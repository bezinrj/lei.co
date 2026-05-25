import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { CalendarDays, Award, Users, Trophy, Sparkles, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lei.co — Estude com propósito" },
      {
        name: "description",
        content:
          "Cronogramas de estudo, medalhas, grupos e ranking. A jornada gentil para concursos públicos.",
      },
      { property: "og:title", content: "Lei.co — Estude com propósito" },
      {
        property: "og:description",
        content: "Cronogramas, medalhas e comunidade para sua aprovação.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/perfil" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen w-full bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo size={26} />
          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              search={{ mode: "login" }}
              className="text-[13px] text-text-muted hover:text-text-main px-3 py-2 rounded-[10px] transition-colors"
            >
              Entrar
            </Link>
            <Link to="/auth" search={{ mode: "signup" }}>
              <Button className="bg-sage-dark hover:bg-sage-dark/90 text-white rounded-[10px] h-9 px-4 text-[13px]">
                Criar conta
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-lilac-light border border-border text-[12px] text-text-muted mb-6">
          <Sparkles size={12} className="text-sage-dark" />
          Sua jornada de estudos, com propósito
        </div>
        <h1 className="font-serif text-[44px] md:text-[60px] leading-[1.05] text-text-main mb-5 max-w-3xl mx-auto">
          Estude com calma.<br />
          Conquiste com constância.
        </h1>
        <p className="text-[16px] text-text-muted max-w-xl mx-auto mb-9">
          Cronogramas inteligentes, medalhas que celebram cada passo e uma comunidade que caminha
          com você até a aprovação.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link to="/auth" search={{ mode: "signup" }}>
            <Button className="bg-sage-dark hover:bg-sage-dark/90 text-white rounded-[10px] h-11 px-6 text-[14px] gap-2">
              Começar agora <ArrowRight size={16} />
            </Button>
          </Link>
          <Link to="/auth" search={{ mode: "login" }}>
            <Button
              variant="outline"
              className="rounded-[10px] h-11 px-6 text-[14px] border-border"
            >
              Já tenho conta
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: CalendarDays,
              title: "Cronogramas",
              desc: "Planos prontos por carreira, com revisões espaçadas.",
            },
            {
              icon: Award,
              title: "Medalhas",
              desc: "Reconheça cada conquista da sua trajetória.",
            },
            {
              icon: Users,
              title: "Grupos",
              desc: "Estude junto. Combine metas com quem entende.",
            },
            {
              icon: Trophy,
              title: "Ranking",
              desc: "Acompanhe seu progresso na comunidade.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="lei-card hover:shadow-md transition-shadow"
            >
              <div className="w-10 h-10 rounded-[10px] bg-sage-light text-sage-dark flex items-center justify-center mb-3">
                <Icon size={18} />
              </div>
              <h3 className="font-serif text-[17px] text-text-main mb-1">{title}</h3>
              <p className="text-[13px] text-text-muted leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 pb-24">
        <div className="lei-card text-center bg-lilac-light">
          <h2 className="font-serif text-[28px] text-text-main mb-2">
            Pronto para começar?
          </h2>
          <p className="text-[14px] text-text-muted mb-6">
            Crie sua conta gratuita e desenhe o caminho até a sua aprovação.
          </p>
          <Link to="/auth">
            <Button className="bg-sage-dark hover:bg-sage-dark/90 text-white rounded-[10px] h-11 px-6 text-[14px] gap-2">
              Criar conta grátis <ArrowRight size={16} />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-6 text-center text-[12px] text-text-muted">
          © {new Date().getFullYear()} Lei.co — Estude com propósito.
        </div>
      </footer>
    </div>
  );
}
