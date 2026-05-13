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
