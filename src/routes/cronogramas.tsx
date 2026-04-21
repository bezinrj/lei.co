import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAcesso } from "@/hooks/useAcesso";
import { CategoryRow } from "@/components/cronogramas/CategoryRow";
import { NovoCronogramaDialog } from "@/components/cronogramas/NovoCronogramaDialog";
import { UpgradeModal } from "@/components/UpgradeModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

let cachedItems: Cronograma[] | null = null;
let cachedAt = 0;
const STALE_MS = 30_000;

function CronogramasPage() {
  const { isAdminOrMod } = useAuth();
  const acesso = useAcesso();
  const navigate = useNavigate();
  const [items, setItems] = useState<Cronograma[]>(cachedItems ?? []);
  const [loading, setLoading] = useState(cachedItems === null);
  const [open, setOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

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

  const grouped = items.reduce<Record<string, Cronograma[]>>((acc, c) => {
    const key = c.categoria?.trim() || "Sem categoria";
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});

  // Botão "Novo Cronograma":
  // - Admin/mod: sempre disponível (criação institucional)
  // - Usuário com assinatura: 1 cronograma próprio
  // - Sem assinatura: oculto
  const isStaff = isAdminOrMod;
  const mostrarBotaoNovo = isStaff || acesso.temAssinatura;
  const jaTemProprio = !!acesso.cronogramaProprioId;
  const botaoDesabilitado = !isStaff && jaTemProprio;

  function handleSelect(c: Cronograma) {
    const liberado = acesso.temAcessoCronograma(c.id, c.premium);
    if (!liberado) {
      setUpgradeOpen(true);
      return;
    }
    navigate({ to: "/cronograma/$id", params: { id: c.id } });
  }

  return (
    <AppShell title="Cronogramas">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-[26px] text-text-main">Cronogramas</h1>
          <p className="text-[13px] text-text-muted mt-1">
            Sua biblioteca de planos de estudo
          </p>
        </div>
        {mostrarBotaoNovo && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    onClick={() => setOpen(true)}
                    disabled={botaoDesabilitado}
                    className="bg-sage-dark hover:bg-sage-dark/90 text-white rounded-[20px] gap-2"
                  >
                    <Plus size={16} /> Novo Cronograma
                  </Button>
                </span>
              </TooltipTrigger>
              {botaoDesabilitado && (
                <TooltipContent>Você já possui um cronograma ativo</TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
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
              isLocked={(c) => !acesso.temAcessoCronograma(c.id, c.premium)}
              onSelect={(id) => {
                const c = list.find((x) => x.id === id);
                if (c) handleSelect(c);
              }}
            />
          ))}
        </div>
      )}

      <NovoCronogramaDialog open={open} onOpenChange={setOpen} onCreated={() => load(true)} />
      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </AppShell>
  );
}
