import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { configurationErrors } from './check-deployment-config.mjs';

const ready = {
  CLOUDFLARE_API_TOKEN: 'test-token', CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
  PRIMARY_API_DB_HOST: 'ep-test.us-east-2.aws.neon.tech',
  PRIMARY_API_DB_DATABASE: 'neondb', PRIMARY_API_DB_USERNAME: 'test-role',
  PRIMARY_API_DB_PASSWORD: 'private-password', PRIMARY_API_JWT_SECRET: 'j'.repeat(64),
  PRIMARY_API_PROVIDER_ENCRYPTION_KEY: 'p'.repeat(64),
};

test('missing credentials cause the actual preflight command to fail', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./check-deployment-config.mjs', import.meta.url))], { env: {}, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CLOUDFLARE_API_TOKEN is missing/);
});
test('preview accepts complete settings, but cutover requires the zone ID', () => {
  assert.deepEqual(configurationErrors(ready), []);
  assert.match(configurationErrors(ready, true).join(), /CLOUDFLARE_ZONE_ID/);
  assert.deepEqual(configurationErrors({ ...ready, CLOUDFLARE_ZONE_ID: 'b'.repeat(32) }, true), []);
});
test('connection URLs, ports and loopback addresses are refused as DB hosts', () => {
  for (const host of ['postgresql://role:secret@host/db', 'host:5432', '127.0.0.2', 'localhost', 'postgres']) {
    assert.match(configurationErrors({ ...ready, PRIMARY_API_DB_HOST: host }).join(), /PRIMARY_API_DB_HOST/);
  }
});
test('short and placeholder signing/encryption keys are refused', () => {
  for (const key of ['PRIMARY_API_JWT_SECRET', 'PRIMARY_API_PROVIDER_ENCRYPTION_KEY']) {
    assert.match(configurationErrors({ ...ready, [key]: 'short' }).join(), new RegExp(key));
    assert.match(configurationErrors({ ...ready, [key]: 'change-me-'.repeat(8) }).join(), new RegExp(key));
  }
});
test('optional JSON cannot replace required credentials or use nonstring values', () => {
  for (const value of ['[]', '{"JWT_SECRET":"replacement"}', '{"SMTP_PORT":587}', '{']) {
    assert.match(configurationErrors({ ...ready, PRIMARY_API_EXTRA_SECRETS_JSON: value }).join(), /PRIMARY_API_EXTRA_SECRETS_JSON/);
  }
  assert.deepEqual(configurationErrors({ ...ready, PRIMARY_API_EXTRA_SECRETS_JSON: '{"SMTP_PASS":"private"}' }), []);
});
test('preflight diagnostics do not disclose invalid secret values', () => {
  const secret = 'private-short';
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./check-deployment-config.mjs', import.meta.url))], {
    env: { ...ready, PRIMARY_API_JWT_SECRET: secret }, encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.ok(!result.stdout.includes(secret) && !result.stderr.includes(secret));
});
