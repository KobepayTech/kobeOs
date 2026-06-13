import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { screen, waitFor } from '@testing-library/dom';
import WarehouseOpsApp from '../index';

const sampleTickets = [
  {
    id: 't1',
    ticketNumber: 'PT-SO-1001',
    orderId: 'o1',
    warehouseId: 'wh1',
    customerName: 'Juma Abdallah',
    status: 'PENDING' as const,
    pickedBy: null,
    createdAt: '2026-05-28T10:00:00Z',
  },
  {
    id: 't2',
    ticketNumber: 'PT-SO-1002',
    orderId: 'o2',
    warehouseId: 'wh1',
    customerName: null,
    status: 'PICKING' as const,
    pickedBy: 'Asha',
    createdAt: '2026-05-28T11:00:00Z',
  },
];

vi.mock('@/lib/api', () => ({
  api: vi.fn(async (path: string) => {
    if (path === '/warehouse/pick-tickets') return sampleTickets;
    if (path.startsWith('/warehouse/pick-tickets/')) {
      return { ...sampleTickets[0], items: [{ id: 'i1', sku: 'SKU-A', name: 'Rice', quantity: 3, location: 'A2', picked: false }] };
    }
    return null;
  }),
}));

vi.mock('@/lib/auth', () => ({ ensureSession: vi.fn(async () => undefined) }));

describe('Warehouse Ops dashboard', () => {
  beforeEach(() => {
    render(<WarehouseOpsApp />);
  });

  it('shows status KPIs and the pending ticket on first load', async () => {
    await waitFor(() => expect(screen.getByText('PT-SO-1001')).toBeInTheDocument());
    // Pending count of 1 appears in the KPI card.
    const pendingCards = screen.getAllByText('PENDING');
    expect(pendingCards.length).toBeGreaterThan(0);
    expect(screen.getByText(/Juma Abdallah/)).toBeInTheDocument();
  });

  it('renders the advance-status button label that matches the current state', async () => {
    await waitFor(() => expect(screen.getByText('PT-SO-1001')).toBeInTheDocument());
    // Pending → Start picking button on the PENDING tab.
    expect(screen.getByRole('button', { name: /Start picking/i })).toBeInTheDocument();
  });
});
