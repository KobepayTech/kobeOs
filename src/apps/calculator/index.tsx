import { useState, useCallback, useEffect } from 'react';

export default function Calculator() {
  const [display, setDisplay] = useState('0');
  const [prev, setPrev] = useState<string | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [fresh, setFresh] = useState(true);
  const [mode, setMode] = useState<'standard' | 'scientific'>('standard');
  const [history, setHistory] = useState<string[]>([]);

  const input = useCallback(
    (val: string) => {
      if (fresh) {
        setDisplay(val);
        setFresh(false);
      } else {
        setDisplay((d) => (d === '0' ? val : d + val));
      }
    },
    [fresh]
  );

  const operator = useCallback(
    (o: string) => {
      setPrev(display);
      setOp(o);
      setFresh(true);
    },
    [display]
  );

  const equals = useCallback(() => {
    if (!op || prev === null) return;
    const a = parseFloat(prev);
    const b = parseFloat(display);
    let result = 0;
    switch (op) {
      case '+':
        result = a + b;
        break;
      case '-':
        result = a - b;
        break;
      case '*':
        result = a * b;
        break;
      case '/':
        result = b === 0 ? NaN : a / b;
        break;
      case '^':
        result = Math.pow(a, b);
        break;
    }
    const resStr = String(result);
    setHistory((h) => [`${prev} ${op} ${display} = ${resStr}`, ...h].slice(0, 20));
    setDisplay(resStr);
    setPrev(null);
    setOp(null);
    setFresh(true);
  }, [op, prev, display]);

  const clear = useCallback(() => {
    setDisplay('0');
    setPrev(null);
    setOp(null);
    setFresh(true);
  }, []);

  const backspace = useCallback(() => {
    setDisplay((d) => (d.length > 1 ? d.slice(0, -1) : '0'));
  }, []);

  const scientific = useCallback(
    (fn: string) => {
      const v = parseFloat(display);
      let r = 0;
      switch (fn) {
        case 'sin':
          r = Math.sin(v);
          break;
        case 'cos':
          r = Math.cos(v);
          break;
        case 'tan':
          r = Math.tan(v);
          break;
        case 'log':
          r = Math.log10(v);
          break;
        case 'ln':
          r = Math.log(v);
          break;
        case 'sqrt':
          r = Math.sqrt(v);
          break;
        case 'factorial': {
          let f = 1;
          for (let i = 2; i <= v; i++) f *= i;
          r = f;
          break;
        }
      }
      setDisplay(String(r));
      setFresh(true);
    },
    [display]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key;
      if (/[0-9.]/.test(key)) input(key);
      if (['+', '-', '*', '/'].includes(key)) operator(key);
      if (key === 'Enter') equals();
      if (key === 'Backspace') backspace();
      if (key === 'Escape') clear();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [input, operator, equals, backspace, clear]);

  const btn = (label: string, onClick: () => void, className = '') => (
    <button
      key={label}
      className={`h-10 rounded-lg text-sm font-medium transition-colors ${className}`}
      onClick={onClick}
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-full bg-[#0f172a] text-os-text-primary">
      {/* History */}
      <div className="w-40 border-r border-white/[0.08] flex flex-col">
        <div className="px-3 py-2 text-xs font-semibold text-os-text-muted uppercase">History</div>
        <div className="flex-1 overflow-auto px-2">
          {history.map((h, i) => (
            <div key={i} className="text-[11px] text-os-text-muted py-1 border-b border-white/5">
              {h}
            </div>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-os-text-muted uppercase">Calculator</div>
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            <button
              className={`px-2 py-1 text-xs ${mode === 'standard' ? 'bg-os-accent/20 text-os-accent' : 'text-os-text-muted'}`}
              onClick={() => setMode('standard')}
            >
              Standard
            </button>
            <button
              className={`px-2 py-1 text-xs ${mode === 'scientific' ? 'bg-os-accent/20 text-os-accent' : 'text-os-text-muted'}`}
              onClick={() => setMode('scientific')}
            >
              Scientific
            </button>
          </div>
        </div>

        <div className="mb-3 p-3 rounded-xl bg-white/5 border border-white/10 text-right text-2xl font-mono tracking-wider truncate">
          {display}
        </div>

        <div className="flex-1 grid gap-1.5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {mode === 'scientific' && (
            <>
              {btn('sin', () => scientific('sin'), 'bg-white/5 hover:bg-white/10 text-xs')}
              {btn('cos', () => scientific('cos'), 'bg-white/5 hover:bg-white/10 text-xs')}
              {btn('tan', () => scientific('tan'), 'bg-white/5 hover:bg-white/10 text-xs')}
              {btn('log', () => scientific('log'), 'bg-white/5 hover:bg-white/10 text-xs')}
              {btn('ln', () => scientific('ln'), 'bg-white/5 hover:bg-white/10 text-xs')}
              {btn('sqrt', () => scientific('sqrt'), 'bg-white/5 hover:bg-white/10 text-xs')}
              {btn('x^y', () => operator('^'), 'bg-white/5 hover:bg-white/10 text-xs')}
              {btn('n!', () => scientific('factorial'), 'bg-white/5 hover:bg-white/10 text-xs')}
              {btn('pi', () => input(String(Math.PI)), 'bg-white/5 hover:bg-white/10 text-xs')}
              {btn('e', () => input(String(Math.E)), 'bg-white/5 hover:bg-white/10 text-xs')}
              {btn('(', () => input('('), 'bg-white/5 hover:bg-white/10 text-xs')}
              {btn(')', () => input(')'), 'bg-white/5 hover:bg-white/10 text-xs')}
            </>
          )}
          {btn('C', clear, 'bg-red-500/20 text-red-400 hover:bg-red-500/30')}
          {btn('CE', () => setDisplay('0'), 'bg-white/5 hover:bg-white/10')}
          {btn('del', backspace, 'bg-white/5 hover:bg-white/10')}
          {btn('/', () => operator('/'), 'bg-os-accent/20 text-os-accent hover:bg-os-accent/30')}

          {btn('7', () => input('7'), 'bg-white/5 hover:bg-white/10')}
          {btn('8', () => input('8'), 'bg-white/5 hover:bg-white/10')}
          {btn('9', () => input('9'), 'bg-white/5 hover:bg-white/10')}
          {btn('*', () => operator('*'), 'bg-os-accent/20 text-os-accent hover:bg-os-accent/30')}

          {btn('4', () => input('4'), 'bg-white/5 hover:bg-white/10')}
          {btn('5', () => input('5'), 'bg-white/5 hover:bg-white/10')}
          {btn('6', () => input('6'), 'bg-white/5 hover:bg-white/10')}
          {btn('-', () => operator('-'), 'bg-os-accent/20 text-os-accent hover:bg-os-accent/30')}

          {btn('1', () => input('1'), 'bg-white/5 hover:bg-white/10')}
          {btn('2', () => input('2'), 'bg-white/5 hover:bg-white/10')}
          {btn('3', () => input('3'), 'bg-white/5 hover:bg-white/10')}
          {btn('+', () => operator('+'), 'bg-os-accent/20 text-os-accent hover:bg-os-accent/30')}

          {btn('±', () => setDisplay((d) => String(parseFloat(d) * -1)), 'bg-white/5 hover:bg-white/10')}
          {btn('0', () => input('0'), 'bg-white/5 hover:bg-white/10')}
          {btn('.', () => input('.'), 'bg-white/5 hover:bg-white/10')}
          {btn('=', equals, 'bg-os-accent text-white hover:bg-os-accent/90')}
        </div>
      </div>
    </div>
  );
}
