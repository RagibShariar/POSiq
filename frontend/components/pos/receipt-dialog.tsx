"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface CompletedOrder {
  orderNumber: string;
  createdAt: string;
  subtotal: string | number;
  discountAmount: string | number;
  totalAmount: string | number;
  paymentMethod: string;
  cashier?: { name: string };
  branch?: { name: string; code: string };
  items: {
    id: string;
    productName: string;
    unitPrice: string | number;
    quantity: number;
    subtotal: string | number;
  }[];
}

const money = (n: string | number) => `৳${Number(n).toLocaleString()}`;

export function ReceiptDialog({
  order,
  businessName,
  onClose,
}: {
  order: CompletedOrder | null;
  businessName: string;
  onClose: () => void;
}) {
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
            </div>
            <hr className="my-3 border-dashed" />
            <table className="w-full text-xs">
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-0.5 pr-2">
                      {item.productName}
                      <span className="text-muted-foreground"> ×{item.quantity}</span>
                    </td>
                    <td className="py-0.5 text-right">{money(item.subtotal)}</td>
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
              <div className="flex justify-between text-sm font-bold">
                <span>Total</span>
                <span>{money(order.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Paid via</span>
                <span>{order.paymentMethod.replace("_", " ")}</span>
              </div>
            </div>
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
