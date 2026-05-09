import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  RotateCcw,
  RotateCw,
  Image,
  FolderOpen,
  Grid3X3,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { fs } from '@/os/fs';
import type { FSNode } from '@/os/types';

interface ImageViewerProps {
  windowId: string;
  data?: { filePath?: string };
}

interface FilterSettings {
  grayscale: number;
  sepia: number;
  blur: number;
  brightness: number;
  contrast: number;
}

export default function ImageViewerApp({ data }: ImageViewerProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isSvg, setIsSvg] = useState(false);
  const [svgContent, setSvgContent] = useState<string>('');
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [filters, setFilters] = useState<FilterSettings>({
    grayscale: 0,
    sepia: 0,
    blur: 0,
    brightness: 100,
    contrast: 100,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);
  const [currentPath, setCurrentPath] = useState('/home/user');
  const [files, setFiles] = useState<FSNode[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);

  const SUPPORTED = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml'];

  const loadImage = useCallback((path: string) => {
    const content = fs.readFile(path);
    if (!content) return;
    const stat = fs.stat(path);
    if (stat?.mimeType === 'image/svg+xml' || path.endsWith('.svg')) {
      if (typeof content === 'string') {
        setIsSvg(true);
        setSvgContent(content);
        setImageUrl(null);
      }
    } else if (content instanceof ArrayBuffer) {
      const blob = new Blob([content], { type: stat?.mimeType ?? 'image/png' });
      const url = URL.createObjectURL(blob);
      setImageUrl(url);
      setIsSvg(false);
    }
    setZoom(1);
    setRotation(0);
    setFilters({ grayscale: 0, sepia: 0, blur: 0, brightness: 100, contrast: 100 });
  }, []);

  useEffect(() => {
    if (data?.filePath) {
      loadImage(data.filePath);
    }
  }, [data, loadImage]);

  useEffect(() => {
    refreshFiles();
  }, [currentPath]);

  const refreshFiles = () => {
    const dir = fs.readdir(currentPath);
    setFiles(dir.filter((f) => f.type === 'file' && (SUPPORTED.includes(f.mimeType ?? '') || f.name.endsWith('.svg'))));
  };

  const zoomIn = () => setZoom((z) => Math.min(z + 0.25, 5));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.25));
  const fit = () => setZoom(1);
  const actualSize = () => setZoom(1);
  const rotateLeft = () => setRotation((r) => r - 90);
  const rotateRight = () => setRotation((r) => r + 90);

  const filterStyle = {
    filter: `grayscale(${filters.grayscale}%) sepia(${filters.sepia}%) blur(${filters.blur}px) brightness(${filters.brightness}%) contrast(${filters.contrast}%)`,
    transform: `scale(${zoom}) rotate(${rotation}deg)`,
    transition: 'transform 0.2s ease',
  };

  const applyPreset = (name: string) => {
    switch (name) {
      case 'grayscale':
        setFilters((f) => ({ ...f, grayscale: f.grayscale > 0 ? 0 : 100 }));
        break;
      case 'sepia':
        setFilters((f) => ({ ...f, sepia: f.sepia > 0 ? 0 : 100 }));
        break;
      case 'blur':
        setFilters((f) => ({ ...f, blur: f.blur > 0 ? 0 : 3 }));
        break;
      case 'brightness':
        setFilters((f) => ({ ...f, brightness: f.brightness === 100 ? 150 : 100 }));
        break;
      case 'contrast':
        setFilters((f) => ({ ...f, contrast: f.contrast === 100 ? 150 : 100 }));
        break;
      case 'reset':
        setFilters({ grayscale: 0, sepia: 0, blur: 0, brightness: 100, contrast: 100 });
        break;
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 text-slate-200">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700 bg-slate-800 shrink-0 flex-wrap">
        {!imageUrl && !isSvg ? (
          <button
            onClick={() => setShowBrowser(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm"
          >
            <FolderOpen className="w-4 h-4" /> Open Image
          </button>
        ) : (
          <>
            <button onClick={zoomIn} className="p-1.5 rounded hover:bg-slate-700" title="Zoom In">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button onClick={zoomOut} className="p-1.5 rounded hover:bg-slate-700" title="Zoom Out">
              <ZoomOut className="w-4 h-4" />
            </button>
            <button onClick={fit} className="p-1.5 rounded hover:bg-slate-700" title="Fit">
              <Maximize className="w-4 h-4" />
            </button>
            <button onClick={actualSize} className="p-1.5 rounded hover:bg-slate-700 text-xs px-2" title="Actual Size">
              1:1
            </button>
            <div className="w-px h-5 bg-slate-600 mx-1" />
            <button onClick={rotateLeft} className="p-1.5 rounded hover:bg-slate-700" title="Rotate Left">
              <RotateCcw className="w-4 h-4" />
            </button>
            <button onClick={rotateRight} className="p-1.5 rounded hover:bg-slate-700" title="Rotate Right">
              <RotateCw className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-slate-600 mx-1" />
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`p-1.5 rounded ${showFilters ? 'bg-blue-600' : 'hover:bg-slate-700'}`}
              title="Filters"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-slate-600 mx-1" />
            <button onClick={() => applyPreset('grayscale')} className="px-2 py-1 rounded hover:bg-slate-700 text-xs">Grayscale</button>
            <button onClick={() => applyPreset('sepia')} className="px-2 py-1 rounded hover:bg-slate-700 text-xs">Sepia</button>
            <button onClick={() => applyPreset('blur')} className="px-2 py-1 rounded hover:bg-slate-700 text-xs">Blur</button>
            <button onClick={() => applyPreset('brightness')} className="px-2 py-1 rounded hover:bg-slate-700 text-xs">Bright</button>
            <button onClick={() => applyPreset('contrast')} className="px-2 py-1 rounded hover:bg-slate-700 text-xs">Contrast</button>
            <button onClick={() => applyPreset('reset')} className="px-2 py-1 rounded hover:bg-slate-700 text-xs">Reset</button>
            <div className="flex-1" />
            <button
              onClick={() => setShowBrowser(true)}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-700 text-xs"
            >
              <FolderOpen className="w-4 h-4" /> Open
            </button>
          </>
        )}
      </div>

      {/* Filters panel */}
      {showFilters && (imageUrl || isSvg) && (
        <div className="px-4 py-2 border-b border-slate-700 bg-slate-800 flex gap-4 flex-wrap items-center text-xs">
          <label className="flex items-center gap-1">
            Grayscale
            <input
              type="range" min={0} max={100} value={filters.grayscale}
              onChange={(e) => setFilters((f) => ({ ...f, grayscale: Number(e.target.value) }))}
              className="w-20"
            />
            {filters.grayscale}%
          </label>
          <label className="flex items-center gap-1">
            Sepia
            <input
              type="range" min={0} max={100} value={filters.sepia}
              onChange={(e) => setFilters((f) => ({ ...f, sepia: Number(e.target.value) }))}
              className="w-20"
            />
            {filters.sepia}%
          </label>
          <label className="flex items-center gap-1">
            Blur
            <input
              type="range" min={0} max={10} step={0.5} value={filters.blur}
              onChange={(e) => setFilters((f) => ({ ...f, blur: Number(e.target.value) }))}
              className="w-20"
            />
            {filters.blur}px
          </label>
          <label className="flex items-center gap-1">
            Brightness
            <input
              type="range" min={50} max={200} value={filters.brightness}
              onChange={(e) => setFilters((f) => ({ ...f, brightness: Number(e.target.value) }))}
              className="w-20"
            />
            {filters.brightness}%
          </label>
          <label className="flex items-center gap-1">
            Contrast
            <input
              type="range" min={50} max={200} value={filters.contrast}
              onChange={(e) => setFilters((f) => ({ ...f, contrast: Number(e.target.value) }))}
              className="w-20"
            />
            {filters.contrast}%
          </label>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-950 relative">
        {!imageUrl && !isSvg ? (
          <div className="flex flex-col items-center justify-center text-slate-400">
            <Image className="w-16 h-16 mb-4" />
            <p className="text-sm">No image loaded</p>
            <button
              onClick={() => setShowBrowser(true)}
              className="mt-3 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-sm"
            >
              Open Image
            </button>
          </div>
        ) : isSvg ? (
          <div
            className="max-w-full max-h-full p-4"
            style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, transition: 'transform 0.2s ease' }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        ) : (
          <img
            ref={imgRef}
            src={imageUrl!}
            alt="Viewer"
            className="max-w-full max-h-full object-contain"
            style={filterStyle}
            draggable={false}
          />
        )}
      </div>

      {/* File browser modal */}
      {showBrowser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg border border-slate-700 w-[400px] max-w-[90vw] flex flex-col shadow-xl max-h-[80vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <h3 className="font-semibold text-sm">Open Image</h3>
              <button onClick={() => setShowBrowser(false)} className="p-1 hover:bg-slate-700 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-4 py-2 border-b border-slate-700 text-xs text-slate-400">
              {currentPath}
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {currentPath !== '/' && (
                <button
                  onClick={() => setCurrentPath(currentPath.split('/').slice(0, -1).join('/') || '/')}
                  className="w-full text-left px-3 py-2 rounded hover:bg-slate-700 text-sm flex items-center gap-2"
                >
                  <Grid3X3 className="w-4 h-4" /> ..
                </button>
              )}
              {files.length === 0 && (
                <p className="text-xs text-slate-500 px-3 py-2">No images in this folder.</p>
              )}
              {files.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    const path = fs.getPathById(f.id);
                    loadImage(path);
                    setShowBrowser(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded hover:bg-slate-700 text-sm flex items-center gap-2"
                >
                  <Image className="w-4 h-4 text-blue-400" />
                  {f.name}
                </button>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-slate-700 flex justify-end">
              <button onClick={() => setShowBrowser(false)} className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
