import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { materiaColor } from "@/lib/materia-color";

type EventoHoje = {
  id: string;
  titulo: string;
  topico_id: string | null;
  materia_nome: string;
  concluido: boolean;
};

type Props = {
  hoje: Date;
  eventosHoje: EventoHoje[];
  onStop: (segundos: number) => void;
};

function fmt(s: number) {
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function CronometroBloco({ hoje, eventosHoje, onStop }: Props) {
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [segundos, setSegundos] = useState(0);

  useEffect(() => {
    if (!running || paused) return;
    const id = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running, paused]);

  const dataExt = format(hoje, "EEEE',' dd 'de' MMMM", { locale: ptBR });
  const pendentes = eventosHoje.filter((e) => !e.concluido);

  function handleStop() {
    onStop(segundos);
    setRunning(false);
    setPaused(false);
    setSegundos(0);
  }

  return (
    <div className="lei-card mb-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <div className="text-[11px] uppercase tracking-wider text-text-muted mb-1">Hoje</div>
          <div className="font-serif text-[20px] text-text-main capitalize mb-3">{dataExt}</div>
          {pendentes.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {pendentes.map((e) => (
                <span
                  key={e.id}
                  className="text-[11px] px-2 py-[3px] rounded-[99px] text-white"
                  style={{ background: materiaColor(e.materia_nome) }}
                >
                  {e.materia_nome}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-[12px] text-text-muted">Nenhum tópico pendente para hoje.</div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          {running && (
            <div
              className="text-[28px] font-medium text-text-main"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {fmt(segundos)}
            </div>
          )}
          <div className="flex gap-2">
            {!running && (
              <Button
                onClick={() => setRunning(true)}
                disabled={pendentes.length === 0}
                className="bg-sage-dark hover:bg-sage-dark/90 text-white rounded-[10px] gap-2"
              >
                <Play size={14} /> Iniciar estudos!
              </Button>
            )}
            {running && (
              <>
                <Button
                  onClick={() => setPaused((p) => !p)}
                  variant="outline"
                  className="rounded-[10px] gap-2"
                  style={{ borderColor: "#EF9F27", color: "#B86E07" }}
                >
                  {paused ? <Play size={14} /> : <Pause size={14} />}
                  {paused ? "Continuar" : "Pausar"}
                </Button>
                <Button
                  onClick={handleStop}
                  variant="outline"
                  className="rounded-[10px] gap-2"
                  style={{ borderColor: "#E24B4A", color: "#E24B4A" }}
                >
                  <Square size={14} /> Stop
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
