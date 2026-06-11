// ============================================================================
// KOBEOS SHARED TYPES
// ============================================================================
// Central type definitions for all KobeOS modules
// ============================================================================

// --- PROPERTY MANAGEMENT ---

export interface Tenant {
  id: string;
  name: string;
  phone: string;
  email?: string;
  unit: string;
  propertyId: string;
  propertyName?: string;
  status: 'active' | 'overdue' | 'fully-paid' | 'pending' | 'inactive';
  leaseStart: string;
  leaseEnd: string;
  monthlyRent: number;
  currency: string;
  shortCode: string;
  balance: number;
  paidAmount: number;
  totalExpected: number;
  nextDueDate: string;
  daysOverdue: number;
  paymentHistory: PaymentRecord[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecord {
  id: string;
  tenantId: string;
  amount: number;
  method: 'bank' | 'mobile-money' | 'kobepay' | 'cash' | 'card';
  reference: string;
  date: string;
  month: string; // e.g., "2026-01"
  status: 'completed' | 'pending' | 'failed';
  notes?: string;
  receiptUrl?: string;
}

export interface PropertySummary {
  totalTenants: number;
  overdueCount: number;
  fullyPaidCount: number;
  pendingCount: number;
  totalRevenueThisMonth: number;
  totalOutstanding: number;
  occupancyRate: number;
}

// --- HOTEL / POS ---

export interface Hotel {
  id: string;
  name: string;
  subdomain: string;
  address: string;
  phone: string;
  email: string;
  logo?: string;
  theme: HotelTheme;
  rooms: Room[];
  menuCategories: MenuCategory[];
  tables: Table[];
  staff: StaffMember[];
  settings: HotelSettings;
  createdAt: string;
}

export interface HotelTheme {
  primaryColor: string;
  secondaryColor: string;
  darkMode: boolean;
}

export interface HotelSettings {
  checkInTime: string;
  checkOutTime: string;
  currency: string;
  taxRate: number;
  serviceCharge: number;
  enableQROrdering: boolean;
  enableRoomService: boolean;
}

export interface Room {
  id: string;
  number: string;
  type: string;
  floor: number;
  pricePerNight: number;
  status: 'available' | 'occupied' | 'cleaning' | 'maintenance' | 'reserved';
  capacity: number;
  amenities: string[];
  qrCode?: string;
  currentGuest?: Guest;
  bookings: Booking[];
}

export interface Guest {
  id: string;
  name: string;
  phone: string;
  email?: string;
  checkInDate: string;
  checkOutDate: string;
  idNumber?: string;
}

export interface Booking {
  id: string;
  guestId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  status: 'confirmed' | 'checked-in' | 'checked-out' | 'cancelled';
  totalAmount: number;
  paidAmount: number;
  paymentMethod?: string;
  source: 'walk-in' | 'online' | 'phone' | 'ota';
  specialRequests?: string;
}

export interface Table {
  id: string;
  number: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
  qrCode: string;
  section: string; // e.g., "indoor", "outdoor", "bar"
  currentOrder?: Order;
}

export interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  image?: string;
  sortOrder: number;
  items: MenuItem[];
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  isAvailable: boolean;
  isPopular?: boolean;
  preparationTime: number; // minutes
  station: 'kitchen' | 'bar' | 'dessert' | 'grill';
  allergens?: string[];
  options?: MenuItemOption[];
}

export interface MenuItemOption {
  name: string;
  choices: { label: string; priceAdjustment: number }[];
}

export interface Order {
  id: string;
  tableId?: string;
  roomId?: string;
  guestName?: string;
  guestPhone?: string;
  items: OrderItem[];
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled' | 'paid';
  subtotal: number;
  tax: number;
  serviceCharge: number;
  total: number;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  paymentMethod?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  station: 'kitchen' | 'bar' | 'dessert' | 'grill' | 'mixed';
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  options?: string;
  notes?: string;
  station: 'kitchen' | 'bar' | 'dessert' | 'grill';
  status: 'pending' | 'preparing' | 'ready' | 'served';
}

export interface StaffMember {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: 'admin' | 'manager' | 'receptionist' | 'waiter' | 'chef' | 'bartender' | 'housekeeping';
  pin: string;
  isActive: boolean;
  permissions: string[];
}

export interface KDSOrder {
  orderId: string;
  items: OrderItem[];
  tableNumber?: string;
  roomNumber?: string;
  guestName?: string;
  priority: 'normal' | 'high' | 'rush';
  elapsedTime: number; // seconds since order created
  station: 'kitchen' | 'bar' | 'dessert';
  status: 'new' | 'preparing' | 'ready';
  notes?: string;
}

// --- CARGO / LOGISTICS ---

export interface Shipment {
  id: string;
  reference: string; // SHP-2026-001
  qrCode: string;
  qrData: string; // URL or UUID
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  suppliers: SupplierAllocation[];
  stage: ShipmentStage;
  status: ShipmentStatus;
  origin: string;
  destination: string;
  weight?: number;
  dimensions?: string;
  description?: string;
  value?: number;
  customsCharges?: CustomsCharge[];
  payments: CargoPayment[];
  totalAmount: number;
  paidAmount: number;
  balance: number;
  purpose: 'deposit' | 'balance' | 'full-payment' | 'shipping' | 'customs';
  eta?: string;
  actualDeliveryDate?: string;
  warehouseReceipts?: WarehouseReceipt[];
  trackingEvents: TrackingEvent[];
  notifications: Notification[];
  packagePhotos?: string[];
  createdAt: string;
  updatedAt: string;
}

export type ShipmentStage = 
  | 'created' 
  | 'supplier-paid' 
  | 'warehouse-received' 
  | 'export-customs' 
  | 'in-transit' 
  | 'import-customs' 
  | 'local-warehouse' 
  | 'out-for-delivery' 
  | 'delivered';

export type ShipmentStatus = 'active' | 'on-hold' | 'cancelled' | 'completed';

export interface SupplierAllocation {
  id: string;
  supplierNumber: string;
  supplierName?: string;
  supplierCity: 'guangzhou' | 'yiwu' | 'shenzhen' | 'other';
  platform: 'alibaba' | '1688' | 'wechat' | 'other';
  amount: number;
  items: string;
  status: 'pending' | 'paid' | 'received' | 'shipped';
  warehouseReceivedAt?: string;
  notes?: string;
}

export interface CustomsCharge {
  id: string;
  shipmentId: string;
  type: 'import-duty' | 'vat' | 'inspection' | 'clearance' | 'other';
  amount: number;
  currency: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

export interface CargoPayment {
  id: string;
  shipmentId: string;
  amount: number;
  currency: string;
  purpose: 'deposit' | 'balance' | 'full-payment' | 'shipping' | 'customs';
  method: 'kobepay' | 'bank' | 'mobile-money' | 'cash';
  reference: string;
  customerReceipt?: Receipt;
  supplierReceipt?: Receipt;
  warehouseCopy?: Receipt;
  status: 'completed' | 'pending' | 'failed';
  createdAt: string;
  createdBy: string;
}

export interface Receipt {
  id: string;
  type: 'customer' | 'supplier' | 'warehouse';
  title: string;
  senderName: string;
  senderPhone?: string;
  supplierName?: string;
  supplierNumber?: string;
  amount: number;
  currency: string;
  purpose: string;
  shipmentRef: string;
  date: string;
  items?: string;
  notes?: string;
  qrCode?: string;
}

export interface WarehouseReceipt {
  id: string;
  shipmentId: string;
  warehouseId: string;
  warehouseName: string;
  scannedBy: string;
  condition: 'good' | 'damaged' | 'partial';
  weight?: number;
  photos?: string[];
  notes?: string;
  receivedAt: string;
}

export interface TrackingEvent {
  id: string;
  shipmentId: string;
  stage: ShipmentStage;
  location: string;
  notes?: string;
  scannedBy?: string;
  photoUrl?: string;
  timestamp: string;
}

export interface Notification {
  id: string;
  shipmentId: string;
  recipientPhone: string;
  recipientEmail?: string;
  type: 'sms' | 'whatsapp' | 'push' | 'email';
  title: string;
  message: string;
  status: 'sent' | 'pending' | 'failed';
  sentAt?: string;
  createdAt: string;
}

// --- CREATOR MARKETPLACE ---

export interface Creator {
  id: string;
  userId: string;
  handle: string;
  displayName: string;
  bio: string;
  profileImage?: string;
  niches: string[];
  platforms: CreatorPlatform[];
  mediaKit?: MediaKit;
  pricing?: CreatorPricing;
  portfolio: PortfolioItem[];
  analytics: CreatorAnalytics;
  score: number;
  isVerified: boolean;
  isActive: boolean;
  location?: string;
  languages?: string[];
  createdAt: string;
}

export interface CreatorPlatform {
  platform: 'instagram' | 'tiktok' | 'youtube' | 'x' | 'facebook';
  handle: string;
  url: string;
  followers: number;
  engagementRate: number;
  avgLikes: number;
  avgComments: number;
  avgViews?: number;
  postingFrequency: number;
  growthRate: number;
  isConnected: boolean;
  lastSyncedAt?: string;
}

export interface MediaKit {
  headline: string;
  about: string;
  achievements: string[];
  audienceDemographics?: AudienceDemographics;
  brandCollaborations?: string[];
  contactEmail: string;
  contactPhone?: string;
}

export interface AudienceDemographics {
  ageRanges: { range: string; percentage: number }[];
  genderSplit: { male: number; female: number; other: number };
  topLocations: { location: string; percentage: number }[];
  topInterests: string[];
}

export interface CreatorPricing {
  postRate: number;
  storyRate: number;
  reelRate: number;
  videoRate: number;
  campaignRate?: number;
  currency: string;
  isNegotiable: boolean;
}

export interface PortfolioItem {
  id: string;
  title: string;
  description?: string;
  platform: string;
  url?: string;
  imageUrl?: string;
  engagement?: number;
  date: string;
}

export interface CreatorAnalytics {
  totalEarnings: number;
  activeCampaigns: number;
  pendingApprovals: number;
  completedCampaigns: number;
  avgEngagementRate: number;
  audienceGrowth: number;
  performanceScore: number;
  monthlyStats: MonthlyStat[];
}

export interface MonthlyStat {
  month: string;
  earnings: number;
  campaigns: number;
  engagement: number;
  followers: number;
}

export interface Brand {
  id: string;
  userId: string;
  companyName: string;
  industry: string;
  logo?: string;
  website?: string;
  description?: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  location?: string;
  budgetRange?: { min: number; max: number; currency: string };
  isVerified: boolean;
  createdAt: string;
}

export interface Campaign {
  id: string;
  brandId: string;
  brandName?: string;
  title: string;
  description: string;
  requirements: string;
  deliverables: CampaignDeliverable[];
  budget: number;
  currency: string;
  niches: string[];
  platforms: string[];
  location?: string;
  deadline: string;
  status: 'draft' | 'open' | 'in-progress' | 'completed' | 'cancelled';
  applications: CampaignApplication[];
  selectedCreators: string[];
  contentSubmissions: ContentSubmission[];
  analytics?: CampaignAnalytics;
  createdAt: string;
}

export interface CampaignDeliverable {
  type: 'post' | 'story' | 'reel' | 'video' | 'review' | 'event';
  quantity: number;
  guidelines?: string;
}

export interface CampaignApplication {
  id: string;
  campaignId: string;
  creatorId: string;
  creatorName?: string;
  message?: string;
  proposedRate: number;
  status: 'pending' | 'accepted' | 'rejected';
  appliedAt: string;
}

export interface ContentSubmission {
  id: string;
  campaignId: string;
  creatorId: string;
  type: string;
  url?: string;
  caption?: string;
  imageUrls?: string[];
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'published';
  brandFeedback?: string;
  submittedAt: string;
  reviewedAt?: string;
}

export interface CampaignAnalytics {
  totalReach: number;
  totalEngagement: number;
  totalImpressions: number;
  totalClicks?: number;
  totalConversions?: number;
  roi?: number;
  costPerEngagement: number;
}

// --- SHARED / SYSTEM ---

export interface User {
  id: string;
  phone: string;
  email?: string;
  name: string;
  role: 'superadmin' | 'admin' | 'manager' | 'cashier' | 'staff' | 'customer' | 'driver' | 'creator' | 'brand';
  avatar?: string;
  isActive: boolean;
  permissions: string[];
  lastLogin?: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FilterState {
  search: string;
  status: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}
