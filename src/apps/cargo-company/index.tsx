import { useState, useMemo } from 'react';
import {
  Shield, Users, Send, Bell, MessageSquare, Settings,
  Plus, Search, Edit2, Trash2, CheckCircle2, XCircle,
  Eye, Phone, Mail, User, Lock, Globe,
  BarChart3, TrendingUp, AlertCircle, ChevronRight,
  Save, Key, Link2, Palette, Building2, Package,
  DollarSign, Clock, Inbox
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

/* ─── Types ─── */
interface Receiver {
  id: number;
  name: string;
  phone: string;
  email: string;
  username: string;
  address: string;
  company: string;
  status: 'Active' | 'Inactive';
  createdDate: string;
}

interface SentMessage {
  id: number;
  date: string;
  recipients: string;
  recipientCount: number;
  message: string;
  type: string;
  status: 'Delivered' | 'Pending' | 'Failed';
}

interface ActivityItem {
  id: number;
  text: string;
  time: string;
  icon: React.ReactNode;
}

interface SMSTemplate {
  id: string;
  name: string;
  content: string;
}

/* ─── Mock Data ─── */
const RECEIVERS: Receiver[] = [
  { id: 1, name: 'Juma Mwinyi', phone: '+255712345678', email: 'juma@email.com', username: 'juma_m', address: 'Kariakoo St, Dar es Salaam', company: 'Kariakoo Branch', status: 'Active', createdDate: '2024-01-15' },
  { id: 2, name: 'Asha Mohammed', phone: '+255723456789', email: 'asha@email.com', username: 'asha_m', address: 'Mikocheni, Dar es Salaam', company: 'Mikocheni Branch', status: 'Active', createdDate: '2024-02-10' },
  { id: 3, name: 'Rajab Hassan', phone: '+255734567890', email: 'rajab@email.com', username: 'rajab_h', address: 'Magomeni, Dar es Salaam', company: 'Kariakoo Branch', status: 'Active', createdDate: '2024-02-22' },
  { id: 4, name: 'Fatima Omar', phone: '+255745678901', email: 'fatima@email.com', username: 'fatima_o', address: 'Upanga, Dar es Salaam', company: 'Upanga Branch', status: 'Inactive', createdDate: '2024-03-05' },
  { id: 5, name: 'Idris Seif', phone: '+255756789012', email: 'idris@email.com', username: 'idris_s', address: 'Kinondoni, Dar es Salaam', company: 'Mikocheni Branch', status: 'Active', createdDate: '2024-03-18' },
  { id: 6, name: 'Mariam Juma', phone: '+255767890123', email: 'mariam@email.com', username: 'mariam_j', address: 'Temeke, Dar es Salaam', company: 'Temeke Branch', status: 'Active', createdDate: '2024-04-01' },
  { id: 7, name: 'Omar Khamis', phone: '+255778901234', email: 'omar@email.com', username: 'omar_k', address: 'Ilala, Dar es Salaam', company: 'Kariakoo Branch', status: 'Inactive', createdDate: '2024-04-12' },
  { id: 8, name: 'Zainab Ali', phone: '+255789012345', email: 'zainab@email.com', username: 'zainab_a', address: 'Masaki, Dar es Salaam', company: 'Upanga Branch', status: 'Active', createdDate: '2024-04-20' },
];

const SENT_MESSAGES: SentMessage[] = [
  { id: 1, date: '2024-05-20 09:30', recipients: 'All Receivers', recipientCount: 28, message: 'Your parcel KBE-001 is now in transit...', type: 'SMS + Push', status: 'Delivered' },
  { id: 2, date: '2024-05-20 11:15', recipients: 'Specific Numbers', recipientCount: 5, message: 'Delivery scheduled for tomorrow between 10-12 AM...', type: 'SMS Only', status: 'Delivered' },
  { id: 3, date: '2024-05-19 14:00', recipients: 'All Drivers', recipientCount: 12, message: 'New pickup assignments available...', type: 'Push Only', status: 'Delivered' },
  { id: 4, date: '2024-05-19 16:45', recipients: 'All Receivers', recipientCount: 28, message: 'Payment reminder for parcel KBE-042...', type: 'SMS + Push', status: 'Pending' },
  { id: 5, date: '2024-05-18 08:00', recipients: 'Specific Numbers', recipientCount: 3, message: 'Your parcel has arrived! Pickup at...', type: 'SMS Only', status: 'Failed' },
  { id: 6, date: '2024-05-18 10:30', recipients: 'All Owners', recipientCount: 4, message: 'Weekly shipment report is now available...', type: 'Push Only', status: 'Delivered' },
];

const ACTIVITIES: ActivityItem[] = [
  { id: 1, text: 'New parcel KBE-001 registered', time: '2 min ago', icon: <Package className="w-4 h-4 text-emerald-400" /> },
  { id: 2, text: 'Driver Rajab completed trip KBE-015', time: '15 min ago', icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" /> },
  { id: 3, text: 'Receiver Juma confirmed pickup', time: '32 min ago', icon: <User className="w-4 h-4 text-blue-400" /> },
  { id: 4, text: 'SMS sent to 28 receivers', time: '1 hr ago', icon: <MessageSquare className="w-4 h-4 text-purple-400" /> },
  { id: 5, text: 'Payment received: TSh 1.2M', time: '2 hrs ago', icon: <DollarSign className="w-4 h-4 text-amber-400" /> },
  { id: 6, text: 'New receiver Zainab Ali registered', time: '3 hrs ago', icon: <Users className="w-4 h-4 text-cyan-400" /> },
  { id: 7, text: 'Parcel KBE-032 delivered', time: '4 hrs ago', icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" /> },
  { id: 8, text: 'SMS gateway updated', time: '5 hrs ago', icon: <Settings className="w-4 h-4 text-gray-400" /> },
];

const MESSAGE_TEMPLATES = [
  { id: 'tmpl_1', name: 'Parcel In Transit', content: 'Your parcel {parcel_id} is now in transit. Track: {link}' },
  { id: 'tmpl_2', name: 'Parcel Arrived', content: 'Your parcel has arrived! Pickup at {location} or schedule delivery.' },
  { id: 'tmpl_3', name: 'Delivery Scheduled', content: 'Delivery scheduled for {date} between {time}. Driver: {driver_name}' },
  { id: 'tmpl_4', name: 'Payment Reminder', content: 'Payment reminder: Your parcel {parcel_id} requires payment of TSh {amount}.' },
  { id: 'tmpl_5', name: 'Welcome', content: 'Welcome to KOBECARGO! Your parcel {parcel_id} has been registered.' },
];

const SMS_TEMPLATES: SMSTemplate[] = [
  { id: 'reg', name: 'Registration', content: 'Welcome to KOBECARGO! Your parcel {id} has been registered.' },
  { id: 'trn', name: 'Transit', content: '[KOBECARGO] Your parcel {id} is now in transit to {destination}. Track: {link}' },
  { id: 'arr', name: 'Arrival', content: '[KOBECARGO] Good news! Parcel {id} has arrived. Pickup or schedule delivery: {link}' },
  { id: 'dlv', name: 'Delivery', content: '[KOBECARGO] Parcel {id} has been delivered. Thank you for choosing us!' },
  { id: 'pmt', name: 'Payment', content: '[KOBECARGO] Payment of TSh {amount} received for parcel {id}.' },
];

/* ─── Status badge helper ─── */
function StatusBadge({ status }: { status: 'Active' | 'Inactive' | 'Delivered' | 'Pending' | 'Failed' }) {
  const colors: Record<string, string> = {
    Active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    Inactive: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    Delivered: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    Pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    Failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return <Badge variant="outline" className={colors[status] || ''}>{status}</Badge>;
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function CargoCompany() {
  const [activeTab, setActiveTab] = useState('dashboard');

  /* ─── Receiver State ─── */
  const [receivers, setReceivers] = useState<Receiver[]>(RECEIVERS);
  const [receiverSearch, setReceiverSearch] = useState('');
  const [showAddReceiver, setShowAddReceiver] = useState(false);
  const [editingReceiver, setEditingReceiver] = useState<Receiver | null>(null);
  const [viewingReceiver, setViewingReceiver] = useState<Receiver | null>(null);
  const [receiverForm, setReceiverForm] = useState({
    name: '', phone: '', email: '', username: '', password: '', address: '', company: 'Kariakoo Branch',
  });

  /* ─── Notification State ─── */
  const [recipientType, setRecipientType] = useState('all_owners');
  const [specificPhones, setSpecificPhones] = useState('');
  const [messageType, setMessageType] = useState('sms_push');
  const [messageText, setMessageText] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [showSendConfirm, setShowSendConfirm] = useState(false);

  /* ─── SMS Gateway State ─── */
  const [smsHeader, setSmsHeader] = useState('KOBECARGO');
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [senderId, setSenderId] = useState('KOBECARGO');
  const [smsTemplates, setSmsTemplates] = useState<SMSTemplate[]>(SMS_TEMPLATES);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);

  /* ─── Company Settings State ─── */
  const [companyName, setCompanyName] = useState('KOBECARGO Logistics Ltd');
  const [companyLogo, setCompanyLogo] = useState('https://placehold.co/100x100/10b981/ffffff?text=KB');
  const [companyPhone, setCompanyPhone] = useState('+255 700 123 456');
  const [companyEmail, setCompanyEmail] = useState('admin@kobecargo.com');
  const [companyAddress, setCompanyAddress] = useState('Kariakoo, Dar es Salaam, Tanzania');
  const [themeColor, setThemeColor] = useState('#10b981');
  const [savedSettings, setSavedSettings] = useState(false);

  /* ─── Filtered Receivers ─── */
  const filteredReceivers = useMemo(() => {
    const q = receiverSearch.toLowerCase();
    return receivers.filter(r =>
      r.name.toLowerCase().includes(q) || r.phone.includes(q)
    );
  }, [receivers, receiverSearch]);

  /* ─── Handlers ─── */
  const handleAddReceiver = () => {
    const newReceiver: Receiver = {
      id: Date.now(),
      name: receiverForm.name,
      phone: receiverForm.phone,
      email: receiverForm.email,
      username: receiverForm.username,
      address: receiverForm.address,
      company: receiverForm.company,
      status: 'Active',
      createdDate: new Date().toISOString().split('T')[0],
    };
    setReceivers([...receivers, newReceiver]);
    setReceiverForm({ name: '', phone: '', email: '', username: '', password: '', address: '', company: 'Kariakoo Branch' });
    setShowAddReceiver(false);
  };

  const handleEditReceiver = () => {
    if (!editingReceiver) return;
    setReceivers(receivers.map(r => r.id === editingReceiver.id ? { ...r, ...receiverForm, id: r.id, status: r.status } : r));
    setEditingReceiver(null);
    setReceiverForm({ name: '', phone: '', email: '', username: '', password: '', address: '', company: 'Kariakoo Branch' });
  };

  const handleToggleStatus = (id: number) => {
    setReceivers(receivers.map(r =>
      r.id === id ? { ...r, status: r.status === 'Active' ? 'Inactive' as const : 'Active' as const } : r
    ));
  };

  const handleDeleteReceiver = (id: number) => {
    setReceivers(receivers.filter(r => r.id !== id));
  };

  const openEditReceiver = (r: Receiver) => {
    setEditingReceiver(r);
    setReceiverForm({
      name: r.name, phone: r.phone, email: r.email, username: r.username,
      password: '', address: r.address, company: r.company,
    });
  };

  const applyTemplate = (templateId: string) => {
    const tmpl = MESSAGE_TEMPLATES.find(t => t.id === templateId);
    if (tmpl) {
      setMessageText(tmpl.content);
      setSelectedTemplate(templateId);
    }
  };

  const handleSaveSettings = () => {
    setSavedSettings(true);
    setTimeout(() => setSavedSettings(false), 3000);
  };

  const handleSendNotification = () => {
    setShowSendConfirm(false);
    setMessageText('');
    setSelectedTemplate('');
  };

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */
  return (
    <div className="w-full h-full bg-slate-950 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-b border-white/10 bg-slate-900/80 backdrop-blur-md">
        <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight">KOBECARGO Admin</h1>
          <p className="text-xs text-gray-400">Company Management Panel</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Online</Badge>
        </div>
      </div>

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="shrink-0 px-4 pt-3 border-b border-white/10 bg-slate-900/50">
          <TabsList className="bg-white/5 border border-white/10 h-10">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 text-xs px-3 gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="receivers" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 text-xs px-3 gap-1.5">
              <Users className="w-3.5 h-3.5" /> Receivers
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 text-xs px-3 gap-1.5">
              <Bell className="w-3.5 h-3.5" /> Notifications
            </TabsTrigger>
            <TabsTrigger value="sms" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 text-xs px-3 gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> SMS Gateway
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 text-xs px-3 gap-1.5">
              <Settings className="w-3.5 h-3.5" /> Settings
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-5">

            {/* ═══════════════════════════════════════════
                TAB 1: DASHBOARD
                ═══════════════════════════════════════════ */}
            <TabsContent value="dashboard" className="mt-0 space-y-5">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Total Parcels', value: '156', icon: <Package className="w-4 h-4" />, color: 'text-blue-400 bg-blue-500/15' },
                  { label: 'Active Shipments', value: '43', icon: <Send className="w-4 h-4" />, color: 'text-emerald-400 bg-emerald-500/15' },
                  { label: 'Receivers', value: '28', icon: <Users className="w-4 h-4" />, color: 'text-cyan-400 bg-cyan-500/15' },
                  { label: 'Revenue', value: 'TSh 45M', icon: <DollarSign className="w-4 h-4" />, color: 'text-amber-400 bg-amber-500/15' },
                  { label: 'Pending', value: '12', icon: <Clock className="w-4 h-4" />, color: 'text-orange-400 bg-orange-500/15' },
                  { label: 'SMS Sent Today', value: '89', icon: <MessageSquare className="w-4 h-4" />, color: 'text-purple-400 bg-purple-500/15' },
                ].map((stat, i) => (
                  <Card key={i} className="bg-white/5 border-white/10">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${stat.color}`}>
                          {stat.icon}
                        </div>
                      </div>
                      <div className="text-xl font-bold">{stat.value}</div>
                      <div className="text-[10px] text-gray-400">{stat.label}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Recent Activity */}
                <Card className="lg:col-span-2 bg-white/5 border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" /> Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {ACTIVITIES.map(a => (
                        <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/3 hover:bg-white/6 transition-colors">
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                            {a.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{a.text}</p>
                            <p className="text-xs text-gray-500">{a.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card className="bg-white/5 border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <ChevronRight className="w-4 h-4 text-emerald-400" /> Quick Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    <Button onClick={() => setActiveTab('notifications')} className="w-full justify-start gap-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30">
                      <Send className="w-4 h-4" /> Send Notification
                    </Button>
                    <Button onClick={() => { setActiveTab('receivers'); setShowAddReceiver(true); }} className="w-full justify-start gap-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30">
                      <Plus className="w-4 h-4" /> Add Receiver
                    </Button>
                    <Button variant="outline" className="w-full justify-start gap-2 border-white/10 text-gray-300 hover:bg-white/10">
                      <BarChart3 className="w-4 h-4" /> View Reports
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ═══════════════════════════════════════════
                TAB 2: RECEIVERS
                ═══════════════════════════════════════════ */}
            <TabsContent value="receivers" className="mt-0 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <Input
                    placeholder="Search by name or phone..."
                    value={receiverSearch}
                    onChange={e => setReceiverSearch(e.target.value)}
                    className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                  />
                </div>
                <Button onClick={() => setShowAddReceiver(true)} className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5">
                  <Plus className="w-4 h-4" /> Add Receiver
                </Button>
              </div>

              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-left text-xs text-gray-400">
                          <th className="p-3 font-medium">Name</th>
                          <th className="p-3 font-medium">Phone</th>
                          <th className="p-3 font-medium">Username</th>
                          <th className="p-3 font-medium">Status</th>
                          <th className="p-3 font-medium">Created</th>
                          <th className="p-3 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredReceivers.map(r => (
                          <tr key={r.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="p-3">
                              <div className="font-medium">{r.name}</div>
                              <div className="text-xs text-gray-500">{r.company}</div>
                            </td>
                            <td className="p-3 text-gray-300">{r.phone}</td>
                            <td className="p-3 text-gray-300">{r.username}</td>
                            <td className="p-3"><StatusBadge status={r.status} /></td>
                            <td className="p-3 text-gray-400">{r.createdDate}</td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10" onClick={() => setViewingReceiver(r)}>
                                  <Eye className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10" onClick={() => openEditReceiver(r)}>
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-gray-300 hover:bg-gray-500/10" onClick={() => handleToggleStatus(r.id)}>
                                  {r.status === 'Active' ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => handleDeleteReceiver(r.id)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredReceivers.length === 0 && (
                    <div className="p-8 text-center text-gray-500 text-sm">No receivers found.</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ═══════════════════════════════════════════
                TAB 3: NOTIFICATIONS
                ═══════════════════════════════════════════ */}
            <TabsContent value="notifications" className="mt-0 space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Compose */}
                <Card className="bg-white/5 border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Send className="w-4 h-4 text-emerald-400" /> Compose Message
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Recipient */}
                    <div>
                      <label className="text-xs text-gray-400 mb-1.5 block">Recipient</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'all_owners', label: 'All Owners' },
                          { id: 'all_drivers', label: 'All Drivers' },
                          { id: 'all_receivers', label: 'All Receivers' },
                          { id: 'specific', label: 'Specific Numbers' },
                        ].map(opt => (
                          <button
                            key={opt.id}
                            onClick={() => setRecipientType(opt.id)}
                            className={`text-xs px-3 py-2 rounded-md border transition-all text-left ${
                              recipientType === opt.id
                                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                                : 'border-white/10 bg-white/3 text-gray-300 hover:bg-white/6'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {recipientType === 'specific' && (
                        <Input
                          placeholder="+2557..., +2557..."
                          value={specificPhones}
                          onChange={e => setSpecificPhones(e.target.value)}
                          className="mt-2 bg-white/5 border-white/10 text-white placeholder:text-gray-500 text-sm"
                        />
                      )}
                    </div>

                    {/* Message Type */}
                    <div>
                      <label className="text-xs text-gray-400 mb-1.5 block">Message Type</label>
                      <div className="flex gap-2">
                        {[
                          { id: 'sms_push', label: 'SMS + Push' },
                          { id: 'push_only', label: 'Push Only' },
                          { id: 'sms_only', label: 'SMS Only' },
                        ].map(opt => (
                          <button
                            key={opt.id}
                            onClick={() => setMessageType(opt.id)}
                            className={`text-xs px-3 py-1.5 rounded-md border transition-all ${
                              messageType === opt.id
                                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                                : 'border-white/10 bg-white/3 text-gray-300 hover:bg-white/6'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Templates */}
                    <div>
                      <label className="text-xs text-gray-400 mb-1.5 block">Quick Templates</label>
                      <div className="flex flex-wrap gap-1.5">
                        {MESSAGE_TEMPLATES.map(tmpl => (
                          <button
                            key={tmpl.id}
                            onClick={() => applyTemplate(tmpl.id)}
                            className={`text-[10px] px-2 py-1 rounded border transition-all ${
                              selectedTemplate === tmpl.id
                                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                                : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/8'
                            }`}
                          >
                            {tmpl.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Message */}
                    <div>
                      <label className="text-xs text-gray-400 mb-1.5 block">Message</label>
                      <textarea
                        value={messageText}
                        onChange={e => setMessageText(e.target.value)}
                        placeholder="Type your message..."
                        rows={4}
                        className="w-full rounded-md bg-white/5 border border-white/10 text-white placeholder:text-gray-500 text-sm p-3 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      />
                      <div className="text-right text-[10px] text-gray-500 mt-1">{messageText.length} characters</div>
                    </div>

                    {/* Preview */}
                    {messageText && (
                      <div className="p-3 rounded-md bg-slate-900/80 border border-white/10">
                        <div className="text-[10px] text-gray-500 mb-1">Preview</div>
                        <p className="text-sm text-gray-300">[{smsHeader}] {messageText}</p>
                      </div>
                    )}

                    <Button onClick={() => setShowSendConfirm(true)} disabled={!messageText} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5">
                      <Send className="w-4 h-4" /> Send Message
                    </Button>
                  </CardContent>
                </Card>

                {/* Sent History */}
                <Card className="bg-white/5 border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Inbox className="w-4 h-4 text-blue-400" /> Sent Messages History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2.5">
                      {SENT_MESSAGES.map(msg => (
                        <div key={msg.id} className="p-3 rounded-lg bg-white/3 hover:bg-white/6 transition-colors border border-white/5">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] text-gray-500">{msg.date}</span>
                            <StatusBadge status={msg.status} />
                          </div>
                          <p className="text-sm text-gray-300 line-clamp-2 mb-1.5">{msg.message}</p>
                          <div className="flex items-center gap-2 text-[10px] text-gray-500">
                            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {msg.recipientCount}</span>
                            <span>{msg.recipients}</span>
                            <span className="ml-auto">{msg.type}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ═══════════════════════════════════════════
                TAB 4: SMS GATEWAY
                ═══════════════════════════════════════════ */}
            <TabsContent value="sms" className="mt-0 space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* SMS Header */}
                <Card className="lg:col-span-2 bg-white/5 border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-emerald-400" /> SMS Header / Custom Headers
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">Current Sender ID</div>
                        <div className="text-lg font-bold text-emerald-400">{smsHeader}</div>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-gray-400 mb-1.5 block">Customize SMS Sender ID (max 11 chars)</label>
                      <div className="flex gap-2">
                        <Input
                          value={smsHeader}
                          onChange={e => setSmsHeader(e.target.value.slice(0, 11).toUpperCase())}
                          maxLength={11}
                          className="bg-white/5 border-white/10 text-white uppercase"
                        />
                        <Button className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5">
                          <Save className="w-4 h-4" /> Save
                        </Button>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">This appears as the sender name on recipient phones.</p>
                    </div>

                    <div className="border-t border-white/10 pt-4">
                      <h4 className="text-xs font-semibold text-gray-300 mb-3 flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5 text-amber-400" /> Message Templates
                      </h4>
                      <div className="space-y-2.5">
                        {smsTemplates.map(tmpl => (
                          <div key={tmpl.id} className="p-3 rounded-lg bg-slate-900/60 border border-white/5">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-medium text-gray-300">{tmpl.name}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[10px] text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                                onClick={() => setEditingTemplate(editingTemplate === tmpl.id ? null : tmpl.id)}
                              >
                                <Edit2 className="w-3 h-3 mr-1" /> {editingTemplate === tmpl.id ? 'Done' : 'Edit'}
                              </Button>
                            </div>
                            {editingTemplate === tmpl.id ? (
                              <textarea
                                value={tmpl.content}
                                onChange={e => setSmsTemplates(smsTemplates.map(t => t.id === tmpl.id ? { ...t, content: e.target.value } : t))}
                                rows={2}
                                className="w-full rounded-md bg-white/5 border border-white/10 text-white text-xs p-2 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            ) : (
                              <p className="text-xs text-gray-400">{tmpl.content}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* API Settings + Usage */}
                <div className="space-y-5">
                  <Card className="bg-white/5 border-white/10">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Key className="w-4 h-4 text-purple-400" /> API Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">API Endpoint</label>
                        <div className="flex items-center gap-2">
                          <Link2 className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                          <Input
                            placeholder="https://sms-api.example.com/v1/send"
                            value={apiEndpoint}
                            onChange={e => setApiEndpoint(e.target.value)}
                            className="bg-white/5 border-white/10 text-white text-xs"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">API Key</label>
                        <div className="flex items-center gap-2">
                          <Lock className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                          <Input
                            type="password"
                            placeholder="sk_live_xxxxxxxx"
                            value={apiKey}
                            onChange={e => setApiKey(e.target.value)}
                            className="bg-white/5 border-white/10 text-white text-xs"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Sender ID</label>
                        <Input
                          value={senderId}
                          onChange={e => setSenderId(e.target.value)}
                          className="bg-white/5 border-white/10 text-white text-xs"
                        />
                      </div>
                      <Button variant="outline" className="w-full gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Test SMS
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/5 border-white/10">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-blue-400" /> SMS Usage
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {[
                          { label: 'Sent Today', value: '89', change: '+12%' },
                          { label: 'This Week', value: '612', change: '+8%' },
                          { label: 'This Month', value: '2,847', change: '+15%' },
                          { label: 'Delivery Rate', value: '96.4%', change: '+1.2%' },
                        ].map((stat, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-xs text-gray-400">{stat.label}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">{stat.value}</span>
                              <span className="text-[10px] text-emerald-400">{stat.change}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* ═══════════════════════════════════════════
                TAB 5: COMPANY SETTINGS
                ═══════════════════════════════════════════ */}
            <TabsContent value="settings" className="mt-0 space-y-5">
              <div className="max-w-2xl">
                <Card className="bg-white/5 border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-400" /> Company Profile
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4 mb-4">
                      <img src={companyLogo} alt="Logo" className="w-16 h-16 rounded-xl border border-white/10" />
                      <div>
                        <div className="text-sm font-medium">Company Logo</div>
                        <div className="text-[10px] text-gray-500">Recommended: 200x200px</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Company Name</label>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                          <Input
                            value={companyName}
                            onChange={e => setCompanyName(e.target.value)}
                            className="bg-white/5 border-white/10 text-white text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Logo URL</label>
                        <Input
                          value={companyLogo}
                          onChange={e => setCompanyLogo(e.target.value)}
                          className="bg-white/5 border-white/10 text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Contact Phone</label>
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                          <Input
                            value={companyPhone}
                            onChange={e => setCompanyPhone(e.target.value)}
                            className="bg-white/5 border-white/10 text-white text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Email</label>
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                          <Input
                            value={companyEmail}
                            onChange={e => setCompanyEmail(e.target.value)}
                            className="bg-white/5 border-white/10 text-white text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-400 block mb-1">Primary Address / Branch</label>
                      <div className="flex items-start gap-2">
                        <Globe className="w-3.5 h-3.5 text-gray-500 shrink-0 mt-2" />
                        <textarea
                          value={companyAddress}
                          onChange={e => setCompanyAddress(e.target.value)}
                          rows={2}
                          className="w-full rounded-md bg-white/5 border border-white/10 text-white text-sm p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        />
                      </div>
                    </div>

                    <div className="border-t border-white/10 pt-4">
                      <label className="text-xs text-gray-400 block mb-3 flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5" /> Theme Color
                      </label>
                      <div className="flex items-center gap-3">
                        {['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'].map(color => (
                          <button
                            key={color}
                            onClick={() => setThemeColor(color)}
                            className={`w-8 h-8 rounded-full border-2 transition-all ${
                              themeColor === color ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                        <Input
                          type="color"
                          value={themeColor}
                          onChange={e => setThemeColor(e.target.value)}
                          className="w-10 h-10 p-0 border-0 bg-transparent cursor-pointer"
                        />
                      </div>
                    </div>

                    {savedSettings && (
                      <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> Settings saved successfully!
                      </div>
                    )}

                    <Button onClick={handleSaveSettings} className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5">
                      <Save className="w-4 h-4" /> Save Settings
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>

      {/* ═══════════════════════════════════════════
          DIALOGS
          ═══════════════════════════════════════════ */}

      {/* Add Receiver Dialog */}
      <Dialog open={showAddReceiver} onOpenChange={setShowAddReceiver}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" /> Add New Receiver
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Full Name</label>
              <Input value={receiverForm.name} onChange={e => setReceiverForm({ ...receiverForm, name: e.target.value })} placeholder="John Doe" className="bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Phone</label>
              <Input value={receiverForm.phone} onChange={e => setReceiverForm({ ...receiverForm, phone: e.target.value })} placeholder="+255..." className="bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Email</label>
              <Input value={receiverForm.email} onChange={e => setReceiverForm({ ...receiverForm, email: e.target.value })} placeholder="email@example.com" className="bg-white/5 border-white/10 text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Username</label>
                <Input value={receiverForm.username} onChange={e => setReceiverForm({ ...receiverForm, username: e.target.value })} placeholder="username" className="bg-white/5 border-white/10 text-white" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Password</label>
                <Input type="password" value={receiverForm.password} onChange={e => setReceiverForm({ ...receiverForm, password: e.target.value })} placeholder="******" className="bg-white/5 border-white/10 text-white" />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Address</label>
              <Input value={receiverForm.address} onChange={e => setReceiverForm({ ...receiverForm, address: e.target.value })} placeholder="Street, City" className="bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Branch</label>
              <select
                value={receiverForm.company}
                onChange={e => setReceiverForm({ ...receiverForm, company: e.target.value })}
                className="w-full rounded-md bg-white/5 border border-white/10 text-white text-sm p-2.5"
              >
                <option value="Kariakoo Branch" className="bg-slate-900">Kariakoo Branch</option>
                <option value="Mikocheni Branch" className="bg-slate-900">Mikocheni Branch</option>
                <option value="Upanga Branch" className="bg-slate-900">Upanga Branch</option>
                <option value="Temeke Branch" className="bg-slate-900">Temeke Branch</option>
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleAddReceiver} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white">Create Receiver</Button>
              <Button variant="outline" onClick={() => setShowAddReceiver(false)} className="border-white/10 text-gray-300 hover:bg-white/10">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Receiver Dialog */}
      <Dialog open={!!editingReceiver} onOpenChange={() => setEditingReceiver(null)}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-amber-400" /> Edit Receiver
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Full Name</label>
              <Input value={receiverForm.name} onChange={e => setReceiverForm({ ...receiverForm, name: e.target.value })} className="bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Phone</label>
              <Input value={receiverForm.phone} onChange={e => setReceiverForm({ ...receiverForm, phone: e.target.value })} className="bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Email</label>
              <Input value={receiverForm.email} onChange={e => setReceiverForm({ ...receiverForm, email: e.target.value })} className="bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Username</label>
              <Input value={receiverForm.username} onChange={e => setReceiverForm({ ...receiverForm, username: e.target.value })} className="bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Address</label>
              <Input value={receiverForm.address} onChange={e => setReceiverForm({ ...receiverForm, address: e.target.value })} className="bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Branch</label>
              <select
                value={receiverForm.company}
                onChange={e => setReceiverForm({ ...receiverForm, company: e.target.value })}
                className="w-full rounded-md bg-white/5 border border-white/10 text-white text-sm p-2.5"
              >
                <option value="Kariakoo Branch" className="bg-slate-900">Kariakoo Branch</option>
                <option value="Mikocheni Branch" className="bg-slate-900">Mikocheni Branch</option>
                <option value="Upanga Branch" className="bg-slate-900">Upanga Branch</option>
                <option value="Temeke Branch" className="bg-slate-900">Temeke Branch</option>
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleEditReceiver} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white">Save Changes</Button>
              <Button variant="outline" onClick={() => setEditingReceiver(null)} className="border-white/10 text-gray-300 hover:bg-white/10">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Receiver Dialog */}
      <Dialog open={!!viewingReceiver} onOpenChange={() => setViewingReceiver(null)}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Receiver Details</DialogTitle>
          </DialogHeader>
          {viewingReceiver && (
            <div className="space-y-3 mt-2">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-2">
                  <User className="w-7 h-7 text-emerald-400" />
                </div>
                <div className="font-semibold text-lg">{viewingReceiver.name}</div>
                <StatusBadge status={viewingReceiver.status} />
              </div>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center gap-2 text-gray-300">
                  <Phone className="w-4 h-4 text-gray-500" /> {viewingReceiver.phone}
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Mail className="w-4 h-4 text-gray-500" /> {viewingReceiver.email}
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <User className="w-4 h-4 text-gray-500" /> @{viewingReceiver.username}
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Building2 className="w-4 h-4 text-gray-500" /> {viewingReceiver.company}
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Globe className="w-4 h-4 text-gray-500" /> {viewingReceiver.address}
                </div>
                <div className="flex items-center gap-2 text-gray-400 text-xs">
                  <Clock className="w-4 h-4 text-gray-500" /> Registered: {viewingReceiver.createdDate}
                </div>
              </div>
              <Button variant="outline" onClick={() => setViewingReceiver(null)} className="w-full border-white/10 text-gray-300 hover:bg-white/10">Close</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Send Confirmation Dialog */}
      <Dialog open={showSendConfirm} onOpenChange={setShowSendConfirm}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" /> Confirm Send
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            <p className="text-sm text-gray-300">Are you sure you want to send this message?</p>
            <div className="p-3 rounded-lg bg-slate-800/80 border border-white/10">
              <div className="text-[10px] text-gray-500 mb-1">Message preview</div>
              <p className="text-sm text-gray-200">[{smsHeader}] {messageText}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSendNotification} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5">
                <Send className="w-4 h-4" /> Send
              </Button>
              <Button variant="outline" onClick={() => setShowSendConfirm(false)} className="border-white/10 text-gray-300 hover:bg-white/10">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
