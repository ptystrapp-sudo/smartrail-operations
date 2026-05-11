import { supabase } from "@/integrations/supabase/client";

export type ValidationOutcome =
  | { ok: true; ticketId: string; ticketCode: string; route: string; type: string }
  | { ok: false; reason: string; ticketId?: string; route?: string; ticketCode?: string };

interface ValidateOpts {
  qrToken: string;
  scannedBy: string;
  stationId?: string | null;
}

/**
 * Core validation logic. Atomic-ish:
 * 1. Look up ticket by qr_token
 * 2. Run business rules
 * 3. If valid, increment validation_count, mark used if at max
 * 4. Record validation_log + audit_log
 */
export async function validateTicket({ qrToken, scannedBy, stationId }: ValidateOpts): Promise<ValidationOutcome> {
  const recordLog = async (
    result: "valid" | "invalid",
    reason: string | null,
    ticketId: string | null
  ) => {
    await supabase.from("validation_logs").insert({
      ticket_id: ticketId,
      scanned_by: scannedBy,
      station_id: stationId ?? null,
      validation_result: result,
      failure_reason: reason,
      qr_token_attempted: qrToken,
    });
  };

  if (!qrToken || qrToken.length < 8) {
    await recordLog("invalid", "invalid token format", null);
    return { ok: false, reason: "Invalid QR format" };
  }

  const { data: t, error } = await supabase
    .from("tickets")
    .select(`
      id, ticket_status, payment_status, expiry_timestamp, ticket_type,
      validation_count, max_validations,
      routes:route_id (
        origin:origin_station ( station_name ),
        destination:destination_station ( station_name )
      )
    `)
    .eq("qr_token", qrToken)
    .maybeSingle();

  if (error || !t) {
    await recordLog("invalid", "ticket not found", null);
    return { ok: false, reason: "Ticket not found in system" };
  }

  const routeLabel = `${(t.routes as unknown as { origin: { station_name: string } | null })?.origin?.station_name ?? "—"} → ${(t.routes as unknown as { destination: { station_name: string } | null })?.destination?.station_name ?? "—"}`;
  const ticketCode = t.id.slice(0, 8).toUpperCase();

  if (t.payment_status !== "completed") {
    await recordLog("invalid", "payment not completed", t.id);
    return { ok: false, reason: "Payment not completed", ticketId: t.id, route: routeLabel, ticketCode };
  }
  if (t.ticket_status === "cancelled") {
    await recordLog("invalid", "ticket cancelled", t.id);
    return { ok: false, reason: "Ticket has been cancelled", ticketId: t.id, route: routeLabel, ticketCode };
  }
  if (t.ticket_status === "used") {
    await recordLog("invalid", "already used", t.id);
    return { ok: false, reason: "Ticket already fully used", ticketId: t.id, route: routeLabel, ticketCode };
  }
  if (new Date(t.expiry_timestamp) < new Date()) {
    await supabase.from("tickets").update({ ticket_status: "expired" }).eq("id", t.id);
    await recordLog("invalid", "expired", t.id);
    return { ok: false, reason: "Ticket expired", ticketId: t.id, route: routeLabel, ticketCode };
  }

  // Valid — increment usage
  const newCount = t.validation_count + 1;
  const newStatus = newCount >= t.max_validations ? "used" : "active";
  const { error: updErr } = await supabase
    .from("tickets")
    .update({ validation_count: newCount, ticket_status: newStatus })
    .eq("id", t.id)
    .eq("validation_count", t.validation_count); // optimistic concurrency
  if (updErr) {
    await recordLog("invalid", "concurrent update conflict", t.id);
    return { ok: false, reason: "Duplicate scan detected", ticketId: t.id, route: routeLabel, ticketCode };
  }

  await recordLog("valid", null, t.id);
  await supabase.from("audit_logs").insert({
    actor_id: scannedBy,
    action_type: "ticket.validate",
    entity_type: "ticket",
    entity_id: t.id,
    new_value: { validation_count: newCount, ticket_status: newStatus } as never,
  });

  return { ok: true, ticketId: t.id, ticketCode, route: routeLabel, type: t.ticket_type };
}

/** Supervisor override — accept a previously-rejected ticket. */
export async function overrideValidation(opts: {
  ticketId: string;
  scannedBy: string;
  stationId?: string | null;
  reason: string;
  qrToken: string;
}) {
  await supabase.from("validation_logs").insert({
    ticket_id: opts.ticketId,
    scanned_by: opts.scannedBy,
    station_id: opts.stationId ?? null,
    validation_result: "overridden",
    override_used: true,
    override_reason: opts.reason,
    qr_token_attempted: opts.qrToken,
  });
  await supabase.from("audit_logs").insert({
    actor_id: opts.scannedBy,
    action_type: "ticket.override",
    entity_type: "ticket",
    entity_id: opts.ticketId,
    new_value: { reason: opts.reason } as never,
  });
}
