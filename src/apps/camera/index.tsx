import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  FlipHorizontal,
  Timer,
  Grid3X3,
  X,
  Aperture,
  Image,
  Trash2,
} from 'lucide-react';
import { fs } from '@/os/fs';
import type { FSNode } from '@/os/types';

type Filter = 'normal' | 'grayscale' | 'sepia' | 'invert';

const FILTER_CSS: Record<Filter, string> = {
  normal: 'none',
  grayscale: 'grayscale(100%)',
  sepia: 'sepia(100%)',
  invert: 'invert(100%)',
};

const GALLERY_DIR = '/home/user/Pictures';

export default function CameraApp() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('normal');
  const [mirror, setMirror] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const [countdownValue, setCountdownValue] = useState(0);
  const [photos, setPhotos] = useState<FSNode[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const refreshPhotos = useCallback(() => {
    const dir = fs.readdir(GALLERY_DIR);
    setPhotos(dir.filter((f) => f.type === 'file' && f.name.match(/\.(png|jpg|jpeg)$/i)));
  }, []);

  useEffect(() => {
    refreshPhotos();
  }, [refreshPhotos]);

  const startCamera = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setStreamActive(true);
    } catch (err) {
      setError('Camera access denied or not available.');
      setStreamActive(false);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStreamActive(false);
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (mirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    // Apply filter via CSS on temp canvas isn't straightforward; we'll apply the filter during draw
    ctx.filter = FILTER_CSS[filter];
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.filter = 'none';
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const reader = new FileReader();
      reader.onload = () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        const name = `photo_${Date.now()}.png`;
        fs.writeFile(`${GALLERY_DIR}/${name}`, arrayBuffer, 'image/png');
        refreshPhotos();
      };
      reader.readAsArrayBuffer(blob);
    }, 'image/png');
  };

  const triggerCapture = () => {
    if (countdownValue > 0) {
      setCountdown(countdownValue);
      let remaining = countdownValue;
      const interval = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(interval);
          capture();
        }
      }, 1000);
    } else {
      capture();
    }
  };

  const deletePhoto = (id: string) => {
    const path = fs.getPathById(id);
    fs.delete(path);
    refreshPhotos();
    if (selectedPhoto === id) setSelectedPhoto(null);
  };

  const getPhotoUrl = (node: FSNode): string | null => {
    const content = fs.readFile(fs.getPathById(node.id));
    if (content instanceof ArrayBuffer) {
      const blob = new Blob([content], { type: node.mimeType ?? 'image/png' });
      return URL.createObjectURL(blob);
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 text-slate-200">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700 bg-slate-800 shrink-0 flex-wrap">
        <button
          onClick={triggerCapture}
          disabled={!streamActive}
          className="flex items-center gap-1 px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 disabled:bg-slate-600 text-white text-sm"
        >
          <Camera className="w-4 h-4" /> Capture
        </button>
        <div className="w-px h-5 bg-slate-600 mx-1" />
        <button
          onClick={() => setMirror((v) => !v)}
          className={`p-1.5 rounded ${mirror ? 'bg-blue-600' : 'hover:bg-slate-700'}`}
          title="Mirror"
        >
          <FlipHorizontal className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-1">
          <Timer className="w-4 h-4 text-slate-400" />
          {[0, 3, 5].map((v) => (
            <button
              key={v}
              onClick={() => setCountdownValue(v)}
              className={`px-2 py-0.5 rounded text-xs ${countdownValue === v ? 'bg-blue-600 text-white' : 'hover:bg-slate-700'}`}
            >
              {v === 0 ? 'Off' : `${v}s`}
            </button>
          ))}
        </div>
        <div className="w-px h-5 bg-slate-600 mx-1" />
        <div className="flex items-center gap-1">
          <Aperture className="w-4 h-4 text-slate-400" />
          {(['normal', 'grayscale', 'sepia', 'invert'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-0.5 rounded text-xs capitalize ${filter === f ? 'bg-blue-600 text-white' : 'hover:bg-slate-700'}`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button
          onClick={streamActive ? stopCamera : startCamera}
          className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs"
        >
          {streamActive ? 'Stop' : 'Start'}
        </button>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video preview */}
        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="text-center p-6">
              <Camera className="w-12 h-12 mx-auto mb-3 text-slate-500" />
              <p className="text-sm text-slate-400">{error}</p>
              <button
                onClick={startCamera}
                className="mt-3 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-sm"
              >
                Retry
              </button>
            </div>
          ) : (
            <video
              ref={videoRef}
              className="max-w-full max-h-full object-contain"
              style={{
                filter: FILTER_CSS[filter],
                transform: mirror ? 'scaleX(-1)' : 'none',
              }}
              muted
              playsInline
            />
          )}

          {/* Countdown overlay */}
          {countdown > 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-8xl font-bold text-white drop-shadow-lg animate-pulse">
                {countdown}
              </span>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Gallery sidebar */}
        <div className="w-32 shrink-0 bg-slate-800 border-l border-slate-700 flex flex-col">
          <div className="px-2 py-2 border-b border-slate-700 text-xs font-semibold flex items-center gap-1">
            <Image className="w-3 h-3" /> Gallery
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5">
            {photos.length === 0 && (
              <p className="text-[10px] text-slate-500 px-1">No photos yet.</p>
            )}
            {photos.map((p) => {
              const url = getPhotoUrl(p);
              return (
                <div
                  key={p.id}
                  className={`relative group rounded overflow-hidden border ${selectedPhoto === p.id ? 'border-blue-500' : 'border-slate-700'}`}
                  onClick={() => setSelectedPhoto(p.id)}
                >
                  {url && (
                    <img src={url} alt={p.name} className="w-full h-16 object-cover" />
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); deletePhoto(p.id); }}
                    className="absolute top-0.5 right-0.5 p-0.5 bg-black/50 rounded opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected photo modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-[80vw] max-h-[80vh]">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute -top-8 right-0 p-1 hover:bg-slate-700 rounded"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            {(() => {
              const node = photos.find((p) => p.id === selectedPhoto);
              const url = node ? getPhotoUrl(node) : null;
              return url ? <img src={url} alt="" className="max-w-full max-h-[80vh] rounded" /> : null;
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
