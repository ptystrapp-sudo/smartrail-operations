import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logAudit } from "@/lib/audit";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useState, useMemo } from "react";
import { Eye, Power } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/users")({ component: UsersPage });

type AppRole = "commuter" | "station_staff" | "supervisor" | "admin";
const ROLES: AppRole[] = ["commuter", "station_staff", "supervisor", "admin"];

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  active_status: boolean;
  phone_number: string | null;
  created_at: string;
  roles: AppRole[];
}

function UsersPage() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const [search, setSearch] = useState("");
  const [inspecting, setInspecting] = useState<UserRow | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [{ data: profiles, error: pe }, { data: roles, error: re }] = await Promise.all([
        supabase.from("profiles").select("id, email, full_name, active_status, phone_number, created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (pe) throw pe;
      if (re) throw re;
      const roleMap = new Map<string, AppRole[]>();
      (roles ?? []).forEach((r) => {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role as AppRole);
        roleMap.set(r.user_id, arr);
      });
      return (profiles ?? []).map((p) => ({ ...p, roles: roleMap.get(p.id) ?? [] })) as UserRow[];
    },
  });

  const filtered = useMemo(
    () =>
      users.filter(
        (u) =>
          u.email.toLowerCase().includes(search.toLowerCase()) ||
          (u.full_name ?? "").toLowerCase().includes(search.toLowerCase()),
      ),
    [users, search],
  );

  const toggleActive = useMutation({
    mutationFn: async (u: UserRow) => {
      const next = !u.active_status;
      const { error } = await supabase.from("profiles").update({ active_status: next }).eq("id", u.id);
      if (error) throw error;
      await logAudit({
        actorId: me!.id, action: next ? "user_activated" : "user_deactivated",
        entityType: "user", entityId: u.id,
        previous: { active_status: u.active_status }, next: { active_status: next },
      });
    },
    onSuccess: () => {
      toast.success("Account status updated");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleRole = useMutation({
    mutationFn: async ({ u, role, on }: { u: UserRow; role: AppRole; on: boolean }) => {
      if (on) {
        const { error } = await supabase.from("user_roles").insert({ user_id: u.id, role });
        if (error && error.code !== "23505") throw error;
        await logAudit({ actorId: me!.id, action: "role_granted", entityType: "user_role", entityId: u.id, next: { role } });
      } else {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", u.id).eq("role", role);
        if (error) throw error;
        await logAudit({ actorId: me!.id, action: "role_revoked", entityType: "user_role", entityId: u.id, previous: { role } });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const sendReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/login",
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset email dispatched");
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">User Management</h1>
        <p className="text-xs text-muted-foreground mt-1">{users.length} accounts on file</p>
      </header>

      <Card className="p-4">
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm mb-3"
        />
        {isLoading ? <Skeleton className="h-64" /> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{u.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {u.roles.map((r) => (
                          <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {u.active_status
                        ? <Badge variant="outline" className="text-success border-success/40">active</Badge>
                        : <Badge variant="outline" className="text-muted-foreground">disabled</Badge>}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => setInspecting(u)}><Eye className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleActive.mutate(u)}><Power className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => sendReset(u.email)}>Reset PW</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">No accounts match</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog open={!!inspecting} onOpenChange={(v) => !v && setInspecting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{inspecting?.full_name || inspecting?.email}</DialogTitle></DialogHeader>
          {inspecting && (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground">
                <div>Email: {inspecting.email}</div>
                <div>Phone: {inspecting.phone_number ?? "—"}</div>
                <div>Joined: {new Date(inspecting.created_at).toLocaleString("en-ZA")}</div>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider">Role assignments</Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {ROLES.map((r) => {
                    const on = inspecting.roles.includes(r);
                    return (
                      <label key={r} className="flex items-center gap-2 text-sm border border-border rounded-md p-2">
                        <Checkbox
                          checked={on}
                          onCheckedChange={(c) => {
                            const next = !!c;
                            toggleRole.mutate(
                              { u: inspecting, role: r, on: next },
                              {
                                onSuccess: () =>
                                  setInspecting((p) =>
                                    p ? { ...p, roles: next ? [...p.roles, r] : p.roles.filter((x) => x !== r) } : p,
                                  ),
                              },
                            );
                          }}
                        />
                        <span>{r}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <UserActivity userId={inspecting.id} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserActivity({ userId }: { userId: string }) {
  const { data } = useQuery({
    queryKey: ["admin-user-activity", userId],
    queryFn: async () => {
      const [tickets, audit] = await Promise.all([
        supabase.from("tickets").select("id, ticket_status, fare_paid, purchase_timestamp").eq("user_id", userId).order("purchase_timestamp", { ascending: false }).limit(10),
        supabase.from("audit_logs").select("action_type, entity_type, created_at").eq("actor_id", userId).order("created_at", { ascending: false }).limit(10),
      ]);
      return { tickets: tickets.data ?? [], audit: audit.data ?? [] };
    },
  });
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider">Recent ticket history</Label>
      <div className="mt-2 max-h-32 overflow-y-auto text-xs space-y-1">
        {(data?.tickets ?? []).map((t) => (
          <div key={t.id} className="flex justify-between border-b border-border py-1">
            <span>{new Date(t.purchase_timestamp).toLocaleDateString("en-ZA")}</span>
            <span>R{Number(t.fare_paid).toFixed(2)}</span>
            <Badge variant="outline" className="text-[9px]">{t.ticket_status}</Badge>
          </div>
        ))}
        {(data?.tickets.length ?? 0) === 0 && <div className="text-muted-foreground">No tickets purchased</div>}
      </div>
    </div>
  );
}
