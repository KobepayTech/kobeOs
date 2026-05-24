; installer.nsh — included by electron-builder into its generated NSIS script.
; electron-builder already handles: MUI2.nsh, MUI_ICON, pages, language, Name,
; OutFile, InstallDir, SetCompressor. Only add custom logic here.
!include "LogicLib.nsh"
!include "FileFunc.nsh"

; ── Registry keys ─────────────────────────────────────────────────────────────
!define OLD_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\{com.kobepay.kobeos}"
!define OLD_INSTALL_DIR_KEY "Software\KobeOS"

; ── customInstall: runs during installation ───────────────────────────────────
; Migrates users from the old KobeOS app before writing new files.
!macro customInstall
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
!macroend

; ── customUnInstall: runs during uninstallation ───────────────────────────────
!macro customUnInstall
  DeleteRegKey HKCU "${OLD_UNINST_KEY}"
  DeleteRegKey HKCU "${OLD_INSTALL_DIR_KEY}"
!macroend
