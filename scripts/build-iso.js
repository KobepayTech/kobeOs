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

// Prefer chroot boot dir (contains Plymouth-enabled initrd) over host /boot
const CHROOT_BOOT = '/workspaces/kobeos-chroot/boot';
const bootDir = fs.existsSync(CHROOT_BOOT) ? CHROOT_BOOT : '/boot';

const vmlinuz = findFile(bootDir, /^vmlinuz-\d/) || path.join(bootDir, 'vmlinuz');
const initrd  = findFile(bootDir, /^initrd\.img-\d/) || path.join(bootDir, 'initrd.img');

if (!fs.existsSync(vmlinuz) || !fs.existsSync(initrd)) {
  console.error('❌ Kernel not found in', bootDir);
  console.error('   Run: sudo apt-get install linux-image-generic (inside chroot)');
  process.exit(1);
}

console.log(`✅ Kernel : ${vmlinuz}`);
console.log(`✅ Initrd : ${initrd} (Plymouth theme embedded)`);
console.log(`✅ Source : ${bootDir === CHROOT_BOOT ? 'chroot' : 'host'}\n`);

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

// ── Squashfs live filesystem ──────────────────────────────────────────────────
// Compress the chroot into a squashfs image that live-boot mounts as the root FS.
// The Electron app is installed into the chroot at /opt/kobeos before this step.

const CHROOT_DIR  = '/workspaces/kobeos-chroot';
const liveDir     = path.join(ISO_DIR, 'live');
const squashfsOut = path.join(liveDir, 'filesystem.squashfs');

fs.mkdirSync(liveDir, { recursive: true });

if (fs.existsSync(CHROOT_DIR)) {
  // Install the Electron app into the chroot before squashing
  const linuxUnpackedInChroot = path.join(CHROOT_DIR, 'opt/kobeos');
  if (fs.existsSync(linuxUnpacked)) {
    console.log('📂 Installing Electron app into chroot at /opt/kobeos...');
    execSync(`sudo mkdir -p ${linuxUnpackedInChroot}`);
    execSync(`sudo cp -r ${linuxUnpacked}/. ${linuxUnpackedInChroot}/`, { stdio: 'inherit' });

    // server-bundle
    const serverBundle = path.join(__dirname, '..', 'electron', 'server-bundle');
    if (fs.existsSync(serverBundle)) {
      const dest = path.join(linuxUnpackedInChroot, 'resources/server-bundle');
      execSync(`sudo mkdir -p ${dest}`);
      execSync(`sudo cp -r ${serverBundle}/. ${dest}/`);
      console.log('   ✅ server-bundle installed into chroot');
    }

    // embedded-postgres
    const pgSrc = path.join(__dirname, '..', 'node_modules', 'embedded-postgres');
    if (fs.existsSync(pgSrc)) {
      const pgDest = path.join(linuxUnpackedInChroot, 'resources/node_modules/embedded-postgres');
      execSync(`sudo mkdir -p ${path.dirname(pgDest)}`);
      execSync(`sudo cp -r ${pgSrc} ${pgDest}`);
      console.log('   ✅ embedded-postgres installed into chroot');
    }
  }

  // Check mksquashfs is available
  try { execSync('which mksquashfs', { stdio: 'pipe' }); } catch {
    console.error('❌ mksquashfs not found. Run: sudo apt-get install squashfs-tools');
    process.exit(1);
  }

  console.log('\n🗜️  Building squashfs (this takes several minutes)...');
  execSync(
    `sudo mksquashfs ${CHROOT_DIR} ${squashfsOut} ` +
    `-comp xz -Xbcj x86 -b 1M -no-progress ` +
    `-e ${CHROOT_DIR}/proc ${CHROOT_DIR}/sys ${CHROOT_DIR}/dev ${CHROOT_DIR}/run`,
    { stdio: 'inherit' }
  );
  const sqMB = (fs.statSync(squashfsOut).size / 1024 / 1024).toFixed(1);
  console.log(`✅ squashfs: ${sqMB} MB\n`);

  // Write filesystem.size (number of inodes — used by some live-boot variants)
  try {
    const inodes = execSync(`sudo find ${CHROOT_DIR} | wc -l`).toString().trim();
    fs.writeFileSync(path.join(liveDir, 'filesystem.size'), inodes);
  } catch { /* non-fatal */ }

} else {
  console.warn(`⚠️  Chroot not found at ${CHROOT_DIR} — skipping squashfs build.`);
  console.warn('   The ISO will boot but will have no live root filesystem.\n');
}

// ── Copy Electron app (fallback: also place directly in ISO for non-live boot) ─

console.log('📂 Copying Electron app into ISO opt/kobeos...');
execSync(`cp -r ${linuxUnpacked}/. ${path.join(ISO_DIR, 'opt/kobeos/')}`, { stdio: 'inherit' });

// Copy server-bundle into ISO fallback dir
const serverBundle = path.join(__dirname, '..', 'electron', 'server-bundle');
if (fs.existsSync(serverBundle)) {
  const dest = path.join(ISO_DIR, 'opt/kobeos/resources/server-bundle');
  fs.mkdirSync(dest, { recursive: true });
  execSync(`cp -r ${serverBundle}/. ${dest}/`);
  console.log('   ✅ server-bundle copied');
} else {
  console.warn('   ⚠️  server-bundle not found — run: npm run build:bundle');
}

// Copy embedded-postgres into ISO fallback dir
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
    linux  /boot/vmlinuz boot=live live-media-path=/live quiet splash plymouth.ignore-serial-consoles
    initrd /boot/initrd.img
}

menuentry "Install KobeOS to Disk" --class kobeos {
    linux  /boot/vmlinuz boot=live live-media-path=/live install=yes quiet splash plymouth.ignore-serial-consoles
    initrd /boot/initrd.img
}

menuentry "KobeOS (safe graphics / nomodeset)" --class kobeos {
    linux  /boot/vmlinuz boot=live live-media-path=/live nomodeset
    initrd /boot/initrd.img
}

menuentry "KobeOS Recovery (installed system)" --class kobeos {
    search --no-floppy --label --set=root KOBEOS_REC
    linux  /vmlinuz boot=live root=LABEL=KOBEOS_REC toram
    initrd /initrd.img
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
# --disable-setuid-sandbox is safe for non-root; avoids SUID chrome-sandbox requirement
exec /opt/kobeos/kobeos --disable-setuid-sandbox --disable-gpu --kiosk
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
