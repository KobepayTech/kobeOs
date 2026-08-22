"""Supervision-based multi-object tracking (assigns stable track IDs).

Lazy-imports supervision so the analytics layer + tests run without it.

Note (per the Supervision roadmap): the built-in `sv.ByteTrack` is slated for
removal in Supervision 0.31; new code should use `ByteTrackTracker` from the
separate `trackers` package. This wrapper prefers the new package and falls
back to `sv.ByteTrack` on older installs, so it keeps working either way.
"""
from __future__ import annotations
from typing import List, Tuple

from .detector import Detection

Tracked = Tuple[int, str, float, Tuple[float, float, float, float]]  # (trackId, cls, conf, xyxy)


class SupervisionTracker:
    def __init__(self, frame_rate: int = 25):
        try:
            import supervision as sv  # noqa: WPS433
        except Exception as e:  # pragma: no cover
            raise RuntimeError("supervision is not installed. `pip install supervision`.") from e
        self.sv = sv
        self._tracker = self._make_tracker(frame_rate)

    def _make_tracker(self, frame_rate: int):
        # Preferred: the standalone `trackers` package (future-proof).
        try:
            from trackers import ByteTrackTracker  # type: ignore
            return ByteTrackTracker()
        except Exception:
            pass
        # Fallback: deprecated but present on <0.31.
        return self.sv.ByteTrack(frame_rate=frame_rate)

    def update(self, detections: List[Detection]) -> List[Tracked]:
        sv = self.sv
        if not detections:
            empty = sv.Detections.empty()
            self._tracker.update_with_detections(empty)
            return []
        import numpy as np
        xyxy = np.array([d[2] for d in detections], dtype=float)
        conf = np.array([d[1] for d in detections], dtype=float)
        classes = [d[0] for d in detections]
        class_ids = np.array([hash(c) % 100000 for c in classes], dtype=int)
        dets = sv.Detections(xyxy=xyxy, confidence=conf, class_id=class_ids)
        tracked = self._tracker.update_with_detections(dets)

        out: List[Tracked] = []
        for i in range(len(tracked)):
            tid = int(tracked.tracker_id[i]) if tracked.tracker_id is not None else -1
            box = tuple(float(v) for v in tracked.xyxy[i])
            # recover the original class label by matching the class_id hash
            cid = int(tracked.class_id[i]) if tracked.class_id is not None else -1
            cls = next((c for c in classes if hash(c) % 100000 == cid), "unknown")
            cf = float(tracked.confidence[i]) if tracked.confidence is not None else 0.0
            out.append((tid, cls, cf, box))  # type: ignore[arg-type]
        return out
