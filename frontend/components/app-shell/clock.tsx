"use client";

import { CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

function parts(d: Date) {
  const h12 = d.getHours() % 12 || 12;
  const ampm = d.getHours() < 12 ? "AM" : "PM";
  return {
    date: `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
    time: `${h12}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${ampm}`,
  };
}

export function Clock() {
  // Set only after mount to avoid a server/client time mismatch.
  const [t, setT] = useState<{ date: string; time: string } | null>(null);

  useEffect(() => {
    const tick = () => setT(parts(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="hidden min-w-[15.5rem] items-center gap-2.5 rounded-xl border bg-muted/40 px-3.5 py-1.5 md:flex">
      <CalendarClock className="h-4 w-4 shrink-0 text-primary/70" />
      {t && (
        <>
          <span className="text-[15px] tracking-tight text-muted-foreground">{t.date}</span>
          <span className="h-4 w-px bg-border" />
          <span className="text-[15px] font-semibold tracking-tight tabular-nums text-foreground">
            {t.time}
          </span>
        </>
      )}
    </div>
  );
}
