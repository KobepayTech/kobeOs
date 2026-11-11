# Independent KobeOS apps — browser SDK v1

Build an ordinary HTML/CSS/JavaScript application. KobeOS injects the `KobeOS`
bridge into its isolated frame. React, Vue or other tools can be used if their
output is bundled into the same HTML file; external scripts and styles are blocked.
No NPM publication or account token is needed to call the browser bridge.

```js
const { items, hasMore } = await KobeOS.inventory.list();
```

The owner must explicitly grant `inventory.read`. Results contain only the owner's
product ID, name, SKU, stock and unit, up to 1,000 products. No prices, costs,
payments, account tokens or inventory writes are exposed. Types are in `index.d.ts`.

## Package and publish

See `examples/stock-alerts/manifest.json` and `app.html` for a complete sample.

```
node scripts/package-developer-app.cjs examples/stock-alerts/manifest.json examples/stock-alerts/app.html examples/stock-alerts/releases/0.1.0.kobeapp.json
node scripts/package-developer-app.cjs examples/stock-alerts/manifest.json examples/stock-alerts/app.html examples/stock-alerts/releases/0.2.0.kobeapp.json 0.2.0
```

1. Open **App Store → Developer apps → Publish an app** and upload the JSON package.
2. Preview your submitted package with clearly labelled sample inventory.
3. A different administrator inspects it and approves or rejects it in Review queue.
4. Approved packages appear in Discover apps. Users consent to permissions on install.
5. Submit a higher version for updates. Installed versions remain unchanged until
   the owner approves the update. No KobeOS rebuild is required for app updates.

Authenticated API: `POST /api/app-distribution/releases`; install:
`POST /api/app-distribution/installed` with `releaseId` and explicit `grants`.
KobeOS attests approved packages with Ed25519 and verifies their digest and signature
before running them. Revoked releases cannot open or read inventory. Uninstall
revokes access. Requests from a different publisher cannot replace your app ID.

## Preview limits

This first milestone supports free inline web apps and one read capability.
Apps open within the App Store's managed KobeOS window and require the node API
to be online. Payments, developer payouts, ratings, external-network permissions,
native executables, arbitrary disk access and offline package caching are not part
of this milestone. Publisher verification and a wider security review are required
before opening the platform to unrestricted public submissions.

This preview uses authenticated publisher, reviewer and merchant accounts on the
same server node. The desktop's single-owner administrator shortcut cannot approve
apps. A central catalogue, desktop account pairing and cross-node distribution
still need a separate rollout; no local user is automatically promoted to reviewer.
