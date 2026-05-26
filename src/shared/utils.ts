// ============================================================================
// KOBEOS SHARED UTILITIES
// ============================================================================

export const formatCurrency = (amount: number, currency: string = 'TZS'): string => {
  if (currency === 'TZS') {
    return `TZS ${amount.toLocaleString('en-TZ')}`;
  }
  if (currency === 'USD') {
    return `$${amount.toLocaleString('en-US')}`;
  }
  return `${currency} ${amount.toLocaleString()}`;
};

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const formatDateTime = (dateStr: string): string => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const formatRelativeTime = (dateStr: string): string => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
};

export const generateId = (prefix: string = ''): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

export const generateShipmentRef = (): string => {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `SHP-${year}-${random}`;
};

export const generateQRData = (shipmentId: string, baseUrl: string = 'https://cargo.kobe/track'): string => {
  return `${baseUrl}/${shipmentId}`;
};

export const getStatusColor = (status: string): { bg: string; text: string; border: string } => {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    'active': { bg: '#0A3D1F', text: '#4ADE80', border: '#166534' },
    'overdue': { bg: '#450A0A', text: '#F87171', border: '#991B1B' },
    'fully-paid': { bg: '#0A3D1F', text: '#4ADE80', border: '#166534' },
    'pending': { bg: '#422006', text: '#FACC15', border: '#854D0E' },
    'inactive': { bg: '#1F1F1F', text: '#9CA3AF', border: '#374151' },
    'available': { bg: '#0A3D1F', text: '#4ADE80', border: '#166534' },
    'occupied': { bg: '#1E3A5F', text: '#60A5FA', border: '#1D4ED8' },
    'completed': { bg: '#0A3D1F', text: '#4ADE80', border: '#166534' },
    'cancelled': { bg: '#450A0A', text: '#F87171', border: '#991B1B' },
    'paid': { bg: '#0A3D1F', text: '#4ADE80', border: '#166534' },
    'unpaid': { bg: '#450A0A', text: '#F87171', border: '#991B1B' },
    'partial': { bg: '#422006', text: '#FACC15', border: '#854D0E' },
    'created': { bg: '#1E3A5F', text: '#60A5FA', border: '#1D4ED8' },
    'in-transit': { bg: '#422006', text: '#FACC15', border: '#854D0E' },
    'delivered': { bg: '#0A3D1F', text: '#4ADE80', border: '#166534' },
    'preparing': { bg: '#422006', text: '#FACC15', border: '#854D0E' },
    'ready': { bg: '#0A3D1F', text: '#4ADE80', border: '#166534' },
    'served': { bg: '#1E3A5F', text: '#60A5FA', border: '#1D4ED8' },
    'new': { bg: '#1E3A5F', text: '#60A5FA', border: '#1D4ED8' },
    'open': { bg: '#0A3D1F', text: '#4ADE80', border: '#166534' },
    'in-progress': { bg: '#422006', text: '#FACC15', border: '#854D0E' },
    'draft': { bg: '#1F1F1F', text: '#9CA3AF', border: '#374151' },
    'warehouse-received': { bg: '#0A3D1F', text: '#4ADE80', border: '#166534' },
    'export-customs': { bg: '#422006', text: '#FACC15', border: '#854D0E' },
    'import-customs': { bg: '#422006', text: '#FACC15', border: '#854D0E' },
    'local-warehouse': { bg: '#1E3A5F', text: '#60A5FA', border: '#1D4ED8' },
    'out-for-delivery': { bg: '#422006', text: '#FACC15', border: '#854D0E' },
  };
  return map[status] || { bg: '#1F1F1F', text: '#9CA3AF', border: '#374151' };
};

export const getShipmentStageLabel = (stage: string): string => {
  const map: Record<string, string> = {
    'created': 'Created',
    'supplier-paid': 'Supplier Paid',
    'warehouse-received': 'Warehouse Received',
    'export-customs': 'Export Customs',
    'in-transit': 'In Transit',
    'import-customs': 'Import Customs',
    'local-warehouse': 'Local Warehouse',
    'out-for-delivery': 'Out For Delivery',
    'delivered': 'Delivered',
  };
  return map[stage] || stage;
};

export const debounce = <T extends (...args: unknown[]) => void>(fn: T, delay: number) => {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

export const classNames = (...classes: (string | boolean | undefined)[]): string => {
  return classes.filter(Boolean).join(' ');
};
