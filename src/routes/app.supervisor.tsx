import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, TrendingUp, TrendingDown, Minus, Calendar, Users, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/supervisor")({
  head: () => ({ meta: [{ title: "Visão Supervisor — ChurchOps" }] }),
  component: SupervisorPage,
});

function SupervisorPage() {
  const { church } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["supervisor-view", church?.id],
    enabled: !!church?.id,
    refetchInterval: 60_000,
    queryFn: async () => {
      const now = new Date().toISOString();

      const { data: schedules } = await supabase
        .from("schedules")
        .select(`
          id, is_published, published_at,
          ministries(id, name),
          events!inner(id, title, starts_at, event_type),
          schedule_assignments(
            id, volunteer_id,
            confirmations(status)
          )
        `)
        .eq("church_id", church!.id)
        .gte("events.starts_at", now)
        .order("events.starts_at");

      const items = (schedules ?? [])
        .filter((s: any) => !!s.events)
        .map((s: any) => {
          const total = s.schedule_assignments?.length ?? 0;
          const confirmed = s.schedule_assignments?.filter((a: any) => a.confirmations?.[0]?.status === "confirmed").length ?? 0;
          const declined = s.schedule_assignments?.filter((a: any) => a.confirmations?.[0]?.status === "declined").length ?? 0;
          const pending = s.schedule_assignments?.filter((a: any) => !a.confirmations?.[0] || a.confirmations?.[0]?.status === "pending").length ?? 0;
          const subReq = s.schedule_assignments?.filter((a: any) => a.confirmations?.[0]?.status === "substitution_requested").length ?? 0;
          const pct = total > 0 ? Math.round((confirmed / total) * 100) : 0;
          const health: "great" | "ok" | "risk" = pct >= 80 ? "great" : pct >= 50 ? "ok" : "risk";
          return { ...s, stats: { total, confirmed, declined, pending, subReq, pct }, health };
        });

      // Agrupado por ministério
      const byMinistry = new Map<string, { name: string; items: typeof items }>();
      for (const item of items) {
        const mn = item.ministries;
        if (!mn) continue;
        if (!byMinistry.has(mn.id)) byMinistry.set(mn.id, { name: mn.name, items: [] });
        byMinistry.get(mn.id)!.items.push(item);
      }

      return Array.from(byMinistry.entries()).map(([id, val]) => ({
        id, name: val.name, schedules: val.items,
        avgPct: val.items.length ? Math.round(val.items.reduce((sum, s) => sum + s.stats.pct, 0) / val.items.length) : 0,
        totalPending: val.items.reduce((sum, s) => sum + s.stats.pending, 0),
      }));
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const allSchedules = (data ?? []).flatMap((g) => g.schedules);
  const overallPct = allSchedules.length
    ? Math.round(allSchedules.reduce((s, sc) => s + sc.stats.pct, 0) / allSchedules.length)
    : 0;
  const atRisk = allSchedules.filter((s) => s.health === "risk").length;
  const totalPending = allSchedules.reduce((s, sc) => s + sc.stats.pending, 0);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Visão Supervisor</h1>
        <p className="mt-1 text-sm text-muted-foreground">Saúde geral das escalas futuras por ministério.</p>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-8">
        <OverviewCard
          label="Taxa média de confirmação"
          value={`${overallPct}%`}
          icon={<HealthIndicator pct={overallPct} size="lg" />}
          sub={allSchedules.length === 0 ? "sem escalas" : `${allSchedules.length} escalas`}
        />
        <OverviewCard
          label="Ministérios ativos"
          value={String(data?.length ?? 0)}
          icon={<Building2 className="h-5 w-5 text-primary" />}
          sub="com escalas futuras"
        />
        <OverviewCard
          label="Pendentes de resposta"
          value={String(totalPending)}
          icon={<Users className="h-5 w-5 text-warning" />}
          sub="voluntários"
          urgent={totalPending > 0}
        />
        <OverviewCard
          label="Escalas em risco"
          value={String(atRisk)}
          icon={<Calendar className="h-5 w-5 text-destructive" />}
          sub="< 50% confirmados"
          urgent={atRisk > 0}
        />
      </div>

      {/* By Ministry */}
      {!data?.length ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Nenhuma escala futura cadastrada.
        </div>
      ) : (
        <div className="space-y-6">
          {data.map((group) => (
            <div key={group.id} className="rounded-2xl border border-border bg-card overflow-hidden">
              {/* Ministry header */}
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                    <Building2 className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold">{group.name}</div>
                    <div className="text-xs text-muted-foreground">{group.schedules.length} escalas futuras</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {group.totalPending > 0 && (
                    <span className="text-xs font-medium text-warning bg-warning/10 border border-warning/20 rounded-full px-2.5 py-0.5">
                      {group.totalPending} pendentes
                    </span>
                  )}
                  <div className="text-right">
                    <div className={cn("text-lg font-bold", group.avgPct >= 80 ? "text-success" : group.avgPct >= 50 ? "text-warning" : "text-destructive")}>
                      {group.avgPct}%
                    </div>
                    <div className="text-[10px] text-muted-foreground">média</div>
                  </div>
                </div>
              </div>

              {/* Schedules table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Evento</th>
                      <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Saúde</th>
                      <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">✓</th>
                      <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">⏳</th>
                      <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">✗</th>
                      <th className="px-5 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {group.schedules.map((s: any) => (
                      <ScheduleRow key={s.id} schedule={s} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScheduleRow({ schedule: s }: { schedule: any }) {
  const ev = s.events;
  const { stats, health } = s;

  const healthConfig = {
    great: { label: "Ótimo", cls: "text-success", icon: <TrendingUp className="h-3.5 w-3.5" /> },
    ok: { label: "Regular", cls: "text-warning", icon: <Minus className="h-3.5 w-3.5" /> },
    risk: { label: "Em risco", cls: "text-destructive", icon: <TrendingDown className="h-3.5 w-3.5" /> },
  }[health];

  return (
    <tr className="hover:bg-accent/30 transition-colors">
      <td className="px-5 py-3">
        <div className="font-medium text-sm">{ev?.title}</div>
        <div className="text-xs text-muted-foreground">{ev && formatDate(ev.starts_at)}</div>
      </td>
      <td className="px-3 py-3 text-center">
        <div className={cn("flex items-center justify-center gap-1 text-xs font-semibold", healthConfig.cls)}>
          {healthConfig.icon}
          <span className="hidden sm:inline">{healthConfig.label}</span>
          <span className="sm:hidden">{stats.pct}%</span>
        </div>
      </td>
      <td className="px-3 py-3 text-center hidden sm:table-cell">
        <span className="text-sm font-semibold text-success">{stats.confirmed}</span>
      </td>
      <td className="px-3 py-3 text-center hidden sm:table-cell">
        <span className="text-sm font-semibold text-warning">{stats.pending}</span>
      </td>
      <td className="px-3 py-3 text-center hidden sm:table-cell">
        <span className="text-sm font-semibold text-destructive">{stats.declined}</span>
      </td>
      <td className="px-5 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", health === "great" ? "bg-success" : health === "ok" ? "bg-warning" : "bg-destructive")}
              style={{ width: `${stats.pct}%` }}
            />
          </div>
          <span className={cn("text-xs font-semibold tabular-nums w-9 text-right", health === "great" ? "text-success" : health === "ok" ? "text-warning" : "text-destructive")}>
            {stats.pct}%
          </span>
          {!s.is_published && (
            <span className="text-[10px] text-muted-foreground border border-border rounded-full px-1.5 py-0.5">rascunho</span>
          )}
        </div>
      </td>
    </tr>
  );
}

function HealthIndicator({ pct, size = "sm" }: { pct: number; size?: "sm" | "lg" }) {
  const color = pct >= 80 ? "text-success" : pct >= 50 ? "text-warning" : "text-destructive";
  const Icon = pct >= 60 ? TrendingUp : pct >= 40 ? Minus : TrendingDown;
  return <Icon className={cn(color, size === "lg" ? "h-5 w-5" : "h-4 w-4")} />;
}

function OverviewCard({ label, value, icon, sub, urgent = false }: {
  label: string; value: string; icon: React.ReactNode; sub: string; urgent?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-2xl border bg-card p-4",
      urgent ? "border-warning/30" : "border-border"
    )}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      <div className="text-[10px] text-muted-foreground/60 mt-1">{sub}</div>
    </div>
  );
}
