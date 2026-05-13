import { useState, useEffect } from 'react';
import {
  Plane, Send, PackageSearch, Truck, Inbox, Shield,
  ArrowRight, MapPin, QrCode, CreditCard, Route, Bell, BarChart3,
  CheckCircle2, Box, Globe, Clock, Phone, Mail, ChevronRight, Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/* ─────────────────────────── data ─────────────────────────── */

interface PortalCard {
  id: string;
  title: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  borderColor: string;
  bgGradient: string;
}

const portals: PortalCard[] = [
  {
    id: 'sender', title: 'Sender Portal', desc: 'Send parcels worldwide',
    icon: Send, color: 'text-emerald-400', borderColor: 'border-emerald-400/30',
    bgGradient: 'from-emerald-500/10 to-emerald-900/10',
  },
  {
    id: 'owner', title: 'Owner Portal', desc: 'Track your shipments',
    icon: PackageSearch, color: 'text-blue-400', borderColor: 'border-blue-400/30',
    bgGradient: 'from-blue-500/10 to-blue-900/10',
  },
  {
    id: 'driver', title: 'Driver Portal', desc: 'Manage trips & earn',
    icon: Truck, color: 'text-amber-400', borderColor: 'border-amber-400/30',
    bgGradient: 'from-amber-500/10 to-amber-900/10',
  },
  {
    id: 'receiver', title: 'Receiver Portal', desc: 'Manage deliveries',
    icon: Inbox, color: 'text-purple-400', borderColor: 'border-purple-400/30',
    bgGradient: 'from-purple-500/10 to-purple-900/10',
  },
  {
    id: 'admin', title: 'Company Admin', desc: 'Company management',
    icon: Shield, color: 'text-rose-400', borderColor: 'border-rose-400/30',
    bgGradient: 'from-rose-500/10 to-rose-900/10',
  },
];

const stats = [
  { label: '12,450+', sub: 'Shipments Delivered', icon: Box },
  { label: '98.7%', sub: 'On-Time Rate', icon: Clock },
  { label: '50+', sub: 'Cities Covered', icon: MapPin },
  { label: '24/7', sub: 'Live Tracking', icon: Globe },
];

const features = [
  { icon: Globe, title: 'Real-Time Tracking', desc: 'Track your cargo across borders with live GPS updates every step of the way.' },
  { icon: QrCode, title: 'QR Code Management', desc: 'Scan and manage parcels instantly with integrated QR code technology.' },
  { icon: CreditCard, title: 'Secure Payments', desc: 'Encrypted payment processing with multiple currency support and invoicing.' },
  { icon: Route, title: 'Multi-Route Support', desc: 'Flexible routing options via air, sea, and land freight across continents.' },
  { icon: Bell, title: 'Instant Notifications', desc: 'Get real-time alerts for every milestone via SMS, email, and push notifications.' },
  { icon: BarChart3, title: 'Analytics Dashboard', desc: 'Comprehensive analytics and reporting for shipments, revenue, and performance.' },
];

const steps = [
  { num: '01', title: 'Book Shipment', desc: 'Create a shipment order with pickup & delivery details online.' },
  { num: '02', title: 'We Collect', desc: 'Our team picks up your cargo and handles all packaging & documentation.' },
  { num: '03', title: 'Track Live', desc: 'Monitor your shipment in real-time from origin to destination.' },
  { num: '04', title: 'Delivered', desc: 'Safe delivery with digital proof of delivery and instant confirmation.' },
];

/* ─────────────────────────── component ─────────────────────────── */

export default function CargoWelcome() {
  const [toast, setToast] = useState<string | null>(null);
  const [particles] = useState(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 1,
      delay: Math.random() * 10,
      duration: Math.random() * 15 + 10,
    }))
  );

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handlePortalClick = (portal: PortalCard) => {
    setToast(`${portal.title} selected — Launching soon!`);
  };

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden bg-slate-950 text-white relative scroll-smooth">
      {/* ─── Floating Particles ─── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full bg-emerald-400/20 animate-pulse"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
      </div>

      {/* ─── Animated Gradient Orbs ─── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(16,185,129,0.4) 0%, transparent 70%)',
            animation: 'floatOrb1 12s ease-in-out infinite',
          }}
        />
        <div
          className="absolute top-1/3 -right-40 w-[400px] h-[400px] rounded-full opacity-15"
          style={{
            background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)',
            animation: 'floatOrb2 15s ease-in-out infinite',
          }}
        />
        <div
          className="absolute -bottom-40 left-1/3 w-[450px] h-[450px] rounded-full opacity-10"
          style={{
            background: 'radial-gradient(circle, rgba(16,185,129,0.35) 0%, transparent 70%)',
            animation: 'floatOrb3 18s ease-in-out infinite',
          }}
        />
      </div>

      {/* ─── Toast ─── */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-emerald-500/20 backdrop-blur-xl border border-emerald-400/40 text-emerald-100 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span className="font-medium">{toast}</span>
          </div>
        </div>
      )}

      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="relative z-10 min-h-[480px] flex flex-col items-center justify-center px-6 py-16 text-center">
        {/* Badge */}
        <div className="mb-6 animate-in fade-in duration-700">
          <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 px-4 py-1.5 text-sm font-medium tracking-wide hover:bg-emerald-500/20 transition-colors">
            <Star className="w-3.5 h-3.5 mr-1.5" />
            Global Cargo Logistics Partner
          </Badge>
        </div>

        {/* Title */}
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-300 bg-clip-text text-transparent">
            Welcome to
          </span>{' '}
          <span className="bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
            KOBECARGO
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mb-8 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-150">
          Global Cargo Logistics — China to Tanzania & Beyond
          <br />
          <span className="text-slate-500 text-base">Your trusted partner for seamless international freight forwarding</span>
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap gap-4 justify-center mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
          <Button
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-6 text-base font-semibold rounded-xl shadow-lg shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40 hover:scale-105"
            onClick={() => handlePortalClick(portals[0])}
          >
            Send a Shipment
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          <Button
            variant="outline"
            className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white px-8 py-6 text-base font-semibold rounded-xl transition-all hover:scale-105"
            onClick={() => handlePortalClick(portals[1])}
          >
            Track a Shipment
            <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
        </div>

        {/* Stats Ticker */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 w-full max-w-4xl animate-in fade-in slide-in-from-bottom-10 duration-700 delay-500">
          {stats.map((s) => (
            <div
              key={s.sub}
              className="group bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center hover:bg-white/10 hover:border-emerald-500/30 transition-all duration-300 hover:-translate-y-1"
            >
              <s.icon className="w-6 h-6 text-emerald-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
              <div className="text-2xl font-bold text-white">{s.label}</div>
              <div className="text-xs text-slate-400 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════ PORTAL CARDS ═══════════════════════ */}
      <section className="relative z-10 px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              Choose Your Portal
            </h2>
            <p className="text-slate-400 max-w-lg mx-auto">
              Access the right tools for your role in the logistics chain. Select a portal to get started.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {portals.map((portal, i) => (
              <Card
                key={portal.id}
                className={`bg-gradient-to-br ${portal.bgGradient} backdrop-blur-md ${portal.borderColor} border cursor-pointer group hover:scale-105 hover:shadow-2xl transition-all duration-300 overflow-hidden`}
                style={{ animationDelay: `${i * 100}ms` }}
                onClick={() => handlePortalClick(portal)}
              >
                <CardContent className="p-6 flex flex-col items-center text-center">
                  <div className={`${portal.color} mb-4 p-4 rounded-2xl bg-white/5 group-hover:bg-white/10 transition-colors`}>
                    <portal.icon className="w-8 h-8 group-hover:scale-110 transition-transform" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-1">{portal.title}</h3>
                  <p className="text-sm text-slate-400">{portal.desc}</p>
                  <div className="mt-4 flex items-center text-xs font-medium text-slate-500 group-hover:text-emerald-400 transition-colors">
                    Access Portal
                    <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ FEATURES ═══════════════════════ */}
      <section className="relative z-10 px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="bg-slate-800 text-slate-300 border-slate-700 mb-4 px-4 py-1">
              Why Choose Us
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              Powerful Features
            </h2>
            <p className="text-slate-400 max-w-lg mx-auto">
              Everything you need to manage global logistics efficiently in one integrated platform.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <Card
                key={f.title}
                className="bg-white/[0.03] backdrop-blur-md border-white/10 hover:border-emerald-500/30 hover:bg-white/[0.06] transition-all duration-300 group"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                      <f.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-emerald-300 transition-colors">
                        {f.title}
                      </h3>
                      <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ HOW IT WORKS ═══════════════════════ */}
      <section className="relative z-10 px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="bg-slate-800 text-slate-300 border-slate-700 mb-4 px-4 py-1">
              Simple Process
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              How It Works
            </h2>
            <p className="text-slate-400 max-w-lg mx-auto">
              Four simple steps to get your cargo from China to Tanzania safely and on time.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {/* Connecting lines for desktop */}
            <div className="hidden lg:block absolute top-[72px] left-[15%] right-[15%] h-0.5">
              <div className="h-full bg-gradient-to-r from-emerald-500/40 via-slate-600/30 to-emerald-500/40" />
            </div>

            {steps.map((step, i) => (
              <div key={step.num} className="relative text-center group">
                {/* Step Number Circle */}
                <div className="relative z-10 mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-900/20 border border-emerald-500/30 flex items-center justify-center mb-5 group-hover:from-emerald-500/30 group-hover:to-emerald-600/30 group-hover:scale-110 group-hover:border-emerald-400/50 transition-all duration-300 shadow-lg shadow-emerald-500/10">
                  <span className="text-2xl font-bold text-emerald-400">{step.num}</span>
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-emerald-300 transition-colors">
                  {step.title}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed max-w-[220px] mx-auto">
                  {step.desc}
                </p>

                {/* Arrow for mobile */}
                {i < steps.length - 1 && (
                  <div className="lg:hidden flex justify-center my-4">
                    <ArrowRight className="w-5 h-5 text-slate-600 rotate-90" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ CTA BANNER ═══════════════════════ */}
      <section className="relative z-10 px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/60 via-slate-900/80 to-blue-900/60" />
            <div
              className="absolute inset-0 opacity-30"
              style={{
                background: 'radial-gradient(ellipse at 30% 50%, rgba(16,185,129,0.3) 0%, transparent 60%)',
              }}
            />

            <div className="relative z-10 px-8 py-12 md:px-16 text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Ready to Ship with{' '}
                <span className="text-emerald-400">KOBECARGO</span>?
              </h2>
              <p className="text-slate-300 max-w-xl mx-auto mb-8">
                Join thousands of businesses trusting us for their international logistics needs.
                Start shipping between China and Tanzania today.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Button
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-6 text-base font-semibold rounded-xl shadow-lg shadow-emerald-500/25 transition-all hover:scale-105"
                  onClick={() => handlePortalClick(portals[0])}
                >
                  Get Started Now
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button
                  variant="outline"
                  className="border-slate-500 text-slate-300 hover:bg-slate-800 hover:text-white px-8 py-6 text-base font-semibold rounded-xl transition-all hover:scale-105"
                  onClick={() => setToast('Contact form coming soon!')}
                >
                  Contact Sales
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ FOOTER ═══════════════════════ */}
      <footer className="relative z-10 border-t border-white/5 bg-slate-950/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30">
                  <Plane className="w-5 h-5 text-emerald-400" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">
                  KOBECARGO
                </span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Your global cargo logistics partner specializing in China-Tanzania freight forwarding with cutting-edge technology.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Portals</h4>
              <ul className="space-y-2.5">
                {portals.slice(0, 4).map((p) => (
                  <li key={p.id}>
                    <button
                      className="text-sm text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1.5"
                      onClick={() => handlePortalClick(p)}
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                      {p.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Services */}
            <div>
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Services</h4>
              <ul className="space-y-2.5">
                {['Air Freight', 'Sea Freight', 'Land Transport', 'Warehousing', 'Customs Clearance', 'Insurance'].map((s) => (
                  <li key={s}>
                    <span className="text-sm text-slate-400 hover:text-emerald-400 transition-colors cursor-default flex items-center gap-1.5">
                      <ChevronRight className="w-3.5 h-3.5" />
                      {s}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Contact</h4>
              <ul className="space-y-3">
                <li className="flex items-center gap-2.5 text-sm text-slate-400">
                  <div className="p-1.5 rounded-lg bg-white/5">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                  </div>
                  Shanghai, China & Dar es Salaam, TZ
                </li>
                <li className="flex items-center gap-2.5 text-sm text-slate-400">
                  <div className="p-1.5 rounded-lg bg-white/5">
                    <Phone className="w-4 h-4 text-emerald-400" />
                  </div>
                  +86 21-XXXX-XXXX
                </li>
                <li className="flex items-center gap-2.5 text-sm text-slate-400">
                  <div className="p-1.5 rounded-lg bg-white/5">
                    <Mail className="w-4 h-4 text-emerald-400" />
                  </div>
                  info@kobecargo.com
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-500">
              &copy; {new Date().getFullYear()} KOBECARGO. All rights reserved. Global Cargo Logistics Solutions.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Globe className="w-3.5 h-3.5 text-emerald-500/60" />
              China — Tanzania — Worldwide
            </div>
          </div>
        </div>
      </footer>

      {/* ═══════════════════════ CSS KEYFRAMES ═══════════════════════ */}
      <style>{`
        @keyframes floatOrb1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(60px, -40px) scale(1.1); }
          66% { transform: translate(-30px, 30px) scale(0.95); }
        }
        @keyframes floatOrb2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-50px, 50px) scale(1.05); }
          66% { transform: translate(40px, -30px) scale(0.9); }
        }
        @keyframes floatOrb3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, 40px) scale(1.08); }
          66% { transform: translate(-50px, -20px) scale(0.92); }
        }
      `}</style>
    </div>
  );
}
