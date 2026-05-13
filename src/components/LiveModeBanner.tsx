import React from 'react';
import { Usb, HardDrive, AlertTriangle } from 'lucide-react';
import { useSystemMode } from '@/hooks/useSystemMode';
import { Button } from '@/components/ui/button';

export default function LiveModeBanner() {
  const mode = useSystemMode();
  if (mode === 'development') return null;
  const configs = {
    'live-usb': { icon: <Usb size={18} className="text-yellow-400" />, bg: 'bg-yellow-500/10 border-yellow-500/30', text: 'text-yellow-400', label: 'LIVE USB MODE', message: 'Running from USB. Performance is limited. Install to hard drive for full speed.', action: 'Install to Disk', color: 'bg-yellow-600 hover:bg-yellow-700' },
    'installed': { icon: <HardDrive size={18} className="text-green-400" />, bg: 'bg-green-500/10 border-green-500/30', text: 'text-green-400', label: 'INSTALLED SYSTEM', message: 'KobeOS is installed on this computer. All features available.', action: null, color: '' },
    'unknown': { icon: <AlertTriangle size={18} className="text-gray-400" />, bg: 'bg-gray-500/10 border-gray-500/30', text: 'text-gray-400', label: 'SYSTEM MODE UNKNOWN', message: 'Cannot detect if running from USB or installed disk.', action: null, color: '' }
  };
  const c = configs[mode];
  return (
    <div className={`fixed top-0 left-0 right-0 z-50 border-b ${c.bg} backdrop-blur-md`}>
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {c.icon}
          <div>
            <span className={`text-xs font-bold tracking-wider ${c.text}`}>{c.label}</span>
            <p className="text-xs text-gray-400 ml-0">{c.message}</p>
          </div>
        </div>
        {c.action && (
          <Button size="sm" className={`${c.color} text-white text-xs`} onClick={() => window.location.href = '/installer'}>
            {c.action}
          </Button>
        )}
      </div>
    </div>
  );
}
