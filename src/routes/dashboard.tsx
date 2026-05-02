import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { WeeklyPerformance } from "@/components/dashboard/WeeklyPerformance";
import { TodaySchedule } from "@/components/dashboard/TodaySchedule";
import { GroupRanking } from "@/components/dashboard/GroupRanking";
import { SubjectPerformance } from "@/components/dashboard/SubjectPerformance";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

type Stats = {
  horasTotais: number;
  sequenciaAtual: number;
  maiorSequencia: number;
  totalQuestoes: number;
  desempenhoAtual: number | null;
  desempenhosConsiderados: number;
};

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Lei.co" },
      { name: "description", content: "Acompanhe horas, questões, desempenho e ranking no Lei.co." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    horasTotais: 0,
    sequenciaAtual: 0,
    maiorSequencia: 0,
    totalQuestoes: 0,
    desempenhoAtual: null,
    desempenhosConsiderados: 0,
  });
  const [badgesCount, setBadgesCount] = useState({ owned: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    (async () => {
      const [badgesRes, userBadgesRes, eventosRes, sessoesRes] = await Promise.all([
        supabase.from("badges").select("id", { count: "exact", head: true }),
        supabase
          .from("user_badges")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("user_calendar_events")
          .select("data, concluido")
          .eq("user_id", user.id)
          .eq("concluido", true)
          .order("data", { ascending: true }),
        supabase
          .from("user_sessions")
          .select("tempo_estudado, questoes, acertos, data, created_at")
          .eq("user_id", user.id)
          .order("data", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);

      if (!mounted) return;

      const sessoes = sessoesRes.data ?? [];
      const horasTotais = sessoes.reduce((acc, s) => {
        const [h, m] = (s.tempo_estudado ?? "0:0").split(":");
        return acc + (parseInt(h, 10) || 0) + (parseInt(m, 10) || 0) / 60;
      }, 0);
      const totalQuestoes = sessoes.reduce((acc, s) => acc + (s.questoes ?? 0), 0);

      // Desempenho Atual: média ponderada das últimas 3 sessões com questões > 0
      const desempenhos = sessoes.filter((s) => (s.questoes ?? 0) > 0).slice(0, 3);
      const somaQ = desempenhos.reduce((a, s) => a + (s.questoes ?? 0), 0);
      const somaA = desempenhos.reduce((a, s) => a + (s.acertos ?? 0), 0);
      const desempenhoAtual =
        somaQ > 0 ? Math.round((somaA / somaQ) * 1000) / 10 : null;

      const datas = Array.from(
        new Set((eventosRes.data ?? []).map((e) => e.data)),
      ).sort();
      let maior = 0;
      let atual = 0;
      let prev: Date | null = null;
      for (const d of datas) {
        const cur = new Date(d);
        if (prev) {
          const diff = (cur.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
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

      setStats({
        horasTotais: Math.round(horasTotais * 10) / 10,
        sequenciaAtual,
        maiorSequencia: maior,
        totalQuestoes,
        desempenhoAtual,
        desempenhosConsiderados: desempenhos.length,
      });
      setBadgesCount({
        owned: userBadgesRes.count ?? 0,
        total: badgesRes.count ?? 0,
      });
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [user]);

  if (loading) {
    return (
      <AppShell title="Dashboard">
        <div className="flex items-center justify-center py-20 text-text-muted">
          <Loader2 className="animate-spin mr-2" size={18} /> Carregando…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Dashboard">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Horas estudadas"
          value={`${stats.horasTotais}h`}
          hint="total registrado"
          tone="sage"
        />
        <MetricCard
          label="Questões feitas"
          value={`${stats.totalQuestoes}`}
          hint={stats.totalQuestoes > 0 ? `${stats.mediaAcerto}% de acerto` : "sem dados ainda"}
          tone="blush"
        />
        <MetricCard
          label="🔥 Sequência"
          value={`${stats.sequenciaAtual} dias`}
          hint={stats.maiorSequencia > 0 ? `seu recorde: ${stats.maiorSequencia}` : "comece hoje"}
          tone="lilac"
        />
        <MetricCard
          label="Medalhas"
          value={`${badgesCount.owned} / ${badgesCount.total}`}
          hint={`${Math.max(0, badgesCount.total - badgesCount.owned)} para desbloquear`}
          tone="sky"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <WeeklyPerformance />
        <TodaySchedule />
        <GroupRanking />
      </div>

      <div className="grid grid-cols-1">
        <SubjectPerformance />
      </div>
    </AppShell>
  );
}
