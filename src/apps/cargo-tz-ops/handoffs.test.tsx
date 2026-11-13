// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { PendingHandoffs, type CargoTzApi } from './handoffs';
import { handoffLink, ParcelLabel, trackingFromScan } from './parcel-label';

const reference = 'CTZ-20261108-A1234567890123456789';
const label = {
  trackingNumber: reference, origin: 'Dar es Salaam', destination: 'Mbeya',
  cartonNumber: 1, cartonCount: 2,
};

afterEach(cleanup);

test('recognizes a handwritten carton code with spaces and rejects an incorrect check digit', () => {
  expect(trackingFromScan('Carton: 123 456 789 05')).toBe('12345678905');
  expect(trackingFromScan('12345678906')).toBe('');
});

test('new labels open public tracking and intake accepts both new and legacy references', () => {
  render(<ParcelLabel parcel={label} />);
  const href = screen.getByRole('link', { name: 'Open tracking page' }).getAttribute('href');
  expect(href).toBe(`${window.location.origin}/ctz/${reference}`);
  expect(trackingFromScan(href!)).toBe(reference);
  expect(handoffLink(reference)).toBe(`${window.location.origin}/cargotz/receive?handoff=${reference}`);
  expect(trackingFromScan(handoffLink(reference))).toBe(reference);
  expect(trackingFromScan('CTZ-20261108-000123')).toBe('CTZ-20261108-000123');
  expect(screen.getByText('Carton 1 of 2')).toBeTruthy();
});

test('intake opens the collector record and only submits measurements and a condition note', async () => {
  const parcel = {
    ...label, id: 'parcel', senderName: 'Goods owner', senderPhone: '0712345678',
    receiverName: 'Recipient', receiverPhone: '0787654321', status: 'AWAITING_HANDOFF',
    description: 'Two shop orders', notes: 'Pickup requested',
  };
  const api = vi.fn(async (path: string) => {
    if (path === '/cargotz/handoffs') return [];
    if (path.endsWith('/confirm')) return { ...parcel, status: 'RECEIVED_AT_SHOP' };
    return { parcel, collector: null };
  });
  render(<PendingHandoffs api={api as CargoTzApi} Scanner={() => null} />);

  fireEvent.change(screen.getByLabelText('Tracking number'), { target: { value: `https://example.test/ctz/${reference}` } });
  fireEvent.click(screen.getByRole('button', { name: 'Open' }));
  expect(await screen.findByText('Owner · Goods owner · 0712345678')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Weight (kg)'), { target: { value: '4.5' } });
  fireEvent.change(screen.getByLabelText('Seal or condition note'), { target: { value: 'Seal intact' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm physical handoff' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith(`/cargotz/handoffs/${reference}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ weight: 4.5, note: 'Seal intact' }),
  }));
  expect(await screen.findByText(`Custody accepted for ${reference}.`)).toBeTruthy();
});

test('a shipment handoff link opens every carton and advances to the next one after acceptance', async () => {
  const secondReference = 'CTZ-20261108-B1234567890123456789';
  const first = {
    ...label, id: 'first', senderName: 'Goods owner', senderPhone: '0712345678',
    receiverName: 'Recipient', receiverPhone: '0787654321', status: 'AWAITING_HANDOFF',
    description: 'Two shop orders', notes: 'Pickup requested',
  };
  const second = { ...first, id: 'second', trackingNumber: secondReference, cartonNumber: 2 };
  let firstAccepted = false;
  const api = vi.fn(async (path: string) => {
    if (path === '/cargotz/handoffs') return [];
    if (path.endsWith('/confirm')) {
      firstAccepted = true;
      return { ...first, status: 'RECEIVED_AT_SHOP' };
    }
    return {
      parcel: path.endsWith(secondReference) ? second : first,
      collector: null,
      cartons: [
        { ...first, status: firstAccepted ? 'RECEIVED_AT_SHOP' : first.status },
        second,
      ],
    };
  });
  render(<PendingHandoffs api={api as CargoTzApi} Scanner={() => null} initialReference={reference} />);

  expect(await screen.findByText('Shipment cartons')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Carton 2 Awaiting custody' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm physical handoff' }));

  expect(await screen.findByText(`Custody accepted for ${reference}.`)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Carton 1 Accepted' }).getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByRole('button', { name: 'Carton 2 Awaiting custody' }).getAttribute('aria-pressed')).toBe('true');
});
