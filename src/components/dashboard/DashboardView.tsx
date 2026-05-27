import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { WeeklyPerformance } from "@/components/dashboard/WeeklyPerformance";
import { TodaySchedule } from "@/components/dashboard/TodaySchedule";
import { GroupRanking } from "@/components/dashboard/GroupRanking";
import { SubjectPerformance } from "@/components/dashboard/SubjectPerformance";
import { supabase } from "@/integrations/supabase/client";

type Stats = {
  horasTotais: number;
  sequenciaAtual: number;
  maiorSequencia: number;
  totalQuestoes: number;
};

function formatarHoras(h: number): string {
  const horas = Math.floor(h);
  const minutos = Math.round((h - horas) * 60);
  if (minutos === 0) return `${horas}h`;
  if (minutos === 60) return `${horas + 1}h`;
  return `${horas}h ${minutos}min`;
}

export function DashboardView({ userId }: { userId: string }) {
  const [stats, setStats] = useState<Stats>({
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
          .eq("user_id", userId),
        supabase
          .from("user_calendar_events")
          .select("data, concluido")
          .eq("user_id", userId)
          .eq("concluido", true)
          .order("data", { ascending: true }),
        supabase
          .from("user_sessions")
          .select("tempo_estudado, questoes, acertos, data, created_at")
          .eq("user_id", userId)
          .order("data", { ascending: false })
          .order("created_at", { ascending: false }),
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
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-text-muted">
        <Loader2 className="animate-spin mr-2" size={18} /> Carregando…
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Horas estudadas"
          value={formatarHoras(stats.horasTotais)}
          hint="total registrado"
          tone="sage"
        />
        <MetricCard
          label="Questões feitas"
          value={`${stats.totalQuestoes}`}
          hint="total registrado"
          tone="blush"
        />
        <MetricCard
          label="🔥 Sequência"
          value={`${stats.sequenciaAtual} dias`}
          hint={stats.maiorSequencia > 0 ? `recorde: ${stats.maiorSequencia}` : "comece hoje"}
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
        <WeeklyPerformance userId={userId} />
        <TodaySchedule userId={userId} />
        <GroupRanking />
      </div>

      <div className="grid grid-cols-1">
        <SubjectPerformance userId={userId} />
      </div>
    </>
  );
}
