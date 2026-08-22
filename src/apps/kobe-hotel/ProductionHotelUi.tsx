import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { inputClass } from './production-types';

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="mb-3 text-sm font-black">{title}</h2>{children}</section>;
}

export function Field({ label, value, onChange, type = 'text', placeholder = '' }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label className="text-xs font-bold text-slate-700">{label}<input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={inputClass} /></label>;
}

export function Metric({ label, value }: { label: string; value: ReactNode }) {
  return <div className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] font-black uppercase text-slate-400">{label}</div><div className="mt-1 text-lg font-black capitalize">{value}</div></div>;
}

export function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">{text}</div>;
}

export function Status({ value }: { value: string }) {
  const key = value.toLowerCase();
  const tone = key.includes('cancel') || key === 'maintenance'
    ? 'bg-red-50 text-red-700'
    : key === 'checked_in' || key === 'occupied' || key === 'active' || key === 'completed' || key === 'delivered'
      ? 'bg-emerald-50 text-emerald-700'
      : key === 'cleaning' || key === 'reserved' || key === 'pending' || key === 'open' || key === 'in_progress'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-slate-100 text-slate-600';
  return <span className={`inline-flex rounded-full px-2 py-1 text-[9px] font-black ${tone}`}>{value.replace(/_/g, ' ')}</span>;
}

export function SmallButton({ children, onClick, danger = false }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return <button onClick={onClick} className={`h-7 rounded-lg px-2.5 text-[10px] font-black inline-flex items-center justify-center ${danger ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{children}</button>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-[9999] grid place-items-center p-4"><button className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close" /><div className="relative w-full max-w-3xl max-h-[90dvh] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-black">{title}</h2><button onClick={onClose} className="h-8 w-8 rounded-lg bg-slate-100 grid place-items-center"><X className="h-4 w-4" /></button></div>{children}</div></div>;
}

export function Th({ children }: { children: ReactNode }) { return <th className="px-2 py-2 font-black">{children}</th>; }
export function Td({ children, colSpan }: { children: ReactNode; colSpan?: number }) { return <td colSpan={colSpan} className="px-2 py-3 align-top">{children}</td>; }
