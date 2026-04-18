import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePlan } from "@/hooks/usePlan";
import { CategoryRow } from "@/components/cronogramas/CategoryRow";
import { NovoCronogramaDialog } from "@/components/cronogramas/NovoCronogramaDialog";

export const Route = createFileRoute("/cronogramas")({
  head: () => ({ meta: [{ title: "Cronogramas — Lei.co" }] }),
  component: CronogramasPage,
});

type Cronograma = {
  id: string;
  nome: string;
  categoria: string | null;
  imagem_url: string | null;
  premium: boolean;
};

// Module-level cache so voltar para /cronogramas é instantâneo
let cachedItems: Cronograma[] | null = null;
let cachedAt = 0;
const STALE_MS = 30_000;

function CronogramasPage() {
  const { isAdminOrMod } = useAuth();
  const { isPremium } = usePlan();
  const navigate = useNavigate();
  const [items, setItems] = useState<Cronograma[]>(cachedItems ?? []);
  const [loading, setLoading] = useState(cachedItems === null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async (force = false) => {
    const fresh = Date.now() - cachedAt < STALE_MS;
    if (!force && cachedItems && fresh) return;
    if (!cachedItems) setLoading(true);
    const { data, error } = await supabase
      .from("cronogramas")
      .select("id, nome, categoria, imagem_url, premium")
      .order("created_at", { ascending: false });
    if (!error && data) {
      cachedItems = data;
      cachedAt = Date.now();
      setItems(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Group by categoria
  const grouped = items.reduce<Record<string, Cronograma[]>>((acc, c) => {
    const key = c.categoria?.trim() || "Sem categoria";
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});

  return (
    <AppShell title="Cronogramas">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-[26px] text-text-main">Cronogramas</h1>
          <p className="text-[13px] text-text-muted mt-1">
            Sua biblioteca de planos de estudo
          </p>
        </div>
        {isAdminOrMod && (
          <Button
            onClick={() => setOpen(true)}
            className="bg-sage-dark hover:bg-sage-dark/90 text-white rounded-[20px] gap-2"
          >
            <Plus size={16} /> Novo Cronograma
          </Button>
        )}
      </div>

      {loading ? (
        <div className="lei-card text-center py-16 text-text-muted text-[13px]">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="lei-card text-center py-16">
          <div className="font-serif text-[18px] text-text-main mb-1">
            Nenhum cronograma ainda
          </div>
          <p className="text-text-muted text-[13px]">
            {isAdminOrMod
              ? "Crie o primeiro com o botão acima."
              : "Volte em breve — estamos preparando os planos."}
          </p>
        </div>
      ) : (
        <div>
          {Object.entries(grouped).map(([cat, list]) => (
            <CategoryRow
              key={cat}
              title={cat}
              items={list}
              isLocked={(c) => c.premium && !isPremium}
              onSelect={(id) => navigate({ to: "/cronograma/$id", params: { id } })}
            />
          ))}
        </div>
      )}

      <NovoCronogramaDialog open={open} onOpenChange={setOpen} onCreated={() => load(true)} />
    </AppShell>
  );
}
