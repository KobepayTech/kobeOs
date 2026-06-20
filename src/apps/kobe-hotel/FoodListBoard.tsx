import { useMemo, useState } from 'react';
import { Plus, Search, UtensilsCrossed, Flame, Leaf, Coffee, IceCream2, Beef, Fish } from 'lucide-react';

/**
 * Blue/light themed Food List — customer-facing catalog view of the menu
 * with photos and category filters. The menu editor (existing `menu` tab)
 * remains for staff CRUD; this is the merchandising view.
 */

export interface FoodItem {
  id: string | number;
  name: string;
  category: string;
  price: number;
  currency?: string;
  available: boolean;
  imageUrl?: string;
  description?: string;
  spicy?: boolean;
  vegetarian?: boolean;
}

interface Props {
  items?: FoodItem[];
}

const FALLBACK: Record<string, string> = {
  Breakfast: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=600&h=360&fit=crop',
  Lunch:     'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=360&fit=crop',
  Dinner:    'https://images.unsplash.com/photo-1559847844-5315695dadae?w=600&h=360&fit=crop',
  Swahili:   'https://images.unsplash.com/photo-1574484284002-952d92456975?w=600&h=360&fit=crop',
  Desserts:  'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&h=360&fit=crop',
  Drinks:    'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=600&h=360&fit=crop',
  Default:   'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=360&fit=crop',
};

const DEMO_FOOD: FoodItem[] = [
  { id: 1,  name: 'Full English Breakfast', category: 'Breakfast', price:  8000, available: true,  imageUrl: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=600&h=360&fit=crop', description: 'Eggs, bacon, beans, sausage, hash brown' },
  { id: 2,  name: 'Pancakes & Maple',       category: 'Breakfast', price:  5500, available: true,  vegetarian: true, imageUrl: 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=600&h=360&fit=crop', description: 'Stack of three with fresh berries' },
  { id: 3,  name: 'Fruit Platter',          category: 'Breakfast', price:  4000, available: true,  vegetarian: true, imageUrl: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=600&h=360&fit=crop', description: 'Seasonal tropical fruits' },
  { id: 4,  name: 'Chicken Curry',          category: 'Lunch',     price:  7500, available: true,  spicy: true, imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&h=360&fit=crop', description: 'House blend, served with basmati' },
  { id: 5,  name: 'Beef Stew',              category: 'Lunch',     price:  7000, available: true,  imageUrl: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=600&h=360&fit=crop', description: 'Slow-cooked with vegetables' },
  { id: 6,  name: 'Pilau',                  category: 'Lunch',     price:  6500, available: true,  imageUrl: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&h=360&fit=crop', description: 'Spiced rice with beef' },
  { id: 7,  name: 'Grilled Chicken',        category: 'Dinner',    price:  9500, available: true,  imageUrl: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=600&h=360&fit=crop', description: 'Half chicken, herb-marinated' },
  { id: 8,  name: 'T-Bone Steak',           category: 'Dinner',    price: 14000, available: true,  imageUrl: 'https://images.unsplash.com/photo-1558030006-450675393462?w=600&h=360&fit=crop', description: '350g, mash & seasonal greens' },
  { id: 9,  name: 'Seafood Platter',        category: 'Dinner',    price: 16000, available: false, imageUrl: 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=600&h=360&fit=crop', description: 'Prawn, calamari, fish, octopus' },
  { id: 10, name: 'Zanzibar Pizza',         category: 'Swahili',   price:  3500, available: true,  imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=360&fit=crop', description: 'Egg, mince, vegetables, cheese' },
  { id: 11, name: 'Mishkaki',               category: 'Swahili',   price:  4000, available: true,  spicy: true, imageUrl: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=600&h=360&fit=crop', description: 'Grilled beef skewers' },
  { id: 12, name: 'Urojo',                  category: 'Swahili',   price:  3000, available: true,  spicy: true, imageUrl: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=600&h=360&fit=crop', description: 'Tangy Zanzibar mix soup' },
  { id: 13, name: 'Chocolate Cake',         category: 'Desserts',  price:  4500, available: true,  vegetarian: true, imageUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&h=360&fit=crop', description: 'Warm with ganache' },
  { id: 14, name: 'Ice Cream',              category: 'Desserts',  price:  3000, available: true,  vegetarian: true, imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&h=360&fit=crop', description: 'Vanilla / chocolate / strawberry' },
  { id: 15, name: 'Cheesecake',             category: 'Desserts',  price:  5000, available: true,  vegetarian: true, imageUrl: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=600&h=360&fit=crop', description: 'New York style with berries' },
];

const CATEGORY_ICONS: Record<string, typeof Coffee> = {
  Breakfast: Coffee,
  Lunch:     UtensilsCrossed,
  Dinner:    Beef,
  Swahili:   Fish,
  Desserts:  IceCream2,
  Drinks:    Coffee,
};

export default function FoodListBoard({ items = DEMO_FOOD }: Props) {
  const categories = useMemo(() => ['All', ...Array.from(new Set(items.map((i) => i.category)))], [items]);
  const [cat, setCat] = useState<string>('All');
  const [search, setSearch] = useState('');

  const filtered = items.filter((i) => {
    if (cat !== 'All' && i.category !== cat) return false;
    if (search && !`${i.name} ${i.description ?? ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts: Record<string, number> = {};
  for (const c of categories) counts[c] = c === 'All' ? items.length : items.filter((i) => i.category === c).length;

  return (
    <div
      className="-mx-6 -my-6 px-6 py-6 bg-slate-50 text-slate-900 min-h-full"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <div className="flex items-center justify-between mb-5 gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Food List</h2>
          <p className="text-xs text-slate-500 mt-0.5">{items.length} items · what guests see in the QR portal</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dish…"
              className="pl-8 pr-3 py-2 rounded-md border border-slate-200 bg-white text-xs w-56 focus:outline-none focus:border-blue-400"
            />
          </div>
          <button className="inline-flex items-center gap-1 px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold">
            <Plus className="w-3.5 h-3.5" />Add Dish
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto pb-2">
        {categories.map((c) => {
          const Icon = CATEGORY_ICONS[c] ?? UtensilsCrossed;
          const active = cat === c;
          return (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold flex-shrink-0 transition ${
                active ? 'bg-blue-600 border-blue-600 text-white shadow' : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {c}
              <span className={`ml-1 px-1.5 py-0 rounded text-[10px] font-extrabold ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>{counts[c]}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center text-sm text-slate-400">
          No dishes match your filter.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((item) => <FoodCard key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}

function FoodCard({ item }: { item: FoodItem }) {
  const img = item.imageUrl ?? FALLBACK[item.category] ?? FALLBACK.Default;
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition ${!item.available ? 'opacity-60' : ''}`}>
      <div className="relative h-32 bg-slate-200">
        <img src={img} alt={item.name} className="w-full h-full object-cover" />
        <div className="absolute top-2 left-2 flex gap-1">
          {item.spicy      && <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white text-[10px] font-extrabold inline-flex items-center gap-0.5"><Flame className="w-3 h-3" />Spicy</span>}
          {item.vegetarian && <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-white text-[10px] font-extrabold inline-flex items-center gap-0.5"><Leaf className="w-3 h-3" />Veg</span>}
        </div>
        {!item.available && (
          <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center">
            <span className="px-2 py-1 rounded bg-white text-slate-800 text-[11px] font-extrabold">86&apos;d</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className="text-sm font-extrabold text-slate-900 leading-tight">{item.name}</h4>
          <span className="text-sm font-extrabold text-blue-600 whitespace-nowrap">TZS {(item.price / 1000).toFixed(item.price >= 10000 ? 0 : 1)}K</span>
        </div>
        <p className="text-[11px] text-slate-500 line-clamp-2 leading-tight min-h-[28px]">{item.description ?? ''}</p>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <span className="text-[10px] uppercase tracking-wide font-bold text-slate-400">{item.category}</span>
          <button className="text-[11px] font-bold text-blue-600 hover:text-blue-500">Edit</button>
        </div>
      </div>
    </div>
  );
}
