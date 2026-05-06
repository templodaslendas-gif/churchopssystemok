import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, XCircle, ArrowLeftRight, Calendar, Loader2, MessageSquare } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ConfirmationBadge } from "./app.index";

export const Route = createFileRoute("/app/minhas-escalas")({
  head: () => ({ meta: [{ title: "Minhas Escalas — ChurchOps" }] }),
  component: MyAssignments,
});

type Item = {
  assignment_id: string;
  confirmation_id: string | null;
  status: string;
  schedules: any;
};

function MyAssignments() {
  const { user, church } = useAuth();
  const qc = useQueryClient();
  const [subDialog, setSubDialog] = useState<{ assignmentId: string; eventTitle: string } | null>(null);
  const [subMessage, setSubMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<{ id: string; action: string } | null>(null);

  const queryKey = ["my-assignments", user?.id, church?.id];

  const { data, isLoading, error } = useQuery({
    queryKey,
    enabled: !!user?.id && !!church?.id,
    refetchOnMount: "always",
    staleTime: 0,
    queryFn: async () => {
      let { data: vol } = await supabase.from("volunteers").select("id, full_name, email").eq("user_id", user!.id).eq("church_id", church!.id).maybeSingle();
      if (!vol && user?.email) {
        const { data: byEmail } = await supabase.from("volunteers").select("id, full_name, email").is("user_id", null).ilike("email", user.email).eq("church_id", church!.id).maybeSingle();
        vol = byEmail ?? null;
      }
      if (!vol) return { volunteer: null, items: [] as Item[] };

      const { data: assigns } = await supabase
        .from("schedule_assignments")
        .select("id, schedule_id, ministry_role_id, schedules!inner(is_published, ministries(name), events(title, starts_at, location))")
        .eq("volunteer_id", vol.id)
        .eq("church_id", church!.id)
        .eq("schedules.is_published", true);

      const assignmentIds = (assigns ?? []).map((a: any) => a.id);
      const confMap = new Map<string, { id: string; status: string }>();
      if (assignmentIds.length > 0) {
        const { data: confs } = await supabase.from("confirmations").select("id, assignment_id, status").in("assignment_id", assignmentIds);
        for (const c of (confs ?? []) as any[]) confMap.set(c.assignment_id, { id: c.id, status: c.status });
      }

      const items: Item[] = (assigns ?? []).map((a: any) => {
        const c = confMap.get(a.id);
        return { assignment_id: a.id, confirmation_id: c?.id ?? null, status: c?.status ?? "pending", schedules: a.schedules };
      }).sort((x, y) => {
        const dx = new Date(x.schedules?.events?.starts_at ?? 0).getTime();
        const dy = new Date(y.schedules?.events?.starts_at ?? 0).getTime();
        return dx - dy;
      });

      return { volunteer: vol, items };
    },
  });

  const invalidateAll = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["my-assignments"] }),
      qc.invalidateQueries({ queryKey: ["my-upcoming-assignments"] }),
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] }),
      qc.invalidateQueries({ queryKey: ["live-schedules"] }),
      qc.invalidateQueries({ queryKey: ["confirmations"] }),
    ]);
  };

  const respond = useMutation({
    mutationFn: async ({ assignment_id, status, message }: { assignment_id: string; status: "confirmed" | "declined" | "substitution_requested"; message?: string }) => {
      const { data: res, error } = await supabase.rpc("respond_to_assignment", {
        _assignment_id: assignment_id,
        _status: status,
        _message: message ?? undefined,
      });
      if (error) throw error;
      return res;
    },
    onMutate: async (vars) => {
      setPendingAction({ id: vars.assignment_id, action: vars.status });
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<any>(queryKey);
      if (previous?.items) {
        qc.setQueryData(queryKey, {
          ...previous,
          items: previous.items.map((i: Item) =>
            i.assignment_id === vars.assignment_id ? { ...i, status: vars.status } : i
          ),
        });
      }
      return { previous };
    },
    onSuccess: (_d, vars) => {
      const label =
        vars.status === "confirmed" ? "🙏 Obrigado pelo seu Sim!" :
        vars.status === "declined" ? "Recusa registrada" :
        "Pedido de substituto enviado";
      // toast equivalent — using alert for now, replace with sonner
      console.info(label);
      invalidateAll();
    },
    onError: async (err: any, _vars, ctx: any) => {
      if (ctx?.previous) qc.setQueryData(queryKey, ctx.previous);
      console.error(err?.message);
    },
    onSettled: () => setPendingAction(null),
  });

  const handle = (assignment_id: string, status: "confirmed" | "declined" | "substitution_requested", eventTitle?: string) => {
    if (respond.isPending) return;
    if (status === "substitution_requested") {
      setSubDialog({ assignmentId: assignment_id, eventTitle: eventTitle ?? "" });
      return;
    }
    respond.mutate({ assignment_id, status });
  };

  const submitSubstitution = () => {
    if (!subDialog) return;
    respond.mutate({ assignment_id: subDialog.assignmentId, status: "substitution_requested", message: subMessage || undefined });
    setSubDialog(null);
    setSubMessage("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-destructive">
          Erro ao carregar escalas: {(error as any).message}
        </div>
      </div>
    );
  }

  if (data && !data.volunteer) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Sua conta ainda não está vinculada como voluntário. Peça ao líder para te cadastrar com este mesmo e-mail.
        </div>
      </div>
    );
  }

  const items = data?.items ?? [];
  const now = Date.now();
  const pendingItems = items.filter((i) => i.status === "pending" && new Date(i.schedules?.events?.starts_at ?? 0).getTime() >= now);
  const answeredItems = items.filter((i) => !pendingItems.includes(i));

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Minhas Escalas</h1>
        <p className="mt-1 text-muted-foreground">Olá, {data?.volunteer?.full_name}.</p>
      </div>

      {/* Pendentes */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-primary">Aguardando sua resposta</h2>
          {pendingItems.length > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {pendingItems.length}
            </span>
          )}
        </div>

        {pendingItems.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-success mb-3" />
            <p className="text-sm text-muted-foreground">Tudo respondido. Obrigado! 🙌</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingItems.map((it) => {
              const e = it.schedules?.events;
              const m = it.schedules?.ministries;
              const isThis = pendingAction?.id === it.assignment_id;
              return (
                <div key={it.assignment_id} className="relative rounded-2xl border border-primary/30 bg-card overflow-hidden shadow-[var(--shadow-elegant)]">
                  {/* Top accent bar */}
                  <div className="h-1 bg-gradient-to-r from-primary to-violet-500" />

                  <div className="p-6">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-2">
                      Confirmação pendente
                    </div>
                    <h3 className="text-xl font-bold">{e?.title}</h3>

                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                        {e && formatDate(e.starts_at, { dateStyle: "full", timeStyle: "short" })}
                      </div>
                      {m?.name && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="h-3.5 w-3.5 flex-shrink-0 text-center">⛪</span>
                          Ministério: {m.name}
                        </div>
                      )}
                      {e?.location && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="h-3.5 w-3.5 flex-shrink-0 text-center">📍</span>
                          {e.location}
                        </div>
                      )}
                    </div>

                    <div className="mt-6 grid grid-cols-3 gap-2">
                      <ActionButton
                        label="Confirmar"
                        icon={<CheckCircle2 className="h-4 w-4" />}
                        loading={isThis && pendingAction?.action === "confirmed"}
                        disabled={respond.isPending}
                        variant="primary"
                        onClick={() => handle(it.assignment_id, "confirmed")}
                      />
                      <ActionButton
                        label="Não posso"
                        icon={<XCircle className="h-4 w-4" />}
                        loading={isThis && pendingAction?.action === "declined"}
                        disabled={respond.isPending}
                        variant="outline"
                        onClick={() => handle(it.assignment_id, "declined")}
                      />
                      <ActionButton
                        label="Substituto"
                        icon={<ArrowLeftRight className="h-4 w-4" />}
                        loading={isThis && pendingAction?.action === "substitution_requested"}
                        disabled={respond.isPending}
                        variant="ghost"
                        onClick={() => handle(it.assignment_id, "substitution_requested", e?.title)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Histórico */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Histórico</h2>
        {answeredItems.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Nenhuma escala no histórico ainda.
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <ul className="divide-y divide-border">
              {answeredItems.map((i) => {
                const e = i.schedules?.events;
                return (
                  <li key={i.assignment_id} className="flex items-center justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                      <div className="font-medium text-sm">{e?.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{e && formatDate(e.starts_at)}</div>
                    </div>
                    <ConfirmationBadge status={i.status} />
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* Dialog de substituição */}
      {subDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)] animate-slide-up">
            <h3 className="font-display text-lg font-semibold mb-1">Pedir substituto</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Para: <strong>{subDialog.eventTitle}</strong>
            </p>
            <div className="space-y-1.5 mb-4">
              <label className="text-xs font-medium text-muted-foreground">
                Motivo (opcional)
              </label>
              <div className="flex items-start gap-2 rounded-xl border border-border bg-background p-3">
                <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <textarea
                  value={subMessage}
                  onChange={(e) => setSubMessage(e.target.value)}
                  placeholder="Ex: Vou viagem, não consigo comparecer..."
                  rows={3}
                  className="w-full bg-transparent text-sm outline-none resize-none placeholder:text-muted-foreground/50"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setSubDialog(null); setSubMessage(""); }}
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={submitSubstitution}
                disabled={respond.isPending}
                className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {respond.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Enviar pedido"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionButton({ label, icon, loading, disabled, variant, onClick }: {
  label: string; icon: React.ReactNode; loading: boolean;
  disabled: boolean; variant: "primary" | "outline" | "ghost"; onClick: () => void;
}) {
  const base = "flex flex-col items-center gap-1.5 rounded-xl py-3 text-xs font-medium transition-all disabled:opacity-50";
  const variants = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    outline: "border border-border hover:bg-accent",
    ghost: "hover:bg-accent text-muted-foreground",
  };
  return (
    <button onClick={onClick} disabled={disabled || loading} className={cn(base, variants[variant])}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}
