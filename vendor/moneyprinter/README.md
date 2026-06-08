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

# License attribution

MoneyPrinterTurbo is MIT-licensed by `@harry0703`. The full text is
preserved at `LICENSE` in this directory. Every commit that interacts
with the MoneyPrinterTurbo API carries an acknowledgement in the code
comment.
