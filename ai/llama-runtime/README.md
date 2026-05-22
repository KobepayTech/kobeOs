# ai/llama-runtime

Local AI inference via [llama.cpp](https://github.com/ggerganov/llama.cpp) and [Ollama](https://ollama.ai).

## Overview

KobeOS runs AI models fully offline. This module manages:
- Spawning and communicating with the Ollama process
- Routing chat/completion/embedding requests from the runtime AI service
- Model lifecycle (load, unload, swap)

## Integration

The `electron/runtime/services/ai-service.js` calls Ollama's HTTP API at `OLLAMA_URL` (default `http://localhost:11434`).

## Supported Models

| Model | Size | Use case |
|---|---|---|
| deepseek-r1:1.5b | ~1GB | Fast chat, code assist |
| llama3.2:3b | ~2GB | General purpose |
| nomic-embed-text | ~270MB | Embeddings |

## Setup

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model
ollama pull deepseek-r1:1.5b
```

The KobeOS AI service auto-detects Ollama on startup and falls back gracefully if unavailable.
