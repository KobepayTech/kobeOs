# Optional: Push LocateAnything model files to GitHub with Git LFS

This guide explains how to place downloaded model files in this repository using Git LFS.

## Read this first

The actual model files are large binary files and should not be committed with normal Git.

Before pushing the model files, confirm that your use and redistribution are allowed by the model license. At the time this guide was added, NVIDIA listed LocateAnything-3B under a non-commercial NVIDIA license. Treat this as research/testing only unless you have written commercial permission from NVIDIA.

If this repository is public, anyone may be able to download the model files after you push them.

## 1. Install Git LFS

```bash
git lfs install
```

## 2. Clone your repo

```bash
git clone https://github.com/KobepayTech/kobeOs.git
cd kobeOs
```

## 3. Check out the LocateAnything branch

```bash
git fetch origin feat/locateanything-local-runner
git checkout feat/locateanything-local-runner
```

## 4. Install Python dependencies

```bash
pip install -r tools/locateanything/requirements.txt
```

## 5. Download the model into the repo

```bash
python tools/locateanything/download_model.py
```

Default model path:

```text
models/LocateAnything-3B
```

## 6. Track model files with Git LFS

The repo includes `.gitattributes` patterns for common model files:

```text
models/LocateAnything-3B/** filter=lfs diff=lfs merge=lfs -text
*.safetensors filter=lfs diff=lfs merge=lfs -text
*.bin filter=lfs diff=lfs merge=lfs -text
*.gguf filter=lfs diff=lfs merge=lfs -text
*.pt filter=lfs diff=lfs merge=lfs -text
*.pth filter=lfs diff=lfs merge=lfs -text
```

## 7. Commit and push

```bash
git add .gitattributes models/LocateAnything-3B
git commit -m "chore: add LocateAnything model weights with Git LFS"
git push origin feat/locateanything-local-runner
```

## Better option for business apps

For production or business use, keep model weights outside GitHub and download them during setup from a controlled storage location, model registry, or Hugging Face cache. That keeps the repo smaller and reduces license/distribution risk.
