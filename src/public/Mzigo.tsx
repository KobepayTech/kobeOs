// @ts-nocheck
import { useEffect, useState, useRef } from "react";
import {
  Package, Truck, Warehouse, MapPin, Phone, Loader2, Check, AlertTriangle,
  Send, ScanLine, RefreshCw, ChevronRight, Copy, ArrowRight, User, Building2,
  Plus, Printer, Settings,
} from "lucide-react";

/**
 * KobeOS · Mzigo — TZ ground-cargo digital waybill, public at /mzigo.
 *
 * Four roles in one page (picker on entry):
 *   1. PACKAGER    Fills the form, picks a cargo agent, gets a
 *                   waybill (KM-XXXXXX) printed on the parcel tag.
 *   2. AGENT       Browses unassigned parcels in their company, claims,
 *                   confirms pickup, earns commission points.
 *   3. WAREHOUSE   Marks parcels as at-warehouse, loads them onto a
 *                   truck (plate + driver), dispatches.
 *   4. DESTINATION Scans the truck plate → entire manifest auto-
 *                   confirms received, owners + recipients texted.
 *
 * Storage: every call hits the backend at /api/mzigo* so the four
 * roles can sit on four different devices and still see the same
 * parcel rows.
 */

const API_BASE = (typeof window !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE) || "/api";

const fmt = (n) => new Intl.NumberFormat("en-US").format(Math.round(Number(n) || 0));
const fmtDate = (iso) => iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

const STATUS = {
  REGISTERED: { label: "Awaiting agent", color: "bg-amber-100 text-amber-800" },
  AGENT_SELECTED: { label: "Agent assigned", color: "bg-amber-100 text-amber-800" },
  PICKED_UP: { label: "Picked up", color: "bg-blue-100 text-blue-800" },
  AT_WAREHOUSE: { label: "At warehouse", color: "bg-blue-100 text-blue-800" },
  ON_TRUCK: { label: "Loaded on truck", color: "bg-violet-100 text-violet-800" },
  IN_TRANSIT: { label: "In transit", color: "bg-violet-100 text-violet-800" },
  DELIVERED_DEST: { label: "Arrived — collect", color: "bg-emerald-100 text-emerald-800" },
  COLLECTED: { label: "Collected", color: "bg-slate-200 text-slate-700" },
};

async function call(path, opts) {
  const r = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(opts && opts.headers) },
    ...opts,
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.message || `HTTP ${r.status}`);
  return body;
}

export default function Mzigo() {
  const [role, setRole] = useState(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("kobe_mzigo_role") || null;
  });
  const setRoleP = (r) => { setRole(r); try { window.localStorage.setItem("kobe_mzigo_role", r || ""); } catch { /* private mode */ } };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-amber-100 text-slate-900">
      <header className="px-5 py-4 border-b border-amber-200/50 bg-white/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white grid place-items-center"><Package className="w-5 h-5" /></div>
            <div>
              <div className="font-extrabold text-base">KobeOS · Mzigo</div>
              <div className="text-[11px] text-amber-700/70">Digital cargo waybill — Tanzania</div>
            </div>
          </div>
          {role && (
            <button onClick={() => setRoleP(null)} className="text-[11px] text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Change role
            </button>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5">
        {!role ? <RolePicker onPick={setRoleP} /> :
          role === "packager"    ? <PackagerView /> :
          role === "agent"       ? <AgentView /> :
          role === "warehouse"   ? <WarehouseView /> :
          role === "destination" ? <DestinationView /> :
          role === "admin"       ? <AdminView /> : null}
      </main>
    </div>
  );
}

function RolePicker({ onPick }) {
  const ROLES = [
    { id: "packager", icon: Package, label: "Packager", desc: "I'm packing goods and sending them.", tone: "from-amber-400 to-orange-400" },
    { id: "agent", icon: User, label: "Pickup Agent", desc: "I collect goods from packagers and bring them to the cargo office.", tone: "from-blue-400 to-cyan-400" },
    { id: "warehouse", icon: Warehouse, label: "Warehouse / Office", desc: "I receive goods, load trucks, dispatch.", tone: "from-violet-400 to-indigo-400" },
    { id: "destination", icon: MapPin, label: "Destination Hub", desc: "I receive trucks at the destination and notify recipients.", tone: "from-emerald-400 to-teal-400" },
    { id: "admin", icon: Settings, label: "Admin / Setup", desc: "Register cargo companies and add agents.", tone: "from-rose-400 to-pink-400" },
  ];
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-extrabold mb-1">Who are you?</h1>
      <p className="text-sm text-slate-600 mb-4">Pick your role. You can change it anytime from the header.</p>
      {ROLES.map((r) => (
        <button key={r.id} onClick={() => onPick(r.id)} className={`w-full text-left rounded-2xl bg-gradient-to-br ${r.tone} text-white p-4 shadow-md active:opacity-90 flex items-center gap-4`}>
          <div className="w-12 h-12 rounded-xl bg-white/20 grid place-items-center shrink-0"><r.icon className="w-6 h-6" /></div>
          <div className="flex-1 min-w-0">
            <div className="font-extrabold text-base">{r.label}</div>
            <div className="text-xs opacity-90 mt-0.5">{r.desc}</div>
          </div>
          <ChevronRight className="w-5 h-5 opacity-70 shrink-0" />
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────── PACKAGER ─────────────────────────── */

function PackagerView() {
  const blank = {
    packagerName: "", packagerPhone: "",
    ownerName: "", ownerPhone: "",
    ownerEmergencyName: "", ownerEmergencyPhone: "",
    recipientName: "", recipientPhone: "", recipientEmergencyPhone: "",
    origin: "", destination: "",
    goodsType: "", weightKg: "", declaredValue: "", paymentAmount: "",
    agentId: "",
  };
  const [f, setF] = useState(blank);
  const [companies, setCompanies] = useState([]);
  const [agents, setAgents] = useState([]);
  const [companyFilter, setCompanyFilter] = useState("");
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => { call("/mzigo/companies").then(setCompanies).catch(() => {}); }, []);
  useEffect(() => {
    const q = companyFilter ? `?companyId=${encodeURIComponent(companyFilter)}` : "";
    call("/mzigo/agents" + q).then(setAgents).catch(() => setAgents([]));
  }, [companyFilter]);

  const submit = async () => {
    setBusy(true); setErr("");
    try {
      const parcel = await call("/mzigo/parcels", {
        method: "POST",
        body: JSON.stringify({
          ...f,
          weightKg: Number(f.weightKg) || 0,
          declaredValue: Number(f.declaredValue) || 0,
          paymentAmount: Number(f.paymentAmount) || 0,
          agentId: f.agentId || undefined,
        }),
      });
      setDone(parcel);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  if (done) return <PackagerReceipt parcel={done} onAnother={() => { setDone(null); setF(blank); }} />;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-extrabold">Register a parcel</h1>
      <p className="text-sm text-slate-600 mb-2">Fill in the goods owner, where they're going, who collects on the other side. You'll get a waybill code to stick on the package.</p>

      <Section title="Who packed">
        <Row2><Field label="Your name" value={f.packagerName} onChange={set("packagerName")} required /><Field label="Your phone" value={f.packagerPhone} onChange={set("packagerPhone")} required inputMode="tel" /></Row2>
      </Section>

      <Section title="Goods owner">
        <Row2><Field label="Owner name" value={f.ownerName} onChange={set("ownerName")} required /><Field label="Owner phone" value={f.ownerPhone} onChange={set("ownerPhone")} required inputMode="tel" /></Row2>
        <Row2><Field label="Emergency name (optional)" value={f.ownerEmergencyName} onChange={set("ownerEmergencyName")} /><Field label="Emergency phone (optional)" value={f.ownerEmergencyPhone} onChange={set("ownerEmergencyPhone")} inputMode="tel" /></Row2>
      </Section>

      <Section title="Where it's going">
        <Row2><Field label="From" value={f.origin} onChange={set("origin")} placeholder="Dar es Salaam" required /><Field label="To" value={f.destination} onChange={set("destination")} placeholder="Mwanza" required /></Row2>
        <Row2><Field label="Recipient name" value={f.recipientName} onChange={set("recipientName")} required /><Field label="Recipient phone" value={f.recipientPhone} onChange={set("recipientPhone")} required inputMode="tel" /></Row2>
        <Field label="Recipient emergency (optional)" value={f.recipientEmergencyPhone} onChange={set("recipientEmergencyPhone")} inputMode="tel" />
      </Section>

      <Section title="The parcel">
        <Row2><Field label="Goods type" value={f.goodsType} onChange={set("goodsType")} placeholder="Clothes, electronics…" /><Field label="Weight (kg)" value={f.weightKg} onChange={set("weightKg")} inputMode="decimal" /></Row2>
        <Row2><Field label="Declared value (TZS)" value={f.declaredValue} onChange={set("declaredValue")} inputMode="numeric" /><Field label="Payment (TZS)" value={f.paymentAmount} onChange={set("paymentAmount")} inputMode="numeric" /></Row2>
      </Section>

      <Section title="Pick the agent">
        <select value={companyFilter} onChange={(e) => { setCompanyFilter(e.target.value); setF({ ...f, agentId: "" }); }} className="w-full h-10 px-3 rounded-lg border border-amber-300 bg-white text-sm mb-2">
          <option value="">— any company —</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="max-h-64 overflow-y-auto space-y-1.5">
          {agents.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No agents — pick "any company" to see everyone, or skip and the parcel goes into the open pool.</p>
          ) : agents.map((a) => (
            <label key={a.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer ${f.agentId === a.id ? "border-amber-500 bg-amber-50" : "border-amber-200 bg-white"}`}>
              <input type="radio" checked={f.agentId === a.id} onChange={() => setF({ ...f, agentId: a.id })} className="accent-amber-500" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">{a.name}</div>
                <div className="text-[11px] text-slate-500"><Building2 className="w-3 h-3 inline mr-1" />{a.companyName}{a.area ? ` · ${a.area}` : ""}</div>
              </div>
              <div className="text-[11px] text-slate-500 text-right shrink-0"><Phone className="w-3 h-3 inline mr-1" />{a.phone}</div>
            </label>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 mt-2">Skip the agent pick to send to the open pool — the first available agent claims it.</p>
      </Section>

      {err && <div className="rounded-lg border border-rose-300 bg-rose-50 text-rose-800 text-xs p-2 inline-flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{err}</div>}
      <button onClick={submit} disabled={busy} className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 shadow-md">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Register parcel
      </button>
    </div>
  );
}

function PackagerReceipt({ parcel, onAnother }) {
  const [copied, setCopied] = useState(false);
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { /* clipboard blocked */ }
  };
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-white border-2 border-amber-300 p-5 shadow-md text-center">
        <div className="text-[10px] uppercase font-bold text-amber-700 tracking-widest mb-1">Waybill</div>
        <div className="text-4xl font-mono font-extrabold tracking-widest text-amber-700">{parcel.waybill}</div>
        <p className="text-xs text-slate-600 mt-3">Write this on the parcel tag.</p>
        <button onClick={() => copy(parcel.waybill)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-amber-700">
          {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy code</>}
        </button>
      </div>
      <div className="rounded-xl bg-white border border-amber-200 p-4 space-y-1.5 text-sm">
        <Pair k="Owner" v={`${parcel.ownerName} · ${parcel.ownerPhone}`} />
        <Pair k="Recipient" v={`${parcel.recipientName} · ${parcel.recipientPhone}`} />
        <Pair k="Route" v={`${parcel.origin} → ${parcel.destination}`} />
        <Pair k="Agent" v={parcel.agentName || "Open pool (first agent claims)"} />
        <Pair k="Goods" v={parcel.goodsType || "—"} />
        <Pair k="Status" v={STATUS[parcel.status]?.label ?? parcel.status} />
      </div>
      <a href={`/mzigo/track/${parcel.waybill}`} className="block text-center text-xs text-amber-700 font-bold underline">Open public tracking page</a>
      <button onClick={onAnother} className="w-full h-11 rounded-xl bg-amber-500 text-white font-extrabold text-sm">Register another parcel</button>
    </div>
  );
}

/* ─────────────────────────── AGENT ─────────────────────────── */

function AgentView() {
  const [agentId, setAgentId] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("kobe_mzigo_agent_id") || "";
  });
  const [agents, setAgents] = useState([]);
  const [open, setOpen] = useState([]);
  const [mine, setMine] = useState([]);
  const [busy, setBusy] = useState({});
  const [err, setErr] = useState("");

  useEffect(() => { call("/mzigo/agents").then(setAgents).catch(() => {}); }, []);
  const reload = async () => {
    try { setOpen(await call("/mzigo/parcels/open")); } catch { /* ignore */ }
    if (agentId) try { setMine(await call(`/mzigo/agents/${agentId}/assignments`)); } catch { /* ignore */ }
  };
  useEffect(() => { void reload(); }, [agentId]);

  const pickAgent = (id) => { setAgentId(id); try { window.localStorage.setItem("kobe_mzigo_agent_id", id); } catch { /* private */ } };

  const doAction = async (waybill, kind) => {
    setBusy({ ...busy, [waybill]: true }); setErr("");
    try {
      await call(`/mzigo/parcels/${waybill}/${kind}`, { method: "POST", body: JSON.stringify({ agentId }) });
      await reload();
    } catch (e) { setErr(e.message); }
    setBusy({ ...busy, [waybill]: false });
  };

  if (!agentId) return (
    <div className="space-y-3">
      <h1 className="text-xl font-extrabold">Who's logged in?</h1>
      <p className="text-sm text-slate-600 mb-2">Pick your agent record. We'll remember it on this device.</p>
      {agents.map((a) => (
        <button key={a.id} onClick={() => pickAgent(a.id)} className="w-full text-left rounded-xl bg-white border border-blue-200 p-3 flex items-center gap-3 hover:bg-blue-50">
          <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 grid place-items-center"><User className="w-5 h-5" /></div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm">{a.name}</div>
            <div className="text-[11px] text-slate-500 truncate">{a.companyName} · {a.area || "—"} · {a.phone}</div>
          </div>
          <div className="text-[10px] bg-blue-100 text-blue-700 rounded px-2 py-0.5 font-bold">{a.commissionPoints} pts</div>
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-extrabold inline-flex items-center gap-2">My pickups <RefreshCw className="w-4 h-4 cursor-pointer text-slate-500" onClick={reload} /></h1>

      {err && <div className="rounded-lg border border-rose-300 bg-rose-50 text-rose-800 text-xs p-2">{err}</div>}

      {mine.length > 0 && (
        <div>
          <h2 className="text-[11px] uppercase font-bold tracking-wide text-slate-500 mb-2">Assigned to you ({mine.length})</h2>
          {mine.map((p) => (
            <ParcelCard key={p.waybill} parcel={p} actionLabel={p.status === "AGENT_SELECTED" ? "Mark picked up" : "Already picked up"}
              actionDisabled={p.status !== "AGENT_SELECTED" || busy[p.waybill]}
              onAction={() => doAction(p.waybill, "picked-up")}
            />
          ))}
        </div>
      )}

      <h2 className="text-[11px] uppercase font-bold tracking-wide text-slate-500 mt-4 mb-2">Open pool ({open.length})</h2>
      {open.length === 0 ? <p className="text-xs text-slate-500 italic">Nothing open. Pull to refresh.</p> :
        open.map((p) => (
          <ParcelCard key={p.waybill} parcel={p} actionLabel="Claim this parcel"
            actionDisabled={busy[p.waybill]} onAction={() => doAction(p.waybill, "claim")} />
        ))}
    </div>
  );
}

/* ─────────────────────────── WAREHOUSE ─────────────────────────── */

function WarehouseView() {
  const [queue, setQueue] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [truck, setTruck] = useState({ truckPlate: "", driverName: "", driverPhone: "", origin: "", destination: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const [dispatched, setDispatched] = useState(null);

  const reload = async () => { try { setQueue(await call("/mzigo/warehouse/queue")); } catch { /* ignore */ } };
  useEffect(() => { void reload(); }, []);

  const markArrived = async (waybill) => {
    try { await call(`/mzigo/parcels/${waybill}/at-warehouse`, { method: "POST", body: "{}" }); await reload(); }
    catch (e) { setErr(e.message); }
  };

  const toggle = (waybill) => {
    const next = new Set(selected);
    if (next.has(waybill)) next.delete(waybill); else next.add(waybill);
    setSelected(next);
  };

  const load = async () => {
    setBusy(true); setErr(""); setDone("");
    try {
      await call("/mzigo/trucks/load", { method: "POST", body: JSON.stringify({ ...truck, waybills: Array.from(selected) }) });
      await call(`/mzigo/trucks/${encodeURIComponent(truck.truckPlate)}/dispatch`, { method: "POST", body: "{}" });
      const loadedParcels = queue.filter((p) => selected.has(p.waybill));
      setDispatched({ truck: { ...truck, truckPlate: truck.truckPlate.toUpperCase() }, parcels: loadedParcels, dispatchedAt: new Date().toISOString() });
      setDone(`Truck ${truck.truckPlate.toUpperCase()} dispatched with ${selected.size} parcels`);
      setSelected(new Set());
      setTruck({ truckPlate: "", driverName: "", driverPhone: "", origin: "", destination: "" });
      await reload();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  if (dispatched) return <DispatchedManifest data={dispatched} onContinue={() => setDispatched(null)} />;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-extrabold inline-flex items-center gap-2">Warehouse queue <RefreshCw className="w-4 h-4 cursor-pointer text-slate-500" onClick={reload} /></h1>
      {err && <div className="rounded-lg border border-rose-300 bg-rose-50 text-rose-800 text-xs p-2">{err}</div>}
      {done && <div className="rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs p-2 inline-flex items-center gap-2"><Check className="w-4 h-4" />{done}</div>}

      {queue.length === 0 ? <p className="text-xs text-slate-500 italic">Nothing here yet.</p> :
        queue.map((p) => (
          <div key={p.waybill} className={`rounded-xl border p-3 ${selected.has(p.waybill) ? "border-violet-500 bg-violet-50" : "border-violet-200 bg-white"}`}>
            <div className="flex items-center gap-3">
              {p.status === "AT_WAREHOUSE" && <input type="checkbox" checked={selected.has(p.waybill)} onChange={() => toggle(p.waybill)} className="accent-violet-500 w-5 h-5" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm">{p.waybill}</span>
                  <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${STATUS[p.status]?.color ?? "bg-slate-100"}`}>{STATUS[p.status]?.label ?? p.status}</span>
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">{p.ownerName} · {p.origin} → {p.destination} · {p.weightKg ? `${p.weightKg} kg` : ""}</div>
              </div>
            </div>
            {p.status === "PICKED_UP" && (
              <button onClick={() => markArrived(p.waybill)} className="mt-2 w-full h-9 rounded-lg bg-violet-500 text-white text-xs font-bold">Mark arrived at warehouse</button>
            )}
          </div>
        ))}

      {selected.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-violet-300 p-4 shadow-2xl space-y-2 z-30">
          <div className="text-xs font-bold text-violet-700">Load {selected.size} parcels onto truck</div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Truck plate" value={truck.truckPlate} onChange={(e) => setTruck({ ...truck, truckPlate: e.target.value })} placeholder="T123 ABC" />
            <Field label="Driver name" value={truck.driverName} onChange={(e) => setTruck({ ...truck, driverName: e.target.value })} />
            <Field label="Driver phone" value={truck.driverPhone} onChange={(e) => setTruck({ ...truck, driverPhone: e.target.value })} inputMode="tel" />
            <Field label="Trip from → to" value={truck.origin} onChange={(e) => setTruck({ ...truck, origin: e.target.value })} placeholder="Dar" />
          </div>
          <Field label="Destination" value={truck.destination} onChange={(e) => setTruck({ ...truck, destination: e.target.value })} placeholder="Mwanza" />
          <button onClick={load} disabled={busy || !truck.truckPlate.trim() || !truck.driverName.trim()} className="w-full h-11 rounded-xl bg-violet-600 text-white font-extrabold text-sm disabled:opacity-40">
            {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Load & dispatch"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── DESTINATION ─────────────────────────── */

function DestinationView() {
  const [plate, setPlate] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);

  const canScan = typeof window !== "undefined" && "BarcodeDetector" in window;

  const stopScan = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setScanning(false);
  };
  useEffect(() => () => stopScan(), []);

  const receive = async (raw) => {
    const p = (raw || plate).trim().toUpperCase().replace(/\s+/g, "");
    if (!p) return;
    setBusy(true); setErr("");
    try {
      const res = await call(`/mzigo/trucks/${encodeURIComponent(p)}/receive`, { method: "POST", body: "{}" });
      setResult(res);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const startScan = async () => {
    setErr(""); setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      const det = new window.BarcodeDetector({ formats: ["qr_code"] });
      const tick = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const found = await det.detect(videoRef.current);
          if (found?.length) { const raw = found[0].rawValue || ""; stopScan(); receive(raw); return; }
        } catch { /* keep scanning */ }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch { stopScan(); setErr("Camera unavailable — type the plate by hand."); }
  };

  if (result) return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-emerald-500 text-white p-5 text-center">
        <Check className="w-14 h-14 mx-auto mb-2" />
        <div className="text-2xl font-extrabold">Truck received</div>
        <p className="text-sm opacity-90 mt-1">{result.parcels.length} parcels marked delivered. Recipients have been notified by SMS.</p>
      </div>
      <div className="rounded-xl bg-white border border-emerald-200 p-3 space-y-2">
        <div className="text-xs font-bold text-emerald-700">Manifest — {result.manifest.truckPlate}</div>
        {result.parcels.map((p) => (
          <div key={p.waybill} className="text-xs border-b border-emerald-100 last:border-0 py-1.5 flex items-center justify-between">
            <div className="min-w-0">
              <div className="font-mono font-bold">{p.waybill}</div>
              <div className="text-[10px] text-slate-500 truncate">{p.recipientName} · {p.recipientPhone}</div>
            </div>
            <span className="text-[9px] bg-emerald-100 text-emerald-700 rounded px-1.5 py-0.5 font-bold">delivered</span>
          </div>
        ))}
      </div>
      <button onClick={() => { setResult(null); setPlate(""); }} className="w-full h-11 rounded-xl bg-emerald-500 text-white font-extrabold text-sm">Receive another truck</button>
    </div>
  );

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-extrabold">Receive a truck</h1>
      <p className="text-sm text-slate-600">Scan the truck plate or type it. All parcels on the truck will be marked delivered and recipients texted.</p>

      <div className="rounded-2xl bg-white border-2 border-emerald-300 p-5">
        <label className="text-[10px] uppercase font-bold text-slate-500">Truck plate</label>
        <input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="T123 ABC"
          className="w-full h-14 mt-1 px-3 rounded-xl bg-emerald-50 border-2 border-emerald-200 font-mono text-2xl font-extrabold tracking-widest text-center" />
      </div>

      {err && <div className="rounded-lg border border-rose-300 bg-rose-50 text-rose-800 text-xs p-2 inline-flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{err}</div>}

      <div className="flex gap-2">
        <button onClick={() => receive()} disabled={busy || !plate.trim()} className="flex-1 h-12 rounded-xl bg-emerald-600 text-white font-extrabold text-sm disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Confirm received"}
        </button>
        {canScan && (
          <button onClick={startScan} className="h-12 px-4 rounded-xl bg-white border-2 border-emerald-300 text-emerald-700 font-extrabold text-sm inline-flex items-center gap-1">
            <ScanLine className="w-4 h-4" /> Scan
          </button>
        )}
      </div>

      {scanning && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
          <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
          <div className="relative z-10 w-72 h-72 border-4 border-white rounded-2xl" />
          <div className="relative z-10 text-white mt-6 text-sm font-bold">Point at the truck-plate QR or barcode</div>
          <button onClick={stopScan} className="relative z-10 mt-4 px-5 py-2 bg-white/20 text-white rounded-lg border border-white/40">Cancel</button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── ADMIN ─────────────────────────── */

function AdminView() {
  const [companies, setCompanies] = useState([]);
  const [agentsByCompany, setAgentsByCompany] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: "", phone: "", headOffice: "" });
  const [showAgentFor, setShowAgentFor] = useState("");
  const [newAgent, setNewAgent] = useState({ name: "", phone: "", area: "" });

  const reload = async () => {
    try {
      const cos = await call("/mzigo/companies");
      setCompanies(cos);
      const map = {};
      await Promise.all(cos.map(async (c) => {
        try { map[c.id] = await call(`/mzigo/agents?companyId=${encodeURIComponent(c.id)}`); }
        catch { map[c.id] = []; }
      }));
      setAgentsByCompany(map);
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { void reload(); }, []);

  const submitCompany = async () => {
    if (!newCompany.name.trim()) return;
    setBusy(true); setErr("");
    try {
      await call("/mzigo/companies", { method: "POST", body: JSON.stringify(newCompany) });
      setNewCompany({ name: "", phone: "", headOffice: "" });
      setShowCompanyForm(false);
      await reload();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const submitAgent = async (companyId) => {
    if (!newAgent.name.trim() || !newAgent.phone.trim()) return;
    setBusy(true); setErr("");
    try {
      await call("/mzigo/agents", { method: "POST", body: JSON.stringify({ ...newAgent, companyId }) });
      setNewAgent({ name: "", phone: "", area: "" });
      setShowAgentFor("");
      await reload();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-extrabold inline-flex items-center gap-2">
        Cargo companies <RefreshCw className="w-4 h-4 cursor-pointer text-slate-500" onClick={reload} />
      </h1>
      <p className="text-sm text-slate-600">Register a company and its pickup agents. Agents show up in the packager's pick list.</p>

      {err && <div className="rounded-lg border border-rose-300 bg-rose-50 text-rose-800 text-xs p-2 inline-flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{err}</div>}

      {!showCompanyForm ? (
        <button onClick={() => setShowCompanyForm(true)} className="w-full h-10 rounded-xl bg-rose-500 text-white font-bold text-sm inline-flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Add company
        </button>
      ) : (
        <div className="rounded-xl bg-white border-2 border-rose-300 p-3 space-y-2">
          <div className="text-[10px] uppercase font-bold tracking-wide text-rose-700">New cargo company</div>
          <Field label="Company name" value={newCompany.name} onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })} required />
          <Row2>
            <Field label="Phone (office)" value={newCompany.phone} onChange={(e) => setNewCompany({ ...newCompany, phone: e.target.value })} inputMode="tel" />
            <Field label="Head office" value={newCompany.headOffice} onChange={(e) => setNewCompany({ ...newCompany, headOffice: e.target.value })} placeholder="Dar es Salaam" />
          </Row2>
          <div className="flex gap-2 pt-1">
            <button onClick={() => { setShowCompanyForm(false); setNewCompany({ name: "", phone: "", headOffice: "" }); }} className="flex-1 h-9 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">Cancel</button>
            <button onClick={submitCompany} disabled={busy || !newCompany.name.trim()} className="flex-1 h-9 rounded-lg bg-rose-500 text-white text-xs font-bold disabled:opacity-50">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : "Save company"}
            </button>
          </div>
        </div>
      )}

      {companies.length === 0 ? (
        <p className="text-xs text-slate-500 italic">No companies yet. Add the first one.</p>
      ) : companies.map((c) => {
        const agents = agentsByCompany[c.id] || [];
        const isAdding = showAgentFor === c.id;
        return (
          <div key={c.id} className="rounded-xl bg-white border border-rose-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="min-w-0">
                <div className="font-bold text-sm flex items-center gap-1.5"><Building2 className="w-4 h-4 text-rose-500" />{c.name}</div>
                <div className="text-[11px] text-slate-500">{c.headOffice || "—"}{c.phone ? ` · ${c.phone}` : ""}</div>
              </div>
              <span className="text-[10px] bg-rose-100 text-rose-700 rounded px-1.5 py-0.5 font-bold">{agents.length} agents</span>
            </div>
            {agents.length > 0 && (
              <div className="space-y-1 mb-2">
                {agents.map((a) => (
                  <div key={a.id} className="text-[11px] flex items-center justify-between border-t border-rose-100 pt-1.5">
                    <div className="min-w-0">
                      <span className="font-bold">{a.name}</span>
                      <span className="text-slate-500"> · {a.phone}{a.area ? ` · ${a.area}` : ""}</span>
                    </div>
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 rounded px-1.5 py-0.5 font-bold">{a.commissionPoints} pts</span>
                  </div>
                ))}
              </div>
            )}
            {!isAdding ? (
              <button onClick={() => setShowAgentFor(c.id)} className="w-full h-8 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold inline-flex items-center justify-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add agent
              </button>
            ) : (
              <div className="rounded-lg border border-rose-200 p-2 space-y-1.5 mt-1">
                <Row2>
                  <Field label="Agent name" value={newAgent.name} onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })} required />
                  <Field label="Phone" value={newAgent.phone} onChange={(e) => setNewAgent({ ...newAgent, phone: e.target.value })} required inputMode="tel" />
                </Row2>
                <Field label="Area / stand (optional)" value={newAgent.area} onChange={(e) => setNewAgent({ ...newAgent, area: e.target.value })} placeholder="Stand 14, Tabata" />
                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setShowAgentFor(""); setNewAgent({ name: "", phone: "", area: "" }); }} className="flex-1 h-8 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">Cancel</button>
                  <button onClick={() => submitAgent(c.id)} disabled={busy || !newAgent.name.trim() || !newAgent.phone.trim()} className="flex-1 h-8 rounded-lg bg-rose-500 text-white text-xs font-bold disabled:opacity-50">
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : "Save agent"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────── DISPATCHED MANIFEST (printable) ─────────────────── */

function DispatchedManifest({ data, onContinue }) {
  useEffect(() => {
    const prev = document.title;
    document.title = `Manifest — ${data.truck.truckPlate}`;
    return () => { document.title = prev; };
  }, [data.truck.truckPlate]);

  return (
    <div className="space-y-3">
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-sheet { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="no-print rounded-2xl bg-emerald-500 text-white p-4 text-center">
        <Check className="w-10 h-10 mx-auto mb-1" />
        <div className="text-base font-extrabold">Truck dispatched</div>
        <div className="text-xs opacity-90 mt-0.5">Print the manifest and give a copy to the driver.</div>
      </div>

      <div className="print-sheet rounded-xl bg-white border-2 border-slate-300 p-5 shadow-md text-slate-900">
        <div className="flex items-start justify-between border-b-2 border-slate-300 pb-3 mb-3">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">KobeOS · Mzigo</div>
            <div className="text-xl font-extrabold mt-0.5">Truck Manifest</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-slate-500">Dispatched</div>
            <div className="text-xs font-bold">{fmtDate(data.dispatchedAt)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs mb-4">
          <Pair k="Truck plate" v={<span className="font-mono text-base">{data.truck.truckPlate}</span>} />
          <Pair k="Parcels" v={`${data.parcels.length}`} />
          <Pair k="Driver" v={data.truck.driverName} />
          <Pair k="Driver phone" v={data.truck.driverPhone || "—"} />
          <Pair k="Origin" v={data.truck.origin || "—"} />
          <Pair k="Destination" v={data.truck.destination || "—"} />
        </div>

        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="bg-slate-100 text-left">
              <th className="border border-slate-300 px-2 py-1 font-bold">#</th>
              <th className="border border-slate-300 px-2 py-1 font-bold">Waybill</th>
              <th className="border border-slate-300 px-2 py-1 font-bold">Owner</th>
              <th className="border border-slate-300 px-2 py-1 font-bold">Recipient · Phone</th>
              <th className="border border-slate-300 px-2 py-1 font-bold text-right">Wt (kg)</th>
              <th className="border border-slate-300 px-2 py-1 font-bold">Signature</th>
            </tr>
          </thead>
          <tbody>
            {data.parcels.map((p, i) => (
              <tr key={p.waybill}>
                <td className="border border-slate-300 px-2 py-1.5">{i + 1}</td>
                <td className="border border-slate-300 px-2 py-1.5 font-mono font-bold">{p.waybill}</td>
                <td className="border border-slate-300 px-2 py-1.5">{p.ownerName}</td>
                <td className="border border-slate-300 px-2 py-1.5">{p.recipientName} · {p.recipientPhone}</td>
                <td className="border border-slate-300 px-2 py-1.5 text-right">{p.weightKg || "—"}</td>
                <td className="border border-slate-300 px-2 py-1.5 w-20"></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="grid grid-cols-2 gap-6 mt-8 text-xs">
          <div>
            <div className="border-t border-slate-400 pt-1 text-center">Warehouse officer</div>
          </div>
          <div>
            <div className="border-t border-slate-400 pt-1 text-center">Driver — {data.truck.driverName}</div>
          </div>
        </div>
      </div>

      <div className="no-print flex gap-2">
        <button onClick={() => window.print()} className="flex-1 h-11 rounded-xl bg-violet-600 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2">
          <Printer className="w-4 h-4" /> Print manifest
        </button>
        <button onClick={onContinue} className="flex-1 h-11 rounded-xl bg-white border-2 border-violet-300 text-violet-700 font-extrabold text-sm">
          Done
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────── helpers ─────────────────────────── */

function Field({ label, required, ...rest }) {
  return (
    <div>
      <label className="text-[10px] uppercase font-bold text-slate-500">{label}{required && <span className="text-rose-500 ml-0.5">*</span>}</label>
      <input {...rest} className="w-full h-10 px-3 mt-1 rounded-lg border border-amber-300 bg-white text-sm" />
    </div>
  );
}
function Row2({ children }) { return <div className="grid grid-cols-2 gap-2">{children}</div>; }
function Section({ title, children }) {
  return (
    <div className="rounded-xl bg-white border border-amber-200 p-3 space-y-2">
      <div className="text-[10px] uppercase font-bold tracking-wide text-amber-700">{title}</div>
      {children}
    </div>
  );
}
function Pair({ k, v }) { return <div className="flex justify-between text-xs"><span className="text-slate-500">{k}</span><span className="font-bold text-right">{v}</span></div>; }

function ParcelCard({ parcel, actionLabel, actionDisabled, onAction }) {
  return (
    <div className="rounded-xl border border-blue-200 bg-white p-3 mb-2">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono font-bold text-sm">{parcel.waybill}</span>
        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${STATUS[parcel.status]?.color ?? ""}`}>{STATUS[parcel.status]?.label ?? parcel.status}</span>
      </div>
      <div className="text-[11px] text-slate-600">{parcel.ownerName} · {parcel.packagerPhone} <ArrowRight className="w-3 h-3 inline" /> {parcel.recipientName}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{parcel.origin} → {parcel.destination}{parcel.weightKg ? ` · ${parcel.weightKg} kg` : ""}</div>
      <button onClick={onAction} disabled={actionDisabled} className="mt-2 w-full h-9 rounded-lg bg-blue-500 text-white text-xs font-bold disabled:opacity-40">
        {actionLabel}
      </button>
    </div>
  );
}
