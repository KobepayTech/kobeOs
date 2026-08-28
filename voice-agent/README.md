# Kobe Receptionist — Voice Agent (LiveKit)

Answers phone calls and takes restaurant orders by voice, using the **same**
Kobe AI Receptionist engine as the web/QR/WhatsApp channels. The agent is a thin
bridge: caller audio → STT → **POST /api/reception-public/:slug/message** →
reply text → TTS → caller. All the intelligence (menu, ordering, status, leads)
lives in the KobeOS backend, so voice stays in sync with every other channel and
needs no separate prompt.

```
   PHONE ──(SIP trunk)──▶ LiveKit SIP ──▶ LiveKit room ──▶ this agent
                                                              │  STT (transcript)
                                                              ▼
                                   POST /api/reception-public/<slug>/message
                                                              │  reply text
                                                              ▼
                                                            TTS ──▶ caller
```

## Why this needs YOUR infra (can't run in the build sandbox)
- A **LiveKit** server or LiveKit Cloud (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`).
- **LiveKit SIP** + a telephony/SIP trunk (e.g. Twilio/Telnyx) to receive real phone numbers, and inbound dispatch rules routing a called number → the receptionist slug.
- **STT/TTS** provider keys (Deepgram/OpenAI for STT; ElevenLabs/OpenAI/Cartesia for TTS). Swahili + English support depends on the provider/voice you pick.
- The KobeOS API reachable at `KOBE_API_BASE`.

None of these secrets are committed; set them in `voice-agent/.env`.

## Files
- `agent.mjs` — the LiveKit Agents entry. Wraps the reception API as the agent's
  "LLM" so the voice pipeline (VAD → STT → **reception** → TTS) reuses the exact
  same brain. Pin `@livekit/agents` + plugin versions to your installed release;
  the plugin API surface changes between versions.
- `reception-llm.mjs` — the shim that turns each user turn into a call to
  `/api/reception-public/<slug>/message`, threading the `sessionId` so the
  conversation (cart, contact) persists across turns.

## Run (on a host with the SDK + keys)
```
cd voice-agent
cp .env.example .env   # fill in LiveKit + STT/TTS + KOBE_API_BASE + RECEPTION_SLUG
npm install
node agent.mjs dev     # or `start` for prod; connect a SIP number to it
```

## Status
This is a **scaffold** — architecturally complete and wired to the live reception
endpoints, but not executed here (no LiveKit/telephony in CI). Expect to pin the
`@livekit/agents` version and adjust the plugin imports to match it on first run.
