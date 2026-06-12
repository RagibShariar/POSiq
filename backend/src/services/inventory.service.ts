import { InventoryType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { buildMeta, ListMeta } from "../utils/response";

interface ListOptions {
  page: number;
  limit: number;
  search?: string;
}

const inventorySelect = {
  id: true,
  stock: true,
  updatedAt: true,
  product: {
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      unit: true,
      lowStockThreshold: true,
      price: true,
      category: { select: { id: true, name: true } },
    },
  },
} as const;

async function assertBranchOwnership(businessId: string, branchId: string) {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, businessId, deletedAt: null },
  });
  if (!branch) throw ApiError.notFound("Branch not found");
  return branch;
}

export async function listInventory(
  businessId: string,
  branchId: string,
  opts: ListOptions
): Promise<{ items: unknown[]; meta: ListMeta }> {
  await assertBranchOwnership(businessId, branchId);

  const where = {
    branchId,
    businessId,
    product: {
      deletedAt: null,
      ...(opts.search
        ? {
            OR: [
              { name: { contains: opts.search, mode: "insensitive" as const } },
              { sku: { contains: opts.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
  };

  const [items, total] = await Promise.all([
    prisma.inventory.findMany({
      where,
      select: inventorySelect,
      orderBy: { product: { name: "asc" } },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
    prisma.inventory.count({ where }),
  ]);

  return { items, meta: buildMeta(total, opts.page, opts.limit) };
}

export async function getLowStock(businessId: string, branchId: string) {
  await assertBranchOwnership(businessId, branchId);

  const items = await prisma.inventory.findMany({
    where: { branchId, businessId, product: { deletedAt: null, isActive: true } },
    select: inventorySelect,
  });

  return items.filter(
    (inv) =>
      inv.stock < (inv.product as { lowStockThreshold: number }).lowStockThreshold
  );
}

export async function getInventoryItem(businessId: string, branchId: string, productId: string) {
  await assertBranchOwnership(businessId, branchId);

  const inv = await prisma.inventory.findUnique({
    where: { branchId_productId: { branchId, productId } },
    select: inventorySelect,
  });
  if (!inv) throw ApiError.notFound("Inventory record not found");
  return inv;
}

export async function adjustStock(
  businessId: string,
  branchId: string,
  productId: string,
  quantity: number,
  note: string | undefined,
  performedBy: string
) {
  await assertBranchOwnership(businessId, branchId);

  const product = await prisma.product.findFirst({
    where: { id: productId, businessId, deletedAt: null },
  });
  if (!product) throw ApiError.notFound("Product not found");

  // Upsert inventory record then log
  const inv = await prisma.inventory.upsert({
    where: { branchId_productId: { branchId, productId } },
    update: { stock: { increment: quantity }, businessId },
    create: { branchId, productId, businessId, stock: quantity },
    select: inventorySelect,
  });

  await prisma.inventoryLog.create({
    data: {
      inventoryId: inv.id,
      branchId,
      productId,
      type: "ADJUSTMENT",
      quantity,
      note,
      createdBy: performedBy,
    },
  });

  return inv;
}

export async function restock(
  businessId: string,
  branchId: string,
  items: { productId: string; quantity: number; note?: string }[],
  performedBy: string
) {
  await assertBranchOwnership(businessId, branchId);

  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, businessId, deletedAt: null },
    select: { id: true },
  });
  if (products.length !== productIds.length) {
    throw ApiError.badRequest("INVALID_PRODUCTS", "One or more products not found");
  }

  const results = await Promise.all(
    items.map(async (item) => {
      const inv = await prisma.inventory.upsert({
        where: { branchId_productId: { branchId, productId: item.productId } },
        update: { stock: { increment: item.quantity }, businessId },
        create: { branchId, productId: item.productId, businessId, stock: item.quantity },
        select: { id: true, stock: true, productId: true },
      });

      await prisma.inventoryLog.create({
        data: {
          inventoryId: inv.id,
          branchId,
          productId: item.productId,
          type: InventoryType.RESTOCK,
          quantity: item.quantity,
          note: item.note,
          createdBy: performedBy,
        },
      });

      return inv;
    })
  );

  return results;
}

export async function listLogs(
  businessId: string,
  opts: ListOptions & { branchId?: string; productId?: string; type?: InventoryType }
): Promise<{ logs: unknown[]; meta: ListMeta }> {
  const where = {
    inventory: { businessId },
    ...(opts.branchId ? { branchId: opts.branchId } : {}),
    ...(opts.productId ? { productId: opts.productId } : {}),
    ...(opts.type ? { type: opts.type } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.inventoryLog.findMany({
      where,
      include: {
        inventory: {
          select: {
            product: { select: { id: true, name: true, sku: true } },
            branch: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
    prisma.inventoryLog.count({ where }),
  ]);

  return { logs, meta: buildMeta(total, opts.page, opts.limit) };
}
