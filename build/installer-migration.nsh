; installer-migration.nsh
;
; Included by electron-builder's generated NSIS installer via:
;   "nsis": { "include": "build/installer-migration.nsh" }
;
; Runs before the main install section to detect and cleanly remove
; the previous KobeOS installation (appId: com.kobepay.kobeos).
;
; electron-builder calls the macro !insertmacro customInstall at the
; start of the install section, so we hook in there.

!define OLD_KOBEOS_UNINST_KEY \
  "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.kobepay.kobeos"
!define OLD_KOBEOS_DIR_KEY "Software\KobeOS"

; electron-builder expands this macro inside the generated install section
!macro customInstall
  ; ── Detect old KobeOS (per-user) ──────────────────────────────────────────
  ReadRegStr $0 HKCU "${OLD_KOBEOS_UNINST_KEY}" "UninstallString"
  ${If} $0 != ""
    MessageBox MB_YESNO|MB_ICONINFORMATION \
      "KobeOS (the previous version of Kobe Studio) is installed on this machine.$\n$\n\
Kobe Studio will replace it. Your data and settings will not be affected.$\n$\n\
Click Yes to remove KobeOS and continue installing Kobe Studio." \
      IDYES migrate_user
    Abort
    migrate_user:
    DetailPrint "Removing KobeOS (user install)…"
    ; /S = silent, _?= keeps the uninstaller from deleting itself before finishing
    ExecWait '"$0" /S _?=$INSTDIR'
    DeleteRegKey HKCU "${OLD_KOBEOS_UNINST_KEY}"
    DeleteRegKey HKCU "${OLD_KOBEOS_DIR_KEY}"
    ; Remove old shortcuts
    Delete "$DESKTOP\KobeOS.lnk"
    Delete "$SMPROGRAMS\KobeOS\KobeOS.lnk"
    Delete "$SMPROGRAMS\KobeOS\Uninstall.lnk"
    RMDir  "$SMPROGRAMS\KobeOS"
    DetailPrint "KobeOS removed."
  ${EndIf}

  ; ── Detect old KobeOS (system-wide) ───────────────────────────────────────
  ReadRegStr $0 HKLM "${OLD_KOBEOS_UNINST_KEY}" "UninstallString"
  ${If} $0 != ""
    DetailPrint "Removing KobeOS (system install)…"
    ExecWait '"$0" /S'
    DeleteRegKey HKLM "${OLD_KOBEOS_UNINST_KEY}"
    DetailPrint "KobeOS (system) removed."
  ${EndIf}
!macroend

; electron-builder expands this macro inside the generated uninstall section
!macro customUnInstall
  ; Nothing extra needed — electron-builder handles the new appId keys.
  ; Clean up any leftover KobeOS keys just in case.
  DeleteRegKey HKCU "${OLD_KOBEOS_UNINST_KEY}"
  DeleteRegKey HKCU "${OLD_KOBEOS_DIR_KEY}"
  DeleteRegKey HKLM "${OLD_KOBEOS_UNINST_KEY}"
!macroend
