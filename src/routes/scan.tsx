import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QrScanner } from "@/components/QrScanner";
import { validateTicket, overrideValidation, type ValidationOutcome } from "@/lib/validation";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, XCircle, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/scan")({
  head: () => ({ meta: [{ title: "Validation Scanner — SmartRail KZN" }] }),
  component: ScanPage,
});

type Recent = ValidationOutcome & { ts: number; lastToken: string };

function ScanPage() {
  const { user, profile, loading, isStaff, hasRole } = useAuth();
  const nav = useNavigate();
  const [last, setLast] = useState<Recent | null>(null);
  const [paused, setPaused] = useState(false);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [manualToken, setManualToken] = useState("");
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideAuth, setOverrideAuth] = useState({ email: "", password: "" });

  useEffect(() => {
    if (!loading && (!user || !isStaff)) nav({ to: "/login" });
  }, [user, loading, isStaff, nav]);

  const stationId = profile?.station_assignment ?? null;

  const handleToken = useCallback(async (token: string) => {
    if (!user) return;
    setPaused(true);
    const result = await validateTicket({ qrToken: token, scannedBy: user.id, stationId });
    const entry: Recent = { ...result, ts: Date.now(), lastToken: token };
    setLast(entry);
    setRecent(prev => [entry, ...prev].slice(0, 20));
    if (result.ok) toast.success(`✓ Valid · ${result.route}`);
    else toast.error(`✗ ${result.reason}`);
    // resume after 2.5s
    setTimeout(() => setPaused(false), 2500);
  }, [user, stationId]);

  const handleManual = async () => {
    if (manualToken.trim().length < 8) {
      toast.error("Enter a valid ticket token");
      return;
    }
    await handleToken(manualToken.trim());
    setManualToken("");
  };

  const canOverride = hasRole("supervisor") || hasRole("admin");
  const showOverride = !!last && !last.ok && !!last.ticketId && canOverride;

  const handleOverride = async () => {
    if (!user || !last?.ticketId) return;
    if (overrideReason.trim().length < 5) {
      toast.error("Override reason must be at least 5 characters");
      return;
    }
    // Re-authenticate the supervisor
    const { error: authErr } = await import("@/integrations/supabase/client").then(m =>
      m.supabase.auth.signInWithPassword(overrideAuth)
    );
    if (authErr) {
      toast.error("Supervisor authentication failed");
      return;
    }
    await overrideValidation({
      ticketId: last.ticketId,
      scannedBy: user.id,
      stationId,
      reason: overrideReason,
      qrToken: last.lastToken,
    });
    toast.success("Override accepted and logged");
    setOverrideOpen(false);
    setOverrideReason("");
    setOverrideAuth({ email: "", password: "" });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="label-uppercase">Operations · Gate validator</div>
          <h1 className="text-xl font-semibold">Ticket Scanner</h1>
        </div>
        <div className="text-xs text-muted-foreground text-right">
          <div>Operator · {profile?.full_name || user?.email}</div>
          <div>Station · {stationId ? "Assigned" : "Unassigned"}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        {/* Scanner */}
        <div className="panel">
          <div className="panel-header">
            <span>Live Scanner</span>
            <span className={paused ? "text-warning" : "text-success"}>
              ● {paused ? "PAUSED" : "READY"}
            </span>
          </div>
          <div className="p-5">
            <QrScanner onDecode={handleToken} paused={paused} />
            <p className="text-[11px] text-muted-foreground text-center mt-3">
              Allow camera access. Hold the commuter's QR within the frame.
            </p>

            <div className="mt-6 grid sm:grid-cols-[1fr_auto] gap-2">
              <div>
                <Label htmlFor="manual" className="text-xs">Manual lookup</Label>
                <Input
                  id="manual"
                  value={manualToken}
                  onChange={e => setManualToken(e.target.value)}
                  placeholder="Paste QR token / ticket reference"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleManual} variant="outline">
                  <Search className="h-4 w-4 mr-1" /> Validate
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Result panel */}
        <div className="space-y-4">
          <div className={`panel border-2 ${
            !last ? "border-border"
            : last.ok ? "border-success" : "border-destructive"
          }`}>
            <div className="panel-header">
              <span>Latest Result</span>
              {last && <span className="font-mono-tight">{new Date(last.ts).toLocaleTimeString()}</span>}
            </div>
            <div className="p-5 text-center">
              {!last ? (
                <p className="text-sm text-muted-foreground py-8">Awaiting first scan…</p>
              ) : last.ok ? (
                <>
                  <CheckCircle2 className="h-10 w-10 mx-auto text-success" />
                  <div className="mt-3 font-semibold text-success">VALID — ALLOW BOARDING</div>
                  <div className="mt-2 text-sm">{last.route}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {last.type.toUpperCase()} · {last.ticketCode}
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-10 w-10 mx-auto text-destructive" />
                  <div className="mt-3 font-semibold text-destructive">INVALID — DENY</div>
                  <div className="mt-2 text-sm">{last.reason}</div>
                  {last.route && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {last.route} · {last.ticketCode}
                    </div>
                  )}
                  {showOverride && (
                    <Button className="mt-4" variant="outline" onClick={() => setOverrideOpen(true)}>
                      <ShieldCheck className="h-4 w-4 mr-1" /> Supervisor override
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><span>Session log</span><span>{recent.length}</span></div>
            <div className="max-h-64 overflow-auto">
              {recent.length === 0 ? (
                <div className="p-4 text-xs text-muted-foreground">No scans yet.</div>
              ) : recent.map((r, i) => (
                <div key={i} className="data-row text-xs">
                  <span className="flex items-center gap-2">
                    <span className={`status-dot ${r.ok ? "bg-success" : "bg-destructive"}`} />
                    {r.ok ? "VALID" : "INVALID"}
                  </span>
                  <span className="truncate max-w-[140px] text-muted-foreground">
                    {r.ok ? r.route : r.reason}
                  </span>
                  <span className="font-mono-tight text-muted-foreground">
                    {new Date(r.ts).toLocaleTimeString().slice(0, 5)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm supervisor override?</AlertDialogTitle>
            <AlertDialogDescription>
              Re-enter your supervisor credentials and document the reason. This action
              is permanently recorded in the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Supervisor email</Label>
              <Input value={overrideAuth.email} onChange={e => setOverrideAuth(a => ({ ...a, email: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Password</Label>
              <Input type="password" value={overrideAuth.password} onChange={e => setOverrideAuth(a => ({ ...a, password: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Reason for override</Label>
              <Textarea rows={3} value={overrideReason} onChange={e => setOverrideReason(e.target.value)} placeholder="e.g. Reader malfunction at gate 3, ticket physically valid" />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleOverride}>Authorize override</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
