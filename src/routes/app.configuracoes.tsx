import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Save, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — ChurchOps" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { church } = useAuth();
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [churchForm, setChurchForm] = useState({ name: "", city: "", timezone: "America/Sao_Paulo" });
  const [conflictForm, setConflictForm] = useState({
    block_same_time: true,
    warn_same_day: true,
    warn_frequency: true,
    max_assignments_per_month: 4,
  });

  const { data: churchData } = useQuery({
    queryKey: ["church-data", church?.id],
    enabled: !!church?.id,
    queryFn: async () => {
      const { data } = await supabase.from("churches").select("*").eq("id", church!.id).maybeSingle();
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

  useEffect(() => {
    if (churchData) {
      setChurchForm({ name: churchData.name ?? "", city: churchData.city ?? "", timezone: churchData.timezone ?? "America/Sao_Paulo" });
    }
  }, [churchData]);

  useEffect(() => {
    if (rules) {
      setConflictForm({
        block_same_time: rules.block_same_time ?? true,
        warn_same_day: rules.warn_same_day ?? true,
        warn_frequency: rules.warn_frequency ?? true,
        max_assignments_per_month: rules.max_assignments_per_month ?? 4,
      });
    }
  }, [rules]);

  const saveAll = useMutation({
    mutationFn: async () => {
      await supabase.from("churches").update({
        name: churchForm.name,
        city: churchForm.city || null,
        timezone: churchForm.timezone,
      }).eq("id", church!.id);

      if (rules) {
        await supabase.from("conflict_rules").update(conflictForm).eq("church_id", church!.id);
      } else {
        await supabase.from("conflict_rules").insert({ ...conflictForm, church_id: church!.id });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["church-data"] });
      qc.invalidateQueries({ queryKey: ["conflict-rules"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6 lg:px-8">
      <div className="mb-6 flex items-center gap-3">
        <Settings className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
      </div>

      {/* Igreja */}
      <Section title="Dados da Igreja">
        <Field label="Nome da Igreja">
          <input
            value={churchForm.name}
            onChange={(e) => setChurchForm({ ...churchForm, name: e.target.value })}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </Field>
        <Field label="Cidade">
          <input
            value={churchForm.city}
            onChange={(e) => setChurchForm({ ...churchForm, city: e.target.value })}
            placeholder="São Paulo"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary placeholder:text-muted-foreground/50"
          />
        </Field>
        <Field label="Fuso horário">
          <select
            value={churchForm.timezone}
            onChange={(e) => setChurchForm({ ...churchForm, timezone: e.target.value })}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          >
            <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
            <option value="America/Manaus">Manaus (GMT-4)</option>
            <option value="America/Belem">Belém (GMT-3)</option>
            <option value="America/Fortaleza">Fortaleza (GMT-3)</option>
          </select>
        </Field>
      </Section>

      {/* Conflitos */}
      <Section title="Regras de Conflito">
        <p className="text-xs text-muted-foreground mb-4">
          Defina como o sistema deve se comportar ao detectar conflitos de disponibilidade.
        </p>

        <div className="space-y-4">
          <Toggle
            label="Bloquear mesmo horário"
            description="Impede escalar um voluntário em dois eventos simultâneos"
            checked={conflictForm.block_same_time}
            onChange={(v) => setConflictForm({ ...conflictForm, block_same_time: v })}
          />
          <Toggle
            label="Avisar para mesmo dia"
            description="Alerta quando um voluntário já está escalado no mesmo dia"
            checked={conflictForm.warn_same_day}
            onChange={(v) => setConflictForm({ ...conflictForm, warn_same_day: v })}
          />
          <Toggle
            label="Avisar limite mensal"
            description="Alerta quando voluntário atingir o limite de escalas no mês"
            checked={conflictForm.warn_frequency}
            onChange={(v) => setConflictForm({ ...conflictForm, warn_frequency: v })}
          />

          {conflictForm.warn_frequency && (
            <div className="ml-0 border-l-2 border-primary/30 pl-4">
              <label className="text-xs font-medium text-muted-foreground">Máximo de escalas por mês</label>
              <div className="flex items-center gap-3 mt-2">
                <input
                  type="range"
                  min={1}
                  max={12}
                  value={conflictForm.max_assignments_per_month}
                  onChange={(e) => setConflictForm({ ...conflictForm, max_assignments_per_month: Number(e.target.value) })}
                  className="flex-1 accent-primary"
                />
                <span className="text-sm font-bold w-6 text-center">{conflictForm.max_assignments_per_month}</span>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={() => saveAll.mutate()}
          disabled={saveAll.isPending}
          className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saveAll.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saved ? "Salvo!" : "Salvar configurações"}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-base font-semibold mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted"}`}
      >
        <span className={`absolute h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}
