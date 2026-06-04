import { Injectable } from '@nestjs/common';
import { PosOrder, PosOrderItem } from './pos.entity';

export interface Receipt {
  orderNumber: string;
  text: string;
  printedAt: string;
}

const WIDTH = 40;

function pad(left: string, right: string): string {
  const space = Math.max(1, WIDTH - left.length - right.length);
  return left + ' '.repeat(space) + right;
}

function money(n: number | string, currency: string): string {
  return `${currency} ${Number(n).toFixed(2)}`;
}

@Injectable()
export class ReceiptService {
  format(order: PosOrder, items: PosOrderItem[]): Receipt {
    const lines: string[] = [];
    lines.push('KobeOS Point of Sale'.padStart((WIDTH + 'KobeOS Point of Sale'.length) / 2));
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
    lines.push(pad('Paid via', order.paymentMethod));
    lines.push('');
    lines.push('Thank you for your business!'.padStart((WIDTH + 'Thank you for your business!'.length) / 2));

    return {
      orderNumber: order.orderNumber,
      text: lines.join('\n'),
      printedAt: new Date().toISOString(),
    };
  }
}
