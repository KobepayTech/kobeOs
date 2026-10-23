# Hotel biometric retention

Normative rules for any KobeOS feature that compares a guest's face — today the
proposed camera monitoring work under `/api/hotel-security`. A face comparison
is special-category data under Tanzania's Personal Data Protection Act 2022 and
GDPR Article 9. Collection is only lawful with a deletion path, so the deletion
path is specified first and the capture code must implement it.

## The rule

Destroy a booking's biometric material when the **stay has ended and the bill is
clear** — not when the bill is paid.

Paying is not the signal. A guest who prepays at check-in has a clear bill on
their first night; deleting then would strip the feature of its purpose for the
rest of the stay. A guest who disputes a charge never has a clear bill; keeping
their face comparison until they pay would retain biometrics longest for exactly
the people under suspicion, which is the opposite of what the rule is for.

So: settlement ends retention, and a hard cap ends it regardless.

## Purge triggers

A booking's biometric material is destroyed when **any** of these fires. There is
no trigger that extends retention.

| # | Trigger | Condition |
|---|---|---|
| 1 | Settled stay | `status ∈ {CHECKED_OUT, CANCELLED}` **and** `folio.outstanding ≤ 0.0001` |
| 2 | Consent withdrawn | Immediately, overriding every other consideration |
| 3 | Hard cap | `now > scheduledCheckOut + BIOMETRIC_RETENTION_DAYS` (default 7), **whatever the balance** |
| 4 | Manual | Operator-initiated, recorded with the actor |

Trigger 1 is the common path and trigger 3 is the backstop. An unpaid balance is
a debt to pursue against the booking record; it is not a lawful basis to keep
someone's face.

Purge is terminal. A charge posted after checkout reopens the folio but never
re-arms biometric capture for that booking.

## What has to be destroyed

More than the photographs. All of the following are biometric or
biometric-derived personal data tied to an identified guest:

- Reception reference photographs and any camera crops, wherever the local
  adapter holds them.
- `faceSimilarity` and `candidateBookingId` on retained observation rows. A
  cosine similarity between a named guest and a camera capture is an assertion
  about that person's body, and it outlives the image.
- Any review classification whose justification was a face match.

The operational outcome may be kept — that a table was occupied, that a stay was
flagged and reviewed, who reviewed it. The biometric derivation behind it may
not.

## Mechanism: destroy the key, not just the row

Deleting rows and files does not delete them from last night's database dump or
the filesystem snapshot. Erasure that a regulator will accept has to reach those
copies, and it cannot.

Encrypt every biometric artifact under a per-booking data key, and make deletion
the destruction of that key:

```
hotel_biometric_keys ( bookingId PK, dataKey, createdAt, destroyedAt )
```

The local adapter encrypts reference photographs and crops under the booking's
key rather than writing plaintext JPEGs. Purging destroys the key row and
overwrites it. Every backup then holds ciphertext that nothing can open, which
is erasure that survives contact with a restore.

This is the part most likely to be skipped, and the only part that makes "we
deleted it" true rather than approximately true.

## Proof, without keeping the thing

Retain a receipt that contains no biometric content:

```
hotel_biometric_purges ( bookingId, trigger, artifactKinds, artifactCount, purgedAt, actor )
```

No locator that resolves to a face, and no hash of an image — a hash still links
to the original for anyone holding it. The receipt is a financial-grade audit
record and is kept; the material it describes is gone.

## Consent

Consent is recorded before the first capture, per subject, not per booking: every
occupant to be compared needs their own reference and their own consent. It names
the purpose, and it is withdrawable mid-stay, which fires trigger 2 immediately.

A booking with no consent record must not be enrolled. The comparison utility is
not a reception enrolment service and must not become one by default.

## Implementation notes

**The settlement predicate is fragile today.** `HotelFrontDeskService.folio()`
computes `paid` by matching `hotel_financials.description LIKE '%[booking:<id>]%'`
on a free-text column. Editing a description silently changes whether a booking
reads as settled. That is tolerable for a folio display and not tolerable as the
trigger for an irreversible deletion. Before wiring trigger 1 to it, give
payments a real `bookingId` column; until then, trigger 3 is the guarantee and
trigger 1 is an optimisation.

**Hook points** are `recordPayment()` and `checkOut()` in
`server/src/hotel/hotel-front-desk.service.ts`, plus an hourly sweep for triggers
3 and the settled bookings whose last event was neither.

**Reconcile with what already exists.** `server/src/hotel-security/` holds an
earlier generation of this idea — room entry events, presence state, signal links
and reviews across five tables. Camera observations, table states and their
reviews overlap it on presence, occupancy counts and review classification. Decide
whether the camera work extends those tables or replaces them before adding a
second presence model and a second review model to the same module.

## What this does not do

Deletion on settlement does not make the monitoring itself proportionate. The
system flags inconsistencies for human review; it does not establish theft, an
unpaid stay, or identity, and a corridor view cannot count who remains in a room.
Those limits belong in the operator-facing documentation, not only here.
