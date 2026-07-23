"""Post processed frames to the existing KobeSports backend.

Builds exactly the IngestFrameDto the NestJS `POST /sports/vision/ingest/:matchId`
endpoint expects (see server/src/sports/dto/sports.dto.ts). The payload builder
is pure/stdlib so its shape is unit-testable; the HTTP send uses urllib so the
worker has no hard `requests` dependency.
"""
from __future__ import annotations
import json
import urllib.request
import urllib.error
from typing import Dict, List, Optional, Sequence


def build_tracked_object(track_id: int, cls: str, x: float, y: float, confidence: float,
                         speed: Optional[float] = None, jersey_number: Optional[int] = None,
                         bbox: Optional[Sequence[float]] = None) -> Dict:
    """One TrackedObject matching the DTO (trackId/class/x/y/confidence/…)."""
    obj: Dict = {
        "trackId": int(track_id),
        "class": cls,
        "x": round(float(x), 3),
        "y": round(float(y), 3),
        "confidence": round(float(confidence), 3),
    }
    if speed is not None:
        obj["speed"] = round(float(speed), 2)
    if jersey_number is not None:
        obj["jerseyNumber"] = int(jersey_number)
    if bbox is not None:
        obj["metadata"] = [round(float(v), 1) for v in bbox]
    return obj


def build_frame(frame_number: int, match_clock: float, half: int, objects: List[Dict],
                event: Optional[Dict] = None, homography: Optional[List[List[float]]] = None) -> Dict:
    """One IngestFrameDto."""
    frame: Dict = {
        "frameNumber": int(frame_number),
        "matchClock": round(float(match_clock), 2),
        "half": int(half),
        "objects": objects,
    }
    if event is not None:
        frame["event"] = event
    if homography is not None:
        frame["homography"] = homography
    return frame


class IngestClient:
    def __init__(self, base_url: str, match_id: str, token: Optional[str] = None, timeout: float = 3.0):
        self.url = f"{base_url.rstrip('/')}/sports/vision/ingest/{match_id}"
        self.token = token
        self.timeout = timeout

    def send(self, frame: Dict) -> bool:
        data = json.dumps(frame).encode("utf-8")
        req = urllib.request.Request(self.url, data=data, method="POST")
        req.add_header("Content-Type", "application/json")
        if self.token:
            req.add_header("Authorization", f"Bearer {self.token}")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return 200 <= resp.status < 300
        except (urllib.error.URLError, TimeoutError) as e:
            # Never let a dropped POST kill the capture loop.
            print(f"[ingest] send failed: {e}")
            return False
