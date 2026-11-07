import { readdirSync, readFileSync } from 'fs';
import { join, resolve, dirname } from 'path';

/**
 * A provider class listed in the `providers` array of two modules is two
 * instances, not one shared instance. Nest resolves each module's copy
 * independently, and `app.get(Token)` hands back the LAST one registered.
 *
 * That is not a theoretical tidiness complaint. BeemService was provided by
 * four modules; the Lala OTP e2e tests spied on `app.get(BeemService)` — the
 * mzigo copy — while LalaIdentityService had been injected the notifications
 * copy. The real sendSms ran, found no credentials, and phone verification
 * answered 503 on CI only.
 *
 * A shared service belongs to exactly one module, which exports it. This
 * test enforces that by source inspection, since booting the whole app graph
 * to assert it would need a database.
 */
describe('module wiring', () => {
  const SRC = resolve(__dirname, '..');

  const moduleFiles = (): string[] => {
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.name.endsWith('.module.ts')) out.push(p);
      }
    };
    walk(SRC);
    return out;
  };

  /** `import { A, B } from './x'` -> { A: '<abs>/x', B: '<abs>/x' } */
  const importedFrom = (src: string, file: string): Map<string, string> => {
    const map = new Map<string, string>();
    const re = /import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g;
    for (let m = re.exec(src); m; m = re.exec(src)) {
      const spec = m[2];
      if (!spec.startsWith('.')) continue; // package import, not ours
      const target = resolve(dirname(file), spec);
      for (const raw of m[1].split(',')) {
        const name = raw.trim().split(/\s+as\s+/).pop()?.trim();
        if (name) map.set(name, target);
      }
    }
    return map;
  };

  const providersOf = (src: string): string[] => {
    const at = src.indexOf('providers:');
    if (at === -1) return [];
    const open = src.indexOf('[', at);
    if (open === -1) return [];
    let depth = 0;
    let close = open;
    for (; close < src.length; close++) {
      if (src[close] === '[') depth++;
      else if (src[close] === ']' && --depth === 0) break;
    }
    // Only bare class references; `{ provide: X, useClass: Y }` entries are
    // deliberate per-module bindings, so skip anything with a colon.
    return src
      .slice(open + 1, close)
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^[A-Z]\w*$/.test(s));
  };

  it('provides each shared service class in exactly one module', () => {
    // token identity = "class name @ defining file", so two unrelated
    // OrdersService classes in different domains do not collide.
    const owners = new Map<string, string[]>();

    for (const file of moduleFiles()) {
      const src = readFileSync(file, 'utf8');
      const imports = importedFrom(src, file);
      for (const name of providersOf(src)) {
        const from = imports.get(name);
        if (!from) continue; // declared in this file, or a DI token constant
        const key = `${name} (${from.slice(SRC.length + 1)})`;
        owners.set(key, [...(owners.get(key) ?? []), file.slice(SRC.length + 1)]);
      }
    }

    const duplicated = [...owners]
      .filter(([, modules]) => modules.length > 1)
      .map(([token, modules]) => `${token} is provided by ${modules.join(' and ')}`);

    expect(duplicated).toEqual([]);
  });
});
