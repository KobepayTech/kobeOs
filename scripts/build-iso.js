const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RELEASE_DIR = path.join(__dirname, '..', 'release');
const ISO_DIR     = path.join(__dirname, '..', 'iso-build');
const OUTPUT_ISO  = path.join(__dirname, '..', 'KobeOS-Installer.iso');

console.log('🖥️  KobeOS ISO Builder\n');

if (fs.existsSync(ISO_DIR)) execSync(`rm -rf ${ISO_DIR}`);
fs.mkdirSync(ISO_DIR, { recursive: true });

const linuxUnpacked = path.join(RELEASE_DIR, 'linux-unpacked');
if (!fs.existsSync(linuxUnpacked)) {
  console.error('❌ Linux build not found. Run: npm run electron:build:linux');
  process.exit(1);
}

// ── Find kernel + initrd ──────────────────────────────────────────────────────

function findFile(dir, pattern) {
  try {
    const files = fs.readdirSync(dir).filter(f => f.match(pattern)).sort().reverse();
    return files.length ? path.join(dir, files[0]) : null;
  } catch { return null; }
}

const vmlinuz = findFile('/boot', /^vmlinuz-\d/) || '/boot/vmlinuz';
const initrd  = findFile('/boot', /^initrd\.img-\d/) || '/boot/initrd.img';

if (!fs.existsSync(vmlinuz) || !fs.existsSync(initrd)) {
  console.error('❌ Kernel not found. Run:');
  console.error('   sudo apt-get install linux-image-generic');
  process.exit(1);
}

console.log(`✅ Kernel : ${vmlinuz}`);
console.log(`✅ Initrd : ${initrd}\n`);

// ── Directory structure ───────────────────────────────────────────────────────

console.log('📦 Packaging KobeOS for bootable ISO...\n');

['opt/kobeos', 'boot/grub', 'boot/isolinux', 'usr/bin', 'usr/share/applications', 'etc/xdg/openbox'].forEach(
  d => fs.mkdirSync(path.join(ISO_DIR, d), { recursive: true })
);

// ── Copy kernel + initrd ──────────────────────────────────────────────────────

console.log('📂 Copying kernel + initrd...');
execSync(`sudo cp ${vmlinuz} ${path.join(ISO_DIR, 'boot/vmlinuz')}`);
execSync(`sudo cp ${initrd}  ${path.join(ISO_DIR, 'boot/initrd.img')}`);
execSync(`sudo chmod 644 ${path.join(ISO_DIR, 'boot/vmlinuz')} ${path.join(ISO_DIR, 'boot/initrd.img')}`);

// ── Copy Electron app ─────────────────────────────────────────────────────────

console.log('📂 Copying Electron app (this may take a minute)...');
execSync(`cp -r ${linuxUnpacked}/. ${path.join(ISO_DIR, 'opt/kobeos/')}`, { stdio: 'inherit' });

// Copy server-bundle
const serverBundle = path.join(__dirname, '..', 'electron', 'server-bundle');
if (fs.existsSync(serverBundle)) {
  const dest = path.join(ISO_DIR, 'opt/kobeos/resources/server-bundle');
  fs.mkdirSync(dest, { recursive: true });
  execSync(`cp -r ${serverBundle}/. ${dest}/`);
  console.log('   ✅ server-bundle copied');
} else {
  console.warn('   ⚠️  server-bundle not found — run: npm run build:bundle');
}

// Copy embedded-postgres
const pgSrc = path.join(__dirname, '..', 'node_modules', 'embedded-postgres');
if (fs.existsSync(pgSrc)) {
  const pgDest = path.join(ISO_DIR, 'opt/kobeos/resources/node_modules/embedded-postgres');
  fs.mkdirSync(path.dirname(pgDest), { recursive: true });
  execSync(`cp -r ${pgSrc} ${pgDest}`);
  console.log('   ✅ embedded-postgres copied');
}

console.log(`   App size: ${execSync(`du -sh ${path.join(ISO_DIR, 'opt/kobeos/')}`).toString().split('\t')[0]}\n`);

// ── GRUB config (uses real kernel) ────────────────────────────────────────────

const grubCfg = `
set timeout=10
set default=0

insmod all_video
insmod gfxterm
terminal_output gfxterm

menuentry "Try KobeOS Live" --class kobeos {
    linux  /boot/vmlinuz boot=live quiet splash nomodeset
    initrd /boot/initrd.img
}

menuentry "Install KobeOS to Disk" --class kobeos {
    linux  /boot/vmlinuz boot=live install=yes quiet splash nomodeset
    initrd /boot/initrd.img
}

menuentry "KobeOS (safe graphics)" --class kobeos {
    linux  /boot/vmlinuz boot=live nomodeset xforcevesa
    initrd /boot/initrd.img
}

menuentry "Reboot"   { reboot }
menuentry "Shutdown" { halt }
`.trim();

fs.writeFileSync(path.join(ISO_DIR, 'boot/grub/grub.cfg'), grubCfg);

// ── Autostart script ──────────────────────────────────────────────────────────

const startScript = `#!/bin/bash
export DISPLAY=:0
export HOME=/root
export XDG_RUNTIME_DIR=/tmp/runtime-root
mkdir -p $XDG_RUNTIME_DIR
# Start X if not running
if ! pgrep -x Xorg > /dev/null; then
  Xorg :0 -nolisten tcp vt1 &
  sleep 3
fi
exec /opt/kobeos/kobeos --no-sandbox --disable-gpu-sandbox --kiosk
`;
fs.writeFileSync(path.join(ISO_DIR, 'usr/bin/start-kobeos'), startScript);
execSync(`chmod +x ${path.join(ISO_DIR, 'usr/bin/start-kobeos')}`);

// ── Desktop entry ─────────────────────────────────────────────────────────────

fs.writeFileSync(path.join(ISO_DIR, 'usr/share/applications/kobeos.desktop'),
`[Desktop Entry]
Name=KobeOS
Exec=/usr/bin/start-kobeos
Type=Application
Terminal=false
Categories=System;
`);

// ── Build ISO ─────────────────────────────────────────────────────────────────

console.log('🔥 Building bootable ISO...\n');
try {
  execSync(
    `grub-mkrescue -o ${OUTPUT_ISO} ${ISO_DIR} ` +
    `--modules="part_gpt part_msdos fat iso9660 gzio linux normal boot all_video gfxterm" 2>&1`,
    { stdio: 'inherit' }
  );
  const sizeMB = (fs.statSync(OUTPUT_ISO).size / 1024 / 1024).toFixed(2);
  console.log(`\n✅ SUCCESS! ISO created: ${OUTPUT_ISO}`);
  console.log(`📊 Size: ${sizeMB} MB`);
} catch (err) {
  console.error('\n❌ ISO build failed:', err.message);
  process.exit(1);
}
