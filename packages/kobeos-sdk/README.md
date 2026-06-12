# @kobeos/sdk

The official TypeScript SDK for building third-party apps that run inside KobeOS.

A KobeOS app is a React component + a manifest. The host loads it into a
window, gates it on subscription tier and permissions, and feeds it a
runtime context (user, theme, locale, plan). Your app uses this SDK to
talk back to the OS.

## Install

```bash
npm install @kobeos/sdk react react-dom
```

## Minimal app

```tsx
import { lazy } from 'react';
import { defineApp, useKobeOS, useKobeApi } from '@kobeos/sdk';

function MyAppRoot() {
  const { user, theme } = useKobeOS();
  const { data, loading } = useKobeApi<{ count: number }>('/my-backend/stats');

  return (
    <div className={theme === 'dark' ? 'bg-slate-950 text-white p-6' : 'bg-white text-slate-900 p-6'}>
      <h1>Hello, {user?.name ?? 'guest'}</h1>
      {loading ? 'Loading…' : <p>You have {data?.count} things.</p>}
    </div>
  );
}

export default defineApp({
  id: 'acme-invoicing',
  name: 'Acme Invoicing',
  description: 'Generates invoices for the storefront',
  icon: 'Receipt',
  category: 'productivity',
  version: '0.1.0',
  width: 900,
  height: 600,
  minWidth: 400,
  minHeight: 300,
  singleton: true,
  requiresAuth: true,
  permissions: ['net.fetch', 'kobepay.read'],
  subscriptionTier: 'pro',
  publisher: { name: 'Acme Ltd', url: 'https://acme.example' },
  component: lazy(() => import('./MyAppRoot')),
});
```

## What the SDK gives you

| API | Use |
|---|---|
| `defineApp(manifest)` | Builds + type-checks your app manifest |
| `useKobeOS()` | Live OS context: user, theme, locale, plan, expiresAt |
| `useKobeApi<T>(path)` | JWT-aware fetch with `{ data, error, loading, refetch }` |
| `apiFetch(path, init)` | Imperative equivalent of `useKobeApi` |
| `launchApp(id, data?)` | Deep-link another KobeOS app |
| `notify(title, body, kind?)` | Surface a desktop toast |

## Permissions

Every app declares the host capabilities it needs. The OS prompts the
user on install and denies API calls that fall outside the granted set.

```ts
type AppPermission =
  | 'fs.read' | 'fs.write'
  | 'net.fetch'
  | 'kobepay.read' | 'kobepay.write'
  | 'storefront' | 'cargo' | 'hotel'
  | 'ai.chat' | 'ai.speech'
  | 'media.camera' | 'media.mic';
```

## Subscription tiers

- `free` — anyone can launch.
- `trial` — only users with an active KobeOS Trial or Pro plan.
- `pro` — only users with an active KobeOS Pro plan.

KobeOS gives every new user a free 7-day trial automatically on signup,
so `trial`-tier apps are reachable out of the box; after expiry the
host shows the paywall in your app's window instead of mounting your
component.

## Publishing

Submit your app for the in-OS App Store via the publisher dashboard
at `/api/appstore/submit` (auth required). The OS team reviews
permissions + manifest + entry-point bundle, then lists it.

For private deployments you can side-load by dropping the built bundle
into `~/.kobeos/sideloaded-apps/<your-app-id>/manifest.js`.
