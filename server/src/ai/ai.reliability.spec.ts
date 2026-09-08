import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { detectTask } from './ai-router';

type Internal = { fetchWithRetry(url: string, init: RequestInit, timeout: number, retries: number): Promise<Response> };
describe('AI routing and request lifetime', () => {
  afterEach(() => jest.restoreAllMocks());
  it.each(['Why is my shop closed?', 'What should I do next?', 'Which class is next?', 'Explain how to add a product'])('uses everyday routing: %s', (message) => {
    expect(detectTask(message)).toBe('general');
  });
  it('retains explicit specialist routing', () => {
    expect(detectTask('Analyze the root cause of declining sales')).toBe('reasoning');
    expect(detectTask('Write a Python script')).toBe('code');
    expect(detectTask('Read this receipt', true)).toBe('vision');
  });
  it('gives tool selection recent conversation context', async () => {
    const service = new AiService(new ConfigService());
    const completion = jest.spyOn(service, 'chatCompletion').mockResolvedValue({
      content: JSON.stringify({ domain: 'shop', task: 'reasoning', toolCalls: [] }), model: 'test', provider: 'ollama',
    });
    const plan = await service.planAssistant('What about yesterday?', [], undefined, [{ role: 'user', content: 'Show shop sales today' }]);
    expect(completion.mock.calls[0][0].messages).toContainEqual({ role: 'user', content: 'Show shop sales today' });
    expect(plan.task).toBe('general');
  });
  it('retains cancellation after response headers', async () => {
    const service = new AiService(new ConfigService()) as unknown as Internal;
    const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(''));
    const controller = new AbortController();
    await service.fetchWithRetry('http://localhost/test', { signal: controller.signal }, 10000, 0);
    const signal = fetcher.mock.calls[0][1]?.signal;
    expect(signal?.aborted).toBe(false);
    controller.abort();
    expect(signal?.aborted).toBe(true);
  });
  it('retains its deadline after response headers', async () => {
    const service = new AiService(new ConfigService()) as unknown as Internal;
    const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(''));
    await service.fetchWithRetry('http://localhost/test', {}, 10, 0);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
  it('does not dispatch an already-cancelled request', async () => {
    const service = new AiService(new ConfigService()) as unknown as Internal;
    const fetcher = jest.spyOn(global, 'fetch');
    await expect(service.fetchWithRetry('http://localhost/test', { signal: AbortSignal.abort() }, 10000, 0)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
