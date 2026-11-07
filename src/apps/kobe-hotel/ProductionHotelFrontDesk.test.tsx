import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FrontDesk } from './ProductionHotelFrontDesk';
import { api } from '@/lib/api';
vi.mock('@/lib/api', () => ({ api: vi.fn() }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.mocked(api).mockReset(); });
const rooms = [{ id: 'room', roomNumber: '101', type: 'Standard', rate: 50000, currency: 'TZS', capacity: 2, status: 'reserved' as const }];
const guests = [{ id: 'guest', name: 'Asha', phone: '0712345678' }];
const bookings = [{ id: 'booking', roomId: 'room', guestId: 'guest', checkIn: '2030-01-01', checkOut: '2030-01-03', guestCount: 1, status: 'CONFIRMED' as const, totalAmount: 100000, currency: 'TZS' }];
describe('persistent front desk', () => {
  it('waits for backend check-in before refreshing and showing success', async () => {
    vi.mocked(api).mockResolvedValue({});
    const changed = vi.fn(async () => {}); const flash = vi.fn();
    render(<FrontDesk rooms={rooms} guests={guests} bookings={bookings} onChanged={changed} flash={flash} />);
    fireEvent.click(screen.getByText('Check in'));
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
    expect(api).toHaveBeenCalledWith('/hotel/front-desk/bookings/booking/check-in', expect.objectContaining({ method: 'POST', offlineFallback: false }));
    expect(flash).toHaveBeenCalledWith('Guest checked in.');
  });
  it('shows a failed request without claiming check-in succeeded', async () => {
    vi.mocked(api).mockRejectedValue(new Error('Backend unavailable'));
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const changed = vi.fn(async () => {}); const flash = vi.fn();
    render(<FrontDesk rooms={rooms} guests={guests} bookings={bookings} onChanged={changed} flash={flash} />);
    fireEvent.click(screen.getByText('Check in'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Backend unavailable'));
    expect(changed).not.toHaveBeenCalled(); expect(flash).not.toHaveBeenCalled();
  });
});
