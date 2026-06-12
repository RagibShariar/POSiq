import { Request, Response } from "express";
import { z } from "zod";
import * as branchService from "../services/branch.service";
import { list, ok } from "../utils/response";
import { parsePagination } from "../utils/pagination";

const createBranchSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20).regex(/^[A-Za-z0-9-]+$/, "Code may only contain letters, numbers and dashes"),
  address: z.string().max(255).optional(),
  phone: z.string().max(20).optional(),
});

const updateBranchSchema = createBranchSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const assignStaffSchema = z.object({
  userId: z.string().uuid(),
});

function businessId(req: Request): string {
  return req.user!.businessId!;
}

export async function listBranches(req: Request, res: Response) {
  const { branches, meta } = await branchService.listBranches(businessId(req), parsePagination(req));
  list(res, branches, meta);
}

export async function getBranch(req: Request, res: Response) {
  ok(res, await branchService.getBranch(businessId(req), req.params.id));
}

export async function createBranch(req: Request, res: Response) {
  const input = createBranchSchema.parse(req.body);
  ok(res, await branchService.createBranch(businessId(req), input), "Branch created", 201);
}

export async function updateBranch(req: Request, res: Response) {
  const input = updateBranchSchema.parse(req.body);
  ok(res, await branchService.updateBranch(businessId(req), req.params.id, input), "Branch updated");
}

export async function deleteBranch(req: Request, res: Response) {
  await branchService.deleteBranch(businessId(req), req.params.id);
  ok(res, null, "Branch deleted");
}

export async function listStaff(req: Request, res: Response) {
  ok(res, await branchService.listStaff(businessId(req), req.params.id));
}

export async function assignStaff(req: Request, res: Response) {
  const { userId } = assignStaffSchema.parse(req.body);
  await branchService.assignStaff(businessId(req), req.params.id, userId);
  ok(res, null, "Staff assigned to branch");
}

export async function unassignStaff(req: Request, res: Response) {
  await branchService.unassignStaff(businessId(req), req.params.id, req.params.userId);
  ok(res, null, "Staff removed from branch");
}
