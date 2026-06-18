import { ModifierGroupType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";

export interface ModifierGroupInput {
  name: string;
  type?: ModifierGroupType;
  minSelect?: number;
  maxSelect?: number;
  isActive?: boolean;
}

export interface ModifierItemInput {
  name: string;
  price?: number;
  isActive?: boolean;
  sortOrder?: number;
}

const groupSelect = {
  id: true,
  name: true,
  type: true,
  minSelect: true,
  maxSelect: true,
  isActive: true,
  createdAt: true,
  items: {
    orderBy: { sortOrder: "asc" as const },
    select: { id: true, name: true, price: true, isActive: true, sortOrder: true },
  },
  _count: { select: { productLinks: true } },
} as const;

export async function listGroups(businessId: string) {
  return prisma.modifierGroup.findMany({
    where: { businessId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: groupSelect,
  });
}

export async function createGroup(businessId: string, input: ModifierGroupInput) {
  return prisma.modifierGroup.create({
    data: { businessId, ...input },
    select: groupSelect,
  });
}

async function assertGroup(businessId: string, groupId: string) {
  const group = await prisma.modifierGroup.findFirst({
    where: { id: groupId, businessId, deletedAt: null },
    select: { id: true },
  });
  if (!group) throw ApiError.notFound("Modifier group not found");
}

export async function updateGroup(businessId: string, id: string, input: Partial<ModifierGroupInput>) {
  await assertGroup(businessId, id);
  return prisma.modifierGroup.update({ where: { id }, data: input, select: groupSelect });
}

export async function deleteGroup(businessId: string, id: string) {
  await assertGroup(businessId, id);
  await prisma.$transaction([
    // Detach from products so it disappears from the POS immediately.
    prisma.productModifierGroup.deleteMany({ where: { modifierGroupId: id } }),
    prisma.modifierGroup.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    }),
  ]);
}

// ─── ITEMS ───────────────────────────────────────────
export async function addItem(businessId: string, groupId: string, input: ModifierItemInput) {
  await assertGroup(businessId, groupId);
  return prisma.modifierItem.create({
    data: { businessId, groupId, ...input },
    select: { id: true, name: true, price: true, isActive: true, sortOrder: true },
  });
}

export async function updateItem(
  businessId: string,
  groupId: string,
  itemId: string,
  input: Partial<ModifierItemInput>
) {
  const item = await prisma.modifierItem.findFirst({
    where: { id: itemId, groupId, businessId },
    select: { id: true },
  });
  if (!item) throw ApiError.notFound("Modifier item not found");
  return prisma.modifierItem.update({
    where: { id: itemId },
    data: input,
    select: { id: true, name: true, price: true, isActive: true, sortOrder: true },
  });
}

export async function deleteItem(businessId: string, groupId: string, itemId: string) {
  const item = await prisma.modifierItem.findFirst({
    where: { id: itemId, groupId, businessId },
    select: { id: true },
  });
  if (!item) throw ApiError.notFound("Modifier item not found");
  await prisma.modifierItem.delete({ where: { id: itemId } });
}
