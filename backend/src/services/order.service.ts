import { InventoryType, OrderPlatform, PaymentMethod } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { buildMeta, ListMeta } from "../utils/response";

// Payment methods that require a transaction reference (proof).
const CARD_METHODS = new Set<PaymentMethod>(["CARD", "VISA", "AMEX", "MASTERCARD"]);
const MOBILE_METHODS = new Set<PaymentMethod>(["MOBILE_BANKING", "BKASH", "NAGAD", "ROCKET"]);

interface OrderItemModifierInput {
  modifierItemId: string;
  quantity?: number;
}

interface OrderItem {
  productId: string;
  quantity: number;
  discount?: number;
  variationId?: string;
  modifiers?: OrderItemModifierInput[];
  specialNote?: string;
}

export interface PaymentInput {
  method: PaymentMethod;
  amount: number;
  reference?: string; // card approval no. / mobile banking TrxID
  tendered?: number; // cash handed over (change = tendered - amount)
}

interface CreateOrderInput {
  branchId: string;
  registerId?: string;
  items: OrderItem[];
  payments: PaymentInput[];
  customerName?: string;
  customerPhone?: string;
  platform?: OrderPlatform;
  platformOrderId?: string;
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
  platform?: string;
}

const orderSelect = {
  id: true,
  orderNumber: true,
  branchId: true,
  cashierId: true,
  customerName: true,
  customerPhone: true,
  platform: true,
  platformOrderId: true,
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
      variationId: true,
      variationName: true,
      unitPrice: true,
      quantity: true,
      discount: true,
      subtotal: true,
      specialNote: true,
      modifiers: {
        select: { id: true, modifierItemId: true, name: true, price: true, quantity: true },
      },
    },
  },
  payments: {
    select: {
      id: true,
      method: true,
      amount: true,
      reference: true,
      tendered: true,
      changeGiven: true,
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

  // Resolve variations (price + name come from the chosen variant)
  const variationIds = [...new Set(input.items.map((i) => i.variationId).filter(Boolean))] as string[];
  const variations = variationIds.length
    ? await prisma.productVariation.findMany({
        where: { id: { in: variationIds }, businessId, deletedAt: null },
        select: { id: true, name: true, price: true, productId: true },
      })
    : [];
  const variationMap = new Map(variations.map((v) => [v.id, v]));

  // Resolve modifier items (each adds to the line price)
  const modifierItemIds = [
    ...new Set(input.items.flatMap((i) => (i.modifiers ?? []).map((m) => m.modifierItemId))),
  ];
  const modifierItems = modifierItemIds.length
    ? await prisma.modifierItem.findMany({
        where: { id: { in: modifierItemIds }, businessId },
        select: { id: true, name: true, price: true },
      })
    : [];
  const modifierMap = new Map(modifierItems.map((m) => [m.id, m]));

  // Build line items
  const lineItems = input.items.map((item) => {
    const product = productMap.get(item.productId)!;
    let unitPrice = Number(product.price);
    let variationName: string | undefined;

    if (item.variationId) {
      const v = variationMap.get(item.variationId);
      if (!v || v.productId !== item.productId) {
        throw ApiError.badRequest("INVALID_VARIATION", `Invalid variation for "${product.name}"`);
      }
      unitPrice = Number(v.price);
      variationName = v.name;
    }

    const modifiers = (item.modifiers ?? []).map((m) => {
      const mi = modifierMap.get(m.modifierItemId);
      if (!mi) throw ApiError.badRequest("INVALID_MODIFIER", "One or more modifiers not found");
      return {
        modifierItemId: mi.id,
        name: mi.name,
        price: Number(mi.price),
        quantity: m.quantity && m.quantity > 0 ? m.quantity : 1,
      };
    });
    const modifiersTotal = modifiers.reduce((s, m) => s + m.price * m.quantity, 0);

    const discount = item.discount ?? 0;
    const subtotal = (unitPrice + modifiersTotal) * item.quantity - discount;
    return {
      productId: item.productId,
      productName: product.name,
      variationId: item.variationId,
      variationName,
      unitPrice,
      quantity: item.quantity,
      discount,
      subtotal,
      specialNote: item.specialNote?.trim() || undefined,
      modifiers,
    };
  });

  const subtotal = lineItems.reduce((s, li) => s + li.subtotal, 0);
  const discountAmount = input.discountAmount ?? 0;
  const taxAmount = input.taxAmount ?? 0;
  const totalAmount = subtotal - discountAmount + taxAmount;

  // ── Validate payments ─────────────────────────────
  if (input.payments.length === 0) {
    throw ApiError.badRequest("NO_PAYMENT", "At least one payment is required");
  }
  const paid = input.payments.reduce((s, p) => s + p.amount, 0);
  if (Math.abs(paid - totalAmount) > 0.01) {
    throw ApiError.badRequest(
      "PAYMENT_MISMATCH",
      `Payments (${paid.toFixed(2)}) must equal the order total (${totalAmount.toFixed(2)})`
    );
  }
  const paymentRows = input.payments.map((p) => {
    if (p.method === "CASH") {
      if (p.tendered !== undefined && p.tendered < p.amount) {
        throw ApiError.badRequest(
          "INSUFFICIENT_CASH",
          `Cash received (${p.tendered}) is less than the amount due (${p.amount})`
        );
      }
      return {
        method: p.method,
        amount: p.amount,
        tendered: p.tendered,
        changeGiven: p.tendered !== undefined ? Number((p.tendered - p.amount).toFixed(2)) : undefined,
      };
    }
    // Card networks and mobile-banking tenders need proof of the transaction.
    if (CARD_METHODS.has(p.method) || MOBILE_METHODS.has(p.method)) {
      if (!p.reference?.trim()) {
        throw ApiError.badRequest(
          "PAYMENT_REFERENCE_REQUIRED",
          `${CARD_METHODS.has(p.method) ? "Card approval number" : "Transaction ID"} is required for ${p.method.toLowerCase()} payments`
        );
      }
      return { method: p.method, amount: p.amount, reference: p.reference.trim() };
    }
    // DUE / COMPLIMENT / delivery platforms / OTHER — reference is optional.
    return {
      method: p.method,
      amount: p.amount,
      ...(p.reference?.trim() ? { reference: p.reference.trim() } : {}),
    };
  });

  const paymentMethod: PaymentMethod =
    input.payments.length === 1 ? input.payments[0].method : "MIXED";

  const orderNumber = await generateOrderNumber(businessId);

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        businessId,
        branchId: input.branchId,
        registerId: input.registerId,
        cashierId,
        orderNumber,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        platform: input.platform ?? "OTHER",
        platformOrderId: input.platformOrderId?.trim() || undefined,
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        paymentMethod,
        paymentRef: input.payments.length === 1 ? input.payments[0].reference : undefined,
        notes: input.notes,
        items: {
          create: lineItems.map((li) => ({
            productId: li.productId,
            productName: li.productName,
            variationId: li.variationId,
            variationName: li.variationName,
            unitPrice: li.unitPrice,
            quantity: li.quantity,
            discount: li.discount,
            subtotal: li.subtotal,
            specialNote: li.specialNote,
            ...(li.modifiers.length
              ? {
                  modifiers: {
                    create: li.modifiers.map((m) => ({
                      modifierItemId: m.modifierItemId,
                      name: m.name,
                      price: m.price,
                      quantity: m.quantity,
                    })),
                  },
                }
              : {}),
          })),
        },
        payments: { create: paymentRows },
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
    ...(opts.platform ? { platform: opts.platform as never } : {}),
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
      payments: true,
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
