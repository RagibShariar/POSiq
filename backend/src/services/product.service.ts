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
  categoryIds?: string[];
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
  hasVariations: true,
  isActive: true,
  createdAt: true,
  categories: { select: { category: { select: { id: true, name: true } } } },
  modifierGroups: { select: { modifierGroupId: true } },
  variations: { where: { deletedAt: null }, select: { id: true } },
} as const;

// Flatten the join rows (`categories: [{ category: {...} }]`) into `categories: [{...}]`.
function mapProduct<T extends { categories?: { category: { id: string; name: string } }[] }>(
  product: T
): Omit<T, "categories"> & { categories: { id: string; name: string }[] } {
  return {
    ...product,
    categories: (product.categories ?? []).map((c) => c.category),
  };
}

// Full detail incl. variations and linked modifier groups + their items —
// used for the product edit screen and the POS item-config dialog.
const productDetailSelect = {
  ...productSelect,
  variations: {
    where: { deletedAt: null },
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      name: true,
      price: true,
      costPrice: true,
      isDefault: true,
      isActive: true,
      sortOrder: true,
    },
  },
  modifierGroups: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      isRequired: true,
      sortOrder: true,
      modifierGroup: {
        select: {
          id: true,
          name: true,
          type: true,
          minSelect: true,
          maxSelect: true,
          isActive: true,
          items: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" as const },
            select: { id: true, name: true, price: true },
          },
        },
      },
    },
  },
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
    ...(opts.categoryId ? { categories: { some: { categoryId: opts.categoryId } } } : {}),
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
      products: lowStockItems.map((inv) => mapProduct({ ...inv.product, stock: inv.stock })),
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

  return { products: products.map(mapProduct), meta: buildMeta(total, opts.page, opts.limit) };
}

export async function getProduct(businessId: string, id: string) {
  const product = await prisma.product.findFirst({
    where: { id, businessId, deletedAt: null },
    select: productDetailSelect,
  });
  if (!product) throw ApiError.notFound("Product not found");
  return mapProduct(product);
}

export async function getProductByBarcode(businessId: string, barcode: string) {
  const product = await prisma.product.findFirst({
    where: { barcode, businessId, deletedAt: null, isActive: true },
    select: productDetailSelect,
  });
  if (!product) throw ApiError.notFound("No product found for this barcode");
  return mapProduct(product);
}

async function assertSkuUnique(businessId: string, sku: string, excludeId?: string) {
  const existing = await prisma.product.findFirst({
    where: { businessId, sku, deletedAt: null, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
  });
  if (existing) throw ApiError.conflict("SKU_EXISTS", `SKU "${sku}" is already in use`);
}

// Validate that every id is a real, non-deleted category in this business.
async function assertCategoriesValid(businessId: string, categoryIds: string[]) {
  if (categoryIds.length === 0) return;
  const found = await prisma.category.count({
    where: { id: { in: categoryIds }, businessId, deletedAt: null },
  });
  if (found !== new Set(categoryIds).size) {
    throw ApiError.badRequest("INVALID_CATEGORY", "One or more categories not found");
  }
}

export async function createProduct(businessId: string, input: ProductInput) {
  await assertProductLimit(businessId);
  await assertSkuUnique(businessId, input.sku);

  const { categoryIds = [], ...data } = input;
  await assertCategoriesValid(businessId, categoryIds);

  const product = await prisma.product.create({
    data: {
      businessId,
      ...data,
      ...(categoryIds.length
        ? { categories: { create: categoryIds.map((categoryId) => ({ categoryId })) } }
        : {}),
    },
    select: productSelect,
  });
  return mapProduct(product);
}

export async function updateProduct(
  businessId: string,
  id: string,
  input: Partial<ProductInput> & { isActive?: boolean }
) {
  await assertProductExists(businessId, id);

  if (input.sku) await assertSkuUnique(businessId, input.sku, id);

  const { categoryIds, ...data } = input;
  if (categoryIds) await assertCategoriesValid(businessId, categoryIds);

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...data,
      ...(categoryIds
        ? {
            // Replace the full set of category links.
            categories: { deleteMany: {}, create: categoryIds.map((categoryId) => ({ categoryId })) },
          }
        : {}),
    },
    select: productSelect,
  });
  return mapProduct(product);
}

export async function deleteProduct(businessId: string, id: string) {
  await assertProductExists(businessId, id);
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
      const categoryId = row.categoryName ? catMap.get(row.categoryName.toLowerCase()) : undefined;
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
          ...(categoryId ? { categories: { create: [{ categoryId }] } } : {}),
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

// ─── VARIATIONS ──────────────────────────────────────
export interface VariationInput {
  name: string;
  price: number;
  costPrice?: number;
  isDefault?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

const variationSelect = {
  id: true,
  name: true,
  price: true,
  costPrice: true,
  isDefault: true,
  isActive: true,
  sortOrder: true,
} as const;

async function assertProductExists(businessId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, businessId, deletedAt: null },
    select: { id: true },
  });
  if (!product) throw ApiError.notFound("Product not found");
}

export async function listVariations(businessId: string, productId: string) {
  await assertProductExists(businessId, productId);
  return prisma.productVariation.findMany({
    where: { productId, businessId, deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: variationSelect,
  });
}

export async function createVariation(businessId: string, productId: string, input: VariationInput) {
  await assertProductExists(businessId, productId);
  const [variation] = await prisma.$transaction([
    prisma.productVariation.create({
      data: { businessId, productId, ...input },
      select: variationSelect,
    }),
    prisma.product.update({ where: { id: productId }, data: { hasVariations: true } }),
  ]);
  return variation;
}

export async function updateVariation(
  businessId: string,
  productId: string,
  variationId: string,
  input: Partial<VariationInput>
) {
  const existing = await prisma.productVariation.findFirst({
    where: { id: variationId, productId, businessId, deletedAt: null },
  });
  if (!existing) throw ApiError.notFound("Variation not found");
  return prisma.productVariation.update({
    where: { id: variationId },
    data: input,
    select: variationSelect,
  });
}

export async function deleteVariation(businessId: string, productId: string, variationId: string) {
  const existing = await prisma.productVariation.findFirst({
    where: { id: variationId, productId, businessId, deletedAt: null },
  });
  if (!existing) throw ApiError.notFound("Variation not found");
  await prisma.productVariation.update({
    where: { id: variationId },
    data: { deletedAt: new Date(), isActive: false },
  });

  // If no active variations remain, clear the flag on the product.
  const remaining = await prisma.productVariation.count({
    where: { productId, businessId, deletedAt: null },
  });
  if (remaining === 0) {
    await prisma.product.update({ where: { id: productId }, data: { hasVariations: false } });
  }
}

// ─── PRODUCT ↔ MODIFIER GROUP LINKS ──────────────────
export async function linkModifierGroup(
  businessId: string,
  productId: string,
  modifierGroupId: string,
  opts: { isRequired?: boolean; sortOrder?: number } = {}
) {
  await assertProductExists(businessId, productId);
  const group = await prisma.modifierGroup.findFirst({
    where: { id: modifierGroupId, businessId, deletedAt: null },
    select: { id: true },
  });
  if (!group) throw ApiError.notFound("Modifier group not found");

  return prisma.productModifierGroup.upsert({
    where: { productId_modifierGroupId: { productId, modifierGroupId } },
    create: {
      productId,
      modifierGroupId,
      isRequired: opts.isRequired ?? false,
      sortOrder: opts.sortOrder ?? 0,
    },
    update: {
      ...(opts.isRequired !== undefined ? { isRequired: opts.isRequired } : {}),
      ...(opts.sortOrder !== undefined ? { sortOrder: opts.sortOrder } : {}),
    },
  });
}

export async function unlinkModifierGroup(
  businessId: string,
  productId: string,
  modifierGroupId: string
) {
  await assertProductExists(businessId, productId);
  await prisma.productModifierGroup
    .delete({ where: { productId_modifierGroupId: { productId, modifierGroupId } } })
    .catch(() => {
      throw ApiError.notFound("Link not found");
    });
}
