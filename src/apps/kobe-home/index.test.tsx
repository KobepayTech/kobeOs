import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import KobeHome from './index';

vi.mock('@/lib/api', () => ({ api: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getStoredAuthUser: () => ({ id: 'owner' }) }));
vi.mock('@/os/store', () => ({ useOSStore: (selector: (state: { launchApp: () => void }) => unknown) => selector({ launchApp: vi.fn() }) }));
const mockApi = vi.mocked(api);
const stock = [
  { id: 'one', name: 'Caps', sku: 'A1', unit: 'pcs', warehouseId: 'west', warehouseName: 'West', quantity: 10, reorderLevel: 2 },
  { id: 'two', name: 'Caps', sku: 'A1', unit: 'pcs', warehouseId: 'east', warehouseName: 'East', quantity: 2, reorderLevel: 2 },
];
beforeEach(() => {
  vi.clearAllMocks();
  mockApi.mockImplementation(async (path, options) => {
    if (options?.method === 'POST') throw new Error('Connection lost; retry safely.');
    if (String(path).startsWith('/brain/briefing')) return { summary: 'Verified business briefing.', alerts: [], data: { generatedAt: '2026-11-02T12:00:00Z', timezone: 'UTC', pendingApprovals: 2, inventory: { warehouseLow: 1 }, ledger: { postingsToday: 3 } } } as never;
    if (String(path).startsWith('/brain/physical-state')) return { rooms: [], stock, totalRooms: 0, totalStockItems: 2, displayLimit: 100 } as never;
    if (path === '/brain/workspaces') return [] as never;
    return { messages: [] } as never;
  });
});
describe('Kobe Home', () => {
  it('shows verified activity and all six work areas', async () => {
    render(<KobeHome />);
    await screen.findByText('Verified business briefing.');
    expect(screen.getByText('2 decisions awaiting review')).toBeInTheDocument();
    for (const area of ['Kobe Business', 'Kobe Money', 'Kobe People', 'Kobe Intelligence', 'Kobe Network']) expect(screen.getByRole('heading', { name: area })).toBeInTheDocument();
    expect(screen.getByText(/not a sensor feed/)).toBeInTheDocument();
  });
  it('shows backend failures instead of reporting zero business activity', async () => {
    mockApi.mockRejectedValue(new Error('Backend unavailable'));
    render(<KobeHome />);
    await screen.findByRole('alert');
    expect(screen.queryByText('Verified business briefing.')).not.toBeInTheDocument();
    expect(screen.getByText(/Connect to your KobeOS backend/)).toBeInTheDocument();
  });
  it('reuses the transfer request ID when retrying an uncertain outcome', async () => {
    render(<KobeHome />);
    await screen.findByText('Verified business briefing.');
    fireEvent.change(screen.getByLabelText('From'), { target: { value: 'one' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: 'two' } });
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '3' } });
    const button = screen.getByRole('button', { name: 'Confirm stock transfer' });
    const calls = () => mockApi.mock.calls.filter(([path]) => path === '/warehouse/transfers');
    fireEvent.click(button);
    await waitFor(() => expect(calls()).toHaveLength(1));
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);
    await waitFor(() => expect(calls()).toHaveLength(2));
    const first = JSON.parse(calls()[0][1]!.body as string);
    const second = JSON.parse(calls()[1][1]!.body as string);
    expect(first.requestKey).toBe(second.requestKey);
    expect(first.quantity).toBe(3);
  });
  it('requires workspace sharing consent before creating an email invitation', async () => {
    render(<KobeHome />);
    await screen.findByText('Verified business briefing.');
    fireEvent.change(screen.getByLabelText('KobeOS email address'), { target: { value: 'staff@test.invalid' } });
    const button = screen.getByRole('button', { name: 'Create invitation' });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(button);
    await waitFor(() => expect(mockApi.mock.calls.some(([path]) => path === '/brain/workspaces/invite')).toBe(true));
    const invitation = mockApi.mock.calls.find(([path]) => path === '/brain/workspaces/invite')!;
    expect(JSON.parse(invitation[1]!.body as string)).toEqual({ email: 'staff@test.invalid', scopeConsent: 'ALL_OWNER_ACCOUNT_RECORDS' });
  });
});
