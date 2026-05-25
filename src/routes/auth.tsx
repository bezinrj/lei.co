import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { maskPhoneBR } from "@/lib/phone-mask";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Lei.co" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    mode: search.mode === "login" ? ("login" as const) : ("signup" as const),
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { mode: initialMode } = Route.useSearch();
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [telefone, setTelefone] = useState("");
  const [planoEscolhido, setPlanoEscolhido] = useState<
    "gratuito" | "mensal" | "trimestral" | "anual" | "diamante"
  >("gratuito");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/perfil" });
  }, [user, loading, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signup") {
      const tel = telefone.trim();
      // Formato esperado: (11) 99999-9999 (14 ou 15 chars com máscara)
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
        // Salva telefone (obrigatório) no profile criado pelo trigger
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


  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-[380px]">
        <div className="text-center mb-8">
          <Logo size={32} showTagline />
        </div>
        <div className="lei-card">
          <h1 className="font-serif text-[20px] text-text-main mb-1">
            {mode === "login" ? "Entrar" : "Criar conta"}
          </h1>
          <p className="text-text-muted text-[13px] mb-5">
            {mode === "login"
              ? "Acesse sua jornada de estudos."
              : "Comece a estudar com propósito."}
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {mode === "signup" && (
              <div>
                <Label className="text-[12px] text-text-muted">Nome</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Maria"
                  className="mt-1"
                />
              </div>
            )}
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
            {mode === "signup" && (
              <div>
                <Label className="text-[12px] text-text-muted">Telefone (WhatsApp)</Label>
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
            )}

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
            {mode === "signup" && (
              <div className="mt-1">
                <Label className="text-[12px] text-text-muted">Escolha seu plano</Label>
                <div className="mt-1.5 grid grid-cols-1 gap-1.5">
                  {(
                    [
                      { id: "gratuito", label: "Gratuito", hint: "Comece sem custo" },
                      { id: "mensal", label: "Mensal", hint: "Flexível, mês a mês" },
                      { id: "trimestral", label: "Trimestral", hint: "Economize 11%" },
                      { id: "anual", label: "Anual", hint: "Economize 30%" },
                      { id: "diamante", label: "Diamante", hint: "Acesso completo" },
                    ] as const
                  ).map((p) => {
                    const active = planoEscolhido === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPlanoEscolhido(p.id)}
                        className={`flex items-center justify-between rounded-[10px] border px-3 py-2 text-left transition ${
                          active
                            ? "border-sage-dark bg-sage-light/50"
                            : "border-border hover:border-sage-dark/40"
                        }`}
                      >
                        <span>
                          <span className="block text-[13px] font-medium text-text-main">
                            {p.label}
                          </span>
                          <span className="block text-[11px] text-text-muted">{p.hint}</span>
                        </span>
                        <span
                          className={`w-3.5 h-3.5 rounded-full border-2 ${
                            active ? "border-sage-dark bg-sage-dark" : "border-border"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
                {planoEscolhido !== "gratuito" && (
                  <p className="text-[11px] text-text-muted mt-2">
                    Após criar a conta, você será direcionado para finalizar a assinatura.
                  </p>
                )}
              </div>
            )}
            <Button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 bg-sage-dark hover:bg-sage-dark/90 text-white rounded-[10px]"
            >
              {submitting ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
            </Button>
          </form>
          <div className="text-center mt-4 text-[12px] text-text-muted">
            {mode === "login" ? "Ainda não tem conta?" : "Já tem conta?"}{" "}
            <button
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-sage-dark font-medium hover:underline"
            >
              {mode === "login" ? "Cadastre-se" : "Entrar"}
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
