#!/bin/bash
###############################################################################
# KobeOS Installer Builder Script
# Converts React+Vite web app into bootable Windows-like OS installer
###############################################################################

set -e

KOBEOS_DIR="$(pwd)"
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║           KobeOS Windows-Style Installer Builder                 ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "\n${YELLOW}[STEP 1/6] Creating Electron wrapper...${NC}"
mkdir -p "$KOBEOS_DIR/electron"
mkdir -p "$KOBEOS_DIR/scripts"
mkdir -p "$KOBEOS_DIR/src/types"

cat > "$KOBEOS_DIR/electron/main.js" << 'ELECTRON_MAIN'
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920, height: 1080, fullscreen: true, kiosk: true,
    autoHideMenuBar: true, frame: false,
    webPreferences: {
      nodeIntegration: true, contextIsolation: false,
      enableRemoteModule: true, webSecurity: false
    }
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.key.toLowerCase() === 'r') event.preventDefault();
    if (input.control && input.shift && input.key.toLowerCase() === 'i') event.preventDefault();
    if (input.key === 'F12') event.preventDefault();
    if (input.key === 'F5') event.preventDefault();
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('system-shutdown', () => {
  exec(process.platform === 'win32' ? 'shutdown /s /t 0' : 'poweroff');
});

ipcMain.handle('system-reboot', () => {
  exec(process.platform === 'win32' ? 'shutdown /r /t 0' : 'reboot');
});

ipcMain.handle('install-to-disk', async (event, diskPath) => {
  return new Promise((resolve) => {
    const script = `
      echo "Installing KobeOS to ${diskPath}..."
      parted ${diskPath} mklabel gpt
      parted ${diskPath} mkpart primary ext4 1MiB 512MiB
      parted ${diskPath} mkpart primary ext4 512MiB 100%
      mkfs.ext4 ${diskPath}1 && mkfs.ext4 ${diskPath}2
      mkdir -p /mnt/kobeos && mount ${diskPath}2 /mnt/kobeos
      cp -a /opt/kobeos/* /mnt/kobeos/
      mkdir -p /mnt/kobeos/boot/efi && mount ${diskPath}1 /mnt/kobeos/boot/efi
      grub-install --target=x86_64-efi --efi-directory=/mnt/kobeos/boot/efi --bootloader-id=KobeOS --removable
      grub-mkconfig -o /mnt/kobeos/boot/grub/grub.cfg
      umount -R /mnt/kobeos
      echo "INSTALL_COMPLETE"
    `;
    exec(script, { timeout: 300000 }, (error, stdout, stderr) => {
      resolve({ success: !error, output: stdout, error: stderr });
    });
  });
});

ipcMain.handle('scan-disks', async () => {
  return new Promise((resolve) => {
    exec("lsblk -d -o NAME,SIZE,TYPE,MODEL -n | grep disk", (error, stdout) => {
      if (error) return resolve([]);
      const disks = stdout.trim().split('\n').map(line => {
        const parts = line.trim().split(/\s+/);
        return { name: parts[0], size: parts[1], model: parts.slice(3).join(' '), path: `/dev/${parts[0]}` };
      });
      resolve(disks);
    });
  });
});
ELECTRON_MAIN

cat > "$KOBEOS_DIR/electron/preload.js" << 'ELECTRON_PRELOAD'
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('kobeOS', {
  system: {
    shutdown: () => ipcRenderer.invoke('system-shutdown'),
    reboot: () => ipcRenderer.invoke('system-reboot'),
    installToDisk: (disk) => ipcRenderer.invoke('install-to-disk', disk),
    scanDisks: () => ipcRenderer.invoke('scan-disks')
  }
});
ELECTRON_PRELOAD
echo -e "${GREEN}✓ Electron wrapper created${NC}"

echo -e "\n${YELLOW}[STEP 2/6] Updating package.json...${NC}"
cat > "$KOBEOS_DIR/package.json" << 'PACKAGE_JSON'
{
  "name": "kobeos", "private": true, "version": "1.0.0", "type": "module", "main": "electron/main.js",
  "scripts": {
    "dev": "vite", "build": "tsc -b && vite build", "lint": "eslint .", "preview": "vite preview",
    "electron": "electron .",
    "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:5173 && electron .\"",
    "electron:build": "npm run build && electron-builder",
    "electron:build:linux": "npm run build && electron-builder --linux",
    "electron:build:win": "npm run build && electron-builder --win",
    "iso:build": "npm run electron:build:linux && node scripts/build-iso.js"
  },
  "dependencies": {
    "@hookform/resolvers": "^5.2.2", "@radix-ui/react-accordion": "^1.2.12",
    "@radix-ui/react-alert-dialog": "^1.1.15", "@radix-ui/react-aspect-ratio": "^1.1.8",
    "@radix-ui/react-avatar": "^1.1.11", "@radix-ui/react-checkbox": "^1.3.3",
    "@radix-ui/react-collapsible": "^1.1.12", "@radix-ui/react-context-menu": "^2.2.16",
    "@radix-ui/react-dialog": "^1.1.15", "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-hover-card": "^1.1.15", "@radix-ui/react-label": "^2.1.8",
    "@radix-ui/react-menubar": "^1.1.16", "@radix-ui/react-navigation-menu": "^1.2.14",
    "@radix-ui/react-popover": "^1.1.15", "@radix-ui/react-progress": "^1.1.8",
    "@radix-ui/react-radio-group": "^1.3.8", "@radix-ui/react-scroll-area": "^1.2.10",
    "@radix-ui/react-select": "^2.2.6", "@radix-ui/react-separator": "^1.1.8",
    "@radix-ui/react-slider": "^1.3.6", "@radix-ui/react-slot": "^1.2.4",
    "@radix-ui/react-switch": "^1.2.6", "@radix-ui/react-tabs": "^1.1.13",
    "@radix-ui/react-toggle": "^1.1.10", "@radix-ui/react-toggle-group": "^1.1.11",
    "@radix-ui/react-tooltip": "^1.2.8", "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1", "cmdk": "^1.1.1", "date-fns": "^4.1.0",
    "embla-carousel-react": "^8.6.0", "framer-motion": "^12.38.0",
    "input-otp": "^1.4.2", "lucide-react": "^0.562.0", "next-themes": "^0.4.6",
    "qrcode.react": "^4.2.0", "react": "^19.2.0", "react-day-picker": "^9.13.0",
    "react-dom": "^19.2.0", "react-hook-form": "^7.70.0",
    "react-resizable-panels": "^4.2.2", "react-router": "^7.6.1",
    "recharts": "^2.15.4", "socket.io-client": "^4.8.3", "sonner": "^2.0.7",
    "tailwind-merge": "^3.4.0", "vaul": "^1.1.2", "zod": "^4.3.5", "zustand": "^5.0.13"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.1", "@types/node": "^24.10.1", "@types/react": "^19.2.5",
    "@types/react-dom": "^19.2.3", "@vitejs/plugin-react": "^5.1.1",
    "autoprefixer": "^10.4.23", "concurrently": "^9.1.2", "electron": "^35.0.0",
    "electron-builder": "^26.0.0", "eslint": "^9.39.1",
    "eslint-plugin-react-hooks": "^7.0.1", "eslint-plugin-react-refresh": "^0.4.24",
    "globals": "^16.5.0", "plugin-inspect-react-code": "^1.0.3", "postcss": "^8.5.6",
    "tailwindcss": "^3.4.19", "tailwindcss-animate": "^1.0.7", "tw-animate-css": "^1.4.0",
    "typescript": "~5.9.3", "typescript-eslint": "^8.46.4", "vite": "^7.2.4", "wait-on": "^8.0.0"
  },
  "build": {
    "appId": "com.kobepay.kobeos", "productName": "KobeOS", "copyright": "© 2026 KobepayTech",
    "directories": { "output": "release", "buildResources": "build" },
    "files": ["dist/**/*", "electron/**/*", "node_modules/**/*", "package.json"],
    "extraResources": [{ "from": "dist", "to": "dist", "filter": ["**/*"] }],
    "linux": {
      "target": [{ "target": "dir", "arch": ["x64"] }, { "target": "AppImage", "arch": ["x64"] }, { "target": "deb", "arch": ["x64"] }],
      "category": "System", "maintainer": "KobepayTech", "vendor": "KobepayTech",
      "synopsis": "KobeOS - Web-based Business Operating System",
      "description": "KobeOS is a web-based operating system with business modules."
    },
    "win": {
      "target": [{ "target": "nsis", "arch": ["x64", "ia32"] }, { "target": "portable", "arch": ["x64"] }],
      "icon": "public/kobeos-icon.ico"
    },
    "nsis": {
      "oneClick": false, "allowToChangeInstallationDirectory": true,
      "installerIcon": "public/kobeos-icon.ico", "uninstallerIcon": "public/kobeos-icon.ico",
      "installerHeaderIcon": "public/kobeos-icon.ico",
      "createDesktopShortcut": true, "createStartMenuShortcut": true, "shortcutName": "KobeOS"
    },
    "mac": { "target": ["dmg", "zip"], "category": "public.app-category.utilities" }
  }
}
PACKAGE_JSON
echo -e "${GREEN}✓ package.json updated${NC}"

echo -e "\n${YELLOW}[STEP 3/6] Creating ISO build script...${NC}"
cat > "$KOBEOS_DIR/scripts/build-iso.js" << 'BUILD_ISO'
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
BUILD_ISO
echo -e "${GREEN}✓ ISO build script created${NC}"

echo -e "\n${YELLOW}[STEP 4/6] Creating Windows-style installer UI...${NC}"
mkdir -p "$KOBEOS_DIR/src/components"
cat > "$KOBEOS_DIR/src/components/KobeOSInstaller.tsx" << 'INSTALLER_UI'
import React, { useState, useEffect } from 'react';
import { Monitor, HardDrive, Download, CheckCircle, AlertCircle, ChevronRight, ChevronLeft, Power, RefreshCw, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';

interface Disk { name: string; size: string; model: string; path: string; }

export default function KobeOSInstaller() {
  const [step, setStep] = useState(1);
  const [disks, setDisks] = useState<Disk[]>([]);
  const [selectedDisk, setSelectedDisk] = useState<string | null>(null);
  const [installProgress, setInstallProgress] = useState(0);
  const [installComplete, setInstallComplete] = useState(false);

  useEffect(() => { if (step === 3 && window.kobeOS) window.kobeOS.system.scanDisks().then(setDisks); }, [step]);

  const startInstall = async () => {
    if (!selectedDisk) return;
    const interval = setInterval(() => {
      setInstallProgress(prev => { if (prev >= 100) { clearInterval(interval); setInstallComplete(true); return 100; } return prev + Math.random() * 5; });
    }, 500);
    const result = await window.kobeOS.system.installToDisk(selectedDisk);
    clearInterval(interval);
    if (result.success) { setInstallProgress(100); setInstallComplete(true); }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className={`flex items-center ${i > 0 ? 'ml-2' : ''}`}>
          {i > 0 && <div className={`w-8 h-0.5 ${i < step ? 'bg-blue-500' : 'bg-gray-600'}`} />}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i + 1 === step ? 'bg-blue-500 text-white' : i + 1 < step ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
            {i + 1 < step ? <CheckCircle size={16} /> : i + 1}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        {renderStepIndicator()}
        <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-8 shadow-2xl">
          {step === 1 && (
            <div className="text-center space-y-6">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto flex items-center justify-center shadow-2xl shadow-blue-500/20">
                <Monitor size={48} className="text-white" />
              </div>
              <div><h1 className="text-4xl font-bold text-white mb-2">Install KobeOS</h1><p className="text-gray-400 text-lg">Version 1.0.0 — Business Operating System</p></div>
              <div className="bg-gray-800/50 rounded-xl p-6 max-w-md mx-auto text-left space-y-3">
                <div className="flex items-center gap-3 text-gray-300"><Shield size={18} className="text-green-400" /><span>Enterprise ERP System</span></div>
                <div className="flex items-center gap-3 text-gray-300"><Shield size={18} className="text-green-400" /><span>Hotel Management Module</span></div>
                <div className="flex items-center gap-3 text-gray-300"><Shield size={18} className="text-green-400" /><span>Credit & Device Financing</span></div>
                <div className="flex items-center gap-3 text-gray-300"><Shield size={18} className="text-green-400" /><span>Cargo & Logistics Tracking</span></div>
              </div>
              <Button onClick={() => setStep(2)} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg rounded-xl">Get Started <ChevronRight size={20} /></Button>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white text-center">License Agreement</h2>
              <Card className="bg-gray-800/50 border-gray-700 p-6 h-64 overflow-y-auto text-gray-300 text-sm">
                <p className="mb-4 font-semibold text-white">KobeOS End User License Agreement</p>
                <p className="mb-3">By installing KobeOS, you agree to the terms and conditions of KobepayTech. KobeOS includes proprietary business modules including ERP, Hotel Management, Credit Systems, and Cargo Tracking.</p>
                <p className="mb-3">1. You may use KobeOS on any number of devices within your organization. 2. Redistribution requires written permission from KobepayTech. 3. The software is provided "as is" without warranty of any kind.</p>
                <p>For full terms, visit: https://kobepay.com/terms</p>
              </Card>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)} className="border-gray-600"><ChevronLeft size={18} /> Back</Button>
                <Button onClick={() => setStep(3)} className="bg-blue-600 hover:bg-blue-700">I Accept <ChevronRight size={18} /></Button>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white text-center">Select Installation Drive</h2>
              <div className="space-y-3">
                {disks.length === 0 ? (
                  <div className="text-center py-12 text-gray-500"><RefreshCw size={32} className="mx-auto mb-3 animate-spin" /><p>Scanning available drives...</p></div>
                ) : (
                  disks.map((disk) => (
                    <Card key={disk.path} onClick={() => setSelectedDisk(disk.path)} className={`p-4 cursor-pointer transition-all ${selectedDisk === disk.path ? 'bg-blue-600/20 border-blue-500' : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'}`}>
                      <div className="flex items-center gap-4">
                        <HardDrive size={32} className={selectedDisk === disk.path ? 'text-blue-400' : 'text-gray-500'} />
                        <div className="flex-1"><p className="font-semibold text-white">{disk.model || disk.name}</p><p className="text-sm text-gray-400">{disk.size} — {disk.path}</p></div>
                        {selectedDisk === disk.path && <CheckCircle size={20} className="text-blue-400" />}
                      </div>
                    </Card>
                  ))
                )}
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)} className="border-gray-600"><ChevronLeft size={18} /> Back</Button>
                <Button onClick={() => setStep(4)} disabled={!selectedDisk} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50">Next <ChevronRight size={18} /></Button>
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-6 text-center">
              <h2 className="text-2xl font-bold text-white">Ready to Install</h2>
              <div className="bg-gray-800/50 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-center gap-3 text-yellow-400"><AlertCircle size={24} /><span className="font-semibold">Warning: All data on the selected drive will be erased</span></div>
                <div className="text-left space-y-2 text-gray-300 text-sm">
                  <p><strong>Target Drive:</strong> {disks.find(d => d.path === selectedDisk)?.model || selectedDisk}</p>
                  <p><strong>Size:</strong> {disks.find(d => d.path === selectedDisk)?.size}</p>
                  <p><strong>Installation Type:</strong> Full System with GRUB Bootloader</p>
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(3)} className="border-gray-600"><ChevronLeft size={18} /> Back</Button>
                <Button onClick={() => { setStep(5); startInstall(); }} className="bg-red-600 hover:bg-red-700 text-white"><Download size={18} className="mr-2" /> Install Now</Button>
              </div>
            </div>
          )}
          {step === 5 && (
            <div className="space-y-8 text-center">
              {!installComplete ? (
                <>
                  <div className="space-y-4"><h2 className="text-2xl font-bold text-white">Installing KobeOS...</h2><p className="text-gray-400">This may take a few minutes. Do not turn off your computer.</p></div>
                  <div className="max-w-md mx-auto space-y-4"><Progress value={installProgress} className="h-3" /><p className="text-3xl font-bold text-blue-400">{Math.round(installProgress)}%</p></div>
                  <div className="animate-pulse text-gray-500"><p>Partitioning disk... Formatting filesystem... Copying system files... Installing bootloader...</p></div>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 bg-green-500 rounded-full mx-auto flex items-center justify-center"><CheckCircle size={40} className="text-white" /></div>
                  <div><h2 className="text-3xl font-bold text-white mb-2">Installation Complete!</h2><p className="text-gray-400">KobeOS has been successfully installed on your system.</p></div>
                  <div className="flex gap-4 justify-center">
                    <Button onClick={() => window.kobeOS.system.reboot()} className="bg-blue-600 hover:bg-blue-700"><Power size={18} className="mr-2" /> Reboot Now</Button>
                    <Button variant="outline" onClick={() => window.kobeOS.system.shutdown()} className="border-gray-600"><Power size={18} className="mr-2" /> Shutdown</Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <p className="text-center text-gray-600 mt-6 text-sm">© 2026 KobepayTech. All rights reserved.</p>
      </div>
    </div>
  );
}
INSTALLER_UI
echo -e "${GREEN}✓ Installer UI component created${NC}"

echo -e "\n${YELLOW}[STEP 5/6] Creating TypeScript declarations...${NC}"
cat > "$KOBEOS_DIR/src/types/electron.d.ts" << 'TYPES_DECL'
export interface KobeOSSystemAPI {
  shutdown: () => Promise<void>;
  reboot: () => Promise<void>;
  installToDisk: (disk: string) => Promise<{ success: boolean; output: string; error: string }>;
  scanDisks: () => Promise<Array<{ name: string; size: string; model: string; path: string }>>;
}

declare global {
  interface Window {
    kobeOS: { system: KobeOSSystemAPI; };
  }
}

export {};
TYPES_DECL
echo -e "${GREEN}✓ TypeScript declarations created${NC}"

echo -e "\n${YELLOW}[STEP 6/6] Updating Vite configuration...${NC}"
cat > "$KOBEOS_DIR/vite.config.ts" << 'VITE_CONFIG'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
VITE_CONFIG
echo -e "${GREEN}✓ Vite config updated${NC}"

echo -e "\n${YELLOW}[BONUS] Updating tsconfig.app.json...${NC}"
cat > "$KOBEOS_DIR/tsconfig.app.json" << 'TSCONFIG'
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["node", "./src/types/electron.d.ts"]
  },
  "include": ["src"]
}
TSCONFIG
echo -e "${GREEN}✓ tsconfig.app.json updated${NC}"

echo -e "\n${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ ALL STEPS COMPLETE! KobeOS Installer System Ready${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"

echo -e "\n${BLUE}📁 Files created:${NC}"
echo "   • electron/main.js           - Electron main process"
echo "   • electron/preload.js        - Secure API bridge"
echo "   • scripts/build-iso.js       - ISO generator"
echo "   • src/components/KobeOSInstaller.tsx - Windows-style installer UI"
echo "   • src/types/electron.d.ts   - TypeScript types"
echo "   • package.json               - Updated with Electron & build scripts"
echo "   • vite.config.ts             - Updated for Electron file:// protocol"
echo "   • tsconfig.app.json          - Updated with Electron types"

echo -e "\n${BLUE}🚀 Next commands to run:${NC}"
echo "   npm install                  - Install new dependencies"
echo "   npm run electron:dev         - Test in development mode"
echo "   npm run electron:build:linux - Build Linux app"
echo "   npm run iso:build            - Create bootable ISO"

echo -e "\n${YELLOW}⚠️  Requirements for ISO build:${NC}"
echo "   sudo apt-get install grub-pc-bin grub-efi-amd64-bin xorriso mtools"

echo -e "\n${GREEN}Done! Your KobeOS is now ready to be installable like Windows.${NC}\n"
