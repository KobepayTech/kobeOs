import { ImageIcon } from 'lucide-react';
import { publicAssetUrl } from './api';

export interface Item {
  id: string;
  productId: string;
  businessId: string;
  name: string;
  description: string;
  category: string;
  price: number | string;
  currency: string;
  imageUrl: string;
  imageUrls: string[];
  videoUrl?: string | null;
  locationLabel?: string;
  stock: number;
  requiredOptions: string[];
  variants: Array<{ id: string; name: string; attributes?: Record<string, string>; stock?: number }>;
  business: { id: string; name: string; publicSlug: string; tier: string; phone: string; whatsapp: string };
  location: null | { property: string; floor: string; shopCode: string };
  nodeStatus: string;
  sample?: 'headphones' | 'bag' | 'lamp';
}

export const money = (value: number | string, currency = 'TZS') => `${currency} ${Number(value).toLocaleString('en-TZ')}`;

const sampleItems = [
  { sample: 'headphones', name: 'Studio Wireless Headphones', category: 'Electronics', price: 89000, merchant: 'Sound House', description: 'A cushioned wireless headset for music on the move. Try choosing a colour before adding it to your practice bag.', options: ['Lilac', 'Charcoal'] },
  { sample: 'bag', name: 'The Weekender Tote', category: 'Fashion', price: 45000, merchant: 'Everyday Studio', description: 'A roomy canvas tote with a wide opening and reinforced handles. An example of a fashion listing on Jumla.', options: ['Sand', 'Cocoa'] },
  { sample: 'lamp', name: 'Halo Table Lamp', category: 'Home & Living', price: 72000, merchant: 'Quiet Spaces', description: 'A softly lit table lamp for a bedside or reading corner. Try saving it to see how your wishlist works.', options: ['Amber', 'Cream'] },
] as const;

export const samples: Item[] = sampleItems.map(({ sample, name, category, price, merchant, description, options }) => ({
  id: `demo-${sample}`, productId: `demo-${sample}`, businessId: `demo-shop-${sample}`,
  name, category, price, currency: 'TZS', description, sample, stock: 9, imageUrl: '', imageUrls: [],
  requiredOptions: ['Color'], variants: options.map((color) => ({ id: color, name: color, attributes: { Color: color } })),
  business: { id: `demo-shop-${sample}`, name: merchant, publicSlug: '', tier: '', phone: '', whatsapp: '' },
  location: null, nodeStatus: 'DEMO',
}));

export function storePath(item: Item) {
  return `${item.business.tier === 'LITE' ? '/lite-shop' : '/shop'}/${encodeURIComponent(item.business.publicSlug)}`;
}

export function readLocal<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; }
  catch { return fallback; }
}

export function writeLocal(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { /* Browsing still works with storage disabled. */ }
}

export const categoryKey = (value: string) => value.trim().toLowerCase();

export function productPhotos(item: Item) {
  return [...new Set([item.imageUrl, ...(item.imageUrls || [])].filter(Boolean))];
}

export function merchantClip(item: Item) {
  try {
    const url = new URL(item.videoUrl?.trim() || '');
    return url.protocol === 'https:' && !url.username && !url.password && /\.(mp4|webm)$/i.test(url.pathname) ? url.href : '';
  } catch {
    return '';
  }
}

export function rankSimilar(source: Item, rows: Item[]) {
  const attributes = (row: Item, names: string[]) => new Set(row.variants
    .filter((variant) => variant.stock == null || variant.stock > 0)
    .flatMap((variant) => Object.entries(variant.attributes ?? {}))
    .filter(([name]) => names.includes(categoryKey(name))).map(([, value]) => categoryKey(value)).filter(Boolean));
  const sizes = ['size', 'uk size', 'eu size', 'saizi'];
  const colours = ['color', 'colour', 'rangi'];
  const shares = (a: Set<string>, b: Set<string>) => [...a].some((value) => b.has(value));
  const pickup = (row: Item) => categoryKey(row.location?.property || row.locationLabel || '');
  const sourcePickup = pickup(source);
  const sourcePrice = Number(source.price);
  return rows.filter((row) => row.productId !== source.productId && row.stock > 0
      && categoryKey(row.category) === categoryKey(source.category) && Boolean(row.sample) === Boolean(source.sample))
    .map((row) => {
      const priceGap = row.currency === source.currency ? Math.abs(Number(row.price) - sourcePrice) / Math.max(sourcePrice, 1) : Infinity;
      const score = 3 * Number(shares(attributes(source, sizes), attributes(row, sizes)))
        + 2 * Number(shares(attributes(source, colours), attributes(row, colours)))
        + Number(Boolean(sourcePickup && sourcePickup === pickup(row)));
      return { row, score, priceGap };
    })
    .sort((a, b) => b.score - a.score || a.priceGap - b.priceGap)
    .slice(0, 8).map(({ row }) => row);
}

export function ProductArt({ item, photo, eager = false }: { item: Item; photo?: string; eager?: boolean }) {
  const url = publicAssetUrl(photo || item.imageUrl || item.imageUrls?.[0]);
  if (!item.sample) return <div className="jl-product-art">
    {url ? <img key={url} src={url} alt={item.name} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={(event) => { event.currentTarget.hidden = true; }} /> : null}
    <span aria-hidden="true"><ImageIcon /> Photo unavailable</span>
  </div>;

  return <div className={`jl-product-art jl-art-${item.sample}`} aria-hidden="true">
    <svg viewBox="0 0 400 440" fill="none" preserveAspectRatio="xMidYMid meet">
      <ellipse cx="202" cy="337" rx="132" ry="24" fill="#221934" opacity=".13" />
      <circle cx="200" cy="192" r="143" stroke="white" opacity=".4" />
      <circle cx="200" cy="192" r="174" stroke="white" opacity=".28" />
      {item.sample === 'headphones' && <g transform="rotate(-17 200 197)">
        <path d="M103 233v-56a97 97 0 0 1 194 0v56" stroke="#292241" strokeWidth="32" />
        <path d="M103 196v-22a97 97 0 0 1 194 0v22" stroke="#dbd0ff" strokeWidth="24" />
        <path d="M102 183v-12a98 98 0 0 1 196 0v12" stroke="#f1e9ff" strokeWidth="5" opacity=".8" />
        <rect x="78" y="206" width="65" height="106" rx="29" fill="#8775ce" />
        <rect x="80" y="211" width="43" height="95" rx="21" fill="#c8b6ff" />
        <rect x="121" y="214" width="28" height="91" rx="14" fill="#30264e" />
        <rect x="253" y="206" width="68" height="106" rx="29" fill="#8471c8" />
        <rect x="276" y="209" width="42" height="99" rx="20" fill="#e5d8ff" />
        <rect x="248" y="214" width="29" height="91" rx="14" fill="#30264e" />
        <path d="M290 279h14m-14 8h9" stroke="#8775ce" strokeWidth="3" strokeLinecap="round" />
      </g>}
      {item.sample === 'bag' && <g transform="rotate(-8 200 210)">
        <path d="M151 179v-39a49 49 0 0 1 98 0v39" stroke="#614938" strokeWidth="16" />
        <path d="M100 163h200l-17 150a23 23 0 0 1-23 20H140a23 23 0 0 1-23-20z" fill="#b78457" />
        <path d="M100 163h184l-16 146a21 21 0 0 1-21 18H138a21 21 0 0 1-21-18z" fill="#f0c998" />
        <path d="M128 187h123M145 205v107m86-107v107" stroke="#a36e47" strokeWidth="2" strokeDasharray="4 6" opacity=".7" />
        <path d="M145 225v-87a44 44 0 1 1 88 0v87" stroke="#7b5036" strokeWidth="15" />
        <rect x="159" y="250" width="61" height="43" rx="6" fill="#d7a773" />
        <path d="M179 270h22" stroke="#845937" strokeWidth="3" strokeLinecap="round" />
      </g>}
      {item.sample === 'lamp' && <g>
        <path d="M200 165v151" stroke="#6f4524" strokeWidth="23" />
        <path d="M195 166v151" stroke="#edaf65" strokeWidth="8" />
        <ellipse cx="200" cy="321" rx="64" ry="14" fill="#91562e" />
        <ellipse cx="200" cy="316" rx="64" ry="13" fill="#edaf65" />
        <path d="M88 196a112 112 0 1 1 224 0z" fill="#a8562d" />
        <path d="M92 191a106 106 0 0 1 206-22c-52-65-141-73-191 22z" fill="#ffc98c" />
        <ellipse cx="200" cy="195" rx="112" ry="17" fill="#fadcac" />
        <ellipse cx="200" cy="197" rx="86" ry="8" fill="#fff5da" />
      </g>}
    </svg>
  </div>;
}
