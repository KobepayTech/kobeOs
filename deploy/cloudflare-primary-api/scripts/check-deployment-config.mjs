export function configurationErrors(env, cutover = false) {
  const errors = [];
  const required = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID',
    'PRIMARY_API_DB_HOST', 'PRIMARY_API_DB_USERNAME', 'PRIMARY_API_DB_PASSWORD',
    'PRIMARY_API_DB_DATABASE', 'PRIMARY_API_JWT_SECRET',
    'PRIMARY_API_PROVIDER_ENCRYPTION_KEY'];
  if (cutover) required.push('CLOUDFLARE_ZONE_ID');
  for (const key of required) {
    if (!env[key]?.trim()) errors.push(`${key} is missing`);
  }
  for (const key of ['CLOUDFLARE_ACCOUNT_ID', ...(cutover ? ['CLOUDFLARE_ZONE_ID'] : [])]) {
    if (env[key] && !/^[a-f0-9]{32}$/i.test(env[key])) errors.push(`${key} must be a 32-character ID`);
  }
  const host = env.PRIMARY_API_DB_HOST;
  if (host && (!/^[a-z0-9.-]+$/i.test(host) ||
      /^(localhost|postgres|kobe-postgres|0\.0\.0\.0)$|^127\.|\.(localhost|local)$/i.test(host))) {
    errors.push('PRIMARY_API_DB_HOST must be a reachable hostname, without a URL, port or credentials');
  }
  for (const [key, min] of [['PRIMARY_API_JWT_SECRET', 32], ['PRIMARY_API_PROVIDER_ENCRYPTION_KEY', 16]]) {
    if (env[key] && (env[key].length < min || /change[-_ ]?me|placeholder|your[_-]/i.test(env[key]))) {
      errors.push(`${key} must contain at least ${min} characters and must not be a placeholder`);
    }
  }
  if (env.PRIMARY_API_EXTRA_SECRETS_JSON) {
    try {
      const extra = JSON.parse(env.PRIMARY_API_EXTRA_SECRETS_JSON);
      if (!extra || Array.isArray(extra) || typeof extra !== 'object' ||
          Object.values(extra).some(value => typeof value !== 'string')) {
        errors.push('PRIMARY_API_EXTRA_SECRETS_JSON must be an object of string values');
      } else if (['DB_HOST', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE', 'JWT_SECRET',
        'PROVIDER_ENCRYPTION_KEY'].some(key => Object.hasOwn(extra, key))) {
        errors.push('PRIMARY_API_EXTRA_SECRETS_JSON must not override required runtime settings');
      }
    } catch { errors.push('PRIMARY_API_EXTRA_SECRETS_JSON must contain valid JSON'); }
  }
  return errors;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const errors = configurationErrors(process.env, process.argv.includes('--cutover'));
  if (errors.length) {
    // Report names and rules only; never output supplied credential values.
    for (const error of errors) console.error(`::error::${error}`);
    process.exitCode = 1;
  } else console.log('Deployment configuration validated. Live deployment is still required.');
}
