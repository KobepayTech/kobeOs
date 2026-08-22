#!/usr/bin/env node
/**
 * Cross-platform `prepare` hook: point git at the repo's .githooks directory.
 *
 * Replaces the old shell one-liner
 *   git config core.hooksPath .githooks 2>/dev/null || true
 * which broke on Windows cmd.exe (`/dev/null` path + no `true` builtin) and
 * failed `npm install` on Windows runners. This is best-effort: any error
 * (not a git repo, git missing, CI checkout) is swallowed so install never
 * fails because of it.
 */
try {
  require('child_process').execSync('git config core.hooksPath .githooks', { stdio: 'ignore' });
} catch {
  /* not a git repo / git unavailable — ignore, hooks are dev-only convenience */
}
