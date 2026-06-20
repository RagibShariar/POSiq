export type Role = "SUPER_ADMIN" | "OWNER" | "MANAGER" | "CASHIER";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  businessId: string | null;
}

export interface Business {
  id: string;
  name: string;
  type: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  isActive: boolean;
  isMainBranch: boolean;
}

export interface AuthSession {
  user: User;
  business?: Business;
  accessToken: string;
  refreshToken: string;
}

export interface ListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  imageUrl?: string | null;
  price: string | number;
  costPrice: string | number;
  unit: string;
  lowStockThreshold: number;
  hasVariations?: boolean;
  isActive: boolean;
  categories?: { id: string; name: string }[];
  // Light shapes returned by the list endpoint — counts only.
  modifierGroups?: { modifierGroupId: string }[];
  variations?: { id: string }[];
}

export interface ProductVariation {
  id: string;
  name: string;
  price: string | number;
  costPrice?: string | number | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
}

export type ModifierGroupType = "ADDON" | "SIDE_ITEM" | "COOKING_INSTRUCTION";

export interface ModifierItem {
  id: string;
  name: string;
  price: string | number;
  isActive?: boolean;
  sortOrder?: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  type: ModifierGroupType;
  minSelect: number;
  maxSelect: number;
  isActive: boolean;
  items: ModifierItem[];
  _count?: { productLinks: number };
}

export interface ProductModifierGroupLink {
  isRequired: boolean;
  sortOrder: number;
  modifierGroup: ModifierGroup;
}

// Full product as returned by GET /products/:id and /products/barcode/:code.
export interface ProductDetail extends Omit<Product, "modifierGroups" | "variations"> {
  variations: ProductVariation[];
  modifierGroups: ProductModifierGroupLink[];
}

// A configured cart line — product + chosen variation + selected modifiers.
export interface SelectedModifier {
  modifierItemId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface OrderPayment {
  id?: string;
  method: string; // see components/pos/payment-methods PayMethod (+ legacy CARD/MOBILE_BANKING/MIXED)
  amount: string | number;
  reference?: string | null;
  tendered?: string | number | null;
  changeGiven?: string | number | null;
}

export interface TaxSettings {
  enabled: boolean;
  rate: number;
  label: string;
}

// Printed invoice / customer receipt customization (settings.receipt).
export interface InvoiceSettings {
  headerText: string;
  footerText: string;
  showLogo: boolean;
  showCashier: boolean;
  paperSize: "80mm" | "58mm" | "A4";
  showPhone: boolean;
  showAddress: boolean;
  showEmail: boolean;
  showCustomer: boolean;
  showTaxBreakdown: boolean;
  showOrderNote: boolean;
  accentColor: string;
  fontScale: number;
}

export type BarcodeSymbology = "CODE128" | "EAN13" | "UPC" | "CODE39";

// Barcode sticker / label sheet defaults (settings.barcode).
export interface BarcodeSettings {
  barcodeType: BarcodeSymbology;
  sheet: string;
  showProductName: boolean;
  productNameSize: number;
  showVariation: boolean;
  variationSize: number;
  showPrice: boolean;
  priceSize: number;
  priceTaxMode: "inc" | "exc";
  showBusinessName: boolean;
  businessNameSize: number;
  showPackingDate: boolean;
  packingDateSize: number;
  showSku: boolean;
  skuSize: number;
}

export interface SummaryReport {
  today: {
    orders: number;
    grossRevenue: number;
    netRevenue: number;
    refunds: number;
    refundedAmount: number;
    avgOrderValue: number;
    totalTax: number;
    totalDiscount: number;
    itemsSold: number;
  };
  yesterday: { orders: number; netRevenue: number };
  deltas: { ordersPct: number | null; revenuePct: number | null };
  lowStockCount: number;
}

export interface SalesReport {
  totals: {
    orders: number;
    grossRevenue: number;
    refundedAmount: number;
    netRevenue: number;
    avgOrderValue: number;
    totalTax: number;
    totalDiscount: number;
  };
  daily: { date: string; orders: number; revenue: number }[];
  byPaymentMethod: { method: string; orders: number; revenue: number }[];
  byPlatform: { platform: string; orders: number; revenue: number }[];
  orderStats: {
    itemsSold: number;
    cancelled: number;
    voided: number;
    discounted: number;
  };
}

export type OrderPlatform = "OTHER" | "FOODPANDA" | "PATHAO" | "FOODI" | "SHOHOZ";

export interface PlatformConfig {
  enabled: boolean;
  paymentMethod: "PAY_NOW" | "PAY_LATER";
  discountPercent: number;
}

export interface PlatformSettings {
  foodpanda: PlatformConfig;
  pathao: PlatformConfig;
  foodi: PlatformConfig;
}

export interface ProductReport {
  topProducts: { productId: string; name: string; quantitySold: number; revenue: number; orderCount: number }[];
  slowProducts: { productId: string; name: string; quantitySold: number; revenue: number }[];
}
