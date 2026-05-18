import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { addDays, endOfWeek, format, startOfWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Modo = "horas" | "questoes";

function parseTempo(t: string | null): number {
  if (!t) return 0;
  const [h, m] = t.split(":");
  const hh = parseInt(h ?? "0", 10) || 0;
  const mm = parseInt(m ?? "0", 10) || 0;
  return hh + mm / 60;
}

export function WeeklyPerformance({ userId }: { userId?: string } = {}) {
  const { user } = useAuth();
  const targetUserId = userId ?? user?.id;
  const [modo, setModo] = useState<Modo>("horas");

  const { inicio, fim } = useMemo(() => {
    const i = startOfWeek(new Date(), { weekStartsOn: 1 });
    const f = endOfWeek(new Date(), { weekStartsOn: 1 });
    return { inicio: i, fim: f };
  }, []);

  const { data: dados } = useQuery({
    queryKey: ["dashboard-semana", targetUserId, format(inicio, "yyyy-MM-dd")],
    enabled: !!targetUserId,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_sessions")
        .select("data, tempo_estudado, questoes")
        .eq("user_id", targetUserId!)
        .gte("data", format(inicio, "yyyy-MM-dd"))
        .lte("data", format(fim, "yyyy-MM-dd"));

      const dias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
      return dias.map((dia, i) => {
        const dataStr = format(addDays(inicio, i), "yyyy-MM-dd");
        const sessoesDia = (data ?? []).filter((s) => s.data === dataStr);
        const horas = sessoesDia.reduce((acc, s) => acc + parseTempo(s.tempo_estudado), 0);
        const questoes = sessoesDia.reduce((acc, s) => acc + (s.questoes ?? 0), 0);
        return {
          dia,
          horas: parseFloat(horas.toFixed(1)),
          questoes,
        };
      });
    },
  });

  const TooltipCustom = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ value: number }>;
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-[10px] border border-border bg-card px-3 py-2 text-[12px] shadow-sm">
        <div className="font-medium text-text-main">{label}</div>
        <div className="text-text-muted">
          {modo === "horas"
            ? `${payload[0].value}h estudadas`
            : `${payload[0].value} questões feitas`}
        </div>
      </div>
    );
  };

  return (
    <div className="lei-card flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-serif text-[15px] text-text-main">Desempenho semanal</h3>
        <div className="flex bg-muted rounded-full p-1 text-[11px]">
          {(["horas", "questoes"] as Modo[]).map((m) => (
            <button
              key={m}
              onClick={() => setModo(m)}
              className={`px-3 py-1 rounded-full transition-colors ${
                modo === m
                  ? "bg-card text-text-main shadow-sm"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              {m === "horas" ? "Horas" : "Questões"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-[180px]">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={dados ?? []} barSize={28} margin={{ top: 18, right: 4, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="dia"
              tick={{ fontSize: 11, fill: "var(--text-muted)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip content={<TooltipCustom />} cursor={{ fill: "var(--muted)" }} />
            <Bar dataKey={modo} radius={[6, 6, 0, 0]}>
              {(dados ?? []).map((entry, index) => (
                <Cell
                  key={index}
                  fill={(entry[modo] as number) > 0 ? "var(--sage)" : "var(--muted)"}
                />
              ))}
              <LabelList
                dataKey={modo}
                position="top"
                style={{ fontSize: 11, fill: "var(--text-muted)", fontWeight: 500 }}
                formatter={(v: number) => (v > 0 ? (modo === "horas" ? `${v}h` : `${v}`) : "")}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
