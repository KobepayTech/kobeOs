import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { LivePresenter } from './LivePresenter';

vi.mock('@/lib/api', () => ({ api: vi.fn() }));
const pin = { id: 'a', name: 'Shirt', code: 'A1', stock: 3, livePrice: 9000, catalogPrice: 10000 };
const draft = { script: 'Shirt. Price 9000 TZS.', aiGenerated: true, products: [pin], currency: 'TZS' };
const speak = vi.fn();
const cancel = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('speechSynthesis', { speak, cancel });
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
  vi.mocked(api).mockImplementation(async (path) => {
    if (path.endsWith('/presenter/script')) return draft as never;
    if (path.endsWith('/pins')) return [pin] as never;
    return { status: 'LIVE' } as never;
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const prepare = async () => {
  render(<LivePresenter sessionId="live" catalogUrl="https://shop.example" onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Prepare script' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start voice' })).toBeEnabled());
};
describe('live presenter controls', () => {
  it('requires a preview before audio and cancels audio on close/unmount', async () => {
    await prepare();
    expect(speak).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Presenter script' })).toHaveValue(draft.script);
    fireEvent.click(screen.getByRole('button', { name: 'Start voice' }));
    await waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
    cleanup();
    expect(cancel).toHaveBeenCalled();
  });
  it('blocks speech if the session ended after the script was prepared', async () => {
    await prepare();
    vi.mocked(api).mockImplementation(async path => path.endsWith('/pins') ? [pin] as never : { status: 'ENDED' } as never);
    fireEvent.click(screen.getByRole('button', { name: 'Start voice' }));
    await screen.findByRole('alert');
    expect(speak).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Start voice' })).toBeDisabled();
  });
  it('cancels the active presenter when stock changes', async () => {
    await prepare();
    fireEvent.click(screen.getByRole('button', { name: 'Start voice' }));
    await waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
    vi.mocked(api).mockImplementation(async path => path.endsWith('/pins') ? [{ ...pin, stock: 0 }] as never : { status: 'LIVE' } as never);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Products changed'), { timeout: 5000 });
    expect(cancel).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Start voice' })).toBeDisabled();
  });
});
