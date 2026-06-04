import type { HomepageSectionSpec } from './storefront.entity';

/**
 * Built-in industry template catalogue. Seeded at boot. Each template
 * pre-populates categories, a homepage layout and starter products so a new
 * merchant doesn't stare at a blank store.
 */
export interface IndustryTemplateSeed {
  code: string;
  name: string;
  description: string;
  iconKey: string;
  defaultCategories: string[];
  defaultSections: HomepageSectionSpec[];
  posLayout: Record<string, unknown>;
  starterProducts: Array<{ name: string; category: string; price?: number }>;
}

const baseSections: HomepageSectionSpec[] = [
  { type: 'hero' },
  { type: 'categories' },
  { type: 'best_sellers' },
  { type: 'new_arrivals' },
  { type: 'featured' },
];

export const INDUSTRY_TEMPLATES: IndustryTemplateSeed[] = [
  {
    code: 'fashion',
    name: 'Fashion & Apparel',
    description: 'Clothing, shoes, accessories. Variants by size & colour.',
    iconKey: 'shirt',
    defaultCategories: ['Men', 'Women', 'Kids', 'Shoes', 'Accessories'],
    defaultSections: [...baseSections, { type: 'promotions' }, { type: 'newsletter' }],
    posLayout: { quickKeys: ['Men', 'Women', 'Kids', 'Sale'] },
    starterProducts: [
      { name: 'Cotton T-Shirt', category: 'Men', price: 25000 },
      { name: 'Denim Jeans', category: 'Men', price: 80000 },
      { name: 'Summer Dress', category: 'Women', price: 60000 },
    ],
  },
  {
    code: 'electronics',
    name: 'Electronics',
    description: 'Phones, laptops, accessories. Heavy on specs and warranty.',
    iconKey: 'cpu',
    defaultCategories: ['Phones', 'Laptops', 'Accessories', 'Audio', 'TV & Home'],
    defaultSections: [...baseSections, { type: 'brands' }, { type: 'video' }],
    posLayout: { quickKeys: ['Phones', 'Laptops', 'Accessories'] },
    starterProducts: [
      { name: 'Smartphone 128GB', category: 'Phones', price: 850000 },
      { name: 'Wireless Earbuds', category: 'Audio', price: 120000 },
    ],
  },
  {
    code: 'grocery',
    name: 'Grocery & Supermarket',
    description: 'Fast-moving consumer goods, high SKU count.',
    iconKey: 'shopping-cart',
    defaultCategories: ['Fresh', 'Pantry', 'Beverages', 'Household', 'Personal Care'],
    defaultSections: [
      { type: 'hero' },
      { type: 'categories' },
      { type: 'promotions' },
      { type: 'best_sellers' },
      { type: 'clearance' },
    ],
    posLayout: { quickKeys: ['Fresh', 'Pantry', 'Beverages', 'Household'] },
    starterProducts: [
      { name: 'Sugar 1kg', category: 'Pantry', price: 3500 },
      { name: 'Rice 5kg', category: 'Pantry', price: 18000 },
    ],
  },
  {
    code: 'pharmacy',
    name: 'Pharmacy',
    description: 'OTC, prescription, wellness. Regulated.',
    iconKey: 'pill',
    defaultCategories: ['Prescription', 'OTC', 'Vitamins', 'Personal Care', 'Baby'],
    defaultSections: baseSections,
    posLayout: { quickKeys: ['OTC', 'Vitamins', 'Prescription'] },
    starterProducts: [{ name: 'Paracetamol 500mg', category: 'OTC', price: 2000 }],
  },
  {
    code: 'restaurant',
    name: 'Restaurant',
    description: 'Menu items, kitchen tickets, table service.',
    iconKey: 'utensils',
    defaultCategories: ['Starters', 'Mains', 'Desserts', 'Drinks', 'Specials'],
    defaultSections: [
      { type: 'hero' },
      { type: 'categories' },
      { type: 'featured' },
      { type: 'testimonials' },
      { type: 'map' },
    ],
    posLayout: { quickKeys: ['Starters', 'Mains', 'Drinks'] },
    starterProducts: [
      { name: 'Beef Burger', category: 'Mains', price: 12000 },
      { name: 'Iced Coffee', category: 'Drinks', price: 4500 },
    ],
  },
  {
    code: 'hardware',
    name: 'Hardware & Building',
    description: 'Tools, materials, fixtures. Heavy on supplier metadata.',
    iconKey: 'wrench',
    defaultCategories: ['Tools', 'Building', 'Plumbing', 'Electrical', 'Paint'],
    defaultSections: baseSections,
    posLayout: { quickKeys: ['Tools', 'Building', 'Electrical'] },
    starterProducts: [{ name: 'Hammer 16oz', category: 'Tools', price: 25000 }],
  },
  {
    code: 'general',
    name: 'General Retail',
    description: 'A neutral starting point — no category bias.',
    iconKey: 'shopping-bag',
    defaultCategories: ['New', 'Popular', 'Sale'],
    defaultSections: baseSections,
    posLayout: { quickKeys: [] },
    starterProducts: [],
  },
];
