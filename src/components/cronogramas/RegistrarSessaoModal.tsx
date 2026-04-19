import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type SessaoEvento = {
  id: string;
  titulo: string;
  topico_id: string | null;
  materia_nome: string;
  concluido: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  segundosTotais: number;
  eventosPendentes: SessaoEvento[];
  userId: string;
  onSaved: () => void;
};

type LinhaState = {
  tempo: string; // HH:MM:SS
  questoes: string;
  acertos: string;
  concluido: boolean;
};

function fmtTempo(s: number) {
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function parsePct(questoesStr: string, acertosStr: string): number | null {
  const q = parseInt(questoesStr, 10);
  const a = parseInt(acertosStr, 10);
  if (!q || q <= 0 || isNaN(a)) return null;
  return Math.round((Math.min(a, q) / q) * 100);
}

function corBarra(p: number): string {
  if (p < 50) return "#E24B4A";
  if (p < 60) return "#EF9F27";
  if (p < 80) return "#1D9E75";
  return "#0F6F4F";
}

export function RegistrarSessaoModal({
  open,
  onOpenChange,
  segundosTotais,
  eventosPendentes,
  userId,
  onSaved,
}: Props) {
  const segundosPorEvento = useMemo(
    () =>
      eventosPendentes.length > 0 ? Math.floor(segundosTotais / eventosPendentes.length) : 0,
    [segundosTotais, eventosPendentes.length],
  );

  const [linhas, setLinhas] = useState<Record<string, LinhaState>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next: Record<string, LinhaState> = {};
    for (const ev of eventosPendentes) {
      next[ev.id] = {
        tempo: fmtTempo(segundosPorEvento),
        questoes: "",
        acertos: "",
        concluido: true,
      };
    }
    setLinhas(next);
  }, [open, eventosPendentes, segundosPorEvento]);

  function update(id: string, patch: Partial<LinhaState>) {
    setLinhas((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      for (const ev of eventosPendentes) {
        const l = linhas[ev.id];
        if (!l) continue;
        const q = parseInt(l.questoes, 10) || 0;
        const a = parseInt(l.acertos, 10) || 0;
        const pct = q > 0 ? Math.round((Math.min(a, q) / q) * 100) : 0;

        if (ev.topico_id) {
          await supabase.from("user_sessions").insert({
            user_id: userId,
            topico_id: ev.topico_id,
            tempo_estudado: l.tempo,
            questoes: q,
            acertos: a,
            percentual_acerto: pct,
          });
        }

        await supabase
          .from("user_calendar_events")
          .update({ concluido: l.concluido })
          .eq("id", ev.id);

        if (ev.topico_id && l.concluido) {
          await supabase.from("user_topico_progresso").upsert(
            {
              user_id: userId,
              topico_id: ev.topico_id,
              concluido: true,
              concluido_em: new Date().toISOString(),
            },
            { onConflict: "user_id,topico_id" } as never,
          );
        }
      }
      toast.success("Sessão registrada");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[520px] rounded-[14px] p-0 gap-0"
        style={{ background: "#ffffff" }}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <DialogTitle
            className="font-medium"
            style={{ fontSize: "16px", color: "#111827", fontFamily: "inherit" }}
          >
            Registrar sessão de estudo
          </DialogTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="text-[#9ca3af] hover:text-[#374151]"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-5 max-h-[60vh] overflow-y-auto flex flex-col gap-3">
          {eventosPendentes.length === 0 && (
            <div className="text-[12px] text-[#6b7280] py-4 text-center">
              Nenhuma matéria pendente para hoje.
            </div>
          )}
          {eventosPendentes.map((ev) => {
            const l = linhas[ev.id];
            if (!l) return null;
            const pct = parsePct(l.questoes, l.acertos);
            return (
              <div
                key={ev.id}
                className="rounded-[10px] p-3 flex flex-col gap-2"
                style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="text-[11px] px-2 py-[2px] rounded-[6px] font-medium"
                    style={{ background: "#f3f4f6", color: "#374151" }}
                  >
                    {ev.materia_nome}
                  </span>
                  <span className="text-[13px]" style={{ color: "#111827" }}>
                    {ev.titulo}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px]" style={{ color: "#6b7280" }}>
                      Tempo
                    </label>
                    <Input
                      value={l.tempo}
                      onChange={(e) => update(ev.id, { tempo: e.target.value })}
                      className="h-8 text-[12px] mt-1"
                      style={{
                        background: "#ffffff",
                        border: "1px solid #d1d5db",
                        color: "#111827",
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[11px]" style={{ color: "#6b7280" }}>
                      Questões
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={l.questoes}
                      onChange={(e) => update(ev.id, { questoes: e.target.value })}
                      className="h-8 text-[12px] mt-1"
                      style={{
                        background: "#ffffff",
                        border: "1px solid #d1d5db",
                        color: "#111827",
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[11px]" style={{ color: "#6b7280" }}>
                      Acertos
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={l.acertos}
                      onChange={(e) => update(ev.id, { acertos: e.target.value })}
                      className="h-8 text-[12px] mt-1"
                      style={{
                        background: "#ffffff",
                        border: "1px solid #d1d5db",
                        color: "#111827",
                      }}
                    />
                  </div>
                </div>

                {pct !== null && (
                  <div className="flex items-center gap-2">
                    <div
                      className="flex-1 h-[6px] rounded-full overflow-hidden"
                      style={{ background: "#e5e7eb" }}
                    >
                      <div
                        className="h-full transition-all"
                        style={{ width: `${pct}%`, background: corBarra(pct) }}
                      />
                    </div>
                    <span
                      className="text-[11px] font-medium"
                      style={{ color: corBarra(pct), minWidth: 36, textAlign: "right" }}
                    >
                      {pct}%
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Switch
                    checked={l.concluido}
                    onCheckedChange={(v) => update(ev.id, { concluido: v })}
                  />
                  <label
                    className="text-[13px]"
                    style={{ color: "#374151" }}
                  >
                    Marcar como concluída
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="flex justify-end gap-2 px-6 py-4"
          style={{ borderTop: "1px solid #e5e7eb" }}
        >
          <Button
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="rounded-[8px] hover:opacity-90"
            style={{
              background: "#f3f4f6",
              color: "#374151",
              border: "1px solid #e5e7eb",
            }}
          >
            Descartar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || eventosPendentes.length === 0}
            className="rounded-[8px] text-white"
            style={{ background: "#1D9E75" }}
          >
            {saving ? "Salvando..." : "Salvar sessão"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
