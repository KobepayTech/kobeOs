from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
from pathlib import Path
from typing import Any

PROFILES = {
    "lite": [
        "yolo26s.pt",
        "yolo26s-pose.pt",
        "yoloe-26s-seg.pt",
    ],
    "balanced": [
        "yolo26m.pt",
        "yolo26m-pose.pt",
        "yolo26m-seg.pt",
        "yoloe-26m-seg.pt",
        "yolo26m-cls.pt",
    ],
    "full": [
        "yolo26s.pt",
        "yolo26m.pt",
        "yolo26m-pose.pt",
        "yolo26m-seg.pt",
        "yoloe-26m-seg.pt",
        "yolo26m-cls.pt",
        "yolo26m-depth.pt",
        "yolo26m-obb.pt",
    ],
}

SPORTS: dict[str, dict[str, Any]] = {
    "football": {
        "classes": [
            "home_player", "away_player", "goalkeeper", "referee",
            "assistant_referee", "football", "goalpost", "corner_flag",
            "substitute", "medical_staff",
        ],
        "tasks": ["detection", "pose", "segmentation", "open_vocabulary"],
        "custom_weights": [
            "players-referees.pt", "ball-small-object.pt",
            "pitch-keypoints-pose.pt", "jersey-region.pt",
        ],
    },
    "boxing": {
        "classes": [
            "red_corner_fighter", "blue_corner_fighter", "referee",
            "left_glove", "right_glove", "head", "torso", "ring_rope",
        ],
        "tasks": ["detection", "pose", "segmentation", "classification"],
        "custom_weights": ["fighters.pt", "gloves-head-body.pt", "boxing-actions-cls.pt"],
    },
    "basketball": {
        "classes": [
            "home_player", "away_player", "referee", "basketball",
            "hoop", "backboard", "court_keypoint",
        ],
        "tasks": ["detection", "pose", "segmentation", "open_vocabulary"],
        "custom_weights": ["players-ball-hoop.pt", "court-keypoints-pose.pt"],
    },
    "volleyball": {
        "classes": [
            "home_player", "away_player", "referee", "volleyball",
            "net", "antenna", "court_keypoint",
        ],
        "tasks": ["detection", "pose", "segmentation", "open_vocabulary"],
        "custom_weights": ["players-ball-net.pt", "court-keypoints-pose.pt"],
    },
    "mma": {
        "classes": [
            "fighter_a", "fighter_b", "referee", "glove",
            "head", "torso", "cage", "corner",
        ],
        "tasks": ["detection", "pose", "segmentation", "classification"],
        "custom_weights": ["fighters-referee.pt", "mma-actions-cls.pt"],
    },
    "tennis": {
        "classes": [
            "player_a", "player_b", "tennis_ball", "racket",
            "net", "chair_umpire", "line_judge", "court_keypoint",
        ],
        "tasks": ["detection", "pose", "segmentation", "open_vocabulary"],
        "custom_weights": ["players-ball-racket.pt", "court-keypoints-pose.pt"],
    },
    "cricket": {
        "classes": [
            "batter", "bowler", "wicketkeeper", "fielder", "umpire",
            "cricket_ball", "bat", "stump", "bail", "boundary_marker",
        ],
        "tasks": ["detection", "pose", "segmentation", "open_vocabulary"],
        "custom_weights": ["players-ball-bat-wicket.pt", "pitch-keypoints-pose.pt"],
    },
    "athletics": {
        "classes": [
            "athlete", "bib_number_region", "lane_marker",
            "starting_block", "finish_line", "baton", "hurdle",
        ],
        "tasks": ["detection", "pose", "segmentation", "classification"],
        "custom_weights": ["athletes-equipment.pt", "track-keypoints-pose.pt"],
    },
    "motorsport": {
        "classes": [
            "race_car", "race_motorcycle", "driver", "rider", "helmet",
            "pit_crew", "flag", "track_boundary", "number_region",
        ],
        "tasks": ["detection", "segmentation", "classification", "open_vocabulary", "obb"],
        "custom_weights": ["vehicles-drivers.pt", "track-flags.pt", "vehicle-number-region.pt"],
    },
}

TASK_MODEL_KEYS = {
    "detection": "detect",
    "pose": "pose",
    "segmentation": "segment",
    "open_vocabulary": "open_vocab",
    "classification": "classify",
    "depth": "depth",
    "obb": "obb",
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download_asset(filename: str, shared: Path) -> Path:
    from ultralytics.utils.downloads import attempt_download_asset

    old_cwd = Path.cwd()
    try:
        os.chdir(shared)
        downloaded = Path(attempt_download_asset(filename)).resolve()
    finally:
        os.chdir(old_cwd)

    if not downloaded.exists():
        raise RuntimeError(f"Ultralytics did not produce {filename}")

    target = (shared / filename).resolve()
    if downloaded != target:
        shutil.copy2(downloaded, target)
    return target


def validate_model(path: Path) -> None:
    if path.name.startswith("yoloe-"):
        from ultralytics import YOLOE
        YOLOE(str(path))
    else:
        from ultralytics import YOLO
        YOLO(str(path))


def choose_task_models(profile: str) -> dict[str, str]:
    scale = "s" if profile == "lite" else "m"
    result = {
        "detect": f"yolo26{scale}.pt",
        "pose": f"yolo26{scale}-pose.pt",
        "segment": f"yolo26{scale}-seg.pt" if profile != "lite" else f"yoloe-26{scale}-seg.pt",
        "open_vocab": f"yoloe-26{scale}-seg.pt",
        "classify": f"yolo26{scale}-cls.pt" if profile != "lite" else "",
        "depth": f"yolo26{scale}-depth.pt" if profile == "full" else "",
        "obb": f"yolo26{scale}-obb.pt" if profile == "full" else "",
    }
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    parser.add_argument("--profile", choices=sorted(PROFILES), default="balanced")
    args = parser.parse_args()

    root = Path(args.root).expanduser().resolve()
    shared = root / "shared"
    sports_root = root / "sports"
    shared.mkdir(parents=True, exist_ok=True)
    sports_root.mkdir(parents=True, exist_ok=True)

    report: list[str] = []
    downloaded_paths: dict[str, Path] = {}

    print(f"Destination: {root}")
    print(f"Profile: {args.profile}")
    print()

    for index, filename in enumerate(PROFILES[args.profile], start=1):
        print(f"[{index}/{len(PROFILES[args.profile])}] Downloading {filename}...")
        path = download_asset(filename, shared)
        print(f"    Validating {path.name}...")
        validate_model(path)
        size = path.stat().st_size
        digest = sha256_file(path)
        downloaded_paths[filename] = path
        report.append(f"{filename}\t{size}\t{digest}")
        print(f"    OK: {size / 1024 / 1024:.1f} MB")

    task_models = choose_task_models(args.profile)

    model_map: dict[str, Any] = {
        "profile": args.profile,
        "root": str(root),
        "shared_models": {
            key: str((shared / filename).resolve()) if filename else None
            for key, filename in task_models.items()
        },
        "sports": {},
        "important": (
            "These are pretrained foundation models. Sport-specific classes listed "
            "below require fine-tuning; place trained weights in each sport/custom folder."
        ),
    }

    for sport, config in SPORTS.items():
        sport_dir = sports_root / sport
        custom_dir = sport_dir / "custom"
        custom_dir.mkdir(parents=True, exist_ok=True)

        (sport_dir / "classes.txt").write_text(
            "\n".join(config["classes"]) + "\n", encoding="utf-8"
        )
        (custom_dir / "PLACE_CUSTOM_WEIGHTS_HERE.txt").write_text(
            "Train or obtain sport-specific weights and place them here:\n\n"
            + "\n".join(f"- {name}" for name in config["custom_weights"])
            + "\n\nDo not rename a generic COCO model as a custom sports model.\n",
            encoding="utf-8",
        )

        mapped = {
            TASK_MODEL_KEYS[task]: task_models.get(TASK_MODEL_KEYS[task])
            for task in config["tasks"]
            if task in TASK_MODEL_KEYS and task_models.get(TASK_MODEL_KEYS[task])
        }
        sport_config = {
            "sport": sport,
            "foundation_models": {
                task: str((shared / filename).resolve())
                for task, filename in mapped.items()
            },
            "custom_classes": config["classes"],
            "expected_custom_weights": config["custom_weights"],
            "custom_directory": str(custom_dir.resolve()),
        }
        (sport_dir / "model-map.json").write_text(
            json.dumps(sport_config, indent=2), encoding="utf-8"
        )
        model_map["sports"][sport] = sport_config

    (root / "sports-model-map.json").write_text(
        json.dumps(model_map, indent=2), encoding="utf-8"
    )
    (root / "download_report.txt").write_text(
        "filename\tbytes\tsha256\n" + "\n".join(report) + "\n",
        encoding="utf-8",
    )

    print()
    print("KobeSports model foundation installed successfully.")
    print(f"Shared weights: {shared}")
    print(f"Per-sport maps: {sports_root}")
    print(f"Main map: {root / 'sports-model-map.json'}")
    print()
    print("IMPORTANT: The downloaded checkpoints are foundation models.")
    print("Train the custom classes in each sport's classes.txt before production scoring.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nCancelled.", file=sys.stderr)
        raise SystemExit(130)
    except Exception as exc:
        print(f"\nERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
