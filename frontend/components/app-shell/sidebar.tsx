"use client";

import {
  BarChart3,
  Boxes,
  Building2,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  { href: "/pos", label: "POS", icon: ShoppingCart, roles: ["OWNER", "MANAGER", "CASHIER"] },
  { href: "/orders", label: "Orders", icon: Receipt, roles: ["OWNER", "MANAGER", "CASHIER"] },
  { href: "/products", label: "Products", icon: Package, roles: ["OWNER", "MANAGER"] },
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
  if (!user) return null;

  const items = NAV.filter((item) => item.roles.includes(user.role as Role));

  return (
    <aside className="hidden w-56 shrink-0 border-r bg-sidebar md:flex md:flex-col">
      <div className="flex h-14 items-center border-b px-5">
        <Link href="/dashboard" className="text-lg font-bold tracking-tight">
          Smart<span className="text-primary">POS</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
