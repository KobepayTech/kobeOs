#!/usr/bin/env python3
"""Download NVIDIA LocateAnything-3B to a local folder.

This script downloads the model files into this repository's local `models/`
folder. The model weights are NOT committed to GitHub because they are large
and are governed by NVIDIA's model license.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from huggingface_hub import snapshot_download


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download LocateAnything-3B locally")
    parser.add_argument(
        "--repo-id",
        default="nvidia/LocateAnything-3B",
        help="Hugging Face model repo ID",
    )
    parser.add_argument(
        "--local-dir",
        default="models/LocateAnything-3B",
        help="Where to save the model files",
    )
    parser.add_argument(
        "--revision",
        default=None,
        help="Optional Hugging Face revision/branch/commit",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    local_dir = Path(args.local_dir).expanduser().resolve()
    token = os.environ.get("HF_TOKEN")

    print(f"Downloading {args.repo_id}...")
    print(f"Target folder: {local_dir}")

    downloaded_path = snapshot_download(
        repo_id=args.repo_id,
        local_dir=str(local_dir),
        revision=args.revision,
        token=token,
        local_dir_use_symlinks=False,
    )

    print("Done.")
    print(f"Model available at: {downloaded_path}")
    print("Next: python tools/locateanything/app.py --model-path models/LocateAnything-3B")


if __name__ == "__main__":
    main()
