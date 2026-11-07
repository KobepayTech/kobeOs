import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import CargoFinanceDesk from './CargoFinanceDesk';

vi.mock('@/lib/api', () => ({ api: vi.fn() }));
vi.mock('../kobe-pay', () => ({ default: () => <div>KobePay supplier workspace</div> }));
const mockApi = vi.mocked(api);
beforeEach(() => {
  sessionStorage.clear(); vi.resetAllMocks();
  mockApi.mockImplementation(async path => path.includes('accounts') ? [{ id: 'c1', name: 'Amina', phone: '123', balance: 100, currency: 'TZS' }] : path.includes('shipments') ? [{ id: 's1', shipmentId: 'SH-001', origin: 'CAN', destination: 'DAR', status: 'LOADING' }] : []);
});
afterEach(cleanup);
async function review() {
  render(<CargoFinanceDesk />);
  fireEvent.click(screen.getByRole('button', { name: /^Pay freight$/ }));
  await screen.findByRole('option', { name: 'Amina · TZS 100' });
  fireEvent.change(screen.getByLabelText('Customer account'), { target: { value: 'c1' } });
  fireEvent.change(screen.getByLabelText('Cargo shipment'), { target: { value: 's1' } });
  fireEvent.change(screen.getByLabelText('Freight payment amount'), { target: { value: '30' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review payment' }));
}
describe('Cargo freight payment UI', () => {
  it('requires review and confirmation before posting a payment', async () => {
    await review();
    expect(mockApi.mock.calls.some(([path]) => path.includes('freight-payments'))).toBe(false);
    expect(screen.getByText('TZS 30')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm freight payment' })).toBeEnabled();
  });
  it('reuses its request ID after an uncertain network response', async () => {
    const original = mockApi.getMockImplementation()!;
    mockApi.mockImplementation(async (path, args) => {
      if (path.includes('freight-payments')) throw new Error('Connection interrupted; payment status unknown');
      return original(path, args);
    });
    await review();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm freight payment' }));
    await screen.findByRole('alert');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm freight payment' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Confirm freight payment' }));
    await waitFor(() => expect(mockApi.mock.calls.filter(([path]) => path.includes('freight-payments'))).toHaveLength(2));
    const posts = mockApi.mock.calls.filter(([path]) => path.includes('freight-payments')).map(([, args]) => args!);
    expect(posts[0].offlineFallback).toBe(false); expect(posts[1].body).toBe(posts[0].body);
    expect(screen.queryByText('Freight payment confirmed')).not.toBeInTheDocument();
  });
});
