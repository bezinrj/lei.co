import { useEffect, useMemo, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getCorMateriaPastel } from "@/lib/materia-color";
import { concederXP } from "@/lib/xp";
import type { Fonte } from "./NovoTopicoForm";

function tempoParaHoras(hms: string): number {
  const [h = "0", m = "0", s = "0"] = hms.split(":");
  return (Number(h) || 0) + (Number(m) || 0) / 60 + (Number(s) || 0) / 3600;
}

export type SessaoEvento = {
  id: string;
  titulo: string;
  topico_id: string | null;
  materia_nome: string;
  concluido: boolean;
  fontes?: Fonte[];
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

const LS_START = "timer_start";
const LS_RUNNING = "timer_running";
const LS_ACC = "timer_accumulated";

function clearTimerLS() {
  localStorage.removeItem(LS_START);
  localStorage.removeItem(LS_RUNNING);
  localStorage.removeItem(LS_ACC);
}

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
  return "#16A085";
}

function fonteLabel(f: Fonte): string {
  return f.descricao ? `${f.sigla} — ${f.descricao}` : f.sigla;
}

function linksQuestoes(fontes: Fonte[]): { sigla: string; url: string }[] {
  return fontes.flatMap((f) => {
    const arr =
      f.links_questoes && f.links_questoes.length > 0
        ? f.links_questoes
        : f.link_questoes
          ? [f.link_questoes]
          : [];
    return arr.filter(Boolean).map((url) => ({ sigla: f.sigla, url: url as string }));
  });
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

  function handleDescartar() {
    clearTimerLS();
    onOpenChange(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const xpToasts: string[] = [];
      const ganhos: { tipo: string; xp: number }[] = [];

      for (const ev of eventosPendentes) {
        const l = linhas[ev.id];
        if (!l) continue;
        const q = parseInt(l.questoes, 10) || 0;
        const a = parseInt(l.acertos, 10) || 0;
        const pct = q > 0 ? Math.round((Math.min(a, q) / q) * 100) : null;

        if (ev.topico_id) {
          await supabase.from("user_sessions").insert({
            user_id: userId,
            topico_id: ev.topico_id,
            tempo_estudado: l.tempo,
            questoes: q > 0 ? q : null,
            acertos: q > 0 ? a : null,
            percentual_acerto: pct,
          });
        }

        // Lookup do evento para saber se é revisão
        const { data: evRow } = await supabase
          .from("user_calendar_events")
          .select("is_revisao")
          .eq("id", ev.id)
          .maybeSingle();
        const isRevisao = !!evRow?.is_revisao;

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

        // ===== XP =====
        const horas = tempoParaHoras(l.tempo);
        if (horas > 0) {
          const r = await concederXP(userId, "horas", { horas });
          if (r.xp_ganho > 0) ganhos.push({ tipo: "horas", xp: r.xp_ganho });
          if (r.levelUp) xpToasts.push(`Subiu para o nível ${r.nivel_novo}!`);
        }
        if (q > 0) {
          const r = await concederXP(userId, "questoes", {
            questoes: q,
            percentual_acerto: pct ?? undefined,
          });
          if (r.xp_ganho > 0) ganhos.push({ tipo: "questões", xp: r.xp_ganho });
          if (r.levelUp) xpToasts.push(`Subiu para o nível ${r.nivel_novo}!`);
        }
        if (isRevisao && l.concluido && pct !== null && pct >= 60) {
          const r = await concederXP(userId, "revisao_60");
          if (r.xp_ganho > 0) ganhos.push({ tipo: "revisão", xp: r.xp_ganho });
          if (r.levelUp) xpToasts.push(`Subiu para o nível ${r.nivel_novo}!`);
        }
        if (ev.topico_id && l.concluido && !isRevisao) {
          const r = await concederXP(userId, "topico_concluido");
          if (r.xp_ganho > 0) ganhos.push({ tipo: "tópico", xp: r.xp_ganho });
          if (r.levelUp) xpToasts.push(`Subiu para o nível ${r.nivel_novo}!`);
        }
      }

      clearTimerLS();
      const totalXP = ganhos.reduce((s, g) => s + g.xp, 0);
      toast.success(
        totalXP > 0 ? `Sessão registrada • +${totalXP} XP` : "Sessão registrada",
      );
      xpToasts.forEach((m) => toast.success(m));
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : handleDescartar())}>
      <DialogContent
        className="sm:max-w-[560px] rounded-[14px] p-0 gap-0"
        style={{ background: "#ffffff" }}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <DialogTitle
            className="font-medium"
            style={{ fontSize: "16px", color: "#111827", fontFamily: "inherit" }}
          >
            Registrar sessão de estudo
          </DialogTitle>
          <button
            onClick={handleDescartar}
            className="text-[#9ca3af] hover:text-[#374151]"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tempo total */}
        <div className="px-6 pb-3">
          <div className="text-[11px] uppercase tracking-wider" style={{ color: "#6b7280" }}>
            Tempo total da sessão
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 500,
              fontVariantNumeric: "tabular-nums",
              color: "#1D9E75",
            }}
          >
            {fmtTempo(segundosTotais)}
          </div>
        </div>

        <div className="px-6 pb-5 max-h-[55vh] overflow-y-auto flex flex-col gap-3">
          {eventosPendentes.length === 0 && (
            <div className="text-[12px] text-[#6b7280] py-4 text-center">
              Nenhuma matéria pendente para hoje.
            </div>
          )}
          {eventosPendentes.map((ev) => {
            const l = linhas[ev.id];
            if (!l) return null;
            const pct = parsePct(l.questoes, l.acertos);
            const pastel = getCorMateriaPastel(ev.materia_nome);
            const fontes = ev.fontes ?? [];
            const fontePrincipal = fontes[0];
            const linksSug = linksQuestoes(fontes);

            return (
              <div
                key={ev.id}
                className="rounded-[10px] p-3 flex flex-col gap-2"
                style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-[11px] px-2 py-[2px] rounded-[99px] font-medium"
                    style={{ background: pastel.background, color: pastel.color }}
                  >
                    {ev.materia_nome}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>
                    {ev.titulo}
                  </span>
                </div>
                {fontePrincipal && (
                  <div style={{ fontSize: 11, color: "#6b7280" }}>{fonteLabel(fontePrincipal)}</div>
                )}

                {/* Checkbox de conclusão */}
                <label
                  className="flex items-center gap-2 cursor-pointer select-none"
                  style={{ fontSize: 13, color: "#374151" }}
                >
                  <Checkbox
                    checked={l.concluido}
                    onCheckedChange={(v) => update(ev.id, { concluido: !!v })}
                  />
                  Marcar esta matéria como concluída
                </label>

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
                      Questões feitas
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
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: corBarra(pct),
                        minWidth: 36,
                        textAlign: "right",
                      }}
                    >
                      {pct}%
                    </span>
                  </div>
                )}
                {pct === null && (
                  <div style={{ fontSize: 10, color: "#9ca3af", fontStyle: "italic" }}>
                    Sem questões registradas — desempenho não será calculado
                  </div>
                )}

                {linksSug.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#6b7280",
                        marginTop: 8,
                        marginBottom: 4,
                      }}
                    >
                      Links sugeridos
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {linksSug.map((l, i) => (
                        <a
                          key={`${l.sigla}-${i}`}
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1"
                          style={{
                            fontSize: 10,
                            color: "#378ADD",
                            border: "1px solid #B5D4F4",
                            borderRadius: 20,
                            padding: "2px 8px",
                          }}
                        >
                          {l.sigla} <ExternalLink size={9} />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div
          className="flex justify-end gap-2 px-6 py-4"
          style={{ borderTop: "1px solid #e5e7eb" }}
        >
          <Button
            onClick={handleDescartar}
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
