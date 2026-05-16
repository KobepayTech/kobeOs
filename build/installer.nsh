!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"

Name "Kobe Studio"
OutFile "KobeStudio-Setup.exe"
InstallDir "$PROGRAMFILES64\Kobe Studio"
InstallDirRegKey HKCU "Software\KobepayTech\Kobe Studio" ""
RequestExecutionLevel admin
SetCompressor /SOLID lzma

!define MUI_ABORTWARNING
!define MUI_ICON "..\public\kobeos-icon.ico"
!define MUI_UNICON "..\public\kobeos-icon.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "..\public\installer-wizard.bmp"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "..\public\installer-header.bmp"

; ── Registry keys ─────────────────────────────────────────────────────────────
; Old appId: com.kobepay.kobeos (KobeOS)
!define OLD_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\{com.kobepay.kobeos}"
!define OLD_INSTALL_DIR_KEY "Software\KobeOS"
; New appId: com.kobepay.kobestudio (Kobe Studio)
!define NEW_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\{com.kobepay.kobestudio}"

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

Section "Kobe Studio Core" SEC_CORE
  SectionIn RO
  Call MigrateFromKobeOS

  SetOutPath "$INSTDIR"
  File /r "..\release\win-unpacked\*.*"

  CreateDirectory "$SMPROGRAMS\Kobe Studio"
  CreateShortcut "$SMPROGRAMS\Kobe Studio\Kobe Studio.lnk" "$INSTDIR\Kobe Studio.exe"
  CreateShortcut "$SMPROGRAMS\Kobe Studio\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\Kobe Studio.lnk" "$INSTDIR\Kobe Studio.exe"

  WriteRegStr HKCU "Software\KobepayTech\Kobe Studio" "" $INSTDIR
  WriteRegStr HKCU "${NEW_UNINST_KEY}" "DisplayName" "Kobe Studio"
  WriteRegStr HKCU "${NEW_UNINST_KEY}" "DisplayVersion" "1.0.0"
  WriteRegStr HKCU "${NEW_UNINST_KEY}" "Publisher" "KobepayTech"
  WriteRegStr HKCU "${NEW_UNINST_KEY}" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "${NEW_UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${NEW_UNINST_KEY}" "DisplayIcon" "$INSTDIR\Kobe Studio.exe"
  WriteRegDWORD HKCU "${NEW_UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${NEW_UNINST_KEY}" "NoRepair" 1

  WriteUninstaller "$INSTDIR\Uninstall.exe"
  EnVar::AddValue "PATH" "$INSTDIR"
SectionEnd

Section "Start Menu Shortcuts" SEC_STARTMENU
  CreateDirectory "$SMPROGRAMS\Kobe Studio"
  CreateShortcut "$SMPROGRAMS\Kobe Studio\Kobe Studio.lnk" "$INSTDIR\Kobe Studio.exe"
SectionEnd

Section "Desktop Shortcut" SEC_DESKTOP
  CreateShortcut "$DESKTOP\Kobe Studio.lnk" "$INSTDIR\Kobe Studio.exe"
SectionEnd

Section "Uninstall"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir /r "$INSTDIR"
  Delete "$SMPROGRAMS\Kobe Studio\Kobe Studio.lnk"
  Delete "$SMPROGRAMS\Kobe Studio\Uninstall.lnk"
  RMDir "$SMPROGRAMS\Kobe Studio"
  Delete "$DESKTOP\Kobe Studio.lnk"
  DeleteRegKey HKCU "Software\KobepayTech\Kobe Studio"
  DeleteRegKey HKCU "${NEW_UNINST_KEY}"
  EnVar::DeleteValue "PATH" "$INSTDIR"
SectionEnd

LangString DESC_CORE      ${LANG_ENGLISH} "Kobe Studio core application files."
LangString DESC_STARTMENU ${LANG_ENGLISH} "Add Kobe Studio to Start Menu."
LangString DESC_DESKTOP   ${LANG_ENGLISH} "Add Kobe Studio shortcut to Desktop."

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_CORE}      $(DESC_CORE)
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_STARTMENU} $(DESC_STARTMENU)
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_DESKTOP}   $(DESC_DESKTOP)
!insertmacro MUI_FUNCTION_DESCRIPTION_END
