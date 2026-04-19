import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

type Tipo = "free" | "premium";

// Cache em módulo: 1 fetch por user em toda a app, compartilhado entre componentes.
const cache = new Map<string, { tipo: Tipo; loadedAt: number }>();
const inflight = new Map<string, Promise<Tipo>>();
const TTL_MS = 5 * 60 * 1000;

async function fetchPlan(userId: string): Promise<Tipo> {
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.loadedAt < TTL_MS) return cached.tipo;

  const existing = inflight.get(userId);
  if (existing) return existing;

  const promise = (async () => {
    const { data } = await supabase
      .from("user_plans")
      .select("tipo, expira_em")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let tipo: Tipo = "free";
    if (data) {
      if (data.expira_em && new Date(data.expira_em) < new Date()) tipo = "free";
      else tipo = (data.tipo as Tipo) ?? "free";
    }
    cache.set(userId, { tipo, loadedAt: Date.now() });
    inflight.delete(userId);
    return tipo;
  })();

  inflight.set(userId, promise);
  return promise;
}

export function usePlan() {
  const { user, isAdminOrMod } = useAuth();
  const [tipo, setTipo] = useState<Tipo>(() =>
    user ? cache.get(user.id)?.tipo ?? "free" : "free",
  );
  const [loading, setLoading] = useState(() => {
    if (!user) return false;
    return !cache.get(user.id);
  });
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      setTipo("free");
      setLoading(false);
      lastUserId.current = null;
      return;
    }
    if (lastUserId.current === user.id && cache.get(user.id)) return;
    lastUserId.current = user.id;

    let cancelled = false;
    fetchPlan(user.id).then((t) => {
      if (cancelled) return;
      setTipo(t);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isPremium = isAdminOrMod || tipo === "premium";
  return { tipo, isPremium, loading };
}
