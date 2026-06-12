import { Request, Response } from "express";
import { z } from "zod";
import * as userService from "../services/user.service";
import { list, ok } from "../utils/response";
import { parsePagination } from "../utils/pagination";

const inviteSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  role: z.enum(["MANAGER", "CASHIER"]),
  branchIds: z.array(z.string().uuid()).min(1, "Assign at least one branch"),
});

const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  role: z.enum(["MANAGER", "CASHIER"]).optional(),
  branchIds: z.array(z.string().uuid()).min(1).optional(),
});

const updateMeSchema = z.object({
  name: z.string().min(2).max(100),
});

function businessId(req: Request): string {
  return req.user!.businessId!;
}

export async function listUsers(req: Request, res: Response) {
  const opts = {
    ...parsePagination(req),
    branchId: typeof req.query.branchId === "string" ? req.query.branchId : undefined,
  };
  const { users, meta } = await userService.listUsers(businessId(req), opts);
  list(res, users, meta);
}

export async function getUser(req: Request, res: Response) {
  ok(res, await userService.getUser(businessId(req), req.params.id));
}

export async function inviteUser(req: Request, res: Response) {
  const input = inviteSchema.parse(req.body);
  ok(res, await userService.inviteUser(businessId(req), input), "Invitation sent", 201);
}

export async function updateUser(req: Request, res: Response) {
  const input = updateUserSchema.parse(req.body);
  ok(res, await userService.updateUser(businessId(req), req.params.id, req.user!.id, input), "User updated");
}

export async function deactivateUser(req: Request, res: Response) {
  await userService.deactivateUser(businessId(req), req.params.id, req.user!.id);
  ok(res, null, "User removed");
}

export async function reactivateUser(req: Request, res: Response) {
  ok(res, await userService.reactivateUser(businessId(req), req.params.id), "User reactivated");
}

export async function getMe(req: Request, res: Response) {
  ok(res, await userService.getMe(req.user!.id));
}

export async function updateMe(req: Request, res: Response) {
  const input = updateMeSchema.parse(req.body);
  ok(res, await userService.updateMe(req.user!.id, input), "Profile updated");
}
