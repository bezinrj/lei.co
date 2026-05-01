import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  calcularNivel,
  getNivelInfo,
  XP_CONFIG,
  concederXP,
  concederBadge,
} from "@/lib/xp";
import {
  ArrowLeft,
  Trophy,
  Target,
  Activity,
  Plus,
  Check,
  Flame,
  Crown,
  LogOut,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { GrupoSettingsDialog } from "@/components/grupos/GrupoSettingsDialog";

export const Route = createFileRoute("/grupos/$id")({
  head: () => ({ meta: [{ title: "Grupo — Lei.co" }] }),
  component: GrupoDetailPage,
});

// =====================================================
// METAS PADRÃO (sistema)
// =====================================================
type MetaPadrao = {
  key: string;
  emoji: string;
  titulo: string;
  alvo: number;
  unidade: string;
  periodo: "semana" | "mes";
  xp: number;
  tipo: "horas" | "questoes" | "topicos" | "streak";
};

const METAS_PADRAO: MetaPadrao[] = [
  {
    key: "horas_mes",
    emoji: "🕐",
    titulo: "200 horas coletivas no mês",
    alvo: 200,
    unidade: "h",
    periodo: "mes",
    xp: XP_CONFIG.XP_META_COLETIVA,
    tipo: "horas",
  },
  {
    key: "questoes_semana",
    emoji: "✏️",
    titulo: "1.000 questões coletivas na semana",
    alvo: 1000,
    unidade: "q",
    periodo: "semana",
    xp: XP_CONFIG.XP_META_COLETIVA,
    tipo: "questoes",
  },
  {
    key: "streak_grupo",
    emoji: "🔥",
    titulo: "Todos com streak de 7 dias",
    alvo: 7,
    unidade: "dias",
    periodo: "semana",
    xp: XP_CONFIG.XP_META_COLETIVA,
    tipo: "streak",
  },
  {
    key: "topicos_semana",
    emoji: "📚",
    titulo: "50 tópicos concluídos na semana",
    alvo: 50,
    unidade: "tópicos",
    periodo: "semana",
    xp: XP_CONFIG.XP_META_COLETIVA,
    tipo: "topicos",
  },
];

// =====================================================
// HELPERS DE DATA
// =====================================================
function inicioSemanaISO(): string {
  const d = new Date();
  const dia = d.getDay(); // 0=dom
  const diff = (dia === 0 ? -6 : 1) - dia; // segunda
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function inicioMesISO(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function diffDias(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86400000);
}
function tempoParaHoras(t: string | null): number {
  if (!t) return 0;
  const m = /^(\d+):(\d+)(?::(\d+))?$/.exec(t.trim());
  if (!m) return 0;
  return Number(m[1]) + Number(m[2]) / 60 + Number(m[3] ?? 0) / 3600;
}
function formatarTempo(iso: string): string {
  const d = new Date(iso);
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const dias = Math.floor(h / 24);
  if (dias < 7) return `${dias}d atrás`;
  return d.toLocaleDateString("pt-BR");
}

// =====================================================
// TIPOS
// =====================================================
type GrupoInfo = {
  id: string;
  nome: string;
  descricao: string | null;
  foto_url: string | null;
  codigo_convite: string;
  criado_por: string;
  max_membros: number;
};

type Membro = {
  user_id: string;
  role: string;
  nome: string;
  xp_total: number;
  nivel: number;
  horas_semana: number;
  questoes_semana: number;
  privacidade_horas: boolean;
  privacidade_questoes: boolean;
  privacidade_acerto: boolean;
  streak_dias: number;
};

type Atividade = {
  id: string;
  user_id: string;
  nome: string;
  tipo: string;
  descricao: string | null;
  created_at: string;
};

type Desafio = {
  id: string;
  titulo: string;
  descricao: string | null;
  prazo: string;
  ativo: boolean;
  criado_por: string;
  xp_recompensa: number;
  concluido_por_mim: boolean;
  total_concluidos: number;
};

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================
function GrupoDetailPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [grupo, setGrupo] = useState<GrupoInfo | null>(null);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [desafios, setDesafios] = useState<Desafio[]>([]);
  const [agregados, setAgregados] = useState({
    horas_mes: 0,
    questoes_semana: 0,
    topicos_semana: 0,
    streak_grupo: 0,
  });
  const [loading, setLoading] = useState(true);
  const [openDesafio, setOpenDesafio] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);

  const isFundador = !!grupo && !!user && grupo.criado_por === user.id;

  async function carregar() {
    if (!user) return;
    setLoading(true);

    // 1. Grupo
    const { data: g } = await supabase
      .from("grupos")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!g) {
      toast.error("Grupo não encontrado");
      navigate({ to: "/grupos" });
      return;
    }
    setGrupo(g as GrupoInfo);

    // 2. Membros
    const { data: ms } = await supabase
      .from("grupo_membros")
      .select("user_id, role, privacidade_horas, privacidade_questoes, privacidade_acerto")
      .eq("grupo_id", id);
    const memberIds = (ms ?? []).map((m) => m.user_id);

    // 3. Profiles + XP
    const [{ data: profs }, { data: xps }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase
        .from("user_xp")
        .select("user_id, xp_total, nivel")
        .in("user_id", memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);

    // 4. Sessões da semana e do mês para agregados + horas/questões por membro
    const semanaIni = inicioSemanaISO();
    const mesIni = inicioMesISO();
    const { data: sessoesMes } = await supabase
      .from("user_sessions")
      .select("user_id, tempo_estudado, questoes, data, topico_id, created_at")
      .in("user_id", memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"])
      .gte("created_at", mesIni);

    // streak por membro: dias consecutivos terminando hoje (ou ontem) com sessão
    const sessoesPorUser = new Map<string, Set<string>>();
    let horas_mes_total = 0;
    let questoes_semana_total = 0;
    (sessoesMes ?? []).forEach((s) => {
      horas_mes_total += tempoParaHoras(s.tempo_estudado as string | null);
      if (s.created_at >= semanaIni)
        questoes_semana_total += Number(s.questoes ?? 0);
      const set = sessoesPorUser.get(s.user_id) ?? new Set<string>();
      set.add(s.data as string);
      sessoesPorUser.set(s.user_id, set);
    });

    function calcStreak(set: Set<string>): number {
      if (set.size === 0) return 0;
      let streak = 0;
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      // tolerância: começa contando a partir de hoje; se hoje não tem, começa de ontem
      let cursor = new Date(hoje);
      const isoHoje = hoje.toISOString().split("T")[0];
      if (!set.has(isoHoje)) cursor.setDate(cursor.getDate() - 1);
      while (set.has(cursor.toISOString().split("T")[0])) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      }
      return streak;
    }

    // 5. Tópicos concluídos na semana (agregado)
    const { count: topicosCount } = await supabase
      .from("user_topico_progresso")
      .select("*", { count: "exact", head: true })
      .in("user_id", memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"])
      .eq("concluido", true)
      .gte("concluido_em", semanaIni);

    // 6. Montar membros
    const membrosFinal: Membro[] = (ms ?? []).map((m) => {
      const prof = (profs ?? []).find((p) => p.id === m.user_id);
      const xp = (xps ?? []).find((x) => x.user_id === m.user_id);
      const xpTotal = Number(xp?.xp_total ?? 0);
      const sessoesUser = (sessoesMes ?? []).filter(
        (s) => s.user_id === m.user_id && s.created_at >= semanaIni,
      );
      const horasSem = sessoesUser.reduce(
        (a, s) => a + tempoParaHoras(s.tempo_estudado as string | null),
        0,
      );
      const questoesSem = sessoesUser.reduce(
        (a, s) => a + Number(s.questoes ?? 0),
        0,
      );
      return {
        user_id: m.user_id,
        role: m.role,
        nome: prof?.display_name ?? "Aluno",
        xp_total: xpTotal,
        nivel: calcularNivel(xpTotal),
        horas_semana: Math.round(horasSem * 10) / 10,
        questoes_semana: questoesSem,
        privacidade_horas: m.privacidade_horas ?? true,
        privacidade_questoes: m.privacidade_questoes ?? true,
        privacidade_acerto: m.privacidade_acerto ?? true,
        streak_dias: calcStreak(sessoesPorUser.get(m.user_id) ?? new Set()),
      };
    });
    membrosFinal.sort((a, b) => b.xp_total - a.xp_total);
    setMembros(membrosFinal);

    const streakGrupo =
      membrosFinal.length > 0
        ? Math.min(...membrosFinal.map((m) => m.streak_dias))
        : 0;

    setAgregados({
      horas_mes: Math.round(horas_mes_total * 10) / 10,
      questoes_semana: questoes_semana_total,
      topicos_semana: topicosCount ?? 0,
      streak_grupo: streakGrupo,
    });

    // 7. Atividades
    const { data: ats } = await supabase
      .from("grupo_atividades")
      .select("id, user_id, tipo, descricao, created_at")
      .eq("grupo_id", id)
      .order("created_at", { ascending: false })
      .limit(50);

    const atividadesFinal: Atividade[] = (ats ?? []).map((a) => {
      const prof = (profs ?? []).find((p) => p.id === a.user_id);
      return {
        id: a.id,
        user_id: a.user_id,
        nome: prof?.display_name ?? "Alguém",
        tipo: a.tipo,
        descricao: a.descricao,
        created_at: a.created_at,
      };
    });
    setAtividades(atividadesFinal);

    // 8. Desafios ativos
    const { data: desRows } = await supabase
      .from("grupo_desafios")
      .select("*")
      .eq("grupo_id", id)
      .eq("ativo", true)
      .order("created_at", { ascending: false });

    const desafioIds = (desRows ?? []).map((d) => d.id);
    const { data: concl } = desafioIds.length
      ? await supabase
          .from("grupo_desafios_membros")
          .select("desafio_id, user_id")
          .in("desafio_id", desafioIds)
      : { data: [] as { desafio_id: string; user_id: string }[] };

    setDesafios(
      (desRows ?? []).map((d) => ({
        id: d.id,
        titulo: d.titulo,
        descricao: d.descricao,
        prazo: d.prazo,
        ativo: d.ativo,
        criado_por: d.criado_por,
        xp_recompensa: d.xp_recompensa,
        concluido_por_mim: (concl ?? []).some(
          (c) => c.desafio_id === d.id && c.user_id === user.id,
        ),
        total_concluidos: (concl ?? []).filter((c) => c.desafio_id === d.id).length,
      })),
    );

    setLoading(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  // Concessão automática de badges de grupo conforme metas
  useEffect(() => {
    if (!user || !grupo || loading) return;
    (async () => {
      // Meta Batida: qualquer meta padrão concluída
      const algumaConcluida = METAS_PADRAO.some((meta) => {
        let atual = 0;
        if (meta.tipo === "horas") atual = agregados.horas_mes;
        if (meta.tipo === "questoes") atual = agregados.questoes_semana;
        if (meta.tipo === "topicos") atual = agregados.topicos_semana;
        if (meta.tipo === "streak") atual = agregados.streak_grupo;
        return atual >= meta.alvo;
      });
      if (algumaConcluida) await concederBadge(user.id, "meta_batida");

      // Chama Coletiva: streak do grupo ≥ 7
      if (agregados.streak_grupo >= 7) {
        await concederBadge(user.id, "chama_coletiva");
      }
      // Grupo de Elite: streak do grupo ≥ 30
      if (agregados.streak_grupo >= 30) {
        await concederBadge(user.id, "grupo_elite");
      }

      // Companheiro: 30 dias como membro de algum grupo
      const { data: meusMembros } = await supabase
        .from("grupo_membros")
        .select("joined_at")
        .eq("user_id", user.id);
      const trintaDiasMs = 30 * 24 * 60 * 60 * 1000;
      const agora = Date.now();
      const tem30dias = (meusMembros ?? []).some(
        (m) => agora - new Date(m.joined_at).getTime() >= trintaDiasMs,
      );
      if (tem30dias) await concederBadge(user.id, "companheiro");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agregados, user?.id, grupo?.id, loading]);


  async function sairDoGrupo() {
    if (!user || !grupo) return;
    if (!confirm(`Sair do grupo "${grupo.nome}"?`)) return;
    const { error } = await supabase
      .from("grupo_membros")
      .delete()
      .eq("grupo_id", grupo.id)
      .eq("user_id", user.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Você saiu do grupo");
    navigate({ to: "/grupos" });
  }

  if (loading || !grupo) {
    return (
      <AppShell title="Grupo">
        <div className="lei-card text-center py-12 text-text-muted text-[13px]">
          Carregando...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={grupo.nome}>
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 mb-4">
        <Link
          to="/grupos"
          className="text-text-muted hover:text-text-main transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h2 className="font-serif text-[20px] text-text-main">{grupo.nome}</h2>
          <p className="text-text-muted text-[12px]">
            {membros.length}/{grupo.max_membros} membros · código{" "}
            <span className="font-mono">{grupo.codigo_convite}</span>
          </p>
        </div>
        {isFundador ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpenSettings(true)}
            className="rounded-[10px]"
          >
            <Settings size={14} className="mr-1.5" />
            Configurações
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={sairDoGrupo}
            className="rounded-[10px]"
          >
            <LogOut size={14} className="mr-1.5" />
            Sair
          </Button>
        )}
      </div>

      <Tabs defaultValue="ranking" className="w-full">
        <TabsList className="bg-muted rounded-[12px] p-1">
          <TabsTrigger value="ranking" className="rounded-[10px]">
            <Trophy size={14} className="mr-1.5" />
            Ranking
          </TabsTrigger>
          <TabsTrigger value="metas" className="rounded-[10px]">
            <Target size={14} className="mr-1.5" />
            Metas
          </TabsTrigger>
          <TabsTrigger value="feed" className="rounded-[10px]">
            <Activity size={14} className="mr-1.5" />
            Feed
          </TabsTrigger>
        </TabsList>

        {/* ============ RANKING ============ */}
        <TabsContent value="ranking" className="mt-4">
          <div
            style={{
              background: "#FAEEDA",
              borderRadius: "12px",
              padding: "12px 16px",
              marginBottom: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "11px",
                  color: "#8A8478",
                  marginBottom: "2px",
                }}
              >
                Streak do grupo
              </div>
              <div
                className="font-serif"
                style={{ fontSize: "22px", fontWeight: 500 }}
              >
                <Flame
                  size={18}
                  className="inline mb-1 mr-1"
                  color="#E24B4A"
                />
                {agregados.streak_grupo} dias
              </div>
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "#6b7280",
                textAlign: "right",
              }}
            >
              Todos estudaram
              <br />
              por {agregados.streak_grupo} dia{agregados.streak_grupo === 1 ? "" : "s"} seguido{agregados.streak_grupo === 1 ? "" : "s"}
            </div>
          </div>

          <div>
            {membros.map((m, i) => {
              const niv = getNivelInfo(m.nivel);
              const isMe = m.user_id === user?.id;
              const isFund = m.user_id === grupo.criado_por;
              return (
                <div
                  key={m.user_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px",
                    borderRadius: "10px",
                    background: isMe ? "#E8F0E5" : "#fff",
                    border: "1px solid rgba(61,56,48,0.08)",
                    marginBottom: "8px",
                  }}
                >
                  <div
                    className="font-serif"
                    style={{
                      fontSize: "20px",
                      color:
                        i === 0
                          ? "#C9A84C"
                          : i === 1
                            ? "#888"
                            : i === 2
                              ? "#CD7F32"
                              : "#8A8478",
                      minWidth: "28px",
                      textAlign: "center",
                    }}
                  >
                    {i + 1}
                  </div>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "#E8F0E5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                      fontWeight: 500,
                      flexShrink: 0,
                    }}
                  >
                    {m.nome[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 500,
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span className="truncate">{m.nome}</span>
                      {isFund && (
                        <Crown size={12} color="#C9A84C" aria-label="Fundador" />
                      )}
                      {isMe && (
                        <span style={{ fontSize: "10px", color: "#6b7280" }}>
                          ← você
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "11px", color: "#8A8478" }}>
                      {niv.nome}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#1D9E75",
                      }}
                    >
                      {m.xp_total.toLocaleString("pt-BR")} XP
                    </div>
                    {m.privacidade_horas && (
                      <div style={{ fontSize: "10px", color: "#6b7280" }}>
                        ⏱ {m.horas_semana}h esta semana
                      </div>
                    )}
                    {m.privacidade_questoes && m.questoes_semana > 0 && (
                      <div style={{ fontSize: "10px", color: "#6b7280" }}>
                        ✏️ {m.questoes_semana} questões
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ============ METAS ============ */}
        <TabsContent value="metas" className="mt-4">
          <h3 className="font-serif text-[15px] text-text-main mb-3">
            Metas coletivas
          </h3>
          <div className="flex flex-col gap-3 mb-6">
            {METAS_PADRAO.map((meta) => {
              let atual = 0;
              if (meta.tipo === "horas") atual = agregados.horas_mes;
              if (meta.tipo === "questoes") atual = agregados.questoes_semana;
              if (meta.tipo === "topicos") atual = agregados.topicos_semana;
              if (meta.tipo === "streak") atual = agregados.streak_grupo;
              const pct = Math.min(100, (atual / meta.alvo) * 100);
              const concluida = atual >= meta.alvo;
              return (
                <div key={meta.key} className="lei-card p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <div className="text-[13px] font-medium text-text-main">
                        {meta.emoji} {meta.titulo}
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5">
                        {meta.periodo === "semana" ? "Esta semana" : "Este mês"}
                      </div>
                    </div>
                    <div
                      className="text-[11px] font-medium px-2 py-1 rounded-[6px]"
                      style={{
                        background: concluida ? "#E8F0E5" : "#FAEEDA",
                        color: concluida ? "#1D9E75" : "#8A6E3A",
                      }}
                    >
                      +{meta.xp} XP
                    </div>
                  </div>
                  <div
                    style={{
                      height: "8px",
                      background: "#F2EFEA",
                      borderRadius: "4px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: concluida ? "#1D9E75" : "#A6B89A",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5 text-[11px] text-text-muted">
                    <span>
                      {Math.round(atual)} / {meta.alvo} {meta.unidade}
                    </span>
                    <span>{Math.round(pct)}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desafio do líder */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-serif text-[15px] text-text-main">
              Desafio do líder
            </h3>
            {isFundador && desafios.filter((d) => d.ativo).length === 0 && (
              <Button
                size="sm"
                onClick={() => setOpenDesafio(true)}
                className="bg-sage-dark hover:bg-sage-dark/90 text-white rounded-[10px]"
              >
                <Plus size={14} className="mr-1.5" />
                Criar
              </Button>
            )}
          </div>

          {desafios.length === 0 ? (
            <div className="lei-card text-center py-6 text-text-muted text-[12px]">
              Nenhum desafio ativo no momento.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {desafios.map((d) => (
                <DesafioCard
                  key={d.id}
                  desafio={d}
                  isFundador={user?.id === d.criado_por}
                  userId={user?.id ?? ""}
                  grupoId={grupo.id}
                  onChange={carregar}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ============ FEED ============ */}
        <TabsContent value="feed" className="mt-4">
          {atividades.length === 0 ? (
            <div className="lei-card text-center py-12 text-text-muted text-[13px]">
              Sem atividades por enquanto. Estudem e voltem aqui.
            </div>
          ) : (
            <div className="lei-card p-4">
              {atividades.map((a) => (
                <div
                  key={a.id}
                  style={{
                    display: "flex",
                    gap: "10px",
                    padding: "10px 0",
                    borderBottom: "1px solid rgba(61,56,48,0.06)",
                  }}
                >
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: "#E8F0E5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      flexShrink: 0,
                    }}
                  >
                    {a.nome[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: "12px", fontWeight: 500 }}>
                      {a.nome}
                    </span>
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>
                      {" "}
                      {a.descricao ?? a.tipo}
                    </span>
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#9ca3af",
                        marginTop: "2px",
                      }}
                    >
                      {formatarTempo(a.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CriarDesafioDialog
        open={openDesafio}
        onOpenChange={setOpenDesafio}
        grupoId={grupo.id}
        userId={user?.id ?? ""}
        onCreated={carregar}
      />

      {isFundador && (
        <GrupoSettingsDialog
          open={openSettings}
          onOpenChange={setOpenSettings}
          grupo={grupo}
          agregados={agregados}
          onChange={carregar}
        />
      )}
    </AppShell>
  );
}

// =====================================================
// CARD DE DESAFIO
// =====================================================
function DesafioCard({
  desafio,
  isFundador,
  userId,
  grupoId,
  onChange,
}: {
  desafio: Desafio;
  isFundador: boolean;
  userId: string;
  grupoId: string;
  onChange: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const podeMarcar = !isFundador && !desafio.concluido_por_mim;

  async function marcarConcluido() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("grupo_desafios_membros")
        .insert({ desafio_id: desafio.id, user_id: userId });
      if (error) throw error;

      // Conceder XP fixo (10)
      await concederXP(userId, "desafio_lider", {
        valor_custom: desafio.xp_recompensa,
      });

      // Registrar atividade
      await supabase.from("grupo_atividades").insert({
        grupo_id: grupoId,
        user_id: userId,
        tipo: "desafio_concluido",
        descricao: `concluiu o desafio "${desafio.titulo}"`,
      });

      toast.success(`+${XP_CONFIG.XP_DESAFIO_LIDER} XP! Desafio concluído.`);
      onChange();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const prazoData = new Date(desafio.prazo);
  const expirado = prazoData.getTime() < Date.now();
  const dias = diffDias(prazoData, new Date());

  return (
    <div className="lei-card p-4">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div className="flex-1">
          <div className="text-[13px] font-medium text-text-main">
            {desafio.titulo}
          </div>
          {desafio.descricao && (
            <div className="text-[11px] text-text-muted mt-0.5 whitespace-pre-line">
              {desafio.descricao}
            </div>
          )}
        </div>
        <div
          className="text-[11px] font-medium px-2 py-1 rounded-[6px] shrink-0"
          style={{ background: "#E8F0E5", color: "#1D9E75" }}
        >
          +{desafio.xp_recompensa} XP
        </div>
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="text-[11px] text-text-muted">
          {expirado
            ? "Expirado"
            : dias === 0
              ? "Termina hoje"
              : `Faltam ${dias} dia${dias === 1 ? "" : "s"}`}{" "}
          · {desafio.total_concluidos} concluído
          {desafio.total_concluidos === 1 ? "" : "s"}
        </div>
        {isFundador ? (
          <span className="text-[11px] text-text-muted italic">
            Você criou este desafio
          </span>
        ) : desafio.concluido_por_mim ? (
          <span
            className="text-[11px] font-medium flex items-center gap-1"
            style={{ color: "#1D9E75" }}
          >
            <Check size={12} /> Concluído
          </span>
        ) : (
          <Button
            size="sm"
            disabled={saving || !podeMarcar || expirado}
            onClick={marcarConcluido}
            className="bg-sage-dark hover:bg-sage-dark/90 text-white rounded-[10px] h-7 text-[11px]"
          >
            {saving ? "..." : "Marcar concluído"}
          </Button>
        )}
      </div>
    </div>
  );
}

// =====================================================
// DIALOG CRIAR DESAFIO
// =====================================================
function CriarDesafioDialog({
  open,
  onOpenChange,
  grupoId,
  userId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  grupoId: string;
  userId: string;
  onCreated: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prazo, setPrazo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("grupo_desafios").insert({
        grupo_id: grupoId,
        criado_por: userId,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        prazo: new Date(prazo + "T23:59:59").toISOString(),
        xp_recompensa: XP_CONFIG.XP_DESAFIO_LIDER,
        ativo: true,
      });
      if (error) throw error;

      await supabase.from("grupo_atividades").insert({
        grupo_id: grupoId,
        user_id: userId,
        tipo: "desafio_criado",
        descricao: `criou o desafio "${titulo.trim()}"`,
      });

      toast.success("Desafio criado!");
      setTitulo("");
      setDescricao("");
      onOpenChange(false);
      onCreated();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao criar desafio";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card sm:max-w-[440px] rounded-[14px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-[18px] text-text-main">
            Criar desafio do líder
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div>
            <Label className="text-[12px] text-text-muted">
              Título <span className="text-destructive">*</span>
            </Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Resolver 50 questões de Direito Civil"
              required
              maxLength={80}
              className="mt-1 bg-background"
            />
          </div>
          <div>
            <Label className="text-[12px] text-text-muted">Descrição</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes do desafio (opcional)"
              maxLength={300}
              rows={3}
              className="mt-1 bg-background"
            />
          </div>
          <div>
            <Label className="text-[12px] text-text-muted">Prazo</Label>
            <Input
              type="date"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              required
              min={new Date().toISOString().split("T")[0]}
              className="mt-1 bg-background"
            />
          </div>
          <div
            className="text-[11px] p-2.5 rounded-[8px]"
            style={{ background: "#FAEEDA", color: "#8A6E3A" }}
          >
            Recompensa fixa: +{XP_CONFIG.XP_DESAFIO_LIDER} XP por membro que
            concluir.
          </div>
          <Button
            type="submit"
            disabled={saving || !titulo.trim()}
            className="w-full bg-sage-dark hover:bg-sage-dark/90 text-white rounded-[10px]"
          >
            {saving ? "Criando..." : "Criar desafio"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
