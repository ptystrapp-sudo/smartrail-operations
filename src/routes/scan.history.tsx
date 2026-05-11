import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { format } from "date-fns";

export const Route = createFileRoute("/scan/history")({
  head: () => ({ meta: [{ title: "Scan history — SmartRail KZN" }] }),
  component: HistoryPage,
});

interface LogRow {
  id: string;
  scan_timestamp: string;
  validation_result: "valid" | "invalid" | "overridden";
  failure_reason: string | null;
  override_used: boolean;
  override_reason: string | null;
  qr_token_attempted: string | null;
  ticket_id: string | null;
}

function HistoryPage() {
  const { user, loading, isStaff } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && (!user || !isStaff)) nav({ to: "/login" });
  }, [user, loading, isStaff, nav]);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["scan-history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("validation_logs")
        .select("id, scan_timestamp, validation_result, failure_reason, override_used, override_reason, qr_token_attempted, ticket_id")
        .order("scan_timestamp", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as LogRow[];
    },
  });

  const stats = {
    total: logs.length,
    valid: logs.filter(l => l.validation_result === "valid").length,
    invalid: logs.filter(l => l.validation_result === "invalid").length,
    overridden: logs.filter(l => l.validation_result === "overridden").length,
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="label-uppercase">Operations</div>
        <h1 className="text-xl font-semibold">Validation log</h1>
      </div>

      <div className="grid sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Total scans" value={stats.total} />
        <Stat label="Valid" value={stats.valid} tone="success" />
        <Stat label="Invalid" value={stats.invalid} tone="destructive" />
        <Stat label="Overridden" value={stats.overridden} tone="warning" />
      </div>

      <div className="panel">
        <div className="panel-header"><span>Recent activity (last 200)</span></div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No scans yet</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left p-2 pl-4">Timestamp</th>
                  <th className="text-left p-2">Result</th>
                  <th className="text-left p-2">Ticket</th>
                  <th className="text-left p-2">Reason / Notes</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} className="border-b border-border/60">
                    <td className="p-2 pl-4 font-mono-tight text-xs">
                      {format(new Date(l.scan_timestamp), "dd MMM HH:mm:ss")}
                    </td>
                    <td className="p-2">
                      <span className={`text-xs font-mono-tight ${
                        l.validation_result === "valid" ? "text-success" :
                        l.validation_result === "overridden" ? "text-warning" : "text-destructive"
                      }`}>
                        ● {l.validation_result.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-2 font-mono-tight text-xs">
                      {l.ticket_id?.slice(0, 8).toUpperCase() ?? "—"}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {l.override_reason ? `Override: ${l.override_reason}` : (l.failure_reason ?? "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "destructive" | "warning" }) {
  const cls = tone === "success" ? "text-success"
    : tone === "destructive" ? "text-destructive"
    : tone === "warning" ? "text-warning" : "";
  return (
    <div className="panel p-4">
      <div className="label-uppercase">{label}</div>
      <div className={`text-2xl font-semibold font-mono-tight mt-1 ${cls}`}>{value}</div>
    </div>
  );
}
