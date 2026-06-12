import Link from "next/link";

const OPTIONS = [
  {
    href: "/design/option-a",
    title: "Option A — Colorful Touch",
    desc: "Vibrant category colors, emoji product icons, color-coded payments (bKash pink). Friendly and playful.",
  },
  {
    href: "/design/option-b",
    title: "Option B — সহজ মোড (Easy Mode)",
    desc: "Bengali-first labels, huge text and buttons, maximum contrast. Built for cashiers who read little English.",
  },
  {
    href: "/design/option-c",
    title: "Option C — Modern Clean",
    desc: "Premium SaaS look: indigo accent, icon rail, colored product tiles. Professional but still touch-friendly.",
  },
];

export default function DesignIndex() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold">POS UI design samples</h1>
      <p className="mt-2 text-muted-foreground">
        Three different directions for the cashier screen. Open each one and try tapping
        products, changing quantities, and switching payment methods — they are live demos.
      </p>
      <div className="mt-8 space-y-4">
        {OPTIONS.map((o) => (
          <Link
            key={o.href}
            href={o.href}
            className="block rounded-xl border bg-card p-5 transition hover:border-primary hover:shadow-md"
          >
            <div className="text-lg font-semibold">{o.title}</div>
            <p className="mt-1 text-sm text-muted-foreground">{o.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
