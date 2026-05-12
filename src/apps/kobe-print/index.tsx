import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Printer, Palette, Shirt, Box, Scissors, Sparkles,
  LayoutDashboard, Layers, Type, Image, Upload, Download,
  MousePointer, Square, Circle, Minus, PenTool,
  ZoomIn, ZoomOut, Copy, Trash2,
  Eye, Settings, Plus, Search, Filter,
  Play, Pause, CheckCircle2, Clock, AlertTriangle,
  DollarSign, TrendingUp, Package, Users, Wrench, ChevronRight,
  Save, ShoppingBag, BarChart3, SlidersHorizontal,
  Star, Edit,
  ArrowUp, ArrowDown, Smartphone, Coffee, HardHat,
  RefreshCw, Undo, Redo,
  Triangle, Hexagon, Octagon,
  Gauge, Waypoints
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';

/* ================================================================
   TYPES
   ================================================================ */
interface CanvasShape {
  id: string; type: 'rect' | 'circle' | 'text' | 'line';
  x: number; y: number; w: number; h: number;
  fill: string; stroke: string; strokeWidth: number; opacity: number;
  text?: string; fontSize?: number; fontFamily?: string; rx?: number; ry?: number;
}
interface PrintJob {
  id: string; product: string; customer: string; dueDate: string;
  priority: 'High' | 'Medium' | 'Low'; status: 'Pending' | 'Printing' | 'Finishing' | 'Completed';
  qty: number; method: string;
}
interface VinylJob { id: string; design: string; material: string; size: string; status: 'Queued' | 'Cutting' | 'Completed'; progress: number; }
interface MaterialItem { id: string; name: string; type: string; stock: number; unit: string; minThreshold: number; status: 'In Stock' | 'Low' | 'Out'; color: string; }
interface ProductItem { id: string; name: string; category: string; basePrice: number; method: string; status: 'Active' | 'Inactive'; icon: string; }
interface ActivityItem { id: string; text: string; time: string; type: 'success' | 'info' | 'warning' | 'error'; }
interface CustomerItem { id: string; name: string; contact: string; phone: string; email: string; orders: number; total: string; status: string; }
interface QueueItem { id: string; job: string; machine: string; operator: string; startTime: string; estEnd: string; progress: number; status: string; }

/* ================================================================
   MOCK DATA
   ================================================================ */
const ACTIVITIES: ActivityItem[] = [
  { id: '1', text: 'Job #1042 completed - 24 DTG T-Shirts for Jengo Tech', time: '5 min ago', type: 'success' },
  { id: '2', text: 'New order received - 50 Sublimation Jerseys', time: '12 min ago', type: 'info' },
  { id: '3', text: 'Material alert: White Vinyl roll below threshold', time: '28 min ago', type: 'warning' },
  { id: '4', text: 'Job #1039 printed and sent to finishing', time: '45 min ago', type: 'info' },
  { id: '5', text: 'Payment received TZS 450,000 from Mzuri Designs', time: '1 hr ago', type: 'success' },
  { id: '6', text: 'DTG printer maintenance completed', time: '2 hrs ago', type: 'info' },
  { id: '7', text: 'Order #2048 delayed - material shortage', time: '3 hrs ago', type: 'error' },
  { id: '8', text: 'New customer: Kariakoo Market Traders', time: '4 hrs ago', type: 'info' },
];
const WEEKLY_ORDERS = [38, 52, 45, 60, 48, 72, 65];
const WEEKLY_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PENDING_JOBS = [
  { id: '#1043', product: 'Football Jersey x30', customer: 'Simba SC', time: 'Due Today', status: 'urgent' as const },
  { id: '#1044', product: 'Business Cards x500', customer: 'NBC Bank', time: 'Due Tomorrow', status: 'normal' as const },
  { id: '#1045', product: 'DTG T-Shirts x20', customer: 'StartupHub', time: 'In 2 Days', status: 'normal' as const },
  { id: '#1046', product: 'Reflective Vests x15', customer: 'TANROADS', time: 'In 3 Days', status: 'normal' as const },
];
const PRINT_JOBS: PrintJob[] = [
  { id: '#1040', product: 'Corporate Polo x25', customer: 'CRDB Bank', dueDate: 'Today', priority: 'High', status: 'Pending', qty: 25, method: 'DTF' },
  { id: '#1041', product: 'Event T-Shirts x100', customer: 'Sabasaba Expo', dueDate: 'Tomorrow', priority: 'High', status: 'Printing', qty: 100, method: 'DTG' },
  { id: '#1042', product: 'School Uniform x60', customer: 'FEZA School', dueDate: 'Today', priority: 'Medium', status: 'Finishing', qty: 60, method: 'Sublimation' },
  { id: '#1043', product: 'Football Jersey x30', customer: 'Simba SC', dueDate: 'Today', priority: 'High', status: 'Pending', qty: 30, method: 'Sublimation' },
  { id: '#1044', product: 'Business Cards x500', customer: 'NBC Bank', dueDate: 'Tomorrow', priority: 'Medium', status: 'Printing', qty: 500, method: 'Transfer' },
  { id: '#1045', product: 'DTG T-Shirts x20', customer: 'StartupHub', dueDate: 'In 2 Days', priority: 'Low', status: 'Pending', qty: 20, method: 'DTG' },
  { id: '#1046', product: 'Reflective Vests x15', customer: 'TANROADS', dueDate: 'In 3 Days', priority: 'Medium', status: 'Finishing', qty: 15, method: 'Vinyl Cut' },
  { id: '#1047', product: 'Boda Jackets x40', customer: 'SafeBoda', dueDate: 'In 2 Days', priority: 'High', status: 'Printing', qty: 40, method: 'DTF' },
  { id: '#1048', product: 'Promo Mugs x50', customer: 'Azam TV', dueDate: 'In 4 Days', priority: 'Low', status: 'Pending', qty: 50, method: 'Transfer' },
  { id: '#1049', product: 'Caps x35', customer: 'CloudFM', dueDate: 'In 5 Days', priority: 'Low', status: 'Completed', qty: 35, method: 'Embroidery' },
  { id: '#1050', product: 'Hoodies x18', customer: 'Ubongo Kids', dueDate: 'In 6 Days', priority: 'Medium', status: 'Completed', qty: 18, method: 'DTF' },
  { id: '#1051', product: 'Tote Bags x45', customer: 'Twiga Foods', dueDate: 'In 7 Days', priority: 'Low', status: 'Completed', qty: 45, method: 'DTF' },
];
const VINYL_JOBS: VinylJob[] = [
  { id: '#V301', design: 'Logo_Sticker_v2', material: 'Oracal 651', size: '300x200mm', status: 'Cutting', progress: 65 },
  { id: '#V302', design: 'Window_Vinyl', material: 'Frosted', size: '600x400mm', status: 'Queued', progress: 0 },
  { id: '#V303', design: 'Car_Decal_Full', material: 'Reflective', size: '1200x500mm', status: 'Queued', progress: 0 },
  { id: '#V304', design: 'Label_Batch_12', material: 'Siser HTV', size: '150x100mm', status: 'Completed', progress: 100 },
  { id: '#V305', design: 'Wall_Graphics', material: 'Oracal 651', size: '2000x800mm', status: 'Completed', progress: 100 },
];
const MATERIALS: MaterialItem[] = [
  { id: '1', name: 'Vinyl Roll - Red', type: 'Vinyl', stock: 12, unit: 'meters', minThreshold: 5, status: 'In Stock', color: '#ef4444' },
  { id: '2', name: 'Vinyl Roll - Black', type: 'Vinyl', stock: 8, unit: 'meters', minThreshold: 5, status: 'In Stock', color: '#1f2937' },
  { id: '3', name: 'Vinyl Roll - White', type: 'Vinyl', stock: 3, unit: 'meters', minThreshold: 5, status: 'Low', color: '#f9fafb' },
  { id: '4', name: 'Vinyl Roll - Gold', type: 'Vinyl', stock: 15, unit: 'meters', minThreshold: 3, status: 'In Stock', color: '#f59e0b' },
  { id: '5', name: 'Siser HTV - White', type: 'HTV', stock: 25, unit: 'sheets', minThreshold: 10, status: 'In Stock', color: '#e5e7eb' },
  { id: '6', name: 'DTF Film Roll', type: 'DTF', stock: 2, unit: 'rolls', minThreshold: 3, status: 'Low', color: '#3b82f6' },
  { id: '7', name: 'Transfer Paper A3', type: 'Transfer', stock: 0, unit: 'sheets', minThreshold: 20, status: 'Out', color: '#10b981' },
  { id: '8', name: 'Sublimation Ink - Cyan', type: 'Ink', stock: 500, unit: 'ml', minThreshold: 200, status: 'In Stock', color: '#06b6d4' },
  { id: '9', name: 'Sublimation Ink - Magenta', type: 'Ink', stock: 180, unit: 'ml', minThreshold: 200, status: 'Low', color: '#ec4899' },
  { id: '10', name: 'DTG Ink - White', type: 'Ink', stock: 800, unit: 'ml', minThreshold: 300, status: 'In Stock', color: '#f3f4f6' },
  { id: '11', name: 'Glitter HTV - Silver', type: 'HTV', stock: 7, unit: 'sheets', minThreshold: 5, status: 'In Stock', color: '#c0c0c0' },
  { id: '12', name: 'Reflective Vinyl', type: 'Vinyl', stock: 4, unit: 'meters', minThreshold: 3, status: 'In Stock', color: '#d4d4d8' },
];
const PRODUCTS: ProductItem[] = [
  { id: '1', name: 'T-Shirt', category: 'Apparel', basePrice: 15000, method: 'DTG', status: 'Active', icon: 'shirt' },
  { id: '2', name: 'Jersey', category: 'Apparel', basePrice: 35000, method: 'Sublimation', status: 'Active', icon: 'shirt' },
  { id: '3', name: 'Mug', category: 'Drinkware', basePrice: 12000, method: 'Transfer', status: 'Active', icon: 'coffee' },
  { id: '4', name: 'Cap', category: 'Accessories', basePrice: 10000, method: 'Embroidery', status: 'Active', icon: 'beanie' },
  { id: '5', name: 'Hoodie', category: 'Apparel', basePrice: 45000, method: 'DTF', status: 'Active', icon: 'shirt' },
  { id: '6', name: 'Reflective Vest', category: 'Safety', basePrice: 18000, method: 'Vinyl Cut', status: 'Active', icon: 'hardhat' },
  { id: '7', name: 'Apron', category: 'Accessories', basePrice: 22000, method: 'DTF', status: 'Active', icon: 'shirt' },
  { id: '8', name: 'Tote Bag', category: 'Accessories', basePrice: 14000, method: 'DTF', status: 'Active', icon: 'shoppingbag' },
];
const DESIGN_TEMPLATES = [
  { id: '1', name: 'Business Card', size: '90x54mm', icon: 'card' },
  { id: '2', name: 'Flyer A5', size: '148x210mm', icon: 'flyer' },
  { id: '3', name: 'T-Shirt Design', size: '300x400mm', icon: 'shirt' },
  { id: '4', name: 'Banner', size: '2000x800mm', icon: 'banner' },
  { id: '5', name: 'Logo Pack', size: '500x500mm', icon: 'logo' },
  { id: '6', name: 'Poster A2', size: '420x594mm', icon: 'poster' },
];
const AI_GENERATIONS = [
  { id: '1', prompt: 'Tribal lion logo, fierce, vector style', style: 'Logo', color: '#8b5cf6' },
  { id: '2', prompt: 'Geometric pattern, African inspired', style: 'Pattern', color: '#f59e0b' },
  { id: '3', prompt: 'Sports team mascot, eagle, bold', style: 'Illustration', color: '#ef4444' },
  { id: '4', prompt: 'Minimal coffee shop branding', style: 'Minimal', color: '#78716c' },
  { id: '5', prompt: 'Vintage safari poster design', style: 'Vintage', color: '#d97706' },
  { id: '6', prompt: 'Dynamic fitness typography', style: 'Typography', color: '#06b6d4' },
  { id: '7', prompt: 'Modern tech company logo', style: 'Corporate', color: '#3b82f6' },
  { id: '8', prompt: 'Racing stripes pattern', style: 'Sporty', color: '#10b981' },
];
const JERSEY_TEMPLATES = [
  { id: '1', name: 'Football Jersey', icon: 'shirt' },
  { id: '2', name: 'Basketball Jersey', icon: 'shirt' },
  { id: '3', name: 'Rugby Jersey', icon: 'shirt' },
  { id: '4', name: 'Boda Boda Jacket', icon: 'hardhat' },
  { id: '5', name: 'School Uniform', icon: 'shirt' },
  { id: '6', name: 'Company Polo', icon: 'shirt' },
];
const CUSTOMERS: CustomerItem[] = [
  { id: '1', name: 'Simba Sports Club', contact: 'John Mrema', phone: '+255 712 345 678', email: 'info@simbasc.co.tz', orders: 45, total: 'TZS 12.5M', status: 'Active' },
  { id: '2', name: 'CRDB Bank', contact: 'Grace Mushi', phone: '+255 713 456 789', email: 'procurement@crdb.co.tz', orders: 32, total: 'TZS 8.2M', status: 'Active' },
  { id: '3', name: 'Yanga Africans', contact: 'Omar Kassim', phone: '+255 714 567 890', email: 'info@yangafc.com', orders: 38, total: 'TZS 10.1M', status: 'Active' },
  { id: '4', name: 'NBC Bank', contact: 'Anna Thomas', phone: '+255 715 678 901', email: 'marketing@nbc.co.tz', orders: 28, total: 'TZS 6.8M', status: 'Active' },
  { id: '5', name: 'FEZA Schools', contact: 'Dr. Hamid', phone: '+255 716 789 012', email: 'admin@feza.sch.tz', orders: 22, total: 'TZS 5.4M', status: 'Active' },
  { id: '6', name: 'TANROADS', contact: 'Eng. Joseph', phone: '+255 717 890 123', email: 'supplies@tanroads.go.tz', orders: 15, total: 'TZS 3.2M', status: 'Inactive' },
  { id: '7', name: 'Azam TV', contact: 'Halima Said', phone: '+255 718 901 234', email: 'brand@azam.tv', orders: 18, total: 'TZS 4.1M', status: 'Active' },
  { id: '8', name: 'Twiga Foods', contact: 'Peter Nzola', phone: '+255 719 012 345', email: 'hr@twigafoods.com', orders: 12, total: 'TZS 2.8M', status: 'Active' },
];
const PRODUCTION_QUEUE: QueueItem[] = [
  { id: 'Q01', job: '#1041 - Event T-Shirts', machine: 'Epson F2100', operator: 'Juma', startTime: '08:00', estEnd: '14:30', progress: 65, status: 'Running' },
  { id: 'Q02', job: '#1044 - Business Cards', machine: 'Roland BN-20', operator: 'Asha', startTime: '09:15', estEnd: '11:00', progress: 45, status: 'Running' },
  { id: 'Q03', job: '#1047 - Boda Jackets', machine: 'Epson DTF', operator: 'Khalid', startTime: '10:00', estEnd: '16:00', progress: 30, status: 'Running' },
  { id: 'Q04', job: '#1042 - School Uniforms', machine: 'Heat Press 1', operator: 'Maria', startTime: '07:30', estEnd: '12:00', progress: 85, status: 'Finishing' },
  { id: 'Q05', job: '#1046 - Reflective Vests', machine: 'Roland GS-24', operator: 'Juma', startTime: '08:30', estEnd: '10:00', progress: 90, status: 'Finishing' },
  { id: 'Q06', job: '#1040 - Corporate Polo', machine: 'DTF Oven', operator: 'Asha', startTime: 'Pending', estEnd: 'Pending', progress: 0, status: 'Queued' },
  { id: 'Q07', job: '#1043 - Football Jerseys', machine: 'Sublimation', operator: 'Khalid', startTime: 'Pending', estEnd: 'Pending', progress: 0, status: 'Queued' },
];

/* ================================================================
   COLOR HELPERS
   ================================================================ */
const STATUS_COLORS = {
  success: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: 'text-emerald-400' },
  info: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: 'text-blue-400' },
  warning: { bg: 'bg-amber-500/10', text: 'text-amber-400', icon: 'text-amber-400' },
  error: { bg: 'bg-red-500/10', text: 'text-red-400', icon: 'text-red-400' },
};
const PRIORITY_COLORS: Record<string, string> = {
  High: 'bg-red-500/20 text-red-400 border-red-500/30',
  Medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};
const JOB_STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  Printing: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  Finishing: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  Completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};
const MATERIAL_STATUS_COLORS: Record<string, string> = {
  'In Stock': 'bg-emerald-500/20 text-emerald-400',
  'Low': 'bg-amber-500/20 text-amber-400',
  'Out': 'bg-red-500/20 text-red-400',
};
const colorPresets = ['#1e40af', '#dc2626', '#16a34a', '#1f2937', '#f9fafb', '#f59e0b', '#7c3aed', '#0e7490', '#be185d', '#854d0e'];

/* ================================================================
   MODULE 1: DASHBOARD
   ================================================================ */
function DashboardModule() {
  const maxOrder = Math.max(...WEEKLY_ORDERS);
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
        <p className="text-white/40 text-sm">Overview of your print shop operations</p>
      </div>
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Jobs', value: '12', change: '+3 today', icon: Printer, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
          { label: 'Completed Today', value: '48', change: '+12 vs yday', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Revenue', value: 'TZS 1.2M', change: '+18% this week', icon: DollarSign, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Materials Low', value: '3', change: 'Restock needed', icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
        ].map((kpi) => (
          <Card key={kpi.label} className="bg-white/[0.03] border-white/[0.06]">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white/40 text-xs mb-1">{kpi.label}</p>
                  <p className="text-2xl font-bold text-white">{kpi.value}</p>
                  <p className="text-xs mt-1 text-white/30">{kpi.change}</p>
                </div>
                <div className={`w-10 h-10 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                  <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-4">
            <h3 className="text-white font-semibold mb-3 text-sm">Weekly Orders</h3>
            <div className="flex items-end gap-2 h-28">
              {WEEKLY_ORDERS.map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full relative">
                    <div className="bg-cyan-500/60 rounded-t-sm transition-all" style={{ height: `${(v / maxOrder) * 80}px` }} />
                  </div>
                  <span className="text-[10px] text-white/30">{WEEKLY_DAYS[i]}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-emerald-400">+24% vs last week</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-4">
            <h3 className="text-white font-semibold mb-3 text-sm">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { label: 'New Design', icon: Palette, color: 'bg-violet-500/10 text-violet-400' },
                { label: 'Start Print Job', icon: Printer, color: 'bg-cyan-500/10 text-cyan-400' },
                { label: 'Add Product', icon: Plus, color: 'bg-emerald-500/10 text-emerald-400' },
              ].map((action) => (
                <button key={action.label} className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] hover:border-white/[0.1] transition-all group">
                  <div className={`w-8 h-8 rounded-lg ${action.color} flex items-center justify-center`}>
                    <action.icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm text-white/70 group-hover:text-white transition-colors">{action.label}</span>
                  <ChevronRight className="w-4 h-4 text-white/20 ml-auto" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-4">
            <h3 className="text-white font-semibold mb-3 text-sm">Pending Jobs</h3>
            <div className="space-y-2">
              {PENDING_JOBS.map((job) => (
                <div key={job.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02]">
                  <div className={`w-2 h-2 rounded-full ${job.status === 'urgent' ? 'bg-red-400' : 'bg-amber-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/70 truncate">{job.product}</p>
                    <p className="text-[10px] text-white/30">{job.customer}</p>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${job.status === 'urgent' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>{job.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Machine Status Row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { name: 'Epson F2100', type: 'DTG Printer', status: 'Online', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { name: 'Roland GS-24', type: 'Vinyl Cutter', status: 'Cutting', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
          { name: 'Heat Press 1', type: 'Transfer', status: 'Idle', color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { name: 'Epson DTF', type: 'Film Printer', status: 'Online', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        ].map((m) => (
          <div key={m.name} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg ${m.bg} flex items-center justify-center`}>
              <Smartphone className={`w-4 h-4 ${m.color}`} />
            </div>
            <div>
              <p className="text-xs text-white/70 font-medium">{m.name}</p>
              <div className="flex items-center gap-1.5">
                <div className={`w-1 h-1 rounded-full ${m.color.replace('text-', 'bg-')}`} />
                <span className="text-[10px] text-white/30">{m.type} · {m.status}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Top Products Row */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-4">
            <h3 className="text-white font-semibold mb-3 text-sm">Top Products by Revenue</h3>
            <div className="space-y-2">
              {[
                { name: 'T-Shirt (DTG)', revenue: 'TZS 450K', count: 120, pct: 85 },
                { name: 'Jersey (Sublimation)', revenue: 'TZS 380K', count: 45, pct: 72 },
                { name: 'Mug (Transfer)', revenue: 'TZS 180K', count: 85, pct: 45 },
                { name: 'Hoodie (DTF)', revenue: 'TZS 320K', count: 28, pct: 60 },
                { name: 'Cap (Embroidery)', revenue: 'TZS 95K', count: 55, pct: 30 },
              ].map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-white/30 w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-0.5">
                      <span className="text-xs text-white/60">{p.name}</span>
                      <span className="text-xs text-emerald-400">{p.revenue}</span>
                    </div>
                    <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500/50 rounded-full" style={{ width: `${p.pct}%` }} />
                    </div>
                  </div>
                  <span className="text-[10px] text-white/20 w-8 text-right">{p.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-4">
            <h3 className="text-white font-semibold mb-3 text-sm">Production by Method</h3>
            <div className="space-y-2">
              {[
                { method: 'DTG', label: 'Direct to Garment', pct: 35, color: 'bg-blue-500' },
                { method: 'DTF', label: 'Direct to Film', pct: 25, color: 'bg-purple-500' },
                { method: 'Sublimation', label: 'Dye Sublimation', pct: 20, color: 'bg-cyan-500' },
                { method: 'Transfer', label: 'Heat Transfer', pct: 12, color: 'bg-amber-500' },
                { method: 'Vinyl Cut', label: 'Vinyl Cutting', pct: 5, color: 'bg-emerald-500' },
                { method: 'Embroidery', label: 'Embroidery', pct: 3, color: 'bg-rose-500' },
              ].map((m, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[10px] text-white/40 w-16">{m.method}</span>
                  <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className={`h-full ${m.color} rounded-full`} style={{ width: `${m.pct}%` }} />
                  </div>
                  <span className="text-xs text-white/30 w-8 text-right">{m.pct}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="bg-white/[0.03] border-white/[0.06]">
        <CardContent className="p-4">
          <h3 className="text-white font-semibold mb-3 text-sm">Recent Activity</h3>
          <div className="space-y-2">
            {ACTIVITIES.map((activity) => {
              const colors = STATUS_COLORS[activity.type];
              return (
                <div key={activity.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                  <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center shrink-0`}>
                    <div className={`w-2 h-2 rounded-full ${colors.icon.replace('text-', 'bg-')}`} />
                  </div>
                  <div className="flex-1 min-w-0"><p className="text-sm text-white/70 truncate">{activity.text}</p></div>
                  <span className="text-xs text-white/30 shrink-0">{activity.time}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ================================================================
   MODULE 2: DESIGNER STUDIO (REAL CANVAS)
   ================================================================ */
function DesignerStudioModule() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shapes, setShapes] = useState<CanvasShape[]>([
    { id: '1', type: 'rect', x: 100, y: 80, w: 200, h: 120, fill: '#3b82f6', stroke: '#2563eb', strokeWidth: 2, opacity: 1 },
    { id: '2', type: 'circle', x: 400, y: 150, w: 100, h: 100, fill: '#ef4444', stroke: '#dc2626', strokeWidth: 2, opacity: 0.8, rx: 50, ry: 50 },
    { id: '3', type: 'text', x: 150, y: 300, w: 300, h: 50, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0, opacity: 1, text: 'KobePrint Studio', fontSize: 32, fontFamily: 'Arial' },
  ]);
  const [selectedTool, setSelectedTool] = useState('select');
  const [selectedShape, setSelectedShape] = useState<string | null>('1');
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });
  const [zoom, setZoom] = useState(100);
  const [activeTab, setActiveTab] = useState('templates');

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvasSize.w;
    canvas.height = canvasSize.h;
    const sq = 20;
    for (let y = 0; y < canvasSize.h; y += sq) {
      for (let x = 0; x < canvasSize.w; x += sq) {
        ctx.fillStyle = ((x / sq + y / sq) % 2 === 0) ? '#1a1a2e' : '#151528';
        ctx.fillRect(x, y, sq, sq);
      }
    }
    shapes.forEach((shape) => {
      ctx.save();
      ctx.globalAlpha = shape.opacity;
      if (shape.type === 'rect') {
        ctx.fillStyle = shape.fill; ctx.strokeStyle = shape.stroke; ctx.lineWidth = shape.strokeWidth;
        ctx.fillRect(shape.x, shape.y, shape.w, shape.h); ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
      } else if (shape.type === 'circle') {
        ctx.fillStyle = shape.fill; ctx.strokeStyle = shape.stroke; ctx.lineWidth = shape.strokeWidth;
        ctx.beginPath(); ctx.ellipse(shape.x + shape.w / 2, shape.y + shape.h / 2, shape.w / 2, shape.h / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else if (shape.type === 'text' && shape.text) {
        ctx.fillStyle = shape.fill; ctx.font = `${shape.fontSize || 24}px ${shape.fontFamily || 'Arial'}`; ctx.textBaseline = 'top'; ctx.fillText(shape.text, shape.x, shape.y);
      } else if (shape.type === 'line') {
        ctx.strokeStyle = shape.stroke; ctx.lineWidth = shape.strokeWidth;
        ctx.beginPath(); ctx.moveTo(shape.x, shape.y); ctx.lineTo(shape.x + shape.w, shape.y + shape.h); ctx.stroke();
      }
      ctx.restore();
      if (selectedShape === shape.id) {
        ctx.save(); ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
        ctx.strokeRect(shape.x - 4, shape.y - 4, shape.w + 8, shape.h + 8);
        ctx.setLineDash([]); ctx.fillStyle = '#fbbf24';
        const handles = [[shape.x-4,shape.y-4],[shape.x+shape.w/2-4,shape.y-4],[shape.x+shape.w-4,shape.y-4],[shape.x-4,shape.y+shape.h-4],[shape.x+shape.w/2-4,shape.y+shape.h-4],[shape.x+shape.w-4,shape.y+shape.h-4],[shape.x-4,shape.y+shape.h/2-4],[shape.x+shape.w-4,shape.y+shape.h/2-4]];
        handles.forEach(([hx, hy]) => { ctx.fillRect(hx, hy, 8, 8); });
        ctx.restore();
      }
    });
  }, [shapes, selectedShape, canvasSize]);

  useEffect(() => { drawCanvas(); }, [drawCanvas]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvasSize.w / rect.width);
    const y = (e.clientY - rect.top) * (canvasSize.h / rect.height);
    if (selectedTool === 'select') {
      for (let i = shapes.length - 1; i >= 0; i--) {
        const s = shapes[i];
        if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) { setSelectedShape(s.id); return; }
      }
      setSelectedShape(null);
    } else if (selectedTool === 'rect') {
      const newShape: CanvasShape = { id: Date.now().toString(), type: 'rect', x: x - 50, y: y - 30, w: 100, h: 60, fill: '#3b82f6', stroke: '#2563eb', strokeWidth: 2, opacity: 1 };
      setShapes([...shapes, newShape]); setSelectedShape(newShape.id); setSelectedTool('select');
    } else if (selectedTool === 'circle') {
      const newShape: CanvasShape = { id: Date.now().toString(), type: 'circle', x: x - 40, y: y - 40, w: 80, h: 80, fill: '#10b981', stroke: '#059669', strokeWidth: 2, opacity: 0.8, rx: 40, ry: 40 };
      setShapes([...shapes, newShape]); setSelectedShape(newShape.id); setSelectedTool('select');
    } else if (selectedTool === 'text') {
      const newShape: CanvasShape = { id: Date.now().toString(), type: 'text', x, y, w: 200, h: 40, fill: '#ffffff', stroke: 'transparent', strokeWidth: 0, opacity: 1, text: 'New Text', fontSize: 24, fontFamily: 'Arial' };
      setShapes([...shapes, newShape]); setSelectedShape(newShape.id); setSelectedTool('select');
    } else if (selectedTool === 'line') {
      const newShape: CanvasShape = { id: Date.now().toString(), type: 'line', x, y, w: 100, h: 0, fill: 'transparent', stroke: '#f59e0b', strokeWidth: 3, opacity: 1 };
      setShapes([...shapes, newShape]); setSelectedShape(newShape.id); setSelectedTool('select');
    }
  };

  const updateSelected = (updates: Partial<CanvasShape>) => {
    if (!selectedShape) return;
    setShapes(shapes.map(s => s.id === selectedShape ? { ...s, ...updates } : s));
  };
  const selected = shapes.find(s => s.id === selectedShape);
  const tools = [
    { id: 'select', icon: MousePointer, label: 'Select' },
    { id: 'rect', icon: Square, label: 'Rectangle' },
    { id: 'circle', icon: Circle, label: 'Circle' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'line', icon: Minus, label: 'Line' },
    { id: 'pen', icon: PenTool, label: 'Pen' },
  ];
  const canvasPresets = [{ name: 'A4', w: 595, h: 842 }, { name: 'A3', w: 842, h: 1191 }, { name: 'Square', w: 600, h: 600 }, { name: 'Banner', w: 1200, h: 400 }];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="h-12 border-b border-white/[0.06] flex items-center px-3 gap-1 bg-[#0c0c1a]">
        <div className="flex items-center gap-1">
          {tools.map((tool) => (
            <button key={tool.id} onClick={() => setSelectedTool(tool.id)} title={tool.label}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${selectedTool === tool.id ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'}`}>
              <tool.icon className="w-4 h-4" />
            </button>
          ))}
        </div>
        <div className="w-px h-6 bg-white/[0.06] mx-2" />
        <div className="flex items-center gap-1">
          {[Undo, Redo, Copy].map((Icon, i) => (
            <button key={i} className="w-9 h-9 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all">
              <Icon className="w-4 h-4" />
            </button>
          ))}
          <button onClick={() => selectedShape && setShapes(shapes.filter(s => s.id !== selectedShape))}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-white/30">Canvas:</span>
          <Select value={`${canvasSize.w}x${canvasSize.h}`} onValueChange={(v) => { const [w, h] = v.split('x').map(Number); setCanvasSize({ w, h }); }}>
            <SelectTrigger className="w-28 h-7 bg-white/[0.04] border-white/[0.08] text-xs text-white/70">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a2e] border-white/[0.1]">
              {canvasPresets.map(p => <SelectItem key={p.name} value={`${p.w}x${p.h}`} className="text-xs text-white/70">{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <button onClick={() => setZoom(Math.max(25, zoom - 25))} className="w-7 h-7 rounded flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.04]"><ZoomOut className="w-3.5 h-3.5" /></button>
          <span className="text-xs text-white/30 w-10 text-center">{zoom}%</span>
          <button onClick={() => setZoom(Math.min(200, zoom + 25))} className="w-7 h-7 rounded flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.04]"><ZoomIn className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="w-56 border-r border-white/[0.06] bg-[#0c0c1a] flex flex-col">
          <div className="flex border-b border-white/[0.06]">
            {['templates', 'shapes', 'text', 'uploads'].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2 text-[10px] font-medium capitalize transition-all ${activeTab === tab ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-white/30 hover:text-white/50'}`}>{tab}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {activeTab === 'templates' && <div className="space-y-2">
              {DESIGN_TEMPLATES.map((t) => (
                <div key={t.id} className="p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] cursor-pointer group transition-all">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400/60" />
                    <div><p className="text-xs text-white/70 group-hover:text-white/90">{t.name}</p><p className="text-[10px] text-white/30">{t.size}</p></div>
                  </div>
                </div>
              ))}
            </div>}
            {activeTab === 'shapes' && <div className="grid grid-cols-2 gap-2">
              {[{ icon: Square, label: 'Square' }, { icon: Circle, label: 'Circle' }, { icon: Triangle, label: 'Triangle' }, { icon: Hexagon, label: 'Hexagon' }, { icon: Star, label: 'Star' }, { icon: Octagon, label: 'Octagon' }].map((s) => (
                <button key={s.label} onClick={() => { if (s.label === 'Square') setSelectedTool('rect'); if (s.label === 'Circle') setSelectedTool('circle'); }}
                  className="aspect-square rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] flex flex-col items-center justify-center gap-1 transition-all">
                  <s.icon className="w-5 h-5 text-white/40" /><span className="text-[10px] text-white/30">{s.label}</span>
                </button>
              ))}
            </div>}
            {activeTab === 'text' && <div className="space-y-2">
              {[{ name: 'Heading', size: '32px', cls: 'font-bold text-lg' }, { name: 'Subheading', size: '24px', cls: 'font-semibold text-base' }, { name: 'Body', size: '16px', cls: 'text-sm' }, { name: 'Caption', size: '12px', cls: 'italic text-xs' }].map((t) => (
                <button key={t.name} onClick={() => setSelectedTool('text')} className="w-full p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] text-left transition-all">
                  <p className={`text-white/70 ${t.cls}`}>{t.name}</p><p className="text-[10px] text-white/30 mt-0.5">{t.size}</p>
                </button>
              ))}
            </div>}
            {activeTab === 'uploads' && <div className="space-y-2">
              <div className="border border-dashed border-white/[0.1] rounded-lg p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-white/[0.2] transition-all">
                <Upload className="w-6 h-6 text-white/20" /><span className="text-[10px] text-white/30 text-center">Drop images here</span>
              </div>
              {['logo_kobe.png', 'pattern_1.jpg', 'mascot.svg', 'team_photo.jpg', 'banner_bg.png'].map((f) => (
                <div key={f} className="p-2 rounded-lg bg-white/[0.02] flex items-center gap-2"><Image className="w-4 h-4 text-white/30" /><span className="text-[10px] text-white/50 truncate">{f}</span></div>
              ))}
            </div>}
          </div>
        </div>
        <div className="flex-1 bg-[#080810] overflow-auto flex items-center justify-center p-8">
          <div className="relative shadow-2xl" style={{ width: canvasSize.w, height: canvasSize.h, transform: `scale(${zoom / 100})`, transformOrigin: 'center center' }}>
            <canvas ref={canvasRef} width={canvasSize.w} height={canvasSize.h} onClick={handleCanvasClick} className="cursor-crosshair" style={{ width: canvasSize.w, height: canvasSize.h }} />
          </div>
        </div>
        <div className="w-56 border-l border-white/[0.06] bg-[#0c0c1a] p-3 overflow-auto">
          <h3 className="text-xs font-semibold text-white mb-3">Properties</h3>
          {selected ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {['x', 'y', 'w', 'h'].map((prop) => (
                  <div key={prop}>
                    <label className="text-[10px] text-white/30 uppercase">{prop}</label>
                    <Input type="number" value={Math.round(selected[prop as keyof CanvasShape] as number)}
                      onChange={(e) => updateSelected({ [prop]: Number(e.target.value) })}
                      className="h-7 bg-white/[0.04] border-white/[0.08] text-xs text-white/70" />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-[10px] text-white/30">Fill Color</label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={selected.fill === 'transparent' ? '#000000' : selected.fill} onChange={(e) => updateSelected({ fill: e.target.value })} className="w-7 h-7 rounded border-0 cursor-pointer" />
                  <Input value={selected.fill} onChange={(e) => updateSelected({ fill: e.target.value })} className="h-7 flex-1 bg-white/[0.04] border-white/[0.08] text-xs text-white/70" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-white/30">Opacity</label>
                <Slider value={[selected.opacity * 100]} onValueChange={([v]) => updateSelected({ opacity: v / 100 })} min={0} max={100} step={1} className="mt-1" />
                <span className="text-[10px] text-white/30">{Math.round(selected.opacity * 100)}%</span>
              </div>
              {selected.text !== undefined && <div>
                <label className="text-[10px] text-white/30">Text</label>
                <Input value={selected.text} onChange={(e) => updateSelected({ text: e.target.value })} className="h-7 bg-white/[0.04] border-white/[0.08] text-xs text-white/70" />
              </div>}
              {selected.fontSize !== undefined && <div>
                <label className="text-[10px] text-white/30">Font Size</label>
                <Input type="number" value={selected.fontSize} onChange={(e) => updateSelected({ fontSize: Number(e.target.value) })} className="h-7 bg-white/[0.04] border-white/[0.08] text-xs text-white/70" />
              </div>}
              <div className="pt-2 border-t border-white/[0.06]">
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => { const idx = shapes.findIndex(s => s.id === selected.id); if (idx < shapes.length - 1) { const ns = [...shapes]; [ns[idx], ns[idx + 1]] = [ns[idx + 1], ns[idx]]; setShapes(ns); } }}
                    className="h-7 text-[10px] text-white/40 hover:text-white/70"><ArrowUp className="w-3 h-3 mr-1" />Up</Button>
                  <Button size="sm" variant="ghost" onClick={() => { const idx = shapes.findIndex(s => s.id === selected.id); if (idx > 0) { const ns = [...shapes]; [ns[idx], ns[idx - 1]] = [ns[idx - 1], ns[idx]]; setShapes(ns); } }}
                    className="h-7 text-[10px] text-white/40 hover:text-white/70"><ArrowDown className="w-3 h-3 mr-1" />Down</Button>
                </div>
                <Button size="sm" variant="ghost" onClick={() => { setShapes(shapes.filter(s => s.id !== selected.id)); setSelectedShape(null); }}
                  className="h-7 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10 mt-1 w-full"><Trash2 className="w-3 h-3 mr-1" />Delete</Button>
              </div>
            </div>
          ) : <p className="text-xs text-white/30">Select a shape to edit properties</p>}
        </div>
      </div>
      <div className="h-8 border-t border-white/[0.06] bg-[#0c0c1a] flex items-center px-3 gap-4">
        <span className="text-[10px] text-white/30">{shapes.length} elements</span>
        <span className="text-[10px] text-white/30">{canvasSize.w} x {canvasSize.h} px</span>
        {selected && <span className="text-[10px] text-cyan-400">Selected: {selected.type}</span>}
      </div>
    </div>
  );
}

/* ================================================================
   MODULE 3: JERSEY DESIGNER
   ================================================================ */
function JerseyDesignerModule() {
  const [baseColor, setBaseColor] = useState('#1e40af');
  const [sleeveColor, setSleeveColor] = useState('#1e3a5f');
  const [collarColor, setCollarColor] = useState('#dc2626');
  const [showStripes, setShowStripes] = useState(true);
  const [stripeColor, setStripeColor] = useState('#ffffff');
  const [teamName, setTeamName] = useState('SIMBA SC');
  const [playerName, setPlayerName] = useState('MSELEMU');
  const [playerNumber, setPlayerNumber] = useState('10');
  const [numberSize, setNumberSize] = useState(80);
  const [selectedTemplate, setSelectedTemplate] = useState('1');
  const [view, setView] = useState<'front' | 'back'>('front');
  const [showBadge, setShowBadge] = useState(true);
  const [fontFamily, setFontFamily] = useState('Arial Black');
  const fonts = ['Arial Black', 'Impact', 'Bebas Neue', 'Montserrat', 'Oswald', 'Roboto'];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
        <div><h1 className="text-lg font-bold text-white">Jersey Designer</h1><p className="text-white/40 text-xs">Customize team jerseys and apparel</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="border-white/[0.1] text-white/70 hover:bg-white/[0.05] hover:text-white text-xs"><Save className="w-3.5 h-3.5 mr-1" /> Save</Button>
          <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs"><Download className="w-3.5 h-3.5 mr-1" /> Export</Button>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="w-72 border-r border-white/[0.06] bg-[#0c0c1a] p-4 overflow-y-auto">
          <div className="mb-4">
            <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Template</label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {JERSEY_TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => setSelectedTemplate(t.id)}
                  className={`p-2 rounded-lg border transition-all ${selectedTemplate === t.id ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'}`}>
                  <Shirt className={`w-5 h-5 mx-auto ${selectedTemplate === t.id ? 'text-cyan-400' : 'text-white/30'}`} />
                  <span className="text-[9px] text-white/40 mt-1 block">{t.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="mb-4 space-y-3">
            {[{ label: 'Base Color', val: baseColor, set: setBaseColor }, { label: 'Sleeve Color', val: sleeveColor, set: setSleeveColor }, { label: 'Collar Color', val: collarColor, set: setCollarColor }].map((c) => (
              <div key={c.label}>
                <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">{c.label}</label>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {colorPresets.map((p) => (
                    <button key={p} onClick={() => c.set(p)} className={`w-6 h-6 rounded-full border-2 transition-all ${c.val === p ? 'border-white scale-110' : 'border-transparent hover:border-white/30'}`} style={{ backgroundColor: p }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Stripes</label>
              <Switch checked={showStripes} onCheckedChange={setShowStripes} />
            </div>
            {showStripes && <div className="flex flex-wrap gap-1.5 mt-2">
              {colorPresets.map((c) => <button key={c} onClick={() => setStripeColor(c)} className={`w-6 h-6 rounded-full border-2 transition-all ${stripeColor === c ? 'border-white scale-110' : 'border-transparent hover:border-white/30'}`} style={{ backgroundColor: c }} />)}
            </div>}
          </div>
          <div className="mb-4 space-y-3">
            <div><label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Team Name</label><Input value={teamName} onChange={(e) => setTeamName(e.target.value.toUpperCase())} className="h-8 mt-1 bg-white/[0.04] border-white/[0.08] text-xs text-white/70" /></div>
            <div><label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Player Name</label><Input value={playerName} onChange={(e) => setPlayerName(e.target.value.toUpperCase())} className="h-8 mt-1 bg-white/[0.04] border-white/[0.08] text-xs text-white/70" /></div>
            <div><label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Player Number</label><Input value={playerNumber} onChange={(e) => setPlayerNumber(e.target.value)} className="h-8 mt-1 bg-white/[0.04] border-white/[0.08] text-xs text-white/70" /></div>
            <div><label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Font</label>
              <Select value={fontFamily} onValueChange={setFontFamily}>
                <SelectTrigger className="h-8 mt-1 bg-white/[0.04] border-white/[0.08] text-xs text-white/70"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-white/[0.1]">{fonts.map(f => <SelectItem key={f} value={f} className="text-xs text-white/70">{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Number Size</label><Slider value={[numberSize]} onValueChange={([v]) => setNumberSize(v)} min={40} max={140} className="mt-2" /></div>
          </div>
          <div className="flex items-center justify-between"><label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Sleeve Badge</label><Switch checked={showBadge} onCheckedChange={setShowBadge} /></div>
          <div className="mt-4">
            <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Team Logo</label>
            <div className="mt-2 border border-dashed border-white/[0.1] rounded-lg p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-white/[0.2] transition-all">
              <Upload className="w-5 h-5 text-white/20" /><span className="text-[10px] text-white/30 text-center">Drop logo here</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Export Options</label>
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between p-2 rounded bg-white/[0.02]">
                <span className="text-[10px] text-white/50">Include Bleed</span>
                <Switch defaultChecked  />
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-white/[0.02]">
                <span className="text-[10px] text-white/50">CMYK Mode</span>
                <Switch defaultChecked  />
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-white/[0.02]">
                <span className="text-[10px] text-white/50">300 DPI</span>
                <Switch defaultChecked  />
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-white/[0.02]">
                <span className="text-[10px] text-white/50">Cut Line</span>
                <Switch />
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Size Guide</label>
            <div className="mt-2 grid grid-cols-3 gap-1">
              {['XS', 'S', 'M', 'L', 'XL', '2XL'].map((s) => (
                <button key={s} className="py-1.5 rounded bg-white/[0.02] border border-white/[0.04] text-[10px] text-white/40 hover:bg-white/[0.06] hover:text-white/60 transition-all">{s}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center bg-[#080810] overflow-auto">
          <div className="flex items-center gap-1 mb-4 p-1 rounded-lg bg-white/[0.04]">
            <button onClick={() => setView('front')} className={`px-3 py-1.5 rounded-md text-xs transition-all ${view === 'front' ? 'bg-cyan-500/20 text-cyan-400' : 'text-white/30 hover:text-white/50'}`}>Front View</button>
            <button onClick={() => setView('back')} className={`px-3 py-1.5 rounded-md text-xs transition-all ${view === 'back' ? 'bg-cyan-500/20 text-cyan-400' : 'text-white/30 hover:text-white/50'}`}>Back View</button>
          </div>
          <div className="relative w-80 h-96">
            <div className="absolute inset-x-8 top-8 bottom-8 rounded-2xl transition-all duration-300" style={{ backgroundColor: baseColor }}>
              {showStripes && <><div className="absolute inset-x-0 top-[20%] h-3 transition-all" style={{ backgroundColor: stripeColor }} /><div className="absolute inset-x-0 top-[28%] h-3 transition-all" style={{ backgroundColor: stripeColor }} /></>}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-10 rounded-b-full transition-all" style={{ backgroundColor: collarColor }} />
              {view === 'front' && teamName && <div className="absolute top-[38%] left-1/2 -translate-x-1/2 text-white font-black text-center leading-tight tracking-wider transition-all" style={{ fontFamily, fontSize: teamName.length > 8 ? '14px' : '18px', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>{teamName}</div>}
              {view === 'back' && playerName && <div className="absolute top-[15%] left-1/2 -translate-x-1/2 text-white font-black text-center transition-all" style={{ fontFamily, fontSize: '16px', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>{playerName}</div>}
              {view === 'back' && playerNumber && <div className="absolute top-[32%] left-1/2 -translate-x-1/2 text-white font-black text-center transition-all" style={{ fontFamily, fontSize: `${numberSize}px`, textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>{playerNumber}</div>}
              {view === 'front' && playerNumber && <div className="absolute top-[52%] left-1/2 -translate-x-1/2 text-white/20 font-black text-center transition-all" style={{ fontFamily, fontSize: `${numberSize * 0.5}px` }}>{playerNumber}</div>}
              {showBadge && view === 'front' && <div className="absolute top-[18%] right-[12%] w-8 h-8 rounded-full bg-yellow-400 border-2 border-white/50 flex items-center justify-center"><Star className="w-4 h-4 text-yellow-800 fill-yellow-800" /></div>}
            </div>
            <div className="absolute left-0 top-12 w-12 h-32 rounded-l-xl transition-all" style={{ backgroundColor: sleeveColor, transform: 'rotate(12deg)', transformOrigin: 'top right' }} />
            <div className="absolute right-0 top-12 w-12 h-32 rounded-r-xl transition-all" style={{ backgroundColor: sleeveColor, transform: 'rotate(-12deg)', transformOrigin: 'top left' }} />
          </div>
        </div>
        <div className="w-52 border-l border-white/[0.06] bg-[#0c0c1a] p-3">
          <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Mockup Templates</label>
          <div className="space-y-2 mt-2">
            {[{ name: 'Simba Home 2024', colors: ['#dc2626', '#ffffff'] }, { name: 'Yanga Away Kit', colors: ['#16a34a', '#ffd700'] }, { name: 'Azam FC Third', colors: ['#1e40af', '#60a5fa'] }, { name: 'School Uniform', colors: ['#1f2937', '#f59e0b'] }, { name: 'Corporate Polo', colors: ['#0e7490', '#ffffff'] }, { name: 'Boda Safety', colors: ['#f59e0b', '#1f2937'] }].map((m, i) => (
              <div key={i} className="p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] cursor-pointer group transition-all">
                <div className="flex items-center gap-2 mb-1"><Shirt className="w-4 h-4 text-white/30" /><div className="flex gap-1">{m.colors.map((c, j) => <div key={j} className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} />)}</div></div>
                <p className="text-[10px] text-white/50 group-hover:text-white/70">{m.name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   MODULE 4: 3D PREVIEW (CSS 3D TRANSFORMS)
   ================================================================ */
function ThreeDPreviewModule() {
  const [product, setProduct] = useState('tshirt');
  const [baseColor, setBaseColor] = useState('#1e40af');
  const [rotateY, setRotateY] = useState(-20);
  const [rotateX, setRotateX] = useState(-5);
  const [autoRotate, setAutoRotate] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ x: 0, y: 0 });
  const products = [
    { id: 'tshirt', name: 'T-Shirt', icon: Shirt }, { id: 'jersey', name: 'Jersey', icon: Shirt },
    { id: 'mug', name: 'Mug', icon: Coffee }, { id: 'cap', name: 'Cap', icon: HardHat },
    { id: 'tote', name: 'Tote Bag', icon: ShoppingBag }, { id: 'phone', name: 'Phone Case', icon: Smartphone },
  ];

  useEffect(() => { if (!autoRotate) return; const interval = setInterval(() => { setRotateY((prev) => prev + 0.5); }, 30); return () => clearInterval(interval); }, [autoRotate]);

  const handleMouseDown = (e: React.MouseEvent) => { setIsDragging(true); dragRef.current = { x: e.clientX, y: e.clientY }; };
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setRotateY((prev) => prev + dx * 0.5);
    setRotateX((prev) => Math.max(-45, Math.min(45, prev + dy * 0.5)));
    dragRef.current = { x: e.clientX, y: e.clientY };
  }, [isDragging]);
  const handleMouseUp = useCallback(() => { setIsDragging(false); }, []);
  useEffect(() => {
    if (isDragging) { window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp); return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); }; }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-white/[0.06]"><h1 className="text-lg font-bold text-white">3D Preview</h1><p className="text-white/40 text-xs">Interactive product visualization</p></div>
      <div className="flex-1 flex overflow-hidden">
        <div className="w-48 border-r border-white/[0.06] bg-[#0c0c1a] p-3">
          <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Products</label>
          <div className="space-y-1.5 mt-2">
            {products.map((p) => {
              const Icon = p.icon;
              return (
                <button key={p.id} onClick={() => setProduct(p.id)} className={`w-full flex items-center gap-2 p-2 rounded-lg border transition-all ${product === p.id ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-transparent bg-white/[0.02] hover:bg-white/[0.04]'}`}>
                  <Icon className={`w-4 h-4 ${product === p.id ? 'text-cyan-400' : 'text-white/30'}`} /><span className={`text-xs ${product === p.id ? 'text-cyan-400' : 'text-white/50'}`}>{p.name}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-6">
            <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Base Color</label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {colorPresets.slice(0, 8).map((c) => <button key={c} onClick={() => setBaseColor(c)} className={`w-7 h-7 rounded-full border-2 transition-all ${baseColor === c ? 'border-white scale-110' : 'border-transparent hover:border-white/30'}`} style={{ backgroundColor: c }} />)}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Design Overlay</label>
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Show Design</span>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Opacity</span>
                <Slider defaultValue={[85]} min={0} max={100} className="w-20" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Position</span>
                <div className="flex gap-1">
                  <button className="w-6 h-6 rounded bg-white/[0.04] flex items-center justify-center text-white/30 hover:text-white/60">T</button>
                  <button className="w-6 h-6 rounded bg-cyan-500/20 flex items-center justify-center text-cyan-400">C</button>
                  <button className="w-6 h-6 rounded bg-white/[0.04] flex items-center justify-center text-white/30 hover:text-white/60">B</button>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 space-y-2">
            <Button size="sm" variant="outline" onClick={() => setAutoRotate(!autoRotate)} className={`w-full h-8 text-xs border-white/[0.1] ${autoRotate ? 'bg-cyan-500/20 text-cyan-400' : 'text-white/50'}`}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${autoRotate ? 'animate-spin' : ''}`} />Auto Rotate
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setRotateY(-20); setRotateX(-5); }} className="w-full h-8 text-xs border-white/[0.1] text-white/50 hover:text-white">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Reset View
            </Button>
            <Button size="sm" variant="outline" className="w-full h-8 text-xs border-white/[0.1] text-white/50 hover:text-white">
              <Upload className="w-3.5 h-3.5 mr-1.5" />Upload Design
            </Button>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center bg-[#080810]">
          <div className="relative w-96 h-96 cursor-grab active:cursor-grabbing" onMouseDown={handleMouseDown} style={{ perspective: '800px' }}>
            <div className="absolute inset-0 flex items-center justify-center transition-transform duration-75" style={{ transformStyle: 'preserve-3d', transform: `rotateY(${rotateY}deg) rotateX(${rotateX}deg)` }}>
              {product === 'tshirt' && (
                <div className="relative w-56 h-72" style={{ transformStyle: 'preserve-3d' }}>
                  <div className="absolute inset-0 rounded-xl shadow-2xl flex items-center justify-center overflow-hidden" style={{ backgroundColor: baseColor, transform: 'translateZ(12px)' }}>
                    <div className="text-center"><p className="text-white font-black text-lg tracking-wider" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>KOBE</p><p className="text-white/60 text-xs">PRINT</p></div>
                    <div className="absolute inset-4 border-2 border-white/20 rounded-lg" />
                  </div>
                  <div className="absolute inset-0 rounded-xl shadow-2xl" style={{ backgroundColor: baseColor, transform: 'translateZ(-12px) rotateY(180deg)' }}>
                    <div className="absolute inset-0 flex items-center justify-center"><p className="text-white/30 font-black text-4xl">01</p></div>
                  </div>
                  <div className="absolute left-0 top-4 bottom-4 w-6" style={{ backgroundColor: baseColor, transform: 'rotateY(-90deg) translateZ(12px)', transformOrigin: 'left center' }} />
                  <div className="absolute right-0 top-4 bottom-4 w-6" style={{ backgroundColor: baseColor, transform: 'rotateY(90deg) translateZ(12px)', transformOrigin: 'right center' }} />
                  <div className="absolute -left-10 top-0 w-12 h-32 rounded-l-xl" style={{ backgroundColor: baseColor, transform: 'rotateY(-60deg) translateZ(8px)', transformOrigin: 'right center' }} />
                  <div className="absolute -right-10 top-0 w-12 h-32 rounded-r-xl" style={{ backgroundColor: baseColor, transform: 'rotateY(60deg) translateZ(8px)', transformOrigin: 'left center' }} />
                </div>
              )}
              {product === 'mug' && (
                <div className="relative w-40 h-52" style={{ transformStyle: 'preserve-3d' }}>
                  <div className="absolute inset-0 rounded-2xl shadow-2xl flex items-center justify-center border-4" style={{ backgroundColor: baseColor, borderColor: baseColor, transform: 'translateZ(16px)' }}>
                    <div className="text-center"><Coffee className="w-12 h-12 text-white/40 mx-auto mb-2" /><p className="text-white font-bold">COFFEE</p></div>
                  </div>
                  <div className="absolute inset-0 rounded-2xl shadow-2xl" style={{ backgroundColor: baseColor, transform: 'translateZ(-16px) rotateY(180deg)' }} />
                  <div className="absolute left-0 top-4 bottom-4 w-10 rounded-l-full" style={{ backgroundColor: baseColor, transform: 'rotateY(-90deg) translateZ(16px)', transformOrigin: 'left center' }} />
                  <div className="absolute right-0 top-4 bottom-4 w-10 rounded-r-full" style={{ backgroundColor: baseColor, transform: 'rotateY(90deg) translateZ(16px)', transformOrigin: 'right center' }} />
                  <div className="absolute -right-16 top-12 w-14 h-24 rounded-r-3xl border-4" style={{ borderColor: baseColor, transform: 'rotateY(45deg) translateZ(8px)' }} />
                </div>
              )}
              {product === 'jersey' && (
                <div className="relative w-56 h-72" style={{ transformStyle: 'preserve-3d' }}>
                  <div className="absolute inset-0 rounded-xl shadow-2xl flex flex-col items-center justify-center" style={{ backgroundColor: baseColor, transform: 'translateZ(10px)' }}>
                    <div className="absolute top-8 left-1/2 -translate-x-1/2 w-20 h-8 rounded-b-full bg-red-600" />
                    <p className="text-white font-black text-xl mt-4 tracking-wider">SIMBA</p>
                    <p className="text-white font-black text-5xl mt-4">10</p>
                  </div>
                  <div className="absolute inset-0 rounded-xl shadow-2xl" style={{ backgroundColor: baseColor, transform: 'translateZ(-10px) rotateY(180deg)' }} />
                </div>
              )}
              {product === 'cap' && (
                <div className="relative w-48 h-36" style={{ transformStyle: 'preserve-3d' }}>
                  <div className="absolute inset-0 rounded-t-full shadow-2xl flex items-center justify-center" style={{ backgroundColor: baseColor, transform: 'translateZ(14px)' }}><p className="text-white font-bold text-sm tracking-widest mt-4">KOBE</p></div>
                  <div className="absolute -bottom-2 left-0 right-0 h-4 rounded-full" style={{ backgroundColor: baseColor, transform: 'translateZ(14px)' }} />
                  <div className="absolute -bottom-2 -left-8 w-16 h-4 rounded-l-full" style={{ backgroundColor: baseColor, transform: 'rotateX(60deg) translateZ(4px)' }} />
                </div>
              )}
              {product === 'tote' && (
                <div className="relative w-48 h-56" style={{ transformStyle: 'preserve-3d' }}>
                  <div className="absolute inset-0 rounded-lg shadow-2xl flex items-center justify-center" style={{ backgroundColor: baseColor, transform: 'translateZ(8px)' }}><ShoppingBag className="w-16 h-16 text-white/30" /></div>
                  <div className="absolute -top-12 left-8 w-4 h-16 rounded-full border-4" style={{ borderColor: baseColor, transform: 'translateZ(8px)' }} />
                  <div className="absolute -top-12 right-8 w-4 h-16 rounded-full border-4" style={{ borderColor: baseColor, transform: 'translateZ(8px)' }} />
                </div>
              )}
              {product === 'phone' && (
                <div className="relative w-40 h-72" style={{ transformStyle: 'preserve-3d' }}>
                  <div className="absolute inset-0 rounded-3xl shadow-2xl flex items-center justify-center border-4 border-gray-800" style={{ backgroundColor: baseColor, transform: 'translateZ(8px)' }}><Smartphone className="w-12 h-12 text-white/30" /></div>
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-16 h-1 rounded-full bg-black/50" style={{ transform: 'translateZ(12px)' }} />
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-white/30 mt-4">Click and drag to rotate</p>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-2"><span className="text-[10px] text-white/30">Y</span><Slider value={[rotateY + 180]} onValueChange={([v]) => setRotateY(v - 180)} min={0} max={360} className="w-24" /></div>
            <div className="flex items-center gap-2"><span className="text-[10px] text-white/30">X</span><Slider value={[rotateX + 45]} onValueChange={([v]) => setRotateX(v - 45)} min={0} max={90} className="w-24" /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   MODULE 5: AI GENERATOR
   ================================================================ */
function AIGeneratorModule() {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('Logo');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generations, setGenerations] = useState(AI_GENERATIONS);
  const styles = ['Logo', 'Pattern', 'Illustration', 'Typography', 'Minimal', 'Vintage', 'Sporty', 'Corporate'];

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setTimeout(() => {
      const newGen = { id: Date.now().toString(), prompt, style: selectedStyle, color: `hsl(${Math.random() * 360}, 60%, 50%)` };
      setGenerations([newGen, ...generations]); setIsGenerating(false); setPrompt('');
    }, 2500);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-white/[0.06]"><h1 className="text-lg font-bold text-white">AI Design Generator</h1><p className="text-white/40 text-xs">Generate unique designs with AI</p></div>
      <div className="flex-1 overflow-auto p-6">
        <Card className="bg-white/[0.03] border-white/[0.06] mb-6">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe your design... e.g., 'Bold lion logo for sports team, vector style, red and black colors'"
                  className="w-full h-20 bg-white/[0.04] border border-white/[0.08] rounded-lg p-3 text-sm text-white/70 placeholder:text-white/20 resize-none focus:outline-none focus:border-violet-500/50" />
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={handleGenerate} disabled={isGenerating || !prompt.trim()} className="bg-violet-600 hover:bg-violet-500 text-white h-10 px-6">
                  {isGenerating ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}{isGenerating ? 'Generating...' : 'Generate'}
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-xs text-white/30">Style:</span>
              {styles.map((s) => (
                <button key={s} onClick={() => setSelectedStyle(s)} className={`px-3 py-1 rounded-full text-xs transition-all ${selectedStyle === s ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'bg-white/[0.02] text-white/40 border border-white/[0.06] hover:bg-white/[0.05]'}`}>{s}</button>
              ))}
            </div>
          </CardContent>
        </Card>
        {isGenerating && (
          <div className="mb-6 flex items-center justify-center p-8 rounded-xl bg-white/[0.02] border border-white/[0.06] border-dashed">
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-16 h-16"><div className="absolute inset-0 rounded-full border-4 border-violet-500/20" /><div className="absolute inset-0 rounded-full border-4 border-t-violet-500 animate-spin" /></div>
              <p className="text-sm text-violet-400">Creating your design...</p>
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Generated Designs</h3>
          <span className="text-xs text-white/30">{generations.length} designs</span>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {generations.map((gen) => (
            <Card key={gen.id} className="bg-white/[0.03] border-white/[0.06] overflow-hidden group">
              <div className="aspect-square relative overflow-hidden" style={{ backgroundColor: gen.color + '20' }}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: gen.color + '40' }}><Palette className="w-8 h-8" style={{ color: gen.color }} /></div>
                    <p className="text-[10px] text-white/30 px-2 line-clamp-2">{gen.prompt}</p>
                  </div>
                </div>
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"><Download className="w-4 h-4 text-white" /></button>
                  <button className="w-8 h-8 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 flex items-center justify-center transition-all"><Palette className="w-4 h-4 text-cyan-400" /></button>
                </div>
              </div>
              <CardContent className="p-2.5">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] border-white/[0.1] text-white/40">{gen.style}</Badge>
                  <button className="text-white/20 hover:text-white/60 transition-all"><Star className="w-3.5 h-3.5" /></button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-6 mb-6">
          <h3 className="text-sm font-semibold text-white mb-3">Prompt Ideas</h3>
          <div className="flex flex-wrap gap-2">
            {[
              'Minimal geometric lion logo, gold on black',
              'Tropical leaf pattern for swimwear, vector',
              'Bold safari typography, distressed texture',
              'Tech startup monogram, blue gradient',
              'Sports team eagle mascot, fierce pose',
              'Coffee cup illustration, hand drawn style',
              'African wax print inspired pattern',
              'Fitness gym logo, barbell and shield',
            ].map((idea) => (
              <button key={idea} onClick={() => setPrompt(idea)} className="px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-[11px] text-white/40 hover:text-white/70 hover:bg-white/[0.06] hover:border-white/[0.1] transition-all">
                {idea.length > 35 ? idea.slice(0, 35) + '...' : idea}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-white mb-3">Recent Generations</h3>
          <div className="space-y-1">
            {generations.slice(0, 5).map((gen) => (
              <div key={gen.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-all">
                <div className="w-8 h-8 rounded-lg shrink-0" style={{ backgroundColor: gen.color + '30' }} />
                <div className="flex-1 min-w-0"><p className="text-xs text-white/60 truncate">{gen.prompt}</p></div>
                <Badge variant="outline" className="text-[10px] border-white/[0.1] text-white/30 shrink-0">{gen.style}</Badge>
                <button className="text-white/20 hover:text-white/50 transition-all shrink-0"><Download className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   MODULE 6: VINYL CUTTER
   ================================================================ */
function VinylCutterModule() {
  const [speed, setSpeed] = useState(45);
  const [pressure, setPressure] = useState(120);
  const [bladeOffset, setBladeOffset] = useState(0.25);
  const [passCount, setPassCount] = useState(1);
  const [cutMode, setCutMode] = useState('Cut');
  const [isConnected] = useState(true);
  const [jobs, setJobs] = useState<VinylJob[]>(VINYL_JOBS);
  const [selectedMaterial, setSelectedMaterial] = useState('Oracal 651');
  const materials = ['Oracal 651', 'Siser HTV', 'Reflective Vinyl', 'Glitter HTV', 'DTF Film'];

  const toggleJobStatus = (id: string) => {
    setJobs(jobs.map(j => {
      if (j.id === id) { if (j.status === 'Queued') return { ...j, status: 'Cutting' as const, progress: 0 }; if (j.status === 'Cutting') return { ...j, status: 'Completed' as const, progress: 100 }; return { ...j, status: 'Queued' as const, progress: 0 }; }
      return j;
    }));
  };
  const deleteJob = (id: string) => { setJobs(jobs.filter(j => j.id !== id)); };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
        <div><h1 className="text-lg font-bold text-white">Vinyl Cutter</h1><p className="text-white/40 text-xs">Roland GS-24 cutting management</p></div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${isConnected ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <span className={`text-xs ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}>{isConnected ? 'Connected' : 'Offline'}</span>
          </div>
          <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs h-8"><Play className="w-3.5 h-3.5 mr-1" /> Start Cut</Button>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 border-r border-white/[0.06] bg-[#0c0c1a] p-4 overflow-auto">
          <div className="mb-4">
            <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Material</label>
            <div className="space-y-1 mt-2">
              {materials.map((m) => (
                <button key={m} onClick={() => setSelectedMaterial(m)} className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${selectedMaterial === m ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' : 'bg-white/[0.02] text-white/50 hover:bg-white/[0.04] border border-transparent'}`}>{m}</button>
              ))}
            </div>
          </div>
          <div className="mb-4">
            <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Cut Settings</label>
            <div className="mt-2 space-y-3">
              <div><div className="flex justify-between text-xs mb-1"><span className="text-white/40">Speed</span><span className="text-cyan-400">{speed}%</span></div><Slider value={[speed]} onValueChange={([v]) => setSpeed(v)} min={1} max={100} /></div>
              <div><div className="flex justify-between text-xs mb-1"><span className="text-white/40">Pressure</span><span className="text-cyan-400">{pressure}g</span></div><Slider value={[pressure]} onValueChange={([v]) => setPressure(v)} min={50} max={300} /></div>
              <div><label className="text-[10px] text-white/40">Blade Offset</label><Input type="number" step={0.05} value={bladeOffset} onChange={(e) => setBladeOffset(Number(e.target.value))} className="h-7 mt-1 bg-white/[0.04] border-white/[0.08] text-xs text-white/70" /></div>
              <div><label className="text-[10px] text-white/40">Pass Count</label><div className="flex gap-1 mt-1">{[1, 2, 3].map((n) => <button key={n} onClick={() => setPassCount(n)} className={`flex-1 py-1 rounded text-xs transition-all ${passCount === n ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/[0.02] text-white/40 hover:bg-white/[0.04]'}`}>{n}</button>)}</div></div>
              <div><label className="text-[10px] text-white/40">Cut Mode</label><div className="flex gap-1 mt-1">{['Cut', 'Draw', 'Score'].map((m) => <button key={m} onClick={() => setCutMode(m)} className={`flex-1 py-1 rounded text-xs transition-all ${cutMode === m ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/[0.02] text-white/40 hover:bg-white/[0.04]'}`}>{m}</button>)}</div></div>
            </div>
          </div>
          <div><label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Upload SVG</label>
            <div className="mt-2 border border-dashed border-white/[0.1] rounded-lg p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-white/[0.2] transition-all">
              <Upload className="w-5 h-5 text-white/20" /><span className="text-[10px] text-white/30 text-center">Drop SVG file here</span>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <Card className="bg-white/[0.03] border-white/[0.06] mb-4">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center"><Scissors className="w-5 h-5 text-cyan-400" /></div>
                  <div><p className="text-sm font-semibold text-white">Roland GS-24</p><p className="text-xs text-white/30">{isConnected ? 'Ready to cut' : 'Check connection'}</p></div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="border-white/[0.1] text-white/50 h-8 text-xs"><Pause className="w-3.5 h-3.5 mr-1" /> Pause</Button>
                  <Button size="sm" variant="outline" className="border-white/[0.1] text-red-400 h-8 text-xs hover:bg-red-500/10"><Pause className="w-3.5 h-3.5 mr-1" /> Stop</Button>
                </div>
              </div>
              {jobs.find(j => j.status === 'Cutting') && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1"><span className="text-white/50">Current: {jobs.find(j => j.status === 'Cutting')?.design}</span><span className="text-cyan-400">{jobs.find(j => j.status === 'Cutting')?.progress}%</span></div>
                  <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden"><div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${jobs.find(j => j.status === 'Cutting')?.progress}%` }} /></div>
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="bg-white/[0.03] border-white/[0.06]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-white">Job Queue</h3><Button size="sm" variant="outline" className="border-white/[0.1] text-white/50 h-7 text-xs"><Plus className="w-3.5 h-3.5 mr-1" /> Add Job</Button></div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-white/[0.06]">{['Job ID', 'Design', 'Material', 'Size', 'Status', 'Progress', 'Actions'].map((h) => <th key={h} className="text-left text-[10px] text-white/30 font-medium py-2 px-2">{h}</th>)}</tr></thead>
                  <tbody>
                    {jobs.map((job) => (
                      <tr key={job.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 px-2 text-xs text-white/50 font-mono">{job.id}</td>
                        <td className="py-2.5 px-2 text-xs text-white/70">{job.design}</td>
                        <td className="py-2.5 px-2 text-xs text-white/50">{job.material}</td>
                        <td className="py-2.5 px-2 text-xs text-white/50">{job.size}</td>
                        <td className="py-2.5 px-2"><Badge className={`text-[10px] ${job.status === 'Cutting' ? 'bg-cyan-500/20 text-cyan-400' : job.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>{job.status}</Badge></td>
                        <td className="py-2.5 px-2"><div className="w-16 h-1 bg-white/[0.06] rounded-full overflow-hidden"><div className={`h-full rounded-full ${job.status === 'Completed' ? 'bg-emerald-500' : job.status === 'Cutting' ? 'bg-cyan-500' : 'bg-slate-500'}`} style={{ width: `${job.progress}%` }} /></div></td>
                        <td className="py-2.5 px-2"><div className="flex gap-1"><button onClick={() => toggleJobStatus(job.id)} className="w-7 h-7 rounded flex items-center justify-center text-white/30 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all">{job.status === 'Cutting' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}</button><button onClick={() => deleteJob(job.id)} className="w-7 h-7 rounded flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 className="w-3.5 h-3.5" /></button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="border-white/[0.1] text-white/50 text-xs h-8 hover:text-white"><Eye className="w-3.5 h-3.5 mr-1" /> Preview Path</Button>
            <Button variant="outline" className="border-white/[0.1] text-white/50 text-xs h-8 hover:text-white"><Settings className="w-3.5 h-3.5 mr-1" /> Advanced</Button>
          </div>
          {/* Material Thickness Guide */}
          <Card className="bg-white/[0.03] border-white/[0.06] mt-4">
            <CardContent className="p-4">
              <h3 className="text-xs font-semibold text-white mb-3">Recommended Settings by Material</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-white/[0.06]">{['Material', 'Speed', 'Pressure', 'Blade', 'Passes'].map((h) => <th key={h} className="text-left text-[10px] text-white/30 font-medium py-2 px-2">{h}</th>)}</tr></thead>
                  <tbody>
                    {[
                      { mat: 'Oracal 651', speed: '60%', pressure: '100g', blade: '45°', passes: 1 },
                      { mat: 'Siser HTV', speed: '30%', pressure: '180g', blade: '60°', passes: 1 },
                      { mat: 'Reflective', speed: '20%', pressure: '220g', blade: '60°', passes: 2 },
                      { mat: 'Glitter HTV', speed: '25%', pressure: '200g', blade: '60°', passes: 2 },
                      { mat: 'DTF Film', speed: '40%', pressure: '120g', blade: '45°', passes: 1 },
                    ].map((row) => (
                      <tr key={row.mat} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                        <td className="py-2 px-2 text-xs text-white/60">{row.mat}</td>
                        <td className="py-2 px-2 text-xs text-white/40 font-mono">{row.speed}</td>
                        <td className="py-2 px-2 text-xs text-white/40 font-mono">{row.pressure}</td>
                        <td className="py-2 px-2 text-xs text-white/40 font-mono">{row.blade}</td>
                        <td className="py-2 px-2 text-xs text-white/40 font-mono">{row.passes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   MODULE 7: PRINT JOBS (KANBAN)
   ================================================================ */
function PrintJobsModule() {
  const [jobs] = useState<PrintJob[]>(PRINT_JOBS);
  const [selectedJob, setSelectedJob] = useState<PrintJob | null>(null);
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');

  const columns: { id: PrintJob['status']; label: string; color: string }[] = [
    { id: 'Pending', label: 'Pending', color: 'border-t-slate-500' },
    { id: 'Printing', label: 'Printing', color: 'border-t-cyan-500' },
    { id: 'Finishing', label: 'Finishing', color: 'border-t-violet-500' },
    { id: 'Completed', label: 'Completed', color: 'border-t-emerald-500' },
  ];

  const filtered = useMemo(() => jobs.filter(j => {
    if (filterStatus !== 'All' && j.status !== filterStatus) return false;
    if (filterPriority !== 'All' && j.priority !== filterPriority) return false;
    return true;
  }), [jobs, filterStatus, filterPriority]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
        <div><h1 className="text-lg font-bold text-white">Print Jobs</h1><p className="text-white/40 text-xs">Manage production workflow</p></div>
        <div className="flex items-center gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32 h-8 bg-white/[0.04] border-white/[0.08] text-xs text-white/70"><Filter className="w-3.5 h-3.5 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent className="bg-[#1a1a2e] border-white/[0.1]">{['All', 'Pending', 'Printing', 'Finishing', 'Completed'].map(s => <SelectItem key={s} value={s} className="text-xs text-white/70">{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-32 h-8 bg-white/[0.04] border-white/[0.08] text-xs text-white/70"><SlidersHorizontal className="w-3.5 h-3.5 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent className="bg-[#1a1a2e] border-white/[0.1]">{['All', 'High', 'Medium', 'Low'].map(s => <SelectItem key={s} value={s} className="text-xs text-white/70">{s}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white h-8 text-xs"><Plus className="w-3.5 h-3.5 mr-1" /> New Job</Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-4 gap-3">
          {columns.map((col) => (
            <div key={col.id} className={`bg-white/[0.02] rounded-xl border-t-2 ${col.color} border-x border-b border-white/[0.04]`}>
              <div className="p-3 border-b border-white/[0.04] flex items-center justify-between">
                <span className="text-xs font-semibold text-white/70">{col.label}</span>
                <Badge className="text-[10px] bg-white/[0.04] text-white/40">{filtered.filter(j => j.status === col.id).length}</Badge>
              </div>
              <div className="p-2 space-y-2">
                {filtered.filter(j => j.status === col.id).map((job) => (
                  <div key={job.id} onClick={() => setSelectedJob(job)} className="p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.04] cursor-pointer transition-all group">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-white/30 font-mono">{job.id}</span>
                      <Badge className={`text-[9px] ${PRIORITY_COLORS[job.priority]}`}>{job.priority}</Badge>
                    </div>
                    <p className="text-xs text-white/70 font-medium mb-0.5">{job.product}</p>
                    <p className="text-[10px] text-white/30 mb-2">{job.customer}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1"><Clock className="w-3 h-3 text-white/20" /><span className="text-[9px] text-white/30">{job.dueDate}</span></div>
                      <span className="text-[9px] text-white/20">{job.method}</span>
                    </div>
                    <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="w-6 h-6 rounded flex items-center justify-center text-white/20 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"><Play className="w-3 h-3" /></button>
                      <button className="w-6 h-6 rounded flex items-center justify-center text-white/20 hover:text-amber-400 hover:bg-amber-500/10 transition-all"><Pause className="w-3 h-3" /></button>
                      <button className="w-6 h-6 rounded flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="bg-[#0f0f1e] border-white/[0.08] max-w-md">
          <DialogHeader><DialogTitle className="text-white flex items-center gap-2"><Printer className="w-5 h-5 text-cyan-400" />Job {selectedJob?.id}</DialogTitle></DialogHeader>
          {selectedJob && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[{ label: 'Product', val: selectedJob.product }, { label: 'Customer', val: selectedJob.customer }, { label: 'Quantity', val: `${selectedJob.qty} units` }, { label: 'Method', val: selectedJob.method }].map((f) => (
                  <div key={f.label} className="p-2.5 rounded-lg bg-white/[0.03]"><p className="text-[10px] text-white/30">{f.label}</p><p className="text-sm text-white/70">{f.val}</p></div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/30">Status:</span><Badge className={JOB_STATUS_COLORS[selectedJob.status]}>{selectedJob.status}</Badge>
                <span className="text-xs text-white/30 ml-2">Priority:</span><Badge className={PRIORITY_COLORS[selectedJob.priority]}>{selectedJob.priority}</Badge>
              </div>
              <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-white/30" /><span className="text-sm text-white/50">Due: {selectedJob.dueDate}</span></div>
              <div className="flex gap-2 pt-2">
                <Button className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs"><Play className="w-3.5 h-3.5 mr-1" /> Start</Button>
                <Button variant="outline" className="border-white/[0.1] text-white/50 text-xs hover:text-white"><Edit className="w-3.5 h-3.5 mr-1" /> Edit</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ================================================================
   MODULE 7b: PRODUCTION QUEUE
   ================================================================ */
function ProductionQueueModule() {
  const [queue] = useState<QueueItem[]>(PRODUCTION_QUEUE);
  const [filterMachine, setFilterMachine] = useState('All');
  const machines = ['All', 'Epson F2100', 'Roland BN-20', 'Epson DTF', 'Heat Press 1', 'Roland GS-24', 'DTF Oven', 'Sublimation'];
  const filtered = filterMachine === 'All' ? queue : queue.filter(q => q.machine === filterMachine);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
        <div><h1 className="text-lg font-bold text-white">Production Queue</h1><p className="text-white/40 text-xs">Real-time production tracking</p></div>
        <Select value={filterMachine} onValueChange={setFilterMachine}>
          <SelectTrigger className="w-40 h-8 bg-white/[0.04] border-white/[0.08] text-xs text-white/70"><Filter className="w-3.5 h-3.5 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent className="bg-[#1a1a2e] border-white/[0.1]">{machines.map(m => <SelectItem key={m} value={m} className="text-xs text-white/70">{m}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((item) => (
            <Card key={item.id} className="bg-white/[0.03] border-white/[0.06]">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                    <Gauge className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs text-white/30 font-mono">{item.id}</span>
                      <Badge className={`text-[10px] ${item.status === 'Running' ? 'bg-cyan-500/20 text-cyan-400' : item.status === 'Finishing' ? 'bg-violet-500/20 text-violet-400' : 'bg-slate-500/20 text-slate-400'}`}>{item.status}</Badge>
                    </div>
                    <p className="text-sm text-white/70 font-medium">{item.job}</p>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-[10px] text-white/30"><span className="text-white/50">Machine:</span> {item.machine}</span>
                      <span className="text-[10px] text-white/30"><span className="text-white/50">Operator:</span> {item.operator}</span>
                      <span className="text-[10px] text-white/30"><span className="text-white/50">Start:</span> {item.startTime}</span>
                      <span className="text-[10px] text-white/30"><span className="text-white/50">Est. End:</span> {item.estEnd}</span>
                    </div>
                  </div>
                  <div className="w-32 shrink-0">
                    <div className="flex justify-between text-xs mb-1"><span className="text-white/30">Progress</span><span className="text-cyan-400">{item.progress}%</span></div>
                    <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${item.progress}%` }} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: 'Queue Efficiency', value: '87%', icon: BarChart3, color: 'text-emerald-400' },
            { label: 'Avg. Job Time', value: '4.2 hrs', icon: Clock, color: 'text-cyan-400' },
            { label: 'Machine Utilization', value: '92%', icon: Waypoints, color: 'text-amber-400' },
          ].map((stat) => (
            <div key={stat.label} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-center gap-3">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              <div><p className="text-[10px] text-white/30">{stat.label}</p><p className="text-lg font-bold text-white">{stat.value}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   MODULE 8: PRODUCTS
   ================================================================ */
function ProductsModule() {
  const [products] = useState<ProductItem[]>(PRODUCTS);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase()));

  const getIcon = (icon: string) => {
    switch (icon) { case 'shirt': return Shirt; case 'coffee': return Coffee; case 'beanie': return HardHat; case 'hardhat': return HardHat; case 'shoppingbag': return ShoppingBag; default: return Box; }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
        <div><h1 className="text-lg font-bold text-white">Products</h1><p className="text-white/40 text-xs">Manage your product catalog</p></div>
        <div className="flex items-center gap-2">
          <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="pl-9 h-8 w-48 bg-white/[0.04] border-white/[0.08] text-xs text-white/70" /></div>
          <Button onClick={() => setShowAddForm(true)} size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white h-8 text-xs"><Plus className="w-3.5 h-3.5 mr-1" /> Add Product</Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-4 gap-4">
          {filtered.map((product) => {
            const Icon = getIcon(product.icon);
            return (
              <Card key={product.id} className="bg-white/[0.03] border-white/[0.06] hover:border-white/[0.1] transition-all group">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center"><Icon className="w-6 h-6 text-cyan-400/60" /></div>
                    <Switch defaultChecked={product.status === 'Active'} />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-0.5">{product.name}</h3>
                  <p className="text-xs text-white/30 mb-2">{product.category}</p>
                  <div className="flex items-center justify-between"><span className="text-sm font-bold text-emerald-400">TZS {product.basePrice.toLocaleString()}</span><Badge className="text-[10px] bg-white/[0.04] text-white/40">{product.method}</Badge></div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="bg-[#0f0f1e] border-white/[0.08]">
          <DialogHeader><DialogTitle className="text-white">Add New Product</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-xs text-white/40">Product Name</label><Input className="h-8 mt-1 bg-white/[0.04] border-white/[0.08] text-xs text-white/70" placeholder="Enter name" /></div>
            <div><label className="text-xs text-white/40">Category</label>
              <Select><SelectTrigger className="h-8 mt-1 bg-white/[0.04] border-white/[0.08] text-xs text-white/70"><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent className="bg-[#1a1a2e] border-white/[0.1]">{['Apparel', 'Drinkware', 'Accessories', 'Safety', 'Promotional'].map(c => <SelectItem key={c} value={c} className="text-xs text-white/70">{c}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><label className="text-xs text-white/40">Base Price (TZS)</label><Input type="number" className="h-8 mt-1 bg-white/[0.04] border-white/[0.08] text-xs text-white/70" placeholder="0" /></div>
            <div><label className="text-xs text-white/40">Print Method</label>
              <Select><SelectTrigger className="h-8 mt-1 bg-white/[0.04] border-white/[0.08] text-xs text-white/70"><SelectValue placeholder="Select method" /></SelectTrigger><SelectContent className="bg-[#1a1a2e] border-white/[0.1]">{['DTG', 'DTF', 'Sublimation', 'Transfer', 'Vinyl Cut', 'Embroidery', 'Screen Print'].map(m => <SelectItem key={m} value={m} className="text-xs text-white/70">{m}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs flex-1" onClick={() => setShowAddForm(false)}><Save className="w-3.5 h-3.5 mr-1" /> Save Product</Button>
              <Button variant="outline" className="border-white/[0.1] text-white/50 text-xs" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ================================================================
   MODULE 9: MATERIALS
   ================================================================ */
function MaterialsModule() {
  const [materials] = useState<MaterialItem[]>(MATERIALS);
  const [search, setSearch] = useState('');
  const filtered = materials.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || m.type.toLowerCase().includes(search.toLowerCase()));
  const lowStock = materials.filter(m => m.status === 'Low' || m.status === 'Out');

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
        <div><h1 className="text-lg font-bold text-white">Materials Inventory</h1><p className="text-white/40 text-xs">Track stock levels and supplies</p></div>
        <div className="flex items-center gap-2">
          <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search materials..." className="pl-9 h-8 w-48 bg-white/[0.04] border-white/[0.08] text-xs text-white/70" /></div>
          <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white h-8 text-xs"><Plus className="w-3.5 h-3.5 mr-1" /> Add Material</Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {lowStock.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-amber-400" /><span className="text-xs font-semibold text-amber-400">Low Stock Alerts</span></div>
            <div className="flex flex-wrap gap-2">{lowStock.map(m => <Badge key={m.id} className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20">{m.name}: {m.stock} {m.unit}</Badge>)}</div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          {filtered.map((material) => (
            <Card key={material.id} className="bg-white/[0.03] border-white/[0.06] hover:border-white/[0.1] transition-all">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg shrink-0 border border-white/[0.1]" style={{ backgroundColor: material.color + '30' }}><div className="w-full h-full rounded-lg" style={{ backgroundColor: material.color }} /></div>
                  <div className="flex-1 min-w-0"><h3 className="text-sm font-semibold text-white truncate">{material.name}</h3><p className="text-xs text-white/30">{material.type}</p></div>
                  <Badge className={`text-[10px] ${MATERIAL_STATUS_COLORS[material.status]}`}>{material.status}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="p-2 rounded bg-white/[0.02]"><p className="text-[10px] text-white/30">Stock</p><p className="text-sm font-semibold text-white/70">{material.stock} <span className="text-[10px] font-normal text-white/30">{material.unit}</span></p></div>
                  <div className="p-2 rounded bg-white/[0.02]"><p className="text-[10px] text-white/30">Min Level</p><p className="text-sm font-semibold text-white/70">{material.minThreshold} <span className="text-[10px] font-normal text-white/30">{material.unit}</span></p></div>
                </div>
                <div className="mt-2"><div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${material.status === 'In Stock' ? 'bg-emerald-500' : material.status === 'Low' ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, (material.stock / (material.minThreshold * 4)) * 100)}%` }} /></div></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   MODULE 10: CUSTOMERS
   ================================================================ */
function CustomersModule() {
  const [search, setSearch] = useState('');
  const filtered = CUSTOMERS.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
        <div><h1 className="text-lg font-bold text-white">Customers</h1><p className="text-white/40 text-xs">Manage customer relationships</p></div>
        <div className="flex items-center gap-2">
          <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-9 h-8 w-48 bg-white/[0.04] border-white/[0.08] text-xs text-white/70" /></div>
          <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white h-8 text-xs"><Plus className="w-3.5 h-3.5 mr-1" /> Add Customer</Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-white/[0.06]">{['Customer', 'Contact', 'Phone', 'Orders', 'Total Spend', 'Status', ''].map((h) => <th key={h} className="text-left text-[10px] text-white/30 font-medium py-3 px-3 uppercase tracking-wider">{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-3"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center"><Users className="w-4 h-4 text-cyan-400/60" /></div><div><p className="text-sm text-white/70 font-medium">{c.name}</p><p className="text-[10px] text-white/30">{c.email}</p></div></div></td>
                  <td className="py-3 px-3 text-xs text-white/50">{c.contact}</td>
                  <td className="py-3 px-3 text-xs text-white/50 font-mono">{c.phone}</td>
                  <td className="py-3 px-3 text-xs text-white/50">{c.orders}</td>
                  <td className="py-3 px-3 text-sm text-emerald-400 font-semibold">{c.total}</td>
                  <td className="py-3 px-3"><Badge className={`text-[10px] ${c.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>{c.status}</Badge></td>
                  <td className="py-3 px-3"><button className="text-white/20 hover:text-white/50 transition-all"><ChevronRight className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   MODULE 11: PRINT SETTINGS
   ================================================================ */
function PrintSettingsModule() {
  const [activeTab, setActiveTab] = useState('profiles');
  const profiles = [
    { name: 'DTG', resolution: '1200x1200 DPI', speed: 'Medium', colorProfile: 'CMYK + White', description: 'Direct to Garment printing for cotton fabrics' },
    { name: 'DTF', resolution: '1440x1440 DPI', speed: 'High', colorProfile: 'CMYK + White', description: 'Direct to Film for versatile fabric transfer' },
    { name: 'Sublimation', resolution: '720x720 DPI', speed: 'High', colorProfile: 'CMYK', description: 'Dye sublimation for polyester materials' },
    { name: 'Transfer', resolution: '600x600 DPI', speed: 'Medium', colorProfile: 'CMYK', description: 'Heat transfer paper printing' },
    { name: 'Vinyl Cut', resolution: 'N/A', speed: 'Variable', colorProfile: 'Spot Colors', description: 'Vinyl cutting with Roland GS-24' },
    { name: 'Screen Print', resolution: '300 DPI', speed: 'Low', colorProfile: 'Pantone', description: 'Traditional screen printing setup' },
  ];
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-white/[0.06]"><h1 className="text-lg font-bold text-white">Print Settings</h1><p className="text-white/40 text-xs">Configure print profiles and business settings</p></div>
      <div className="flex-1 overflow-auto p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white/[0.03] border border-white/[0.06] mb-4">
            <TabsTrigger value="profiles" className="text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">Print Profiles</TabsTrigger>
            <TabsTrigger value="pricing" className="text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">Pricing Rules</TabsTrigger>
            <TabsTrigger value="business" className="text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">Business Info</TabsTrigger>
          </TabsList>
          <TabsContent value="profiles">
            <div className="grid grid-cols-2 gap-3">
              {profiles.map((p) => (
                <Card key={p.name} className="bg-white/[0.03] border-white/[0.06]">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2"><div className="flex items-center gap-2"><Printer className="w-5 h-5 text-cyan-400/60" /><h3 className="text-sm font-semibold text-white">{p.name}</h3></div><button className="text-white/20 hover:text-white/50 transition-all"><Edit className="w-3.5 h-3.5" /></button></div>
                    <p className="text-xs text-white/30 mb-3">{p.description}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[{ label: 'Resolution', val: p.resolution }, { label: 'Speed', val: p.speed }, { label: 'Color', val: p.colorProfile }].map((f) => (
                        <div key={f.label} className="p-2 rounded bg-white/[0.02]"><p className="text-[10px] text-white/30">{f.label}</p><p className="text-xs text-white/60">{f.val}</p></div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="pricing">
            <div className="max-w-lg space-y-4">
              <Card className="bg-white/[0.03] border-white/[0.06]">
                <CardContent className="p-4 space-y-3">
                  {[{ label: 'DTG Base Cost per Print', value: '3500', unit: 'TZS' }, { label: 'DTF Base Cost per Print', value: '4200', unit: 'TZS' }, { label: 'Sublimation Base Cost', value: '2800', unit: 'TZS' }, { label: 'Markup Percentage', value: '65', unit: '%' }, { label: 'Rush Order Surcharge', value: '25', unit: '%' }, { label: 'Bulk Discount (100+)', value: '15', unit: '%' }].map((item) => (
                    <div key={item.label} className="flex items-center justify-between"><label className="text-xs text-white/50">{item.label}</label><div className="flex items-center gap-2"><Input defaultValue={item.value} className="h-7 w-24 bg-white/[0.04] border-white/[0.08] text-xs text-white/70 text-right" /><span className="text-xs text-white/30 w-8">{item.unit}</span></div></div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="business">
            <div className="max-w-lg space-y-4">
              <Card className="bg-white/[0.03] border-white/[0.06]">
                <CardContent className="p-4 space-y-3">
                  <div><label className="text-xs text-white/50">Company Name</label><Input defaultValue="KobePrint Tanzania" className="h-8 mt-1 bg-white/[0.04] border-white/[0.08] text-xs text-white/70" /></div>
                  <div><label className="text-xs text-white/50">Address</label><Input defaultValue="Kariakoo, Dar es Salaam" className="h-8 mt-1 bg-white/[0.04] border-white/[0.08] text-xs text-white/70" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs text-white/50">Tax Rate (%)</label><Input defaultValue="18" className="h-8 mt-1 bg-white/[0.04] border-white/[0.08] text-xs text-white/70" /></div>
                    <div><label className="text-xs text-white/50">Currency</label><Input defaultValue="TZS" className="h-8 mt-1 bg-white/[0.04] border-white/[0.08] text-xs text-white/70" /></div>
                  </div>
                  <div><label className="text-xs text-white/50">Phone</label><Input defaultValue="+255 717 543 210" className="h-8 mt-1 bg-white/[0.04] border-white/[0.08] text-xs text-white/70" /></div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
        <div className="flex gap-2 mt-4">
          <Button className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs"><Save className="w-3.5 h-3.5 mr-1" /> Save Changes</Button>
          <Button variant="outline" className="border-white/[0.1] text-white/50 text-xs hover:text-white"><RefreshCw className="w-3.5 h-3.5 mr-1" /> Reset</Button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   MODULE 12: PLOTTER CONFIG
   ================================================================ */
function PlotterConfigModule() {
  const [activeTab, setActiveTab] = useState('general');
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-white/[0.06]"><h1 className="text-lg font-bold text-white">Plotter Configuration</h1><p className="text-white/40 text-xs">Vinyl cutter and plotter settings</p></div>
      <div className="flex-1 overflow-auto p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white/[0.03] border border-white/[0.06] mb-4">
            <TabsTrigger value="general" className="text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">General</TabsTrigger>
            <TabsTrigger value="blade" className="text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">Blade</TabsTrigger>
            <TabsTrigger value="advanced" className="text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">Advanced</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            <div className="max-w-lg space-y-4">
              <Card className="bg-white/[0.03] border-white/[0.06]">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-cyan-500/10 flex items-center justify-center"><Scissors className="w-7 h-7 text-cyan-400" /></div>
                    <div><h3 className="text-sm font-semibold text-white">Roland GS-24</h3><p className="text-xs text-white/30">Desktop Vinyl Cutter</p><div className="flex items-center gap-1 mt-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /><span className="text-[10px] text-emerald-400">Online</span></div></div>
                  </div>
                  <div className="border-t border-white/[0.06] pt-3 space-y-3">
                    {[{ label: 'Model', value: 'GS-24' }, { label: 'Serial Number', value: 'Z7G524001234' }, { label: 'Firmware', value: 'v3.2.1' }, { label: 'Connection', value: 'USB' }, { label: 'Cutting Width', value: '584mm (23")' }, { label: 'Max Speed', value: '500mm/s' }].map((item) => (
                      <div key={item.label} className="flex items-center justify-between"><span className="text-xs text-white/40">{item.label}</span><span className="text-xs text-white/70 font-mono">{item.value}</span></div>
                    ))}
                  </div>
                  <div className="border-t border-white/[0.06] pt-3 space-y-3">
                    <div><label className="text-xs text-white/50">Default Speed</label><Slider defaultValue={[45]} min={1} max={100} className="mt-2" /></div>
                    <div><label className="text-xs text-white/50">Default Pressure</label><Slider defaultValue={[120]} min={50} max={300} className="mt-2" /></div>
                    <div><label className="text-xs text-white/50">Offset</label><Input defaultValue="0.25" className="h-8 mt-1 bg-white/[0.04] border-white/[0.08] text-xs text-white/70" /></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="blade">
            <div className="max-w-lg space-y-4">
              <Card className="bg-white/[0.03] border-white/[0.06]">
                <CardContent className="p-4 space-y-3">
                  {[{ label: 'Blade Type', value: '45° Standard' }, { label: 'Blade Life', value: '850 cuts remaining' }, { label: 'Overcut', value: '0.2mm' }, { label: 'Cutting Strip', value: 'Good condition' }].map((item) => (
                    <div key={item.label} className="flex items-center justify-between p-2 rounded bg-white/[0.02]"><span className="text-xs text-white/50">{item.label}</span><span className="text-xs text-white/70">{item.value}</span></div>
                  ))}
                  <div className="pt-2"><div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: '75%' }} /></div><p className="text-[10px] text-white/30 mt-1">Blade life: 75%</p></div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="advanced">
            <div className="max-w-lg space-y-4">
              <Card className="bg-white/[0.03] border-white/[0.06]">
                <CardContent className="p-4 space-y-3">
                  {[{ label: 'Weed Border', desc: 'Add weeding border around cuts', checked: true }, { label: 'Multi-Cut', desc: 'Cut same path multiple times', checked: false }, { label: 'Cut Direction', desc: 'Reverse cut direction', checked: false }, { label: 'Auto-Align', desc: 'Automatic alignment detection', checked: true }, { label: 'Registration Marks', desc: 'Print registration marks', checked: true }, { label: 'Cut Line Type', desc: 'Separate cut lines from print', checked: false }].map((item) => (
                    <div key={item.label} className="flex items-center justify-between p-2 rounded bg-white/[0.02]"><div><p className="text-xs text-white/70">{item.label}</p><p className="text-[10px] text-white/30">{item.desc}</p></div><Switch defaultChecked={item.checked} /></div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
        <div className="flex gap-2 mt-4">
          <Button className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs"><Save className="w-3.5 h-3.5 mr-1" /> Save Config</Button>
          <Button variant="outline" className="border-white/[0.1] text-white/50 text-xs hover:text-white"><RefreshCw className="w-3.5 h-3.5 mr-1" /> Factory Reset</Button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   HELPER COMPONENTS
   ================================================================ */

/* ================================================================
   MAIN APP COMPONENT
   ================================================================ */
type SectionId = 'overview' | 'design' | 'production' | 'business' | 'settings';
type ModuleId = string;

interface SidebarItem { id: ModuleId; label: string; icon: React.ElementType; section: SectionId; color: string; }

const MODULES: SidebarItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'overview', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
  { id: 'designer', label: 'Designer Studio', icon: Palette, section: 'design', color: 'text-violet-400 bg-violet-500/10 border-violet-500/30' },
  { id: 'jersey', label: 'Jersey Designer', icon: Shirt, section: 'design', color: 'text-violet-400 bg-violet-500/10 border-violet-500/30' },
  { id: '3dpreview', label: '3D Preview', icon: Box, section: 'design', color: 'text-violet-400 bg-violet-500/10 border-violet-500/30' },
  { id: 'aigenerator', label: 'AI Generator', icon: Sparkles, section: 'design', color: 'text-violet-400 bg-violet-500/10 border-violet-500/30' },
  { id: 'vinylcutter', label: 'Vinyl Cutter', icon: Scissors, section: 'production', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  { id: 'printjobs', label: 'Print Jobs', icon: Printer, section: 'production', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  { id: 'productionqueue', label: 'Production Queue', icon: Layers, section: 'production', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  { id: 'products', label: 'Products', icon: ShoppingBag, section: 'business', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  { id: 'materials', label: 'Materials', icon: Package, section: 'business', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  { id: 'customers', label: 'Customers', icon: Users, section: 'business', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  { id: 'printsettings', label: 'Print Settings', icon: SlidersHorizontal, section: 'settings', color: 'text-slate-400 bg-slate-500/10 border-slate-500/30' },
  { id: 'plotterconfig', label: 'Plotter Config', icon: Wrench, section: 'settings', color: 'text-slate-400 bg-slate-500/10 border-slate-500/30' },
];

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'design', label: 'Design Studio' },
  { id: 'production', label: 'Production' },
  { id: 'business', label: 'Business' },
  { id: 'settings', label: 'Settings' },
];

export default function KobePrint() {
  const [activeModule, setActiveModule] = useState<ModuleId>('dashboard');
  const [expandedSections, setExpandedSections] = useState<Set<SectionId>>(new Set(['overview', 'design', 'production', 'business', 'settings']));

  const toggleSection = (section: SectionId) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) { next.delete(section); } else { next.add(section); }
      return next;
    });
  };

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard': return <DashboardModule />;
      case 'designer': return <DesignerStudioModule />;
      case 'jersey': return <JerseyDesignerModule />;
      case '3dpreview': return <ThreeDPreviewModule />;
      case 'aigenerator': return <AIGeneratorModule />;
      case 'vinylcutter': return <VinylCutterModule />;
      case 'printjobs': return <PrintJobsModule />;
      case 'products': return <ProductsModule />;
      case 'materials': return <MaterialsModule />;
      case 'customers': return <CustomersModule />;
      case 'printsettings': return <PrintSettingsModule />;
      case 'plotterconfig': return <PlotterConfigModule />;
      case 'productionqueue': return <ProductionQueueModule />;
      default: return <DashboardModule />;
    }
  };

  return (
    <div className="h-full w-full bg-[#0a0a1a] text-white flex overflow-hidden">
      <div className="w-60 bg-[#0c0c1a] border-r border-white/[0.06] flex flex-col overflow-hidden">
        <div className="h-14 flex items-center px-4 border-b border-white/[0.06]">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mr-2.5">
            <Printer className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight">KobePrint</h1>
            <p className="text-[10px] text-white/30 leading-tight">Print Shop Manager</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {SECTIONS.map((section) => {
            const sectionModules = MODULES.filter(m => m.section === section.id);
            const isExpanded = expandedSections.has(section.id);
            return (
              <div key={section.id} className="mb-1">
                <button onClick={() => toggleSection(section.id)} className="w-full flex items-center px-3 py-1.5 text-[10px] text-white/30 uppercase tracking-wider font-semibold hover:text-white/50 transition-colors">
                  <ChevronRight className={`w-3 h-3 mr-1 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  {section.label}
                </button>
                {isExpanded && (
                  <div className="px-2 space-y-0.5">
                    {sectionModules.map((module) => {
                      const isActive = activeModule === module.id;
                      const Icon = module.icon;
                      return (
                        <button key={module.id} onClick={() => setActiveModule(module.id)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all border ${isActive ? `${module.color}` : 'text-white/40 border-transparent hover:text-white/60 hover:bg-white/[0.03]'}`}>
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{module.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="p-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02]">
            <div className="w-7 h-7 rounded-full bg-cyan-500/10 flex items-center justify-center"><Users className="w-3.5 h-3.5 text-cyan-400" /></div>
            <div><p className="text-[10px] text-white/50">Admin</p><p className="text-[10px] text-white/30">KobePrint Shop</p></div>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">{renderModule()}</div>
    </div>
  );
}
