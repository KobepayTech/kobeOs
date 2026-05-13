const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const RELEASE_DIR = path.join(__dirname, '..', 'release');
const ISO_DIR = path.join(__dirname, '..', 'iso-build');
const OUTPUT_ISO = path.join(__dirname, '..', 'KobeOS-Installer.iso');
console.log('🖥️  KobeOS ISO Builder\n');
if (fs.existsSync(ISO_DIR)) execSync(`rm -rf ${ISO_DIR}`);
fs.mkdirSync(ISO_DIR, { recursive: true });
const linuxUnpacked = path.join(RELEASE_DIR, 'linux-unpacked');
if (!fs.existsSync(linuxUnpacked)) {
  console.error('❌ Linux build not found. Run: npm run electron:build:linux');
  process.exit(1);
}
console.log('📦 Packaging KobeOS for bootable ISO...\n');
const dirs = ['opt/kobeos', 'etc/xdg/openbox', 'usr/share/applications', 'usr/bin', 'boot/grub'];
dirs.forEach(dir => fs.mkdirSync(path.join(ISO_DIR, dir), { recursive: true }));
const autostart = `#!/bin/bash\nexport DISPLAY=:0\nexport HOME=/home/kobeos\nexport XDG_CONFIG_HOME=/home/kobeos/.config\nopenbox &\nexec /opt/kobeos/kobeos --no-sandbox --disable-gpu --kiosk\n`;
fs.writeFileSync(path.join(ISO_DIR, 'usr/bin/start-kobeos'), autostart);
execSync(`chmod +x ${path.join(ISO_DIR, 'usr/bin/start-kobeos')}`);
const desktopEntry = `[Desktop Entry]\nName=KobeOS\nExec=/usr/bin/start-kobeos\nType=Application\nTerminal=false\nIcon=/opt/kobeos/resources/kobeos-icon.png\nCategories=System;\n`;
fs.writeFileSync(path.join(ISO_DIR, 'usr/share/applications/kobeos.desktop'), desktopEntry);
const grubConfig = `set timeout=10\nset default=0\nset menu_color_normal=white/black\nset menu_color_highlight=black/light-gray\n\nmenuentry "🖥️  Try KobeOS (Live Mode)" --class kobeos {\n    linux /boot/vmlinuz root=/dev/sr0 quiet splash\n    initrd /boot/initrd.img\n}\n\nmenuentry "💾 Install KobeOS to Hard Drive" --class kobeos {\n    linux /boot/vmlinuz root=/dev/sr0 install=yes quiet splash\n    initrd /boot/initrd.img\n}\n\nmenuentry "🔧 KobeOS Recovery Mode" --class kobeos {\n    linux /boot/vmlinuz root=/dev/sr0 recovery=yes single\n    initrd /boot/initrd.img\n}\n\nmenuentry "🔄 Reboot" { reboot }\nmenuentry "⏻  Shutdown" { halt }\n`;
fs.writeFileSync(path.join(ISO_DIR, 'boot/grub/grub.cfg'), grubConfig);
const initScript = `#!/bin/bash\nmount -t proc none /proc\nmount -t sysfs none /sys\nmount -t devtmpfs none /dev\nfor device in /dev/sr0 /dev/cdrom /dev/sda1 /dev/sdb1; do\n  if mount -o ro $device /mnt 2>/dev/null; then\n    if [ -f /mnt/opt/kobeos/kobeos ]; then\n      echo "Found KobeOS on $device"\n      break\n    fi\n    umount /mnt\n  fi\ndone\nmkdir -p /upper /work\nmount -t tmpfs none /upper\nmount -t overlay overlay -o lowerdir=/mnt,upperdir=/upper,workdir=/work /newroot\nexec switch_root /newroot /sbin/init\n`;
fs.writeFileSync(path.join(ISO_DIR, 'init'), initScript);
execSync(`chmod +x ${path.join(ISO_DIR, 'init')}`);
console.log('🔥 Building bootable ISO...\n');
try {
  execSync(`cd ${ISO_DIR} && grub-mkrescue -o ${OUTPUT_ISO} . --modules="part_gpt part_msdos fat iso9660 gzio linux boot" 2>&1`, { stdio: 'inherit' });
  console.log(`\n✅ SUCCESS! ISO created: ${OUTPUT_ISO}`);
  console.log(`📊 Size: ${(fs.statSync(OUTPUT_ISO).size / 1024 / 1024).toFixed(2)} MB`);
} catch (error) {
  console.error('\n❌ ISO build failed. Install required tools:');
  console.error('   sudo apt-get install grub-pc-bin grub-efi-amd64-bin xorriso mtools');
  process.exit(1);
}
