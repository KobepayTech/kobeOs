; installer.nsh — included by electron-builder into its generated NSIS script.
; electron-builder already handles: MUI2.nsh, MUI_ICON, pages, language, Name,
; OutFile, InstallDir, SetCompressor. Only add custom logic here.
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "StrFunc.nsh"
${StrContains}
${StrRep}

; ── Registry keys ─────────────────────────────────────────────────────────────
!define OLD_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\{com.kobepay.kobeos}"
!define OLD_INSTALL_DIR_KEY "Software\KobeOS"

; ── VC++ 2015-2022 x64 detection ──────────────────────────────────────────────
; Microsoft's official registry key written by the VC++ 2015-2022 x64 redist.
; "Installed" DWORD == 1 means the runtime is present.
!define VCREDIST_KEY "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\X64"

; ── customInstall: runs during installation ───────────────────────────────────
!macro customInstall
  ; ── 1. Migrate from previous KobeOS installation ──────────────────────────
  ReadRegStr $0 HKCU "${OLD_UNINST_KEY}" "UninstallString"
  ${If} $0 != ""
    MessageBox MB_YESNO|MB_ICONINFORMATION \
      "KobeOS (the previous version of Kobe Studio) is installed.$\n$\nThe installer will remove it first. Your data will not be affected.$\n$\nContinue?" \
      IDYES +2
    Abort
    DetailPrint "Removing previous KobeOS installation..."
    ExecWait '"$0" /S _?=$INSTDIR'
    DeleteRegKey HKCU "${OLD_UNINST_KEY}"
    DeleteRegKey HKCU "${OLD_INSTALL_DIR_KEY}"
    Delete "$DESKTOP\KobeOS.lnk"
    Delete "$SMPROGRAMS\KobeOS\KobeOS.lnk"
    RMDir "$SMPROGRAMS\KobeOS"
  ${EndIf}
  ReadRegStr $0 HKLM "${OLD_UNINST_KEY}" "UninstallString"
  ${If} $0 != ""
    ExecWait '"$0" /S'
    DeleteRegKey HKLM "${OLD_UNINST_KEY}"
  ${EndIf}

  ; ── 2. Install Visual C++ 2015-2022 x64 Redistributable if missing ─────────
  ; Check HKLM (machine-wide) then HKCU (per-user).
  StrCpy $1 "0"
  ReadRegDWORD $0 HKLM "${VCREDIST_KEY}" "Installed"
  ${If} $0 == "1"
    StrCpy $1 "1"
  ${Else}
    ReadRegDWORD $0 HKCU "${VCREDIST_KEY}" "Installed"
    ${If} $0 == "1"
      StrCpy $1 "1"
    ${EndIf}
  ${EndIf}

  ${If} $1 == "0"
    DetailPrint "Installing Visual C++ 2015-2022 x64 Redistributable..."
    ; vc_redist.x64.exe is placed next to the installer by electron-builder
    ; via the extraFiles entry in package.json (from: build/vcredist/).
    StrCpy $2 "$EXEDIR\vc_redist.x64.exe"
    ${If} ${FileExists} "$2"
      ; /install /quiet /norestart — silent, no reboot prompt
      ExecWait '"$2" /install /quiet /norestart' $3
      ${If} $3 != 0
      ${AndIf} $3 != 1638
        ; 1638 = a newer version is already installed — not an error
        MessageBox MB_OK|MB_ICONEXCLAMATION \
          "Visual C++ Redistributable setup returned code $3.$\n$\nKobeOS may not start correctly. If it fails, install vc_redist.x64.exe from Microsoft manually."
      ${EndIf}
    ${Else}
      MessageBox MB_OK|MB_ICONEXCLAMATION \
        "vc_redist.x64.exe was not found next to the installer.$\n$\nIf KobeOS fails to start, download the Visual C++ 2015-2022 x64 Redistributable from Microsoft."
    ${EndIf}
  ${Else}
    DetailPrint "Visual C++ 2015-2022 x64 Redistributable already present — skipping."
  ${EndIf}
!macroend

  ; ── 3. Register cloudflared.exe on the system PATH ────────────────────────
  ; cloudflared-win-x64.exe is bundled in resources\cloudflared\ by electron-builder.
  ; We copy it to $INSTDIR\cloudflared.exe and add $INSTDIR to the machine PATH
  ; so `cloudflared` is available system-wide (needed by the NestJS backend).
  StrCpy $0 "$INSTDIR\resources\cloudflared\cloudflared-win-x64.exe"
  StrCpy $1 "$INSTDIR\cloudflared.exe"
  ${If} ${FileExists} "$0"
    DetailPrint "Installing cloudflared.exe..."
    CopyFiles /SILENT "$0" "$1"

    ; Add $INSTDIR to system PATH if not already present
    ReadRegStr $2 HKLM "SYSTEM\CurrentControlSet\Control\Session Manager\Environment" "Path"
    ${If} $2 != ""
      StrCpy $3 "$2"
      ; Simple check: if $INSTDIR is already in PATH, skip
      ${StrContains} $4 "$INSTDIR" "$3"
      ${If} $4 == ""
        WriteRegExpandStr HKLM "SYSTEM\CurrentControlSet\Control\Session Manager\Environment" "Path" "$2;$INSTDIR"
        ; Broadcast WM_SETTINGCHANGE so running processes pick up the new PATH
        SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
        DetailPrint "Added $INSTDIR to system PATH."
      ${Else}
        DetailPrint "$INSTDIR already in system PATH — skipping."
      ${EndIf}
    ${EndIf}
  ${Else}
    DetailPrint "cloudflared binary not found in resources — skipping PATH registration."
  ${EndIf}
!macroend

; ── customUnInstall: runs during uninstallation ───────────────────────────────
!macro customUnInstall
  DeleteRegKey HKCU "${OLD_UNINST_KEY}"
  DeleteRegKey HKCU "${OLD_INSTALL_DIR_KEY}"

  ; Remove cloudflared.exe left by the installer
  Delete "$INSTDIR\cloudflared.exe"

  ; Remove $INSTDIR from system PATH
  ReadRegStr $0 HKLM "SYSTEM\CurrentControlSet\Control\Session Manager\Environment" "Path"
  ${If} $0 != ""
    ; Strip ";$INSTDIR" or "$INSTDIR;" from PATH
    ${StrRep} $1 "$0" ";$INSTDIR" ""
    ${StrRep} $1 "$1" "$INSTDIR;" ""
    ${If} $1 != $0
      WriteRegExpandStr HKLM "SYSTEM\CurrentControlSet\Control\Session Manager\Environment" "Path" "$1"
      SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
    ${EndIf}
  ${EndIf}

  ; Intentionally do NOT uninstall the VC++ runtime — other apps depend on it.
!macroend
