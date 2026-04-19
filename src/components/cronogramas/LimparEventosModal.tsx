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
  onCleared: () => void;
};

export function LimparEventosModal({
  open,
  onOpenChange,
  userId,
  cronogramaId,
  onCleared,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function clearAll() {
    setBusy(true);
    const { error } = await supabase
      .from("user_calendar_events")
      .delete()
      .eq("user_id", userId)
      .eq("cronograma_id", cronogramaId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Calendário limpo");
    onOpenChange(false);
    onCleared();
  }

  async function clearPending() {
    setBusy(true);
    const { error } = await supabase
      .from("user_calendar_events")
      .delete()
      .eq("user_id", userId)
      .eq("cronograma_id", cronogramaId)
      .eq("concluido", false);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Pendentes removidos");
    onOpenChange(false);
    onCleared();
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
              Remove todos os eventos deste cronograma, inclusive concluídos.
            </div>
          </button>

          <button
            disabled={busy}
            onClick={clearPending}
            className="text-left rounded-[10px] p-4 transition-colors hover:opacity-90 disabled:opacity-60"
            style={{ border: "1px solid #e5e7eb", background: "#f9fafb" }}
          >
            <div className="text-[14px] font-medium" style={{ color: "#374151" }}>
              Limpar apenas não concluídas
            </div>
            <div className="text-[12px] mt-1" style={{ color: "#6b7280" }}>
              Mantém o histórico de tópicos já finalizados.
            </div>
          </button>
        </div>

        <Button
          onClick={() => onOpenChange(false)}
          variant="outline"
          className="mt-4 rounded-[8px] self-end"
        >
          Cancelar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
