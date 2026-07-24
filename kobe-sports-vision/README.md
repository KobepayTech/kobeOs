# kobe-sports-vision

A standalone Python vision worker for **KobeSports**. It runs a YOLO detector
plus **Roboflow Supervision** (tracking, pitch geometry, zones, line crossings),
computes football analytics (speed/distance/heatmaps, possession/passes), and
POSTs each processed frame to the existing NestJS backend at
`POST /sports/vision/ingest/:matchId` — the endpoint and downstream
(offside detection, player stats, WebSocket broadcast) already exist.

```
RTSP cameras / video  →  YOLO detector  →  Supervision (track + geometry)
                      →  Kobe analytics (possession, passes, speed, zones)
                      →  /sports/vision/ingest/:matchId  →  WebSocket  →  clients
```

## ⚠️ Licensing — read before commercial use

KobeOS is a commercial, closed, self-distributed product, so the detector's
licence matters. The worker supports two backends (config `detector_backend`):

- **`rfdetr` (DEFAULT) — Apache-2.0, licence-clean.** RF-DETR (Roboflow) needs
  no fee and no open-sourcing. Its COCO base already detects `person` +
  `sports ball`, so you can pilot with **no custom training**. This is the way
  to **avoid the Ultralytics Enterprise licence entirely.**
- **`ultralytics` (OPT-IN) — AGPL-3.0 / Enterprise.** Ultralytics YOLO (any
  version, incl. YOLO11/YOLO26 — and AGPL wrappers like Tencent YOLO-Master)
  require a paid Enterprise licence for closed commercial distribution. Only
  enable this backend if you hold that licence.

Other permissive alternatives (Apache-2.0) that fit Supervision if you prefer:
**RTMDet** (MMDetection), **DETR-family** (HF Transformers), **YOLOX**.

- **Roboflow Supervision is MIT** — safe to use and bundle.
- The detector backends are isolated in `detector_rfdetr.py` / `detector.py`,
  so the licence choice touches one file. This worker's own code (analytics,
  geometry, ingest) is part of KobeOS.

### Team home/away with RF-DETR
COCO gives generic `person` → mapped to `"player"`. The built-in
**jersey-colour team classifier** (`team_classifier.py`, on by default via
`team_split: true`) then splits players into `player_home` / `player_away`:
it samples each jersey's torso colour, clusters players into two teams by
lighting-invariant chromaticity, and stabilises each track with a majority
vote — so possession/passes work with the licence-clean RF-DETR base and no
custom training. Referees still land in a team until you use a fine-tuned
checkpoint with a dedicated referee class.

## Architecture

| Module | Role | Tested here |
|---|---|---|
| `detector_rfdetr.py` | **RF-DETR backend (Apache-2.0, default)** — COCO person+ball, no training | needs torch |
| `detector.py` | Ultralytics YOLO backend (AGPL/Enterprise, opt-in), version-agnostic | needs GPU/weights |
| `tracking.py` | Supervision tracker → stable track IDs (prefers the `trackers` package's `ByteTrackTracker`, falls back to `sv.ByteTrack`) | needs supervision |
| `pitch.py` | 4-point homography, pixel → pitch (0..100) | ✅ pure stdlib |
| `kinematics.py` | speed (km/h), distance, sprints, heatmaps | ✅ |
| `possession.py` | nearest-player, control-for-N-frames, passes/interceptions, possession % | ✅ |
| `zones.py` | `PolygonZone` + `LineZone` on pitch coords | ✅ |
| `ingest.py` | builds + POSTs the exact `IngestFrameDto` (stdlib urllib) | ✅ |
| `pipeline.py` | orchestrates detections → frame payload + analytics snapshot | ✅ |
| `worker.py` | capture loop (RTSP/file/webcam) | needs opencv |

The analytics/geometry layer is **pure stdlib and unit-tested** so the contract
and football maths are verified without a GPU; only YOLO + capture need hardware.

## Run

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt              # installs ultralytics (AGPL) — see above
cp config.example.yaml config.yaml           # then edit: source, match_id, token, calibration
python -m kobe_vision.worker --config config.yaml --half 1
```

Calibration: set `pixel_corners` (4 points in the camera frame) and the
`pitch_corners` they map to (default = pitch corners 0..100), then every
detection is transformed to pitch coordinates automatically.

## Running on a normal desktop CPU (no GPU)

It works for **one camera at reduced settings** — good for piloting and the
"slow" analytics (possession, zones, heatmaps, distance covered, formations).
Precise ball touches / fast events degrade; that's a GPU job.

Set `device: "cpu"` and the worker auto-applies a CPU preset (any value you set
explicitly still wins):

- `imgsz` → 640 (nano/small models are near real-time at 640 on CPU)
- `detect_every` → 3 (runs the detector every 3rd frame; the match clock uses
  the real frame number, so speeds/distances stay correct — only temporal
  resolution drops)

For more CPU speed:

- Use a **nano** player model (`yolo26n` / `yolo11n`), not m/l/x.
- **Drop the separate high-res ball model** (1280–1920px is the biggest CPU cost)
  or run it rarely.
- **Export to ONNX or Intel OpenVINO** (`yolo export format=openvino`) — a large
  speedup on Intel CPUs vs PyTorch.
- One camera, not four; raise `detect_every` to 4–5 if it can't keep up.

Realistic: ~5–15 effective FPS on a modern desktop CPU, single camera.

## Test (no GPU needed)

```bash
python tests/test_analytics.py        # 8 tests: pitch, kinematics, possession, zones, contract
```

## Notes / not-included

Per the plan, this worker supplies detections, tracking, geometry and the
analytics layer. It does **not** provide a trained football detector, jersey-OCR,
cross-camera identity, or VAR decisions — those are your custom models + rules.
Phase 2 (many products/objects per still image, jersey-number OCR) builds on top.
