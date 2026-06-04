// ============================================================================
// REAL-TIME ENGINE (WebSockets)
// ============================================================================
// WebSocket client for live updates:
// - KDS order updates (Kitchen/Bar/Dessert)
// - Cargo tracking events
// - Hotel room/booking changes
// - Creator campaign notifications
// - Payment status updates
// - Auto-reconnect with exponential backoff
// ============================================================================

import { useEffect, useState, useCallback } from 'react';

const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'wss://api.kobeos.app/ws';

export type WebSocketEvent =
  | 'order.created'
  | 'order.updated'
  | 'order.item.updated'
  | 'shipment.stage.changed'
  | 'shipment.warehouse.scanned'
  | 'shipment.customs.updated'
  | 'room.status.changed'
  | 'booking.created'
  | 'booking.updated'
  | 'payment.completed'
  | 'payment.failed'
  | 'campaign.application'
  | 'campaign.content.submitted'
  | 'campaign.content.approved'
  | 'notification.new'
  | 'user.typing'
  | 'ping';

interface WebSocketMessage {
  event: WebSocketEvent;
  payload: any;
  timestamp: string;
  sender?: string;
}

type MessageHandler = (message: WebSocketMessage) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private handlers: Map<WebSocketEvent, Set<MessageHandler>> = new Map();
  private messageQueue: WebSocketMessage[] = [];
  private isConnected = false;

  constructor(url: string = WS_BASE_URL) {
    this.url = url;
  }

  connect(token?: string) {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (this.ws?.readyState === WebSocket.CONNECTING) return;

    this.token = token || this.token;
    const wsUrl = this.token ? `${this.url}?token=${this.token}` : this.url;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();

        // Subscribe to rooms/channels after connection
        this.subscribeToDefaultChannels();

        // Flush queued messages
        while (this.messageQueue.length > 0) {
          const msg = this.messageQueue.shift();
          if (msg) this.send(msg);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (err) {
          console.error('[WebSocket] Invalid message:', event.data);
        }
      };

      this.ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        this.isConnected = false;
        this.stopHeartbeat();
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        this.ws?.close();
      };
    } catch (err) {
      console.error('[WebSocket] Connection failed:', err);
      this.scheduleReconnect();
    }
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.ws?.close();
    this.ws = null;
    this.isConnected = false;
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.send({ event: 'ping', payload: {}, timestamp: new Date().toISOString() });
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private subscribeToDefaultChannels() {
    // Auto-subscribe based on user role/permissions
    this.send({
      event: 'ping',
      payload: { action: 'subscribe', channels: ['orders', 'shipments', 'notifications'] },
      timestamp: new Date().toISOString(),
    });
  }

  send(message: WebSocketMessage) {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }

  private handleMessage(message: WebSocketMessage) {
    const handlers = this.handlers.get(message.event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message);
        } catch (err) {
          console.error('[WebSocket] Handler error:', err);
        }
      });
    }

    // Also emit as custom DOM event for non-React listeners
    window.dispatchEvent(new CustomEvent('ws-message', { detail: message }));
  }

  on(event: WebSocketEvent, handler: MessageHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  off(event: WebSocketEvent, handler: MessageHandler) {
    this.handlers.get(event)?.delete(handler);
  }

  getConnectionState() {
    return {
      isConnected: this.isConnected,
      readyState: this.ws?.readyState,
      queueLength: this.messageQueue.length,
    };
  }
}

// Singleton instance
export const wsClient = new WebSocketClient();

// --- REACT HOOKS ---

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const check = () => {
      const state = wsClient.getConnectionState();
      setIsConnected(state.isConnected);
    };
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, []);

  const connect = useCallback((token?: string) => {
    wsClient.connect(token);
  }, []);

  const disconnect = useCallback(() => {
    wsClient.disconnect();
  }, []);

  return { isConnected, connect, disconnect };
};

export const useWebSocketEvent = (event: WebSocketEvent, handler: MessageHandler) => {
  useEffect(() => {
    const unsubscribe = wsClient.on(event, handler);
    return () => unsubscribe();
  }, [event, handler]);
};

// --- MODULE-SPECIFIC REAL-TIME HOOKS ---

import type { Order, Notification as NotificationMessage } from '@/shared/types';

// KDS Real-time Orders
export const useKDSRealtime = (hotelId: string, station: string, onNewOrder: (order: Order) => void) => {
  useEffect(() => {
    wsClient.connect();

    const unsubCreated = wsClient.on('order.created', (msg) => {
      if (msg.payload.hotelId === hotelId && msg.payload.order.station === station) {
        onNewOrder(msg.payload.order);
      }
    });

    const unsubUpdated = wsClient.on('order.updated', (msg) => {
      if (msg.payload.hotelId === hotelId && msg.payload.order.station === station) {
        onNewOrder(msg.payload.order);
      }
    });

    const unsubItem = wsClient.on('order.item.updated', (msg) => {
      if (msg.payload.hotelId === hotelId) {
        onNewOrder(msg.payload.order);
      }
    });

    return () => {
      unsubCreated();
      unsubUpdated();
      unsubItem();
    };
  }, [hotelId, station, onNewOrder]);
};

// Cargo Tracking Real-time
export const useCargoRealtime = (onStageChange: (shipmentId: string, stage: string, location: string) => void) => {
  useEffect(() => {
    wsClient.connect();

    const unsubStage = wsClient.on('shipment.stage.changed', (msg) => {
      onStageChange(msg.payload.shipmentId, msg.payload.stage, msg.payload.location);
    });

    const unsubWarehouse = wsClient.on('shipment.warehouse.scanned', (msg) => {
      onStageChange(msg.payload.shipmentId, 'warehouse-received', msg.payload.warehouseName);
    });

    const unsubCustoms = wsClient.on('shipment.customs.updated', (msg) => {
      onStageChange(msg.payload.shipmentId, msg.payload.stage, 'Customs');
    });

    return () => {
      unsubStage();
      unsubWarehouse();
      unsubCustoms();
    };
  }, [onStageChange]);
};

// Hotel Room/Booking Real-time
export const useHotelRealtime = (hotelId: string, onRoomChange: (roomId: string, status: string) => void, onBookingChange: (booking: any) => void) => {
  useEffect(() => {
    wsClient.connect();

    const unsubRoom = wsClient.on('room.status.changed', (msg) => {
      if (msg.payload.hotelId === hotelId) {
        onRoomChange(msg.payload.roomId, msg.payload.status);
      }
    });

    const unsubBooking = wsClient.on('booking.updated', (msg) => {
      if (msg.payload.hotelId === hotelId) {
        onBookingChange(msg.payload.booking);
      }
    });

    return () => {
      unsubRoom();
      unsubBooking();
    };
  }, [hotelId, onRoomChange, onBookingChange]);
};

// Payment Status Real-time
export const usePaymentRealtime = (onPaymentUpdate: (paymentId: string, status: string) => void) => {
  useEffect(() => {
    wsClient.connect();

    const unsubCompleted = wsClient.on('payment.completed', (msg) => {
      onPaymentUpdate(msg.payload.paymentId, 'completed');
    });

    const unsubFailed = wsClient.on('payment.failed', (msg) => {
      onPaymentUpdate(msg.payload.paymentId, 'failed');
    });

    return () => {
      unsubCompleted();
      unsubFailed();
    };
  }, [onPaymentUpdate]);
};

// Creator Campaign Real-time
export const useCreatorRealtime = (creatorId: string, onCampaignEvent: (event: string, payload: any) => void) => {
  useEffect(() => {
    wsClient.connect();

    const unsubApp = wsClient.on('campaign.application', (msg) => {
      if (msg.payload.creatorId === creatorId) {
        onCampaignEvent('application', msg.payload);
      }
    });

    const unsubContent = wsClient.on('campaign.content.approved', (msg) => {
      if (msg.payload.creatorId === creatorId) {
        onCampaignEvent('content-approved', msg.payload);
      }
    });

    return () => {
      unsubApp();
      unsubContent();
    };
  }, [creatorId, onCampaignEvent]);
};

// Notification Real-time
export const useNotificationRealtime = (onNotification: (notif: NotificationMessage) => void) => {
  useEffect(() => {
    wsClient.connect();

    const unsub = wsClient.on('notification.new', (msg) => {
      onNotification(msg.payload);
    });

    return () => unsub();
  }, [onNotification]);
};

// --- CONNECTION STATUS INDICATOR ---

export const ConnectionStatus: React.FC = () => {
  const { isConnected } = useWebSocket();

  return (
    <div style={{
      position: 'fixed',
      bottom: '16px',
      right: '16px',
      padding: '6px 12px',
      borderRadius: '20px',
      background: isConnected ? '#0A3D1F' : '#450A0A',
      border: `1px solid ${isConnected ? '#166534' : '#991B1B'}`,
      color: isConnected ? '#4ADE80' : '#F87171',
      fontSize: '11px',
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      zIndex: 9999,
    }}>
      <span style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: 'currentColor',
        animation: isConnected ? 'none' : 'pulse 1.5s infinite',
      }} />
      {isConnected ? 'Live' : 'Reconnecting...'}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
};

export default wsClient;
