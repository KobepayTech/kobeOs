const fs = require('node:fs');
const path = require('node:path');

const bundleDir = path.join(__dirname, '..', 'electron', 'server-bundle');
fs.writeFileSync(
  path.join(bundleDir, 'package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2) + '\n',
);
