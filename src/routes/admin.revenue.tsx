import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, PieChart, Pie, Cell, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/admin/revenue")({ component: RevenuePage });

const ZAR = (n: number) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(n);

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

function RevenuePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-revenue"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const [tx, tickets, routes, stations] = await Promise.all([
        supabase.from("transactions").select("amount, transaction_status, created_at, ticket_id").gte("created_at", since),
        supabase.from("tickets").select("id, ticket_type, route_id, fare_paid, created_at").gte("created_at", since),
        supabase.from("routes").select("id, origin_station, destination_station"),
        supabase.from("stations").select("id, station_name"),
      ]);

      const ticketRoute = new Map((tickets.data ?? []).map((t) => [t.id, t.route_id]));
      const ticketTypeMap = new Map((tickets.data ?? []).map((t) => [t.id, t.ticket_type]));
      const routeOrigin = new Map((routes.data ?? []).map((r) => [r.id, r.origin_station]));
      const stationName = new Map((stations.data ?? []).map((s) => [s.id, s.station_name]));

      const succeeded = (tx.data ?? []).filter((t) => t.transaction_status === "completed");
      const failed = (tx.data ?? []).filter((t) => t.transaction_status !== "completed").length;

      // Hourly today
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: `${String(h).padStart(2, "0")}:00`, revenue: 0 }));
      succeeded
        .filter((t) => +new Date(t.created_at) >= +today)
        .forEach((t) => {
          const h = new Date(t.created_at).getHours();
          hourly[h].revenue += Number(t.amount);
        });

      // Station revenue (origin of route)
      const stationRev = new Map<string, number>();
      succeeded.forEach((t) => {
        if (!t.ticket_id) return;
        const rid = ticketRoute.get(t.ticket_id);
        if (!rid) return;
        const orig = routeOrigin.get(rid);
        if (!orig) return;
        stationRev.set(orig, (stationRev.get(orig) ?? 0) + Number(t.amount));
      });
      const stationRevArr = [...stationRev.entries()]
        .map(([id, revenue]) => ({ name: stationName.get(id) ?? "—", revenue }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Ticket type distribution (count)
      const typeCounts = new Map<string, number>();
      ticketTypeMap.forEach((tp) => typeCounts.set(tp, (typeCounts.get(tp) ?? 0) + 1));
      const typeData = [...typeCounts.entries()].map(([name, value]) => ({ name, value }));

      // Daily trend last 30
      const dailyMap = new Map<string, number>();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
        dailyMap.set(d.toISOString().slice(0, 10), 0);
      }
      succeeded.forEach((t) => {
        const k = new Date(t.created_at).toISOString().slice(0, 10);
        if (dailyMap.has(k)) dailyMap.set(k, (dailyMap.get(k) ?? 0) + Number(t.amount));
      });
      const dailyTrend = [...dailyMap.entries()].map(([date, revenue]) => ({ date: date.slice(5), revenue }));

      return {
        hourly, stationRevArr, typeData, dailyTrend,
        succeededCount: succeeded.length, failedCount: failed,
        totalRevenue: succeeded.reduce((s, t) => s + Number(t.amount), 0),
      };
    },
  });

  if (isLoading) return <Skeleton className="h-[600px]" />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Revenue Operations</h1>
        <p className="text-xs text-muted-foreground mt-1">30-day rolling window · Real settled transactions</p>
      </header>

      <div className="grid md:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Revenue (30d)</div>
          <div className="text-2xl font-semibold mt-2 text-success tabular-nums">{ZAR(data.totalRevenue)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Successful Payments</div>
          <div className="text-2xl font-semibold mt-2 tabular-nums">{data.succeededCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Declined Payments</div>
          <div className="text-2xl font-semibold mt-2 text-destructive tabular-nums">{data.failedCount}</div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Hourly Revenue (Today)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.hourly}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
              <Line type="monotone" dataKey="revenue" stroke={COLORS[0]} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">30-Day Revenue Trend</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
              <Line type="monotone" dataKey="revenue" stroke={COLORS[1]} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Top Stations by Revenue</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.stationRevArr} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="revenue" fill={COLORS[2]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Ticket Type Distribution</h2>
          {data.typeData.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-12">No tickets in window</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={data.typeData} dataKey="value" nameKey="name" outerRadius={100} label>
                  {data.typeData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}
