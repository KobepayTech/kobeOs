// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { CargoTzApi } from './handoffs';
import { TripOperations } from './trips';

const plate = 'T 472 DFR';
const trackingNumber = 'CTZ-20261108-A1234567890123456789';
const trip = {
  id: 'trip-id', plate, origin: 'Dar es Salaam', operator: 'Highland Cargo', vehicleType: 'Lorry',
  status: 'IN_TRANSIT', sealedAt: '2026-11-08T08:00:00Z', departedAt: '2026-11-08T08:15:00Z',
  stops: [{ branch: 'Mbeya', key: 'mbeya', arrivedAt: null }],
};
const carton = {
  trackingNumber, shipmentKey: 'shipment', destination: 'Mbeya', cartonNumber: 1, cartonCount: 2,
  weight: 5, status: 'ARRIVED', loadedAt: trip.sealedAt, unloadedAt: trip.departedAt,
  issue: '', recipient: 'Goods recipient', shipmentVerified: 1,
};
const sms = { configured: true, sent: 0, pending: 1, failed: 0 };

afterEach(cleanup);

test('destination requires an observed plate and keeps pickup disabled for incomplete shipments', async () => {
  let arrived = false;
  const api = vi.fn(async (path: string) => {
    if (path.includes('/trips?')) return [trip];
    if (path.endsWith('/arrive?branch=Mbeya')) { arrived = true; return { ok: true }; }
    return {
      ...trip,
      stops: [{ ...trip.stops[0], arrivedAt: arrived ? '2026-11-08T13:00:00Z' : null }],
      cartons: [carton], sms,
    };
  });
  render(<TripOperations api={api as CargoTzApi} role="Destination" workspace={{ ownerId: 'carrier', role: 'Destination', branch: 'Mbeya' }} Scanner={() => null} />);

  fireEvent.click(await screen.findByRole('button', { name: /T 472 DFR/ }));
  const arrival = await screen.findByRole('button', { name: 'Confirm plate & arrival' });
  expect(arrival.hasAttribute('disabled')).toBe(true);
  fireEvent.change(screen.getByLabelText('Vehicle plate'), { target: { value: plate } });
  fireEvent.click(arrival);

  expect(await screen.findByText('1 of 2 verified')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Send pickup code' }).hasAttribute('disabled')).toBe(true);
  expect(api).toHaveBeenCalledWith('/cargotz/operations/carrier/trips/trip-id/arrive?branch=Mbeya', {
    method: 'POST', body: JSON.stringify({ branch: 'Mbeya', plate }),
  });
});

test('loading keeps the manifest button disabled until the checklist is complete', async () => {
  const loading = { ...trip, status: 'LOADING', sealedAt: null, departedAt: null };
  const api = vi.fn(async (path: string) => path.includes('/trips?') ? [loading] : {
    ...loading, cartons: [carton, { ...carton, trackingNumber: 'CTZ-20261108-B1234567890123456789', loadedAt: null }], sms,
  });
  render(<TripOperations api={api as CargoTzApi} role="Loading" Scanner={() => null} />);
  fireEvent.click(await screen.findByRole('button', { name: /T 472 DFR/ }));

  expect(await screen.findByText('1 of 2 loaded')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Confirm loading & issue manifest' }).hasAttribute('disabled')).toBe(true);
});
