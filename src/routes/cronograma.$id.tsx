import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Play, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useAcesso } from "@/hooks/useAcesso";
import { MatrizTab, type MatrizTopico } from "@/components/cronogramas/MatrizTab";
import { CalendarioTab } from "@/components/cronogramas/CalendarioTab";
import { DesempenhoTab } from "@/components/cronogramas/DesempenhoTab";
import { AtivarDialog } from "@/components/cronogramas/AtivarDialog";
import type { Fonte } from "@/components/cronogramas/NovoTopicoForm";

export const Route = createFileRoute("/cronograma/$id")({
  head: () => ({ meta: [{ title: "Cronograma — Lei.co" }] }),
  component: CronogramaDetail,
});

type Cronograma = {
  nome: string;
  categoria: string | null;
  imagem_url: string | null;
  premium: boolean;
};

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

function CronogramaDetail() {
  const { id } = Route.useParams();
  const { user, isAdminOrMod } = useAuth();
  const acesso = useAcesso();
  const navigate = useNavigate();

  const [cron, setCron] = useState<Cronograma | null>(null);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [progresso, setProgresso] = useState<Record<string, boolean>>({});
  const [fonteProgresso, setFonteProgresso] = useState<Record<string, boolean>>({});
  const [ativacao, setAtivacao] = useState<{ data_inicio: string; data_prova: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [ativarOpen, setAtivarOpen] = useState(false);
  const [tab, setTab] = useState<string>("matriz");

  const loadAll = useCallback(async () => {
    const { data: cronData } = await supabase
      .from("cronogramas")
      .select("nome, categoria, imagem_url, premium")
      .eq("id", id)
      .maybeSingle();
    setCron(cronData);

    const { data: matData } = await supabase
      .from("cronograma_materias")
      .select(
        "id, nome, cor, ordem, cronograma_topicos(id, titulo, duracao_minutos, materia_id, ordem, horas_estimadas, fontes)",
      )
      .eq("cronograma_id", id)
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
        }))
        .sort((a, b) => a.ordem - b.ordem),
    }));
    setMaterias(mats);

    if (user) {
      const allTopicoIds = mats.flatMap((m) => m.topicos.map((t) => t.id));

      const { data: evs } = await supabase
        .from("user_calendar_events")
        .select("id, titulo, data, cor, concluido, topico_id, materia_id, is_revisao")
        .eq("user_id", user.id)
        .eq("cronograma_id", id)
        .order("data", { ascending: true });
      setEventos(evs ?? []);

      if (allTopicoIds.length > 0) {
        const { data: progs } = await supabase
          .from("user_topico_progresso")
          .select("topico_id, concluido")
          .eq("user_id", user.id)
          .in("topico_id", allTopicoIds);
        const pm: Record<string, boolean> = {};
        (progs ?? []).forEach((p) => {
          pm[p.topico_id] = p.concluido;
        });
        setProgresso(pm);

        const { data: fps } = await supabase
          .from("user_fonte_progress")
          .select("topico_id, sigla, concluido")
          .eq("user_id", user.id)
          .in("topico_id", allTopicoIds);
        const fm: Record<string, boolean> = {};
        (fps ?? []).forEach((f) => {
          fm[`${f.topico_id}:${f.sigla}`] = f.concluido;
        });
        setFonteProgresso(fm);
      } else {
        setProgresso({});
        setFonteProgresso({});
      }

      const { data: at } = await supabase
        .from("user_cronograma_ativacao")
        .select("data_inicio, data_prova")
        .eq("user_id", user.id)
        .eq("cronograma_id", id)
        .eq("ativo", true)
        .maybeSingle();
      setAtivacao(at);
    }
    setLoading(false);
  }, [id, user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Flatten topicos with materia info for the matriz table
  const allTopicos: MatrizTopico[] = useMemo(() => {
    const flat = materias.flatMap((m) =>
      m.topicos.map((t) => ({
        id: t.id,
        titulo: t.titulo,
        ordem: t.ordem,
        horas_estimadas: t.horas_estimadas ?? 3,
        fontes: t.fontes ?? [],
        materia_id: m.id,
        materia_nome: m.nome,
        materia_cor: m.cor,
      })),
    );
    // Stable order: by materia.ordem then topico.ordem (already sorted)
    return flat;
  }, [materias]);

  const previewTopicos: MatrizTopico[] = useMemo(
    () => allTopicos.slice(0, 3),
    [allTopicos],
  );

  // Acesso ao cronograma (gratuito sempre passa; premium depende de compra/Diamante/staff)
  const temAcesso = cron ? acesso.temAcessoCronograma(id, cron.premium) : true;
  const podeCalendario = cron ? acesso.podeUsarCalendario(id, cron.premium) : false;

  return (
    <AppShell title={cron?.nome ?? "Cronograma"}>
      <Link
        to="/cronogramas"
        className="inline-flex items-center gap-1 text-[13px] text-text-muted hover:text-text-main mb-4"
      >
        <ArrowLeft size={14} /> Voltar
      </Link>

      {loading ? (
        <div className="lei-card text-center py-16 text-text-muted text-[13px]">Carregando...</div>
      ) : !cron ? (
        <div className="lei-card text-center py-16">
          <div className="font-serif text-[18px]">Cronograma não encontrado</div>
        </div>
      ) : (
        <>
          {/* Hero */}
          <div className="lei-card flex gap-6 items-start mb-6">
            {cron.imagem_url ? (
              <img
                src={cron.imagem_url}
                alt={cron.nome}
                className="w-[140px] h-[187px] object-cover rounded-[12px] border border-border"
              />
            ) : (
              <div className="w-[140px] h-[187px] rounded-[12px] bg-muted border border-border" />
            )}
            <div className="flex-1">
              <div className="text-[11px] uppercase tracking-wider text-text-muted mb-1">
                {cron.categoria ?? "Sem categoria"}
              </div>
              <h1 className="font-serif text-[24px] text-text-main mb-2">{cron.nome}</h1>
              <span
                className="inline-block text-[10px] font-medium rounded-[20px] px-2 py-[2px] mr-2"
                style={
                  cron.premium
                    ? { background: "#FAC775", color: "#633806" }
                    : { background: "var(--color-sage-light)", color: "var(--color-sage-dark)" }
                }
              >
                {cron.premium ? "Premium" : "Gratuito"}
              </span>
              {ativacao && (
                <span className="inline-block text-[10px] font-medium rounded-[20px] px-2 py-[2px] bg-sage-light text-sage-dark">
                  Ativo até {new Date(ativacao.data_prova + "T00:00").toLocaleDateString("pt-BR")}
                </span>
              )}
              <div className="mt-4 flex gap-2">
                {temAcesso && podeCalendario && user && allTopicos.length > 0 && !ativacao && (
                  <Button
                    onClick={() => setAtivarOpen(true)}
                    className="bg-sage-dark hover:bg-sage-dark/90 text-white rounded-[10px] gap-2"
                  >
                    <Play size={14} /> Ativar cronograma
                  </Button>
                )}
              </div>
            </div>
          </div>

          {!temAcesso ? (
            // Premium sem acesso: apenas Matriz com fade nas 3 primeiras linhas
            <div className="relative">
              <MatrizTab
                cronogramaId={id}
                topicos={previewTopicos}
                materias={materias.map((m) => ({ id: m.id, nome: m.nome }))}
                progresso={{}}
                fonteProgresso={{}}
                canEdit={false}
                userId={null}
                onChange={loadAll}
              />
              <div
                className="absolute left-0 right-0 bottom-0 flex items-end justify-center pb-5 pointer-events-none"
                style={{
                  height: 220,
                  background:
                    "linear-gradient(to bottom, transparent 0%, var(--color-cream, #F7F4EE) 70%)",
                }}
              >
                <div className="bg-white border border-border rounded-[14px] px-6 py-4 text-center shadow-sm pointer-events-auto">
                  <div className="text-2xl mb-1">🔒</div>
                  <div className="text-[13px] font-medium text-text-main mb-1">
                    Conteúdo Premium
                  </div>
                  <div className="text-[12px] text-text-muted mb-3">
                    Adquira este cronograma ou assine o Plano Diamante
                  </div>
                  <Button
                    size="sm"
                    onClick={() => navigate({ to: "/meu-plano" })}
                    className="bg-sage-dark hover:bg-sage-dark/90 text-white rounded-[20px] gap-2"
                  >
                    <Sparkles size={14} /> Ver planos
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="bg-muted">
                <TabsTrigger value="matriz">Matriz</TabsTrigger>
                <TabsTrigger value="calendario">Calendário</TabsTrigger>
                <TabsTrigger value="desempenho">Desempenho</TabsTrigger>
              </TabsList>
              <TabsContent value="matriz" className="mt-4">
                <MatrizTab
                  cronogramaId={id}
                  topicos={allTopicos}
                  materias={materias.map((m) => ({ id: m.id, nome: m.nome }))}
                  progresso={progresso}
                  fonteProgresso={fonteProgresso}
                  canEdit={isAdminOrMod}
                  userId={user?.id ?? null}
                  onChange={loadAll}
                />
              </TabsContent>
              <TabsContent value="calendario" className="mt-4">
                {user ? (
                  <div className="relative">
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
                      userId={user.id}
                      cronogramaId={id}
                      materias={materias.map((m) => ({ id: m.id, nome: m.nome }))}
                      onChange={loadAll}
                    />
                    {!podeCalendario && (
                      <div
                        className="absolute inset-0 flex items-center justify-center rounded-[14px] z-10"
                        style={{
                          background: "rgba(247,244,238,0.85)",
                          backdropFilter: "blur(4px)",
                        }}
                      >
                        <div className="text-center max-w-sm px-4">
                          <div className="text-3xl mb-2">📅</div>
                          <div className="text-[14px] font-medium text-text-main mb-1">
                            Calendário bloqueado
                          </div>
                          <div className="text-[12px] text-text-muted mb-4">
                            Você possui acesso à matriz deste cronograma.
                            <br />
                            Assine um plano para usar o calendário e cronômetro.
                          </div>
                          <Button
                            size="sm"
                            onClick={() => navigate({ to: "/meu-plano" })}
                            className="bg-sage hover:bg-sage/90 text-white rounded-[20px]"
                          >
                            Assinar agora
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="lei-card text-center py-12 text-text-muted text-[13px]">
                    Faça login para ver seu calendário.
                  </div>
                )}
              </TabsContent>
              <TabsContent value="desempenho" className="mt-4">
                {podeCalendario ? (
                  <DesempenhoTab
                    cronogramaId={id}
                    userId={user?.id ?? null}
                    materias={materias}
                    eventos={eventos}
                    onChange={loadAll}
                  />
                ) : (
                  <div className="lei-card text-center py-12">
                    <div className="text-3xl mb-2">📊</div>
                    <div className="text-[14px] font-medium text-text-main mb-1">
                      Desempenho bloqueado
                    </div>
                    <div className="text-[12px] text-text-muted mb-4">
                      Assine um plano para acompanhar suas estatísticas.
                    </div>
                    <Button
                      size="sm"
                      onClick={() => navigate({ to: "/meu-plano" })}
                      className="bg-sage hover:bg-sage/90 text-white rounded-[20px]"
                    >
                      Assinar agora
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}

          {user && (
            <AtivarDialog
              open={ativarOpen}
              onOpenChange={setAtivarOpen}
              cronogramaId={id}
              userId={user.id}
              topicos={materias.flatMap((m) =>
                m.topicos.map((t) => ({
                  id: t.id,
                  titulo: t.titulo,
                  materia_id: m.id,
                  cor: m.cor,
                })),
              )}
              onActivated={loadAll}
            />
          )}
        </>
      )}
    </AppShell>
  );
}
