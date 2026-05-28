import { api } from '@/lib/api';

export type HotelRoomSignalLinkRecord = {
  id: string;
  roomId: string;
  roomNumber: string;
  zoneId: string;
  active: boolean;
};

export type HotelRoomReviewRecord = {
  id: string;
  roomId: string;
  roomNumber: string;
  risk: 'normal' | 'watch' | 'high' | 'critical';
  state: 'open' | 'reviewing' | 'resolved' | 'closed';
  title: string;
  summary: string;
  snapshot: Record<string, unknown>;
};

export type HotelSecuritySummary = {
  links: number;
  reviews: number;
};

export function getHotelSecuritySummary() {
  return api<HotelSecuritySummary>('/hotel-security/summary');
}

export function listHotelRoomLinks() {
  return api<HotelRoomSignalLinkRecord[]>('/hotel-security/room-links');
}

export function createHotelRoomLink(data: Omit<HotelRoomSignalLinkRecord, 'id'>) {
  return api<HotelRoomSignalLinkRecord>('/hotel-security/room-links', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function listHotelRoomReviews() {
  return api<HotelRoomReviewRecord[]>('/hotel-security/room-reviews');
}

export function createHotelRoomReview(data: Omit<HotelRoomReviewRecord, 'id'>) {
  return api<HotelRoomReviewRecord>('/hotel-security/room-reviews', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
