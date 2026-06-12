import { InventoryType } from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import * as inventoryService from "../services/inventory.service";
import { parsePagination } from "../utils/pagination";
import { list, ok } from "../utils/response";

const adjustSchema = z.object({
  quantity: z.number().int(),
  note: z.string().max(500).optional(),
});

const restockSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
        note: z.string().max(500).optional(),
      })
    )
    .min(1),
});

const biz = (req: Request) => req.user!.businessId!;

export async function listInventory(req: Request, res: Response) {
  const { items, meta } = await inventoryService.listInventory(
    biz(req),
    req.params.branchId,
    parsePagination(req)
  );
  list(res, items, meta);
}

export async function getLowStock(req: Request, res: Response) {
  ok(res, await inventoryService.getLowStock(biz(req), req.params.branchId));
}

export async function getInventoryItem(req: Request, res: Response) {
  ok(res, await inventoryService.getInventoryItem(biz(req), req.params.branchId, req.params.productId));
}

export async function adjustStock(req: Request, res: Response) {
  const { quantity, note } = adjustSchema.parse(req.body);
  ok(
    res,
    await inventoryService.adjustStock(biz(req), req.params.branchId, req.params.productId, quantity, note, req.user!.id),
    "Stock adjusted"
  );
}

export async function restock(req: Request, res: Response) {
  const { items } = restockSchema.parse(req.body);
  ok(res, await inventoryService.restock(biz(req), req.params.branchId, items, req.user!.id), "Restocked");
}

export async function listLogs(req: Request, res: Response) {
  const opts = {
    ...parsePagination(req),
    branchId: typeof req.query.branchId === "string" ? req.query.branchId : undefined,
    productId: typeof req.query.productId === "string" ? req.query.productId : undefined,
    type:
      typeof req.query.type === "string" && Object.values(InventoryType).includes(req.query.type as InventoryType)
        ? (req.query.type as InventoryType)
        : undefined,
  };
  const { logs, meta } = await inventoryService.listLogs(biz(req), opts);
  list(res, logs, meta);
}
