# KobeOS ↔ KobeAI K9 integration

Status: adopted • Updated: 2026-10-09

## Ownership

KobeOS owns **Duka OS**, now fully consolidated into KobeOS.

KobeOS is the commerce/POS side:
- school shops and merchants
- catalogs, products, prices and inventory
- checkout
- QR/NFC acceptance
- orders
- merchant operations
- settlement and commerce reporting

KobeAI K9 owns the combined **School OS + Student OS** side:
- school/campus/class/student context
- attendance and classroom intelligence
- learning profiles and assessments
- exam/OCR analytics
- Teacher Lens and teacher glasses
- parent portal and mini-K9
- student AI experience
- school/student policy context

## Pocket-money integration

The Kobepay student pocket-money wallet remains the monetary foundation.

KobeOS must not create an independent school-money ledger. A school purchase
uses the Kobepay transaction/ledger and then publishes an idempotent event for
K9.

```
Student / Parent
      |
      v
Kobepay wallet
      |
      v
KobeOS checkout (Duka OS)
      |
      v
Kobepay transaction_id
      |
      v
K9 school/student activity
      |
      +--> parent notification
      +--> student history
```

K9 may provide student eligibility, spending-limit and school-policy context
to the checkout flow, but the final monetary mutation is performed by the
Kobepay wallet/ledger.

## Stable identifiers

Every integration request/event should carry:
- `tenant_id`
- `school_id`
- `student_id`
- `student_code`
- `merchant_id`
- `order_id`
- `transaction_id`

Payment-completed events must be safe to retry and deduplicate using
`transaction_id`.

## API/event contract

KobeOS publishes:

```json
{
  "event": "school.payment.completed",
  "transaction_id": "kp_tx_...",
  "school_id": "school_...",
  "student_id": "student_...",
  "student_code": "K9-001",
  "merchant_id": "merchant_...",
  "order_id": "order_...",
  "amount": 5000,
  "currency": "TZS",
  "occurred_at": "2026-10-09T00:00:00Z"
}
```

K9 consumes this event for student activity, parent notifications and school
analytics. It does not rewrite the wallet balance from the event.

## Non-goals

- Do not resurrect a separate Duka OS application.
- Do not move merchant inventory/checkout into K9.
- Do not move learning/attendance/exam intelligence into KobeOS.
- Do not maintain two monetary ledgers.
