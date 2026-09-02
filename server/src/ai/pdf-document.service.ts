import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { inflateSync } from 'node:zlib';
import { OcrService } from '../ocr/ocr.service';

export interface PdfExtractionResult {
  text: string;
  pageCount: number;
  charCount: number;
  method: 'pdftotext' | 'fallback' | 'ocr';
  ocrPages: number;
  warnings: string[];
}

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_TEXT_CHARS = 2_000_000;
const MAX_FALLBACK_STREAMS = 2_000;
const MAX_INFLATED_STREAM = 12 * 1024 * 1024;
const MAX_OCR_PAGES = 15;

@Injectable()
export class PdfDocumentService {
  private readonly logger = new Logger(PdfDocumentService.name);

  constructor(private readonly ocr: OcrService) {}

  async extract(buffer: Buffer): Promise<PdfExtractionResult> {
    if (!buffer?.length) throw new BadRequestException('PDF file is empty');
    if (buffer.length > MAX_PDF_BYTES) throw new BadRequestException('PDF exceeds the 25 MB upload limit');
    if (!buffer.subarray(0, 8).toString('latin1').startsWith('%PDF-')) {
      throw new BadRequestException('The uploaded file is not a valid PDF');
    }

    const warnings: string[] = [];
    const pageCount = this.pageCount(buffer);
    let best = '';
    let method: PdfExtractionResult['method'] = 'fallback';

    try {
      const native = await this.extractWithPoppler(buffer);
      if (native.trim().length > best.trim().length) {
        best = native;
        method = 'pdftotext';
      }
    } catch (error) {
      warnings.push('Native Poppler extraction unavailable; used the built-in PDF parser.');
      this.logger.debug(`pdftotext unavailable/failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      const fallback = this.extractFallback(buffer);
      if (fallback.trim().length > best.trim().length) {
        best = fallback;
        method = 'fallback';
      }
    } catch (error) {
      this.logger.warn(`built-in PDF fallback failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    let ocrPages = 0;
    if (best.replace(/\s+/g, ' ').trim().length < 20) {
      try {
        const ocr = await this.extractScannedPdf(buffer, pageCount);
        if (ocr.text.trim()) {
          best = ocr.text;
          ocrPages = ocr.pages;
          method = 'ocr';
          if (pageCount > MAX_OCR_PAGES) warnings.push(`OCR is limited to the first ${MAX_OCR_PAGES} pages per upload.`);
        }
      } catch (error) {
        warnings.push('This PDF appears image-only and OCR was not available on this server.');
        this.logger.debug(`PDF OCR unavailable/failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const text = this.normalize(best).slice(0, MAX_TEXT_CHARS);
    if (!text.trim()) {
      throw new BadRequestException(
        'No readable text was found in this PDF. If it is a scan, ensure the server image includes Poppler OCR support or upload the page as an image.',
      );
    }
    if (best.length > MAX_TEXT_CHARS) warnings.push('Extracted text was truncated at 2,000,000 characters.');

    return {
      text,
      pageCount,
      charCount: text.length,
      method,
      ocrPages,
      warnings,
    };
  }

  private pageCount(buffer: Buffer): number {
    const source = buffer.toString('latin1');
    const count = source.match(/\/Type\s*\/Page\b/g)?.length || 0;
    return Math.max(1, count);
  }

  private normalize(text: string): string {
    return text
      .split(String.fromCharCode(0)).join('')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{4,}/g, '\n\n\n')
      .trim();
  }

  private async extractWithPoppler(buffer: Buffer): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'kobe-pdf-'));
    const input = join(dir, 'input.pdf');
    const output = join(dir, 'output.txt');
    try {
      await writeFile(input, buffer);
      await this.run('pdftotext', ['-layout', '-enc', 'UTF-8', input, output], 20_000);
      return await readFile(output, 'utf8');
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async extractScannedPdf(buffer: Buffer, pageCount: number): Promise<{ text: string; pages: number }> {
    const dir = await mkdtemp(join(tmpdir(), 'kobe-pdf-ocr-'));
    const input = join(dir, 'input.pdf');
    const prefix = join(dir, 'page');
    const maxPages = Math.min(Math.max(1, pageCount), MAX_OCR_PAGES);
    try {
      await writeFile(input, buffer);
      await this.run('pdftoppm', ['-png', '-r', '144', '-f', '1', '-l', String(maxPages), input, prefix], 45_000);
      const pages = (await readdir(dir))
        .filter((name) => /^page-\d+\.png$/i.test(name))
        .sort((a, b) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0))
        .slice(0, maxPages);
      const chunks: string[] = [];
      for (let i = 0; i < pages.length; i++) {
        const image = await readFile(join(dir, pages[i]));
        const result = await this.ocr.extract(image, 'eng+swa');
        if (result.text.trim()) chunks.push(`--- Page ${i + 1} ---\n${result.text.trim()}`);
      }
      return { text: chunks.join('\n\n'), pages: pages.length };
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private run(command: string, args: string[], timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'], shell: false });
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`${command} timed out`));
      }, timeoutMs);
      child.stderr.on('data', (chunk: Buffer) => {
        if (stderr.length < 8_000) stderr += chunk.toString('utf8');
      });
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`${command} exited ${code}: ${stderr.slice(0, 1_000)}`));
      });
    });
  }

  private extractFallback(buffer: Buffer): string {
    const source = buffer.toString('latin1');
    const decodedStreams: string[] = [];
    const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match: RegExpExecArray | null;
    let seen = 0;
    while ((match = streamRe.exec(source)) && seen < MAX_FALLBACK_STREAMS) {
      seen++;
      const dict = source.slice(Math.max(0, match.index - 900), match.index);
      let data = Buffer.from(match[1], 'latin1');
      try {
        if (/\/Filter\s*(?:\[\s*)?\/FlateDecode\b/.test(dict)) {
          data = inflateSync(data, { maxOutputLength: MAX_INFLATED_STREAM });
        }
      } catch {
        continue;
      }
      if (data.length > MAX_INFLATED_STREAM) continue;
      const text = data.toString('latin1');
      if (/BT[\s\S]*?ET/.test(text) || /begincmap/.test(text)) decodedStreams.push(text);
    }

    const cmap = this.buildCMap(decodedStreams.filter((stream) => /begincmap/.test(stream)));
    const out: string[] = [];
    for (const stream of decodedStreams) {
      if (!/BT[\s\S]*?ET/.test(stream)) continue;
      const blocks = stream.match(/BT[\s\S]*?ET/g) || [];
      for (const block of blocks) {
        const extracted = this.extractTextOperators(block, cmap);
        if (extracted.trim()) out.push(extracted.trim());
      }
      if (out.join('\n').length >= MAX_TEXT_CHARS) break;
    }
    return out.join('\n\n');
  }

  private extractTextOperators(block: string, cmap: Map<string, string>): string {
    const out: string[] = [];
    const tokenRe = /(\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]+>|\[(?:\\.|[^\]])*\])\s*(Tj|TJ|'|")/g;
    let match: RegExpExecArray | null;
    while ((match = tokenRe.exec(block))) {
      const token = match[1];
      const operator = match[2];
      let text = '';
      if (token.startsWith('[')) {
        const inner = token.slice(1, -1);
        const pieces = inner.match(/\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]+>/g) || [];
        text = pieces.map((piece) => this.decodePdfString(piece, cmap)).join('');
      } else {
        text = this.decodePdfString(token, cmap);
      }
      if (text) out.push(text + (operator === "'" || operator === '"' ? '\n' : ''));
    }
    return out.join(' ').replace(/\s+\n/g, '\n');
  }

  private decodePdfString(token: string, cmap: Map<string, string>): string {
    let bytes: Buffer;
    if (token.startsWith('<')) {
      let hex = token.slice(1, -1).replace(/\s+/g, '');
      if (hex.length % 2) hex += '0';
      bytes = Buffer.from(hex, 'hex');
    } else {
      const raw = token.slice(1, -1);
      const values: number[] = [];
      for (let i = 0; i < raw.length; i++) {
        const code = raw.charCodeAt(i) & 0xff;
        if (code !== 0x5c) {
          values.push(code);
          continue;
        }
        const next = raw[++i];
        if (next == null) break;
        const escapes: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12, '(': 40, ')': 41, '\\': 92 };
        if (next in escapes) {
          values.push(escapes[next]);
          continue;
        }
        if (next === '\r' || next === '\n') {
          if (next === '\r' && raw[i + 1] === '\n') i++;
          continue;
        }
        if (/[0-7]/.test(next)) {
          let oct = next;
          for (let n = 0; n < 2 && /[0-7]/.test(raw[i + 1] || ''); n++) oct += raw[++i];
          values.push(parseInt(oct, 8) & 0xff);
          continue;
        }
        values.push(next.charCodeAt(0) & 0xff);
      }
      bytes = Buffer.from(values);
    }

    const mapped = this.decodeWithCMap(bytes, cmap);
    if (mapped) return mapped;
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return this.utf16be(bytes.subarray(2));
    if (bytes.length >= 4 && bytes.length % 2 === 0) {
      let zeroHigh = 0;
      for (let i = 0; i < bytes.length; i += 2) if (bytes[i] === 0) zeroHigh++;
      if (zeroHigh >= bytes.length / 4) return this.utf16be(bytes);
    }
    return this.stripControlCharacters(bytes.toString('latin1'));
  }

  private decodeWithCMap(bytes: Buffer, cmap: Map<string, string>): string {
    if (!cmap.size || !bytes.length) return '';
    const hex = bytes.toString('hex').toUpperCase();
    if (cmap.has(hex)) return cmap.get(hex) || '';
    const widths = [...new Set([...cmap.keys()].map((key) => key.length))]
      .filter((width) => width > 0 && width <= 8)
      .sort((a, b) => b - a);
    for (const width of widths) {
      if (hex.length % width) continue;
      let value = '';
      let ok = true;
      for (let i = 0; i < hex.length; i += width) {
        const mapped = cmap.get(hex.slice(i, i + width));
        if (mapped == null) { ok = false; break; }
        value += mapped;
      }
      if (ok && value) return value;
    }
    return '';
  }

  private buildCMap(streams: string[]): Map<string, string> {
    const map = new Map<string, string>();
    const toUnicode = (hex: string) => {
      const bytes = Buffer.from(hex.replace(/\s+/g, ''), 'hex');
      return bytes.length % 2 === 0 ? this.utf16be(bytes) : bytes.toString('utf8');
    };
    for (const stream of streams) {
      const bfchar = /beginbfchar([\s\S]*?)endbfchar/g;
      let block: RegExpExecArray | null;
      while ((block = bfchar.exec(stream))) {
        const pair = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
        let entry: RegExpExecArray | null;
        while ((entry = pair.exec(block[1]))) map.set(entry[1].toUpperCase(), toUnicode(entry[2]));
      }
      const bfrange = /beginbfrange([\s\S]*?)endbfrange/g;
      while ((block = bfrange.exec(stream))) {
        const scalar = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
        let entry: RegExpExecArray | null;
        while ((entry = scalar.exec(block[1]))) {
          const start = parseInt(entry[1], 16);
          const end = parseInt(entry[2], 16);
          const dst = parseInt(entry[3], 16);
          const width = entry[1].length;
          const dstWidth = entry[3].length;
          for (let value = start; value <= end && value - start < 512; value++) {
            const srcHex = value.toString(16).toUpperCase().padStart(width, '0');
            const dstHex = (dst + value - start).toString(16).toUpperCase().padStart(dstWidth, '0');
            map.set(srcHex, toUnicode(dstHex));
          }
        }
        const arrays = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([^\]]+)\]/g;
        while ((entry = arrays.exec(block[1]))) {
          const start = parseInt(entry[1], 16);
          const end = parseInt(entry[2], 16);
          const width = entry[1].length;
          const targets = [...entry[3].matchAll(/<([0-9A-Fa-f]+)>/g)].map((item) => item[1]);
          for (let value = start; value <= end && value - start < targets.length; value++) {
            map.set(value.toString(16).toUpperCase().padStart(width, '0'), toUnicode(targets[value - start]));
          }
        }
      }
    }
    return map;
  }

  private stripControlCharacters(value: string): string {
    return [...value].filter((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || code >= 32;
    }).join('');
  }

  private utf16be(bytes: Buffer): string {
    const swapped = Buffer.alloc(bytes.length);
    for (let i = 0; i + 1 < bytes.length; i += 2) {
      swapped[i] = bytes[i + 1];
      swapped[i + 1] = bytes[i];
    }
    return swapped.toString('utf16le').replace(/^\uFEFF/, '');
  }
}
