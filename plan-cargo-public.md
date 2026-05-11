# KOBECARGO Public Apps Ecosystem — Build Plan

## Overview
Build 6 new public-facing cargo apps + update the main cargo app with a welcome landing page.

## Apps to Build

### 1. `cargo-welcome` — KOBECARGO Landing Page
- Beautiful hero: "Welcome to KOBECARGO"
- Links/cards for Sender, Owner, Driver, Receiver portals
- Company admin login link
- Quick stats ticker (shipments delivered, active, etc.)
- Dark theme, frosted glass, animated

### 2. `cargo-sender` — Public Sender App
- Anyone can access via link
- Send parcel form (sender info, receiver info, package details)
- Get instant quote
- Track submitted parcels
- QR code for parcel pickup
- Payment selection (PAY_NOW / PAY_ON_ARRIVAL)

### 3. `cargo-owner` — Public Owner Tracking App
- Anyone can track by parcel ID / phone
- View all parcels associated with their phone number
- Real-time status updates with timeline
- Push notification subscription
- Download receipts

### 4. `cargo-driver` — Public Driver App
- Driver registration / login
- View assigned trips and routes
- Checkpoint scanning and updates
- Trip status updates (depart, arrive, incident report)
- Earnings and rewards tracker
- Navigation integration

### 5. `cargo-receiver` — Receiver App (Admin-created)
- Login with credentials created by company admin
- View incoming parcels
- Confirm delivery / pickup
- Delivery scheduling
- Notification preferences

### 6. `cargo-company` — Company Admin Panel
- Dashboard with company stats
- Manage receivers (create, edit, disable accounts)
- Push notification composer (send to owners/drivers/receivers)
- SMS gateway configuration (custom headers, templates)
- Message history / delivery reports
- Company branding settings

## Implementation
- All apps in `src/apps/cargo-*` directories
- Each with its own `manifest.ts` and `index.tsx`
- Register all in `src/os/registry.ts`
- Add desktop icons in `src/os/store.ts`
- Use shared types from cargo_tz where applicable
- Consistent design: dark logistics theme, green accents, frosted glass

## Stage 1: Create Welcome + Sender + Owner (parallel)
## Stage 2: Create Driver + Receiver (parallel)
## Stage 3: Create Company Admin with SMS (parallel with Stage 2)
## Stage 4: Integration — Registry, Store, Desktop updates
## Stage 5: Build and Deploy
