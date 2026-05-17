import { useState } from 'react';
import { Wifi, Volume2, Monitor, User, Shield, Power, Moon, Sun } from 'lucide-react';

export default function SystemSettings() {
  const [activeTab, setActiveTab] = useState('general');
  const [darkMode, setDarkMode] = useState(true);
  const [volume, setVolume] = useState(75);
  const [brightness, setBrightness] = useState(80);

  const tabs = [
    { id: 'general', icon: <User size={20} />, label: 'General' },
    { id: 'wifi', icon: <Wifi size={20} />, label: 'Network' },
    { id: 'display', icon: <Monitor size={20} />, label: 'Display' },
    { id: 'sound', icon: <Volume2 size={20} />, label: 'Sound' },
    { id: 'security', icon: <Shield size={20} />, label: 'Security' },
    { id: 'power', icon: <Power size={20} />, label: 'Power' },
  ];

  return (
    <div className="flex h-full bg-gray-900 text-white">
      <div className="w-56 bg-gray-800/50 border-r border-gray-700 p-4">
        <h2 className="text-lg font-bold mb-6 px-2">System Settings</h2>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors ${
              activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'
            }`}>
            {tab.icon}<span className="text-sm">{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 p-6 overflow-y-auto">
        {activeTab === 'general' && (
          <div className="max-w-xl space-y-4">
            <h3 className="text-xl font-bold mb-4">General</h3>
            <SettingRow label="Computer Name" value="KobeOS-Desktop" editable />
            <SettingRow label="OS Version" value="KobeOS 1.0.0" />
            <SettingRow label="Build Date" value="2026-05-13" />
            <div className="flex items-center justify-between py-3 border-b border-gray-700">
              <span className="text-gray-400 text-sm">Theme</span>
              <button onClick={() => setDarkMode(!darkMode)} className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-lg">
                {darkMode ? <Moon size={16} /> : <Sun size={16} />}
                <span className="text-sm">{darkMode ? 'Dark' : 'Light'}</span>
              </button>
            </div>
          </div>
        )}
        {activeTab === 'display' && (
          <div className="max-w-xl">
            <h3 className="text-xl font-bold mb-4">Display</h3>
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Brightness</label>
                <input type="range" min="0" max="100" value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="w-full accent-blue-500" />
                <span className="text-sm text-gray-500">{brightness}%</span>
              </div>
              <SettingRow label="Resolution" value="1920 x 1080" editable />
            </div>
          </div>
        )}
        {activeTab === 'sound' && (
          <div className="max-w-xl">
            <h3 className="text-xl font-bold mb-4">Sound</h3>
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Output Volume</label>
                <input type="range" min="0" max="100" value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-full accent-blue-500" />
                <span className="text-sm text-gray-500">{volume}%</span>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'wifi' && (
          <div className="max-w-xl">
            <h3 className="text-xl font-bold mb-4">Network</h3>
            <div className="space-y-2">
              {['KobeOffice-5G', 'KobeGuest', 'KobeERP-Secure'].map(network => (
                <div key={network} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl border border-gray-700">
                  <div className="flex items-center gap-3">
                    <Wifi size={18} className="text-blue-400" />
                    <span className="text-sm">{network}</span>
                  </div>
                  <span className="text-xs text-green-400">Connected</span>
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
    <div className="flex items-center justify-between py-3 border-b border-gray-700">
      <span className="text-gray-400 text-sm">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">{value}</span>
        {editable && <button className="text-blue-400 text-xs hover:underline">Edit</button>}
      </div>
    </div>
  );
}
