# KobeOS Qwen 3 edition

This Windows edition uses **Qwen 3-VL 8B** for chat, business assistance, coding,
translation and image understanding. It accepts the standard `qwen3-vl:8b` tag
or the locally converted `kobe-qwen3-vl` tag. It does not substitute a 4B model.

The installer contains no model weights. This keeps downloads and updates small;
Model Manager offers one verified Ollama registry download, approximately 6.2 GB.
After installation the model works offline. An existing compatible model on the
connected Ollama service is reused. Raw Safetensors require conversion first.

The edition has a separate app identity and update channel. All model roles use
Qwen, remote AI fallback is disabled, and only one inference request runs at a time.
The standard edition keeps its existing model options. Separate embedding models
are unavailable; optional specialist services are not part of this model pack.

## Build

Run `npm run electron:build:win:qwen3` on Windows, or manually run the Windows
installer workflow with edition `qwen3-only`. The workflow never publishes this
edition automatically. Outputs are `release/KobeOS-Qwen3-Setup-<version>.exe`
and a portable executable. CUDA runtime libraries are excluded; CPU inference is
supported. Allow at least 16 GB RAM, with other large applications closed.
Actual inference speed depends on the computer and must be measured.

## Reuse a locally converted model

With Ollama's compatible converter, create `kobe-qwen3-vl` from the downloaded
Qwen 3-VL Safetensors using Q4_K_M quantization. Keep the original download.
Then export only the finished model and its vision projector:

```
node scripts/export-qwen3-model-pack.cjs <conversion-cache> <output-folder> <portable-exe>
```

Ship the resulting folder and open `Start KobeOS.cmd`. The launcher selects this
model cache and a dedicated local runtime port, avoiding interference with an
existing Ollama service. Keep the launcher, executable and `qwen3-models` folder
together in a writable location. Model weights remain outside app updates.
The exporter deliberately omits temporary full-precision blobs and other models.

Qwen's upstream model: https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct
(Apache 2.0). Include its license and attribution when distributing model weights.
