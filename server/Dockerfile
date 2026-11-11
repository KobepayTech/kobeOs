# Install FFmpeg from the image distribution so npm does not fetch a GitHub release asset.
FROM node:22-alpine AS media-base
RUN apk add --no-cache ffmpeg
ENV FFMPEG_BIN=/usr/bin/ffmpeg
# This image runs on CPU. Keep the bundled CPU runtime and skip the CUDA download.
ENV ONNXRUNTIME_NODE_INSTALL_CUDA=skip
RUN ffmpeg -hide_banner -encoders > /tmp/encoders \
    && grep -qw libx264 /tmp/encoders \
    && grep -qw aac /tmp/encoders \
    && rm /tmp/encoders

# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM media-base AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

# Prune dev dependencies
RUN npm prune --omit=dev --legacy-peer-deps

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM media-base AS runtime
WORKDIR /app

# Native PDF text extraction + page rasterization for scanned-PDF OCR.
# Kept in the runtime image so PDF ingestion does not depend on a cloud API.
RUN apk add --no-cache poppler-utils

# Non-root user for security
RUN addgroup -S kobe && adduser -S kobe -G kobe

COPY --from=builder --chown=kobe:kobe /app/dist ./dist
COPY --from=builder --chown=kobe:kobe /app/node_modules ./node_modules
COPY --from=builder --chown=kobe:kobe /app/package.json ./package.json
# Ops scripts (e.g. npm run vapid:generate) — needed for the deploy
# workflow's one-time VAPID-key generation step.
COPY --from=builder --chown=kobe:kobe /app/scripts ./scripts

USER kobe

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "dist/main"]
