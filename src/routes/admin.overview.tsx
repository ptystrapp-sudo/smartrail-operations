import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/admin/KpiCard";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign, Ticket, CheckCircle2, XCircle, Activity, MapPin, ScanLine, Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/overview")({
  component: OverviewPage,
});

const ZAR = (n: number) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 2 }).format(n);

function startOfDayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function OverviewPage() {
  const today = startOfDayISO();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview", today],
    refetchInterval: 15_000,
    queryFn: async () => {
      const [tx, ticketsActive, ticketsUsed, vlogsToday, vlogsFailed, totalCommuters, stations] =
        await Promise.all([
          supabase
            .from("transactions")
            .select("amount, transaction_status, created_at")
            .gte("created_at", today)
            .eq("transaction_status", "completed"),
          supabase.from("tickets").select("id", { count: "exact", head: true }).eq("ticket_status", "active"),
          supabase
            .from("tickets")
            .select("id", { count: "exact", head: true })
            .eq("ticket_status", "used")
            .gte("activation_timestamp", today),
          supabase.from("validation_logs").select("id, station_id, validation_result").gte("scan_timestamp", today),
          supabase
            .from("validation_logs")
            .select("id", { count: "exact", head: true })
            .neq("validation_result", "valid")
            .gte("scan_timestamp", today),
          supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "commuter"),
          supabase.from("stations").select("id, station_name").eq("active_status", true),
        ]);

      const stationMap = new Map((stations.data ?? []).map((s) => [s.id, s.station_name]));
      const dailyRevenue = (tx.data ?? []).reduce((s, t) => s + Number(t.amount), 0);

      const stationCounts = new Map<string, number>();
      (vlogsToday.data ?? []).forEach((v) => {
        if (!v.station_id) return;
        stationCounts.set(v.station_id, (stationCounts.get(v.station_id) ?? 0) + 1);
      });
      let busiest: { name: string; count: number } | null = null;
      stationCounts.forEach((count, id) => {
        if (!busiest || count > busiest.count) {
          busiest = { name: stationMap.get(id) ?? "Unknown", count };
        }
      });

      const totalScans = (vlogsToday.data ?? []).length;
      const adoption =
        (ticketsUsed.count ?? 0) === 0
          ? 0
          : Math.round(((ticketsUsed.count ?? 0) / Math.max(1, totalScans)) * 100);

      return {
        dailyRevenue,
        activeTickets: ticketsActive.count ?? 0,
        usedToday: ticketsUsed.count ?? 0,
        failedScans: vlogsFailed.count ?? 0,
        totalScans,
        commuters: totalCommuters.count ?? 0,
        busiest,
        adoption,
      };
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Operational Overview</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Live network telemetry · Auto-refreshes every 15s
        </p>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Daily Revenue" value={ZAR(data!.dailyRevenue)} icon={<DollarSign className="h-4 w-4" />} hint="Settled transactions today" tone="success" />
          <KpiCard label="Active Tickets" value={data!.activeTickets} icon={<Ticket className="h-4 w-4" />} hint="In commuter wallets" />
          <KpiCard label="Used Today" value={data!.usedToday} icon={<CheckCircle2 className="h-4 w-4" />} hint="Validated at gates" />
          <KpiCard label="Failed Validations" value={data!.failedScans} icon={<XCircle className="h-4 w-4" />} hint="Rejected scans today" tone={data!.failedScans > 5 ? "destructive" : "default"} />
          <KpiCard label="Digital Adoption" value={`${data!.adoption}%`} icon={<Activity className="h-4 w-4" />} hint="Used / total scans" />
          <KpiCard label="Busiest Station" value={data!.busiest?.name ?? "—"} icon={<MapPin className="h-4 w-4" />} hint={data!.busiest ? `${data!.busiest.count} scans` : "No scans yet"} />
          <KpiCard label="Total Scans" value={data!.totalScans} icon={<ScanLine className="h-4 w-4" />} hint="Validation attempts today" />
          <KpiCard label="Active Commuters" value={data!.commuters} icon={<Users className="h-4 w-4" />} hint="Registered passengers" />
        </div>
      )}

      <LiveFeed />
    </div>
  );
}

interface FeedEvent {
  id: string;
  ts: string;
  kind: string;
  who?: string;
  station?: string;
  status: "success" | "warning" | "destructive" | "default";
  detail: string;
}

function LiveFeed() {
  const [events, setEvents] = useState<FeedEvent[]>([]);

  // Initial load from audit + validation logs
  const { data: initial } = useQuery({
    queryKey: ["admin-feed-initial"],
    queryFn: async () => {
      const [audit, vlogs, stations] = await Promise.all([
        supabase
          .from("audit_logs")
          .select("id, action_type, entity_type, created_at, actor_id")
          .order("created_at", { ascending: false })
          .limit(25),
        supabase
          .from("validation_logs")
          .select("id, scan_timestamp, validation_result, station_id, override_used, failure_reason, scanned_by")
          .order("scan_timestamp", { ascending: false })
          .limit(25),
        supabase.from("stations").select("id, station_name"),
      ]);
      const stationMap = new Map((stations.data ?? []).map((s) => [s.id, s.station_name]));

      const fromAudit: FeedEvent[] = (audit.data ?? []).map((a) => ({
        id: `a-${a.id}`,
        ts: a.created_at,
        kind: a.action_type,
        status:
          a.action_type.includes("cancel") || a.action_type.includes("override")
            ? "warning"
            : a.action_type.includes("delete")
              ? "destructive"
              : "success",
        detail: `${a.entity_type} · ${a.action_type}`,
      }));

      const fromVlogs: FeedEvent[] = (vlogs.data ?? []).map((v) => ({
        id: `v-${v.id}`,
        ts: v.scan_timestamp,
        kind: v.override_used ? "supervisor_override" : v.validation_result,
        station: v.station_id ? stationMap.get(v.station_id) : undefined,
        status:
          v.validation_result === "valid"
            ? v.override_used ? "warning" : "success"
            : "destructive",
        detail: v.failure_reason ?? (v.override_used ? "Override accepted" : "Validation success"),
      }));

      return [...fromAudit, ...fromVlogs]
        .sort((a, b) => +new Date(b.ts) - +new Date(a.ts))
        .slice(0, 40);
    },
  });

  useEffect(() => {
    if (initial) setEvents(initial);
  }, [initial]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("ops-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "validation_logs" }, (p) => {
        const v = p.new as {
          id: string; scan_timestamp: string; validation_result: string;
          override_used: boolean; failure_reason: string | null;
        };
        setEvents((prev) =>
          [
            {
              id: `v-${v.id}`,
              ts: v.scan_timestamp,
              kind: v.override_used ? "supervisor_override" : v.validation_result,
              status: v.validation_result === "valid"
                ? v.override_used ? "warning" : "success"
                : "destructive",
              detail: v.failure_reason ?? (v.override_used ? "Override accepted" : "Validation success"),
            } as FeedEvent,
            ...prev,
          ].slice(0, 40),
        );
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_logs" }, (p) => {
        const a = p.new as { id: string; action_type: string; entity_type: string; created_at: string };
        setEvents((prev) =>
          [
            {
              id: `a-${a.id}`,
              ts: a.created_at,
              kind: a.action_type,
              status: a.action_type.includes("cancel") || a.action_type.includes("override")
                ? "warning"
                : a.action_type.includes("delete")
                  ? "destructive"
                  : "success",
              detail: `${a.entity_type} · ${a.action_type}`,
            } as FeedEvent,
            ...prev,
          ].slice(0, 40),
        );
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Live Operational Feed</h2>
        <span className="text-[11px] text-muted-foreground font-mono-tight">
          <span className="status-dot bg-success" /> STREAMING
        </span>
      </div>
      <div className="divide-y divide-border max-h-[480px] overflow-y-auto">
        {events.length === 0 && (
          <div className="text-sm text-muted-foreground py-6 text-center">
            Awaiting network activity…
          </div>
        )}
        {events.map((e) => (
          <div key={e.id} className="py-2 flex items-center gap-3 text-sm">
            <span className="font-mono-tight text-[11px] text-muted-foreground w-20">
              {new Date(e.ts).toLocaleTimeString("en-ZA", { hour12: false })}
            </span>
            <Badge
              variant="outline"
              className={
                e.status === "success"
                  ? "text-success border-success/40"
                  : e.status === "warning"
                    ? "text-warning border-warning/40"
                    : e.status === "destructive"
                      ? "text-destructive border-destructive/40"
                      : ""
              }
            >
              {e.kind}
            </Badge>
            <span className="text-xs text-muted-foreground flex-1 truncate">{e.detail}</span>
            {e.station && (
              <span className="text-[11px] text-muted-foreground hidden sm:inline">{e.station}</span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
