import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Bold,
  Italic,
  Download,
  Type,
  Palette,
  ArrowRightLeft,
} from 'lucide-react';

interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  bgColor?: string;
  textColor?: string;
}

interface CellData {
  value: string;
  formula?: string;
  format?: CellFormat;
}

function colName(index: number): string {
  return String.fromCharCode(65 + index);
}

function parseCellRef(ref: string): { col: number; row: number } | null {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  const col = m[1].charCodeAt(0) - 65;
  const row = parseInt(m[2], 10) - 1;
  if (col < 0 || col >= 26 || row < 0 || row >= 50) return null;
  return { col, row };
}



function evaluateFormula(cells: Map<string, CellData>, formula: string): string {
  const expr = formula.slice(1).trim();

  // Range functions
  const rangeMatch = expr.match(/^(SUM|AVERAGE|MAX|MIN|COUNT)\s*\(\s*([A-Z]\d+)\s*:\s*([A-Z]\d+)\s*\)$/i);
  if (rangeMatch) {
    const [, func, start, end] = rangeMatch;
    const s = parseCellRef(start)!;
    const e = parseCellRef(end)!;
    const values: number[] = [];
    for (let c = Math.min(s.col, e.col); c <= Math.max(s.col, e.col); c++) {
      for (let r = Math.min(s.row, e.row); r <= Math.max(s.row, e.row); r++) {
        const key = `${c},${r}`;
        const cell = cells.get(key);
        const val = cell?.formula ? evaluateFormula(cells, cell.formula) : (cell?.value ?? '');
        const num = parseFloat(val);
        if (!isNaN(num)) values.push(num);
      }
    }
    const fn = func.toUpperCase();
    if (values.length === 0) return '0';
    if (fn === 'SUM') return String(values.reduce((a, b) => a + b, 0));
    if (fn === 'AVERAGE') return String(values.reduce((a, b) => a + b, 0) / values.length);
    if (fn === 'MAX') return String(Math.max(...values));
    if (fn === 'MIN') return String(Math.min(...values));
    if (fn === 'COUNT') return String(values.length);
  }

  // Single-cell functions or arithmetic
  try {
    const replaced = expr.replace(/([A-Z]\d+)/g, (match) => {
      const parsed = parseCellRef(match);
      if (!parsed) return '0';
      const key = `${parsed.col},${parsed.row}`;
      const cell = cells.get(key);
      if (!cell) return '0';
      const val = cell.formula ? evaluateFormula(cells, cell.formula) : cell.value;
      const num = parseFloat(val);
      return isNaN(num) ? '0' : String(num);
    });
    const result = new Function('return ' + replaced)();
    return String(result);
  } catch {
    return '#ERROR';
  }
}

function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

export default function SpreadsheetApp() {
  const [cells, setCells] = useState<Map<string, CellData>>(new Map());
  const [selected, setSelected] = useState<{ col: number; row: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [_editing, setEditing] = useState(false);
  const [colWidths, setColWidths] = useState<number[]>(() => Array.from({ length: 26 }, () => 80));
  const [resizing, setResizing] = useState<number | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const getDisplayValue = useCallback((col: number, row: number): string => {
    const key = cellKey(col, row);
    const cell = cells.get(key);
    if (!cell) return '';
    if (cell.formula) return evaluateFormula(cells, cell.formula);
    return cell.value;
  }, [cells]);

  const setCell = useCallback((col: number, row: number, updater: Partial<CellData>) => {
    const key = cellKey(col, row);
    setCells((prev) => {
      const next = new Map(prev);
      const existing = next.get(key);
      const updated: CellData = existing
        ? { ...existing, ...updater }
        : { value: '', ...updater };
      next.set(key, updated);
      return next;
    });
  }, []);

  const handleCellClick = (col: number, row: number) => {
    setSelected({ col, row });
    const key = cellKey(col, row);
    const cell = cells.get(key);
    setEditValue(cell?.formula ?? cell?.value ?? '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commitEdit = () => {
    if (!selected) return;
    const { col, row } = selected;
    const val = editValue.trim();
    if (val.startsWith('=')) {
      setCell(col, row, { formula: val, value: '' });
    } else {
      setCell(col, row, { value: val, formula: undefined });
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitEdit();
      if (selected && selected.row < 49) {
        const next = { col: selected.col, row: selected.row + 1 };
        setSelected(next);
        const key = cellKey(next.col, next.row);
        const cell = cells.get(key);
        setEditValue(cell?.formula ?? cell?.value ?? '');
        setEditing(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    } else if (e.key === 'Escape') {
      setEditing(false);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit();
      if (selected) {
        const next = { col: Math.min(selected.col + 1, 25), row: selected.row };
        setSelected(next);
        const key = cellKey(next.col, next.row);
        const cell = cells.get(key);
        setEditValue(cell?.formula ?? cell?.value ?? '');
        setEditing(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    }
  };

  const toggleFormat = (key: keyof CellFormat) => {
    if (!selected) return;
    const { col, row } = selected;
    const k = cellKey(col, row);
    const cell = cells.get(k);
    const fmt = cell?.format ?? {};
    setCell(col, row, {
      format: { ...fmt, [key]: !fmt[key] } as CellFormat },
    );
  };

  const setColor = (type: 'bgColor' | 'textColor', color: string) => {
    if (!selected) return;
    const { col, row } = selected;
    const k = cellKey(col, row);
    const cell = cells.get(k);
    const fmt = cell?.format ?? {};
    setCell(col, row, { format: { ...fmt, [type]: color } });
  };

  const exportCSV = () => {
    let csv = '';
    for (let r = 0; r < 50; r++) {
      const row: string[] = [];
      for (let c = 0; c < 26; c++) {
        row.push(getDisplayValue(c, r));
      }
      csv += row.join(',') + '\n';
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'spreadsheet.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const onHeaderMouseDown = (colIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    setResizing(colIndex);
    setStartX(e.clientX);
    setStartWidth(colWidths[colIndex]);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (resizing === null) return;
      const diff = e.clientX - startX;
      setColWidths((prev) => {
        const next = [...prev];
        next[resizing] = Math.max(40, startWidth + diff);
        return next;
      });
    };
    const onUp = () => setResizing(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [resizing, startX, startWidth]);

  const selectedFormat = selected ? cells.get(cellKey(selected.col, selected.row))?.format : undefined;

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 text-slate-200 select-none">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700 bg-slate-800 shrink-0 flex-wrap">
        <button
          onClick={() => toggleFormat('bold')}
          className={`p-1.5 rounded ${selectedFormat?.bold ? 'bg-blue-600 text-white' : 'hover:bg-slate-700'}`}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => toggleFormat('italic')}
          className={`p-1.5 rounded ${selectedFormat?.italic ? 'bg-blue-600 text-white' : 'hover:bg-slate-700'}`}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-slate-600 mx-1" />
        <div className="flex items-center gap-1">
          <Palette className="w-4 h-4" />
          {['#ffffff', '#ef4444', '#22c55e', '#3b82f6', '#eab308', '#a855f7', '#000000'].map((c) => (
            <button
              key={c}
              onClick={() => setColor('bgColor', c)}
              className="w-5 h-5 rounded border border-slate-500"
              style={{ backgroundColor: c }}
              title={`BG ${c}`}
            />
          ))}
        </div>
        <div className="w-px h-5 bg-slate-600 mx-1" />
        <div className="flex items-center gap-1">
          <Type className="w-4 h-4" />
          {['#ffffff', '#ef4444', '#22c55e', '#3b82f6', '#eab308', '#a855f7', '#000000'].map((c) => (
            <button
              key={c}
              onClick={() => setColor('textColor', c)}
              className="w-5 h-5 rounded border border-slate-500"
              style={{ backgroundColor: c }}
              title={`Text ${c}`}
            />
          ))}
        </div>
        <div className="w-px h-5 bg-slate-600 mx-1" />
        <button
          onClick={exportCSV}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-700 text-sm"
          title="Export CSV"
        >
          <Download className="w-4 h-4" /> CSV
        </button>
        <div className="w-px h-5 bg-slate-600 mx-1" />
        <ArrowRightLeft className="w-4 h-4 text-slate-400" />
        <span className="text-xs text-slate-400">Drag column borders to resize</span>
      </div>

      {/* Formula bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-700 bg-slate-800 shrink-0">
        <span className="text-sm text-slate-400 w-16 shrink-0">
          {selected ? `${colName(selected.col)}${selected.row + 1}` : ''}
        </span>
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
          placeholder="Enter value or formula (=SUM(A1:A5))"
        />
      </div>

      {/* Grid */}
      <div ref={gridRef} className="flex-1 overflow-auto">
        <div className="inline-block min-w-full">
          {/* Header row */}
          <div className="flex sticky top-0 z-10">
            <div className="w-12 shrink-0 bg-slate-800 border-b border-r border-slate-700" />
            {Array.from({ length: 26 }).map((_, c) => (
              <div
                key={c}
                className="shrink-0 bg-slate-800 border-b border-r border-slate-700 text-center text-xs text-slate-400 py-1 relative"
                style={{ width: colWidths[c] }}
              >
                {colName(c)}
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500"
                  onMouseDown={(e) => onHeaderMouseDown(c, e)}
                />
              </div>
            ))}
          </div>
          {/* Data rows */}
          {Array.from({ length: 50 }).map((_, r) => (
            <div className="flex" key={r}>
              <div className="w-12 shrink-0 bg-slate-800 border-b border-r border-slate-700 text-center text-xs text-slate-400 py-1 sticky left-0 z-10">
                {r + 1}
              </div>
              {Array.from({ length: 26 }).map((_, c) => {
                const key = cellKey(c, r);
                const cell = cells.get(key);
                const display = getDisplayValue(c, r);
                const isSelected = selected?.col === c && selected?.row === r;
                const fmt = cell?.format;
                return (
                  <div
                    key={key}
                    onClick={() => handleCellClick(c, r)}
                    className={`shrink-0 border-b border-r border-slate-700 px-1 py-0.5 text-sm cursor-cell relative ${
                      isSelected ? 'ring-1 ring-blue-500 z-20' : ''
                    }`}
                    style={{
                      width: colWidths[c],
                      fontWeight: fmt?.bold ? 'bold' : 'normal',
                      fontStyle: fmt?.italic ? 'italic' : 'normal',
                      backgroundColor: fmt?.bgColor ?? 'transparent',
                      color: fmt?.textColor ?? 'inherit',
                    }}
                  >
                    {display}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
