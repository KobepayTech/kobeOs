# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .

# Bake the TrOCR handwriting OCR model into the image so production
# servers never need to reach HuggingFace at runtime. ~1.3 GB layer,
# downloaded once at build time, cached by Docker for subsequent builds.
# The model lives at node_modules/@huggingface/transformers/.cache/
# (a runtime-dependency directory, so it survives `npm prune` below).
# Override the source via build arg:
#   docker build --build-arg HANDWRITING_OCR_MODEL=kobepaytech/trocr-base-handwritten .
ARG HANDWRITING_OCR_MODEL=Xenova/trocr-base-handwritten
ENV HANDWRITING_OCR_MODEL=${HANDWRITING_OCR_MODEL}
RUN node scripts/prefetch-handwriting-ocr.mjs || \
    echo "⚠ Prefetch failed — runtime will lazy-download on first parse."

RUN npm run build

# Prune dev dependencies. @huggingface/transformers is a runtime dep,
# so its .cache/ directory (the baked model) is preserved.
RUN npm prune --omit=dev --legacy-peer-deps

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

# Non-root user for security
RUN addgroup -S kobe && adduser -S kobe -G kobe

COPY --from=builder --chown=kobe:kobe /app/dist ./dist
COPY --from=builder --chown=kobe:kobe /app/node_modules ./node_modules
COPY --from=builder --chown=kobe:kobe /app/package.json ./package.json

# Model is already on disk — the on-boot prefetch would just confirm
# the cache exists, but skip it to keep startup instant.
ENV HANDWRITING_OCR_PREFETCH=false

USER kobe

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/main"]
