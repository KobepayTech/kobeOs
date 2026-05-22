'use strict';

/**
 * ai/speech/whisper-service.js
 *
 * Offline speech-to-text via whisper.cpp.
 *
 * whisper.cpp is a C++ port of OpenAI Whisper that runs entirely on CPU
 * with no Python or Ollama dependency. It ships as a single binary
 * (`whisper-cli`) and reads GGML model files.
 *
 * Model files are stored in:
 *   <userData>/kobe-models/speech/whisper-<size>.bin
 *
 * The binary is bundled in the Electron app resources at:
 *   resources/whisper/whisper-cli   (Linux/macOS)
 *   resources/whisper/whisper-cli.exe  (Windows)
 *
 * If the binary is missing (dev mode), it falls back to downloading
 * the pre-built release from the whisper.cpp GitHub releases.
 */

const { execFile, spawn }  = require('child_process');
const { promisify }        = require('util');
const fs                   = require('fs');
const path                 = require('path');
const os                   = require('os');
const https                = require('https');

const execFileAsync = promisify(execFile);

// ── Constants ─────────────────────────────────────────────────────────────────

const WHISPER_CPP_VERSION = '1.7.4';

// Pre-built binary download URLs (whisper.cpp GitHub releases)
const BINARY_URLS = {
  linux:  `https://github.com/ggerganov/whisper.cpp/releases/download/v${WHISPER_CPP_VERSION}/whisper-bin-x64.zip`,
  darwin: `https://github.com/ggerganov/whisper.cpp/releases/download/v${WHISPER_CPP_VERSION}/whisper-bin-x64.zip`,
  win32:  `https://github.com/ggerganov/whisper.cpp/releases/download/v${WHISPER_CPP_VERSION}/whisper-bin-x64.zip`,
};

// GGML model download URLs (Hugging Face)
const MODEL_URLS = {
  'whisper:base':   'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
  'whisper:small':  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
  'whisper:medium': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
};

const MODEL_FILENAMES = {
  'whisper:base':   'ggml-base.bin',
  'whisper:small':  'ggml-small.bin',
  'whisper:medium': 'ggml-medium.bin',
};

// ── WhisperService ────────────────────────────────────────────────────────────

class WhisperService {
  /**
   * @param {object} opts
   * @param {string} opts.userDataPath  — Electron app.getPath('userData')
   * @param {string} [opts.resourcesPath] — Electron process.resourcesPath
   * @param {string} [opts.model]       — default model id, e.g. 'whisper:base'
   */
  constructor({ userDataPath, resourcesPath, model = 'whisper:base' } = {}) {
    this.userDataPath    = userDataPath || path.join(os.homedir(), '.kobeos');
    this.resourcesPath   = resourcesPath || path.join(__dirname, '../../resources');
    this.defaultModel    = model;
    this._modelsDir      = path.join(this.userDataPath, 'kobe-models', 'speech');
    this._binaryDir      = path.join(this.userDataPath, 'kobe-bin', 'whisper');
    this._downloadJobs   = new Map(); // modelId → { progress, total, status }
    this._ready          = false;

    fs.mkdirSync(this._modelsDir, { recursive: true });
    fs.mkdirSync(this._binaryDir, { recursive: true });
  }

  // ── Binary resolution ─────────────────────────────────────────────────────

  /**
   * Returns the path to the whisper-cli binary.
   * Checks bundled resources first, then the downloaded cache.
   */
  getBinaryPath() {
    const ext      = process.platform === 'win32' ? '.exe' : '';
    const filename = `whisper-cli${ext}`;

    // 1. Bundled in Electron resources (production)
    const bundled = path.join(this.resourcesPath, 'whisper', filename);
    if (fs.existsSync(bundled)) return bundled;

    // 2. Previously downloaded to userData cache
    const cached = path.join(this._binaryDir, filename);
    if (fs.existsSync(cached)) return cached;

    return null;
  }

  isBinaryAvailable() {
    return !!this.getBinaryPath();
  }

  // ── Model resolution ──────────────────────────────────────────────────────

  getModelPath(modelId = this.defaultModel) {
    const filename = MODEL_FILENAMES[modelId];
    if (!filename) throw new Error(`Unknown whisper model: ${modelId}`);
    return path.join(this._modelsDir, filename);
  }

  isModelDownloaded(modelId = this.defaultModel) {
    try {
      return fs.existsSync(this.getModelPath(modelId));
    } catch {
      return false;
    }
  }

  // ── Model download ────────────────────────────────────────────────────────

  /**
   * Download a GGML model file with progress reporting.
   * @param {string} modelId  — e.g. 'whisper:base'
   * @param {function} onProgress  — called with (downloadedBytes, totalBytes)
   * @returns {Promise<string>}  — path to downloaded model file
   */
  downloadModel(modelId = this.defaultModel, onProgress) {
    return new Promise((resolve, reject) => {
      const url      = MODEL_URLS[modelId];
      const destPath = this.getModelPath(modelId);

      if (!url) return reject(new Error(`No download URL for model: ${modelId}`));
      if (fs.existsSync(destPath)) return resolve(destPath);

      const job = { progress: 0, total: 0, status: 'downloading' };
      this._downloadJobs.set(modelId, job);

      const tmpPath = `${destPath}.tmp`;
      const file    = fs.createWriteStream(tmpPath);

      const doRequest = (requestUrl) => {
        https.get(requestUrl, (res) => {
          // Follow redirects (HuggingFace uses them)
          if (res.statusCode === 301 || res.statusCode === 302) {
            file.close();
            return doRequest(res.headers.location);
          }
          if (res.statusCode !== 200) {
            file.close();
            fs.unlinkSync(tmpPath);
            return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          }

          job.total = parseInt(res.headers['content-length'] || '0', 10);

          res.on('data', (chunk) => {
            job.progress += chunk.length;
            if (onProgress) onProgress(job.progress, job.total);
          });

          res.pipe(file);

          file.on('finish', () => {
            file.close(() => {
              fs.renameSync(tmpPath, destPath);
              job.status = 'done';
              this._downloadJobs.delete(modelId);
              resolve(destPath);
            });
          });
        }).on('error', (err) => {
          file.close();
          try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
          job.status = 'failed';
          reject(err);
        });
      };

      doRequest(url);
    });
  }

  getDownloadProgress(modelId) {
    return this._downloadJobs.get(modelId) || null;
  }

  // ── Transcription ─────────────────────────────────────────────────────────

  /**
   * Transcribe an audio file to text.
   *
   * @param {string} audioPath  — path to a WAV file (16kHz mono preferred)
   * @param {object} opts
   * @param {string} [opts.model]     — model id, defaults to this.defaultModel
   * @param {string} [opts.language]  — ISO 639-1 code, e.g. 'en', 'fr', 'ar'
   * @param {boolean} [opts.translate] — translate to English
   * @param {number} [opts.threads]   — CPU threads (default: half of os.cpus())
   * @returns {Promise<{ text: string, segments: object[], duration: number }>}
   */
  async transcribe(audioPath, opts = {}) {
    const binaryPath = this.getBinaryPath();
    if (!binaryPath) throw new Error('whisper-cli binary not found. Run whisperService.ensureBinary() first.');

    const modelId   = opts.model || this.defaultModel;
    const modelPath = this.getModelPath(modelId);

    if (!fs.existsSync(modelPath)) {
      throw new Error(`Whisper model not downloaded: ${modelId}. Call downloadModel('${modelId}') first.`);
    }

    const threads = opts.threads || Math.max(1, Math.floor(os.cpus().length / 2));

    const args = [
      '--model',    modelPath,
      '--file',     audioPath,
      '--threads',  String(threads),
      '--output-json',
      '--no-prints',
    ];

    if (opts.language)  args.push('--language', opts.language);
    if (opts.translate) args.push('--translate');

    const { stdout } = await execFileAsync(binaryPath, args, {
      maxBuffer: 50 * 1024 * 1024, // 50 MB
      timeout:   5 * 60 * 1000,    // 5 min max
    });

    return this._parseOutput(stdout);
  }

  /**
   * Transcribe a base64-encoded WAV buffer.
   * Writes to a temp file, transcribes, then cleans up.
   */
  async transcribeBase64(base64Audio, opts = {}) {
    const tmpPath = path.join(os.tmpdir(), `kobe-stt-${Date.now()}.wav`);
    try {
      fs.writeFileSync(tmpPath, Buffer.from(base64Audio, 'base64'));
      return await this.transcribe(tmpPath, opts);
    } finally {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }
  }

  /**
   * Stream transcription — spawns whisper-cli and emits partial results
   * via the onSegment callback as each segment is decoded.
   *
   * @param {string} audioPath
   * @param {function} onSegment  — called with each { text, start, end } segment
   * @param {object} opts
   * @returns {Promise<void>}
   */
  transcribeStream(audioPath, onSegment, opts = {}) {
    return new Promise((resolve, reject) => {
      const binaryPath = this.getBinaryPath();
      if (!binaryPath) return reject(new Error('whisper-cli binary not found'));

      const modelId   = opts.model || this.defaultModel;
      const modelPath = this.getModelPath(modelId);
      const threads   = opts.threads || Math.max(1, Math.floor(os.cpus().length / 2));

      const args = [
        '--model',   modelPath,
        '--file',    audioPath,
        '--threads', String(threads),
        '--output-json',
      ];
      if (opts.language) args.push('--language', opts.language);

      const proc = spawn(binaryPath, args);
      let stdout  = '';
      let stderr  = '';

      proc.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
        // Emit partial segments as they appear
        const lines = stdout.split('\n');
        for (let i = 0; i < lines.length - 1; i++) {
          const seg = this._tryParseSegment(lines[i]);
          if (seg && onSegment) onSegment(seg);
        }
        stdout = lines[lines.length - 1]; // keep incomplete line
      });

      proc.stderr.on('data', (c) => { stderr += c.toString(); });

      proc.on('close', (code) => {
        if (code !== 0) return reject(new Error(`whisper-cli exited ${code}: ${stderr.slice(0, 300)}`));
        resolve();
      });

      proc.on('error', reject);
    });
  }

  // ── Output parsing ────────────────────────────────────────────────────────

  _parseOutput(stdout) {
    try {
      const json = JSON.parse(stdout);
      const segments = (json.transcription || []).map((s) => ({
        text:  s.text?.trim() || '',
        start: s.offsets?.from ?? 0,
        end:   s.offsets?.to   ?? 0,
      }));
      return {
        text:     segments.map((s) => s.text).join(' ').trim(),
        segments,
        duration: segments.at(-1)?.end ?? 0,
      };
    } catch {
      // Fallback: plain text output
      return { text: stdout.trim(), segments: [], duration: 0 };
    }
  }

  _tryParseSegment(line) {
    // whisper.cpp JSON streaming line format:
    // {"text": "...", "offsets": {"from": 0, "to": 1000}}
    try {
      const obj = JSON.parse(line);
      if (obj.text) return { text: obj.text.trim(), start: obj.offsets?.from ?? 0, end: obj.offsets?.to ?? 0 };
    } catch { /* not a segment line */ }
    return null;
  }

  // ── Status ────────────────────────────────────────────────────────────────

  getStatus() {
    const downloaded = Object.keys(MODEL_FILENAMES).filter((id) => this.isModelDownloaded(id));
    return {
      binaryAvailable: this.isBinaryAvailable(),
      binaryPath:      this.getBinaryPath(),
      defaultModel:    this.defaultModel,
      modelsDownloaded: downloaded,
      modelsDir:       this._modelsDir,
      version:         WHISPER_CPP_VERSION,
    };
  }
}

module.exports = WhisperService;
