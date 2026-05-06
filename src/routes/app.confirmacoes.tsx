import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Clock, Filter, Search, RefreshCw, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ConfirmationBadge } from "./app.index";

export const Route = createFileRoute("/app/confirmacoes")({
  head: () => ({ meta: [{ title: "Confirmações — ChurchOps" }] }),
  component: ConfirmationsPage,
});

const STATUS_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendentes" },
  { value: "confirmed", label: "Confirmados" },
  { value: "declined", label: "Recusados" },
  { value: "substitution_requested", label: "Pediu substituto" },
];

function ConfirmationsPage() {
  const { church, leaderMinistryIds, isGlobalManager } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [ministryFilter, setMinistryFilter] = useState("all");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["confirmations", church?.id, statusFilter, ministryFilter],
    enabled: !!church?.id,
    queryFn: async () => {
      let q = supabase
        .from("confirmations")
        .select(`
          id, status, message, responded_at, created_at,
          volunteers(id, full_name, email, phone),
          schedule_assignments!inner(
            id, ministry_role_id,
            schedules!inner(
              id, is_published,
              ministries(id, name),
              events(id, title, starts_at)
            )
          )
        `)
        .eq("church_id", church!.id)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") q = q.eq("status", statusFilter as any);

      if (!isGlobalManager && leaderMinistryIds.length > 0) {
        q = q.in("schedule_assignments.schedules.ministry_id", leaderMinistryIds);
      }

      if (ministryFilter !== "all") {
        q = q.eq("schedule_assignments.schedules.ministry_id", ministryFilter);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).filter((c: any) => c.schedule_assignments?.schedules?.events);
    },
  });

  const { data: ministries } = useQuery({
    queryKey: ["ministries-list", church?.id],
    enabled: !!church?.id,
    queryFn: async () => {
      const { data } = await supabase.from("ministries").select("id, name").eq("church_id", church!.id).order("name");
      return data ?? [];
    },
  });

  const renotify = useMutation({
    mutationFn: async (confirmationId: string) => {
      // Placeholder — integração WhatsApp/e-mail
      await new Promise((r) => setTimeout(r, 800));
      console.info("Renotificação enviada para", confirmationId);
    },
  });

  const filtered = (data ?? []).filter((c: any) => {
    if (!search) return true;
    const name = c.volunteers?.full_name?.toLowerCase() ?? "";
    const title = c.schedule_assignments?.schedules?.events?.title?.toLowerCase() ?? "";
    const s = search.toLowerCase();
    return name.includes(s) || title.includes(s);
  });

  // Agrupado por evento
  const grouped = new Map<string, { event: any; ministry: any; items: any[] }>();
  for (const c of filtered) {
    const ev = c.schedule_assignments?.schedules?.events;
    const mn = c.schedule_assignments?.schedules?.ministries;
    if (!ev) continue;
    if (!grouped.has(ev.id)) grouped.set(ev.id, { event: ev, ministry: mn, items: [] });
    grouped.get(ev.id)!.items.push(c);
  }
  const groups = Array.from(grouped.values()).sort((a, b) =>
    new Date(a.event.starts_at).getTime() - new Date(b.event.starts_at).getTime()
  );

  const stats = {
    total: (data ?? []).length,
    confirmed: (data ?? []).filter((c: any) => c.status === "confirmed").length,
    pending: (data ?? []).filter((c: any) => c.status === "pending").length,
    declined: (data ?? []).filter((c: any) => c.status === "declined").length,
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Confirmações</h1>
        <p className="mt-1 text-sm text-muted-foreground">Acompanhe o status de resposta de cada voluntário.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Confirmados", value: stats.confirmed, color: "text-success" },
          { label: "Pendentes", value: stats.pending, color: "text-warning" },
          { label: "Recusados", value: stats.declined, color: "text-destructive" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-3 text-center">
            <div className={cn("text-2xl font-bold", s.color)}>{s.value}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="mb-5 flex flex-wrap gap-2">
        {/* Search */}
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 min-w-[180px] flex-1">
          <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar voluntário ou evento..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 min-w-0"
          />
        </div>

        {/* Status filter */}
        <div className="flex rounded-xl border border-border bg-card overflow-hidden">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "px-3 py-2 text-xs font-medium transition-colors",
                statusFilter === f.value ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Ministry filter */}
        {ministries && ministries.length > 1 && (
          <select
            value={ministryFilter}
            onChange={(e) => setMinistryFilter(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-2 text-xs outline-none"
          >
            <option value="all">Todos os ministérios</option>
            {ministries.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-accent transition-colors"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          Atualizar
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !groups.length ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Nenhuma confirmação encontrada com os filtros selecionados.
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ event, ministry, items }) => {
            const confirmed = items.filter((i) => i.status === "confirmed").length;
            const pct = Math.round((confirmed / items.length) * 100);
            return (
              <div key={event.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                {/* Group header */}
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border bg-accent/20">
                  <div>
                    <div className="font-semibold text-sm">{event.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {ministry?.name} · {formatDate(event.starts_at, { dateStyle: "long", timeStyle: "short" })}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-semibold">{confirmed}/{items.length}</div>
                      <div className="text-[10px] text-muted-foreground">confirmados</div>
                    </div>
                    <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", pct >= 80 ? "bg-success" : pct >= 50 ? "bg-warning" : "bg-primary")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-border">
                  {items.map((c: any) => (
                    <ConfirmationRow
                      key={c.id}
                      confirmation={c}
                      onRenotify={() => renotify.mutate(c.id)}
                      renotifying={renotify.isPending}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ConfirmationRow({ confirmation: c, onRenotify, renotifying }: {
  confirmation: any; onRenotify: () => void; renotifying: boolean;
}) {
  const vol = c.volunteers;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="px-5 py-3">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold">
          {vol?.full_name?.charAt(0)?.toUpperCase()}
        </div>
        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{vol?.full_name}</span>
            <ConfirmationBadge status={c.status} />
          </div>
          {c.responded_at && (
            <div className="text-xs text-muted-foreground mt-0.5">
              Respondeu em {formatDate(c.responded_at)}
            </div>
          )}
          {!c.responded_at && (
            <div className="text-xs text-muted-foreground mt-0.5">
              Enviado em {formatDate(c.created_at)}
            </div>
          )}
        </div>
        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {c.message && (
            <button
              onClick={() => setExpanded((x) => !x)}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {expanded ? "Ocultar" : "Ver mensagem"}
            </button>
          )}
          {c.status === "pending" && (
            <button
              onClick={onRenotify}
              disabled={renotifying}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
            >
              <RefreshCw className={cn("h-3 w-3", renotifying && "animate-spin")} />
              Renotificar
            </button>
          )}
        </div>
      </div>
      {expanded && c.message && (
        <div className="mt-2 ml-11 rounded-xl bg-accent/50 border border-border px-3 py-2 text-xs text-muted-foreground italic">
          "{c.message}"
        </div>
      )}
    </div>
  );
}
