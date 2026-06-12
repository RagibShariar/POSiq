import { InventoryType, PaymentMethod } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { buildMeta, ListMeta } from "../utils/response";

interface OrderItem {
  productId: string;
  quantity: number;
  discount?: number;
}

interface CreateOrderInput {
  branchId: string;
  registerId?: string;
  items: OrderItem[];
  paymentMethod: PaymentMethod;
  paymentRef?: string;
  discountAmount?: number;
  taxAmount?: number;
  notes?: string;
}

interface ListOptions {
  page: number;
  limit: number;
  branchId?: string;
  from?: string;
  to?: string;
  status?: string;
}

const orderSelect = {
  id: true,
  orderNumber: true,
  branchId: true,
  cashierId: true,
  subtotal: true,
  discountAmount: true,
  taxAmount: true,
  totalAmount: true,
  paymentMethod: true,
  paymentRef: true,
  status: true,
  notes: true,
  createdAt: true,
  cashier: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true, code: true } },
  items: {
    select: {
      id: true,
      productId: true,
      productName: true,
      unitPrice: true,
      quantity: true,
      discount: true,
      subtotal: true,
    },
  },
} as const;

async function generateOrderNumber(businessId: string): Promise<string> {
  const count = await prisma.order.count({ where: { businessId } });
  const year = new Date().getFullYear();
  const seq = String(count + 1).padStart(5, "0");
  return `ORD-${year}-${seq}`;
}

export async function createOrder(
  businessId: string,
  cashierId: string,
  input: CreateOrderInput
) {
  // Validate branch belongs to this business
  const branch = await prisma.branch.findFirst({
    where: { id: input.branchId, businessId, deletedAt: null, isActive: true },
  });
  if (!branch) throw ApiError.notFound("Branch not found");

  if (input.registerId) {
    const reg = await prisma.cashRegister.findFirst({
      where: { id: input.registerId, branchId: input.branchId, status: "OPEN" },
    });
    if (!reg) throw ApiError.badRequest("INVALID_REGISTER", "Register not found or not open");
  }

  if (input.items.length === 0) {
    throw ApiError.badRequest("EMPTY_ORDER", "Order must have at least one item");
  }

  const productIds = input.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, businessId, deletedAt: null, isActive: true },
    select: { id: true, name: true, price: true },
  });

  if (products.length !== productIds.length) {
    throw ApiError.badRequest("INVALID_PRODUCTS", "One or more products not found or inactive");
  }

  const productMap = new Map(products.map((p) => [p.id, p]));

  // Check stock
  const inventories = await prisma.inventory.findMany({
    where: {
      branchId: input.branchId,
      productId: { in: productIds },
    },
    select: { productId: true, stock: true },
  });
  const stockMap = new Map(inventories.map((inv) => [inv.productId, inv.stock]));

  for (const item of input.items) {
    const stock = stockMap.get(item.productId) ?? 0;
    if (stock < item.quantity) {
      const product = productMap.get(item.productId)!;
      throw ApiError.badRequest(
        "INSUFFICIENT_STOCK",
        `Insufficient stock for "${product.name}": ${stock} available, ${item.quantity} requested`
      );
    }
  }

  // Build line items
  const lineItems = input.items.map((item) => {
    const product = productMap.get(item.productId)!;
    const unitPrice = Number(product.price);
    const discount = item.discount ?? 0;
    const subtotal = unitPrice * item.quantity - discount;
    return {
      productId: item.productId,
      productName: product.name,
      unitPrice,
      quantity: item.quantity,
      discount,
      subtotal,
    };
  });

  const subtotal = lineItems.reduce((s, li) => s + li.subtotal, 0);
  const discountAmount = input.discountAmount ?? 0;
  const taxAmount = input.taxAmount ?? 0;
  const totalAmount = subtotal - discountAmount + taxAmount;

  const orderNumber = await generateOrderNumber(businessId);

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        businessId,
        branchId: input.branchId,
        registerId: input.registerId,
        cashierId,
        orderNumber,
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        paymentMethod: input.paymentMethod,
        paymentRef: input.paymentRef,
        notes: input.notes,
        items: { create: lineItems },
      },
      select: orderSelect,
    });

    // Decrement stock and log
    for (const item of input.items) {
      const inv = await tx.inventory.update({
        where: { branchId_productId: { branchId: input.branchId, productId: item.productId } },
        data: { stock: { decrement: item.quantity } },
      });
      await tx.inventoryLog.create({
        data: {
          inventoryId: inv.id,
          branchId: input.branchId,
          productId: item.productId,
          type: InventoryType.SALE,
          quantity: -item.quantity,
          note: `Order ${orderNumber}`,
          createdBy: cashierId,
        },
      });
    }

    return created;
  });

  return order;
}

export async function listOrders(
  businessId: string,
  opts: ListOptions
): Promise<{ orders: unknown[]; meta: ListMeta }> {
  const where = {
    businessId,
    ...(opts.branchId ? { branchId: opts.branchId } : {}),
    ...(opts.status ? { status: opts.status as never } : {}),
    ...(opts.from || opts.to
      ? {
          createdAt: {
            ...(opts.from ? { gte: new Date(opts.from) } : {}),
            ...(opts.to ? { lte: new Date(opts.to + "T23:59:59Z") } : {}),
          },
        }
      : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: orderSelect,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, meta: buildMeta(total, opts.page, opts.limit) };
}

export async function getOrder(businessId: string, id: string) {
  const order = await prisma.order.findFirst({
    where: { id, businessId },
    select: { ...orderSelect, refunds: true },
  });
  if (!order) throw ApiError.notFound("Order not found");
  return order;
}

export async function voidOrder(businessId: string, id: string, performedBy: string) {
  const order = await prisma.order.findFirst({ where: { id, businessId } });
  if (!order) throw ApiError.notFound("Order not found");
  if (order.status !== "COMPLETED") {
    throw ApiError.badRequest("INVALID_STATUS", "Only completed orders can be voided");
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id }, data: { status: "VOIDED" } });

    // Restore stock
    const items = await tx.orderItem.findMany({ where: { orderId: id } });
    for (const item of items) {
      const inv = await tx.inventory.update({
        where: { branchId_productId: { branchId: order.branchId, productId: item.productId } },
        data: { stock: { increment: item.quantity } },
      });
      await tx.inventoryLog.create({
        data: {
          inventoryId: inv.id,
          branchId: order.branchId,
          productId: item.productId,
          type: InventoryType.ADJUSTMENT,
          quantity: item.quantity,
          note: `Void of order ${order.orderNumber}`,
          createdBy: performedBy,
        },
      });
    }
  });
}

export async function refundOrder(
  businessId: string,
  orderId: string,
  input: { amount: number; reason?: string; method: PaymentMethod; processedBy: string }
) {
  const order = await prisma.order.findFirst({ where: { id: orderId, businessId } });
  if (!order) throw ApiError.notFound("Order not found");
  if (order.status === "VOIDED") {
    throw ApiError.badRequest("ALREADY_VOIDED", "Cannot refund a voided order");
  }

  const existingRefunds = await prisma.refund.findMany({ where: { orderId } });
  const alreadyRefunded = existingRefunds.reduce((s, r) => s + Number(r.amount), 0);
  const refundable = Number(order.totalAmount) - alreadyRefunded;

  if (input.amount > refundable) {
    throw ApiError.badRequest(
      "REFUND_EXCEEDS_TOTAL",
      `Cannot refund ${input.amount}. Only ${refundable.toFixed(2)} is refundable.`
    );
  }

  const isFullRefund = input.amount >= refundable;

  await prisma.$transaction([
    prisma.refund.create({
      data: {
        orderId,
        branchId: order.branchId,
        processedBy: input.processedBy,
        amount: input.amount,
        reason: input.reason,
        method: input.method,
      },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: { status: isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED" },
    }),
  ]);

  return { refunded: input.amount, remaining: refundable - input.amount };
}

export async function listRefunds(
  businessId: string,
  opts: ListOptions
): Promise<{ refunds: unknown[]; meta: ListMeta }> {
  const where = {
    order: {
      businessId,
      ...(opts.branchId ? { branchId: opts.branchId } : {}),
    },
    ...(opts.from || opts.to
      ? {
          createdAt: {
            ...(opts.from ? { gte: new Date(opts.from) } : {}),
            ...(opts.to ? { lte: new Date(opts.to + "T23:59:59Z") } : {}),
          },
        }
      : {}),
  };

  const [refunds, total] = await Promise.all([
    prisma.refund.findMany({
      where,
      include: { order: { select: { orderNumber: true, totalAmount: true } } },
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
    prisma.refund.count({ where }),
  ]);

  return { refunds, meta: buildMeta(total, opts.page, opts.limit) };
}

// ─── RECEIPT ─────────────────────────────────────────
export async function getReceipt(businessId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, businessId },
    include: {
      items: true,
      cashier: { select: { name: true } },
      branch: { select: { name: true, address: true, phone: true } },
    },
  });
  if (!order) throw ApiError.notFound("Order not found");

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true, phone: true, address: true, currency: true },
  });

  return { business, order };
}
