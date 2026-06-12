"use client";

import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ApiRequestError } from "@/lib/api";
import type { ListMeta, Product } from "@/lib/types";

interface Category {
  id: string;
  name: string;
  description?: string | null;
  _count?: { products: number };
}

const money = (n: string | number) => `৳${Number(n).toLocaleString()}`;

const EMPTY_FORM = {
  name: "",
  sku: "",
  barcode: "",
  imageUrl: "",
  price: "",
  costPrice: "",
  unit: "pcs",
  lowStockThreshold: "10",
  categoryId: "",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const loadProducts = useCallback(() => {
    api
      .get<Product[]>(`/products?page=${page}&limit=20&search=${encodeURIComponent(search)}`)
      .then((res) => {
        setProducts(res.data);
        setMeta(res.meta ?? null);
      })
      .catch(() => toast.error("Failed to load products"));
  }, [page, search]);

  const loadCategories = useCallback(() => {
    api
      .get<Category[]>("/categories?limit=100")
      .then((res) => setCategories(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(loadProducts, 250);
    return () => clearTimeout(t);
  }, [loadProducts]);

  useEffect(loadCategories, [loadCategories]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode ?? "",
      imageUrl: p.imageUrl ?? "",
      price: String(p.price),
      costPrice: String(p.costPrice),
      unit: p.unit,
      lowStockThreshold: String(p.lowStockThreshold),
      categoryId: p.category?.id ?? "",
    });
    setDialogOpen(true);
  }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload = {
      name: form.name,
      sku: form.sku,
      ...(form.barcode ? { barcode: form.barcode } : {}),
      ...(form.imageUrl ? { imageUrl: form.imageUrl } : {}),
      price: Number(form.price),
      costPrice: Number(form.costPrice),
      unit: form.unit || "pcs",
      lowStockThreshold: Number(form.lowStockThreshold) || 10,
      ...(form.categoryId ? { categoryId: form.categoryId } : {}),
    };
    try {
      if (editing) {
        await api.patch(`/products/${editing.id}`, payload);
        toast.success("Product updated");
      } else {
        await api.post("/products", payload);
        toast.success("Product created");
      }
      setDialogOpen(false);
      loadProducts();
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct(p: Product) {
    if (!confirm(`Delete "${p.name}"? It will disappear from the catalog.`)) return;
    try {
      await api.delete(`/products/${p.id}`);
      toast.success("Product deleted");
      loadProducts();
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Delete failed");
    }
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCategory.trim()) return;
    try {
      await api.post("/categories", { name: newCategory.trim() });
      setNewCategory("");
      loadCategories();
      toast.success("Category added");
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Failed to add category");
    }
  }

  async function deleteCategory(c: Category) {
    try {
      await api.delete(`/categories/${c.id}`);
      loadCategories();
      toast.success("Category deleted");
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Delete failed");
    }
  }

  const set = (key: keyof typeof EMPTY_FORM) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Tabs defaultValue="products" className="space-y-4">
      <div className="flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> New product
        </Button>
      </div>

      <TabsContent value="products" className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search name, SKU, barcode…"
            className="pl-8"
          />
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {products === null && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-20 w-full" />
                  </TableCell>
                </TableRow>
              )}
              {products?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    No products yet — create your first one.
                  </TableCell>
                </TableRow>
              )}
              {products?.map((p) => {
                const margin =
                  Number(p.price) > 0
                    ? Math.round(((Number(p.price) - Number(p.costPrice)) / Number(p.price)) * 100)
                    : 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.imageUrl}
                            alt=""
                            className="h-8 w-8 rounded-md border object-cover"
                          />
                        ) : (
                          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground">
                            {p.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        {p.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.sku}</TableCell>
                    <TableCell>
                      {p.category ? (
                        <Badge variant="secondary">{p.category.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{money(p.price)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {money(p.costPrice)}
                    </TableCell>
                    <TableCell className="text-right">{margin}%</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground"
                        onClick={() => deleteProduct(p)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {meta.page} of {meta.totalPages} · {meta.total} products
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </TabsContent>

      <TabsContent value="categories" className="space-y-4">
        <form onSubmit={addCategory} className="flex max-w-sm gap-2">
          <Input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="New category name"
          />
          <Button type="submit" disabled={!newCategory.trim()}>
            Add
          </Button>
        </form>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Products</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                    No categories yet.
                  </TableCell>
                </TableRow>
              )}
              {categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-right">{c._count?.products ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground"
                      onClick={() => deleteCategory(c)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit product" : "New product"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveProduct} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="p-name">Name</Label>
                <Input
                  id="p-name"
                  required
                  value={form.name}
                  onChange={(e) => set("name")(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-sku">SKU</Label>
                <Input
                  id="p-sku"
                  required
                  value={form.sku}
                  onChange={(e) => set("sku")(e.target.value)}
                  placeholder="ABC-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-barcode">Barcode (optional)</Label>
                <Input
                  id="p-barcode"
                  value={form.barcode}
                  onChange={(e) => set("barcode")(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="p-image">Image URL (optional)</Label>
                <Input
                  id="p-image"
                  type="url"
                  value={form.imageUrl}
                  onChange={(e) => set("imageUrl")(e.target.value)}
                  placeholder="https://…/product.jpg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-price">Selling price (৳)</Label>
                <Input
                  id="p-price"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.price}
                  onChange={(e) => set("price")(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-cost">Cost price (৳)</Label>
                <Input
                  id="p-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.costPrice}
                  onChange={(e) => set("costPrice")(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-unit">Unit</Label>
                <Input
                  id="p-unit"
                  value={form.unit}
                  onChange={(e) => set("unit")(e.target.value)}
                  placeholder="pcs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-threshold">Low stock alert below</Label>
                <Input
                  id="p-threshold"
                  type="number"
                  min="0"
                  value={form.lowStockThreshold}
                  onChange={(e) => set("lowStockThreshold")(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Category</Label>
                <Select
                  value={form.categoryId || "none"}
                  onValueChange={(v) => set("categoryId")(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "Saving…" : editing ? "Save changes" : "Create product"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
