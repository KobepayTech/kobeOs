import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import FlightBoard from './FlightBoard';
import KobeAirCargo from './KobeAirCargo';

vi.mock('@/lib/api', () => ({ api: vi.fn() }));
vi.mock('@/os/store', () => ({ useOSStore: (selector: (store: { openWindow: () => null }) => unknown) => selector({ openWindow: () => null }) }));
const mockedApi = vi.mocked(api);
afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());

describe('FlightRadar cargo board', () => {
  it('is reachable from the active KobeOS cargo entry point', async () => {
    mockedApi.mockImplementation(async path => path.endsWith('/status') ? { configured: false } : []);
    render(<KobeAirCargo />);
    fireEvent.click(screen.getByRole('button', { name: /^Flight radar$/ }));
    expect(await screen.findByText('Flight feed not configured')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Eyes on the sky.' })).toBeInTheDocument();
    expect(screen.queryByText('FlightRadar24 ready')).not.toBeInTheDocument();
  });
  it('does not label an unreachable backend as a missing provider key', async () => {
    mockedApi.mockRejectedValue(new Error('API unavailable'));
    render(<FlightBoard />);
    expect(await screen.findByText('Connection unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Flight feed not configured')).not.toBeInTheDocument();
    expect(mockedApi).toHaveBeenCalledWith('/cargo/flights/fr24/status', { offlineFallback: false });
  });
  it('keeps assigned flights accessible when the feed is not configured', async () => {
    mockedApi.mockImplementation(async (path) => path.endsWith('/status') ? { configured: false } : [{ id: 's-1', shipmentId: 'AC-001', origin: 'CAN', destination: 'DAR', flightNumber: 'ET607', status: 'IN_TRANSIT' }]);
    render(<FlightBoard />);
    await screen.findByText('Flight feed not configured');
    expect(mockedApi.mock.calls.some(([path]) => path.includes('/airport/'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Assigned Flights' }));
    expect(await screen.findByText('AC-001')).toBeInTheDocument();
  });
  it('requires an explicit confirmation before assigning a real flight', async () => {
    mockedApi.mockImplementation(async (path) => path.endsWith('/status') ? { configured: true } : path.includes('assign-fr24-flight') ? {} : [{ fr24Id: 'f-1', callsign: 'ETH607', flightNumber: 'ET607', origin: 'CAN', destination: 'ADD', status: 'Airborne' }]);
    render(<FlightBoard />);
    await screen.findByText('ET607');
    fireEvent.change(screen.getByPlaceholderText('shipment id'), { target: { value: 's-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));
    expect(mockedApi.mock.calls.some(([path]) => path.includes('assign-fr24-flight'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm assignment' }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/cargo/shipments/s-1/assign-fr24-flight', expect.objectContaining({ method: 'POST', offlineFallback: false, body: JSON.stringify({ flightNumber: 'ET607' }) })));
  });
});
