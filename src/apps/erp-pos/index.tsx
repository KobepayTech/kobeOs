import { useState, useMemo } from 'react';
import {
  Plus, Minus, Trash2, ShoppingCart, CreditCard, Smartphone, Banknote,
  Receipt, Tag, Percent, Search, Barcode,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const categories = ['All', 'Electronics', 'Clothing', 'Food', 'Household'];

const products = [
  { id: 1, name: 'Samsung Galaxy A14', price: 450000, category: 'Electronics', color: 'bg-blue-600' },
  { id: 2, name: 'Tecno Spark 10', price: 280000, category: 'Electronics', color: 'bg-indigo-600' },
  { id: 3, name: 'Itel PowerBank 20k', price: 45000, category: 'Electronics', color: 'bg-cyan-600' },
  { id: 4, name: 'Earbuds Wireless', price: 35000, category: 'Electronics', color: 'bg-sky-600' },
  { id: 5, name: 'LED Bulb 12W', price: 8000, category: 'Electronics', color: 'bg-blue-700' },
  { id: 6, name: "Men's Cotton T-Shirt", price: 15000, category: 'Clothing', color: 'bg-emerald-600' },
  { id: 7, name: 'Kitenge Dress', price: 45000, category: 'Clothing', color: 'bg-green-600' },
  { id: 8, name: 'School Uniform Set', price: 32000, category: 'Clothing', color: 'bg-teal-600' },
  { id: 9, name: 'Running Shoes', price: 55000, category: 'Clothing', color: 'bg-lime-600' },
  { id: 10, name: 'Baseball Cap', price: 12000, category: 'Clothing', color: 'bg-emerald-700' },
  { id: 11, name: 'Mama Ntilie Rice 5kg', price: 18000, category: 'Food', color: 'bg-amber-600' },
  { id: 12, name: 'Sunflower Oil 3L', price: 22000, category: 'Food', color: 'bg-yellow-600' },
  { id: 13, name: 'Sugar 2kg', price: 8500, category: 'Food', color: 'bg-orange-600' },
  { id: 14, name: 'Wheat Flour 2kg', price: 6000, category: 'Food', color: 'bg-amber-700' },
  { id: 15, name: 'Chai Masala 100g', price: 3500, category: 'Food', color: 'bg-yellow-700' },
  { id: 16, name: 'Borehole Pump 1HP', price: 320000, category: 'Household', color: 'bg-rose-600' },
  { id: 17, name: 'Solar Panel 100W', price: 180000, category: 'Household', color: 'bg-pink-600' },
  { id: 18, name: 'Plastic Chairs (4)', price: 85000, category: 'Household', color: 'bg-fuchsia-600' },
  { id: 19, name: 'Mosquito Net Double', price: 25000, category: 'Household', color: 'bg-rose-700' },
  { id: 20, name: 'Water Filter', price: 65000, category: 'Household', color: 'bg-pink-700' },
];

const tzs = (n: number) => `TZS ${n.toLocaleString()}`;

interface CartItem {
  product: typeof products[0];
  qty: number;
}

export default function ERPPos() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcode, setBarcode] = useState('');
  const [search, setSearch] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa' | 'card'>('cash');
  const [amountPaid, setAmountPaid] = useState('');

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = activeCategory === 'All' || p.category === activeCategory;
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [activeCategory, search]);

  const addToCart = (product: typeof products[0]) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) => (i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  const updateQty = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.product.id === id ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const removeItem = (id: number) => {
    setCart((prev) => prev.filter((i) => i.product.id !== id));
  };

  const handleBarcode = () => {
    const code = parseInt(barcode, 10);
    const product = products.find((p) => p.id === code);
    if (product) {
      addToCart(product);
      setBarcode('');
    }
  };

  const subtotal = cart.reduce((sum, i) => sum + i.product.price * i.qty, 0);
  const discountValue = discountType === 'percent' ? subtotal * (discount / 100) : discount;
  const taxable = Math.max(0, subtotal - discountValue);
  const tax = taxEnabled ? taxable * 0.18 : 0;
  const total = taxable + tax;
  const paid = parseInt(amountPaid || '0', 10) || 0;
  const change = Math.max(0, paid - total);

  const receiptNo = `REC-${Date.now().toString().slice(-6)}`;
  const now = new Date().toLocaleString('en-GB');

  return (
    <div className="h-full bg-slate-950 text-slate-100 flex">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-3 border-b border-slate-800 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-400" />
            <h1 className="text-sm font-semibold">POS Terminal</h1>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Barcode className="w-4 h-4 text-slate-400" />
            <Input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBarcode()}
              placeholder="Scan barcode (product ID)"
              className="w-48 h-8 bg-slate-900 border-slate-700 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-48 h-8 bg-slate-900 border-slate-700 text-xs"
            />
          </div>
        </div>

        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="px-3 pt-2">
          <TabsList className="bg-slate-900 border border-slate-800 h-8">
            {categories.map((c) => (
              <TabsTrigger key={c} value={c} className="text-xs px-3 py-1 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                {c}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <ScrollArea className="flex-1 p-3">
          <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="text-left rounded-xl border border-slate-800 bg-slate-900/60 hover:border-blue-500/40 hover:bg-slate-800/80 transition-all group"
              >
                <div className={`h-20 w-full rounded-t-xl ${product.color} opacity-80 group-hover:opacity-100 transition-opacity`} />
                <div className="p-2">
                  <div className="text-xs font-medium truncate">{product.name}</div>
                  <div className="text-xs text-blue-400 font-semibold mt-0.5">{tzs(product.price)}</div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="w-80 border-l border-slate-800 bg-slate-900/40 flex flex-col">
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-sm font-semibold flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-blue-400" />
            Cart ({cart.reduce((s, i) => s + i.qty, 0)})
          </span>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        <ScrollArea className="flex-1 p-3">
          {cart.length === 0 ? (
            <div className="text-center text-slate-500 text-xs py-8">
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No items in cart
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((item) => (
                <div key={item.product.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <div className={`w-8 h-8 rounded-md ${item.product.color} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{item.product.name}</div>
                    <div className="text-[10px] text-slate-400">{tzs(item.product.price)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(item.product.id, -1)} className="w-5 h-5 rounded bg-slate-700 flex items-center justify-center hover:bg-slate-600">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-5 text-center text-xs">{item.qty}</span>
                    <button onClick={() => updateQty(item.product.id, 1)} className="w-5 h-5 rounded bg-slate-700 flex items-center justify-center hover:bg-slate-600">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <button onClick={() => removeItem(item.product.id)} className="text-slate-500 hover:text-red-400">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-3 border-t border-slate-800 space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setDiscountType('percent'); setDiscount(discount > 0 ? discount : 0); }}
              className={`text-xs px-2 py-1 rounded border ${discountType === 'percent' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-slate-700 text-slate-400'}`}
            >
              <Percent className="w-3 h-3 inline mr-1" />%
            </button>
            <button
              onClick={() => { setDiscountType('amount'); setDiscount(discount > 0 ? discount : 0); }}
              className={`text-xs px-2 py-1 rounded border ${discountType === 'amount' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-slate-700 text-slate-400'}`}
            >
              <Tag className="w-3 h-3 inline mr-1" />TZS
            </button>
            <Input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="h-7 w-24 bg-slate-900 border-slate-700 text-xs"
              placeholder="Discount"
            />
            <button
              onClick={() => setTaxEnabled((v) => !v)}
              className={`text-xs px-2 py-1 rounded border ml-auto ${taxEnabled ? 'border-green-500 bg-green-500/10 text-green-400' : 'border-slate-700 text-slate-400'}`}
            >
              VAT 18%
            </button>
          </div>

          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal</span>
              <span>{tzs(subtotal)}</span>
            </div>
            {discountValue > 0 && (
              <div className="flex justify-between text-green-400">
                <span>Discount</span>
                <span>-{tzs(Math.round(discountValue))}</span>
              </div>
            )}
            {taxEnabled && (
              <div className="flex justify-between text-slate-400">
                <span>VAT (18%)</span>
                <span>{tzs(Math.round(tax))}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold pt-1 border-t border-slate-800">
              <span>Total</span>
              <span className="text-blue-400">{tzs(Math.round(total))}</span>
            </div>
          </div>

          <Button
            onClick={() => setCheckoutOpen(true)}
            disabled={cart.length === 0}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white"
          >
            Checkout
          </Button>
        </div>
      </div>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center py-2">
              <div className="text-xs text-slate-400">Amount Due</div>
              <div className="text-2xl font-bold text-blue-400">{tzs(Math.round(total))}</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['cash', 'mpesa', 'card'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors ${
                    paymentMethod === m ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {m === 'cash' && <Banknote className="w-5 h-5" />}
                  {m === 'mpesa' && <Smartphone className="w-5 h-5" />}
                  {m === 'card' && <CreditCard className="w-5 h-5" />}
                  <span className="text-xs capitalize">{m === 'mpesa' ? 'M-Pesa' : m}</span>
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Amount Paid (TZS)</label>
              <Input
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100"
                placeholder="Enter amount"
              />
            </div>
            {change > 0 && (
              <div className="flex justify-between text-xs text-green-400">
                <span>Change</span>
                <span>{tzs(Math.round(change))}</span>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCheckoutOpen(false)} className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800">
                Cancel
              </Button>
              <Button
                onClick={() => { setCheckoutOpen(false); setReceiptOpen(true); }}
                disabled={paid < total}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white"
              >
                Complete Sale
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Receipt className="w-4 h-4" /> Receipt Preview
            </DialogTitle>
          </DialogHeader>
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2 text-xs">
            <div className="text-center border-b border-slate-800 pb-2">
              <div className="font-bold text-sm">KOBE Enterprises</div>
              <div className="text-slate-400">Dar es Salaam, Tanzania</div>
              <div className="text-slate-400">{now}</div>
              <div className="text-slate-500 mt-1">{receiptNo}</div>
            </div>
            <div className="space-y-1 py-1">
              {cart.map((item) => (
                <div key={item.product.id} className="flex justify-between">
                  <span>{item.product.name} x{item.qty}</span>
                  <span>{tzs(item.product.price * item.qty)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-800 pt-2 space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal</span>
                <span>{tzs(subtotal)}</span>
              </div>
              {discountValue > 0 && (
                <div className="flex justify-between text-green-400">
                  <span>Discount</span>
                  <span>-{tzs(Math.round(discountValue))}</span>
                </div>
              )}
              {taxEnabled && (
                <div className="flex justify-between text-slate-400">
                  <span>VAT</span>
                  <span>{tzs(Math.round(tax))}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm pt-1">
                <span>Total</span>
                <span>{tzs(Math.round(total))}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Paid ({paymentMethod === 'mpesa' ? 'M-Pesa' : paymentMethod})</span>
                <span>{tzs(paid)}</span>
              </div>
              {change > 0 && (
                <div className="flex justify-between text-green-400">
                  <span>Change</span>
                  <span>{tzs(Math.round(change))}</span>
                </div>
              )}
            </div>
            <div className="text-center text-slate-500 pt-2">Thank you for shopping!</div>
          </div>
          <Button
            onClick={() => {
              setReceiptOpen(false);
              setCart([]);
              setDiscount(0);
              setAmountPaid('');
            }}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white"
          >
            Print & New Sale
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
