import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPagesAccess, pagesConfiguration, verifyPagesRelease } from './cloudflare-pages.mjs';

const env = { CLOUDFLARE_API_TOKEN: 'private-test-token', CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), GITHUB_SHA: 'b'.repeat(40) };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

test('requires credentials and validates account before sending requests', async () => {
  assert.throws(() => pagesConfiguration({}), /token is missing/);
  let called = false;
  await assert.rejects(checkPagesAccess({ ...env, CLOUDFLARE_ACCOUNT_ID: 'wrong' }, async () => { called = true; }), /32-character/);
  assert.equal(called, false);
});
test('checks only the intended project through the official API without redirects', async () => {
  const result = await checkPagesAccess(env, async (url, options) => {
    assert.equal(url, `https://api.cloudflare.com/client/v4/accounts/${'a'.repeat(32)}/pages/projects/kobeos-app`);
    assert.equal(options.headers.Authorization, 'Bearer private-test-token');
    assert.equal(options.redirect, 'error');
    return json({ success: true, result: { name: 'kobeos-app', production_branch: 'master' } });
  });
  assert.equal(result.project, 'kobeos-app');
});
test('reports auth failure and remediation without leaking provider text or the token', async () => {
  await assert.rejects(checkPagesAccess(env, async () => json({ success: false, errors: [{ code: 10000, message: env.CLOUDFLARE_API_TOKEN }] }, 403)), error => {
    assert.match(error.message, /HTTP 403; codes 10000/);
    assert.match(error.message, /CLOUDFLARE_PAGES_API_TOKEN/);
    assert.ok(!error.message.includes(env.CLOUDFLARE_API_TOKEN));
    return true;
  });
});
test('rejects wrong project, invalid branch, and malformed provider responses', async () => {
  for (const result of [{ name: 'another-project', production_branch: 'master' }, { name: 'kobeos-app', production_branch: 'main\ninjected=true' }]) {
    await assert.rejects(checkPagesAccess(env, async () => json({ success: true, result })));
  }
  await assert.rejects(checkPagesAccess(env, async () => new Response('not json', { status: 502 })), /HTTP 502/);
});
test('uses the actual configured production branch instead of assuming master', async () => {
  const result = await checkPagesAccess(env, async () => json({ success: true, result: { name: 'kobeos-app', production_branch: 'main' } }));
  assert.equal(result.productionBranch, 'main');
});
test('network failures do not expose request credentials', async () => {
  await assert.rejects(checkPagesAccess(env, async () => { throw new Error(env.CLOUDFLARE_API_TOKEN); }), error => !error.message.includes(env.CLOUDFLARE_API_TOKEN));
});
test('an old frontend cannot pass release verification', async () => {
  let calls = 0;
  await assert.rejects(verifyPagesRelease(env, async () => { calls++; return json({ revision: 'c'.repeat(40) }); }), /does not contain this release/);
  assert.equal(calls, 1);
});
test('requires the current frontend and healthy production database', async () => {
  const request = async url => url.includes('deployment-version.json') ? json({ revision: env.GITHUB_SHA }) : json({ status: 'ok', db: 'connected' });
  assert.deepEqual(await verifyPagesRelease(env, request), { revision: env.GITHUB_SHA, database: 'connected' });
  await assert.rejects(verifyPagesRelease(env, async url => url.includes('deployment-version.json') ? json({ revision: env.GITHUB_SHA }) : json({ status: 'ok', db: 'disconnected' })), /database health/);
});
