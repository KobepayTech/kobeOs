const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const root = path.join(__dirname, '..');
const serverRequire = createRequire(path.join(root, 'server', 'package.json'));
const output = path.join(root, 'electron', 'server-bundle', 'node_modules');
const copied = new Set();

function copyDependency(name, fromRequire) {
  const entry = fromRequire.resolve(name);
  let directory = path.dirname(entry);
  while (directory !== path.dirname(directory)) {
    const manifest = path.join(directory, 'package.json');
    if (fs.existsSync(manifest)) {
      const data = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      if (data.name === name) {
        if (copied.has(name)) return;
        copied.add(name);
        fs.cpSync(directory, path.join(output, name), {
          recursive: true,
          filter: source => source === directory || !path.relative(directory, source).split(path.sep).includes('node_modules'),
        });
        for (const dependency of Object.keys(data.dependencies ?? {})) {
          copyDependency(dependency, createRequire(manifest));
        }
        return;
      }
    }
    directory = path.dirname(directory);
  }
  throw new Error('Cannot locate OCR dependency ' + name);
}

copyDependency('tesseract.js', serverRequire);
console.log('Bundled Tesseract OCR and its runtime dependencies');
