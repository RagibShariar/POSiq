"use client";

// DESIGN SAMPLE C — "Modern Clean"
// Professional indigo look, product photos placeholder w/ initials,
// softer color coding, still touch-friendly but more "premium SaaS".

import {
  Banknote,
  CreditCard,
  LayoutGrid,
  Minus,
  Plus,
  Receipt,
  Search,
  Smartphone,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useState } from "react";

const PRODUCTS = [
  { id: 1, name: "Coca Cola 500ml", price: 45, color: "bg-rose-500", initials: "CC" },
  { id: 2, name: "Red Bull 250ml", price: 180, color: "bg-indigo-500", initials: "RB" },
  { id: 3, name: "Mango Juice", price: 60, color: "bg-amber-500", initials: "MJ" },
  { id: 4, name: "Lays Original", price: 30, color: "bg-yellow-500", initials: "LO" },
  { id: 5, name: "Pringles", price: 350, color: "bg-emerald-500", initials: "PR" },
  { id: 6, name: "Nescafe Classic", price: 250, color: "bg-orange-600", initials: "NC" },
  { id: 7, name: "Fresh Milk 1L", price: 95, color: "bg-sky-500", initials: "FM" },
  { id: 8, name: "Chocolate Bar", price: 90, color: "bg-fuchsia-500", initials: "CB" },
];

export default function DesignC() {
  const [cart, setCart] = useState<{ id: number; qty: number }[]>([
    { id: 2, qty: 1 },
    { id: 4, qty: 3 },
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
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* Icon rail */}
      <aside className="flex w-16 shrink-0 flex-col items-center gap-2 bg-indigo-950 py-4">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-lg font-black text-white">
          S
        </div>
        {[LayoutGrid, Receipt, Sparkles].map((Icon, i) => (
          <button
            key={i}
            className={`flex h-11 w-11 items-center justify-center rounded-xl transition ${i === 0 ? "bg-indigo-600 text-white" : "text-indigo-300 hover:bg-indigo-900"}`}
          >
            <Icon className="h-5 w-5" />
          </button>
        ))}
        <div className="mt-auto flex h-9 w-9 items-center justify-center rounded-full bg-indigo-700 text-sm font-bold text-white">
          K
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-white px-5">
          <div>
            <div className="text-sm font-bold text-slate-900">Gulshan Branch</div>
            <div className="text-xs text-emerald-600">● Register open since 9:00 AM</div>
          </div>
          <div className="relative w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              className="w-full rounded-full border border-slate-200 bg-slate-100 py-2 pl-9 pr-4 text-sm outline-none focus:border-indigo-400 focus:bg-white"
              placeholder="Search or scan barcode…"
            />
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="grid flex-1 auto-rows-min grid-cols-3 gap-3 overflow-y-auto p-4 lg:grid-cols-4">
            {PRODUCTS.map((p) => (
              <button
                key={p.id}
                onClick={() => add(p.id)}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-95"
              >
                <div className={`flex h-20 items-center justify-center text-2xl font-black text-white ${p.color}`}>
                  {p.initials}
                </div>
                <div className="p-3">
                  <div className="line-clamp-1 text-sm font-semibold text-slate-800">{p.name}</div>
                  <div className="mt-1 text-base font-bold text-indigo-600">৳{p.price}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Cart */}
          <div className="flex w-96 shrink-0 flex-col border-l bg-white">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="font-bold text-slate-900">Order #00012</h2>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                {lines.reduce((s, l) => s + l.qty, 0)} items
              </span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {lines.map((l) => (
                <div key={l.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white ${l.color}`}>
                    {l.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-800">{l.name}</div>
                    <div className="text-xs text-slate-500">৳{l.price}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setQty(l.id, l.qty - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 active:scale-90">
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-6 text-center font-bold">{l.qty}</span>
                    <button onClick={() => add(l.id)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white active:scale-90">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button onClick={() => setQty(l.id, 0)} className="text-slate-300 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-3 border-t p-4">
              <div className="flex justify-between text-sm text-slate-500">
                <span>Subtotal</span>
                <span>৳{total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-2xl font-extrabold text-slate-900">
                <span>Total</span>
                <span>৳{total.toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "cash", label: "Cash", icon: Banknote, on: "bg-emerald-600 text-white", off: "bg-emerald-50 text-emerald-700" },
                  { id: "card", label: "Card", icon: CreditCard, on: "bg-blue-600 text-white", off: "bg-blue-50 text-blue-700" },
                  { id: "bkash", label: "bKash", icon: Smartphone, on: "bg-pink-600 text-white", off: "bg-pink-50 text-pink-700" },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setPayment(m.id)}
                    className={`flex flex-col items-center gap-1 rounded-xl p-2.5 text-xs font-bold transition ${payment === m.id ? m.on : m.off}`}
                  >
                    <m.icon className="h-5 w-5" /> {m.label}
                  </button>
                ))}
              </div>
              <button className="w-full rounded-xl bg-indigo-600 py-3.5 text-lg font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 active:scale-95">
                Complete sale · ৳{total.toLocaleString()}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
