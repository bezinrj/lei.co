import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getCorMateriaPastel } from "@/lib/materia-color";

type EventoHoje = {
  id: string;
  titulo: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  concluido: boolean;
  is_revisao: boolean;
  materia_nome: string | null;
};

export function TodaySchedule() {
  const { user } = useAuth();
  const hoje = format(new Date(), "yyyy-MM-dd");

  const { data: eventos } = useQuery<EventoHoje[]>({
    queryKey: ["dashboard-hoje", user?.id, hoje],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_calendar_events")
        .select(
          `id, titulo, hora_inicio, hora_fim, concluido, is_revisao,
           cronograma_materias(nome)`,
        )
        .eq("user_id", user!.id)
        .eq("data", hoje)
        .order("hora_inicio", { ascending: true, nullsFirst: false });

      type Row = {
        id: string;
        titulo: string;
        hora_inicio: string | null;
        hora_fim: string | null;
        concluido: boolean;
        is_revisao: boolean;
        cronograma_materias: { nome: string } | null;
      };
      return ((data ?? []) as unknown as Row[]).map((e) => ({
        id: e.id,
        titulo: e.titulo,
        hora_inicio: e.hora_inicio,
        hora_fim: e.hora_fim,
        concluido: e.concluido,
        is_revisao: e.is_revisao,
        materia_nome: e.cronograma_materias?.nome ?? null,
      }));
    },
  });

  return (
    <div className="lei-card h-full flex flex-col">
      <h3 className="font-serif text-[15px] text-text-main mb-4">Hoje no cronograma</h3>

      {(!eventos || eventos.length === 0) && (
        <div className="flex-1 flex items-center justify-center text-center text-[13px] text-text-muted py-6">
          Nenhum estudo programado para hoje 🎉
        </div>
      )}

      <ul className="flex flex-col gap-2 overflow-y-auto">
        {eventos?.map((b) => {
          const pastel = getCorMateriaPastel(b.materia_nome ?? "");
          const horario =
            b.hora_inicio && b.hora_fim
              ? `${b.hora_inicio.slice(0, 5)} — ${b.hora_fim.slice(0, 5)}`
              : b.hora_inicio
                ? b.hora_inicio.slice(0, 5)
                : "Sem horário";
          const status = b.concluido ? "Concluído" : b.is_revisao ? "Revisão" : "Pendente";
          const statusBg = b.concluido
            ? "var(--sage-light)"
            : b.is_revisao
              ? "var(--lilac-light)"
              : "var(--blush-light)";
          const statusFg = b.concluido
            ? "var(--sage-dark)"
            : b.is_revisao
              ? "oklch(0.45 0.08 300)"
              : "oklch(0.5 0.1 25)";
          return (
            <li
              key={b.id}
              className="flex items-center gap-3 py-2 border-b border-border last:border-b-0"
            >
              <span
                className="px-2 py-1 rounded-[8px] text-[10px] font-medium whitespace-nowrap shrink-0"
                style={{ background: pastel.background, color: pastel.color }}
              >
                {b.materia_nome ?? "—"}
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className={`text-[13px] truncate ${
                    b.concluido ? "text-text-muted line-through" : "text-text-main"
                  }`}
                >
                  {b.titulo}
                </div>
                <div className="text-[11px] text-text-muted">{horario}</div>
              </div>
              <span
                className="text-[10px] px-2 py-1 rounded-[10px] font-medium whitespace-nowrap shrink-0"
                style={{ backgroundColor: statusBg, color: statusFg }}
              >
                {status}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
