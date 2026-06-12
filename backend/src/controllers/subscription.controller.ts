import { Request, Response } from "express";
import { z } from "zod";
import * as subscriptionService from "../services/subscription.service";
import { parsePagination } from "../utils/pagination";
import { list, ok } from "../utils/response";

const upgradeSchema = z.object({
  plan: z.enum(["FREE", "STARTER", "PRO", "ENTERPRISE"]),
});

const biz = (req: Request) => req.user!.businessId!;

export async function getSubscription(req: Request, res: Response) {
  ok(res, await subscriptionService.getSubscription(biz(req)));
}

export async function upgrade(req: Request, res: Response) {
  const { plan } = upgradeSchema.parse(req.body);
  ok(res, await subscriptionService.upgrade(biz(req), plan), `Plan changed to ${plan}`);
}

export async function cancel(req: Request, res: Response) {
  ok(res, await subscriptionService.cancel(biz(req)), "Subscription cancelled");
}

export async function listInvoices(req: Request, res: Response) {
  const { page, limit } = parsePagination(req);
  const { invoices, meta } = await subscriptionService.listInvoices(biz(req), { page, limit });
  list(res, invoices, meta);
}
