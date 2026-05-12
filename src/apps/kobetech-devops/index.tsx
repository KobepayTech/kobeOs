import { useState, useMemo } from 'react';
import {
  Code2, LayoutDashboard, Package, GitCommit, ToggleLeft, Rocket, Bug, BookOpen, Settings,
  Plus, Search, CheckCircle2, Clock, XCircle, Edit, Trash2, ChevronRight, Copy, Check,
  BadgeCheck, AlertTriangle, HardDrive, Wifi, RefreshCw,
  GitBranch, GitMerge, Play, Pause, RotateCcw, Terminal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────
type ModuleName = 'dashboard' | 'modules' | 'commits' | 'featureFlags' | 'deployments' | 'issues' | 'apiDocs' | 'settings';

interface DevModule {
  id: string;
  name: string;
  description: string;
  version: string;
  commits: number;
  lastDeployed: string;
  status: 'Production' | 'Staging' | 'Dev';
  developers: string[];
  icon: string;
  files: string[];
  envVars: { key: string; value: string; env: string }[];
}

interface Commit {
  id: string;
  message: string;
  author: string;
  module: string;
  branch: string;
  status: 'Merged' | 'Open' | 'Pending';
  date: string;
}

interface FeatureFlag {
  id: string;
  name: string;
  module: string;
  description: string;
  status: 'Enabled' | 'Disabled';
  companiesAffected: number;
  createdBy: string;
  rolloutPercent: number;
}

interface Deployment {
  id: string;
  module: string;
  environment: 'Dev' | 'Staging' | 'Production';
  status: 'Deployed' | 'Deploying' | 'Failed' | 'Pending';
  timestamp: string;
  duration: string;
}

interface Issue {
  id: string;
  title: string;
  module: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  assignee: string;
  created: string;
  comments: { author: string; text: string; date: string }[];
}

interface ApiEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  module: string;
  params: string;
  response: string;
}

// ─── Mock Data: Modules ───────────────────────────────────────────────────────
const MODULES: DevModule[] = [
  { id: 'mod-1', name: 'KOBECARGO', description: 'Core cargo logistics platform', version: '3.2.1', commits: 312, lastDeployed: '2024-01-15 14:30', status: 'Production', developers: ['John Doe', 'Rajab M'], icon: 'Cpu', files: ['CargoService.ts', 'RouteOptimizer.ts', 'ShipmentCtrl.ts', 'TrackingService.ts'], envVars: [{ key: 'CARGO_API_URL', value: 'https://cargo.kobe.io/v3', env: 'prod' }, { key: 'REDIS_CACHE_TTL', value: '3600', env: 'prod' }] },
  { id: 'mod-2', name: 'KobePay', description: 'Payment processing and wallet system', version: '2.8.0', commits: 278, lastDeployed: '2024-01-14 09:15', status: 'Production', developers: ['Jane Smith', 'Amina H'], icon: 'Wifi', files: ['PaymentGateway.ts', 'WalletService.ts', 'TransactionCtrl.ts'], envVars: [{ key: 'PAYMENT_PROVIDER', value: 'stripe', env: 'prod' }, { key: 'WALLET_MAX_BALANCE', value: '1000000', env: 'prod' }] },
  { id: 'mod-3', name: 'KobeHotel', description: 'Hotel booking and management', version: '1.9.2', commits: 156, lastDeployed: '2024-01-12 16:45', status: 'Production', developers: ['Peter K', 'Amina H'], icon: 'HardDrive', files: ['BookingService.ts', 'RoomCtrl.ts', 'AvailabilityChecker.ts'], envVars: [{ key: 'BOOKING_TIMEOUT', value: '900', env: 'prod' }, { key: 'MAX_ROOMS_PER_BOOKING', value: '5', env: 'prod' }] },
  { id: 'mod-4', name: 'KobePrint', description: 'Print service management', version: '1.4.0', commits: 89, lastDeployed: '2024-01-10 11:20', status: 'Staging', developers: ['Rajab M'], icon: 'Activity', files: ['PrintQueue.ts', 'PrinterCtrl.ts', 'JobScheduler.ts'], envVars: [{ key: 'PRINT_MAX_JOBS', value: '100', env: 'staging' }, { key: 'PRINTER_POLL_INTERVAL', value: '30', env: 'staging' }] },
  { id: 'mod-5', name: 'Creator', description: 'Content creation tools', version: '2.1.0', commits: 134, lastDeployed: '2024-01-08 08:00', status: 'Production', developers: ['Jane Smith', 'Peter K'], icon: 'Cpu', files: ['Editor.tsx', 'MediaUpload.ts', 'TemplateEngine.ts'], envVars: [{ key: 'MEDIA_MAX_SIZE', value: '50MB', env: 'prod' }, { key: 'EDITOR_PLUGINS', value: 'all', env: 'prod' }] },
  { id: 'mod-6', name: 'ERP Dashboard', description: 'ERP analytics dashboard', version: '4.0.1', commits: 245, lastDeployed: '2024-01-15 12:00', status: 'Production', developers: ['John Doe', 'Jane Smith'], icon: 'LayoutDashboard', files: ['Dashboard.tsx', 'ChartRenderer.tsx', 'ReportBuilder.ts'], envVars: [{ key: 'DASHBOARD_CACHE', value: 'enabled', env: 'prod' }, { key: 'REPORT_TIMEOUT', value: '30000', env: 'prod' }] },
  { id: 'mod-7', name: 'ERP POS', description: 'Point of sale system', version: '3.5.0', commits: 198, lastDeployed: '2024-01-13 10:30', status: 'Production', developers: ['Amina H', 'Rajab M'], icon: 'Wifi', files: ['POSTerminal.tsx', 'ReceiptPrinter.ts', 'CashRegister.ts'], envVars: [{ key: 'POS_PRINTER_DRIVER', value: 'epson', env: 'prod' }, { key: 'OFFLINE_MODE', value: 'true', env: 'prod' }] },
  { id: 'mod-8', name: 'ERP Shop', description: 'E-commerce shop module', version: '2.3.0', commits: 167, lastDeployed: '2024-01-11 15:45', status: 'Staging', developers: ['Peter K', 'John Doe'], icon: 'HardDrive', files: ['ShopFront.tsx', 'CartService.ts', 'CheckoutCtrl.ts'], envVars: [{ key: 'SHOP_CURRENCY', value: 'USD', env: 'staging' }, { key: 'TAX_RATE', value: '0.16', env: 'staging' }] },
  { id: 'mod-9', name: 'Property', description: 'Property management system', version: '1.7.0', commits: 112, lastDeployed: '2024-01-09 13:20', status: 'Dev', developers: ['Jane Smith'], icon: 'Activity', files: ['PropertyCtrl.ts', 'TenantService.ts', 'LeaseManager.ts'], envVars: [{ key: 'LEASE_DEFAULT_TERM', value: '12', env: 'dev' }, { key: 'PROPERTY_MAX_IMAGES', value: '20', env: 'dev' }] },
  { id: 'mod-10', name: 'Cargo TZ', description: 'Tanzania cargo operations', version: '2.0.0', commits: 78, lastDeployed: '2024-01-14 17:00', status: 'Production', developers: ['Rajab M', 'Peter K'], icon: 'Cpu', files: ['TZRouteCtrl.ts', 'CustomsService.ts', 'LocalPartner.ts'], envVars: [{ key: 'TZ_CUSTOMS_API', value: 'https://customs.tz.go', env: 'prod' }, { key: 'LOCAL_PARTNER_ID', value: 'TZ-001', env: 'prod' }] },
  { id: 'mod-11', name: 'Cargo Sender', description: 'Sender portal for cargo', version: '1.5.0', commits: 95, lastDeployed: '2024-01-12 09:45', status: 'Staging', developers: ['Amina H'], icon: 'Wifi', files: ['SenderDashboard.tsx', 'QuoteService.ts', 'PickupScheduler.ts'], envVars: [{ key: 'QUOTE_EXPIRY_HOURS', value: '48', env: 'staging' }, { key: 'PICKUP_WINDOW_HOURS', value: '24', env: 'staging' }] },
  { id: 'mod-12', name: 'Cargo Driver', description: 'Driver mobile app backend', version: '1.8.0', commits: 143, lastDeployed: '2024-01-13 14:15', status: 'Production', developers: ['John Doe', 'Rajab M'], icon: 'HardDrive', files: ['DriverLocation.ts', 'TripService.ts', 'DeliveryProof.ts'], envVars: [{ key: 'LOCATION_UPDATE_INTERVAL', value: '10', env: 'prod' }, { key: 'DELIVERY_PHOTO_REQUIRED', value: 'true', env: 'prod' }] },
  { id: 'mod-13', name: 'Cargo Owner', description: 'Cargo owner management', version: '1.3.0', commits: 67, lastDeployed: '2024-01-10 16:30', status: 'Dev', developers: ['Peter K'], icon: 'Activity', files: ['OwnerPortal.tsx', 'CargoRegistry.ts', 'InvoiceService.ts'], envVars: [{ key: 'INVOICE_DUE_DAYS', value: '30', env: 'dev' }, { key: 'OWNER_NOTIFICATIONS', value: 'email,sms', env: 'dev' }] },
  { id: 'mod-14', name: 'Games Bundle', description: 'Gaming and entertainment', version: '0.9.0', commits: 45, lastDeployed: '2024-01-08 10:00', status: 'Dev', developers: ['Amina H', 'Jane Smith'], icon: 'Cpu', files: ['GameEngine.ts', 'Leaderboard.ts', 'RewardService.ts'], envVars: [{ key: 'GAME_MAX_SESSION', value: '3600', env: 'dev' }, { key: 'REWARD_MULTIPLIER', value: '1.5', env: 'dev' }] },
  { id: 'mod-15', name: 'OS Shell', description: 'Core operating shell', version: '5.0.0', commits: 389, lastDeployed: '2024-01-15 08:00', status: 'Production', developers: ['John Doe', 'Rajab M', 'Peter K'], icon: 'Terminal', files: ['Kernel.ts', 'ProcessManager.ts', 'SecurityLayer.ts', 'EventBus.ts'], envVars: [{ key: 'SHELL_LOG_LEVEL', value: 'info', env: 'prod' }, { key: 'SECURITY_POLICY', value: 'strict', env: 'prod' }] },
];

// ─── Mock Data: Commits ───────────────────────────────────────────────────────
const COMMITS: Commit[] = [
  { id: 'C-1029', message: 'feat: add wallet system', author: 'John Doe', module: 'KobePay', branch: 'main', status: 'Merged', date: '2024-01-15 14:30' },
  { id: 'C-1028', message: 'fix: sidebar scroll issue', author: 'Jane Smith', module: 'ERP Dashboard', branch: 'main', status: 'Merged', date: '2024-01-15 12:15' },
  { id: 'C-1027', message: 'refactor: payment flow optimization', author: 'Rajab M', module: 'KobePay', branch: 'develop', status: 'Open', date: '2024-01-15 10:45' },
  { id: 'C-1026', message: 'feat: route optimizer v2', author: 'Peter K', module: 'KOBECARGO', branch: 'feature/routes', status: 'Open', date: '2024-01-15 09:30' },
  { id: 'C-1025', message: 'fix: hotel booking race condition', author: 'Amina H', module: 'KobeHotel', branch: 'main', status: 'Merged', date: '2024-01-14 16:20' },
  { id: 'C-1024', message: 'chore: update dependencies', author: 'John Doe', module: 'OS Shell', branch: 'main', status: 'Merged', date: '2024-01-14 14:00' },
  { id: 'C-1023', message: 'feat: AI cargo price estimator', author: 'Rajab M', module: 'Cargo TZ', branch: 'feature/ai-pricing', status: 'Pending', date: '2024-01-14 11:30' },
  { id: 'C-1022', message: 'fix: POS receipt printer timeout', author: 'Amina H', module: 'ERP POS', branch: 'main', status: 'Merged', date: '2024-01-14 09:15' },
  { id: 'C-1021', message: 'feat: escrow payment integration', author: 'Jane Smith', module: 'KobePay', branch: 'feature/escrow', status: 'Open', date: '2024-01-13 17:45' },
  { id: 'C-1020', message: 'refactor: dashboard chart components', author: 'Peter K', module: 'ERP Dashboard', branch: 'develop', status: 'Open', date: '2024-01-13 15:30' },
  { id: 'C-1019', message: 'feat: driver location tracking', author: 'John Doe', module: 'Cargo Driver', branch: 'main', status: 'Merged', date: '2024-01-13 13:00' },
  { id: 'C-1018', message: 'fix: memory leak in game engine', author: 'Amina H', module: 'Games Bundle', branch: 'fix/memory', status: 'Pending', date: '2024-01-13 10:20' },
  { id: 'C-1017', message: 'feat: property lease templates', author: 'Jane Smith', module: 'Property', branch: 'feature/leases', status: 'Open', date: '2024-01-12 16:00' },
  { id: 'C-1016', message: 'chore: CI/CD pipeline update', author: 'Rajab M', module: 'OS Shell', branch: 'main', status: 'Merged', date: '2024-01-12 14:30' },
  { id: 'C-1015', message: 'feat: QR code ordering', author: 'Peter K', module: 'ERP Shop', branch: 'feature/qr-order', status: 'Open', date: '2024-01-12 11:45' },
  { id: 'C-1014', message: 'fix: cargo customs form validation', author: 'Rajab M', module: 'Cargo TZ', branch: 'main', status: 'Merged', date: '2024-01-12 09:00' },
  { id: 'C-1013', message: 'feat: sender quote calculator', author: 'Amina H', module: 'Cargo Sender', branch: 'main', status: 'Merged', date: '2024-01-11 15:30' },
  { id: 'C-1012', message: 'refactor: security layer hardening', author: 'John Doe', module: 'OS Shell', branch: 'main', status: 'Merged', date: '2024-01-11 13:00' },
  { id: 'C-1011', message: 'feat: print job batching', author: 'Peter K', module: 'KobePrint', branch: 'feature/batch', status: 'Pending', date: '2024-01-11 10:45' },
  { id: 'C-1010', message: 'fix: owner invoice generation', author: 'Jane Smith', module: 'Cargo Owner', branch: 'fix/invoices', status: 'Open', date: '2024-01-10 16:20' },
  { id: 'C-1009', message: 'feat: happy hour pricing', author: 'Amina H', module: 'ERP POS', branch: 'feature/happy-hour', status: 'Open', date: '2024-01-10 14:00' },
  { id: 'C-1008', message: 'chore: database migration v5', author: 'Rajab M', module: 'KOBECARGO', branch: 'main', status: 'Merged', date: '2024-01-10 11:30' },
  { id: 'C-1007', message: 'feat: media upload CDN', author: 'Peter K', module: 'Creator', branch: 'feature/cdn', status: 'Open', date: '2024-01-10 09:15' },
  { id: 'C-1006', message: 'fix: shop cart persistence', author: 'Jane Smith', module: 'ERP Shop', branch: 'main', status: 'Merged', date: '2024-01-09 17:00' },
  { id: 'C-1005', message: 'feat: tenant portal auth', author: 'John Doe', module: 'Property', branch: 'feature/auth', status: 'Pending', date: '2024-01-09 14:30' },
  { id: 'C-1004', message: 'refactor: event bus optimization', author: 'Rajab M', module: 'OS Shell', branch: 'main', status: 'Merged', date: '2024-01-09 12:00' },
  { id: 'C-1003', message: 'feat: delivery proof photos', author: 'Amina H', module: 'Cargo Driver', branch: 'main', status: 'Merged', date: '2024-01-09 09:45' },
  { id: 'C-1002', message: 'fix: leaderboard score sort', author: 'Peter K', module: 'Games Bundle', branch: 'fix/leaderboard', status: 'Open', date: '2024-01-08 16:30' },
  { id: 'C-1001', message: 'feat: cargo owner notifications', author: 'Jane Smith', module: 'Cargo Owner', branch: 'main', status: 'Merged', date: '2024-01-08 14:00' },
  { id: 'C-1000', message: 'chore: initial release setup', author: 'John Doe', module: 'OS Shell', branch: 'main', status: 'Merged', date: '2024-01-08 10:00' },
];

// ─── Mock Data: Feature Flags ─────────────────────────────────────────────────
const FEATURE_FLAGS: FeatureFlag[] = [
  { id: 'ff-1', name: 'wallet-system', module: 'KobePay', description: 'Digital wallet for cargo payments', status: 'Enabled', companiesAffected: 42, createdBy: 'John Doe', rolloutPercent: 100 },
  { id: 'ff-2', name: 'price-negotiation', module: 'KOBECARGO', description: 'Allow price negotiation on shipments', status: 'Enabled', companiesAffected: 28, createdBy: 'Rajab M', rolloutPercent: 75 },
  { id: 'ff-3', name: 'happy-hour', module: 'ERP POS', description: 'Discounted pricing during happy hours', status: 'Enabled', companiesAffected: 15, createdBy: 'Amina H', rolloutPercent: 100 },
  { id: 'ff-4', name: 'ai-generator', module: 'Creator', description: 'AI-powered content generation', status: 'Disabled', companiesAffected: 0, createdBy: 'Jane Smith', rolloutPercent: 0 },
  { id: 'ff-5', name: 'qr-ordering', module: 'ERP Shop', description: 'QR code-based table ordering', status: 'Enabled', companiesAffected: 22, createdBy: 'Peter K', rolloutPercent: 60 },
  { id: 'ff-6', name: 'escrow-payments', module: 'KobePay', description: 'Escrow-based payment protection', status: 'Enabled', companiesAffected: 18, createdBy: 'Jane Smith', rolloutPercent: 45 },
  { id: 'ff-7', name: 'route-optimizer-v2', module: 'KOBECARGO', description: 'Next-gen route optimization', status: 'Enabled', companiesAffected: 35, createdBy: 'Peter K', rolloutPercent: 80 },
  { id: 'ff-8', name: 'dark-mode', module: 'ERP Dashboard', description: 'Dark theme for dashboard', status: 'Enabled', companiesAffected: 50, createdBy: 'John Doe', rolloutPercent: 100 },
  { id: 'ff-9', name: 'offline-mode', module: 'ERP POS', description: 'Offline transaction support', status: 'Enabled', companiesAffected: 12, createdBy: 'Amina H', rolloutPercent: 30 },
  { id: 'ff-10', name: 'multi-currency', module: 'KobePay', description: 'Support for multiple currencies', status: 'Disabled', companiesAffected: 0, createdBy: 'Rajab M', rolloutPercent: 0 },
  { id: 'ff-11', name: 'real-time-tracking', module: 'Cargo Driver', description: 'Live shipment tracking map', status: 'Enabled', companiesAffected: 40, createdBy: 'John Doe', rolloutPercent: 100 },
  { id: 'ff-12', name: 'auto-invoice', module: 'Cargo Owner', description: 'Automatic invoice generation', status: 'Enabled', companiesAffected: 25, createdBy: 'Jane Smith', rolloutPercent: 70 },
  { id: 'ff-13', name: 'batch-printing', module: 'KobePrint', description: 'Batch print job processing', status: 'Disabled', companiesAffected: 0, createdBy: 'Peter K', rolloutPercent: 0 },
  { id: 'ff-14', name: 'custom-reports', module: 'ERP Dashboard', description: 'Custom report builder', status: 'Enabled', companiesAffected: 20, createdBy: 'Amina H', rolloutPercent: 55 },
  { id: 'ff-15', name: 'tenant-messaging', module: 'Property', description: 'In-app tenant messaging', status: 'Enabled', companiesAffected: 10, createdBy: 'Jane Smith', rolloutPercent: 40 },
  { id: 'ff-16', name: 'leaderboard-v2', module: 'Games Bundle', description: 'New leaderboard system', status: 'Disabled', companiesAffected: 0, createdBy: 'Peter K', rolloutPercent: 0 },
  { id: 'ff-17', name: 'customs-integration', module: 'Cargo TZ', description: 'Tanzania customs API integration', status: 'Enabled', companiesAffected: 8, createdBy: 'Rajab M', rolloutPercent: 100 },
  { id: 'ff-18', name: 'pickup-scheduler', module: 'Cargo Sender', description: 'Self-service pickup scheduling', status: 'Enabled', companiesAffected: 16, createdBy: 'Amina H', rolloutPercent: 65 },
  { id: 'ff-19', name: 'media-cdn', module: 'Creator', description: 'CDN-based media delivery', status: 'Enabled', companiesAffected: 30, createdBy: 'Peter K', rolloutPercent: 90 },
  { id: 'ff-20', name: 'security-audit', module: 'OS Shell', description: 'Enhanced security audit logging', status: 'Enabled', companiesAffected: 50, createdBy: 'John Doe', rolloutPercent: 100 },
];

// ─── Mock Data: Deployments ───────────────────────────────────────────────────
const DEPLOYMENTS: Deployment[] = [
  { id: 'd-1', module: 'KOBECARGO', environment: 'Production', status: 'Deployed', timestamp: '2024-01-15 14:30', duration: '4m 12s' },
  { id: 'd-2', module: 'KobePay', environment: 'Production', status: 'Deployed', timestamp: '2024-01-14 09:15', duration: '3m 45s' },
  { id: 'd-3', module: 'KobeHotel', environment: 'Production', status: 'Deployed', timestamp: '2024-01-12 16:45', duration: '5m 20s' },
  { id: 'd-4', module: 'KobePrint', environment: 'Staging', status: 'Deploying', timestamp: '2024-01-15 10:00', duration: '2m 10s' },
  { id: 'd-5', module: 'Creator', environment: 'Production', status: 'Deployed', timestamp: '2024-01-08 08:00', duration: '3m 30s' },
  { id: 'd-6', module: 'ERP Dashboard', environment: 'Production', status: 'Deployed', timestamp: '2024-01-15 12:00', duration: '4m 00s' },
  { id: 'd-7', module: 'ERP POS', environment: 'Production', status: 'Deployed', timestamp: '2024-01-13 10:30', duration: '3m 15s' },
  { id: 'd-8', module: 'ERP Shop', environment: 'Staging', status: 'Failed', timestamp: '2024-01-15 09:30', duration: '1m 45s' },
  { id: 'd-9', module: 'Property', environment: 'Dev', status: 'Deployed', timestamp: '2024-01-09 13:20', duration: '2m 50s' },
  { id: 'd-10', module: 'Cargo TZ', environment: 'Production', status: 'Deployed', timestamp: '2024-01-14 17:00', duration: '6m 30s' },
  { id: 'd-11', module: 'Cargo Sender', environment: 'Staging', status: 'Pending', timestamp: '2024-01-15 11:00', duration: '--' },
  { id: 'd-12', module: 'Cargo Driver', environment: 'Production', status: 'Deployed', timestamp: '2024-01-13 14:15', duration: '3m 40s' },
  { id: 'd-13', module: 'Cargo Owner', environment: 'Dev', status: 'Deployed', timestamp: '2024-01-10 16:30', duration: '2m 20s' },
  { id: 'd-14', module: 'Games Bundle', environment: 'Dev', status: 'Failed', timestamp: '2024-01-08 10:00', duration: '1m 10s' },
  { id: 'd-15', module: 'OS Shell', environment: 'Production', status: 'Deployed', timestamp: '2024-01-15 08:00', duration: '7m 15s' },
  { id: 'd-16', module: 'ERP Shop', environment: 'Dev', status: 'Deployed', timestamp: '2024-01-14 11:30', duration: '2m 45s' },
  { id: 'd-17', module: 'KobePrint', environment: 'Dev', status: 'Deployed', timestamp: '2024-01-12 09:00', duration: '2m 00s' },
  { id: 'd-18', module: 'Cargo Sender', environment: 'Dev', status: 'Deployed', timestamp: '2024-01-11 10:00', duration: '2m 30s' },
  { id: 'd-19', module: 'Property', environment: 'Staging', status: 'Deploying', timestamp: '2024-01-15 13:00', duration: '3m 00s' },
  { id: 'd-20', module: 'Games Bundle', environment: 'Staging', status: 'Pending', timestamp: '2024-01-15 15:00', duration: '--' },
];

// ─── Mock Data: Issues ────────────────────────────────────────────────────────
const ISSUES: Issue[] = [
  { id: 'ISS-42', title: 'Wallet balance incorrect after refund', module: 'KobePay', priority: 'Critical', status: 'Open', assignee: 'Jane Smith', created: '2024-01-15 10:00', comments: [{ author: 'John Doe', text: 'Checking transaction logs', date: '2024-01-15 10:30' }, { author: 'Jane Smith', text: 'Found the race condition', date: '2024-01-15 11:00' }] },
  { id: 'ISS-41', title: 'Cargo route calculation timeout', module: 'KOBECARGO', priority: 'High', status: 'In Progress', assignee: 'Peter K', created: '2024-01-14 16:00', comments: [{ author: 'Rajab M', text: 'Large shipment sets trigger this', date: '2024-01-14 16:30' }] },
  { id: 'ISS-40', title: 'POS printer not responding', module: 'ERP POS', priority: 'High', status: 'Open', assignee: 'Amina H', created: '2024-01-14 14:00', comments: [] },
  { id: 'ISS-39', title: 'Hotel room availability sync delay', module: 'KobeHotel', priority: 'Medium', status: 'In Progress', assignee: 'Amina H', created: '2024-01-14 12:00', comments: [{ author: 'Peter K', text: 'Cache invalidation issue', date: '2024-01-14 13:00' }] },
  { id: 'ISS-38', title: 'Dashboard charts not loading on Safari', module: 'ERP Dashboard', priority: 'Medium', status: 'Open', assignee: 'John Doe', created: '2024-01-14 10:00', comments: [] },
  { id: 'ISS-37', title: 'Driver location updates stale', module: 'Cargo Driver', priority: 'High', status: 'Resolved', assignee: 'John Doe', created: '2024-01-13 18:00', comments: [{ author: 'Rajab M', text: 'Redis TTL too short', date: '2024-01-13 18:30' }, { author: 'John Doe', text: 'Fixed in C-1019', date: '2024-01-13 19:00' }] },
  { id: 'ISS-36', title: 'Shop cart loses items on refresh', module: 'ERP Shop', priority: 'Medium', status: 'Resolved', assignee: 'Jane Smith', created: '2024-01-13 15:00', comments: [] },
  { id: 'ISS-35', title: 'Game engine memory leak', module: 'Games Bundle', priority: 'High', status: 'In Progress', assignee: 'Amina H', created: '2024-01-13 12:00', comments: [{ author: 'Peter K', text: 'Related to C-1018', date: '2024-01-13 12:30' }] },
  { id: 'ISS-34', title: 'Property lease document upload fails', module: 'Property', priority: 'Low', status: 'Open', assignee: 'Jane Smith', created: '2024-01-13 10:00', comments: [] },
  { id: 'ISS-33', title: 'TZ customs API rate limiting', module: 'Cargo TZ', priority: 'High', status: 'Open', assignee: 'Rajab M', created: '2024-01-12 16:00', comments: [{ author: 'Peter K', text: 'Need exponential backoff', date: '2024-01-12 16:30' }] },
  { id: 'ISS-32', title: 'Sender quote email not sending', module: 'Cargo Sender', priority: 'Medium', status: 'Resolved', assignee: 'Amina H', created: '2024-01-12 14:00', comments: [] },
  { id: 'ISS-31', title: 'Owner invoice PDF generation error', module: 'Cargo Owner', priority: 'Medium', status: 'Open', assignee: 'Peter K', created: '2024-01-12 12:00', comments: [] },
  { id: 'ISS-30', title: 'Print queue stuck on large jobs', module: 'KobePrint', priority: 'Low', status: 'In Progress', assignee: 'Rajab M', created: '2024-01-12 10:00', comments: [] },
  { id: 'ISS-29', title: 'Creator media upload size limit', module: 'Creator', priority: 'Medium', status: 'Closed', assignee: 'Peter K', created: '2024-01-11 18:00', comments: [{ author: 'Jane Smith', text: 'Increased to 50MB', date: '2024-01-11 18:30' }] },
  { id: 'ISS-28', title: 'Shell security audit log rotation', module: 'OS Shell', priority: 'Low', status: 'Open', assignee: 'John Doe', created: '2024-01-11 16:00', comments: [] },
  { id: 'ISS-27', title: 'Hotel booking double-charge bug', module: 'KobeHotel', priority: 'Critical', status: 'Resolved', assignee: 'Amina H', created: '2024-01-11 14:00', comments: [{ author: 'Jane Smith', text: 'Refunded affected customers', date: '2024-01-11 15:00' }] },
  { id: 'ISS-26', title: 'Cargo tracking page 500 error', module: 'KOBECARGO', priority: 'High', status: 'Closed', assignee: 'Rajab M', created: '2024-01-11 12:00', comments: [] },
  { id: 'ISS-25', title: 'Wallet transaction history pagination', module: 'KobePay', priority: 'Low', status: 'Open', assignee: 'Jane Smith', created: '2024-01-11 10:00', comments: [] },
  { id: 'ISS-24', title: 'POS offline sync conflict', module: 'ERP POS', priority: 'Medium', status: 'In Progress', assignee: 'Amina H', created: '2024-01-10 16:00', comments: [] },
  { id: 'ISS-23', title: 'Creator template preview broken', module: 'Creator', priority: 'Low', status: 'Open', assignee: 'Peter K', created: '2024-01-10 14:00', comments: [] },
];

// ─── Mock Data: API Endpoints ─────────────────────────────────────────────────
const API_ENDPOINTS: ApiEndpoint[] = [
  { id: 'api-1', method: 'GET', path: '/api/companies', description: 'List all companies', module: 'OS Shell', params: 'page, limit, search', response: '{ "companies": [...], "total": 150 }' },
  { id: 'api-2', method: 'POST', path: '/api/companies', description: 'Create a new company', module: 'OS Shell', params: 'name, email, phone', response: '{ "id": "comp-123", "status": "created" }' },
  { id: 'api-3', method: 'GET', path: '/api/companies/:id', description: 'Get company details', module: 'OS Shell', params: 'id (path)', response: '{ "id": "comp-123", "name": "Acme Corp" }' },
  { id: 'api-4', method: 'POST', path: '/api/deposits', description: 'Create a deposit', module: 'KobePay', params: 'companyId, amount, currency', response: '{ "depositId": "dep-456", "status": "pending" }' },
  { id: 'api-5', method: 'GET', path: '/api/deposits', description: 'List deposits', module: 'KobePay', params: 'companyId, status, from, to', response: '{ "deposits": [...], "total": 45 }' },
  { id: 'api-6', method: 'PUT', path: '/api/deposits/:id', description: 'Update deposit status', module: 'KobePay', params: 'id, status', response: '{ "id": "dep-456", "status": "confirmed" }' },
  { id: 'api-7', method: 'POST', path: '/api/payouts', description: 'Create a payout', module: 'KobePay', params: 'companyId, amount, method', response: '{ "payoutId": "pay-789", "status": "processing" }' },
  { id: 'api-8', method: 'GET', path: '/api/payouts', description: 'List payouts', module: 'KobePay', params: 'companyId, status', response: '{ "payouts": [...], "total": 23 }' },
  { id: 'api-9', method: 'PUT', path: '/api/payouts/:id', description: 'Update payout', module: 'KobePay', params: 'id, status', response: '{ "id": "pay-789", "status": "completed" }' },
  { id: 'api-10', method: 'POST', path: '/api/cargo/shipments', description: 'Create shipment', module: 'KOBECARGO', params: 'origin, destination, weight, type', response: '{ "shipmentId": "ship-001", "status": "created" }' },
  { id: 'api-11', method: 'GET', path: '/api/cargo/shipments', description: 'List shipments', module: 'KOBECARGO', params: 'companyId, status, from, to', response: '{ "shipments": [...], "total": 89 }' },
  { id: 'api-12', method: 'GET', path: '/api/cargo/shipments/:id', description: 'Get shipment details', module: 'KOBECARGO', params: 'id (path)', response: '{ "shipmentId": "ship-001", "status": "in_transit" }' },
  { id: 'api-13', method: 'PUT', path: '/api/cargo/shipments/:id', description: 'Update shipment', module: 'KOBECARGO', params: 'id, status, location', response: '{ "shipmentId": "ship-001", "status": "delivered" }' },
  { id: 'api-14', method: 'DELETE', path: '/api/cargo/shipments/:id', description: 'Cancel shipment', module: 'KOBECARGO', params: 'id (path)', response: '{ "status": "cancelled" }' },
  { id: 'api-15', method: 'POST', path: '/api/cargo/routes/optimize', description: 'Optimize cargo routes', module: 'KOBECARGO', params: 'shipmentIds, constraints', response: '{ "routes": [...], "savings": "15%" }' },
  { id: 'api-16', method: 'POST', path: '/api/hotel/bookings', description: 'Create hotel booking', module: 'KobeHotel', params: 'hotelId, roomType, dates, guest', response: '{ "bookingId": "bk-123", "status": "confirmed" }' },
  { id: 'api-17', method: 'GET', path: '/api/hotel/bookings', description: 'List bookings', module: 'KobeHotel', params: 'hotelId, status, from, to', response: '{ "bookings": [...], "total": 34 }' },
  { id: 'api-18', method: 'PUT', path: '/api/hotel/bookings/:id', description: 'Update booking', module: 'KobeHotel', params: 'id, status', response: '{ "bookingId": "bk-123", "status": "checked_in" }' },
  { id: 'api-19', method: 'POST', path: '/api/pos/transactions', description: 'Create POS transaction', module: 'ERP POS', params: 'items, paymentMethod, total', response: '{ "transactionId": "txn-456", "status": "approved" }' },
  { id: 'api-20', method: 'GET', path: '/api/pos/transactions', description: 'List POS transactions', module: 'ERP POS', params: 'storeId, from, to', response: '{ "transactions": [...], "total": 156 }' },
  { id: 'api-21', method: 'GET', path: '/api/shop/products', description: 'List shop products', module: 'ERP Shop', params: 'category, search, page', response: '{ "products": [...], "total": 230 }' },
  { id: 'api-22', method: 'POST', path: '/api/shop/orders', description: 'Create shop order', module: 'ERP Shop', params: 'items, shipping, payment', response: '{ "orderId": "ord-789", "status": "placed" }' },
  { id: 'api-23', method: 'GET', path: '/api/shop/orders/:id', description: 'Get order details', module: 'ERP Shop', params: 'id (path)', response: '{ "orderId": "ord-789", "status": "shipped" }' },
  { id: 'api-24', method: 'POST', path: '/api/print/jobs', description: 'Create print job', module: 'KobePrint', params: 'document, printerId, copies', response: '{ "jobId": "job-001", "status": "queued" }' },
  { id: 'api-25', method: 'GET', path: '/api/print/jobs', description: 'List print jobs', module: 'KobePrint', params: 'status, printerId', response: '{ "jobs": [...], "total": 12 }' },
  { id: 'api-26', method: 'POST', path: '/api/driver/trips', description: 'Start driver trip', module: 'Cargo Driver', params: 'shipmentId, driverId', response: '{ "tripId": "trip-001", "status": "started" }' },
  { id: 'api-27', method: 'PUT', path: '/api/driver/trips/:id', description: 'Update trip status', module: 'Cargo Driver', params: 'id, status, location', response: '{ "tripId": "trip-001", "status": "completed" }' },
  { id: 'api-28', method: 'POST', path: '/api/creator/media', description: 'Upload media', module: 'Creator', params: 'file, type, tags', response: '{ "mediaId": "med-001", "url": "https://cdn..." }' },
  { id: 'api-29', method: 'GET', path: '/api/reports/dashboard', description: 'Get dashboard metrics', module: 'ERP Dashboard', params: 'period, modules', response: '{ "metrics": { "revenue": 150000, "orders": 420 } }' },
  { id: 'api-30', method: 'POST', path: '/api/property/leases', description: 'Create lease', module: 'Property', params: 'propertyId, tenantId, terms', response: '{ "leaseId": "lease-001", "status": "active" }' },
];

// ─── Mock Data: Charts ────────────────────────────────────────────────────────
const weeklyCommits = [
  { week: 'W1', commits: 42 }, { week: 'W2', commits: 58 }, { week: 'W3', commits: 35 },
  { week: 'W4', commits: 67 }, { week: 'W5', commits: 45 }, { week: 'W6', commits: 72 },
  { week: 'W7', commits: 53 }, { week: 'W8', commits: 89 }, { week: 'W9', commits: 64 },
  { week: 'W10', commits: 78 }, { week: 'W11', commits: 91 }, { week: 'W12', commits: 1247 },
];

const deploySuccess = [
  { month: 'Jan', rate: 92 }, { month: 'Feb', rate: 88 }, { month: 'Mar', rate: 95 },
  { month: 'Apr', rate: 90 }, { month: 'May', rate: 96 }, { month: 'Jun', rate: 94 },
  { month: 'Jul', rate: 97 }, { month: 'Aug', rate: 93 }, { month: 'Sep', rate: 98 },
  { month: 'Oct', rate: 91 }, { month: 'Nov', rate: 95 }, { month: 'Dec', rate: 96 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const statusColors: Record<string, string> = {
  Production: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  Staging: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  Dev: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  Deployed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  Deploying: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  Failed: 'bg-red-500/15 text-red-400 border-red-500/20',
  Pending: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  Enabled: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  Disabled: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
  Critical: 'bg-red-500/15 text-red-400 border-red-500/20',
  High: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  Medium: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  Low: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
  Open: 'bg-red-500/15 text-red-400 border-red-500/20',
  'In Progress': 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  Resolved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  Closed: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
  Merged: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  GET: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  POST: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  PUT: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  DELETE: 'bg-red-500/15 text-red-400 border-red-500/20',
};

const sidebarItems: { key: ModuleName; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-cyan-400' },
  { key: 'modules', label: 'Modules', icon: Package, color: 'text-blue-400' },
  { key: 'commits', label: 'Commits', icon: GitCommit, color: 'text-emerald-400' },
  { key: 'featureFlags', label: 'Feature Flags', icon: ToggleLeft, color: 'text-amber-400' },
  { key: 'deployments', label: 'Deployments', icon: Rocket, color: 'text-violet-400' },
  { key: 'issues', label: 'Issues', icon: Bug, color: 'text-pink-400' },
  { key: 'apiDocs', label: 'API Docs', icon: BookOpen, color: 'text-orange-400' },
  { key: 'settings', label: 'Settings', icon: Settings, color: 'text-slate-400' },
];

// ─── Sub-Components ───────────────────────────────────────────────────────────
function KpiCard({ title, value, icon: Icon, color }: { title: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <Card className="bg-[#13131f] border-white/[0.06] rounded-xl">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold text-white mt-1">{value}</p>
          </div>
          <div className={`p-2.5 rounded-lg bg-white/[0.04] ${color}`}>
            <Icon size={20} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={`text-[11px] font-medium border ${statusColors[status] || 'bg-slate-500/15 text-slate-400'}`}>
      {status}
    </Badge>
  );
}

// ─── Module 1: Dashboard ──────────────────────────────────────────────────────
function DashboardView({ onNavigate }: { onNavigate: (m: ModuleName) => void }) {
  const recentCommits = COMMITS.slice(0, 8);
  const activeDeployments = DEPLOYMENTS.filter(d => d.status === 'Deployed' || d.status === 'Deploying');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard title="Active Modules" value={15} icon={Package} color="text-blue-400" />
        <KpiCard title="Total Commits" value={1247} icon={GitCommit} color="text-emerald-400" />
        <KpiCard title="Open Issues" value={23} icon={Bug} color="text-pink-400" />
        <KpiCard title="Deployed" value={8} icon={CheckCircle2} color="text-emerald-400" />
        <KpiCard title="In Staging" value={4} icon={Clock} color="text-amber-400" />
        <KpiCard title="Failed" value={2} icon={XCircle} color="text-red-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-[#13131f] border-white/[0.06] rounded-xl">
          <CardContent className="p-4">
            <h3 className="text-white font-semibold text-sm mb-4">Commits Per Week</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyCommits}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="week" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip contentStyle={{ background: '#13131f', border: '1px solid #ffffff10', borderRadius: 8, color: '#fff' }} />
                <Bar dataKey="commits" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-[#13131f] border-white/[0.06] rounded-xl">
          <CardContent className="p-4">
            <h3 className="text-white font-semibold text-sm mb-4">Deployment Success Rate</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={deploySuccess}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} domain={[80, 100]} />
                <Tooltip contentStyle={{ background: '#13131f', border: '1px solid #ffffff10', borderRadius: 8, color: '#fff' }} />
                <Area type="monotone" dataKey="rate" stroke="#8b5cf6" fill="#8b5cf630" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-[#13131f] border-white/[0.06] rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-sm">Recent Commits</h3>
              <Button variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300 h-7 text-xs" onClick={() => onNavigate('commits')}>
                View All <ChevronRight size={12} className="ml-1" />
              </Button>
            </div>
            <div className="space-y-2">
              {recentCommits.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                  <GitCommit size={14} className="text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate">{c.message}</p>
                    <p className="text-slate-500 text-[10px]">{c.author} · {c.module}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#13131f] border-white/[0.06] rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-sm">Active Deployments</h3>
              <Button variant="ghost" size="sm" className="text-violet-400 hover:text-violet-300 h-7 text-xs" onClick={() => onNavigate('deployments')}>
                View All <ChevronRight size={12} className="ml-1" />
              </Button>
            </div>
            <div className="space-y-2">
              {activeDeployments.map(d => (
                <div key={d.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                  <Rocket size={14} className="text-violet-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate">{d.module}</p>
                    <p className="text-slate-500 text-[10px]">{d.environment} · {d.timestamp}</p>
                  </div>
                  <StatusBadge status={d.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Module 2: Modules ────────────────────────────────────────────────────────
function ModulesView({ onNavigate }: { onNavigate: (m: ModuleName) => void }) {
  const [selectedModule, setSelectedModule] = useState<DevModule | null>(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() =>
    MODULES.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || m.description.toLowerCase().includes(search.toLowerCase())),
    [search]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input placeholder="Search modules..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 bg-[#13131f] border-white/[0.06] text-white placeholder:text-slate-500 text-sm" />
        </div>
        <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-8"><Plus size={14} className="mr-1" />New Module</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map(mod => (
          <Card key={mod.id} className="bg-[#13131f] border-white/[0.06] rounded-xl cursor-pointer hover:border-white/[0.12] transition-all" onClick={() => setSelectedModule(mod)}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400"><Package size={18} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold text-sm truncate">{mod.name}</h3>
                    <StatusBadge status={mod.status} />
                  </div>
                  <p className="text-slate-400 text-xs mt-1 truncate">{mod.description}</p>
                  <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-500">
                    <span>v{mod.version}</span>
                    <span className="flex items-center gap-1"><GitCommit size={10} />{mod.commits}</span>
                    <span className="flex items-center gap-1"><Clock size={10} />{mod.lastDeployed}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    {mod.developers.map(d => (
                      <span key={d} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400">{d}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.04]">
                <Button size="sm" variant="ghost" className="h-6 text-[10px] text-amber-400 hover:text-amber-300 hover:bg-amber-500/10" onClick={e => { e.stopPropagation(); onNavigate('deployments'); }}>Staging</Button>
                <Button size="sm" variant="ghost" className="h-6 text-[10px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10" onClick={e => { e.stopPropagation(); onNavigate('deployments'); }}>Production</Button>
                <Button size="sm" variant="ghost" className="h-6 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={e => { e.stopPropagation(); }}>Rollback</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedModule && (
        <Dialog open={!!selectedModule} onOpenChange={() => setSelectedModule(null)}>
          <DialogContent className="bg-[#13131f] border-white/[0.06] text-white max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-white">{selectedModule.name}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-slate-400 text-sm">{selectedModule.description}</p>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>Version: <span className="text-white">{selectedModule.version}</span></span>
                <span>Commits: <span className="text-white">{selectedModule.commits}</span></span>
                <span>Last Deployed: <span className="text-white">{selectedModule.lastDeployed}</span></span>
                <StatusBadge status={selectedModule.status} />
              </div>
              <div>
                <h4 className="text-white text-sm font-semibold mb-2">Source Files</h4>
                <div className="space-y-1">
                  {selectedModule.files.map(f => (
                    <div key={f} className="flex items-center gap-2 p-2 rounded bg-white/[0.02] text-xs text-slate-300">
                      <Code2 size={12} className="text-blue-400" />{f}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-white text-sm font-semibold mb-2">Environment Variables</h4>
                <div className="space-y-1">
                  {selectedModule.envVars.map(ev => (
                    <div key={ev.key} className="flex items-center gap-2 p-2 rounded bg-white/[0.02] text-xs">
                      <span className="text-slate-400">{ev.key}</span>
                      <span className="text-white">=</span>
                      <span className="text-emerald-400">{ev.value}</span>
                      <span className="text-[10px] px-1 rounded bg-white/[0.04] text-slate-500 ml-auto">{ev.env}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-white text-sm font-semibold mb-2">Assigned Developers</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedModule.developers.map(d => (
                    <span key={d} className="text-xs px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400">{d}</span>
                  ))}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Module 3: Commits ────────────────────────────────────────────────────────
function CommitsView() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() =>
    COMMITS.filter(c => {
      const matchSearch = c.message.toLowerCase().includes(search.toLowerCase()) || c.author.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'All' || c.status === statusFilter;
      return matchSearch && matchStatus;
    }),
    [search, statusFilter]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input placeholder="Search commits..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 bg-[#13131f] border-white/[0.06] text-white placeholder:text-slate-500 text-sm" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 bg-[#13131f] border-white/[0.06] text-white text-xs"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-[#13131f] border-white/[0.06]">
            <SelectItem value="All">All</SelectItem>
            <SelectItem value="Merged">Merged</SelectItem>
            <SelectItem value="Open">Open</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8" onClick={() => setShowCreate(!showCreate)}>
          <GitCommit size={14} className="mr-1" />New Commit
        </Button>
        <Button size="sm" variant="outline" className="border-white/[0.06] text-white text-xs h-8 hover:bg-white/[0.04]">
          <GitMerge size={14} className="mr-1" />Merge Request
        </Button>
      </div>

      {showCreate && (
        <Card className="bg-[#13131f] border-white/[0.06] rounded-xl">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-white text-sm font-semibold">Create New Commit</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Select>
                <SelectTrigger className="bg-white/[0.04] border-white/[0.06] text-white text-xs"><SelectValue placeholder="Select Module" /></SelectTrigger>
                <SelectContent className="bg-[#13131f] border-white/[0.06]">{MODULES.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select>
                <SelectTrigger className="bg-white/[0.04] border-white/[0.06] text-white text-xs"><SelectValue placeholder="Select Branch" /></SelectTrigger>
                <SelectContent className="bg-[#13131f] border-white/[0.06]">
                  <SelectItem value="main">main</SelectItem><SelectItem value="develop">develop</SelectItem><SelectItem value="staging">staging</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Commit message (e.g., feat: add feature)" className="bg-white/[0.04] border-white/[0.06] text-white placeholder:text-slate-500 text-xs" />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" className="text-slate-400 h-7 text-xs" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white h-7 text-xs">Create Commit</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-[#13131f] border-white/[0.06] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] text-slate-400">
                <th className="text-left p-3 font-medium">ID</th>
                <th className="text-left p-3 font-medium">Message</th>
                <th className="text-left p-3 font-medium">Author</th>
                <th className="text-left p-3 font-medium">Module</th>
                <th className="text-left p-3 font-medium">Branch</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="p-3 text-slate-500 font-mono">{c.id}</td>
                  <td className="p-3 text-white font-medium">{c.message}</td>
                  <td className="p-3 text-slate-400">{c.author}</td>
                  <td className="p-3 text-slate-400">{c.module}</td>
                  <td className="p-3"><span className="flex items-center gap-1 text-slate-400"><GitBranch size={10} />{c.branch}</span></td>
                  <td className="p-3"><StatusBadge status={c.status} /></td>
                  <td className="p-3 text-slate-500">{c.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Module 4: Feature Flags ──────────────────────────────────────────────────
function FeatureFlagsView() {
  const [search, setSearch] = useState('');
  const [flags, setFlags] = useState<FeatureFlag[]>(FEATURE_FLAGS);

  const filtered = useMemo(() =>
    flags.filter(f => f.name.toLowerCase().includes(search.toLowerCase()) || f.module.toLowerCase().includes(search.toLowerCase())),
    [search, flags]
  );

  const toggleFlag = (id: string) => {
    setFlags(prev => prev.map(f => f.id === id ? { ...f, status: f.status === 'Enabled' ? 'Disabled' : 'Enabled', rolloutPercent: f.status === 'Enabled' ? 0 : 100 } : f));
  };

  const updateRollout = (id: string, val: number) => {
    setFlags(prev => prev.map(f => f.id === id ? { ...f, rolloutPercent: val, status: val > 0 ? 'Enabled' : 'Disabled' } : f));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input placeholder="Search feature flags..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 bg-[#13131f] border-white/[0.06] text-white placeholder:text-slate-500 text-sm" />
        </div>
        <Button size="sm" className="bg-amber-600 hover:bg-amber-500 text-white text-xs h-8"><Plus size={14} className="mr-1" />New Flag</Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {filtered.map(f => (
          <Card key={f.id} className="bg-[#13131f] border-white/[0.06] rounded-xl">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <ToggleLeft size={16} className={f.status === 'Enabled' ? 'text-amber-400' : 'text-slate-600'} />
                  <div>
                    <h3 className="text-white text-sm font-semibold">{f.name}</h3>
                    <p className="text-slate-500 text-[10px]">{f.module} · by {f.createdBy}</p>
                  </div>
                </div>
                <StatusBadge status={f.status} />
              </div>
              <p className="text-slate-400 text-xs mt-2">{f.description}</p>
              <div className="mt-3 pt-3 border-t border-white/[0.04] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Companies Affected</span>
                  <span className="text-white font-medium">{f.companiesAffected}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Rollout</span>
                  <span className="text-white font-medium">{f.rolloutPercent}%</span>
                </div>
                <input type="range" min={0} max={100} value={f.rolloutPercent} onChange={e => updateRollout(f.id, parseInt(e.target.value))} className="w-full accent-amber-500 h-1" />
                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" variant="ghost" className={`h-6 text-[10px] ${f.status === 'Enabled' ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'}`} onClick={() => toggleFlag(f.id)}>
                    {f.status === 'Enabled' ? <Pause size={10} className="mr-1" /> : <Play size={10} className="mr-1" />}
                    {f.status === 'Enabled' ? 'Disable' : 'Enable'}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] text-blue-400 hover:text-blue-300"><Edit size={10} className="mr-1" />Edit</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Module 5: Deployments ────────────────────────────────────────────────────
function DeploymentsView() {
  const [envFilter, setEnvFilter] = useState('All');
  const filtered = useMemo(() =>
    envFilter === 'All' ? DEPLOYMENTS : DEPLOYMENTS.filter(d => d.environment === envFilter),
    [envFilter]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={envFilter} onValueChange={setEnvFilter}>
          <SelectTrigger className="w-36 bg-[#13131f] border-white/[0.06] text-white text-xs"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-[#13131f] border-white/[0.06]">
            <SelectItem value="All">All Environments</SelectItem>
            <SelectItem value="Dev">Dev</SelectItem>
            <SelectItem value="Staging">Staging</SelectItem>
            <SelectItem value="Production">Production</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" className="bg-violet-600 hover:bg-violet-500 text-white text-xs h-8"><Rocket size={14} className="mr-1" />Deploy All</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map(d => (
          <Card key={d.id} className="bg-[#13131f] border-white/[0.06] rounded-xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Rocket size={14} className="text-violet-400" />
                  <h3 className="text-white text-sm font-semibold">{d.module}</h3>
                </div>
                <StatusBadge status={d.status} />
              </div>
              <div className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">Environment</span><span className="text-white">{d.environment}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Timestamp</span><span className="text-white">{d.timestamp}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Duration</span><span className="text-white">{d.duration}</span></div>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.04]">
                {d.status !== 'Deployed' && (
                  <Button size="sm" className="h-6 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white"><Play size={10} className="mr-1" />Deploy</Button>
                )}
                {d.status === 'Failed' && (
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] text-red-400 hover:text-red-300"><RotateCcw size={10} className="mr-1" />Rollback</Button>
                )}
                {d.status === 'Deploying' && (
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] text-amber-400"><RefreshCw size={10} className="mr-1 animate-spin" />In Progress</Button>
                )}
                <Button size="sm" variant="ghost" className="h-6 text-[10px] text-slate-400 hover:text-white"><Terminal size={10} className="mr-1" />Logs</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Module 6: Issues ─────────────────────────────────────────────────────────
function IssuesView() {
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [commentText, setCommentText] = useState('');

  const filtered = useMemo(() =>
    ISSUES.filter(i => {
      const matchSearch = i.title.toLowerCase().includes(search.toLowerCase());
      const matchPriority = priorityFilter === 'All' || i.priority === priorityFilter;
      const matchStatus = statusFilter === 'All' || i.status === statusFilter;
      return matchSearch && matchPriority && matchStatus;
    }),
    [search, priorityFilter, statusFilter]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input placeholder="Search issues..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 bg-[#13131f] border-white/[0.06] text-white placeholder:text-slate-500 text-sm" />
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-28 bg-[#13131f] border-white/[0.06] text-white text-xs"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-[#13131f] border-white/[0.06]">
            <SelectItem value="All">All Priority</SelectItem>
            <SelectItem value="Critical">Critical</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-28 bg-[#13131f] border-white/[0.06] text-white text-xs"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-[#13131f] border-white/[0.06]">
            <SelectItem value="All">All Status</SelectItem>
            <SelectItem value="Open">Open</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Resolved">Resolved</SelectItem>
            <SelectItem value="Closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" className="bg-pink-600 hover:bg-pink-500 text-white text-xs h-8"><Plus size={14} className="mr-1" />New Issue</Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {filtered.map(issue => (
          <Card key={issue.id} className="bg-[#13131f] border-white/[0.06] rounded-xl cursor-pointer hover:border-white/[0.12] transition-all" onClick={() => setSelectedIssue(issue)}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Bug size={14} className="text-pink-400 shrink-0" />
                  <div>
                    <h3 className="text-white text-sm font-semibold">{issue.id}: {issue.title}</h3>
                    <p className="text-slate-500 text-[10px]">{issue.module} · {issue.assignee} · {issue.created}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <StatusBadge status={issue.priority} />
                <StatusBadge status={issue.status} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedIssue && (
        <Dialog open={!!selectedIssue} onOpenChange={() => setSelectedIssue(null)}>
          <DialogContent className="bg-[#13131f] border-white/[0.06] text-white max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-white text-base">{selectedIssue.id}: {selectedIssue.title}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={selectedIssue.priority} />
                <StatusBadge status={selectedIssue.status} />
                <span className="text-xs text-slate-500">{selectedIssue.module}</span>
                <span className="text-xs text-slate-500">Assigned: {selectedIssue.assignee}</span>
              </div>
              <div>
                <h4 className="text-white text-xs font-semibold mb-2">Comments ({selectedIssue.comments.length})</h4>
                <div className="space-y-2">
                  {selectedIssue.comments.map((c, i) => (
                    <div key={i} className="p-2 rounded-lg bg-white/[0.02]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-400 font-medium">{c.author}</span>
                        <span className="text-[10px] text-slate-500">{c.date}</span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">{c.text}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Input placeholder="Add a comment..." value={commentText} onChange={e => setCommentText(e.target.value)} className="bg-white/[0.04] border-white/[0.06] text-white placeholder:text-slate-500 text-xs" />
                  <Button size="sm" className="bg-pink-600 hover:bg-pink-500 text-white h-7 text-xs" onClick={() => { setCommentText(''); }}>Post</Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Module 7: API Docs ───────────────────────────────────────────────────────
function ApiDocsView() {
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() =>
    API_ENDPOINTS.filter(e => {
      const matchSearch = e.path.toLowerCase().includes(search.toLowerCase()) || e.description.toLowerCase().includes(search.toLowerCase());
      const matchModule = moduleFilter === 'All' || e.module === moduleFilter;
      return matchSearch && matchModule;
    }),
    [search, moduleFilter]
  );

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const uniqueModules = useMemo(() => ['All', ...Array.from(new Set(API_ENDPOINTS.map(e => e.module)))], []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input placeholder="Search endpoints..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 bg-[#13131f] border-white/[0.06] text-white placeholder:text-slate-500 text-sm" />
        </div>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-40 bg-[#13131f] border-white/[0.06] text-white text-xs"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-[#13131f] border-white/[0.06]">{uniqueModules.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {filtered.map(ep => (
          <Card key={ep.id} className="bg-[#13131f] border-white/[0.06] rounded-xl">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <StatusBadge status={ep.method} />
                <code className="text-white text-xs font-mono">{ep.path}</code>
                <span className="text-slate-500 text-[10px] ml-auto">{ep.module}</span>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-slate-400 hover:text-white" onClick={() => copyToClipboard(`${ep.method} ${ep.path}`, ep.id)}>
                  {copiedId === ep.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </Button>
              </div>
              <p className="text-slate-400 text-xs mt-2">{ep.description}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="p-2 rounded bg-white/[0.02]">
                  <span className="text-[10px] text-slate-500 uppercase">Params</span>
                  <p className="text-xs text-slate-300 mt-0.5">{ep.params}</p>
                </div>
                <div className="p-2 rounded bg-white/[0.02]">
                  <span className="text-[10px] text-slate-500 uppercase">Response</span>
                  <p className="text-xs text-slate-300 mt-0.5 font-mono truncate">{ep.response}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Module 8: Settings ───────────────────────────────────────────────────────
function SettingsView() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="github" className="w-full">
        <TabsList className="bg-[#13131f] border border-white/[0.06] rounded-lg p-0.5 h-auto">
          <TabsTrigger value="github" className="text-xs px-3 py-1.5 data-[state=active]:bg-white/[0.08] text-slate-400 data-[state=active]:text-white rounded-md"><GitBranch size={12} className="mr-1" />GitHub</TabsTrigger>
          <TabsTrigger value="cicd" className="text-xs px-3 py-1.5 data-[state=active]:bg-white/[0.08] text-slate-400 data-[state=active]:text-white rounded-md"><RefreshCw size={12} className="mr-1" />CI/CD</TabsTrigger>
          <TabsTrigger value="env" className="text-xs px-3 py-1.5 data-[state=active]:bg-white/[0.08] text-slate-400 data-[state=active]:text-white rounded-md"><HardDrive size={12} className="mr-1" />Env Vars</TabsTrigger>
          <TabsTrigger value="team" className="text-xs px-3 py-1.5 data-[state=active]:bg-white/[0.08] text-slate-400 data-[state=active]:text-white rounded-md"><BadgeCheck size={12} className="mr-1" />Team</TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs px-3 py-1.5 data-[state=active]:bg-white/[0.08] text-slate-400 data-[state=active]:text-white rounded-md"><Wifi size={12} className="mr-1" />Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="github" className="mt-4 space-y-4">
          <Card className="bg-[#13131f] border-white/[0.06] rounded-xl"><CardContent className="p-4 space-y-3">
            <h3 className="text-white text-sm font-semibold">GitHub Integration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><label className="text-xs text-slate-500 mb-1 block">Repository URL</label><Input defaultValue="https://github.com/kobetech/platform" className="bg-white/[0.04] border-white/[0.06] text-white text-xs" /></div>
              <div><label className="text-xs text-slate-500 mb-1 block">Default Branch</label><Input defaultValue="main" className="bg-white/[0.04] border-white/[0.06] text-white text-xs" /></div>
              <div className="md:col-span-2"><label className="text-xs text-slate-500 mb-1 block">Webhook URL</label><Input defaultValue="https://devops.kobe.io/webhooks/github" className="bg-white/[0.04] border-white/[0.06] text-white text-xs" /></div>
            </div>
            <div className="flex justify-end"><Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-7">Save GitHub Config</Button></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="cicd" className="mt-4 space-y-4">
          <Card className="bg-[#13131f] border-white/[0.06] rounded-xl"><CardContent className="p-4 space-y-3">
            <h3 className="text-white text-sm font-semibold">CI/CD Configuration</h3>
            <div className="space-y-3">
              <div><label className="text-xs text-slate-500 mb-1 block">Build Command</label><Input defaultValue="npm run build:prod" className="bg-white/[0.04] border-white/[0.06] text-white text-xs font-mono" /></div>
              <div><label className="text-xs text-slate-500 mb-1 block">Test Command</label><Input defaultValue="npm run test:ci" className="bg-white/[0.04] border-white/[0.06] text-white text-xs font-mono" /></div>
              <div><label className="text-xs text-slate-500 mb-1 block">Deploy Script (Staging)</label><Input defaultValue="./scripts/deploy-staging.sh" className="bg-white/[0.04] border-white/[0.06] text-white text-xs font-mono" /></div>
              <div><label className="text-xs text-slate-500 mb-1 block">Deploy Script (Production)</label><Input defaultValue="./scripts/deploy-prod.sh" className="bg-white/[0.04] border-white/[0.06] text-white text-xs font-mono" /></div>
            </div>
            <div className="flex justify-end"><Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-7">Save CI/CD Config</Button></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="env" className="mt-4 space-y-4">
          <Card className="bg-[#13131f] border-white/[0.06] rounded-xl"><CardContent className="p-4 space-y-3">
            <h3 className="text-white text-sm font-semibold">Environment Variables</h3>
            {['Dev', 'Staging', 'Production'].map(env => (
              <div key={env} className="space-y-2">
                <h4 className="text-xs text-slate-400 font-medium">{env}</h4>
                <div className="grid grid-cols-2 gap-2">
                  {MODULES.slice(0, 5).map(m => (
                    <div key={m.id} className="flex items-center gap-2 p-2 rounded bg-white/[0.02]">
                      <span className="text-[10px] text-slate-500">{m.name.toUpperCase().replace(/\s/g, '_')}_API_URL</span>
                      <span className="text-xs text-emerald-400 ml-auto font-mono">https://{m.name.toLowerCase().replace(/\s/g, '')}.kobe.io</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex justify-end"><Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-7">Save Env Vars</Button></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="team" className="mt-4 space-y-4">
          <Card className="bg-[#13131f] border-white/[0.06] rounded-xl"><CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-white text-sm font-semibold">Developer Access</h3>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-7"><Plus size={12} className="mr-1" />Add Developer</Button>
            </div>
            <div className="space-y-2">
              {['John Doe', 'Jane Smith', 'Rajab M', 'Amina H', 'Peter K'].map(dev => (
                <div key={dev} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold">{dev.split(' ').map(n => n[0]).join('')}</div>
                    <div><span className="text-white text-xs font-medium">{dev}</span><p className="text-slate-500 text-[10px]">Developer</p></div>
                  </div>
                  <div className="flex items-center gap-1">
                    {MODULES.filter(m => m.developers.includes(dev)).map(m => (
                      <span key={m.id} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400">{m.name}</span>
                    ))}
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-slate-500 hover:text-red-400"><Trash2 size={12} /></Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4 space-y-4">
          <Card className="bg-[#13131f] border-white/[0.06] rounded-xl"><CardContent className="p-4 space-y-3">
            <h3 className="text-white text-sm font-semibold">Notification Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><label className="text-xs text-slate-500 mb-1 block">Slack Webhook</label><Input defaultValue="https://hooks.slack.com/services/T00/B00/XXXX" className="bg-white/[0.04] border-white/[0.06] text-white text-xs" /></div>
              <div><label className="text-xs text-slate-500 mb-1 block">Alert Email</label><Input defaultValue="devops@kobe.io" className="bg-white/[0.04] border-white/[0.06] text-white text-xs" /></div>
              <div className="md:col-span-2 space-y-2">
                {['Deployment failures', 'New commits on main', 'Issue assigned', 'Build status changes'].map(label => (
                  <label key={label} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded accent-blue-500" />{label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end"><Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-7">Save Notifications</Button></div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function KobetechDevops() {
  const [activeModule, setActiveModule] = useState<ModuleName>('dashboard');

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard': return <DashboardView onNavigate={setActiveModule} />;
      case 'modules': return <ModulesView onNavigate={setActiveModule} />;
      case 'commits': return <CommitsView />;
      case 'featureFlags': return <FeatureFlagsView />;
      case 'deployments': return <DeploymentsView />;
      case 'issues': return <IssuesView />;
      case 'apiDocs': return <ApiDocsView />;
      case 'settings': return <SettingsView />;
    }
  };

  const activeItem = sidebarItems.find(i => i.key === activeModule);

  return (
    <div className="flex h-screen w-full bg-[#0a0a1a] text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-[#13131f] border-r border-white/[0.06] flex flex-col shrink-0">
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/15 text-cyan-400">
              <Code2 size={18} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">KOBETECH</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">DevOps Portal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {sidebarItems.map(item => {
            const isActive = activeModule === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveModule(item.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <item.icon size={15} className={isActive ? item.color : ''} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02]">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-[10px] font-bold">JD</div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-white font-medium truncate">John Doe</p>
              <p className="text-[9px] text-slate-500">Lead Developer</p>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-white/[0.06] flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-2">
            {activeItem && <activeItem.icon size={16} className={activeItem.color} />}
            <h2 className="text-sm font-semibold text-white capitalize">{activeItem?.label}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white h-7 w-7 p-0"><Search size={14} /></Button>
            <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white h-7 w-7 p-0"><AlertTriangle size={14} /></Button>
            <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white h-7 w-7 p-0"><RefreshCw size={14} /></Button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderModule()}
        </div>
      </main>
    </div>
  );
}
