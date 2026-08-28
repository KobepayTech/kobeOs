/**
 * agent.mjs — Kobe Receptionist voice agent (LiveKit Agents, Node).
 *
 * SCAFFOLD: architecturally complete and wired to the live reception endpoints,
 * but the exact @livekit/agents API + plugin imports must be pinned to your
 * installed version on first run (the surface changes between releases). The
 * shape below follows the LiveKit Agents voice-pipeline pattern.
 *
 * Pipeline:  VAD → STT → ReceptionSession (KobeOS) → TTS
 * The "brain" is the Kobe AI Receptionist API, not a raw LLM, so every channel
 * (voice/web/QR/WhatsApp) shares one engine and one conversation state.
 */
import 'dotenv/config';
import { ReceptionSession } from './reception-llm.mjs';

// NOTE: pin these to your installed @livekit/agents release.
//   import { cli, defineAgent, pipeline, WorkerOptions } from '@livekit/agents';
//   import * as deepgram from '@livekit/agents-plugin-deepgram';   // STT
//   import * as elevenlabs from '@livekit/agents-plugin-elevenlabs'; // TTS
//   import * as silero from '@livekit/agents-plugin-silero';         // VAD

const CONFIG = {
  apiBase: process.env.KOBE_API_BASE || 'https://api.kobeapptz.com',
  // In production the receptionist slug is resolved from the dialed number via
  // a LiveKit SIP dispatch rule / room metadata; RECEPTION_SLUG is the dev default.
  defaultSlug: process.env.RECEPTION_SLUG || '',
};

/**
 * entry(ctx) — called per call/room. Wire this into defineAgent(...) for your
 * @livekit/agents version. `ctx` gives you the room, participant and SIP data.
 */
export async function entry(ctx) {
  await ctx.connect();

  // Slug + caller id from SIP dispatch metadata (fallback to env for dev).
  const slug = ctx.room?.metadata && safeJson(ctx.room.metadata)?.receptionSlug || CONFIG.defaultSlug;
  const callerPhone = firstParticipantPhone(ctx);
  if (!slug) throw new Error('No receptionist slug (set RECEPTION_SLUG or SIP dispatch metadata)');

  const reception = new ReceptionSession({ apiBase: CONFIG.apiBase, slug, customer: callerPhone ? { phone: callerPhone } : undefined });
  const profile = await reception.profile();

  // Build the voice pipeline for your installed version, e.g.:
  //
  //   const agent = new pipeline.VoicePipelineAgent(
  //     silero.VAD.load(),
  //     new deepgram.STT({ model: 'nova-2', language: 'multi' }),   // en + sw where supported
  //     { chat: async ({ messages }) => reception.say(lastUserText(messages)) }, // ← our brain
  //     new elevenlabs.TTS({ voice: process.env.TTS_VOICE }),
  //   );
  //   agent.start(ctx.room);
  //   await agent.say(profile.greeting, /* allowInterruptions */ true);
  //
  // Until the versioned pipeline is wired, expose the turn handler so a custom
  // STT/TTS loop (or a test harness) can drive it:
  return {
    greeting: profile.greeting,
    /** Feed a recognized utterance, get the text to speak back. */
    onUserTurn: (text) => reception.say(text),
  };
}

function safeJson(s) { try { return JSON.parse(s); } catch { return null; } }
function firstParticipantPhone(ctx) {
  try {
    const p = ctx.room?.remoteParticipants ? [...ctx.room.remoteParticipants.values()][0] : null;
    const attr = p?.attributes?.['sip.phoneNumber'] || p?.identity;
    return typeof attr === 'string' && /^\+?\d{7,}$/.test(attr) ? attr : undefined;
  } catch { return undefined; }
}

// When wired to @livekit/agents:
//   cli.runApp(new WorkerOptions({ agent: defineAgent({ entry }) }));
