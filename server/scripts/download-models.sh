#!/bin/bash
# Download AI models for KobeOS
# Run this ON YOUR SERVER after cloning the repo

set -e

echo "========================================"
echo "📥 Downloading AI Models for KobeOS"
echo "========================================"

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
fi

# Start Ollama in background if not running
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "Starting Ollama..."
    ollama serve &
    sleep 3
fi

# Pull models
echo "Downloading deepseek-r1:8b (4.9GB)..."
ollama pull deepseek-r1:8b

echo "Downloading llama3.2 (2GB)..."
ollama pull llama3.2

echo "Downloading nomic-embed-text (274MB)..."
ollama pull nomic-embed-text

echo "Downloading TrOCR handwriting model (~1.3 GB)..."
# Pre-warm the Microsoft TrOCR model used by OrderFromImageService for
# reading handwritten quantities on customer-annotated catalog photos.
# Cached under server/node_modules/@huggingface/transformers/.cache/.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
( cd "$SCRIPT_DIR/.." && npm run --silent prefetch:handwriting-ocr ) || \
    echo "⚠ TrOCR prefetch skipped — server will download lazily on first image parse."

echo ""
echo "========================================"
echo "✅ All models downloaded!"
echo "========================================"
echo ""
echo "Models are stored in: ~/.ollama/models/"
echo ""
echo "To start using them:"
echo "  ollama serve"
echo ""
echo "To test:"
echo "  ollama run deepseek-r1:8b"
