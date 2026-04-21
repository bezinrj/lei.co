import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  cronogramaId: string;
  /** ids de tópicos que pertencem a este cronograma (para limitar o escopo de sessions/revisões) */
  topicoIds: string[];
  onCleared: () => void;
};

export function LimparEventosModal({
  open,
  onOpenChange,
  userId,
  cronogramaId,
  topicoIds,
  onCleared,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function clearAll() {
    setBusy(true);
    try {
      // 1. Apagar todos os eventos do calendário deste cronograma
      const { error: e1 } = await supabase
        .from("user_calendar_events")
        .delete()
        .eq("user_id", userId)
        .eq("cronograma_id", cronogramaId);
      if (e1) throw e1;

      // 2. Apagar sessões de estudo (limitadas aos tópicos deste cronograma)
      if (topicoIds.length > 0) {
        const { error: e2 } = await supabase
          .from("user_sessions")
          .delete()
          .eq("user_id", userId)
          .in("topico_id", topicoIds);
        if (e2) throw e2;
      }

      toast.success("Calendário limpo com sucesso!");
      onOpenChange(false);
      onCleared();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao limpar";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function clearPending() {
    setBusy(true);
    try {
      // 1. Buscar tópicos com pelo menos um evento concluído (a preservar)
      const { data: concluidosRows, error: eq } = await supabase
        .from("user_calendar_events")
        .select("topico_id")
        .eq("user_id", userId)
        .eq("cronograma_id", cronogramaId)
        .eq("concluido", true)
        .not("topico_id", "is", null);
      if (eq) throw eq;
      const preservar = new Set(
        (concluidosRows ?? []).map((r) => r.topico_id).filter((x): x is string => !!x),
      );

      // 2. Apagar eventos não concluídos
      const { error: e1 } = await supabase
        .from("user_calendar_events")
        .delete()
        .eq("user_id", userId)
        .eq("cronograma_id", cronogramaId)
        .eq("concluido", false);
      if (e1) throw e1;

      // 3. Apagar sessões de tópicos que NÃO estão na lista a preservar
      const aLimpar = topicoIds.filter((id) => !preservar.has(id));
      if (aLimpar.length > 0) {
        const { error: e2 } = await supabase
          .from("user_sessions")
          .delete()
          .eq("user_id", userId)
          .in("topico_id", aLimpar);
        if (e2) throw e2;
      }

      toast.success("Calendário limpo com sucesso!");
      onOpenChange(false);
      onCleared();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao limpar";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[460px] rounded-[14px] p-6 gap-0"
        style={{ background: "#ffffff" }}
      >
        <DialogTitle
          className="font-medium mb-4"
          style={{ fontSize: "16px", color: "#111827", fontFamily: "inherit" }}
        >
          Limpar calendário
        </DialogTitle>

        <div className="flex flex-col gap-3">
          <button
            disabled={busy}
            onClick={clearAll}
            className="text-left rounded-[10px] p-4 transition-colors hover:opacity-90 disabled:opacity-60"
            style={{ border: "1px solid #E24B4A", background: "#FFF0F0" }}
          >
            <div className="text-[14px] font-medium" style={{ color: "#E24B4A" }}>
              Limpar todos os registros
            </div>
            <div className="text-[12px] mt-1" style={{ color: "#9b3a39" }}>
              Remove todos os eventos do calendário, sessões de estudo e histórico de revisões deste
              cronograma.
            </div>
          </button>

          <button
            disabled={busy}
            onClick={clearPending}
            className="text-left rounded-[10px] p-4 transition-colors hover:opacity-90 disabled:opacity-60"
            style={{ border: "1px solid #e5e7eb", background: "#f9fafb" }}
          >
            <div className="text-[14px] font-medium" style={{ color: "#374151" }}>
              Limpar apenas pendentes
            </div>
            <div className="text-[12px] mt-1" style={{ color: "#6b7280" }}>
              Remove eventos não concluídos. Preserva sessões e revisões de tópicos com pelo menos
              uma conclusão.
            </div>
          </button>
        </div>

        <Button
          onClick={() => onOpenChange(false)}
          variant="outline"
          className="mt-4 rounded-[8px] self-end"
          disabled={busy}
        >
          Cancelar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
