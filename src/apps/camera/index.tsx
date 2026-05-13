import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  FlipHorizontal,
  Timer,
  X,
  Aperture,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { ensureSession } from '@/lib/auth';

type Filter = 'normal' | 'grayscale' | 'sepia' | 'invert';

const FILTER_CSS: Record<Filter, string> = {
  normal: 'none',
  grayscale: 'grayscale(100%)',
  sepia: 'sepia(100%)',
  invert: 'invert(100%)',
};

interface ApiPhoto {
  id: string;
  kind: 'photo';
  name: string;
  mimeType?: string | null;
  src: string;
  size: number;
  createdAt: string;
}

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
  const [photos, setPhotos] = useState<ApiPhoto[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [bootReady, setBootReady] = useState(false);

  const refreshPhotos = useCallback(async () => {
    try {
      const list = await api<ApiPhoto[]>('/media/assets?kind=photo');
      setPhotos(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load photos');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureSession();
        if (cancelled) return;
        await refreshPhotos();
        if (!cancelled) setBootReady(true);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to connect');
      }
    })();
    return () => { cancelled = true; };
  }, [refreshPhotos]);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setStreamActive(true);
    } catch {
      setError('Camera access denied or not available.');
      setStreamActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStreamActive(false);
  }, []);

  useEffect(() => {
    if (!bootReady) return;
    startCamera();
    return () => stopCamera();
  }, [bootReady, startCamera, stopCamera]);

  const capture = useCallback(() => {
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

    ctx.filter = FILTER_CSS[filter];
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.filter = 'none';
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const dataUrl: string = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      try {
        const created = await api<ApiPhoto>('/media/assets', {
          method: 'POST',
          body: JSON.stringify({
            kind: 'photo',
            name: `photo_${Date.now()}.png`,
            mimeType: 'image/png',
            src: dataUrl,
            size: blob.size,
          }),
        });
        setPhotos((prev) => [created, ...prev]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
    }, 'image/png');
  }, [filter, mirror]);

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

  const deletePhoto = async (id: string) => {
    try {
      await api(`/media/assets/${id}`, { method: 'DELETE' });
      setPhotos((prev) => prev.filter((p) => p.id !== id));
      if (selectedPhotoId === id) setSelectedPhotoId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 text-slate-200">
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

      <div className="flex-1 flex overflow-hidden">
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

          {countdown > 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-8xl font-bold text-white drop-shadow-lg animate-pulse">
                {countdown}
              </span>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="w-32 shrink-0 bg-slate-800 border-l border-slate-700 flex flex-col">
          <div className="px-2 py-2 border-b border-slate-700 text-xs font-semibold flex items-center gap-1">
            <ImageIcon className="w-3 h-3" /> Gallery
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5">
            {photos.length === 0 && (
              <p className="text-[10px] text-slate-500 px-1">No photos yet.</p>
            )}
            {photos.map((p) => (
              <div
                key={p.id}
                className={`relative group rounded overflow-hidden border ${selectedPhotoId === p.id ? 'border-blue-500' : 'border-slate-700'}`}
                onClick={() => setSelectedPhotoId(p.id)}
              >
                <img src={p.src} alt={p.name} className="w-full h-16 object-cover" />
                <button
                  onClick={(e) => { e.stopPropagation(); deletePhoto(p.id); }}
                  className="absolute top-0.5 right-0.5 p-0.5 bg-black/50 rounded opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedPhotoId && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setSelectedPhotoId(null)}
        >
          <div className="relative max-w-[80vw] max-h-[80vh]">
            <button
              onClick={() => setSelectedPhotoId(null)}
              className="absolute -top-8 right-0 p-1 hover:bg-slate-700 rounded"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            {(() => {
              const p = photos.find((x) => x.id === selectedPhotoId);
              return p ? <img src={p.src} alt="" className="max-w-full max-h-[80vh] rounded" /> : null;
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
