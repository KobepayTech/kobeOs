"""Per-frame orchestration: detections -> tracks -> pitch -> analytics -> frame.

This is the KobeSports analytics engine that sits between Supervision and the
ingest API. It is deliberately decoupled from OpenCV/YOLO: it takes already-
tracked objects (trackId, class, conf, bbox) plus a PitchMapper and produces the
IngestFrameDto payload, updating speed/distance/heatmaps, possession/passes and
zone/line counters. That keeps it unit-testable with synthetic tracks.
"""
from __future__ import annotations
from typing import Dict, List, Optional, Tuple

from .pitch import PitchMapper
from .kinematics import KinematicsEngine
from .possession import PossessionEngine
from .zones import PolygonZone, LineZone, standard_football_zones
from .ingest import build_tracked_object, build_frame

TrackedInput = Tuple[int, str, float, Tuple[float, float, float, float]]  # (trackId, cls, conf, xyxy)


class AnalyticsPipeline:
    def __init__(self, mapper: PitchMapper, frame_rate: int = 25,
                 zones: Optional[List[PolygonZone]] = None,
                 lines: Optional[List[LineZone]] = None):
        self.mapper = mapper
        self.frame_rate = max(1, frame_rate)
        self.kin = KinematicsEngine()
        self.poss = PossessionEngine()
        self.zones = zones if zones is not None else standard_football_zones()
        self.lines = lines or []

    def process(self, frame_number: int, half: int, tracks: List[TrackedInput],
                match_clock: Optional[float] = None) -> Dict:
        t = frame_number / self.frame_rate if match_clock is None else match_clock

        objects: List[Dict] = []
        player_pts: List[Tuple[int, Tuple[float, float]]] = []
        players_for_poss = []
        ball_pt: Optional[Tuple[float, float]] = None

        for track_id, cls, conf, bbox in tracks:
            x, y = self.mapper.map_bbox(bbox)
            speed = None
            if cls == "ball":
                ball_pt = (x, y)
            else:
                speed = self.kin.update(track_id, x, y, t)
                player_pts.append((track_id, (x, y)))
                players_for_poss.append((track_id, cls, x, y))
            objects.append(build_tracked_object(track_id, cls, x, y, conf, speed=speed, bbox=bbox))

        # Zones + lines operate on player ground points.
        for z in self.zones:
            z.update(player_pts)
        for ln in self.lines:
            ln.update(player_pts)

        # Possession / passes -> optional per-frame event.
        event = None
        pe = self.poss.update(frame_number, ball_pt, players_for_poss)
        if pe is not None:
            event = {"type": pe.type, "fromTrackId": pe.from_track, "toTrackId": pe.to_track, "team": pe.team}

        return build_frame(frame_number, t, half, objects, event=event, homography=self.mapper.h)

    def analytics_snapshot(self) -> Dict:
        """Roll-up for the /sports analytics endpoint (possession, zones, per-player)."""
        return {
            **self.poss.summary(),
            "zones": [z.report() for z in self.zones],
            "lines": [ln.report() for ln in self.lines],
            "players": [self.kin.summary(tid) for tid in self.kin.players],
        }
