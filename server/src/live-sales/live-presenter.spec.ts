import { AiService } from '../ai/ai.service';
import { LiveSaleService } from './live-sale.service';
import { LivePresenterService } from './live-presenter.service';

describe('live presenter', () => {
  const setup = () => {
    const sales = {
      getSession: jest.fn().mockResolvedValue({ status: 'LIVE', kind: 'live', currency: 'TZS' }),
      listPins: jest.fn().mockResolvedValue([
        { id: 'a', name: 'Shirt', code: 'A1', stock: 3, livePrice: 9000, catalogPrice: 10000 },
        { id: 'b', name: 'Sold out hat', code: 'B1', stock: 0, livePrice: 0, catalogPrice: 5000 },
      ]),
    };
    const ai = { chatCompletion: jest.fn().mockResolvedValue({ content: 'Welcome, shoppers!' }) };
    const service = new LivePresenterService(sales as unknown as LiveSaleService, ai as unknown as AiService);
    return { sales, ai, service };
  };
  it('uses owned current catalogue facts and excludes sold out items', async () => {
    const { service, sales } = setup();
    const result = await service.script('owner', 'live');
    expect(sales.getSession).toHaveBeenCalledWith('owner', 'live');
    expect(sales.listPins).toHaveBeenCalledWith('owner', 'live');
    expect(result.script).toContain('Shirt. Price 9000 TZS. 3 available. Comment A1');
    expect(result.script).not.toContain('Sold out hat');
    expect(result.aiGenerated).toBe(true);
  });
  it('keeps catalogue presentation working when AI is unavailable', async () => {
    const { service, ai } = setup();
    ai.chatCompletion.mockRejectedValue(new Error('offline'));
    const result = await service.script('owner', 'live');
    expect(result.aiGenerated).toBe(false);
    expect(result.script).toContain('virtual presenter');
    expect(result.script).toContain('9000 TZS');
  });
  it('does not access AI or products when the owner cannot access the session', async () => {
    const { service, sales, ai } = setup();
    sales.getSession.mockRejectedValue(new Error('not found'));
    await expect(service.script('stranger', 'live')).rejects.toThrow('not found');
    expect(ai.chatCompletion).not.toHaveBeenCalled();
    expect(sales.listPins).not.toHaveBeenCalled();
  });
  it('rejects a session ended during inference', async () => {
    const { service, sales } = setup();
    sales.getSession.mockResolvedValueOnce({ status: 'LIVE', kind: 'live', currency: 'TZS' }).mockResolvedValueOnce({ status: 'ENDED' });
    await expect(service.script('owner', 'live')).rejects.toThrow('ended');
  });
  it('rejects empty catalogues and post campaigns', async () => {
    const { service, sales, ai } = setup();
    sales.listPins.mockResolvedValue([]);
    await expect(service.script('owner', 'live')).rejects.toThrow('in-stock');
    ai.chatCompletion.mockClear();
    sales.getSession.mockResolvedValue({ status: 'LIVE', kind: 'post' });
    await expect(service.script('owner', 'post')).rejects.toThrow('live session');
    expect(ai.chatCompletion).not.toHaveBeenCalled();
  });
});
