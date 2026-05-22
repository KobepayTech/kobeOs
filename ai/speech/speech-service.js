'use strict';

/**
 * ai/speech/speech-service.js
 *
 * Speech-to-Text (STT) and Text-to-Speech (TTS) for KobeOS.
 *
 * STT: Uses the system's Web Speech API (via renderer IPC) or
 *      Whisper via Ollama when available.
 *
 * TTS: Uses the system's SpeechSynthesis API (via renderer IPC)
 *      or espeak/say on Linux/macOS as a fallback.
 *
 * All speech I/O is routed through the renderer because microphone
 * and audio output require browser APIs. The main process acts as
 * coordinator only.
 */

const { execSync } = require('child_process');

class SpeechService {
  constructor(ollamaBridge) {
    this.ollama   = ollamaBridge;
    this._webContents = null; // set via attachWindow()
    this._listening   = false;
  }

  attachWindow(webContents) {
    this._webContents = webContents;
  }

  // ── Text-to-Speech ────────────────────────────────────────────────────────

  /**
   * Speak text via the renderer's SpeechSynthesis API.
   * Falls back to espeak (Linux) or say (macOS) if no renderer.
   */
  speak(text, options = {}) {
    if (this._webContents && !this._webContents.isDestroyed()) {
      this._webContents.send('speech:speak', { text, ...options });
      return { method: 'web-speech', text };
    }
    // System fallback
    try {
      if (process.platform === 'linux')  execSync(`espeak "${text.replace(/"/g, '')}" 2>/dev/null`);
      if (process.platform === 'darwin') execSync(`say "${text.replace(/"/g, '')}"`);
    } catch { /* ignore */ }
    return { method: 'system', text };
  }

  stop() {
    if (this._webContents && !this._webContents.isDestroyed()) {
      this._webContents.send('speech:stop');
    }
  }

  // ── Speech-to-Text ────────────────────────────────────────────────────────

  /**
   * Start listening via the renderer's Web Speech API.
   * Results are sent back via IPC as 'speech:result' events.
   */
  startListening(options = {}) {
    if (this._webContents && !this._webContents.isDestroyed()) {
      this._listening = true;
      this._webContents.send('speech:listen', options);
      return { listening: true };
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

  /**
   * Transcribe an audio file using Whisper via Ollama (if available).
   * audioBase64: base64-encoded WAV/MP3 data.
   */
  async transcribe(audioBase64, language = 'en') {
    if (!this.ollama) throw new Error('Ollama bridge not configured');
    const available = await this.ollama.isAvailable();
    if (!available) throw new Error('Ollama not running');

    // Whisper via Ollama multimodal endpoint
    return this.ollama.generate('whisper', `Transcribe this audio. Language: ${language}`, {
      images: [audioBase64],
    });
  }

  getStatus() {
    return {
      listening:       this._listening,
      hasRenderer:     !!this._webContents && !this._webContents?.isDestroyed(),
      ollamaAvailable: !!this.ollama,
      platform:        process.platform,
    };
  }
}

module.exports = SpeechService;
