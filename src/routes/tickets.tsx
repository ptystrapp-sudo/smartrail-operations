import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Ticket as TicketIcon, QrCode, X } from "lucide-react";
import { format } from "date-fns";
import { QrModal } from "@/components/QrModal";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/tickets")({
  head: () => ({ meta: [{ title: "My tickets — SmartRail KZN" }] }),
  component: TicketsPage,
});

interface TicketRow {
  id: string;
  qr_token: string;
  ticket_type: string;
  ticket_status: "active" | "used" | "expired" | "cancelled";
  payment_status: string;
  fare_paid: number;
  purchase_timestamp: string;
  expiry_timestamp: string;
  validation_count: number;
  max_validations: number;
  route_id: string;
  routes: {
    estimated_duration: number;
    origin: { station_name: string } | null;
    destination: { station_name: string } | null;
  } | null;
}

function TicketsPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [openQr, setOpenQr] = useState<TicketRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<TicketRow | null>(null);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["tickets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select(`
          id, qr_token, ticket_type, ticket_status, payment_status,
          fare_paid, purchase_timestamp, expiry_timestamp,
          validation_count, max_validations, route_id,
          routes:route_id (
            estimated_duration,
            origin:origin_station ( station_name ),
            destination:destination_station ( station_name )
          )
        `)
        .order("purchase_timestamp", { ascending: false });
      if (error) throw error;
      return data as unknown as TicketRow[];
    },
  });

  // Auto-expire tickets past expiry on view (defensive client check)
  useEffect(() => {
    if (!tickets.length) return;
    const now = new Date();
    const stale = tickets.filter(t =>
      t.ticket_status === "active" && new Date(t.expiry_timestamp) < now
    );
    if (stale.length) {
      supabase.from("tickets").update({ ticket_status: "expired" })
        .in("id", stale.map(t => t.id))
        .then(() => qc.invalidateQueries({ queryKey: ["tickets", user?.id] }));
    }
  }, [tickets, user?.id, qc]);

  const handleConfirmCancel = async () => {
    if (!cancelTarget || !user) return;
    const { error } = await supabase.from("tickets").update({
      ticket_status: "cancelled",
    }).eq("id", cancelTarget.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit({
      actorId: user.id,
      action: "ticket.cancel",
      entityType: "ticket",
      entityId: cancelTarget.id,
      previous: { ticket_status: "active" },
      next: { ticket_status: "cancelled" },
    });
    toast.success("Ticket cancelled");
    setCancelTarget(null);
    qc.invalidateQueries({ queryKey: ["tickets", user?.id] });
  };

  const groups = {
    active: tickets.filter(t => t.ticket_status === "active"),
    used: tickets.filter(t => t.ticket_status === "used"),
    expired: tickets.filter(t => t.ticket_status === "expired"),
    cancelled: tickets.filter(t => t.ticket_status === "cancelled"),
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="label-uppercase">Wallet</div>
          <h1 className="text-xl font-semibold">My tickets</h1>
        </div>
        <Button asChild><Link to="/book">Book new journey</Link></Button>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active <span className="ml-1.5 text-muted-foreground">{groups.active.length}</span></TabsTrigger>
          <TabsTrigger value="used">Used <span className="ml-1.5 text-muted-foreground">{groups.used.length}</span></TabsTrigger>
          <TabsTrigger value="expired">Expired <span className="ml-1.5 text-muted-foreground">{groups.expired.length}</span></TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled <span className="ml-1.5 text-muted-foreground">{groups.cancelled.length}</span></TabsTrigger>
        </TabsList>

        {(["active", "used", "expired", "cancelled"] as const).map(key => (
          <TabsContent key={key} value={key} className="mt-4">
            {isLoading ? (
              <div className="text-sm text-muted-foreground py-12 text-center">Loading tickets…</div>
            ) : groups[key].length === 0 ? (
              <Empty label={`No ${key} tickets`} />
            ) : (
              <div className="space-y-3">
                {groups[key].map(t => (
                  <TicketCard
                    key={t.id}
                    t={t}
                    onShowQr={() => setOpenQr(t)}
                    onCancel={() => setCancelTarget(t)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <QrModal
        open={!!openQr}
        onClose={() => setOpenQr(null)}
        qrToken={openQr?.qr_token ?? null}
        ticketCode={openQr?.id.slice(0, 8).toUpperCase() ?? ""}
        routeLabel={openQr ? `${openQr.routes?.origin?.station_name ?? "—"} → ${openQr.routes?.destination?.station_name ?? "—"}` : ""}
      />

      <AlertDialog open={!!cancelTarget} onOpenChange={(v) => !v && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              The QR will be invalidated immediately and cannot be re-issued.
              This action is logged for audit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep ticket</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirm cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="panel p-12 text-center">
      <TicketIcon className="h-7 w-7 mx-auto text-muted-foreground mb-3" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function TicketCard({ t, onShowQr, onCancel }: { t: TicketRow; onShowQr: () => void; onCancel: () => void }) {
  const orig = t.routes?.origin?.station_name ?? "—";
  const dest = t.routes?.destination?.station_name ?? "—";
  const isActive = t.ticket_status === "active";
  const statusTone =
    t.ticket_status === "active" ? "bg-success" :
    t.ticket_status === "used" ? "bg-rail" :
    t.ticket_status === "cancelled" ? "bg-destructive" : "bg-muted-foreground";

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="flex items-center">
          <span className={`status-dot ${statusTone}`} />
          {t.ticket_status.toUpperCase()} · {t.ticket_type.toUpperCase()}
        </span>
        <span className="font-mono-tight">{t.id.slice(0, 8).toUpperCase()}</span>
      </div>
      <div className="p-4 grid sm:grid-cols-[1fr_auto] gap-4 items-center">
        <div>
          <div className="text-base font-semibold">{orig} → {dest}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Issued {format(new Date(t.purchase_timestamp), "dd MMM yyyy · HH:mm")} ·
            Expires {format(new Date(t.expiry_timestamp), "dd MMM yyyy · HH:mm")}
          </div>
          <div className="mt-2 text-xs flex flex-wrap gap-x-4 gap-y-1">
            <span><span className="label-uppercase mr-1">Fare</span><span className="font-mono-tight">R {Number(t.fare_paid).toFixed(2)}</span></span>
            <span><span className="label-uppercase mr-1">Used</span><span className="font-mono-tight">{t.validation_count} / {t.max_validations}</span></span>
            <span><span className="label-uppercase mr-1">Payment</span><span className="font-mono-tight">{t.payment_status}</span></span>
          </div>
        </div>
        <div className="flex sm:flex-col gap-2 sm:items-end">
          {isActive && (
            <>
              <Button size="sm" onClick={onShowQr}><QrCode className="h-4 w-4 mr-1" />Show QR</Button>
              <Button size="sm" variant="outline" onClick={onCancel}><X className="h-4 w-4 mr-1" />Cancel</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
