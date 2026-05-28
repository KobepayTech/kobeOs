// ============================================================================
// KOBEOS SHARED STORE PATTERN
// ============================================================================
// Lightweight state management using React Context + useReducer
// Replace with Zustand/Redux if preferred
// ============================================================================

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type { Tenant, Shipment, Creator, Campaign, Hotel, Order, Notification, User } from './types';

// --- PROPERTY STORE ---

interface PropertyState {
  tenants: Tenant[];
  selectedTenantId: string | null;
  filters: {
    search: string;
    status: string;
    propertyId: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  };
  isLoading: boolean;
  error: string | null;
}

type PropertyAction =
  | { type: 'SET_TENANTS'; payload: Tenant[] }
  | { type: 'ADD_TENANT'; payload: Tenant }
  | { type: 'UPDATE_TENANT'; payload: Tenant }
  | { type: 'DELETE_TENANT'; payload: string }
  | { type: 'SELECT_TENANT'; payload: string | null }
  | { type: 'SET_FILTERS'; payload: Partial<PropertyState['filters']> }
  | { type: 'ADD_PAYMENT'; payload: { tenantId: string; payment: unknown } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

const propertyReducer = (state: PropertyState, action: PropertyAction): PropertyState => {
  switch (action.type) {
    case 'SET_TENANTS':
      return { ...state, tenants: action.payload, isLoading: false };
    case 'ADD_TENANT':
      return { ...state, tenants: [action.payload, ...state.tenants] };
    case 'UPDATE_TENANT':
      return {
        ...state,
        tenants: state.tenants.map(t => t.id === action.payload.id ? action.payload : t),
      };
    case 'DELETE_TENANT':
      return { ...state, tenants: state.tenants.filter(t => t.id !== action.payload) };
    case 'SELECT_TENANT':
      return { ...state, selectedTenantId: action.payload };
    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload } };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    default:
      return state;
  }
};

const PropertyContext = createContext<{
  state: PropertyState;
  dispatch: React.Dispatch<PropertyAction>;
} | null>(null);

export const PropertyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(propertyReducer, {
    tenants: [],
    selectedTenantId: null,
    filters: { search: '', status: 'all', propertyId: 'all', sortBy: 'name', sortOrder: 'asc' },
    isLoading: false,
    error: null,
  });
  return React.createElement(PropertyContext.Provider, { value: { state, dispatch } }, children);
};

export const usePropertyStore = () => {
  const ctx = useContext(PropertyContext);
  if (!ctx) throw new Error('usePropertyStore must be used within PropertyProvider');
  return ctx;
};

// --- CARGO STORE ---

interface CargoState {
  shipments: Shipment[];
  selectedShipmentId: string | null;
  filters: {
    search: string;
    stage: string;
    status: string;
    dateFrom: string;
    dateTo: string;
  };
  isLoading: boolean;
}

type CargoAction =
  | { type: 'SET_SHIPMENTS'; payload: Shipment[] }
  | { type: 'ADD_SHIPMENT'; payload: Shipment }
  | { type: 'UPDATE_SHIPMENT'; payload: Shipment }
  | { type: 'UPDATE_SHIPMENT_STAGE'; payload: { id: string; stage: string } }
  | { type: 'SELECT_SHIPMENT'; payload: string | null }
  | { type: 'SET_FILTERS'; payload: Partial<CargoState['filters']> }
  | { type: 'SET_LOADING'; payload: boolean };

const cargoReducer = (state: CargoState, action: CargoAction): CargoState => {
  switch (action.type) {
    case 'SET_SHIPMENTS':
      return { ...state, shipments: action.payload, isLoading: false };
    case 'ADD_SHIPMENT':
      return { ...state, shipments: [action.payload, ...state.shipments] };
    case 'UPDATE_SHIPMENT':
      return {
        ...state,
        shipments: state.shipments.map(s => s.id === action.payload.id ? action.payload : s),
      };
    case 'UPDATE_SHIPMENT_STAGE':
      return {
        ...state,
        shipments: state.shipments.map(s =>
          s.id === action.payload.id ? { ...s, stage: action.payload.stage as Shipment['stage'], updatedAt: new Date().toISOString() } : s
        ),
      };
    case 'SELECT_SHIPMENT':
      return { ...state, selectedShipmentId: action.payload };
    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload } };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
};

const CargoContext = createContext<{ state: CargoState; dispatch: React.Dispatch<CargoAction> } | null>(null);

export const CargoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(cargoReducer, {
    shipments: [],
    selectedShipmentId: null,
    filters: { search: '', stage: 'all', status: 'all', dateFrom: '', dateTo: '' },
    isLoading: false,
  });
  return React.createElement(CargoContext.Provider, { value: { state, dispatch } }, children);
};

export const useCargoStore = () => {
  const ctx = useContext(CargoContext);
  if (!ctx) throw new Error('useCargoStore must be used within CargoProvider');
  return ctx;
};

// --- HOTEL STORE ---

interface HotelState {
  hotels: Hotel[];
  currentHotelId: string | null;
  orders: Order[];
  activeOrders: Order[];
  kdsOrders: unknown[];
  isLoading: boolean;
}

type HotelAction =
  | { type: 'SET_HOTELS'; payload: Hotel[] }
  | { type: 'SET_CURRENT_HOTEL'; payload: string }
  | { type: 'ADD_ORDER'; payload: Order }
  | { type: 'UPDATE_ORDER'; payload: Order }
  | { type: 'UPDATE_ORDER_STATUS'; payload: { orderId: string; status: Order['status'] } }
  | { type: 'SET_ORDERS'; payload: Order[] }
  | { type: 'SET_LOADING'; payload: boolean };

const hotelReducer = (state: HotelState, action: HotelAction): HotelState => {
  switch (action.type) {
    case 'SET_HOTELS':
      return { ...state, hotels: action.payload, isLoading: false };
    case 'SET_CURRENT_HOTEL':
      return { ...state, currentHotelId: action.payload };
    case 'ADD_ORDER':
      return { ...state, orders: [action.payload, ...state.orders], activeOrders: [action.payload, ...state.activeOrders] };
    case 'UPDATE_ORDER':
      return {
        ...state,
        orders: state.orders.map(o => o.id === action.payload.id ? action.payload : o),
        activeOrders: state.activeOrders.map(o => o.id === action.payload.id ? action.payload : o),
      };
    case 'UPDATE_ORDER_STATUS':
      return {
        ...state,
        orders: state.orders.map(o => o.id === action.payload.orderId ? { ...o, status: action.payload.status } : o),
        activeOrders: state.activeOrders.filter(o => o.id !== action.payload.orderId || action.payload.status !== 'paid'),
      };
    case 'SET_ORDERS':
      return { ...state, orders: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
};

const HotelContext = createContext<{ state: HotelState; dispatch: React.Dispatch<HotelAction> } | null>(null);

export const HotelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(hotelReducer, {
    hotels: [],
    currentHotelId: null,
    orders: [],
    activeOrders: [],
    kdsOrders: [],
    isLoading: false,
  });
  return React.createElement(HotelContext.Provider, { value: { state, dispatch } }, children);
};

export const useHotelStore = () => {
  const ctx = useContext(HotelContext);
  if (!ctx) throw new Error('useHotelStore must be used within HotelProvider');
  return ctx;
};

// --- CREATOR STORE ---

interface CreatorState {
  creators: Creator[];
  campaigns: Campaign[];
  currentCreatorId: string | null;
  currentBrandId: string | null;
  filters: {
    search: string;
    niche: string;
    platform: string;
    minFollowers: number;
    maxFollowers: number;
    location: string;
  };
  isLoading: boolean;
}

type CreatorAction =
  | { type: 'SET_CREATORS'; payload: Creator[] }
  | { type: 'SET_CAMPAIGNS'; payload: Campaign[] }
  | { type: 'SET_CURRENT_CREATOR'; payload: string | null }
  | { type: 'SET_CURRENT_BRAND'; payload: string | null }
  | { type: 'ADD_CAMPAIGN'; payload: Campaign }
  | { type: 'UPDATE_CAMPAIGN'; payload: Campaign }
  | { type: 'SET_FILTERS'; payload: Partial<CreatorState['filters']> }
  | { type: 'SET_LOADING'; payload: boolean };

const creatorReducer = (state: CreatorState, action: CreatorAction): CreatorState => {
  switch (action.type) {
    case 'SET_CREATORS':
      return { ...state, creators: action.payload, isLoading: false };
    case 'SET_CAMPAIGNS':
      return { ...state, campaigns: action.payload, isLoading: false };
    case 'SET_CURRENT_CREATOR':
      return { ...state, currentCreatorId: action.payload };
    case 'SET_CURRENT_BRAND':
      return { ...state, currentBrandId: action.payload };
    case 'ADD_CAMPAIGN':
      return { ...state, campaigns: [action.payload, ...state.campaigns] };
    case 'UPDATE_CAMPAIGN':
      return {
        ...state,
        campaigns: state.campaigns.map(c => c.id === action.payload.id ? action.payload : c),
      };
    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload } };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
};

const CreatorContext = createContext<{ state: CreatorState; dispatch: React.Dispatch<CreatorAction> } | null>(null);

export const CreatorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(creatorReducer, {
    creators: [],
    campaigns: [],
    currentCreatorId: null,
    currentBrandId: null,
    filters: { search: '', niche: 'all', platform: 'all', minFollowers: 0, maxFollowers: 10000000, location: '' },
    isLoading: false,
  });
  return React.createElement(CreatorContext.Provider, { value: { state, dispatch } }, children);
};

export const useCreatorStore = () => {
  const ctx = useContext(CreatorContext);
  if (!ctx) throw new Error('useCreatorStore must be used within CreatorProvider');
  return ctx;
};

// --- NOTIFICATION ENGINE ---

export interface NotificationConfig {
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
}

export const sendNotification = async (
  type: 'sms' | 'whatsapp' | 'push' | 'email',
  recipient: string,
  message: string,
  title?: string
): Promise<{ success: boolean; id?: string; error?: string }> => {
  // TODO: Integrate with actual SMS/WhatsApp/push providers
  // For now, simulate API call
  console.log(`[${type.toUpperCase()}] To: ${recipient} | ${title || ''}: ${message}`);
  return { success: true, id: generateId('notif-') };
};

export const generateId = (prefix: string = ''): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
};
