import { useState, useRef, useEffect, useCallback } from 'react';
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
  FolderOpen,
  Upload,
  ListMusic,
  Disc,
} from 'lucide-react';
import { fs } from '@/os/fs';
import type { FSNode } from '@/os/types';

interface Track {
  id: string;
  name: string;
  path: string;
  duration: number;
}

const PLAYLIST_KEY = 'kobe_media_playlist';
const SUPPORTED = ['audio/mpeg', 'audio/wav', 'audio/wave', 'audio/ogg', 'audio/mp3'];

function loadPlaylist(): Track[] {
  try {
    const raw = localStorage.getItem(PLAYLIST_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function savePlaylist(tracks: Track[]) {
  localStorage.setItem(PLAYLIST_KEY, JSON.stringify(tracks));
}

export default function MediaPlayerApp() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playlist, setPlaylist] = useState<Track[]>(loadPlaylist);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [visualizerBars, setVisualizerBars] = useState<number[]>(Array.from({ length: 32 }, () => 4));
  const [showPlaylist, setShowPlaylist] = useState(true);
  const [showBrowser, setShowBrowser] = useState(false);
  const [currentPath, setCurrentPath] = useState('/home/user');
  const [files, setFiles] = useState<FSNode[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    savePlaylist(playlist);
  }, [playlist]);

  const currentTrack = playlist[currentIndex];

  useEffect(() => {
    refreshFiles();
  }, [currentPath]);

  const refreshFiles = () => {
    const dir = fs.readdir(currentPath);
    setFiles(dir.filter((f) => f.type === 'file' && (SUPPORTED.includes(f.mimeType ?? '') || f.name.match(/\.(mp3|wav|ogg)$/i))));
  };

  const playTrack = useCallback((index: number) => {
    setCurrentIndex(index);
    setIsPlaying(true);
    setTimeout(() => {
      audioRef.current?.play().catch(() => setIsPlaying(false));
    }, 50);
  }, []);

  const togglePlay = () => {
    if (!audioRef.current || !currentTrack) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    }
  };

  const stop = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const prev = () => {
    if (playlist.length === 0) return;
    if (shuffle) {
      const nextIdx = Math.floor(Math.random() * playlist.length);
      playTrack(nextIdx);
    } else {
      const nextIdx = currentIndex > 0 ? currentIndex - 1 : playlist.length - 1;
      playTrack(nextIdx);
    }
  };

  const next = () => {
    if (playlist.length === 0) return;
    if (shuffle) {
      const nextIdx = Math.floor(Math.random() * playlist.length);
      playTrack(nextIdx);
    } else {
      const nextIdx = currentIndex < playlist.length - 1 ? currentIndex + 1 : 0;
      playTrack(nextIdx);
    }
  };

  const onTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
    setDuration(audio.duration || 0);
  };

  const onEnded = () => {
    if (repeat) {
      audioRef.current?.play().catch(() => setIsPlaying(false));
    } else {
      next();
    }
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

  // Visualizer simulation
  useEffect(() => {
    const animate = () => {
      if (isPlaying) {
        setVisualizerBars((prev) =>
          prev.map((_, i) => {
            const base = Math.sin(Date.now() / 200 + i * 0.5) * 20 + 30;
            const noise = Math.random() * 15;
            return Math.max(4, Math.min(80, base + noise));
          })
        );
      } else {
        setVisualizerBars((prev) => prev.map(() => 4));
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying]);

  const addToPlaylist = (path: string, name: string) => {
    if (playlist.some((t) => t.path === path)) return;
    const track: Track = { id: `track_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, name, path, duration: 0 };
    setPlaylist((prev) => [...prev, track]);
  };

  const removeFromPlaylist = (id: string) => {
    setPlaylist((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      const next = prev.filter((t) => t.id !== id);
      if (idx === currentIndex && next.length > 0) {
        setCurrentIndex(0);
        setIsPlaying(false);
      }
      return next;
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const path = `/home/user/Music/${file.name}`;
      fs.writeFile(path, arrayBuffer, file.type);
      addToPlaylist(path, file.name);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const path = `/home/user/Music/${file.name}`;
      fs.writeFile(path, arrayBuffer, file.type);
      addToPlaylist(path, file.name);
    };
    reader.readAsArrayBuffer(file);
  };

  // Load audio source
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    const content = fs.readFile(currentTrack.path);
    if (content instanceof ArrayBuffer) {
      const blob = new Blob([content], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      audio.src = url;
      if (isPlaying) {
        audio.play().catch(() => setIsPlaying(false));
      }
      return () => URL.revokeObjectURL(url);
    }
  }, [currentTrack]);

  return (
    <div
      className="flex flex-col h-full w-full bg-slate-900 text-slate-200"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <audio ref={audioRef} onTimeUpdate={onTimeUpdate} onEnded={onEnded} />

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Playlist sidebar */}
        {showPlaylist && (
          <div className="w-56 shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col">
            <div className="px-3 py-2 border-b border-slate-700 text-sm font-semibold flex items-center gap-2">
              <ListMusic className="w-4 h-4" /> Playlist
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {playlist.length === 0 && (
                <p className="text-xs text-slate-500 px-1">Drop audio files or open from FS.</p>
              )}
              {playlist.map((track, idx) => (
                <div
                  key={track.id}
                  onClick={() => playTrack(idx)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer ${
                    idx === currentIndex ? 'bg-blue-600/20 text-blue-300' : 'hover:bg-slate-700'
                  }`}
                >
                  <Music className="w-3 h-3 shrink-0" />
                  <span className="flex-1 truncate">{track.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFromPlaylist(track.id); }}
                    className="p-0.5 hover:bg-red-900 rounded opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
            <div className="px-3 py-2 border-t border-slate-700 flex gap-2">
              <label className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-xs cursor-pointer">
                <Upload className="w-3 h-3" /> Upload
                <input type="file" accept="audio/*" className="hidden" onChange={handleFileInput} />
              </label>
              <button
                onClick={() => setShowBrowser(true)}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-xs"
              >
                <FolderOpen className="w-3 h-3" /> FS
              </button>
            </div>
          </div>
        )}

        {/* Center */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
          {/* Visualizer */}
          <div className="flex items-end gap-0.5 h-24 mb-4">
            {visualizerBars.map((h, i) => (
              <div
                key={i}
                className="w-1.5 rounded-t bg-blue-400"
                style={{ height: `${h}px`, transition: 'height 0.05s linear' }}
              />
            ))}
          </div>

          {/* Track info */}
          <div className="text-center mb-4">
            <Disc className={`w-12 h-12 mx-auto mb-2 text-blue-400 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
            <p className="text-lg font-medium truncate max-w-xs">{currentTrack?.name ?? 'No track selected'}</p>
            <p className="text-xs text-slate-400">
              {formatTime(currentTime)} / {formatTime(duration)}
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 mb-3">
            <button onClick={prev} className="p-2 hover:bg-slate-700 rounded" title="Previous">
              <SkipBack className="w-5 h-5" />
            </button>
            <button onClick={togglePlay} className="p-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white" title="Play/Pause">
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </button>
            <button onClick={stop} className="p-2 hover:bg-slate-700 rounded" title="Stop">
              <Square className="w-5 h-5" />
            </button>
            <button onClick={next} className="p-2 hover:bg-slate-700 rounded" title="Next">
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          {/* Seek bar */}
          <div className="w-full max-w-md flex items-center gap-2 mb-2">
            <span className="text-[10px] text-slate-400 w-8 text-right">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={currentTime}
              onChange={(e) => onSeek(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-[10px] text-slate-400 w-8">{formatTime(duration)}</span>
          </div>

          {/* Volume + modes */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setRepeat((v) => !v)}
              className={`p-1.5 rounded ${repeat ? 'bg-blue-600' : 'hover:bg-slate-700'}`}
              title="Repeat"
            >
              <Repeat className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShuffle((v) => !v)}
              className={`p-1.5 rounded ${shuffle ? 'bg-blue-600' : 'hover:bg-slate-700'}`}
              title="Shuffle"
            >
              <Shuffle className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1">
              <button onClick={() => onVolumeChange(muted ? volume : 0)} className="p-1 hover:bg-slate-700 rounded">
                {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
                className="w-20"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Playlist toggle */}
      <button
        onClick={() => setShowPlaylist((v) => !v)}
        className="absolute top-2 right-2 p-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700"
        title="Toggle Playlist"
      >
        <ListMusic className="w-4 h-4" />
      </button>

      {/* File browser modal */}
      {showBrowser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg border border-slate-700 w-[400px] max-w-[90vw] flex flex-col shadow-xl max-h-[70vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <h3 className="font-semibold text-sm">Add from File System</h3>
              <button onClick={() => setShowBrowser(false)} className="p-1 hover:bg-slate-700 rounded">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="px-4 py-2 border-b border-slate-700 text-xs text-slate-400">{currentPath}</div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {currentPath !== '/' && (
                <button
                  onClick={() => setCurrentPath(currentPath.split('/').slice(0, -1).join('/') || '/')}
                  className="w-full text-left px-3 py-2 rounded hover:bg-slate-700 text-sm"
                >
                  ..
                </button>
              )}
              {files.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    const path = fs.getPathById(f.id);
                    addToPlaylist(path, f.name);
                    setShowBrowser(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded hover:bg-slate-700 text-sm flex items-center gap-2"
                >
                  <Music className="w-4 h-4 text-blue-400" /> {f.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
