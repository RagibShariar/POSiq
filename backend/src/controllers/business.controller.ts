import { Request, Response } from "express";
import { z } from "zod";
import * as businessService from "../services/business.service";
import { ok } from "../utils/response";

const updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  type: z.string().min(2).max(50).optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(255).optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().max(50).optional(),
});

const logoSchema = z.object({
  logoUrl: z.string().url(),
});

const settingsSchema = z.record(z.string(), z.unknown());

const biz = (req: Request) => req.user!.businessId!;

export async function getBusiness(req: Request, res: Response) {
  ok(res, await businessService.getBusiness(biz(req)));
}

export async function updateBusiness(req: Request, res: Response) {
  const input = updateSchema.parse(req.body);
  ok(res, await businessService.updateBusiness(biz(req), input), "Business updated");
}

export async function setLogo(req: Request, res: Response) {
  const { logoUrl } = logoSchema.parse(req.body);
  ok(res, await businessService.setLogo(biz(req), logoUrl), "Logo updated");
}

export async function deleteBusiness(req: Request, res: Response) {
  await businessService.deleteBusiness(biz(req));
  ok(res, null, "Business deleted");
}

// ─── SETTINGS ────────────────────────────────────────
export async function getSettings(req: Request, res: Response) {
  ok(res, await businessService.getSettings(biz(req)));
}

export async function updateSettings(req: Request, res: Response) {
  const patch = settingsSchema.parse(req.body);
  ok(res, await businessService.updateSettings(biz(req), patch), "Settings updated");
}

export async function getReceiptSettings(req: Request, res: Response) {
  ok(res, await businessService.getReceiptSettings(biz(req)));
}

export async function updateReceiptSettings(req: Request, res: Response) {
  const patch = settingsSchema.parse(req.body);
  ok(res, await businessService.updateReceiptSettings(biz(req), patch), "Receipt settings updated");
}
