import { useEffect, useRef, useState } from 'react';
import { Copy, Mic, MicOff, PhoneOff, Users, Video, VideoOff } from 'lucide-react';
import { io, type Socket } from 'socket.io-client';
import { getToken } from '@/lib/api';

type PeerView = { peerId: string; stream: MediaStream };
type JoinAck = { ok: boolean; error?: string; peers?: Array<{ peerId: string; email?: string }> };
const SIGNAL_ORIGIN = import.meta.env.VITE_API_ORIGIN || window.location.origin;
const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

export default function VideoConference() {
  const initialRoom = new URL(window.location.href).searchParams.get('room') || '';
  const [roomId, setRoomId] = useState(initialRoom);
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<PeerView[]>([]);
  const [error, setError] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  const closePeer = (peerId: string) => {
    pcsRef.current.get(peerId)?.close();
    pcsRef.current.delete(peerId);
    setPeers((current) => current.filter((peer) => peer.peerId !== peerId));
  };

  const cleanup = () => {
    const socket = socketRef.current;
    const room = roomId.trim();
    if (socket?.connected && room) socket.emit('rtc:leave', { roomId: room });
    socket?.disconnect();
    socketRef.current = null;
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setLocalStream(null);
    setPeers([]);
    setJoined(false);
  };

  useEffect(() => () => {
    socketRef.current?.disconnect();
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const makePeer = (peerId: string, socket: Socket, cleanRoom: string) => {
    const existing = pcsRef.current.get(peerId);
    if (existing) return existing;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    streamRef.current?.getTracks().forEach((track) => pc.addTrack(track, streamRef.current as MediaStream));
    pc.onicecandidate = (event) => {
      if (event.candidate) socket.emit('rtc:ice', { roomId: cleanRoom, to: peerId, candidate: event.candidate.toJSON() });
    };
    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) return;
      setPeers((current) => current.some((peer) => peer.peerId === peerId) ? current.map((peer) => peer.peerId === peerId ? { peerId, stream } : peer) : [...current, { peerId, stream }]);
    };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) closePeer(peerId);
    };
    pcsRef.current.set(peerId, pc);
    return pc;
  };

  const createOffer = async (peerId: string, socket: Socket, cleanRoom: string) => {
    const pc = makePeer(peerId, socket, cleanRoom);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('rtc:offer', { roomId: cleanRoom, to: peerId, description: offer });
  };

  const join = async () => {
    setError('');
    const cleanRoom = roomId.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
    if (!cleanRoom) {
      setError('Enter a meeting room code.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      setLocalStream(stream);
      setRoomId(cleanRoom);

      const socket = io(`${SIGNAL_ORIGIN}/chat`, { transports: ['websocket'], auth: { token: getToken() || '' } });
      socketRef.current = socket;
      socket.on('connect_error', (cause) => setError(cause.message));
      socket.on('rtc:peer-joined', ({ peerId }: { peerId: string }) => { void createOffer(peerId, socket, cleanRoom); });
      socket.on('rtc:peer-left', ({ peerId }: { peerId: string }) => closePeer(peerId));
      socket.on('rtc:offer', async ({ from, description }: { from: string; description: RTCSessionDescriptionInit }) => {
        const pc = makePeer(from, socket, cleanRoom);
        await pc.setRemoteDescription(description);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('rtc:answer', { roomId: cleanRoom, to: from, description: answer });
      });
      socket.on('rtc:answer', async ({ from, description }: { from: string; description: RTCSessionDescriptionInit }) => {
        const pc = pcsRef.current.get(from);
        if (pc) await pc.setRemoteDescription(description);
      });
      socket.on('rtc:ice', ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
        const pc = makePeer(from, socket, cleanRoom);
        void pc.addIceCandidate(candidate).catch((cause) => setError((cause as Error).message));
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('Meeting signaling timed out.')), 8000);
        socket.emit('rtc:join', { roomId: cleanRoom }, (ack: JoinAck) => {
          window.clearTimeout(timeout);
          if (!ack?.ok) {
            reject(new Error(ack?.error || 'Could not join meeting.'));
            return;
          }
          (ack.peers || []).forEach((peer) => { void createOffer(peer.peerId, socket, cleanRoom); });
          resolve();
        });
      });

      setJoined(true);
      const url = new URL(window.location.href);
      url.searchParams.set('room', cleanRoom);
      window.history.replaceState({}, '', url);
    } catch (cause) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setLocalStream(null);
      setError((cause as Error).message || 'Camera and microphone access are required.');
    }
  };

  const toggleMic = () => {
    const next = !muted;
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMuted(next);
  };

  const toggleCamera = () => {
    const next = !cameraOff;
    streamRef.current?.getVideoTracks().forEach((track) => { track.enabled = !next; });
    setCameraOff(next);
  };

  const copyInvite = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`;
    void navigator.clipboard.writeText(url).catch(() => setError('Could not copy the invite link.'));
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#07111f] text-white">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-4">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-500/15 text-cyan-300"><Video className="h-5 w-5" /></div>
        <div><h1 className="font-black">Kobe Meet</h1><p className="text-[11px] text-slate-500">Authenticated peer-to-peer WebRTC meetings</p></div>
        {joined && <><span className="ml-auto text-xs text-slate-400">Room <b className="text-white">{roomId}</b></span><button onClick={copyInvite} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10"><Copy className="h-4 w-4" /></button></>}
      </header>

      {!joined ? (
        <main className="grid flex-1 place-items-center p-6">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <Users className="h-10 w-10 text-cyan-300" />
            <h2 className="mt-4 text-2xl font-black">Start or join a meeting</h2>
            <p className="mt-2 text-sm text-slate-400">Everyone joins the same room code while signed into KobeOS. Signaling stays inside KobeOS; video and audio use WebRTC.</p>
            <label className="mt-5 grid gap-1 text-xs text-slate-400">Room code<input value={roomId} onChange={(event) => setRoomId(event.target.value)} className="h-11 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-base" /></label>
            {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
            <button onClick={() => void join()} className="mt-5 h-11 w-full rounded-xl bg-cyan-500 font-black text-[#07111f]">Join meeting</button>
          </div>
        </main>
      ) : (
        <>
          <main className="min-h-0 flex-1 overflow-auto p-4">
            <div className={`grid gap-3 ${peers.length ? 'sm:grid-cols-2 xl:grid-cols-3' : 'mx-auto max-w-4xl grid-cols-1'}`}>
              <VideoTile label="You" stream={localStream} muted />
              {peers.map((peer) => <VideoTile key={peer.peerId} label={`Participant ${peer.peerId.slice(0, 5)}`} stream={peer.stream} />)}
              {!peers.length && <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-white/10 p-6 text-center text-slate-500"><div><Users className="mx-auto mb-2 h-8 w-8" /><p>Waiting for another participant.</p><button onClick={copyInvite} className="mt-2 text-sm text-cyan-300 underline">Copy invite link</button></div></div>}
            </div>
            {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
          </main>
          <footer className="flex h-20 shrink-0 items-center justify-center gap-3 border-t border-white/10">
            <button onClick={toggleMic} aria-label="Toggle microphone" className={`grid h-12 w-12 place-items-center rounded-full ${muted ? 'bg-rose-500/20 text-rose-300' : 'bg-white/10'}`}>{muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</button>
            <button onClick={toggleCamera} aria-label="Toggle camera" className={`grid h-12 w-12 place-items-center rounded-full ${cameraOff ? 'bg-rose-500/20 text-rose-300' : 'bg-white/10'}`}>{cameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}</button>
            <button onClick={cleanup} className="inline-flex h-12 items-center gap-2 rounded-full bg-rose-600 px-5 font-black"><PhoneOff className="h-5 w-5" />Leave</button>
          </footer>
        </>
      )}
    </div>
  );
}

function VideoTile({ label, stream, muted = false }: { label: string; stream: MediaStream | null; muted?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const node = videoRef.current;
    if (node) node.srcObject = stream;
    return () => { if (node) node.srcObject = null; };
  }, [stream]);
  return <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black"><video ref={videoRef} autoPlay playsInline muted={muted} className="h-full w-full object-cover" /><span className="absolute bottom-3 left-3 rounded-lg bg-black/60 px-2 py-1 text-xs font-bold">{label}</span></div>;
}
