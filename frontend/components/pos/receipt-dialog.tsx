"use client";

import { Printer } from "lucide-react";
import { methodLabel } from "@/components/pos/payment-methods";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { OrderPayment } from "@/lib/types";

export interface CompletedOrder {
  orderNumber: string;
  createdAt: string;
  customerName?: string | null;
  customerPhone?: string | null;
  subtotal: string | number;
  discountAmount: string | number;
  taxAmount: string | number;
  totalAmount: string | number;
  paymentMethod: string;
  cashier?: { name: string };
  branch?: { name: string; code: string };
  items: {
    id: string;
    productName: string;
    variationName?: string | null;
    unitPrice: string | number;
    quantity: number;
    subtotal: string | number;
    specialNote?: string | null;
    modifiers?: { id: string; name: string; price: string | number; quantity: number }[];
  }[];
  payments?: OrderPayment[];
}

const money = (n: string | number) =>
  `৳${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export function ReceiptDialog({
  order,
  businessName,
  onClose,
}: {
  order: CompletedOrder | null;
  businessName: string;
  onClose: () => void;
}) {
  const totalChange =
    order?.payments?.reduce((s, p) => s + Number(p.changeGiven ?? 0), 0) ?? 0;

  return (
    <Dialog open={order !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm print:max-w-none print:border-0 print:shadow-none">
        <DialogHeader>
          <DialogTitle className="sr-only">Receipt</DialogTitle>
        </DialogHeader>
        {order && (
          <div id="receipt" className="font-mono text-sm">
            <div className="text-center">
              <div className="text-base font-bold">{businessName}</div>
              {order.branch && (
                <div className="text-xs text-muted-foreground">{order.branch.name}</div>
              )}
              <div className="mt-1 text-xs">
                {order.orderNumber} · {new Date(order.createdAt).toLocaleString()}
              </div>
              {order.cashier && (
                <div className="text-xs text-muted-foreground">Served by {order.cashier.name}</div>
              )}
              {(order.customerName || order.customerPhone) && (
                <div className="mt-1 text-xs">
                  Customer: {order.customerName ?? ""}
                  {order.customerPhone ? ` · ${order.customerPhone}` : ""}
                </div>
              )}
            </div>
            <hr className="my-3 border-dashed" />
            <table className="w-full text-xs">
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-0.5 pr-2">
                      {item.productName}
                      {item.variationName ? ` — ${item.variationName}` : ""}
                      <span className="text-muted-foreground"> ×{item.quantity}</span>
                      {item.modifiers && item.modifiers.length > 0 && (
                        <div className="pl-2 text-[10px] text-muted-foreground">
                          {item.modifiers
                            .map((m) => `+ ${m.name}${m.quantity > 1 ? ` ×${m.quantity}` : ""}`)
                            .join(", ")}
                        </div>
                      )}
                      {item.specialNote && (
                        <div className="pl-2 text-[10px] italic text-muted-foreground">
                          {item.specialNote}
                        </div>
                      )}
                    </td>
                    <td className="py-0.5 text-right align-top">{money(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <hr className="my-3 border-dashed" />
            <div className="space-y-0.5 text-xs">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{money(order.subtotal)}</span>
              </div>
              {Number(order.discountAmount) > 0 && (
                <div className="flex justify-between">
                  <span>Discount</span>
                  <span>-{money(order.discountAmount)}</span>
                </div>
              )}
              {Number(order.taxAmount) > 0 && (
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>{money(order.taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold">
                <span>Total</span>
                <span>{money(order.totalAmount)}</span>
              </div>
            </div>

            {order.payments && order.payments.length > 0 && (
              <>
                <hr className="my-3 border-dashed" />
                <div className="space-y-0.5 text-xs">
                  {order.payments.map((p, i) => (
                    <div key={p.id ?? i}>
                      <div className="flex justify-between">
                        <span>
                          {methodLabel(p.method)}
                          {p.reference ? ` (${p.reference})` : ""}
                        </span>
                        <span>{money(p.amount)}</span>
                      </div>
                      {p.tendered !== null && p.tendered !== undefined && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>&nbsp;&nbsp;Received {money(p.tendered)}</span>
                          <span>Change {money(p.changeGiven ?? 0)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {totalChange > 0 && (
                    <div className="flex justify-between pt-0.5 text-sm font-bold">
                      <span>CHANGE DUE</span>
                      <span>{money(totalChange)}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Thank you for your purchase!
            </p>
          </div>
        )}
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            New sale
          </Button>
          <Button className="flex-1" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" /> Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
