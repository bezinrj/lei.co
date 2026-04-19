import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Faz upsert do timestamp do usuário a cada 60s enquanto a aba estiver visível.
// Usa um throttle global para evitar pings duplicados se o hook for montado mais de uma vez.
let lastPingAt = 0;
const MIN_INTERVAL_MS = 45_000;

export function usePresence() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    async function ping() {
      if (cancelled || !user) return;
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastPingAt < MIN_INTERVAL_MS) return;
      lastPingAt = now;
      await supabase
        .from("presence")
        .upsert({ user_id: user.id, last_seen_at: new Date().toISOString() }, { onConflict: "user_id" });
    }

    ping();
    const id = setInterval(ping, 60_000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user]);
}
