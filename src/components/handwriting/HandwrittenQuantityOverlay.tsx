import { useEffect, useRef, useState, useCallback } from 'react';
import { Pencil, Delete, X, RotateCcw, Check } from 'lucide-react';
import { Pt, Stroke, rasterize, recognizeNumber, clampQuantity, NumberResult } from '@/lib/handwriting/recognizer';

/**
 * Build digit prototypes from the system font at runtime (offline, no assets):
 * render '0'–'9', sample the dark pixels as points, and rasterise them with the
 * SAME normaliser used for user strokes, so cosine comparison is apples-to-apples.
 */
function buildFontPrototypes(): number[][] {
  const size = 200;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const protos: number[][] = [];
  if (!ctx) return protos;
  ctx.font = 'bold 150px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let d = 0; d < 10; d++) {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#000';
    ctx.fillText(String(d), size / 2, size / 2);
    const data = ctx.getImageData(0, 0, size, size).data;
    const pts: Pt[] = [];
    for (let y = 0; y < size; y += 3) {
      for (let x = 0; x < size; x += 3) {
        const i = (y * size + x) * 4;
        if (data[i + 3] > 40 && data[i] < 128) pts.push({ x, y });
      }
    }
    // Each sampled pixel is a 1-point stroke → no spurious connecting lines.
    protos[d] = rasterize(pts.map((p) => [p]));
  }
  return protos;
}

export interface HandwrittenQuantityProps {
  productName: string;
  stock: number;
  currentQuantity: number;      // 0 if not in cart
  imageUrl?: string | null;
  /** wholesale "add to existing" instead of "set". */
  addMode?: boolean;
  maxQuantity?: number;         // default 99
  confidenceThreshold?: number; // default 0.55
  onSet: (quantity: number) => void;
  onClose: () => void;
}

type Phase = { kind: 'draw' } | { kind: 'confirm'; target: number; note: string; clamped?: boolean; available?: number } | { kind: 'unsure'; result: NumberResult };

/**
 * Write-a-quantity overlay. The customer writes a number over the product image
 * with finger/stylus/mouse; strokes are recognised locally and applied to the
 * cart with SET semantics (2 → 5), stock clamping, an Undo, and a numeric-keypad
 * fallback that is always correct.
 */
export default function HandwrittenQuantityOverlay(props: HandwrittenQuantityProps) {
  const { productName, stock, currentQuantity, imageUrl, addMode = false, maxQuantity = 99, confidenceThreshold = 0.55, onSet, onClose } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const protosRef = useRef<number[][] | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef(false);
  const recogTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>({ kind: 'draw' });
  const [showKeypad, setShowKeypad] = useState(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => { protosRef.current = buildFontPrototypes(); }, []);
  useEffect(() => () => { clearTimeout(recogTimer.current); clearTimeout(autoTimer.current); }, []);

  // ── Drawing ────────────────────────────────────────────────────────────────
  const ctx = () => canvasRef.current?.getContext('2d') ?? null;

  const redraw = useCallback(() => {
    const c = canvasRef.current, g = ctx();
    if (!c || !g) return;
    g.clearRect(0, 0, c.width, c.height);
    // Faint dot grid — only while there's ink being written.
    if (drawingRef.current || strokesRef.current.length) {
      g.fillStyle = 'rgba(255,255,255,0.18)';
      const step = c.width / 12;
      for (let x = step; x < c.width; x += step) for (let y = step; y < c.height; y += step) { g.beginPath(); g.arc(x, y, 1.1, 0, Math.PI * 2); g.fill(); }
    }
    g.strokeStyle = '#6366f1';
    g.lineWidth = Math.max(3, c.width / 60);
    g.lineJoin = 'round'; g.lineCap = 'round';
    for (const s of strokesRef.current) {
      if (s.length < 2) continue;
      g.beginPath(); g.moveTo(s[0].x, s[0].y);
      for (let i = 1; i < s.length; i++) g.lineTo(s[i].x, s[i].y);
      g.stroke();
    }
  }, []);

  const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>): Pt => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = canvasRef.current!.width / rect.width, sy = canvasRef.current!.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy, t: e.timeStamp };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    clearTimeout(recogTimer.current); clearTimeout(autoTimer.current);
    if (phase.kind !== 'draw') setPhase({ kind: 'draw' });
    drawingRef.current = true;
    strokesRef.current.push([pointFromEvent(e)]);
    setHasInk(true);
    canvasRef.current?.setPointerCapture(e.pointerId);
    redraw();
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    strokesRef.current[strokesRef.current.length - 1].push(pointFromEvent(e));
    redraw();
  };
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    // Recognise a short moment after the last stroke, so multi-digit numbers
    // (e.g. "1" then "2") are read together, not digit-by-digit.
    clearTimeout(recogTimer.current);
    recogTimer.current = setTimeout(recognise, 650);
  };

  const clearInk = () => {
    strokesRef.current = []; setHasInk(false); setPhase({ kind: 'draw' });
    clearTimeout(autoTimer.current); redraw();
  };

  // ── Recognition → confirm / unsure ──────────────────────────────────────────
  const targetFor = (written: number) => {
    const base = addMode ? currentQuantity + written : written;
    return clampQuantity(base, stock, maxQuantity);
  };

  const recognise = () => {
    const protos = protosRef.current;
    if (!protos || !strokesRef.current.length) return;
    const result = recognizeNumber(strokesRef.current, protos);
    if (result.value == null || result.confidence < confidenceThreshold) { setPhase({ kind: 'unsure', result }); return; }
    proposeQuantity(result.value);
  };

  const proposeQuantity = (written: number) => {
    if (written === 0) { setPhase({ kind: 'confirm', target: 0, note: `Remove ${productName} from cart?` }); return; }
    const { quantity, clampedToStock, overMax } = targetFor(written);
    let note: string;
    if (clampedToStock) note = `You wrote ${written}, but only ${stock} available. Set to ${quantity}?`;
    else if (overMax) note = `Max is ${maxQuantity}. Set ${productName} to ${quantity}?`;
    else if (currentQuantity && !addMode) note = `Quantity changed: ${currentQuantity} → ${quantity}`;
    else note = `Add ${quantity} × ${productName} to cart?`;
    setPhase({ kind: 'confirm', target: quantity, note, clamped: clampedToStock, available: stock });
    // Fast-shopping: auto-apply after 1s unless it was clamped or is a removal.
    if (!clampedToStock && written !== 0) {
      clearTimeout(autoTimer.current);
      autoTimer.current = setTimeout(() => apply(quantity), 1000);
    }
  };

  const apply = (quantity: number) => { clearTimeout(autoTimer.current); onSet(quantity); onClose(); };

  // ── Keypad fallback ─────────────────────────────────────────────────────────
  const [keypadValue, setKeypadValue] = useState('');
  const pressKey = (k: string) => {
    if (k === 'del') return setKeypadValue((v) => v.slice(0, -1));
    if (k === 'ok') { const n = Number(keypadValue || '0'); setShowKeypad(false); proposeQuantity(n); return; }
    setKeypadValue((v) => (v.length >= 3 ? v : (v + k).replace(/^0+(?=\d)/, '')));
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/70 grid place-items-center p-4" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm rounded-2xl bg-[#0c0c1a] border border-white/10 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
          <Pencil className="w-4 h-4 text-indigo-400" />
          <div className="flex-1 text-sm font-semibold text-white/90">Write quantity · {productName}</div>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {/* Drawing surface over the product image */}
        <div className="relative bg-white/[0.03]" style={{ aspectRatio: '1 / 1' }}>
          {imageUrl
            ? <img src={imageUrl} alt={productName} className="absolute inset-0 w-full h-full object-contain opacity-60 pointer-events-none" />
            : <div className="absolute inset-0 grid place-items-center text-white/20 text-5xl font-bold">{productName.slice(0, 2).toUpperCase()}</div>}
          <canvas
            ref={canvasRef}
            width={360}
            height={360}
            className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
          {!hasInk && phase.kind === 'draw' && (
            <div className="absolute inset-x-0 bottom-2 text-center text-[11px] text-white/40 pointer-events-none">Write a number (1–{maxQuantity}) with your finger</div>
          )}
        </div>

        {/* Status / confirm / unsure */}
        <div className="p-3 space-y-2">
          {phase.kind === 'confirm' && (
            <div className={`rounded-lg border p-2.5 ${phase.clamped ? 'border-amber-500/40 bg-amber-500/10' : 'border-indigo-500/30 bg-indigo-500/10'}`}>
              <div className="text-sm text-white/90">{phase.note}</div>
              <div className="mt-2 flex gap-2">
                <button onClick={() => apply(phase.target)} className="flex-1 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-1"><Check className="w-4 h-4" /> {phase.target === 0 ? 'Remove' : 'Confirm'}</button>
                <button onClick={clearInk} className="h-9 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm inline-flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5" /> Undo</button>
              </div>
            </div>
          )}
          {phase.kind === 'unsure' && (
            <div className="rounded-lg border border-white/15 bg-white/[0.04] p-2.5">
              <div className="text-sm text-white/80">
                {phase.result.digits.length && phase.result.digits[0].alt !== undefined
                  ? <>Not sure — did you write <b>{phase.result.digits.map((d) => d.digit).join('')}</b> or <b>{phase.result.digits.map((d) => d.alt ?? d.digit).join('')}</b>?</>
                  : <>Couldn’t read that clearly.</>}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {phase.result.value != null && <button onClick={() => proposeQuantity(phase.result.value!)} className="h-8 px-3 rounded-lg bg-indigo-600 text-white text-sm">Use {phase.result.value}</button>}
                <button onClick={clearInk} className="h-8 px-3 rounded-lg bg-white/10 text-white/80 text-sm">Rewrite</button>
                <button onClick={() => { setKeypadValue(''); setShowKeypad(true); }} className="h-8 px-3 rounded-lg bg-white/10 text-white/80 text-sm">Type it</button>
              </div>
            </div>
          )}
          {phase.kind === 'draw' && (
            <div className="flex items-center justify-between">
              <button onClick={clearInk} disabled={!hasInk} className="h-9 px-3 rounded-lg bg-white/[0.05] border border-white/10 text-white/70 text-sm disabled:opacity-40 inline-flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5" /> Clear</button>
              <button onClick={() => { setKeypadValue(''); setShowKeypad(true); }} className="h-9 px-3 rounded-lg bg-white/[0.05] border border-white/10 text-white/70 text-sm">Use keypad</button>
            </div>
          )}
          <div className="text-[11px] text-white/35 text-center">{addMode ? 'Adds to the current quantity' : 'Sets the cart quantity'} · {stock} in stock</div>
        </div>
      </div>

      {/* Numeric keypad fallback (always correct) */}
      {showKeypad && (
        <div className="fixed inset-0 z-[10001] bg-black/60 grid place-items-end sm:place-items-center" onPointerDown={(e) => { if (e.target === e.currentTarget) setShowKeypad(false); }}>
          <div className="w-full sm:max-w-xs bg-[#0c0c1a] border border-white/10 rounded-t-2xl sm:rounded-2xl p-4">
            <div className="text-center text-3xl font-bold text-white mb-3 tabular-nums h-10">{keypadValue || '0'}</div>
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'].map((k) => (
                <button key={k} onClick={() => pressKey(k)} className={`h-12 rounded-lg text-lg font-semibold ${k === 'ok' ? 'bg-indigo-600 text-white' : 'bg-white/[0.06] text-white/90 hover:bg-white/[0.12]'}`}>
                  {k === 'del' ? <Delete className="w-5 h-5 mx-auto" /> : k === 'ok' ? <Check className="w-5 h-5 mx-auto" /> : k}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
