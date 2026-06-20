"use client";

import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Thin wrapper around the shadcn Tooltip so a trigger only needs a label.
// Use `asChild` (default) so the tooltip attaches to the child element
// (e.g. a Button) without adding an extra wrapper node.
export function Hint({
  label,
  children,
  side = "top",
  asChild = true,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  asChild?: boolean;
}) {
  if (!label) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild={asChild}>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
