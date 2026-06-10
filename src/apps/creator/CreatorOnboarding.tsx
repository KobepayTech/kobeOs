// ============================================================================
// CREATOR ONBOARDING — Multi-step wizard for new creator signups
// ============================================================================
// Steps:
// 1. Welcome & Basic Info       → name, handle, niche, country, bio
// 2. Connect Platforms          → instagram, youtube, tiktok, x
// 3. Set Your Rates             → tier selection + weekly rate
// 4. Portfolio & Verification   → portfolio upload + terms
// 5. Dashboard Preview          → post-signup preview
// ============================================================================

import { useState, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sparkles,
  Instagram,
  Youtube,
  Twitter,
  Smartphone,
  ChevronRight,
  ChevronLeft,
  Check,
  Upload,
  Users,
  TrendingUp,
  BarChart3,
  DollarSign,
  Globe,
  Star,
  AlertCircle,
  FileText,
  Zap,
  Crown,
  Rocket,
  Award,
} from 'lucide-react';

// ── Constants ───────────────────────────────────────────

const NICHES = [
  'Fashion', 'Tech', 'Food', 'Fitness', 'Beauty', 'Travel',
  'Gaming', 'Music', 'Comedy', 'Education', 'Business',
  'Lifestyle', 'Sports', 'Health',
];

const COUNTRIES = [
  'Tanzania', 'Kenya', 'Ghana', 'Nigeria', 'Uganda',
  'Rwanda', 'Senegal', 'South Africa', 'Other',
];

const TIERS = [
  {
    id: 'basic',
    name: 'Basic',
    priceRange: 'TZS 150K-350K',
    priceNum: { min: 150000, max: 350000 },
    description: '1 Feed Post + Story',
    icon: Star,
    color: '#10b981',
    bgColor: 'from-emerald-500/10 to-emerald-900/5',
  },
  {
    id: 'standard',
    name: 'Standard',
    priceRange: 'TZS 350K-750K',
    priceNum: { min: 350000, max: 750000 },
    description: '2 Posts + 3 Stories + Reel',
    icon: Zap,
    color: '#06b6d4',
    bgColor: 'from-cyan-500/10 to-cyan-900/5',
  },
  {
    id: 'premium',
    name: 'Premium',
    priceRange: 'TZS 750K-1.5M',
    priceNum: { min: 750000, max: 1500000 },
    description: '4 Posts + 5 Stories + 2 Reels + Analytics Report',
    icon: Crown,
    color: '#f59e0b',
    bgColor: 'from-amber-500/10 to-amber-900/5',
  },
  {
    id: 'elite',
    name: 'Elite',
    priceRange: 'Custom pricing',
    priceNum: { min: 1500000, max: 5000000 },
    description: 'Full campaign management + dedicated support',
    icon: Rocket,
    color: '#ec4899',
    bgColor: 'from-pink-500/10 to-pink-900/5',
  },
] as const;

const PLATFORM_CONFIG = [
  {
    platform: 'instagram',
    label: 'Instagram',
    icon: Instagram,
    color: '#E1306C',
    placeholder: '@username',
  },
  {
    platform: 'youtube',
    label: 'YouTube',
    icon: Youtube,
    color: '#FF0000',
    placeholder: 'Channel URL',
  },
  {
    platform: 'tiktok',
    label: 'TikTok',
    icon: Smartphone,
    color: '#00f2ea',
    placeholder: '@username',
  },
  {
    platform: 'x',
    label: 'X / Twitter',
    icon: Twitter,
    color: '#1DA1F2',
    placeholder: '@username',
  },
] as const;

// ── Types ───────────────────────────────────────────────

interface PlatformData {
  platform: string;
  handle: string;
  followerCount: number;
}

interface FormData {
  name: string;
  handle: string;
  niche: string;
  country: string;
  bio: string;
  weeklyRate: string;
  minBudget: string;
  tier: string;
}

interface FormErrors {
  [key: string]: string;
}

// ── Helper Components ───────────────────────────────────

function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between relative">
        {/* Background line */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/[0.06] -translate-y-1/2" />
        {/* Active line */}
        <div
          className="absolute top-1/2 left-0 h-0.5 bg-gradient-to-r from-cyan-500 to-violet-500 -translate-y-1/2 transition-all duration-500"
          style={{ width: `${(current / (steps.length - 1)) * 100}%` }}
        />
        {steps.map((label, i) => {
          const isActive = i <= current;
          const isCurrent = i === current;
          return (
            <div key={i} className="relative z-10 flex flex-col items-center gap-2">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all duration-300 ${
                  isCurrent
                    ? 'border-cyan-400 bg-cyan-500/20 text-cyan-400 scale-110'
                    : isActive
                    ? 'border-violet-400 bg-violet-500/20 text-violet-400'
                    : 'border-white/[0.1] bg-[#13131f] text-slate-500'
                }`}
              >
                {isActive && !isCurrent ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <span
                className={`text-xs font-medium transition-colors duration-300 ${
                  isCurrent ? 'text-cyan-400' : isActive ? 'text-violet-400' : 'text-slate-600'
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InputLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-xs text-slate-400 mb-1.5 block">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="flex items-center gap-1 mt-1">
      <AlertCircle className="w-3 h-3 text-red-400" />
      <span className="text-xs text-red-400">{message}</span>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────

export function CreatorOnboarding() {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    handle: '',
    niche: '',
    country: '',
    bio: '',
    weeklyRate: '',
    minBudget: '',
    tier: 'basic',
  });

  const [platforms, setPlatforms] = useState<PlatformData[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [countsAccurate, setCountsAccurate] = useState(false);
  const [portfolioFiles, setPortfolioFiles] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const stepLabels = ['Basic Info', 'Platforms', 'Rates', 'Portfolio', 'Dashboard'];

  const updateField = useCallback((field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }, [errors]);

  // ── Platform helpers ──
  const getPlatform = (p: string) => platforms.find((x) => x.platform === p);

  const updatePlatform = (platform: string, handle: string) => {
    setPlatforms((prev) => {
      const existing = prev.find((p) => p.platform === platform);
      if (existing) {
        return prev.map((p) => (p.platform === platform ? { ...p, handle } : p));
      }
      return [...prev, { platform, handle, followerCount: 0 }];
    });
  };

  const updatePlatformCount = (platform: string, count: number) => {
    setPlatforms((prev) => {
      const existing = prev.find((p) => p.platform === platform);
      if (existing) {
        return prev.map((p) => (p.platform === platform ? { ...p, followerCount: count } : p));
      }
      return [...prev, { platform, handle: '', followerCount: count }];
    });
  };

  const connectedCount = useMemo(() => platforms.filter((p) => p.handle).length, [platforms]);
  const totalFollowers = useMemo(
    () => platforms.reduce((sum, p) => sum + (p.followerCount || 0), 0),
    [platforms],
  );

  // ── Validation ──
  const validateStep = (s: number): boolean => {
    const e: FormErrors = {};
    if (s === 0) {
      if (!formData.name.trim()) e.name = 'Display name is required';
      else if (formData.name.trim().length < 2) e.name = 'Min 2 characters';
      if (!formData.handle.trim()) e.handle = 'Handle is required';
      else if (formData.handle.trim().length < 2) e.handle = 'Min 2 characters';
      if (!formData.niche) e.niche = 'Select a niche';
      if (!formData.country) e.country = 'Select a country';
      if (!formData.bio.trim()) e.bio = 'Bio is required';
      else if (formData.bio.trim().length > 300) e.bio = 'Max 300 characters';
    }
    if (s === 1) {
      if (platforms.length === 0 || !platforms.some((p) => p.handle)) {
        e.platforms = 'Connect at least one platform';
      }
    }
    if (s === 2) {
      if (!formData.weeklyRate || Number(formData.weeklyRate) < 10000) {
        e.weeklyRate = 'Enter a valid weekly rate (min 10,000 TZS)';
      }
      if (!formData.minBudget || Number(formData.minBudget) < 10000) {
        e.minBudget = 'Enter a valid minimum budget (min 10,000 TZS)';
      }
    }
    if (s === 3) {
      if (!termsAccepted) e.terms = 'You must accept the terms of service';
      if (!countsAccurate) e.counts = 'Please confirm follower counts are accurate';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const nextStep = () => {
    if (!validateStep(step)) return;
    if (step < stepLabels.length - 1) {
      setDirection(1);
      setStep((s) => s + 1);
    }
  };

  const prevStep = () => {
    if (step > 0) {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  };

  // ── Submit ──
  const handleSubmit = async () => {
    if (!validateStep(step)) return;
    setSubmitting(true);
    try {
      await api('/creators', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name,
          handle: formData.handle,
          niche: formData.niche,
          country: formData.country,
          bio: formData.bio,
          platforms: platforms.map((p) => p.platform),
          weeklyRateTzs: Number(formData.weeklyRate),
          subscriptionTier: formData.tier,
        }),
      });
      setSubmitted(true);
      setDirection(1);
      setStep(stepLabels.length - 1);
    } catch (err) {
      console.error('Failed to register creator:', err);
      setErrors({ submit: 'Something went wrong. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Drag & drop ──
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) {
      setPortfolioFiles((prev) => [
        ...prev,
        ...files.slice(0, 5 - prev.length).map((f) => f.name),
      ]);
    }
  };

  // ── Render helpers ──
  const selectedTier = TIERS.find((t) => t.id === formData.tier) || TIERS[0];

  // ── Step 1: Welcome & Basic Info ──
  const renderStep1 = () => (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 flex items-center justify-center mx-auto mb-4 border border-cyan-500/20">
          <Sparkles className="w-7 h-7 text-cyan-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Become a Kobe Creator</h2>
        <p className="text-sm text-slate-400 mt-1">
          Monetize your social media presence with brand deals
        </p>
      </div>

      <Card className="bg-white/[0.03] border-white/[0.06]">
        <CardContent className="p-5 space-y-4">
          <div>
            <InputLabel required>Display Name</InputLabel>
            <Input
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
              placeholder="e.g. Zara Hassan"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              maxLength={50}
            />
            <ErrorText message={errors.name} />
          </div>

          <div>
            <InputLabel required>Handle</InputLabel>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">@</span>
              <Input
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 pl-7"
                placeholder="username"
                value={formData.handle}
                onChange={(e) => updateField('handle', e.target.value.replace(/^@/, ''))}
                maxLength={30}
              />
            </div>
            <ErrorText message={errors.handle} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <InputLabel required>Niche / Category</InputLabel>
              <Select value={formData.niche} onValueChange={(v) => updateField('niche', v)}>
                <SelectTrigger className="w-full bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Select niche" />
                </SelectTrigger>
                <SelectContent className="bg-[#1e1e2e] border-white/10 text-white">
                  {NICHES.map((n) => (
                    <SelectItem key={n} value={n} className="text-white hover:bg-white/10">
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ErrorText message={errors.niche} />
            </div>

            <div>
              <InputLabel required>Country</InputLabel>
              <Select value={formData.country} onValueChange={(v) => updateField('country', v)}>
                <SelectTrigger className="w-full bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent className="bg-[#1e1e2e] border-white/10 text-white">
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c} className="text-white hover:bg-white/10">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ErrorText message={errors.country} />
            </div>
          </div>

          <div>
            <InputLabel required>Bio</InputLabel>
            <textarea
              className="w-full rounded-md border border-white/10 bg-white/5 text-white placeholder:text-slate-500 px-3 py-2 text-sm outline-none focus-visible:border-cyan-500/50 focus-visible:ring-1 focus-visible:ring-cyan-500/30 resize-none"
              rows={3}
              maxLength={300}
              placeholder="Tell brands about yourself..."
              value={formData.bio}
              onChange={(e) => updateField('bio', e.target.value)}
            />
            <div className="flex items-center justify-between mt-1">
              <ErrorText message={errors.bio} />
              <span className="text-xs text-slate-500 ml-auto">{formData.bio.length}/300</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ── Step 2: Connect Platforms ──
  const renderStep2 = () => (
    <div className="space-y-5">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-white">Connect Your Platforms</h2>
        <p className="text-sm text-slate-400 mt-1">
          Link your social accounts to showcase your audience
        </p>
      </div>

      {/* Total followers badge */}
      <div className="flex items-center justify-center">
        <div className="bg-gradient-to-r from-cyan-500/10 to-violet-500/10 border border-cyan-500/20 rounded-xl px-6 py-3 flex items-center gap-4">
          <Users className="w-5 h-5 text-cyan-400" />
          <div>
            <div className="text-xs text-slate-400">Total Combined Followers</div>
            <div className="text-lg font-bold text-white">{totalFollowers.toLocaleString()}</div>
          </div>
          {connectedCount > 0 && (
            <div className="bg-cyan-500/20 text-cyan-400 text-xs font-medium px-2 py-0.5 rounded-full border border-cyan-500/30">
              {connectedCount} connected
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {PLATFORM_CONFIG.map((cfg) => {
          const connected = getPlatform(cfg.platform);
          const Icon = cfg.icon;
          return (
            <Card
              key={cfg.platform}
              className={`bg-white/[0.03] border-white/[0.06] transition-all duration-200 ${
                connected?.handle ? 'border-opacity-100' : ''
              }`}
              style={connected?.handle ? { borderColor: `${cfg.color}30` } : {}}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${cfg.color}15`, color: cfg.color }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{cfg.label}</span>
                      {connected?.handle && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-full border"
                          style={{
                            backgroundColor: `${cfg.color}15`,
                            color: cfg.color,
                            borderColor: `${cfg.color}30`,
                          }}
                        >
                          Connected
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Input
                        className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 h-8 text-xs flex-1"
                        placeholder={cfg.placeholder}
                        value={connected?.handle || ''}
                        onChange={(e) => updatePlatform(cfg.platform, e.target.value)}
                      />
                      <Input
                        type="number"
                        className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 h-8 text-xs w-28"
                        placeholder="Followers"
                        value={connected?.followerCount || ''}
                        onChange={(e) => updatePlatformCount(cfg.platform, Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <ErrorText message={errors.platforms} />
    </div>
  );

  // ── Step 3: Set Your Rates ──
  const renderStep3 = () => (
    <div className="space-y-5">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-white">Set Your Rates</h2>
        <p className="text-sm text-slate-400 mt-1">
          Choose a tier that matches your content offering
        </p>
      </div>

      {/* Tier cards */}
      <div className="grid grid-cols-1 gap-3">
        {TIERS.map((tier) => {
          const Icon = tier.icon;
          const isSelected = formData.tier === tier.id;
          return (
            <button
              key={tier.id}
              onClick={() => updateField('tier', tier.id)}
              className={`relative rounded-xl border-2 transition-all duration-200 text-left ${
                isSelected
                  ? 'border-cyan-500/50 bg-gradient-to-r ' + tier.bgColor
                  : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.1]'
              }`}
            >
              <div className="p-4 flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: isSelected ? `${tier.color}25` : 'rgba(255,255,255,0.05)',
                    color: isSelected ? tier.color : '#94a3b8',
                  }}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                      {tier.name}
                    </span>
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: isSelected ? `${tier.color}20` : 'rgba(255,255,255,0.05)',
                        color: isSelected ? tier.color : '#94a3b8',
                      }}
                    >
                      {tier.priceRange}/week
                    </span>
                  </div>
                  <p className={`text-xs mt-0.5 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                    {tier.description}
                  </p>
                </div>
                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Rate inputs */}
      <Card className="bg-white/[0.03] border-white/[0.06]">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <InputLabel required>Weekly Rate (TZS)</InputLabel>
              <Input
                type="number"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                placeholder={selectedTier.priceNum.min.toString()}
                value={formData.weeklyRate}
                onChange={(e) => updateField('weeklyRate', e.target.value)}
              />
              <ErrorText message={errors.weeklyRate} />
            </div>
            <div>
              <InputLabel required>Minimum Budget (TZS)</InputLabel>
              <Input
                type="number"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                placeholder="100000"
                value={formData.minBudget}
                onChange={(e) => updateField('minBudget', e.target.value)}
              />
              <ErrorText message={errors.minBudget} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ── Step 4: Portfolio & Verification ──
  const renderStep4 = () => (
    <div className="space-y-5">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-white">Portfolio & Verification</h2>
        <p className="text-sm text-slate-400 mt-1">
          Upload your best work and confirm your details
        </p>
      </div>

      {/* Upload area */}
      <Card
        className={`border-2 border-dashed transition-all duration-200 ${
          isDragging
            ? 'border-cyan-500/40 bg-cyan-500/5'
            : 'border-white/[0.06] bg-white/[0.02]'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="p-6">
          <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center mx-auto mb-3 border border-violet-500/20">
              <Upload className="w-6 h-6 text-violet-400" />
            </div>
            <p className="text-sm font-medium text-slate-300">
              Drag & drop portfolio samples here
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Or click to browse (images, PDFs, links)
            </p>
            <input
              type="file"
              multiple
              accept="image/*,.pdf"
              className="hidden"
              id="portfolio-input"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length) {
                  setPortfolioFiles((prev) => [
                    ...prev,
                    ...files.slice(0, 5 - prev.length).map((f) => f.name),
                  ]);
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="mt-3 border-white/10 text-slate-300 hover:bg-white/5 hover:text-white"
              onClick={() => document.getElementById('portfolio-input')?.click()}
            >
              Browse Files
            </Button>
          </div>

          {/* File list */}
          {portfolioFiles.length > 0 && (
            <div className="mt-4 space-y-2">
              {portfolioFiles.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 bg-white/[0.05] rounded-lg px-3 py-2 border border-white/[0.06]"
                >
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs text-slate-300 flex-1 truncate">{f}</span>
                  <button
                    className="text-slate-500 hover:text-red-400 transition-colors"
                    onClick={() => setPortfolioFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Checkboxes */}
      <Card className="bg-white/[0.03] border-white/[0.06]">
        <CardContent className="p-4 space-y-4">
          <div>
            <label className="flex items-start gap-3 cursor-pointer group">
              <Checkbox
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                className="mt-0.5 border-white/20 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
              />
              <span className="text-sm text-slate-300 group-hover:text-slate-200 transition-colors">
                I agree to the{' '}
                <button className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2">
                  creator terms of service
                </button>
              </span>
            </label>
            <ErrorText message={errors.terms} />
          </div>

          <div>
            <label className="flex items-start gap-3 cursor-pointer group">
              <Checkbox
                checked={countsAccurate}
                onCheckedChange={(checked) => setCountsAccurate(checked === true)}
                className="mt-0.5 border-white/20 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
              />
              <span className="text-sm text-slate-300 group-hover:text-slate-200 transition-colors">
                I confirm all my follower counts are accurate
              </span>
            </label>
            <ErrorText message={errors.counts} />
          </div>
        </CardContent>
      </Card>

      {errors.submit && (
        <div className="text-center text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
          {errors.submit}
        </div>
      )}
    </div>
  );

  // ── Step 5: Dashboard Preview ──
  const renderStep5 = () => (
    <div className="space-y-5">
      <div className="text-center mb-4">
        <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-3 border border-emerald-500/30">
          {submitted ? (
            <Check className="w-7 h-7 text-emerald-400" />
          ) : (
            <Sparkles className="w-7 h-7 text-emerald-400" />
          )}
        </div>
        <h2 className="text-xl font-bold text-white">
          {submitted ? 'Welcome to Kobe Studio!' : 'Dashboard Preview'}
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          {submitted
            ? 'Your creator profile has been created'
            : 'Here is how your profile will look'}
        </p>
      </div>

      {/* Profile card */}
      <Card className="bg-gradient-to-br from-[#13131f] to-[#1a1a2e] border-white/[0.08] overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-cyan-500/20 via-violet-500/20 to-pink-500/20" />
        <CardContent className="p-4 -mt-8">
          <div className="flex items-end gap-4 mb-3">
            <div className="w-16 h-16 rounded-2xl bg-[#0a0a1a] border-2 border-white/[0.08] flex items-center justify-center text-xl font-bold text-white shadow-xl">
              {formData.name ? formData.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : '?'}
            </div>
            <div className="pb-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  {formData.name || 'Your Name'}
                </h3>
                <span
                  className="text-xs px-2 py-0.5 rounded-full border"
                  style={{
                    backgroundColor: `${selectedTier.color}15`,
                    color: selectedTier.color,
                    borderColor: `${selectedTier.color}30`,
                  }}
                >
                  {selectedTier.name}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                @{formData.handle || 'handle'} · {formData.niche || 'Niche'} · {formData.country || 'Country'}
              </p>
            </div>
          </div>

          {/* Under review badge */}
          <div className="mb-3 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-amber-400 font-medium">
              Your profile is under review
            </span>
          </div>

          <p className="text-sm text-slate-400 leading-relaxed">
            {formData.bio || 'Your bio will appear here.'}
          </p>

          {/* Platforms */}
          <div className="flex items-center gap-2 mt-3">
            {platforms.filter((p) => p.handle).map((p) => {
              const cfg = PLATFORM_CONFIG.find((c) => c.platform === p.platform);
              if (!cfg) return null;
              const Icon = cfg.icon;
              return (
                <div
                  key={p.platform}
                  className="flex items-center gap-1 bg-white/[0.05] rounded-full px-2.5 py-1 border border-white/[0.06]"
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                  <span className="text-xs text-slate-300">
                    {(p.followerCount / 1000).toFixed(0)}K
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Followers', value: totalFollowers.toLocaleString(), icon: Users, color: '#8b5cf6' },
          { label: 'Engagement', value: '6.2%', icon: TrendingUp, color: '#10b981' },
          { label: 'Avg Views', value: '12.4K', icon: BarChart3, color: '#06b6d4' },
          { label: 'Earnings', value: '0 TZS', icon: DollarSign, color: '#f59e0b' },
        ].map((stat) => (
          <Card key={stat.label} className="bg-white/[0.03] border-white/[0.06]">
            <CardContent className="p-3 text-center">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2"
                style={{ backgroundColor: `${stat.color}15`, color: stat.color }}
              >
                <stat.icon className="w-4 h-4" />
              </div>
              <div className="text-sm font-bold text-white truncate">{stat.value}</div>
              <div className="text-[10px] text-slate-500">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tips */}
      <Card className="bg-cyan-500/[0.03] border-cyan-500/15">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-cyan-400">Tip: Complete your portfolio to get verified faster</p>
              <p className="text-xs text-slate-400 mt-1">
                Brands prefer creators with verified follower counts and portfolio samples.
                Add more platforms to increase your visibility.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ── Step renderer ──
  const renderStep = () => {
    switch (step) {
      case 0: return renderStep1();
      case 1: return renderStep2();
      case 2: return renderStep3();
      case 3: return renderStep4();
      case 4: return renderStep5();
      default: return renderStep1();
    }
  };

  const isLastStep = step === stepLabels.length - 1;
  const isFirstStep = step === 0;

  return (
    <div className="h-full w-full bg-[#0a0a1a] text-white overflow-y-auto">
      <div className="min-h-full flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold tracking-wide text-white">KOBE CREATOR</span>
          </div>
          <span className="text-xs text-slate-500">
            Step {step + 1} of {stepLabels.length}
          </span>
        </div>

        {/* Main content */}
        <div className="flex-1 flex items-start justify-center px-6 py-8">
          <div className="w-full max-w-lg">
            <StepIndicator steps={stepLabels} current={step} />

            {/* Animated content */}
            <div
              className="transition-all duration-300 ease-out"
              style={{
                opacity: 1,
                transform: direction > 0 ? 'translateX(0)' : 'translateX(0)',
              }}
            >
              {renderStep()}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between mt-8">
              <Button
                variant="ghost"
                onClick={prevStep}
                disabled={isFirstStep}
                className={`text-slate-400 hover:text-white hover:bg-white/5 gap-1 ${
                  isFirstStep ? 'invisible' : ''
                }`}
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>

              {isLastStep ? (
                <Button
                  onClick={() => {
                    if (submitted) {
                      /* could route to dashboard */
                    } else {
                      handleSubmit();
                    }
                  }}
                  disabled={submitting}
                  className="bg-cyan-500 hover:bg-cyan-600 text-white gap-2 px-6"
                >
                  {submitting ? (
                    'Submitting...'
                  ) : submitted ? (
                    <>
                      Go to Dashboard <ChevronRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Complete Signup <Check className="w-4 h-4" />
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={nextStep}
                  className="bg-cyan-500 hover:bg-cyan-600 text-white gap-2 px-6"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreatorOnboarding;
