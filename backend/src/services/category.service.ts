import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { buildMeta, ListMeta } from "../utils/response";

interface ListOptions {
  page: number;
  limit: number;
  search?: string;
}

interface CategoryInput {
  name: string;
  description?: string;
}

const categorySelect = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  _count: { select: { products: true } },
} as const;

export async function listCategories(
  businessId: string,
  opts: ListOptions
): Promise<{ categories: unknown[]; meta: ListMeta }> {
  const where = {
    businessId,
    deletedAt: null,
    ...(opts.search
      ? { name: { contains: opts.search, mode: "insensitive" as const } }
      : {}),
  };

  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      where,
      select: categorySelect,
      orderBy: { name: "asc" },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
    prisma.category.count({ where }),
  ]);

  return { categories, meta: buildMeta(total, opts.page, opts.limit) };
}

export async function getCategory(businessId: string, id: string) {
  const category = await prisma.category.findFirst({
    where: { id, businessId, deletedAt: null },
    select: categorySelect,
  });
  if (!category) throw ApiError.notFound("Category not found");
  return category;
}

export async function createCategory(businessId: string, input: CategoryInput) {
  const exists = await prisma.category.findFirst({
    where: { businessId, name: { equals: input.name, mode: "insensitive" }, deletedAt: null },
  });
  if (exists) throw ApiError.conflict("CATEGORY_EXISTS", `Category "${input.name}" already exists`);

  return prisma.category.create({
    data: { businessId, ...input },
    select: categorySelect,
  });
}

export async function updateCategory(businessId: string, id: string, input: Partial<CategoryInput>) {
  await getCategory(businessId, id);

  if (input.name) {
    const exists = await prisma.category.findFirst({
      where: { businessId, name: { equals: input.name, mode: "insensitive" }, deletedAt: null, NOT: { id } },
    });
    if (exists) throw ApiError.conflict("CATEGORY_EXISTS", `Category "${input.name}" already exists`);
  }

  return prisma.category.update({
    where: { id },
    data: input,
    select: categorySelect,
  });
}

export async function deleteCategory(businessId: string, id: string) {
  await getCategory(businessId, id);

  const productCount = await prisma.product.count({
    where: { categoryId: id, deletedAt: null },
  });
  if (productCount > 0) {
    throw ApiError.badRequest(
      "CATEGORY_IN_USE",
      `Cannot delete: ${productCount} product(s) are in this category. Reassign them first.`
    );
  }

  await prisma.category.update({ where: { id }, data: { deletedAt: new Date() } });
}
