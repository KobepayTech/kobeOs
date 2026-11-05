import { ArrowLeft, MoonStar } from 'lucide-react';
import { useEffect } from 'react';
import { usePwaManifest } from '@/hooks/usePwaManifest';
import LalaAccount from './LalaAccount';
import './lala.css';

export default function LalaPassport({ token }: { token: string }) {
  usePwaManifest({ name: 'Lala — Hotels, rooms & rewards', shortName: 'Lala', startUrl: location.hostname.startsWith('lala.') ? '/' : '/lala', iconBase: '/lala', themeColor: '#0066f5', backgroundColor: '#f5f7fa' });
  useEffect(() => { const title = document.title; document.title = 'Your Lala Passport'; return () => { document.title = title; }; }, []);
  return <div className="lala-world" data-surface="lala"><main className="lala-frame"><header className="lala-header"><a className="lala-icon-button" href="/lala" aria-label="Back to Lala"><ArrowLeft size={20} /></a><a className="lala-wordmark" href="/lala"><MoonStar size={23} /> lala<span>.</span></a><span className="lala-header-note">YOUR PASSPORT</span></header><LalaAccount token={token} view="passport" /></main></div>;
}
