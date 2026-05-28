import { api } from '@/lib/api';

export type SecurityClientRecord = {
  id: string;
  name: string;
  contactName?: string | null;
  contactPhone?: string | null;
  registrationNumber?: string | null;
  active: boolean;
};

export type ClientSiteRecord = {
  id: string;
  clientId: string;
  name: string;
  address: string;
  plan: string;
  zoneIds: string[];
};

export type TeamMemberRecord = {
  id: string;
  name: string;
  phone?: string | null;
  status: 'active' | 'inactive' | 'suspended';
  assignedSiteId?: string | null;
};

export type ServiceRouteRecord = {
  id: string;
  siteId: string;
  name: string;
  checkpointNames: string[];
  active: boolean;
};

export type ServiceCheckRecord = {
  id: string;
  routeId: string;
  memberId: string;
  checkpointName: string;
  status: 'checked' | 'missed' | 'late';
  checkedAt: string;
  note?: string | null;
};

export type SiteSignalRecord = {
  id: string;
  siteId?: string | null;
  zoneId: string;
  zoneName: string;
  eventType: string;
  severity: 'info' | 'warning' | 'critical';
  occupied: boolean;
  peopleCount: number;
  confidence: number;
  raw?: Record<string, unknown>;
};

export type WorkItemRecord = {
  id: string;
  clientId?: string | null;
  siteId?: string | null;
  title: string;
  priority: string;
  state: string;
  details: string;
};

export type SecuritySummary = {
  clients: number;
  sites: number;
  members: number;
  routes: number;
  checks: number;
  signals: number;
  workItems: number;
};

export function getSecuritySummary() {
  return api<SecuritySummary>('/security/summary');
}

export function listSecurityClients() {
  return api<SecurityClientRecord[]>('/security/clients');
}

export function listClientSites() {
  return api<ClientSiteRecord[]>('/security/sites');
}

export function listTeamMembers() {
  return api<TeamMemberRecord[]>('/security/members');
}

export function listServiceRoutes() {
  return api<ServiceRouteRecord[]>('/security/routes');
}

export function listServiceChecks() {
  return api<ServiceCheckRecord[]>('/security/checks');
}

export function listSiteSignals() {
  return api<SiteSignalRecord[]>('/security/signals');
}

export function listWorkItems() {
  return api<WorkItemRecord[]>('/security/work-items');
}

export function createWorkItem(data: Partial<WorkItemRecord> & { title: string }) {
  return api<WorkItemRecord>('/security/work-items', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function createSiteSignal(data: Omit<SiteSignalRecord, 'id'>) {
  return api<SiteSignalRecord>('/security/signals', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
