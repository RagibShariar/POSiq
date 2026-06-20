import { OrderPlatform, PaymentMethod } from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import * as orderService from "../services/order.service";
import { parsePagination } from "../utils/pagination";
import { list, ok } from "../utils/response";

const paymentMethods = Object.values(PaymentMethod) as [string, ...string[]];

const createOrderSchema = z.object({
  branchId: z.string().uuid(),
  registerId: z.string().uuid().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
        discount: z.number().min(0).optional(),
        variationId: z.string().uuid().optional(),
        modifiers: z
          .array(
            z.object({
              modifierItemId: z.string().uuid(),
              quantity: z.number().int().positive().optional(),
            })
          )
          .optional(),
        specialNote: z.string().max(300).optional(),
      })
    )
    .min(1),
  payments: z
    .array(
      z.object({
        method: z.enum(paymentMethods as [PaymentMethod, ...PaymentMethod[]]),
        amount: z.number().positive(),
        reference: z.string().max(100).optional(),
        tendered: z.number().min(0).optional(),
      })
    )
    .min(1)
    .max(4),
  customerName: z.string().max(100).optional(),
  customerPhone: z.string().max(20).optional(),
  platform: z.nativeEnum(OrderPlatform).optional(),
  platformOrderId: z.string().max(100).optional(),
  discountAmount: z.number().min(0).optional(),
  taxAmount: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
});

const refundSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().max(500).optional(),
  method: z.enum(paymentMethods as [PaymentMethod, ...PaymentMethod[]]),
});

const biz = (req: Request) => req.user!.businessId!;

export async function createOrder(req: Request, res: Response) {
  const input = createOrderSchema.parse(req.body);
  ok(res, await orderService.createOrder(biz(req), req.user!.id, input), "Order created", 201);
}

export async function listOrders(req: Request, res: Response) {
  const opts = {
    ...parsePagination(req),
    branchId: typeof req.query.branchId === "string" ? req.query.branchId : undefined,
    from: typeof req.query.from === "string" ? req.query.from : undefined,
    to: typeof req.query.to === "string" ? req.query.to : undefined,
    status: typeof req.query.status === "string" ? req.query.status : undefined,
    platform: typeof req.query.platform === "string" ? req.query.platform : undefined,
  };
  const { orders, meta } = await orderService.listOrders(biz(req), opts);
  list(res, orders, meta);
}

export async function getOrder(req: Request, res: Response) {
  ok(res, await orderService.getOrder(biz(req), req.params.id));
}

export async function voidOrder(req: Request, res: Response) {
  await orderService.voidOrder(biz(req), req.params.id, req.user!.id);
  ok(res, null, "Order voided");
}

export async function getReceipt(req: Request, res: Response) {
  ok(res, await orderService.getReceipt(biz(req), req.params.id));
}

export async function refundOrder(req: Request, res: Response) {
  const input = refundSchema.parse(req.body);
  ok(
    res,
    await orderService.refundOrder(biz(req), req.params.id, { ...input, processedBy: req.user!.id }),
    "Refund processed"
  );
}

export async function listRefunds(req: Request, res: Response) {
  const opts = {
    ...parsePagination(req),
    branchId: typeof req.query.branchId === "string" ? req.query.branchId : undefined,
    from: typeof req.query.from === "string" ? req.query.from : undefined,
    to: typeof req.query.to === "string" ? req.query.to : undefined,
  };
  const { refunds, meta } = await orderService.listRefunds(biz(req), opts);
  list(res, refunds, meta);
}
