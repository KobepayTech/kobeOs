import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Lala from './Lala';
import type { LalaHotel } from './lala-shared';

const api = vi.hoisted(() => vi.fn());
vi.mock('./api', () => ({ publicApi: api, publicAssetUrl: (value?: string) => value || '' }));
vi.mock('@/hooks/usePwaManifest', () => ({ usePwaManifest: vi.fn() }));
const hotel: LalaHotel = {
  hotel: { id: 'hotel-one', slug: 'coast-house', name: 'Coast House', location: 'Dar es Salaam', phone: '+255700000000', currency: 'TZS' },
  profile: { description: 'A peaceful place to stay.', images: [], amenities: ['Wi-Fi'], guestRating: 0, verifiedReviewCount: 0, lastMinuteEnabled: true },
  availableRooms: [{ id: 'room-one', roomNumber: '101', type: 'Garden double', rate: 45000, currency: 'TZS', capacity: 2, imageUrl: '' }],
  verifiedAvailabilityAt: '2026-11-05T10:00:00Z',
};
const passport = {
  passport: { passportNumber: 'LALA-ONE', name: 'Test Guest', phone: '+255700000000', nationality: '' },
  rewards: { points: 7, tier: 'Explorer', verifiedStays: 1 }, hotelLoyalty: [], stays: [],
  activeBookings: [{ id: 'booking-one', hotelName: 'Coast House', roomType: 'Garden double', roomNumber: '101', checkIn: '2026-11-06', checkOut: '2026-11-08', status: 'PENDING', totalAmount: 90000, currency: 'TZS' }],
};
async function openReservation() {
  fireEvent.click(await screen.findByRole('button', { name: 'View Coast House' }));
  fireEvent.click(screen.getByRole('button', { name: /Choose room/ }));
  return screen.getByRole('dialog', { name: 'Your next good night.' });
}
describe('Lala mobile guest journeys', () => {
  beforeEach(() => {
    localStorage.clear(); history.replaceState(null, '', '/lala'); api.mockReset();
    api.mockImplementation(async (path: string) => {
      if (path.startsWith('/lala-public/search')) return [hotel];
      if (path === '/lala-public/phone/request') return { sent: true };
      if (path === '/lala-public/phone/verify') return { phoneToken: 'verified-phone' };
      if (path === '/lala-public/passports') return { passport: { qrToken: 'passport-token' } };
      if (path === '/lala-public/bookings') return { booking: { id: 'booking-one' }, hotel: 'Coast House' };
      if (path.startsWith('/lala-public/passports/')) return passport;
      return [];
    });
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('allows hotel discovery before requesting identity, with honest unrated hotel labels', async () => {
    render(<Lala />);
    expect(await screen.findByRole('button', { name: 'View Coast House' })).toBeVisible();
    expect(screen.getByText('New stay')).toBeVisible();
    expect(screen.queryByLabelText('Your name')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Lala navigation' })).toBeVisible();
    expect(api.mock.calls.every(([path]) => path.startsWith('/lala-public/search'))).toBe(true);
  });

  it('saves hotels locally and rechecks live availability before opening a saved hotel', async () => {
    render(<Lala />);
    fireEvent.click(await screen.findByRole('button', { name: 'Save Coast House' }));
    expect(JSON.parse(localStorage.getItem('lala_saved_hotels_v1') || '[]')[0].id).toBe('hotel-one');
    fireEvent.click(screen.getByRole('button', { name: 'Saved' }));
    fireEvent.click(screen.getByRole('button', { name: /Coast House.*Check current rooms/ }));
    await screen.findByRole('dialog', { name: 'Coast House' });
    expect(api.mock.calls.filter(([path]) => path.startsWith('/lala-public/search'))).toHaveLength(2);
    expect(api.mock.calls.at(-1)?.[0]).toContain('destination=Coast+House');
  });

  it('uses submitted search dates and requires a verified phone before sending one reservation', async () => {
    render(<Lala />);
    await screen.findByRole('button', { name: 'View Coast House' });
    const start = new Date(); start.setDate(start.getDate() + 2);
    const end = new Date(start); end.setDate(end.getDate() + 2);
    const date = (value: Date) => value.toLocaleDateString('en-CA');
    fireEvent.change(screen.getByLabelText('Check-in', { exact: true }), { target: { value: date(start) } });
    fireEvent.change(screen.getByLabelText('Check-out', { exact: true }), { target: { value: date(end) } });
    fireEvent.submit(screen.getByRole('form', { name: 'Find a stay' }));
    await waitFor(() => expect(api.mock.calls.filter(([path]) => path.startsWith('/lala-public/search'))).toHaveLength(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Find a stay' })).toBeEnabled());
    // An unsubmitted draft change must not alter a displayed room's booking dates.
    const draft = new Date(end); draft.setDate(draft.getDate() + 1);
    fireEvent.change(screen.getByLabelText('Check-out', { exact: true }), { target: { value: date(draft) } });
    const dialog = await openReservation();
    expect(within(dialog).getByRole('button', { name: /Request reservation/ })).toBeDisabled();
    expect(within(dialog).getByText('TZS 90,000', { selector: '.lala-total b' })).toBeVisible();
    fireEvent.change(within(dialog).getByLabelText('Your name'), { target: { value: 'Test Guest' } });
    fireEvent.change(within(dialog).getByLabelText(/Phone number/), { target: { value: '+255700000000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send code' }));
    await screen.findByText('Your code is on its way by SMS.');
    fireEvent.change(within(dialog).getByLabelText('SMS code'), { target: { value: '123456' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Verify' }));
    await screen.findByText('Phone verified. You’re ready to go.');
    fireEvent.click(within(dialog).getByRole('button', { name: /Request reservation/ }));
    await screen.findByText('Your stays.');
    const writes = api.mock.calls.filter(([path]) => path === '/lala-public/bookings');
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0][1].body)).toMatchObject({ hotelId: 'hotel-one', roomId: 'room-one', passportToken: 'passport-token', checkIn: date(start), checkOut: date(end) });
    expect(JSON.parse(api.mock.calls.find(([path]) => path === '/lala-public/passports')?.[1].body)).toMatchObject({ phoneToken: 'verified-phone' });
    expect(screen.getByRole('status')).toHaveTextContent('Arrange payment with the hotel');
    expect(await screen.findByText('PENDING')).toBeVisible();
  });

  it('does not show a success state when the reservation fails', async () => {
    localStorage.setItem('lala_passport_token_v2', 'existing-passport');
    const normal = api.getMockImplementation()!;
    api.mockImplementation((path, ...args) => path === '/lala-public/bookings' ? Promise.reject(new Error('Room was just booked. Choose another room.')) : normal(path, ...args));
    render(<Lala />);
    const dialog = await openReservation();
    fireEvent.click(within(dialog).getByRole('button', { name: /Request reservation/ }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Room was just booked');
    expect(screen.queryByText(/Reservation .* received/)).not.toBeInTheDocument();
  });

  it('keeps hotel rewards and Lala Rewards separate in Passport', async () => {
    localStorage.setItem('lala_passport_token_v2', 'existing-passport');
    render(<Lala />);
    fireEvent.click(screen.getByRole('button', { name: 'Passport' }));
    expect(await screen.findByText('Your Passport.')).toBeVisible();
    expect(await screen.findByText('LALA-ONE')).toBeVisible();
    expect(screen.getByText('Each hotel’s rewards stay separate from your Lala balance.')).toBeVisible();
  });

  it('keeps navigation on the Lala route and makes room dialogs keyboard-dismissable', async () => {
    render(<Lala />);
    const view = await screen.findByRole('button', { name: 'View Coast House' });
    view.focus(); fireEvent.click(view);
    const dialog = screen.getByRole('dialog', { name: 'Coast House' });
    expect(dialog).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(view).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Saved' }));
    expect(location.pathname).toBe('/lala');
    expect(location.hash).toBe('#saved');
  });
});
