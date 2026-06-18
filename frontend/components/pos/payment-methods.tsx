"use client";

import { Banknote, Bike, Clock, CreditCard, Gift, Smartphone, Wallet } from "lucide-react";
import { useState } from "react";

// Payment sources the POS can take. Legacy CARD/MOBILE_BANKING and the MIXED
// split-marker still appear in old orders, so they get labels/colors but aren't
// directly selectable here.
export type PayMethod =
  | "CASH"
  | "DUE"
  | "COMPLIMENT"
  | "VISA"
  | "AMEX"
  | "MASTERCARD"
  | "BKASH"
  | "NAGAD"
  | "ROCKET"
  | "FOODPANDA"
  | "FOODI"
  | "PATHAO"
  | "OTHER";

export type RefKind = "cash" | "card" | "mobile" | "optional";
export type MethodGroup = "Standard" | "Cards" | "Mobile banking" | "Food delivery";

export interface MethodDef {
  id: PayMethod;
  label: string;
  group: MethodGroup;
  color: string; // brand hex
  refKind: RefKind;
  icon: React.ComponentType<{ className?: string }>;
  logo?: string; // path to a brand SVG under /public
  hideLabel?: boolean; // true when the logo already includes the brand wordmark
}

export const PAYMENT_METHODS: MethodDef[] = [
  { id: "CASH", label: "Cash", group: "Standard", color: "#10b981", refKind: "cash", icon: Banknote, logo: "/payment/cash.svg" },
  { id: "DUE", label: "Due", group: "Standard", color: "#f59e0b", refKind: "optional", icon: Clock },
  { id: "COMPLIMENT", label: "Compliment", group: "Standard", color: "#8b5cf6", refKind: "optional", icon: Gift },
  { id: "OTHER", label: "Others", group: "Standard", color: "#64748b", refKind: "optional", icon: Wallet },
  { id: "VISA", label: "Visa", group: "Cards", color: "#1a1f71", refKind: "card", icon: CreditCard, logo: "/payment/visa.svg", hideLabel: true },
  { id: "MASTERCARD", label: "Mastercard", group: "Cards", color: "#eb001b", refKind: "card", icon: CreditCard, logo: "/payment/mastercard.svg", hideLabel: true },
  { id: "AMEX", label: "Amex", group: "Cards", color: "#2e77bc", refKind: "card", icon: CreditCard, logo: "/payment/amex.svg", hideLabel: true },
  { id: "BKASH", label: "bKash", group: "Mobile banking", color: "#e2136e", refKind: "mobile", icon: Smartphone, logo: "/payment/bkash.svg", hideLabel: true },
  { id: "NAGAD", label: "Nagad", group: "Mobile banking", color: "#ec1c24", refKind: "mobile", icon: Smartphone, logo: "/payment/nagad.svg", hideLabel: true },
  { id: "ROCKET", label: "Rocket", group: "Mobile banking", color: "#8c3494", refKind: "mobile", icon: Smartphone, logo: "/payment/rocket.svg", hideLabel: true },
  { id: "FOODPANDA", label: "Foodpanda", group: "Food delivery", color: "#d70f64", refKind: "optional", icon: Bike, logo: "/payment/foodpanda.png", hideLabel: true },
  { id: "FOODI", label: "Foodi", group: "Food delivery", color: "#e10101", refKind: "optional", icon: Bike, logo: "/payment/foodi.svg", hideLabel: true },
  { id: "PATHAO", label: "Pathao food", group: "Food delivery", color: "#e21b22", refKind: "optional", icon: Bike, logo: "/payment/pathao.png", hideLabel: true },
];

/** Renders a method's brand logo when available, else (or on load error) its tinted icon. */
export function MethodVisual({ method, className }: { method: MethodDef; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (method.logo && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={method.logo}
        alt={method.label}
        className={className ?? "h-5 w-auto"}
        onError={() => setFailed(true)}
      />
    );
  }
  const Icon = method.icon;
  return <Icon className={className ?? "h-4 w-4"} />;
}

export const PAYMENT_GROUPS: MethodGroup[] = ["Standard", "Cards", "Mobile banking", "Food delivery"];

const BY_ID = new Map(PAYMENT_METHODS.map((m) => [m.id, m]));

const LEGACY_LABEL: Record<string, string> = {
  CARD: "Card",
  MOBILE_BANKING: "Mobile banking",
  MIXED: "Mixed",
};
const LEGACY_COLOR: Record<string, string> = {
  CARD: "#3b82f6",
  MOBILE_BANKING: "#ec4899",
  MIXED: "#0ea5e9",
};

export const methodDef = (id: string) => BY_ID.get(id as PayMethod);
export const methodLabel = (id: string) =>
  BY_ID.get(id as PayMethod)?.label ?? LEGACY_LABEL[id] ?? id.replace(/_/g, " ");
export const methodColor = (id: string) =>
  BY_ID.get(id as PayMethod)?.color ?? LEGACY_COLOR[id] ?? "#64748b";
