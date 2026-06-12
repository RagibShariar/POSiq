import { Request, Response } from "express";
import { z } from "zod";
import * as aiService from "../services/ai.service";
import { parsePagination } from "../utils/pagination";
import { list, ok } from "../utils/response";

const querySchema = z.object({
  question: z.string().min(3).max(1000),
  branchId: z.string().uuid().optional(),
});

const biz = (req: Request) => req.user!.businessId!;

export async function query(req: Request, res: Response) {
  const { question, branchId } = querySchema.parse(req.body);
  ok(res, await aiService.query(biz(req), req.user!.id, question, branchId));
}

export async function getHistory(req: Request, res: Response) {
  const { page, limit } = parsePagination(req);
  const { history, meta } = await aiService.getHistory(biz(req), { page, limit });
  list(res, history, meta);
}

export async function clearHistory(req: Request, res: Response) {
  await aiService.clearHistory(biz(req));
  ok(res, null, "AI query history cleared");
}

export async function getUsage(req: Request, res: Response) {
  ok(res, await aiService.getUsage(biz(req)));
}
