import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/admin/passengers")({ component: PassengerPage });

function PassengerPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-passengers"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const since30 = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const [vlogs, stations, routes, profiles] = await Promise.all([
        supabase.from("validation_logs").select("scan_timestamp, station_id, validation_result, ticket_id").gte("scan_timestamp", since30),
        supabase.from("stations").select("id, station_name, daily_capacity"),
        supabase.from("routes").select("id, origin_station, destination_station"),
        supabase.from("profiles").select("id, created_at"),
      ]);

      const stationMap = new Map((stations.data ?? []).map((s) => [s.id, s]));
      const tickets = await supabase
        .from("tickets")
        .select("id, route_id")
        .in("id", (vlogs.data ?? []).map((v) => v.ticket_id).filter((x): x is string => !!x));
      const ticketRoute = new Map((tickets.data ?? []).map((t) => [t.id, t.route_id]));

      // Peak hours
      const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: `${String(h).padStart(2, "0")}`, scans: 0 }));
      (vlogs.data ?? []).forEach((v) => { hourly[new Date(v.scan_timestamp).getHours()].scans++; });

      // Station usage
      const stationCounts = new Map<string, number>();
      (vlogs.data ?? []).forEach((v) => {
        if (v.station_id) stationCounts.set(v.station_id, (stationCounts.get(v.station_id) ?? 0) + 1);
      });
      const stationUsage = [...stationCounts.entries()]
        .map(([id, count]) => {
          const s = stationMap.get(id);
          const cap = (s?.daily_capacity ?? 5000) * 30;
          return { name: s?.station_name ?? "—", scans: count, utilization: Math.min(100, Math.round((count / cap) * 100 * 10) / 10) };
        })
        .sort((a, b) => b.scans - a.scans)
        .slice(0, 12);

      // Busiest routes (by validations)
      const routeCounts = new Map<string, number>();
      (vlogs.data ?? []).forEach((v) => {
        if (!v.ticket_id) return;
        const rid = ticketRoute.get(v.ticket_id);
        if (!rid) return;
        routeCounts.set(rid, (routeCounts.get(rid) ?? 0) + 1);
      });
      const routesArr = (routes.data ?? []);
      const routeNames = new Map(routesArr.map((r) => {
        const o = stationMap.get(r.origin_station)?.station_name ?? "—";
        const d = stationMap.get(r.destination_station)?.station_name ?? "—";
        return [r.id, `${o} → ${d}`];
      }));
      const busiestRoutes = [...routeCounts.entries()]
        .map(([id, count]) => ({ name: routeNames.get(id) ?? "—", count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      // Commuter growth (per day)
      const growthMap = new Map<string, number>();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
        growthMap.set(d.toISOString().slice(0, 10), 0);
      }
      (profiles.data ?? []).forEach((p) => {
        const k = new Date(p.created_at).toISOString().slice(0, 10);
        if (growthMap.has(k)) growthMap.set(k, (growthMap.get(k) ?? 0) + 1);
      });
      const growth = [...growthMap.entries()].map(([date, signups]) => ({ date: date.slice(5), signups }));

      return { hourly, stationUsage, busiestRoutes, growth };
    },
  });

  if (isLoading) return <Skeleton className="h-[600px]" />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Passenger Analytics</h1>
        <p className="text-xs text-muted-foreground mt-1">Commuter flow & station utilization · 30-day window</p>
      </header>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Peak Travel Hours</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.hourly}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="scans" fill="hsl(var(--chart-1))" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Busiest Routes</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.busiestRoutes} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={160} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="count" fill="hsl(var(--chart-2))" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold mb-3">Station Utilization Heatmap</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {data.stationUsage.map((s) => {
              const intensity = Math.min(1, s.utilization / 100);
              const bg = `oklch(0.4 ${0.05 + 0.15 * intensity} 25 / ${0.2 + 0.7 * intensity})`;
              return (
                <div key={s.name} className="rounded-md p-3 border border-border" style={{ background: bg }}>
                  <div className="text-xs font-medium truncate">{s.name}</div>
                  <div className="text-lg font-semibold tabular-nums">{s.scans}</div>
                  <div className="text-[10px] text-muted-foreground">{s.utilization}% util</div>
                </div>
              );
            })}
            {data.stationUsage.length === 0 && (
              <div className="col-span-full text-center text-xs text-muted-foreground py-6">No validation activity</div>
            )}
          </div>
        </Card>

        <Card className="p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold mb-3">Commuter Growth (30d)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.growth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="signups" fill="hsl(var(--chart-3))" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
