import { useState, useCallback, useEffect } from 'react';
import {
  Database,
  Play,
  Plus,
  Trash2,
  Table,
  FileDown,
  FileUp,
  Search,
  AlertCircle,
  Columns,
} from 'lucide-react';

type ColumnType = 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB';

interface ColumnDef {
  name: string;
  type: ColumnType;
  nullable: boolean;
  primaryKey: boolean;
}

interface TableData {
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
}

interface DBState {
  tables: Record<string, TableData>;
}

function loadDB(): DBState {
  const raw = localStorage.getItem('kobe_db_manager');
  if (raw) return JSON.parse(raw);
  // Pre-populate sample tables
  return {
    tables: {
      users: {
        columns: [
          { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
          { name: 'name', type: 'TEXT', nullable: false, primaryKey: false },
          { name: 'email', type: 'TEXT', nullable: false, primaryKey: false },
          { name: 'age', type: 'INTEGER', nullable: true, primaryKey: false },
          { name: 'active', type: 'INTEGER', nullable: false, primaryKey: false },
        ],
        rows: [
          { id: 1, name: 'Alice Johnson', email: 'alice@example.com', age: 28, active: 1 },
          { id: 2, name: 'Bob Smith', email: 'bob@example.com', age: 34, active: 1 },
          { id: 3, name: 'Carol White', email: 'carol@example.com', age: 22, active: 0 },
          { id: 4, name: 'David Brown', email: 'david@example.com', age: 45, active: 1 },
        ],
      },
      products: {
        columns: [
          { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
          { name: 'name', type: 'TEXT', nullable: false, primaryKey: false },
          { name: 'price', type: 'REAL', nullable: false, primaryKey: false },
          { name: 'stock', type: 'INTEGER', nullable: false, primaryKey: false },
        ],
        rows: [
          { id: 1, name: 'Laptop', price: 999.99, stock: 15 },
          { id: 2, name: 'Mouse', price: 29.99, stock: 120 },
          { id: 3, name: 'Keyboard', price: 79.99, stock: 45 },
          { id: 4, name: 'Monitor', price: 299.99, stock: 8 },
        ],
      },
      orders: {
        columns: [
          { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
          { name: 'user_id', type: 'INTEGER', nullable: false, primaryKey: false },
          { name: 'product_id', type: 'INTEGER', nullable: false, primaryKey: false },
          { name: 'quantity', type: 'INTEGER', nullable: false, primaryKey: false },
          { name: 'total', type: 'REAL', nullable: false, primaryKey: false },
        ],
        rows: [
          { id: 1, user_id: 1, product_id: 1, quantity: 1, total: 999.99 },
          { id: 2, user_id: 1, product_id: 2, quantity: 2, total: 59.98 },
          { id: 3, user_id: 2, product_id: 3, quantity: 1, total: 79.99 },
          { id: 4, user_id: 3, product_id: 1, quantity: 1, total: 999.99 },
        ],
      },
    },
  };
}

function saveDB(db: DBState) {
  localStorage.setItem('kobe_db_manager', JSON.stringify(db));
}

export default function DatabaseManager() {
  const [db, setDb] = useState<DBState>(loadDB);
  const [selectedTable, setSelectedTable] = useState<string | null>('users');
  const [query, setQuery] = useState('SELECT * FROM users');
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null);
  const [resultColumns, setResultColumns] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(25);
  const [creatingTable, setCreatingTable] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newColumns, setNewColumns] = useState<ColumnDef[]>([{ name: '', type: 'TEXT', nullable: true, primaryKey: false }]);
  const [activeView, setActiveView] = useState<'data' | 'query'>('data');

  useEffect(() => {
    saveDB(db);
  }, [db]);

  const runQuery = useCallback(() => {
    setError(null);
    setResults(null);
    setResultColumns([]);
    setPage(0);

    const sql = query.trim().toUpperCase();
    try {
      if (sql.startsWith('SELECT')) {
        const tableMatch = query.match(/FROM\s+(\w+)/i);
        const table = tableMatch ? tableMatch[1] : null;
        if (!table || !db.tables[table]) {
          setError(`Table '${table}' not found`);
          return;
        }
        let rows = [...db.tables[table].rows];

        // Simple WHERE parsing (exact equality only)
        const whereMatch = query.match(/WHERE\s+(.+)/i);
        if (whereMatch) {
          const whereClause = whereMatch[1].trim();
          // Handle AND
          const conditions = whereClause.split(/\s+AND\s+/i);
          for (const cond of conditions) {
            const eqMatch = cond.match(/(\w+)\s*=\s*(.+)/);
            if (eqMatch) {
              const col = eqMatch[1];
              let val = eqMatch[2].trim();
              if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
              rows = rows.filter((r) => String(r[col]) === val || (typeof r[col] === 'number' && String(r[col]) === val));
            }
          }
        }

        // ORDER BY
        const orderMatch = query.match(/ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
        if (orderMatch) {
          const col = orderMatch[1];
          const dir = (orderMatch[2] || 'ASC').toUpperCase();
          rows.sort((a, b) => {
            const av = a[col], bv = b[col];
            if (av === undefined || bv === undefined) return 0;
            if (typeof av === 'number' && typeof bv === 'number') {
              return dir === 'DESC' ? bv - av : av - bv;
            }
            return dir === 'DESC' ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
          });
        }

        // LIMIT
        const limitMatch = query.match(/LIMIT\s+(\d+)/i);
        if (limitMatch) {
          rows = rows.slice(0, Number(limitMatch[1]));
        }

        const columns = db.tables[table].columns.map((c) => c.name);
        setResultColumns(columns);
        setResults(rows);
      } else if (sql.startsWith('INSERT')) {
        const tableMatch = query.match(/INTO\s+(\w+)/i);
        const table = tableMatch ? tableMatch[1] : null;
        if (!table || !db.tables[table]) {
          setError(`Table '${table}' not found`);
          return;
        }
        const colsMatch = query.match(/\(([^)]+)\)/);
        const valsMatch = query.match(/VALUES\s*\(([^)]+)\)/);
        if (!colsMatch || !valsMatch) {
          setError('INSERT syntax: INSERT INTO table (col1, col2) VALUES (val1, val2)');
          return;
        }
        const cols = colsMatch[1].split(',').map((c) => c.trim());
        const vals = valsMatch[1].split(',').map((v) => {
          v = v.trim();
          if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
          const n = Number(v);
          return isNaN(n) ? v : n;
        });
        const row: Record<string, unknown> = {};
        cols.forEach((c, i) => { row[c] = vals[i]; });

        // Auto-increment primary key if missing
        const pk = db.tables[table].columns.find((c) => c.primaryKey);
        if (pk && row[pk.name] === undefined) {
          const maxId = Math.max(0, ...db.tables[table].rows.map((r) => Number(r[pk.name]) || 0));
          row[pk.name] = maxId + 1;
        }

        const next = { ...db, tables: { ...db.tables, [table]: { ...db.tables[table], rows: [...db.tables[table].rows, row] } } };
        setDb(next);
        setResults([row]);
        setResultColumns(cols);
      } else if (sql.startsWith('UPDATE')) {
        const tableMatch = query.match(/UPDATE\s+(\w+)/i);
        const table = tableMatch ? tableMatch[1] : null;
        if (!table || !db.tables[table]) {
          setError(`Table '${table}' not found`);
          return;
        }
        const setMatch = query.match(/SET\s+(.+?)(?:\s+WHERE|$)/i);
        if (!setMatch) {
          setError('UPDATE syntax: UPDATE table SET col=val WHERE condition');
          return;
        }
        const assignments = setMatch[1].split(',').map((a) => a.trim());
        const updates: Record<string, unknown> = {};
        for (const a of assignments) {
          const [k, v] = a.split('=').map((s) => s.trim());
          let val: unknown = v;
          if (typeof v === 'string' && v.startsWith("'") && v.endsWith("'")) val = v.slice(1, -1);
          else { const n = Number(v); if (!isNaN(n)) val = n; }
          updates[k] = val;
        }

        let rows = [...db.tables[table].rows];
        const whereMatch = query.match(/WHERE\s+(.+)/i);
        if (whereMatch) {
          const col = whereMatch[1].match(/(\w+)\s*=\s*(.+)/);
          if (col) {
            const cname = col[1];
            let val = col[2].trim();
            if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
            rows = rows.filter((r) => String(r[cname]) === val || String(r[cname]) === String(Number(val)));
          }
        }

        const updated = db.tables[table].rows.map((r) => {
          if (rows.includes(r)) return { ...r, ...updates };
          return r;
        });
        const next = { ...db, tables: { ...db.tables, [table]: { ...db.tables[table], rows: updated } } };
        setDb(next);
        setResults([updated.find((r) => rows.some((o) => o.id === r.id)) || updated[0]]);
        setResultColumns(db.tables[table].columns.map((c) => c.name));
      } else if (sql.startsWith('DELETE')) {
        const tableMatch = query.match(/FROM\s+(\w+)/i);
        const table = tableMatch ? tableMatch[1] : null;
        if (!table || !db.tables[table]) {
          setError(`Table '${table}' not found`);
          return;
        }
        let rows = [...db.tables[table].rows];
        const whereMatch = query.match(/WHERE\s+(.+)/i);
        if (whereMatch) {
          const col = whereMatch[1].match(/(\w+)\s*=\s*(.+)/);
          if (col) {
            const cname = col[1];
            let val = col[2].trim();
            if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
            rows = rows.filter((r) => String(r[cname]) !== val && String(r[cname]) !== String(Number(val)));
          }
        } else {
          rows = [];
        }
        const next = { ...db, tables: { ...db.tables, [table]: { ...db.tables[table], rows } } };
        setDb(next);
        setResults([]);
        setResultColumns([]);
      } else {
        setError('Only SELECT, INSERT, UPDATE, DELETE are supported');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Query error');
    }
  }, [query, db]);

  const dropTable = (name: string) => {
    if (!confirm(`Drop table '${name}'?`)) return;
    const next = { ...db, tables: { ...db.tables } };
    delete next.tables[name];
    setDb(next);
    if (selectedTable === name) setSelectedTable(null);
  };

  const createTable = () => {
    if (!newTableName || db.tables[newTableName]) {
      alert('Invalid or duplicate table name');
      return;
    }
    const cols = newColumns.filter((c) => c.name);
    if (cols.length === 0) {
      alert('At least one column required');
      return;
    }
    const next = { ...db, tables: { ...db.tables, [newTableName]: { columns: cols, rows: [] } } };
    setDb(next);
    setCreatingTable(false);
    setNewTableName('');
    setNewColumns([{ name: '', type: 'TEXT', nullable: true, primaryKey: false }]);
    setSelectedTable(newTableName);
  };

  const exportCSV = (name: string) => {
    const table = db.tables[name];
    if (!table) return;
    const headers = table.columns.map((c) => c.name).join(',');
    const rows = table.rows.map((r) => table.columns.map((c) => `"${String(r[c.name] ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importCSV = (name: string, csvText: string) => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return;
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const rows: Record<string, unknown>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
      const row: Record<string, unknown> = {};
      headers.forEach((h, j) => {
        const val = values[j] || '';
        const n = Number(val);
        row[h] = isNaN(n) || val === '' ? val : n;
      });
      rows.push(row);
    }
    const next = { ...db, tables: { ...db.tables, [name]: { ...db.tables[name], rows: [...db.tables[name].rows, ...rows] } } };
    setDb(next);
  };

  const currentTable = selectedTable ? db.tables[selectedTable] : null;
  const displayRows = activeView === 'data' && currentTable
    ? currentTable.rows.slice(page * rowsPerPage, (page + 1) * rowsPerPage)
    : (results || []);
  const displayCols = activeView === 'data' && currentTable
    ? currentTable.columns.map((c) => c.name)
    : resultColumns;
  const totalPages = currentTable ? Math.ceil(currentTable.rows.length / rowsPerPage) : 1;

  return (
    <div className="flex h-full bg-[#0f172a] text-os-text-primary overflow-hidden">
      {/* Sidebar: Tables */}
      <div className="w-48 border-r border-white/[0.08] flex flex-col flex-shrink-0">
        <div className="flex items-center justify-between px-2 py-2 border-b border-white/[0.08]">
          <div className="text-xs font-semibold text-os-text-muted uppercase flex items-center gap-1">
            <Database className="w-3 h-3" /> Tables
          </div>
          <button onClick={() => setCreatingTable(true)} className="p-0.5 rounded hover:bg-white/10">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {Object.keys(db.tables).map((name) => (
            <button
              key={name}
              onClick={() => { setSelectedTable(name); setActiveView('data'); setResults(null); setPage(0); }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-white/5 text-left ${selectedTable === name ? 'bg-os-accent/10 text-os-accent' : ''}`}
            >
              <Table className="w-3 h-3" />
              <span className="flex-1 truncate">{name}</span>
              <span className="text-[10px] text-os-text-muted">{db.tables[name].rows.length}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Query bar */}
        <div className="flex items-center gap-2 px-2 py-2 border-b border-white/[0.08]">
          <Search className="w-3.5 h-3.5 text-os-text-muted" />
          <input
            className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs font-mono outline-none focus:border-os-accent min-w-0"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="SELECT * FROM users WHERE active=1"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runQuery(); } }}
          />
          <button onClick={runQuery} className="flex items-center gap-1 px-2 py-1 rounded bg-os-accent text-white text-xs font-semibold hover:bg-os-accent/90">
            <Play className="w-3 h-3" /> Run
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </div>
        )}

        {/* Tabs + Actions */}
        {selectedTable && (
          <div className="flex items-center justify-between px-2 py-1 border-b border-white/[0.08]">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveView('data')}
                className={`px-2 py-0.5 rounded text-xs ${activeView === 'data' ? 'bg-os-accent/20 text-os-accent' : 'text-os-text-muted hover:bg-white/5'}`}
              >
                Data
              </button>
              <button
                onClick={() => setActiveView('query')}
                className={`px-2 py-0.5 rounded text-xs ${activeView === 'query' ? 'bg-os-accent/20 text-os-accent' : 'text-os-text-muted hover:bg-white/5'}`}
              >
                Query Result
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => exportCSV(selectedTable)} className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/10 text-xs">
                <FileDown className="w-3 h-3" /> Export
              </button>
              <button
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.csv';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => importCSV(selectedTable, String(ev.target?.result || ''));
                      reader.readAsText(file);
                    }
                  };
                  input.click();
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/10 text-xs"
              >
                <FileUp className="w-3 h-3" /> Import
              </button>
              <button onClick={() => dropTable(selectedTable)} className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/10 text-xs text-red-400">
                <Trash2 className="w-3 h-3" /> Drop
              </button>
            </div>
          </div>
        )}

        {/* Data table */}
        <div className="flex-1 overflow-auto">
          {displayCols.length > 0 ? (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#1e293b]">
                <tr>
                  {displayCols.map((col) => (
                    <th key={col} className="px-3 py-2 text-left font-semibold text-os-text-muted border-b border-white/[0.08]">
                      <div className="flex items-center gap-1">
                        <Columns className="w-3 h-3" /> {col}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                    {displayCols.map((col) => (
                      <td key={col} className="px-3 py-1.5 font-mono text-os-text-primary">
                        {row[col] === null || row[col] === undefined ? (
                          <span className="text-gray-500">NULL</span>
                        ) : typeof row[col] === 'number' ? (
                          <span className="text-blue-400">{row[col]}</span>
                        ) : typeof row[col] === 'boolean' || row[col] === 0 || row[col] === 1 ? (
                          <span className="text-purple-400">{String(row[col])}</span>
                        ) : (
                          <span className="text-emerald-400">{String(row[col])}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex items-center justify-center h-full text-os-text-muted text-sm">
              {selectedTable ? 'No rows' : 'Select a table or run a query'}
            </div>
          )}
        </div>

        {/* Pagination */}
        {activeView === 'data' && currentTable && currentTable.rows.length > rowsPerPage && (
          <div className="flex items-center justify-between px-3 py-1 border-t border-white/[0.08] text-xs">
            <span className="text-os-text-muted">
              {page * rowsPerPage + 1}-{Math.min((page + 1) * rowsPerPage, currentTable.rows.length)} of {currentTable.rows.length}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-2 py-0.5 rounded hover:bg-white/10 disabled:opacity-30">Prev</button>
              <span className="text-os-text-muted">{page + 1} / {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="px-2 py-0.5 rounded hover:bg-white/10 disabled:opacity-30">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Create Table Modal */}
      {creatingTable && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#1e293b] rounded-xl border border-white/10 p-4 w-96 max-h-[80%] overflow-auto">
            <div className="text-sm font-semibold mb-3">Create Table</div>
            <input
              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-os-accent mb-3"
              value={newTableName}
              onChange={(e) => setNewTableName(e.target.value)}
              placeholder="Table name"
            />
            <div className="space-y-2 mb-3">
              {newColumns.map((col, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-os-accent"
                    value={col.name}
                    onChange={(e) => {
                      const next = [...newColumns];
                      next[i].name = e.target.value;
                      setNewColumns(next);
                    }}
                    placeholder="Column name"
                  />
                  <select
                    className="bg-white/5 border border-white/10 rounded px-1 py-1 text-xs outline-none"
                    value={col.type}
                    onChange={(e) => {
                      const next = [...newColumns];
                      next[i].type = e.target.value as ColumnType;
                      setNewColumns(next);
                    }}
                  >
                    <option value="TEXT">TEXT</option>
                    <option value="INTEGER">INTEGER</option>
                    <option value="REAL">REAL</option>
                    <option value="BLOB">BLOB</option>
                  </select>
                  <button
                    onClick={() => {
                      const next = [...newColumns];
                      next[i].primaryKey = !next[i].primaryKey;
                      setNewColumns(next);
                    }}
                    className={`text-[10px] px-1.5 py-0.5 rounded border ${col.primaryKey ? 'bg-os-accent/20 text-os-accent border-os-accent/30' : 'text-os-text-muted border-white/10'}`}
                  >
                    PK
                  </button>
                  <button onClick={() => setNewColumns(newColumns.filter((_, idx) => idx !== i))} className="p-1 rounded hover:bg-white/10">
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setNewColumns([...newColumns, { name: '', type: 'TEXT', nullable: true, primaryKey: false }])}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 text-xs mb-3"
            >
              <Plus className="w-3 h-3" /> Add Column
            </button>
            <div className="flex items-center gap-2">
              <button onClick={createTable} className="flex-1 px-3 py-1.5 rounded bg-os-accent text-white text-xs font-semibold hover:bg-os-accent/90">
                Create
              </button>
              <button onClick={() => setCreatingTable(false)} className="flex-1 px-3 py-1.5 rounded border border-white/10 text-xs hover:bg-white/5">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
