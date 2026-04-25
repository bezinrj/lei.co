import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, startOfMonth, startOfWeek, startOfYear } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getCorMateria } from "@/lib/materia-color";

type Visao = "disciplinas" | "assuntos";
type Modo = "horas" | "acerto";
type Periodo = "semana" | "mes" | "ano" | "total";

type SessaoRow = {
  tempo_estudado: string | null;
  questoes: number | null;
  acertos: number | null;
  percentual_acerto: number | null;
  data: string;
  cronograma_topicos: {
    titulo: string;
    assunto: string | null;
    cronograma_materias: { nome: string; cor: string | null };
  };
};

function parseHoras(tempo: string | null): number {
  if (!tempo) return 0;
  const [h, m] = tempo.split(":");
  return (parseInt(h, 10) || 0) + (parseInt(m, 10) || 0) / 60;
}

function periodoLabel(p: Periodo): string {
  if (p === "semana") return "Esta semana";
  if (p === "mes") return "Este mês";
  if (p === "ano") return "Este ano";
  return "Total de atividades";
}

export function SubjectPerformance() {
  const { user } = useAuth();
  const [visao, setVisao] = useState<Visao>("disciplinas");
  const [modo, setModo] = useState<Modo>("horas");
  const [periodo, setPeriodo] = useState<Periodo>("total");
  const [disciplinaSelecionada, setDisciplinaSelecionada] = useState<string>("");

  const { data: sessoes = [] } = useQuery<SessaoRow[]>({
    queryKey: ["dashboard-grafico", user?.id, periodo],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from("user_sessions")
        .select(
          `tempo_estudado, questoes, acertos, percentual_acerto, data,
           cronograma_topicos!inner(titulo, assunto,
             cronograma_materias!inner(nome, cor))`,
        )
        .eq("user_id", user!.id);

      const hoje = new Date();
      if (periodo === "semana") {
        query = query.gte(
          "data",
          format(startOfWeek(hoje, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        );
      } else if (periodo === "mes") {
        query = query.gte("data", format(startOfMonth(hoje), "yyyy-MM-dd"));
      } else if (periodo === "ano") {
        query = query.gte("data", format(startOfYear(hoje), "yyyy-MM-dd"));
      }

      const { data } = await query;
      return (data ?? []) as unknown as SessaoRow[];
    },
  });

  // Agregar por disciplina
  const disciplinas = useMemo(() => {
    const acc: Record<
      string,
      { horas: number; questoes: number; acertos: number; cor: string }
    > = {};
    for (const s of sessoes) {
      const nome = s.cronograma_topicos?.cronograma_materias?.nome ?? "—";
      const cor =
        s.cronograma_topicos?.cronograma_materias?.cor || getCorMateria(nome);
      if (!acc[nome]) acc[nome] = { horas: 0, questoes: 0, acertos: 0, cor };
      acc[nome].horas += parseHoras(s.tempo_estudado);
      acc[nome].questoes += s.questoes ?? 0;
      acc[nome].acertos += s.acertos ?? 0;
    }
    const totalHoras = Object.values(acc).reduce((a, v) => a + v.horas, 0);
    return Object.entries(acc)
      .map(([nome, v]) => ({
        nome,
        horas: parseFloat(v.horas.toFixed(1)),
        pct_horas:
          totalHoras > 0 ? parseFloat(((v.horas / totalHoras) * 100).toFixed(1)) : 0,
        pct_acerto:
          v.questoes > 0 ? Math.round((v.acertos / v.questoes) * 100) : null,
        questoes: v.questoes,
        cor: v.cor,
      }))
      .sort((a, b) => b.horas - a.horas);
  }, [sessoes]);

  const totalHoras = disciplinas.reduce((a, d) => a + d.horas, 0);
  const totalQuestoes = disciplinas.reduce((a, d) => a + d.questoes, 0);
  const totalAcertos = sessoes.reduce((a, s) => a + (s.acertos ?? 0), 0);
  const mediaAcerto =
    totalQuestoes > 0 ? Math.round((totalAcertos / totalQuestoes) * 100) : 0;

  // Garantir disciplina selecionada válida
  const disciplinaAtual =
    disciplinaSelecionada && disciplinas.some((d) => d.nome === disciplinaSelecionada)
      ? disciplinaSelecionada
      : disciplinas[0]?.nome ?? "";

  // Agregar por assunto da disciplina escolhida
  const assuntos = useMemo(() => {
    if (!disciplinaAtual) return [];
    const acc: Record<string, { horas: number; questoes: number; acertos: number }> =
      {};
    for (const s of sessoes) {
      const mat = s.cronograma_topicos?.cronograma_materias?.nome;
      if (mat !== disciplinaAtual) continue;
      const nome =
        s.cronograma_topicos?.assunto?.trim() ||
        s.cronograma_topicos?.titulo ||
        "Sem assunto";
      if (!acc[nome]) acc[nome] = { horas: 0, questoes: 0, acertos: 0 };
      acc[nome].horas += parseHoras(s.tempo_estudado);
      acc[nome].questoes += s.questoes ?? 0;
      acc[nome].acertos += s.acertos ?? 0;
    }
    return Object.entries(acc)
      .map(([nome, v]) => ({
        nome,
        horas: parseFloat(v.horas.toFixed(1)),
        pct_acerto:
          v.questoes > 0 ? Math.round((v.acertos / v.questoes) * 100) : null,
        questoes: v.questoes,
      }))
      .sort((a, b) => b.horas - a.horas);
  }, [sessoes, disciplinaAtual]);

  // Dados para BarChart empilhado: uma única barra (período) com cada disciplina/assunto como série
  const chartData = useMemo(() => {
    const row: Record<string, string | number> = { periodo: periodoLabel(periodo) };
    if (visao === "disciplinas") {
      for (const d of disciplinas) {
        row[d.nome] = modo === "horas" ? d.horas : (d.pct_acerto ?? 0);
      }
    } else {
      for (const a of assuntos) {
        row[a.nome] = modo === "horas" ? a.horas : (a.pct_acerto ?? 0);
      }
    }
    return [row];
  }, [visao, modo, disciplinas, assuntos, periodo]);

  const corDisciplinaAtual =
    disciplinas.find((d) => d.nome === disciplinaAtual)?.cor ?? "#888780";

  const TooltipCustom = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; fill: string }>;
  }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border rounded-[10px] px-3 py-2 text-xs shadow-md">
        {payload
          .filter((p) => p.value > 0)
          .map((p, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: p.fill }}
              />
              <span className="text-text-muted">{p.name}:</span>
              <span className="font-medium text-text-main tabular-nums">
                {modo === "horas" ? `${p.value.toFixed(1)}h` : `${p.value}%`}
              </span>
            </div>
          ))}
      </div>
    );
  };

  const pillBase =
    "px-3 py-1 rounded-full text-[11px] cursor-pointer transition-colors border";
  const pillOff = "bg-card text-text-muted border-border hover:text-text-main";
  const pillOn = "bg-sage-light text-sage border-sage";

  return (
    <div className="lei-card">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-serif text-[15px] text-text-main">
          Desempenho por {visao === "disciplinas" ? "Disciplinas" : "Assuntos"}
        </h3>
        <div className="flex gap-1.5 flex-wrap">
          {(["disciplinas", "assuntos"] as Visao[]).map((v) => (
            <button
              key={v}
              onClick={() => setVisao(v)}
              className={`${pillBase} ${visao === v ? pillOn : pillOff}`}
            >
              {v === "disciplinas" ? "Disciplinas" : "Assuntos"}
            </button>
          ))}
          {(["horas", "acerto"] as Modo[]).map((m) => (
            <button
              key={m}
              onClick={() => setModo(m)}
              className={`${pillBase} ${
                modo === m
                  ? "bg-sky-light text-sky border-sky"
                  : pillOff
              }`}
            >
              {m === "horas" ? "Horas" : "% Acerto"}
            </button>
          ))}
        </div>
      </div>

      {/* Filtro de período */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {(["semana", "mes", "ano", "total"] as Periodo[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={`${pillBase} ${periodo === p ? pillOn : pillOff}`}
          >
            {p === "mes" ? "Mês" : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {sessoes.length === 0 ? (
        <div className="text-center text-[13px] text-text-muted py-10">
          Nenhuma sessão registrada ainda. Comece seus estudos para ver seu
          desempenho aqui!
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Gráfico */}
          <div className="flex-1 w-full min-w-0">
            {visao === "assuntos" && (
              <select
                value={disciplinaAtual}
                onChange={(e) => setDisciplinaSelecionada(e.target.value)}
                className="mb-3 px-3 py-1.5 rounded-lg border border-border bg-card text-[12px] text-text-main outline-none"
              >
                {disciplinas.map((d) => (
                  <option key={d.nome} value={d.nome}>
                    {d.nome}
                  </option>
                ))}
              </select>
            )}

            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} barSize={64}>
                <XAxis
                  dataKey="periodo"
                  tick={{ fontSize: 11, fill: "#8A8478" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#8A8478" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<TooltipCustom />}
                  cursor={{ fill: "var(--muted)" }}
                />
                {visao === "disciplinas"
                  ? disciplinas.map((d) => (
                      <Bar
                        key={d.nome}
                        dataKey={d.nome}
                        stackId="a"
                        fill={d.cor}
                      />
                    ))
                  : assuntos.map((a, i) => (
                      <Bar
                        key={a.nome}
                        dataKey={a.nome}
                        stackId="a"
                        fill={corDisciplinaAtual}
                        fillOpacity={Math.max(0.35, 1 - i * 0.1)}
                      />
                    ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Legenda lateral */}
          <div className="flex flex-col gap-2.5 lg:min-w-[220px] w-full lg:w-auto">
            <div className="mb-2">
              <div className="font-serif text-[28px] font-medium text-text-main leading-none">
                {modo === "horas"
                  ? `${totalHoras.toFixed(0)}h`
                  : `${mediaAcerto}%`}
              </div>
              <div className="text-[11px] text-text-muted mt-1">
                {periodoLabel(periodo)}
              </div>
            </div>

            {(visao === "disciplinas" ? disciplinas : assuntos).map((item, i) => {
              const cor =
                visao === "disciplinas"
                  ? (item as (typeof disciplinas)[number]).cor
                  : corDisciplinaAtual;
              const opacidade =
                visao === "disciplinas" ? 1 : Math.max(0.35, 1 - i * 0.1);
              return (
                <div key={item.nome} className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: cor, opacity: opacidade }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-text-main font-medium truncate">
                      {item.nome}
                    </div>
                    <div className="text-[11px] text-text-muted">
                      {modo === "horas"
                        ? visao === "disciplinas"
                          ? `${item.horas.toFixed(1)}h (${(item as (typeof disciplinas)[number]).pct_horas}%)`
                          : `${item.horas.toFixed(1)}h`
                        : item.pct_acerto !== null
                          ? `${item.pct_acerto}% de acerto`
                          : "Sem questões"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
