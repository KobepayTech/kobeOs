# DNS setup for KobeOS subdomains

This document is the DNS-only piece. After you finish the records
below, the SPA subdomain routing already shipped in the code does
the rest — no per-subdomain configuration needed for new apps.

For TLS + nginx setup, see `SUBDOMAIN-SETUP.md` (separate doc).

---

## TL;DR

Add **two records** at your DNS provider:

```
*.kobeapptz.com    A    <your-server-IPv4>
kobeapptz.com      A    <your-server-IPv4>
```

That's it. The wildcard covers every existing public app
(`tuma.`, `mzigo.`, `me.`, `track.`, `posys.`, `cargo.`, `api.`)
plus every future tenant slug (`serenahotel.kobeapptz.com`, etc.)
and every future app you add.

Add an `AAAA` record alongside each `A` if your server has an IPv6
address.

---

## What gets covered

Once the wildcard is live, the following hostnames all start
resolving to your server:

| Hostname                        | What it serves                       |
| ------------------------------- | ------------------------------------ |
| `kobeapptz.com`                 | KobeOS desktop / launcher (apex)     |
| `api.kobeapptz.com`             | NestJS API                           |
| `tuma.kobeapptz.com`            | KobeOS · Tuma money tokens           |
| `mzigo.kobeapptz.com`           | KobeOS · Mzigo ground cargo          |
| `cargo.kobeapptz.com`           | Alias → Mzigo                        |
| `me.kobeapptz.com`              | Customer self-serve portal           |
| `track.kobeapptz.com`           | Public cargo tracking                |
| `posys.kobeapptz.com`           | POSys property + hotel ops           |
| `{tenant-slug}.kobeapptz.com`   | Tenant storefront (per customer)     |

---

## Provider walk-throughs

Pick the section that matches your DNS host. Field labels vary
slightly between providers; the records themselves are identical.

### Cloudflare

> **Set BOTH records to DNS-only (grey cloud).** Mixing — apex
> proxied + wildcard direct, or the reverse — works but is fragile:
> two cert chains to maintain (Cloudflare edge cert + origin cert),
> easy to forget which mode the next record needs, and you can hit
> a `526` cert-validation error if the two diverge. KobeOS already
> handles TLS at the origin via certbot DNS-01 and assumes direct
> client IPs for rate limiting, so DNS-only end-to-end is the
> simplest correct setup. See the "Proxied mode" section below if
> you specifically need Cloudflare's DDoS/WAF/caching.

1. Dashboard → `kobeapptz.com` zone → **DNS** → **Records**.
2. Click **Add record**.
3. Set:
   - **Type**: `A`
   - **Name**: `*` (just the asterisk — Cloudflare expands it)
   - **IPv4 address**: your server's public IP
   - **Proxy status**: **DNS only** (grey cloud, NOT orange)
   - **TTL**: Auto
4. **Save**.
5. Add a second record with everything the same except:
   - **Name**: `@` (the apex)
   - **Proxy status**: **DNS only** (grey cloud)
6. **Save**.

If you've also got IPv6, add two more records with `Type: AAAA`
pointing at the IPv6 address, same Name (`*` and `@`), both
DNS-only.

#### Proxied mode (only if you need DDoS / WAF / caching)

If you do want Cloudflare in front — apex AND wildcard both orange
cloud, no mixing — you must also do all four of these or the apps
break in subtle ways:

1. **SSL/TLS → Overview** → set encryption mode to **Full
   (strict)**. Anything less than Full will downgrade or proxy
   plaintext.
2. **Network** → enable **WebSockets**. Required for Socket.io
   (POS realtime, Cargo dispatch board, Kanban). Off by default
   on the free plan in some zones.
3. **Rules → Transform Rules** → add a request header rewrite
   that sets `X-Real-IP` from `cf.connecting_ip`. The
   `ThrottlerGuard` rate limiter (and the FX cache, and the
   Mzigo throttler) keys on `X-Real-IP`; without this every
   request appears to come from the Cloudflare edge IP and your
   limits collapse to one bucket for the whole internet.
4. **Caching → Cache Rules** → add a bypass-cache rule for
   `/api/*`, `/sw.js`, `/manifest.json`, and `/socket.io/*`. The
   origin already sends the right `Cache-Control` headers but
   Cloudflare's defaults can override them, which staleness-locks
   PWA updates and 504s websocket upgrades.

The QR scanner in Mzigo (BarcodeDetector + `getUserMedia`) can
also trip Cloudflare's bot-fight mode and get challenged with a
captcha on the initial fetch, which kills the scanner UX. If you
see this, **Security → Bots** → set Bot Fight Mode to **Off** for
the public-app subdomains.

### AWS Route 53

1. Console → **Route 53** → **Hosted zones** → `kobeapptz.com`.
2. **Create record** → **Quick create**.
3. Wildcard:
   - **Record name**: `*` (it auto-appends `.kobeapptz.com`)
   - **Record type**: `A`
   - **Value**: server IP
   - **TTL**: 300
   - **Routing policy**: Simple routing
4. **Create records**.
5. Repeat for the apex (leave **Record name** blank).

### Google Cloud DNS

1. Cloud Console → **Network services** → **Cloud DNS** → your
   `kobeapptz-com` zone.
2. **Add standard** → fill in:
   - **DNS Name**: `*`  (leave the rest of the suffix populated)
   - **Resource Record Type**: `A`
   - **TTL**: `300`
   - **IPv4 Address**: server IP
3. **Create**.
4. Repeat with **DNS Name** blank for the apex.

### Namecheap

1. Domain List → **Manage** next to `kobeapptz.com` → **Advanced
   DNS** tab.
2. **Add New Record**:
   - **Type**: `A Record`
   - **Host**: `*`
   - **Value**: server IP
   - **TTL**: Automatic
3. **Save**.
4. **Add New Record** again for the apex with **Host**: `@`.

### GoDaddy

1. My Products → `kobeapptz.com` → **DNS** → **Manage Zones**.
2. **Add** → **A**:
   - **Host**: `*`
   - **Points to**: server IP
   - **TTL**: 1 Hour (or Custom 600)
3. **Save**.
4. Verify the existing `@` (apex) `A` record already points at the
   server; if not, edit/add it.

### Manual / generic BIND zone file

If you maintain your own zone, append:

```
$ORIGIN kobeapptz.com.
$TTL 300

@        IN  A     203.0.113.10
*        IN  A     203.0.113.10
@        IN  AAAA  2001:db8::10        ; optional
*        IN  AAAA  2001:db8::10        ; optional
```

Bump the SOA serial, reload bind, done.

---

## Records you do NOT need

To save you a tab-shuffle, the following are **not** required:

- `CNAME` for individual app subdomains. The wildcard `A` covers
  them. If you'd rather use CNAMEs (e.g. your TLS automation
  validates against a specific canonical host), that works too —
  but it's extra records to maintain.
- `MX` / `TXT` / `SPF` / `DMARC`. These only matter for email; the
  apps don't send mail from these hostnames.
- A separate `api` record. The wildcard already covers
  `api.kobeapptz.com`. Only carve out an explicit `api` `A` record
  if you want the API on a different server.
- A `_acme-challenge` record. Certbot creates the temporary TXT
  during DNS-01 issuance; you don't pre-create it.

---

## Verify it worked

After the TTL expires (default 5 min on most providers), check:

```sh
# Each command should return your server's IP. The wildcard answers
# for arbitrary subdomains — pick any name to confirm.
dig +short kobeapptz.com           A
dig +short api.kobeapptz.com       A
dig +short tuma.kobeapptz.com      A
dig +short anything.kobeapptz.com  A   # should also resolve
```

Or, browser-friendly version:

```sh
curl -sI https://dnschecker.org/api/v1/quickcheck?host=tuma.kobeapptz.com&type=A
```

If `dig` returns nothing, the most common causes are:

| Symptom                              | Cause                                |
| ------------------------------------ | ------------------------------------ |
| `;; ANSWER SECTION` is empty         | Record not saved, or wrong zone      |
| Returns the registrar's parking page | Nameservers not updated to your DNS  |
|                                      | provider (set them at the registrar) |
| Returns `127.0.53.53`                | Name collision (rare — usually only  |
|                                      | happens with new gTLDs)              |
| Resolves only on the first device    | Your local DNS cached `NXDOMAIN`;    |
|                                      | flush with `sudo dscacheutil`        |
|                                      | (macOS) or `resolvectl flush-caches` |
|                                      | (Linux)                              |

Propagation is usually under 5 minutes on modern providers; allow up
to 48 hours in pathological cases.

---

## Adding a custom apex (e.g. yourbrand.com)

If a customer wants to white-label on their own domain instead of a
subdomain of `kobeapptz.com`:

1. **They** add `A` + wildcard `*.A` records at their DNS provider
   pointing to your server's IP.
2. **You** issue a wildcard cert for their domain (DNS-01 against
   their DNS — needs a delegated credential or a DNS-CAA record they
   allow).
3. **You** add a `server_name yourbrand.com *.yourbrand.com` block
   to `server/nginx/nginx.conf` and copy the cert in.

The SPA already routes by `window.location.hostname`, so once
nginx serves the bundle for the new apex, every public app works
on the customer's domain automatically — no code changes.

---

## When you can skip wildcard DNS

If you only want **specific** app subdomains and would rather not
run a wildcard (some compliance or audit scenarios), add one `A`
record per app:

```
kobeapptz.com   A   <ip>
api             A   <ip>
tuma            A   <ip>
mzigo           A   <ip>
cargo           A   <ip>
me              A   <ip>
track           A   <ip>
posys           A   <ip>
```

Then issue per-host certs (HTTP-01 is fine — no DNS-01 needed) and
list each `server_name` explicitly in nginx. Trade-off: you have to
add a new record (and re-issue a cert) every time you ship a new
public-app subdomain or onboard a new tenant slug. With wildcard,
it's zero ops.
