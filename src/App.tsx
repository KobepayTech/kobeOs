import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

import LoginScreen from '@/components/LoginScreen';
import LiveModeBanner from '@/components/LiveModeBanner';
import SystemSettings from '@/components/SystemSettings';
import FileManager from '@/components/FileManager';
import AppStore from '@/components/AppStore';
import KobeOSInstaller from '@/components/KobeOSInstaller';

function Desktop({ user, onOpenApp }: { user: string; onOpenApp: (app: string) => void }) {
  const apps = [
    { id: 'erp', name: 'KobeERP', icon: '📊', color: 'from-blue-500 to-blue-600' },
    { id: 'hotel', name: 'KobeHotel', icon: '🏨', color: 'from-purple-500 to-purple-600' },
    { id: 'credit', name: 'KobeCredit', icon: '💳', color: 'from-green-500 to-green-600' },
    { id: 'cargo', name: 'KobeCargo', icon: '🚛', color: 'from-orange-500 to-orange-600' },
    { id: 'settings', name: 'Settings', icon: '⚙️', color: 'from-gray-500 to-gray-600' },
    { id: 'files', name: 'Files', icon: '📁', color: 'from-yellow-500 to-yellow-600' },
    { id: 'store', name: 'App Store', icon: '🛒', color: 'from-pink-500 to-pink-600' },
    { id: 'installer', name: 'Installer', icon: '💿', color: 'from-red-500 to-red-600' },
  ];

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white overflow-hidden">
      <div className="h-10 bg-gray-800/50 backdrop-blur-md border-b border-gray-700 flex items-center px-4 justify-between">
        <div className="flex items-center gap-4">
          <span className="font-bold">KobeOS</span>
          <span className="text-xs text-gray-500">|</span>
          <span className="text-sm text-gray-400">{user}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
          <button onClick={() => window.kobeOS?.system?.shutdown?.()} className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors" title="Shutdown">⏻</button>
        </div>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {apps.map((app, i) => (
            <motion.button key={app.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              onClick={() => onOpenApp(app.id)} className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/5 transition-colors group">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${app.color} flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform`}>
                {app.icon}
              </div>
              <span className="text-xs font-medium">{app.name}</span>
            </motion.button>
          ))}
        </div>
      </div>
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 bg-gray-800/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl px-3 py-1.5 flex items-center gap-1.5">
        {apps.slice(0, 4).map(app => (
          <button key={app.id} onClick={() => onOpenApp(app.id)} className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-lg hover:scale-110 transition-transform">
            {app.icon}
          </button>
        ))}
      </div>
    </div>
  );
}

function WindowManager({ app, onClose }: { app: string; onClose: () => void }) {
  const renderApp = () => {
    switch (app) {
      case 'settings': return <SystemSettings />;
      case 'files': return <FileManager />;
      case 'store': return <AppStore />;
      case 'installer': return <KobeOSInstaller />;
      default: return (
        <div className="h-full flex items-center justify-center text-gray-500">
          <div className="text-center">
            <p className="text-4xl mb-4">🚧</p>
            <p className="text-lg">{app} module</p>
            <p className="text-sm text-gray-600 mt-2">Integrate your existing {app} code here</p>
          </div>
        </div>
      );
    }
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-3 bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col z-40">
      <div className="h-9 bg-gray-800/50 border-b border-gray-700 flex items-center px-3 justify-between">
        <span className="font-medium text-sm capitalize">{app}</span>
        <div className="flex gap-1.5">
          <button className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
          <button className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
          <button onClick={onClose} className="w-2.5 h-2.5 rounded-full bg-red-500 hover:bg-red-600 transition-colors" />
        </div>
      </div>
      <div className="flex-1 overflow-hidden">{renderApp()}</div>
    </motion.div>
  );
}

export default function App() {
  const [user, setUser] = useState<string | null>(() => localStorage.getItem('kobeos_user'));
  const [openApp, setOpenApp] = useState<string | null>(null);

  const handleLogin = (username: string) => {
    setUser(username);
    localStorage.setItem('kobeos_user', username);
  };

  if (!user) return <LoginScreen onLogin={handleLogin} />;

  return (
    <BrowserRouter>
      <LiveModeBanner />
      <div className="pt-8">
        <Routes>
          <Route path="/" element={<><Desktop user={user} onOpenApp={setOpenApp} /><AnimatePresence>{openApp && <WindowManager app={openApp} onClose={() => setOpenApp(null)} />}</AnimatePresence></>} />
          <Route path="/installer" element={<KobeOSInstaller />} />
          <Route path="/settings" element={<SystemSettings />} />
          <Route path="/files" element={<FileManager />} />
          <Route path="/store" element={<AppStore />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
