import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";
import { Download, FileJson } from "lucide-react";

export const Route = createFileRoute("/admin/audit")({ component: AuditPage });

interface Audit {
  id: string;
  created_at: string;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  actor_id: string | null;
  previous_value: unknown;
  new_value: unknown;
}

function AuditPage() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const PAGE = 25;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const [logs, profiles] = await Promise.all([
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(1000),
        supabase.from("profiles").select("id, full_name, email"),
      ]);
      const profMap = new Map((profiles.data ?? []).map((p) => [p.id, p]));
      return { logs: (logs.data ?? []) as Audit[], profMap };
    },
  });

  const actions = useMemo(() => {
    const set = new Set<string>();
    (data?.logs ?? []).forEach((l) => set.add(l.action_type));
    return [...set].sort();
  }, [data?.logs]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.logs.filter((l) => {
      if (actionFilter !== "all" && l.action_type !== actionFilter) return false;
      if (from && new Date(l.created_at) < new Date(from)) return false;
      if (to && new Date(l.created_at) > new Date(to + "T23:59:59")) return false;
      if (search) {
        const term = search.toLowerCase();
        const actor = data.profMap.get(l.actor_id ?? "");
        const matches =
          l.action_type.toLowerCase().includes(term) ||
          l.entity_type.toLowerCase().includes(term) ||
          (actor?.full_name ?? "").toLowerCase().includes(term) ||
          (actor?.email ?? "").toLowerCase().includes(term);
        if (!matches) return false;
      }
      return true;
    });
  }, [data, actionFilter, from, to, search]);

  const paged = filtered.slice(page * PAGE, (page + 1) * PAGE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));

  const exportCsv = () => {
    const rows = [
      ["timestamp", "actor", "action", "entity_type", "entity_id", "previous", "new"],
      ...filtered.map((l) => {
        const a = data!.profMap.get(l.actor_id ?? "");
        return [
          l.created_at,
          a?.email ?? l.actor_id ?? "",
          l.action_type,
          l.entity_type,
          l.entity_id ?? "",
          JSON.stringify(l.previous_value ?? ""),
          JSON.stringify(l.new_value ?? ""),
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    download(csv, "audit_logs.csv", "text/csv");
  };

  const exportJson = () => {
    download(JSON.stringify(filtered, null, 2), "audit_logs.json", "application/json");
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Audit Log Viewer</h1>
        <p className="text-xs text-muted-foreground mt-1">Immutable record of every operational change · {filtered.length} events</p>
      </header>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <Input placeholder="Search actor / entity / action…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="max-w-xs" />
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-3.5 w-3.5" /> CSV</Button>
            <Button size="sm" variant="outline" onClick={exportJson}><FileJson className="h-3.5 w-3.5" /> JSON</Button>
          </div>
        </div>

        {isLoading ? <Skeleton className="h-96" /> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Diff</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((l) => {
                  const actor = data!.profMap.get(l.actor_id ?? "");
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono-tight text-xs whitespace-nowrap">
                        {new Date(l.created_at).toLocaleString("en-ZA", { hour12: false })}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>{actor?.full_name ?? "system"}</div>
                        <div className="text-muted-foreground">{actor?.email ?? l.actor_id?.slice(0, 8)}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{l.action_type}</Badge></TableCell>
                      <TableCell className="text-xs">
                        <div>{l.entity_type}</div>
                        <div className="text-muted-foreground font-mono">{l.entity_id?.slice(0, 8)}</div>
                      </TableCell>
                      <TableCell className="text-[11px] max-w-md truncate">
                        {l.previous_value ? <span className="text-destructive">−{JSON.stringify(l.previous_value).slice(0, 80)}</span> : null}
                        {l.previous_value && l.new_value ? <br /> : null}
                        {l.new_value ? <span className="text-success">+{JSON.stringify(l.new_value).slice(0, 80)}</span> : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {paged.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">No audit events match</TableCell></TableRow>
                )}
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
    </div>
  );
}

function download(content: string, name: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
