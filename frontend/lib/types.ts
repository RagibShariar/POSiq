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
  isActive: boolean;
  category?: { id: string; name: string } | null;
}

export interface OrderPayment {
  id?: string;
  method: "CASH" | "CARD" | "MOBILE_BANKING" | "MIXED";
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

export interface SummaryReport {
  today: {
    orders: number;
    grossRevenue: number;
    netRevenue: number;
    refunds: number;
    refundedAmount: number;
    avgOrderValue: number;
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
  };
  daily: { date: string; orders: number; revenue: number }[];
  byPaymentMethod: { method: string; orders: number; revenue: number }[];
}
