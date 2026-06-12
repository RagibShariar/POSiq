import { Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import * as reportService from "../services/report.service";
import { sendCsv } from "../utils/csv";
import { ok } from "../utils/response";

const biz = (req: Request) => req.user!.businessId!;

// ?from=YYYY-MM-DD&to=YYYY-MM-DD — defaults to the last 30 days.
function parseRange(req: Request) {
  const to = typeof req.query.to === "string" ? new Date(req.query.to + "T23:59:59.999Z") : new Date();
  const from =
    typeof req.query.from === "string"
      ? new Date(req.query.from + "T00:00:00Z")
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    throw ApiError.badRequest("INVALID_DATE", "Dates must be in YYYY-MM-DD format");
  }
  if (from > to) {
    throw ApiError.badRequest("INVALID_RANGE", "'from' must be before 'to'");
  }

  const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
  return { from, to, branchId };
}

const wantsCsv = (req: Request) => req.query.export === "csv";

export async function summary(req: Request, res: Response) {
  const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
  ok(res, await reportService.getSummary(biz(req), branchId));
}

export async function sales(req: Request, res: Response) {
  const report = await reportService.getSalesReport(biz(req), parseRange(req));
  if (wantsCsv(req)) return sendCsv(res, "sales-report", report.daily);
  ok(res, report);
}

export async function products(req: Request, res: Response) {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const report = await reportService.getProductReport(biz(req), parseRange(req), limit);
  if (wantsCsv(req)) return sendCsv(res, "product-report", report.topProducts);
  ok(res, report);
}

export async function cashiers(req: Request, res: Response) {
  const report = await reportService.getCashierReport(biz(req), parseRange(req));
  if (wantsCsv(req)) return sendCsv(res, "cashier-report", report as never);
  ok(res, report);
}

export async function inventory(req: Request, res: Response) {
  const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
  const report = await reportService.getInventoryReport(biz(req), branchId);
  if (wantsCsv(req)) return sendCsv(res, "inventory-report", report.branches as never);
  ok(res, report);
}

export async function branches(req: Request, res: Response) {
  const { from, to } = parseRange(req);
  const report = await reportService.getBranchReport(biz(req), { from, to });
  if (wantsCsv(req)) return sendCsv(res, "branch-report", report as never);
  ok(res, report);
}
