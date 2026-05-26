// ============================================================================
// BACKEND API CLIENT LAYER
// ============================================================================
// Production-grade fetch wrapper with:
// - JWT auth interceptors
// - Automatic token refresh
// - Request/response logging
// - Retry logic with exponential backoff
// - Error normalization
// - File upload support
// ============================================================================

import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './kobeos-token-manager';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.kobeos.app/v1';

interface ApiError {
  status: number;
  message: string;
  code: string;
  details?: Record<string, string[]>;
}

interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

class ApiClient {
  private baseUrl: string;
  private refreshPromise: Promise<string | null> | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retries: number = 3
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = getAccessToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Client-Version': '1.0.0',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Token expired — try refresh
      if (response.status === 401) {
        const newToken = await this.refreshAccessToken();
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`;
          const retryResponse = await fetch(url, { ...options, headers });
          return this.parseResponse<T>(retryResponse);
        }
        clearTokens();
        window.location.href = '/login?expired=true';
        return { error: { status: 401, message: 'Session expired. Please log in again.', code: 'UNAUTHORIZED' } };
      }

      return this.parseResponse<T>(response);
    } catch (networkError) {
      if (retries > 0) {
        await this.delay(Math.pow(2, 3 - retries) * 1000);
        return this.request<T>(endpoint, options, retries - 1);
      }
      return {
        error: {
          status: 0,
          message: 'Network error. Please check your connection.',
          code: 'NETWORK_ERROR',
        },
      };
    }
  }

  private async parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const contentType = response.headers.get('content-type') || '';
    let body: any = {};

    if (contentType.includes('application/json')) {
      body = await response.json();
    } else if (response.status !== 204) {
      body = { message: await response.text() };
    }

    if (!response.ok) {
      return {
        error: {
          status: response.status,
          message: body.message || body.error || `HTTP ${response.status}`,
          code: body.code || `HTTP_${response.status}`,
          details: body.details,
        },
      };
    }

    return {
      data: body.data || body,
      meta: body.meta,
    };
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return null;

      try {
        const response = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) return null;

        const data = await response.json();
        setTokens(data.accessToken, data.refreshToken);
        return data.accessToken;
      } catch {
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // === HTTP METHODS ===

  async get<T>(endpoint: string, params?: Record<string, string | number | undefined>): Promise<ApiResponse<T>> {
    const query = params
      ? '?' + new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined && v !== '')
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : '';
    return this.request<T>(`${endpoint}${query}`, { method: 'GET' });
  }

  async post<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async put<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async patch<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async upload<T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: formData,
      headers: {}, // Let browser set Content-Type with boundary
    });
  }
}

// Singleton instance
export const api = new ApiClient();

// ============================================================================
// MODULE-SPECIFIC API HOOKS
// ============================================================================

import { useCallback } from 'react';
import type {
  Tenant, Shipment, Creator, Campaign, Hotel, Order,
  PaymentRecord, CargoPayment, CampaignApplication, ContentSubmission,
  PaginatedResponse, FilterState
} from '@/shared/types';

// --- PROPERTY API ---

export const usePropertyApi = () => {
  const fetchTenants = useCallback(async (filters: FilterState, page: number = 1, pageSize: number = 20) => {
    return api.get<PaginatedResponse<Tenant>>('/property/tenants', {
      ...filters,
      page,
      pageSize,
    });
  }, []);

  const fetchTenant = useCallback(async (id: string) => {
    return api.get<Tenant>(`/property/tenants/${id}`);
  }, []);

  const createTenant = useCallback(async (tenant: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>) => {
    return api.post<Tenant>('/property/tenants', tenant);
  }, []);

  const updateTenant = useCallback(async (id: string, updates: Partial<Tenant>) => {
    return api.patch<Tenant>(`/property/tenants/${id}`, updates);
  }, []);

  const deleteTenant = useCallback(async (id: string) => {
    return api.delete<void>(`/property/tenants/${id}`);
  }, []);

  const recordPayment = useCallback(async (tenantId: string, payment: Omit<PaymentRecord, 'id'>) => {
    return api.post<PaymentRecord>(`/property/tenants/${tenantId}/payments`, payment);
  }, []);

  const fetchSummary = useCallback(async (propertyId?: string) => {
    return api.get<{ totalTenants: number; overdue: number; paid: number; pending: number; revenue: number }>(
      '/property/summary',
      { propertyId }
    );
  }, []);

  const generateInvoice = useCallback(async (tenantId: string, month: string) => {
    return api.get<{ url: string }>(`/property/tenants/${tenantId}/invoice`, { month });
  }, []);

  return {
    fetchTenants, fetchTenant, createTenant, updateTenant, deleteTenant,
    recordPayment, fetchSummary, generateInvoice,
  };
};

// --- CARGO API ---

export const useCargoApi = () => {
  const fetchShipments = useCallback(async (filters?: Record<string, string>, page: number = 1) => {
    return api.get<PaginatedResponse<Shipment>>('/cargo/shipments', { ...filters, page, pageSize: 20 });
  }, []);

  const fetchShipment = useCallback(async (id: string) => {
    return api.get<Shipment>(`/cargo/shipments/${id}`);
  }, []);

  const createShipment = useCallback(async (shipment: Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>) => {
    return api.post<Shipment>('/cargo/shipments', shipment);
  }, []);

  const updateStage = useCallback(async (id: string, stage: string, location?: string, notes?: string) => {
    return api.patch<Shipment>(`/cargo/shipments/${id}/stage`, { stage, location, notes, timestamp: new Date().toISOString() });
  }, []);

  const scanQR = useCallback(async (qrData: string) => {
    return api.get<Shipment>('/cargo/scan', { qr: qrData });
  }, []);

  const processPayment = useCallback(async (shipmentId: string, payment: Omit<CargoPayment, 'id' | 'createdAt'>) => {
    return api.post<CargoPayment>(`/cargo/shipments/${shipmentId}/payments`, payment);
  }, []);

  const generateReceipt = useCallback(async (paymentId: string, type: 'customer' | 'supplier' | 'warehouse') => {
    return api.get<{ url: string; html: string }>(`/cargo/payments/${paymentId}/receipt`, { type });
  }, []);

  const addWarehouseReceipt = useCallback(async (shipmentId: string, data: { warehouseId: string; condition: string; photos?: string[]; notes?: string }) => {
    return api.post(`/cargo/shipments/${shipmentId}/warehouse-receipts`, data);
  }, []);

  const addCustomsCharge = useCallback(async (shipmentId: string, data: { type: string; amount: number; notes?: string }) => {
    return api.post(`/cargo/shipments/${shipmentId}/customs-charges`, data);
  }, []);

  return {
    fetchShipments, fetchShipment, createShipment, updateStage, scanQR,
    processPayment, generateReceipt, addWarehouseReceipt, addCustomsCharge,
  };
};

// --- HOTEL API ---

export const useHotelApi = () => {
  const fetchHotels = useCallback(async () => {
    return api.get<Hotel[]>('/hotels');
  }, []);

  const fetchHotel = useCallback(async (id: string) => {
    return api.get<Hotel>(`/hotels/${id}`);
  }, []);

  const updateHotel = useCallback(async (id: string, updates: Partial<Hotel>) => {
    return api.patch<Hotel>(`/hotels/${id}`, updates);
  }, []);

  const createRoom = useCallback(async (hotelId: string, room: any) => {
    return api.post(`/hotels/${hotelId}/rooms`, room);
  }, []);

  const createBooking = useCallback(async (hotelId: string, booking: any) => {
    return api.post(`/hotels/${hotelId}/bookings`, booking);
  }, []);

  const createOrder = useCallback(async (hotelId: string, order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>) => {
    return api.post<Order>(`/hotels/${hotelId}/orders`, order);
  }, []);

  const updateOrderStatus = useCallback(async (hotelId: string, orderId: string, status: string) => {
    return api.patch<Order>(`/hotels/${hotelId}/orders/${orderId}`, { status });
  }, []);

  const updateOrderItemStatus = useCallback(async (hotelId: string, orderId: string, itemId: string, status: string) => {
    return api.patch(`/hotels/${hotelId}/orders/${orderId}/items/${itemId}`, { status });
  }, []);

  const fetchActiveOrders = useCallback(async (hotelId: string, station?: string) => {
    return api.get<Order[]>(`/hotels/${hotelId}/orders/active`, { station });
  }, []);

  const updateMenu = useCallback(async (hotelId: string, categoryId: string, items: any[]) => {
    return api.put(`/hotels/${hotelId}/menu/${categoryId}`, { items });
  }, []);

  const generateQR = useCallback(async (hotelId: string, type: 'table' | 'room', id: string) => {
    return api.get<{ qrUrl: string; portalUrl: string }>(`/hotels/${hotelId}/qr`, { type, id });
  }, []);

  return {
    fetchHotels, fetchHotel, updateHotel, createRoom, createBooking,
    createOrder, updateOrderStatus, updateOrderItemStatus, fetchActiveOrders,
    updateMenu, generateQR,
  };
};

// --- CREATOR API ---

export const useCreatorApi = () => {
  const fetchCreators = useCallback(async (filters?: Record<string, string>) => {
    return api.get<PaginatedResponse<Creator>>('/creators', filters);
  }, []);

  const fetchCreator = useCallback(async (id: string) => {
    return api.get<Creator>(`/creators/${id}`);
  }, []);

  const updateProfile = useCallback(async (updates: Partial<Creator>) => {
    return api.patch<Creator>('/creators/me', updates);
  }, []);

  const fetchCampaigns = useCallback(async (status?: string) => {
    return api.get<PaginatedResponse<Campaign>>('/campaigns', { status });
  }, []);

  const createCampaign = useCallback(async (campaign: Omit<Campaign, 'id' | 'createdAt'>) => {
    return api.post<Campaign>('/campaigns', campaign);
  }, []);

  const applyCampaign = useCallback(async (campaignId: string, application: Omit<CampaignApplication, 'id' | 'appliedAt'>) => {
    return api.post<CampaignApplication>(`/campaigns/${campaignId}/apply`, application);
  }, []);

  const reviewApplication = useCallback(async (campaignId: string, applicationId: string, status: 'accepted' | 'rejected') => {
    return api.patch(`/campaigns/${campaignId}/applications/${applicationId}`, { status });
  }, []);

  const submitContent = useCallback(async (campaignId: string, submission: Omit<ContentSubmission, 'id' | 'submittedAt'>) => {
    return api.post<ContentSubmission>(`/campaigns/${campaignId}/submissions`, submission);
  }, []);

  const reviewContent = useCallback(async (campaignId: string, submissionId: string, status: 'approved' | 'rejected', feedback?: string) => {
    return api.patch(`/campaigns/${campaignId}/submissions/${submissionId}`, { status, feedback });
  }, []);

  return {
    fetchCreators, fetchCreator, updateProfile, fetchCampaigns,
    createCampaign, applyCampaign, reviewApplication, submitContent, reviewContent,
  };
};

export default api;
