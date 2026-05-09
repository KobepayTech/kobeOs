import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Pencil,
  Minus,
  Square,
  Circle,
  Eraser,
  MousePointer,
  Palette,
  Undo,
  Redo,
  Trash2,
  Download,
  Save,
  CircleDot,
} from 'lucide-react';
import { fs } from '@/os/fs';

type Tool = 'brush' | 'line' | 'rect' | 'circle' | 'eraser' | 'select';

interface Point {
  x: number;
  y: number;
}

export default function DrawApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>('brush');
  const [color, setColor] = useState('#3b82f6');
  const [brushSize, setBrushSize] = useState(4);
  const [fill, setFill] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [snapshot, setSnapshot] = useState<ImageData | null>(null);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  }, []);

  const saveSnapshot = useCallback(() => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => {
      const next = prev.slice(0, historyIndex + 1);
      if (next.length >= 20) next.shift();
      next.push(data);
      return next;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 19));
  }, [getCtx, historyIndex]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    const oldData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width = rect.width;
    canvas.height = rect.height;
    if (ctx && oldData) {
      ctx.putImageData(oldData, 0, 0);
    } else if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  useEffect(() => {
    resizeCanvas();
    const observer = new ResizeObserver(() => resizeCanvas());
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [resizeCanvas]);

  useEffect(() => {
    // Init white background
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx && canvas.width > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistory([data]);
      setHistoryIndex(0);
    }
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pos = getPos(e);
    setIsDrawing(true);
    setStartPoint(pos);
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    if (tool === 'brush' || tool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    } else {
      setSnapshot(ctx.getImageData(0, 0, canvas.width, canvas.height));
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const pos = getPos(e);
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    if (tool === 'brush' || tool === 'eraser') {
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
      ctx.lineWidth = brushSize;
      ctx.stroke();
    } else if (snapshot) {
      ctx.putImageData(snapshot, 0, 0);
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.fillStyle = color;
      if (tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(startPoint!.x, startPoint!.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      } else if (tool === 'rect') {
        const w = pos.x - startPoint!.x;
        const h = pos.y - startPoint!.y;
        if (fill) {
          ctx.fillRect(startPoint!.x, startPoint!.y, w, h);
        }
        ctx.strokeRect(startPoint!.x, startPoint!.y, w, h);
      } else if (tool === 'circle') {
        const rx = Math.abs(pos.x - startPoint!.x) / 2;
        const ry = Math.abs(pos.y - startPoint!.y) / 2;
        const cx = (startPoint!.x + pos.x) / 2;
        const cy = (startPoint!.y + pos.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        if (fill) ctx.fill();
        ctx.stroke();
      }
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setStartPoint(null);
    setSnapshot(null);
    saveSnapshot();
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.putImageData(history[nextIndex], 0, 0);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.putImageData(history[nextIndex], 0, 0);
  };

  const clearCanvas = () => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveSnapshot();
  };

  const exportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `drawing-${Date.now()}.png`;
    a.click();
  };

  const saveToFs = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const reader = new FileReader();
      reader.onload = () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        fs.writeFile(`/home/user/Pictures/drawing-${Date.now()}.png`, arrayBuffer, 'image/png');
      };
      reader.readAsArrayBuffer(blob);
    }, 'image/png');
  };

  const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: 'brush', icon: <Pencil className="w-4 h-4" />, label: 'Brush' },
    { id: 'line', icon: <Minus className="w-4 h-4" />, label: 'Line' },
    { id: 'rect', icon: <Square className="w-4 h-4" />, label: 'Rectangle' },
    { id: 'circle', icon: <Circle className="w-4 h-4" />, label: 'Circle' },
    { id: 'eraser', icon: <Eraser className="w-4 h-4" />, label: 'Eraser' },
    { id: 'select', icon: <MousePointer className="w-4 h-4" />, label: 'Select' },
  ];

  const palette = [
    '#000000', '#ffffff', '#ef4444', '#f97316', '#eab308',
    '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#78716c',
  ];

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 text-slate-200">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700 bg-slate-800 shrink-0 flex-wrap">
        {tools.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
              tool === t.id ? 'bg-blue-600 text-white' : 'hover:bg-slate-700'
            }`}
            title={t.label}
          >
            {t.icon}
          </button>
        ))}
        <div className="w-px h-5 bg-slate-600 mx-1" />
        <div className="flex items-center gap-1">
          <Palette className="w-4 h-4 text-slate-400" />
          {palette.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-5 h-5 rounded-full border-2 ${color === c ? 'border-white' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
          />
        </div>
        <div className="w-px h-5 bg-slate-600 mx-1" />
        <label className="flex items-center gap-1 text-xs text-slate-400">
          <input
            type="range"
            min={1}
            max={50}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-20"
          />
          {brushSize}px
        </label>
        <div className="w-px h-5 bg-slate-600 mx-1" />
        <button
          onClick={() => setFill((v) => !v)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${fill ? 'bg-blue-600 text-white' : 'hover:bg-slate-700'}`}
          title="Fill shapes"
        >
          <CircleDot className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-slate-600 mx-1" />
        <button onClick={undo} className="p-1.5 rounded hover:bg-slate-700" title="Undo">
          <Undo className="w-4 h-4" />
        </button>
        <button onClick={redo} className="p-1.5 rounded hover:bg-slate-700" title="Redo">
          <Redo className="w-4 h-4" />
        </button>
        <button onClick={clearCanvas} className="p-1.5 rounded hover:bg-slate-700" title="Clear">
          <Trash2 className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-slate-600 mx-1" />
        <button onClick={exportPNG} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-700 text-xs" title="Export PNG">
          <Download className="w-4 h-4" /> PNG
        </button>
        <button onClick={saveToFs} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-700 text-xs" title="Save to FS">
          <Save className="w-4 h-4" /> Save
        </button>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 relative bg-slate-950">
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', touchAction: 'none' }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
    </div>
  );
}
