# Guided catalogue intake

A merchant with eighty items photographs them, then faces a form eighty times.
The bulk upload that already existed applied one price and one stock figure to
every image, which only helps when the items are identical — so in practice
people uploaded one at a time anyway.

This turns the work into a conversation: upload everything once, then answer
two or three questions per photo with the photo in front of you. The photo is
the prompt, so nobody has to remember which item they are describing.

## The three kinds

| Kind | Questions | Creates |
|---|---|---|
| `SHOP_PRODUCT` | name, size, price, **stock**, category | a POS product, via the existing quick-add path |
| `RESTAURANT_MENU_ITEM` | name, portion, price, menu section | a hotel menu item |
| `HOTEL_ROOM` | room number, **room type**, nightly rate, capacity | a hotel room |

Stock is asked only of a shop. A kitchen does not count portions the way a
shelf counts units, and a room's availability comes from its bookings, not a
quantity field — asking anyway would invite a number nothing reads.

A size or portion is folded into the name, so the catalogue shows "Soda 500ml"
rather than two entries both called "Soda". A room keeps its number alone:
"101 Large" is not a room number.

## The flow

```
POST /api/intake/sessions            upload the batch, get the first question
GET  /api/intake/sessions/:id        the current question
POST /api/intake/items/:id/answer    answer; the response carries the next one
POST /api/intake/items/:id/skip      leave one undescribed
POST /api/intake/items/:id/retry     put a skipped or failed photo back
GET  /api/intake/sessions            batches still part-way through
```

Answering returns the next question, so a merchant works through the queue
without a second request per photo.

## What it refuses, and when

A shop batch is refused **at upload** when there is no shop yet, with a
message saying to set one up first. Letting someone upload eighty photos and
describe one before telling them is the wrong place to fail.

Validation runs before anything is created, so a mistyped price cannot leave a
half-made product behind, and every problem is reported at once rather than
one per attempt. What was typed is kept, so a correction does not start from an
empty form. A photo whose creation fails is marked failed and stays in the
queue rather than being lost.

## AI is optional

Each photo is shown to the vision model once, through the existing
`describeProductImage`, which drafts a name, category and visible sizes. The
answer is cached on the item: vision is slow, the same photo is shown again
when someone steps back, and retrying on every poll would stall the queue for
a feature that is optional.

**Price and stock are never suggested.** A wrong price that looks
authoritative is worse than an empty box, because it gets accepted without
thinking and then sold at.

With no model installed — the common case on a shop machine — the questions
arrive empty and everything still works. A model that is missing or offline is
recorded as attempted with nothing rather than retried.

## Durability

The queue is a pair of tables, not memory. A merchant photographing eighty
items answers over several sittings, on a phone, on a connection that drops;
losing the queue would mean re-uploading everything and re-answering what was
already done, which is worse than the form this replaces.

Photos are converted to webp and stored under a public token in
`commerce_product_media`, the same place quick-add puts them. So a photo is
servable while it is still being described, and it replicates to the cloud with
the catalogue rather than needing a second mechanism.

Verified by `server/test/intake.e2e-spec.ts` (23 tests, including the hotel and
restaurant kinds and the no-model path) and
`server/src/intake/intake.rules.spec.ts` (39 tests).

---

# Turning the setup interview into a working business

The setup interview asks what the business is and what it does. Those answers
then sat in a column: the owner still had to find the App Store, work out which
of fourteen bundles matched the business they had just described, and build
their own automations.

Two endpoints close that gap.

```
POST /api/onboarding/setup-plan   what this business probably needs
POST /api/onboarding/provision    install the parts the owner ticked
```

## It proposes; it never installs

The plan changes nothing. Bundles are entitlements and some are billed, so
acting straight from an interview answer would charge someone for answering a
question. The owner reads a list and ticks it.

**Nothing ticked does nothing.** An owner who unticks the lot has declined, and
installing anyway would be charging them for it. A choice the plan does not
offer is ignored rather than rejected, so a stale screen cannot install
something that has since been withdrawn.

## Every line explains itself

| Business | Bundles | Automations |
|---|---|---|
| Shop | Retail | Daily sales summary (20:30), low stock before opening (07:00) |
| Hotel | Hotels & Hospitality | Occupancy and arrivals (07:00), daily revenue (20:30) |
| Restaurant | Restaurants & Food Service | Daily sales summary, weekly menu performance |
| Anything else | Office & Services | Weekly business health |

A service the owner listed adds a bundle: deliveries add Cargo & Logistics,
rentals add Property, mobile money adds Finance & Payments, live selling adds
Creators. Service matching is deliberately narrow — a word has to clearly name
a line of business before it adds a paid bundle, because guessing wide puts
charges on a list the owner never asked about, and that is the fastest way to
make the whole plan untrustworthy.

Each bundle and each job carries a sentence saying why it is there. A list
someone did not ask for, offering to change what their business can do, is only
trustworthy if every item explains itself.

## The automations only report

Each one becomes a scheduled agent with **no write tools**, `DRAFT_ONLY`
approval, and its output going to the KobeOS inbox for a person to read. An
agent switched on during setup, before the owner has seen what it produces,
must not be able to change stock, prices or bookings. A unit test asserts the
objectives contain no verb that acts.

Times come from the business: the stock warning lands before opening, while
there is still time to reorder, and the summary after close, so the day it
describes is finished. Both run in the timezone the interview collected — a
wrong one would deliver the morning list in the afternoon.

Deliberately few. An owner who finds five unexplained agents running on their
data turns them all off, including the useful ones.

## Partial failure keeps what worked

Bundles and automations are applied independently and reported on separately. A
shop that gets its bundles but loses its connection before the automations
keeps the bundles and can finish the rest, rather than starting the interview
again.

Verified by `server/src/onboarding/setup-plan.spec.ts` (25 tests) and
`server/test/setup-provisioning.e2e-spec.ts` (15 tests, including the
read-only guarantee and partial failure).
