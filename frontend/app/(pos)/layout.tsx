"use client";

import { LayoutDashboard, LogOut } from "lucide-react";
import Link from "next/link";
import { BranchBadge } from "@/components/app-shell/branch-badge";
import { Calculator } from "@/components/app-shell/calculator";
import { Clock } from "@/components/app-shell/clock";
import { RequireAuth } from "@/components/app-shell/require-auth";
import { ThemeToggle } from "@/components/app-shell/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

function PosChrome({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between border-b bg-background px-4">
        <div className="flex items-center gap-3">
          <span className="font-bold tracking-tight">
            Smart<span className="text-primary">POS</span>
          </span>
          <span className="hidden text-sm text-muted-foreground lg:inline">Point of Sale</span>
          <Clock />
          <BranchBadge />
        </div>
        <div className="flex items-center gap-1">
          <Calculator />
          <ThemeToggle />
          <span className="mx-2 hidden text-sm text-muted-foreground sm:inline">
            {user?.name}
          </span>
          {user && user.role !== "CASHIER" && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">
                <LayoutDashboard className="mr-1 h-4 w-4" />
                Dashboard
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => logout()}>
            <LogOut className="mr-1 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <PosChrome>{children}</PosChrome>
    </RequireAuth>
  );
}
