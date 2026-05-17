import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

// Atualiza profiles.last_seen a cada 2 minutos enquanto o usuário está logado e a aba visível.
let lastUpdateAt = 0;
const MIN_INTERVAL_MS = 90_000;

export function useLastSeen() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function update() {
      if (cancelled || !user) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastUpdateAt < MIN_INTERVAL_MS) return;
      lastUpdateAt = now;
      await supabase
        .from("profiles")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", user.id);
    }

    update();
    const id = setInterval(update, 120_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user?.id]);
}
