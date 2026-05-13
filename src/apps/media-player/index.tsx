import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Shuffle,
  Music,
  Trash2,
  Upload,
  ListMusic,
  Disc,
  X,
} from 'lucide-react';
import { api, fetchObjectUrl, uploadFile } from '@/lib/api';
import { ensureSession } from '@/lib/auth';

interface ApiAsset {
  id: string;
  kind: 'audio' | 'video' | 'photo' | 'image';
  name: string;
  mimeType?: string | null;
  src: string;
  duration: number;
  size: number;
  createdAt: string;
}

export default function MediaPlayerApp() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [tracks, setTracks] = useState<ApiAsset[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [visualizerBars, setVisualizerBars] = useState<number[]>(Array.from({ length: 32 }, () => 4));
  const [showPlaylist, setShowPlaylist] = useState(true);
  const [ready, setReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const animRef = useRef<number>(0);

  const currentIndex = useMemo(() => tracks.findIndex((t) => t.id === currentId), [tracks, currentId]);
  const currentTrack = currentIndex >= 0 ? tracks[currentIndex] : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureSession();
        const list = await api<ApiAsset[]>('/media/assets?kind=audio');
        if (cancelled) return;
        setTracks(list);
        setReady(true);
      } catch (err) {
        if (!cancelled) setErrorMsg(err instanceof Error ? err.message : 'Failed to load');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const playIndex = useCallback((idx: number) => {
    const track = tracks[idx];
    if (!track) return;
    setCurrentId(track.id);
    setIsPlaying(true);
    setTimeout(() => audioRef.current?.play().catch(() => setIsPlaying(false)), 50);
  }, [tracks]);

  const togglePlay = () => {
    if (!audioRef.current || !currentTrack) return;
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else { audioRef.current.play().catch(() => setIsPlaying(false)); setIsPlaying(true); }
  };

  const stop = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const prev = () => {
    if (!tracks.length) return;
    const idx = shuffle ? Math.floor(Math.random() * tracks.length)
      : currentIndex > 0 ? currentIndex - 1 : tracks.length - 1;
    playIndex(idx);
  };

  const next = () => {
    if (!tracks.length) return;
    const idx = shuffle ? Math.floor(Math.random() * tracks.length)
      : currentIndex >= 0 && currentIndex < tracks.length - 1 ? currentIndex + 1 : 0;
    playIndex(idx);
  };

  const onTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
    setDuration(audio.duration || 0);
  };

  const onEnded = () => {
    if (repeat) audioRef.current?.play().catch(() => setIsPlaying(false));
    else next();
  };

  const onSeek = (val: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = val;
    setCurrentTime(val);
  };

  const onVolumeChange = (val: number) => {
    if (!audioRef.current) return;
    audioRef.current.volume = val;
    setVolume(val);
    setMuted(val === 0);
  };

  const formatTime = (t: number) => {
    if (!isFinite(t)) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const animate = () => {
      if (isPlaying) {
        setVisualizerBars((prev) => prev.map((_, i) => {
          const base = Math.sin(Date.now() / 200 + i * 0.5) * 20 + 30;
          return Math.max(4, Math.min(80, base + Math.random() * 15));
        }));
      } else {
        setVisualizerBars((prev) => prev.map(() => 4));
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying]);

  const uploadTrack = async (file: File) => {
    try {
      const created = await uploadFile<ApiAsset>('/media/upload?kind=audio', file);
      setTracks((prev) => [...prev, created]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const removeTrack = async (id: string) => {
    try {
      await api(`/media/assets/${id}`, { method: 'DELETE' });
      setTracks((prev) => prev.filter((t) => t.id !== id));
      if (currentId === id) { setCurrentId(null); setIsPlaying(false); }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('audio/')) return;
    void uploadTrack(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void uploadTrack(file);
    e.target.value = '';
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    let revokeUrl: string | null = null;
    let cancelled = false;
    (async () => {
      const raw = currentTrack.src;
      // /api/media/blob/:id requires the JWT — fetch it via the api client
      // and hand the audio element a blob: URL it can stream from.
      const playable = raw.startsWith('data:') || raw.startsWith('blob:')
        ? raw
        : await fetchObjectUrl(raw.replace(/^\/api/, '')).then((u) => { revokeUrl = u; return u; });
      if (cancelled) { if (revokeUrl) URL.revokeObjectURL(revokeUrl); return; }
      audio.src = playable;
      if (isPlaying) audio.play().catch(() => setIsPlaying(false));
    })();
    return () => {
      cancelled = true;
      if (revokeUrl) URL.revokeObjectURL(revokeUrl);
    };
  }, [currentTrack]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-900 text-sm text-slate-400">
        {errorMsg ?? 'Connecting…'}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full w-full bg-slate-900 text-slate-200"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <audio ref={audioRef} onTimeUpdate={onTimeUpdate} onEnded={onEnded} />

      <div className="flex-1 flex overflow-hidden">
        {showPlaylist && (
          <div className="w-56 shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col">
            <div className="px-3 py-2 border-b border-slate-700 text-sm font-semibold flex items-center gap-2">
              <ListMusic className="w-4 h-4" /> Playlist
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {tracks.length === 0 && (
                <p className="text-xs text-slate-500 px-1">Drop audio files or click Upload.</p>
              )}
              {tracks.map((track, idx) => (
                <div
                  key={track.id}
                  onClick={() => playIndex(idx)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer group ${
                    track.id === currentId ? 'bg-blue-600/20 text-blue-300' : 'hover:bg-slate-700'
                  }`}
                >
                  <Music className="w-3 h-3 shrink-0" />
                  <span className="flex-1 truncate">{track.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); void removeTrack(track.id); }}
                    className="p-0.5 hover:bg-red-900 rounded opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
            <div className="px-3 py-2 border-t border-slate-700">
              <label className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-xs cursor-pointer">
                <Upload className="w-3 h-3" /> Upload audio
                <input type="file" accept="audio/*" className="hidden" onChange={handleFileInput} />
              </label>
            </div>
            {errorMsg && <div className="text-[10px] text-red-400 px-3 py-1 border-t border-slate-700">{errorMsg}</div>}
          </div>
        )}

        <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
          <div className="flex items-end gap-0.5 h-24 mb-4">
            {visualizerBars.map((h, i) => (
              <div key={i} className="w-1.5 rounded-t bg-blue-400" style={{ height: `${h}px`, transition: 'height 0.05s linear' }} />
            ))}
          </div>

          <div className="text-center mb-4">
            <Disc className={`w-12 h-12 mx-auto mb-2 text-blue-400 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
            <p className="text-lg font-medium truncate max-w-xs">{currentTrack?.name ?? 'No track selected'}</p>
            <p className="text-xs text-slate-400">{formatTime(currentTime)} / {formatTime(duration)}</p>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <button onClick={prev} className="p-2 hover:bg-slate-700 rounded" title="Previous"><SkipBack className="w-5 h-5" /></button>
            <button onClick={togglePlay} className="p-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white">
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </button>
            <button onClick={stop} className="p-2 hover:bg-slate-700 rounded" title="Stop"><Square className="w-5 h-5" /></button>
            <button onClick={next} className="p-2 hover:bg-slate-700 rounded" title="Next"><SkipForward className="w-5 h-5" /></button>
          </div>

          <div className="w-full max-w-md flex items-center gap-2 mb-2">
            <span className="text-[10px] text-slate-400 w-8 text-right">{formatTime(currentTime)}</span>
            <input type="range" min={0} max={duration || 1} step={0.1} value={currentTime}
              onChange={(e) => onSeek(Number(e.target.value))} className="flex-1" />
            <span className="text-[10px] text-slate-400 w-8">{formatTime(duration)}</span>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setRepeat((v) => !v)} className={`p-1.5 rounded ${repeat ? 'bg-blue-600' : 'hover:bg-slate-700'}`}><Repeat className="w-4 h-4" /></button>
            <button onClick={() => setShuffle((v) => !v)} className={`p-1.5 rounded ${shuffle ? 'bg-blue-600' : 'hover:bg-slate-700'}`}><Shuffle className="w-4 h-4" /></button>
            <div className="flex items-center gap-1">
              <button onClick={() => onVolumeChange(muted ? volume : 0)} className="p-1 hover:bg-slate-700 rounded">
                {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
                onChange={(e) => onVolumeChange(Number(e.target.value))} className="w-20" />
            </div>
          </div>
        </div>
      </div>

      <button onClick={() => setShowPlaylist((v) => !v)}
        className="absolute top-2 right-2 p-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700">
        {showPlaylist ? <X className="w-4 h-4" /> : <ListMusic className="w-4 h-4" />}
      </button>
    </div>
  );
}
