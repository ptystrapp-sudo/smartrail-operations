import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Train, Ticket, ScanLine, LogOut, ShieldCheck, User as UserIcon, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, profile, roles, isStaff, hasRole, signOut } = useAuth();
  const isAdmin = hasRole("admin");
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const handleLogout = async () => {
    await signOut();
    toast.success("Signed out");
    nav({ to: "/" });
  };

  const navLink = (to: string, label: string, icon: ReactNode) => {
    const active = path === to || (to !== "/" && path.startsWith(to));
    return (
      <Link
        to={to}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
          active
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
        }`}
      >
        {icon}
        <span>{label}</span>
      </Link>
    );
  };

  const primaryRole = roles.includes("admin")
    ? "Admin"
    : roles.includes("supervisor")
      ? "Supervisor"
      : roles.includes("station_staff")
        ? "Station Staff"
        : "Commuter";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-surface">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-sm bg-primary flex items-center justify-center">
              <Train className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="leading-none">
              <div className="text-sm font-semibold tracking-tight">SmartRail KZN</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Metrorail Durban · Operations
              </div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {user && !isStaff && (
              <>
                {navLink("/book", "Book", <Ticket className="h-4 w-4" />)}
                {navLink("/tickets", "My Tickets", <Ticket className="h-4 w-4" />)}
              </>
            )}
            {user && isStaff && !isAdmin && (
              <>
                {navLink("/scan", "Scanner", <ScanLine className="h-4 w-4" />)}
                {navLink("/scan/history", "Scan Log", <ShieldCheck className="h-4 w-4" />)}
              </>
            )}
            {user && isAdmin && (
              <>
                {navLink("/admin/overview", "Operations", <LayoutDashboard className="h-4 w-4" />)}
                {navLink("/scan", "Scanner", <ScanLine className="h-4 w-4" />)}
              </>
            )}
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="hidden sm:flex flex-col items-end leading-tight">
                  <span className="text-xs font-medium">{profile?.full_name || user.email}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {primaryRole}
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/signup">
                    <UserIcon className="h-4 w-4 mr-1" /> Register
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-surface">
        <div className="max-w-7xl mx-auto px-4 py-3 text-[11px] text-muted-foreground flex items-center justify-between">
          <span>SmartRail KZN · Operational MVP · Durban Metropolitan Rail</span>
          <span className="font-mono-tight">SYSTEM · ONLINE</span>
        </div>
      </footer>
    </div>
  );
}
