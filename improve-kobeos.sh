#!/bin/bash
set -e

echo "Improving KobeOS with 5 major features..."

# 1. Offline PWA
npm install vite-plugin-pwa

# 2. Create all components
mkdir -p src/components src/hooks

cat > src/hooks/useSystemMode.ts << 'HOOK'
import { useState, useEffect } from 'react';
export type SystemMode = 'live-usb' | 'installed' | 'development' | 'unknown';
export function useSystemMode(): SystemMode {
  const [mode, setMode] = useState<SystemMode>('unknown');
  useEffect(() => {
    const isElectron = window.navigator.userAgent.toLowerCase().includes('electron');
    if (!isElectron) { setMode('development'); return; }
    fetch('file:///proc/mounts').then(r => r.text()).then(m => {
      if (m.includes('/dev/sr0') || m.includes('overlay')) setMode('live-usb');
      else setMode('installed');
    }).catch(() => setMode('installed'));
  }, []);
  return mode;
}
HOOK

cat > src/components/LoginScreen.tsx << 'LOGIN'
import React, { useState } from 'react';
import { User, Lock, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LoginScreen({ onLogin }: { onLogin: (user: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const users = [
    { name: 'Admin', avatar: 'A', role: 'System Administrator', color: 'from-blue-500 to-purple-600' },
    { name: 'Manager', avatar: 'M', role: 'Business Manager', color: 'from-green-500 to-teal-600' },
    { name: 'Cashier', avatar: 'C', role: 'Sales Staff', color: 'from-orange-500 to-red-600' },
  ];

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
      <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-3xl p-8 shadow-2xl max-w-md w-full">
        <h1 className="text-3xl font-bold text-white text-center mb-2">KobeOS</h1>
        <p className="text-gray-400 text-center mb-8">Select user to continue</p>
        <div className="space-y-3 mb-6">
          {users.map(user => (
            <button key={user.name} onClick={() => setUsername(user.name)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                username === user.name ? 'border-blue-500 bg-blue-500/20' : 'border-gray-700 hover:border-gray-600'
              }`}>
              <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${user.color} flex items-center justify-center text-white font-bold`}>
                {user.avatar}
              </div>
              <div className="text-left">
                <p className="font-semibold text-white">{user.name}</p>
                <p className="text-sm text-gray-400">{user.role}</p>
              </div>
            </button>
          ))}
        </div>
        {username && (
          <div className="space-y-4">
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-3 text-gray-500" />
              <input type="password" placeholder="Enter password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onLogin(username)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
            </div>
            <Button onClick={() => onLogin(username)} className="w-full bg-blue-600 hover:bg-blue-700 py-6 text-lg rounded-xl">
              Sign In
            </Button>
          </div>
        )}
        <div className="flex justify-center mt-6">
          <button className="text-gray-500 hover:text-white"><Power size={20} /></button>
        </div>
      </div>
    </div>
  );
}
LOGIN

cat > src/components/SystemSettings.tsx << 'SETTINGS'
import React, { useState } from 'react';
import { Wifi, Volume2, Display, User, Shield, Power, Moon, Sun, Globe } from 'lucide-react';

export default function SystemSettings() {
  const [activeTab, setActiveTab] = useState('general');
  const [darkMode, setDarkMode] = useState(true);
  const [volume, setVolume] = useState(75);
  const [brightness, setBrightness] = useState(80);

  const tabs = [
    { id: 'general', icon: <User size={20} />, label: 'General' },
    { id: 'wifi', icon: <Wifi size={20} />, label: 'Network' },
    { id: 'display', icon: <Display size={20} />, label: 'Display' },
    { id: 'sound', icon: <Volume2 size={20} />, label: 'Sound' },
    { id: 'security', icon: <Shield size={20} />, label: 'Security' },
    { id: 'power', icon: <Power size={20} />, label: 'Power' },
  ];

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <div className="w-64 bg-gray-800/50 border-r border-gray-700 p-4">
        <h2 className="text-lg font-bold mb-6 px-2">System Settings</h2>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors ${
              activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'
            }`}>
            {tab.icon}<span>{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'general' && (
          <div className="max-w-2xl space-y-6">
            <h3 className="text-2xl font-bold mb-6">General</h3>
            <SettingRow label="Computer Name" value="KobeOS-Desktop" editable />
            <SettingRow label="OS Version" value="KobeOS 1.0.0" />
            <SettingRow label="Build Date" value="2026-05-13" />
            <div className="flex items-center justify-between py-4 border-b border-gray-700">
              <span className="text-gray-400">Theme</span>
              <button onClick={() => setDarkMode(!darkMode)} className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-lg">
                {darkMode ? <Moon size={16} /> : <Sun size={16} />}
                <span className="text-sm">{darkMode ? 'Dark' : 'Light'}</span>
              </button>
            </div>
          </div>
        )}
        {activeTab === 'display' && (
          <div className="max-w-2xl">
            <h3 className="text-2xl font-bold mb-6">Display</h3>
            <div className="space-y-6">
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Brightness</label>
                <input type="range" min="0" max="100" value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-full accent-blue-500" />
                <span className="text-sm text-gray-500">{brightness}%</span>
              </div>
              <SettingRow label="Resolution" value="1920 x 1080" editable />
              <SettingRow label="Scale" value="100%" editable />
            </div>
          </div>
        )}
        {activeTab === 'sound' && (
          <div className="max-w-2xl">
            <h3 className="text-2xl font-bold mb-6">Sound</h3>
            <div className="space-y-6">
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Output Volume</label>
                <input type="range" min="0" max="100" value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-full accent-blue-500" />
                <span className="text-sm text-gray-500">{volume}%</span>
              </div>
              <SettingRow label="Output Device" value="Built-in Speakers" editable />
              <SettingRow label="Input Device" value="Built-in Microphone" editable />
            </div>
          </div>
        )}
        {activeTab === 'wifi' && (
          <div className="max-w-2xl">
            <h3 className="text-2xl font-bold mb-6">Network</h3>
            <div className="space-y-3">
              {['KobeOffice-5G', 'KobeGuest', 'KobeERP-Secure'].map(network => (
                <div key={network} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                  <div className="flex items-center gap-3">
                    <Wifi size={20} className="text-blue-400" />
                    <span>{network}</span>
                  </div>
                  <span className="text-sm text-green-400">Connected</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingRow({ label, value, editable }: { label: string; value: string; editable?: boolean }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-700">
      <span className="text-gray-400">{label}</span>
      <div className="flex items-center gap-3">
        <span className="font-medium">{value}</span>
        {editable && <button className="text-blue-400 text-sm hover:underline">Edit</button>}
      </div>
    </div>
  );
}
SETTINGS

cat > src/components/FileManager.tsx << 'FM'
import React, { useState } from 'react';
import { Folder, FileText, Image, Music, Video, ChevronRight, Home, ArrowLeft, MoreVertical, Grid, List } from 'lucide-react';

interface FileItem {
  name: string;
  type: 'folder' | 'file' | 'image' | 'music' | 'video';
  size?: string;
  modified: string;
}

export default function FileManager() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [currentPath, setCurrentPath] = useState('/home/kobeos');
  const [selected, setSelected] = useState<string | null>(null);

  const files: FileItem[] = [
    { name: 'Documents', type: 'folder', modified: '2026-05-13' },
    { name: 'Downloads', type: 'folder', modified: '2026-05-12' },
    { name: 'ERP-Reports', type: 'folder', modified: '2026-05-10' },
    { name: 'invoice-march.pdf', type: 'file', size: '2.4 MB', modified: '2026-03-15' },
    { name: 'logo.png', type: 'image', size: '156 KB', modified: '2026-04-20' },
    { name: 'meeting-recording.mp4', type: 'video', size: '45 MB', modified: '2026-05-01' },
    { name: 'sales-data.xlsx', type: 'file', size: '890 KB', modified: '2026-05-11' },
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case 'folder': return <Folder size={24} className="text-blue-400" />;
      case 'image': return <Image size={24} className="text-purple-400" />;
      case 'music': return <Music size={24} className="text-pink-400" />;
      case 'video': return <Video size={24} className="text-red-400" />;
      default: return <FileText size={24} className="text-gray-400" />;
    }
  };

  return (
    <div className="h-full bg-gray-900 text-white flex flex-col">
      <div className="flex items-center gap-2 p-3 border-b border-gray-700 bg-gray-800/50">
        <button className="p-2 hover:bg-gray-700 rounded-lg"><ArrowLeft size={18} /></button>
        <button className="p-2 hover:bg-gray-700 rounded-lg"><Home size={18} /></button>
        <div className="flex-1 flex items-center bg-gray-800 rounded-lg px-3 py-1.5 mx-2">
          <ChevronRight size={14} className="text-gray-500 mr-2" />
          <span className="text-sm text-gray-300">{currentPath}</span>
        </div>
        <div className="flex bg-gray-800 rounded-lg p-1">
          <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-gray-700' : ''}`}><List size={16} /></button>
          <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-gray-700' : ''}`}><Grid size={16} /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {viewMode === 'list' ? (
          <div className="grid grid-cols-1 gap-1">
            {files.map(file => (
              <div key={file.name} onClick={() => setSelected(file.name)}
                onDoubleClick={() => file.type === 'folder' && setCurrentPath(`${currentPath}/${file.name}`)}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  selected === file.name ? 'bg-blue-600/20 border border-blue-500/30' : 'hover:bg-gray-800/50'
                }`}>
                {getIcon(file.type)}
                <div className="flex-1"><p className="font-medium text-sm">{file.name}</p><p className="text-xs text-gray-500">{file.modified}</p></div>
                {file.size && <span className="text-xs text-gray-500">{file.size}</span>}
                <button className="p-1 hover:bg-gray-700 rounded"><MoreVertical size={16} /></button>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3 p-2">
            {files.map(file => (
              <div key={file.name} onClick={() => setSelected(file.name)}
                className={`flex flex-col items-center p-4 rounded-xl cursor-pointer transition-colors ${
                  selected === file.name ? 'bg-blue-600/20 border border-blue-500/30' : 'hover:bg-gray-800/50'
                }`}>
                <div className="mb-3">{getIcon(file.type)}</div>
                <p className="text-sm text-center truncate w-full">{file.name}</p>
                {file.size && <p className="text-xs text-gray-500 mt-1">{file.size}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="p-2 border-t border-gray-700 text-xs text-gray-500 flex justify-between">
        <span>{files.length} items</span>
        <span>{selected ? `Selected: ${selected}` : 'No selection'}</span>
      </div>
    </div>
  );
}
FM

cat > src/components/AppStore.tsx << 'STORE'
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
    { id: 'erp', name: 'KobeERP', description: 'Enterprise Resource Planning with inventory, sales, and analytics', icon: <ShoppingCart size={32} />, installed: true, size: '45 MB', version: '2.1.0', category: 'Business' },
    { id: 'hotel', name: 'KobeHotel', description: 'Hotel Management System with bookings and billing', icon: <Hotel size={32} />, installed: false, size: '38 MB', version: '1.5.0', category: 'Business' },
    { id: 'credit', name: 'KobeCredit', description: 'Device Financing & Credit Management', icon: <CreditCard size={32} />, installed: false, size: '52 MB', version: '1.0.0', category: 'Finance' },
    { id: 'cargo', name: 'KobeCargo', description: 'Logistics & Cargo Tracking System', icon: <Truck size={32} />, installed: false, size: '29 MB', version: '1.2.0', category: 'Logistics' },
    { id: 'analytics', name: 'KobeAnalytics', description: 'Business Intelligence & Reporting Dashboard', icon: <BarChart3 size={32} />, installed: false, size: '67 MB', version: '1.0.0', category: 'Analytics' },
    { id: 'crm', name: 'KobeCRM', description: 'Customer Relationship Management', icon: <Users size={32} />, installed: false, size: '41 MB', version: '2.0.0', category: 'Business' },
    { id: 'calendar', name: 'KobeCalendar', description: 'Team Scheduling & Event Management', icon: <Calendar size={32} />, installed: false, size: '23 MB', version: '1.1.0', category: 'Productivity' },
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
          <Globe size={32} className="text-blue-400" />
          <div>
            <h1 className="text-3xl font-bold">KobeOS App Store</h1>
            <p className="text-gray-400">Install business modules to expand your system</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {categories.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === cat ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(app => (
            <div key={app.id} className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-gray-600 transition-all">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl flex items-center justify-center text-blue-400">
                  {app.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-lg">{app.name}</h3>
                    <span className="text-xs bg-gray-700 px-2 py-1 rounded">{app.category}</span>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">{app.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{app.size} • v{app.version}</span>
                    {app.installed ? (
                      <div className="flex items-center gap-2 text-green-400 text-sm"><Check size={16} /> Installed</div>
                    ) : installing === app.id ? (
                      <div className="w-24"><Progress value={progress} className="h-2" /></div>
                    ) : (
                      <Button size="sm" onClick={() => installApp(app.id)} className="bg-blue-600 hover:bg-blue-700">
                        <Download size={14} className="mr-1" /> Install
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
STORE

echo "✅ All improvements created!"
echo ""
echo "📁 New files:"
echo "   src/hooks/useSystemMode.ts       → Detects Live USB vs Installed"
echo "   src/components/LoginScreen.tsx    → macOS-style user login"
echo "   src/components/SystemSettings.tsx → Windows/macOS settings panel"
echo "   src/components/FileManager.tsx    → Explorer/Finder file manager"
echo "   src/components/AppStore.tsx       → Module installer store"
echo ""
echo "🚀 Next: Add these to your router and push to GitHub"
