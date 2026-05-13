import { useState, useEffect, useCallback, useRef } from 'react';
import { fs } from '@/os/fs';
import { useOSStore } from '@/os/store';

const keywords = /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|type|interface|extends|implements|new|this|try|catch|throw|async|await|true|false|null|undefined)\b/g;
const strings = /(["'])(?:(?=(\\?))\2.)*?\1/g;
const comments = /\/\/.*|\/\*[\s\S]*?\*\//g;
const numbers = /\b\d+(?:\.\d+)?\b/g;

function highlight(code: string): string {
  let html = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  html = html.replace(comments, (m) => `<span class="text-slate-500">${m}</span>`);
  html = html.replace(strings, (m) => `<span class="text-emerald-400">${m}</span>`);
  html = html.replace(keywords, (m) => `<span class="text-purple-400">${m}</span>`);
  html = html.replace(numbers, (m) => `<span class="text-amber-400">${m}</span>`);
  return html;
}

export default function TextEditor() {
  const [content, setContent] = useState('');
  const [filePath, setFilePath] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const windows = useOSStore((s) => s.windows);
  const focused = windows.find((w) => w.isFocused && w.appId === 'text-editor');
  const initPath = focused?.data?.filePath as string | undefined;

  useEffect(() => {
    if (initPath && initPath !== filePath) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFilePath(initPath);
      const data = fs.readFile(initPath);
      if (data && typeof data === 'string') setContent(data);
    }
  }, [initPath, filePath]);

  const lines = content.split('\n');

  const handleScroll = useCallback(() => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  const save = () => {
    if (filePath) {
      fs.writeFile(filePath, content);
    } else {
      const name = prompt('Save as:');
      if (name) {
        const path = '/home/user/Documents/' + name;
        fs.writeFile(path, content);
        setFilePath(path);
      }
    }
  };

  const open = useCallback(() => {
    const name = prompt('Open file path:');
    if (!name) return;
    const path = name.startsWith('/') ? name : '/home/user/' + name;
    const data = fs.readFile(path);
    if (data && typeof data === 'string') {
      setContent(data);
      setFilePath(path);
    } else {
      alert('File not found or binary');
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#0f172a] text-sm text-os-text-primary">
      {/* Toolbar */}
      <div className="h-9 flex items-center gap-1 px-2 border-b border-white/[0.08]">
        <button className="px-2 py-1 rounded hover:bg-white/10 text-xs" onClick={() => setContent('')}>New</button>
        <button className="px-2 py-1 rounded hover:bg-white/10 text-xs" onClick={open}>Open</button>
        <button className="px-2 py-1 rounded hover:bg-white/10 text-xs" onClick={save}>Save</button>
        <div className="flex-1" />
        <span className="text-[11px] text-os-text-muted truncate">{filePath ?? 'Untitled'}</span>
      </div>

      {/* Editor */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Line numbers */}
        <div className="w-10 bg-white/5 border-r border-white/[0.08] text-right pr-2 pt-2 text-xs text-os-text-muted select-none overflow-hidden">
          {lines.map((_, i) => (
            <div key={i} className="leading-5">{i + 1}</div>
          ))}
        </div>

        <div className="flex-1 relative">
          <pre
            ref={preRef}
            className="absolute inset-0 p-2 font-mono text-sm leading-5 whitespace-pre-wrap overflow-auto pointer-events-none"
            dangerouslySetInnerHTML={{ __html: highlight(content + ' ') }}
          />
          <textarea
            ref={textareaRef}
            className="absolute inset-0 p-2 font-mono text-sm leading-5 bg-transparent text-transparent caret-white resize-none outline-none overflow-auto"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onScroll={handleScroll}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                const el = e.currentTarget;
                const start = el.selectionStart;
                const end = el.selectionEnd;
                const newVal = content.substring(0, start) + '    ' + content.substring(end);
                setContent(newVal);
                setTimeout(() => el.setSelectionRange(start + 4, start + 4), 0);
              }
              if (e.key === 's' && e.ctrlKey) {
                e.preventDefault();
                save();
              }
            }}
            spellCheck={false}
          />
        </div>
      </div>

      {/* Status */}
      <div className="h-6 flex items-center px-3 border-t border-white/[0.08] text-[11px] text-os-text-muted justify-between">
        <span>{lines.length} lines, {content.length} chars</span>
        <span>UTF-8</span>
      </div>
    </div>
  );
}
