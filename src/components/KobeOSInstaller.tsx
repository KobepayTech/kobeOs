import { useState, useEffect } from 'react';
import { Monitor, HardDrive, Download, CheckCircle, AlertCircle, ChevronRight, ChevronLeft, Power, RefreshCw, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';

interface Disk { name: string; size: string; model: string; path: string; }

export default function KobeOSInstaller() {
  const [step, setStep] = useState(1);
  const [disks, setDisks] = useState<Disk[]>([]);
  const [selectedDisk, setSelectedDisk] = useState<string | null>(null);
  const [installProgress, setInstallProgress] = useState(0);
  const [installComplete, setInstallComplete] = useState(false);

  useEffect(() => {
    if (step === 3) window.kobeOS?.system?.scanDisks?.().then(setDisks);
  }, [step]);

  const startInstall = async () => {
    if (!selectedDisk) return;
    const interval = setInterval(() => {
      setInstallProgress(prev => { if (prev >= 100) { clearInterval(interval); setInstallComplete(true); return 100; } return prev + Math.random() * 5; });
    }, 500);
    const result = await window.kobeOS?.system?.installToDisk?.(selectedDisk);
    clearInterval(interval);
    if (result?.success) { setInstallProgress(100); setInstallComplete(true); }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className={`flex items-center ${i > 0 ? 'ml-2' : ''}`}>
          {i > 0 && <div className={`w-8 h-0.5 ${i < step ? 'bg-blue-500' : 'bg-gray-600'}`} />}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i + 1 === step ? 'bg-blue-500 text-white' : i + 1 < step ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
            {i + 1 < step ? <CheckCircle size={16} /> : i + 1}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        {renderStepIndicator()}
        <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-8 shadow-2xl">
          {step === 1 && (
            <div className="text-center space-y-6">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto flex items-center justify-center shadow-2xl shadow-blue-500/20">
                <Monitor size={48} className="text-white" />
              </div>
              <div><h1 className="text-4xl font-bold text-white mb-2">Install KobeOS</h1><p className="text-gray-400 text-lg">Version 1.0.0 — Business Operating System</p></div>
              <div className="bg-gray-800/50 rounded-xl p-6 max-w-md mx-auto text-left space-y-3">
                <div className="flex items-center gap-3 text-gray-300"><Shield size={18} className="text-green-400" /><span>Enterprise ERP System</span></div>
                <div className="flex items-center gap-3 text-gray-300"><Shield size={18} className="text-green-400" /><span>Hotel Management Module</span></div>
                <div className="flex items-center gap-3 text-gray-300"><Shield size={18} className="text-green-400" /><span>Credit & Device Financing</span></div>
                <div className="flex items-center gap-3 text-gray-300"><Shield size={18} className="text-green-400" /><span>Cargo & Logistics Tracking</span></div>
              </div>
              <Button onClick={() => setStep(2)} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg rounded-xl">Get Started <ChevronRight size={20} /></Button>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white text-center">License Agreement</h2>
              <Card className="bg-gray-800/50 border-gray-700 p-6 h-64 overflow-y-auto text-gray-300 text-sm">
                <p className="mb-4 font-semibold text-white">KobeOS End User License Agreement</p>
                <p className="mb-3">By installing KobeOS, you agree to the terms and conditions of KobepayTech. KobeOS includes proprietary business modules including ERP, Hotel Management, Credit Systems, and Cargo Tracking.</p>
                <p className="mb-3">1. You may use KobeOS on any number of devices within your organization. 2. Redistribution requires written permission from KobepayTech. 3. The software is provided "as is" without warranty of any kind.</p>
                <p>For full terms, visit: https://kobepay.com/terms</p>
              </Card>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)} className="border-gray-600"><ChevronLeft size={18} /> Back</Button>
                <Button onClick={() => setStep(3)} className="bg-blue-600 hover:bg-blue-700">I Accept <ChevronRight size={18} /></Button>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white text-center">Select Installation Drive</h2>
              <div className="space-y-3">
                {disks.length === 0 ? (
                  <div className="text-center py-12 text-gray-500"><RefreshCw size={32} className="mx-auto mb-3 animate-spin" /><p>Scanning available drives...</p></div>
                ) : (
                  disks.map((disk) => (
                    <Card key={disk.path} onClick={() => setSelectedDisk(disk.path)} className={`p-4 cursor-pointer transition-all ${selectedDisk === disk.path ? 'bg-blue-600/20 border-blue-500' : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'}`}>
                      <div className="flex items-center gap-4">
                        <HardDrive size={32} className={selectedDisk === disk.path ? 'text-blue-400' : 'text-gray-500'} />
                        <div className="flex-1"><p className="font-semibold text-white">{disk.model || disk.name}</p><p className="text-sm text-gray-400">{disk.size} — {disk.path}</p></div>
                        {selectedDisk === disk.path && <CheckCircle size={20} className="text-blue-400" />}
                      </div>
                    </Card>
                  ))
                )}
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)} className="border-gray-600"><ChevronLeft size={18} /> Back</Button>
                <Button onClick={() => setStep(4)} disabled={!selectedDisk} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50">Next <ChevronRight size={18} /></Button>
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-6 text-center">
              <h2 className="text-2xl font-bold text-white">Ready to Install</h2>
              <div className="bg-gray-800/50 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-center gap-3 text-yellow-400"><AlertCircle size={24} /><span className="font-semibold">Warning: All data on the selected drive will be erased</span></div>
                <div className="text-left space-y-2 text-gray-300 text-sm">
                  <p><strong>Target Drive:</strong> {disks.find(d => d.path === selectedDisk)?.model || selectedDisk}</p>
                  <p><strong>Size:</strong> {disks.find(d => d.path === selectedDisk)?.size}</p>
                  <p><strong>Installation Type:</strong> Full System with GRUB Bootloader</p>
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(3)} className="border-gray-600"><ChevronLeft size={18} /> Back</Button>
                <Button onClick={() => { setStep(5); startInstall(); }} className="bg-red-600 hover:bg-red-700 text-white"><Download size={18} className="mr-2" /> Install Now</Button>
              </div>
            </div>
          )}
          {step === 5 && (
            <div className="space-y-8 text-center">
              {!installComplete ? (
                <>
                  <div className="space-y-4"><h2 className="text-2xl font-bold text-white">Installing KobeOS...</h2><p className="text-gray-400">This may take a few minutes. Do not turn off your computer.</p></div>
                  <div className="max-w-md mx-auto space-y-4"><Progress value={installProgress} className="h-3" /><p className="text-3xl font-bold text-blue-400">{Math.round(installProgress)}%</p></div>
                  <div className="animate-pulse text-gray-500"><p>Partitioning disk... Formatting filesystem... Copying system files... Installing bootloader...</p></div>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 bg-green-500 rounded-full mx-auto flex items-center justify-center"><CheckCircle size={40} className="text-white" /></div>
                  <div><h2 className="text-3xl font-bold text-white mb-2">Installation Complete!</h2><p className="text-gray-400">KobeOS has been successfully installed on your system.</p></div>
                  <div className="flex gap-4 justify-center">
                    <Button onClick={() => window.kobeOS?.system?.reboot?.()} className="bg-blue-600 hover:bg-blue-700"><Power size={18} className="mr-2" /> Reboot Now</Button>
                    <Button variant="outline" onClick={() => window.kobeOS?.system?.shutdown?.()} className="border-gray-600"><Power size={18} className="mr-2" /> Shutdown</Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <p className="text-center text-gray-600 mt-6 text-sm">© 2026 KobepayTech. All rights reserved.</p>
      </div>
    </div>
  );
}
