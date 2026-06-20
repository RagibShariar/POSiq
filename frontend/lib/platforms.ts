import type { OrderPlatform } from "@/lib/types";

interface PlatformMeta {
  id: OrderPlatform;
  label: string;
  settingsKey?: "foodpanda" | "pathao" | "foodi"; // key in settings.platforms
  color: string;
}

// Platforms selectable at the POS. OTHER = walk-in / in-store.
export const PLATFORMS: PlatformMeta[] = [
  { id: "OTHER", label: "In-store", color: "#64748b" },
  { id: "FOODPANDA", label: "Foodpanda", settingsKey: "foodpanda", color: "#d70f64" },
  { id: "PATHAO", label: "Pathao food", settingsKey: "pathao", color: "#e21b22" },
  { id: "FOODI", label: "Foodi", settingsKey: "foodi", color: "#e10101" },
];

const BY_ID = new Map(PLATFORMS.map((p) => [p.id, p]));

const EXTRA_LABEL: Record<string, string> = { SHOHOZ: "Shohoz" };

export const platformLabel = (id: string) =>
  BY_ID.get(id as OrderPlatform)?.label ?? EXTRA_LABEL[id] ?? id;
export const platformColor = (id: string) => BY_ID.get(id as OrderPlatform)?.color ?? "#64748b";
