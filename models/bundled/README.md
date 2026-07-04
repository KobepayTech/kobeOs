# Bundled AI models (baked into the installer)

Drop the `.gguf` model files **you already downloaded** into this folder. At
build time they are copied into the KobeOS installer (electron-builder
`extraResources` → `resources/models/`). On the shop laptop's **first boot**,
KobeOS imports each one into the bundled Ollama runtime (`ollama create`) — no
internet download required — and the "Ask Kobe" assistant uses them.

```
models/bundled/
  models.json          ← optional: names / default / parameters (see below)
  mistral-7b-q4.gguf   ← your downloaded gguf(s) go here
  nomic-embed.gguf
```

## How import works

For every `.gguf` in this folder, KobeOS registers a named Ollama model:

- If `models.json` lists the file, its `name`, `system` prompt and
  `parameters` are used.
- Otherwise the file is auto-registered as `kobe-<filename>` (e.g.
  `mistral-7b-q4.gguf` → `kobe-mistral-7b-q4`).

The **default** model (what the assistant talks to) is `models.json.default`,
or the first gguf found if no manifest. The backend reads it via `OLLAMA_MODEL`.

Import runs **once** — models are copied into Ollama's store under the app's
user-data dir, so they survive app updates and re-imports are skipped.

## models.json (optional)

```json
{
  "default": "kobe-chat",
  "models": [
    {
      "name": "kobe-chat",
      "file": "mistral-7b-q4.gguf",
      "system": "You are Kobe, a concise business assistant for a Tanzanian shop.",
      "parameters": { "temperature": 0.6, "num_ctx": 4096 }
    },
    {
      "name": "kobe-embed",
      "file": "nomic-embed.gguf"
    }
  ]
}
```

## Notes

- `.gguf` files are **git-ignored** (too large for the repo) — they live only on
  the build machine. This README and `models.json` are tracked so the folder and
  its config always exist.
- Bundling large models makes the installer large (each gguf is 1–8 GB). That is
  the trade-off for a fully offline, turnkey install.
