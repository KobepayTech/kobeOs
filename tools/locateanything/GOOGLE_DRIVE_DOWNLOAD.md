# Download LocateAnything-3B to Google Drive

This is the safest way to put the model into your own Google Drive without sharing your Google password or access token with anyone.

## Recommended method: Google Colab notebook

Open this notebook from the repo:

```text
tools/locateanything/colab_download_to_drive.ipynb
```

Then run each cell.

The notebook will:

1. Mount your Google Drive.
2. Install `huggingface_hub`.
3. Optionally log in to Hugging Face if required.
4. Download `nvidia/LocateAnything-3B` into:

```text
/content/drive/MyDrive/models/LocateAnything-3B
```

In your Google Drive, that becomes:

```text
My Drive/models/LocateAnything-3B
```

## Important

Do not share your Google password, Google Drive private tokens, or Hugging Face token.

If you want other people to download the model from your Drive, confirm the NVIDIA model license allows your use case first. Public Drive links can also hit download quota limits.

For commercial apps, use an official model host or get commercial permission from NVIDIA.

## App path

If your app runs in Colab, use:

```bash
python tools/locateanything/app.py --model-path /content/drive/MyDrive/models/LocateAnything-3B
```

If your app runs on your PC after downloading/syncing the folder from Drive, use the local folder path where Google Drive synced the files.
