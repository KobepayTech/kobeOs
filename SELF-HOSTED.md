# KobeOS self-hosted deployment

This deployment runs the web app and API locally with Docker Compose. It does
not install Electron, create a desktop installer, require Cloudflare Tunnel,
or require TLS certificates for a localhost deployment.

## Requirements

- Docker Desktop or Docker Engine with Compose v2
- 4 GB RAM available to the containers
- Ports `3000` and `8080` available, unless changed in `.env.self-hosted`

## Start

PowerShell:

```powershell
Copy-Item .env.self-hosted.example .env.self-hosted
# Edit .env.self-hosted and replace DB_PASSWORD and JWT_SECRET.
# Optional: set KOBEOS_BOOTSTRAP_ADMIN_EMAIL and
# KOBEOS_BOOTSTRAP_ADMIN_PASSWORD (12+ characters) for the first boot.
docker compose --env-file .env.self-hosted -f docker-compose.self-hosted.yml up -d --build
```

Linux/macOS:

```bash
cp .env.self-hosted.example .env.self-hosted
# Edit .env.self-hosted and replace DB_PASSWORD and JWT_SECRET.
# Optional: set KOBEOS_BOOTSTRAP_ADMIN_EMAIL and
# KOBEOS_BOOTSTRAP_ADMIN_PASSWORD (12+ characters) for the first boot.
docker compose --env-file .env.self-hosted -f docker-compose.self-hosted.yml up -d --build
```

If the bootstrap variables are set, the API creates that account with the
`admin` role only when the email does not already exist. Remove all
`KOBEOS_BOOTSTRAP_ADMIN_*` lines and restart after signing in; the API never
promotes an existing user or changes an existing password automatically.

Open [http://localhost:8080](http://localhost:8080). The API health endpoint
is [http://localhost:3000/api/health](http://localhost:3000/api/health).

### Disposable test profile

For a throwaway test instance that does not require creating an `.env.self-hosted`
file, use the test-only compose overlay:

```bash
docker compose -f docker-compose.self-hosted.yml \
  -f docker-compose.self-hosted.test.yml up -d --build
```

That overlay contains public test-only database and JWT values. It is marked
`NODE_ENV=test` and must never be used with production data. Stop and remove
its disposable data with `docker compose ... down -v` when the test is finished.

The API runs tracked migrations with `DB_SYNCHRONIZE=false`; it never rewrites
the schema from entities in production mode. Postgres and Redis data persist
in named Docker volumes.

## Stop and update

```bash
docker compose --env-file .env.self-hosted -f docker-compose.self-hosted.yml down
docker compose --env-file .env.self-hosted -f docker-compose.self-hosted.yml up -d --build
```

`down` preserves the named data volumes. To intentionally remove all local
data, use `docker compose ... down -v`.

## Reverse proxy / public hosting

For a public deployment, keep the API and web services on a private Docker
network and put an operator-managed HTTPS reverse proxy in front of them. Set
`VITE_API_BASE`, `CORS_ORIGIN`, `APP_PUBLIC_URL`, and `APP_FRONTEND_URL` to the
public URLs before rebuilding the `web` service. Provider OAuth callbacks must
use the public HTTPS callback URLs registered in Meta/TikTok.
