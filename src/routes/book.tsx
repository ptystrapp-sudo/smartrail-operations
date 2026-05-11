import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { TICKET_TYPE_META, calcFare, calcExpiry, type TicketTypeKey } from "@/lib/fares";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/book")({
  head: () => ({ meta: [{ title: "Book a journey — SmartRail KZN" }] }),
  component: BookPage,
});

interface Station { id: string; station_name: string; region: string; }
interface RouteRow { id: string; origin_station: string; destination_station: string; estimated_duration: number; fare: number; }

function BookPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [origin, setOrigin] = useState<string>("");
  const [destination, setDestination] = useState<string>("");
  const [ticketType, setTicketType] = useState<TicketTypeKey>("single");
  const [step, setStep] = useState<"select" | "pay">("select");
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvv: "" });
  const [processing, setProcessing] = useState(false);

  const { data: stations = [] } = useQuery({
    queryKey: ["stations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stations")
        .select("id, station_name, region").eq("active_status", true).order("station_name");
      if (error) throw error;
      return data as Station[];
    },
  });

  const { data: routes = [] } = useQuery({
    queryKey: ["routes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("routes")
        .select("id, origin_station, destination_station, estimated_duration, fare")
        .eq("route_status", "operational");
      if (error) throw error;
      return data as RouteRow[];
    },
  });

  const route = useMemo(() => {
    if (!origin || !destination) return null;
    // Match either direction
    return routes.find(r =>
      (r.origin_station === origin && r.destination_station === destination) ||
      (r.origin_station === destination && r.destination_station === origin)
    ) ?? null;
  }, [origin, destination, routes]);

  const fare = route ? calcFare(Number(route.fare), ticketType) : 0;

  const handleProceed = () => {
    if (!route) {
      toast.error("No operational route between those stations");
      return;
    }
    if (origin === destination) {
      toast.error("Origin and destination must differ");
      return;
    }
    setStep("pay");
  };

  const handlePay = async () => {
    if (!user || !route) return;

    // Card validation (simulated)
    const cardOk = /^\d{12,19}$/.test(card.number.replace(/\s/g, ""))
      && card.name.trim().length > 1
      && /^(0[1-9]|1[0-2])\/\d{2}$/.test(card.expiry)
      && /^\d{3,4}$/.test(card.cvv);
    if (!cardOk) {
      toast.error("Card details are invalid");
      return;
    }

    setProcessing(true);

    // 1. ticket row
    const meta = TICKET_TYPE_META[ticketType];
    const expiry = calcExpiry(ticketType);
    const { data: ticket, error: tErr } = await supabase
      .from("tickets")
      .insert({
        user_id: user.id,
        route_id: route.id,
        ticket_type: ticketType,
        ticket_status: "active",
        payment_status: "pending",
        fare_paid: fare,
        expiry_timestamp: expiry.toISOString(),
        max_validations: meta.maxValidations,
      })
      .select()
      .single();

    if (tErr || !ticket) {
      setProcessing(false);
      toast.error(tErr?.message ?? "Failed to create ticket");
      return;
    }

    // 2. simulate payment (95% success)
    const success = Math.random() < 0.95;
    const txStatus = success ? "completed" : "failed";

    const { error: txErr } = await supabase.from("transactions").insert({
      user_id: user.id,
      ticket_id: ticket.id,
      amount: fare,
      payment_method: "card",
      transaction_status: txStatus,
    });

    if (txErr) {
      setProcessing(false);
      toast.error(txErr.message);
      return;
    }

    if (!success) {
      // mark ticket cancelled (payment failed)
      await supabase.from("tickets").update({
        ticket_status: "cancelled",
        payment_status: "failed",
      }).eq("id", ticket.id);
      setProcessing(false);
      toast.error("Payment declined by issuer. Please retry with a different card.");
      return;
    }

    // 3. mark ticket paid
    await supabase.from("tickets").update({
      payment_status: "completed",
      activation_timestamp: new Date().toISOString(),
    }).eq("id", ticket.id);

    await logAudit({
      actorId: user.id,
      action: "ticket.purchase",
      entityType: "ticket",
      entityId: ticket.id,
      next: { ticket_type: ticketType, fare, route_id: route.id },
    });

    setProcessing(false);
    toast.success("Payment confirmed. Ticket issued.");
    nav({ to: "/tickets" });
  };

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  const stationName = (id: string) => stations.find(s => s.id === id)?.station_name ?? "—";

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="label-uppercase">Step {step === "select" ? "1 of 2" : "2 of 2"}</div>
          <h1 className="text-xl font-semibold">{step === "select" ? "Plan your journey" : "Confirm payment"}</h1>
        </div>
        {step === "pay" && (
          <Button variant="ghost" size="sm" onClick={() => setStep("select")}>Back</Button>
        )}
      </div>

      {step === "select" ? (
        <div className="panel">
          <div className="panel-header"><span>Journey details</span></div>
          <div className="p-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Origin station</Label>
                <Select value={origin} onValueChange={setOrigin}>
                  <SelectTrigger><SelectValue placeholder="Select origin" /></SelectTrigger>
                  <SelectContent>
                    {stations.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.station_name} <span className="text-muted-foreground">· {s.region}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Destination station</Label>
                <Select value={destination} onValueChange={setDestination}>
                  <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                  <SelectContent>
                    {stations.filter(s => s.id !== origin).map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.station_name} <span className="text-muted-foreground">· {s.region}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Ticket type</Label>
              <div className="grid sm:grid-cols-2 gap-2 mt-1">
                {(Object.keys(TICKET_TYPE_META) as TicketTypeKey[]).map(k => {
                  const m = TICKET_TYPE_META[k];
                  const active = ticketType === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setTicketType(k)}
                      className={`text-left p-3 rounded-md border transition-colors ${
                        active ? "border-primary bg-accent" : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{m.label}</span>
                        {route && (
                          <span className="font-mono-tight text-sm">R {calcFare(Number(route.fare), k).toFixed(2)}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {route && (
              <div className="rounded-md border border-border bg-background/40 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{stationName(origin)}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{stationName(destination)}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-4 text-xs">
                  <div><div className="label-uppercase">Distance</div><div className="font-mono-tight">{route.estimated_duration} min</div></div>
                  <div><div className="label-uppercase">Base fare</div><div className="font-mono-tight">R {Number(route.fare).toFixed(2)}</div></div>
                  <div><div className="label-uppercase">Total</div><div className="font-mono-tight text-success">R {fare.toFixed(2)}</div></div>
                </div>
              </div>
            )}

            <Button onClick={handleProceed} disabled={!origin || !destination || !route} className="w-full">
              Proceed to payment
            </Button>
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="panel-header"><span>Payment</span><span><ShieldCheck className="h-3 w-3 inline mr-1" />Secured · simulated</span></div>
          <div className="p-5 space-y-4">
            <div className="rounded-md border border-border bg-background/40 p-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Route</span><span>{stationName(origin)} → {stationName(destination)}</span></div>
              <div className="flex justify-between mt-1"><span className="text-muted-foreground">Type</span><span>{TICKET_TYPE_META[ticketType].label}</span></div>
              <div className="flex justify-between mt-1 pt-2 border-t border-border"><span>Total</span><span className="font-mono-tight text-success">R {fare.toFixed(2)}</span></div>
            </div>

            <div>
              <Label>Card number</Label>
              <Input inputMode="numeric" placeholder="4111 1111 1111 1111"
                value={card.number} onChange={e => setCard({ ...card, number: e.target.value })} />
            </div>
            <div>
              <Label>Cardholder</Label>
              <Input placeholder="As printed on card" value={card.name} onChange={e => setCard({ ...card, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Expiry</Label>
                <Input placeholder="MM/YY" value={card.expiry} onChange={e => setCard({ ...card, expiry: e.target.value })} />
              </div>
              <div>
                <Label>CVV</Label>
                <Input inputMode="numeric" placeholder="123" value={card.cvv} onChange={e => setCard({ ...card, cvv: e.target.value })} />
              </div>
            </div>

            <Button onClick={handlePay} disabled={processing} className="w-full">
              {processing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing…</> : `Pay R ${fare.toFixed(2)}`}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              Test environment · cards not charged. ~5% of attempts simulate a decline so you can see error handling.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
