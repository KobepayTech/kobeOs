"""Worker configuration (from a YAML file or env). Stdlib-only parsing of the
subset we need, so PyYAML is optional."""
from __future__ import annotations
import json
import os
from dataclasses import dataclass, field
from typing import List, Optional, Tuple


@dataclass
class Config:
    source: str = "0"                       # RTSP url, file path, or camera index
    weights: str = "models/football/players-yolo26m.pt"
    ball_weights: Optional[str] = None       # optional dedicated small-ball model
    match_id: str = ""
    backend_url: str = "http://127.0.0.1:3000"
    token: Optional[str] = None
    frame_rate: int = 25
    imgsz: int = 1280
    conf: float = 0.25
    device: Optional[str] = None             # 'cuda:0' | 'cpu' | None(auto)
    # Four pixel points and the pitch points they map to (0..100), for calibration.
    pixel_corners: Optional[List[Tuple[float, float]]] = None
    pitch_corners: List[Tuple[float, float]] = field(
        default_factory=lambda: [(0, 0), (100, 0), (100, 100), (0, 100)]
    )
    attack_direction: str = "left_to_right"
    ingest_every: int = 1                    # post every Nth frame

    @classmethod
    def load(cls, path: Optional[str] = None) -> "Config":
        data: dict = {}
        if path and os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                text = f.read()
            try:
                import yaml  # optional
                data = yaml.safe_load(text) or {}
            except Exception:
                data = json.loads(text)  # allow JSON configs without PyYAML
        # env overrides
        for k in ("source", "weights", "match_id", "backend_url", "token", "device"):
            env = os.environ.get(f"KOBE_VISION_{k.upper()}")
            if env:
                data[k] = env
        known = {f for f in cls().__dict__}
        return cls(**{k: v for k, v in data.items() if k in known})
