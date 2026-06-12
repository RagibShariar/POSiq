import { Request, Response } from "express";
import { z } from "zod";
import * as productService from "../services/product.service";
import { parsePagination } from "../utils/pagination";
import { list, ok } from "../utils/response";

const productSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().min(1).max(50),
  barcode: z.string().max(50).optional(),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().url().optional(),
  price: z.number().positive(),
  costPrice: z.number().min(0),
  unit: z.string().max(20).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  categoryId: z.string().uuid().optional(),
});

const bulkRowSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  barcode: z.string().optional(),
  price: z.number().positive(),
  costPrice: z.number().min(0),
  unit: z.string().optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  categoryName: z.string().optional(),
});

const biz = (req: Request) => req.user!.businessId!;

export async function listProducts(req: Request, res: Response) {
  const opts = {
    ...parsePagination(req),
    categoryId: typeof req.query.categoryId === "string" ? req.query.categoryId : undefined,
    branchId: typeof req.query.branchId === "string" ? req.query.branchId : undefined,
    lowStock: req.query.lowStock === "true",
  };
  const { products, meta } = await productService.listProducts(biz(req), opts);
  list(res, products, meta);
}

export async function getProduct(req: Request, res: Response) {
  ok(res, await productService.getProduct(biz(req), req.params.id));
}

export async function getProductByBarcode(req: Request, res: Response) {
  ok(res, await productService.getProductByBarcode(biz(req), req.params.code));
}

export async function createProduct(req: Request, res: Response) {
  const input = productSchema.parse(req.body);
  ok(res, await productService.createProduct(biz(req), input), "Product created", 201);
}

export async function updateProduct(req: Request, res: Response) {
  const input = productSchema.partial().extend({ isActive: z.boolean().optional() }).parse(req.body);
  ok(res, await productService.updateProduct(biz(req), req.params.id, input), "Product updated");
}

export async function deleteProduct(req: Request, res: Response) {
  await productService.deleteProduct(biz(req), req.params.id);
  ok(res, null, "Product deleted");
}

export async function bulkImport(req: Request, res: Response) {
  const rows = z.array(bulkRowSchema).min(1).max(500).parse(req.body);
  ok(res, await productService.bulkImport(biz(req), rows), "Bulk import complete");
}

export async function getLowStock(req: Request, res: Response) {
  const opts = {
    ...parsePagination(req),
    branchId: typeof req.query.branchId === "string" ? req.query.branchId : undefined,
    lowStock: true,
  };
  const { products, meta } = await productService.listProducts(biz(req), opts);
  list(res, products, meta);
}
