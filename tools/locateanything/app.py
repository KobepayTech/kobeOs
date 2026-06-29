#!/usr/bin/env python3
"""Small local web app for NVIDIA LocateAnything-3B.

Run:
    python tools/locateanything/app.py --model-path models/LocateAnything-3B

Then open the local Gradio URL printed in the terminal.
"""

from __future__ import annotations

import argparse
from functools import lru_cache
from pathlib import Path
from typing import Any

import gradio as gr
from PIL import Image
from transformers import pipeline


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run LocateAnything locally")
    parser.add_argument(
        "--model-path",
        default="models/LocateAnything-3B",
        help="Local model folder or Hugging Face repo ID",
    )
    parser.add_argument(
        "--max-new-tokens",
        type=int,
        default=512,
        help="Maximum tokens to generate",
    )
    parser.add_argument(
        "--share",
        action="store_true",
        help="Create a temporary public Gradio link",
    )
    return parser.parse_args()


ARGS = parse_args()


@lru_cache(maxsize=1)
def get_pipe() -> Any:
    model_path = str(Path(ARGS.model_path).expanduser())
    return pipeline(
        "image-text-to-text",
        model=model_path,
        trust_remote_code=True,
        device_map="auto",
    )


def locate(image: Image.Image | None, instruction: str) -> str:
    if image is None:
        return "Upload an image first."

    prompt = instruction.strip() or "Locate the main object in this image."
    pipe = get_pipe()

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image", "image": image},
                {"type": "text", "text": prompt},
            ],
        }
    ]

    try:
        output = pipe(text=messages, max_new_tokens=ARGS.max_new_tokens)
    except TypeError:
        # Some Transformers/model-card examples use `url` instead of a PIL image.
        # Save a temporary image and retry with a local path.
        tmp_path = Path("tools/locateanything/.tmp_input.png")
        tmp_path.parent.mkdir(parents=True, exist_ok=True)
        image.save(tmp_path)
        messages[0]["content"][0] = {"type": "image", "url": str(tmp_path)}
        output = pipe(text=messages, max_new_tokens=ARGS.max_new_tokens)

    return str(output)


def main() -> None:
    demo = gr.Interface(
        fn=locate,
        inputs=[
            gr.Image(type="pil", label="Image"),
            gr.Textbox(
                label="Instruction",
                value="Locate the person or object in this image and return the location/box.",
                lines=3,
            ),
        ],
        outputs=gr.Textbox(label="Model output", lines=12),
        title="LocateAnything Local Runner",
        description=(
            "Upload an image and ask LocateAnything-3B to find an object, text, "
            "GUI element, document region, or other visible target."
        ),
    )
    demo.launch(share=ARGS.share)


if __name__ == "__main__":
    main()
