# KobeOS business operating system delivery

The user authorized all four phases on 2026-11-02. This file records scope and
acceptance requirements, not a declaration that the roadmap is complete.

| Phase | Reusable systems | Current delivery | Remaining acceptance requirements |
| --- | --- | --- | --- |
| 1: shared infrastructure | JWT, commerce businesses, approvals, journals, platform events | Consistent briefing; accepted/revoked viewer grants; guarded decisions; precise line quantization and bank-source replay rejection; transactional inbox | Per-business delegated write permissions; canonical customer/supplier/employee links; currency-qualified accounting; all financial domain adapters; audited operator recovery; release migration validation |
| 2: operational intelligence | Scheduled agents and run logs, skill packs, memory graph, rent automation | Verified business events become owner-scoped searchable memory atomically with inbox delivery; Home opens existing agents, workflows and review tools | Event-triggered workflow definitions and deduplicated execution; installable employee profiles with budgets and permissions; integrated retention and correction policies; independent approval stages; end-to-end task acceptance |
| 3: connected businesses | Commerce, suppliers, warehouse items/movements/pick tickets, POS, chat, email, WhatsApp, social connections | Home combines recorded email/WhatsApp previews, separates private communication from shared briefing grants, and supports atomic deduplicated warehouse transfers | Canonical stock identity across modules; reservations and cross-module stock adapters; consented supplier discovery through approved purchase to receipt; unified conversation identity and channel adapters; provider-backed delivery tests |
| 4: physical operations and innovation | Hotel rooms, properties, warehouse records, cameras, print bridge, App Store, developer projects | Recorded hotel-room and warehouse-stock view in Home; App Store prototype preserved separately | Live resource graph and optional 3D with a conventional view; authenticated hardware enrollment, capabilities and health; reviewed third-party agent packages, restricted execution and billing; real device tests |

## Required product surfaces

Kobe Home is the common entry point. Its six areas are Home, Business, Money,
People, Intelligence and Network. Its briefing uses real backend records and
shows errors rather than fabricated activity. Staff invitations explicitly
disclose workspace-wide read access; the recipient accepts before viewing.
Existing applications remain the operational tools until their shared adapters
are implemented and tested. Links to an application are not proof that every
roadmap capability in that area is complete.

## Additional capabilities carried by the roadmap

Maps, authorized Vision, Swahili/English Voice, Documents, external Connect,
Offline synchronization, Trust/disputes, Analytics, Hardware Hub and App Studio
must reuse their existing counterparts where present. For each one, acceptance
requires an owner-scoped working UI, persisted backend behavior, permission and
failure tests, and an honest disconnected state. External provider connections,
financial settlement and physical hardware require real-account/device tests
before being marked ready. A simulated response does not satisfy those checks.

## Delivery rules

- Extend existing modules; do not invent parallel ledgers or identity systems.
- Tie changes and their events to the same transaction.
- No autonomous payments, outbound messages or destructive actions without an
  owner's explicit configuration and applicable approval.
- Use a stable source identity for retries and preserve audit evidence.
- Show capability availability accurately. Configuration, provider approval,
  device enrollment and offline state must remain visible.
- Changes in review are not installed versions. Apply reviewed migrations and
  rebuild/retest both Windows editions before declaring a release ready.


## Verified implementation boundaries

The room/stock board is a conventional record-based view capped at 100 entries
per resource type, with total counts displayed. It is not an IoT sensor feed or
an optional 3D renderer. The email/WhatsApp preview combines the latest 50 stored
messages per source into 50 recent entries and excludes drafts. No global team
chat is aggregated: those records do not currently have a trustworthy owner
boundary. Provider connection status is not inferred from stored messages.

A warehouse transfer requires two owner-controlled records in different
warehouses with an identical SKU and unit. It reuses the existing movement
service inside one transaction and records both movement events. A stable
owner/request key deduplicates retries; changing quantities under a previously
used key fails. Stock cannot become negative; a failed second leg rolls back
the first leg too. This does not create a reservation, supplier order, payment
or valuation journal. Neither POS quantities nor unrelated SKUs are silently
merged into a universal inventory pool.

Business activity is projected into the existing owner-scoped memory graph only
when new supported events are delivered. Signal, memory and delivery status
commit atomically. Replay does not duplicate memory. Historical published
events have not been backfilled. Memory is evidence, not authorization and not
an instruction channel for external message content.
