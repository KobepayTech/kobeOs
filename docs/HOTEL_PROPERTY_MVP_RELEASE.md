# Hotels, Properties and Lala release checks

This change is a release candidate, not proof of a working production deployment.

## Changes

- The hotel launcher keeps the original interface. PR #145 wires its reception actions to persistent front-desk APIs; this PR adds a transaction and a room lock shared with Lala's booking path. Failed KDS delivery does not produce a successful receipt in the legacy screen.
- Leases support 1, 6 or 12 months per invoice. Monthly rent remains the base rate. Billing is in advance, anchored to the start month; the end date is exclusive. The final invoice covers only remaining calendar months, without daily proration. Existing leases retain monthly billing. The UI defaults new leases to annual billing.
- Charges are generated only within the lease term and at the configured interval. Payment entry selects an existing charge. Payments, charge allocation and reversals are atomic; a request key prevents duplicate payment retries. Overpayments and tenant/unit/currency mismatches are rejected. Existing unallocated payments are not silently reallocated.
- Public shop IDs no longer grant ownership. Landlords generate private seven-day, single-use invitations in Property → Marketplace. Generating a new invitation revokes the previous one. Both new Lite businesses and existing businesses need an invitation.
- Offline full-KobeOS merchants are hidden from public product discovery, matching checkout's existing online requirement. Lite shops remain cloud available.
- Lala uses SMS verification before creating or recovering a passport. Challenges are database-backed, cryptographically random, limited to five attempts, and expire after five minutes. Proof is phone-bound and expires after ten minutes. Failed SMS delivery fails closed.

## Migration and rollout

Back up the database and run the tracked migrations before deploying the new clients. Migration `1792540800000-LeaseBillingIntervals` adds lease billing intervals, rent payment request keys, shop invitations and Lala phone challenges.

**Existing Lala passport links are intentionally invalidated.** The old public endpoint could return their bearer tokens to someone knowing only a phone number. Guests must verify their phone again. The rollback migration cannot restore invalidated links. Existing signed-in browser passport storage uses a new key.

Review existing unallocated rent payments before generating or collecting replacement charges; this release does not infer historical allocations.

## External dependencies and remaining launch gates

- Lala SMS: configure `BEEM_API_KEY`, `BEEM_SECRET_KEY` and the approved sender configured by BeemService. Verify delivery on a real consenting test phone after deployment. Automated tests mock SMS transport.
- The production API previously returned HTTP 530. The Cloudflare workflow needs its production account, database, JWT and provider-encryption settings. This PR does not repair account-side DNS, tunnel or container configuration and does not deploy.
- Marketplace checkout submits orders for payment arranged with merchants. Lala creates reservations for payment arranged with hotels. Neither public flow introduced here collects online payment. Provider collection, reconciliation, refunds and merchant settlement remain launch work if online prepayment is required.
- OTA channel sync and external tenant screening remain provider integrations; saved settings are not live integrations.
- Test from a migrated production-like database: hotel reception → Lala availability → checkout → housekeeping; annual rent → partial/full payment → reversal; landlord invite → merchant catalogue → multi-shop order; OTP → recovery → old-link rejection.
- Existing alternate booking endpoints and offline desktop/cloud synchronization require a full integration review before claiming platform-wide inventory consistency.

## Validation

Run frontend build/tests, backend build/unit tests, and the database-backed suites `hotel-property-readiness`, `lala`, and `property-marketplace`. The readiness suite covers competing reception reservations, duplicate rent payment requests, reversals, passport recovery protection and migration execution. Run the full CI suite before merging.
