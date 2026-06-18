"use client";

import { LogOut, ShoppingCart, UserRound } from "lucide-react";
import Link from "next/link";
import { BranchBadge } from "@/components/app-shell/branch-badge";
import { Calculator } from "@/components/app-shell/calculator";
import { Clock } from "@/components/app-shell/clock";
import { ThemeToggle } from "@/components/app-shell/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";

export function Topbar({ title }: { title?: string }) {
  const { user, logout } = useAuth();
  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4 md:px-6">
      <div className="flex items-center gap-3">
        <Clock />
        <BranchBadge />
        {title && <h1 className="text-base font-semibold">{title}</h1>}
      </div>
      <div className="flex items-center gap-2">
        <Button
          asChild
          title="Open POS"
          className="h-9 gap-1.5 px-4 text-sm font-semibold shadow-sm ring-2 ring-primary/30"
        >
          <Link href="/pos" target="_blank" rel="noopener noreferrer">
            <ShoppingCart className="h-[18px] w-[18px]" />
            POS
          </Link>
        </Button>
        <Calculator />
        <ThemeToggle />
        <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 px-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium sm:inline">{user.name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>
            <div className="text-sm font-medium">{user.name}</div>
            <div className="text-xs font-normal text-muted-foreground">{user.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            <UserRound className="mr-2 h-4 w-4" />
            {user.role.charAt(0) + user.role.slice(1).toLowerCase().replace("_", " ")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => logout()} variant="destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
