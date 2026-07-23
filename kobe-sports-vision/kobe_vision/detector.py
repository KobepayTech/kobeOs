"""Ultralytics YOLO detector wrapper — version-agnostic (YOLO11 / YOLO26 / …).

Lazy-imports ultralytics so the analytics layer + tests run without torch. You
supply the weights you are LICENSED to use (see README: Ultralytics is AGPL-3.0
or Enterprise). This wrapper only calls the public `model()` API, so it works
across YOLO versions; whichever weights you load determine the classes.

Maps the model's class names to KobeSports classes:
  player_home | player_away | goalkeeper_home | goalkeeper_away | referee | ball
via a configurable name map (your custom detector should already output these).
"""
from __future__ import annotations
from typing import Dict, List, Optional, Sequence, Tuple

Detection = Tuple[str, float, Tuple[float, float, float, float]]  # (cls, conf, xyxy)


class YoloDetector:
    def __init__(self, weights: str, conf: float = 0.25, imgsz: int = 1280,
                 device: Optional[str] = None, name_map: Optional[Dict[str, str]] = None):
        try:
            from ultralytics import YOLO  # noqa: WPS433 (lazy, optional dep)
        except Exception as e:  # pragma: no cover - only hit without the dep
            raise RuntimeError(
                "ultralytics is not installed. `pip install ultralytics` "
                "(AGPL-3.0 / Enterprise — see README) to run detection."
            ) from e
        self.model = YOLO(weights)
        self.conf = conf
        self.imgsz = imgsz
        self.device = device
        self.name_map = name_map or {}

    def detect(self, frame) -> List[Detection]:
        """Run one frame; return KobeSports-classed detections."""
        results = self.model(frame, conf=self.conf, imgsz=self.imgsz, device=self.device, verbose=False)
        out: List[Detection] = []
        for r in results:
            names = r.names
            boxes = getattr(r, "boxes", None)
            if boxes is None:
                continue
            for b in boxes:
                cls_idx = int(b.cls[0])
                raw = names.get(cls_idx, str(cls_idx)) if isinstance(names, dict) else names[cls_idx]
                cls = self.name_map.get(raw, raw)
                conf = float(b.conf[0])
                x1, y1, x2, y2 = (float(v) for v in b.xyxy[0])
                out.append((cls, conf, (x1, y1, x2, y2)))
        return out
