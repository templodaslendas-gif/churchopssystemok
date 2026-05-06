import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, CheckCircle2, XCircle, Users, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/substituicoes")({
  head: () => ({ meta: [{ title: "Substituições — ChurchOps" }] }),
  component: SubstitutionsPage,
});

const STATUS_COLOR: Record<string, string> = {
  open: "bg-warning/15 text-warning border-warning/30",
  accepted: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Aberta",
  accepted: "Aceita",
  rejected: "Recusada",
  cancelled: "Cancelada",
};

function SubstitutionsPage() {
  const { church, isGlobalManager, leaderMinistryIds } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"open" | "all">("open");
  const [openSub, setOpenSub] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["substitutions", church?.id, tab],
    enabled: !!church?.id,
    queryFn: async () => {
      let q = supabase
        .from("substitutions")
        .select(`
          id, status, message, created_at, updated_at, substitute_id,
          volunteers!substitutions_requester_id_fkey(id, full_name),
          substitutes:volunteers!substitutions_substitute_id_fkey(id, full_name),
          schedule_assignments!inner(
            id, volunteer_id,
            schedules!inner(
              id,
              ministries(id, name),
              events(id, title, starts_at)
            )
          )
        `)
        .eq("church_id", church!.id)
        .order("created_at", { ascending: false });

      if (tab === "open") q = q.eq("status", "open");

      if (!isGlobalManager && leaderMinistryIds.length > 0) {
        q = q.in("schedule_assignments.schedules.ministry_id", leaderMinistryIds);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).filter((s: any) => !!s.schedule_assignments?.schedules?.events);
    },
  });

  // Voluntários elegíveis para substituição de uma escala
  const { data: eligibleVols } = useQuery({
    queryKey: ["eligible-subs", openSub],
    enabled: !!openSub,
    queryFn: async () => {
      const sub = data?.find((s: any) => s.id === openSub);
      if (!sub) return [];
      const ministryId = sub.schedule_assignments?.schedules?.ministries?.id;
      if (!ministryId) return [];
      const { data: vols } = await supabase
        .from("volunteers")
        .select("id, full_name, volunteer_ministries(ministry_id)")
        .eq("church_id", church!.id)
        .eq("is_active", true)
        .neq("id", sub.schedule_assignments.volunteer_id);
      return (vols ?? []).filter((v: any) => v.volunteer_ministries.some((vm: any) => vm.ministry_id === ministryId));
    },
  });

  const assignSub = useMutation({
    mutationFn: async ({ subId, volId }: { subId: string; volId: string }) => {
      const { error } = await supabase
        .from("substitutions")
        .update({ substitute_id: volId, status: "accepted" })
        .eq("id", subId);
      if (error) throw error;

      // Atualizar confirmação do voluntário original
      const sub = data?.find((s: any) => s.id === subId);
      if (sub) {
        await supabase
          .from("schedule_assignments")
          .update({ volunteer_id: volId })
          .eq("id", sub.schedule_assignments.id);
        await supabase
          .from("confirmations")
          .update({ volunteer_id: volId, status: "pending", responded_at: null })
          .eq("assignment_id", sub.schedule_assignments.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["substitutions"] });
      qc.invalidateQueries({ queryKey: ["confirmations"] });
      qc.invalidateQueries({ queryKey: ["live-schedules"] });
      setOpenSub(null);
    },
    onError: (e: any) => console.error(e.message),
  });

  const cancelSub = useMutation({
    mutationFn: async (subId: string) => {
      const { error } = await supabase.from("substitutions").update({ status: "cancelled" }).eq("id", subId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["substitutions"] }),
  });

  const items = data ?? [];
  const openCount = items.filter((s: any) => s.status === "open").length;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Substituições</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gerencie pedidos de substituição dos voluntários.</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5 rounded-xl border border-border bg-card p-1 w-fit">
        <button
          onClick={() => setTab("open")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            tab === "open" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
          )}
        >
          Abertas
          {openCount > 0 && (
            <span className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
              tab === "open" ? "bg-white/20 text-white" : "bg-primary/15 text-primary"
            )}>
              {openCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("all")}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            tab === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
          )}
        >
          Todas
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !items.length ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <ArrowLeftRight className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            {tab === "open" ? "Nenhuma substituição aberta. Tudo certo! 🙌" : "Nenhuma substituição encontrada."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((s: any) => {
            const isExpanded = openSub === s.id;
            const ev = s.schedule_assignments?.schedules?.events;
            const mn = s.schedule_assignments?.schedules?.ministries;

            return (
              <div key={s.id} className={cn(
                "rounded-2xl border bg-card overflow-hidden transition-shadow",
                s.status === "open" ? "border-warning/30 shadow-[0_0_0_1px_hsl(38_92%_50%_/_0.15)]" : "border-border"
              )}>
                {/* Card header */}
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", STATUS_COLOR[s.status])}>
                          {STATUS_LABEL[s.status]}
                        </span>
                        {mn?.name && (
                          <span className="text-xs text-muted-foreground">{mn.name}</span>
                        )}
                      </div>
                      <div className="font-semibold text-sm">{ev?.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {ev && formatDate(ev.starts_at, { dateStyle: "long", timeStyle: "short" })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {s.status === "open" && (
                        <>
                          <button
                            onClick={() => setOpenSub(isExpanded ? null : s.id)}
                            className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                          >
                            <Users className="h-3.5 w-3.5" />
                            {isExpanded ? "Fechar" : "Atribuir"}
                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>
                          <button
                            onClick={() => cancelSub.mutate(s.id)}
                            disabled={cancelSub.isPending}
                            className="rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
                          >
                            Cancelar
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Requester / substitute */}
                  <div className="mt-4 flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-destructive/15 text-xs font-semibold text-destructive">
                        {s.volunteers?.full_name?.charAt(0)}
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground">Solicitante</div>
                        <div className="text-xs font-medium">{s.volunteers?.full_name}</div>
                      </div>
                    </div>
                    {s.substitutes && (
                      <>
                        <ArrowLeftRight className="h-4 w-4 text-muted-foreground self-center" />
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-success/15 text-xs font-semibold text-success">
                            {s.substitutes.full_name?.charAt(0)}
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground">Substituto</div>
                            <div className="text-xs font-medium">{s.substitutes.full_name}</div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {s.message && (
                    <div className="mt-3 rounded-xl bg-accent/50 border border-border px-3 py-2 text-xs text-muted-foreground italic">
                      "{s.message}"
                    </div>
                  )}
                </div>

                {/* Sub assignment panel */}
                {isExpanded && s.status === "open" && (
                  <div className="border-t border-border bg-accent/20 px-5 py-4">
                    <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                      Voluntários elegíveis do ministério
                    </div>
                    {!eligibleVols ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                      </div>
                    ) : !eligibleVols.length ? (
                      <p className="text-sm text-muted-foreground">Nenhum voluntário disponível neste ministério.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {eligibleVols.map((v: any) => (
                          <button
                            key={v.id}
                            onClick={() => assignSub.mutate({ subId: s.id, volId: v.id })}
                            disabled={assignSub.isPending}
                            className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-50"
                          >
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-semibold flex-shrink-0">
                              {v.full_name?.charAt(0)}
                            </div>
                            <span className="text-xs font-medium truncate">{v.full_name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {assignSub.isPending && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Atribuindo substituto...
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
