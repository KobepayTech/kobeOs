# Phase 1: shared business foundations

This first increment connects existing KobeOS systems. It is not completion of
the entire business-OS roadmap. The unfinished App Store / Stock Alerts prototype
is preserved separately on local branch `feat/appstore-stock-alerts` (`48777d9`).

## What is connected

| Foundation | Existing code reused | This increment |
| --- | --- | --- |
| AI Brain | Kobe Agent, operating controls, business records | A consistent owner-scoped briefing; exact decimal order and expense totals grouped by currency; existing assistant uses the shared briefing. |
| Identity | JWT user identity, owner IDs, commerce business directory | Explicit `owner-account-v1` context. Administrator status never bypasses workspace grants on Brain endpoints. |
| Permissions | JWT guard, role claims, approval chains | Owner and write-role checks on workflow execution and decisions; client-supplied approvals are cleared; approved workflows cannot be edited or reapproved. |
| Financial ledger | Existing balanced KobePay Pro journals | Ledger entries and their activity event commit together. Non-finite/negative amounts and attempts to mix currencies in a legacy account are refused. |
| Events | Existing platform domain events | Versioned, transaction-bound, deduplicated events; bounded retries; a durable, data-only Brain activity inbox. |

The deterministic briefing works without a running language model. Qwen can use
the same structured data through the existing `business_health` tool. Both
Windows editions share these source changes; previously built installers do not
contain this increment until rebuilt.

## Brain API and metric definitions

Authenticated routes (under the normal `/api` prefix):

- `GET /brain/snapshot?timezone=Africa/Dar_es_Salaam`
- `GET /brain/briefing?timezone=Africa/Dar_es_Salaam`
- Existing `GET /ai/briefing?timezone=...` now uses the shared service and retains
  the optional month-end rent-charge approval reminder.

The assistant sends the device's IANA timezone. Other callers default to UTC.
Snapshot generation uses a read-only repeatable-read transaction and the
database clock. Invalid timezones fail explicitly; database errors are not
silently converted to zero activity.

Completed order totals include only `COMPLETED` POS orders created during the
current business day. They are not cash received, net profit or reconciled bank
income. The date is order creation, not a payment or completion timestamp.
Expenses use the current business month. Decimal sums remain strings; USD and
TZS are never added together. Legacy rent charges lack a currency and are
explicitly marked with `currency: null`. Reserved hotel rooms are not reported
as occupied. Warehouse and POS stock counts remain separate and can overlap.

The snapshot includes pending decisions, journal posting counts, recent activity
and delivery status. Commerce business directory results are capped at 100 and
activity at 20; those are display limits, not financial aggregation limits.
Snapshots are owner-account scoped (including accepted read-only workspace grants), not an independently selectable business's
consolidated financial statement. Commerce `catalogOwnerId` and `ownerUserId`
can differ; this increment does not silently merge their records.

## Transactional activity stream

New producers record events through `PlatformEventsService.recordInTransaction`:

- `inventory.stock.changed`: every recorded warehouse movement.
- `inventory.stock.low`: crossing from above to at/below the reorder level.
- `kobepay.ledger.posted`: a balanced journal posting, not a bank transfer.
- `ai.approval.decided`: a final approved/rejected decision, not proof of action
  completion. Check the approval's separate execution state for that outcome.

The caller must supply an active transaction, owner, aggregate ID and bounded
idempotency key. A unique owner/event/key index prevents duplicates. Reusing a
key with different aggregate or payload data fails rather than silently losing
the change. Rolling back the business transaction also removes its events.

Every five seconds the internal consumer processes at most 20 events. Row
locking with `SKIP LOCKED` permits concurrent workers. Signal insertion and
`PUBLISHED` state commit in the same transaction, and the source-event unique
key makes redelivery harmless. Projection failures retain the event, back off
from five seconds to at most one hour, and stop automatic delivery at eight
attempts. Unsupported schema versions fail safely. The consumer projects a
small allowlisted payload and never sends messages, changes prices or moves
money. Here, `PUBLISHED` means the internal activity signal was committed.

Legacy `emit()` producers remain compatible, but have not all been migrated to
transaction-bound recording. Legacy events are not automatically replayed into
the new inbox. Signal retention, paging, terminal-failure alerts and an audited
operator redrive interface are follow-up work; do not claim universal event
coverage or external delivery.

## Approval and recovery rules

Only the signed-in owner with an allowed write role may decide their request.
All new chain steps start pending, irrespective of supplied status/actor data.
A locked transaction records the decision, audit entry and final decision event.
The execution claim is persisted before the business action starts, so concurrent
clicks cannot execute the same request twice. A workflow also has a persistent
execution claim to stop concurrent runs from creating duplicate action requests.

Execution is `NOT_STARTED`, `RUNNING`, `COMPLETED` or `FAILED`, independently of
approval status. The controls display completed and uncertain/failed outcomes.
External actions are not enclosed in a database transaction and cannot provide
exactly-once execution across a crash or network failure. No automatic retries
are attempted. A process crash can leave a `RUNNING` action or workflow claim;
an operator must inspect the business/provider records before reconciling it.
Do not clear a claim or create a replacement financial action blindly. Existing
approved tool requests are marked for manual review during migration, never
replayed. Several stages approved by the same user are not independent approval
by multiple people.

## Release and verification

Apply migration `1793600000000-SharedBusinessFoundations` before starting the new
backend. Hosted deployments must use migrations, not schema synchronization.
The migration extends existing tables; it requires the earlier platform and AI
operating migrations. Its destructive `down` method removes the new signals and
execution metadata, so use database backups and a reviewed rollback plan.

The new test suite includes an opt-in real PostgreSQL integration run. It only
connects to loopback and resets the fixed database `kobeos_foundations_test`.
Never use that database for application data. On a disposable local PostgreSQL
server with that database already created, set `FOUNDATION_TEST_PORT`, optional
`FOUNDATION_TEST_USER` / `FOUNDATION_TEST_PASSWORD`, then run:

```powershell
npm --prefix server run test:unit -- --runInBand business-foundations.spec.ts
```

Without the port, only policy unit checks run and database checks are explicitly
skipped. CI creates the dedicated test database and enables the integration
checks against its PostgreSQL service. Tests cover migration up/down/up,
rollback, conflicting and concurrent duplicates, retry limits and recovery,
stock concurrency, ledger balance/currency safety, concurrent decisions and
workflows, uncertain action outcomes, decimal/currency totals, and real JWT API
authorization. External actions are mocked; no real money or messages are sent.

## Work still required for the full Phase 1 roadmap

1. Business/organization memberships and delegated roles, invitations, revocation
   and an explicit selected-business context across every existing module. Global
   administrator role is not a substitute for a business membership.
2. Cross-module customer, supplier and employee identities with reviewed merge
   and import rules. Existing domain IDs cannot simply be replaced.
3. A universal accounting contract: currency-qualified accounts, decimal-safe
   posting arithmetic throughout, posting-source idempotency and reconciled
   integrations from every domain. Existing journals remain the source for
   KobePay Pro; this increment does not replace them or invent a second ledger.
   Legacy account uniqueness omits currency; posting into an existing account
   with another currency is now rejected until that schema is migrated.
4. Transactional event adoption by the remaining producers, observability,
   retention, reviewed redrive and explicit downstream subscription permissions.
5. Apply shared authorization and action-recovery contracts to every older
   direct-write AI endpoint, scheduled job and automation. This increment hardens
   operating approvals/workflows; it is not an audit of every existing write path.

Digital employees and the App Store should build on these contracts after the
identity and ledger migrations, rather than introduce their own owner, approval
or financial systems.


## Follow-up: staff workspace access and posting precision

Workspace APIs under `/api/brain/workspaces` support listing grants, inviting an
existing account, accepting an invitation and revoking/leaving. Invitations
require `memberId` and `scopeConsent: "ALL_OWNER_ACCOUNT_RECORDS"`. This is
explicitly workspace-wide read access, not access to one shop. An invitation
alone grants no access. Only its recipient can accept; the owner or recipient
can revoke. An active viewer can request `/brain/snapshot?ownerId=...`; each
request checks the current grant. In-flight snapshots retain normal database
snapshot consistency. Viewer access cannot approve actions or operate the
owner's other modules. Grants and changes are durably audited. A staff management
screen and narrower business/module permissions remain required before this is
a general team-management product.

Posting validation now quantizes each line into integer four-decimal units
before comparing totals. Account updates use integer-unit arithmetic. Inputs or
balances beyond the safe range of the existing numeric API fail explicitly.
This prevents the earlier sum-then-round check from accepting lines whose stored
values do not balance. Other legacy wallet and reconciliation calculations have
not yet been converted to a universal exact-decimal contract.

`PostInput.idempotencyKey` optionally identifies a posting source. Deposits with
a bank transaction ID automatically use that ID as their source. Transactional
locks and a unique owner/source index prevent concurrent duplicate postings.
Replays raise a conflict instead of returning success: this rolls back any
caller wallet/domain writes, preventing duplicate overlays. Legacy bank-linked
deposits are checked too, without rewriting historical keys. Callers without a
stable source still need migration; this is not global request idempotency.

Also apply `1793601000000-LedgerSourceIdempotency` and
`1793602000000-WorkspaceMemberships` before using this follow-up. No production
schema or live account grants have been changed during development.
