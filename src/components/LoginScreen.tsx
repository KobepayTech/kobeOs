import React, { useState } from 'react';
import { Lock, Power, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { login, oauthGoogle, requestPasswordReset, resetPassword } from '@/lib/auth';
import { ApiError, API_BASE } from '@/lib/api';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

// Load the Google Identity Services script once (no-op if already present).
function loadGis(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.id) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Google sign-in'));
    document.head.appendChild(s);
  });
}

const PROFILES = [
  { name: 'Admin', avatar: 'A', role: 'System Administrator', color: 'from-blue-500 to-purple-600' },
  { name: 'Manager', avatar: 'M', role: 'Business Manager', color: 'from-green-500 to-teal-600' },
  { name: 'Cashier', avatar: 'C', role: 'Sales Staff', color: 'from-orange-500 to-red-600' },
];

export default function LoginScreen({ onLogin }: { onLogin: (user: string) => void }) {
  const [profile, setProfile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!profile) { setError('Select a profile'); return; }
    if (!email) { setError('Enter your email'); return; }
    if (!password) { setError('Enter your password'); return; }

    setLoading(true);
    setError('');
    try {
      const user = await login(email, password);
      onLogin(user.displayName ?? user.email);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Invalid email or password');
      } else {
        setError('Could not connect to server');
      }
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    if (!GOOGLE_CLIENT_ID) { setError('Google sign-in is not configured on this build'); return; }
    setError('');
    try {
      await loadGis();
      const google = (window as any).google;
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (resp: { credential?: string }) => {
          if (!resp?.credential) { setError('Google sign-in was cancelled'); return; }
          setLoading(true);
          try {
            const user = await oauthGoogle(resp.credential);
            onLogin(user.displayName ?? user.email);
          } catch { setError('Google sign-in failed'); }
          finally { setLoading(false); }
        },
      });
      google.accounts.id.prompt();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const signInWithTikTok = () => {
    // Server-side auth-code flow: backend redirects to TikTok, then back to
    // /oauth/tiktok with tokens in the URL fragment (handled in main.tsx).
    window.location.href = `${API_BASE}/auth/oauth/tiktok`;
  };

  // ── Forgot password ─────────────────────────────────────────────────────────
  const [fpOpen, setFpOpen] = useState(false);
  const [fpStage, setFpStage] = useState<'request' | 'reset'>('request');
  const [fpToken, setFpToken] = useState('');
  const [fpNewPass, setFpNewPass] = useState('');
  const [fpMsg, setFpMsg] = useState('');

  const sendResetCode = async () => {
    if (!email) { setFpMsg('Enter your account email first'); return; }
    setLoading(true); setFpMsg('');
    try {
      const res = await requestPasswordReset(email);
      // In dev the server returns the token directly; in prod it's emailed.
      if (res.resetToken) { setFpToken(res.resetToken); setFpMsg('Reset code ready — set a new password below.'); }
      else setFpMsg('If that email exists, a reset code has been sent. Enter it below.');
      setFpStage('reset');
    } catch { setFpMsg('Could not start password reset'); }
    finally { setLoading(false); }
  };

  const submitReset = async () => {
    if (!fpToken || fpNewPass.length < 6) { setFpMsg('Enter the code and a new password (6+ chars)'); return; }
    setLoading(true); setFpMsg('');
    try {
      await resetPassword(fpToken.trim(), fpNewPass);
      setFpMsg('Password changed — you can sign in now.');
      setFpOpen(false); setFpStage('request'); setFpToken(''); setFpNewPass(''); setPassword('');
    } catch { setFpMsg('Invalid or expired reset code'); }
    finally { setLoading(false); }
  };

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
      <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-3xl p-8 shadow-2xl max-w-md w-full">
        <h1 className="text-3xl font-bold text-white text-center mb-2">KobeOS</h1>
        <p className="text-gray-400 text-center mb-8">Select a profile to continue</p>

        {error && <p className="text-red-400 text-sm text-center mb-4">{error}</p>}

        <div className="space-y-3 mb-6">
          {PROFILES.map((p) => (
            <button
              key={p.name}
              onClick={() => { setProfile(p.name); setError(''); }}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                profile === p.name ? 'border-blue-500 bg-blue-500/20' : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${p.color} flex items-center justify-center text-white font-bold`}>
                {p.avatar}
              </div>
              <div className="text-left">
                <p className="font-semibold text-white">{p.name}</p>
                <p className="text-sm text-gray-400">{p.role}</p>
              </div>
            </button>
          ))}
        </div>

        {profile && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl py-2.5 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-3 text-gray-500" />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <Button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 py-6 text-lg rounded-xl"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : 'Sign In'}
            </Button>

            <div className="text-center">
              <button type="button" onClick={() => { setFpOpen((v) => !v); setFpMsg(''); }} className="text-xs text-gray-400 hover:text-white">
                Forgot password?
              </button>
            </div>

            {fpOpen && (
              <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-3 space-y-2">
                {fpStage === 'request' ? (
                  <>
                    <p className="text-xs text-gray-400">We’ll send a reset code to <b className="text-gray-200">{email || 'your email'}</b>.</p>
                    <Button onClick={sendResetCode} disabled={loading || !email} className="w-full bg-gray-700 hover:bg-gray-600 rounded-lg">Send reset code</Button>
                  </>
                ) : (
                  <>
                    <input value={fpToken} onChange={(e) => setFpToken(e.target.value)} placeholder="Reset code" className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2 px-3 text-white placeholder-gray-500 text-sm outline-none" />
                    <input type="password" value={fpNewPass} onChange={(e) => setFpNewPass(e.target.value)} placeholder="New password (6+ chars)" className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2 px-3 text-white placeholder-gray-500 text-sm outline-none" />
                    <Button onClick={submitReset} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 rounded-lg">Set new password</Button>
                  </>
                )}
                {fpMsg && <p className="text-[11px] text-gray-300">{fpMsg}</p>}
              </div>
            )}
          </div>
        )}

        {/* Sign up / in with a provider — no profile selection needed */}
        <div className="mt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-gray-700" />
            <span className="text-xs text-gray-500">or continue with</span>
            <div className="h-px flex-1 bg-gray-700" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={signInWithGoogle}
              disabled={loading}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-700 hover:border-gray-500 bg-white text-gray-800 font-medium disabled:opacity-50"
            >
              <span className="text-lg font-bold" style={{ color: '#4285F4' }}>G</span> Google
            </button>
            <button
              onClick={signInWithTikTok}
              disabled={loading}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-700 hover:border-gray-500 bg-black text-white font-medium disabled:opacity-50"
            >
              <span aria-hidden className="text-lg">♪</span> TikTok
            </button>
          </div>
          <p className="text-[11px] text-gray-500 text-center mt-3">New here? Continuing with Google or TikTok creates your account.</p>
        </div>

        <div className="flex justify-center mt-6">
          <button className="text-gray-500 hover:text-white" onClick={() => window.kobeOS?.system?.shutdown?.()}>
            <Power size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
