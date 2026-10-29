# Archived branches

The repository was consolidated to a single branch (`master`) on 2026-10-29.

Nothing was thrown away. Every branch listed here was tagged `archive/<branch
name>` before deletion, so its commits stay reachable permanently and can be
restored at any time:

```bash
git fetch origin 'refs/tags/archive/*:refs/tags/archive/*'
git checkout -b <branch-name> archive/<branch-name>
```

Tags were used rather than keeping the branches because a deleted branch's
commits eventually become unreachable and get collected, whereas a tag keeps
them indefinitely — and tags do not clutter the branch list.

## Why these were not merged

Merging them was considered and rejected. Every unmerged branch below was
between 44 and 133 commits behind `master`, and the ones showing very large
"ahead" counts were cut from an older history, so almost every commit in the
repository counted as new to them. Merging that set would have reverted this
month's production fixes — the supervisor compatibility check, the guarded
migrations, the cluster provisioning — and reintroduced defects that had
already been removed. The branches are kept as tags instead so individual work
can be recovered deliberately rather than resurrected in bulk.

Four branches with open pull requests were left in place and are not listed
here: #149, #142, #141 and #136.


## Already merged into master (7)

These were fully contained in `master`; deleting them lost nothing at all.

| Branch | Tip | Last commit |
|---|---|---|
| `fix/hotel-property-mvp` | `2f323065e` | 2026-10-21 |
| `codex/fix-facebook-signin-recovery` | `6c8dc33e3` | 2026-09-08 |
| `codex/preserve-claude-ai-connection-recovery` | `0df8d7372` | 2026-09-08 |
| `codex/supervisor-drain-deployment-listener` | `fdca7b4b6` | 2026-09-03 |
| `codex/kobeai-fast-default` | `424efce72` | 2026-09-02 |
| `codex/selfheal-no-prod-migrations` | `2735e302a` | 2026-09-02 |
| `feat/cloudflare-primary-db-cutover` | `32d8222c1` | 2026-09-02 |

## Unmerged, superseded (68)

Recoverable from the `archive/` tag.

| Branch | Tip | Last commit | Subject |
|---|---|---|---|
| `codex/allow-protected-node-origin-listener` | `2898d6797` | 2026-09-03 | fix: allow protected Node origin listener shutdown |
| `codex/control-origin-runtime-during-release` | `dba58cd21` | 2026-09-03 | fix: control KobeOS runtime across atomic release |
| `codex/drain-stale-origin-listener` | `a61d1abf4` | 2026-09-03 | fix: preserve PowerShell listener guard |
| `codex/diagnose-windows-origin-release` | `1d7000efe` | 2026-09-02 | ci: classify Windows origin release failures safely |
| `codex/fix-windows-release-check` | `0125b0c84` | 2026-09-02 | fix(ops): accept valid PowerShell JSON search response |
| `codex/release-windows-origin-mvp` | `f46702b30` | 2026-09-02 | ops(mvp): add safe Windows origin release |
| `feat/cloudflare-primary-api` | `2ae9df5a8` | 2026-09-02 | chore(cloudflare): remove temporary origin diagnostic |
| `feat/kobe-ai-operating-layer-20` | `d38837f4d` | 2026-09-02 | fix(deploy): stop requiring seeded Kijani demo data |
| `codex/exclude-test-migrations` | `ca0d59359` | 2026-09-01 | build(server): exclude test files from production output |
| `codex/offbox-origin-verification` | `0ada8630f` | 2026-09-01 | docs(ops): explain off-box origin verification |
| `codex/verify-deployed-lala-route` | `3c0dde5f2` | 2026-09-01 | docs(ops): verify Lala public search |
| `feat/activate-supabase-lala-backup` | `c4dec1b9d` | 2026-09-01 | fix(lala): support existing primary passport during outage |
| `feat/always-on-api-arrears-status` | `065c3384b` | 2026-09-01 | docs: make always-on VPS the preferred API origin |
| `feat/dual-path-production-failover` | `661902be9` | 2026-09-01 | docs(ops): document dual-path production failover |
| `feat/dual-path-production-failover-v2` | `efe073ccd` | 2026-09-01 | rebase failover: support independent backup path prefix |
| `feat/kobe-ai-router-v2` | `11be433ac` | 2026-09-01 | feat(ai): show latency, throughput and fallback readiness on mobile |
| `feat/kobe-ai-skills-activity-webapps` | `72e40e24c` | 2026-09-01 | feat(ai): embed Kobe copilot in standalone KobeOS web apps |
| `feat/kobepay-cashier-qr-scan` | `147aaf24d` | 2026-09-01 | feat(kobepay): streamline scanned payment confirmation |
| `feat/property-pm-always-on-api` | `2bcad00e8` | 2026-09-01 | fix(property): satisfy frontend lint in PM workspace |
| `feat/property-pm-always-on-api-ci` | `2bcad00e8` | 2026-09-01 | fix(property): satisfy frontend lint in PM workspace |
| `feat/property-pm-hotel-polish-always-on-api` | `3f00b44ce` | 2026-09-01 | docs: make always-on VPS the preferred API origin |
| `fix/lala-supabase-emergency-web` | `edcf9273f` | 2026-09-01 | docs(lala): make Supabase the active emergency frontend |
| `codex/fix-origin-supervisor-count` | `9190d97e6` | 2026-08-31 | fix(ops): normalize supervisor process results |
| `codex/full-origin-autorecovery` | `7fb705d90` | 2026-08-31 | fix(ops): avoid duplicate healthy origin supervisors |
| `demo/kijani-motors-preview` | `09a71971b` | 2026-08-31 | Add standalone Kijani Motors demo preview |
| `feat/dealership-production-completion` | `717567a50` | 2026-08-31 | Cover dealership flow end to end |
| `feat/dealership-public-demo` | `8c6c88df1` | 2026-08-31 | Fix migration QueryRunner typing |
| `fix/kijani-demo-pages` | `7d9ea8a57` | 2026-08-31 | Publish Kijani Motors demo with GitHub Pages |
| `fix/lala-deploy-gates` | `e7a2fce52` | 2026-08-31 | ci(lala): gate production deploy on Lala API and web |
| `fix/lala-deploy-truthful-status` | `be0a270a1` | 2026-08-31 | ci(lala): fail when production deploy is skipped |
| `fix/lala-mvp-production` | `e62ece778` | 2026-08-31 | fix(lala): validate reverse offer pricing and expiry |
| `fix/lala-origin-autostart` | `6558f94fb` | 2026-08-31 | fix(ops): keep KobeOS origin API running |
| `fix/lala-origin-runner-fallback` | `1fe98efbf` | 2026-08-31 | docs(ops): explain runner-managed fallback |
| `fix/lala-origin-startup-diagnostics` | `c11074b24` | 2026-08-31 | fix(ops): classify startup failures without logs |
| `ops/lala-capture-cloudflare-error` | `c2eef475b` | 2026-08-31 | ops(lala): capture Cloudflare origin error body |
| `ops/lala-origin-diagnostics` | `1c97ce3d3` | 2026-08-31 | ops(lala): diagnose self-hosted origin capabilities |
| `ops/lala-public-smoke` | `8f8c2b9da` | 2026-08-31 | ci(lala): add public production smoke check |
| `ops/lala-selfheal-origin` | `af5989ece` | 2026-08-31 | ops(lala): add guarded self-heal for existing origin tunnel |
| `feat/property-marketplace-auto-provision` | `43e62bb73` | 2026-08-30 | fix(web): remove unused storefront resolver icon |
| `fix/production-webapps-live` | `f9e31f080` | 2026-08-30 | fix(health): use portable TypeORM readiness queries |
| `codex/meta-oauth-fix` | `4aebf2d2c` | 2026-08-24 | release: v1.7.4 |
| `agent/livesales-meta-deployment` | `8ddf07864` | 2026-08-22 | Merge pull request #75 from KobepayTech/master |
| `copilot/fix-build-windows-job` | `61bc6029e` | 2026-08-22 | Merge branch 'master' into copilot/fix-build-windows-job |
| `copilot/fix-build-windows-selfhosted-again` | `332ec459a` | 2026-08-22 | Merge branch 'master' into copilot/fix-build-windows-selfhosted-again |
| `feat/finish-all-mvp-modules` | `6fd655ed6` | 2026-08-22 | fix: remove unused cargo company import |
| `feat/mvp-mobile-ai-module-store` | `efb0909c4` | 2026-08-22 | Merge branch 'master' into feat/mvp-mobile-ai-module-store |
| `fix/creator-production-no-demo` | `2eba05a09` | 2026-08-22 | refactor(creators): keep production workspace concise and fully live |
| `fix/hotel-production-no-demo` | `8ff6c716d` | 2026-08-22 | refactor(hotel): remove legacy demo hotel entry point |
| `fix/login-scroll-cloud-oauth` | `d230208c2` | 2026-08-22 | fix(login): type OAuth message listener for browser build |
| `mvp/module-store-mobile-ai` | `94604d813` | 2026-08-22 | Merge branch 'master' into mvp/module-store-mobile-ai |
| `codex/live-full-cart-attribution` | `75d390835` | 2026-08-14 | feat: track complete social live baskets |
| `copilot/fix-build-windows-selfhosted-yet-again` | `4608615e4` | 2026-08-03 | Merge origin/master into copilot/fix-build-windows-selfhosted-yet-agai |
| `copilot/fix-build-windows-selfhosted-job-again` | `9169f7801` | 2026-08-02 | Initial plan |
| `copilot/fix-build-windows-selfhosted-another-one` | `c071d1031` | 2026-07-28 | fix(ci): isolate self-hosted release dir per workflow attempt |
| `copilot/fix-build-windows-selfhosted-job` | `6347ada0d` | 2026-07-28 | Initial plan |
| `agent/ai-reliability-scheduled-agents` | `6c2f8d537` | 2026-07-23 | fix(ai): export RuntimeHealth so the controller return type is nameabl |
| `agent/independent-module-sites` | `0cce70452` | 2026-07-23 | feat(module-sites): load public cargo site independently |
| `agent/kobepay-receipt-china-cashier` | `c658db787` | 2026-07-23 | fix(kobepay): default idempotency keys for older clients |
| `agent/property-bulk-layout-onboarding` | `0050369c2` | 2026-07-23 | fix(property): export LayoutProposal so the controller return type is  |
| `agent/property-payment-orders-portals` | `39e5d454b` | 2026-07-23 | fix(property-payments): type transaction manager + query fallbacks (ba |
| `agent/real-module-app-store` | `9a8e1d29c` | 2026-07-23 | Merge latest master into App Store feature |
| `agent/shared-media-inbox` | `7d65ce63d` | 2026-07-23 | chore(ci): remove temporary media build workflow |
| `fix/module-window-theme-foundation` | `23af04458` | 2026-07-23 | fix(os): preserve minimized app state and use true full workspace maxi |
| `copilot/fix-build-windows-selfhosted` | `cbf921c3b` | 2026-07-21 | fix(typecheck): resolve 5 TypeScript errors causing CI build failure |
| `copilot/fix-bug` | `27e85e2f1` | 2026-06-30 | Merge pull request #50 from KobepayTech/copilot/fix-build-windows-job- |
| `copilot/fix-build-windows-job-again` | `56f016a09` | 2026-06-30 | fix: resolve TypeScript errors in erp-shop and PropEasy |
| `kobepaytech-bug-check-scan` | `8d5cedc11` | 2026-06-29 | fix: update widget dismiss + bell badge; store editor offline save mes |
| `feature/eod-expenses` | `42dcd7041` | 2026-06-07 | Merge remote-tracking branch 'origin/master' into feature/eod-expenses |
