import { useMemo } from "react";
import { Progress } from "@/components/ui/progress";

type Topico = { id: string; titulo: string };
type Materia = { id: string; nome: string; topicos: Topico[] };
type Evento = { topico_id: string | null; concluido: boolean };

type Props = {
  materias: Materia[];
  eventos: Evento[];
};

export function DesempenhoTab({ materias, eventos }: Props) {
  const stats = useMemo(() => {
    const concluidosSet = new Set(
      eventos.filter((e) => e.concluido && e.topico_id).map((e) => e.topico_id!),
    );
    const totalTopicos = materias.reduce((s, m) => s + m.topicos.length, 0);
    const concluidos = materias.reduce(
      (s, m) => s + m.topicos.filter((t) => concluidosSet.has(t.id)).length,
      0,
    );
    const porMateria = materias.map((m) => {
      const total = m.topicos.length;
      const ok = m.topicos.filter((t) => concluidosSet.has(t.id)).length;
      return {
        id: m.id,
        nome: m.nome,
        total,
        ok,
        pct: total === 0 ? 0 : Math.round((ok / total) * 100),
      };
    });
    return {
      totalTopicos,
      concluidos,
      pctGeral: totalTopicos === 0 ? 0 : Math.round((concluidos / totalTopicos) * 100),
      porMateria,
    };
  }, [materias, eventos]);

  if (materias.length === 0) {
    return (
      <div className="lei-card text-center py-12 text-text-muted text-[13px]">
        Sem matérias para medir desempenho.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="lei-card">
          <div className="text-[11px] uppercase tracking-wider text-text-muted">Geral</div>
          <div className="font-serif text-[28px] text-text-main">{stats.pctGeral}%</div>
          <Progress value={stats.pctGeral} className="mt-2 h-1.5" />
        </div>
        <div className="lei-card">
          <div className="text-[11px] uppercase tracking-wider text-text-muted">Tópicos</div>
          <div className="font-serif text-[28px] text-text-main">
            {stats.concluidos}<span className="text-text-muted text-[16px]">/{stats.totalTopicos}</span>
          </div>
        </div>
        <div className="lei-card">
          <div className="text-[11px] uppercase tracking-wider text-text-muted">Matérias</div>
          <div className="font-serif text-[28px] text-text-main">{materias.length}</div>
        </div>
      </div>

      <div className="lei-card">
        <h3 className="font-serif text-[16px] text-text-main mb-3">Por matéria</h3>
        <div className="flex flex-col gap-3">
          {stats.porMateria.map((m) => (
            <div key={m.id}>
              <div className="flex justify-between text-[12px] mb-1">
                <span className="text-text-main">{m.nome}</span>
                <span className="text-text-muted">
                  {m.ok}/{m.total} ({m.pct}%)
                </span>
              </div>
              <Progress value={m.pct} className="h-1.5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}