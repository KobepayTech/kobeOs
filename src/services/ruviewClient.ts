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
};

export type RuViewSnapshot = {
  health: RuViewHealth;
  zones: RuViewZone[];
  alerts: RuViewAlert[];
};

const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_WS_URL = 'ws://localhost:3001';

const baseUrl = import.meta.env.VITE_RUVIEW_BASE_URL || DEFAULT_BASE_URL;
const wsUrl = import.meta.env.VITE_RUVIEW_WS_URL || DEFAULT_WS_URL;

const nowIso = () => new Date().toISOString();

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
      signal: AbortSignal.timeout(2500),
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
      signal: AbortSignal.timeout(2500),
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

export async function getRuViewSnapshot(): Promise<RuViewSnapshot> {
  const [health, zones, alerts] = await Promise.all([
    getRuViewHealth(),
    getRuViewZones(),
    getRuViewAlerts(),
  ]);

  return { health, zones, alerts };
}

export function connectRuViewStream(onMessage: (snapshot: Partial<RuViewSnapshot>) => void): () => void {
  let socket: WebSocket | null = null;
  let closed = false;

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
    closed = true;
  }

  return () => {
    closed = true;
    if (!closed && socket?.readyState === WebSocket.OPEN) socket.close();
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
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
