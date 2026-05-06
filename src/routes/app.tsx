import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Calendar, Users, Building2, CheckSquare, ArrowLeftRight,
  LogOut, Settings, Menu, ShieldCheck, Bell, ChevronRight, X, Home,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: Array<"super_admin" | "supervisor" | "ministry_leader" | "volunteer">;
  badge?: number;
}

const NAV: NavItem[] = [
  { to: "/app", label: "Início", icon: LayoutDashboard },
  { to: "/app/escalas", label: "Escalas & Eventos", icon: Calendar, roles: ["super_admin", "supervisor", "ministry_leader"] },
  { to: "/app/ministerios", label: "Ministérios", icon: Building2, roles: ["super_admin", "supervisor"] },
  { to: "/app/voluntarios", label: "Voluntários", icon: Users, roles: ["super_admin", "supervisor", "ministry_leader"] },
  { to: "/app/confirmacoes", label: "Confirmações", icon: CheckSquare, roles: ["super_admin", "supervisor", "ministry_leader"] },
  { to: "/app/substituicoes", label: "Substituições", icon: ArrowLeftRight, roles: ["super_admin", "supervisor", "ministry_leader"] },
  { to: "/app/supervisor", label: "Visão Supervisor", icon: ShieldCheck, roles: ["super_admin", "supervisor"] },
  { to: "/app/minhas-escalas", label: "Minhas Escalas", icon: Home },
  { to: "/app/configuracoes", label: "Configurações", icon: Settings, roles: ["super_admin"] },
];

function AppLayout() {
  const { session, loading, profile, church, roles, hasAnyRole, isGlobalManager, signOut } = useAuth();
  const navigate = useNavigate();
  const router = useRouterState();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (loading || !session || !profile?.church_id) return;
    const current = router.location.pathname;
    const match = NAV.find((n) => n.to !== "/app" && current.startsWith(n.to));
    if (match?.roles && !hasAnyRole(match.roles)) {
      navigate({ to: "/app" });
    }
  }, [router.location.pathname, loading, session, profile?.church_id, hasAnyRole, navigate]);

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [router.location.pathname]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm text-muted-foreground">Carregando...</span>
        </div>
      </div>
    );
  }

  if (!profile?.church_id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-elegant)]">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-warning/15 flex items-center justify-center">
            <Bell className="h-6 w-6 text-warning" />
          </div>
          <h2 className="font-display text-lg font-semibold">Conta sem igreja vinculada</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua conta não está associada a nenhuma igreja. Entre em contato com o administrador.
          </p>
          <button
            className="mt-6 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            onClick={() => signOut().then(() => navigate({ to: "/" }))}
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  const visibleNav = NAV.filter((n) => !n.roles || hasAnyRole(n.roles));

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 flex-col bg-sidebar transition-transform duration-300 ease-out lg:static lg:flex lg:translate-x-0",
          sidebarOpen ? "flex translate-x-0" : "-translate-x-full hidden lg:flex"
        )}
      >
        {/* Sidebar header */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Building2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display text-base font-700 text-sidebar-foreground tracking-tight">
              ChurchOps
            </span>
          </div>
          <button
            className="rounded-md p-1 text-sidebar-foreground/50 hover:text-sidebar-foreground lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Church info */}
        <div className="border-b border-sidebar-border px-5 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 mb-1">
            Igreja
          </div>
          <div className="text-sm font-semibold text-sidebar-foreground truncate">{church?.name}</div>
          <div className="mt-2">
            <span className="inline-flex items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              {ROLE_LABELS[roles[0] ?? "volunteer"]}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {visibleNav.map((item) => (
            <NavLink key={item.to} item={item} />
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-xl p-3 hover:bg-sidebar-accent/50 transition-colors">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary text-sm font-semibold">
              {profile?.full_name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-sidebar-foreground truncate">{profile?.full_name}</div>
              <div className="text-[11px] text-sidebar-foreground/50 truncate">{profile?.email}</div>
            </div>
            <button
              onClick={() => signOut().then(() => navigate({ to: "/" }))}
              className="rounded-lg p-1.5 text-sidebar-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Sair"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Topbar (mobile) */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/80 backdrop-blur-md px-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1.5 text-foreground hover:bg-accent transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
              <Building2 className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-display text-sm font-700 tracking-tight">ChurchOps</span>
          </div>
          <div className="text-xs text-muted-foreground truncate max-w-[120px]">{church?.name}</div>
        </header>

        <main className="flex-1 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavLink({ item }: { item: NavItem }) {
  const router = useRouterState();
  const current = router.location.pathname;
  const isActive = item.to === "/app" ? current === "/app" : current.startsWith(item.to);

  return (
    <Link
      to={item.to}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
        isActive
          ? "bg-primary/15 text-primary"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
      )}
    >
      <item.icon className={cn("h-4 w-4 flex-shrink-0 transition-colors", isActive ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground")} />
      <span className="flex-1 truncate">{item.label}</span>
      {isActive && <ChevronRight className="h-3 w-3 text-primary/60" />}
    </Link>
  );
}
