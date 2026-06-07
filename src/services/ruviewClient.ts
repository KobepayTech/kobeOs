export type RuViewConnectionStatus = 'online' | 'offline' | 'degraded' | 'simulated';

export type RuViewZoneType = 'hotel-room' | 'warehouse' | 'gate' | 'office' | 'retail' | 'school' | 'custom';

export type RuViewZone = {
  id: string;
  name: string;
  type: RuViewZoneType;
  building: string;
  floor?: string;
  occupied: boolean;
  peopleCount: number;
  motionLevel: number;
  confidence: number;
  lastSeenAt: string;
  source: 'ruview' | 'manual' | 'simulated';
};

export type RuViewAlertSeverity = 'info' | 'warning' | 'critical';

export type RuViewAlert = {
  id: string;
  zoneId: string;
  zoneName: string;
  title: string;
  severity: RuViewAlertSeverity;
  status: 'open' | 'acknowledged' | 'resolved';
  createdAt: string;
  description: string;
  source: 'ruview' | 'guard' | 'system';
};

export type KobeSecurityIncident = {
  id: string;
  title: string;
  zoneId?: string;
  severity: RuViewAlertSeverity;
  createdAt: string;
  createdBy: string;
  notes: string;
  status: 'open' | 'investigating' | 'resolved';
};

export type RuViewHealth = {
  status: RuViewConnectionStatus;
  baseUrl: string;
  wsUrl: string;
  message: string;
  checkedAt: string;
  /** RuView server version when reachable — useful in the Setup tab. */
  version?: string;
  /** Frames per second the sensing server is currently emitting. */
  framesPerSecond?: number;
};

/**
 * RuView vital-sign reading. Breathing 6-30 BPM and heart rate 40-120 BPM
 * are extracted from the same CSI stream and emitted per (zoneId, personId).
 */
export type RuViewVitals = {
  zoneId: string;
  zoneName: string;
  personId: string;
  breathingBpm: number;
  heartRateBpm: number;
  confidence: number;
  capturedAt: string;
};

/**
 * 17-keypoint pose estimate from CSI alone (no camera). Coordinates are
 * normalised 0..1 inside the zone bounding box so the storefront can
 * render skeletons at any size.
 */
export type RuViewPoseKeypoint = { x: number; y: number; score: number };
export type RuViewPose = {
  zoneId: string;
  zoneName: string;
  personId: string;
  keypoints: RuViewPoseKeypoint[];   // 17 nodes (COCO)
  bboxNormalized?: [number, number, number, number];
  capturedAt: string;
};

/** Fall-detection event — RuView reports these with <200ms latency. */
export type RuViewFall = {
  id: string;
  zoneId: string;
  zoneName: string;
  personId: string;
  severity: 'minor' | 'serious';
  detectedAt: string;
  acknowledgedAt?: string;
};

/** Per-zone sleep-quality summary (overnight monitoring rooms). */
export type RuViewSleep = {
  zoneId: string;
  zoneName: string;
  personId: string;
  scoreOutOf100: number;
  apneaEventsLastHour: number;
  averageBreathingBpm: number;
  capturedAt: string;
};

export type RuViewSnapshot = {
  health: RuViewHealth;
  zones: RuViewZone[];
  alerts: RuViewAlert[];
  vitals: RuViewVitals[];
  poses: RuViewPose[];
  falls: RuViewFall[];
  sleep: RuViewSleep[];
};

const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_WS_URL = 'ws://localhost:3001';

const baseUrl = import.meta.env.VITE_RUVIEW_BASE_URL || DEFAULT_BASE_URL;
const wsUrl = import.meta.env.VITE_RUVIEW_WS_URL || DEFAULT_WS_URL;

const nowIso = () => new Date().toISOString();

function timeoutSignal(timeoutMs: number): AbortSignal {
  const abortSignalWithTimeout = AbortSignal as typeof AbortSignal & { timeout?: (ms: number) => AbortSignal };

  if (typeof abortSignalWithTimeout.timeout === 'function') {
    return abortSignalWithTimeout.timeout(timeoutMs);
  }

  const controller = new AbortController();
  globalThis.setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

const demoZones: RuViewZone[] = [
  {
    id: 'hotel-room-101',
    name: 'Hotel Room 101',
    type: 'hotel-room',
    building: 'Kobe Hotel Demo',
    floor: '1',
    occupied: true,
    peopleCount: 2,
    motionLevel: 0.32,
    confidence: 0.86,
    lastSeenAt: nowIso(),
    source: 'simulated',
  },
  {
    id: 'hotel-room-102',
    name: 'Hotel Room 102',
    type: 'hotel-room',
    building: 'Kobe Hotel Demo',
    floor: '1',
    occupied: true,
    peopleCount: 1,
    motionLevel: 0.18,
    confidence: 0.88,
    lastSeenAt: nowIso(),
    source: 'simulated',
  },
  {
    id: 'hotel-room-103',
    name: 'Hotel Room 103',
    type: 'hotel-room',
    building: 'Kobe Hotel Demo',
    floor: '1',
    occupied: false,
    peopleCount: 0,
    motionLevel: 0.02,
    confidence: 0.81,
    lastSeenAt: nowIso(),
    source: 'simulated',
  },
  {
    id: 'warehouse-gate-a',
    name: 'Cargo Warehouse Gate A',
    type: 'warehouse',
    building: 'Kobe Cargo Demo',
    floor: 'Ground',
    occupied: true,
    peopleCount: 4,
    motionLevel: 0.71,
    confidence: 0.79,
    lastSeenAt: nowIso(),
    source: 'simulated',
  },
  {
    id: 'cafe-zone-main',
    name: 'Cafe Main Seating',
    type: 'retail',
    building: 'Kobe ERP Cafe',
    floor: 'Ground',
    occupied: false,
    peopleCount: 0,
    motionLevel: 0.05,
    confidence: 0.74,
    lastSeenAt: nowIso(),
    source: 'simulated',
  },
  {
    id: 'front-gate',
    name: 'Main Security Gate',
    type: 'gate',
    building: 'Kobe Facility',
    floor: 'Ground',
    occupied: true,
    peopleCount: 1,
    motionLevel: 0.48,
    confidence: 0.83,
    lastSeenAt: nowIso(),
    source: 'simulated',
  },
];

const demoAlerts: RuViewAlert[] = [
  {
    id: 'alert-warehouse-motion',
    zoneId: 'warehouse-gate-a',
    zoneName: 'Cargo Warehouse Gate A',
    title: 'Movement after scheduled closing time',
    severity: 'warning',
    status: 'open',
    createdAt: nowIso(),
    description: 'RuView simulated motion event. Guard should verify physically before escalation.',
    source: 'ruview',
  },
  {
    id: 'alert-room-101-occupied',
    zoneId: 'hotel-room-101',
    zoneName: 'Hotel Room 101',
    title: 'Room occupancy detected',
    severity: 'info',
    status: 'acknowledged',
    createdAt: nowIso(),
    description: 'Room is marked occupied for housekeeping and energy automation workflows.',
    source: 'ruview',
  },
];

async function requestJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { Accept: 'application/json' },
      signal: timeoutSignal(2500),
    });

    if (!response.ok) {
      return fallback;
    }

    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

function normaliseZones(payload: unknown): RuViewZone[] {
  if (!Array.isArray(payload)) return demoZones;

  return payload.map((item, index) => {
    const record = item as Partial<RuViewZone> & Record<string, unknown>;
    const count = Number(record.peopleCount ?? record['people_count'] ?? record['occupancy_count'] ?? 0);
    const confidence = Number(record.confidence ?? 0.5);
    const motionLevel = Number(record.motionLevel ?? record['motion_level'] ?? record['motion'] ?? 0);

    return {
      id: String(record.id ?? `ruview-zone-${index + 1}`),
      name: String(record.name ?? record['zone_name'] ?? `RuView Zone ${index + 1}`),
      type: (record.type as RuViewZoneType) ?? 'custom',
      building: String(record.building ?? 'RuView Building'),
      floor: record.floor ? String(record.floor) : undefined,
      occupied: Boolean(record.occupied ?? count > 0),
      peopleCount: Number.isFinite(count) ? count : 0,
      motionLevel: Number.isFinite(motionLevel) ? motionLevel : 0,
      confidence: Number.isFinite(confidence) ? confidence : 0.5,
      lastSeenAt: String(record.lastSeenAt ?? record['last_seen_at'] ?? nowIso()),
      source: 'ruview',
    };
  });
}

function normaliseAlerts(payload: unknown): RuViewAlert[] {
  if (!Array.isArray(payload)) return demoAlerts;

  return payload.map((item, index) => {
    const record = item as Partial<RuViewAlert> & Record<string, unknown>;
    const severity = record.severity === 'critical' || record.severity === 'warning' ? record.severity : 'info';

    return {
      id: String(record.id ?? `ruview-alert-${index + 1}`),
      zoneId: String(record.zoneId ?? record['zone_id'] ?? 'unknown'),
      zoneName: String(record.zoneName ?? record['zone_name'] ?? 'Unknown Zone'),
      title: String(record.title ?? record['event'] ?? 'RuView sensing alert'),
      severity,
      status: record.status === 'resolved' || record.status === 'acknowledged' ? record.status : 'open',
      createdAt: String(record.createdAt ?? record['created_at'] ?? nowIso()),
      description: String(record.description ?? 'Signal event received from RuView.'),
      source: 'ruview',
    };
  });
}

export async function getRuViewHealth(): Promise<RuViewHealth> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/health`, {
      headers: { Accept: 'application/json' },
      signal: timeoutSignal(2500),
    });

    if (!response.ok) {
      return {
        status: 'degraded',
        baseUrl,
        wsUrl,
        message: `RuView responded with HTTP ${response.status}`,
        checkedAt: nowIso(),
      };
    }

    return {
      status: 'online',
      baseUrl,
      wsUrl,
      message: 'RuView sensing server is reachable.',
      checkedAt: nowIso(),
    };
  } catch {
    return {
      status: 'simulated',
      baseUrl,
      wsUrl,
      message: 'RuView is not reachable. Kobe Security is showing simulated demo data.',
      checkedAt: nowIso(),
    };
  }
}

export async function getRuViewZones(): Promise<RuViewZone[]> {
  const payload = await requestJson<unknown>('/api/v1/zones', demoZones);
  return normaliseZones(payload);
}

export async function getRuViewAlerts(): Promise<RuViewAlert[]> {
  const payload = await requestJson<unknown>('/api/v1/alerts', demoAlerts);
  return normaliseAlerts(payload);
}

/**
 * Demo vital/pose/fall/sleep frames so the new RuView tabs show something
 * useful before the docker container is started. Match the shape RuView
 * emits in simulator mode so the same UI works for both data paths.
 */
const demoVitals: RuViewVitals[] = [
  { zoneId: 'hotel-room-101', zoneName: 'Hotel Room 101', personId: 'p1', breathingBpm: 14, heartRateBpm: 72, confidence: 0.87, capturedAt: nowIso() },
  { zoneId: 'hotel-room-101', zoneName: 'Hotel Room 101', personId: 'p2', breathingBpm: 16, heartRateBpm: 68, confidence: 0.81, capturedAt: nowIso() },
  { zoneId: 'hotel-room-102', zoneName: 'Hotel Room 102', personId: 'p3', breathingBpm: 12, heartRateBpm: 60, confidence: 0.92, capturedAt: nowIso() },
];

const demoPoses: RuViewPose[] = [
  {
    zoneId: 'warehouse-gate-a',
    zoneName: 'Cargo Warehouse Gate A',
    personId: 'p4',
    keypoints: Array.from({ length: 17 }, (_, i) => ({
      x: 0.3 + ((i % 5) * 0.08),
      y: 0.2 + (Math.floor(i / 5) * 0.18),
      score: 0.7 + ((i % 3) * 0.05),
    })),
    bboxNormalized: [0.25, 0.18, 0.65, 0.95],
    capturedAt: nowIso(),
  },
];

const demoFalls: RuViewFall[] = [];

const demoSleep: RuViewSleep[] = [
  { zoneId: 'hotel-room-101', zoneName: 'Hotel Room 101', personId: 'p1', scoreOutOf100: 82, apneaEventsLastHour: 0, averageBreathingBpm: 14, capturedAt: nowIso() },
];

function normaliseVitals(payload: unknown): RuViewVitals[] {
  if (!Array.isArray(payload)) return demoVitals;
  return payload.map((item, i) => {
    const r = item as Partial<RuViewVitals> & Record<string, unknown>;
    return {
      zoneId:       String(r.zoneId ?? r['zone_id'] ?? `zone-${i}`),
      zoneName:     String(r.zoneName ?? r['zone_name'] ?? 'Unknown zone'),
      personId:     String(r.personId ?? r['person_id'] ?? `p-${i}`),
      breathingBpm: Number(r.breathingBpm ?? r['breathing_bpm'] ?? 0),
      heartRateBpm: Number(r.heartRateBpm ?? r['heart_rate_bpm'] ?? 0),
      confidence:   Number(r.confidence ?? 0.5),
      capturedAt:   String(r.capturedAt ?? r['captured_at'] ?? nowIso()),
    };
  });
}

function normalisePoses(payload: unknown): RuViewPose[] {
  if (!Array.isArray(payload)) return demoPoses;
  return payload.map((item, i) => {
    const r = item as Partial<RuViewPose> & Record<string, unknown>;
    const kp = Array.isArray(r.keypoints) ? r.keypoints : [];
    return {
      zoneId:    String(r.zoneId ?? r['zone_id'] ?? `zone-${i}`),
      zoneName:  String(r.zoneName ?? r['zone_name'] ?? 'Unknown zone'),
      personId:  String(r.personId ?? r['person_id'] ?? `p-${i}`),
      keypoints: kp.map((k) => {
        const kk = k as Partial<RuViewPoseKeypoint>;
        return { x: Number(kk.x ?? 0), y: Number(kk.y ?? 0), score: Number(kk.score ?? 0) };
      }),
      bboxNormalized: Array.isArray(r.bboxNormalized) && r.bboxNormalized.length === 4
        ? (r.bboxNormalized as [number, number, number, number])
        : undefined,
      capturedAt: String(r.capturedAt ?? r['captured_at'] ?? nowIso()),
    };
  });
}

function normaliseFalls(payload: unknown): RuViewFall[] {
  if (!Array.isArray(payload)) return demoFalls;
  return payload.map((item, i) => {
    const r = item as Partial<RuViewFall> & Record<string, unknown>;
    const severity: RuViewFall['severity'] = r.severity === 'serious' ? 'serious' : 'minor';
    return {
      id:         String(r.id ?? `fall-${i}`),
      zoneId:     String(r.zoneId ?? r['zone_id'] ?? `zone-${i}`),
      zoneName:   String(r.zoneName ?? r['zone_name'] ?? 'Unknown zone'),
      personId:   String(r.personId ?? r['person_id'] ?? `p-${i}`),
      severity,
      detectedAt: String(r.detectedAt ?? r['detected_at'] ?? nowIso()),
      acknowledgedAt: r.acknowledgedAt ? String(r.acknowledgedAt) : undefined,
    };
  });
}

function normaliseSleep(payload: unknown): RuViewSleep[] {
  if (!Array.isArray(payload)) return demoSleep;
  return payload.map((item, i) => {
    const r = item as Partial<RuViewSleep> & Record<string, unknown>;
    return {
      zoneId:               String(r.zoneId ?? r['zone_id'] ?? `zone-${i}`),
      zoneName:             String(r.zoneName ?? r['zone_name'] ?? 'Unknown zone'),
      personId:             String(r.personId ?? r['person_id'] ?? `p-${i}`),
      scoreOutOf100:        Number(r.scoreOutOf100 ?? r['score_out_of_100'] ?? 50),
      apneaEventsLastHour:  Number(r.apneaEventsLastHour ?? r['apnea_events_last_hour'] ?? 0),
      averageBreathingBpm:  Number(r.averageBreathingBpm ?? r['average_breathing_bpm'] ?? 0),
      capturedAt:           String(r.capturedAt ?? r['captured_at'] ?? nowIso()),
    };
  });
}

export async function getRuViewVitals(): Promise<RuViewVitals[]> {
  return normaliseVitals(await requestJson<unknown>('/api/v1/vitals', demoVitals));
}

export async function getRuViewPoses(): Promise<RuViewPose[]> {
  return normalisePoses(await requestJson<unknown>('/api/v1/pose', demoPoses));
}

export async function getRuViewFalls(): Promise<RuViewFall[]> {
  return normaliseFalls(await requestJson<unknown>('/api/v1/falls', demoFalls));
}

export async function getRuViewSleep(): Promise<RuViewSleep[]> {
  return normaliseSleep(await requestJson<unknown>('/api/v1/sleep', demoSleep));
}

export async function getRuViewSnapshot(): Promise<RuViewSnapshot> {
  const [health, zones, alerts, vitals, poses, falls, sleep] = await Promise.all([
    getRuViewHealth(),
    getRuViewZones(),
    getRuViewAlerts(),
    getRuViewVitals(),
    getRuViewPoses(),
    getRuViewFalls(),
    getRuViewSleep(),
  ]);

  return { health, zones, alerts, vitals, poses, falls, sleep };
}

export function connectRuViewStream(onMessage: (snapshot: Partial<RuViewSnapshot>) => void): () => void {
  let socket: WebSocket | null = null;

  try {
    socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as Partial<RuViewSnapshot>;
        onMessage(payload);
      } catch {
        // Ignore malformed sensing frames. Polling still keeps the UI useful.
      }
    };
  } catch {
    socket = null;
  }

  return () => {
    if (socket && socket.readyState < WebSocket.CLOSING) {
      socket.close();
    }
  };
}

export function createLocalIncident(alert: RuViewAlert, guardName: string): KobeSecurityIncident {
  return {
    id: `incident-${alert.id}-${Date.now()}`,
    title: alert.title,
    zoneId: alert.zoneId,
    severity: alert.severity,
    createdAt: nowIso(),
    createdBy: guardName,
    notes: `Created from ${alert.source} alert: ${alert.description}`,
    status: 'open',
  };
}
