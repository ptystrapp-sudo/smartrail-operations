import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/admin/validation")({ component: ValidationPage });

function ValidationPage() {
  const [stationId, setStationId] = useState<string>("all");
  const [result, setResult] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-vlogs"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const [vlogs, stations, profiles] = await Promise.all([
        supabase
          .from("validation_logs")
          .select("id, scan_timestamp, validation_result, station_id, scanned_by, override_used, failure_reason, qr_token_attempted")
          .gte("scan_timestamp", since)
          .order("scan_timestamp", { ascending: false })
          .limit(500),
        supabase.from("stations").select("id, station_name"),
        supabase.from("profiles").select("id, full_name"),
      ]);
      return {
        vlogs: vlogs.data ?? [],
        stations: stations.data ?? [],
        profileMap: new Map((profiles.data ?? []).map((p) => [p.id, p.full_name])),
      };
    },
  });

  const stationMap = useMemo(
    () => new Map((data?.stations ?? []).map((s) => [s.id, s.station_name])),
    [data?.stations],
  );

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.vlogs.filter((v) => {
      if (stationId !== "all" && v.station_id !== stationId) return false;
      if (result !== "all") {
        if (result === "override" && !v.override_used) return false;
        else if (result !== "override" && v.validation_result !== result) return false;
      }
      if (search) {
        const term = search.toLowerCase();
        const station = stationMap.get(v.station_id ?? "")?.toLowerCase() ?? "";
        const staff = data.profileMap.get(v.scanned_by ?? "")?.toLowerCase() ?? "";
        if (!station.includes(term) && !staff.includes(term) && !(v.failure_reason ?? "").toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }, [data, stationId, result, search, stationMap]);

  const stats = useMemo(() => {
    const s = { success: 0, failed: 0, override: 0, expired: 0, duplicate: 0 };
    (data?.vlogs ?? []).forEach((v) => {
      if (v.override_used) s.override++;
      if (v.validation_result === "success") s.success++;
      else s.failed++;
      if (v.failure_reason?.toLowerCase().includes("expir")) s.expired++;
      if (v.failure_reason?.toLowerCase().includes("already") || v.failure_reason?.toLowerCase().includes("max")) s.duplicate++;
    });
    return s;
  }, [data?.vlogs]);

  const failureRate = data?.vlogs.length ? Math.round((stats.failed / data.vlogs.length) * 100) : 0;
  const congested = failureRate > 25;

  if (isLoading) return <Skeleton className="h-[600px]" />;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Validation Monitoring</h1>
        <p className="text-xs text-muted-foreground mt-1">Live gate-validation throughput · Last 7 days · Auto-refresh 15s</p>
      </header>

      {congested && (
        <div className="border border-destructive/50 bg-destructive/10 rounded-md p-3 flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span>Abnormal failure rate detected: <b>{failureRate}%</b> of validations rejected. Investigate gates.</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { l: "Successful", v: stats.success, t: "text-success" },
          { l: "Failed", v: stats.failed, t: "text-destructive" },
          { l: "Overrides", v: stats.override, t: "text-warning" },
          { l: "Expired Attempts", v: stats.expired, t: "" },
          { l: "Duplicate Scans", v: stats.duplicate, t: "" },
        ].map((c) => (
          <Card key={c.l} className="p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{c.l}</div>
            <div className={`text-2xl font-semibold mt-2 tabular-nums ${c.t}`}>{c.v}</div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <Input placeholder="Search station, staff, reason…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={stationId} onValueChange={setStationId}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Station" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stations</SelectItem>
              {(data?.stations ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.station_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={result} onValueChange={setResult}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Result" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All results</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="override">Overrides only</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} events</span>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Station</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 200).map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono-tight text-xs whitespace-nowrap">
                    {new Date(v.scan_timestamp).toLocaleString("en-ZA", { hour12: false })}
                  </TableCell>
                  <TableCell>
                    {v.override_used ? (
                      <Badge variant="outline" className="text-warning border-warning/40">override</Badge>
                    ) : v.validation_result === "success" ? (
                      <Badge variant="outline" className="text-success border-success/40">success</Badge>
                    ) : (
                      <Badge variant="outline" className="text-destructive border-destructive/40">{v.validation_result}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{stationMap.get(v.station_id ?? "") ?? "—"}</TableCell>
                  <TableCell className="text-xs">{data?.profileMap.get(v.scanned_by ?? "") ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{v.failure_reason ?? (v.override_used ? "Supervisor override" : "Validated")}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">No matching validation events</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
