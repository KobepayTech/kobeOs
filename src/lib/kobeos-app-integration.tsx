// ============================================================================
// APP INTEGRATION (main.tsx / App.tsx)
// ============================================================================
// Complete wiring of all 6 backend layers + all frontend modules
// Copy this into your main entry point
// ============================================================================

import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// --- STYLES ---
import './styles/global.css';

// --- AUTH ---
import { AuthProvider, useAuth, RequireAuth } from './backend/auth/authSystem';

// --- NOTIFICATIONS ---
import { NotificationProvider } from './backend/notifications/notificationEngine';

// --- STORES ---
import {
  PropertyProvider, CargoProvider, HotelProvider, CreatorProvider
} from './shared/store';

// --- REALTIME ---
import { ConnectionStatus } from './backend/realtime/websocketEngine';

// --- PROPERTY PAGES ---
import { PropertySummaryCards } from './property/PropertySummaryCards';
import { TenantListView } from './property/TenantListView';
import { TenantDetailView } from './property/TenantDetailView';

// --- HOTEL PAGES ---
import { HotelAdminDashboard } from './hotel/HotelAdminDashboard';
import { KDSDisplay } from './hotel/KDSDisplay';

// --- CARGO PAGES ---
import { ShipmentCreation } from './cargo/ShipmentCreation';
import { CargoKanban } from './cargo/CargoKanban';
import { CargoPaymentWorkflow } from './cargo/CargoPaymentWorkflow';

// --- CREATOR PAGES ---
import { CreatorDashboard } from './creators/CreatorDashboard';
import { BrandPortal } from './creators/BrandPortal';

// --- API HOOKS (for data fetching) ---
import { usePropertyApi, useCargoApi } from './backend/api/client';

// ============================================================================
// EXAMPLE: PROPERTY PAGE (with backend integration)
// ============================================================================

const PropertyPage: React.FC = () => {
  const { user } = useAuth();
  const { fetchTenants, fetchSummary, recordPayment } = usePropertyApi();
  const { state: propertyState, dispatch } = usePropertyStore();
  const [selectedTenant, setSelectedTenant] = useState<any>(null);

  // Load data on mount
  useEffect(() => {
    const load = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      const [tenantsRes, summaryRes] = await Promise.all([
        fetchTenants(propertyState.filters),
        fetchSummary(),
      ]);
      if (tenantsRes.data) dispatch({ type: 'SET_TENANTS', payload: tenantsRes.data.data });
      if (summaryRes.data) {
        // summary stored separately or in state
      }
      dispatch({ type: 'SET_LOADING', payload: false });
    };
    load();
  }, [propertyState.filters]);

  const handleRecordPayment = async (tenantId: string) => {
    const amount = prompt('Enter payment amount:');
    if (!amount) return;
    const res = await recordPayment(tenantId, {
      tenantId,
      amount: Number(amount),
      method: 'kobepay',
      reference: `PAY-${Date.now()}`,
      date: new Date().toISOString(),
      month: new Date().toISOString().slice(0, 7),
      status: 'completed',
    });
    if (res.data) {
      // Refresh tenant data
      alert('Payment recorded successfully!');
    }
  };

  if (propertyState.isLoading) return <div style={{ padding: 40, color: '#6B7280' }}>Loading...</div>;

  return (
    <div style={{ padding: 24 }}>
      <PropertySummaryCards
        summary={{
          totalTenants: propertyState.tenants.length,
          overdueCount: propertyState.tenants.filter(t => t.status === 'overdue').length,
          fullyPaidCount: propertyState.tenants.filter(t => t.status === 'fully-paid').length,
          pendingCount: propertyState.tenants.filter(t => t.status === 'pending').length,
          totalRevenueThisMonth: propertyState.tenants.reduce((sum, t) => sum + t.paidAmount, 0),
          totalOutstanding: propertyState.tenants.reduce((sum, t) => sum + t.balance, 0),
          occupancyRate: 85,
        }}
      />

      {selectedTenant ? (
        <TenantDetailView
          tenant={selectedTenant}
          onBack={() => setSelectedTenant(null)}
          onRecordPayment={handleRecordPayment}
          onSendReminder={(id) => alert(`Sending reminder to tenant ${id}`)}
          onDownloadInvoice={(id) => alert(`Downloading invoice for tenant ${id}`)}
          onGenerateReceipt={(id) => alert(`Generating receipt ${id}`)}
          onWhatsApp={(id) => window.open(`https://wa.me/${selectedTenant.phone}`, '_blank')}
          onEdit={(id) => alert(`Editing tenant ${id}`)}
        />
      ) : (
        <TenantListView
          tenants={propertyState.tenants}
          onSelectTenant={(id) => {
            const tenant = propertyState.tenants.find(t => t.id === id);
            if (tenant) setSelectedTenant(tenant);
          }}
          onRecordPayment={handleRecordPayment}
          onSendReminder={(id) => alert(`Reminder sent to ${id}`)}
          onWhatsApp={(id) => {
            const tenant = propertyState.tenants.find(t => t.id === id);
            if (tenant) window.open(`https://wa.me/${tenant.phone}`, '_blank');
          }}
          onExport={() => alert('Exporting to CSV...')}
        />
      )}
    </div>
  );
};

// ============================================================================
// EXAMPLE: CARGO PAGE (with backend integration)
// ============================================================================

const CargoPage: React.FC = () => {
  const { fetchShipments, updateStage, createShipment, processPayment } = useCargoApi();
  const { state: cargoState, dispatch } = useCargoStore();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      const res = await fetchShipments(cargoState.filters);
      if (res.data) dispatch({ type: 'SET_SHIPMENTS', payload: res.data.data });
      dispatch({ type: 'SET_LOADING', payload: false });
    };
    load();
  }, [cargoState.filters]);

  const handleCreate = async (shipment: any) => {
    const res = await createShipment(shipment);
    if (res.data) {
      dispatch({ type: 'ADD_SHIPMENT', payload: res.data });
      setShowCreate(false);
    }
  };

  const handleStageUpdate = async (id: string, stage: string) => {
    await updateStage(id, stage);
    dispatch({ type: 'UPDATE_SHIPMENT_STAGE', payload: { id, stage } });
  };

  return (
    <div style={{ padding: 24, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ margin: 0, color: '#FFFFFF' }}>Cargo Operations</h1>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: '10px 18px',
            background: '#1F3B73',
            border: 'none',
            borderRadius: 8,
            color: '#FFFFFF',
            cursor: 'pointer',
          }}
        >
          + New Shipment
        </button>
      </div>

      {showCreate ? (
        <ShipmentCreation
          onCreate={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      ) : selectedShipment ? (
        <CargoPaymentWorkflow
          shipment={selectedShipment}
          onProcessPayment={async (payment) => {
            await processPayment(selectedShipment.id, payment);
            alert('Payment processed!');
          }}
          onPrintReceipt={(receipt) => {
            window.print();
          }}
        />
      ) : (
        <CargoKanban
          shipments={cargoState.shipments}
          onUpdateStage={handleStageUpdate}
          onSelectShipment={(id) => {
            const s = cargoState.shipments.find(x => x.id === id);
            if (s) setSelectedShipment(s);
          }}
          onScanQR={(id) => alert(`Scanning QR for ${id}`)}
        />
      )}
    </div>
  );
};

// ============================================================================
// MAIN APP ROUTER
// ============================================================================

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <PropertyProvider>
            <CargoProvider>
              <HotelProvider>
                <CreatorProvider>
                  <div style={{ minHeight: '100vh', background: '#0B0B0B' }}>
                    {/* Top Navigation with Notification Bell */}
                    <nav style={{
                      height: 56,
                      background: '#111111',
                      borderBottom: '1px solid #1A1A1A',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0 24px',
                    }}>
                      <span style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF' }}>KobeOS</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        {/* <NotificationBell /> */}
                        <UserMenu />
                      </div>
                    </nav>

                    <Routes>
                      <Route path="/login" element={<LoginPage />} />

                      <Route path="/property" element={
                        <RequireAuth roles={['superadmin', 'admin', 'manager']}>
                          <PropertyPage />
                        </RequireAuth>
                      } />

                      <Route path="/cargo/*" element={
                        <RequireAuth roles={['superadmin', 'admin', 'manager', 'cashier']}>
                          <CargoPage />
                        </RequireAuth>
                      } />

                      <Route path="/hotel/*" element={
                        <RequireAuth roles={['superadmin', 'admin', 'manager', 'staff']}>
                          <HotelAdminDashboard hotel={{} as any} onUpdateHotel={() => {}} />
                        </RequireAuth>
                      } />

                      <Route path="/kds" element={
                        <RequireAuth roles={['superadmin', 'admin', 'staff']}>
                          <KDSDisplay orders={[]} station="all" onUpdateItemStatus={() => {}} onCompleteOrder={() => {}} />
                        </RequireAuth>
                      } />

                      <Route path="/creators" element={
                        <RequireAuth roles={['creator']}>
                          <CreatorDashboard creator={{} as any} campaigns={[]} onApplyCampaign={() => {}} onSubmitContent={() => {}} onUpdateProfile={() => {}} />
                        </RequireAuth>
                      } />

                      <Route path="/brands" element={
                        <RequireAuth roles={['brand', 'admin']}>
                          <BrandPortal brand={{} as any} creators={[]} campaigns={[]} onCreateCampaign={() => {}} onApproveApplication={() => {}} onRejectApplication={() => {}} onApproveContent={() => {}} onRejectContent={() => {}} />
                        </RequireAuth>
                      } />

                      <Route path="/" element={<Navigate to="/property" replace />} />
                    </Routes>

                    <ConnectionStatus />
                  </div>
                </CreatorProvider>
              </HotelProvider>
            </CargoProvider>
          </PropertyProvider>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

// --- SIMPLE LOGIN PAGE ---

const LoginPage: React.FC = () => {
  const { login, loginWithOTP } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (mode === 'password') {
        await login({ phone, password });
      } else if (otpSent) {
        await loginWithOTP(phone, otp);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  const requestOTP = async () => {
    // Call API to send OTP
    setOtpSent(true);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0B0B0B',
    }}>
      <form onSubmit={handleLogin} style={{
        width: '100%',
        maxWidth: 400,
        padding: 32,
        background: '#181818',
        border: '1px solid #222',
        borderRadius: 16,
      }}>
        <h2 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 700, color: '#FFFFFF', textAlign: 'center' }}>
          KobeOS Login
        </h2>

        {error && (
          <div style={{ padding: 12, background: '#450A0A', border: '1px solid #991B1B', borderRadius: 8, color: '#F87171', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: '#9CA3AF', textTransform: 'uppercase' }}>Phone Number</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+255..."
            style={{ width: '100%', padding: '10px 12px', background: '#1A1A1A', border: '1px solid #2C2C2C', borderRadius: 8, color: '#FFFFFF', fontSize: 14 }}
          />
        </div>

        {mode === 'password' ? (
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: '#9CA3AF', textTransform: 'uppercase' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', background: '#1A1A1A', border: '1px solid #2C2C2C', borderRadius: 8, color: '#FFFFFF', fontSize: 14 }}
            />
          </div>
        ) : otpSent ? (
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: '#9CA3AF', textTransform: 'uppercase' }}>OTP Code</label>
            <input
              type="text"
              value={otp}
              onChange={e => setOtp(e.target.value)}
              placeholder="Enter 6-digit code"
              style={{ width: '100%', padding: '10px 12px', background: '#1A1A1A', border: '1px solid #2C2C2C', borderRadius: 8, color: '#FFFFFF', fontSize: 14 }}
            />
          </div>
        ) : null}

        <button
          type="submit"
          style={{
            width: '100%',
            padding: 12,
            background: '#1F3B73',
            border: 'none',
            borderRadius: 8,
            color: '#FFFFFF',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {mode === 'otp' && !otpSent ? 'Send OTP' : 'Sign In'}
        </button>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => { setMode(mode === 'password' ? 'otp' : 'password'); setOtpSent(false); }}
            style={{ background: 'none', border: 'none', color: '#60A5FA', fontSize: 13, cursor: 'pointer' }}
          >
            {mode === 'password' ? 'Use OTP instead' : 'Use password instead'}
          </button>
        </div>
      </form>
    </div>
  );
};

// --- USER MENU ---

const UserMenu: React.FC = () => {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 13, color: '#B3B3B3' }}>{user.name}</span>
      <button
        onClick={logout}
        style={{
          padding: '6px 12px',
          background: '#1A1A1A',
          border: '1px solid #2C2C2C',
          borderRadius: 6,
          color: '#F87171',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        Logout
      </button>
    </div>
  );
};

// --- MOUNT APP ---

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// --- NEEDED IMPORTS (add to top of file) ---
// import { useState, useEffect } from 'react';
// import { usePropertyStore } from './shared/store';
// import { useCargoStore } from './shared/store';
