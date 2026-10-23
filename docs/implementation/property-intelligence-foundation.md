# Property intelligence foundation

Branch: `feat/property-intelligence-foundation`. This implementation extends the existing Properties module and preserves PropEasy, the commercial shop activation flows, and the legacy receipt portal.

## Feature completion

| Capability | Implemented behavior | Limits |
| --- | --- | --- |
| Automated invoicing | Existing cadence-aware rent generator, manual generation, opt-in daily scheduler | Annual/half-year/monthly cadence; no tax invoice certification |
| Reconciliation and arrears | Explicit allocation of verified, owned inbound Kobepay receipts in a transaction; replay protection and charge balances | One receipt to one charge; overpayments/splits rejected; no bank feed matching |
| P&L and expenses | Property/currency scoped earned rent, collections, expenses, cash net, operating profit; expense entry | Management report, not statutory accounts; excludes depreciation/tax; earned rent is contractual day-prorated rent |
| Forecasting | Twelve-month contracted collections from actual lease cadence and end dates | No speculative occupancy, renewals or exchange conversion |
| Discrepancies | Allocation mismatch, unallocated payments, repeated references; AI explains current facts | Evidence checks, not a trained fraud detector |
| Accounting integration | Explicit approved posting of receipts/expenses into existing ERP balanced journals; duplicate prevention | Existing ERP is currencyless: posting restricted to TZS; audited reversals remain future work |
| Building management | Existing properties/units plus editable floor/corridor/side/position, occupancy and performance views, tenant assignment | Existing apartment/shop/office/warehouse support reused; no CAD editor |
| Shop activation | Existing commercial marketplace and merchant activation retained | No replacement shop or inventory system |
| Maintenance | Assets/service dates, evidence-based risk, work orders/status, opt-in recurring overdue-asset tickets | Rule-based scheduling, not sensor-based failure prediction; no autonomous purchasing |
| Utilities | Meter readings, calculated bills, payment recording, tenant visibility | Manual readings and payment confirmation; no meter integration |
| Property AI | Natural-language query over owned database records; existing agent forecast tool uses the same live service | Requires configured AI runtime; facts remain available when unavailable |
| Reminders | Approved one-time or opt-in daily SMS reminders, durable per-charge/day deduplication | Requires configured Beem provider; ambiguous sends not retried automatically that day |
| Documents | Save document metadata, image OCR, supplied transcript analysis with evidence and review requirement | AI/OCR configuration required; no digital signature or legal adjudication |
| Reports | Persisted performance snapshots and downloadable JSON report | No PDF/statutory financial statement export |
| Tenant self-service | Revocable, hashed, expiring private links; invoices, receipts, leases, deposits, utilities, maintenance requests | Link possession grants access; distribute privately; no tenant identity account or online rent checkout added |
| Lease renewals | Approved new term, overlap checks, cadence validation, existing-lease preservation | No e-signature; deposit stays with original lease rather than moving silently |
| Jumla vacancies | Owner opt-in vacant-unit publication/search and applications in existing Jumla Properties view | Application review remains with owner; no automatic tenancy |
| Inspections | Unit checklist, condition, notes and HTTPS photo references | Photos use existing external/storage URLs; no new upload backend |
| Deposits | Auditable receipts/refunds/deductions with lease balance limits and replay protection | Records movements; does not initiate a financial payout |
| Mobile | Responsive landlord intelligence panels and tenant portal forms | Device-browser walkthrough still required |

## Integrity and authorization

Owner APIs use existing JWT authentication and owner-scoped queries. Sensitive actions require explicit approval. Mutations use transaction-scoped idempotency keys, input fingerprints and appropriate row/advisory locks. Tenant links are random bearer tokens stored only as hashes with expiry/revocation. Tenant responses omit owner metadata. Public listings contain only opted-in vacant units.

The existing AI `record_rent_payment` execution path is disabled because it previously changed paid balances without a payment record. Users must use the approved Properties payment workflow. AI never confirms payment from a document or approves a lease change.

Migration `1792756800000-PropertyIntelligenceFoundation` adds assets, utility bills, inspections, deposit entries, tenant access and operation receipts, plus the unit publication flag. Production must run migrations; do not enable schema synchronization.

## Verification

- Frontend full unit suite: 185 passed, 4 skipped.
- Backend unit suite: 138 passed.
- Frontend and backend lint: no errors (repository warnings remain).
- Frontend typecheck/build and backend build run locally.
- Added eight migrated-schema end-to-end scenarios for owner isolation, approval, annual invoicing, payment concurrency/replay, journals, deposits, renewal/utility validation, tenant revocation, vacancies and maintenance automation.
- Local PostgreSQL execution is unavailable because the environment rejects the required process-user transition. Database end-to-end verification must run in the repository's PostgreSQL CI job. Do not treat local unit/build success as migration verification.

## Deployment and remaining blockers

Do not merge until CI verifies the exact PR commit. Apply the migration before enabling the new UI. Validate SMS delivery and configured AI/OCR services in staging; no live SMS, financial transfer or production deployment was performed during implementation. Smoke-test landlord and tenant flows on mobile devices. Multi-currency ERP posting, financial reversals, bank feed reconciliation, electronic signatures, online tenant payments and sensor-based predictive maintenance are outside this foundation and remain unimplemented.
