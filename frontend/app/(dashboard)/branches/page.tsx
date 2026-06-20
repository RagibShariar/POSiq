"use client";

import { Building2, Pencil, Plus, Star, Trash2, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Hint } from "@/components/ui/hint";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiRequestError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface BranchRow {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  isActive: boolean;
  isMainBranch: boolean;
  _count?: { staff: number };
}

const EMPTY = { name: "", code: "", address: "", phone: "" };

export default function BranchesPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<BranchRow[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BranchRow | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const isOwner = user?.role === "OWNER";

  const load = useCallback(() => {
    api
      .get<BranchRow[]>("/branches?limit=100")
      .then((res) => setBranches(res.data))
      .catch(() => toast.error("Failed to load branches"));
  }, []);

  useEffect(load, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  }

  function openEdit(b: BranchRow) {
    setEditing(b);
    setForm({ name: b.name, code: b.code, address: b.address ?? "", phone: b.phone ?? "" });
    setDialogOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload = {
      name: form.name,
      code: form.code,
      ...(form.address ? { address: form.address } : {}),
      ...(form.phone ? { phone: form.phone } : {}),
    };
    try {
      if (editing) {
        await api.patch(`/branches/${editing.id}`, payload);
        toast.success("Branch updated");
      } else {
        await api.post("/branches", payload);
        toast.success("Branch created");
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(b: BranchRow) {
    if (!confirm(`Delete branch "${b.name}"? Its staff assignments will be removed.`)) return;
    try {
      await api.delete(`/branches/${b.id}`);
      toast.success("Branch deleted");
      load();
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Each branch keeps its own stock, register, and orders.
        </p>
        {isOwner && (
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /> New branch
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {branches === null &&
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        {branches?.map((b) => (
          <Card key={b.id} className={b.isActive ? "" : "opacity-60"}>
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {b.name}
                {b.isMainBranch && (
                  <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800">
                    <Star className="h-3 w-3" /> Main
                  </Badge>
                )}
              </CardTitle>
              {isOwner && (
                <div className="flex">
                  <Hint label="Edit branch">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(b)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </Hint>
                  {!b.isMainBranch && (
                    <Hint label="Delete branch">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => remove(b)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </Hint>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <div>
                Code: <span className="font-mono text-foreground">{b.code}</span>
              </div>
              {b.address && <div>{b.address}</div>}
              {b.phone && <div>{b.phone}</div>}
              <div className="flex items-center gap-1 pt-1">
                <Users className="h-3.5 w-3.5" /> {b._count?.staff ?? 0} staff assigned
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit branch" : "New branch"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="b-name">Branch name</Label>
              <Input
                id="b-name"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Banani Branch"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-code">Code</Label>
              <Input
                id="b-code"
                required
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="BAN-01"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-address">Address (optional)</Label>
              <Input
                id="b-address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-phone">Phone (optional)</Label>
              <Input
                id="b-phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Saving…" : editing ? "Save changes" : "Create branch"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
