'use strict';
const fs = require('node:fs');
const path = require('node:path');
function pack(manifestFile, htmlFile, output, version) {
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  if (version) manifest.version = version;
  if (manifest.apiVersion !== 1 || !/^ext\.[a-z0-9]+(?:[.-][a-z0-9]+)+$/.test(manifest.id) || !/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error('Use API version 1, an ext. app ID, and a three-part version.');
  if (!Array.isArray(manifest.permissions) || manifest.permissions.some(p => p !== 'inventory.read')) throw new Error('Only inventory.read is supported.');
  const html = fs.readFileSync(htmlFile, 'utf8').replaceAll('{{VERSION}}', manifest.version);
  if (Buffer.byteLength(html, 'utf8') > 262144) throw new Error('Inline app HTML must be under 256 KB.');
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, JSON.stringify({ manifest, html }, null, 2) + '\n');
  return { file: output, version: manifest.version, bytes: fs.statSync(output).size };
}
if (require.main === module) {
  const [, , manifest, html, output, version] = process.argv;
  if (!manifest || !html || !output) throw new Error('Usage: node scripts/package-developer-app.cjs <manifest.json> <app.html> <output.kobeapp.json> [version]');
  console.log(JSON.stringify(pack(manifest, html, output, version)));
}
module.exports = { pack };
