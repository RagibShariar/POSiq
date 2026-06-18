"use client";

import { Calculator as CalculatorIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Op = "+" | "-" | "*" | "/";

function compute(a: number, op: Op, b: number): number {
  let r: number;
  switch (op) {
    case "+": r = a + b; break;
    case "-": r = a - b; break;
    case "*": r = a * b; break;
    case "/": r = b === 0 ? NaN : a / b; break;
  }
  // Trim floating-point noise.
  return Math.round((r + Number.EPSILON) * 1e10) / 1e10;
}

export function Calculator() {
  const [display, setDisplay] = useState("0");
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [overwrite, setOverwrite] = useState(true);

  const isError = display === "Error";

  function clearAll() {
    setDisplay("0");
    setAcc(null);
    setOp(null);
    setOverwrite(true);
  }

  function inputDigit(d: string) {
    if (isError) clearAll();
    setDisplay((cur) => (overwrite || cur === "0" ? d : cur + d));
    setOverwrite(false);
  }

  function inputDot() {
    if (isError) return clearAll();
    if (overwrite) {
      setDisplay("0.");
      setOverwrite(false);
    } else if (!display.includes(".")) {
      setDisplay(display + ".");
    }
  }

  function backspace() {
    if (isError) return clearAll();
    setDisplay((cur) => (cur.length > 1 ? cur.slice(0, -1) : "0"));
  }

  function percent() {
    if (isError) return;
    setDisplay(String(parseFloat(display) / 100));
    setOverwrite(true);
  }

  function toggleSign() {
    if (isError) return;
    setDisplay((cur) => (cur.startsWith("-") ? cur.slice(1) : cur === "0" ? cur : "-" + cur));
  }

  function chooseOp(next: Op) {
    if (isError) return;
    const value = parseFloat(display);
    if (acc === null) {
      setAcc(value);
    } else if (op && !overwrite) {
      const r = compute(acc, op, value);
      if (Number.isNaN(r)) return setDisplay("Error");
      setAcc(r);
      setDisplay(String(r));
    }
    setOp(next);
    setOverwrite(true);
  }

  function equals() {
    if (op === null || acc === null || isError) return;
    const r = compute(acc, op, parseFloat(display));
    setDisplay(Number.isNaN(r) ? "Error" : String(r));
    setAcc(null);
    setOp(null);
    setOverwrite(true);
  }

  const pad = "h-11 text-base font-semibold";
  const opCls = (o: Op) =>
    `${pad} ${op === o && overwrite ? "ring-2 ring-primary" : ""}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" title="Calculator" aria-label="Calculator">
          <CalculatorIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <div className="mb-2 flex h-14 items-center justify-end overflow-hidden rounded-lg bg-muted px-3 text-2xl font-bold tabular-nums">
          {display}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          <Button variant="secondary" className={pad} onClick={clearAll}>AC</Button>
          <Button variant="secondary" className={pad} onClick={backspace}>⌫</Button>
          <Button variant="secondary" className={pad} onClick={percent}>%</Button>
          <Button variant="outline" className={opCls("/")} onClick={() => chooseOp("/")}>÷</Button>

          {["7", "8", "9"].map((d) => (
            <Button key={d} variant="outline" className={pad} onClick={() => inputDigit(d)}>{d}</Button>
          ))}
          <Button variant="outline" className={opCls("*")} onClick={() => chooseOp("*")}>×</Button>

          {["4", "5", "6"].map((d) => (
            <Button key={d} variant="outline" className={pad} onClick={() => inputDigit(d)}>{d}</Button>
          ))}
          <Button variant="outline" className={opCls("-")} onClick={() => chooseOp("-")}>−</Button>

          {["1", "2", "3"].map((d) => (
            <Button key={d} variant="outline" className={pad} onClick={() => inputDigit(d)}>{d}</Button>
          ))}
          <Button variant="outline" className={opCls("+")} onClick={() => chooseOp("+")}>+</Button>

          <Button variant="outline" className={pad} onClick={toggleSign}>±</Button>
          <Button variant="outline" className={pad} onClick={() => inputDigit("0")}>0</Button>
          <Button variant="outline" className={pad} onClick={inputDot}>.</Button>
          <Button className={pad} onClick={equals}>=</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
