import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function usePlan() {
  const { user, isAdminOrMod } = useAuth();
  const [tipo, setTipo] = useState<"free" | "premium">("free");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTipo("free");
      setLoading(false);
      return;
    }
    supabase
      .from("user_plans")
      .select("tipo, expira_em")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) setTipo("free");
        else if (data.expira_em && new Date(data.expira_em) < new Date()) setTipo("free");
        else setTipo(data.tipo as "free" | "premium");
        setLoading(false);
      });
  }, [user]);

  // Admin/mod sempre tem acesso premium
  const isPremium = isAdminOrMod || tipo === "premium";
  return { tipo, isPremium, loading };
}