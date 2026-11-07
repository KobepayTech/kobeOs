import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import KobePay from './index';

vi.mock('@/lib/api', () => ({ api: vi.fn().mockRejectedValue(new Error('Failed to fetch')) }));
vi.mock('./SendMoneyWizard', () => ({ SendMoneyWizard: () => null }));
afterEach(cleanup);

it('shows unavailable records instead of zero funds after a connection failure', async () => {
  render(<KobePay embedded />);
  await screen.findByRole('alert');
  expect(screen.getAllByText('—')).toHaveLength(4);
  expect(screen.queryByText('TSh 0')).not.toBeInTheDocument();
  expect(screen.queryByText('No customer deposits have been recorded.')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Send money' })).toBeDisabled();
});
