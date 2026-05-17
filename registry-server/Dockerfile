FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
RUN addgroup -S kobe && adduser -S kobe -G kobe
COPY --from=builder --chown=kobe:kobe /app/dist ./dist
COPY --from=builder --chown=kobe:kobe /app/node_modules ./node_modules
COPY --from=builder --chown=kobe:kobe /app/package.json ./package.json
USER kobe
EXPOSE 3000
CMD ["node", "dist/main"]
