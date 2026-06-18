"use client";

import { Building2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import type { Branch } from "@/lib/types";

// Shows the user's branch in the navbar. One branch → a static badge;
// multiple (e.g. an owner) → a dropdown listing them all.
export function BranchBadge() {
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [business, setBusiness] = useState<string>("");

  useEffect(() => {
    api
      .get<unknown>("/users/me")
      .then((res) => {
        const me = res.data as { branches?: Branch[]; business?: { name: string } };
        setBranches(me.branches ?? []);
        setBusiness(me.business?.name ?? "");
      })
      .catch(() => setBranches([]));
  }, []);

  if (!branches || branches.length === 0) return null;

  const main = branches.find((b) => b.isMainBranch) ?? branches[0];
  const pill =
    "hidden items-center gap-1.5 rounded-lg border bg-muted/40 px-2.5 py-1.5 text-sm md:flex";

  if (branches.length === 1) {
    return (
      <span className={pill} title={`${main.name} · ${main.code}`}>
        <Building2 className="h-4 w-4 shrink-0 text-primary/70" />
        <span className="font-medium">{main.name}</span>
        <span className="text-muted-foreground">· {main.code}</span>
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={`${pill} cursor-pointer hover:bg-muted`}>
        <Building2 className="h-4 w-4 shrink-0 text-primary/70" />
        <span className="font-medium">{main.name}</span>
        <span className="rounded bg-primary/10 px-1.5 text-xs font-semibold text-primary">
          {branches.length} branches
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{business || "Your branches"}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {branches.map((b) => (
          <DropdownMenuItem key={b.id} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              {b.name}
              <span className="text-xs text-muted-foreground">{b.code}</span>
            </span>
            {b.isMainBranch && (
              <span className="text-[10px] font-semibold uppercase text-primary">Main</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
