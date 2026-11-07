export interface LalaRoom { id: string; roomNumber: string; type: string; rate: number; currency: string; capacity: number; imageUrl: string }
export interface LalaHotel { hotel: { id: string; slug: string; name: string; location: string; phone: string; currency: string; logoUrl?: string }; profile: { description: string; amenities: string[]; images: string[]; guestRating: number; verifiedReviewCount: number; lastMinuteEnabled: boolean }; availableRooms: LalaRoom[]; foodAvailable?: boolean; verifiedAvailabilityAt: string }
export interface LalaPassportData {
  passport: { passportNumber: string; name: string; phone: string; nationality: string };
  rewards: null | { points: number; tier: string; verifiedStays: number };
  hotelLoyalty: Array<{ id: string; hotelName: string; points: number; tier: string; stays: number }>;
  stays: Array<{ id: string; checkIn: string; checkOut: string; hotelPointsEarned: number; lalaPointsEarned: number }>;
  activeBookings: Array<{ id: string; hotelName: string; roomNumber: string; roomType: string; checkIn: string; checkOut: string; status: string; totalAmount: number; currency: string }>;
}
export const lalaMoney = (amount: number, currency = 'TZS') => currency + ' ' + Number(amount).toLocaleString();
export const lalaDate = (date: string) => date ? new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Choose date';
export const lalaPhoto = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1000&q=85';
