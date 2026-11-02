import { pathToFileURL } from 'node:url';
import { appendFileSync } from 'node:fs';

const TOKEN_HELP = 'Set CLOUDFLARE_PAGES_API_TOKEN in the GitHub production environment to a token with Account > Cloudflare Pages > Edit for the account containing kobeos-app. Check CLOUDFLARE_ACCOUNT_ID matches that account. Do not use a desktop OAuth session for CI.';

export function pagesConfiguration(env) {
  const token = (env.CLOUDFLARE_API_TOKEN || '').trim();
  const account = (env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const project = (env.CLOUDFLARE_PAGES_PROJECT || 'kobeos-app').trim();
  if (!token) throw new Error(`Cloudflare Pages token is missing. ${TOKEN_HELP}`);
  if (!/^[a-f0-9]{32}$/i.test(account)) throw new Error('CLOUDFLARE_ACCOUNT_ID must be the 32-character ID of the account containing the KobeOS Pages project.');
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(project)) throw new Error('CLOUDFLARE_PAGES_PROJECT is invalid.');
  return { token, account, project };
}

export async function checkPagesAccess(env, request = fetch) {
  const { token, account, project } = pagesConfiguration(env);
  let response;
  try {
    response = await request(`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${project}`, {
      headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(15000),
    });
  } catch { throw new Error('Cloudflare Pages access check could not reach the API. Check network availability and retry.'); }
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.success !== true) {
    // Never print provider messages or request details: either can contain credentials.
    const codes = (Array.isArray(data?.errors) ? data.errors : []).map(error => error?.code).filter(code => Number.isSafeInteger(code)).join(', ');
    throw new Error(`Cloudflare Pages access rejected (HTTP ${response.status}${codes ? `; codes ${codes}` : ''}). ${TOKEN_HELP}`);
  }
  if (data.result?.name !== project) throw new Error('Cloudflare returned an unexpected Pages project. Deployment stopped.');
  if (typeof data.result.production_branch !== 'string' || !/^[a-z0-9][a-z0-9._/-]{0,127}$/i.test(data.result.production_branch)) throw new Error('Cloudflare did not return a valid Pages production branch. Deployment stopped.');
  return { project, productionBranch: data.result.production_branch };
}

export async function verifyPagesRelease(env, request = fetch) {
  const sha = (env.GITHUB_SHA || '').trim();
  if (!/^[a-f0-9]{40}$/i.test(sha)) throw new Error('GITHUB_SHA must identify the exact release being verified.');
  const site = 'https://kobeos-app.pages.dev';
  const options = { redirect: 'error', signal: AbortSignal.timeout(15000), headers: { 'Cache-Control': 'no-cache' } };
  const releaseResponse = await request(`${site}/deployment-version.json?revision=${sha}`, options);
  const release = await releaseResponse.json().catch(() => null);
  if (!releaseResponse.ok || release?.revision !== sha) throw new Error('The live KobeOS frontend does not contain this release yet. Do not report deployment as successful.');
  const apiResponse = await request('https://api.kobeapptz.com/api/health', { ...options, signal: AbortSignal.timeout(15000) });
  const health = await apiResponse.json().catch(() => null);
  if (!apiResponse.ok || health?.status !== 'ok' || health?.db !== 'connected') throw new Error('The frontend release is published, but the production API/database health check failed.');
  return { revision: sha, database: 'connected' };
}

export async function main(mode, env = process.env) {
  if (mode === 'access') {
    const result = await checkPagesAccess(env);
    if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `production_branch=${result.productionBranch}\n`);
    console.log(`Cloudflare access verified for ${result.project}; production branch: ${result.productionBranch}. A deployment is still required to verify write permission.`);
  } else if (mode === 'verify') {
    let failure;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const result = await verifyPagesRelease(env);
        console.log(`KobeOS release ${result.revision} verified; production database connected.`);
        return;
      } catch (error) { failure = error; }
      if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 5000));
    }
    throw failure;
  } else throw new Error('Use access or verify.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2]).catch(error => { console.error(`::error::${error.message}`); process.exitCode = 1; });
}
