#!/bin/bash
set -e

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║     KobeOS Complete Setup: ISO Builder + Live Mode + Windows     ║"
echo "╚══════════════════════════════════════════════════════════════════╝"

# ============================================
# 1. GITHUB ACTION (Auto-build ISO on push)
# ============================================
echo -e "\n[1/4] Creating GitHub Action workflow..."
mkdir -p .github/workflows
cat > .github/workflows/build-iso.yml << 'GA'
name: Build KobeOS Installer ISO
on:
  push:
    branches: [master, main]
  pull_request:
    branches: [master, main]
  workflow_dispatch:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: |
          sudo apt-get update
          sudo apt-get install -y grub-pc-bin grub-efi-amd64-bin xorriso mtools squashfs-tools fakeroot debootstrap
      - run: npm ci
      - run: npm run build
      - run: npm run electron:build:linux
      - run: npm run iso:build
      - uses: actions/upload-artifact@v4
        with:
          name: KobeOS-Installer
          path: KobeOS-Installer.iso
          retention-days: 30
      - uses: actions/upload-artifact@v4
        with:
          name: KobeOS-AppImage
          path: release/*.AppImage
          retention-days: 30
      - if: startsWith(github.ref, 'refs/tags/v')
        uses: softprops/action-gh-release@v1
        with:
          files: |
            KobeOS-Installer.iso
            release/*.AppImage
            release/*.deb
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
GA
echo "✓ GitHub Action created"

# ============================================
# 2. LIVE MODE SYSTEM (USB vs Installed)
# ============================================
echo -e "\n[2/4] Creating Live Mode detection system..."
mkdir -p src/hooks
cat > src/hooks/useSystemMode.ts << 'HOOK'
import { useState, useEffect } from 'react';
export type SystemMode = 'live-usb' | 'installed' | 'development' | 'unknown';
export function useSystemMode(): SystemMode {
  const [mode, setMode] = useState<SystemMode>('unknown');
  useEffect(() => {
    const isElectron = window.navigator.userAgent.toLowerCase().includes('electron');
    if (!isElectron) { setMode('development'); return; }
    fetch('file:///proc/mounts').then(r => r.text()).then(mounts => {
      if (mounts.includes('/dev/sr0') || mounts.includes('/dev/cdrom') || mounts.includes('overlay') || mounts.includes('aufs')) setMode('live-usb');
      else if (mounts.includes('/dev/sda') || mounts.includes('/dev/nvme') || mounts.includes('/dev/mmc')) setMode('installed');
      else setMode('installed');
    }).catch(() => setMode('installed'));
  }, []);
  return mode;
}
HOOK

cat > src/components/LiveModeBanner.tsx << 'BANNER'
import React from 'react';
import { Usb, HardDrive, Code, AlertTriangle } from 'lucide-react';
import { useSystemMode } from '@/hooks/useSystemMode';
import { Button } from '@/components/ui/button';

export default function LiveModeBanner() {
  const mode = useSystemMode();
  if (mode === 'development') return null;
  const configs = {
    'live-usb': {
      icon: <Usb size={18} className="text-yellow-400" />,
      bg: 'bg-yellow-500/10 border-yellow-500/30',
      text: 'text-yellow-400',
      label: 'LIVE USB MODE',
      message: 'Running from USB. Performance is limited. Install to hard drive for full speed.',
      action: 'Install to Disk',
      color: 'bg-yellow-600 hover:bg-yellow-700'
    },
    'installed': {
      icon: <HardDrive size={18} className="text-green-400" />,
      bg: 'bg-green-500/10 border-green-500/30',
      text: 'text-green-400',
      label: 'INSTALLED SYSTEM',
      message: 'KobeOS is installed on this computer. All features available.',
      action: null,
      color: ''
    },
    'unknown': {
      icon: <AlertTriangle size={18} className="text-gray-400" />,
      bg: 'bg-gray-500/10 border-gray-500/30',
      text: 'text-gray-400',
      label: 'SYSTEM MODE UNKNOWN',
      message: 'Cannot detect if running from USB or installed disk.',
      action: null,
      color: ''
    }
  };
  const c = configs[mode];
  return (
    <div className={`fixed top-0 left-0 right-0 z-50 border-b ${c.bg} backdrop-blur-md`}>
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {c.icon}
          <div>
            <span className={`text-xs font-bold tracking-wider ${c.text}`}>{c.label}</span>
            <p className="text-xs text-gray-400 ml-0">{c.message}</p>
          </div>
        </div>
        {c.action && (
          <Button size="sm" className={`${c.color} text-white text-xs`} onClick={() => window.location.href = '/installer'}>
            {c.action}
          </Button>
        )}
      </div>
    </div>
  );
}
BANNER
echo "✓ Live Mode system created"

# ============================================
# 3. WINDOWS NSIS INSTALLER
# ============================================
echo -e "\n[3/4] Creating Windows NSIS installer script..."
mkdir -p build
cat > build/installer.nsh << 'NSIS'
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"

Name "KobeOS"
OutFile "KobeOS-Setup.exe"
InstallDir "$PROGRAMFILES64\KobeOS"
InstallDirRegKey HKCU "Software\KobeOS" ""
RequestExecutionLevel admin
SetCompressor /SOLID lzma

!define MUI_ABORTWARNING
!define MUI_ICON "..\public\kobeos-icon.ico"
!define MUI_UNICON "..\public\kobeos-icon.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "..\public\installer-wizard.bmp"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "..\public\installer-header.bmp"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\LICENSE.txt"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "English"

Section "KobeOS Core" SEC_CORE
  SectionIn RO
  SetOutPath "$INSTDIR"
  File /r "..\release\win-unpacked\*.*"
  CreateDirectory "$SMPROGRAMS\KobeOS"
  CreateShortcut "$SMPROGRAMS\KobeOS\KobeOS.lnk" "$INSTDIR\KobeOS.exe"
  CreateShortcut "$SMPROGRAMS\KobeOS\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\KobeOS.lnk" "$INSTDIR\KobeOS.exe"
  WriteRegStr HKCU "Software\KobeOS" "" $INSTDIR
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  EnVar::AddValue "PATH" "$INSTDIR"
SectionEnd

Section "Start Menu Shortcuts" SEC_STARTMENU
  CreateDirectory "$SMPROGRAMS\KobeOS"
  CreateShortcut "$SMPROGRAMS\KobeOS\KobeOS.lnk" "$INSTDIR\KobeOS.exe"
SectionEnd

Section "Desktop Shortcut" SEC_DESKTOP
  CreateShortcut "$DESKTOP\KobeOS.lnk" "$INSTDIR\KobeOS.exe"
SectionEnd

Section "Uninstall"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir /r "$INSTDIR"
  Delete "$SMPROGRAMS\KobeOS\KobeOS.lnk"
  Delete "$SMPROGRAMS\KobeOS\Uninstall.lnk"
  RMDir "$SMPROGRAMS\KobeOS"
  Delete "$DESKTOP\KobeOS.lnk"
  DeleteRegKey HKCU "Software\KobeOS"
  EnVar::DeleteValue "PATH" "$INSTDIR"
SectionEnd

LangString DESC_CORE ${LANG_ENGLISH} "KobeOS core application files."
LangString DESC_STARTMENU ${LANG_ENGLISH} "Add KobeOS to Start Menu."
LangString DESC_DESKTOP ${LANG_ENGLISH} "Add KobeOS shortcut to Desktop."

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_CORE} $(DESC_CORE)
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_STARTMENU} $(DESC_STARTMENU)
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_DESKTOP} $(DESC_DESKTOP)
!insertmacro MUI_FUNCTION_DESCRIPTION_END
NSIS
echo "✓ Windows NSIS installer created"

# ============================================
# 4. UPDATE package.json WITH NSIS SCRIPT PATH
# ============================================
echo -e "\n[4/4] Updating package.json Windows config..."

# Check if package.json exists from previous setup
if [ ! -f "package.json" ]; then
  echo "❌ package.json not found. Run the main setup script first!"
  exit 1
fi

# The NSIS config is already in the package.json from the main script
# Just verify it's there
if grep -q "nsis" package.json; then
  echo "✓ package.json already has NSIS configuration"
else
  echo "⚠️  package.json may need manual NSIS config update"
fi

echo -e "\n═══════════════════════════════════════════════════════════════════"
echo "  ✅ ALL FEATURES CREATED SUCCESSFULLY!"
echo "═══════════════════════════════════════════════════════════════════"

echo -e "\n📁 New files created:"
echo "   .github/workflows/build-iso.yml     → Auto-builds ISO on every push"
echo "   src/hooks/useSystemMode.ts            → Detects Live USB vs Installed"
echo "   src/components/LiveModeBanner.tsx     → Shows banner at top of app"
echo "   build/installer.nsh                  → Windows .exe installer wizard"

echo -e "\n🚀 Push to GitHub to activate:"
echo "   git add ."
echo "   git commit -m 'Add auto-ISO build, live mode, Windows installer'"
echo "   git push origin master"

echo -e "\n📋 After push, GitHub will auto-build ISO. Download from:"
echo "   GitHub → Actions → Build KobeOS Installer ISO → Artifacts"

echo -e "\n💻 Build Windows installer locally:"
echo "   npm run electron:build:win"
echo "   (Requires Windows or wine on Linux)"

echo -e "\n🔧 To use Live Mode banner in your app, add to App.tsx:"
echo "   import LiveModeBanner from '@/components/LiveModeBanner';"
echo "   <LiveModeBanner />"
echo ""
