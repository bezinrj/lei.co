import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Settings, Loader2, BookMarked, LayoutDashboard } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { WeeklyPerformance } from "@/components/dashboard/WeeklyPerformance";
import { TodaySchedule } from "@/components/dashboard/TodaySchedule";
import { SubjectPerformance } from "@/components/dashboard/SubjectPerformance";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { MatrizTab, type MatrizTopico } from "@/components/cronogramas/MatrizTab";
import { CalendarioTab } from "@/components/cronogramas/CalendarioTab";
import { DesempenhoTab } from "@/components/cronogramas/DesempenhoTab";
import { UserProfileSheet } from "@/components/admin/UserProfileSheet";
import type { Fonte } from "@/components/cronogramas/NovoTopicoForm";

export const Route = createFileRoute("/admin/aluno/$id")({
  head: () => ({ meta: [{ title: "Aluno — Painel Admin — Lei.co" }] }),
  component: AdminAlunoPage,
});

type Profile = {
  id: string;
  display_name: string | null;
  friend_id: string | null;
  avatar_url: string | null;
  plano_atual: string;
  bloqueado: boolean;
};

function formatarHoras(h: number): string {
  const horas = Math.floor(h);
  const minutos = Math.round((h - horas) * 60);
  if (minutos === 0) return `${horas}h`;
  if (minutos === 60) return `${horas + 1}h`;
  return `${horas}h ${minutos}min`;
}

function AdminAlunoPage() {
  const { id: studentId } = Route.useParams();
  const { roles, loading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  const isStaff = roles.includes("admin") || roles.includes("moderador");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    // Espera roles carregarem antes de decidir; evita redirect indevido
    if (roles.length === 0) return;
    if (!isStaff) {
      navigate({ to: "/perfil" });
    }
  }, [authLoading, isStaff, user, navigate, roles.length]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, friend_id, avatar_url, plano_atual, bloqueado")
        .eq("id", studentId)
        .maybeSingle();
      if (!mounted) return;
      setProfile(data as Profile | null);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [studentId]);

  if (loading || !isStaff) {
    return (
      <AppShell title="Aluno">
        <div className="flex items-center justify-center py-20 text-text-muted">
          <Loader2 className="animate-spin mr-2" size={18} /> Carregando…
        </div>
      </AppShell>
    );
  }

  if (!profile) {
    return (
      <AppShell title="Aluno">
        <div className="lei-card text-center py-16">
          <div className="font-serif text-[18px]">Aluno não encontrado</div>
          <Link to="/admin" className="text-[13px] text-sage-dark underline mt-3 inline-block">
            Voltar ao painel
          </Link>
        </div>
      </AppShell>
    );
  }

  const initials = (profile.display_name || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <AppShell title={`Aluno — ${profile.display_name ?? ""}`}>
      <Link
        to="/admin"
        className="inline-flex items-center gap-1 text-[13px] text-text-muted hover:text-text-main mb-4"
      >
        <ArrowLeft size={14} /> Voltar ao painel
      </Link>

      {/* Header */}
      <div className="lei-card flex items-start gap-4 mb-6">
        <div className="w-[60px] h-[60px] rounded-full bg-sage-light flex items-center justify-center text-sage-dark font-serif text-[24px] overflow-hidden shrink-0">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-[22px] text-text-main truncate">
            {profile.display_name ?? "Sem nome"}
          </h1>
          <div className="text-[12px] text-text-muted">{profile.friend_id ?? "—"}</div>
          <div className="flex items-center gap-2 mt-2 text-[11px]">
            <span className="px-2 py-0.5 rounded-full bg-muted text-text-muted">
              Plano: {profile.plano_atual}
            </span>
            {profile.bloqueado && (
              <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                🚫 Bloqueado
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full bg-blush-light text-blush">
              Visualizando como {roles.includes("admin") ? "Administrador" : "Moderador"}
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setSheetOpen(true)}
        >
          <Settings size={14} /> Ações & Plano
        </Button>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="bg-muted">
          <TabsTrigger value="dashboard" className="gap-2">
            <LayoutDashboard size={14} /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="cronogramas" className="gap-2">
            <BookMarked size={14} /> Cronogramas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <DashboardDoAluno studentId={studentId} />
        </TabsContent>

        <TabsContent value="cronogramas" className="mt-6">
          <CronogramasDoAluno studentId={studentId} />
        </TabsContent>
      </Tabs>

      <UserProfileSheet
        userId={studentId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </AppShell>
  );
}

// ============= Dashboard do aluno =============

function DashboardDoAluno({ studentId }: { studentId: string }) {
  const [stats, setStats] = useState({
    horasTotais: 0,
    sequenciaAtual: 0,
    maiorSequencia: 0,
    totalQuestoes: 0,
  });
  const [badgesCount, setBadgesCount] = useState({ owned: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [badgesRes, userBadgesRes, eventosRes, sessoesRes] = await Promise.all([
        supabase.from("badges").select("id", { count: "exact", head: true }),
        supabase
          .from("user_badges")
          .select("id", { count: "exact", head: true })
          .eq("user_id", studentId),
        supabase
          .from("user_calendar_events")
          .select("data, concluido")
          .eq("user_id", studentId)
          .eq("concluido", true)
          .order("data", { ascending: true }),
        supabase
          .from("user_sessions")
          .select("tempo_estudado, questoes")
          .eq("user_id", studentId),
      ]);
      if (!mounted) return;

      const sessoes = sessoesRes.data ?? [];
      const horasTotais = sessoes.reduce((acc, s) => {
        if (!s.tempo_estudado) return acc;
        const partes = s.tempo_estudado.split(":").map((p) => parseInt(p, 10) || 0);
        return acc + (partes[0] || 0) + (partes[1] || 0) / 60 + (partes[2] || 0) / 3600;
      }, 0);
      const totalQuestoes = sessoes.reduce((acc, s) => acc + (s.questoes ?? 0), 0);

      const datas = Array.from(new Set((eventosRes.data ?? []).map((e) => e.data))).sort();
      let maior = 0;
      let atual = 0;
      let prev: Date | null = null;
      for (const d of datas) {
        const cur = new Date(d);
        if (prev) {
          const diff = (cur.getTime() - prev.getTime()) / 86400000;
          atual = diff === 1 ? atual + 1 : 1;
        } else {
          atual = 1;
        }
        if (atual > maior) maior = atual;
        prev = cur;
      }
      let sequenciaAtual = 0;
      if (prev) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const last = new Date(prev);
        last.setHours(0, 0, 0, 0);
        const diffDias = Math.round((hoje.getTime() - last.getTime()) / 86400000);
        if (diffDias <= 1) sequenciaAtual = atual;
      }

      setStats({ horasTotais, sequenciaAtual, maiorSequencia: maior, totalQuestoes });
      setBadgesCount({ owned: userBadgesRes.count ?? 0, total: badgesRes.count ?? 0 });
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [studentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-text-muted">
        <Loader2 className="animate-spin mr-2" size={16} /> Carregando dashboard…
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Horas estudadas" value={formatarHoras(stats.horasTotais)} hint="total" tone="sage" />
        <MetricCard label="Questões feitas" value={`${stats.totalQuestoes}`} hint="total" tone="blush" />
        <MetricCard
          label="🔥 Sequência"
          value={`${stats.sequenciaAtual} dias`}
          hint={stats.maiorSequencia > 0 ? `recorde: ${stats.maiorSequencia}` : "—"}
          tone="lilac"
        />
        <MetricCard
          label="Medalhas"
          value={`${badgesCount.owned} / ${badgesCount.total}`}
          hint={`${Math.max(0, badgesCount.total - badgesCount.owned)} para desbloquear`}
          tone="sky"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <WeeklyPerformance userId={studentId} />
        <TodaySchedule userId={studentId} />
      </div>

      <div className="grid grid-cols-1">
        <SubjectPerformance userId={studentId} />
      </div>
    </>
  );
}

// ============= Cronogramas do aluno =============

type CronogramaItem = {
  id: string;
  nome: string;
  categoria: string | null;
  premium: boolean;
  imagem_url: string | null;
};

function CronogramasDoAluno({ studentId }: { studentId: string }) {
  const [items, setItems] = useState<CronogramaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Cronogramas que o aluno tem ativados + os próprios cronogramas pessoais do aluno
    const [{ data: ativacoes }, { data: proprios }] = await Promise.all([
      supabase
        .from("user_cronograma_ativacao")
        .select("cronograma_id")
        .eq("user_id", studentId)
        .eq("ativo", true),
      supabase
        .from("cronogramas")
        .select("id, nome, categoria, premium, imagem_url")
        .eq("criado_por", studentId)
        .eq("is_proprio", true),
    ]);

    const ids = (ativacoes ?? []).map((a) => a.cronograma_id).filter(Boolean) as string[];
    let ativados: CronogramaItem[] = [];
    if (ids.length > 0) {
      const { data } = await supabase
        .from("cronogramas")
        .select("id, nome, categoria, premium, imagem_url")
        .in("id", ids);
      ativados = (data ?? []) as CronogramaItem[];
    }
    const map = new Map<string, CronogramaItem>();
    [...ativados, ...((proprios ?? []) as CronogramaItem[])].forEach((c) => map.set(c.id, c));
    setItems(Array.from(map.values()));
    setLoading(false);
  }, [studentId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-text-muted">
        <Loader2 className="animate-spin mr-2" size={16} /> Carregando cronogramas…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="lei-card text-center py-12 text-text-muted text-[13px]">
        Este aluno ainda não ativou nenhum cronograma.
      </div>
    );
  }

  if (selected) {
    const cron = items.find((c) => c.id === selected);
    return (
      <div>
        <button
          onClick={() => setSelected(null)}
          className="inline-flex items-center gap-1 text-[13px] text-text-muted hover:text-text-main mb-3"
        >
          <ArrowLeft size={14} /> Voltar para a lista
        </button>
        <div className="font-serif text-[18px] text-text-main mb-4">{cron?.nome}</div>
        <CronogramaAlunoDetalhe cronogramaId={selected} studentId={studentId} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((c) => (
        <button
          key={c.id}
          onClick={() => setSelected(c.id)}
          className="lei-card flex gap-3 items-center text-left hover:ring-2 hover:ring-sage transition"
        >
          {c.imagem_url ? (
            <img src={c.imagem_url} alt="" className="w-14 h-20 object-cover rounded-md shrink-0" />
          ) : (
            <div className="w-14 h-20 bg-muted rounded-md shrink-0" />
          )}
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-text-muted truncate">
              {c.categoria ?? "Sem categoria"}
            </div>
            <div className="text-[14px] font-medium text-text-main truncate">{c.nome}</div>
            {c.premium && (
              <span
                className="inline-block text-[10px] font-medium rounded-[20px] px-2 py-[1px] mt-1"
                style={{ background: "#FAC775", color: "#633806" }}
              >
                Premium
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

// ============= Cronograma específico do aluno =============

type Materia = {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  topicos: {
    id: string;
    titulo: string;
    duracao_minutos: number;
    materia_id: string;
    ordem: number;
    horas_estimadas: number;
    fontes: Fonte[];
    doutrina: string[];
    atencao: string | null;
  }[];
};

type Evento = {
  id: string;
  titulo: string;
  data: string;
  cor: string | null;
  concluido: boolean;
  topico_id: string | null;
  materia_id: string | null;
  is_revisao: boolean;
};

function CronogramaAlunoDetalhe({
  cronogramaId,
  studentId,
}: {
  cronogramaId: string;
  studentId: string;
}) {
  const { roles } = useAuth();
  const isAdminOrMod = roles.includes("admin") || roles.includes("moderador");
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [progresso, setProgresso] = useState<Record<string, boolean>>({});
  const [fonteProgresso, setFonteProgresso] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const { data: matData } = await supabase
      .from("cronograma_materias")
      .select(
        "id, nome, cor, ordem, cronograma_topicos(id, titulo, duracao_minutos, materia_id, ordem, horas_estimadas, fontes, doutrina, atencao)",
      )
      .eq("cronograma_id", cronogramaId)
      .order("ordem", { ascending: true });

    const mats: Materia[] = (matData ?? []).map((m) => ({
      id: m.id,
      nome: m.nome,
      cor: m.cor,
      ordem: m.ordem,
      topicos: (m.cronograma_topicos ?? [])
        .map((t) => ({
          id: t.id,
          titulo: t.titulo,
          duracao_minutos: t.duracao_minutos,
          materia_id: t.materia_id,
          ordem: t.ordem,
          horas_estimadas: t.horas_estimadas ?? 3,
          fontes: (Array.isArray(t.fontes) ? t.fontes : []) as unknown as Fonte[],
          doutrina: Array.isArray((t as { doutrina?: unknown }).doutrina)
            ? ((t as { doutrina: string[] }).doutrina)
            : [],
          atencao: (t as { atencao?: string | null }).atencao ?? null,
        }))
        .sort((a, b) => a.ordem - b.ordem),
    }));
    setMaterias(mats);

    const allTopicoIds = mats.flatMap((m) => m.topicos.map((t) => t.id));

    const { data: evs } = await supabase
      .from("user_calendar_events")
      .select("id, titulo, data, cor, concluido, topico_id, materia_id, is_revisao")
      .eq("user_id", studentId)
      .eq("cronograma_id", cronogramaId)
      .order("data", { ascending: true });
    setEventos(evs ?? []);

    if (allTopicoIds.length > 0) {
      const { data: progs } = await supabase
        .from("user_topico_progresso")
        .select("topico_id, concluido")
        .eq("user_id", studentId)
        .in("topico_id", allTopicoIds);
      const pm: Record<string, boolean> = {};
      (progs ?? []).forEach((p) => {
        pm[p.topico_id] = p.concluido;
      });
      setProgresso(pm);

      const { data: fps } = await supabase
        .from("user_fonte_progress")
        .select("topico_id, fonte_index, concluido")
        .eq("user_id", studentId)
        .in("topico_id", allTopicoIds);
      const fm: Record<string, boolean> = {};
      (fps ?? []).forEach((f) => {
        if (f.fonte_index !== null && f.fonte_index !== undefined) {
          fm[`${f.topico_id}:${f.fonte_index}`] = f.concluido;
        }
      });
      setFonteProgresso(fm);
    } else {
      setProgresso({});
      setFonteProgresso({});
    }
    setLoading(false);
  }, [cronogramaId, studentId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const allTopicos: MatrizTopico[] = useMemo(() => {
    const flat = materias.flatMap((m) =>
      m.topicos.map((t) => ({
        id: t.id,
        titulo: t.titulo,
        ordem: t.ordem,
        horas_estimadas: t.horas_estimadas ?? 3,
        fontes: t.fontes ?? [],
        doutrina: t.doutrina ?? [],
        atencao: t.atencao ?? null,
        materia_id: m.id,
        materia_nome: m.nome,
        materia_cor: m.cor,
      })),
    );
    return flat.sort((a, b) => a.ordem - b.ordem);
  }, [materias]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-text-muted">
        <Loader2 className="animate-spin mr-2" size={16} /> Carregando…
      </div>
    );
  }

  return (
    <Tabs defaultValue="matriz">
      <TabsList className="bg-muted">
        <TabsTrigger value="matriz">Matriz</TabsTrigger>
        <TabsTrigger value="calendario">Calendário</TabsTrigger>
        <TabsTrigger value="desempenho">Desempenho</TabsTrigger>
      </TabsList>
      <TabsContent value="matriz" className="mt-4">
        <MatrizTab
          cronogramaId={cronogramaId}
          topicos={allTopicos}
          materias={materias.map((m) => ({ id: m.id, nome: m.nome }))}
          progresso={progresso}
          fonteProgresso={fonteProgresso}
          canEdit={isAdminOrMod}
          userId={studentId}
          onChange={loadAll}
        />
      </TabsContent>
      <TabsContent value="calendario" className="mt-4">
        <CalendarioTab
          eventos={eventos}
          topicos={allTopicos.map((t) => ({
            id: t.id,
            titulo: t.titulo,
            materia_id: t.materia_id,
            materia_nome: t.materia_nome,
            horas_estimadas: t.horas_estimadas,
            fontes: t.fontes,
          }))}
          userId={studentId}
          cronogramaId={cronogramaId}
          materias={materias.map((m) => ({ id: m.id, nome: m.nome }))}
          onChange={loadAll}
        />
      </TabsContent>
      <TabsContent value="desempenho" className="mt-4">
        <DesempenhoTab
          cronogramaId={cronogramaId}
          userId={studentId}
          materias={materias}
          eventos={eventos}
          onChange={loadAll}
        />
      </TabsContent>
    </Tabs>
  );
}
