import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logAudit } from "@/lib/audit";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Archive } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/admin/ConfirmDelete";
import { EmptyState } from "@/components/admin/EmptyState";

export const Route = createFileRoute("/admin/routes")({ component: RoutesPage });

interface RouteRow {
  id: string;
  origin_station: string;
  destination_station: string;
  fare: number;
  estimated_duration: number;
  route_status: "operational" | "suspended" | "archived";
}
interface Station { id: string; station_name: string }

function RoutesPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<RouteRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<RouteRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-routes"],
    queryFn: async () => {
      const [r, s] = await Promise.all([
        supabase.from("routes").select("*").order("fare"),
        supabase.from("stations").select("id, station_name").order("station_name"),
      ]);
      if (r.error) throw r.error;
      if (s.error) throw s.error;
      return { routes: r.data as RouteRow[], stations: s.data as Station[] };
    },
  });

  const stationName = useMemo(
    () => new Map((data?.stations ?? []).map((s) => [s.id, s.station_name])),
    [data?.stations],
  );

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.routes.filter((r) => {
      if (statusFilter !== "all" && r.route_status !== statusFilter) return false;
      if (search) {
        const o = stationName.get(r.origin_station)?.toLowerCase() ?? "";
        const d = stationName.get(r.destination_station)?.toLowerCase() ?? "";
        if (!o.includes(search.toLowerCase()) && !d.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [data, search, statusFilter, stationName]);

  const setStatus = useMutation({
    mutationFn: async ({ r, status }: { r: RouteRow; status: RouteRow["route_status"] }) => {
      const { error } = await supabase.from("routes").update({ route_status: status }).eq("id", r.id);
      if (error) throw error;
      await logAudit({
        actorId: user!.id, action: `route_${status}`, entityType: "route", entityId: r.id,
        previous: { route_status: r.route_status }, next: { route_status: status },
      });
    },
    onSuccess: () => {
      toast.success("Route updated");
      qc.invalidateQueries({ queryKey: ["admin-routes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (r: RouteRow) => {
      const { error } = await supabase.from("routes").delete().eq("id", r.id);
      if (error) throw error;
      await logAudit({ actorId: user!.id, action: "route_deleted", entityType: "route", entityId: r.id, previous: r });
    },
    onSuccess: () => {
      toast.success("Route removed");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["admin-routes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Route Management</h1>
          <p className="text-xs text-muted-foreground mt-1">{data?.routes.length ?? 0} configured routes</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New route</Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <Input placeholder="Search station…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="operational">Operational</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? <Skeleton className="h-64" /> : filtered.length === 0 ? (
          <EmptyState title="No routes match" description="Adjust filters or create a new route." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Origin</TableHead><TableHead>Destination</TableHead>
                <TableHead className="text-right">Fare</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{stationName.get(r.origin_station) ?? "—"}</TableCell>
                    <TableCell>{stationName.get(r.destination_station) ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">R{Number(r.fare).toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.estimated_duration} min</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        r.route_status === "operational" ? "text-success border-success/40"
                          : r.route_status === "suspended" ? "text-warning border-warning/40"
                            : "text-muted-foreground"
                      }>{r.route_status}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                      {r.route_status !== "archived" && (
                        <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ r, status: "archived" })}>
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(r)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <RouteFormDialog
        open={creating || !!editing}
        existing={editing}
        stations={data?.stations ?? []}
        onClose={() => { setCreating(false); setEditing(null); }}
      />
      <ConfirmDelete
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        entityLabel="this route"
        busy={del.isPending}
        onConfirm={() => { if (deleting) del.mutate(deleting); }}
      />
    </div>
  );
}

function RouteFormDialog({
  open, existing, stations, onClose,
}: { open: boolean; existing: RouteRow | null; stations: Station[]; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [origin, setOrigin] = useState(existing?.origin_station ?? "");
  const [dest, setDest] = useState(existing?.destination_station ?? "");
  const [fare, setFare] = useState<number>(existing?.fare ?? 12);
  const [duration, setDuration] = useState<number>(existing?.estimated_duration ?? 20);
  const [status, setStatus] = useState<RouteRow["route_status"]>(existing?.route_status ?? "operational");

  useMemo(() => {
    setOrigin(existing?.origin_station ?? "");
    setDest(existing?.destination_station ?? "");
    setFare(existing?.fare ?? 12);
    setDuration(existing?.estimated_duration ?? 20);
    setStatus(existing?.route_status ?? "operational");
  }, [existing, open]);

  const save = useMutation({
    mutationFn: async () => {
      if (!origin || !dest) throw new Error("Select origin and destination");
      if (origin === dest) throw new Error("Origin and destination must differ");
      if (fare <= 0) throw new Error("Fare must be greater than 0");
      if (duration <= 0) throw new Error("Duration must be positive");
      if (existing) {
        const { error } = await supabase.from("routes")
          .update({ origin_station: origin, destination_station: dest, fare, estimated_duration: duration, route_status: status })
          .eq("id", existing.id);
        if (error) throw error;
        await logAudit({ actorId: user!.id, action: "route_updated", entityType: "route", entityId: existing.id, previous: existing, next: { origin, dest, fare, duration, status } });
      } else {
        const { data, error } = await supabase.from("routes")
          .insert({ origin_station: origin, destination_station: dest, fare, estimated_duration: duration, route_status: status })
          .select().single();
        if (error) {
          if (error.code === "23505") throw new Error("A route already exists between these stations");
          throw error;
        }
        await logAudit({ actorId: user!.id, action: "route_created", entityType: "route", entityId: data.id, next: data });
      }
    },
    onSuccess: () => {
      toast.success(existing ? "Route updated" : "Route created");
      qc.invalidateQueries({ queryKey: ["admin-routes"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Edit route" : "Create route"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Origin</Label>
            <Select value={origin} onValueChange={setOrigin}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {stations.map((s) => <SelectItem key={s.id} value={s.id}>{s.station_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Destination</Label>
            <Select value={dest} onValueChange={setDest}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {stations.map((s) => <SelectItem key={s.id} value={s.id}>{s.station_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Fare (ZAR)</Label>
              <Input type="number" step="0.5" value={fare} onChange={(e) => setFare(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">Duration (min)</Label>
              <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as RouteRow["route_status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="operational">Operational</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : existing ? "Save changes" : "Create route"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
