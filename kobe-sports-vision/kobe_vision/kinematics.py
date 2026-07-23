"""Per-player kinematics from pitch coordinates: speed, distance, sprints, heatmaps.

Pitch-normalised coords (0..100) are converted to metres using the real pitch
size (default 105 x 68 m) so speeds come out in km/h and distances in metres —
the units KobeSports stores and displays. Pure stdlib, unit-testable.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from math import hypot
from typing import Dict, List, Optional, Tuple

PITCH_LENGTH_M = 105.0
PITCH_WIDTH_M = 68.0
SPRINT_KMH = 25.2  # ~7 m/s, a common sprint threshold


def _to_metres(x: float, y: float, length: float, width: float) -> Tuple[float, float]:
    return (x / 100.0 * length, y / 100.0 * width)


@dataclass
class PlayerKinematics:
    track_id: int
    distance_m: float = 0.0
    top_speed_kmh: float = 0.0
    sprint_count: int = 0
    _last: Optional[Tuple[float, float, float]] = None  # (mx, my, t)
    _in_sprint: bool = False
    heat: Dict[Tuple[int, int], int] = field(default_factory=dict)


class KinematicsEngine:
    """Feed each tracked player's pitch position per frame; get speed + totals."""

    def __init__(self, length: float = PITCH_LENGTH_M, width: float = PITCH_WIDTH_M,
                 heat_cols: int = 24, heat_rows: int = 16, max_kmh: float = 43.0):
        self.length = length
        self.width = width
        self.heat_cols = heat_cols
        self.heat_rows = heat_rows
        self.max_kmh = max_kmh  # reject teleport jitter above this
        self.players: Dict[int, PlayerKinematics] = {}

    def update(self, track_id: int, x: float, y: float, t: float) -> float:
        """Return instantaneous speed (km/h) for this player at time t (seconds)."""
        pk = self.players.setdefault(track_id, PlayerKinematics(track_id))
        mx, my = _to_metres(x, y, self.length, self.width)

        # Heatmap cell (based on pitch-normalised position).
        cx = min(self.heat_cols - 1, max(0, int(x / 100.0 * self.heat_cols)))
        cy = min(self.heat_rows - 1, max(0, int(y / 100.0 * self.heat_rows)))
        pk.heat[(cx, cy)] = pk.heat.get((cx, cy), 0) + 1

        speed_kmh = 0.0
        if pk._last is not None:
            lx, ly, lt = pk._last
            dt = t - lt
            if dt > 0:
                dist = hypot(mx - lx, my - ly)
                speed_kmh = (dist / dt) * 3.6
                if speed_kmh <= self.max_kmh:  # ignore ID-switch teleports
                    pk.distance_m += dist
                    pk.top_speed_kmh = max(pk.top_speed_kmh, speed_kmh)
                    # Count a sprint on the rising edge over the threshold.
                    if speed_kmh >= SPRINT_KMH and not pk._in_sprint:
                        pk.sprint_count += 1
                        pk._in_sprint = True
                    elif speed_kmh < SPRINT_KMH:
                        pk._in_sprint = False
                else:
                    speed_kmh = 0.0
        pk._last = (mx, my, t)
        return round(speed_kmh, 2)

    def summary(self, track_id: int) -> dict:
        pk = self.players.get(track_id)
        if not pk:
            return {"trackId": track_id, "distanceM": 0, "topSpeedKmh": 0, "sprints": 0}
        return {
            "trackId": track_id,
            "distanceM": round(pk.distance_m, 1),
            "topSpeedKmh": round(pk.top_speed_kmh, 1),
            "sprints": pk.sprint_count,
        }

    def heatmap(self, track_id: int) -> List[List[int]]:
        """Dense heat grid [rows][cols] of dwell counts for one player."""
        grid = [[0] * self.heat_cols for _ in range(self.heat_rows)]
        pk = self.players.get(track_id)
        if pk:
            for (cx, cy), n in pk.heat.items():
                grid[cy][cx] = n
        return grid
