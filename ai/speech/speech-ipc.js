'use strict';

/**
 * ai/speech/speech-ipc.js
 *
 * Registers IPC handlers for the speech service.
 * Call registerSpeechIPC(ipcMain, speechService) from main.js.
 */

function registerSpeechIPC(ipcMain, speechService) {
  ipcMain.handle('speech:speak',        (_e, text, opts)  => speechService.speak(text, opts));
  ipcMain.handle('speech:stop',         ()                => speechService.stop());
  ipcMain.handle('speech:startListen',  (_e, opts)        => speechService.startListening(opts));
  ipcMain.handle('speech:stopListen',   ()                => speechService.stopListening());
  ipcMain.handle('speech:transcribe',   (_e, audio, lang) => speechService.transcribe(audio, lang));
  ipcMain.handle('speech:status',       ()                => speechService.getStatus());
}

module.exports = { registerSpeechIPC };
