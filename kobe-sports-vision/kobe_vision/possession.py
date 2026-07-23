"""Possession, passes, interceptions and possession-% — the football rules layer.

Supervision/YOLO give us tracked positions; the football meaning is ours:
 - the player nearest the ball (within a radius) is the *candidate* holder;
 - possession is only assigned once one candidate holds it for N consecutive
   frames (debounce), so a ball rolling past a player doesn't flip possession;
 - a change of confirmed holder is a PASS (same team) or an INTERCEPTION /
   TURNOVER (different team);
 - possession % is time-weighted by confirmed holder's team.

Pure stdlib, unit-testable. Distances are in pitch-normalised units (0..100).
"""
from __future__ import annotations
from dataclasses import dataclass, field
from math import hypot
from typing import Dict, List, Optional, Tuple

Player = Tuple[int, str, float, float]  # (trackId, team, x, y)


def _team_of(cls: str) -> Optional[str]:
    if cls.endswith("_home") or cls == "home":
        return "home"
    if cls.endswith("_away") or cls == "away":
        return "away"
    return None


@dataclass
class PossessionEvent:
    type: str            # 'PASS' | 'INTERCEPTION' | 'TURNOVER'
    from_track: int
    to_track: int
    team: str
    frame: int


@dataclass
class PossessionState:
    holder: Optional[int] = None
    holder_team: Optional[str] = None
    home_frames: int = 0
    away_frames: int = 0
    passes_home: int = 0
    passes_away: int = 0
    interceptions: int = 0
    _cand: Optional[int] = None
    _cand_team: Optional[str] = None
    _cand_streak: int = 0
    events: List[PossessionEvent] = field(default_factory=list)


class PossessionEngine:
    def __init__(self, control_frames: int = 3, radius: float = 3.0):
        self.control_frames = control_frames
        self.radius = radius  # pitch-normalised units (~3 => ~3m of length)
        self.state = PossessionState()

    def update(self, frame: int, ball: Optional[Tuple[float, float]], players: List[Player]) -> Optional[PossessionEvent]:
        s = self.state
        # Time-weight possession by the currently confirmed holder.
        if s.holder_team == "home":
            s.home_frames += 1
        elif s.holder_team == "away":
            s.away_frames += 1

        if ball is None or not players:
            s._cand_streak = 0
            return None

        bx, by = ball
        nearest = min(players, key=lambda p: hypot(p[2] - bx, p[3] - by))
        dist = hypot(nearest[2] - bx, nearest[3] - by)
        if dist > self.radius:
            s._cand = None
            s._cand_streak = 0
            return None

        cand_id, cand_cls = nearest[0], nearest[1]
        cand_team = _team_of(cand_cls)
        if cand_id == s._cand:
            s._cand_streak += 1
        else:
            s._cand, s._cand_team, s._cand_streak = cand_id, cand_team, 1

        event: Optional[PossessionEvent] = None
        if s._cand_streak >= self.control_frames and cand_id != s.holder:
            prev_holder, prev_team = s.holder, s.holder_team
            if prev_holder is not None:
                if prev_team == cand_team:
                    etype = "PASS"
                    if cand_team == "home":
                        s.passes_home += 1
                    elif cand_team == "away":
                        s.passes_away += 1
                else:
                    etype = "INTERCEPTION"
                    s.interceptions += 1
                event = PossessionEvent(etype, prev_holder, cand_id, cand_team or "?", frame)
                s.events.append(event)
            s.holder, s.holder_team = cand_id, cand_team
        return event

    def summary(self) -> dict:
        s = self.state
        total = s.home_frames + s.away_frames
        home_pct = round(100.0 * s.home_frames / total, 1) if total else 0.0
        return {
            "possession": {"home": home_pct, "away": round(100.0 - home_pct, 1) if total else 0.0},
            "passes": {"home": s.passes_home, "away": s.passes_away},
            "interceptions": s.interceptions,
            "holder": s.holder,
            "holderTeam": s.holder_team,
        }
