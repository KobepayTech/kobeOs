# Origin

KobeOS's Kobe Studio integrates **MoneyPrinterTurbo**
(https://github.com/harry0703/MoneyPrinterTurbo) as the AI short-video
generation backend. MoneyPrinterTurbo ships under the MIT licence — see
`LICENSE` for the full text and upstream attribution. We don't vendor
the Python source; this folder gives you a Docker compose that pulls
the official upstream image (`harry0703/moneyprinterturbo:latest`) and
exposes:

- REST API: `http://localhost:8080` (consumed by KobeOS's VideoGenerationService)
- Streamlit playground: `http://localhost:8501` (optional, for manual testing)

# One-shot start

From the KobeOS repo root:

```bash
docker compose -f vendor/moneyprinter/docker-compose.yml up -d
```

That pulls the official MoneyPrinterTurbo image and starts the API +
WebUI containers. KobeOS's video-generation backend auto-points at
`http://localhost:8080` unless `MONEY_PRINTER_BASE_URL` is set.

To stop it:

```bash
docker compose -f vendor/moneyprinter/docker-compose.yml down
```

# First-run config

KobeOS ships a `config.toml.example` in this folder that points
MoneyPrinterTurbo at the **host's local Ollama** (KobeOS's bundled local
LLM runtime) by default — so the video pipeline runs fully offline,
no OpenAI key required.

```bash
mkdir -p config && cp config.toml.example config/config.toml
docker compose -f vendor/moneyprinter/docker-compose.yml restart
```

For Ollama to answer, make sure it's running on the host machine:

```bash
ollama serve &           # if it's not already a system service
ollama pull llama3.2:3b  # ~2 GB, recommended starter
```

The `host.docker.internal` mapping in the compose file lets the
container reach the host's Ollama at `localhost:11434`.

If you'd rather use a cloud provider (OpenAI, Moonshot, DeepSeek,
Azure, Qwen), open `config/config.toml` and flip `llm_provider` +
`openai_api_key` to your provider's values. The rest of the pipeline
(Pexels stock footage, edge-tts voiceover, ffmpeg compositing) is
unchanged.

# What the KobeOS backend does

`server/src/video-generation/video-generation.service.ts` calls the
following endpoints:

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/videos` | Start a new video task. Body has `video_subject`, `voice_name`, `video_aspect`, etc. Returns `{ task_id }`. |
| `GET`  | `/api/v1/tasks/{task_id}` | Poll task progress (`state: 1=running, 2=success, 3=failed`, `progress: 0..100`, `videos: [paths]`). |

The MP4s land in `./storage/tasks/{task_id}/final-N.mp4`. The KobeOS
service stores the relative path in `video_jobs.outputPath` so the
front-end can stream it via the existing media-blob handler.

# Configuration knobs

The backend reads these env vars:

| Env var | Default | What |
|---|---|---|
| `MONEY_PRINTER_BASE_URL` | `http://localhost:8080` | MoneyPrinterTurbo REST API root |
| `MONEY_PRINTER_POLL_MS` | `4000` | How often to poll task status |
| `MONEY_PRINTER_TIMEOUT_MS` | `900000` | Max wait for a single generation (15 min) |
| `MONEY_PRINTER_USE_PIPER` | `false` | Re-render audio with offline Piper TTS post-render |
| `MONEY_PRINTER_PIPER_VOICE` | `en_US-amy-medium` | Piper voice to swap in |
| `MONEY_PRINTER_STORAGE_PATH` | `vendor/moneyprinter/storage` | Host path to the bind-mounted storage dir |
| `PIPER_BIN` | `~/.kobeos/kobe-bin/piper/piper` | Piper binary (falls back to `piper` on PATH) |
| `PIPER_VOICES_DIR` | `~/.kobeos/kobe-models/speech` | Directory holding downloaded `<voice>.onnx` files |
| `FFMPEG_BIN` | `ffmpeg` | ffmpeg binary used for the audio swap |

# Offline voiceover (replacing edge-tts)

Upstream MoneyPrinterTurbo's default voiceover comes from Microsoft Edge
TTS, which needs internet on every render. KobeOS will instead **re-
render the script with Piper** (`ai/speech/piper-service.js`) and use
ffmpeg to swap the audio track in the MP4 when:

```bash
export MONEY_PRINTER_USE_PIPER=true
export MONEY_PRINTER_PIPER_VOICE=en_US-amy-medium    # default
```

Prereqs on the host:

1. Download a Piper voice — open the Kobe Models app → Speech category
   → click the download button on a `piper:*` row. The .onnx file lands
   in `~/.kobeos/kobe-models/speech/`.
2. Make sure the Piper binary is on `PATH` (the Whisper/Piper bootstrap
   in `ai/speech/piper-service.js` will pull it from the upstream
   GitHub release on first use), or set `PIPER_BIN` explicitly.
3. Make sure `ffmpeg` is on `PATH` (or set `FFMPEG_BIN`).

If any of those is missing the swap is skipped silently and the
upstream edge-tts audio is kept, so the flag is safe to set even on
machines that don't have Piper installed yet.

# Fully offline: GPT-SoVITS sidecar (in-pipeline)

The Piper post-swap above still relies on edge-tts succeeding *during*
the render. To take that last cloud dependency out of the loop, KobeOS
ships an **optional** GPT-SoVITS sidecar
(https://github.com/RVC-Boss/GPT-SoVITS, MIT) that MoneyPrinterTurbo
can drive directly.

It's not enabled by default because the upstream Docker image is ~6 GB
and the pretrained voice models add another ~5 GB. Bring it up only
when you want fully offline video:

```bash
docker compose -f vendor/moneyprinter/docker-compose.yml \
  --profile offline-tts up -d
```

That starts the `gpt-sovits` service on these ports:

| Port | What |
|---|---|
| 9880 | Inference API consumed by MoneyPrinterTurbo |
| 9871 | Training control (optional) |
| 9872 | WebUI for cloning new voices (optional) |
| 9873 | UVR5 vocal separation (optional) |

Then in `config/config.toml`, uncomment the GPT-SoVITS block at the
bottom of the example file:

```toml
voice_name = "GPT-SoVITS-default"
tts_server = "gpt-sovits"
gpt_sovits_url = "http://gpt-sovits:9880"
gpt_sovits_voice = "default"
```

And restart the MoneyPrinterTurbo containers:

```bash
docker compose -f vendor/moneyprinter/docker-compose.yml restart api webui
```

## Performance note

CPU-only inference works but is slow — roughly 3–5× real-time per
generated minute. For production set up an NVIDIA GPU on the host
and uncomment the `deploy.resources.reservations.devices` block in
the compose file:

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: 1
          capabilities: [gpu]
```

Also flip `is_half: "True"` in the gpt-sovits env block to use FP16
on supported GPUs.

## Voice cloning

The default voice that ships with GPT-SoVITS is fine for demos. To
clone a custom voice from 5–30 seconds of reference audio, open the
WebUI at http://localhost:9872 and follow the upstream's training
tutorial. The trained voice ends up in `./gpt-sovits-models/` and
can be referenced by name in `config/config.toml`.

## Trade-off table

| Path | Cloud needed? | Quality | Cost |
|---|---|---|---|
| edge-tts (upstream default) | Yes (Microsoft) | Good | None — but online |
| edge-tts + Piper post-swap | Render-time only | Good (Piper) | ~30 MB voice |
| GPT-SoVITS in-pipeline | None | Best (clonable) | ~11 GB image + models, slow on CPU |

# License attribution

MoneyPrinterTurbo is MIT-licensed by `@harry0703`. The full text is
preserved at `LICENSE` in this directory. Every commit that interacts
with the MoneyPrinterTurbo API carries an acknowledgement in the code
comment.
