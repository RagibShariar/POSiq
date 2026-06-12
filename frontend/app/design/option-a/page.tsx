"use client";

// DESIGN SAMPLE A — "Colorful Touch"
// Vibrant category colors, emoji product icons, big touch targets,
// Bangladesh payment colors (bKash pink / Nagad orange / cash green).

import { Banknote, CreditCard, Minus, Plus, Smartphone, Trash2 } from "lucide-react";
import { useState } from "react";

const CATEGORIES = [
  { id: "all", label: "All", emoji: "🏪", color: "bg-slate-700" },
  { id: "drinks", label: "Drinks", emoji: "🥤", color: "bg-sky-500" },
  { id: "snacks", label: "Snacks", emoji: "🍟", color: "bg-orange-500" },
  { id: "coffee", label: "Coffee", emoji: "☕", color: "bg-amber-600" },
  { id: "dairy", label: "Dairy", emoji: "🥛", color: "bg-violet-500" },
];

const PRODUCTS = [
  { id: 1, name: "Coca Cola 500ml", price: 45, emoji: "🥤", cat: "drinks", tint: "bg-sky-50 border-sky-200" },
  { id: 2, name: "Red Bull 250ml", price: 180, emoji: "⚡", cat: "drinks", tint: "bg-sky-50 border-sky-200" },
  { id: 3, name: "Mango Juice", price: 60, emoji: "🥭", cat: "drinks", tint: "bg-sky-50 border-sky-200" },
  { id: 4, name: "Lays Original", price: 30, emoji: "🍟", cat: "snacks", tint: "bg-orange-50 border-orange-200" },
  { id: 5, name: "Pringles", price: 350, emoji: "🥫", cat: "snacks", tint: "bg-orange-50 border-orange-200" },
  { id: 6, name: "Chocolate Bar", price: 90, emoji: "🍫", cat: "snacks", tint: "bg-orange-50 border-orange-200" },
  { id: 7, name: "Nescafe Classic", price: 250, emoji: "☕", cat: "coffee", tint: "bg-amber-50 border-amber-200" },
  { id: 8, name: "Latte", price: 180, emoji: "🍮", cat: "coffee", tint: "bg-amber-50 border-amber-200" },
  { id: 9, name: "Fresh Milk 1L", price: 95, emoji: "🥛", cat: "dairy", tint: "bg-violet-50 border-violet-200" },
  { id: 10, name: "Yogurt Cup", price: 40, emoji: "🍦", cat: "dairy", tint: "bg-violet-50 border-violet-200" },
];

export default function DesignA() {
  const [cat, setCat] = useState("all");
  const [cart, setCart] = useState<{ id: number; qty: number }[]>([
    { id: 1, qty: 2 },
    { id: 7, qty: 1 },
  ]);
  const [payment, setPayment] = useState("cash");

  const add = (id: number) =>
    setCart((c) =>
      c.find((l) => l.id === id)
        ? c.map((l) => (l.id === id ? { ...l, qty: l.qty + 1 } : l))
        : [...c, { id, qty: 1 }]
    );
  const setQty = (id: number, qty: number) =>
    setCart((c) => (qty <= 0 ? c.filter((l) => l.id !== id) : c.map((l) => (l.id === id ? { ...l, qty } : l))));

  const lines = cart.map((l) => ({ ...PRODUCTS.find((p) => p.id === l.id)!, qty: l.qty }));
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const visible = PRODUCTS.filter((p) => cat === "all" || p.cat === cat);

  return (
    <div className="flex h-screen flex-col bg-slate-100 font-sans">
      <header className="flex h-14 items-center justify-between bg-emerald-600 px-4 text-white">
        <div className="flex items-center gap-2 text-lg font-bold">
          🛒 SmartPOS <span className="rounded bg-white/20 px-2 py-0.5 text-xs font-medium">Gulshan Branch</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-full bg-white/20 px-3 py-1">🟢 Register Open</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white font-bold text-emerald-700">K</span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Category color chips */}
          <div className="flex gap-2 overflow-x-auto p-3">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow transition-transform active:scale-95 ${c.color} ${cat === c.id ? "ring-4 ring-yellow-300" : "opacity-80"}`}
              >
                <span className="text-lg">{c.emoji}</span> {c.label}
              </button>
            ))}
          </div>

          {/* Product grid — big emoji cards */}
          <div className="grid flex-1 auto-rows-min grid-cols-3 gap-3 overflow-y-auto px-3 pb-3 lg:grid-cols-4">
            {visible.map((p) => (
              <button
                key={p.id}
                onClick={() => add(p.id)}
                className={`rounded-2xl border-2 p-3 text-center shadow-sm transition-transform active:scale-95 ${p.tint}`}
              >
                <div className="text-4xl">{p.emoji}</div>
                <div className="mt-1 line-clamp-2 text-sm font-semibold text-slate-800">{p.name}</div>
                <div className="mt-1 inline-block rounded-full bg-emerald-600 px-3 py-0.5 text-sm font-bold text-white">
                  ৳{p.price}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Cart */}
        <div className="flex w-96 shrink-0 flex-col border-l-4 border-emerald-600 bg-white">
          <div className="bg-emerald-50 p-3 text-lg font-bold text-emerald-900">🧾 Current Sale</div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {lines.map((l) => (
              <div key={l.id} className="flex items-center gap-2 rounded-xl border-2 border-slate-100 bg-slate-50 p-2">
                <span className="text-2xl">{l.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{l.name}</div>
                  <div className="text-xs text-slate-500">৳{l.price} each</div>
                </div>
                <button onClick={() => setQty(l.id, l.qty - 1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-600 active:scale-90">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-6 text-center text-lg font-bold">{l.qty}</span>
                <button onClick={() => add(l.id)} className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 active:scale-90">
                  <Plus className="h-4 w-4" />
                </button>
                <button onClick={() => setQty(l.id, 0)} className="ml-1 text-slate-400">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-3 border-t-2 p-3">
            <div className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-white">
              <span className="text-sm font-medium">TOTAL</span>
              <span className="text-3xl font-extrabold">৳{total.toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setPayment("cash")} className={`flex flex-col items-center gap-1 rounded-xl border-4 p-3 font-bold transition ${payment === "cash" ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
                <Banknote className="h-6 w-6" /> Cash
              </button>
              <button onClick={() => setPayment("card")} className={`flex flex-col items-center gap-1 rounded-xl border-4 p-3 font-bold transition ${payment === "card" ? "border-blue-600 bg-blue-600 text-white" : "border-blue-200 bg-blue-50 text-blue-800"}`}>
                <CreditCard className="h-6 w-6" /> Card
              </button>
              <button onClick={() => setPayment("bkash")} className={`flex flex-col items-center gap-1 rounded-xl border-4 p-3 font-bold transition ${payment === "bkash" ? "border-pink-600 bg-pink-600 text-white" : "border-pink-200 bg-pink-50 text-pink-700"}`}>
                <Smartphone className="h-6 w-6" /> bKash
              </button>
            </div>
            <button className="w-full rounded-2xl bg-emerald-600 py-4 text-xl font-extrabold text-white shadow-lg transition active:scale-95">
              ✓ PAY ৳{total.toLocaleString()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
