import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { QWEN_MODEL, QWEN_EDITION } from './qwen-edition';
describe('Qwen-only edition', () => {
  const create = () => new AiService(new ConfigService({ KOBE_AI_EDITION: QWEN_EDITION, OLLAMA_MODEL: 'other:7b', KOBE_AI_FALLBACK_URL: 'https://example.com' }));
  afterEach(() => jest.restoreAllMocks());
  it('filters shared runtime models and reuses the converted local alias', async () => {
    const service = create();
    jest.spyOn(global, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ models: [
      { name: 'other:7b' }, { name: 'qwen3-vl:4b' }, { name: 'kobe-qwen3-vl:latest' },
    ] })));
    expect((await service.listInstalled()).map(m => m.name)).toEqual(['kobe-qwen3-vl:latest']);
    expect((await service.listCatalogue())).toEqual([expect.objectContaining({ id: QWEN_MODEL, installed: true, category: 'multimodal' })]);
    const health = await service.health();
    expect(health.models).toEqual(['kobe-qwen3-vl:latest']);
    expect(health.remoteFallbackConfigured).toBe(false);
    expect(Object.values(health.routing)).toEqual(Array(5).fill(QWEN_MODEL));
  });
  it('rejects other models through every mutation and chat entry point', async () => {
    const service = create();
    expect(() => service.setActiveModel('other:7b')).toThrow('only');
    expect(() => service.setActiveModel('')).toThrow('only');
    await expect(service.pullModel('other:7b')).rejects.toThrow('only');
    await expect(service.deleteModel('other:7b')).rejects.toThrow('only');
    await expect(service.chatCompletion({ messages: [{ role: 'user', content: 'hello' }], model: 'other:7b' })).rejects.toThrow('only');
  });
  it('routes images to the installed VL model without substituting a smaller model', () => {
    const service = create() as any;
    expect(service.routeModel(undefined, ['qwen3-vl:4b', 'kobe-qwen3-vl:latest'], 'vision')).toBe('kobe-qwen3-vl:latest');
    expect(() => service.routeModel(undefined, ['qwen3-vl:4b'], 'vision')).toThrow('not installed');
  });
  it('does not treat a registry error in HTTP 200 as an installed model', async () => {
    const service = create();
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'disk full' })));
    expect(await service.pullModel(QWEN_MODEL)).toEqual({ success: false, message: 'disk full' });
  });
});
