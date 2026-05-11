import { useState, useMemo } from 'react';
import {
  ShoppingBag,
  Search,
  Plus,
  Minus,
  X,
  Trash2,
  Package,
  ShoppingCart,
  CreditCard,
  Truck,
  CheckCircle2,
  Star,
  Filter,
  ArrowRight,
  Smartphone,
  Building2,
  Banknote,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */

interface Product {
  id: number;
  name: string;
  sku: string;
  price: number;
  stock: number;
  category: string;
  description: string;
  image: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface CheckoutForm {
  name: string;
  phone: string;
  address: string;
  paymentMethod: 'cod' | 'mobile' | 'bank';
}

/* ------------------------------------------------------------------ */
/*  DATA                                                               */
/* ------------------------------------------------------------------ */

const products: Product[] = [
  { id: 1, name: 'Samsung Galaxy A14', sku: 'ELEC-042', price: 450000, stock: 3, category: 'Electronics', description: '6.6" display, 4GB RAM, 64GB storage, 5000mAh battery', image: 'from-blue-600 to-indigo-700' },
  { id: 2, name: 'Tecno Spark 10', sku: 'ELEC-051', price: 280000, stock: 12, category: 'Electronics', description: '6.6" HD+ display, 8GB RAM, 128GB storage, 5000mAh', image: 'from-indigo-600 to-purple-700' },
  { id: 3, name: 'Itel PowerBank 20k', sku: 'ELEC-033', price: 45000, stock: 25, category: 'Electronics', description: '20000mAh capacity, dual USB output, LED indicator', image: 'from-cyan-600 to-blue-700' },
  { id: 4, name: "Men's Cotton T-Shirt", sku: 'CLTH-018', price: 15000, stock: 5, category: 'Clothing', description: '100% cotton, available in S/M/L/XL, machine washable', image: 'from-emerald-600 to-green-700' },
  { id: 5, name: 'Kitenge Dress', sku: 'CLTH-022', price: 45000, stock: 8, category: 'Clothing', description: 'Traditional African print, premium cotton, handmade', image: 'from-green-600 to-teal-700' },
  { id: 6, name: 'Mama Ntilie Rice 5kg', sku: 'FOOD-033', price: 18000, stock: 4, category: 'Food', description: 'Premium grade white rice, 5kg bag, grown in Tanzania', image: 'from-amber-600 to-yellow-700' },
  { id: 7, name: 'Sunflower Oil 3L', sku: 'FOOD-041', price: 22000, stock: 18, category: 'Food', description: 'Pure sunflower cooking oil, 3 liter bottle', image: 'from-yellow-600 to-orange-700' },
  { id: 8, name: 'Sugar 2kg', sku: 'FOOD-012', price: 8500, stock: 30, category: 'Food', description: 'Refined white sugar, 2kg pack', image: 'from-orange-600 to-red-700' },
  { id: 9, name: 'Borehole Pump 1HP', sku: 'HSHD-009', price: 320000, stock: 2, category: 'Household', description: '1HP submersible water pump, stainless steel, 220V', image: 'from-rose-600 to-pink-700' },
  { id: 10, name: 'Solar Panel 100W', sku: 'HSHD-015', price: 180000, stock: 7, category: 'Household', description: '100W monocrystalline solar panel, 18V output', image: 'from-pink-600 to-fuchsia-700' },
  { id: 11, name: 'Plastic Chairs (4pc)', sku: 'HSHD-021', price: 85000, stock: 10, category: 'Household', description: 'Durable plastic chairs set of 4, assorted colors', image: 'from-fuchsia-600 to-purple-700' },
  { id: 12, name: 'Mosquito Net Double', sku: 'HSHD-027', price: 25000, stock: 14, category: 'Household', description: 'Double bed mosquito net, insecticide treated', image: 'from-red-600 to-orange-700' },
  { id: 13, name: 'LED Bulb 12W', sku: 'ELEC-019', price: 8000, stock: 40, category: 'Electronics', description: 'Energy efficient 12W LED bulb, E27 base, warm white', image: 'from-blue-700 to-cyan-700' },
  { id: 14, name: 'School Uniform Set', sku: 'CLTH-031', price: 32000, stock: 6, category: 'Clothing', description: 'Complete school uniform: shirt, trousers, sweater', image: 'from-teal-600 to-cyan-700' },
  { id: 15, name: 'Water Filter', sku: 'HSHD-035', price: 65000, stock: 9, category: 'Household', description: 'Ceramic water filter with 2 candles, 20L capacity', image: 'from-violet-600 to-purple-700' },
  { id: 16, name: 'Shea Butter Cream', sku: 'BTRY-001', price: 12000, stock: 20, category: 'Beauty', description: 'Pure organic shea butter, 250g, moisturizing', image: 'from-pink-400 to-rose-500' },
  { id: 17, name: 'Black Soap', sku: 'BTRY-002', price: 8000, stock: 35, category: 'Beauty', description: 'Traditional African black soap, 200g, natural', image: 'from-amber-700 to-yellow-600' },
  { id: 18, name: 'Coconut Oil', sku: 'BTRY-003', price: 15000, stock: 15, category: 'Beauty', description: 'Cold-pressed virgin coconut oil, 500ml', image: 'from-emerald-500 to-green-600' },
];

const categories = ['All', 'Electronics', 'Clothing', 'Food', 'Household', 'Beauty'];

const SHIPPING_COST = 5000;

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

function formatPrice(price: number): string {
  return 'TZS ' + price.toLocaleString('en-US');
}

function getStockColor(stock: number): string {
  if (stock <= 3) return 'bg-red-500';
  if (stock <= 10) return 'bg-yellow-500';
  return 'bg-emerald-500';
}

function getStockLabel(stock: number): string {
  if (stock <= 3) return 'Low Stock';
  if (stock <= 10) return 'Limited';
  return 'In Stock';
}

function generateOrderNumber(): string {
  return 'KOBE-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  MAIN COMPONENT                                                     */
/* ------------------------------------------------------------------ */

export default function ErpShop() {
  /* -- state -- */
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCheckout, setIsCheckout] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm>({
    name: '',
    phone: '',
    address: '',
    paymentMethod: 'cod',
  });

  /* -- derived -- */
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [cart]
  );

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  /* -- cart actions -- */
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const newQty = Math.max(1, Math.min(item.quantity + delta, item.product.stock));
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const clearCart = () => setCart([]);

  /* -- checkout -- */
  const handleCheckout = () => {
    if (cart.length === 0) return;
    setIsCartOpen(false);
    setIsCheckout(true);
  };

  const handlePlaceOrder = () => {
    if (!checkoutForm.name || !checkoutForm.phone || !checkoutForm.address) return;
    const newOrderNumber = generateOrderNumber();
    setOrderNumber(newOrderNumber);
    setIsCheckout(false);
    setOrderConfirmed(true);
    clearCart();
  };

  const handleCloseConfirmation = () => {
    setOrderConfirmed(false);
    setCheckoutForm({ name: '', phone: '', address: '', paymentMethod: 'cod' });
  };

  /* -- product detail -- */
  const openProductDetail = (product: Product) => {
    setSelectedProduct(product);
  };

  const closeProductDetail = () => {
    setSelectedProduct(null);
  };

  /* -- product card component -- */
  const ProductCard = ({ product }: { product: Product }) => (
    <Card
      className="bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06] transition-all duration-300 cursor-pointer group overflow-hidden rounded-xl"
      onClick={() => openProductDetail(product)}
    >
      <CardContent className="p-0">
        {/* Product Image */}
        <div className={`relative h-40 bg-gradient-to-br ${product.image} flex items-center justify-center overflow-hidden`}>
          <Package className="w-12 h-12 text-white/30 group-hover:scale-110 transition-transform duration-300" />
          <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors duration-300" />
          {/* Category badge */}
          <div className="absolute top-2 left-2">
            <span className="px-2 py-0.5 rounded-full bg-black/40 text-white/80 text-[10px] font-medium backdrop-blur-sm">
              {product.category}
            </span>
          </div>
          {/* Stock indicator */}
          <div className="absolute top-2 right-2 flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${getStockColor(product.stock)}`} />
            <span className="text-[10px] text-white/80 font-medium">{getStockLabel(product.stock)}</span>
          </div>
        </div>
        {/* Product Info */}
        <div className="p-3">
          <h3 className="text-white/90 text-sm font-semibold truncate group-hover:text-blue-400 transition-colors">
            {product.name}
          </h3>
          <p className="text-white/30 text-[11px] mt-0.5 font-mono">{product.sku}</p>
          <p className="text-white/50 text-xs mt-1 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
          <div className="flex items-center justify-between mt-3">
            <span className="text-white/90 font-bold text-sm">{formatPrice(product.price)}</span>
            <Button
              size="sm"
              className="h-7 px-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs gap-1"
              onClick={(e) => {
                e.stopPropagation();
                addToCart(product);
              }}
            >
              <ShoppingCart className="w-3 h-3" />
              Add
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  /* =========================== RENDER =========================== */

  return (
    <div className="h-full flex flex-col bg-[#0a0a1a] text-white/90 overflow-hidden">
      {/* ====== HEADER ====== */}
      <header className="shrink-0 border-b border-white/[0.06] bg-[#0a0a1a]/95 backdrop-blur-sm z-20">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-bold tracking-tight leading-none">KOBESTORE</h1>
              <p className="text-[10px] text-white/40 leading-none mt-0.5">Shop Smart, Live Better</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-md mx-3 sm:mx-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 h-9 rounded-lg bg-white/[0.04] border-white/[0.08] text-white/90 placeholder:text-white/30 text-sm focus:border-blue-500/50 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* Cart Button */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors"
          >
            <ShoppingCart className="w-4 h-4 text-white/70" />
            <span className="hidden sm:inline text-xs text-white/60">Cart</span>
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center shadow-lg shadow-blue-500/30">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ====== SCROLLABLE CONTENT ====== */}
      <ScrollArea className="flex-1">
        <div className="pb-6">
          {/* ====== HERO BANNER ====== */}
          <section className="relative px-4 py-8 sm:py-10 overflow-hidden">
            {/* Background glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-transparent" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl" />

            <div className="relative max-w-2xl">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 text-[11px] font-medium border border-blue-500/20">
                  <Sparkles className="w-3 h-3" />
                  New Arrivals
                </span>
                <span className="text-white/30 text-[11px]">Free shipping on orders over TZS 100,000</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                Your One-Stop
                <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  {' '}Online Shop
                </span>
              </h2>
              <p className="text-white/50 text-sm mt-2 max-w-lg leading-relaxed">
                Discover quality electronics, clothing, food, household items and beauty products at unbeatable prices. Delivered to your doorstep anywhere in Tanzania.
              </p>
              <div className="flex items-center gap-3 mt-5">
                <Button
                  onClick={() => {
                    setSelectedCategory('All');
                    setSearchQuery('');
                  }}
                  className="rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm h-9 px-5 gap-2"
                >
                  Browse All
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="outline"
                  className="rounded-lg border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white text-sm h-9 px-5"
                  onClick={() => {
                    setSelectedCategory('Electronics');
                  }}
                >
                  Electronics
                </Button>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 mt-6 pt-5 border-t border-white/[0.06]">
                <div className="flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-white/30" />
                  <span className="text-xs text-white/40">{products.length}+ Products</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-white/30" />
                  <span className="text-xs text-white/40">Fast Delivery</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-white/30" />
                  <span className="text-xs text-white/40">Best Prices</span>
                </div>
              </div>
            </div>
          </section>

          {/* ====== CATEGORY NAVIGATION ====== */}
          <section className="px-4 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-3.5 h-3.5 text-white/30" />
              <span className="text-xs text-white/40 uppercase tracking-wider font-medium">Categories</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-all duration-200 border ${
                    selectedCategory === cat
                      ? 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/20'
                      : 'bg-white/[0.04] text-white/60 border-white/[0.08] hover:bg-white/[0.08] hover:text-white/80'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </section>

          {/* ====== PRODUCT GRID ====== */}
          <section className="px-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white/80">
                {selectedCategory === 'All' ? 'All Products' : selectedCategory}
                <span className="text-white/30 font-normal ml-2">({filteredProducts.length})</span>
              </h3>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Clear search
                </button>
              )}
            </div>

            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search className="w-10 h-10 text-white/10 mb-3" />
                <p className="text-white/40 text-sm">No products found</p>
                <p className="text-white/20 text-xs mt-1">Try adjusting your search or filter</p>
              </div>
            )}
          </section>
        </div>
      </ScrollArea>

      {/* ====== CART PANEL (Slide-out) ====== */}
      {isCartOpen && (
        <div className="absolute inset-0 z-50 flex justify-end">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsCartOpen(false)}
          />
          {/* Panel */}
          <div className="relative w-full max-w-md bg-[#0e0e24] border-l border-white/[0.08] flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            {/* Cart Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-400" />
                <h2 className="text-base font-semibold">Your Cart</h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 text-xs font-medium">
                  {cartCount}
                </span>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-4 h-4 text-white/50" />
              </button>
            </div>

            {/* Cart Items */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3">
                {cart.length > 0 ? (
                  cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                    >
                      {/* Item image */}
                      <div className={`w-16 h-16 rounded-lg bg-gradient-to-br ${item.product.image} flex items-center justify-center flex-shrink-0`}>
                        <Package className="w-6 h-6 text-white/30" />
                      </div>
                      {/* Item details */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-white/90 truncate">{item.product.name}</h4>
                        <p className="text-xs text-white/40 font-mono mt-0.5">{item.product.sku}</p>
                        <p className="text-sm font-semibold text-blue-400 mt-1">
                          {formatPrice(item.product.price * item.quantity)}
                        </p>
                        {/* Quantity controls */}
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => updateQuantity(item.product.id, -1)}
                            className="w-6 h-6 rounded-md bg-white/[0.06] hover:bg-white/[0.10] flex items-center justify-center transition-colors"
                          >
                            <Minus className="w-3 h-3 text-white/60" />
                          </button>
                          <span className="text-sm font-medium w-5 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product.id, 1)}
                            className="w-6 h-6 rounded-md bg-white/[0.06] hover:bg-white/[0.10] flex items-center justify-center transition-colors"
                          >
                            <Plus className="w-3 h-3 text-white/60" />
                          </button>
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="ml-auto p-1.5 rounded-md hover:bg-red-500/10 transition-colors group"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-white/30 group-hover:text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <ShoppingCart className="w-12 h-12 text-white/10 mb-3" />
                    <p className="text-white/40 text-sm">Your cart is empty</p>
                    <p className="text-white/20 text-xs mt-1">Add products to get started</p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Cart Footer */}
            {cart.length > 0 && (
              <div className="border-t border-white/[0.06] p-4 space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/50">Subtotal</span>
                    <span className="text-white/80">{formatPrice(cartTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/50">Shipping</span>
                    <span className="text-white/80">{formatPrice(SHIPPING_COST)}</span>
                  </div>
                  <div className="h-px bg-white/[0.06]" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white/90">Total</span>
                    <span className="text-lg font-bold text-white">{formatPrice(cartTotal + SHIPPING_COST)}</span>
                  </div>
                </div>
                <Button
                  onClick={handleCheckout}
                  className="w-full h-10 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  Checkout
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====== PRODUCT DETAIL MODAL ====== */}
      <Dialog open={selectedProduct !== null} onOpenChange={closeProductDetail}>
        <DialogContent className="bg-[#0e0e24] border-white/[0.08] text-white max-w-lg p-0 gap-0 overflow-hidden">
          {selectedProduct && (
            <>
              {/* Product Image */}
              <div className={`relative h-56 bg-gradient-to-br ${selectedProduct.image} flex items-center justify-center`}>
                <Package className="w-20 h-20 text-white/20" />
                <button
                  onClick={closeProductDetail}
                  className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/30 hover:bg-black/50 backdrop-blur-sm transition-colors"
                >
                  <X className="w-4 h-4 text-white/70" />
                </button>
                {/* Category badge */}
                <div className="absolute top-3 left-3">
                  <span className="px-2.5 py-1 rounded-full bg-black/40 text-white/90 text-xs font-medium backdrop-blur-sm">
                    {selectedProduct.category}
                  </span>
                </div>
                {/* Stock badge */}
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm">
                  <span className={`w-2 h-2 rounded-full ${getStockColor(selectedProduct.stock)}`} />
                  <span className="text-xs text-white/80">{getStockLabel(selectedProduct.stock)} · {selectedProduct.stock} left</span>
                </div>
              </div>

              {/* Product Details */}
              <div className="p-5 space-y-4">
                <DialogHeader className="space-y-1">
                  <DialogTitle className="text-xl font-bold text-white/90">
                    {selectedProduct.name}
                  </DialogTitle>
                  <p className="text-xs text-white/30 font-mono">{selectedProduct.sku}</p>
                </DialogHeader>

                <p className="text-sm text-white/60 leading-relaxed">
                  {selectedProduct.description}
                </p>

                {/* Price & Add to Cart */}
                <div className="flex items-center justify-between pt-2">
                  <div>
                    <p className="text-xs text-white/40">Price</p>
                    <p className="text-2xl font-bold text-white">{formatPrice(selectedProduct.price)}</p>
                  </div>
                  <Button
                    onClick={() => {
                      addToCart(selectedProduct);
                      closeProductDetail();
                    }}
                    className="h-10 px-6 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium gap-2"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Add to Cart
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ====== CHECKOUT MODAL ====== */}
      <Dialog open={isCheckout} onOpenChange={(open) => !open && setIsCheckout(false)}>
        <DialogContent className="bg-[#0e0e24] border-white/[0.08] text-white max-w-md max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-white/[0.06]">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-400" />
              Checkout
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 space-y-5">
            {/* Order Summary */}
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-2">
              <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">Order Summary</h4>
              {cart.map((item) => (
                <div key={item.product.id} className="flex items-center justify-between text-sm">
                  <span className="text-white/70 truncate flex-1">{item.product.name} × {item.quantity}</span>
                  <span className="text-white/90 font-medium ml-3">{formatPrice(item.product.price * item.quantity)}</span>
                </div>
              ))}
              <div className="h-px bg-white/[0.06] my-2" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50">Shipping</span>
                <span className="text-white/80">{formatPrice(SHIPPING_COST)}</span>
              </div>
              <div className="flex items-center justify-between font-bold">
                <span className="text-white/90">Total</span>
                <span className="text-white">{formatPrice(cartTotal + SHIPPING_COST)}</span>
              </div>
            </div>

            {/* Shipping Details */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider">Shipping Details</h4>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Full Name</label>
                <Input
                  placeholder="John Doe"
                  value={checkoutForm.name}
                  onChange={(e) => setCheckoutForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="h-9 rounded-lg bg-white/[0.04] border-white/[0.08] text-white/90 placeholder:text-white/25 text-sm focus:border-blue-500/50 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Phone Number</label>
                <Input
                  placeholder="+255 7XX XXX XXX"
                  value={checkoutForm.phone}
                  onChange={(e) => setCheckoutForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="h-9 rounded-lg bg-white/[0.04] border-white/[0.08] text-white/90 placeholder:text-white/25 text-sm focus:border-blue-500/50 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Delivery Address</label>
                <Input
                  placeholder="123 Mbezi Beach, Dar es Salaam"
                  value={checkoutForm.address}
                  onChange={(e) => setCheckoutForm((prev) => ({ ...prev, address: e.target.value }))}
                  className="h-9 rounded-lg bg-white/[0.04] border-white/[0.08] text-white/90 placeholder:text-white/25 text-sm focus:border-blue-500/50 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider">Payment Method</h4>
              <div className="space-y-2">
                <button
                  onClick={() => setCheckoutForm((prev) => ({ ...prev, paymentMethod: 'cod' }))}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${
                    checkoutForm.paymentMethod === 'cod'
                      ? 'border-blue-500/50 bg-blue-500/10'
                      : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                    <Banknote className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-medium text-white/90">Cash on Delivery</p>
                    <p className="text-xs text-white/40">Pay when you receive</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    checkoutForm.paymentMethod === 'cod' ? 'border-blue-500' : 'border-white/20'
                  }`}>
                    {checkoutForm.paymentMethod === 'cod' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                  </div>
                </button>

                <button
                  onClick={() => setCheckoutForm((prev) => ({ ...prev, paymentMethod: 'mobile' }))}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${
                    checkoutForm.paymentMethod === 'mobile'
                      ? 'border-blue-500/50 bg-blue-500/10'
                      : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-purple-500/15 flex items-center justify-center">
                    <Smartphone className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-medium text-white/90">Mobile Money</p>
                    <p className="text-xs text-white/40">M-Pesa, Tigo Pesa, Airtel Money</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    checkoutForm.paymentMethod === 'mobile' ? 'border-blue-500' : 'border-white/20'
                  }`}>
                    {checkoutForm.paymentMethod === 'mobile' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                  </div>
                </button>

                <button
                  onClick={() => setCheckoutForm((prev) => ({ ...prev, paymentMethod: 'bank' }))}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${
                    checkoutForm.paymentMethod === 'bank'
                      ? 'border-blue-500/50 bg-blue-500/10'
                      : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-medium text-white/90">Bank Transfer</p>
                    <p className="text-xs text-white/40">Direct bank deposit</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    checkoutForm.paymentMethod === 'bank' ? 'border-blue-500' : 'border-white/20'
                  }`}>
                    {checkoutForm.paymentMethod === 'bank' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                  </div>
                </button>
              </div>
            </div>

            {/* Place Order */}
            <Button
              onClick={handlePlaceOrder}
              disabled={!checkoutForm.name || !checkoutForm.phone || !checkoutForm.address}
              className="w-full h-10 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:pointer-events-none text-white font-medium gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Place Order
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== ORDER CONFIRMATION MODAL ====== */}
      <Dialog open={orderConfirmed} onOpenChange={handleCloseConfirmation}>
        <DialogContent className="bg-[#0e0e24] border-white/[0.08] text-white max-w-sm p-0 gap-0 overflow-hidden text-center">
          {/* Success Animation Area */}
          <div className="relative pt-10 pb-6 bg-gradient-to-b from-emerald-500/10 to-transparent">
            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/15 flex items-center justify-center ring-2 ring-emerald-500/30">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
          </div>

          <div className="px-6 pb-6 space-y-4">
            <div>
              <h3 className="text-xl font-bold text-white">Order Confirmed!</h3>
              <p className="text-sm text-white/50 mt-1">Thank you for shopping with KOBESTORE</p>
            </div>

            {/* Order Number */}
            <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-4">
              <p className="text-xs text-white/40 uppercase tracking-wider">Order Number</p>
              <p className="text-lg font-bold text-emerald-400 font-mono mt-1">{orderNumber}</p>
            </div>

            {/* Delivery Info */}
            <div className="flex items-start gap-3 text-left p-3 rounded-lg bg-white/[0.02]">
              <Truck className="w-4 h-4 text-white/30 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-white/60">Your order will be delivered within 2-5 business days. We will contact you on your phone for delivery confirmation.</p>
              </div>
            </div>

            <Button
              onClick={handleCloseConfirmation}
              className="w-full h-10 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium"
            >
              Continue Shopping
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
