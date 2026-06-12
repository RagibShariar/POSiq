"use client";

import { LayoutDashboard, LogOut } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/app-shell/require-auth";
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
          <span className="text-sm text-muted-foreground">Point of Sale</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="mr-2 hidden text-sm text-muted-foreground sm:inline">
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
