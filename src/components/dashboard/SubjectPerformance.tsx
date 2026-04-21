import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Visao = "materias" | "topicos";

function corBarra(pct: number): string {
  if (pct >= 80) return "#16A085";
  if (pct >= 60) return "#1D9E75";
  if (pct >= 50) return "#EF9F27";
  return "#E24B4A";
}

type Linha = { nome: string; media: number };

export function SubjectPerformance() {
  const { user } = useAuth();
  const [visao, setVisao] = useState<Visao>("materias");

  const { data: desempenho } = useQuery<Linha[]>({
    queryKey: ["dashboard-desempenho", user?.id, visao],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_sessions")
        .select(
          `percentual_acerto,
           cronograma_topicos!inner(titulo, cronograma_materias!inner(nome))`,
        )
        .eq("user_id", user!.id)
        .not("percentual_acerto", "is", null);

      type Row = {
        percentual_acerto: number;
        cronograma_topicos: {
          titulo: string;
          cronograma_materias: { nome: string };
        };
      };
      const rows = (data ?? []) as unknown as Row[];

      const agrupado: Record<string, { soma: number; count: number }> = {};
      for (const s of rows) {
        const materia = s.cronograma_topicos?.cronograma_materias?.nome ?? "—";
        const titulo = s.cronograma_topicos?.titulo ?? "";
        const key = visao === "materias" ? materia : `${materia} — ${titulo}`;
        if (!agrupado[key]) agrupado[key] = { soma: 0, count: 0 };
        agrupado[key].soma += s.percentual_acerto ?? 0;
        agrupado[key].count += 1;
      }

      return Object.entries(agrupado)
        .map(([nome, v]) => ({ nome, media: Math.round(v.soma / v.count) }))
        .sort((a, b) => b.media - a.media);
    },
  });

  return (
    <div className="lei-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-serif text-[15px] text-text-main">
          Desempenho por {visao === "materias" ? "Matérias" : "Tópicos"}
        </h3>
        <div className="flex bg-muted rounded-full p-1 text-[11px]">
          {(
            [
              { key: "materias", label: "Matérias" },
              { key: "topicos", label: "Tópicos" },
            ] as { key: Visao; label: string }[]
          ).map((v) => (
            <button
              key={v.key}
              onClick={() => setVisao(v.key)}
              className={`px-3 py-1 rounded-full transition-colors ${
                visao === v.key
                  ? "bg-card text-text-main shadow-sm"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {(!desempenho || desempenho.length === 0) && (
        <div className="text-center text-[13px] text-text-muted py-8">
          Nenhuma sessão registrada ainda.
        </div>
      )}

      <div className="flex flex-col gap-2.5 max-h-[360px] overflow-y-auto pr-1">
        {desempenho?.map((item, i) => {
          const baixo = item.media < 60;
          const cor = corBarra(item.media);
          return (
            <div
              key={i}
              className="rounded-[10px] px-3 py-2.5 border transition-colors"
              style={{
                background: baixo ? "var(--blush-light)" : "var(--card)",
                borderColor: baixo ? "rgba(226,75,74,0.4)" : "var(--border)",
              }}
            >
              <div className="flex items-center justify-between mb-1.5 gap-3">
                <span
                  className="text-[12px] font-medium truncate"
                  style={{ color: baixo ? "#E24B4A" : "var(--text-main)" }}
                >
                  {item.nome}
                </span>
                <span
                  className="text-[12px] font-semibold tabular-nums shrink-0"
                  style={{ color: cor }}
                >
                  {item.media}%
                </span>
              </div>
              <div className="bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-500 ease-out"
                  style={{ width: `${item.media}%`, background: cor }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
