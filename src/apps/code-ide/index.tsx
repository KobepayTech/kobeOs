import { useEffect, useRef, useState } from 'react';
import { Code2, FilePlus2, FolderOpen, Play, Save, TerminalSquare } from 'lucide-react';

type Lang = 'html' | 'javascript' | 'typescript' | 'css' | 'json' | 'text';
const DEFAULT = `<!doctype html>\n<html>\n<head><meta charset="utf-8"><title>Kobe Code</title></head>\n<body>\n  <h1>Hello from KobeOS</h1>\n  <script>console.log('Kobe Code ready')</script>\n</body>\n</html>`;
const languageFor = (name: string): Lang => name.endsWith('.html') ? 'html' : name.endsWith('.js') ? 'javascript' : name.endsWith('.ts') ? 'typescript' : name.endsWith('.css') ? 'css' : name.endsWith('.json') ? 'json' : 'text';

export default function CodeIDE() {
  const [name, setName] = useState(() => localStorage.getItem('kobe-code-name') || 'index.html');
  const [code, setCode] = useState(() => localStorage.getItem('kobe-code-content') || DEFAULT);
  const [lang, setLang] = useState<Lang>(() => languageFor(localStorage.getItem('kobe-code-name') || 'index.html'));
  const [preview, setPreview] = useState(false);
  const [consoleLines, setConsoleLines] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      localStorage.setItem('kobe-code-name', name);
      localStorage.setItem('kobe-code-content', code);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [name, code]);

  const newFile = () => {
    setName('untitled.txt');
    setCode('');
    setLang('text');
    setPreview(false);
    setConsoleLines([]);
  };

  const open = async (file: File) => {
    const text = await file.text();
    setName(file.name);
    setCode(text);
    setLang(languageFor(file.name));
    setPreview(false);
    setConsoleLines([]);
  };

  const download = () => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name || 'untitled.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const run = () => {
    setConsoleLines([]);
    if (lang === 'html') {
      setPreview(true);
      return;
    }
    if (lang === 'javascript') {
      try {
        const logs: string[] = [];
        const fakeConsole = {
          log: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
          error: (...args: unknown[]) => logs.push(`ERROR: ${args.map(String).join(' ')}`),
        };
        new Function('console', code)(fakeConsole);
        setConsoleLines(logs.length ? logs : ['Program completed.']);
      } catch (error) {
        setConsoleLines([`ERROR: ${(error as Error).message}`]);
      }
      return;
    }
    if (lang === 'json') {
      try {
        JSON.parse(code);
        setConsoleLines(['Valid JSON.']);
      } catch (error) {
        setConsoleLines([`Invalid JSON: ${(error as Error).message}`]);
      }
      return;
    }
    setConsoleLines(['Preview/run is available for HTML, JavaScript and JSON.']);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#0d1117] text-slate-100">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/10 px-3">
        <Code2 className="h-5 w-5 text-blue-400" />
        <b>Kobe Code</b>
        <input value={name} onChange={(event) => { setName(event.target.value); setLang(languageFor(event.target.value)); }} className="ml-3 h-8 min-w-0 max-w-sm flex-1 rounded-lg border border-white/10 bg-white/5 px-2 text-xs" />
        <span className="text-[10px] font-black uppercase text-slate-500">{lang}</span>
        <input ref={fileRef} type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void open(file); event.currentTarget.value = ''; }} />
        <Tool title="New" onClick={newFile}><FilePlus2 /></Tool>
        <Tool title="Open" onClick={() => fileRef.current?.click()}><FolderOpen /></Tool>
        <Tool title="Save/download" onClick={download}><Save /></Tool>
        <Tool title="Run" onClick={run}><Play /></Tool>
      </header>
      <div className="grid min-h-0 flex-1 grid-rows-[1fr_auto]">
        <div className={`grid min-h-0 ${preview ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
          <div className="relative min-h-0">
            <div className="absolute bottom-0 left-0 top-0 w-10 select-none overflow-hidden border-r border-white/5 bg-black/20 pr-2 pt-3 text-right text-[11px] leading-5 text-slate-600">
              {code.split('\n').map((_, index) => <div key={index}>{index + 1}</div>)}
            </div>
            <textarea value={code} onChange={(event) => setCode(event.target.value)} spellCheck={false} className="h-full w-full resize-none bg-transparent py-3 pl-12 pr-3 font-mono text-[13px] leading-5 text-slate-200 outline-none" />
          </div>
          {preview && <iframe title="Preview" sandbox="allow-scripts" srcDoc={code} className="h-full w-full border-l border-white/10 bg-white" />}
        </div>
        <div className="max-h-44 min-h-24 overflow-auto border-t border-white/10 bg-black/30">
          <div className="flex h-8 items-center gap-2 border-b border-white/5 px-3 text-xs text-slate-400"><TerminalSquare className="h-4 w-4" />Output</div>
          <pre className="whitespace-pre-wrap p-3 font-mono text-xs text-slate-300">{consoleLines.length ? consoleLines.join('\n') : 'Run HTML, JavaScript or validate JSON. Changes are saved locally as you type.'}</pre>
        </div>
      </div>
    </div>
  );
}

function Tool({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactElement }) {
  return <button title={title} onClick={onClick} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"><span className="[&>svg]:h-4 [&>svg]:w-4">{children}</span></button>;
}
