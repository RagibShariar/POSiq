import { Request, Response } from "express";
import { z } from "zod";
import * as authService from "../services/auth.service";
import { ok } from "../utils/response";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters");

const registerSchema = z.object({
  businessName: z.string().min(2).max(100),
  businessType: z.string().min(2).max(50), // retail, restaurant, salon, pharmacy...
  businessEmail: z.string().email(),
  phone: z.string().max(20).optional(),
  ownerName: z.string().min(2).max(100),
  ownerEmail: z.string().email(),
  password: passwordSchema,
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: passwordSchema,
});

export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);
  const result = await authService.register(input);
  ok(res, result, "Business registered successfully", 201);
}

export async function login(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);
  const result = await authService.login(email, password);
  ok(res, result, "Logged in");
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = refreshSchema.parse(req.body);
  const tokens = await authService.refresh(refreshToken);
  ok(res, tokens);
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.body?.refreshToken);
  ok(res, null, "Logged out");
}

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  await authService.changePassword(req.user!.id, currentPassword, newPassword);
  ok(res, null, "Password changed — please log in again");
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = forgotPasswordSchema.parse(req.body);
  await authService.forgotPassword(email);
  ok(res, null, "If that email is registered, a reset link has been sent");
}

export async function resetPassword(req: Request, res: Response) {
  const { token, newPassword } = resetPasswordSchema.parse(req.body);
  await authService.resetPassword(token, newPassword);
  ok(res, null, "Password reset — please log in");
}
