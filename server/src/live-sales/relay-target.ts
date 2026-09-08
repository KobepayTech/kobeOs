import { BadRequestException } from '@nestjs/common';
/** Relay only to an owned capability endpoint on the Kobe public domain. */
export function relayTarget(raw: string, baseDomain = 'kobeapptz.com'): string {
  let url: URL;
  try { url = new URL(raw); } catch { throw new BadRequestException('Publish your store before linking phone live sales.'); }
  const host = url.hostname.toLowerCase();
  const domain = baseDomain.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash
    || !(host === domain || host.endsWith(`.${domain}`))
    || !/^\/api\/live-sales\/ingest\/[a-f0-9]{24}$/.test(url.pathname)) {
    throw new BadRequestException('Phone live sales needs the published Kobe store URL.');
  }
  return url.toString();
}
