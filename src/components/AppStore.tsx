import React, { useState } from 'react';
import { Download, Check, Globe, Hotel, CreditCard, Truck, ShoppingCart, BarChart3, Users, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface AppModule {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  installed: boolean;
  size: string;
  version: string;
  category: string;
}

export default function AppStore() {
  const [apps, setApps] = useState<AppModule[]>([
    { id: 'erp', name: 'KobeERP', description: 'Enterprise Resource Planning', icon: <ShoppingCart size={28} />, installed: true, size: '45 MB', version: '2.1.0', category: 'Business' },
    { id: 'hotel', name: 'KobeHotel', description: 'Hotel Management System', icon: <Hotel size={28} />, installed: false, size: '38 MB', version: '1.5.0', category: 'Business' },
    { id: 'credit', name: 'KobeCredit', description: 'Device Financing & Credit', icon: <CreditCard size={28} />, installed: false, size: '52 MB', version: '1.0.0', category: 'Finance' },
    { id: 'cargo', name: 'KobeCargo', description: 'Logistics & Cargo Tracking', icon: <Truck size={28} />, installed: false, size: '29 MB', version: '1.2.0', category: 'Logistics' },
    { id: 'analytics', name: 'KobeAnalytics', description: 'Business Intelligence', icon: <BarChart3 size={28} />, installed: false, size: '67 MB', version: '1.0.0', category: 'Analytics' },
    { id: 'crm', name: 'KobeCRM', description: 'Customer Relationship Management', icon: <Users size={28} />, installed: false, size: '41 MB', version: '2.0.0', category: 'Business' },
    { id: 'calendar', name: 'KobeCalendar', description: 'Team Scheduling', icon: <Calendar size={28} />, installed: false, size: '23 MB', version: '1.1.0', category: 'Productivity' },
  ]);

  const [installing, setInstalling] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [filter, setFilter] = useState('all');

  const installApp = (appId: string) => {
    setInstalling(appId);
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setApps(apps.map(a => a.id === appId ? { ...a, installed: true } : a));
          setInstalling(null);
          return 100;
        }
        return p + Math.random() * 15;
      });
    }, 200);
  };

  const categories = ['all', ...new Set(apps.map(a => a.category))];
  const filtered = filter === 'all' ? apps : apps.filter(a => a.category === filter);

  return (
    <div className="h-full bg-gray-900 text-white p-6 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Globe size={28} className="text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold">KobeOS App Store</h1>
            <p className="text-gray-400 text-sm">Install business modules</p>
          </div>
        </div>
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {categories.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === cat ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(app => (
            <div key={app.id} className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-gray-600 transition-all">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl flex items-center justify-center text-blue-400">
                  {app.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold">{app.name}</h3>
                    <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">{app.category}</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{app.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{app.size} • v{app.version}</span>
                    {app.installed ? (
                      <span className="text-xs text-green-400 flex items-center gap-1"><Check size={12} /> Installed</span>
                    ) : installing === app.id ? (
                      <div className="w-20"><Progress value={progress} className="h-1.5" /></div>
                    ) : (
                      <Button size="sm" onClick={() => installApp(app.id)} className="bg-blue-600 hover:bg-blue-700 h-7 text-xs">
                        <Download size={12} className="mr-1" /> Install
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
