import { Request, Response } from "express";
import { z } from "zod";
import * as modifierService from "../services/modifier.service";
import { ok } from "../utils/response";

const biz = (req: Request) => req.user!.businessId!;

const groupSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["ADDON", "SIDE_ITEM", "COOKING_INSTRUCTION"]).optional(),
  minSelect: z.number().int().min(0).optional(),
  maxSelect: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});

const itemSchema = z.object({
  name: z.string().min(1).max(100),
  price: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function listGroups(req: Request, res: Response) {
  ok(res, await modifierService.listGroups(biz(req)));
}

export async function createGroup(req: Request, res: Response) {
  const input = groupSchema.parse(req.body);
  ok(res, await modifierService.createGroup(biz(req), input), "Modifier group created", 201);
}

export async function updateGroup(req: Request, res: Response) {
  const input = groupSchema.partial().parse(req.body);
  ok(res, await modifierService.updateGroup(biz(req), req.params.id, input), "Modifier group updated");
}

export async function deleteGroup(req: Request, res: Response) {
  await modifierService.deleteGroup(biz(req), req.params.id);
  ok(res, null, "Modifier group deleted");
}

export async function addItem(req: Request, res: Response) {
  const input = itemSchema.parse(req.body);
  ok(res, await modifierService.addItem(biz(req), req.params.id, input), "Modifier added", 201);
}

export async function updateItem(req: Request, res: Response) {
  const input = itemSchema.partial().parse(req.body);
  ok(res, await modifierService.updateItem(biz(req), req.params.id, req.params.itemId, input), "Modifier updated");
}

export async function deleteItem(req: Request, res: Response) {
  await modifierService.deleteItem(biz(req), req.params.id, req.params.itemId);
  ok(res, null, "Modifier deleted");
}
