import { Sparkles, TrendingUp, Tag, Award, Heart, PackageSearch, Star, CreditCard, Home } from 'lucide-react';

export type StorefrontView =
  | 'home'
  | 'new-arrivals'
  | 'best-sellers'
  | 'offers'
  | 'brands'
  | 'wishlist'
  | 'track-order'
  | 'loyalty'
  | 'bnpl';

export const NAV_ITEMS: Array<{ key: StorefrontView; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'new-arrivals', label: 'New Arrivals', icon: Sparkles },
  { key: 'best-sellers', label: 'Best Sellers', icon: TrendingUp },
  { key: 'offers', label: 'Offers', icon: Tag },
  { key: 'brands', label: 'Brands', icon: Award },
  { key: 'wishlist', label: 'Wishlist', icon: Heart },
  { key: 'track-order', label: 'Track Order', icon: PackageSearch },
  { key: 'loyalty', label: 'Loyalty', icon: Star },
  { key: 'bnpl', label: 'Pay Later', icon: CreditCard },
];

export function StorefrontNav({
  current,
  onChange,
}: {
  current: StorefrontView;
  onChange: (v: StorefrontView) => void;
}) {
  return (
    <div className="flex gap-1 px-4 py-2 overflow-x-auto shrink-0 bg-slate-800/40 border-b border-white/10">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = current === item.key;
        return (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
              active ? 'bg-blue-600 text-white' : 'bg-white/[0.06] text-slate-300 hover:bg-white/15'
            }`}
          >
            <Icon className="w-3 h-3" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
