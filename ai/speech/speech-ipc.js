'use strict';

/**
 * ai/speech/speech-ipc.js
 *
 * IPC handlers for the SpeechService.
 *
 * Renderer calls:  window.kobeOS.runtime.speech.*
 * Preload exposes: ipcRenderer.invoke('speech:<action>', ...args)
 *
 * Handlers registered here:
 *   speech:status          — get service status + whisper binary/model state
 *   speech:speak           — TTS: speak text
 *   speech:stop            — TTS: stop speaking
 *   speech:listen          — STT: start live microphone (Web Speech API)
 *   speech:stop-listen     — STT: stop live microphone
 *   speech:transcribe      — STT: transcribe base64 WAV via whisper.cpp
 *   speech:transcribe-file — STT: transcribe a file path via whisper.cpp
 *   speech:model-status    — check if a whisper model is downloaded
 *   speech:model-download  — download a whisper model (streams progress events)
 *   speech:model-progress  — get current download progress for a model
 */

const { ipcMain } = require('electron');

/**
 * @param {import('./speech-service')} speechService
 * @param {Electron.WebContents} [webContents]  — attach renderer for TTS/live STT
 */
function registerSpeechIpc(speechService, webContents) {
  if (webContents) speechService.attachWindow(webContents);

  // ── Status ────────────────────────────────────────────────────────────────

  ipcMain.handle('speech:status', () => {
    return speechService.getStatus();
  });

  // ── TTS ───────────────────────────────────────────────────────────────────

  ipcMain.handle('speech:speak', (_e, text, options = {}) => {
    return speechService.speak(String(text), options);
  });

  ipcMain.handle('speech:stop', () => {
    return speechService.stopSpeaking();
  });

  // ── Live microphone STT (Web Speech API in renderer) ─────────────────────

  ipcMain.handle('speech:listen', (_e, options = {}) => {
    return speechService.startListening(options);
  });

  ipcMain.handle('speech:stop-listen', () => {
    return speechService.stopListening();
  });

  // ── whisper.cpp transcription ─────────────────────────────────────────────

  ipcMain.handle('speech:transcribe', async (_e, base64Audio, opts = {}) => {
    if (!base64Audio) throw new Error('base64Audio is required');
    return speechService.transcribeBase64(base64Audio, opts);
  });

  ipcMain.handle('speech:transcribe-file', async (_e, audioPath, opts = {}) => {
    if (!audioPath) throw new Error('audioPath is required');
    return speechService.transcribeFile(audioPath, opts);
  });

  // ── Model management ──────────────────────────────────────────────────────

  ipcMain.handle('speech:model-status', (_e, modelId) => {
    return {
      modelId,
      downloaded: speechService.isModelReady(modelId),
      progress:   speechService.getDownloadProgress(modelId),
    };
  });

  /**
   * Download a whisper model.
   * Streams progress back to the renderer via 'speech:model-progress' events
   * so the UI can show a progress bar without polling.
   */
  ipcMain.handle('speech:model-download', async (event, modelId) => {
    const sender = event.sender;

    const onProgress = (downloaded, total) => {
      if (!sender.isDestroyed()) {
        sender.send('speech:model-progress', {
          modelId,
          downloaded,
          total,
          pct: total > 0 ? Math.round((downloaded / total) * 100) : 0,
        });
      }
    };

    await speechService.downloadModel(modelId, onProgress);

    // Notify completion
    if (!sender.isDestroyed()) {
      sender.send('speech:model-progress', { modelId, downloaded: 1, total: 1, pct: 100, done: true });
    }

    return { modelId, downloaded: true };
  });

  ipcMain.handle('speech:model-progress', (_e, modelId) => {
    return speechService.getDownloadProgress(modelId);
  });
}

module.exports = { registerSpeechIpc };
