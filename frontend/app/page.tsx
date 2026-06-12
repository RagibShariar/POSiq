import { ArrowRight, BarChart3, Sparkles, Store } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: Store,
    title: "Run your shop from anywhere",
    text: "Fast POS checkout, multi-branch inventory, team roles — all in the cloud.",
  },
  {
    icon: Sparkles,
    title: "Ask your business anything",
    text: "An AI assistant that answers from your real sales data: “What should I restock?”",
  },
  {
    icon: BarChart3,
    title: "Know your numbers",
    text: "Daily KPIs, branch comparison, top products, and CSV exports built in.",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <span className="text-xl font-bold tracking-tight">
          Smart<span className="text-primary">POS</span>
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Get started free</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 pb-16 pt-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          The point of sale that <span className="text-primary">answers back</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Smart POS runs your retail shop, café, salon, or pharmacy — and its AI assistant
          turns your sales data into decisions, in plain language.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/register">
              Start free <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Free plan: 1 user · 100 products · 5 AI queries/day. No card required.
        </p>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-6 pb-24 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border bg-card p-6">
            <f.icon className="h-7 w-7 text-primary" />
            <h3 className="mt-3 font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
