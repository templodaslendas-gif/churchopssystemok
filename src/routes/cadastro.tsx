import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, Input, ErrorMsg } from "./login";

export const Route = createFileRoute("/cadastro")({
  head: () => ({ meta: [{ title: "Cadastrar Igreja — ChurchOps" }] }),
  component: CadastroPage,
});

function CadastroPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    full_name: "", email: "", password: "", confirm: "",
    church_name: "", city: "", timezone: "America/Sao_Paulo",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState("");

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!form.full_name.trim()) e.full_name = "Nome obrigatório";
    if (!form.email.includes("@")) e.email = "E-mail inválido";
    if (form.password.length < 6) e.password = "Mínimo 6 caracteres";
    if (form.password !== form.confirm) e.confirm = "Senhas não coincidem";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const validateStep2 = () => {
    const e: Record<string, string> = {};
    if (!form.church_name.trim()) e.church_name = "Nome da igreja obrigatório";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async () => {
    if (!validateStep2()) return;
    setLoading(true);
    setGlobalError("");
    try {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.full_name } },
      });
      if (signUpErr) throw signUpErr;
      if (!signUpData.user) throw new Error("Erro ao criar conta.");

      // Create church
      const { data: church, error: churchErr } = await supabase.from("churches").insert({
        name: form.church_name,
        city: form.city || null,
        timezone: form.timezone,
      }).select("id").single();
      if (churchErr) throw churchErr;

      // Update profile
      await supabase.from("profiles").update({
        full_name: form.full_name,
        church_id: church.id,
      }).eq("id", signUpData.user.id);

      // Assign super_admin role
      await supabase.from("user_roles").insert({
        user_id: signUpData.user.id,
        church_id: church.id,
        role: "super_admin",
      });

      navigate({ to: "/app" });
    } catch (err: any) {
      setGlobalError(err.message ?? "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  };

  const f = (k: keyof typeof form) => (v: string) => setForm({ ...form, [k]: v });

  return (
    <AuthShell
      title={step === 1 ? "Crie sua conta" : "Dados da Igreja"}
      subtitle={step === 1 ? "Passo 1 de 2 — Seus dados" : "Passo 2 de 2 — Sua igreja"}
    >
      {globalError && <ErrorMsg>{globalError}</ErrorMsg>}

      {step === 1 ? (
        <div className="space-y-3">
          <Input label="Seu nome completo" value={form.full_name} onChange={f("full_name")} placeholder="João Silva" error={errors.full_name} />
          <Input label="E-mail" type="email" value={form.email} onChange={f("email")} placeholder="joao@email.com" error={errors.email} />
          <Input label="Senha" type="password" value={form.password} onChange={f("password")} placeholder="Mínimo 6 caracteres" error={errors.password} />
          <Input label="Confirmar senha" type="password" value={form.confirm} onChange={f("confirm")} placeholder="Repita a senha" error={errors.confirm} />
          <button
            onClick={() => { if (validateStep1()) setStep(2); }}
            className="mt-2 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Continuar →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <Input label="Nome da Igreja" value={form.church_name} onChange={f("church_name")} placeholder="Igreja Batista Central" error={errors.church_name} />
          <Input label="Cidade" value={form.city} onChange={f("city")} placeholder="São Paulo" />
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Fuso horário</label>
            <select
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            >
              <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
              <option value="America/Manaus">Manaus (GMT-4)</option>
              <option value="America/Belem">Belém (GMT-3)</option>
              <option value="America/Fortaleza">Fortaleza (GMT-3)</option>
              <option value="America/Recife">Recife (GMT-3)</option>
              <option value="America/Porto_Velho">Porto Velho (GMT-4)</option>
              <option value="America/Rio_Branco">Rio Branco (GMT-5)</option>
              <option value="America/Noronha">Fernando de Noronha (GMT-2)</option>
            </select>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setStep(1)}
              className="flex-1 rounded-xl border border-border py-3 text-sm font-medium hover:bg-accent"
            >
              ← Voltar
            </button>
            <button
              onClick={submit}
              disabled={loading}
              className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar conta
            </button>
          </div>
        </div>
      )}

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Já tem conta?{" "}
        <Link to="/login" className="text-primary hover:underline">Entrar</Link>
      </p>
    </AuthShell>
  );
}
