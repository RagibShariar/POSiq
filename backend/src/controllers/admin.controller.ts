import { Request, Response } from "express";
import { z } from "zod";
import * as adminService from "../services/admin.service";
import { parsePagination } from "../utils/pagination";
import { list, ok } from "../utils/response";

const updateBusinessSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  isActive: z.boolean().optional(),
});

export async function listBusinesses(req: Request, res: Response) {
  const opts = {
    ...parsePagination(req),
    plan: typeof req.query.plan === "string" ? req.query.plan : undefined,
    includeInactive: req.query.includeInactive === "true",
  };
  const { businesses, meta } = await adminService.listBusinesses(opts);
  list(res, businesses, meta);
}

export async function getBusiness(req: Request, res: Response) {
  ok(res, await adminService.getBusinessDetail(req.params.id));
}

export async function updateBusiness(req: Request, res: Response) {
  const input = updateBusinessSchema.parse(req.body);
  ok(res, await adminService.updateBusiness(req.params.id, input), "Business updated");
}

export async function suspendBusiness(req: Request, res: Response) {
  const suspend = req.query.undo !== "true";
  const result = await adminService.suspendBusiness(req.params.id, suspend);
  ok(res, result, suspend ? "Business suspended" : "Business reactivated");
}

export async function getStats(_req: Request, res: Response) {
  ok(res, await adminService.getStats());
}

export async function getAiUsage(req: Request, res: Response) {
  const { page, limit } = parsePagination(req);
  ok(res, await adminService.getAiUsage({ page, limit }));
}

export async function impersonate(req: Request, res: Response) {
  ok(res, await adminService.impersonate(req.params.id), "Impersonation token issued");
}
