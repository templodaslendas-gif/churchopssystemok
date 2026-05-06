import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, UserCheck, UserX, Mail, Phone, Pencil, Trash2, X, Loader2, ChevronDown } from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/voluntarios")({
  head: () => ({ meta: [{ title: "Voluntários — ChurchOps" }] }),
  component: VolunteersPage,
});

const volSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

type VolForm = z.infer<typeof volSchema>;

function VolunteersPage() {
  const { church } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const [inviteVolId, setInviteVolId] = useState<string | null>(null);

  const { data: volunteers, isLoading } = useQuery({
    queryKey: ["volunteers", church?.id],
    enabled: !!church?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("volunteers")
        .select("*, volunteer_ministries(ministry_id, role, ministries(name))")
        .eq("church_id", church!.id)
        .order("full_name");
      if (error) throw error;
      return data;
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

  const upsert = useMutation({
    mutationFn: async (form: VolForm) => {
      if (editing) {
        const { error } = await supabase.from("volunteers").update({
          full_name: form.full_name,
          email: form.email || null,
          phone: form.phone || null,
          notes: form.notes || null,
        }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("volunteers").insert({
          church_id: church!.id,
          full_name: form.full_name,
          email: form.email || null,
          phone: form.phone || null,
          notes: form.notes || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["volunteers"] });
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e: any) => console.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("volunteers").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["volunteers"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("volunteers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["volunteers"] });
      setConfirmDelete(null);
    },
    onError: (e: any) => console.error(e.message),
  });

  const sendInvite = useMutation({
    mutationFn: async ({ volId, ministryId }: { volId: string; ministryId: string }) => {
      const vol = volunteers?.find((v: any) => v.id === volId);
      if (!vol?.email) throw new Error("Voluntário sem e-mail cadastrado");
      const { error } = await supabase.from("invitations").insert({
        church_id: church!.id,
        volunteer_id: volId,
        ministry_id: ministryId,
        email: vol.email,
        role: "volunteer",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invitations"] });
      setInviteVolId(null);
    },
    onError: (e: any) => console.error(e.message),
  });

  const filtered = (volunteers ?? []).filter((v: any) => {
    const matchesStatus =
      activeFilter === "all" ||
      (activeFilter === "active" && v.is_active) ||
      (activeFilter === "inactive" && !v.is_active);
    const matchesSearch = !search || v.full_name?.toLowerCase().includes(search.toLowerCase()) || v.email?.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Voluntários</h1>
          <p className="mt-1 text-sm text-muted-foreground">{volunteers?.length ?? 0} cadastrados</p>
        </div>
        <button
          onClick={() => { setEditing(null); setDialogOpen(true); }}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo voluntário</span>
        </button>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 min-w-[180px] flex-1">
          <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
          />
        </div>
        <div className="flex rounded-xl border border-border bg-card overflow-hidden">
          {(["all", "active", "inactive"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={cn(
                "px-3 py-2 text-xs font-medium transition-colors",
                activeFilter === f ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"
              )}
            >
              {{ all: "Todos", active: "Ativos", inactive: "Inativos" }[f]}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !filtered.length ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Nenhum voluntário encontrado.
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <ul className="divide-y divide-border">
            {filtered.map((v: any) => (
              <VolunteerRow
                key={v.id}
                volunteer={v}
                onEdit={() => { setEditing(v); setDialogOpen(true); }}
                onToggle={() => toggle.mutate({ id: v.id, active: !v.is_active })}
                onDelete={() => setConfirmDelete(v)}
                onInvite={() => setInviteVolId(v.id)}
                toggling={toggle.isPending}
              />
            ))}
          </ul>
        </div>
      )}

      {/* Upsert dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)] animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display text-lg font-semibold">
                {editing ? "Editar voluntário" : "Novo voluntário"}
              </h3>
              <button onClick={() => { setDialogOpen(false); setEditing(null); }} className="rounded-lg p-1.5 hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <VolunteerForm
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
            <h3 className="font-display text-lg font-semibold mb-2">Excluir voluntário?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Vai remover <strong>{confirmDelete.full_name}</strong> permanentemente, incluindo todas as suas escalas e confirmações.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent">
                Cancelar
              </button>
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

      {/* Invite dialog */}
      {inviteVolId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)] animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold">Enviar convite</h3>
              <button onClick={() => setInviteVolId(null)} className="rounded-lg p-1.5 hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground">Ministério</label>
              <select
                id="invite-ministry"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none"
              >
                {ministries?.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setInviteVolId(null)} className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent">
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    const sel = (document.getElementById("invite-ministry") as HTMLSelectElement).value;
                    sendInvite.mutate({ volId: inviteVolId, ministryId: sel });
                  }}
                  disabled={sendInvite.isPending || !ministries?.length}
                  className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {sendInvite.isPending ? "Enviando..." : "Enviar convite"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VolunteerRow({ volunteer: v, onEdit, onToggle, onDelete, onInvite, toggling }: any) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ministries = v.volunteer_ministries ?? [];

  return (
    <li className="flex items-center gap-3 px-5 py-4 hover:bg-accent/20 transition-colors relative">
      {/* Avatar */}
      <div className={cn(
        "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold",
        v.is_active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
      )}>
        {v.full_name?.charAt(0)?.toUpperCase()}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{v.full_name}</span>
          {!v.is_active && (
            <span className="text-[10px] font-semibold uppercase text-muted-foreground border border-border rounded-full px-1.5 py-0.5">
              Inativo
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-0.5">
          {v.email && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="h-3 w-3" />{v.email}</span>}
          {v.phone && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{v.phone}</span>}
        </div>
        {ministries.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {ministries.map((vm: any) => (
              <span key={vm.ministry_id} className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium">
                {vm.ministries?.name}
                {vm.role === "leader" && <span className="ml-1 text-primary">· Líder</span>}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onEdit} className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onToggle}
          disabled={toggling}
          className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title={v.is_active ? "Desativar" : "Ativar"}
        >
          {v.is_active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
        </button>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((x) => !x)}
            className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-xl border border-border bg-card shadow-[var(--shadow-elegant)] py-1 animate-slide-up">
                <button
                  onClick={() => { setMenuOpen(false); onInvite(); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors"
                >
                  <Mail className="h-3.5 w-3.5" /> Convidar
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onDelete(); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function VolunteerForm({ initial, onSubmit, saving, onCancel }: {
  initial: any; onSubmit: (v: VolForm) => void; saving: boolean; onCancel: () => void;
}) {
  const [form, setForm] = useState<VolForm>(() => ({
    full_name: initial?.full_name ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    notes: initial?.notes ?? "",
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    const parsed = volSchema.safeParse(form);
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
      {[
        { key: "full_name", label: "Nome completo", type: "text", placeholder: "João Silva", required: true },
        { key: "email", label: "E-mail", type: "email", placeholder: "joao@email.com" },
        { key: "phone", label: "Telefone/WhatsApp", type: "tel", placeholder: "(11) 9 9999-9999" },
      ].map((f) => (
        <div key={f.key} className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">{f.label}{f.required && " *"}</label>
          <input
            type={f.type}
            value={(form as any)[f.key]}
            onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
            placeholder={f.placeholder}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50"
          />
          {errors[f.key] && <p className="text-xs text-destructive">{errors[f.key]}</p>}
        </div>
      ))}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Observações</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Observações opcionais..."
          rows={2}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50 resize-none"
        />
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={onCancel} className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent">Cancelar</button>
        <button
          onClick={submit}
          disabled={saving}
          className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Salvando..." : initial ? "Salvar" : "Cadastrar"}
        </button>
      </div>
    </div>
  );
}
