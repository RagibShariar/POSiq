import { Request, Response } from "express";
import { z } from "zod";
import * as registerService from "../services/register.service";
import { parsePagination } from "../utils/pagination";
import { ok } from "../utils/response";

const openSchema = z.object({ openingBalance: z.number().min(0) });
const closeSchema = z.object({ closingBalance: z.number().min(0) });

const biz = (req: Request) => req.user!.businessId!;

export async function getRegister(req: Request, res: Response) {
  ok(res, await registerService.getOpenRegister(biz(req), req.params.branchId));
}

export async function openRegister(req: Request, res: Response) {
  const { openingBalance } = openSchema.parse(req.body);
  ok(
    res,
    await registerService.openRegister(biz(req), req.params.branchId, req.user!.id, openingBalance),
    "Register opened",
    201
  );
}

export async function closeRegister(req: Request, res: Response) {
  const { closingBalance } = closeSchema.parse(req.body);
  ok(
    res,
    await registerService.closeRegister(biz(req), req.params.branchId, req.user!.id, closingBalance),
    "Register closed"
  );
}

export async function getHistory(req: Request, res: Response) {
  const { page, limit } = parsePagination(req);
  const { registers, meta } = await registerService.getHistory(biz(req), req.params.branchId, { page, limit });
  res.json({ success: true, data: registers, meta });
}
