import { useMemo, useState } from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  isSameDay,
  isSameMonth,
  addWeeks,
  addMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Evento = {
  id: string;
  titulo: string;
  data: string;
  cor: string | null;
  concluido: boolean;
  topico_id: string | null;
};

type Props = {
  eventos: Evento[];
  userId: string;
  onChange: () => void;
};

type ViewMode = "semana" | "mes";

export function CalendarioTab({ eventos, userId, onChange }: Props) {
  const [view, setView] = useState<ViewMode>("semana");
  const [offset, setOffset] = useState(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  const refDate = useMemo(
    () => (view === "semana" ? addWeeks(new Date(), offset) : addMonths(new Date(), offset)),
    [view, offset],
  );

  const dias = useMemo(() => {
    if (view === "semana") {
      const start = startOfWeek(refDate, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const monthStart = startOfMonth(refDate);
    const monthEnd = endOfMonth(refDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days: Date[] = [];
    let cur = gridStart;
    while (cur <= gridEnd) {
      days.push(cur);
      cur = addDays(cur, 1);
    }
    return days;
  }, [view, refDate]);

  const eventosPorDia = useMemo(() => {
    const map = new Map<string, Evento[]>();
    for (const e of eventos) {
      if (!map.has(e.data)) map.set(e.data, []);
      map.get(e.data)!.push(e);
    }
    return map;
  }, [eventos]);

  async function toggleConcluido(ev: Evento) {
    const novoEstado = !ev.concluido;
    const { error } = await supabase
      .from("user_calendar_events")
      .update({ concluido: novoEstado })
      .eq("id", ev.id);
    if (error) return toast.error(error.message);

    if (ev.topico_id) {
      await supabase.from("user_topico_progresso").upsert(
        {
          user_id: userId,
          topico_id: ev.topico_id,
          concluido: novoEstado,
          concluido_em: novoEstado ? new Date().toISOString() : null,
        },
        { onConflict: "user_id,topico_id" } as never,
      );
    }
    onChange();
  }

  async function moveEvento(eventoId: string, novaData: string) {
    const ev = eventos.find((e) => e.id === eventoId);
    if (!ev || ev.data === novaData) return;
    const { error } = await supabase
      .from("user_calendar_events")
      .update({ data: novaData })
      .eq("id", eventoId);
    if (error) return toast.error(error.message);
    toast.success("Tópico movido");
    onChange();
  }

  if (eventos.length === 0) {
    return (
      <div className="lei-card text-center py-12 text-text-muted text-[13px]">
        Ative o cronograma para ver seus tópicos distribuídos por dia.
      </div>
    );
  }

  const headerLabel =
    view === "semana"
      ? `Semana de ${format(startOfWeek(refDate, { weekStartsOn: 1 }), "dd 'de' MMMM", { locale: ptBR })}`
      : format(refDate, "MMMM 'de' yyyy", { locale: ptBR });

  const weekdays = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-[8px] border border-border p-[2px] bg-muted">
            {(["semana", "mes"] as const).map((v) => (
              <button
                key={v}
                onClick={() => {
                  setView(v);
                  setOffset(0);
                }}
                className={`text-[12px] px-3 h-7 rounded-[6px] transition-colors ${
                  view === v
                    ? "bg-background text-text-main shadow-sm"
                    : "text-text-muted hover:text-text-main"
                }`}
              >
                {v === "semana" ? "Semana" : "Mês"}
              </button>
            ))}
          </div>
          <div className="text-[12px] text-text-muted capitalize">{headerLabel}</div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOffset((o) => o - 1)}
            className="h-8 w-8 p-0 rounded-[8px]"
            aria-label={view === "semana" ? "Semana anterior" : "Mês anterior"}
          >
            <ChevronLeft size={14} />
          </Button>
          {offset !== 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(0)}
              className="h-8 px-3 rounded-[8px] text-[12px]"
            >
              Hoje
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOffset((o) => o + 1)}
            className="h-8 w-8 p-0 rounded-[8px]"
            aria-label={view === "semana" ? "Próxima semana" : "Próximo mês"}
          >
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>

      {view === "mes" && (
        <div className="grid grid-cols-7 gap-2 mb-1">
          {weekdays.map((w) => (
            <div
              key={w}
              className="text-[10px] uppercase tracking-wider text-text-muted text-center"
            >
              {w}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-7 gap-2">
        {dias.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const evs = eventosPorDia.get(key) ?? [];
          const isToday = isSameDay(d, new Date());
          const isOver = dragOverDay === key;
          const outOfMonth = view === "mes" && !isSameMonth(d, refDate);
          const minH = view === "semana" ? "min-h-[180px]" : "min-h-[110px]";
          const maxVisible = view === "semana" ? evs.length : 3;
          const visibleEvs = evs.slice(0, maxVisible);
          const overflow = evs.length - visibleEvs.length;

          return (
            <div
              key={key}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverDay !== key) setDragOverDay(key);
              }}
              onDragLeave={() => {
                if (dragOverDay === key) setDragOverDay(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                setDragOverDay(null);
                setDraggingId(null);
                if (id) moveEvento(id, key);
              }}
              className={`lei-card ${minH} !p-3 transition-colors ${
                isToday ? "ring-2 ring-sage" : ""
              } ${isOver ? "bg-sage-light/40 ring-2 ring-sage-dark" : ""} ${
                outOfMonth ? "opacity-50" : ""
              }`}
            >
              {view === "semana" && (
                <div className="text-[10px] uppercase tracking-wider text-text-muted">
                  {format(d, "EEE", { locale: ptBR })}
                </div>
              )}
              <div className="text-[16px] font-serif text-text-main mb-2">{format(d, "dd")}</div>
              <div className="flex flex-col gap-1">
                {visibleEvs.map((ev) => (
                  <div
                    key={ev.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", ev.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDraggingId(ev.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOverDay(null);
                    }}
                    className={`group flex items-start gap-1 text-left text-[11px] px-2 py-1 rounded-[6px] border transition-all cursor-grab active:cursor-grabbing ${
                      ev.concluido
                        ? "bg-sage-light border-sage line-through text-text-muted"
                        : "bg-background border-border text-text-main hover:bg-muted"
                    } ${draggingId === ev.id ? "opacity-40" : ""}`}
                  >
                    <GripVertical
                      size={10}
                      className="mt-[2px] shrink-0 text-text-muted/60 opacity-0 group-hover:opacity-100"
                    />
                    <button
                      onClick={() => toggleConcluido(ev)}
                      className="flex-1 text-left flex items-start gap-1"
                    >
                      {ev.concluido && <Check size={10} className="mt-[2px] shrink-0" />}
                      <span className="line-clamp-2">{ev.titulo}</span>
                    </button>
                  </div>
                ))}
                {overflow > 0 && (
                  <div className="text-[10px] text-text-muted">+{overflow} mais</div>
                )}
                {evs.length === 0 && view === "semana" && (
                  <div className="text-[10px] text-text-muted/60">livre</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
