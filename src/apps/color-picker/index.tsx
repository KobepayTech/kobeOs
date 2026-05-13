import { useState } from 'react';
import {
  Copy,
  Check,
  Plus,
  Trash2,
  Palette,
} from 'lucide-react';

interface HSLA {
  h: number;
  s: number;
  l: number;
  a: number;
}

function hslaToString({ h, s, l, a }: HSLA): string {
  return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${a.toFixed(2)})`;
}

function hslaToHex({ h, s, l, a: alpha }: HSLA): string {
  const c = (1 - Math.abs(2 * (l / 100) - 1)) * (s / 100);
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l / 100 - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toHex = (n: number) => {
    const val = Math.round((n + m) * 255);
    return val.toString(16).padStart(2, '0');
  };
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  if (alpha < 1) {
    const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, '0');
    return hex + alphaHex;
  }
  return hex;
}

function hexToHsla(hex: string): HSLA {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  let a = 1;
  if (hex.length === 8) {
    a = parseInt(hex.slice(6, 8), 16) / 255;
    hex = hex.slice(0, 6);
  }
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100), a };
}

function hslaToRgb({ h, s, l }: HSLA): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * (l / 100) - 1)) * (s / 100);
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l / 100 - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function getContrastRatio(color: HSLA): number {
  const { r, g, b } = hslaToRgb(color);
  const luminance = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const l1 = 0.2126 * luminance(r) + 0.7152 * luminance(g) + 0.0722 * luminance(b);
  const l2 = 1; // white
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function harmonies(base: HSLA): { complementary: HSLA; triadic: HSLA[]; analogous: HSLA[] } {
  const comp: HSLA = { ...base, h: (base.h + 180) % 360 };
  const tri1: HSLA = { ...base, h: (base.h + 120) % 360 };
  const tri2: HSLA = { ...base, h: (base.h + 240) % 360 };
  const ana1: HSLA = { ...base, h: (base.h + 30) % 360 };
  const ana2: HSLA = { ...base, h: (base.h + 330) % 360 };
  return { complementary: comp, triadic: [base, tri1, tri2], analogous: [ana2, base, ana1] };
}

function ColorSwatch({ c, label, onPick }: { c: HSLA; label?: string; onPick: (c: HSLA) => void }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="w-12 h-12 rounded-lg border border-white/10 cursor-pointer shadow-sm"
        style={{ background: hslaToString(c) }}
        onClick={() => onPick(c)}
        title={hslaToHex(c)}
      />
      {label && <span className="text-[10px] text-os-text-muted">{label}</span>}
    </div>
  );
}

export default function ColorPicker() {
  const [color, setColor] = useState<HSLA>({ h: 210, s: 80, l: 50, a: 1 });
  const [palette, setPalette] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('color-picker-palette');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const hex = hslaToHex(color);
  const rgb = hslaToRgb(color);
  const hslStr = `hsl(${Math.round(color.h)}, ${Math.round(color.s)}%, ${Math.round(color.l)}%)`;
  const rgbStr = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

  const contrast = getContrastRatio(color);
  const wcag = contrast >= 7 ? 'AAA' : contrast >= 4.5 ? 'AA' : contrast >= 3 ? 'AA Large' : 'Fail';

  const { complementary, triadic, analogous } = harmonies(color);

  const savePalette = (p: string[]) => {
    setPalette(p);
    localStorage.setItem('color-picker-palette', JSON.stringify(p));
  };

  const addToPalette = () => {
    if (palette.length >= 10) return;
    savePalette([...palette, hex]);
  };

  const removeFromPalette = (idx: number) => {
    savePalette(palette.filter((_, i) => i !== idx));
  };

  const copy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const setFromHex = (val: string) => {
    if (/^#[0-9a-fA-F]{3,8}$/.test(val)) {
      setColor(hexToHsla(val));
    }
  };

  const setFromRgb = (r: number, g: number, b: number) => {
    const rf = r / 255, gf = g / 255, bf = b / 255;
    const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case rf: h = ((gf - bf) / d + (gf < bf ? 6 : 0)) * 60; break;
        case gf: h = ((bf - rf) / d + 2) * 60; break;
        case bf: h = ((rf - gf) / d + 4) * 60; break;
      }
    }
    setColor({ h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100), a: color.a });
  };

  return (
    <div className="flex h-full bg-[#0f172a] text-os-text-primary overflow-hidden">
      {/* Left: Picker */}
      <div className="flex-1 flex flex-col p-4 gap-4 overflow-auto">
        {/* Gradient area */}
        <div
          className="relative w-full h-48 rounded-xl border border-white/10 cursor-crosshair"
          style={{
            background: `linear-gradient(to right, #fff 0%, hsl(${color.h}, 100%, 50%) 100%), linear-gradient(to bottom, transparent 0%, #000 100%)`,
          }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = 1 - (e.clientY - rect.top) / rect.height;
            const s = x * 100;
            const l = (y * 50) + (1 - x) * 50;
            setColor({ ...color, s: Math.min(100, Math.max(0, s)), l: Math.min(100, Math.max(0, l)) });
          }}
        >
          <div
            className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md"
            style={{
              left: `${(color.s / 100) * 100}%`,
              bottom: `${((color.l - (1 - color.s / 100) * 50) / 50) * 100}%`,
              transform: 'translate(-50%, 50%)',
              background: hslaToString(color),
            }}
          />
        </div>

        {/* Sliders */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs w-12 text-os-text-muted">Hue</span>
            <input
              type="range" min="0" max="360" value={color.h}
              className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
              style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
              onChange={(e) => setColor({ ...color, h: Number(e.target.value) })}
            />
            <span className="text-xs w-10 text-right">{color.h}°</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs w-12 text-os-text-muted">Sat</span>
            <input
              type="range" min="0" max="100" value={color.s}
              className="flex-1 h-2 rounded-full appearance-none cursor-pointer bg-white/20"
              onChange={(e) => setColor({ ...color, s: Number(e.target.value) })}
            />
            <span className="text-xs w-10 text-right">{color.s}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs w-12 text-os-text-muted">Light</span>
            <input
              type="range" min="0" max="100" value={color.l}
              className="flex-1 h-2 rounded-full appearance-none cursor-pointer bg-white/20"
              onChange={(e) => setColor({ ...color, l: Number(e.target.value) })}
            />
            <span className="text-xs w-10 text-right">{color.l}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs w-12 text-os-text-muted">Alpha</span>
            <input
              type="range" min="0" max="1" step="0.01" value={color.a}
              className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
              style={{ background: 'linear-gradient(to right, transparent, #fff)' }}
              onChange={(e) => setColor({ ...color, a: Number(e.target.value) })}
            />
            <span className="text-xs w-10 text-right">{Math.round(color.a * 100)}%</span>
          </div>
        </div>

        {/* Preview */}
        <div className="flex gap-3 items-center">
          <div
            className="w-20 h-20 rounded-xl border border-white/10 shadow-lg"
            style={{ background: hslaToString(color) }}
          />
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex items-center gap-2 text-os-text-muted">
              <span className="w-16">White text</span>
              <div className="px-2 py-0.5 rounded" style={{ background: hslaToString(color), color: '#fff' }}>Aa</div>
            </div>
            <div className="flex items-center gap-2 text-os-text-muted">
              <span className="w-16">Black text</span>
              <div className="px-2 py-0.5 rounded" style={{ background: hslaToString(color), color: '#000' }}>Aa</div>
            </div>
            <div className="flex items-center gap-2 text-os-text-muted">
              <span className="w-16">Contrast</span>
              <span className={`font-mono ${contrast >= 4.5 ? 'text-emerald-400' : 'text-red-400'}`}>
                {contrast.toFixed(2)} ({wcag})
              </span>
            </div>
          </div>
        </div>

        {/* Values */}
        <div className="space-y-2">
          {[
            { label: 'HEX', value: hex, setter: setFromHex },
            { label: 'RGB', value: rgbStr, setter: (v: string) => {
              const m = v.match(/\d+/g);
              if (m) setFromRgb(Number(m[0]), Number(m[1]), Number(m[2]));
            }},
            { label: 'HSL', value: hslStr, setter: (v: string) => {
              const m = v.match(/\d+/g);
              if (m) setColor({ h: Number(m[0]), s: Number(m[1]), l: Number(m[2]), a: color.a });
            }},
          ].map(({ label, value, setter }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-xs w-10 text-os-text-muted">{label}</span>
              <input
                className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs font-mono outline-none focus:border-os-accent"
                value={value}
                onChange={(e) => setter(e.target.value)}
              />
              <button
                onClick={() => copy(value, label)}
                className="p-1 rounded hover:bg-white/10"
              >
                {copiedField === label ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))}
        </div>

        {/* Harmonies */}
        <div className="space-y-2">
          <div className="text-xs text-os-text-muted uppercase tracking-wider">Harmonies</div>
          <div className="flex gap-2">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-os-text-muted">Comp</span>
              <ColorSwatch c={complementary} onPick={setColor} />
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-os-text-muted">Triadic</span>
              <div className="flex gap-1">
                {triadic.map((c, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded border border-white/10 cursor-pointer"
                    style={{ background: hslaToString(c) }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-os-text-muted">Analog</span>
              <div className="flex gap-1">
                {analogous.map((c, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded border border-white/10 cursor-pointer"
                    style={{ background: hslaToString(c) }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Palette */}
      <div className="w-44 border-l border-white/[0.08] flex flex-col p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-os-text-muted uppercase flex items-center gap-1">
            <Palette className="w-3 h-3" /> Palette
          </div>
          <button onClick={addToPalette} disabled={palette.length >= 10} className="p-1 rounded hover:bg-white/10 disabled:opacity-30">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex-1 space-y-2 overflow-auto">
          {palette.length === 0 && (
            <div className="text-[11px] text-os-text-muted text-center py-4">No saved colors</div>
          )}
          {palette.map((c, i) => (
            <div key={i} className="flex items-center gap-2 group">
              <div
                className="w-8 h-8 rounded border border-white/10 cursor-pointer flex-shrink-0"
                style={{ background: c }}
                onClick={() => setFromHex(c)}
              />
              <span className="text-[10px] font-mono text-os-text-muted flex-1 truncate">{c}</span>
              <button
                onClick={() => removeFromPalette(i)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10"
              >
                <Trash2 className="w-3 h-3 text-red-400" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
