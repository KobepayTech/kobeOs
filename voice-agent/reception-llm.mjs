/**
 * reception-llm.mjs — bridges each spoken turn to the Kobe AI Receptionist.
 *
 * Instead of a raw LLM, the voice pipeline uses this: the caller's transcript is
 * POSTed to /api/reception-public/<slug>/message and the receptionist's reply is
 * spoken back. The KobeOS backend owns menu/order/status/lead logic, so voice
 * behaves identically to web/QR/WhatsApp and orders land on the same kitchen
 * board.
 */

export class ReceptionSession {
  /**
   * @param {object} opts
   * @param {string} opts.apiBase   e.g. https://api.kobeapptz.com
   * @param {string} opts.slug      the receptionist slug
   * @param {{name?:string, phone?:string}} [opts.customer]  known caller (from SIP caller-id)
   */
  constructor({ apiBase, slug, customer }) {
    this.apiBase = apiBase.replace(/\/+$/, '');
    this.slug = slug;
    this.customer = customer;
    this.sessionId = undefined;
  }

  /** Fetch greeting + capabilities so the agent can open the call. */
  async profile() {
    const res = await fetch(`${this.apiBase}/api/reception-public/${encodeURIComponent(this.slug)}`);
    if (!res.ok) throw new Error(`reception profile ${res.status}`);
    return res.json();
  }

  /** Send one caller utterance, return the assistant's reply text. */
  async say(text) {
    const res = await fetch(`${this.apiBase}/api/reception-public/${encodeURIComponent(this.slug)}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: this.sessionId, text, channel: 'voice', customer: this.customer }),
    });
    if (!res.ok) throw new Error(`reception message ${res.status}`);
    const data = await res.json();
    this.sessionId = data.sessionId; // persist conversation state (cart, contact, stage)
    return data.reply;
  }
}
