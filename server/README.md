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

Both return `{ accessToken, user }`. Send `Authorization: Bearer <token>` on every other request.

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

## Production notes

- Set `DB_SYNCHRONIZE=false` and use TypeORM migrations.
- Rotate `JWT_SECRET` to a strong random string.
- Set `CORS_ORIGIN` to your frontend URL(s), comma-separated.
- Front the API with a reverse proxy that terminates TLS.
- `passwords` stores ciphertext only — derive the key on the client.
