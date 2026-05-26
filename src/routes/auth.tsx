import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { maskPhoneBR } from "@/lib/phone-mask";
import { Check, Crown, Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Lei.co" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    mode: search.mode === "login" ? ("login" as const) : ("signup" as const),
  }),
  component: AuthPage,
});

type PlanoTipo = "gratuito" | "mensal" | "trimestral" | "anual" | "diamante";

type PlanoDb = {
  id: string;
  nome: string;
  tipo: Exclude<PlanoTipo, "gratuito"> | "cortesia";
  preco_centavos: number;
};

const PLANO_BENEFICIOS: Record<PlanoTipo, string[]> = {
  gratuito: ["Cronogramas gratuitos", "Medalhas e gamificação", "Ranking Semanal"],
  mensal: [
    "1 cronograma editável",
    "Calendário inteligente",
    "Dashboard de desempenho",
    "Gestor de Revisões",
    "Criação de grupos (Study Rats)",
  ],
  trimestral: [
    "1 cronograma editável",
    "Calendário inteligente",
    "Dashboard de desempenho",
    "Gestor de Revisões",
    "Criação de grupos (Study Rats)",
  ],
  anual: [
    "1 cronograma editável",
    "Calendário inteligente",
    "Dashboard de desempenho",
    "Gestor de Revisões",
    "Criação de grupos (Study Rats)",
  ],
  diamante: [
    "Tudo do plano Anual",
    "Acesso a TODOS os cronogramas premium",
    "Badge exclusivo Diamante",
    "Mentoria individual inclusa",
  ],
};

const PLANO_PRECOS_FALLBACK: Record<PlanoTipo, number> = {
  gratuito: 0,
  mensal: 2990,
  trimestral: 7990,
  anual: 24990,
  diamante: 49900,
};

const PLANO_LABEL: Record<PlanoTipo, string> = {
  gratuito: "Gratuito",
  mensal: "Mensal",
  trimestral: "Trimestral",
  anual: "Anual",
  diamante: "Diamante",
};

const PLANO_ORDEM: PlanoTipo[] = ["gratuito", "mensal", "trimestral", "anual", "diamante"];

function formatBRL(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { mode: initialMode } = Route.useSearch();
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [telefone, setTelefone] = useState("");
  const [planoEscolhido, setPlanoEscolhido] = useState<PlanoTipo>("gratuito");
  const [planosDb, setPlanosDb] = useState<PlanoDb[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/perfil" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (mode !== "signup") return;
    let mounted = true;
    supabase
      .from("planos")
      .select("id, nome, tipo, preco_centavos")
      .eq("ativo", true)
      .then(({ data }) => {
        if (mounted && data) setPlanosDb(data as PlanoDb[]);
      });
    return () => {
      mounted = false;
    };
  }, [mode]);

  const planosOrdenados = useMemo(() => {
    return PLANO_ORDEM.map((tipo): { tipo: PlanoTipo; preco: number } => {
      if (tipo === "gratuito") return { tipo, preco: 0 };
      const found = planosDb.find((p) => p.tipo === tipo);
      return { tipo, preco: found?.preco_centavos ?? PLANO_PRECOS_FALLBACK[tipo] };
    });
  }, [planosDb]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signup") {
      const tel = telefone.trim();
      if (tel.length < 14) {
        toast.error("Informe um telefone (WhatsApp) válido");
        return;
      }
    }
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/perfil`,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (signUpData.user?.id) {
          await supabase
            .from("profiles")
            .update({ telefone: telefone.trim() })
            .eq("id", signUpData.user.id);
        }
        if (planoEscolhido === "gratuito") {
          toast.success("Conta criada! Bem-vindo(a) à Lei.co 🎉");
          navigate({ to: "/perfil" });
        } else {
          toast.success("Conta criada! Finalize a assinatura do seu plano.");
          navigate({
            to: "/meu-plano",
            search: { welcome: 1, plano: planoEscolhido } as never,
          });
        }
        return;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao autenticar";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // ====== LOGIN VIEW (single column) ======
  if (mode === "login") {
    return (
      <div className="min-h-screen w-full bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-[380px]">
          <div className="text-center mb-8">
            <Logo size={32} showTagline />
          </div>
          <div className="lei-card">
            <h1 className="font-serif text-[20px] text-text-main mb-1">Entrar</h1>
            <p className="text-text-muted text-[13px] mb-5">
              Acesse sua jornada de estudos.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <Label className="text-[12px] text-text-muted">Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[12px] text-text-muted">Senha</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="mt-1"
                />
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 bg-sage-dark hover:bg-sage-dark/90 text-white rounded-[10px]"
              >
                {submitting ? "Aguarde..." : "Entrar"}
              </Button>
            </form>
            <div className="text-center mt-4 text-[12px] text-text-muted">
              Ainda não tem conta?{" "}
              <button
                onClick={() => setMode("signup")}
                className="text-sage-dark font-medium hover:underline"
              >
                Cadastre-se
              </button>
            </div>
          </div>
          <div className="text-center mt-4">
            <Link to="/" className="text-[12px] text-text-muted hover:text-text-main">
              ← Voltar
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ====== SIGNUP VIEW (two-column: plans | form) ======
  const planoNome = PLANO_LABEL[planoEscolhido];

  return (
    <div className="min-h-screen w-full bg-background px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <Logo size={32} showTagline />
        </div>

        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-5">
          {/* LEFT: PLAN SELECTION */}
          <div className="lei-card">
            <div className="flex items-baseline gap-2 mb-1">
              <h2 className="font-serif text-[20px] text-text-main">1. Escolha seu plano</h2>
            </div>
            <p className="text-text-muted text-[13px] mb-5">
              Você pode começar grátis e fazer upgrade quando quiser.
            </p>

            <div className="flex flex-col gap-2">
              {planosOrdenados.map(({ tipo, preco }) => {
                const active = planoEscolhido === tipo;
                const popular = tipo === "trimestral";
                const isDiamante = tipo === "diamante";
                const beneficios = PLANO_BENEFICIOS[tipo];
                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => setPlanoEscolhido(tipo)}
                    className={`relative text-left rounded-[12px] border p-4 transition ${
                      active
                        ? "border-sage-dark ring-2 ring-sage-dark/30 bg-sage-light/40"
                        : "border-border hover:border-sage-dark/40 bg-card"
                    }`}
                  >
                    {popular && (
                      <span className="absolute -top-2 right-3 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sage-dark text-white">
                        <Sparkles size={10} /> Popular
                      </span>
                    )}
                    {isDiamante && (
                      <span className="absolute -top-2 right-3 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-text-main text-white">
                        <Crown size={10} /> Premium
                      </span>
                    )}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <span
                          className={`mt-1 w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                            active ? "border-sage-dark bg-sage-dark" : "border-border"
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="text-[15px] font-semibold text-text-main">
                            {PLANO_LABEL[tipo]}
                          </div>
                          <ul className="mt-1.5 space-y-1">
                            {beneficios.map((b) => (
                              <li
                                key={b}
                                className="flex items-start gap-1.5 text-[12px] text-text-muted"
                              >
                                <Check
                                  size={12}
                                  className="text-sage-dark mt-0.5 flex-shrink-0"
                                />
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[18px] font-bold text-text-main leading-tight">
                          {preco === null ? "—" : formatBRL(preco)}
                        </div>
                        <div className="text-[10px] text-text-muted">
                          {tipo === "gratuito" ? "para sempre" : "/ período"}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT: SIGNUP FORM */}
          <div className="lei-card h-fit lg:sticky lg:top-8">
            <h2 className="font-serif text-[20px] text-text-main mb-1">2. Crie sua conta</h2>
            <p className="text-text-muted text-[13px] mb-4">
              Comece em poucos segundos.
            </p>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sage-light text-sage-dark text-[12px] font-medium mb-5">
              <Crown size={12} />
              Plano selecionado: <span className="font-semibold">{planoNome}</span>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <Label className="text-[12px] text-text-muted">Nome</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Maria"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[12px] text-text-muted">Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[12px] text-text-muted">WhatsApp</Label>
                <Input
                  type="tel"
                  inputMode="numeric"
                  value={telefone}
                  onChange={(e) => setTelefone(maskPhoneBR(e.target.value))}
                  placeholder="(11) 99999-9999"
                  maxLength={15}
                  minLength={14}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[12px] text-text-muted">Senha</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="mt-1"
                />
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 bg-sage-dark hover:bg-sage-dark/90 text-white rounded-[10px] h-11"
              >
                {submitting
                  ? "Aguarde..."
                  : planoEscolhido === "gratuito"
                    ? "Criar conta grátis"
                    : `Criar conta — ${planoNome}`}
              </Button>
              {planoEscolhido !== "gratuito" && (
                <p className="text-[11px] text-text-muted text-center">
                  Após criar a conta, você será direcionado para finalizar a assinatura.
                </p>
              )}
            </form>

            <div className="text-center mt-4 text-[12px] text-text-muted">
              Já tem conta?{" "}
              <button
                onClick={() => setMode("login")}
                className="text-sage-dark font-medium hover:underline"
              >
                Entrar
              </button>
            </div>
          </div>
        </div>

        <div className="text-center mt-6">
          <Link to="/" className="text-[12px] text-text-muted hover:text-text-main">
            ← Voltar
          </Link>
        </div>
      </div>
    </div>
  );
}
