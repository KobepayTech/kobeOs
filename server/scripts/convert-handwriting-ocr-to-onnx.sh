#!/usr/bin/env bash
# Convert a TrOCR PyTorch checkpoint (e.g. microsoft/trocr-large-handwritten)
# to ONNX format that @huggingface/transformers can load, then push the
# converted model to YOUR HuggingFace account.
#
# This is the path to use when you want a variant (like "large") that no
# one has published an ONNX conversion of. You control every step — only
# Microsoft (the upstream PyTorch source) is in the trust chain.
#
# Prerequisites:
#   - Python 3.10+
#   - pip install -U "optimum[exporters]" "huggingface_hub[cli]" torch
#   - git-lfs
#   - huggingface-cli login (interactive) OR HF_TOKEN env var
#
# Usage:
#   ./scripts/convert-handwriting-ocr-to-onnx.sh <destination-owner> [source-pytorch-model] [destination-name]
#
# Examples:
#   ./scripts/convert-handwriting-ocr-to-onnx.sh kobepaytech
#   ./scripts/convert-handwriting-ocr-to-onnx.sh kobepaytech microsoft/trocr-base-handwritten trocr-base-handwritten-onnx
#
# Defaults: converts microsoft/trocr-large-handwritten →
#   <owner>/trocr-large-handwritten

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <destination-owner> [source-pytorch-model] [destination-name]"
  exit 1
fi

DEST_OWNER="$1"
SOURCE_REPO="${2:-microsoft/trocr-large-handwritten}"
MODEL_NAME="${3:-$(basename "$SOURCE_REPO")}"
DEST_REPO="${DEST_OWNER}/${MODEL_NAME}"

WORK_DIR="$(mktemp -d -t kobeos-convert-XXXXXX)"
cleanup() { rm -rf "$WORK_DIR"; }
trap cleanup EXIT

# Refuse if DEST_OWNER looks like a token (catches the same accident as
# the mirror script).
if [[ "${DEST_OWNER:0:3}" == "hf_" ]]; then
  echo "❌ Refusing: first arg looks like an HF token, not a username."
  exit 1
fi

# Auth: prefer interactive login; fall back to HF_TOKEN env var.
if [[ -n "${HF_TOKEN:-}" ]]; then
  echo "Using HF_TOKEN from the environment."
  export HUGGINGFACE_HUB_TOKEN="$HF_TOKEN"
fi
if ! huggingface-cli whoami >/dev/null 2>&1; then
  echo "❌ Not logged in. Run 'huggingface-cli login' or set HF_TOKEN env var."
  exit 1
fi
echo "Authenticated as: $(huggingface-cli whoami | head -1)"

echo "================================================"
echo "Converting ${SOURCE_REPO} → ONNX → ${DEST_REPO}"
echo "Working dir: ${WORK_DIR}"
echo "================================================"

# 1. ONNX export via optimum. --task image-to-text routes to the
#    vision-encoder-decoder exporter that splits TrOCR into:
#       encoder_model.onnx + decoder_model_merged.onnx
ONNX_OUT="${WORK_DIR}/onnx-export"
echo "Step 1/4: exporting ${SOURCE_REPO} to ONNX (this is the long step — 5–15 min for large)..."
optimum-cli export onnx \
  --model "${SOURCE_REPO}" \
  --task image-to-text \
  --device cpu \
  "${ONNX_OUT}"

# 2. transformers.js expects ONNX files under onnx/ subdirectory while
#    config/tokenizer files stay at the repo root. Reshape the export.
REPO_DIR="${WORK_DIR}/repo"
mkdir -p "${REPO_DIR}/onnx"
cp "${ONNX_OUT}"/*.onnx "${REPO_DIR}/onnx/" 2>/dev/null || true
cp "${ONNX_OUT}"/*.json "${REPO_DIR}/" 2>/dev/null || true
# Copy any preprocessor / generation files transformers.js needs at root.
for f in config.json generation_config.json preprocessor_config.json \
         tokenizer.json tokenizer_config.json special_tokens_map.json \
         vocab.json merges.txt; do
  [[ -f "${ONNX_OUT}/${f}" ]] && cp "${ONNX_OUT}/${f}" "${REPO_DIR}/"
done

# 3. README with provenance trail (license + attribution required by MIT).
cat > "${REPO_DIR}/README.md" <<EOF
---
license: mit
tags:
  - trocr
  - image-to-text
  - onnx
  - transformers.js
base_model: ${SOURCE_REPO}
---

# ${MODEL_NAME}

ONNX-converted variant of [\`${SOURCE_REPO}\`](https://huggingface.co/${SOURCE_REPO}),
maintained by ${DEST_OWNER} for use with the KobeOS handwriting OCR
pipeline. Conversion performed with \`optimum-cli export onnx\`.

Loadable from JavaScript via \`@huggingface/transformers\`:

\`\`\`ts
import { pipeline } from '@huggingface/transformers';
const ocr = await pipeline('image-to-text', '${DEST_REPO}');
\`\`\`

Original license (MIT, Microsoft) applies. See the upstream model card
for training data, evaluation, and limitations.
EOF

# 4. Upload via huggingface-cli (handles repo creation + LFS for the
#    multi-hundred-MB ONNX blobs automatically).
echo "Step 4/4: pushing to ${DEST_REPO} (multi-GB upload)..."
huggingface-cli upload "${DEST_REPO}" "${REPO_DIR}" \
  --repo-type model \
  --create-pr false \
  --commit-message "ONNX conversion of ${SOURCE_REPO} via optimum-cli"

echo ""
echo "================================================"
echo "✅ Conversion + upload complete:"
echo "   https://huggingface.co/${DEST_REPO}"
echo "================================================"
echo ""
echo "Now set in server/.env:"
echo "  HANDWRITING_OCR_MODEL=${DEST_REPO}"
echo ""
echo "Then run:  npm run prefetch:handwriting-ocr"
echo "to confirm KobeOS pulls from your converted ONNX."
