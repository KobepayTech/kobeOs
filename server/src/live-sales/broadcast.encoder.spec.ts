import childProcess from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpeg from 'ffmpeg-static';
import { BroadcastService } from './broadcast.service';
import { LiveSaleService } from './live-sale.service';
import { AuditService } from '../audit/audit.service';

it('encodes real browser-format chunks as H.264/AAC FLV without contacting a platform', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'kobe-encoder-'));
  const input = join(directory, 'camera.webm');
  const output = join(directory, 'stream.flv');
  const originalSpawn = childProcess.spawn;
  let child: childProcess.ChildProcessWithoutNullStreams | undefined;
  // Only replace the final destination. Exercise the service's exact encoder
  // options, chunk ordering, stdin writes and process lifecycle with FFmpeg.
  const spy = jest.spyOn(childProcess, 'spawn').mockImplementation((binary, args, options) => {
    const actual = [...(args as string[])]; actual[actual.length - 1] = output;
    child = originalSpawn(binary, actual, options) as childProcess.ChildProcessWithoutNullStreams;
    return child;
  });
  const service = new BroadcastService({ getSession: async () => ({ status: 'LIVE', platform: 'instagram', kind: 'live' }) } as unknown as LiveSaleService,
    { log: async () => ({}) } as unknown as AuditService);
  try {
    childProcess.execFileSync(ffmpeg!, ['-y', '-f', 'lavfi', '-i', 'color=c=blue:s=160x240:r=30', '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '1', '-c:v', 'libvpx', '-c:a', 'libopus', input], { stdio: 'ignore', timeout: 15_000 });
    await service.start('owner', 'sale', 'rtmps://live-upload.instagram.com/rtmp/', 'test-only');
    const finished = new Promise<number | null>(resolve => child!.once('exit', resolve));
    const video = readFileSync(input);
    for (let offset = 0, sequence = 0; offset < video.length; offset += 4096, sequence++) {
      await service.chunk('owner', 'sale', sequence, video.subarray(offset, offset + 4096).toString('base64'));
    }
    child!.stdin.end();
    expect(await finished).toBe(0);
    expect(readFileSync(output).subarray(0, 3).toString()).toBe('FLV');
    childProcess.execFileSync(ffmpeg!, ['-v', 'error', '-i', output, '-f', 'null', '-'], { stdio: 'pipe', timeout: 10_000 });
  } finally { service.onModuleDestroy(); spy.mockRestore(); rmSync(directory, { recursive: true, force: true }); }
}, 25_000);
