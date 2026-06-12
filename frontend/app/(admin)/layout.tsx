"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/app-shell/require-auth";
import { useAuth } from "@/lib/auth-context";

function AdminChrome({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="flex h-14 items-center justify-between border-b bg-background px-6">
        <div className="flex items-center gap-2 font-bold">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Smart<span className="text-primary">POS</span>
          <span className="ml-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            SUPER ADMIN
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={() => logout()}>
            <LogOut className="mr-1 h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth roles={["SUPER_ADMIN"]}>
      <AdminChrome>{children}</AdminChrome>
    </RequireAuth>
  );
}
