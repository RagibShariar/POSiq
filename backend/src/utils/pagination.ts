import { Request } from "express";

export function parsePagination(req: Request) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const search = typeof req.query.search === "string" && req.query.search.trim()
    ? req.query.search.trim()
    : undefined;
  return { page, limit, search };
}
