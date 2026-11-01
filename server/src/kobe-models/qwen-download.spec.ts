import { createServer, Server } from 'http';
import { ConfigService } from '@nestjs/config';
import { KobeModelsService } from './kobe-models.service';
import { QWEN_EDITION, QWEN_MODEL } from '../ai/qwen-edition';
describe('verified model download stream', () => {
  let server: Server;
  let service: KobeModelsService;
  let reply: (res: any) => void;
  beforeEach(async () => {
    server = createServer((_req, res) => reply(res));
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as any).port;
    service = new KobeModelsService(new ConfigService({ KOBE_AI_EDITION: QWEN_EDITION, OLLAMA_URL: `http://127.0.0.1:${port}` }));
  });
  afterEach(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
  const finished = async (job: any) => {
    for (let i = 0; i < 100 && !['done', 'failed'].includes(job.status); i++) await new Promise(resolve => setTimeout(resolve, 10));
    return job;
  };
  it('handles split progress events, reuses an active download and requires success', async () => {
    reply = res => {
      res.write('{"digest":"sha256:a","total":100,"completed":');
      setTimeout(() => res.end('100,"status":"pulling"}\n{"status":"success"}\n'), 30);
    };
    const job = await service.startDownload(QWEN_MODEL);
    expect((await service.startDownload(QWEN_MODEL)).jobId).toBe(job.jobId);
    expect(await finished(job)).toMatchObject({ status: 'done', progressPct: 100, progressBytes: 100 });
  });
  it.each(['{"error":"disk full"}\n', '{"status":"pulling"}\n'])('does not mark HTTP 200 as installed: %s', async body => {
    reply = res => res.end(body);
    const job = await finished(await service.startDownload(QWEN_MODEL));
    expect(job.status).toBe('failed');
    expect(job.progressPct).not.toBe(100);
  });
  it('exposes only Qwen and rejects an unrelated model before opening a download', async () => {
    expect((await service.getCatalogue()).models.map(m => m.id)).toEqual([QWEN_MODEL]);
    await expect(service.startDownload('other:7b')).rejects.toThrow('not in catalogue');
  });
});
