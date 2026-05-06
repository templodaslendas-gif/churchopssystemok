import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Building2, Pencil, Trash2, X, Loader2, Users, ChevronDown, ChevronRight, Tag } from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/ministerios")({
  head: () => ({ meta: [{ title: "Ministérios — ChurchOps" }] }),
  component: MinistriesPage,
});

const ministrySchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional().or(z.literal("")),
});

function MinistriesPage() {
  const { church } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [roleDialog, setRoleDialog] = useState<{ ministryId: string; name: string } | null>(null);
  const [newRoleName, setNewRoleName] = useState("");

  const { data: ministries, isLoading } = useQuery({
    queryKey: ["ministries-full", church?.id],
    enabled: !!church?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ministries")
        .select("*, ministry_roles(id, name), volunteer_ministries(volunteer_id, role, volunteers(full_name))")
        .eq("church_id", church!.id)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const upsert = useMutation({
    mutationFn: async (form: z.infer<typeof ministrySchema>) => {
      if (editing) {
        const { error } = await supabase.from("ministries").update({
          name: form.name, description: form.description || null,
        }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ministries").insert({
          church_id: church!.id, name: form.name, description: form.description || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ministries-full"] });
      qc.invalidateQueries({ queryKey: ["ministries-list"] });
      qc.invalidateQueries({ queryKey: ["ministries-roles"] });
      setDialogOpen(false);
      setEditing(null);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ministries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ministries-full"] });
      qc.invalidateQueries({ queryKey: ["ministries-list"] });
      setConfirmDelete(null);
    },
  });

  const addRole = useMutation({
    mutationFn: async ({ ministryId, name }: { ministryId: string; name: string }) => {
      const { error } = await supabase.from("ministry_roles").insert({ ministry_id: ministryId, name });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ministries-full"] });
      qc.invalidateQueries({ queryKey: ["ministries-roles"] });
      setNewRoleName("");
    },
  });

  const removeRole = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ministry_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ministries-full"] }),
  });

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ministérios</h1>
          <p className="mt-1 text-sm text-muted-foreground">{ministries?.length ?? 0} cadastrados</p>
        </div>
        <button
          onClick={() => { setEditing(null); setDialogOpen(true); }}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo ministério</span>
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !ministries?.length ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground mb-4">Nenhum ministério cadastrado ainda.</p>
          <button
            onClick={() => setDialogOpen(true)}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Criar primeiro ministério
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {ministries.map((m: any) => {
            const isExpanded = expandedId === m.id;
            const leaders = (m.volunteer_ministries ?? []).filter((vm: any) => vm.role === "leader");
            const members = (m.volunteer_ministries ?? []).filter((vm: any) => vm.role === "volunteer");

            return (
              <div key={m.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                {/* Ministry header */}
                <div className="flex items-center gap-3 px-5 py-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{m.name}</span>
                      {m.is_active === false && (
                        <span className="text-[10px] text-muted-foreground border border-border rounded-full px-1.5 py-0.5">Inativo</span>
                      )}
                    </div>
                    {m.description && <div className="text-xs text-muted-foreground mt-0.5 truncate">{m.description}</div>}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{m.volunteer_ministries?.length ?? 0} membros</span>
                      <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{m.ministry_roles?.length ?? 0} funções</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => { setEditing(m); setDialogOpen(true); }} className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setConfirmDelete(m)} className="rounded-lg p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : m.id)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-accent transition-colors"
                    >
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded */}
                {isExpanded && (
                  <div className="border-t border-border bg-accent/10 px-5 py-4 space-y-5">
                    {/* Roles */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Funções</div>
                        <button
                          onClick={() => setRoleDialog({ ministryId: m.id, name: m.name })}
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" /> Adicionar
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!m.ministry_roles?.length ? (
                          <span className="text-xs text-muted-foreground">Nenhuma função cadastrada.</span>
                        ) : m.ministry_roles.map((r: any) => (
                          <div key={r.id} className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs">
                            {r.name}
                            <button
                              onClick={() => removeRole.mutate(r.id)}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Leaders */}
                    {leaders.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Líderes</div>
                        <div className="flex flex-wrap gap-2">
                          {leaders.map((vm: any) => (
                            <div key={vm.volunteer_id} className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                              {vm.volunteers?.full_name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Members */}
                    {members.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Voluntários ({members.length})</div>
                        <div className="flex flex-wrap gap-2">
                          {members.map((vm: any) => (
                            <div key={vm.volunteer_id} className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs">
                              {vm.volunteers?.full_name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upsert dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)] animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display text-lg font-semibold">
                {editing ? "Editar ministério" : "Novo ministério"}
              </h3>
              <button onClick={() => { setDialogOpen(false); setEditing(null); }} className="rounded-lg p-1.5 hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <MinistryForm
              initial={editing}
              onSubmit={(v) => upsert.mutate(v)}
              saving={upsert.isPending}
              onCancel={() => { setDialogOpen(false); setEditing(null); }}
            />
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)] animate-slide-up">
            <h3 className="font-display text-lg font-semibold mb-2">Excluir ministério?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Vai remover <strong>{confirmDelete.name}</strong> e todos os dados associados.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent">Cancelar</button>
              <button
                onClick={() => remove.mutate(confirmDelete.id)}
                disabled={remove.isPending}
                className="flex-1 rounded-xl bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50"
              >
                {remove.isPending ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role dialog */}
      {roleDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)] animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-base font-semibold">Nova função — {roleDialog.name}</h3>
              <button onClick={() => setRoleDialog(null)} className="rounded-lg p-1.5 hover:bg-accent"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <input
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="Ex: Baterista, Tecladista, Câmera..."
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newRoleName.trim()) {
                    addRole.mutate({ ministryId: roleDialog.ministryId, name: newRoleName.trim() });
                  }
                }}
              />
              <div className="flex gap-2">
                <button onClick={() => setRoleDialog(null)} className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent">Fechar</button>
                <button
                  onClick={() => {
                    if (newRoleName.trim()) addRole.mutate({ ministryId: roleDialog.ministryId, name: newRoleName.trim() });
                  }}
                  disabled={!newRoleName.trim() || addRole.isPending}
                  className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {addRole.isPending ? "Adicionando..." : "Adicionar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MinistryForm({ initial, onSubmit, saving, onCancel }: any) {
  const [form, setForm] = useState({ name: initial?.name ?? "", description: initial?.description ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    const parsed = ministrySchema.safeParse(form);
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
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Nome *</label>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Louvor, Mídia, Recepção..."
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary placeholder:text-muted-foreground/50"
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Descrição</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Descrição opcional do ministério..."
          rows={2}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary resize-none placeholder:text-muted-foreground/50"
        />
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={onCancel} className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent">Cancelar</button>
        <button
          onClick={submit}
          disabled={saving}
          className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Salvando..." : initial ? "Salvar" : "Criar"}
        </button>
      </div>
    </div>
  );
}
