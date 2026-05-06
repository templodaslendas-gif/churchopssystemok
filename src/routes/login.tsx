// ============================================================
// LOGIN
// ============================================================
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Eye, EyeOff, Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — ChurchOps" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!form.email || !form.password) { setError("Preencha e-mail e senha."); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
    setLoading(false);
    if (err) {
      setError(err.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : err.message);
    } else {
      navigate({ to: "/app" });
    }
  };

  return (
    <AuthShell title="Bem-vindo de volta" subtitle="Entre na sua conta ChurchOps">
      {error && <ErrorMsg>{error}</ErrorMsg>}
      <div className="space-y-3">
        <Input label="E-mail" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="seu@email.com" />
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Senha</label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="••••••••"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 pr-10 text-sm outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50"
            />
            <button type="button" onClick={() => setShowPw((x) => !x)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
      <button
        onClick={submit}
        disabled={loading}
        className="mt-5 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Entrar
      </button>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Não tem conta?{" "}
        <Link to="/cadastro" className="text-primary hover:underline">Cadastrar nova igreja</Link>
      </p>
    </AuthShell>
  );
}

// ============================================================
// Shared auth components (exported for re-use)
// ============================================================
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4"
      style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%, hsl(220 90% 56% / 0.12), transparent)" }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-[var(--shadow-glow)]">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)]">
          {children}
        </div>
      </div>
    </div>
  );
}

export function Input({ label, type = "text", value, onChange, placeholder, error }: {
  label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string; error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
      {children}
    </div>
  );
}
