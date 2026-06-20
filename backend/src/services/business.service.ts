import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";

const businessSelect = {
  id: true,
  name: true,
  type: true,
  email: true,
  phone: true,
  address: true,
  logo: true,
  currency: true,
  timezone: true,
  createdAt: true,
} as const;

export async function getBusiness(businessId: string) {
  const business = await prisma.business.findFirst({
    where: { id: businessId, deletedAt: null },
    select: {
      ...businessSelect,
      subscription: { select: { plan: true, status: true, currentPeriodEnd: true } },
      _count: { select: { branches: { where: { deletedAt: null } }, users: { where: { deletedAt: null } } } },
    },
  });
  if (!business) throw ApiError.notFound("Business not found");
  return business;
}

interface UpdateBusinessInput {
  name?: string;
  type?: string;
  phone?: string;
  address?: string;
  currency?: string;
  timezone?: string;
}

export async function updateBusiness(businessId: string, input: UpdateBusinessInput) {
  await getBusiness(businessId);
  return prisma.business.update({
    where: { id: businessId },
    data: input,
    select: businessSelect,
  });
}

// MVP: the logo is a URL (e.g. uploaded to Cloudinary from the frontend).
export async function setLogo(businessId: string, logoUrl: string) {
  await getBusiness(businessId);
  return prisma.business.update({
    where: { id: businessId },
    data: { logo: logoUrl },
    select: businessSelect,
  });
}

export async function deleteBusiness(businessId: string) {
  await getBusiness(businessId);
  const now = new Date();

  await prisma.$transaction([
    prisma.business.update({
      where: { id: businessId },
      data: { deletedAt: now, isActive: false },
    }),
    prisma.user.updateMany({
      where: { businessId },
      data: { isActive: false },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: { in: (await prisma.user.findMany({ where: { businessId }, select: { id: true } })).map((u) => u.id) }, revokedAt: null },
      data: { revokedAt: now },
    }),
  ]);
}

// ─── SETTINGS (JSON blob on Business) ────────────────
const DEFAULT_SETTINGS = {
  // Customer invoice / printed receipt customization.
  receipt: {
    headerText: "",
    footerText: "Thank you for your purchase!",
    showLogo: true,
    showCashier: true,
    // Invoice customization
    paperSize: "80mm", // "80mm" | "58mm" | "A4"
    showPhone: true,
    showAddress: true,
    showEmail: false,
    showCustomer: true,
    showTaxBreakdown: true,
    showOrderNote: true,
    accentColor: "#27496d",
    fontScale: 100, // percent
  },
  tax: {
    enabled: false,
    rate: 0, // percent, applied on (subtotal - discount)
    label: "VAT",
  },
  // Monthly net-sales goal (in the business currency). 0 = not set.
  salesTarget: 0,
  // Barcode sticker / label sheet defaults. Used to seed the Print Labels page.
  barcode: {
    barcodeType: "CODE128", // CODE128 | EAN13 | UPC | CODE39
    sheet: "30-up", // preset key, see frontend lib/barcode
    showProductName: true,
    productNameSize: 13,
    showVariation: false,
    variationSize: 11,
    showPrice: true,
    priceSize: 13,
    priceTaxMode: "inc", // "inc" | "exc"
    showBusinessName: true,
    businessNameSize: 11,
    showPackingDate: false,
    packingDateSize: 10,
    showSku: false,
    skuSize: 10,
  },
  // Delivery platforms. paymentMethod: PAY_NOW | PAY_LATER; discountPercent auto-applied at the POS.
  platforms: {
    foodpanda: { enabled: true, paymentMethod: "PAY_LATER", discountPercent: 0 },
    pathao: { enabled: true, paymentMethod: "PAY_NOW", discountPercent: 0 },
    foodi: { enabled: true, paymentMethod: "PAY_NOW", discountPercent: 0 },
  },
};

type Settings = typeof DEFAULT_SETTINGS & Record<string, unknown>;

export async function getSettings(businessId: string): Promise<Settings> {
  const business = await prisma.business.findFirst({
    where: { id: businessId, deletedAt: null },
    select: { settings: true },
  });
  if (!business) throw ApiError.notFound("Business not found");

  const stored = (business.settings as Record<string, unknown> | null) ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    receipt: { ...DEFAULT_SETTINGS.receipt, ...((stored.receipt as object) ?? {}) },
    tax: { ...DEFAULT_SETTINGS.tax, ...((stored.tax as object) ?? {}) },
    barcode: { ...DEFAULT_SETTINGS.barcode, ...((stored.barcode as object) ?? {}) },
    platforms: { ...DEFAULT_SETTINGS.platforms, ...((stored.platforms as object) ?? {}) },
  };
}

export async function updateSettings(businessId: string, patch: Record<string, unknown>) {
  const current = await getSettings(businessId);
  const merged = {
    ...current,
    ...patch,
    receipt: { ...current.receipt, ...((patch.receipt as object) ?? {}) },
    tax: { ...current.tax, ...((patch.tax as object) ?? {}) },
    barcode: { ...current.barcode, ...((patch.barcode as object) ?? {}) },
    platforms: { ...current.platforms, ...((patch.platforms as object) ?? {}) },
  };

  await prisma.business.update({
    where: { id: businessId },
    data: { settings: merged as Prisma.InputJsonValue },
  });
  return merged;
}

export async function getReceiptSettings(businessId: string) {
  return (await getSettings(businessId)).receipt;
}

export async function updateReceiptSettings(businessId: string, patch: Record<string, unknown>) {
  const updated = await updateSettings(businessId, { receipt: patch });
  return updated.receipt;
}
