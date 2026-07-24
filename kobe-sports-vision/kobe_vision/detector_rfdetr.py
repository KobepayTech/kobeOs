"""RF-DETR detector backend — Apache-2.0, avoids the Ultralytics AGPL entirely.

RF-DETR (Roboflow) is Apache-2.0 licensed and Supervision-native: its
`predict()` returns an `sv.Detections` directly. Because the base model is
COCO-pretrained, it detects `person` and `sports ball` out of the box — enough
to pilot KobeSports tracking with NO custom training and NO AGPL obligations.

Mapping to KobeSports classes:
 - COCO `person`      -> "player"   (home/away split is a later jersey-colour step)
 - COCO `sports ball` -> "ball"
Point `weights` at a fine-tuned RF-DETR checkpoint later for referee/goalkeeper
classes. Lazy import so the analytics layer + tests don't need torch.
"""
from __future__ import annotations
from typing import Dict, List, Optional, Tuple

Detection = Tuple[str, float, Tuple[float, float, float, float]]  # (cls, conf, xyxy)

# Default COCO name -> KobeSports class. Override via config `class_map`.
DEFAULT_COCO_MAP: Dict[str, str] = {
    "person": "player",
    "sports ball": "ball",
}


class RFDetrDetector:
    def __init__(self, weights: Optional[str] = None, conf: float = 0.4,
                 resolution: int = 728, class_map: Optional[Dict[str, str]] = None):
        try:
            from rfdetr import RFDETRBase  # noqa: WPS433 (lazy, optional dep)
        except Exception as e:  # pragma: no cover
            raise RuntimeError(
                "rfdetr is not installed. `pip install rfdetr` (Apache-2.0) to use "
                "the licence-clean detector backend."
            ) from e
        # A path fine-tunes/loads custom weights; None = COCO-pretrained base.
        self.model = RFDETRBase(pretrain_weights=weights) if weights else RFDETRBase()
        self.conf = conf
        self.resolution = resolution
        self.class_map = class_map or DEFAULT_COCO_MAP

    def _label(self, det, i: int) -> str:
        """Resolve a detection's class name, preferring the model's own names."""
        data = getattr(det, "data", {}) or {}
        names = data.get("class_name")
        if names is not None:
            raw = str(names[i])
        else:
            # Fall back to COCO id lookup via supervision's class list if present.
            try:
                from supervision.dataset.utils import COCO_CLASSES  # type: ignore
                raw = COCO_CLASSES[int(det.class_id[i])]
            except Exception:
                raw = str(int(det.class_id[i]))
        return self.class_map.get(raw, raw)

    def detect(self, frame) -> List[Detection]:
        det = self.model.predict(frame, threshold=self.conf)
        out: List[Detection] = []
        n = len(det.xyxy) if det.xyxy is not None else 0
        for i in range(n):
            cls = self._label(det, i)
            if cls not in ("player", "ball", "referee", "goalkeeper_home", "goalkeeper_away",
                           "player_home", "player_away"):
                continue  # ignore unrelated COCO classes (cars, chairs, …)
            conf = float(det.confidence[i]) if det.confidence is not None else 0.0
            x1, y1, x2, y2 = (float(v) for v in det.xyxy[i])
            out.append((cls, conf, (x1, y1, x2, y2)))
        return out
