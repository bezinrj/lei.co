import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCorMateriaPastel } from "@/lib/materia-color";

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

const LS_START = "timer_start";
const LS_RUNNING = "timer_running";
const LS_ACC = "timer_accumulated"; // milissegundos acumulados (de pausas anteriores)

function fmt(s: number) {
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function readState() {
  if (typeof window === "undefined") {
    return { running: false, paused: false, elapsedMs: 0 };
  }
  const running = localStorage.getItem(LS_RUNNING);
  const acc = parseInt(localStorage.getItem(LS_ACC) || "0", 10) || 0;
  const start = parseInt(localStorage.getItem(LS_START) || "0", 10) || 0;
  if (running === "true" && start > 0) {
    return { running: true, paused: false, elapsedMs: acc + (Date.now() - start) };
  }
  if (running === "false" && acc > 0) {
    return { running: true, paused: true, elapsedMs: acc };
  }
  return { running: false, paused: false, elapsedMs: 0 };
}

export function CronometroBloco({ hoje, eventosHoje, onStop }: Props) {
  // restaura imediatamente do localStorage
  const initial = useRef(readState());
  const [running, setRunning] = useState(initial.current.running);
  const [paused, setPaused] = useState(initial.current.paused);
  const [elapsedMs, setElapsedMs] = useState(initial.current.elapsedMs);

  // tick: recomputa a partir do localStorage (resiliente a troca de aba)
  useEffect(() => {
    if (!running || paused) return;
    const id = setInterval(() => {
      const st = readState();
      setElapsedMs(st.elapsedMs);
    }, 1000);
    return () => clearInterval(id);
  }, [running, paused]);

  // re-sincroniza ao voltar para a aba/janela
  useEffect(() => {
    function sync() {
      const st = readState();
      setRunning(st.running);
      setPaused(st.paused);
      setElapsedMs(st.elapsedMs);
    }
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  const dataExt = format(hoje, "EEEE',' dd 'de' MMMM", { locale: ptBR });
  const pendentes = eventosHoje.filter((e) => !e.concluido);
  const segundos = Math.floor(elapsedMs / 1000);

  function handleIniciar() {
    localStorage.setItem(LS_START, Date.now().toString());
    localStorage.setItem(LS_RUNNING, "true");
    localStorage.setItem(LS_ACC, "0");
    setRunning(true);
    setPaused(false);
    setElapsedMs(0);
  }

  function handlePausarContinuar() {
    if (paused) {
      // continuar
      const acc = parseInt(localStorage.getItem(LS_ACC) || "0", 10) || 0;
      localStorage.setItem(LS_START, Date.now().toString());
      localStorage.setItem(LS_RUNNING, "true");
      localStorage.setItem(LS_ACC, String(acc));
      setPaused(false);
    } else {
      // pausar
      const start = parseInt(localStorage.getItem(LS_START) || "0", 10) || 0;
      const acc = parseInt(localStorage.getItem(LS_ACC) || "0", 10) || 0;
      const total = acc + (start ? Date.now() - start : 0);
      localStorage.setItem(LS_ACC, String(total));
      localStorage.setItem(LS_RUNNING, "false");
      localStorage.removeItem(LS_START);
      setPaused(true);
      setElapsedMs(total);
    }
  }

  function handleEncerrar() {
    const st = readState();
    onStop(Math.floor(st.elapsedMs / 1000));
    // não limpa o localStorage aqui — o modal decide (Salvar/Descartar)
    setRunning(false);
    setPaused(false);
    setElapsedMs(0);
  }

  return (
    <div className="lei-card mb-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <div className="text-[11px] uppercase tracking-wider text-text-muted mb-1">Hoje</div>
          <div className="font-serif text-[20px] text-text-main capitalize mb-3">{dataExt}</div>
          {pendentes.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {pendentes.map((e) => {
                const p = getCorMateriaPastel(e.materia_nome);
                return (
                  <span
                    key={e.id}
                    className="text-[11px] px-2 py-[3px] rounded-[99px] font-medium"
                    style={{ background: p.background, color: p.color }}
                  >
                    {e.materia_nome}
                  </span>
                );
              })}
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
                type="button"
                onClick={handleIniciar}
                className="bg-sage-dark hover:bg-sage-dark/90 text-white rounded-[10px] gap-2"
              >
                <Play size={14} /> Iniciar estudos!
              </Button>
            )}
            {running && (
              <>
                <Button
                  onClick={handlePausarContinuar}
                  variant="outline"
                  className="rounded-[10px] gap-2"
                  style={{ borderColor: "#EF9F27", color: "#B86E07" }}
                >
                  {paused ? <Play size={14} /> : <Pause size={14} />}
                  {paused ? "Continuar" : "Pausar"}
                </Button>
                <Button
                  onClick={handleEncerrar}
                  variant="outline"
                  className="rounded-[10px] gap-2"
                  style={{ borderColor: "#E24B4A", color: "#E24B4A" }}
                >
                  <Square size={14} /> Encerrar sessão
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
