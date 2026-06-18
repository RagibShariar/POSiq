"use client";

import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ModifierManager } from "@/components/products/modifier-manager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { ListMeta, ModifierGroup, Product, ProductDetail } from "@/lib/types";

interface Category {
  id: string;
  name: string;
  description?: string | null;
  _count?: { products: number };
}

// A buffered variation row in the form. `id` present = already exists on the server.
interface VarRow {
  id?: string;
  name: string;
  price: string;
}

const PAGE_SIZE = 20;
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
};

function errToast(e: unknown, fallback: string) {
  toast.error(e instanceof ApiRequestError ? e.message : fallback);
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  // Selected category ids for the product being edited/created.
  const [categoryIds, setCategoryIds] = useState<Set<string>>(new Set());

  // ── Variations & modifier-link buffers (used for both create and edit) ──
  const [hasVariations, setHasVariations] = useState(false);
  const [varRows, setVarRows] = useState<VarRow[]>([]);
  const [initialVarRows, setInitialVarRows] = useState<VarRow[]>([]);
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  const [initialLinkedIds, setInitialLinkedIds] = useState<string[]>([]);

  // ── View (read-only) modal ──
  const [viewing, setViewing] = useState<ProductDetail | null>(null);

  const loadProducts = useCallback(() => {
    api
      .get<Product[]>(`/products?page=${page}&limit=${PAGE_SIZE}&search=${encodeURIComponent(search)}`)
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

  const loadModifierGroups = useCallback(() => {
    api
      .get<ModifierGroup[]>("/modifier-groups")
      .then((res) => setModifierGroups(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(loadProducts, 250);
    return () => clearTimeout(t);
  }, [loadProducts]);

  useEffect(loadCategories, [loadCategories]);
  useEffect(loadModifierGroups, [loadModifierGroups]);

  function resetExtras() {
    setCategoryIds(new Set());
    setHasVariations(false);
    setVarRows([]);
    setInitialVarRows([]);
    setLinkedIds(new Set());
    setInitialLinkedIds([]);
  }

  function toggleCategory(id: string, checked: boolean) {
    setCategoryIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    resetExtras();
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
    });
    resetExtras();
    setCategoryIds(new Set((p.categories ?? []).map((c) => c.id)));
    setDialogOpen(true);
    // Load existing variations + modifier links into the buffers.
    api
      .get<ProductDetail>(`/products/${p.id}`)
      .then((res) => {
        const rows = res.data.variations.map((v) => ({
          id: v.id,
          name: v.name,
          price: String(v.price),
        }));
        setVarRows(rows);
        setInitialVarRows(rows);
        setHasVariations(Boolean(res.data.hasVariations) || rows.length > 0);
        const ids = res.data.modifierGroups.map((l) => l.modifierGroup.id);
        setLinkedIds(new Set(ids));
        setInitialLinkedIds(ids);
      })
      .catch(() => {});
  }

  async function openView(p: Product) {
    try {
      const res = await api.get<ProductDetail>(`/products/${p.id}`);
      setViewing(res.data);
    } catch {
      toast.error("Failed to load product");
    }
  }

  // ── Variation row helpers ──
  const addVarRow = () => setVarRows((r) => [...r, { name: "", price: "" }]);
  const removeVarRow = (idx: number) => setVarRows((r) => r.filter((_, i) => i !== idx));
  const updateVarRow = (idx: number, key: "name" | "price", value: string) =>
    setVarRows((r) => r.map((row, i) => (i === idx ? { ...row, [key]: value } : row)));

  function toggleLink(groupId: string, checked: boolean) {
    setLinkedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(groupId);
      else next.delete(groupId);
      return next;
    });
  }

  async function reconcileVariations(productId: string) {
    if (!hasVariations) {
      // Toggling variations off removes them all.
      for (const init of initialVarRows) {
        if (init.id) await api.delete(`/products/${productId}/variations/${init.id}`);
      }
      return;
    }
    // Delete removed rows.
    for (const init of initialVarRows) {
      if (init.id && !varRows.some((r) => r.id === init.id)) {
        await api.delete(`/products/${productId}/variations/${init.id}`);
      }
    }
    // Create new / update changed.
    for (const row of varRows) {
      if (!row.name.trim() || row.price === "") continue;
      const price = Number(row.price) || 0;
      if (row.id) {
        const init = initialVarRows.find((i) => i.id === row.id);
        if (init && (init.name !== row.name || init.price !== row.price)) {
          await api.patch(`/products/${productId}/variations/${row.id}`, {
            name: row.name.trim(),
            price,
          });
        }
      } else {
        await api.post(`/products/${productId}/variations`, { name: row.name.trim(), price });
      }
    }
  }

  async function reconcileLinks(productId: string) {
    for (const id of linkedIds) {
      if (!initialLinkedIds.includes(id))
        await api.post(`/products/${productId}/modifier-groups`, { modifierGroupId: id });
    }
    for (const id of initialLinkedIds) {
      if (!linkedIds.has(id)) await api.delete(`/products/${productId}/modifier-groups/${id}`);
    }
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
      categoryIds: [...categoryIds],
    };
    try {
      let productId = editing?.id;
      if (editing) {
        await api.patch(`/products/${editing.id}`, payload);
      } else {
        const res = await api.post<Product>("/products", payload);
        productId = res.data.id;
      }
      if (productId) {
        await reconcileVariations(productId);
        await reconcileLinks(productId);
      }
      toast.success(editing ? "Product updated" : "Product created");
      setDialogOpen(false);
      loadProducts();
      loadModifierGroups(); // refresh "applied on" counts
    } catch (err) {
      errToast(err, "Save failed");
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
      errToast(err, "Delete failed");
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
      errToast(err, "Failed to add category");
    }
  }

  async function deleteCategory(c: Category) {
    try {
      await api.delete(`/categories/${c.id}`);
      loadCategories();
      toast.success("Category deleted");
    } catch (err) {
      errToast(err, "Delete failed");
    }
  }

  const set = (key: keyof typeof EMPTY_FORM) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Tabs defaultValue="products" className="space-y-4">
      <div className="flex items-center justify-between">
        <TabsList className="h-10 p-1">
          <TabsTrigger value="products" className="px-4 font-semibold">
            Products
          </TabsTrigger>
          <TabsTrigger value="categories" className="px-4 font-semibold">
            Categories
          </TabsTrigger>
          <TabsTrigger value="modifiers" className="px-4 font-semibold">
            Modifiers
          </TabsTrigger>
        </TabsList>
        <Button size="lg" onClick={openCreate} title="Add a new product">
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

        <p className="text-xs font-medium text-muted-foreground">
          List of menu items ({meta?.total ?? products?.length ?? 0} items)
        </p>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-center">#</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-center">Variations</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products === null && (
                <TableRow>
                  <TableCell colSpan={9}>
                    <Skeleton className="h-20 w-full" />
                  </TableCell>
                </TableRow>
              )}
              {products?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                    No products yet — create your first one.
                  </TableCell>
                </TableRow>
              )}
              {products?.map((p, idx) => {
                const margin =
                  Number(p.price) > 0
                    ? Math.round(((Number(p.price) - Number(p.costPrice)) / Number(p.price)) * 100)
                    : 0;
                const varCount = p.variations?.length ?? 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-center text-muted-foreground">
                      {(page - 1) * PAGE_SIZE + idx + 1}
                    </TableCell>
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
                      {p.categories && p.categories.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {p.categories.map((c) => (
                            <Badge key={c.id} variant="secondary">
                              {c.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {varCount > 0 ? (
                        <Badge variant="secondary" title={`${varCount} variation(s)`}>
                          {varCount}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground" title="No variations">
                          0
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{money(p.price)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {money(p.costPrice)}
                    </TableCell>
                    <TableCell className="text-right">{margin}%</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="View details"
                        onClick={() => openView(p)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit product"
                        onClick={() => openEdit(p)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground"
                        title="Delete product"
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
                <TableHead className="w-10 text-center">#</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Products</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No categories yet.
                  </TableCell>
                </TableRow>
              )}
              {categories.map((c, idx) => (
                <TableRow key={c.id}>
                  <TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-right">{c._count?.products ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground"
                      title="Delete category"
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

      <TabsContent value="modifiers">
        <ModifierManager />
      </TabsContent>

      {/* ── Create / Edit dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit product" : "New product"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveProduct} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="p-name">Name</Label>
                <Input id="p-name" required value={form.name} onChange={(e) => set("name")(e.target.value)} />
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
                <Label htmlFor="p-price">
                  {hasVariations ? "Base price (৳)" : "Selling price (৳)"}
                </Label>
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
                <Label>Categories</Label>
                {categories.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No categories yet — add some in the Categories tab.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {categories.map((c) => {
                      const checked = categoryIds.has(c.id);
                      return (
                        <label
                          key={c.id}
                          title="A product can belong to multiple categories"
                          className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm ${
                            checked ? "border-primary bg-primary/5" : "bg-card"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => toggleCategory(c.id, e.target.checked)}
                          />
                          {c.name}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Variations & modifiers ── */}
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <label
                className="flex cursor-pointer items-center gap-2 text-sm font-medium"
                title="Tick this to sell the product in multiple sizes/flavors, each with its own price"
              >
                <input
                  type="checkbox"
                  checked={hasVariations}
                  onChange={(e) => setHasVariations(e.target.checked)}
                />
                This product has variations (sizes / flavors)
              </label>

              {hasVariations && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Each variation has its own price; the cashier picks one at checkout. Blank rows
                    are ignored. No variations = a regular single-price product.
                  </p>
                  {varRows.map((row, idx) => (
                    <div key={row.id ?? `new-${idx}`} className="flex items-center gap-2">
                      <Input
                        value={row.name}
                        onChange={(e) => updateVarRow(idx, "name", e.target.value)}
                        placeholder="e.g. Large"
                        className="h-8 flex-1"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.price}
                        onChange={(e) => updateVarRow(idx, "price", e.target.value)}
                        placeholder="৳ price"
                        className="h-8 w-28"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-500"
                        title="Remove variation"
                        onClick={() => removeVarRow(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addVarRow} title="Add a variation">
                    <Plus className="mr-1 h-4 w-4" /> Add variation
                  </Button>
                </div>
              )}

              <div className="space-y-2 border-t pt-3">
                <div className="text-sm font-medium">
                  Modifier groups{" "}
                  <span className="font-normal text-muted-foreground">(optional add-ons)</span>
                </div>
                {modifierGroups.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No modifier groups yet — create them in the Modifiers tab first.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {modifierGroups.map((g) => {
                      const checked = linkedIds.has(g.id);
                      return (
                        <label
                          key={g.id}
                          title={`${g.items.length} option(s)`}
                          className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm ${
                            checked ? "border-primary bg-primary/5" : "bg-card"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => toggleLink(g.id, e.target.checked)}
                          />
                          {g.name}
                          <span className="text-xs text-muted-foreground">({g.items.length})</span>
                        </label>
                      );
                    })}
                  </div>
                )}
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

      {/* ── View (read-only) modal ── */}
      <Dialog open={viewing !== null} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {viewing.name}
                  {!viewing.isActive && <Badge variant="secondary">Inactive</Badge>}
                </DialogTitle>
                <DialogDescription>
                  SKU {viewing.sku}
                  {viewing.barcode ? ` · Barcode ${viewing.barcode}` : ""}
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center gap-3">
                {viewing.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={viewing.imageUrl}
                    alt=""
                    className="h-16 w-16 rounded-lg border object-cover"
                  />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted text-sm font-bold text-muted-foreground">
                    {viewing.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <div className="space-y-0.5 text-sm">
                  <div>
                    <span className="text-muted-foreground">Price: </span>
                    <span className="font-semibold">{money(viewing.price)}</span>
                    {viewing.hasVariations && (
                      <span className="text-xs text-muted-foreground"> (base)</span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cost: </span>
                    {money(viewing.costPrice)} · <span className="text-muted-foreground">Unit: </span>
                    {viewing.unit}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Categories: </span>
                    {viewing.categories && viewing.categories.length > 0
                      ? viewing.categories.map((c) => c.name).join(", ")
                      : "—"}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-sm font-semibold">
                  Variations ({viewing.variations.length})
                </div>
                {viewing.variations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No variations — single price.</p>
                ) : (
                  <div className="space-y-1">
                    {viewing.variations.map((v) => (
                      <div
                        key={v.id}
                        className="flex justify-between rounded-md border bg-muted/40 px-2.5 py-1.5 text-sm"
                      >
                        <span>{v.name}</span>
                        <span className="font-medium">{money(v.price)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="text-sm font-semibold">
                  Modifier groups ({viewing.modifierGroups.length})
                </div>
                {viewing.modifierGroups.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No modifier groups attached.</p>
                ) : (
                  <div className="space-y-1.5">
                    {viewing.modifierGroups.map((l) => (
                      <div key={l.modifierGroup.id} className="rounded-md border px-2.5 py-1.5 text-sm">
                        <div className="font-medium">{l.modifierGroup.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {l.modifierGroup.items.map((it) => it.name).join(", ") || "No options"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    const p = products?.find((x) => x.id === viewing.id);
                    setViewing(null);
                    if (p) openEdit(p);
                  }}
                >
                  <Pencil className="mr-1 h-4 w-4" /> Edit this product
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
