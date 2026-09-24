# HotelOS Byte-style restaurant foundation

This module deliberately reimplements the useful product patterns from restaurant POS/KDS systems without copying AGPL source code.

## Foundation delivered

- One HotelOS Order Hub contract for room service, table, pickup and delivery.
- Station routing (kitchen/bar/other) already remains authoritative from the HotelOS menu catalog.
- Recipe/BOM model that maps a menu item to inventory ingredients.
- Deterministic inventory depletion calculator for accepted restaurant orders.
- Offline-first browser queue primitives for POS/QR/KDS clients.
- Idempotency key support in the queue contract to prevent duplicate replay after reconnect.
- Waste/variance and forecasting are intentionally the next layer, built on the recipe consumption events.

## Intended flow

Lala / room QR / waiter / POS -> HotelOS Order Hub -> KDS station -> recipe consumption -> inventory -> folio/accounting -> analytics/KobeAI.

The server remains the source of truth. Offline clients enqueue mutations locally and replay them when connectivity returns. The server should persist idempotency keys before this queue is enabled for payment-bearing mutations.
