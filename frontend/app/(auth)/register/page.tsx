"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiRequestError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const BUSINESS_TYPES = [
  { value: "retail", label: "Retail shop" },
  { value: "restaurant", label: "Restaurant / Café" },
  { value: "salon", label: "Salon" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "other", label: "Other" },
];

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    businessName: "",
    businessType: "retail",
    businessEmail: "",
    phone: "",
    ownerName: "",
    ownerEmail: "",
    password: "",
  });

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await register({ ...form, phone: form.phone || undefined });
      toast.success("Business registered — welcome aboard!");
      router.replace("/dashboard");
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Registration failed");
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Register your business</CardTitle>
        <CardDescription>
          Start free — 1 user, 100 products, 5 AI queries a day. Upgrade anytime.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business name</Label>
              <Input
                id="businessName"
                required
                value={form.businessName}
                onChange={(e) => set("businessName")(e.target.value)}
                placeholder="Sunrise Café"
              />
            </div>
            <div className="space-y-2">
              <Label>Business type</Label>
              <Select value={form.businessType} onValueChange={set("businessType")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="businessEmail">Business email</Label>
              <Input
                id="businessEmail"
                type="email"
                required
                value={form.businessEmail}
                onChange={(e) => set("businessEmail")(e.target.value)}
                placeholder="hello@sunrise.cafe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => set("phone")(e.target.value)}
                placeholder="+8801…"
              />
            </div>
          </div>
          <hr className="border-border" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ownerName">Your name</Label>
              <Input
                id="ownerName"
                required
                value={form.ownerName}
                onChange={(e) => set("ownerName")(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ownerEmail">Your email (login)</Label>
              <Input
                id="ownerEmail"
                type="email"
                required
                value={form.ownerEmail}
                onChange={(e) => set("ownerEmail")(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => set("password")(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Creating your business…" : "Create business"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already registered?{" "}
          <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
