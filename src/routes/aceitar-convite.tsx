import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CheckCircle2, XCircle, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, Input, ErrorMsg } from "./login";

export const Route = createFileRoute("/aceitar-convite")({
  head: () => ({ meta: [{ title: "Aceitar Convite — ChurchOps" }] }),
  validateSearch: (s: Record<string, string>) => ({ token: s.token ?? "" }),
  component: AceitarConvitePage,
});

function AceitarConvitePage() {
  const navigate = useNavigate();
  const { token } = Route.useSearch();
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [done, setDone] = useState(false);

  const { data: invite, isLoading: inviteLoading, error: inviteError } = useQuery({
    queryKey: ["invite", token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_invitation_by_token", { _token: token });
      if (error) throw error;
      if (!data?.length) throw new Error("Convite inválido ou expirado.");
      return data[0];
    },
  });

  // If user is already logged in (came from email magic link), redirect directly
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && done) navigate({ to: "/app" });
    });
  }, [done, navigate]);

  if (!token) {
    return (
      <AuthShell title="Convite inválido" subtitle="Token não encontrado na URL">
        <p className="text-sm text-muted-foreground text-center py-4">
          Verifique o link enviado por e-mail ou peça um novo convite ao administrador.
        </p>
        <Link to="/login" className="mt-4 block text-center text-sm text-primary hover:underline">
          Ir para o login
        </Link>
      </AuthShell>
    );
  }

  if (inviteLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (inviteError || !invite) {
    return (
      <AuthShell title="Convite inválido" subtitle="">
        <div className="flex flex-col items-center gap-3 py-4">
          <XCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-center text-muted-foreground">
            {(inviteError as any)?.message ?? "Este convite é inválido ou já foi utilizado."}
          </p>
        </div>
        <Link to="/login" className="mt-4 block text-center text-sm text-primary hover:underline">
          Ir para o login
        </Link>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Conta criada!" subtitle="Você já pode acessar o sistema">
        <div className="flex flex-col items-center gap-3 py-4">
          <CheckCircle2 className="h-10 w-10 text-success" />
          <p className="text-sm text-center text-muted-foreground">
            Bem-vindo(a) à <strong>{invite.church_name}</strong>!
          </p>
        </div>
        <button
          onClick={() => navigate({ to: "/app" })}
          className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Entrar no sistema →
        </button>
      </AuthShell>
    );
  }

  const submit = async () => {
    const e: Record<string, string> = {};
    if (form.password.length < 6) e.password = "Mínimo 6 caracteres";
    if (form.password !== form.confirm) e.confirm = "Senhas não coincidem";
    setErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    setGlobalError("");

    try {
      // Sign up the user
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: invite.email,
        password: form.password,
        options: { data: { full_name: invite.volunteer_name } },
      });

      if (signUpErr) throw signUpErr;
      if (!signUpData.user) throw new Error("Erro ao criar conta.");

      const userId = signUpData.user.id;

      // Link volunteer to user account
      await supabase.from("volunteers")
        .update({ user_id: userId })
        .eq("id", invite.volunteer_id);

      // Accept invitation
      await supabase.from("invitations")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("volunteer_id", invite.volunteer_id)
        .eq("church_id", invite.church_id);

      // Assign role
      await supabase.from("user_roles").upsert({
        user_id: userId,
        church_id: invite.church_id,
        role: invite.role,
      });

      // Update profile
      await supabase.from("profiles").upsert({
        id: userId,
        full_name: invite.volunteer_name,
        email: invite.email,
        church_id: invite.church_id,
      });

      // Sign in immediately (Supabase may require email confirmation depending on settings)
      await supabase.auth.signInWithPassword({ email: invite.email, password: form.password });

      setDone(true);
    } catch (err: any) {
      const msg = err.message;
      if (msg?.includes("already registered")) {
        setGlobalError("Este e-mail já tem uma conta. Faça login e acesse com o convite ativo.");
      } else {
        setGlobalError(msg ?? "Erro ao criar conta.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Aceitar convite"
      subtitle={`Você foi convidado para ${invite.church_name}`}
    >
      {/* Invite info */}
      <div className="mb-5 rounded-xl border border-border bg-accent/30 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="text-sm font-semibold">{invite.church_name}</span>
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          <div>Voluntário: <span className="text-foreground font-medium">{invite.volunteer_name}</span></div>
          <div>Ministério: <span className="text-foreground font-medium">{invite.ministry_name}</span></div>
          <div>E-mail: <span className="text-foreground font-medium">{invite.email}</span></div>
        </div>
      </div>

      {globalError && <ErrorMsg>{globalError}</ErrorMsg>}

      <div className="space-y-3">
        <Input label="Crie sua senha" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} placeholder="Mínimo 6 caracteres" error={errors.password} />
        <Input label="Confirmar senha" type="password" value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })} placeholder="Repita a senha" error={errors.confirm} />
      </div>

      <button
        onClick={submit}
        disabled={loading}
        className="mt-5 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Criar conta e entrar
      </button>
    </AuthShell>
  );
}
