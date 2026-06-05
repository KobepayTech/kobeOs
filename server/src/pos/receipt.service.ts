import { Injectable } from '@nestjs/common';
import { PosOrder, PosOrderItem } from './pos.entity';

export interface Receipt {
  orderNumber: string;
  text: string;
  printedAt: string;
}

export interface ReceiptOptions {
  /**
   * BNPL instalment schedule. When present the receipt prints the
   * "Balance to pay later (red)" section with one row per instalment.
   */
  schedule?: Array<{ amountDue: number; dueDate: Date }>;
}

const WIDTH = 40;

function pad(left: string, right: string): string {
  const space = Math.max(1, WIDTH - left.length - right.length);
  return left + ' '.repeat(space) + right;
}

function money(n: number | string, currency: string): string {
  return `${currency} ${Number(n).toFixed(2)}`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

@Injectable()
export class ReceiptService {
  /**
   * Plain-language receipt:
   *   "Money in today (green)"  — what the customer actually paid now
   *   "Balance to pay later (red)" — what they still owe, per instalment
   * No accounting jargon (no debit/credit/AR). Designed so a cashier
   * reading aloud to the buyer doesn't need to translate.
   */
  format(order: PosOrder, items: PosOrderItem[], opts: ReceiptOptions = {}): Receipt {
    const lines: string[] = [];
    const title = 'KobeOS Point of Sale';
    lines.push(title.padStart((WIDTH + title.length) / 2));
    lines.push('='.repeat(WIDTH));
    lines.push(`Order:  ${order.orderNumber}`);
    lines.push(`Date:   ${order.createdAt.toISOString().slice(0, 19).replace('T', ' ')}`);
    if (order.customerName) lines.push(`Customer: ${order.customerName}`);
    if (order.customerPhone) lines.push(`Phone:    ${order.customerPhone}`);
    lines.push('-'.repeat(WIDTH));

    for (const it of items) {
      lines.push(it.productName);
      const qtyPrice = `${it.quantity} x ${money(it.unitPrice, order.currency)}`;
      lines.push(pad(`  ${qtyPrice}`, money(it.lineTotal, order.currency)));
    }

    lines.push('-'.repeat(WIDTH));
    lines.push(pad('Subtotal', money(order.subtotal, order.currency)));
    if (Number(order.discountAmount) > 0) {
      lines.push(pad('Discount', `-${money(order.discountAmount, order.currency)}`));
    }
    if (Number(order.taxAmount) > 0) {
      lines.push(pad('Tax', money(order.taxAmount, order.currency)));
    }
    lines.push(pad('TOTAL', money(order.total, order.currency)));
    lines.push('-'.repeat(WIDTH));

    const isBnpl = (order.paymentMethod ?? '').toUpperCase() === 'BNPL';
    if (isBnpl && opts.schedule && opts.schedule.length > 0) {
      // Buyer is paying nothing today (full BNPL) — show the schedule only.
      lines.push('Money in today (green)');
      lines.push(pad('  Today', money(0, order.currency)));
      lines.push('');
      lines.push('Balance to pay later (red)');
      lines.push(pad('  Remaining', money(order.total, order.currency)));
      lines.push('');
      const plural = opts.schedule.length === 1 ? 'instalment' : `${opts.schedule.length} instalments`;
      lines.push(`  Pay in ${plural}:`);
      for (const inst of opts.schedule) {
        lines.push(pad(`    ${money(inst.amountDue, order.currency)}`, `by ${fmtDate(inst.dueDate)}`));
      }
    } else {
      // Cash / Card / Mobile / Bank — paid in full today.
      lines.push('Money in today (green)');
      lines.push(pad(`  ${order.paymentMethod}`, money(order.total, order.currency)));
    }

    lines.push('-'.repeat(WIDTH));
    lines.push('');
    const thanks = 'Thank you for your business!';
    lines.push(thanks.padStart((WIDTH + thanks.length) / 2));

    return {
      orderNumber: order.orderNumber,
      text: lines.join('\n'),
      printedAt: new Date().toISOString(),
    };
  }
}
