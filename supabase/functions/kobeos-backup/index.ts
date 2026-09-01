
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PRIMARY = "https://api.kobeapptz.com/api";
const SNAPSHOT_KEY = "lala_public";

function emergencyAppHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Lala · Independent Backup</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#241638;background:#f8f5ff}
*{box-sizing:border-box}body{margin:0}.top{background:#24103f;color:white;padding:18px 20px}.bar{max-width:1100px;margin:auto;display:flex;gap:12px;align-items:center}.logo{width:44px;height:44px;border-radius:15px;background:#ffcb69;color:#24103f;display:grid;place-items:center;font-weight:900}.tag{margin-left:auto;font-size:12px;color:#ffe7a6}.hero{background:linear-gradient(135deg,#321456,#552282,#8a3b82);color:white;padding:46px 20px}.hero>div,.main{max-width:1100px;margin:auto}.hero h1{font-size:clamp(34px,7vw,62px);line-height:.98;margin:12px 0}.hero p{color:#e8d9f8;max-width:720px}.notice{background:#fff5ce;color:#684b00;border:1px solid #f5d66c;border-radius:14px;padding:12px 14px;font-weight:700;margin:18px 0}.search{display:grid;grid-template-columns:1.4fr 1fr 1fr .6fr auto;gap:8px;background:white;padding:10px;border-radius:20px;margin-top:24px}input,button{font:inherit}.search input{height:44px;border:1px solid #e9e2f2;border-radius:11px;padding:0 11px}.search button,.primary{border:0;border-radius:11px;background:#24103f;color:white;font-weight:850;padding:0 18px;min-height:44px;cursor:pointer}.main{padding:20px}.status{min-height:22px;margin-bottom:12px;font-size:14px}.error{color:#b42318}.ok{color:#087443;font-weight:750}.grid{display:grid;gap:16px}.hotel{background:white;border:1px solid #ece6f4;border-radius:24px;padding:20px;box-shadow:0 8px 30px rgba(35,16,63,.05)}.hotel h2{margin:0}.meta{color:#776c82;font-size:14px;margin:5px 0 12px}.rooms{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}.room{border:1px solid #e9e2f2;border-radius:16px;padding:14px;background:#fcfbff}.room b{display:block}.price{color:#59228b;font-weight:900;margin:7px 0}.room button{width:100%;margin-top:10px}.empty{text-align:center;color:#796e84;padding:54px 15px}.small{font-size:12px;color:#80758a}.pill{display:inline-block;background:#f1e9ff;color:#6429a0;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:800}
@media(max-width:760px){.search{grid-template-columns:1fr 1fr}.search input:first-child,.search button{grid-column:1/-1}.tag{display:none}}
</style>
</head>
<body>
<header class="top"><div class="bar"><div class="logo">L</div><div><b style="font-size:20px">Lala</b><div style="font-size:10px;letter-spacing:.18em;color:#bba8ce">KOBEOS HOTEL NETWORK</div></div><span class="tag">Independent emergency path · Supabase</span></div></header>
<section class="hero"><div><span style="font-size:12px;font-weight:900;letter-spacing:.12em;color:#ffcb69">CLOUDFLARE-INDEPENDENT BACKUP</span><h1>Find a room even<br>when primary is down.</h1><p>This emergency Lala runs on a separate provider. Availability is a recent synchronized snapshot; new booking requests are saved safely and confirmed automatically when primary KobeOS reconnects.</p>
<div class="search">
<input id="destination" placeholder="City or hotel">
<input id="checkin" type="date">
<input id="checkout" type="date">
<input id="guests" type="number" min="1" value="1">
<button id="searchBtn">Search rooms</button>
</div></div></section>
<main class="main">
<div class="notice">Backup mode: requests may show <b>awaiting confirmation</b> until the primary KobeOS inventory reconnects. The backup never pretends a queued request is a confirmed room.</div>
<div id="status" class="status"></div>
<div id="results" class="grid"></div>
</main>
<script>
const API = location.origin + location.pathname.replace(/\\/(app|lala)\\/?$/, '').replace(/\\/$/,'');
const el = (id) => document.getElementById(id);
const today = new Date();
const iso = (d) => d.toISOString().slice(0,10);
el('checkin').value = iso(today);
const tomorrow = new Date(today.getTime()+86400000);
el('checkout').value = iso(tomorrow);
el('checkin').min=iso(today); el('checkout').min=iso(today);
function setStatus(message,type){const e=el('status');e.textContent=message;e.className='status '+(type||'')}
function money(n,c){return (c||'TZS')+' '+Number(n||0).toLocaleString()}
function make(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}
async function api(path,init){
  const r=await fetch(API+path,{...(init||{}),headers:{'Content-Type':'application/json',...((init&&init.headers)||{})}});
  const text=await r.text();let body=null;try{body=text?JSON.parse(text):null}catch{body={message:text}}
  if(!r.ok)throw new Error((body&&body.message)||('HTTP '+r.status));
  return body;
}
async function passport(){
  let t=localStorage.getItem('lala_backup_passport');
  if(t)return t;
  const name=prompt('Your full name');if(!name)throw new Error('Name is required');
  const phone=prompt('Your phone number');if(!phone)throw new Error('Phone number is required');
  const p=await api('/lala-public/passports',{method:'POST',body:JSON.stringify({name,phone})});
  t=p.passport.qrToken;localStorage.setItem('lala_backup_passport',t);return t;
}
async function book(hotel,room){
  try{
    setStatus('Saving booking request…');
    const passportToken=await passport();
    const result=await api('/lala-public/bookings',{method:'POST',body:JSON.stringify({
      hotelId:hotel.id,roomId:room.id,passportToken:passportToken,
      checkIn:el('checkin').value,checkOut:el('checkout').value,guests:Number(el('guests').value||1)
    })});
    setStatus(result.pendingConfirmation
      ? 'Saved safely. Request '+result.booking.id.slice(0,8)+' is awaiting primary confirmation.'
      : 'Booking '+result.booking.id.slice(0,8)+' confirmed.','ok');
  }catch(e){setStatus(e.message,'error')}
}
function render(rows){
  const root=el('results');root.replaceChildren();
  if(!rows.length){root.append(make('div','empty','No synchronized rooms match this search yet.'));return}
  for(const row of rows){
    const card=make('article','hotel');card.append(make('h2','',row.hotel.name));
    card.append(make('div','meta',row.hotel.location||''));
    card.append(make('p','small',(row.profile&&row.profile.description)||''));
    const rooms=make('div','rooms');
    for(const room of (row.availableRooms||[])){
      const rc=make('div','room');rc.append(make('span','pill',room.type||'Room'));
      rc.append(make('b','',room.roomNumber?('Room '+room.roomNumber):'Available room'));
      rc.append(make('div','small','Up to '+Number(room.capacity||1)+' guests'));
      rc.append(make('div','price',money(room.rate,room.currency)+' / night'));
      const b=make('button','primary','Request this room');b.onclick=()=>book(row.hotel,room);rc.append(b);rooms.append(rc);
    }
    card.append(rooms);root.append(card);
  }
}
async function search(){
  try{
    setStatus('Checking independent backup…');
    const q=new URLSearchParams({
      destination:el('destination').value,
      checkIn:el('checkin').value,
      checkOut:el('checkout').value,
      guests:el('guests').value||'1'
    });
    const rows=await api('/lala-public/search?'+q.toString());
    setStatus(rows.length?('Backup is healthy · '+rows.length+' hotel result'+(rows.length===1?'':'s')):'Backup is healthy · no current synchronized inventory','ok');
    render(rows);
  }catch(e){setStatus(e.message,'error');render([])}
}
el('searchBtn').onclick=search;
search();
</script>
</body></html>`;
}

function html(body: string, origin: string | null = null) {
  return new Response(body, {
    status: 200,
    headers: {
      ...cors(origin),
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Kobe-Production-Path": "supabase-backup",
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}


function cors(origin: string | null) {
  const allowed =
    !origin ||
    origin === "https://kobepaytech.github.io" ||
    origin === "https://kobeapptz.com" ||
    /^https:\/\/[a-z0-9-]+\.kobeapptz\.com$/i.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed && origin ? origin : "https://kobepaytech.github.io",
    "Access-Control-Allow-Headers": "content-type, authorization, x-client-info, apikey",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Kobe-Production-Path": "supabase-backup",
    },
  });
}

function cleanPhone(value: unknown) {
  return String(value ?? "").trim().replace(/[^0-9+]/g, "");
}

function token() {
  return crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
}

function shortCode() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
}

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function snapshotRow() {
  const { data, error } = await db
    .from("kobe_backup_snapshots")
    .select("payload,synced_at,last_error")
    .eq("key", SNAPSHOT_KEY)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function syncSnapshot() {
  try {
    let payload: any;
    let sourceUrl = `${PRIMARY}/lala-public/backup-snapshot`;

    const response = await fetch(sourceUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });

    if (response.ok) {
      payload = await response.json();
    } else if (response.status === 404) {
      // Compatibility path for an origin that has not deployed the dedicated
      // snapshot route yet. All of this data is already public on Lala.
      sourceUrl = `${PRIMARY}/lala-public/search`;
      const searchResponse = await fetch(sourceUrl, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!searchResponse.ok) {
        throw new Error(`Primary search HTTP ${searchResponse.status}`);
      }

      const rows = await searchResponse.json();
      const menus: any[] = [];
      for (const row of Array.isArray(rows) ? rows : []) {
        if (!row?.foodAvailable || !row?.hotel?.slug) continue;
        try {
          const menuResponse = await fetch(
            `${PRIMARY}/public/hotel/${encodeURIComponent(row.hotel.slug)}/menu-items`,
            { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8_000) },
          );
          if (!menuResponse.ok) continue;
          const items = await menuResponse.json();
          for (const item of Array.isArray(items) ? items : []) {
            menus.push({ hotelSlug: row.hotel.slug, item });
          }
        } catch {
          // Keep the hotel snapshot even if one menu endpoint is temporarily slow.
        }
      }

      payload = {
        version: 1,
        generatedAt: new Date().toISOString(),
        rows: Array.isArray(rows) ? rows : [],
        menus,
        compatibilitySource: true,
      };
    } else {
      throw new Error(`Primary snapshot HTTP ${response.status}`);
    }

    const now = new Date().toISOString();
    const { error } = await db.from("kobe_backup_snapshots").upsert({
      key: SNAPSHOT_KEY,
      payload,
      synced_at: now,
      source_url: sourceUrl,
      last_error: null,
      updated_at: now,
    });
    if (error) throw error;
    return { ok: true, syncedAt: now, sourceUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.from("kobe_backup_snapshots").upsert({
      key: SNAPSHOT_KEY,
      payload: { generatedAt: null, rows: [], menus: [] },
      last_error: message,
      updated_at: new Date().toISOString(),
    }, { onConflict: "key", ignoreDuplicates: true });
    await db.from("kobe_backup_snapshots")
      .update({ last_error: message, updated_at: new Date().toISOString() })
      .eq("key", SNAPSHOT_KEY);
    return { ok: false, error: message };
  }
}

async function primaryJson(path: string, init: RequestInit = {}) {
  const response = await fetch(`${PRIMARY}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { message: text }; }
  return { response, body };
}

async function ensurePrimaryPassport(backupToken: string) {
  const { data: passport, error } = await db
    .from("kobe_backup_passports")
    .select("*")
    .eq("qr_token", backupToken)
    .maybeSingle();
  if (error) throw error;
  if (!passport) return backupToken;
  if (passport.primary_passport_token) return passport.primary_passport_token;

  const { response, body } = await primaryJson("/lala-public/passports", {
    method: "POST",
    body: JSON.stringify({
      phone: passport.phone,
      name: passport.name,
      email: passport.email,
      nationality: passport.nationality,
      preferences: passport.preferences,
      privacy: passport.privacy,
    }),
  });
  if (!response.ok || !body?.passport?.qrToken) {
    throw Object.assign(new Error(`Primary passport HTTP ${response.status}`), { status: response.status });
  }

  await db.from("kobe_backup_passports")
    .update({
      primary_passport_token: body.passport.qrToken,
      updated_at: new Date().toISOString(),
    })
    .eq("id", passport.id);

  return body.passport.qrToken as string;
}

async function replayOne(row: any) {
  const payload = row.payload || {};
  try {
    let result: any;
    if (row.kind === "BOOKING") {
      const primaryToken = await ensurePrimaryPassport(row.passport_token);
      const { response, body } = await primaryJson("/lala-public/bookings", {
        method: "POST",
        body: JSON.stringify({ ...payload, passportToken: primaryToken }),
      });
      if (!response.ok) throw Object.assign(new Error(`Booking HTTP ${response.status}: ${body?.message ?? ""}`), { status: response.status });
      result = body;
    } else if (row.kind === "REVERSE_REQUEST") {
      const primaryToken = await ensurePrimaryPassport(row.passport_token);
      const { response, body } = await primaryJson("/lala-public/reverse-requests", {
        method: "POST",
        body: JSON.stringify({ ...payload, passportToken: primaryToken }),
      });
      if (!response.ok) throw Object.assign(new Error(`Reverse request HTTP ${response.status}`), { status: response.status });
      result = body;
    } else if (row.kind === "ORDER") {
      const { slug, order } = payload;
      const { response, body } = await primaryJson(`/public/hotel/${encodeURIComponent(slug)}/orders`, {
        method: "POST",
        body: JSON.stringify(order),
      });
      if (!response.ok) throw Object.assign(new Error(`Order HTTP ${response.status}`), { status: response.status });
      result = body;
    } else {
      throw Object.assign(new Error("Unsupported queue kind"), { status: 400 });
    }

    const primaryId =
      result?.booking?.id || result?.id || result?.request?.id || null;
    await db.from("kobe_backup_queue").update({
      status: "CONFIRMED",
      attempts: row.attempts + 1,
      primary_id: primaryId,
      primary_response: result,
      last_error: null,
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);
    return { id: row.id, status: "CONFIRMED", primaryId };
  } catch (error: any) {
    const status = Number(error?.status || 0);
    const terminal = status >= 400 && status < 500 && status !== 408 && status !== 429;
    const message = error instanceof Error ? error.message : String(error);
    await db.from("kobe_backup_queue").update({
      status: terminal ? "FAILED" : "RETRY",
      attempts: row.attempts + 1,
      last_error: message,
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);
    return { id: row.id, status: terminal ? "FAILED" : "RETRY", error: message };
  }
}

async function replayQueue() {
  const { data, error } = await db
    .from("kobe_backup_queue")
    .select("*")
    .in("status", ["PENDING", "RETRY"])
    .order("created_at", { ascending: true })
    .limit(25);
  if (error) throw error;
  const results = [];
  for (const row of data || []) results.push(await replayOne(row));
  return results;
}

async function maintenance() {
  const sync = await syncSnapshot();
  const replay = await replayQueue();
  return { sync, replay };
}

async function search(url: URL) {
  const snap = await snapshotRow();
  const payload: any = snap?.payload || {};
  let rows: any[] = Array.isArray(payload.rows) ? payload.rows : [];
  const destination = (url.searchParams.get("destination") || "").toLowerCase();
  const guests = Math.max(1, Number(url.searchParams.get("guests") || 1));
  const maxPrice = Number(url.searchParams.get("maxPrice") || 0);
  const amenity = (url.searchParams.get("amenity") || "").toLowerCase();
  const lastMinute = url.searchParams.get("lastMinute") === "true";

  rows = rows
    .filter((row) => !destination || `${row?.hotel?.name || ""} ${row?.hotel?.location || ""}`.toLowerCase().includes(destination))
    .filter((row) => !amenity || (row?.profile?.amenities || []).some((a: string) => String(a).toLowerCase().includes(amenity)))
    .filter((row) => !lastMinute || row?.profile?.lastMinuteEnabled !== false)
    .map((row) => ({
      ...row,
      availableRooms: (row.availableRooms || []).filter((room: any) =>
        Number(room.capacity || 1) >= guests && (!maxPrice || Number(room.rate || 0) <= maxPrice)
      ),
      backupMode: true,
      verifiedAvailabilityAt: snap?.synced_at || row.verifiedAvailabilityAt,
    }))
    .filter((row) => row.availableRooms.length > 0);

  return rows;
}

async function upsertPassport(body: any) {
  const phone = cleanPhone(body.phone);
  const name = String(body.name || "").trim();
  if (!phone || !name) throw Object.assign(new Error("Name and phone are required"), { status: 400 });

  const { data: existing } = await db.from("kobe_backup_passports")
    .select("*").eq("phone", phone).maybeSingle();
  const now = new Date().toISOString();

  const record = existing ? {
    ...existing,
    name,
    email: String(body.email || existing.email || "").trim().toLowerCase(),
    nationality: String(body.nationality || existing.nationality || "").trim(),
    preferences: body.preferences || existing.preferences || {},
    privacy: { ...(existing.privacy || {}), ...(body.privacy || {}) },
    updated_at: now,
  } : {
    qr_token: token(),
    passport_number: `LALA-BK-${shortCode()}`,
    phone,
    name,
    email: String(body.email || "").trim().toLowerCase(),
    nationality: String(body.nationality || "").trim(),
    preferences: body.preferences || {},
    privacy: { shareName: true, sharePhone: true, shareHistory: false, ...(body.privacy || {}) },
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await db.from("kobe_backup_passports")
    .upsert(record, { onConflict: "phone" }).select("*").single();
  if (error) throw error;
  return data;
}

async function passportView(backupToken: string) {
  const { data: passport, error } = await db.from("kobe_backup_passports")
    .select("*").eq("qr_token", backupToken).maybeSingle();
  if (error) throw error;

  // If this token came from primary before the Supabase backup existed, try it
  // directly. During an outage that request may fail, but queued bookings can
  // still be shown and replayed later without copying private passport data.
  const primaryToken = passport?.primary_passport_token || backupToken;
  try {
    const { response, body } = await primaryJson(
      `/lala-public/passports/${encodeURIComponent(primaryToken)}`
    );
    if (response.ok) return body;
  } catch { /* independent backup view below */ }

  const localPassport = passport || {
    passport_number: "LALA-BACKUP",
    name: "Lala guest",
    phone: "",
    nationality: "",
    preferences: {},
    privacy: { shareName: true, sharePhone: false, shareHistory: false },
  };

  const { data: queued } = await db.from("kobe_backup_queue")
    .select("*")
    .eq("passport_token", backupToken)
    .eq("kind", "BOOKING")
    .order("created_at", { ascending: false });

  const snap = await snapshotRow();
  const rows: any[] = Array.isArray((snap?.payload as any)?.rows) ? (snap!.payload as any).rows : [];
  const activeBookings = (queued || []).map((q: any) => {
    const hotel = rows.find((r) => r?.hotel?.id === q.payload?.hotelId);
    const room = hotel?.availableRooms?.find((r: any) => r.id === q.payload?.roomId);
    const nights = Math.max(1, Math.ceil(
      (new Date(q.payload.checkOut).getTime() - new Date(q.payload.checkIn).getTime()) / 86400000
    ));
    return {
      id: q.primary_id || q.id,
      hotelName: hotel?.hotel?.name || "Hotel",
      roomNumber: room?.roomNumber || "",
      roomType: room?.type || "",
      checkIn: q.payload?.checkIn,
      checkOut: q.payload?.checkOut,
      status: q.status === "CONFIRMED" ? "CONFIRMED" : q.status === "FAILED" ? "FAILED" : "BACKUP_PENDING",
      totalAmount: Number(room?.rate || 0) * nights,
      currency: room?.currency || hotel?.hotel?.currency || "TZS",
    };
  });

  return {
    passport: {
      passportNumber: localPassport.passport_number,
      name: localPassport.privacy?.shareName === false ? "Lala guest" : localPassport.name,
      phone: localPassport.privacy?.sharePhone === false ? "" : localPassport.phone,
      nationality: localPassport.nationality,
      preferences: localPassport.preferences,
    },
    rewards: { points: 0, tier: "Explorer", verifiedStays: 0 },
    hotelLoyalty: [],
    stays: [],
    activeBookings,
    backupMode: true,
  };
}

async function queueBooking(body: any) {
  if (!String(body.passportToken || "").trim()) {
    throw Object.assign(new Error("Lala Passport token is required"), { status: 400 });
  }

  const key = await digest(JSON.stringify({
    passportToken: body.passportToken,
    hotelId: body.hotelId,
    roomId: body.roomId,
    checkIn: body.checkIn,
    checkOut: body.checkOut,
  }));

  const { data: existing } = await db.from("kobe_backup_queue")
    .select("*").eq("kind", "BOOKING").eq("dedupe_key", key).maybeSingle();
  if (existing) return existing;

  const { data, error } = await db.from("kobe_backup_queue").insert({
    kind: "BOOKING",
    dedupe_key: key,
    passport_token: body.passportToken,
    payload: {
      hotelId: body.hotelId,
      roomId: body.roomId,
      checkIn: body.checkIn,
      checkOut: body.checkOut,
      guests: Number(body.guests || 1),
    },
  }).select("*").single();
  if (error) throw error;
  return data;
}

async function queueReverse(body: any) {
  const key = await digest(JSON.stringify({
    passportToken: body.passportToken,
    destination: body.destination,
    checkIn: body.checkIn,
    checkOut: body.checkOut,
    guests: body.guests,
    budget: body.budget,
  }));
  const { data: existing } = await db.from("kobe_backup_queue")
    .select("*").eq("kind", "REVERSE_REQUEST").eq("dedupe_key", key).maybeSingle();
  if (existing) return existing;

  const { data, error } = await db.from("kobe_backup_queue").insert({
    kind: "REVERSE_REQUEST",
    dedupe_key: key,
    passport_token: body.passportToken,
    payload: {
      destination: body.destination,
      checkIn: body.checkIn,
      checkOut: body.checkOut,
      guests: Number(body.guests || 1),
      budget: Number(body.budget || 0),
      currency: body.currency || "TZS",
    },
  }).select("*").single();
  if (error) throw error;
  return data;
}

async function menuForSlug(slug: string) {
  const snap = await snapshotRow();
  const payload: any = snap?.payload || {};
  const menus: any[] = Array.isArray(payload.menus) ? payload.menus : [];
  return menus.filter((m) => m.hotelSlug === slug).map((m) => m.item);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });

  const url = new URL(req.url);
  const markers = ["/functions/v1/kobeos-backup", "/kobeos-backup"];
  const marker = markers.find((value) => url.pathname.startsWith(value));
  const path = marker ? (url.pathname.slice(marker.length) || "/") : url.pathname;

  try {
    if (req.method === "GET" && (path === "/" || path === "/app" || path === "/lala")) {
      return html(emergencyAppHtml(), origin);
    }

    if (req.method === "GET" && path === "/health") {
      const snap = await snapshotRow();
      return json({
        status: "ok",
        service: "kobeos-lala-backup",
        database: "ready",
        mode: "supabase-backup",
        snapshotSyncedAt: snap?.synced_at || null,
        snapshotLastError: snap?.last_error || null,
        checkedAt: new Date().toISOString(),
      }, 200, origin);
    }

    if (req.method === "GET" && path === "/lala-public/health") {
      const snap = await snapshotRow();
      return json({
        status: "ok",
        service: "lala",
        database: "ready",
        mode: "supabase-backup",
        snapshotSyncedAt: snap?.synced_at || null,
        checkedAt: new Date().toISOString(),
      }, 200, origin);
    }

    if (req.method === "GET" && path === "/lala-public/search") {
      return json(await search(url), 200, origin);
    }

    if (req.method === "POST" && path === "/lala-public/passports") {
      const passport = await upsertPassport(await req.json());
      return json({
        passport: {
          id: passport.id,
          passportNumber: passport.passport_number,
          qrToken: passport.qr_token,
          phone: passport.phone,
          name: passport.name,
        },
        rewards: { points: 0, tier: "Explorer", verifiedStays: 0 },
        qrUrl: `/lala/passport/${passport.qr_token}`,
        backupMode: true,
      }, 200, origin);
    }

    const passportMatch = path.match(/^\/lala-public\/passports\/([^/]+)$/);
    if (req.method === "GET" && passportMatch) {
      return json(await passportView(decodeURIComponent(passportMatch[1])), 200, origin);
    }

    if (req.method === "POST" && path === "/lala-public/bookings") {
      const body = await req.json();
      const queued = await queueBooking(body);
      const snap = await snapshotRow();
      const rows: any[] = Array.isArray((snap?.payload as any)?.rows) ? (snap!.payload as any).rows : [];
      const hotel = rows.find((r) => r?.hotel?.id === body.hotelId);
      const room = hotel?.availableRooms?.find((r: any) => r.id === body.roomId);
      return json({
        booking: { id: queued.id, status: "BACKUP_PENDING" },
        hotel: hotel?.hotel?.name || "Hotel",
        room: room?.roomNumber || "",
        nights: Math.max(1, Math.ceil((new Date(body.checkOut).getTime() - new Date(body.checkIn).getTime()) / 86400000)),
        pendingConfirmation: true,
        backupRequestId: queued.id,
        message: "Saved by the independent backup. Final room confirmation will be replayed to KobeOS when the primary path recovers.",
      }, 202, origin);
    }

    if (req.method === "POST" && path === "/lala-public/reverse-requests") {
      const queued = await queueReverse(await req.json());
      return json({
        id: queued.id,
        status: "BACKUP_PENDING",
        pendingConfirmation: true,
        backupRequestId: queued.id,
      }, 202, origin);
    }

    const offersMatch = path.match(/^\/lala-public\/reverse-requests\/([^/]+)\/offers$/);
    if (req.method === "GET" && offersMatch) return json([], 200, origin);

    if (req.method === "POST" && /\/lala-public\/reverse-requests\/[^/]+\/offers\/[^/]+\/accept$/.test(path)) {
      return json({
        message: "Offer acceptance is paused while Lala is on the independent backup path. Existing requests are safe and will resume when primary returns.",
      }, 503, origin);
    }

    const menuMatch = path.match(/^\/public\/hotel\/([^/]+)\/menu-items$/);
    if (req.method === "GET" && menuMatch) {
      return json(await menuForSlug(decodeURIComponent(menuMatch[1])), 200, origin);
    }

    const orderMatch = path.match(/^\/public\/hotel\/([^/]+)\/orders$/);
    if (req.method === "POST" && orderMatch) {
      const order = await req.json();
      const { data, error } = await db.from("kobe_backup_queue").insert({
        kind: "ORDER",
        payload: { slug: decodeURIComponent(orderMatch[1]), order },
      }).select("*").single();
      if (error) throw error;
      return json({
        id: data.id,
        status: "BACKUP_PENDING",
        pendingConfirmation: true,
        backupRequestId: data.id,
      }, 202, origin);
    }

    if (req.method === "POST" && path === "/maintenance") {
      return json(await maintenance(), 200, origin);
    }

    if (req.method === "POST" && path === "/sync") {
      return json(await syncSnapshot(), 200, origin);
    }

    if (req.method === "POST" && path === "/replay") {
      return json({ replay: await replayQueue() }, 200, origin);
    }

    return json({ message: "Backup endpoint not found", path }, 404, origin);
  } catch (error: any) {
    const status = Number(error?.status || 500);
    return json({
      message: error instanceof Error ? error.message : String(error),
      backupMode: true,
    }, status >= 400 && status <= 599 ? status : 500, origin);
  }
});
