import { Request, Response } from "express";
import { z } from "zod";
import * as categoryService from "../services/category.service";
import { parsePagination } from "../utils/pagination";
import { list, ok } from "../utils/response";

const categorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

const biz = (req: Request) => req.user!.businessId!;

export async function listCategories(req: Request, res: Response) {
  const { categories, meta } = await categoryService.listCategories(biz(req), parsePagination(req));
  list(res, categories, meta);
}

export async function getCategory(req: Request, res: Response) {
  ok(res, await categoryService.getCategory(biz(req), req.params.id));
}

export async function createCategory(req: Request, res: Response) {
  const input = categorySchema.parse(req.body);
  ok(res, await categoryService.createCategory(biz(req), input), "Category created", 201);
}

export async function updateCategory(req: Request, res: Response) {
  const input = categorySchema.partial().parse(req.body);
  ok(res, await categoryService.updateCategory(biz(req), req.params.id, input), "Category updated");
}

export async function deleteCategory(req: Request, res: Response) {
  await categoryService.deleteCategory(biz(req), req.params.id);
  ok(res, null, "Category deleted");
}
