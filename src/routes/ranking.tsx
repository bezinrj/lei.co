import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { calcularNivel, getNivelInfo } from "@/lib/xp";
import { Trophy, Users, UserRound, Flame } from "lucide-react";

export const Route = createFileRoute("/ranking")({
  head: () => ({ meta: [{ title: "Ranking Global — Lei.co" }] }),
  component: RankingPage,
});

type GrupoRow = {
  id: string;
  nome: string;
  foto_url: string | null;
  membros_count: number;
  membros_ativos: number;
  xp_medio_60d: number;
  contem_me: boolean;
};

type UserRow = {
  user_id: string;
  nome: string;
  avatar_url: string | null;
  xp_total: number;
  nivel: number;
  streak_dias: number;
};

function inicioMesISO(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function calcStreak(set: Set<string>): number {
  if (set.size === 0) return 0;
  let streak = 0;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const cursor = new Date(hoje);
  const isoHoje = hoje.toISOString().split("T")[0];
  if (!set.has(isoHoje)) cursor.setDate(cursor.getDate() - 1);
  while (set.has(cursor.toISOString().split("T")[0])) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function corPosicao(i: number): string {
  if (i === 0) return "#C9A84C";
  if (i === 1) return "#888";
  if (i === 2) return "#CD7F32";
  return "#8A8478";
}

function RankingPage() {
  const { user } = useAuth();
  const [grupos, setGrupos] = useState<GrupoRow[]>([]);
  const [individual, setIndividual] = useState<UserRow[]>([]);
  const [amigos, setAmigos] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function carregar() {
    if (!user) return;
    setLoading(true);

    // ============= INDIVIDUAL =============
    const { data: xps } = await supabase
      .from("user_xp")
      .select("user_id, xp_total, nivel")
      .order("xp_total", { ascending: false })
      .limit(200);

    const userIds = (xps ?? []).map((x) => x.user_id);
    const safeIds = userIds.length
      ? userIds
      : ["00000000-0000-0000-0000-000000000000"];

    const [{ data: profs }, { data: sessoes }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", safeIds),
      supabase
        .from("user_sessions")
        .select("user_id, data")
        .in("user_id", safeIds)
        .gte("created_at", inicioMesISO()),
    ]);

    const sessoesMap = new Map<string, Set<string>>();
    (sessoes ?? []).forEach((s) => {
      const set = sessoesMap.get(s.user_id) ?? new Set<string>();
      set.add(s.data as string);
      sessoesMap.set(s.user_id, set);
    });

    const indv: UserRow[] = (xps ?? []).map((x) => {
      const prof = (profs ?? []).find((p) => p.id === x.user_id);
      return {
        user_id: x.user_id,
        nome: prof?.display_name ?? "Aluno",
        avatar_url: prof?.avatar_url ?? null,
        xp_total: Number(x.xp_total ?? 0),
        nivel: Number(x.nivel ?? calcularNivel(Number(x.xp_total ?? 0))),
        streak_dias: calcStreak(sessoesMap.get(x.user_id) ?? new Set()),
      };
    });
    setIndividual(indv);

    // ============= GRUPOS =============
    const { data: todosGrupos } = await supabase
      .from("grupos")
      .select("id, nome, foto_url");
    const { data: todosMembros } = await supabase
      .from("grupo_membros")
      .select("grupo_id, user_id");

    // XP dos últimos 60 dias por usuário
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 60);
    const dataLimiteISO = dataLimite.toISOString().split("T")[0];

    const { data: xpDiario } = await supabase
      .from("user_xp_diario")
      .select("user_id, xp_ganho, data")
      .gte("data", dataLimiteISO);

    const xp60dPorUser = new Map<string, number>();
    (xpDiario ?? []).forEach((r) => {
      const atual = xp60dPorUser.get(r.user_id) ?? 0;
      xp60dPorUser.set(r.user_id, atual + Number(r.xp_ganho ?? 0));
    });

    const meusGrupos = new Set(
      (todosMembros ?? [])
        .filter((m) => m.user_id === user.id)
        .map((m) => m.grupo_id),
    );

    const gruposRows: GrupoRow[] = (todosGrupos ?? []).map((g) => {
      const membros = (todosMembros ?? []).filter((m) => m.grupo_id === g.id);
      const xp_total_60d = membros.reduce(
        (a, m) => a + (xp60dPorUser.get(m.user_id) ?? 0),
        0,
      );
      const ativos = membros.filter(
        (m) => (xp60dPorUser.get(m.user_id) ?? 0) > 0,
      ).length;
      const xp_medio_60d = membros.length
        ? Math.round(xp_total_60d / membros.length)
        : 0;
      return {
        id: g.id,
        nome: g.nome,
        foto_url: g.foto_url,
        membros_count: membros.length,
        membros_ativos: ativos,
        xp_medio_60d,
        contem_me: meusGrupos.has(g.id),
      };
    });
    gruposRows.sort((a, b) => b.xp_medio_60d - a.xp_medio_60d);
    setGrupos(gruposRows);

    // ============= AMIGOS =============
    // usuários que estão em ao menos 1 grupo em comum com o user logado
    const meusGruposIds = Array.from(meusGrupos);
    const amigosIds = new Set<string>();
    if (meusGruposIds.length > 0) {
      (todosMembros ?? [])
        .filter((m) => meusGruposIds.includes(m.grupo_id))
        .forEach((m) => amigosIds.add(m.user_id));
    }
    amigosIds.add(user.id); // incluir o próprio
    setAmigos(indv.filter((u) => amigosIds.has(u.user_id)));

    setLoading(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <AppShell title="Ranking Global">
      <div className="mb-5">
        <h2 className="font-serif text-[20px] text-text-main">Ranking</h2>
        <p className="text-text-muted text-[13px]">
          Suba de nível, suba na lista.
        </p>
      </div>

      <Tabs defaultValue="grupos" className="w-full">
        <TabsList className="bg-muted rounded-[12px] p-1">
          <TabsTrigger value="grupos" className="rounded-[10px]">
            <Users size={14} className="mr-1.5" />
            Grupos
          </TabsTrigger>
          <TabsTrigger value="individual" className="rounded-[10px]">
            <Trophy size={14} className="mr-1.5" />
            Individual
          </TabsTrigger>
          <TabsTrigger value="amigos" className="rounded-[10px]">
            <UserRound size={14} className="mr-1.5" />
            Amigos
          </TabsTrigger>
        </TabsList>

        {/* GRUPOS */}
        <TabsContent value="grupos" className="mt-4">
          {loading ? (
            <Skeleton />
          ) : grupos.length === 0 ? (
            <Empty texto="Nenhum grupo ainda. Crie ou entre em um." />
          ) : (
            <div className="flex flex-col gap-2">
              {grupos.map((g, i) => (
                <Link
                  key={g.id}
                  to="/grupos/$id"
                  params={{ id: g.id }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px",
                    borderRadius: "10px",
                    background: g.contem_me ? "#E8F0E5" : "#fff",
                    border: "1px solid rgba(61,56,48,0.08)",
                    textDecoration: "none",
                  }}
                >
                  <div
                    className="font-serif"
                    style={{
                      fontSize: "20px",
                      color: corPosicao(i),
                      minWidth: "28px",
                      textAlign: "center",
                    }}
                  >
                    {i + 1}
                  </div>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      background: g.foto_url
                        ? `url(${g.foto_url}) center/cover`
                        : "linear-gradient(135deg, #A6B89A, #C9B6D6)",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 500,
                        color: "var(--text-main)",
                      }}
                      className="truncate"
                    >
                      {g.nome}
                    </div>
                    <div style={{ fontSize: "11px", color: "#8A8478" }}>
                      {g.membros_count} membro
                      {g.membros_count === 1 ? "" : "s"} ·{" "}
                      {getNivelInfo(g.nivel_medio).nome}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#1D9E75",
                    }}
                  >
                    {g.xp_total.toLocaleString("pt-BR")} XP
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* INDIVIDUAL */}
        <TabsContent value="individual" className="mt-4">
          {loading ? (
            <Skeleton />
          ) : individual.length === 0 ? (
            <Empty texto="Ninguém pontuou ainda." />
          ) : (
            <UserList rows={individual} meId={user?.id} />
          )}
        </TabsContent>

        {/* AMIGOS */}
        <TabsContent value="amigos" className="mt-4">
          {loading ? (
            <Skeleton />
          ) : amigos.length <= 1 ? (
            <Empty texto="Entre em um grupo para ver amigos aqui." />
          ) : (
            <UserList rows={amigos} meId={user?.id} />
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function UserList({ rows, meId }: { rows: UserRow[]; meId?: string }) {
  return (
    <div className="flex flex-col gap-2">
      {rows.map((u, i) => {
        const isMe = u.user_id === meId;
        const niv = getNivelInfo(u.nivel);
        return (
          <div
            key={u.user_id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px",
              borderRadius: "10px",
              background: isMe ? "#E8F0E5" : "#fff",
              border: "1px solid rgba(61,56,48,0.08)",
            }}
          >
            <div
              className="font-serif"
              style={{
                fontSize: "20px",
                color: corPosicao(i),
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
                background: u.avatar_url
                  ? `url(${u.avatar_url}) center/cover`
                  : "#E8F0E5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: 500,
                flexShrink: 0,
                color: "var(--text-main)",
              }}
            >
              {u.avatar_url ? "" : (u.nome[0]?.toUpperCase() ?? "?")}
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
                <span className="truncate">{u.nome}</span>
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
                {u.xp_total.toLocaleString("pt-BR")} XP
              </div>
              {u.streak_dias > 0 && (
                <div
                  style={{
                    fontSize: "10px",
                    color: "#6b7280",
                    display: "flex",
                    alignItems: "center",
                    gap: "3px",
                    justifyContent: "flex-end",
                  }}
                >
                  <Flame size={10} color="#E24B4A" /> {u.streak_dias}d
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="lei-card text-center py-12 text-text-muted text-[13px]">
      Carregando...
    </div>
  );
}

function Empty({ texto }: { texto: string }) {
  return (
    <div className="lei-card text-center py-12 text-text-muted text-[13px]">
      {texto}
    </div>
  );
}
