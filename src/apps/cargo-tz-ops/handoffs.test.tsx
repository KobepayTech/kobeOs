// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { PendingHandoffs, type CargoTzApi } from './handoffs';
import { ParcelLabel, trackingFromScan } from './parcel-label';

const reference = 'CTZ-20261108-A1234567890123456789';
const label = {
  trackingNumber: reference, origin: 'Dar es Salaam', destination: 'Mbeya',
  cartonNumber: 1, cartonCount: 2,
};

afterEach(cleanup);

test('new labels open public tracking and intake accepts both new and legacy references', () => {
  render(<ParcelLabel parcel={label} />);
  const href = screen.getByRole('link', { name: 'Open tracking page' }).getAttribute('href');
  expect(href).toBe(`${window.location.origin}/ctz/${reference}`);
  expect(trackingFromScan(href!)).toBe(reference);
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
    if (path.endsWith('/confirm')) return {};
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
