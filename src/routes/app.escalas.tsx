import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Calendar as CalIcon, AlertTriangle, Send, Trash2, X, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { EVENT_TYPE_LABEL } from "@/lib/permissions";
import { formatDate, toLocalDatetimeInput } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/escalas")({
  head: () => ({ meta: [{ title: "Escalas — ChurchOps" }] }),
  component: SchedulesPage,
});

const eventSchema = z.object({
  title: z.string().trim().min(2).max(120),
  event_type: z.enum(["culto", "ensaio", "evento_especial", "reuniao"]),
  starts_at: z.string().min(1, "Data obrigatória"),
  location: z.string().trim().max(120).optional().or(z.literal("")),
});

type Conflict = { type: "same_time" | "same_day" | "frequency"; message: string };

function SchedulesPage() {
  const { church } = useAuth();
  const qc = useQueryClient();
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const { data: events } = useQuery({
    queryKey: ["events-list", church?.id],
    enabled: !!church?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("church_id", church!.id).order("starts_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: ministries } = useQuery({
    queryKey: ["ministries-roles", church?.id],
    enabled: !!church?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("ministries").select("id, name, ministry_roles(id, name)").eq("church_id", church!.id);
      if (error) throw error;
      return data;
    },
  });

  const { data: volunteers } = useQuery({
    queryKey: ["vols-light", church?.id],
    enabled: !!church?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("volunteers").select("id, full_name, volunteer_ministries(ministry_id)").eq("church_id", church!.id).eq("is_active", true).order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: rules } = useQuery({
    queryKey: ["conflict-rules", church?.id],
    enabled: !!church?.id,
    queryFn: async () => {
      const { data } = await supabase.from("conflict_rules").select("*").eq("church_id", church!.id).maybeSingle();
      return data;
    },
  });

  const upsertEvent = useMutation({
    mutationFn: async (v: z.infer<typeof eventSchema>) => {
      if (editingEvent) {
        const { error } = await supabase.from("events").update({
          title: v.title, event_type: v.event_type, starts_at: v.starts_at, location: v.location || null,
        }).eq("id", editingEvent.id);
        if (error) throw error;
        return editingEvent.id;
      } else {
        const { data, error } = await supabase.from("events").insert({
          church_id: church!.id, title: v.title, event_type: v.event_type, starts_at: v.starts_at, location: v.location || null,
        }).select("id").single();
        if (error) throw error;
        return data.id;
      }
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["events-list"] });
      qc.invalidateQueries({ queryKey: ["schedule"] });
      setEventDialogOpen(false);
      setEditingEvent(null);
      setSelectedEventId(id);
    },
    onError: (e: any) => console.error(e.message),
  });

  const deleteEvent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("events").delete().eq("id", selectedEventId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events-list"] });
      qc.invalidateQueries({ queryKey: ["schedule"] });
      qc.invalidateQueries({ queryKey: ["live-schedules"] });
      setSelectedEventId(null);
      setDeleteConfirm(false);
    },
    onError: (e: any) => console.error(e.message),
  });

  const selectedEvent = events?.find((e: any) => e.id === selectedEventId);
  const upcoming = events?.filter((e: any) => new Date(e.starts_at) >= new Date()) ?? [];
  const past = events?.filter((e: any) => new Date(e.starts_at) < new Date()) ?? [];

  return (
    <div className="container mx-auto px-4 py-6 lg:px-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Escalas & Eventos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Crie eventos, monte escalas e detecte conflitos.</p>
        </div>
        <button
          onClick={() => { setEditingEvent(null); setEventDialogOpen(true); }}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo evento</span>
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Event list */}
        <div className="space-y-4">
          <EventGroup
            title="Próximos"
            events={upcoming}
            selectedId={selectedEventId}
            onSelect={setSelectedEventId}
          />
          {past.length > 0 && (
            <EventGroup
              title="Passados"
              events={past}
              selectedId={selectedEventId}
              onSelect={setSelectedEventId}
              collapsed
            />
          )}
        </div>

        {/* Schedule editor */}
        <div>
          {selectedEvent ? (
            <EventScheduleEditor
              event={selectedEvent}
              ministries={ministries ?? []}
              volunteers={volunteers ?? []}
              rules={rules}
              churchId={church!.id}
              onEdit={() => { setEditingEvent(selectedEvent); setEventDialogOpen(true); }}
              onDelete={() => setDeleteConfirm(true)}
              deleting={deleteEvent.isPending}
            />
          ) : (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
              Selecione um evento para montar a escala.
            </div>
          )}
        </div>
      </div>

      {/* Event Dialog */}
      {eventDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)] animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold">
                {editingEvent ? "Editar evento" : "Novo evento"}
              </h3>
              <button onClick={() => { setEventDialogOpen(false); setEditingEvent(null); }} className="rounded-lg p-1.5 hover:bg-accent transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <EventForm
              initial={editingEvent}
              onSubmit={(v) => upsertEvent.mutate(v)}
              saving={upsertEvent.isPending}
              onCancel={() => { setEventDialogOpen(false); setEditingEvent(null); }}
            />
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)] animate-slide-up">
            <h3 className="font-display text-lg font-semibold mb-2">Excluir evento?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Isso vai apagar o evento <strong>"{selectedEvent?.title}"</strong>, todas as escalas e confirmações. Essa ação não pode ser desfeita.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(false)} className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors">
                Cancelar
              </button>
              <button
                onClick={() => deleteEvent.mutate()}
                disabled={deleteEvent.isPending}
                className="flex-1 rounded-xl bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {deleteEvent.isPending ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EventGroup({ title, events, selectedId, onSelect, collapsed = false }: {
  title: string; events: any[]; selectedId: string | null; onSelect: (id: string) => void; collapsed?: boolean;
}) {
  const [open, setOpen] = useState(!collapsed);
  const eventTypeIcon: Record<string, string> = { culto: "⛪", ensaio: "🎵", evento_especial: "⭐", reuniao: "🤝" };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:bg-accent/50 transition-colors"
      >
        {title} ({events.length})
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="divide-y divide-border border-t border-border">
          {!events.length ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhum evento.</p>
          ) : events.map((e: any) => (
            <button
              key={e.id}
              onClick={() => onSelect(e.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                selectedId === e.id ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-accent/50"
              )}
            >
              <span className="text-base">{eventTypeIcon[e.event_type] ?? "📅"}</span>
              <div className="min-w-0 flex-1">
                <div className={cn("text-sm font-medium truncate", selectedId === e.id && "text-primary")}>{e.title}</div>
                <div className="text-xs text-muted-foreground">{formatDate(e.starts_at)}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EventForm({ initial, onSubmit, saving, onCancel }: {
  initial: any; onSubmit: (v: z.infer<typeof eventSchema>) => void; saving: boolean; onCancel: () => void;
}) {
  const [form, setForm] = useState(() => initial ? {
    title: initial.title,
    event_type: initial.event_type,
    starts_at: toLocalDatetimeInput(initial.starts_at),
    location: initial.location ?? "",
  } : { title: "", event_type: "culto" as const, starts_at: "", location: "" });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    const parsed = eventSchema.safeParse({ ...form, starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : "" });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { errs[i.path[0] as string] = i.message; });
      setErrors(errs);
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  };

  return (
    <div className="space-y-4">
      <Field label="Título" error={errors.title}>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Culto de Domingo"
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50"
        />
      </Field>
      <Field label="Tipo" error={errors.event_type}>
        <select
          value={form.event_type}
          onChange={(e) => setForm({ ...form, event_type: e.target.value as any })}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors"
        >
          {Object.entries(EVENT_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <Field label="Data e hora" error={errors.starts_at}>
        <input
          type="datetime-local"
          value={form.starts_at}
          onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors"
        />
      </Field>
      <Field label="Local (opcional)">
        <input
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          placeholder="Salão principal"
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50"
        />
      </Field>
      <div className="flex gap-2 pt-2">
        <button onClick={onCancel} className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors">
          Cancelar
        </button>
        <button onClick={submit} disabled={saving} className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50">
          {saving ? "Salvando..." : initial ? "Salvar" : "Criar"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/* ----------------------------------------------------------------
   EventScheduleEditor
---------------------------------------------------------------- */
function EventScheduleEditor({ event, ministries, volunteers, rules, churchId, onEdit, onDelete, deleting }: any) {
  const qc = useQueryClient();
  const [activeMinistry, setActiveMinistry] = useState<string>(ministries[0]?.id ?? "");

  useEffect(() => {
    if (ministries.length && !activeMinistry) setActiveMinistry(ministries[0].id);
  }, [ministries, activeMinistry]);

  const { data: schedule } = useQuery({
    queryKey: ["schedule", event.id, activeMinistry],
    enabled: !!activeMinistry,
    queryFn: async () => {
      const { data: sched } = await supabase
        .from("schedules")
        .select("*, schedule_assignments(id, volunteer_id, ministry_role_id, volunteers(full_name), confirmations(status))")
        .eq("event_id", event.id).eq("ministry_id", activeMinistry).maybeSingle();
      return sched;
    },
  });

  // Batch conflict detection — uma query para todos os voluntários elegíveis
  const eligibleVols = volunteers.filter((v: any) => v.volunteer_ministries.some((vm: any) => vm.ministry_id === activeMinistry));
  const assignments = schedule?.schedule_assignments ?? [];
  const assignedIds = new Set(assignments.map((a: any) => a.volunteer_id));
  const availableVols = eligibleVols.filter((v: any) => !assignedIds.has(v.id));

  const { data: conflictsMap } = useQuery({
    queryKey: ["conflicts-batch", event.id, activeMinistry, availableVols.map((v: any) => v.id).join(",")],
    enabled: availableVols.length > 0 && !!rules,
    staleTime: 30_000,
    queryFn: async () => {
      const eventStart = new Date(event.starts_at);
      const dayStart = new Date(eventStart); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(eventStart); dayEnd.setHours(23, 59, 59, 999);
      const monthStart = new Date(eventStart.getFullYear(), eventStart.getMonth(), 1).toISOString();
      const monthEnd = new Date(eventStart.getFullYear(), eventStart.getMonth() + 1, 0, 23, 59, 59).toISOString();

      // Single query for all assignments in the relevant timeframe
      const volIds = availableVols.map((v: any) => v.id);
      const { data: allAssignments } = await supabase
        .from("schedule_assignments")
        .select("volunteer_id, schedules(events(id, starts_at, title))")
        .in("volunteer_id", volIds)
        .eq("church_id", churchId);

      // Frequency counts
      const { data: freqData } = rules?.warn_frequency ? await supabase
        .from("schedule_assignments")
        .select("volunteer_id")
        .in("volunteer_id", volIds)
        .eq("church_id", churchId)
        .gte("schedules.events.starts_at", monthStart)
        .lte("schedules.events.starts_at", monthEnd) : { data: [] };

      const freqCounts: Record<string, number> = {};
      (freqData ?? []).forEach((a: any) => { freqCounts[a.volunteer_id] = (freqCounts[a.volunteer_id] ?? 0) + 1; });

      const result: Record<string, Conflict[]> = {};
      for (const vol of availableVols) {
        const conflicts: Conflict[] = [];
        const volAssignments = (allAssignments ?? []).filter((a: any) => a.volunteer_id === vol.id);

        const sameDay = volAssignments.filter((a: any) => {
          const ev = (a.schedules as any)?.events;
          if (!ev || ev.id === event.id) return false;
          const t = new Date(ev.starts_at);
          return t >= dayStart && t <= dayEnd;
        });

        const sameTime = sameDay.find((a: any) =>
          Math.abs(new Date((a.schedules as any).events.starts_at).getTime() - eventStart.getTime()) < 60 * 60 * 1000
        );

        if (sameTime) {
          conflicts.push({ type: "same_time", message: `Já escalado em "${(sameTime.schedules as any).events.title}"` });
        } else if (sameDay.length && rules?.warn_same_day) {
          conflicts.push({ type: "same_day", message: "Já escalado neste dia" });
        }

        const freq = freqCounts[vol.id] ?? 0;
        const limit = rules?.max_assignments_per_month ?? 4;
        if (rules?.warn_frequency && freq >= limit) {
          conflicts.push({ type: "frequency", message: `${freq}/${limit} escalas neste mês` });
        }

        result[vol.id] = conflicts;
      }
      return result;
    },
  });

  const ensureSchedule = async () => {
    if (schedule) return schedule.id;
    const { data, error } = await supabase.from("schedules").insert({
      church_id: churchId, event_id: event.id, ministry_id: activeMinistry,
    }).select("id").single();
    if (error) throw error;
    return data.id;
  };

  const addAssignment = useMutation({
    mutationFn: async ({ volunteerId, roleId }: { volunteerId: string; roleId: string | null }) => {
      const sId = await ensureSchedule();
      const { data: assignment, error } = await supabase.from("schedule_assignments").insert({
        church_id: churchId, schedule_id: sId, volunteer_id: volunteerId, ministry_role_id: roleId,
      }).select("id").single();
      if (error) throw error;
      await supabase.from("confirmations").insert({ church_id: churchId, assignment_id: assignment.id, volunteer_id: volunteerId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule"] });
      qc.invalidateQueries({ queryKey: ["live-schedules"] });
    },
    onError: (e: any) => console.error(e.message),
  });

  const removeAssignment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedule_assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule"] });
      qc.invalidateQueries({ queryKey: ["live-schedules"] });
    },
  });

  const publish = useMutation({
    mutationFn: async () => {
      const sId = await ensureSchedule();
      const { error } = await supabase.from("schedules").update({ is_published: true, published_at: new Date().toISOString() }).eq("id", sId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule"] });
      qc.invalidateQueries({ queryKey: ["live-schedules"] });
    },
  });

  const ministry = ministries.find((m: any) => m.id === activeMinistry);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-[var(--shadow-elegant)]">
      {/* Event header */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">{event.title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{formatDate(event.starts_at, { dateStyle: "long", timeStyle: "short" })}</p>
          </div>
          <div className="flex items-center gap-2">
            {schedule?.is_published && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-success border border-success/30 bg-success/10 rounded-full px-2 py-0.5">
                Publicada
              </span>
            )}
            <button onClick={onEdit} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors">
              <Pencil className="h-3 w-3" /> Editar
            </button>
            <button
              onClick={onDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-3 w-3" /> Excluir
            </button>
            <button
              onClick={() => publish.mutate()}
              disabled={publish.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Send className="h-3 w-3" />
              {schedule?.is_published ? "Republicar" : "Publicar"}
            </button>
          </div>
        </div>

        {/* Ministry tabs */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {ministries.map((m: any) => (
            <button
              key={m.id}
              onClick={() => setActiveMinistry(m.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                activeMinistry === m.id ? "bg-primary text-primary-foreground" : "border border-border hover:bg-accent"
              )}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="grid gap-4 p-5 md:grid-cols-2">
        {/* Escalados */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Escalados ({assignments.length})
          </div>
          <div className="min-h-[120px] space-y-2 rounded-xl border border-dashed border-border p-3">
            {!assignments.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum voluntário escalado.</p>
            ) : assignments.map((a: any) => {
              const role = ministry?.ministry_roles.find((r: any) => r.id === a.ministry_role_id);
              const status = a.confirmations?.[0]?.status ?? "pending";
              return (
                <div key={a.id} className={cn(
                  "flex items-center justify-between rounded-xl px-3 py-2 border",
                  status === "confirmed" ? "bg-success/10 border-success/20" :
                  status === "declined" ? "bg-destructive/10 border-destructive/20" :
                  "bg-accent/50 border-border"
                )}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0",
                      status === "confirmed" ? "bg-success" :
                      status === "declined" ? "bg-destructive" : "bg-muted-foreground/50"
                    )} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{a.volunteers?.full_name}</div>
                      {role && <div className="text-xs text-muted-foreground">{role.name}</div>}
                    </div>
                  </div>
                  <button
                    onClick={() => removeAssignment.mutate(a.id)}
                    className="ml-2 rounded-lg p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Disponíveis */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Disponíveis ({availableVols.length})
          </div>
          <div className="space-y-2 rounded-xl border border-border p-3 max-h-[400px] overflow-y-auto">
            {!availableVols.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum voluntário disponível.</p>
            ) : availableVols.map((v: any) => {
              const conflicts = conflictsMap?.[v.id] ?? [];
              const blocking = conflicts.find((c) => c.type === "same_time");
              const isBlocked = !!blocking && !!rules?.block_same_time;

              return (
                <VolunteerAddRow
                  key={v.id}
                  volunteer={v}
                  ministry={ministry}
                  conflicts={conflicts}
                  isBlocked={isBlocked}
                  loading={!conflictsMap}
                  onAdd={(roleId) => addAssignment.mutate({ volunteerId: v.id, roleId })}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function VolunteerAddRow({ volunteer, ministry, conflicts, isBlocked, loading, onAdd }: any) {
  const [roleId, setRoleId] = useState(() => ministry?.ministry_roles[0]?.id ?? "");

  useEffect(() => {
    setRoleId(ministry?.ministry_roles[0]?.id ?? "");
  }, [ministry?.id]);

  return (
    <div className={cn(
      "flex flex-col gap-2 rounded-xl border px-3 py-2.5",
      isBlocked ? "border-destructive/20 bg-destructive/5 opacity-60" : "border-border bg-card/50"
    )}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{volunteer.full_name}</div>
          {conflicts.length > 0 && (
            <div className={cn("mt-0.5 flex items-center gap-1 text-xs", isBlocked ? "text-destructive" : "text-warning")}>
              <AlertTriangle className="h-3 w-3" />
              {conflicts[0].message}
            </div>
          )}
        </div>
        <button
          disabled={loading || isBlocked}
          onClick={() => onAdd(roleId || null)}
          className={cn(
            "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            isBlocked ? "bg-muted text-muted-foreground cursor-not-allowed" :
            "bg-primary/10 text-primary hover:bg-primary/20"
          )}
        >
          {loading ? "..." : isBlocked ? "Bloqueado" : "Escalar"}
        </button>
      </div>
      {ministry?.ministry_roles.length > 0 && !isBlocked && (
        <select
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none"
        >
          {ministry.ministry_roles.map((r: any) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}
