"use client";

import {
  BarChart3,
  Barcode,
  Boxes,
  Building2,
  LayoutDashboard,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Hint } from "@/components/ui/hint";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import type { Role } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["OWNER", "MANAGER"] },
  // POS lives in the topbar as a highlighted quick-access button.
  { href: "/orders", label: "Orders", icon: Receipt, roles: ["OWNER", "MANAGER", "CASHIER"] },
  { href: "/products", label: "Products", icon: Package, roles: ["OWNER", "MANAGER"] },
  { href: "/labels", label: "Print Labels", icon: Barcode, roles: ["OWNER", "MANAGER"] },
  { href: "/inventory", label: "Inventory", icon: Boxes, roles: ["OWNER", "MANAGER"] },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["OWNER", "MANAGER"] },
  { href: "/ai", label: "AI Assistant", icon: Sparkles, roles: ["OWNER", "MANAGER"] },
  { href: "/team", label: "Team", icon: Users, roles: ["OWNER", "MANAGER"] },
  { href: "/branches", label: "Branches", icon: Building2, roles: ["OWNER", "MANAGER"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["OWNER"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [animate, setAnimate] = useState(false);

  // Restore the collapsed preference after mount (avoids SSR/client mismatch).
  // Enable the width transition only after the restored state is painted, so the
  // sidebar doesn't animate open→closed on every page load.
  useEffect(() => {
    setMounted(true);
    setCollapsed(localStorage.getItem("sidebar.collapsed") === "1");
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem("sidebar.collapsed", next ? "1" : "0");
      } catch {
        /* private mode — ignore */
      }
      return next;
    });
  }

  if (!user) return null;

  const items = NAV.filter((item) => item.roles.includes(user.role as Role));
  const isCollapsed = mounted && collapsed;

  return (
    <aside
      style={{ transition: animate ? "width 300ms cubic-bezier(0.4, 0, 0.2, 1)" : undefined }}
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 self-start overflow-hidden border-r bg-sidebar md:flex md:flex-col",
        isCollapsed ? "w-16" : "w-56"
      )}
    >
      <div
        className={cn(
          "flex h-14 items-center border-b px-3",
          isCollapsed ? "justify-end" : "justify-between"
        )}
      >
        {!isCollapsed && (
          <Link
            href="/dashboard"
            className="whitespace-nowrap px-1 text-lg font-bold tracking-tight"
          >
            Smart<span className="text-primary">POS</span>
          </Link>
        )}
        <Hint label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"} side="right">
          <button
            type="button"
            onClick={toggle}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </Hint>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          // Constant padding + gap and a nowrap label that simply clips while the
          // width animates — so the icon never moves and rows never reflow.
          const link = (
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-3 overflow-hidden whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-[image:linear-gradient(to_right,#000000_0%,#27496d_100%)] text-white shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="min-w-0">{item.label}</span>
            </Link>
          );
          return isCollapsed ? (
            <Hint key={item.href} label={item.label} side="right">
              {link}
            </Hint>
          ) : (
            <div key={item.href}>{link}</div>
          );
        })}
      </nav>
    </aside>
  );
}
