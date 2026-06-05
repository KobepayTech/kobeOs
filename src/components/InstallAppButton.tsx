import { useState } from 'react';
import { Download, Check, Share2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePwaInstall } from '@/hooks/usePwaInstall';

/**
 * "Install" CTA + share-link generator. Hides itself when the app is already
 * installed; falls back to a shareable URL when the browser hasn't fired
 * beforeinstallprompt yet (iOS, or before the engagement heuristics kick in).
 *
 * The share URL points at /install/<id>, which renders InstallLandingPage —
 * a clean page that re-fires the prompt on the recipient's device.
 */
export function InstallAppButton({
  appId = 'kobeos',
  appName = 'KobeOS',
  className,
  compact = false,
}: {
  appId?: string;
  appName?: string;
  className?: string;
  compact?: boolean;
}) {
  const { canInstall, installed, prompt } = usePwaInstall();
  const [shared, setShared] = useState<'idle' | 'copied' | 'shared'>('idle');
  const [installing, setInstalling] = useState(false);

  if (installed) {
    return compact ? null : (
      <span className={`inline-flex items-center gap-1.5 text-xs text-emerald-300 ${className ?? ''}`}>
        <Check className="w-3.5 h-3.5" /> Installed
      </span>
    );
  }

  const shareUrl = `${window.location.origin}/install/${encodeURIComponent(appId)}`;

  const onInstall = async () => {
    setInstalling(true);
    try {
      const outcome = await prompt();
      if (outcome === 'unavailable') {
        // No native prompt available — copy the share URL so the user can
        // open it on a device that supports the install prompt.
        await share(shareUrl, appName, setShared);
      }
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <Button
        size={compact ? 'sm' : 'default'}
        onClick={onInstall}
        disabled={installing}
        className="bg-blue-600 hover:bg-blue-500 text-white"
      >
        <Download className="w-4 h-4 mr-1.5" />
        {canInstall ? `Install ${appName}` : 'Get install link'}
      </Button>
      <Button
        size={compact ? 'sm' : 'default'}
        variant="outline"
        onClick={() => share(shareUrl, appName, setShared)}
        title="Copy install link"
      >
        {shared === 'copied' ? <Check className="w-4 h-4" /> : shared === 'shared' ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
        <span className="ml-1 hidden sm:inline">
          {shared === 'copied' ? 'Copied' : shared === 'shared' ? 'Shared' : 'Share link'}
        </span>
      </Button>
    </div>
  );
}

async function share(url: string, title: string, setStatus: (s: 'idle' | 'copied' | 'shared') => void) {
  if (navigator.share) {
    try {
      await navigator.share({ url, title: `Install ${title}` });
      setStatus('shared');
      setTimeout(() => setStatus('idle'), 2000);
      return;
    } catch {
      /* user cancelled — fall through to clipboard */
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    setStatus('copied');
    setTimeout(() => setStatus('idle'), 2000);
  } catch {
    window.prompt('Copy this install link:', url);
  }
}
