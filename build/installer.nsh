; installer.nsh — included by electron-builder into its generated NSIS script.
; electron-builder already handles: MUI2.nsh, MUI_ICON, pages, language, Name,
; OutFile, InstallDir, SetCompressor. Only add custom logic here.
!include "LogicLib.nsh"
!include "FileFunc.nsh"

; ── Registry keys ─────────────────────────────────────────────────────────────
; Old appId: com.kobepay.kobeos (KobeOS)
!define OLD_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\{com.kobepay.kobeos}"
!define OLD_INSTALL_DIR_KEY "Software\KobeOS"
; New appId: com.kobepay.kobestudio (Kobe Studio)
!define NEW_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\{com.kobepay.kobestudio}"

; ── Migration: remove old KobeOS install before writing new files ─────────────
Function MigrateFromKobeOS
  ; Check HKCU first (per-user install)
  ReadRegStr $0 HKCU "${OLD_UNINST_KEY}" "UninstallString"
  ${If} $0 != ""
    MessageBox MB_YESNO|MB_ICONINFORMATION \
      "KobeOS (the previous version of Kobe Studio) is installed.$\n$\nThe installer will remove it before installing Kobe Studio. Your data will not be affected.$\n$\nContinue?" \
      IDYES +2
    Abort
    DetailPrint "Removing previous KobeOS installation (user)…"
    ExecWait '"$0" /S _?=$INSTDIR'
    DeleteRegKey HKCU "${OLD_UNINST_KEY}"
    DeleteRegKey HKCU "${OLD_INSTALL_DIR_KEY}"
    Delete "$DESKTOP\KobeOS.lnk"
    Delete "$SMPROGRAMS\KobeOS\KobeOS.lnk"
    Delete "$SMPROGRAMS\KobeOS\Uninstall.lnk"
    RMDir "$SMPROGRAMS\KobeOS"
    DetailPrint "Done."
  ${EndIf}

  ; Check HKLM (system-wide install)
  ReadRegStr $0 HKLM "${OLD_UNINST_KEY}" "UninstallString"
  ${If} $0 != ""
    DetailPrint "Removing previous KobeOS installation (system)…"
    ExecWait '"$0" /S'
    DeleteRegKey HKLM "${OLD_UNINST_KEY}"
    DetailPrint "Done."
  ${EndIf}
FunctionEnd

; electron-builder generates the install/uninstall sections automatically.
; The MigrateFromKobeOS function is called from the customInstall macro below.

!macro customInstall
  Call MigrateFromKobeOS
  EnVar::AddValue "PATH" "$INSTDIR"
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "${NEW_UNINST_KEY}"
  DeleteRegKey HKCU "${OLD_UNINST_KEY}"
  DeleteRegKey HKCU "${OLD_INSTALL_DIR_KEY}"
  EnVar::DeleteValue "PATH" "$INSTDIR"
!macroend
