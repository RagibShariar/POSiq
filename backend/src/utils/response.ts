import { Response } from "express";

export interface ListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function ok<T>(res: Response, data: T, message?: string, status = 200) {
  return res.status(status).json({ success: true, data, message });
}

export function created<T>(res: Response, data: T, message?: string) {
  return ok(res, data, message, 201);
}

export function list<T>(res: Response, data: T[], meta: ListMeta) {
  return res.status(200).json({ success: true, data, meta });
}

export function buildMeta(total: number, page: number, limit: number): ListMeta {
  return { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
