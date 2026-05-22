'use strict';

/**
 * ai/speech/speech-service.js
 *
 * Speech-to-Text (STT) and Text-to-Speech (TTS) for KobeOS.
 *
 * STT:  whisper.cpp via WhisperService (offline, no Ollama dependency).
 *       Falls back to the renderer's Web Speech API for live microphone input.
 *
 * TTS:  Renderer's SpeechSynthesis API (Web Speech).
 *       Falls back to espeak (Linux) or say (macOS) when no renderer is attached.
 */

const { execSync } = require('child_process');
const WhisperService = require('./whisper-service');

class SpeechService {
  /**
   * @param {object} opts
   * @param {string} opts.userDataPath     — Electron app.getPath('userData')
   * @param {string} [opts.resourcesPath]  — Electron process.resourcesPath
   * @param {string} [opts.whisperModel]   — default whisper model id
   */
  constructor({ userDataPath, resourcesPath, whisperModel = 'whisper:base' } = {}) {
    this.whisper      = new WhisperService({ userDataPath, resourcesPath, model: whisperModel });
    this._webContents = null;
    this._listening   = false;
  }

  attachWindow(webContents) {
    this._webContents = webContents;
  }

  // ── Text-to-Speech ────────────────────────────────────────────────────────

  speak(text, options = {}) {
    if (this._webContents && !this._webContents.isDestroyed()) {
      this._webContents.send('speech:speak', { text, ...options });
      return { method: 'web-speech', text };
    }
    try {
      if (process.platform === 'linux')  execSync(`espeak "${text.replace(/"/g, '')}" 2>/dev/null`);
      if (process.platform === 'darwin') execSync(`say "${text.replace(/"/g, '')}"`);
    } catch { /* ignore */ }
    return { method: 'system', text };
  }

  stopSpeaking() {
    if (this._webContents && !this._webContents.isDestroyed()) {
      this._webContents.send('speech:stop');
    }
  }

  // ── Live microphone STT (renderer Web Speech API) ─────────────────────────

  startListening(options = {}) {
    if (this._webContents && !this._webContents.isDestroyed()) {
      this._listening = true;
      this._webContents.send('speech:listen', options);
      return { listening: true, method: 'web-speech' };
    }
    return { listening: false, reason: 'No renderer attached' };
  }

  stopListening() {
    this._listening = false;
    if (this._webContents && !this._webContents.isDestroyed()) {
      this._webContents.send('speech:stop-listen');
    }
    return { listening: false };
  }

  // ── File / buffer transcription (whisper.cpp) ─────────────────────────────

  /**
   * Transcribe a WAV file path.
   * @param {string} audioPath
   * @param {object} opts  — { model, language, translate, threads }
   */
  async transcribeFile(audioPath, opts = {}) {
    return this.whisper.transcribe(audioPath, opts);
  }

  /**
   * Transcribe a base64-encoded WAV buffer.
   * Used by the IPC handler when the renderer captures audio.
   * @param {string} base64Audio
   * @param {object} opts
   */
  async transcribeBase64(base64Audio, opts = {}) {
    return this.whisper.transcribeBase64(base64Audio, opts);
  }

  // ── Model management ──────────────────────────────────────────────────────

  isModelReady(modelId) {
    return this.whisper.isModelDownloaded(modelId);
  }

  async downloadModel(modelId, onProgress) {
    return this.whisper.downloadModel(modelId, onProgress);
  }

  getDownloadProgress(modelId) {
    return this.whisper.getDownloadProgress(modelId);
  }

  // ── Status ────────────────────────────────────────────────────────────────

  getStatus() {
    return {
      listening:   this._listening,
      hasRenderer: !!this._webContents && !this._webContents?.isDestroyed(),
      whisper:     this.whisper.getStatus(),
      platform:    process.platform,
    };
  }
}

module.exports = SpeechService;
