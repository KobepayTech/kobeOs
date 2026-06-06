import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, ArrowRight, Check, Smartphone, Monitor, Apple } from 'lucide-react';
import { usePwaInstall } from '@/hooks/usePwaInstall';

/**
 * `/install/:appId` — a clean, share-friendly landing page that triggers the
 * PWA install prompt on the recipient's device. Detects iOS (which has no
 * install prompt API) and shows the manual "Add to Home Screen" instructions
 * instead. Browser support detection runs in usePwaInstall.
 */
const APP_CATALOG: Record<string, { name: string; description: string; icon: string }> = {
  kobeos:      { name: 'KobeOS',     description: 'Your business OS — ERP, POS, cargo, payments.', icon: '🏪' },
  erp:         { name: 'KobeERP',    description: 'Inventory, sales, customers, reports.',          icon: '📊' },
  pos:         { name: 'KobePOS',    description: 'Cashier-friendly checkout with BNPL.',            icon: '🛒' },
  cargo:       { name: 'KobeCargo',  description: 'Air & ground freight, FR24 flight board.',        icon: '🚛' },
  hotel:       { name: 'KobeHotel',  description: 'Front desk, rooms, housekeeping.',                icon: '🏨' },
  shop:        { name: 'KobeShop',   description: 'Storefront for your customers.',                  icon: '🛍️' },
};

export default function InstallLandingPage() {
  const { appId = 'kobeos' } = useParams<{ appId?: string }>();
  const app = APP_CATALOG[appId] ?? APP_CATALOG.kobeos;
  const { canInstall, installed, prompt } = usePwaInstall();
  const [outcome, setOutcome] = useState<'accepted' | 'dismissed' | 'unavailable' | null>(null);

  const platform = useMemo<'ios' | 'android' | 'desktop' | 'other'>(() => {
    if (typeof navigator === 'undefined') return 'other';
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) return 'ios';
    if (/android/.test(ua)) return 'android';
    if (/macintosh|windows|linux/.test(ua)) return 'desktop';
    return 'other';
  }, []);

  // Auto-fire the prompt once available, so visitors land and immediately get
  // the system dialog (browsers require a user gesture in some setups — the
  // explicit button below covers that case).
  useEffect(() => {
    if (canInstall && outcome === null) {
      prompt().then(setOutcome);
    }
  }, [canInstall, outcome, prompt]);

  if (installed) {
    return (
      <Center>
        <Card className="bg-emerald-500/10 border-emerald-500/30 max-w-md">
          <CardContent className="p-6 text-center space-y-3">
            <Check className="w-10 h-10 text-emerald-300 mx-auto" />
            <h1 className="text-xl font-semibold text-white">{app.name} is already installed</h1>
            <p className="text-sm text-white/70">Open it from your home screen or app drawer.</p>
          </CardContent>
        </Card>
      </Center>
    );
  }

  return (
    <Center>
      <Card className="bg-white/[0.04] border-white/10 max-w-md w-full">
        <CardContent className="p-6 space-y-4">
          <div className="text-5xl text-center">{app.icon}</div>
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-semibold text-white">Install {app.name}</h1>
            <p className="text-sm text-white/60">{app.description}</p>
          </div>

          <div className="flex items-center justify-center gap-3 text-[11px] text-white/40 pt-1">
            <Smartphone className="w-3.5 h-3.5" /> Phone
            <Monitor className="w-3.5 h-3.5" /> Desktop
            <Apple className="w-3.5 h-3.5" /> iOS
          </div>

          {platform === 'ios' ? (
            <IosInstructions appName={app.name} />
          ) : canInstall ? (
            <Button onClick={() => prompt().then(setOutcome)} className="w-full bg-blue-600 hover:bg-blue-500" size="lg">
              <Download className="w-4 h-4 mr-2" /> Install now
            </Button>
          ) : (
            <NoPromptFallback appName={app.name} />
          )}

          {outcome === 'dismissed' && (
            <p className="text-xs text-amber-300 text-center">
              Install dismissed. Tap the button again whenever you're ready.
            </p>
          )}
        </CardContent>
      </Card>
    </Center>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white">
      {children}
    </div>
  );
}

function IosInstructions({ appName }: { appName: string }) {
  return (
    <div className="space-y-2 text-sm text-white/80">
      <p className="text-white font-medium">To install {appName} on iPhone or iPad:</p>
      <ol className="space-y-2 list-decimal list-inside text-white/70">
        <li>Tap the Share <ArrowRight className="w-3 h-3 inline" /> button in Safari.</li>
        <li>Scroll down and choose <strong>Add to Home Screen</strong>.</li>
        <li>Tap <strong>Add</strong> in the top right.</li>
      </ol>
      <p className="text-xs text-white/40 pt-2">
        iOS requires Safari and does not show a one-tap install prompt.
      </p>
    </div>
  );
}

function NoPromptFallback({ appName }: { appName: string }) {
  return (
    <div className="text-sm text-white/70 space-y-2 text-center">
      <p>{appName} can be installed from your browser menu.</p>
      <p className="text-xs text-white/40">
        Look for "Install app" or "Add to Home Screen" — usually under the ⋮ menu on Chrome / Edge,
        or under <em>File → Install</em> on desktop.
      </p>
    </div>
  );
}
