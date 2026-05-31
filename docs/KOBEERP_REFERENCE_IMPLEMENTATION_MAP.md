# KobeERP Reference Implementation Map

This document tracks what is not complete in KobeERP/KobeOS and which open-source platform or product pattern should be copied/adapted. The goal is to keep all existing KobeOS features, improve them, and add missing production workflows.

## Core rule

Do not replace KobeERP. Copy patterns from the listed platforms and adapt them into KobeERP modules.

---

## 1. ERP Core

**Status:** Partial

**KobeERP has:** dashboard, inventory, sourcing, accounting, credit/collections, property manager, users, reports.

**Missing:** deeper module structure, workflows, approvals, audit logs, product variants, multi-company, multi-branch.

**Reference to copy:**

- ERPNext: https://github.com/frappe/erpnext
- Frappe Framework: https://github.com/frappe/frappe
- Odoo: https://github.com/odoo/odoo

**Copy these patterns:**

- ERPNext DocType-style business objects
- ERPNext inventory/accounting workflows
- Odoo module/menu structure
- Odoo access rights and group permissions
- Audit trail for every critical transaction

**Target KobeOS modules:**

- `server/src/erp`
- `server/src/pos`
- `server/src/warehouse`
- `server/src/account`
- `src/apps/erp-dashboard`

---

## 2. POS Improvements

**Status:** Started, not complete

**KobeERP has:** product/order backend and basic stock deduction.

**Started in KobeOS:** POS entity fields for receipts, BNPL, discounts, warehouse shelf, pick ticket references.

**Missing:** cashier UI, barcode scanner flow, receipt print, returns, offline queue, shift closing, cash drawer, warehouse handoff.

**Reference to copy:**

- Odoo POS: https://github.com/odoo/odoo/tree/17.0/addons/point_of_sale
- ERPNext POS: https://github.com/frappe/erpnext/tree/develop/erpnext/selling/page/point_of_sale
- Chromis POS: https://github.com/ChromisPos/ChromisPOS

**Copy these patterns:**

- Odoo POS cashier layout
- Odoo POS receipt model
- ERPNext POS item/customer/payment workflow
- Shift/session close report
- Offline transaction queue concept

**Target KobeOS modules:**

- `server/src/pos`
- `src/apps/erp-dashboard`
- `src/lib/api.ts`

---

## 3. Receipt Printing

**Status:** Not complete

**Needed behavior:** Every completed POS order must generate a customer receipt and print it automatically if a printer is configured.

**Reference to copy:**

- Odoo POS receipt flow: https://github.com/odoo/odoo/tree/17.0/addons/point_of_sale
- ESC/POS printing patterns: https://github.com/lsongdev/node-escpos

**Copy these patterns:**

- Receipt template model
- Print preview before retry
- Thermal printer command path
- Receipt reprint permission

**Target KobeOS modules:**

- `server/src/print`
- `server/src/pos`
- `electron/*` printer IPC
- `src/apps/erp-dashboard`

---

## 4. Warehouse Picking, Packing, Dispatch

**Status:** Started, not complete

**Started in KobeOS:** `WarehousePickTicket` entity and module registration.

**Missing:** controller APIs, pick queue, status transitions, QR scanning, warehouse receipt print, packing and dispatch dashboards.

**Reference to copy:**

- ERPNext Stock/Warehouse: https://github.com/frappe/erpnext/tree/develop/erpnext/stock
- Odoo Inventory: https://github.com/odoo/odoo/tree/17.0/addons/stock

**Copy these patterns:**

- Pick list
- Delivery note
- Stock reservation
- Bin/shelf locations
- Transfers between warehouses
- Backorders

**Target KobeOS modules:**

- `server/src/warehouse`
- `server/src/pos`
- `src/apps/erp-dashboard`

---

## 5. Discount Engine

**Status:** Not complete

**Needed behavior:** Support product discounts, customer discounts, volume discounts, promo codes, Buy X Get Y, time-limited discounts, and manager approval for large discounts.

**Reference to copy:**

- Medusa promotions: https://github.com/medusajs/medusa
- Odoo pricelists: https://github.com/odoo/odoo/tree/17.0/addons/product
- ERPNext pricing rules: https://github.com/frappe/erpnext/tree/develop/erpnext/accounts/doctype/pricing_rule

**Copy these patterns:**

- Rule priority
- Coupon usage limits
- Product/category targeting
- Customer group targeting
- Approval limits by role

**Target KobeOS modules:**

- `server/src/discounts`
- `server/src/pos`
- `src/apps/erp-dashboard`

---

## 6. Buy Now Pay Later / Customer Credit

**Status:** Started, not complete

**Started in KobeOS:** POS customer credit profile entity fields.

**Missing:** credit APIs, credit limit validation, installment plans, repayment schedules, reminders, receivables posting, approval workflow.

**Reference to copy:**

- ERPNext customer credit limit and accounts receivable: https://github.com/frappe/erpnext/tree/develop/erpnext/accounts
- Odoo invoicing/payment terms: https://github.com/odoo/odoo/tree/17.0/addons/account

**Copy these patterns:**

- Credit limit check
- Payment terms
- Installment schedule
- Aging report
- Customer statement
- Payment reminder

**Target KobeOS modules:**

- `server/src/pos`
- `server/src/account`
- `server/src/payments`
- `src/apps/erp-dashboard`

---

## 7. Accounting Integration

**Status:** Partial

**Missing:** automatic journal entries from POS, discount posting, BNPL accounts receivable, inventory/COGS posting, tax posting, reconciliation.

**Reference to copy:**

- ERPNext Accounting: https://github.com/frappe/erpnext/tree/develop/erpnext/accounts
- Odoo Accounting: https://github.com/odoo/odoo/tree/17.0/addons/account

**Copy these patterns:**

- Sales invoice posting
- Payment entry
- Journal entry validation
- Debits must equal credits
- Accounts receivable and payable ledger
- Customer statement

**Target KobeOS modules:**

- `server/src/account`
- `server/src/pos`
- `src/apps/erp-dashboard`

---

## 8. Shopify-Style Online Commerce

**Status:** Not complete

**Needed behavior:** Online shops, products, categories, variants, cart, checkout, store builder, themes, coupons, SEO, subdomains.

**Reference to copy:**

- Medusa: https://github.com/medusajs/medusa
- Medusa Next.js starter: https://github.com/medusajs/nextjs-starter-medusa
- Spree Commerce: https://github.com/spree/spree
- Vendure: https://github.com/vendure-ecommerce/vendure

**Copy these patterns:**

- Product catalog
- Variant model
- Cart/checkout lifecycle
- Orders and fulfillment
- Storefront API
- Channel/market support

**Target KobeOS modules:**

- `server/src/store`
- `server/src/store-registry`
- `server/src/store-settings`
- `src/apps/erp-dashboard`

---

## 9. Store Builder / Themes

**Status:** Not complete

**Needed behavior:** Merchant can build website pages and publish to `businessname.kobeapptz.com`.

**Reference to copy:**

- Craft.js page editor: https://github.com/prevwong/craft.js
- GrapesJS: https://github.com/GrapesJS/grapesjs
- Medusa storefront starter: https://github.com/medusajs/nextjs-starter-medusa

**Copy these patterns:**

- Drag-and-drop section builder
- Theme JSON config
- Preview before publish
- Domain/subdomain routing

**Target KobeOS modules:**

- `server/src/store-registry`
- `server/src/store-settings`
- `src/apps/erp-dashboard`

---

## 10. Phone PWA Connection Manager

**Status:** Not complete

**Needed behavior:** Phone chooses best connection automatically:

1. Same Wi-Fi local server: `http://kobe.local`
2. KobeOS hotspot: phone joins `KobeOS-Business` Wi-Fi, opens `http://kobe.local`
3. Online access: `https://businessname.kobeapptz.com`

**Reference to copy:**

- RxDB: https://github.com/pubkey/rxdb
- ElectricSQL: https://github.com/electric-sql/electric
- Workbox PWA: https://github.com/GoogleChrome/workbox
- Bonjour/mDNS patterns: https://github.com/homebridge/ciao

**Copy these patterns:**

- Offline local database
- Sync queue
- Local discovery
- Conflict resolution
- Cloud fallback

**Target KobeOS modules:**

- `server/src/connection-manager`
- `electron/lan-server.cjs`
- `src/lib/api.ts`
- PWA frontend folder

---

## 11. Sync Engine

**Status:** Partial local sync exists, not complete for phone/cloud.

**Needed behavior:** Local-first writes, queued sync, cloud backup, conflict resolution, offline phone mode.

**Reference to copy:**

- RxDB: https://github.com/pubkey/rxdb
- ElectricSQL: https://github.com/electric-sql/electric
- PouchDB: https://github.com/pouchdb/pouchdb

**Copy these patterns:**

- Pull replication
- Push replication
- Conflict resolver
- Offline queue
- Last-write vs manual resolution

**Target KobeOS modules:**

- `electron/sync-engine*`
- `src/lib/api.ts`
- `server/src/*`

---

## 12. KobePay Integration

**Status:** Partial/planned

**Needed behavior:** wallet payments, QR payments, mobile money, BNPL, reconciliation, settlement, agent management.

**Reference to copy:**

- Odoo Payments: https://github.com/odoo/odoo/tree/17.0/addons/payment
- Medusa payment provider pattern: https://github.com/medusajs/medusa

**Copy these patterns:**

- Payment provider abstraction
- Payment capture/refund
- Reconciliation ledger
- Settlement status
- QR payment session

**Target KobeOS modules:**

- `server/src/payments`
- `server/src/pos`
- `server/src/account`
- `src/apps/erp-dashboard`

---

## 13. Loyalty, Cashback, Rewards

**Status:** Not complete

**Reference to copy:**

- Odoo loyalty module patterns: https://github.com/odoo/odoo
- Medusa loyalty plugin patterns: https://github.com/medusajs/medusa

**Copy these patterns:**

- Points per spend
- Cashback rules
- Redemption
- Expiry
- Customer tiers

**Target KobeOS modules:**

- `server/src/loyalty`
- `server/src/pos`
- `server/src/payments`

---

## 14. Delivery Tracking

**Status:** Not complete

**Reference to copy:**

- ERPNext Delivery Note / Shipment: https://github.com/frappe/erpnext/tree/develop/erpnext/stock
- Odoo Delivery: https://github.com/odoo/odoo/tree/17.0/addons/delivery

**Copy these patterns:**

- Delivery note
- Carrier assignment
- Proof of delivery
- Tracking number
- Returns

**Target KobeOS modules:**

- `server/src/cargo`
- `server/src/warehouse`
- `server/src/pos`

---

## 15. Final target flow

```text
POS Sale
  -> Apply discount rules
  -> Check BNPL / payment method
  -> Deduct or reserve inventory
  -> Generate customer receipt
  -> Print customer receipt
  -> Create warehouse pick ticket
  -> Print warehouse pick receipt
  -> Pick items by shelf/bin
  -> Pack order
  -> Dispatch / delivery tracking
  -> Auto-post accounting entries
  -> Sync to phone/cloud
```

## Priority implementation order

1. POS receipt + pick ticket API
2. Warehouse pick dashboard
3. Discount engine
4. BNPL credit checks
5. Accounting auto-posting
6. Phone PWA connection manager
7. Online store engine
8. Store builder/themes
9. Loyalty/cashback
10. Delivery tracking
