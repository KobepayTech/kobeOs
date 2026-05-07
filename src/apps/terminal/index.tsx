import { useState, useRef, useEffect, useCallback } from 'react';
import { fs } from '@/os/fs';
import { useOSStore } from '@/os/store';

type CommandResult = { output: string[]; cwd: string };

export default function Terminal() {
  const [lines, setLines] = useState<string[]>([
    'KOBE OS Terminal v1.0',
    'Type "help" for a list of commands.',
    '',
  ]);
  const [input, setInput] = useState('');
  const [cwd, setCwd] = useState('/home/user');
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const launchApp = useOSStore((s) => s.launchApp);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const runCommand = useCallback(
    (raw: string): CommandResult => {
      const trimmed = raw.trim();
      if (!trimmed) return { output: [], cwd };
      const parts = trimmed.split(/\s+/);
      const cmd = parts[0];
      const args = parts.slice(1);
      const out: string[] = [];
      let newCwd = cwd;

      switch (cmd) {
        case 'help':
          out.push(
            'Available commands:',
            '  help, ls, cd, pwd, mkdir, touch, cat, echo, rm, clear',
            '  whoami, date, neofetch, calc, open [app]'
          );
          break;
        case 'ls': {
          const items = fs.readdir(newCwd);
          if (items.length === 0) {
            out.push('(empty)');
          } else {
            for (const item of items) {
              const marker = item.type === 'directory' ? 'd' : '-';
              out.push(`${marker} ${item.name}`);
            }
          }
          break;
        }
        case 'cd': {
          const target = args[0] ?? '/home/user';
          const resolved = target.startsWith('/')
            ? target
            : newCwd + '/' + target;
          const norm = resolved.replace(/\/+/g, '/');
          if (fs.exists(norm)) {
            newCwd = norm;
          } else {
            out.push(`cd: no such file or directory: ${target}`);
          }
          break;
        }
        case 'pwd':
          out.push(newCwd);
          break;
        case 'mkdir': {
          const name = args[0];
          if (!name) {
            out.push('mkdir: missing operand');
          } else {
            const res = fs.mkdir(newCwd + '/' + name);
            if (!res) out.push(`mkdir: cannot create directory '${name}'`);
          }
          break;
        }
        case 'touch': {
          const name = args[0];
          if (!name) {
            out.push('touch: missing operand');
          } else {
            fs.writeFile(newCwd + '/' + name, '');
          }
          break;
        }
        case 'cat': {
          const name = args[0];
          if (!name) {
            out.push('cat: missing operand');
          } else {
            const content = fs.readFile(newCwd + '/' + name);
            if (content === null) {
              out.push(`cat: ${name}: No such file`);
            } else if (typeof content === 'string') {
              out.push(...content.split('\n'));
            } else {
              out.push('[binary file]');
            }
          }
          break;
        }
        case 'echo':
          out.push(args.join(' '));
          break;
        case 'rm': {
          const name = args[0];
          if (!name) {
            out.push('rm: missing operand');
          } else {
            const ok = fs.delete(newCwd + '/' + name);
            if (!ok) out.push(`rm: cannot remove '${name}'`);
          }
          break;
        }
        case 'clear':
          setLines([]);
          return { output: [], cwd: newCwd };
        case 'whoami':
          out.push('user');
          break;
        case 'date':
          out.push(new Date().toString());
          break;
        case 'neofetch':
          out.push(
            '████████████████████████  ██╗  ██╗ ██████╗ ██████╗ ███████╗    ██████╗ ███████╗',
            '████████████████████████  ██║ ██╔╝██╔═══██╗██╔══██╗██╔════╝    ██╔══██╗██╔════╝',
            '████████████████████████  █████╔╝ ██║   ██║██████╔╝█████╗      ██║  ██║███████╗',
            '████████████████████████  ██╔═██╗ ██║   ██║██╔══██╗██╔══╝      ██║  ██║╚════██║',
            '████████████████████████  ██║  ██╗╚██████╔╝██████╔╝███████╗    ██████╔╝███████║',
            '████████████████████████  ╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝    ╚═════╝ ╚══════╝',
            '',
            'OS: KOBE OS v1.0',
            'Kernel: WebAssembly 1.0',
            'Uptime: forever',
            'Shell: ksh',
            'Resolution: ' + window.innerWidth + 'x' + window.innerHeight,
            'DE: KOBE Desktop',
            'WM: KWindow Manager',
            'Terminal: kterm',
            'CPU: JavaScript Engine',
            'Memory: Unlimited'
          );
          break;
        case 'calc': {
          const expr = args.join('');
          try {
            // eslint-disable-next-line no-eval
            const result = eval(expr);
            out.push(String(result));
          } catch {
            out.push('calc: invalid expression');
          }
          break;
        }
        case 'open': {
          const appId = args[0];
          if (!appId) {
            out.push('open: missing app name');
          } else {
            const app = useOSStore.getState().getApp(appId);
            if (app) {
              launchApp(appId);
              out.push(`Opened ${app.name}`);
            } else {
              out.push(`open: app '${appId}' not found`);
            }
          }
          break;
        }
        default:
          out.push(`${cmd}: command not found`);
      }
      return { output: out, cwd: newCwd };
    },
    [cwd, launchApp]
  );

  const submit = useCallback(() => {
    const raw = input;
    const promptText = `user@kobe-os:${cwd}$ ${raw}`;
    const { output, cwd: newCwd } = runCommand(raw);
    setLines((prev) => [...prev, promptText, ...output, '']);
    setCwd(newCwd);
    setHistory((h) => [...h, raw]);
    setHistIdx(-1);
    setInput('');
  }, [input, cwd, runCommand]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHistIdx((idx) => {
          const next = Math.min(idx + 1, history.length - 1);
          if (history[history.length - 1 - next]) {
            setInput(history[history.length - 1 - next]);
          }
          return next;
        });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHistIdx((idx) => {
          const next = Math.max(idx - 1, -1);
          if (next === -1) setInput('');
          else if (history[history.length - 1 - next]) {
            setInput(history[history.length - 1 - next]);
          }
          return next;
        });
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const items = fs.readdir(cwd);
        const matches = items.filter((i) => i.name.startsWith(input));
        if (matches.length === 1) {
          setInput(matches[0].name);
        }
      } else if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault();
        setLines([]);
      }
    },
    [input, history, histIdx, submit, cwd]
  );

  return (
    <div
      className="flex flex-col h-full font-mono text-sm p-2"
      style={{ background: '#0a0a0a', color: '#10b981' }}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex-1 overflow-auto whitespace-pre-wrap">
        {lines.map((line, i) => (
          <div key={i} className="leading-relaxed">
            {line}
          </div>
        ))}
        <div className="flex items-center gap-1">
          <span>user@kobe-os:{cwd}$</span>
          <input
            ref={inputRef}
            className="flex-1 bg-transparent outline-none border-none font-mono text-sm"
            style={{ color: '#10b981' }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoFocus
          />
        </div>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
