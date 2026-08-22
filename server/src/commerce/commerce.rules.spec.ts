import { isNodeOnline, merchantOrderAccess, panelCrops, shopCode } from './commerce.rules';

describe('Kobe commerce acceptance rules', () => {
  it('creates the required Moscow Tower shop code', () => expect(shopCode('Moscow Tower', 'G', 12)).toBe('MOS-G-12'));
  it('splits a four-panel collage into four product tiles', () => expect(panelCrops(4)).toHaveLength(4));
  it('lets the customer submit order 51 but locks it for a Lite merchant', () => expect(merchantOrderAccess('LITE', 50)).toEqual({ locked: true, status: 'WAITING_ACTIVATION', orderNumber: 51 }));
  it('suppresses stale nodes and restores a recent heartbeat', () => {
    const now = new Date('2026-08-21T12:00:00Z');
    expect(isNodeOnline(new Date('2026-08-21T11:49:59Z'), now)).toBe(false);
    expect(isNodeOnline(new Date('2026-08-21T11:59:00Z'), now)).toBe(true);
  });
});
