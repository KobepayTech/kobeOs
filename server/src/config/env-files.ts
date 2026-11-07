import { basename, resolve } from 'path';

// Server-specific settings first; Neon CLI writes its variables at repo root.
// Explicit process environment always takes precedence over these files.
const cwd = process.cwd();
// E2E suites truncate tables. They load test/.env.test themselves and must
// never pick up the production Neon URLs pulled at the repository root.
export const envFiles = process.env.NODE_ENV === 'test' ? [] : [
  resolve(cwd, '.env.local'),
  resolve(cwd, '.env'),
  ...(basename(cwd) === 'server' ? [
    resolve(cwd, '../.env.local'),
    resolve(cwd, '../.env'),
  ] : []),
];
