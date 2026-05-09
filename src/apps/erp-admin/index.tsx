import { useState } from 'react';
import {
  Shield, Plus, Trash2, Edit3, CheckCircle, XCircle, Search, Activity,
  UserCog, Store, Truck, DollarSign, BarChart3, Package,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';

const roles = ['Owner', 'Manager', 'Seller', 'Accountant', 'Warehouse', 'Rider', 'Admin'];

const roleIcon = (role: string) => {
  const map: Record<string, typeof Shield> = {
    Owner: Shield,
    Manager: BarChart3,
    Seller: Store,
    Accountant: DollarSign,
    Warehouse: Package,
    Rider: Truck,
    Admin: UserCog,
  };
  return map[role] || UserCog;
};

const roleColor = (role: string) => {
  const map: Record<string, string> = {
    Owner: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    Manager: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Seller: 'bg-green-500/10 text-green-400 border-green-500/20',
    Accountant: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    Warehouse: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    Rider: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    Admin: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return map[role] || 'bg-slate-500/10 text-slate-400';
};

const initialUsers = [
  { id: 1, name: 'Joseph Kibebe', email: 'joseph@kobe.co.tz', role: 'Owner', active: true, lastLogin: '2026-05-08 08:15' },
  { id: 2, name: 'Grace Mwakasege', email: 'grace@kobe.co.tz', role: 'Manager', active: true, lastLogin: '2026-05-08 07:42' },
  { id: 3, name: 'Juma Bakari', email: 'juma@kobe.co.tz', role: 'Seller', active: true, lastLogin: '2026-05-07 16:30' },
  { id: 4, name: 'Asha Mrema', email: 'asha@kobe.co.tz', role: 'Accountant', active: true, lastLogin: '2026-05-08 09:00' },
  { id: 5, name: 'John Daudi', email: 'john@kobe.co.tz', role: 'Warehouse', active: true, lastLogin: '2026-05-07 14:20' },
  { id: 6, name: 'Peter Omari', email: 'peter@kobe.co.tz', role: 'Rider', active: true, lastLogin: '2026-05-06 11:10' },
  { id: 7, name: 'Halima Saidi', email: 'halima@kobe.co.tz', role: 'Admin', active: false, lastLogin: '2026-04-28 10:05' },
  { id: 8, name: 'David Njoroge', email: 'david@kobe.co.tz', role: 'Seller', active: true, lastLogin: '2026-05-08 08:50' },
];

const activityLog = [
  { action: 'User login', user: 'Joseph Kibebe', time: '2026-05-08 08:15', type: 'info' },
  { action: 'Invoice #1042 created', user: 'Asha Mrema', time: '2026-05-08 09:03', type: 'success' },
  { action: 'Product price updated', user: 'Grace Mwakasege', time: '2026-05-08 09:15', type: 'warning' },
  { action: 'Order #1041 processed', user: 'Juma Bakari', time: '2026-05-08 09:22', type: 'success' },
  { action: 'Inventory adjusted', user: 'John Daudi', time: '2026-05-07 14:35', type: 'warning' },
  { action: 'Shipment #SH-004 delayed', user: 'Peter Omari', time: '2026-05-07 11:00', type: 'error' },
  { action: 'New user created', user: 'Halima Saidi', time: '2026-04-28 10:05', type: 'info' },
  { action: 'Report exported', user: 'Asha Mrema', time: '2026-05-06 16:45', type: 'success' },
];

export default function ERPAdmin() {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<typeof initialUsers[0] | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'Seller', active: true });

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditingUser(null);
    setForm({ name: '', email: '', role: 'Seller', active: true });
    setModalOpen(true);
  };

  const openEdit = (user: typeof initialUsers[0]) => {
    setEditingUser(user);
    setForm({ name: user.name, email: user.email, role: user.role, active: user.active });
    setModalOpen(true);
  };

  const saveUser = () => {
    if (editingUser) {
      setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? { ...u, ...form } : u)));
    } else {
      const newId = Math.max(...users.map((u) => u.id), 0) + 1;
      setUsers((prev) => [...prev, { id: newId, ...form, lastLogin: 'Never' }]);
    }
    setModalOpen(false);
  };

  const deleteUser = (id: number) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  const toggleActive = (id: number) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, active: !u.active } : u)));
  };

  return (
    <div className="h-full bg-slate-950 text-slate-100 overflow-auto">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            <h1 className="text-lg font-semibold">Admin Panel</h1>
          </div>
          <Button size="sm" onClick={openAdd} className="bg-blue-600 hover:bg-blue-500 text-white">
            <Plus className="w-3 h-3 mr-1" /> Add User
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-slate-900/60 border-slate-800">
            <CardContent className="p-3">
              <div className="text-xs text-slate-400">Total Users</div>
              <div className="text-xl font-bold">{users.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/60 border-slate-800">
            <CardContent className="p-3">
              <div className="text-xs text-slate-400">Active</div>
              <div className="text-xl font-bold text-green-400">{users.filter((u) => u.active).length}</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/60 border-slate-800">
            <CardContent className="p-3">
              <div className="text-xs text-slate-400">Inactive</div>
              <div className="text-xl font-bold text-red-400">{users.filter((u) => !u.active).length}</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/60 border-slate-800">
            <CardContent className="p-3">
              <div className="text-xs text-slate-400">Roles</div>
              <div className="text-xl font-bold">{roles.length}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 bg-slate-900/60 border-slate-800">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">User Management</CardTitle>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..." className="pl-8 h-8 w-56 bg-slate-900 border-slate-700 text-xs" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-400 text-xs">User</TableHead>
                      <TableHead className="text-slate-400 text-xs">Role</TableHead>
                      <TableHead className="text-slate-400 text-xs">Status</TableHead>
                      <TableHead className="text-slate-400 text-xs">Last Login</TableHead>
                      <TableHead className="text-slate-400 text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((u) => {
                      const Icon = roleIcon(u.role);
                      return (
                        <TableRow key={u.id} className="border-slate-800 hover:bg-slate-800/40">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                                <Icon className="w-4 h-4 text-blue-400" />
                              </div>
                              <div>
                                <div className="text-xs font-medium">{u.name}</div>
                                <div className="text-[10px] text-slate-400">{u.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={roleColor(u.role)}>
                              {u.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <button onClick={() => toggleActive(u.id)} className="flex items-center gap-1">
                              {u.active ? (
                                <CheckCircle className="w-4 h-4 text-green-400" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-400" />
                              )}
                            </button>
                          </TableCell>
                          <TableCell className="text-xs text-slate-400">{u.lastLogin}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => openEdit(u)} className="text-slate-400 hover:text-blue-400">
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button onClick={() => deleteUser(u.id)} className="text-slate-400 hover:text-red-400">
                                <Trash2 className="w-4 h-4" />
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

          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" /> Activity Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {activityLog.map((log, i) => {
                    const colors: Record<string, string> = {
                      info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                      success: 'bg-green-500/10 text-green-400 border-green-500/20',
                      warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
                      error: 'bg-red-500/10 text-red-400 border-red-500/20',
                    };
                    return (
                      <div key={i} className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className={colors[log.type]}>
                            {log.type}
                          </Badge>
                          <span className="text-[10px] text-slate-500">{log.time}</span>
                        </div>
                        <div className="text-xs text-slate-300 mt-1">{log.action}</div>
                        <div className="text-[10px] text-slate-400">by {log.user}</div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">{editingUser ? 'Edit User' : 'Add User'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Full Name</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="bg-slate-800 border-slate-700 text-slate-100" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Email</label>
              <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="bg-slate-800 border-slate-700 text-slate-100" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full h-9 px-2 rounded-md bg-slate-800 border border-slate-700 text-xs text-slate-300"
              >
                {roles.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
              <span className="text-xs text-slate-300">Active</span>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800">
                Cancel
              </Button>
              <Button onClick={saveUser} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white">
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
