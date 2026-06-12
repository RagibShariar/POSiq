import { PLAN_LIMITS } from "../config/plans";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { buildMeta, ListMeta } from "../utils/response";

interface ListOptions {
  page: number;
  limit: number;
  search?: string;
  categoryId?: string;
  lowStock?: boolean;
  branchId?: string;
}

interface ProductInput {
  name: string;
  sku: string;
  barcode?: string;
  description?: string;
  imageUrl?: string;
  price: number;
  costPrice: number;
  unit?: string;
  lowStockThreshold?: number;
  categoryId?: string;
}

const productSelect = {
  id: true,
  name: true,
  sku: true,
  barcode: true,
  description: true,
  imageUrl: true,
  price: true,
  costPrice: true,
  unit: true,
  lowStockThreshold: true,
  isActive: true,
  createdAt: true,
  category: { select: { id: true, name: true } },
} as const;

async function assertProductLimit(businessId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { businessId } });
  const plan = subscription?.plan ?? "FREE";
  const limit = PLAN_LIMITS[plan].products;
  if (limit === Infinity) return;

  const count = await prisma.product.count({ where: { businessId, deletedAt: null } });
  if (count >= limit) {
    throw ApiError.forbidden(
      `Your ${plan} plan allows ${limit} products. Upgrade to add more.`
    );
  }
}

export async function listProducts(
  businessId: string,
  opts: ListOptions
): Promise<{ products: unknown[]; meta: ListMeta }> {
  const baseWhere = {
    businessId,
    deletedAt: null,
    ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
    ...(opts.search
      ? {
          OR: [
            { name: { contains: opts.search, mode: "insensitive" as const } },
            { sku: { contains: opts.search, mode: "insensitive" as const } },
            { barcode: { contains: opts.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  // Low-stock requires joining inventory for a specific branch
  if (opts.lowStock && opts.branchId) {
    const items = await prisma.inventory.findMany({
      where: { branchId: opts.branchId, product: { ...baseWhere } },
      include: { product: { select: productSelect } },
    });
    const lowStockItems = items.filter(
      (inv) => inv.stock < (inv.product as { lowStockThreshold: number }).lowStockThreshold
    );
    return {
      products: lowStockItems.map((inv) => ({ ...inv.product, stock: inv.stock })),
      meta: buildMeta(lowStockItems.length, 1, Math.max(lowStockItems.length, 1)),
    };
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: baseWhere,
      select: productSelect,
      orderBy: { name: "asc" },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
    prisma.product.count({ where: baseWhere }),
  ]);

  return { products, meta: buildMeta(total, opts.page, opts.limit) };
}

export async function getProduct(businessId: string, id: string) {
  const product = await prisma.product.findFirst({
    where: { id, businessId, deletedAt: null },
    select: productSelect,
  });
  if (!product) throw ApiError.notFound("Product not found");
  return product;
}

export async function getProductByBarcode(businessId: string, barcode: string) {
  const product = await prisma.product.findFirst({
    where: { barcode, businessId, deletedAt: null, isActive: true },
    select: productSelect,
  });
  if (!product) throw ApiError.notFound("No product found for this barcode");
  return product;
}

async function assertSkuUnique(businessId: string, sku: string, excludeId?: string) {
  const existing = await prisma.product.findFirst({
    where: { businessId, sku, deletedAt: null, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
  });
  if (existing) throw ApiError.conflict("SKU_EXISTS", `SKU "${sku}" is already in use`);
}

export async function createProduct(businessId: string, input: ProductInput) {
  await assertProductLimit(businessId);
  await assertSkuUnique(businessId, input.sku);

  if (input.categoryId) {
    const cat = await prisma.category.findFirst({ where: { id: input.categoryId, businessId, deletedAt: null } });
    if (!cat) throw ApiError.badRequest("INVALID_CATEGORY", "Category not found");
  }

  return prisma.product.create({
    data: { businessId, ...input },
    select: productSelect,
  });
}

export async function updateProduct(
  businessId: string,
  id: string,
  input: Partial<ProductInput> & { isActive?: boolean }
) {
  await getProduct(businessId, id);

  if (input.sku) await assertSkuUnique(businessId, input.sku, id);
  if (input.categoryId) {
    const cat = await prisma.category.findFirst({ where: { id: input.categoryId, businessId, deletedAt: null } });
    if (!cat) throw ApiError.badRequest("INVALID_CATEGORY", "Category not found");
  }

  return prisma.product.update({ where: { id }, data: input, select: productSelect });
}

export async function deleteProduct(businessId: string, id: string) {
  await getProduct(businessId, id);
  await prisma.product.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
}

// ─── BULK IMPORT ─────────────────────────────────────
export interface BulkRow {
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  costPrice: number;
  unit?: string;
  lowStockThreshold?: number;
  categoryName?: string;
}

export async function bulkImport(businessId: string, rows: BulkRow[]) {
  await assertProductLimit(businessId);

  const results = { created: 0, skipped: 0, errors: [] as { row: number; sku: string; reason: string }[] };

  // Pre-resolve category names to IDs
  const categoryNames = [...new Set(rows.map((r) => r.categoryName).filter(Boolean))] as string[];
  const categories = await prisma.category.findMany({
    where: { businessId, name: { in: categoryNames }, deletedAt: null },
    select: { id: true, name: true },
  });
  const catMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

  // Existing SKUs to skip duplicates
  const existingSkus = new Set(
    (await prisma.product.findMany({ where: { businessId, deletedAt: null }, select: { sku: true } })).map(
      (p) => p.sku
    )
  );

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (existingSkus.has(row.sku)) {
      results.skipped++;
      continue;
    }
    try {
      await prisma.product.create({
        data: {
          businessId,
          name: row.name,
          sku: row.sku,
          barcode: row.barcode,
          price: row.price,
          costPrice: row.costPrice,
          unit: row.unit ?? "pcs",
          lowStockThreshold: row.lowStockThreshold ?? 10,
          categoryId: row.categoryName ? catMap.get(row.categoryName.toLowerCase()) : undefined,
        },
      });
      existingSkus.add(row.sku);
      results.created++;
    } catch (e) {
      results.errors.push({ row: i + 1, sku: row.sku, reason: String(e) });
    }
  }

  return results;
}
