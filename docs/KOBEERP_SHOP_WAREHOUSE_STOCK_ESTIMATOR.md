# KobeERP Shop vs Warehouse Inventory Value Estimator

## Purpose

KobeERP will support two inventory views:

1. **Warehouse Inventory** — exact stock received and stored in the warehouse.
2. **Shop Inventory** — stock transferred/sold from the warehouse to a shop.

This feature adds a fast estimated-stock model for shops that do not count every item daily. It estimates remaining stock using the total value of goods transferred to the shop and the shop's sales value.

This is an estimate, not an exact stock count. Exact stock will still come from barcode/QR/item-level sales where available.

---

## Example

A shop receives goods from the warehouse:

```text
Total goods value: 20,000,000 TZS
Total pieces:      1,000 pcs
```

Average value per piece:

```text
20,000,000 / 1,000 = 20,000 TZS per estimated piece
```

If the shop sells:

```text
Sales today: 5,000,000 TZS
```

Estimated sold pieces:

```text
5,000,000 / 20,000 = 250 pcs
```

Estimated remaining stock:

```text
1,000 - 250 = 750 pcs
```

---

## Formula

```text
average_piece_value = allocation_total_value / allocation_total_pieces
estimated_sold_pieces = sales_value / average_piece_value
estimated_remaining_pieces = allocation_total_pieces - estimated_sold_pieces
```

Alternative form:

```text
estimated_sold_pieces = (sales_value / allocation_total_value) * allocation_total_pieces
estimated_remaining_pieces = allocation_total_pieces - estimated_sold_pieces
```

---

## Super Profit Logic

If shop sales exceed the allocated goods value, the surplus is treated as **super profit**.

```text
super_profit = sales_value - allocation_total_value
```

Example:

```text
Allocation value: 20,000,000 TZS
Sales value:      24,000,000 TZS
Super profit:      4,000,000 TZS
```

When this happens, KobeERP should show:

```text
Estimated stock remaining: 0 pcs
Super profit: 4,000,000 TZS
Status: Allocation exceeded
```

---

## Required Backend Model

### ShopStockAllocation

```ts
{
  id: string;
  shopId: string;
  warehouseId: string;
  allocationNumber: string;
  totalValue: number;
  totalPieces: number;
  averagePieceValue: number;
  allocatedAt: Date;
  status: 'OPEN' | 'CLOSED' | 'RECONCILED';
}
```

### ShopStockEstimate

```ts
{
  allocationId: string;
  salesValue: number;
  estimatedSoldPieces: number;
  estimatedRemainingPieces: number;
  superProfit: number;
  accuracy: 'ESTIMATE';
  calculatedAt: Date;
}
```

---

## Required API Endpoints

```text
POST /shop-stock/allocations
GET  /shop-stock/allocations
GET  /shop-stock/allocations/:id
POST /shop-stock/allocations/:id/calculate-estimate
POST /shop-stock/allocations/:id/reconcile
```

---

## Frontend Screens

Add inside KobeERP:

```text
Inventory
├── Warehouse Inventory
├── Shop Inventory
├── Stock Allocations
├── Estimated Stock Remaining
├── Super Profit Report
└── Reconciliation
```

---

## UI Example

```text
Allocation: WH-DAR → Shop Kariakoo
Value:      20,000,000 TZS
Pieces:     1,000 pcs
Avg/Piece:  20,000 TZS

Sales:      5,000,000 TZS
Sold Est:   250 pcs
Remaining:  750 pcs
SuperProfit: 0 TZS
```

---

## Reconciliation Logic

Because this is an estimate, KobeERP must allow physical reconciliation.

Example:

```text
Estimated remaining: 750 pcs
Physical counted:    720 pcs
Difference:           30 pcs
```

System should classify the difference as:

```text
Shrinkage / loss / error / unrecorded sale
```

---

## Reference Platforms / Repositories

Copy inventory-transfer and reconciliation patterns from:

- ERPNext Stock/Warehouse: https://github.com/frappe/erpnext/tree/develop/erpnext/stock
- ERPNext Stock Reconciliation: https://github.com/frappe/erpnext/tree/develop/erpnext/stock/doctype/stock_reconciliation
- Odoo Inventory: https://github.com/odoo/odoo/tree/17.0/addons/stock
- Odoo Stock Valuation: https://github.com/odoo/odoo/tree/17.0/addons/stock_account

But this **estimated shop stock from value ratio** is a KobeERP-specific feature and should be implemented as unique Kobe logic.

---

## Target KobeOS Modules

```text
server/src/warehouse
server/src/pos
server/src/erp
server/src/account
src/apps/erp-dashboard
```

---

## Priority

High priority for shops that sell mixed goods without scanning every item.

Implementation order:

1. Add shop stock allocation backend entity.
2. Add estimate calculation service.
3. Add ERP frontend screen.
4. Link daily POS sales to allocation estimates.
5. Add reconciliation screen.
6. Add super profit report.
