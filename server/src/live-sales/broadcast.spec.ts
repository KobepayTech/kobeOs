import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { spawn } from 'node:child_process';
import { BroadcastService, broadcastTarget } from './broadcast.service';
import { LiveSaleService } from './live-sale.service';
import { AuditService } from '../audit/audit.service';
jest.mock('node:child_process', () => ({ spawn: jest.fn() }));

describe('camera broadcast isolation', () => {
  let service: BroadcastService;
  let child: EventEmitter & { stdin: PassThrough; stdout: PassThrough; stderr: PassThrough; kill: jest.Mock };
  const sales = { getSession: jest.fn() };
  const audit = { log: jest.fn().mockResolvedValue({}) };
  beforeEach(() => {
    process.env.FFMPEG_BIN = '/test/ffmpeg';
    sales.getSession.mockImplementation(async (uid: string) => {
      if (uid !== 'owner') throw new Error('Not found');
      return { platform: 'instagram', kind: 'live', status: 'LIVE' };
    });
    child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: jest.fn() });
    (spawn as jest.Mock).mockImplementation(() => { setImmediate(() => child.emit('spawn')); return child; });
    service = new BroadcastService(sales as unknown as LiveSaleService, audit as unknown as AuditService);
  });
  afterEach(() => { service.onModuleDestroy(); delete process.env.FFMPEG_BIN; jest.clearAllMocks(); });
  it.each(['https://instagram.com/upload', 'rtmp://127.0.0.1/live', 'rtmp://instagram.com.evil.test/live', 'rtmp://user:pass@instagram.com/live', 'rtmp://instagram.com:22/live'])('rejects unsupported destinations %s', url => {
    expect(() => broadcastTarget('instagram', url, 'test-key')).toThrow();
  });
  it('preserves a provider-issued signed stream key', () => {
    expect(broadcastTarget('instagram', 'rtmps://live-upload.instagram.com:443/rtmp/', 'key?signature=test')).toBe('rtmps://live-upload.instagram.com:443/rtmp/key?signature=test');
  });
  it('never exposes keys, enforces ownership and ordered chunks, and releases the encoder', async () => {
    await service.start('owner', 'sale', 'rtmps://live-upload.instagram.com/rtmp/', 'secret-test');
    expect(audit.log).toHaveBeenCalledWith(expect.not.objectContaining({ streamKey: expect.anything() }));
    expect(JSON.stringify(await service.status('owner', 'sale'))).not.toContain('secret-test');
    await expect(service.chunk('foreign', 'sale', 0, 'YWJj')).rejects.toThrow();
    await expect(service.chunk('owner', 'sale', 1, 'YWJj')).rejects.toThrow('out of order');
    expect(await service.chunk('owner', 'sale', 0, 'YWJj')).toEqual({ sequence: 1 });
    await expect(service.start('owner', 'other', 'rtmps://live-upload.instagram.com/rtmp/', 'key')).rejects.toThrow('capacity');
    await service.stop('owner', 'sale');
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    await expect(service.chunk('owner', 'sale', 1, 'YWJj')).rejects.toThrow('not running');
  });
  it('does not start a child process for a foreign session', async () => {
    await expect(service.start('foreign', 'sale', 'rtmps://live-upload.instagram.com/rtmp/', 'key')).rejects.toThrow('Not found');
    expect(spawn).not.toHaveBeenCalled();
  });
});
