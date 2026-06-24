#!/usr/bin/env node
/**
 * Generate VAPID keys for Web Push and either:
 *   - append them to the local .env (when one exists and lacks the keys)
 *   - print the lines to stdout for the operator to paste manually
 *
 * Usage:
 *   npm run vapid:generate              # in server/
 *
 * Safe to re-run: refuses to overwrite existing VAPID_* lines so an
 * accidental second run can't silently rotate keys (which would
 * invalidate every push subscription customers have already given).
 */
import fs from 'node:fs';
import path from 'node:path';

const webpushModule = await import('web-push');
// web-push exports differently across versions; the .default form
// covers both ESM-wrapping-CJS and the direct ESM case.
const webpush = (webpushModule.default && typeof webpushModule.default.generateVAPIDKeys === 'function')
  ? webpushModule.default
  : webpushModule;
const { publicKey, privateKey } = webpush.generateVAPIDKeys();
const subject = process.env.VAPID_SUBJECT || 'mailto:ops@kobeapptz.com';

const envPath = path.resolve(process.cwd(), '.env');
const lines = [
  `VAPID_PUBLIC_KEY=${publicKey}`,
  `VAPID_PRIVATE_KEY=${privateKey}`,
  `VAPID_SUBJECT=${subject}`,
];

if (fs.existsSync(envPath)) {
  const current = fs.readFileSync(envPath, 'utf8');
  const hasPublic  = /^VAPID_PUBLIC_KEY=/m.test(current);
  const hasPrivate = /^VAPID_PRIVATE_KEY=/m.test(current);
  if (hasPublic || hasPrivate) {
    console.log('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY already present in .env');
    console.log('Refusing to overwrite — rotating keys breaks every existing push subscription.');
    console.log('');
    console.log('If you really want to rotate: delete the existing VAPID_* lines from .env,');
    console.log('then re-run this script.');
    process.exit(1);
  }
  const additions = ['', '# Web Push (added by npm run vapid:generate)', ...lines, ''].join('\n');
  fs.appendFileSync(envPath, additions);
  console.log(`Appended VAPID keys to ${envPath}`);
  console.log('Restart the Nest server (npm run start:prod) to pick them up.');
} else {
  console.log('No .env in', process.cwd(), '— add these lines to your environment:');
  console.log('');
  for (const line of lines) console.log(line);
  console.log('');
}
