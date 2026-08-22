/**
 * Minimal obs-websocket v5 client — no dependency. Talks to OBS's built-in
 * WebSocket server (Tools → WebSocket Server Settings, default ws://localhost:4455)
 * so KobeSports can auto-connect and drive OBS: drop in the scoreboard overlay
 * as a Browser Source and start/stop the stream. The user installs OBS once and
 * enables the WebSocket server; after that KobeSports controls it.
 *
 * Protocol: https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md
 */

async function sha256Base64(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

export class ObsClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private reqId = 0;
  connected = false;

  /** Connect + authenticate. Rejects on bad password / unreachable. */
  connect(url: string, password = ''): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const ws = new WebSocket(url);
      this.ws = ws;
      const fail = (m: string) => { if (!settled) { settled = true; reject(new Error(m)); } };

      ws.onerror = () => fail('Could not reach OBS. Is OBS open with the WebSocket server enabled?');
      ws.onclose = () => { this.connected = false; if (!settled) fail('Connection closed before identifying.'); };
      ws.onmessage = async (ev) => {
        let msg: { op: number; d: Record<string, unknown> };
        try { msg = JSON.parse(ev.data as string); } catch { return; }

        if (msg.op === 0) { // Hello → Identify
          const d = msg.d as { authentication?: { challenge: string; salt: string }; rpcVersion?: number };
          const identify: Record<string, unknown> = { rpcVersion: d.rpcVersion ?? 1 };
          if (d.authentication) {
            if (!password) return fail('OBS requires a WebSocket password — set it in the field.');
            const secret = await sha256Base64(password + d.authentication.salt);
            identify.authentication = await sha256Base64(secret + d.authentication.challenge);
          }
          ws.send(JSON.stringify({ op: 1, d: identify }));
        } else if (msg.op === 2) { // Identified
          this.connected = true; settled = true; resolve();
        } else if (msg.op === 7) { // RequestResponse
          const d = msg.d as { requestId: string; requestStatus: { result: boolean; comment?: string }; responseData?: unknown };
          const p = this.pending.get(d.requestId);
          if (p) {
            this.pending.delete(d.requestId);
            if (d.requestStatus.result) p.resolve(d.responseData ?? {});
            else p.reject(new Error(d.requestStatus.comment || 'OBS request failed'));
          }
        }
      };
    });
  }

  private request<T = Record<string, unknown>>(requestType: string, requestData?: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || !this.connected) return reject(new Error('Not connected to OBS'));
      const requestId = `r${++this.reqId}`;
      this.pending.set(requestId, { resolve: resolve as (v: unknown) => void, reject });
      this.ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }));
      setTimeout(() => { if (this.pending.delete(requestId)) reject(new Error('OBS request timed out')); }, 8000);
    });
  }

  /** Add (or update) the KobeSports overlay as a Browser Source in the current scene. */
  async addOverlay(url: string): Promise<void> {
    const scene = await this.request<{ currentProgramSceneName: string }>('GetCurrentProgramScene');
    const sceneName = scene.currentProgramSceneName;
    const inputName = 'KobeSports Overlay';
    const inputSettings = { url, width: 1920, height: 1080, reroute_audio: false };
    try {
      await this.request('CreateInput', { sceneName, inputName, inputKind: 'browser_source', inputSettings, sceneItemEnabled: true });
    } catch {
      // Already exists → just refresh its URL/size.
      await this.request('SetInputSettings', { inputName, inputSettings, overlay: true });
    }
  }

  async streamStatus(): Promise<boolean> {
    const s = await this.request<{ outputActive: boolean }>('GetStreamStatus');
    return !!s.outputActive;
  }
  startStream() { return this.request('StartStream'); }
  stopStream() { return this.request('StopStream'); }

  disconnect() { this.connected = false; this.ws?.close(); this.ws = null; this.pending.clear(); }
}
