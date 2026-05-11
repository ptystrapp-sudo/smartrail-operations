import { supabase } from "@/integrations/supabase/client";

export async function logAudit(opts: {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  previous?: unknown;
  next?: unknown;
}) {
  await supabase.from("audit_logs").insert({
    actor_id: opts.actorId,
    action_type: opts.action,
    entity_type: opts.entityType,
    entity_id: opts.entityId ?? null,
    previous_value: (opts.previous ?? null) as never,
    new_value: (opts.next ?? null) as never,
  });
}
