import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  ScanLine,
  Train,
  Route as RouteIcon,
  UserCog,
  ClipboardList,
  Settings,
  Bell,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: AdminLayout,
});

const NAV = [
  { to: "/admin/overview", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/revenue", label: "Revenue Operations", icon: TrendingUp },
  { to: "/admin/passengers", label: "Passenger Analytics", icon: Users },
  { to: "/admin/validation", label: "Validation Monitoring", icon: ScanLine },
  { to: "/admin/stations", label: "Station Management", icon: Train },
  { to: "/admin/routes", label: "Route Management", icon: RouteIcon },
  { to: "/admin/users", label: "User Management", icon: UserCog },
  { to: "/admin/audit", label: "Audit Logs", icon: ClipboardList },
  { to: "/admin/settings", label: "Operational Settings", icon: Settings },
] as const;

function AdminLayout() {
  const { user, profile, hasRole, loading } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [now, setNow] = useState<string>("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const tick = () =>
      setNow(
        new Date().toLocaleTimeString("en-ZA", {
          hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="p-8 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!user || !hasRole("admin")) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <h1 className="text-xl font-semibold">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The Operations Console requires the <span className="font-mono">admin</span> role.
        </p>
        <Link to="/" className="mt-4 inline-block text-rail underline text-sm">
          Return to commuter app
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem-2.25rem)]">
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-surface border-r border-border transform transition-transform lg:transform-none ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="px-4 h-12 border-b border-border flex items-center justify-between">
          <span className="text-[11px] tracking-widest uppercase text-muted-foreground font-medium">
            Operations Console
          </span>
          <button onClick={() => setOpen(false)} className="lg:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="p-2 space-y-0.5 overflow-y-auto h-[calc(100%-3rem)]">
          {NAV.map((item) => {
            const active = path === item.to || path.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-12 border-b border-border bg-surface/40 flex items-center px-4 gap-3">
          <button onClick={() => setOpen(true)} className="lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 flex items-center gap-2 text-xs text-muted-foreground font-mono-tight">
            <span className="status-dot bg-success" /> SYSTEM ONLINE
            <span className="mx-2 hidden sm:inline">·</span>
            <span className="hidden sm:inline">{now} SAST</span>
          </div>
          <Bell className="h-4 w-4 text-muted-foreground" />
          <div className="text-right hidden sm:block leading-tight">
            <div className="text-xs font-medium">{profile?.full_name || user.email}</div>
            <Badge variant="outline" className="px-1 py-0 text-[9px]">ADMIN</Badge>
          </div>
        </div>
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
