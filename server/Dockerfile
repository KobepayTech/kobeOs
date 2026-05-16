# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

# Prune dev dependencies
RUN npm prune --omit=dev

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

# Non-root user for security
RUN addgroup -S kobe && adduser -S kobe -G kobe

COPY --from=builder --chown=kobe:kobe /app/dist ./dist
COPY --from=builder --chown=kobe:kobe /app/node_modules ./node_modules
COPY --from=builder --chown=kobe:kobe /app/package.json ./package.json

USER kobe

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/main"]
