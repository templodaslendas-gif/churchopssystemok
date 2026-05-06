import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Calendar, Users, CheckCircle2, ArrowRight, Shield, Zap, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "ChurchOps — Gestão de Escalas para Igrejas" }] }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background" style={{ background: "radial-gradient(ellipse 80% 50% at 50% -10%, hsl(220 90% 56% / 0.15), transparent)" }}>
      {/* Nav */}
      <nav className="border-b border-border/50 backdrop-blur-md sticky top-0 z-40 bg-background/80">
        <div className="container mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Building2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold tracking-tight">ChurchOps</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Entrar
            </Link>
            <Link
              to="/cadastro"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Começar grátis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="container mx-auto max-w-5xl px-4 py-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary mb-6">
          <Zap className="h-3 w-3" />
          Escalas de voluntários simplificadas
        </div>
        <h1 className="font-display text-5xl font-extrabold tracking-tight lg:text-6xl">
          Organize sua igreja<br />
          <span className="bg-gradient-to-r from-primary to-violet-400 bg-clip-text text-transparent">
            sem planilhas
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Monte escalas, confirme presença, gerencie substituições e acompanhe tudo em tempo real — diretamente pelo WhatsApp.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/cadastro"
            className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity shadow-[var(--shadow-glow)]"
          >
            Cadastrar minha igreja <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/login"
            className="flex items-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-semibold hover:bg-accent transition-colors"
          >
            Já tenho conta
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto max-w-5xl px-4 py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Calendar, title: "Escalas automáticas", desc: "Monte escalas por ministério, detecte conflitos e publique com um clique." },
            { icon: CheckCircle2, title: "Confirmações em tempo real", desc: "Veja o status de cada voluntário ao vivo enquanto eles respondem." },
            { icon: Users, title: "Gestão de substituições", desc: "Pedidos de substituição com workflow completo — sem bagunça no grupo de WhatsApp." },
            { icon: MessageCircle, title: "WhatsApp integrado", desc: "Notificações e confirmações direto no WhatsApp, onde sua galera já está." },
            { icon: Shield, title: "Controle de acesso", desc: "Líderes, supervisores e voluntários com permissões granulares por ministério." },
            { icon: Zap, title: "Multi-ministério", desc: "Louvor, mídia, recepção — cada um no seu espaço, tudo no mesmo sistema." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6 hover:border-primary/30 hover:shadow-[var(--shadow-elegant)] transition-all">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-10">
          <h2 className="font-display text-3xl font-bold mb-4">Comece hoje, é grátis</h2>
          <p className="text-muted-foreground mb-6">Cadastre sua igreja em menos de 2 minutos e pare de gerenciar escala no grupo de WhatsApp.</p>
          <Link
            to="/cadastro"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Criar conta grátis <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} ChurchOps · Feito com 🙏 para igrejas brasileiras
      </footer>
    </div>
  );
}
