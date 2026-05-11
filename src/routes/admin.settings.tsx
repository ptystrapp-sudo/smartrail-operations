import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logAudit } from "@/lib/audit";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

interface Setting { id: string; key: string; value: unknown; description: string | null }

function SettingsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*").order("key");
      if (error) throw error;
      return data as Setting[];
    },
  });

  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (data) {
      const init: Record<string, string> = {};
      data.forEach((s) => { init[s.key] = JSON.stringify(s.value); });
      setDraft(init);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async (s: Setting) => {
      let parsed: unknown;
      try { parsed = JSON.parse(draft[s.key]); }
      catch { throw new Error(`Invalid JSON value for ${s.key}`); }
      // Type validation per key
      if (s.key.endsWith("_hours") || s.key.endsWith("_minutes") || s.key.endsWith("_seconds")) {
        if (typeof parsed !== "number" || parsed < 0) throw new Error("Must be a non-negative number");
      }
      if (s.key === "maintenance_mode" || s.key === "refund_eligible") {
        if (typeof parsed !== "boolean") throw new Error("Must be true or false");
      }
      const { error } = await supabase.from("app_settings")
        .update({ value: parsed as never, updated_by: user!.id }).eq("id", s.id);
      if (error) throw error;
      await logAudit({
        actorId: user!.id, action: "setting_updated", entityType: "app_setting",
        entityId: s.id, previous: { [s.key]: s.value }, next: { [s.key]: parsed },
      });
    },
    onSuccess: () => {
      toast.success("Setting persisted");
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-4 max-w-3xl">
      <header>
        <h1 className="text-xl font-semibold">Operational Settings</h1>
        <p className="text-xs text-muted-foreground mt-1">Network-wide rules. Changes persist to the database and audit log instantly.</p>
      </header>

      <div className="space-y-3">
        {(data ?? []).map((s) => {
          const isBool = typeof s.value === "boolean";
          const draftVal = draft[s.key] ?? "";
          return (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <Label className="text-sm font-medium font-mono-tight">{s.key}</Label>
                  {s.description && <p className="text-xs text-muted-foreground mt-1">{s.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {isBool ? (
                    <Switch
                      checked={draftVal === "true"}
                      onCheckedChange={(v) => setDraft((d) => ({ ...d, [s.key]: String(v) }))}
                    />
                  ) : (
                    <Input
                      className="w-56 font-mono-tight text-xs"
                      value={draftVal}
                      onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))}
                    />
                  )}
                  <Button size="sm" onClick={() => save.mutate(s)} disabled={save.isPending}>Save</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
