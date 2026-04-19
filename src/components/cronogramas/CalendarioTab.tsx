import { useMemo, useState } from "react";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

export function CalendarioTab({ eventos, userId, onChange }: Props) {
  const weekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  const eventosPorDia = useMemo(() => {
    const map = new Map<string, Evento[]>();
    for (const e of eventos) {
      const key = e.data;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
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

  return (
    <div>
      <div className="text-[12px] text-text-muted mb-2">
        Semana de {format(weekStart, "dd 'de' MMMM", { locale: ptBR })} · arraste para reorganizar
      </div>
      <div className="grid grid-cols-7 gap-2">
        {dias.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const evs = eventosPorDia.get(key) ?? [];
          const isToday = isSameDay(d, new Date());
          const isOver = dragOverDay === key;
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
              className={`lei-card min-h-[180px] !p-3 transition-colors ${
                isToday ? "ring-2 ring-sage" : ""
              } ${isOver ? "bg-sage-light/40 ring-2 ring-sage-dark" : ""}`}
            >
              <div className="text-[10px] uppercase tracking-wider text-text-muted">
                {format(d, "EEE", { locale: ptBR })}
              </div>
              <div className="text-[18px] font-serif text-text-main mb-2">{format(d, "dd")}</div>
              <div className="flex flex-col gap-1">
                {evs.map((ev) => (
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
                {evs.length === 0 && (
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
