import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Crown, Check, Loader2, Lock } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { createCheckoutSession, createCheckoutAvulso, cancelSubscription } from "@/server/stripe.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/meu-plano")({
  component: MeuPlanoPage,
  validateSearch: (search: Record<string, unknown>) => ({
    welcome: search.welcome === 1 || search.welcome === "1" ? 1 : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Meu Plano | Lei.co" },
      { name: "description", content: "Escolha seu plano e desbloqueie cronogramas premium." },
    ],
  }),
});


type Plano = {
  id: string;
  nome: string;
  tipo: "mensal" | "trimestral" | "anual" | "diamante" | "cortesia";
  preco_centavos: number | null;
};

type CronogramaPremium = {
  id: string;
  nome: string;
  categoria: string | null;
  imagem_url: string | null;
  preco_centavos: number | null;
};

const PLANO_VISUAL: Record<string, { bg: string; border?: string; benefits: string[]; subtitle: string }> = {
  gratuito: {
    bg: "#F7F4EE",
    subtitle: "Acesso básico à plataforma",
    benefits: [
      "Cronogramas gratuitos",
      "Ranking Semanal",
      "Medalhas e gamificação",
    ],
  },
  mensal: {
    bg: "#E8F0E5",
    subtitle: "Para começar com flexibilidade",
    benefits: [
      "Acesso à plataforma e 1 cronograma editável",
      "Calendário inteligente",
      "Dashboard de desempenho",
      "Gestor de Revisões",
      "Criação de grupos (Study Rats)",
    ],
  },
  trimestral: {
    bg: "#E6F1FB",
    subtitle: "Equilíbrio entre preço e duração",
    benefits: [
      "Tudo do plano Mensal",
      "Economia de 11% vs. mensal",
      "Acompanhamento trimestral",
    ],
  },
  anual: {
    bg: "#EDE9F5",
    subtitle: "O melhor custo-benefício",
    benefits: [
      "Tudo do plano Trimestral",
      "Economia de 30% vs. mensal",
      "Acesso garantido por 1 ano",
    ],
  },
  diamante: {
    bg: "#FAEEDA",
    border: "#BA7517",
    subtitle: "A experiência completa Lei.co",
    benefits: [
      "Tudo do plano Anual",
      "Mentoria individual inclusa",
      "Acesso a TODOS os cronogramas premium sem custo extra",
      "Badge exclusivo de assinante Diamante",
      "Acesso antecipado a novas funcionalidades",
      "Atendimento VIP",
    ],
  },
};

const ORDEM: Plano["tipo"][] = ["mensal", "trimestral", "anual", "diamante"];

function formatBRL(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function periodoLabel(tipo: string) {
  switch (tipo) {
    case "mensal":
      return "/mês";
    case "trimestral":
      return "/trimestre";
    case "anual":
    case "diamante":
      return "/ano";
    default:
      return "";
  }
}

function MeuPlanoPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [planoAtual, setPlanoAtual] = useState<string>("gratuito");
  const [cronogramas, setCronogramas] = useState<CronogramaPremium[]>([]);
  const [comprados, setComprados] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);

  const checkoutSubFn = useServerFn(createCheckoutSession);
  const checkoutAvulsoFn = useServerFn(createCheckoutAvulso);
  const cancelarFn = useServerFn(cancelSubscription);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      const [planosRes, profileRes, cronsRes, comprasRes] = await Promise.all([
        supabase.from("planos").select("id, nome, tipo, preco_centavos").eq("ativo", true),
        supabase.from("profiles").select("plano_atual").eq("id", user.id).maybeSingle(),
        supabase
          .from("cronogramas")
          .select("id, nome, categoria, imagem_url, preco_centavos")
          .eq("premium", true)
          .not("preco_centavos", "is", null),
        supabase
          .from("cronograma_compras")
          .select("cronograma_id")
          .eq("user_id", user.id)
          .eq("status", "ativo"),
      ]);
      if (!mounted) return;
      setPlanos((planosRes.data ?? []) as Plano[]);
      setPlanoAtual((profileRes.data?.plano_atual as string) || "gratuito");
      setCronogramas((cronsRes.data ?? []) as CronogramaPremium[]);
      setComprados(new Set((comprasRes.data ?? []).map((c) => c.cronograma_id as string)));
      setCarregando(false);
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  async function assinar(plano: Plano) {
    setProcessando(plano.id);
    try {
      const { url } = await checkoutSubFn({
        data: { planoId: plano.id, origin: window.location.origin },
      });
      if (url) window.location.href = url;
      else throw new Error("URL de checkout não retornada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao iniciar checkout");
      setProcessando(null);
    }
  }

  async function comprarCronograma(cron: CronogramaPremium) {
    setProcessando(cron.id);
    try {
      const { url } = await checkoutAvulsoFn({
        data: { cronogramaId: cron.id, origin: window.location.origin },
      });
      if (url) window.location.href = url;
      else throw new Error("URL de checkout não retornada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao iniciar checkout");
      setProcessando(null);
    }
  }

  async function cancelarAssinatura() {
    setCancelando(true);
    try {
      const res = await cancelarFn({ data: {} });
      toast.success(res.message ?? "Assinatura cancelada com sucesso");
      setConfirmCancel(false);
      setPlanoAtual("gratuito");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cancelar assinatura");
    } finally {
      setCancelando(false);
    }
  }

  if (loading || carregando) {
    return (
      <AppShell title="Meu Plano">
        <div className="flex items-center justify-center py-20 text-text-muted">
          <Loader2 className="animate-spin" />
        </div>
      </AppShell>
    );
  }

  // Ordena planos pela ordem visual
  const planosOrdenados = ORDEM.map((tipo) => planos.find((p) => p.tipo === tipo)).filter(
    Boolean,
  ) as Plano[];

  const cards: Array<{ tipo: string; plano: Plano | null }> = [
    { tipo: "gratuito", plano: null },
    ...planosOrdenados.map((p) => ({ tipo: p.tipo, plano: p })),
  ];

  return (
    <AppShell title="Meu Plano">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-10 text-center">
          <h1 className="font-serif text-3xl md:text-4xl text-text-main mb-2">Meu Plano</h1>
          <p className="text-text-muted">
            Escolha o plano ideal para o seu ritmo de estudo. Cancele quando quiser.
          </p>
        </header>

        <section className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 mb-14">
          {cards.map(({ tipo, plano }) => {
            const visual = PLANO_VISUAL[tipo];
            const isCurrent = planoAtual === tipo;
            const isDiamante = tipo === "diamante";
            const isFree = tipo === "gratuito";
            return (
              <div
                key={tipo}
                className="rounded-[20px] p-6 flex flex-col relative shadow-sm"
                style={{
                  background: visual.bg,
                  border: visual.border ? `2px solid ${visual.border}` : "1px solid rgba(0,0,0,0.04)",
                }}
              >
                {isDiamante && (
                  <div
                    className="absolute -top-3 right-4 px-3 py-1 rounded-full text-[11px] font-medium text-white flex items-center gap-1"
                    style={{ background: "#BA7517" }}
                  >
                    <Crown size={12} /> Diamante
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 left-4 px-3 py-1 rounded-full text-[11px] font-medium bg-sage-dark text-white">
                    Plano atual
                  </div>
                )}

                <h3 className="font-serif text-xl text-text-main mb-1">
                  {plano?.nome ?? "Plano Gratuito"}
                </h3>
                <p className="text-[13px] text-text-muted mb-4">{visual.subtitle}</p>

                <div className="mb-5">
                  {isFree ? (
                    <div className="text-2xl font-medium text-text-main">Grátis</div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-medium text-text-main">
                        {formatBRL(plano!.preco_centavos ?? 0)}
                      </span>
                      <span className="text-[13px] text-text-muted">{periodoLabel(tipo)}</span>
                    </div>
                  )}
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {visual.benefits.map((b) => (
                    <li key={b} className="flex gap-2 text-[13px] text-text-main">
                      <Check size={16} className="shrink-0 mt-0.5 text-sage-dark" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                {isFree ? (
                  <Button disabled variant="outline" className="w-full">
                    {isCurrent ? "Plano atual" : "Sempre disponível"}
                  </Button>
                ) : isCurrent ? (
                  <div className="space-y-2">
                    <Button disabled className="w-full">
                      Ativo
                    </Button>
                    <button
                      type="button"
                      onClick={() => setConfirmCancel(true)}
                      className="w-full text-[12px] text-text-muted hover:text-destructive transition-colors underline-offset-2 hover:underline"
                    >
                      Cancelar assinatura
                    </button>
                  </div>
                ) : (
                  <Button
                    onClick={() => assinar(plano!)}
                    disabled={processando === plano!.id}
                    className="w-full"
                    style={
                      isDiamante
                        ? { background: "#BA7517", color: "white" }
                        : undefined
                    }
                  >
                    {processando === plano!.id ? (
                      <>
                        <Loader2 className="animate-spin mr-2" size={14} /> Aguarde…
                      </>
                    ) : (
                      "Assinar"
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </section>

        <section>
          <header className="mb-5">
            <h2 className="font-serif text-2xl text-text-main mb-1">
              Cronogramas Premium — compra individual
            </h2>
            <p className="text-text-muted text-[14px]">
              Prefere acesso a um cronograma específico? Compre uma vez e estude no seu tempo.
            </p>
          </header>

          {cronogramas.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-border p-8 text-center text-text-muted">
              Nenhum cronograma premium disponível para compra avulsa no momento.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {cronogramas.map((cron) => {
                const comprado = comprados.has(cron.id);
                return (
                  <div
                    key={cron.id}
                    className="rounded-[14px] bg-card border border-border p-5 flex flex-col"
                  >
                    {cron.imagem_url && (
                      <img
                        src={cron.imagem_url}
                        alt={cron.nome}
                        className="w-full h-32 object-cover rounded-[10px] mb-3"
                      />
                    )}
                    <h3 className="font-serif text-lg text-text-main mb-1">{cron.nome}</h3>
                    {cron.categoria && (
                      <p className="text-[12px] text-text-muted mb-3">{cron.categoria}</p>
                    )}
                    <div className="text-2xl font-medium text-text-main mb-4">
                      {formatBRL(cron.preco_centavos ?? 0)}
                    </div>
                    {comprado ? (
                      <Button disabled variant="outline" className="mt-auto">
                        <Check size={14} className="mr-2" /> Já adquirido
                      </Button>
                    ) : (
                      <Button
                        onClick={() => comprarCronograma(cron)}
                        disabled={processando === cron.id}
                        variant="outline"
                        className="mt-auto"
                      >
                        {processando === cron.id ? (
                          <>
                            <Loader2 className="animate-spin mr-2" size={14} /> Aguarde…
                          </>
                        ) : (
                          <>
                            <Lock size={14} className="mr-2" /> Comprar acesso
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
            <AlertDialogDescription>
              Sua assinatura será cancelada ao final do período já pago. Você manterá
              o acesso até lá e não será cobrado novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelando}>Manter assinatura</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                cancelarAssinatura();
              }}
              disabled={cancelando}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {cancelando ? (
                <><Loader2 className="animate-spin mr-2" size={14} /> Cancelando…</>
              ) : (
                "Sim, cancelar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
