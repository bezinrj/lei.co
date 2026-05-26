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
import { EditarCronogramaDialog } from "@/components/admin/EditarCronogramaDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import { duplicateCronograma, deleteCronograma, type AdminCronograma } from "@/server/admin.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

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
  is_proprio: boolean;
  criado_por: string | null;
  origem_id: string | null;
  preco_centavos: number | null;
  stripe_price_id: string | null;
};


let cachedItems: Cronograma[] | null = null;
let cachedAt = 0;
const STALE_MS = 30_000;

function CronogramasPage() {
  const { isAdminOrMod, user } = useAuth();
  const acesso = useAcesso();
  const navigate = useNavigate();
  const [items, setItems] = useState<Cronograma[]>(cachedItems ?? []);
  const [loading, setLoading] = useState(cachedItems === null);
  const [open, setOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Cronograma | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Cronograma | null>(null);
  const [busy, setBusy] = useState(false);

  const duplicateFn = useServerFn(duplicateCronograma);
  const deleteFn = useServerFn(deleteCronograma);

  const load = useCallback(async (force = false) => {
    const fresh = Date.now() - cachedAt < STALE_MS;
    if (!force && cachedItems && fresh) return;
    if (!cachedItems) setLoading(true);
    const { data, error } = await supabase
      .from("cronogramas")
      .select("id, nome, categoria, imagem_url, premium, is_proprio, criado_por, preco_centavos, stripe_price_id")
      .order("created_at", { ascending: false });
    if (!error && data) {
      cachedItems = data as Cronograma[];
      cachedAt = Date.now();
      setItems(data as Cronograma[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Separa "Meu Cronograma" do resto
  const meusProprios = items.filter((c) => c.is_proprio && c.criado_por === user?.id);
  const institucionais = items.filter((c) => !c.is_proprio || c.criado_por !== user?.id);

  const grouped = institucionais.reduce<Record<string, Cronograma[]>>((acc, c) => {
    const key = c.categoria?.trim() || "Sem categoria";
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});

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

  async function handleDuplicate(c: Cronograma) {
    if (busy) return;
    setBusy(true);
    try {
      await duplicateFn({ data: { id: c.id } });
      toast.success("Cronograma duplicado!");
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao duplicar");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteFn({ data: { id: deleteTarget.id } });
      toast.success("Cronograma excluído!");
      setDeleteTarget(null);
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir");
    } finally {
      setBusy(false);
    }
  }

  // Adapta cronograma local para AdminCronograma esperado pelo EditarCronogramaDialog
  const editTargetAdmin: AdminCronograma | null = editTarget
    ? {
        id: editTarget.id,
        nome: editTarget.nome,
        categoria: editTarget.categoria,
        premium: editTarget.premium,
        imagem_url: editTarget.imagem_url,
        preco_centavos: editTarget.preco_centavos,
        stripe_price_id: editTarget.stripe_price_id,
        total_materias: 0,
        total_topicos: 0,
        total_alunos_ativos: 0,
        created_at: "",
      }
    : null;

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
          {meusProprios.length > 0 && (
            <CategoryRow
              title="Meu Cronograma"
              items={meusProprios}
              isLocked={() => false}
              showActions
              onSelect={(id) => {
                const c = meusProprios.find((x) => x.id === id);
                if (c) handleSelect(c);
              }}
              onEdit={(c) => setEditTarget(c)}
              onDelete={(c) => setDeleteTarget(c)}
            />
          )}
          {Object.entries(grouped).map(([cat, list]) => (
            <CategoryRow
              key={cat}
              title={cat}
              items={list}
              isLocked={(c) => !acesso.temAcessoCronograma(c.id, c.premium)}
              showActions={isStaff}
              onSelect={(id) => {
                const c = list.find((x) => x.id === id);
                if (c) handleSelect(c);
              }}
              onEdit={isStaff ? (c) => setEditTarget(c) : undefined}
              onDuplicate={isStaff ? (c) => handleDuplicate(c) : undefined}
              onDelete={isStaff ? (c) => setDeleteTarget(c) : undefined}
            />
          ))}
        </div>
      )}

      <NovoCronogramaDialog open={open} onOpenChange={setOpen} onCreated={() => load(true)} />
      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />

      <EditarCronogramaDialog
        open={!!editTarget}
        onOpenChange={(v) => !v && setEditTarget(null)}
        cronograma={editTargetAdmin}
        onSaved={() => load(true)}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-medium text-text-main">
              Excluir cronograma
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.nome}</strong>? Os tópicos
              da matriz serão removidos. Os dados de progresso dos alunos não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteConfirm();
              }}
              disabled={busy}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {busy ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
