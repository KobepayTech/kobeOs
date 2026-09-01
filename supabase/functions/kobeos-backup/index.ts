
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PRIMARY = "https://api.kobeapptz.com/api";
const SNAPSHOT_KEY = "lala_public";

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
    const response = await fetch(`${PRIMARY}/lala-public/backup-snapshot`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`Primary snapshot HTTP ${response.status}`);
    const payload = await response.json();
    const now = new Date().toISOString();
    const { error } = await db.from("kobe_backup_snapshots").upsert({
      key: SNAPSHOT_KEY,
      payload,
      synced_at: now,
      source_url: `${PRIMARY}/lala-public/backup-snapshot`,
      last_error: null,
      updated_at: now,
    });
    if (error) throw error;
    return { ok: true, syncedAt: now };
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
  if (!passport) throw new Error("Backup passport not found");
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
  if (!passport) throw Object.assign(new Error("Passport not found"), { status: 404 });

  // When primary is healthy, return its richer history but keep the backup token
  // usable during later outages.
  if (passport.primary_passport_token) {
    try {
      const { response, body } = await primaryJson(
        `/lala-public/passports/${encodeURIComponent(passport.primary_passport_token)}`
      );
      if (response.ok) return body;
    } catch { /* backup view below */ }
  }

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
      passportNumber: passport.passport_number,
      name: passport.privacy?.shareName === false ? "Lala guest" : passport.name,
      phone: passport.privacy?.sharePhone === false ? "" : passport.phone,
      nationality: passport.nationality,
      preferences: passport.preferences,
    },
    rewards: { points: 0, tier: "Explorer", verifiedStays: 0 },
    hotelLoyalty: [],
    stays: [],
    activeBookings,
    backupMode: true,
  };
}

async function queueBooking(body: any) {
  const { data: passport } = await db.from("kobe_backup_passports")
    .select("qr_token").eq("qr_token", body.passportToken).maybeSingle();
  if (!passport) throw Object.assign(new Error("Valid Lala Passport is required"), { status: 400 });

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
