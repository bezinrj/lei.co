import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";

type Plano = "gratuito" | "mensal" | "trimestral" | "anual" | "diamante" | "cortesia";

const PLANOS_COM_ASSINATURA: Plano[] = [
  "mensal",
  "trimestral",
  "anual",
  "diamante",
  "cortesia",
];

export function useAcesso() {
  const { user, isAdminOrMod, isAdmin, loading: authLoading } = useAuth() as ReturnType<
    typeof useAuth
  > & { isAdmin?: boolean };
  const [plano, setPlano] = useState<Plano>("gratuito");
  const [compras, setCompras] = useState<string[]>([]);
  const [cronogramaProprioId, setCronogramaProprioId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setPlano("gratuito");
      setCompras([]);
      setCronogramaProprioId(null);
      setLoading(false);
      return;
    }

    let mounted = true;
    (async () => {
      const [profileRes, comprasRes, propRes] = await Promise.all([
        supabase.from("profiles").select("plano_atual").eq("id", user.id).maybeSingle(),
        supabase
          .from("cronograma_compras")
          .select("cronograma_id")
          .eq("user_id", user.id)
          .eq("status", "ativo"),
        supabase
          .from("cronogramas")
          .select("id")
          .eq("criado_por", user.id)
          .eq("is_proprio", true)
          .maybeSingle(),
      ]);
      if (!mounted) return;
      setPlano(((profileRes.data?.plano_atual as Plano) ?? "gratuito") as Plano);
      setCompras(
        (comprasRes.data ?? [])
          .map((c) => c.cronograma_id as string | null)
          .filter((v): v is string => !!v),
      );
      setCronogramaProprioId(propRes.data?.id ?? null);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [user, authLoading]);

  const temAssinatura = isAdminOrMod || PLANOS_COM_ASSINATURA.includes(plano);
  const isDiamante = isAdminOrMod || plano === "diamante" || plano === "cortesia";

  function temAcessoCronograma(cronogramaId: string, isPremium: boolean) {
    if (!isPremium) return true;
    if (isAdminOrMod) return true;
    if (isDiamante) return true;
    return compras.includes(cronogramaId);
  }

  function podeUsarCalendario(cronogramaId: string, isPremium: boolean) {
    return temAssinatura && temAcessoCronograma(cronogramaId, isPremium);
  }

  return {
    loading,
    isAdmin: !!isAdmin,
    isAdminOrMod,
    plano,
    temAssinatura,
    isDiamante,
    compras,
    cronogramaProprioId,
    temAcessoCronograma,
    podeUsarCalendario,
    podeCriarCronogramaProprio: temAssinatura && !cronogramaProprioId,
  };
}
