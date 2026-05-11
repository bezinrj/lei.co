import { useEffect, useMemo, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { colorForMateria } from "@/lib/materia-color";
import { RefreshCw, TrendingDown, TrendingUp, History } from "lucide-react";
import { toast } from "sonner";

type Topico = { id: string; titulo: string };
type Materia = { id: string; nome: string; cor: string; topicos: Topico[] };
type Evento = { topico_id: string | null; concluido: boolean; is_revisao?: boolean };

type Props = {
  cronogramaId: string;
  userId: string | null;
  materias: Materia[];
  eventos: Evento[];
  onChange?: () => void;
};

type SessionRow = {
  id: string;
  topico_id: string;
  percentual_acerto: number;
  questoes: number;
  acertos: number;
  data: string;
  user_id: string;
};

function nextWeekday(from: Date): string {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function DesempenhoTab({ cronogramaId, userId, materias, eventos, onChange }: Props) {
  const [mySessions, setMySessions] = useState<SessionRow[]>([]);
  const [allSessions, setAllSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingRevisao, setCreatingRevisao] = useState<string | null>(null);

  const allTopicoIds = useMemo(
    () => materias.flatMap((m) => m.topicos.map((t) => t.id)),
    [materias],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (allTopicoIds.length === 0) {
        setMySessions([]);
        setAllSessions([]);
        setLoading(false);
        return;
      }
      const { data: all } = await supabase
        .from("user_sessions")
        .select("id, topico_id, percentual_acerto, questoes, acertos, data, user_id")
        .in("topico_id", allTopicoIds)
        .not("percentual_acerto", "is", null);
      if (cancelled) return;
      const rows = (all ?? []) as SessionRow[];
      setAllSessions(rows);
      setMySessions(userId ? rows.filter((r) => r.user_id === userId) : []);
      setLoading(false);
    }
    setLoading(true);
    load();
    return () => {
      cancelled = true;
    };
  }, [allTopicoIds, userId, cronogramaId]);

  // Stats: per materia my % vs avg %
  const stats = useMemo(() => {
    const concluidosSet = new Set(
      eventos.filter((e) => e.concluido && e.topico_id).map((e) => e.topico_id!),
    );
    const totalTopicos = materias.reduce((s, m) => s + m.topicos.length, 0);
    const concluidos = materias.reduce(
      (s, m) => s + m.topicos.filter((t) => concluidosSet.has(t.id)).length,
      0,
    );

    const topicoTitulo = new Map<string, string>();
    materias.forEach((m) => m.topicos.forEach((t) => topicoTitulo.set(t.id, t.titulo)));

    const porMateria = materias.map((m) => {
      const tIds = new Set(m.topicos.map((t) => t.id));
      const mine = mySessions
        .filter((s) => tIds.has(s.topico_id))
        .slice()
        .sort((a, b) => a.data.localeCompare(b.data));
      const others = allSessions.filter((s) => tIds.has(s.topico_id));
      const ultimaSessao = mine.length > 0 ? mine[mine.length - 1] : null;
      const myLast = ultimaSessao ? ultimaSessao.percentual_acerto : null;
      const ultimoAssunto = ultimaSessao ? topicoTitulo.get(ultimaSessao.topico_id) ?? null : null;
      const allAvg =
        others.length === 0
          ? null
          : Math.round(others.reduce((acc, s) => acc + s.percentual_acerto, 0) / others.length);
      const okTopicos = m.topicos.filter((t) => concluidosSet.has(t.id)).length;
      return {
        id: m.id,
        nome: m.nome,
        cor: m.cor,
        total: m.topicos.length,
        ok: okTopicos,
        pctConclusao: m.topicos.length === 0 ? 0 : Math.round((okTopicos / m.topicos.length) * 100),
        myLast,
        ultimoAssunto,
        ultimaData: ultimaSessao?.data ?? null,
        allAvg,
        sessions: mine.length,
      };
    });

    // Ordenação: matérias com sessões aparecem primeiro, ordenadas pelas
    // últimas sessões com pior rendimento (mais recente + menor %).
    porMateria.sort((a, b) => {
      if (a.myLast === null && b.myLast === null) return 0;
      if (a.myLast === null) return 1;
      if (b.myLast === null) return -1;
      // Mais recente primeiro
      if (a.ultimaData && b.ultimaData && a.ultimaData !== b.ultimaData) {
        return b.ultimaData.localeCompare(a.ultimaData);
      }
      return a.myLast - b.myLast;
    });

    return {
      totalTopicos,
      concluidos,
      pctGeral: totalTopicos === 0 ? 0 : Math.round((concluidos / totalTopicos) * 100),
      porMateria,
    };
  }, [materias, eventos, mySessions, allSessions]);

  // Tópicos aguardando revisão (evento is_revisao=true ainda não concluído neste cronograma)
  const aguardandoRevisao = useMemo(() => {
    const set = new Set<string>();
    eventos.forEach((e) => {
      if (e.is_revisao && !e.concluido && e.topico_id) set.add(e.topico_id);
    });
    return set;
  }, [eventos]);

  // Painel por TÓPICO: média < 60%, excluindo os que já têm revisão pendente
  type TopicoBaixo = {
    topicoId: string;
    titulo: string;
    materiaId: string;
    materiaNome: string;
    materiaCor: string;
    media: number;
    tentativas: number;
  };
  const topicosBaixos = useMemo<TopicoBaixo[]>(() => {
    const byTopico = new Map<string, SessionRow[]>();
    mySessions.forEach((s) => {
      const arr = byTopico.get(s.topico_id) ?? [];
      arr.push(s);
      byTopico.set(s.topico_id, arr);
    });
    const out: TopicoBaixo[] = [];
    for (const m of materias) {
      for (const t of m.topicos) {
        const arr = byTopico.get(t.id);
        if (!arr || arr.length === 0) continue;
        const media = Math.round(
          arr.reduce((acc, s) => acc + s.percentual_acerto, 0) / arr.length,
        );
        if (media >= 60) continue;
        if (aguardandoRevisao.has(t.id)) continue; // já tem revisão pendente
        out.push({
          topicoId: t.id,
          titulo: t.titulo,
          materiaId: m.id,
          materiaNome: m.nome,
          materiaCor: m.cor,
          media,
          tentativas: arr.length,
        });
      }
    }
    return out.sort((a, b) => a.media - b.media);
  }, [mySessions, materias, aguardandoRevisao]);

  // Histórico de revisões: agrupar sessões por tópico, pegando pior e melhor %
  const historicoRevisoes = useMemo(() => {
    const byTopico = new Map<string, SessionRow[]>();
    mySessions.forEach((s) => {
      const arr = byTopico.get(s.topico_id) ?? [];
      arr.push(s);
      byTopico.set(s.topico_id, arr);
    });
    const result: {
      topicoId: string;
      titulo: string;
      materia: string;
      materiaId: string;
      materiaCor: string;
      cor: string;
      tentativas: number;
      pior: number;
      melhor: number;
      ultima: number;
      superado: boolean;
      aguardando: boolean;
    }[] = [];
    for (const m of materias) {
      for (const t of m.topicos) {
        const arr = byTopico.get(t.id);
        if (!arr || arr.length < 2) continue; // só mostra com 2+ tentativas
        const sorted = [...arr].sort((a, b) => a.data.localeCompare(b.data));
        const percs = arr.map((s) => s.percentual_acerto);
        const melhor = Math.max(...percs);
        result.push({
          topicoId: t.id,
          titulo: t.titulo,
          materia: m.nome,
          materiaId: m.id,
          materiaCor: m.cor,
          cor: m.cor,
          tentativas: arr.length,
          pior: Math.min(...percs),
          melhor,
          ultima: sorted[sorted.length - 1].percentual_acerto,
          superado: melhor >= 60,
          aguardando: aguardandoRevisao.has(t.id),
        });
      }
    }
    return result.sort((a, b) => a.pior - b.pior);
  }, [mySessions, materias, aguardandoRevisao]);

  async function criarRevisaoTopico(
    topicoId: string,
    materiaId: string,
    titulo: string,
    materiaNome: string,
    cor: string,
  ) {
    if (!userId) return;
    setCreatingRevisao(topicoId);
    const data = nextWeekday(new Date());
    const { error } = await supabase.from("user_calendar_events").insert({
      user_id: userId,
      cronograma_id: cronogramaId,
      materia_id: materiaId,
      topico_id: topicoId,
      titulo: `Revisão: ${titulo}`,
      data,
      is_revisao: true,
      cor: colorForMateria(materiaNome, cor),
      concluido: false,
    });
    setCreatingRevisao(null);
    if (error) {
      toast.error("Erro ao criar revisão");
      return;
    }
    toast.success(`Revisão agendada para ${new Date(data + "T00:00").toLocaleDateString("pt-BR")}`);
    onChange?.();
  }

  if (materias.length === 0) {
    return (
      <div className="lei-card text-center py-12 text-text-muted text-[13px]">
        Sem matérias para medir desempenho.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Cards top */}
      <div className="grid grid-cols-3 gap-3">
        <div className="lei-card">
          <div className="text-[11px] uppercase tracking-wider text-text-muted">Conclusão geral</div>
          <div className="font-serif text-[28px] text-text-main">{stats.pctGeral}%</div>
          <Progress value={stats.pctGeral} className="mt-2 h-1.5" />
        </div>
        <div className="lei-card">
          <div className="text-[11px] uppercase tracking-wider text-text-muted">Tópicos</div>
          <div className="font-serif text-[28px] text-text-main">
            {stats.concluidos}
            <span className="text-text-muted text-[16px]">/{stats.totalTopicos}</span>
          </div>
        </div>
        <div className="lei-card">
          <div className="text-[11px] uppercase tracking-wider text-text-muted">Sessões registradas</div>
          <div className="font-serif text-[28px] text-text-main">{mySessions.length}</div>
        </div>
      </div>

      {/* Painel: Tópicos abaixo de 60% (filtra os que já têm revisão pendente) */}
      {loading ? (
        <div className="lei-card text-center py-8 text-text-muted text-[13px]">Carregando...</div>
      ) : topicosBaixos.length > 0 ? (
        <div
          className="lei-card"
          style={{ borderLeft: "3px solid #D85A30", background: "rgba(216,90,48,0.04)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown size={16} style={{ color: "#D85A30" }} />
            <h3 className="font-serif text-[16px] text-text-main">Tópicos abaixo de 60%</h3>
          </div>
          <p className="text-[12px] text-text-muted mb-3">
            Estes tópicos precisam de revisão. Agende uma sessão para retomar o conteúdo.
          </p>
          <div className="flex flex-col gap-2">
            {topicosBaixos.map((t) => (
              <div
                key={t.topicoId}
                className="flex items-center justify-between gap-3 p-3 rounded-[10px] bg-card border border-border"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: colorForMateria(t.materiaNome, t.materiaCor) }}
                  />
                  <div className="min-w-0">
                    <div className="text-[13px] text-text-main truncate">{t.titulo}</div>
                    <div className="text-[11px] text-text-muted truncate">{t.materiaNome}</div>
                  </div>
                  <span
                    className="text-[11px] font-medium px-2 py-[2px] rounded-full"
                    style={{ background: "rgba(216,90,48,0.12)", color: "#D85A30" }}
                  >
                    {t.media}%
                  </span>
                  <span className="text-[11px] text-text-muted">
                    {t.tentativas} {t.tentativas === 1 ? "tentativa" : "tentativas"}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    criarRevisaoTopico(
                      t.topicoId,
                      t.materiaId,
                      t.titulo,
                      t.materiaNome,
                      t.materiaCor,
                    )
                  }
                  disabled={creatingRevisao === t.topicoId}
                  className="gap-1 text-[12px] h-8"
                >
                  <RefreshCw size={12} />
                  {creatingRevisao === t.topicoId ? "Agendando..." : "+ Revisão"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Comparação por matéria: meu vs média (grid de mini-cards) */}
      <div className="lei-card">
        <h3 className="font-serif text-[16px] text-text-main mb-1">Meu desempenho vs média</h3>
        <p className="text-[12px] text-text-muted mb-4">
          Última pontuação por matéria, comparada à média dos demais alunos. Matérias com pior rendimento recente aparecem primeiro.
        </p>
        <div
          className="grid gap-[10px]"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}
        >
          {stats.porMateria.map((m) => {
            const mine = m.myLast ?? 0;
            const others = m.allAvg ?? 0;
            const myColor =
              m.myLast === null
                ? "#d1d5db"
                : mine < 50
                  ? "#E24B4A"
                  : mine < 60
                    ? "#EF9F27"
                    : mine < 80
                      ? "#1D9E75"
                      : "#16A085";
            const diff = m.myLast !== null && m.allAvg !== null ? mine - others : null;
            return (
              <div
                key={m.id}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    background: "#f3f4f6",
                    color: "#374151",
                    borderRadius: 20,
                    padding: "2px 8px",
                    fontSize: 10,
                    fontWeight: 500,
                  }}
                >
                  {m.sessions} {m.sessions === 1 ? "sessão" : "sessões"}
                </span>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#111827",
                    marginTop: 6,
                    marginBottom: 8,
                  }}
                  className="truncate"
                  title={m.nome}
                >
                  {m.nome}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontStyle: "italic",
                    color: "#6b7280",
                    marginBottom: 8,
                    minHeight: 14,
                  }}
                  className="truncate"
                  title={m.ultimoAssunto ?? ""}
                >
                  {m.ultimoAssunto ?? "—"}
                </div>

                <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 2 }}>
                  Meu desempenho
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 999,
                    background: "#f3f4f6",
                    overflow: "hidden",
                    marginBottom: 2,
                  }}
                >
                  <div
                    style={{
                      width: `${mine}%`,
                      height: "100%",
                      background: myColor,
                      transition: "width .2s",
                    }}
                  />
                </div>
                <div style={{ fontSize: 10, color: "#374151", textAlign: "right", marginBottom: 8 }}>
                  {m.myLast !== null ? `${mine}%` : "—"}
                </div>

                <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 2 }}>
                  Média dos alunos
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 999,
                    background: "#f3f4f6",
                    overflow: "hidden",
                    marginBottom: 2,
                  }}
                >
                  <div
                    style={{
                      width: `${others}%`,
                      height: "100%",
                      background: "#d1d5db",
                      transition: "width .2s",
                    }}
                  />
                </div>
                <div style={{ fontSize: 10, color: "#6b7280", textAlign: "right" }}>
                  {m.allAvg !== null ? `${others}%` : "—"}
                </div>

                {diff !== null && (
                  <div
                    style={{
                      fontSize: 10,
                      marginTop: 6,
                      color: diff >= 0 ? "#1D9E75" : "#E24B4A",
                      fontWeight: 500,
                    }}
                  >
                    {diff >= 0 ? "+" : ""}
                    {diff} pts vs média
                  </div>
                )}

                {/* Botão de revisão movido para o painel "Tópicos abaixo de 60%" (granularidade por tópico) */}
              </div>
            );
          })}
        </div>
      </div>

      {/* Histórico de Revisões */}
      <div className="lei-card">
        <div className="flex items-center gap-2 mb-3">
          <History size={16} className="text-text-muted" />
          <h3 className="font-serif text-[16px] text-text-main">Histórico de revisões</h3>
        </div>
        {historicoRevisoes.length === 0 ? (
          <p className="text-[12px] text-text-muted py-4 text-center">
            Tópicos com 2 ou mais tentativas aparecerão aqui com pior e melhor desempenho.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-text-muted text-left">
                  <th className="font-normal pb-2 pr-3">Tópico</th>
                  <th className="font-normal pb-2 px-3">Tentativas</th>
                  <th className="font-normal pb-2 px-3">Pior</th>
                  <th className="font-normal pb-2 px-3">Melhor</th>
                  <th className="font-normal pb-2 px-3">Última</th>
                  <th className="font-normal pb-2 pl-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {historicoRevisoes
                  .filter((h) => !h.aguardando) /* esconde temporariamente enquanto há revisão pendente */
                  .map((h) => (
                    <tr key={h.topicoId} className="border-t border-border">
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: colorForMateria(h.materia, h.cor) }}
                          />
                          <div className="min-w-0">
                            <div className="text-text-main truncate">{h.titulo}</div>
                            <div className="text-[11px] text-text-muted truncate">{h.materia}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3 tabular-nums text-text-main">{h.tentativas}</td>
                      <td className="py-2 px-3">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full font-medium"
                          style={{ background: "rgba(216,90,48,0.12)", color: "#D85A30" }}
                        >
                          <TrendingDown size={10} /> {h.pior}%
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full font-medium"
                          style={{ background: "rgba(29,158,117,0.12)", color: "#1D9E75" }}
                        >
                          <TrendingUp size={10} /> {h.melhor}%
                        </span>
                      </td>
                      <td className="py-2 px-3 tabular-nums text-text-main">{h.ultima}%</td>
                      <td className="py-2 pl-3">
                        {h.superado ? (
                          <span
                            className="inline-block text-[11px] font-medium px-2 py-[2px] rounded-full"
                            style={{ background: "rgba(29,158,117,0.12)", color: "#1D9E75" }}
                          >
                            🎉 Superado
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              criarRevisaoTopico(
                                h.topicoId,
                                h.materiaId,
                                h.titulo,
                                h.materia,
                                h.materiaCor,
                              )
                            }
                            disabled={creatingRevisao === h.topicoId}
                            className="gap-1 text-[11px] h-7"
                          >
                            <RefreshCw size={11} />
                            {creatingRevisao === h.topicoId ? "Agendando..." : "Revisar novamente"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
