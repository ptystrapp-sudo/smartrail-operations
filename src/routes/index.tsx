import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ScanLine, Ticket, Train, ShieldCheck, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SmartRail KZN — Skip the queue. Scan and ride." },
      { name: "description", content: "Buy and validate Metrorail Durban tickets digitally. Real fares, real routes, instant QR validation at every station." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { data: stats } = useQuery({
    queryKey: ["public-stats"],
    queryFn: async () => {
      const [{ count: stationCount }, { count: routeCount }] = await Promise.all([
        supabase.from("stations").select("*", { count: "exact", head: true }).eq("active_status", true),
        supabase.from("routes").select("*", { count: "exact", head: true }).eq("route_status", "operational"),
      ]);
      return { stations: stationCount ?? 0, routes: routeCount ?? 0 };
    },
  });

  return (
    <div>
      {/* Status bar */}
      <div className="border-b border-border bg-surface/60">
        <div className="max-w-7xl mx-auto px-4 py-1.5 text-[11px] text-muted-foreground flex items-center gap-4 font-mono-tight">
          <span className="flex items-center"><span className="status-dot bg-success" />NETWORK OPERATIONAL</span>
          <span className="flex items-center"><span className="status-dot bg-success" />TICKETING ONLINE</span>
          <span className="flex items-center"><span className="status-dot bg-success" />VALIDATION ONLINE</span>
          <span className="ml-auto hidden sm:inline">v1.0 · {new Date().toLocaleDateString("en-ZA")}</span>
        </div>
      </div>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 py-16 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <div className="label-uppercase mb-3">Metrorail Durban · Digital Operations</div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight">
            Avoid ticket queues.<br />
            <span className="text-rail">Scan. Board. Travel.</span>
          </h1>
          <p className="mt-5 text-muted-foreground max-w-lg">
            SmartRail KZN replaces the paper-ticket queue with a verified digital
            wallet. Buy a fare from your phone, present a QR at the gate, and travel
            across the Durban network — single, return, weekly or monthly.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link to="/signup">Get a digital ticket <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/login">Staff & Operator Sign-in</Link>
            </Button>
          </div>

          <dl className="mt-10 grid grid-cols-3 gap-4 max-w-md">
            <Stat label="Active stations" value={stats?.stations ?? "—"} />
            <Stat label="Operational routes" value={stats?.routes ?? "—"} />
            <Stat label="Avg. validation" value="<2s" />
          </dl>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span>Live Network · KZN Region</span>
            <span className="text-success">●  ON-TIME</span>
          </div>
          <div className="divide-y divide-border">
            <NetworkRow line="Durban → Umlazi" status="On time" tone="success" detail="Next: 14:22" />
            <NetworkRow line="Durban → KwaMashu" status="On time" tone="success" detail="Next: 14:35" />
            <NetworkRow line="Durban → Phoenix" status="+4 min" tone="warning" detail="Next: 14:48" />
            <NetworkRow line="Durban → Isipingo" status="On time" tone="success" detail="Next: 14:30" />
            <NetworkRow line="Durban → Reunion" status="On time" tone="success" detail="Next: 14:55" />
          </div>
          <div className="panel-header border-t border-b-0 text-[10px]">
            <span>Source: Metrorail OCC</span>
            <span>Last sync · just now</span>
          </div>
        </div>
      </section>

      {/* Feature strip */}
      <section className="border-y border-border bg-surface/40">
        <div className="max-w-7xl mx-auto px-4 py-12 grid md:grid-cols-4 gap-6">
          <Feature icon={<Ticket className="h-5 w-5" />} title="Digital fares"
            body="Buy single, return, weekly or monthly tickets. Fares calculated per route." />
          <Feature icon={<Train className="h-5 w-5" />} title="Network coverage"
            body="All major Metrorail Durban stations from Umlazi to KwaMashu and Phoenix." />
          <Feature icon={<ScanLine className="h-5 w-5" />} title="Instant validation"
            body="Single-use QR validated by station staff in under two seconds." />
          <Feature icon={<ShieldCheck className="h-5 w-5" />} title="Audited operations"
            body="Every scan, override and ticket change is logged for compliance." />
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 py-16 text-center">
        <Activity className="h-8 w-8 mx-auto text-primary mb-4" />
        <h2 className="text-2xl font-semibold">Built for the daily commute</h2>
        <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
          Register a commuter account in under a minute. Staff and supervisors are
          provisioned by the operations administrator.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild><Link to="/signup">Create commuter account</Link></Button>
          <Button variant="outline" asChild><Link to="/book">Browse routes</Link></Button>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dd className="text-2xl font-semibold font-mono-tight">{value}</dd>
      <dt className="label-uppercase mt-1">{label}</dt>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div>
      <div className="h-9 w-9 rounded-sm bg-accent flex items-center justify-center text-rail mb-3">
        {icon}
      </div>
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">{body}</p>
    </div>
  );
}

function NetworkRow({ line, status, tone, detail }: { line: string; status: string; tone: "success" | "warning" | "destructive"; detail: string }) {
  const toneClass = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-destructive";
  return (
    <div className="data-row">
      <span className="font-medium">{line}</span>
      <span className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">{detail}</span>
        <span className={`text-xs font-mono-tight ${toneClass}`}>{status}</span>
      </span>
    </div>
  );
}
