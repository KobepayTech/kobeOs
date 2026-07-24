"""kobe-sports-vision worker entrypoint.

Reads a video source (RTSP camera, file, or webcam index), runs the detector +
Supervision tracker, feeds the analytics pipeline, and POSTs each processed
frame to the existing KobeSports `/sports/vision/ingest/:matchId` API.

    python -m kobe_vision.worker --config config.yaml

The CV imports are lazy (inside main), so `--help` and the analytics tests work
without torch/opencv installed.
"""
from __future__ import annotations
import argparse
import time

from .config import Config
from .pitch import PitchMapper
from .pipeline import AnalyticsPipeline
from .ingest import IngestClient


def main() -> None:
    ap = argparse.ArgumentParser(prog="kobe-sports-vision")
    ap.add_argument("--config", default="config.yaml")
    ap.add_argument("--half", type=int, default=1)
    args = ap.parse_args()

    cfg = Config.load(args.config)
    if not cfg.match_id:
        raise SystemExit("match_id is required (config or KOBE_VISION_MATCH_ID).")

    # Lazy CV imports so the module loads without torch/opencv.
    import cv2  # type: ignore
    from .tracking import SupervisionTracker

    if cfg.pixel_corners is None:
        raise SystemExit("pixel_corners not calibrated — set 4 pixel points in the config.")
    mapper = PitchMapper.calibrate(cfg.pixel_corners, cfg.pitch_corners)

    if cfg.detector_backend == "rfdetr":
        from .detector_rfdetr import RFDetrDetector          # Apache-2.0
        detector = RFDetrDetector(weights=cfg.weights, conf=cfg.conf)
    elif cfg.detector_backend == "ultralytics":
        from .detector import YoloDetector                   # AGPL-3.0 / Enterprise
        if not cfg.weights:
            raise SystemExit("ultralytics backend needs `weights` (a .pt file).")
        detector = YoloDetector(cfg.weights, conf=cfg.conf, imgsz=cfg.imgsz, device=cfg.device)
    else:
        raise SystemExit(f"unknown detector_backend: {cfg.detector_backend!r}")
    tracker = SupervisionTracker(frame_rate=cfg.frame_rate)
    pipeline = AnalyticsPipeline(mapper, frame_rate=cfg.frame_rate)
    ingest = IngestClient(cfg.backend_url, cfg.match_id, token=cfg.token)

    source = int(cfg.source) if cfg.source.isdigit() else cfg.source
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        raise SystemExit(f"could not open source: {cfg.source}")

    detect_every = max(1, cfg.detect_every)
    print(f"[worker] streaming {cfg.source} -> {ingest.url} (device={cfg.device or 'auto'}, "
          f"imgsz={cfg.imgsz}, detect_every={detect_every})")
    frame_number = 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            # CPU mode: only run the heavy detector every Nth frame. The match
            # clock uses the real frame number, so speeds/distances stay correct;
            # temporal resolution just drops N-fold.
            if frame_number % detect_every == 0:
                detections = detector.detect(frame)
                tracks = tracker.update(detections)
                payload = pipeline.process(frame_number, args.half, tracks)
                if (frame_number // detect_every) % max(1, cfg.ingest_every) == 0:
                    ingest.send(payload)
            frame_number += 1
    except KeyboardInterrupt:
        pass
    finally:
        cap.release()
        snap = pipeline.analytics_snapshot()
        print(f"[worker] done after {frame_number} frames. Possession: {snap.get('possession')}")


if __name__ == "__main__":
    main()
