"use client";

import { UserCheck, UserPlus, UserX } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
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
import { api, ApiRequestError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Branch } from "@/lib/types";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  branches: { id: string; name: string; code: string }[];
}

const ROLE_STYLE: Record<string, string> = {
  OWNER: "bg-violet-100 text-violet-800",
  MANAGER: "bg-blue-100 text-blue-800",
  CASHIER: "bg-slate-100 text-slate-700",
};

export default function TeamPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "CASHIER", branchId: "" });

  const isOwner = user?.role === "OWNER";

  const load = useCallback(() => {
    api
      .get<TeamMember[]>("/users?limit=100")
      .then((res) => setMembers(res.data))
      .catch(() => toast.error("Failed to load team"));
  }, []);

  useEffect(() => {
    load();
    api.get<Branch[]>("/branches?limit=100").then((res) => setBranches(res.data)).catch(() => {});
  }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/users/invite", {
        name: form.name,
        email: form.email,
        role: form.role,
        branchIds: [form.branchId],
      });
      toast.success(`Invitation sent to ${form.email}`);
      setInviteOpen(false);
      setForm({ name: "", email: "", role: "CASHIER", branchId: "" });
      load();
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(m: TeamMember) {
    try {
      if (m.isActive) {
        if (!confirm(`Remove ${m.name}? They will be signed out everywhere.`)) return;
        await api.delete(`/users/${m.id}`);
        toast.success(`${m.name} removed`);
      } else {
        await api.patch(`/users/${m.id}/activate`);
        toast.success(`${m.name} reactivated`);
      }
      load();
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Action failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Invited members get an email link to set their password (valid 72 hours).
        </p>
        {isOwner && (
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-1 h-4 w-4" /> Invite member
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Branches</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead>Status</TableHead>
              {isOwner && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members === null && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Skeleton className="h-20 w-full" />
                </TableCell>
              </TableRow>
            )}
            {members?.map((m) => (
              <TableRow key={m.id} className={m.isActive ? "" : "opacity-60"}>
                <TableCell>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-muted-foreground">{m.email}</div>
                </TableCell>
                <TableCell>
                  <Badge className={ROLE_STYLE[m.role] ?? ""} variant="secondary">
                    {m.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {m.branches.map((b) => b.code).join(", ") || "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleDateString() : "Never"}
                </TableCell>
                <TableCell>
                  {m.isActive ? (
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </TableCell>
                {isOwner && (
                  <TableCell className="text-right">
                    {m.role !== "OWNER" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(m)}
                        className={m.isActive ? "text-red-600" : "text-emerald-600"}
                      >
                        {m.isActive ? (
                          <>
                            <UserX className="mr-1 h-4 w-4" /> Remove
                          </>
                        ) : (
                          <>
                            <UserCheck className="mr-1 h-4 w-4" /> Reactivate
                          </>
                        )}
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite team member</DialogTitle>
            <DialogDescription>
              They&apos;ll receive an email link to set their password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={invite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="i-name">Name</Label>
              <Input
                id="i-name"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="i-email">Email</Label>
              <Input
                id="i-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASHIER">Cashier</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Branch</Label>
                <Select
                  value={form.branchId}
                  onValueChange={(v) => setForm((f) => ({ ...f, branchId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full" disabled={busy || !form.branchId}>
                {busy ? "Sending…" : "Send invitation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
