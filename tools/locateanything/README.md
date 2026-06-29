# LocateAnything Local Runner

This folder adds a small local setup for downloading and testing NVIDIA `LocateAnything-3B` on a laptop or PC.

## Important license note

The model weights are not stored in this repository. They are downloaded from Hugging Face when you run the downloader.

Check NVIDIA's model license before using this in a product. At the time this runner was added, `nvidia/LocateAnything-3B` was listed for non-commercial use, so treat this as a local research/testing demo unless you have commercial permission from NVIDIA.

## 1. Create a Python environment

```bash
cd tools/locateanything
python -m venv .venv
```

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Linux/macOS:

```bash
source .venv/bin/activate
```

Install dependencies from the repo root:

```bash
pip install -r tools/locateanything/requirements.txt
```

## 2. Download the model

From the repo root:

```bash
python tools/locateanything/download_model.py
```

The default download location is:

```text
models/LocateAnything-3B
```

The `models/` folder is ignored by Git so the large model files do not get committed.

## 3. Run the local app

```bash
python tools/locateanything/app.py --model-path models/LocateAnything-3B
```

Open the local Gradio URL printed in your terminal, upload an image, and ask for what you want to locate.

Example prompts:

```text
Locate the M-Pesa amount in this screenshot.
Locate the sender name in this receipt screenshot.
Find the button labeled Pay.
Find the car in this image and return its location.
```

## Laptop/PC notes

- Best experience: NVIDIA GPU with 8GB+ VRAM.
- Better: 12GB to 16GB+ VRAM.
- CPU-only can be very slow.
- Keep the downloaded model local; do not commit model weights into GitHub.

## File overview

| File | Purpose |
|---|---|
| `download_model.py` | Downloads `nvidia/LocateAnything-3B` from Hugging Face. |
| `app.py` | Starts a simple local Gradio web app. |
| `requirements.txt` | Python dependencies. |
