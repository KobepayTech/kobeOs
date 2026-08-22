import { useState, type ReactNode } from 'react';
import { Monitor, Smartphone, Save, Check, Loader2, Eye } from 'lucide-react';
import { DevicePreviewFrame } from './DevicePreviewFrame';

/**
 * Reusable site-builder shell shared by every module (ERP shop, property,
 * hotel, cargo…). Same architecture everywhere: a left settings sidebar
 * (grouped, declarative fields) + a live, genuinely-responsive preview in an
 * iframe with a Desktop/Mobile toggle + a Save action.
 *
 * A module supplies three things: its field groups, its settings object, and a
 * renderPreview() that draws its own public site from those settings. The
 * framework owns the chrome, the responsive preview, and the save flow.
 */

export type SiteFieldType = 'text' | 'textarea' | 'color' | 'toggle' | 'select';

export interface SiteField {
  key: string;
  label: string;
  type: SiteFieldType;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  /** Show this field only when another boolean field is on. */
  showWhen?: string;
}

export interface SiteSection {
  title: string;
  fields: SiteField[];
}

export function SiteBuilder<T extends Record<string, unknown>>({
  title,
  subtitle,
  sections,
  value,
  onChange,
  onSave,
  saving,
  saved,
  renderPreview,
}: {
  title: string;
  subtitle?: string;
  sections: SiteSection[];
  value: T;
  onChange: (next: T) => void;
  onSave: () => void;
  saving?: boolean;
  saved?: boolean;
  renderPreview: (v: T) => ReactNode;
}) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });

  return (
    <div className="flex h-full bg-[#0d0d1a] text-white/90 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 shrink-0 bg-[#111118] border-r border-white/[0.06] flex flex-col">
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <div className="text-sm font-semibold text-white/90">{title}</div>
          {subtitle && <div className="text-[10px] text-white/40 mt-0.5">{subtitle}</div>}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {sections.map((sec) => (
            <div key={sec.title}>
              <div className="text-[10px] uppercase font-bold text-white/40 tracking-wider mb-2">{sec.title}</div>
              <div className="space-y-2.5">
                {sec.fields
                  .filter((f) => !f.showWhen || !!value[f.showWhen])
                  .map((f) => (
                    <FieldControl key={f.key} field={f} value={value[f.key]} onChange={(v) => set(f.key, v)} />
                  ))}
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-white/[0.06]">
          <button
            onClick={onSave}
            disabled={saving}
            className="w-full h-9 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save & publish'}
          </button>
        </div>
      </aside>

      {/* Preview */}
      <div className="flex-1 flex flex-col bg-[#0a0a1a] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-[#111118]">
          <span className="text-xs font-medium text-white/70 inline-flex items-center gap-2"><Eye className="w-4 h-4 text-white/50" /> Live preview</span>
          <div className="flex rounded-md bg-white/[0.04] border border-white/[0.06] overflow-hidden">
            <button onClick={() => setDevice('desktop')} title="Desktop" className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium ${device === 'desktop' ? 'bg-violet-600 text-white' : 'text-white/50 hover:text-white/80'}`}>
              <Monitor className="w-3 h-3" /> Desktop
            </button>
            <button onClick={() => setDevice('mobile')} title="Mobile (390px)" className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium ${device === 'mobile' ? 'bg-violet-600 text-white' : 'text-white/50 hover:text-white/80'}`}>
              <Smartphone className="w-3 h-3" /> Mobile
            </button>
          </div>
        </div>
        <div className={`flex-1 min-h-0 overflow-hidden ${device === 'mobile' ? 'bg-[#0a0a1a] px-2 py-2' : ''}`}>
          <DevicePreviewFrame width={device === 'mobile' ? 390 : '100%'}>
            {renderPreview(value)}
          </DevicePreviewFrame>
        </div>
      </div>
    </div>
  );
}

function FieldControl({ field, value, onChange }: { field: SiteField; value: unknown; onChange: (v: unknown) => void }) {
  const base = 'w-full h-9 px-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:border-blue-400';
  if (field.type === 'toggle') {
    return (
      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-xs text-white/70">{field.label}</span>
        <button
          onClick={() => onChange(!value)}
          className={`w-9 h-5 rounded-full transition-colors relative ${value ? 'bg-blue-600' : 'bg-white/15'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${value ? 'left-[18px]' : 'left-0.5'}`} />
        </button>
      </label>
    );
  }
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-white/50">{field.label}</span>
      <div className="mt-1">
        {field.type === 'textarea' ? (
          <textarea value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} rows={2} placeholder={field.placeholder}
            className="w-full px-2.5 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:border-blue-400" />
        ) : field.type === 'color' ? (
          <div className="flex items-center gap-2">
            <input type="color" value={String(value ?? '#000000')} onChange={(e) => onChange(e.target.value)} className="w-9 h-9 rounded cursor-pointer bg-transparent" />
            <input value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className={base} placeholder="#c8102e" />
          </div>
        ) : field.type === 'select' ? (
          <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className={base}>
            {(field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <input value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} className={base} />
        )}
      </div>
    </label>
  );
}
