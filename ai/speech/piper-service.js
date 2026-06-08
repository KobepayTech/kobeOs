'use strict';

/**
 * ai/speech/piper-service.js
 *
 * Offline text-to-speech via Piper (https://github.com/rhasspy/piper, MIT).
 *
 * Piper is a fast neural TTS that runs on CPU with no Python or GPU
 * dependency. It ships as a single binary (`piper`) and reads ONNX voice
 * models. We mirror the whisper-service.js layout so the OS-side
 * model-manager + IPC bridge can treat STT and TTS identically.
 *
 * Layout on disk (resolved at runtime):
 *   <userData>/kobe-bin/piper/piper            binary
 *   <userData>/kobe-models/speech/<voice>.onnx voice weights
 *   <userData>/kobe-models/speech/<voice>.onnx.json voice metadata
 *
 * Bundled location (Electron production):
 *   resources/piper/piper                       binary
 *
 * If the binary is missing the service downloads the prebuilt release
 * from the upstream GitHub. Voice models come from rhasspy/piper-voices
 * on HuggingFace.
 */

const { execFile, spawn } = require('child_process');
const { promisify }       = require('util');
const fs                  = require('fs');
const path                = require('path');
const os                  = require('os');
const https               = require('https');

const execFileAsync = promisify(execFile);

// ── Constants ────────────────────────────────────────────────────────────────

const PIPER_VERSION = '2023.11.14-2';

const BINARY_URLS = {
  linux:  `https://github.com/rhasspy/piper/releases/download/${PIPER_VERSION}/piper_linux_x86_64.tar.gz`,
  darwin: `https://github.com/rhasspy/piper/releases/download/${PIPER_VERSION}/piper_macos_x64.tar.gz`,
  win32:  `https://github.com/rhasspy/piper/releases/download/${PIPER_VERSION}/piper_windows_amd64.zip`,
};

// Pre-curated voice set — small enough to ship as on-demand downloads.
// IDs follow the upstream pattern: <lang>-<voice>-<quality>.
const VOICES = {
  'en_US-amy-medium': {
    onnx:     'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx',
    metadata: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json',
    sizeBytes: 63_000_000,
    label: 'Amy (US English, medium)',
  },
  'en_US-libritts-high': {
    onnx:     'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts/high/en_US-libritts-high.onnx',
    metadata: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts/high/en_US-libritts-high.onnx.json',
    sizeBytes: 120_000_000,
    label: 'LibriTTS (US English, high)',
  },
  'en_GB-alba-medium': {
    onnx:     'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alba/medium/en_GB-alba-medium.onnx',
    metadata: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alba/medium/en_GB-alba-medium.onnx.json',
    sizeBytes: 63_000_000,
    label: 'Alba (UK English, medium)',
  },
};

// ── PiperService ─────────────────────────────────────────────────────────────

class PiperService {
  /**
   * @param {object} opts
   * @param {string} opts.userDataPath  — Electron app.getPath('userData')
   * @param {string} [opts.resourcesPath]
   * @param {string} [opts.defaultVoice]
   */
  constructor({ userDataPath, resourcesPath, defaultVoice = 'en_US-amy-medium' } = {}) {
    this.userDataPath  = userDataPath || path.join(os.homedir(), '.kobeos');
    this.resourcesPath = resourcesPath || path.join(__dirname, '../../resources');
    this.defaultVoice  = defaultVoice;
    this._modelsDir    = path.join(this.userDataPath, 'kobe-models', 'speech');
    this._binaryDir    = path.join(this.userDataPath, 'kobe-bin', 'piper');
    this._downloadJobs = new Map();

    fs.mkdirSync(this._modelsDir, { recursive: true });
    fs.mkdirSync(this._binaryDir, { recursive: true });
  }

  listVoices() {
    return Object.entries(VOICES).map(([id, v]) => ({
      id,
      label: v.label,
      sizeBytes: v.sizeBytes,
      downloaded: this.isVoiceDownloaded(id),
    }));
  }

  // ── Binary resolution ──────────────────────────────────────────────────────

  getBinaryPath() {
    const ext = process.platform === 'win32' ? '.exe' : '';
    const filename = `piper${ext}`;

    const bundled = path.join(this.resourcesPath, 'piper', filename);
    if (fs.existsSync(bundled)) return bundled;

    const cached = path.join(this._binaryDir, filename);
    if (fs.existsSync(cached)) return cached;

    return null;
  }

  isBinaryAvailable() { return !!this.getBinaryPath(); }

  // ── Voice model resolution ─────────────────────────────────────────────────

  getVoicePath(voiceId = this.defaultVoice) {
    if (!VOICES[voiceId]) throw new Error(`Unknown piper voice: ${voiceId}`);
    return path.join(this._modelsDir, `${voiceId}.onnx`);
  }

  isVoiceDownloaded(voiceId = this.defaultVoice) {
    try {
      return fs.existsSync(this.getVoicePath(voiceId))
          && fs.existsSync(`${this.getVoicePath(voiceId)}.json`);
    } catch { return false; }
  }

  // ── Download ───────────────────────────────────────────────────────────────

  async downloadVoice(voiceId = this.defaultVoice, onProgress) {
    const voice = VOICES[voiceId];
    if (!voice) throw new Error(`Unknown piper voice: ${voiceId}`);

    const onnxPath = this.getVoicePath(voiceId);
    const jsonPath = `${onnxPath}.json`;

    if (fs.existsSync(onnxPath) && fs.existsSync(jsonPath)) return onnxPath;

    await this._downloadFile(voice.metadata, jsonPath);
    await this._downloadFile(voice.onnx, onnxPath, onProgress);
    return onnxPath;
  }

  _downloadFile(url, destPath, onProgress) {
    return new Promise((resolve, reject) => {
      const tmpPath = `${destPath}.tmp`;
      const file = fs.createWriteStream(tmpPath);
      let received = 0;
      let total = 0;

      const doRequest = (requestUrl) => {
        https.get(requestUrl, (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            file.close();
            return doRequest(res.headers.location);
          }
          if (res.statusCode !== 200) {
            file.close();
            try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
            return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          }
          total = parseInt(res.headers['content-length'] || '0', 10);
          res.on('data', (chunk) => {
            received += chunk.length;
            if (onProgress) onProgress(received, total);
          });
          res.pipe(file);
          file.on('finish', () => {
            file.close(() => {
              fs.renameSync(tmpPath, destPath);
              resolve(destPath);
            });
          });
        }).on('error', (err) => {
          file.close();
          try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
          reject(err);
        });
      };

      doRequest(url);
    });
  }

  // ── Synthesis ──────────────────────────────────────────────────────────────

  /**
   * Synthesize speech to a WAV file on disk.
   * @param {string} text         — UTF-8 text to speak
   * @param {object} [opts]
   * @param {string} [opts.voice] — voice id
   * @param {string} [opts.outputPath]  — defaults to a tmp file
   * @returns {Promise<string>}   — path to the WAV file
   */
  async synthesize(text, opts = {}) {
    const binaryPath = this.getBinaryPath();
    if (!binaryPath) throw new Error('piper binary not found. Run ensureBinary() first.');

    const voiceId = opts.voice || this.defaultVoice;
    const voicePath = this.getVoicePath(voiceId);
    if (!fs.existsSync(voicePath)) {
      throw new Error(`Voice not downloaded: ${voiceId}. Call downloadVoice('${voiceId}') first.`);
    }

    const outputPath = opts.outputPath || path.join(os.tmpdir(), `kobe-tts-${Date.now()}.wav`);

    await new Promise((resolve, reject) => {
      const proc = spawn(binaryPath, [
        '--model', voicePath,
        '--output_file', outputPath,
      ]);
      let stderr = '';
      proc.stderr.on('data', (c) => { stderr += c.toString(); });
      proc.on('close', (code) => {
        if (code !== 0) return reject(new Error(`piper exited ${code}: ${stderr.slice(0, 300)}`));
        resolve();
      });
      proc.on('error', reject);
      proc.stdin.write(text);
      proc.stdin.end();
    });

    return outputPath;
  }

  /**
   * Synthesize speech, return the raw WAV bytes as a Buffer.
   */
  async synthesizeBuffer(text, opts = {}) {
    const wavPath = await this.synthesize(text, opts);
    try {
      return fs.readFileSync(wavPath);
    } finally {
      try { fs.unlinkSync(wavPath); } catch { /* ignore */ }
    }
  }
}

module.exports = { PiperService, VOICES, PIPER_VERSION };
