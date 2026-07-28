import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Copy,
  DoorOpen,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';

interface LayoutUnit {
  unitNumber: string;
  type: string;
  floor: string;
  corridor: string;
  corridorSide: 'left' | 'right' | 'end' | 'single';
  layoutPosition: number;
  bedrooms: number;
  bathrooms: number;
  rentAmount: number;
  currency: string;
  status: 'vacant';
}

interface LayoutProposal {
  summary: string;
  source: 'ai' | 'planner';
  units: LayoutUnit[];
  warnings?: string[];
}

interface CreatedResult {
  property: { id: string; name: string };
  units: Array<{ id: string; unitNumber: string }>;
}

interface Props {
  onCancel: () => void;
  onCreated: (result: CreatedResult) => void;
}

const inputClass = 'w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const labelClass = 'block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1';

function makeManualUnits(options: {
  floors: number;
  roomsPerFloor: number;
  startingRoom: number;
  centralCorridor: boolean;
  defaultType: string;
  defaultRent: number;
}): LayoutUnit[] {
  const units: LayoutUnit[] = [];
  const baseHundreds = Math.floor(options.startingRoom / 100);
  const suffix = options.startingRoom % 100;
  for (let floor = 0; floor < options.floors; floor += 1) {
    for (let position = 0; position < options.roomsPerFloor; position += 1) {
      units.push({
        unitNumber: String((baseHundreds + floor) * 100 + suffix + position),
        type: options.defaultType || 'Standard',
        floor: `Floor ${floor + 1}`,
        corridor: options.centralCorridor ? 'Central corridor' : 'Main corridor',
        corridorSide: options.centralCorridor ? (position % 2 === 0 ? 'left' : 'right') : 'single',
        layoutPosition: position,
        bedrooms: 1,
        bathrooms: 1,
        rentAmount: options.defaultRent,
        currency: 'TZS',
        status: 'vacant',
      });
    }
  }
  return units;
}

export default function PropertyOnboardingWizard({ onCancel, onCreated }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [property, setProperty] = useState({
    name: '',
    address: '',
    city: '',
    plotNo: '',
    blockNo: '',
    type: 'residential' as 'residential' | 'commercial' | 'mixed',
    imageUrl: '',
    notes: '',
  });
  const [layout, setLayout] = useState({
    floors: 1,
    roomsPerFloor: 6,
    startingRoom: 101,
    centralCorridor: true,
    defaultType: 'Standard',
    defaultRent: 0,
  });
  const [prompt, setPrompt] = useState('');
  const [units, setUnits] = useState<LayoutUnit[]>([]);
  const [proposalSource, setProposalSource] = useState<'ai' | 'planner' | 'manual'>('manual');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [planning, setPlanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const floors = useMemo(() => {
    const grouped = new Map<string, LayoutUnit[]>();
    units.forEach((unit) => {
      const current = grouped.get(unit.floor) ?? [];
      current.push(unit);
      grouped.set(unit.floor, current);
    });
    return [...grouped.entries()].map(([name, floorUnits]) => ({
      name,
      units: [...floorUnits].sort((a, b) => a.layoutPosition - b.layoutPosition),
    }));
  }, [units]);

  const duplicateNumbers = useMemo(() => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    units.forEach((unit) => {
      const key = unit.unitNumber.trim().toLowerCase();
      if (seen.has(key)) duplicates.add(key);
      seen.add(key);
    });
    return duplicates;
  }, [units]);

  const generateManual = () => {
    setError(null);
    const count = layout.floors * layout.roomsPerFloor;
    if (count < 1 || count > 500) {
      setError('Choose between 1 and 500 rooms in one property.');
      return;
    }
    setUnits(makeManualUnits(layout));
    setProposalSource('manual');
    setWarnings([]);
  };

  const generateWithAi = async () => {
    setError(null);
    if (!prompt.trim()) {
      setError('Describe the property layout first.');
      return;
    }
    setPlanning(true);
    try {
      const proposal = await api<LayoutProposal>('/property/layout/proposal', {
        method: 'POST',
        body: JSON.stringify({
          prompt: prompt.trim(),
          startingRoom: String(layout.startingRoom),
          defaultRent: layout.defaultRent,
          defaultType: layout.defaultType,
        }),
      });
      setUnits(proposal.units ?? []);
      setProposalSource(proposal.source);
      setWarnings(proposal.warnings ?? []);
      setStep(2);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create a layout proposal.');
    } finally {
      setPlanning(false);
    }
  };

  const updateUnit = (index: number, patch: Partial<LayoutUnit>) => {
    setUnits((current) => current.map((unit, i) => (i === index ? { ...unit, ...patch } : unit)));
  };

  const removeUnit = (index: number) => {
    setUnits((current) => current.filter((_, i) => i !== index));
  };

  const addUnit = () => {
    const last = units[units.length - 1];
    const number = last && /^\d+$/.test(last.unitNumber) ? String(Number(last.unitNumber) + 1) : `Room ${units.length + 1}`;
    setUnits((current) => current.concat({
      unitNumber: number,
      type: last?.type || layout.defaultType || 'Standard',
      floor: last?.floor || 'Floor 1',
      corridor: last?.corridor || 'Main corridor',
      corridorSide: last?.corridorSide === 'left' ? 'right' : 'left',
      layoutPosition: (last?.layoutPosition ?? current.length - 1) + 1,
      bedrooms: last?.bedrooms ?? 1,
      bathrooms: last?.bathrooms ?? 1,
      rentAmount: last?.rentAmount ?? layout.defaultRent,
      currency: 'TZS',
      status: 'vacant',
    }));
  };

  const duplicateFloor = (floorName: string) => {
    const source = units.filter((unit) => unit.floor === floorName);
    if (!source.length) return;
    const nextFloorNumber = floors.length + 1;
    const nextFloor = `Floor ${nextFloorNumber}`;
    const numbers = units.map((unit) => Number(unit.unitNumber)).filter(Number.isFinite);
    const nextStart = numbers.length ? Math.max(...numbers) + 1 : nextFloorNumber * 100 + 1;
    const copied = source.map((unit, index) => ({
      ...unit,
      unitNumber: String(nextStart + index),
      floor: nextFloor,
    }));
    setUnits((current) => current.concat(copied));
  };

  const goToLayout = () => {
    setError(null);
    if (!property.name.trim()) {
      setError('Property name is required.');
      return;
    }
    if (!units.length) generateManual();
    setStep(2);
  };

  const goToReview = () => {
    setError(null);
    if (!units.length) {
      setError('Add at least one room.');
      return;
    }
    if (duplicateNumbers.size) {
      setError(`Duplicate room number: ${[...duplicateNumbers][0]}`);
      return;
    }
    if (units.some((unit) => !unit.unitNumber.trim())) {
      setError('Every room needs a number or name.');
      return;
    }
    setStep(3);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await api<CreatedResult>('/property/properties/onboard', {
        method: 'POST',
        body: JSON.stringify({
          property: {
            ...property,
            name: property.name.trim(),
            totalUnits: units.length,
          },
          units,
          layoutPrompt: prompt.trim() || undefined,
        }),
      });
      onCreated(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create the property. Nothing was saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur px-5 py-3">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <button onClick={onCancel} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Back to properties">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-extrabold">Add property and rooms</h1>
            <p className="text-xs text-slate-500">Create the building, corridors, and all rooms in one transaction.</p>
          </div>
          <div className="hidden items-center gap-1 text-xs font-bold sm:flex">
            {[1, 2, 3].map((item) => (
              <div key={item} className={`rounded-full px-3 py-1.5 ${step === item ? 'bg-blue-600 text-white' : step > item ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {step > item ? <Check className="mr-1 inline h-3 w-3" /> : null}{item}. {item === 1 ? 'Property' : item === 2 ? 'Rooms' : 'Review'}
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-5">
        {step === 1 && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><Building2 className="h-5 w-5" /></div>
                <div><h2 className="font-extrabold">Property details</h2><p className="text-xs text-slate-500">The room-layout step opens immediately after this.</p></div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="md:col-span-2"><span className={labelClass}>Property name *</span><input className={inputClass} value={property.name} onChange={(e) => setProperty({ ...property, name: e.target.value })} placeholder="Kobe Apartments" /></label>
                <label className="md:col-span-2"><span className={labelClass}>Address</span><input className={inputClass} value={property.address} onChange={(e) => setProperty({ ...property, address: e.target.value })} placeholder="Plot 12, Mbezi Beach" /></label>
                <label><span className={labelClass}>City</span><input className={inputClass} value={property.city} onChange={(e) => setProperty({ ...property, city: e.target.value })} placeholder="Dar es Salaam" /></label>
                <label><span className={labelClass}>Property type</span><select className={inputClass} value={property.type} onChange={(e) => setProperty({ ...property, type: e.target.value as typeof property.type })}><option value="residential">Residential</option><option value="commercial">Commercial</option><option value="mixed">Mixed use</option></select></label>
                <label><span className={labelClass}>Plot number</span><input className={inputClass} value={property.plotNo} onChange={(e) => setProperty({ ...property, plotNo: e.target.value })} /></label>
                <label><span className={labelClass}>Block number</span><input className={inputClass} value={property.blockNo} onChange={(e) => setProperty({ ...property, blockNo: e.target.value })} /></label>
                <label className="md:col-span-2"><span className={labelClass}>Cover image URL</span><input className={inputClass} value={property.imageUrl} onChange={(e) => setProperty({ ...property, imageUrl: e.target.value })} placeholder="https://…" /></label>
              </div>
            </section>

            <section className="rounded-2xl border border-violet-200 bg-gradient-to-b from-violet-50 to-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-violet-700"><Sparkles className="h-5 w-5" /><h2 className="font-extrabold">AI room-layout assistant</h2></div>
              <p className="mb-3 text-xs leading-relaxed text-slate-600">Describe the floors, corridors, room count, and numbering. Kobe AI returns a structured proposal for you to review before anything is saved.</p>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={6} className="w-full rounded-xl border border-violet-200 bg-white p-3 text-sm outline-none focus:border-violet-500" placeholder="Example: 3 floors, central corridor, 10 rooms on each floor, rooms 101–110, 201–210 and 301–310." />
              <button onClick={generateWithAi} disabled={planning} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50">
                {planning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{planning ? 'Planning…' : 'Generate AI proposal'}
              </button>
              <div className="my-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400"><span className="h-px flex-1 bg-slate-200" />or use exact controls<span className="h-px flex-1 bg-slate-200" /></div>
              <div className="grid grid-cols-2 gap-3">
                <label><span className={labelClass}>Floors</span><input type="number" min={1} max={50} className={inputClass} value={layout.floors} onChange={(e) => setLayout({ ...layout, floors: Math.max(1, Number(e.target.value)) })} /></label>
                <label><span className={labelClass}>Rooms/floor</span><input type="number" min={1} max={100} className={inputClass} value={layout.roomsPerFloor} onChange={(e) => setLayout({ ...layout, roomsPerFloor: Math.max(1, Number(e.target.value)) })} /></label>
                <label><span className={labelClass}>Starting room</span><input type="number" className={inputClass} value={layout.startingRoom} onChange={(e) => setLayout({ ...layout, startingRoom: Number(e.target.value) || 101 })} /></label>
                <label><span className={labelClass}>Monthly rent</span><input type="number" min={0} className={inputClass} value={layout.defaultRent} onChange={(e) => setLayout({ ...layout, defaultRent: Math.max(0, Number(e.target.value)) })} /></label>
                <label className="col-span-2"><span className={labelClass}>Room type</span><input className={inputClass} value={layout.defaultType} onChange={(e) => setLayout({ ...layout, defaultType: e.target.value })} /></label>
              </div>
              <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={layout.centralCorridor} onChange={(e) => setLayout({ ...layout, centralCorridor: e.target.checked })} /> Rooms on both sides of a central corridor</label>
              <button onClick={() => { generateManual(); setStep(2); }} className="mt-3 h-10 w-full rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50">Generate exact layout</button>
            </section>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-lg font-extrabold">Room and corridor layout</h2><p className="text-xs text-slate-500">{units.length} rooms · {floors.length} floors · proposal: {proposalSource}</p></div>
              <div className="flex gap-2"><button onClick={addUnit} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold"><Plus className="h-3.5 w-3.5" />Add room</button><button onClick={goToReview} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white">Review<ArrowRight className="h-3.5 w-3.5" /></button></div>
            </div>
            {warnings.map((warning) => <div key={warning} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{warning}</div>)}
            {floors.map((floor) => {
              const left = floor.units.filter((unit) => unit.corridorSide === 'left' || unit.corridorSide === 'single');
              const right = floor.units.filter((unit) => unit.corridorSide === 'right' || unit.corridorSide === 'end');
              return (
                <section key={floor.name} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between"><div><h3 className="font-extrabold">{floor.name}</h3><p className="text-[11px] text-slate-500">{floor.units.length} rooms</p></div><button onClick={() => duplicateFloor(floor.name)} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600"><Copy className="h-3.5 w-3.5" />Duplicate floor</button></div>
                  <div className="grid min-w-[680px] grid-cols-[1fr_92px_1fr] gap-3 overflow-x-auto rounded-xl bg-slate-100 p-3">
                    <RoomColumn units={left} allUnits={units} duplicates={duplicateNumbers} onUpdate={updateUnit} onRemove={removeUnit} />
                    <div className="flex min-h-40 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-200/70 px-2 text-center text-[10px] font-extrabold uppercase tracking-widest text-slate-500 [writing-mode:vertical-rl]">{floor.units[0]?.corridor || 'Corridor'}</div>
                    <RoomColumn units={right} allUnits={units} duplicates={duplicateNumbers} onUpdate={updateUnit} onRemove={removeUnit} />
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-extrabold">Review before creation</h2>
              <p className="mb-5 text-xs text-slate-500">The property and all rooms are saved atomically. A failure rolls back everything.</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><SummaryCard label="Property" value={property.name} /><SummaryCard label="Floors" value={String(floors.length)} /><SummaryCard label="Rooms" value={String(units.length)} /><SummaryCard label="Monthly potential" value={`TZS ${units.reduce((sum, unit) => sum + Number(unit.rentAmount || 0), 0).toLocaleString()}`} /></div>
              <div className="mt-5 max-h-[420px] overflow-auto rounded-xl border border-slate-200"><table className="w-full text-xs"><thead className="sticky top-0 bg-slate-50 text-left text-slate-500"><tr><th className="p-2">Room</th><th className="p-2">Floor</th><th className="p-2">Side</th><th className="p-2">Type</th><th className="p-2 text-right">Rent</th></tr></thead><tbody>{units.map((unit) => <tr key={`${unit.floor}-${unit.unitNumber}`} className="border-t border-slate-100"><td className="p-2 font-bold">{unit.unitNumber}</td><td className="p-2">{unit.floor}</td><td className="p-2 capitalize">{unit.corridorSide}</td><td className="p-2">{unit.type}</td><td className="p-2 text-right">{Number(unit.rentAmount || 0).toLocaleString()}</td></tr>)}</tbody></table></div>
            </section>
            <aside className="h-fit rounded-2xl border border-blue-200 bg-blue-50 p-5"><h3 className="font-extrabold text-blue-900">Ready to create</h3><p className="mt-1 text-xs leading-relaxed text-blue-800">This creates one property, {units.length} room records, and their corridor positions in a single database transaction.</p><button onClick={save} disabled={saving} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-extrabold text-white hover:bg-blue-500 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{saving ? 'Creating…' : 'Create property and rooms'}</button><button onClick={() => setStep(2)} className="mt-2 h-10 w-full rounded-xl border border-blue-200 bg-white text-xs font-bold text-blue-700">Back to layout</button></aside>
          </div>
        )}

        {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
        {step === 1 && <div className="mt-5 flex justify-end"><button onClick={goToLayout} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white">Continue to rooms<ArrowRight className="h-4 w-4" /></button></div>}
      </main>
    </div>
  );
}

function RoomColumn({ units, allUnits, duplicates, onUpdate, onRemove }: {
  units: LayoutUnit[];
  allUnits: LayoutUnit[];
  duplicates: Set<string>;
  onUpdate: (index: number, patch: Partial<LayoutUnit>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="space-y-2">
      {units.map((unit) => {
        const index = allUnits.indexOf(unit);
        const duplicate = duplicates.has(unit.unitNumber.trim().toLowerCase());
        return (
          <div key={`${unit.floor}-${index}`} className={`rounded-lg border bg-white p-2 shadow-sm ${duplicate ? 'border-rose-400' : 'border-slate-200'}`}>
            <div className="flex items-center gap-2"><DoorOpen className="h-4 w-4 shrink-0 text-blue-500" /><input value={unit.unitNumber} onChange={(e) => onUpdate(index, { unitNumber: e.target.value })} className="h-7 min-w-0 flex-1 rounded border border-slate-200 px-2 text-xs font-extrabold outline-none focus:border-blue-500" /><button onClick={() => onRemove(index)} className="text-slate-300 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button></div>
            <div className="mt-2 grid grid-cols-2 gap-1.5"><input value={unit.type} onChange={(e) => onUpdate(index, { type: e.target.value })} className="h-7 rounded border border-slate-200 px-2 text-[11px]" /><input type="number" min={0} value={unit.rentAmount} onChange={(e) => onUpdate(index, { rentAmount: Math.max(0, Number(e.target.value)) })} className="h-7 rounded border border-slate-200 px-2 text-right text-[11px]" /></div>
          </div>
        );
      })}
      {!units.length && <div className="grid min-h-24 place-items-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">No rooms</div>}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 truncate text-sm font-extrabold text-slate-900" title={value}>{value}</div></div>;
}
