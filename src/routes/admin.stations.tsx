import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logAudit } from "@/lib/audit";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo } from "react";
import { Plus, Pencil, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/admin/ConfirmDelete";
import { EmptyState } from "@/components/admin/EmptyState";

export const Route = createFileRoute("/admin/stations")({ component: StationsPage });

interface Station {
  id: string;
  station_name: string;
  region: string;
  daily_capacity: number;
  active_status: boolean;
}

function StationsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Station | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Station | null>(null);
  const PAGE = 10;

  const { data: stations = [], isLoading } = useQuery({
    queryKey: ["admin-stations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stations").select("*").order("station_name");
      if (error) throw error;
      return data as Station[];
    },
  });

  const filtered = useMemo(
    () =>
      stations.filter(
        (s) =>
          s.station_name.toLowerCase().includes(search.toLowerCase()) ||
          s.region.toLowerCase().includes(search.toLowerCase()),
      ),
    [stations, search],
  );
  const paged = filtered.slice(page * PAGE, (page + 1) * PAGE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));

  const toggleActive = useMutation({
    mutationFn: async (s: Station) => {
      const next = !s.active_status;
      const { error } = await supabase.from("stations").update({ active_status: next }).eq("id", s.id);
      if (error) throw error;
      await logAudit({
        actorId: user!.id,
        action: next ? "station_reactivated" : "station_deactivated",
        entityType: "station",
        entityId: s.id,
        previous: { active_status: s.active_status },
        next: { active_status: next },
      });
    },
    onSuccess: () => {
      toast.success("Station status updated");
      qc.invalidateQueries({ queryKey: ["admin-stations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (s: Station) => {
      const { error } = await supabase.from("stations").delete().eq("id", s.id);
      if (error) throw error;
      await logAudit({
        actorId: user!.id,
        action: "station_deleted",
        entityType: "station",
        entityId: s.id,
        previous: s,
      });
    },
    onSuccess: () => {
      toast.success("Station permanently removed");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["admin-stations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Station Management</h1>
          <p className="text-xs text-muted-foreground mt-1">{stations.length} stations on the network</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New station</Button>
      </div>

      <Card className="p-4">
        <Input
          placeholder="Search by name or region…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="max-w-sm mb-3"
        />
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : paged.length === 0 ? (
          <EmptyState
            title="No stations match the current filter"
            description="Adjust the search or create a new station to add it to the operational network."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Station</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead className="text-right">Daily Capacity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.station_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.region}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.daily_capacity.toLocaleString()}</TableCell>
                    <TableCell>
                      {s.active_status
                        ? <Badge variant="outline" className="text-success border-success/40">operational</Badge>
                        : <Badge variant="outline" className="text-muted-foreground">offline</Badge>}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleActive.mutate(s)}><Power className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(s)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            <span>Page {page + 1} of {totalPages}</span>
            <div className="space-x-2">
              <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      <StationFormDialog
        open={creating || !!editing}
        existing={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
      />

      <ConfirmDelete
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        entityLabel={deleting?.station_name ?? "this station"}
        busy={del.isPending}
        onConfirm={() => { if (deleting) del.mutate(deleting); }}
      />
    </div>
  );
}

function StationFormDialog({
  open, existing, onClose,
}: { open: boolean; existing: Station | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [name, setName] = useState(existing?.station_name ?? "");
  const [region, setRegion] = useState(existing?.region ?? "");
  const [capacity, setCapacity] = useState(existing?.daily_capacity ?? 5000);
  const [active, setActive] = useState(existing?.active_status ?? true);

  // Reset form when dialog reopens
  useMemo(() => {
    setName(existing?.station_name ?? "");
    setRegion(existing?.region ?? "");
    setCapacity(existing?.daily_capacity ?? 5000);
    setActive(existing?.active_status ?? true);
  }, [existing, open]);

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !region.trim()) throw new Error("Name and region are required");
      if (capacity < 1) throw new Error("Capacity must be greater than zero");
      if (existing) {
        const { error } = await supabase.from("stations")
          .update({ station_name: name.trim(), region: region.trim(), daily_capacity: capacity, active_status: active })
          .eq("id", existing.id);
        if (error) throw error;
        await logAudit({
          actorId: user!.id, action: "station_updated", entityType: "station", entityId: existing.id,
          previous: existing, next: { station_name: name, region, daily_capacity: capacity, active_status: active },
        });
      } else {
        const { data, error } = await supabase.from("stations")
          .insert({ station_name: name.trim(), region: region.trim(), daily_capacity: capacity, active_status: active })
          .select().single();
        if (error) throw error;
        await logAudit({ actorId: user!.id, action: "station_created", entityType: "station", entityId: data.id, next: data });
      }
    },
    onSuccess: () => {
      toast.success(existing ? "Station updated" : "Station created");
      qc.invalidateQueries({ queryKey: ["admin-stations"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Edit station" : "Create station"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Station name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Durban Central" />
          </div>
          <div>
            <Label className="text-xs">Region</Label>
            <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. eThekwini" />
          </div>
          <div>
            <Label className="text-xs">Daily capacity</Label>
            <Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Operational</Label>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : existing ? "Save changes" : "Create station"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
