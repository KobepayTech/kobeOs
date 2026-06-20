#!/usr/bin/env bash
# Mirror the TrOCR handwriting model into your own HuggingFace account /
# organization so KobeOS no longer depends on the public Xenova mirror.
#
# After this runs, set in your server .env:
#   HANDWRITING_OCR_MODEL=<your-username-or-org>/trocr-base-handwritten
# and KobeOS pulls from your copy. Only you can delete or rename it;
# Xenova / Microsoft / anyone else cannot pull it out from under you.
#
# Prerequisites:
#   1. Free HuggingFace account: https://huggingface.co/join
#   2. Access token with "write" scope:
#        https://huggingface.co/settings/tokens
#   3. huggingface-cli installed:
#        pip install -U "huggingface_hub[cli]"
#        huggingface-cli login  (paste the write token)
#   4. git-lfs:
#        apt install git-lfs   # or:  brew install git-lfs
#        git lfs install
#
# Usage:
#   ./scripts/mirror-handwriting-ocr.sh <your-username-or-org>
#
# Example:
#   ./scripts/mirror-handwriting-ocr.sh kobepaytech
#   # → creates https://huggingface.co/kobepaytech/trocr-base-handwritten

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <your-hf-username-or-org>"
  exit 1
fi

DEST_OWNER="$1"
SOURCE_REPO="${SOURCE_REPO:-Xenova/trocr-base-handwritten}"
MODEL_NAME="${MODEL_NAME:-trocr-base-handwritten}"
DEST_REPO="${DEST_OWNER}/${MODEL_NAME}"
WORK_DIR="$(mktemp -d -t kobeos-mirror-XXXXXX)"

cleanup() { rm -rf "$WORK_DIR"; }
trap cleanup EXIT

echo "================================================"
echo "Mirroring ${SOURCE_REPO} → ${DEST_REPO}"
echo "Working dir: ${WORK_DIR}"
echo "================================================"

# 1. Make sure you're authenticated as the destination owner.
if ! huggingface-cli whoami >/dev/null 2>&1; then
  echo "❌ Not logged in. Run: huggingface-cli login"
  exit 1
fi
HF_USER="$(huggingface-cli whoami | head -1)"
echo "Authenticated as: ${HF_USER}"

# 2. Create the destination repo (idempotent — ignored if it already exists).
huggingface-cli repo create "${MODEL_NAME}" --type model \
  ${DEST_OWNER:+--organization "${DEST_OWNER}"} -y 2>&1 \
  | grep -v "already created" || true

# 3. Clone the source repo (git LFS pulls the actual weight blobs).
echo "Cloning source (this downloads ~1.3 GB)..."
git clone "https://huggingface.co/${SOURCE_REPO}" "${WORK_DIR}/repo"
cd "${WORK_DIR}/repo"

# 4. Strip the upstream README header so the mirror doesn't impersonate
#    Xenova / Microsoft. Prepend a "mirrored by" note while keeping the
#    original license + model card intact.
if [[ -f README.md ]]; then
  cat > README.md.new <<EOF
# trocr-base-handwritten (KobeOS mirror)

This is a private mirror of [\`${SOURCE_REPO}\`](https://huggingface.co/${SOURCE_REPO})
maintained by ${DEST_OWNER} so the KobeOS deployments are not exposed to
upstream changes / deletion.

Original license (MIT) and model card follow.

---

EOF
  cat README.md >> README.md.new
  mv README.md.new README.md
fi

# 5. Push to the destination.
git remote set-url origin "https://huggingface.co/${DEST_REPO}"
echo "Pushing to ${DEST_REPO} (this uploads ~1.3 GB)..."
git push -u origin main

echo ""
echo "================================================"
echo "✅ Mirror complete: https://huggingface.co/${DEST_REPO}"
echo "================================================"
echo ""
echo "Now set in server/.env:"
echo "  HANDWRITING_OCR_MODEL=${DEST_REPO}"
echo ""
echo "Then run:"
echo "  npm run prefetch:handwriting-ocr   (inside server/)"
echo "to confirm the new source works."
