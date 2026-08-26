import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * An async replacement for window.prompt() that works in the Electron desktop
 * renderer (where window.prompt is a no-op that returns undefined). Renders a
 * small modal into its own root and resolves with the entered string, or null
 * if cancelled — a drop-in for `prompt()` via `await kobePrompt(...)`.
 */
export function kobePrompt(message: string, defaultValue = ''): Promise<string | null> {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    let settled = false;
    const done = (value: string | null) => {
      if (settled) return;
      settled = true;
      root.unmount();
      host.remove();
      resolve(value);
    };
    root.render(<PromptModal message={message} defaultValue={defaultValue} onDone={done} />);
  });
}

function PromptModal({ message, defaultValue, onDone }: { message: string; defaultValue: string; onDone: (v: string | null) => void }) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDone(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/60 p-4" onClick={() => onDone(null)}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); onDone(value); }}
        className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl"
      >
        <p className="text-sm font-semibold whitespace-pre-line">{message}</p>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-3 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm outline-none focus:border-emerald-500"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => onDone(null)} className="h-9 rounded-lg border border-slate-700 px-4 text-xs font-bold text-slate-300 hover:bg-slate-800">Cancel</button>
          <button type="submit" className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-500">OK</button>
        </div>
      </form>
    </div>
  );
}
