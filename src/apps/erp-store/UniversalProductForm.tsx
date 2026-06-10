import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Trash2 } from 'lucide-react';

/**
 * Universal product shape — matches PosProduct on the backend. Used by both
 * the storefront catalog UI and POS receiving so creating once-and-anywhere
 * lands the same fields. Variants live inline as JSON since they don't need
 * joins or per-variant indexes.
 */
export interface ProductVariant {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  price?: number;
  stock?: number;
  attributes?: Record<string, string>;
  imageUrl?: string;
}

export interface JerseyDetails {
  teamClub: string;
  jerseyType: 'fan' | 'match' | 'retro' | 'player' | 'kids';
  season: '2024/25' | '2025/26' | '2026/27' | 'world-cup-2026';
  badgeOptions: string[];
  nameNumber: string;
  size: string;
  kitType: 'jersey-only' | 'shorts-socks' | 'full-kit';
}

export interface UniversalProduct {
  id?: string;
  name: string;
  sku: string;
  barcode?: string;
  description: string;
  category: string;
  brand?: string;
  supplier?: string;
  price: number;
  compareAtPrice?: number;
  cost?: number;
  currency: string;
  taxRate: number;
  stock: number;
  estimatedStock: number;
  shelf?: string;
  warehouseId?: string;
  imageUrl?: string;
  imageUrls: string[];
  videoUrl?: string;
  variants: ProductVariant[];
  tags: string[];
  active: boolean;
  featured: boolean;
  /** Jersey-specific fields for ProJerseyShop.es product structure */
  jerseyDetails?: JerseyDetails;
}

export const blankProduct: UniversalProduct = {
  name: '',
  sku: '',
  description: '',
  category: '',
  price: 0,
  currency: 'EUR',
  taxRate: 0,
  stock: 0,
  estimatedStock: 0,
  imageUrls: [],
  variants: [],
  tags: [],
  active: true,
  featured: false,
  jerseyDetails: {
    teamClub: '',
    jerseyType: 'fan',
    season: '2025/26',
    badgeOptions: [],
    nameNumber: '',
    size: 'M',
    kitType: 'jersey-only',
  },
};

export function UniversalProductForm({
  value,
  onChange,
  onSave,
  onCancel,
  categories,
}: {
  value: UniversalProduct;
  onChange: (next: UniversalProduct) => void;
  onSave: () => void;
  onCancel: () => void;
  categories: string[];
}) {
  const [tab, setTab] = useState('basic');
  const patch = (p: Partial<UniversalProduct>) => onChange({ ...value, ...p });

  const patchJersey = (field: keyof JerseyDetails, val: unknown) => {
    onChange({
      ...value,
      jerseyDetails: {
        ...(value.jerseyDetails ?? blankProduct.jerseyDetails!),
        [field]: val,
      },
    });
  };

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-slate-800 border border-slate-700 w-full">
          <TabsTrigger value="basic" className="text-xs flex-1">Basic</TabsTrigger>
          <TabsTrigger value="jersey" className="text-xs flex-1">Jersey</TabsTrigger>
          <TabsTrigger value="inventory" className="text-xs flex-1">Inventory</TabsTrigger>
          <TabsTrigger value="variants" className="text-xs flex-1">Variants</TabsTrigger>
          <TabsTrigger value="media" className="text-xs flex-1">Media</TabsTrigger>
          <TabsTrigger value="meta" className="text-xs flex-1">Meta</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-3 pt-3">
          <Field label="Name">
            <Input value={value.name} onChange={(e) => patch({ name: e.target.value })} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU">
              <Input value={value.sku} onChange={(e) => patch({ sku: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Barcode">
              <Input
                value={value.barcode ?? ''}
                onChange={(e) => patch({ barcode: e.target.value })}
                placeholder="EAN/UPC"
                className={inputCls}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select value={value.category} onChange={(e) => patch({ category: e.target.value })} className={selectCls}>
                <option value="">— Choose —</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Brand">
              <Input value={value.brand ?? ''} onChange={(e) => patch({ brand: e.target.value })} className={inputCls} />
            </Field>
          </div>
          <Field label="Supplier">
            <Input value={value.supplier ?? ''} onChange={(e) => patch({ supplier: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Description">
            <Textarea
              value={value.description}
              onChange={(e) => patch({ description: e.target.value })}
              rows={3}
              className={`${inputCls} text-xs`}
            />
          </Field>
        </TabsContent>

        <TabsContent value="jersey" className="space-y-3 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Team / Club">
              <select
                value={value.jerseyDetails?.teamClub ?? ''}
                onChange={(e) => patchJersey('teamClub', e.target.value)}
                className={selectCls}
              >
                <option value="">— Choose —</option>
                <optgroup label="World Cup 2026">
                  {WORLD_CUP_TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                </optgroup>
                <optgroup label="Clubs">
                  {CLUB_TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                </optgroup>
                <optgroup label="Other">
                  <option value="Other Nation">Other Nation</option>
                  <option value="Other Club">Other Club</option>
                  <option value="Classic">Classic / Special</option>
                </optgroup>
              </select>
            </Field>
            <Field label="Jersey Type">
              <select
                value={value.jerseyDetails?.jerseyType ?? 'fan'}
                onChange={(e) => patchJersey('jerseyType', e.target.value)}
                className={selectCls}
              >
                <option value="fan">Fan Jersey</option>
                <option value="match">Match Jersey</option>
                <option value="retro">Retro Jersey</option>
                <option value="player">Player Version</option>
                <option value="kids">Kids Kit</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Season">
              <select
                value={value.jerseyDetails?.season ?? '2025/26'}
                onChange={(e) => patchJersey('season', e.target.value)}
                className={selectCls}
              >
                <option value="2024/25">2024/25</option>
                <option value="2025/26">2025/26</option>
                <option value="2026/27">2026/27</option>
                <option value="world-cup-2026">World Cup 2026</option>
              </select>
            </Field>
            <Field label="Size">
              <select
                value={value.jerseyDetails?.size ?? 'M'}
                onChange={(e) => patchJersey('size', e.target.value)}
                className={selectCls}
              >
                <optgroup label="Adult">
                  {ADULT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                </optgroup>
                <optgroup label="Kids">
                  {KIDS_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                </optgroup>
              </select>
            </Field>
          </div>
          <Field label="Badge Options">
            <div className="grid grid-cols-2 gap-2 p-2 rounded-md bg-slate-800 border border-slate-700">
              {BADGE_OPTIONS.map((badge) => (
                <label key={badge} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(value.jerseyDetails?.badgeOptions ?? []).includes(badge)}
                    onChange={(e) => {
                      const current = value.jerseyDetails?.badgeOptions ?? [];
                      const next = e.target.checked
                        ? [...current, badge]
                        : current.filter((b) => b !== badge);
                      patchJersey('badgeOptions', next);
                    }}
                    className="rounded border-slate-600"
                  />
                  {badge}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Name & Number (Custom Printing)">
            <Input
              value={value.jerseyDetails?.nameNumber ?? ''}
              onChange={(e) => patchJersey('nameNumber', e.target.value)}
              placeholder="e.g. Yamal 19"
              className={inputCls}
            />
          </Field>
          {value.category?.toLowerCase().includes('kids') && (
            <Field label="Kit Type">
              <select
                value={value.jerseyDetails?.kitType ?? 'jersey-only'}
                onChange={(e) => patchJersey('kitType', e.target.value)}
                className={selectCls}
              >
                <option value="jersey-only">Jersey Only</option>
                <option value="shorts-socks">Shorts + Socks Set</option>
                <option value="full-kit">Full Kit</option>
              </select>
            </Field>
          )}
        </TabsContent>

        <TabsContent value="inventory" className="space-y-3 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price">
              <Input
                type="number"
                value={value.price}
                onChange={(e) => patch({ price: Number(e.target.value) })}
                className={inputCls}
              />
            </Field>
            <Field label="Compare-at price">
              <Input
                type="number"
                value={value.compareAtPrice ?? ''}
                onChange={(e) => patch({ compareAtPrice: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="Was-was price"
                className={inputCls}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Unit cost">
              <Input
                type="number"
                value={value.cost ?? ''}
                onChange={(e) => patch({ cost: e.target.value ? Number(e.target.value) : undefined })}
                className={inputCls}
              />
            </Field>
            <Field label="Tax rate (%)">
              <Input
                type="number"
                step="0.01"
                value={value.taxRate * 100}
                onChange={(e) => patch({ taxRate: Number(e.target.value) / 100 })}
                className={inputCls}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stock on hand">
              <Input
                type="number"
                value={value.stock}
                onChange={(e) => patch({ stock: Number(e.target.value) })}
                className={inputCls}
              />
            </Field>
            <Field label="Estimated stock">
              <Input
                type="number"
                value={value.estimatedStock}
                onChange={(e) => patch({ estimatedStock: Number(e.target.value) })}
                placeholder="Inbound, not unloaded"
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Currency">
            <Input value={value.currency} onChange={(e) => patch({ currency: e.target.value })} className={inputCls} />
          </Field>
        </TabsContent>

        <TabsContent value="variants" className="space-y-3 pt-3">
          <div className="text-[11px] text-slate-400">
            Add a row per size/colour/style. Each variant inherits the parent price unless overridden.
          </div>
          {value.variants.map((v, idx) => (
            <div key={v.id} className="grid grid-cols-12 gap-2 items-center">
              <Input
                placeholder="Name (e.g. M / Red)"
                value={v.name}
                onChange={(e) =>
                  patch({
                    variants: value.variants.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)),
                  })
                }
                className={`${inputCls} col-span-4`}
              />
              <Input
                placeholder="SKU"
                value={v.sku ?? ''}
                onChange={(e) =>
                  patch({
                    variants: value.variants.map((x, i) => (i === idx ? { ...x, sku: e.target.value } : x)),
                  })
                }
                className={`${inputCls} col-span-3`}
              />
              <Input
                type="number"
                placeholder="Price"
                value={v.price ?? ''}
                onChange={(e) =>
                  patch({
                    variants: value.variants.map((x, i) =>
                      i === idx ? { ...x, price: e.target.value ? Number(e.target.value) : undefined } : x,
                    ),
                  })
                }
                className={`${inputCls} col-span-2`}
              />
              <Input
                type="number"
                placeholder="Stock"
                value={v.stock ?? ''}
                onChange={(e) =>
                  patch({
                    variants: value.variants.map((x, i) =>
                      i === idx ? { ...x, stock: e.target.value ? Number(e.target.value) : undefined } : x,
                    ),
                  })
                }
                className={`${inputCls} col-span-2`}
              />
              <button
                onClick={() => patch({ variants: value.variants.filter((_, i) => i !== idx) })}
                className="col-span-1 text-rose-300 hover:text-rose-200"
                aria-label="Remove variant"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              patch({
                variants: [...value.variants, { id: `v-${Date.now()}-${value.variants.length}`, name: '' }],
              })
            }
            className="h-7 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" /> Add variant
          </Button>
        </TabsContent>

        <TabsContent value="media" className="space-y-3 pt-3">
          <Field label="Primary image URL">
            <Input
              value={value.imageUrl ?? ''}
              onChange={(e) => patch({ imageUrl: e.target.value })}
              placeholder="https://…"
              className={inputCls}
            />
          </Field>
          <Field label="Additional images">
            <Textarea
              value={value.imageUrls.join('\n')}
              onChange={(e) =>
                patch({ imageUrls: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })
              }
              rows={3}
              placeholder="One URL per line"
              className={`${inputCls} text-xs`}
            />
          </Field>
          <Field label="Video URL">
            <Input
              value={value.videoUrl ?? ''}
              onChange={(e) => patch({ videoUrl: e.target.value })}
              placeholder="YouTube/Vimeo/MP4"
              className={inputCls}
            />
          </Field>
        </TabsContent>

        <TabsContent value="meta" className="space-y-3 pt-3">
          <Field label="Tags (comma separated)">
            <Input
              value={value.tags.join(', ')}
              onChange={(e) =>
                patch({ tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
              }
              placeholder="seasonal, gift, eco"
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Shelf">
              <Input value={value.shelf ?? ''} onChange={(e) => patch({ shelf: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Warehouse ID">
              <Input
                value={value.warehouseId ?? ''}
                onChange={(e) => patch({ warehouseId: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>
          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={value.active} onChange={(e) => patch({ active: e.target.checked })} />
              Active
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={value.featured} onChange={(e) => patch({ featured: e.target.checked })} />
              Featured
            </label>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800">
          Cancel
        </Button>
        <Button onClick={onSave} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white">
          Save
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-slate-400 block mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'bg-slate-800 border-slate-700 text-slate-100';
const selectCls = 'w-full h-9 px-2 rounded-md bg-slate-800 border border-slate-700 text-xs text-slate-300';

const WORLD_CUP_TEAMS = [
  'Spain', 'Brazil', 'USA', 'Mexico', 'Argentina', 'Germany', 'France',
  'Portugal', 'England', 'Netherlands', 'Italy', 'Belgium', 'Croatia',
  'Uruguay', 'Colombia', 'Japan', 'South Korea', 'Morocco', 'Senegal',
  'Canada', 'Ecuador', 'Poland', 'Wales', 'Australia', 'Cameroon',
  'Ghana', 'Qatar', 'Saudi Arabia', 'Tunisia', 'Iran', 'Costa Rica',
];

const CLUB_TEAMS = [
  'Real Madrid', 'Barcelona', 'PSG', 'Liverpool', 'Manchester United',
  'Manchester City', 'Arsenal', 'Chelsea', 'Juventus', 'Bayern Munich',
  'Borussia Dortmund', 'AC Milan', 'Inter Milan', 'Napoli', 'Roma',
  'Atletico Madrid', 'Sevilla', 'Tottenham', 'Newcastle', 'Aston Villa',
  'Benfica', 'Porto', 'Ajax', 'Celtic', 'Rangers', 'Al Nassr', 'Al Hilal',
];

const ADULT_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const KIDS_SIZES = ['Kids 4-5Y', 'Kids 6-7Y', 'Kids 8-9Y', 'Kids 10-11Y', 'Kids 12-13Y'];

const BADGE_OPTIONS = [
  'No Badge',
  'World Cup 2026 Sleeve Badge',
  'Champions League Badge',
  'League Badge',
  'Respect Badge',
  'Foundation Badge',
];
