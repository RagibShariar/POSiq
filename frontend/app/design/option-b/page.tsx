"use client";

// DESIGN SAMPLE B — "সহজ মোড (Easy Mode)"
// Bengali-first labels, very large text and buttons, maximum contrast.
// Built for cashiers who read little English — icons + Bangla + numbers.

import { Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

const PRODUCTS = [
  { id: 1, name: "কোকা কোলা", en: "Coca Cola", price: 45, emoji: "🥤" },
  { id: 2, name: "রেড বুল", en: "Red Bull", price: 180, emoji: "⚡" },
  { id: 3, name: "আমের জুস", en: "Mango Juice", price: 60, emoji: "🥭" },
  { id: 4, name: "চিপস", en: "Lays", price: 30, emoji: "🍟" },
  { id: 5, name: "চকলেট", en: "Chocolate", price: 90, emoji: "🍫" },
  { id: 6, name: "কফি", en: "Nescafe", price: 250, emoji: "☕" },
  { id: 7, name: "দুধ ১ লিটার", en: "Milk 1L", price: 95, emoji: "🥛" },
  { id: 8, name: "বিস্কুট", en: "Biscuit", price: 25, emoji: "🍪" },
];

export default function DesignB() {
  const [cart, setCart] = useState<{ id: number; qty: number }[]>([
    { id: 1, qty: 2 },
    { id: 6, qty: 1 },
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

  return (
    <div className="flex h-screen flex-col bg-white font-sans">
      <header className="flex h-16 items-center justify-between bg-slate-900 px-5 text-white">
        <div className="text-2xl font-extrabold">
          🛒 স্মার্ট<span className="text-yellow-400">POS</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-emerald-500 px-4 py-2 text-base font-bold">✓ ক্যাশবাক্স খোলা</span>
          <span className="text-lg">👤 করিম</span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Products — huge cards, Bangla names */}
        <div className="grid flex-1 auto-rows-min grid-cols-2 gap-4 overflow-y-auto bg-slate-50 p-4 lg:grid-cols-3">
          {PRODUCTS.map((p) => (
            <button
              key={p.id}
              onClick={() => add(p.id)}
              className="rounded-2xl border-4 border-slate-200 bg-white p-4 text-center shadow transition active:scale-95 active:border-yellow-400"
            >
              <div className="text-6xl">{p.emoji}</div>
              <div className="mt-2 text-xl font-extrabold text-slate-900">{p.name}</div>
              <div className="text-sm text-slate-400">{p.en}</div>
              <div className="mt-2 text-2xl font-extrabold text-emerald-600">৳{p.price}</div>
            </button>
          ))}
        </div>

        {/* Cart — Bangla labels, giant controls */}
        <div className="flex w-[26rem] shrink-0 flex-col border-l-8 border-yellow-400 bg-white">
          <div className="bg-yellow-400 p-4 text-2xl font-extrabold text-slate-900">🧾 বিক্রির তালিকা</div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {lines.map((l) => (
              <div key={l.id} className="rounded-2xl border-2 border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-lg font-extrabold">
                    <span className="text-2xl">{l.emoji}</span> {l.name}
                  </span>
                  <button onClick={() => setQty(l.id, 0)} className="rounded-lg bg-red-100 p-2 text-red-600">
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setQty(l.id, l.qty - 1)} className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500 text-white active:scale-90">
                      <Minus className="h-6 w-6" />
                    </button>
                    <span className="w-10 text-center text-2xl font-extrabold">{l.qty}</span>
                    <button onClick={() => add(l.id)} className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 text-white active:scale-90">
                      <Plus className="h-6 w-6" />
                    </button>
                  </div>
                  <span className="text-2xl font-extrabold">৳{l.price * l.qty}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3 border-t-4 border-slate-200 p-4">
            <div className="flex items-center justify-between rounded-2xl bg-slate-900 px-5 py-4 text-white">
              <span className="text-xl font-bold">মোট</span>
              <span className="text-4xl font-extrabold text-yellow-400">৳{total.toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-lg font-extrabold">
              <button onClick={() => setPayment("cash")} className={`rounded-xl p-3 ${payment === "cash" ? "bg-emerald-600 text-white ring-4 ring-emerald-200" : "bg-emerald-50 text-emerald-800"}`}>
                💵<br />নগদ টাকা
              </button>
              <button onClick={() => setPayment("card")} className={`rounded-xl p-3 ${payment === "card" ? "bg-blue-600 text-white ring-4 ring-blue-200" : "bg-blue-50 text-blue-800"}`}>
                💳<br />কার্ড
              </button>
              <button onClick={() => setPayment("bkash")} className={`rounded-xl p-3 ${payment === "bkash" ? "bg-pink-600 text-white ring-4 ring-pink-200" : "bg-pink-50 text-pink-700"}`}>
                📱<br />বিকাশ
              </button>
            </div>
            <button className="w-full rounded-2xl bg-emerald-600 py-5 text-2xl font-extrabold text-white shadow-xl active:scale-95">
              ✓ টাকা নিন — ৳{total.toLocaleString()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
