// ============================================================================
// NOTIFICATIONS ENGINE
// ============================================================================
// Multi-channel notification system:
// - SMS (Twilio)
// - WhatsApp Business API
// - Push Notifications (Firebase FCM)
// - Email (SendGrid / Resend)
// - In-app notification center
// ============================================================================

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { api } from './kobeos-api-client';

// --- NOTIFICATION TYPES ---

export type NotificationChannel = 'sms' | 'whatsapp' | 'push' | 'email' | 'in-app';

export interface NotificationMessage {
  id: string;
  recipientId: string;
  recipientPhone?: string;
  recipientEmail?: string;
  recipientFcmToken?: string;
  title: string;
  body: string;
  channel: NotificationChannel;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  metadata?: Record<string, any>;
  sentAt?: string;
  readAt?: string;
  createdAt: string;
}

export interface NotificationPreferences {
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  quietHoursStart?: string; // "22:00"
  quietHoursEnd?: string;   // "08:00"
}

// --- NOTIFICATION API ---

export const notificationApi = {
  send: async (message: Omit<NotificationMessage, 'id' | 'status' | 'createdAt'>) => {
    return api.post<NotificationMessage>('/notifications/send', message);
  },

  sendBulk: async (messages: Omit<NotificationMessage, 'id' | 'status' | 'createdAt'>[]) => {
    return api.post<{ sent: number; failed: number }>('/notifications/send-bulk', { messages });
  },

  getHistory: async (page: number = 1, channel?: NotificationChannel) => {
    return api.get<{ data: NotificationMessage[]; total: number }>('/notifications/history', {
      page,
      pageSize: 20,
      channel,
    });
  },

  markAsRead: async (notificationId: string) => {
    return api.patch(`/notifications/${notificationId}/read`, {});
  },

  getUnreadCount: async () => {
    const res = await api.get<{ count: number }>('/notifications/unread-count');
    return res.data?.count || 0;
  },

  updatePreferences: async (prefs: Partial<NotificationPreferences>) => {
    return api.patch('/notifications/preferences', prefs);
  },

  getPreferences: async () => {
    return api.get<NotificationPreferences>('/notifications/preferences');
  },

  registerFcmToken: async (token: string) => {
    return api.post('/notifications/fcm-token', { token });
  },
};

// --- TEMPLATES (Pre-built for common scenarios) ---

export const notificationTemplates = {
  // CARGO
  cargoWarehouseReceived: (shipmentRef: string, warehouse: string): NotificationMessage => ({
    id: '',
    recipientId: '',
    title: 'Parcel Received',
    body: `Your shipment ${shipmentRef} has been received at ${warehouse}.`,
    channel: 'sms',
    priority: 'normal',
    status: 'pending',
    createdAt: new Date().toISOString(),
  }),

  cargoCustomsCharges: (shipmentRef: string, amount: number, currency: string): NotificationMessage => ({
    id: '',
    recipientId: '',
    title: 'Customs Charges Added',
    body: `Customs charges of ${currency} ${amount.toLocaleString()} have been added to shipment ${shipmentRef}. Please pay before release.`,
    channel: 'sms',
    priority: 'high',
    status: 'pending',
    createdAt: new Date().toISOString(),
  }),

  cargoDelivered: (shipmentRef: string): NotificationMessage => ({
    id: '',
    recipientId: '',
    title: 'Shipment Delivered',
    body: `Your shipment ${shipmentRef} has been delivered. Thank you for using KobeCargo.`,
    channel: 'sms',
    priority: 'normal',
    status: 'pending',
    createdAt: new Date().toISOString(),
  }),

  // PROPERTY
  rentReminder: (tenantName: string, amount: number, currency: string, dueDate: string): NotificationMessage => ({
    id: '',
    recipientId: '',
    title: 'Rent Payment Reminder',
    body: `Hi ${tenantName}, your rent of ${currency} ${amount.toLocaleString()} is due on ${dueDate}. Please pay to avoid penalties.`,
    channel: 'sms',
    priority: 'high',
    status: 'pending',
    createdAt: new Date().toISOString(),
  }),

  rentOverdue: (tenantName: string, amount: number, currency: string, days: number): NotificationMessage => ({
    id: '',
    recipientId: '',
    title: 'Overdue Rent Notice',
    body: `Hi ${tenantName}, your rent of ${currency} ${amount.toLocaleString()} is ${days} days overdue. Please settle immediately.`,
    channel: 'sms',
    priority: 'urgent',
    status: 'pending',
    createdAt: new Date().toISOString(),
  }),

  paymentReceived: (tenantName: string, amount: number, currency: string, receiptNo: string): NotificationMessage => ({
    id: '',
    recipientId: '',
    title: 'Payment Received',
    body: `Hi ${tenantName}, we received ${currency} ${amount.toLocaleString()}. Receipt: ${receiptNo}.`,
    channel: 'sms',
    priority: 'normal',
    status: 'pending',
    createdAt: new Date().toISOString(),
  }),

  // HOTEL
  orderReady: (orderId: string, items: string): NotificationMessage => ({
    id: '',
    recipientId: '',
    title: 'Order Ready',
    body: `Your order #${orderId} (${items}) is ready!`,
    channel: 'push',
    priority: 'normal',
    status: 'pending',
    createdAt: new Date().toISOString(),
  }),

  roomService: (roomNumber: string, service: string): NotificationMessage => ({
    id: '',
    recipientId: '',
    title: 'Room Service Request',
    body: `Room ${roomNumber} requested: ${service}`,
    channel: 'push',
    priority: 'normal',
    status: 'pending',
    createdAt: new Date().toISOString(),
  }),

  // CREATOR
  campaignInvitation: (brandName: string, campaignTitle: string): NotificationMessage => ({
    id: '',
    recipientId: '',
    title: 'Campaign Invitation',
    body: `${brandName} invited you to join "${campaignTitle}". Check your dashboard to apply.`,
    channel: 'in-app',
    priority: 'normal',
    status: 'pending',
    createdAt: new Date().toISOString(),
  }),

  contentApproved: (campaignTitle: string): NotificationMessage => ({
    id: '',
    recipientId: '',
    title: 'Content Approved',
    body: `Your submission for "${campaignTitle}" has been approved! You can now publish.`,
    channel: 'in-app',
    priority: 'normal',
    status: 'pending',
    createdAt: new Date().toISOString(),
  }),

  paymentReleased: (amount: number, currency: string, campaignTitle: string): NotificationMessage => ({
    id: '',
    recipientId: '',
    title: 'Payment Released',
    body: `${currency} ${amount.toLocaleString()} for "${campaignTitle}" has been released to your account.`,
    channel: 'in-app',
    priority: 'normal',
    status: 'pending',
    createdAt: new Date().toISOString(),
  }),
};

// --- NOTIFICATION CONTEXT ---

interface NotificationContextType {
  notifications: NotificationMessage[];
  unreadCount: number;
  isLoading: boolean;
  send: (message: Omit<NotificationMessage, 'id' | 'status' | 'createdAt'>) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [historyRes, countRes] = await Promise.all([
        notificationApi.getHistory(1),
        notificationApi.getUnreadCount(),
      ]);
      if (historyRes.data) setNotifications(historyRes.data.data);
      setUnreadCount(countRes);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Poll every 30 seconds
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const send = useCallback(async (message: Omit<NotificationMessage, 'id' | 'status' | 'createdAt'>) => {
    const res = await notificationApi.send(message);
    if (res.data) {
      setNotifications(prev => [res.data!, ...prev]);
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    await notificationApi.markAsRead(id);
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, status: 'read' as const, readAt: new Date().toISOString() } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(async () => {
    await api.patch('/notifications/mark-all-read', {});
    setNotifications(prev => prev.map(n => ({ ...n, status: 'read' as const })));
    setUnreadCount(0);
  }, []);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      isLoading,
      send,
      markAsRead,
      markAllAsRead,
      refresh,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
};

// --- IN-APP NOTIFICATION BELL COMPONENT ---

import { Bell, CheckCheck, X } from 'lucide-react';

export const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'relative',
          padding: '8px',
          background: 'transparent',
          border: 'none',
          color: '#FFFFFF',
          cursor: 'pointer',
        }}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            background: '#F87171',
            color: '#FFFFFF',
            fontSize: '11px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: '360px',
          maxHeight: '480px',
          background: '#181818',
          border: '1px solid #222',
          borderRadius: '12px',
          boxShadow: '0 10px 15px rgba(0,0,0,0.5)',
          zIndex: 1000,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #222',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>Notifications</span>
            <button
              onClick={markAllAsRead}
              style={{
                padding: '4px 8px',
                background: 'transparent',
                border: 'none',
                color: '#60A5FA',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <CheckCheck size={14} /> Mark all read
            </button>
          </div>

          <div style={{ overflow: 'auto', flex: 1 }}>
            {notifications.length === 0 && (
              <div style={{ padding: '32px', textAlign: 'center', color: '#6B7280', fontSize: '13px' }}>
                No notifications yet
              </div>
            )}
            {notifications.map(notif => (
              <div
                key={notif.id}
                onClick={() => { markAsRead(notif.id); setIsOpen(false); }}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #1A1A1A',
                  cursor: 'pointer',
                  background: notif.status === 'pending' || notif.status === 'sent' ? '#1A1A1A' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: notif.status === 'read' ? 'transparent' : '#60A5FA',
                    marginTop: '6px',
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>{notif.title}</div>
                    <div style={{ fontSize: '12px', color: '#B3B3B3', marginTop: '2px', lineHeight: 1.4 }}>{notif.body}</div>
                    <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>
                      {notif.channel} · {new Date(notif.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationProvider;
