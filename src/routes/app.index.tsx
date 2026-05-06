import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
  Calendar, CheckCircle2, Clock, Users, Building2, ArrowLeftRight,
  AlertTriangle, ArrowRight, Circle, Zap, TrendingUp,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, daysUntil, pluralize } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Início — ChurchOps" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { roles } = useAuth();
  const isVolunteerOnly = roles.length > 0 && roles.every((r) => r === "volunteer");
  return isVolunteerOnly ? <VolunteerDashboard /> : <MasterDashboard />;
}

/* ================================================================
   MASTER DASHBOARD — Líderes e Admins
   Página inicial com escalas se formando em tempo real
================================================================ */

function MasterDashboard() {
  const { church, profile, roles } = useAuth();
  const qc = useQueryClient();

  // Stats gerais
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", church?.id],
    enabled: !!church?.id,
    refetchInterval: 30_000,
    queryFn: async () => {
      const now = new Date().toISOString();
      const [events, volunteers, ministries, pendingConf, openSubs] = await Promise.all([
        supabase.from("events").select("id, title, starts_at, location").eq("church_id", church!.id).gte("starts_at", now).order("starts_at").limit(5),
        supabase.from("volunteers").select("id", { count: "exact", head: true }).eq("church_id", church!.id).eq("is_active", true),
        supabase.from("ministries").select("id", { count: "exact", head: true }).eq("church_id", church!.id).eq("is_active", true),
        supabase.from("confirmations").select("id", { count: "exact", head: true }).eq("church_id", church!.id).eq("status", "pending"),
        supabase.from("substitutions").select("id", { count: "exact", head: true }).eq("church_id", church!.id).eq("status", "open"),
      ]);
      return {
        upcoming: events.data ?? [],
        volunteers: volunteers.count ?? 0,
        ministries: ministries.count ?? 0,
        pending: pendingConf.count ?? 0,
        subs: openSubs.count ?? 0,
      };
    },
  });

  // Escalas vivas — próximos 30 dias com confirmações em tempo real
  const { data: liveSchedules, refetch: refetchLive } = useQuery({
    queryKey: ["live-schedules", church?.id],
    enabled: !!church?.id,
    refetchInterval: 15_000,
    queryFn: async () => {
      const now = new Date().toISOString();
      const in30 = new Date(Date.now() + 30 * 86400000).toISOString();

      const { data: schedules } = await supabase
        .from("schedules")
        .select(`
          id, is_published, published_at,
          ministries(id, name),
          events!inner(id, title, starts_at, event_type),
          schedule_assignments(
            id, volunteer_id,
            volunteers(full_name),
            confirmations(status)
          )
        `)
        .eq("church_id", church!.id)
        .gte("events.starts_at", now)
        .lte("events.starts_at", in30)
        .order("events.starts_at");

      return (schedules ?? []).map((s: any) => {
        const assignments = s.schedule_assignments ?? [];
        const total = assignments.length;
        const confirmed = assignments.filter((a: any) => a.confirmations?.[0]?.status === "confirmed").length;
        const declined = assignments.filter((a: any) => a.confirmations?.[0]?.status === "declined").length;
        const pending = assignments.filter((a: any) => !a.confirmations?.[0] || a.confirmations?.[0]?.status === "pending").length;
        return {
          id: s.id,
          published: s.is_published,
          ministry: s.ministries,
          event: s.events,
          assignments,
          stats: { total, confirmed, declined, pending },
          pct: total > 0 ? Math.round((confirmed / total) * 100) : 0,
        };
      });
    },
  });

  // Realtime subscription
  useEffect(() => {
    if (!church?.id) return;
    const channel = supabase
      .channel(`dashboard:${church.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "confirmations", filter: `church_id=eq.${church.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["live-schedules"] });
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [church?.id, qc]);

  const isAdmin = roles.includes("super_admin") || roles.includes("supervisor");
  const showOnboarding = isAdmin && stats && (stats.ministries === 0 || stats.volunteers === 0 || stats.upcoming.length === 0);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1">
          <Zap className="h-3 w-3 text-primary" />
          <span>Painel em tempo real</span>
          <span className="h-1.5 w-1.5 rounded-full bg-success pulse-live" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          Olá, {profile?.full_name?.split(" ")[0]} 👋
        </h1>
        <p className="mt-1 text-muted-foreground">
          Acompanhe as escalas se formando conforme os voluntários confirmam presença.
        </p>
      </div>

      {/* Onboarding */}
      {showOnboarding && (
        <div className="mb-8 rounded-2xl border border-primary/30 bg-primary/5 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm">Configure em 3 passos</h2>
          </div>
          <div className="space-y-2">
            <OnboardingStep done={stats.ministries > 0} label="Crie seu primeiro ministério" to="/app/ministerios" cta="Criar" />
            <OnboardingStep done={stats.volunteers > 0} label="Cadastre voluntários" to="/app/voluntarios" cta="Cadastrar" />
            <OnboardingStep done={stats.upcoming.length > 0} label="Crie um evento e monte a escala" to="/app/escalas" cta="Criar" />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-8">
        <StatCard icon={Users} label="Voluntários" value={stats?.volunteers ?? 0} color="primary" />
        <StatCard icon={Building2} label="Ministérios" value={stats?.ministries ?? 0} color="accent" />
        <StatCard icon={Clock} label="Pendentes" value={stats?.pending ?? 0} color="warning" to="/app/confirmacoes" />
        <StatCard icon={ArrowLeftRight} label="Substituições" value={stats?.subs ?? 0} color="destructive" to="/app/substituicoes" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Escalas ao vivo — coluna principal */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Escalas se Formando</h2>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success pulse-live" />
              Ao vivo
            </div>
          </div>

          {!liveSchedules?.length ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center">
              <Calendar className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma escala nos próximos 30 dias.</p>
              <Link to="/app/escalas" className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                Criar primeiro evento <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {liveSchedules.map((s) => (
                <LiveScheduleCard key={s.id} schedule={s} />
              ))}
            </div>
          )}
        </div>

        {/* Coluna lateral */}
        <div className="lg:col-span-2 space-y-4">
          {/* Próximos eventos */}
          <div>
            <h2 className="font-display text-lg font-semibold mb-3">Próximos Eventos</h2>
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              {!stats?.upcoming.length ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum evento agendado.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {stats.upcoming.map((e: any) => (
                    <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex h-9 w-9 flex-shrink-0 flex-col items-center justify-center rounded-xl bg-accent text-center">
                        <span className="text-[10px] font-bold uppercase leading-none text-muted-foreground">
                          {new Date(e.starts_at).toLocaleString("pt-BR", { month: "short" })}
                        </span>
                        <span className="text-base font-bold leading-none text-foreground">
                          {new Date(e.starts_at).getDate()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{e.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(e.starts_at).toLocaleString("pt-BR", { timeStyle: "short" })}
                          {e.location ? ` · ${e.location}` : ""}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-muted-foreground">
                        {daysUntil(e.starts_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Alertas */}
          {(!!stats?.pending || !!stats?.subs) && (
            <div>
              <h2 className="font-display text-lg font-semibold mb-3">Alertas</h2>
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                {!!stats.pending && (
                  <AlertItem
                    icon={Clock}
                    color="warning"
                    label={`${stats.pending} confirmações pendentes`}
                    to="/app/confirmacoes"
                    cta="Ver lista"
                  />
                )}
                {!!stats.subs && (
                  <AlertItem
                    icon={ArrowLeftRight}
                    color="destructive"
                    label={`${stats.subs} pedidos de substituição`}
                    to="/app/substituicoes"
                    cta="Resolver"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------
   Live Schedule Card — mostra progresso das confirmações
---------------------------------------------------------------- */
function LiveScheduleCard({ schedule }: { schedule: any }) {
  const { stats, pct, event, ministry, published, assignments } = schedule;

  const statusColor =
    pct >= 80 ? "success" :
    pct >= 50 ? "warning" :
    "destructive";

  const eventTypeIcon: Record<string, string> = {
    culto: "⛪",
    ensaio: "🎵",
    evento_especial: "⭐",
    reuniao: "🤝",
  };

  return (
    <div className="group rounded-2xl border border-border bg-card p-5 hover:border-primary/30 hover:shadow-[var(--shadow-elegant)] transition-all duration-200 animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{eventTypeIcon[event?.event_type] ?? "📅"}</span>
          <div>
            <div className="font-semibold text-sm">{event?.title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {ministry?.name} · {formatDate(event?.starts_at)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!published && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border border-border rounded-full px-2 py-0.5">
              Rascunho
            </span>
          )}
          {published && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-success border border-success/30 bg-success/10 rounded-full px-2 py-0.5">
              Publicada
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-muted-foreground">Confirmações</span>
          <span className={cn(
            "font-semibold",
            statusColor === "success" ? "text-success" :
            statusColor === "warning" ? "text-warning" : "text-muted-foreground"
          )}>
            {stats.confirmed}/{stats.total} ({pct}%)
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700 ease-out",
              statusColor === "success" ? "bg-success" :
              statusColor === "warning" ? "bg-warning" : "bg-primary"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Volunteers grid */}
      {assignments.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5">
          {assignments.map((a: any) => {
            const status = a.confirmations?.[0]?.status ?? "pending";
            return (
              <div key={a.id} className={cn(
                "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs",
                status === "confirmed" ? "bg-success/10 border border-success/20" :
                status === "declined" ? "bg-destructive/10 border border-destructive/20" :
                "bg-muted/50 border border-border"
              )}>
                <div className={cn(
                  "h-1.5 w-1.5 rounded-full flex-shrink-0",
                  status === "confirmed" ? "bg-success" :
                  status === "declined" ? "bg-destructive" :
                  "bg-muted-foreground/50"
                )} />
                <span className="truncate font-medium">{a.volunteers?.full_name?.split(" ")[0]}</span>
                <span className={cn(
                  "ml-auto flex-shrink-0",
                  status === "confirmed" ? "text-success" :
                  status === "declined" ? "text-destructive" : "text-muted-foreground"
                )}>
                  {status === "confirmed" ? "✓" : status === "declined" ? "✗" : "?"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Mini stats */}
      <div className="flex gap-3 mt-4 pt-4 border-t border-border">
        <MiniStat label="Confirmados" value={stats.confirmed} color="text-success" />
        <MiniStat label="Pendentes" value={stats.pending} color="text-warning" />
        <MiniStat label="Recusados" value={stats.declined} color="text-destructive" />
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex-1 text-center">
      <div className={cn("text-lg font-bold", color)}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

/* ================================================================
   VOLUNTEER DASHBOARD
================================================================ */
function VolunteerDashboard() {
  const { profile, church, user } = useAuth();

  const { data: assignments } = useQuery({
    queryKey: ["my-upcoming-assignments", user?.id, church?.id],
    enabled: !!user?.id && !!church?.id,
    refetchOnMount: "always",
    staleTime: 0,
    queryFn: async () => {
      let { data: vol } = await supabase.from("volunteers").select("id").eq("user_id", user!.id).eq("church_id", church!.id).maybeSingle();
      if (!vol && user?.email) {
        const { data: byEmail } = await supabase.from("volunteers").select("id").is("user_id", null).ilike("email", user.email).eq("church_id", church!.id).maybeSingle();
        vol = byEmail ?? null;
      }
      if (!vol) return [];
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("schedule_assignments")
        .select("id, schedules!inner(is_published, ministries(name), events!inner(id, title, starts_at))")
        .eq("volunteer_id", vol.id)
        .eq("church_id", church!.id)
        .eq("schedules.is_published", true)
        .gte("schedules.events.starts_at", now);
      const rows = (data ?? []).filter((a: any) => !!a.schedules?.events);
      const ids = rows.map((a: any) => a.id);
      const confMap = new Map<string, string>();
      if (ids.length > 0) {
        const { data: confs } = await supabase.from("confirmations").select("assignment_id, status").in("assignment_id", ids);
        for (const c of (confs ?? []) as any[]) confMap.set(c.assignment_id, c.status);
      }
      return rows.map((a: any) => ({
        id: a.id,
        title: a.schedules.events.title,
        starts_at: a.schedules.events.starts_at,
        ministry: a.schedules.ministries?.name ?? null,
        status: confMap.get(a.id) ?? "pending",
      })).sort((a: any, b: any) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    },
  });

  const list = assignments ?? [];
  const pendingCount = list.filter((a) => a.status === "pending").length;

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Olá, {profile?.full_name?.split(" ")[0]} 👋
        </h1>
        <p className="mt-1 text-muted-foreground">Suas próximas escalas e ministérios.</p>
      </div>

      {pendingCount > 0 && (
        <div className="mb-6 rounded-2xl border border-warning/30 bg-warning/10 p-4 flex items-center gap-3">
          <Clock className="h-5 w-5 text-warning flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-warning">
              {pluralize(pendingCount, "escala aguardando resposta", "escalas aguardando resposta")}
            </div>
          </div>
          <Link to="/app/minhas-escalas" className="text-xs font-medium text-warning hover:underline shrink-0">
            Responder →
          </Link>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <Calendar className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-sm">Próximas Escalas</h2>
        </div>
        {list.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Você não tem escalas futuras.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {list.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <div className="font-medium text-sm">{a.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(a.starts_at, { dateStyle: "long", timeStyle: "short" })}
                    {a.ministry ? ` · ${a.ministry}` : ""}
                  </div>
                </div>
                <ConfirmationBadge status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 text-center">
        <Link to="/app/minhas-escalas" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          Ver todas as escalas <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

/* ================================================================
   Shared Components
================================================================ */
function StatCard({ icon: Icon, label, value, color, to }: {
  icon: any; label: string; value: number; color: string; to?: string;
}) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    primary: { bg: "bg-primary/10", text: "text-primary" },
    accent: { bg: "bg-accent", text: "text-accent-foreground" },
    warning: { bg: "bg-warning/15", text: "text-warning" },
    destructive: { bg: "bg-destructive/10", text: "text-destructive" },
  };
  const { bg, text } = colorMap[color] ?? colorMap.primary;
  const inner = (
    <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-4 hover:border-primary/30 transition-colors">
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", bg)}>
        <Icon className={cn("h-5 w-5", text)} />
      </div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
  if (to) return <Link to={to} className="block">{inner}</Link>;
  return inner;
}

function OnboardingStep({ done, label, to, cta }: { done: boolean; label: string; to: string; cta: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/50 px-4 py-3">
      <div className="flex items-center gap-2.5">
        {done ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground/50" />
        )}
        <span className={cn("text-sm", done ? "text-muted-foreground line-through" : "font-medium")}>{label}</span>
      </div>
      {!done && (
        <Link to={to} className="shrink-0 rounded-lg border border-border px-3 py-1 text-xs font-medium hover:bg-accent transition-colors">
          {cta} →
        </Link>
      )}
    </div>
  );
}

function AlertItem({ icon: Icon, color, label, to, cta }: { icon: any; color: string; label: string; to: string; cta: string }) {
  const colorMap: Record<string, string> = {
    warning: "text-warning",
    destructive: "text-destructive",
  };
  return (
    <div className="flex items-center gap-3">
      <Icon className={cn("h-4 w-4 flex-shrink-0", colorMap[color])} />
      <div className="flex-1 text-sm font-medium">{label}</div>
      <Link to={to} className="text-xs text-primary hover:underline shrink-0">{cta}</Link>
    </div>
  );
}

export function ConfirmationBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pendente", cls: "bg-warning/15 text-warning border-warning/30" },
    confirmed: { label: "Confirmado", cls: "bg-success/15 text-success border-success/30" },
    declined: { label: "Recusado", cls: "bg-destructive/10 text-destructive border-destructive/30" },
    substitution_requested: { label: "Pediu substituto", cls: "bg-accent text-accent-foreground border-border" },
  };
  const m = map[status] ?? map.pending;
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", m.cls)}>
      {m.label}
    </span>
  );
}
