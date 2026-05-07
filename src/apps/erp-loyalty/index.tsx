import { useState } from 'react';
import {
  Award, Gift, Plus, Minus, Send, Search, User, Star, Crown, Medal, Trophy,
  Calendar, MessageSquare, Mail,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const tiers = [
  { name: 'Bronze', min: 0, color: 'bg-amber-700/10 text-amber-500 border-amber-700/20', icon: Medal },
  { name: 'Silver', min: 500, color: 'bg-slate-400/10 text-slate-300 border-slate-400/20', icon: Star },
  { name: 'Gold', min: 2000, color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', icon: Crown },
  { name: 'Platinum', min: 5000, color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: Trophy },
];

const getTier = (points: number) => {
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (points >= tiers[i].min) return tiers[i];
  }
  return tiers[0];
};

const initialCustomers = [
  { id: 1, name: 'Juma Bakari', phone: '+255 713 123456', points: 3200, joinDate: '2024-03-15', visits: 42 },
  { id: 2, name: 'Asha Mwangi', phone: '+255 714 234567', points: 850, joinDate: '2025-01-10', visits: 18 },
  { id: 3, name: 'David Ochieng', phone: '+255 715 345678', points: 5400, joinDate: '2023-08-22', visits: 67 },
  { id: 4, name: 'Fatuma Said', phone: '+255 716 456789', points: 120, joinDate: '2025-11-05', visits: 5 },
  { id: 5, name: 'Peter Njoroge', phone: '+255 717 567890', points: 2100, joinDate: '2024-06-18', visits: 35 },
  { id: 6, name: 'Grace Wambui', phone: '+255 718 678901', points: 75, joinDate: '2026-02-01', visits: 3 },
  { id: 7, name: 'Omari Juma', phone: '+255 719 789012', points: 4300, joinDate: '2023-12-10', visits: 58 },
  { id: 8, name: 'Halima Saidi', phone: '+255 720 890123', points: 950, joinDate: '2025-04-20', visits: 22 },
  { id: 9, name: 'Keneth Mrema', phone: '+255 721 901234', points: 280, joinDate: '2025-09-12', visits: 9 },
  { id: 10, name: 'Rehema Joseph', phone: '+255 722 012345', points: 1800, joinDate: '2024-09-30', visits: 31 },
];

const pointsHistory = [
  { id: 1, customer: 'Juma Bakari', type: 'Earned', points: 150, description: 'Purchase ORD-1042', date: '2026-05-08' },
  { id: 2, customer: 'David Ochieng', type: 'Redeemed', points: -500, description: 'Reward: Solar Lamp', date: '2026-05-07' },
  { id: 3, customer: 'Asha Mwangi', type: 'Earned', points: 85, description: 'Purchase ORD-1041', date: '2026-05-08' },
  { id: 4, customer: 'Peter Njoroge', type: 'Bonus', points: 200, description: 'Birthday bonus', date: '2026-05-06' },
  { id: 5, customer: 'Omari Juma', type: 'Earned', points: 320, description: 'Purchase ORD-1036', date: '2026-05-06' },
  { id: 6, customer: 'Rehema Joseph', type: 'Redeemed', points: -300, description: 'Reward: Rice 5kg', date: '2026-05-04' },
  { id: 7, customer: 'Fatuma Said', type: 'Earned', points: 45, description: 'Purchase ORD-1039', date: '2026-05-07' },
  { id: 8, customer: 'Halima Saidi', type: 'Earned', points: 110, description: 'Purchase ORD-1035', date: '2026-05-05' },
];

const rewardsCatalog = [
  { id: 1, name: 'Solar LED Lamp', points: 500, image: 'bg-yellow-600', stock: 12 },
  { id: 2, name: 'Mama Ntilie Rice 5kg', points: 300, image: 'bg-amber-600', stock: 45 },
  { id: 3, name: 'Tecno PowerBank', points: 1200, image: 'bg-blue-600', stock: 8 },
  { id: 4, name: 'Kitenge Dress', points: 800, image: 'bg-emerald-600', stock: 15 },
  { id: 5, name: 'Sunflower Oil 3L', points: 250, image: 'bg-orange-600', stock: 30 },
  { id: 6, name: 'School Uniform Set', points: 600, image: 'bg-teal-600', stock: 20 },
];

export default function ERPLoyalty() {
  const [tab, setTab] = useState('customers');
  const [customers, setCustomers] = useState(initialCustomers);
  const [search, setSearch] = useState('');
  const [pointsModalOpen, setPointsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<typeof initialCustomers[0] | null>(null);
  const [pointsAmount, setPointsAmount] = useState(100);
  const [pointsReason, setPointsReason] = useState('Manual adjustment');
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoMessage, setPromoMessage] = useState('');
  const [promoType, setPromoType] = useState<'sms' | 'email'>('sms');

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  );

  const openAddPoints = (customer: typeof initialCustomers[0]) => {
    setSelectedCustomer(customer);
    setPointsAmount(100);
    setPointsReason('Manual adjustment');
    setPointsModalOpen(true);
  };

  const applyPoints = () => {
    if (!selectedCustomer) return;
    setCustomers((prev) =>
      prev.map((c) => (c.id === selectedCustomer.id ? { ...c, points: c.points + pointsAmount } : c))
    );
    setPointsModalOpen(false);
  };

  const sendPromo = () => {
    setPromoOpen(false);
    setPromoMessage('');
  };

  return (
    <div className="h-full bg-slate-950 text-slate-100 overflow-auto">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-blue-400" />
            <h1 className="text-lg font-semibold">Loyalty Program</h1>
          </div>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-slate-900 border border-slate-800 h-9">
              <TabsTrigger value="customers" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <User className="w-3 h-3 mr-1" /> Customers
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Calendar className="w-3 h-3 mr-1" /> History
              </TabsTrigger>
              <TabsTrigger value="rewards" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Gift className="w-3 h-3 mr-1" /> Rewards
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {tab === 'customers' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {tiers.map((tier) => {
                const count = customers.filter((c) => getTier(c.points).name === tier.name).length;
                const Icon = tier.icon;
                return (
                  <Card key={tier.name} className="bg-slate-900/60 border-slate-800">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-4 h-4" style={{ color: tier.name === 'Bronze' ? '#b45309' : tier.name === 'Silver' ? '#94a3b8' : tier.name === 'Gold' ? '#eab308' : '#a855f7' }} />
                        <span className="text-xs text-slate-400">{tier.name}</span>
                      </div>
                      <div className="text-xl font-bold">{count}</div>
                      <div className="text-[10px] text-slate-500">{tier.min}+ pts</div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Customers</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-8 h-8 w-48 bg-slate-900 border-slate-700 text-xs" />
                    </div>
                    <Button size="sm" onClick={() => setPromoOpen(true)} className="h-8 bg-blue-600 hover:bg-blue-500 text-white text-xs">
                      <Send className="w-3 h-3 mr-1" /> Promo
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-800 hover:bg-transparent">
                        <TableHead className="text-slate-400 text-xs">Customer</TableHead>
                        <TableHead className="text-slate-400 text-xs">Phone</TableHead>
                        <TableHead className="text-slate-400 text-xs">Points</TableHead>
                        <TableHead className="text-slate-400 text-xs">Tier</TableHead>
                        <TableHead className="text-slate-400 text-xs">Visits</TableHead>
                        <TableHead className="text-slate-400 text-xs">Joined</TableHead>
                        <TableHead className="text-slate-400 text-xs text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCustomers.map((c) => {
                        const tier = getTier(c.points);
                        const Icon = tier.icon;
                        return (
                          <TableRow key={c.id} className="border-slate-800 hover:bg-slate-800/40">
                            <TableCell className="text-xs font-medium text-slate-200">{c.name}</TableCell>
                            <TableCell className="text-xs text-slate-400">{c.phone}</TableCell>
                            <TableCell className="text-xs font-bold text-blue-400">{c.points.toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={tier.color}>
                                <Icon className="w-3 h-3 mr-1" /> {tier.name}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-slate-400">{c.visits}</TableCell>
                            <TableCell className="text-xs text-slate-400">{c.joinDate}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => openAddPoints(c)} className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors">
                                  <Plus className="w-3 h-3" />
                                </button>
                                <button onClick={() => openAddPoints(c)} className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center hover:bg-red-600 hover:text-white transition-colors">
                                  <Minus className="w-3 h-3" />
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </>
        )}

        {tab === 'history' && (
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Points History</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-400 text-xs">Customer</TableHead>
                      <TableHead className="text-slate-400 text-xs">Type</TableHead>
                      <TableHead className="text-slate-400 text-xs">Points</TableHead>
                      <TableHead className="text-slate-400 text-xs">Description</TableHead>
                      <TableHead className="text-slate-400 text-xs">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pointsHistory.map((h) => (
                      <TableRow key={h.id} className="border-slate-800 hover:bg-slate-800/40">
                        <TableCell className="text-xs text-slate-300">{h.customer}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            h.type === 'Earned' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                            h.type === 'Redeemed' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                            'bg-purple-500/10 text-purple-400 border-purple-500/20'
                          }>
                            {h.type}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-xs font-bold ${h.points > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {h.points > 0 ? '+' : ''}{h.points}
                        </TableCell>
                        <TableCell className="text-xs text-slate-400">{h.description}</TableCell>
                        <TableCell className="text-xs text-slate-400">{h.date}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {tab === 'rewards' && (
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Rewards Catalog</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {rewardsCatalog.map((r) => (
                  <div key={r.id} className="p-3 rounded-xl border border-slate-800 bg-slate-800/50 hover:border-slate-600 transition-colors">
                    <div className={`h-24 w-full rounded-lg ${r.image} mb-3`} />
                    <div className="text-xs font-medium">{r.name}</div>
                    <div className="flex items-center justify-between mt-2">
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                        <Award className="w-3 h-3 mr-1" /> {r.points} pts
                      </Badge>
                      <span className="text-[10px] text-slate-500">Stock: {r.stock}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={pointsModalOpen} onOpenChange={setPointsModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Adjust Points — {selectedCustomer?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-center p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <div className="text-xs text-slate-400">Current Points</div>
              <div className="text-2xl font-bold text-blue-400">{selectedCustomer?.points.toLocaleString()}</div>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Amount (+/-)</label>
              <Input type="number" value={pointsAmount} onChange={(e) => setPointsAmount(Number(e.target.value))} className="bg-slate-800 border-slate-700 text-slate-100" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Reason</label>
              <Input value={pointsReason} onChange={(e) => setPointsReason(e.target.value)} className="bg-slate-800 border-slate-700 text-slate-100" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPointsModalOpen(false)} className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800">Cancel</Button>
              <Button onClick={applyPoints} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white">Apply</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={promoOpen} onOpenChange={setPromoOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Send Promotion</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <button onClick={() => setPromoType('sms')} className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border text-xs ${promoType === 'sms' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-slate-700 text-slate-400'}`}>
                <MessageSquare className="w-3 h-3" /> SMS
              </button>
              <button onClick={() => setPromoType('email')} className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border text-xs ${promoType === 'email' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-slate-700 text-slate-400'}`}>
                <Mail className="w-3 h-3" /> Email
              </button>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Message</label>
              <textarea
                value={promoMessage}
                onChange={(e) => setPromoMessage(e.target.value)}
                placeholder={`Hi {name}! Double points this weekend at KOBE Enterprises. Shop now and earn 2x loyalty points!`}
                className="w-full h-24 rounded-md bg-slate-800 border border-slate-700 text-xs text-slate-100 p-2 resize-none"
              />
            </div>
            <div className="text-[10px] text-slate-500">
              Will be sent to {customers.length} customers via {promoType === 'sms' ? 'SMS' : 'Email'}.
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPromoOpen(false)} className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800">Cancel</Button>
              <Button onClick={sendPromo} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white">Send</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
