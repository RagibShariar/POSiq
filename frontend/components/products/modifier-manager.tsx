"use client";

import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Hint } from "@/components/ui/hint";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, ApiRequestError } from "@/lib/api";
import type { ModifierGroup, ModifierGroupType } from "@/lib/types";

const money = (n: string | number) => `৳${Number(n).toLocaleString()}`;

const TYPE_LABEL: Record<ModifierGroupType, string> = {
  ADDON: "Add-on",
  SIDE_ITEM: "Side item",
  COOKING_INSTRUCTION: "Cooking instruction",
};

function err(e: unknown, fallback: string) {
  toast.error(e instanceof ApiRequestError ? e.message : fallback);
}

export function ModifierManager() {
  const [groups, setGroups] = useState<ModifierGroup[] | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<ModifierGroupType>("ADDON");
  const [maxSelect, setMaxSelect] = useState("10");
  // Per-group new-item drafts keyed by group id.
  const [itemDraft, setItemDraft] = useState<Record<string, { name: string; price: string }>>({});

  const load = useCallback(() => {
    api
      .get<ModifierGroup[]>("/modifier-groups")
      .then((r) => setGroups(r.data))
      .catch(() => toast.error("Failed to load modifier groups"));
  }, []);

  useEffect(load, [load]);

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.post("/modifier-groups", {
        name: name.trim(),
        type,
        maxSelect: Number(maxSelect) || 10,
      });
      setName("");
      setMaxSelect("10");
      setType("ADDON");
      toast.success("Modifier group created");
      load();
    } catch (e) {
      err(e, "Failed to create group");
    }
  }

  async function deleteGroup(g: ModifierGroup) {
    if (!confirm(`Delete "${g.name}"? It will be removed from all products.`)) return;
    try {
      await api.delete(`/modifier-groups/${g.id}`);
      toast.success("Group deleted");
      load();
    } catch (e) {
      err(e, "Delete failed");
    }
  }

  async function addItem(groupId: string) {
    const draft = itemDraft[groupId];
    if (!draft?.name.trim()) return;
    try {
      await api.post(`/modifier-groups/${groupId}/items`, {
        name: draft.name.trim(),
        price: Number(draft.price) || 0,
      });
      setItemDraft((d) => ({ ...d, [groupId]: { name: "", price: "" } }));
      load();
    } catch (e) {
      err(e, "Failed to add item");
    }
  }

  async function deleteItem(groupId: string, itemId: string) {
    try {
      await api.delete(`/modifier-groups/${groupId}/items/${itemId}`);
      load();
    } catch (e) {
      err(e, "Delete failed");
    }
  }

  const setDraft = (groupId: string, key: "name" | "price", value: string) =>
    setItemDraft((d) => {
      const cur = d[groupId] ?? { name: "", price: "" };
      return { ...d, [groupId]: { ...cur, [key]: value } };
    });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">New modifier group</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createGroup} className="flex flex-wrap items-end gap-2">
            <div className="min-w-48 flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">Group name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Drink Add-Ons"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Type</label>
              <Select value={type} onValueChange={(v) => setType(v as ModifierGroupType)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADDON">Add-on</SelectItem>
                  <SelectItem value="SIDE_ITEM">Side item</SelectItem>
                  <SelectItem value="COOKING_INSTRUCTION">Cooking instruction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Max select</label>
              <Input
                type="number"
                min="1"
                value={maxSelect}
                onChange={(e) => setMaxSelect(e.target.value)}
                className="w-24"
              />
            </div>
            <Button type="submit" disabled={!name.trim()}>
              <Plus className="mr-1 h-4 w-4" /> Create
            </Button>
          </form>
        </CardContent>
      </Card>

      {groups === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {groups?.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No modifier groups yet — create one above (e.g. &ldquo;Extra toppings&rdquo;).
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {groups?.map((g) => {
          const draft = itemDraft[g.id] ?? { name: "", price: "" };
          return (
            <Card key={g.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">{g.name}</CardTitle>
                  <Badge variant="secondary">{TYPE_LABEL[g.type]}</Badge>
                  <Hint label="Number of products this modifier group is attached to">
                    <Badge variant="outline">
                      Applied on {g._count?.productLinks ?? 0}{" "}
                      {(g._count?.productLinks ?? 0) === 1 ? "product" : "products"}
                    </Badge>
                  </Hint>
                  <span className="text-xs text-muted-foreground">· {g.items.length} options</span>
                </div>
                <Hint label="Delete this modifier group">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-red-500"
                    onClick={() => deleteGroup(g)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </Hint>
              </CardHeader>
              <CardContent className="space-y-2">
                {g.items.length === 0 && (
                  <p className="text-xs text-muted-foreground">No options yet.</p>
                )}
                {g.items.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center justify-between rounded-md border bg-muted/40 px-2.5 py-1.5 text-sm"
                  >
                    <span>{it.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {Number(it.price) > 0 ? `+${money(it.price)}` : "Free"}
                      </span>
                      <Hint label="Remove this option">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-red-500"
                          onClick={() => deleteItem(g.id, it.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </Hint>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft(g.id, "name", e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem(g.id))}
                    placeholder="Option name"
                    className="h-8"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.price}
                    onChange={(e) => setDraft(g.id, "price", e.target.value)}
                    placeholder="৳0"
                    className="h-8 w-20"
                  />
                  <Button size="sm" variant="outline" onClick={() => addItem(g.id)}>
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
