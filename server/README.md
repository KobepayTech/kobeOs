# KOBE OS — Backend

NestJS + PostgreSQL backend for the KOBE OS frontend.

## Run

```bash
# 1. Start postgres
docker compose up -d

# 2. Install deps
npm install

# 3. Configure env
cp .env.example .env

# 4. Run in dev mode
npm run start:dev
```

The API listens on `http://localhost:3000/api`. With `DB_SYNCHRONIZE=true` (default in dev), schema is auto-created on boot.

## Auth

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"secret123","displayName":"You"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"secret123"}'
```

Both return `{ accessToken, refreshToken, user }`. Send `Authorization: Bearer <accessToken>` on
every other request. When the access token expires (default 15 min), POST the refresh token to
`/api/auth/refresh` to rotate it:

```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<your refresh token>"}'

# Sign out (revokes the refresh token)
curl -X POST http://localhost:3000/api/auth/logout \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<your refresh token>"}'
```

Refresh-token rotation is enforced — once a refresh token is used, it's revoked and the request
returns a new pair. A leaked refresh token is therefore single-use.

Password reset (delivery is out-of-scope; in prod, send the token via email and only return `{ ok: true }`):

```bash
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com"}'
# → { ok: true, resetToken: "..." }   (resetToken only returned in dev/test)

curl -X POST http://localhost:3000/api/auth/reset-password \
  -H 'Content-Type: application/json' \
  -d '{"token":"<reset token>","newPassword":"new-secret"}'
```

`reset-password` revokes every refresh token for the user, forcing a fresh login on every device.

## Rate limiting

Two `@nestjs/throttler` buckets are wired globally:

- `default`: 120 requests / 60 seconds per IP (applied to every controller).
- `auth`: 10 requests / 60 seconds per IP (applied to `AuthController`), protecting
  register / login / refresh / forgot / reset against credential stuffing.

Tune via `ThrottlerModule.forRoot` in `src/app.module.ts`.

## Uploads

Multipart endpoints for raw file/image/audio bytes:

```bash
# Files VFS (auto-creates the parent chain)
curl -X POST 'http://localhost:3000/api/files/upload?path=/Pictures/cat.png' \
  -H "Authorization: Bearer <token>" \
  -F "file=@cat.png"

# Media assets (kind = audio | photo | video | image)
curl -X POST 'http://localhost:3000/api/media/upload?kind=audio' \
  -H "Authorization: Bearer <token>" \
  -F "file=@track.mp3"

# Stream bytes back (auth required — use the frontend `fetchObjectUrl` helper)
curl -X GET 'http://localhost:3000/api/files/blob?path=/Pictures/cat.png' \
  -H "Authorization: Bearer <token>" --output cat.png
curl -X GET 'http://localhost:3000/api/media/blob/<asset-id>' \
  -H "Authorization: Bearer <token>" --output track.mp3
```

The size limit is 25 MB per request (configurable in `main.ts` / `FileInterceptor`).

## Modules

| Module | Path | Notes |
| --- | --- | --- |
| Auth | `/api/auth/{register,login}` | JWT bearer tokens |
| Users | `/api/users/me` | Current user profile |
| Notes | `/api/notes` | CRUD |
| Todo | `/api/todo/{lists,items}` | Lists + items |
| Kanban | `/api/kanban/{boards,columns,cards}` | Boards/columns/cards |
| Contacts | `/api/contacts` | CRUD |
| Email | `/api/email` | Folder-scoped |
| Chat | `/api/chat/{channels,messages}` | Shared channels, per-user posts |
| Calendar | `/api/calendar` | Event range queries via `?start=&end=` |
| Files | `/api/files` | Virtual filesystem, recursive move/delete |
| Passwords | `/api/passwords` | Client-encrypted vault blobs |
| Media | `/api/media/{assets,playlists}` | Photos, audio, video |
| Cargo | `/api/cargo/{parcels,shipments,drivers,flights}` | |
| Property | `/api/property/{properties,units,tenants,payments}` | |
| POS | `/api/pos/{products,orders}` | Atomic order creation w/ stock decrement |
| Warehouse | `/api/warehouse/{items,movements}` | IN/OUT/ADJUST movements |
| Discounts | `/api/discounts/{rules,coupons,campaigns}` | |
| Payments | `/api/payments/{wallets,transactions,transfer,loans}` | Transactional transfers |
| Hotel | `/api/hotel/{rooms,guests,bookings}` | |
| Creators | `/api/creators` | |

All entities except `chat.channels` and `users` are scoped to `ownerId = current user`. Cross-user reads are not exposed.

## Project layout

```
server/
  src/
    common/      base.entity, owned.entity, http-exception filter, owned CRUD base
    config/      database.config
    auth/        JWT strategy, guards, controllers
    users/
    <domain>/    entity, dto/, service, controller, module per domain
    app.module.ts
    main.ts
  docker-compose.yml    Postgres 16
  .env.example
```

## Realtime

`ChatModule` exposes a Socket.IO gateway on the `/chat` namespace. Clients pass the
JWT either as `auth.token` in the handshake or as a `Bearer ...` header; the
gateway verifies it on connection. Once connected, emit `chat:join` /
`chat:leave` with `{ channelId }` to subscribe to a channel room.
Every successful `POST /api/chat/messages` triggers a `chat:message` broadcast
to that channel's room.

## Tests

E2E tests live under `test/` and run against a separate `kobeos_e2e` database
to avoid stomping on dev data:

```bash
createdb -O kobe kobeos_e2e
psql -d kobeos_e2e -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
DB_DATABASE=kobeos_e2e npm run test:e2e
```

Three specs cover the auth lifecycle (register / login / refresh rotation /
logout / password reset), notes CRUD with owner scoping + validation, and the
multipart upload round-trip for `/api/files` and `/api/media`. 11 tests total.

## Migrations

Schema changes are tracked under `src/migrations`. Dev mode uses
`DB_SYNCHRONIZE=true` (entity-driven sync) and ignores migrations. Production
should use `DB_SYNCHRONIZE=false` + `DB_MIGRATIONS_RUN=true` and rely on
migrations.

```bash
# Generate a new migration from current entity changes:
npm run migration:generate -- src/migrations/AddSomething

# Apply pending migrations against the configured DB:
npm run migration:run

# Roll back the most recent migration:
npm run migration:revert
```

The CLI reads the same `.env` and connects via `src/config/data-source.ts`.

## Production notes

- Set `DB_SYNCHRONIZE=false` + `DB_MIGRATIONS_RUN=true`.
- Rotate `JWT_SECRET` to a strong random string. Access tokens are short-lived
  (`JWT_EXPIRES_IN`, default 15m); refresh tokens last `REFRESH_EXPIRES_DAYS`
  (default 30 days).
- Set `CORS_ORIGIN` to your frontend URL(s), comma-separated.
- Front the API with a reverse proxy that terminates TLS.
- `passwords` stores ciphertext only — derive the key on the client.
- For password reset, plug in an email delivery driver in `PasswordResetService`
  and stop returning the raw token in the response.
