# Online continuity layer

KobeOS stays the main system. A cloud API and a cloud PostgreSQL keep Lala,
shops and e-commerce serving online customers while the KobeOS server is
unreachable, and hand everything taken during that window back afterwards.

This is a continuity layer, not a second KobeOS.

## Three decisions this design rests on

### 1. Allotment, not locking

Two databases that cannot talk to each other cannot agree, so do not ask them
to. Give the cloud a slice of inventory it owns outright, and make exceeding it
impossible rather than unlikely.

**Hotels.** Allot specific rooms for a date window — rooms 101 and 102 are
cloud-sellable from the 1st to the 14th. While that allotment is live the front
desk will not sell those rooms for those dates. This is the allotment model
hotels already use for OTAs, so it matches how an operator thinks, and it fits
the booking unit the schema already has: `HotelBooking` is `roomId` plus
`checkIn`/`checkOut`.

**Shops.** `ProductSnippet.stock` stops being a mirror and becomes the cloud's
allowance. Today `commerce.service.ts` sets `snippet.stock = live.stock` from
the node heartbeat, which means the cloud advertises every unit the shop owns
and would sell all of them. After this change KobeOS reduces its own sellable
quantity by whatever it allots, and the two numbers never overlap.

**Default to zero.** No allotment until an operator opts in per property or
shop. Selling nothing during an outage is a bad day; selling a room twice is a
refund, an argument and a lost customer.

### 2. The cloud never holds money

**Version one: reserve online, pay on arrival or collection.** No payment is
captured in the cloud. This is already the product's vocabulary — cargo has
`PAY_ON_ARRIVAL` as a first-class payment mode — and PR #144 already tells
public customers they arrange payment with the hotel or merchant.

That single decision removes the hardest problem in the whole design. There is
no money in the cloud to reconcile, no refunds to issue across a partition, and
no conflict with the credit gate in `payments.service.ts`, which requires a
*verified inbound payment* row that only exists on the main server.

**Version two, if prepayment is wanted: the mobile-money provider is the
authority, not the cloud.** The cloud stores a provider transaction reference
and nothing more. On reconnect KobeOS verifies that reference against the
provider using the inbound-payment matching it already has. Money is never
"in" the cloud, so there is nothing to reconcile — only a claim to check
against a party that was never offline.

### 3. Online visibility keyed on allotment, not on presence

A shop or room is sellable online **if and only if it has unexhausted
allotment**, regardless of whether the node is online. Node presence becomes
informational (`nodeStatus`), which is what the original Jumla mirror comment
intended.

This resolves a real tension. PR #144 changed marketplace visibility to
`businesses.filter(b => b.tier !== 'FULL' || isNodeOnline(...))`, hiding
merchants whose node is offline, and deleted the comment that said a merchant
who closes their laptop should never disappear. #144 was right that you must
not offer what you cannot fulfil. The original was right that a closed laptop
should not erase a business. Allotment satisfies both: what is offered is
exactly what has been set aside.

## Direction of truth

One direction per table. Every bidirectional-sync disaster starts with one
table that looked fine both ways.

| Data | Direction | Cloud may write? |
|---|---|---|
| Hotels, rooms, rates, product catalogue, prices | KobeOS → cloud | No |
| Room allotments, stock allowances | KobeOS → cloud | Decrement only, never increase |
| Bookings and orders created online | cloud → KobeOS | Yes, it originates them |
| Guests and customers created online | cloud → KobeOS | Yes |
| Payments, wallets, ledger, ERP, property, staff | Never replicated | No |

## One schema, a subset of rows

The cloud runs the same migrations as KobeOS and holds only the rows it needs.
It does **not** get its own schema or its own migration lineage. Two lineages
drift, and a week was just lost to migration drift — one of those is enough.

The cost is tables the cloud never uses, which is cheap. The alternative costs
correctness.

## Mechanics

**Outbox.** Everything the cloud originates lands in an append-only
`cloud_outbox` row — kind, payload, `createdAt`, `syncedAt`, `attempts`,
`lastError`. Nothing is deleted on sync, only stamped. The outbox is the
evidence of what happened during the outage.

**KobeOS initiates.** The main server has no static IP and sits behind a
tunnel, so it polls the cloud outbound, authenticated with a machine
credential — not a user JWT. `JWT_SECRET` must be shared, or tokens issued by
one side will not validate on the other.

**Sync runs continuously, not at outage time.** The cloud cannot be populated
when the outage starts; by then the server is gone. Catalogue and allotment
replication is a steady background job while everything is healthy.

**Conflicts are exceptions, not merges.** A cloud booking a guest is relying on
is a fact. KobeOS absorbs it even if that produces an overbooking a human has
to resolve, and surfaces it in a staff exception queue. Last-write-wins is
categorically wrong for anything that touches money or a bed.

**The cloud database is a system of record while it holds unsynced rows.** For
that window it is the only copy of those bookings. It needs backups and
point-in-time recovery, not cache treatment.

## Privacy

Do not replicate identity documents. Hotel guests carry `guestIdNumber` and
Lala carries passport data; a second copy in another jurisdiction is a Tanzania
PDPA question and interacts with `docs/HOTEL_BIOMETRIC_RETENTION.md`.

The cloud needs a name and a phone number to hold a reservation. It does not
need an ID number, and it must never receive a face reference.

## What customers are told

Surface the staleness watermark — "availability as of 14:20" — from the
`indexedAt` the snippet already carries, and stop offering rather than offer
stale beyond a configured threshold.

## Operating it

Alert on **sync lag**, not only uptime. An outage that everyone sees is
survivable; a sync that silently stopped while bookings pile up unreconciled is
the one that costs real money. Alert on the count and age of unsynced outbox
rows.

Split brain is a real case: KobeOS can be up but unreachable *from Cloudflare*.
Health-based routing has to decide, and both sides must be safe if it decides
wrongly — which, with allotment, they are.

## Running the sync

Each side runs the same KobeOS backend. Which role it plays is decided entirely
by configuration: the origin is the instance with `CONTINUITY_PEER_URL` set, and
the cloud is the instance it points at.

| Variable | Set on | Notes |
|---|---|---|
| `CONTINUITY_SYNC_TOKEN` | both | Shared machine secret, min 32 chars. Must match. |
| `CONTINUITY_PEER_URL` | origin only | Base URL of the cloud, e.g. `https://api.kobeapptz.com` |

Both unset means no syncing and no load, which is what desktop and single-shop
installs want.

`ContinuitySyncWorker` runs a pass a minute on the origin. A pass:

1. pushes the catalogue — only rooms with a live allotment and products with
   allowance left, and no guest data at all;
2. pulls the cloud's unsynced outbox;
3. absorbs each item, idempotently, keyed on the cloud's own id;
4. acknowledges only the items that actually landed.

Passes never overlap, and the three endpoints (`POST /api/continuity/catalogue`,
`GET /api/continuity/outbox`, `POST /api/continuity/outbox/ack`) take the shared
token rather than a user JWT: the peer is a server, not a person. An instance
with no token configured serves none of them rather than defaulting to open.

Failure is ordinary, not exceptional:

- **Catalogue push fails** — the pass still collects transactions. A stale
  catalogue costs an offer; an uncollected booking costs a guest.
- **Acknowledgement is lost** — the cloud offers the item again and absorption
  recognises it. This is the case idempotency exists for, and it is tested.
- **An item cannot be absorbed** — it is left unacknowledged, so the evidence
  stays on the cloud instead of a customer's order being dropped.
- **Cancellation arrives before its booking** — nothing orders the two. The
  claim waits, and the booking is cancelled as it lands rather than becoming a
  live reservation for a guest who cancelled.

Backlog shows on `/api/health` under `sync` (`ok` / `warn` past an hour /
`critical` past four). A stalled sync deliberately does not fail the endpoint:
unsynced bookings are for an operator to chase, not a reason to stop taking the
next one. Claims that have been applied are settled, so the count stays honest —
a permanent false critical would train operators to ignore the alert.

Proven by `server/test/continuity-sync.e2e-spec.ts`, which runs two app
instances against two separate PostgreSQL databases. One database cannot show
that a booking survived being handed over.

### Catalogue images

Product images live in PostgreSQL and are served from
`/api/commerce-public/media/:token` — a relative path. Replicating the
catalogue alone therefore produced a storefront with correct names and prices
and a broken image on every tile: the path resolved against the cloud while the
bytes were still only on the origin. Precisely the wrong moment for a shop to
look abandoned.

Bytes are replicated on demand, not with every catalogue:

1. the catalogue push returns `missingMedia` — the image tokens the cloud
   references but cannot serve, derived from the catalogue's own `imageUrl`
   values so the two cannot disagree;
2. the origin reads those images and posts them to `POST /api/continuity/media`;
3. the cloud stores them under the **same token**, so the catalogue needs no URL
   rewriting and no frontend has to know which instance answered.

A row that exists without bytes counts as missing — a catalogue push writes
`imageUrl`, so a reference alone still renders broken.

A pass sends at most 25 images, 2 MB each and 8 MB in total. An oversized image
is skipped rather than truncated and is simply offered again next pass. A failed
image push never stops the pass from collecting transactions: pictures are worth
less than money already taken.

## Build order

Steps 1 to 4 need no cloud hosting and can be built and tested locally against
two PostgreSQL instances, which is how the partition behaviour gets proven.

1. Allotment schema and the KobeOS-side guard that refuses to sell allotted
   inventory
2. `ProductSnippet.stock` reinterpreted as allowance rather than mirror
3. Outbox, plus the reconciliation that absorbs cloud bookings and the
   exception queue for conflicts
4. **Partition test**: sell from the allotment with the server unreachable,
   reconnect, assert exactly one booking exists and nothing was oversold
5. Cloud PostgreSQL and the Cloudflare API deploy — needs the credentials in
   `docs/PRODUCTION_HOSTING.md`
6. Health-based routing and sync-lag alerting

## Out of scope

Restaurant and bar orders, ERP, property management, staff and payroll, wallets
and the ledger. They are not online-customer-facing and replicating them buys
risk for nothing.
## Marketplace product search

`GET /api/commerce-public/jumla/items` is the shops marketplace search — the
commerce counterpart to Lala's hotel search.

It was previously `LOWER(name) LIKE '%q%'` ordered by `indexedAt DESC`. That
had three faults a shopper feels at once: a leading-wildcard LIKE cannot use an
index, so every search scanned the whole snippet table; there was no stemming,
so "shoes" missed "shoe"; and results were newest-first, which is not
relevance.

It now uses PostgreSQL full-text search with a weighted vector — name (A),
category (B), description (C) — ranked by `ts_rank_cd`, which prefers products
where the matched terms sit close together. `commerce_snippet_fts` is a GIN
expression index over exactly that vector; **the expression in the query and
the one in the index must stay identical**, or the planner silently stops using
the index and every search goes back to a full scan. A unit test compares the
two strings for that reason.

| Parameter | Notes |
|---|---|
| `q` | Full-text query; under two characters is treated as browsing |
| `category`, `businessId` | Exact filters |
| `minPrice`, `maxPrice` | A reversed range is corrected, not treated as empty |
| `sort` | `relevance` (default with a query), `newest`, `price_asc`, `price_desc` |
| `limit`, `offset` | Capped at 200 and 2000 |

Every sort ends with the primary key, so paging cannot show one product twice
while never showing another.

**Typo tolerance** uses `word_similarity` from pg_trgm, and only for a
single-word query that matched nothing. `similarity` was the wrong function:
it compares whole strings, so "samsng" scores 0.22 against "Samsung
Refrigerator" and would be rejected, where `word_similarity` scores 0.57
against an unrelated word's 0.00. A multi-word miss is left alone on purpose —
for "red shirt" loose matching returns a blue one, because "shirt" alone scores
well, and an empty result is the honest answer.

pg_trgm is optional. The migration attempts it separately and skips the
trigram index if the database refuses the extension, because losing typo
tolerance must not cost a deployment its schema — TypeORM runs pending
migrations in one transaction, so a single failing statement would roll back
the batch and the instance would never boot.

A synchronize-built install (the desktop app) has no expression index, since
those live only in the migration. Search still returns correct results there,
just unindexed, which is acceptable for a single shop's catalogue.
