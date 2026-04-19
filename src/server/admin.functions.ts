import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase as browserSupabase } from "@/integrations/supabase/client";

const attachAuthHeader = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await browserSupabase.auth.getSession();
  const token = data.session?.access_token;
  return next({
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
});

export type AdminUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  display_name: string | null;
  friend_id: string | null;
  roles: string[];
  last_seen_at: string | null;
  online: boolean;
};

const ONLINE_WINDOW_MS = 2 * 60 * 1000;

async function requireAdminAccess(supabase: any, userId: string) {
  const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (roleError || !isAdmin) {
    throw new Error("Acesso negado");
  }
}

async function requireAdminOrModAccess(supabase: any, userId: string) {
  const [{ data: a }, { data: m }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "moderador" }),
  ]);
  if (!a && !m) throw new Error("Acesso negado");
}

export const listAdminUsers = createServerFn({ method: "POST" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireAdminAccess(supabase, userId);

    const [{ data: profiles, error: profilesErr }, { data: roles, error: rolesErr }, { data: presence, error: presenceErr }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, friend_id, created_at"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("presence").select("user_id, last_seen_at"),
    ]);

    if (profilesErr) throw new Error(profilesErr.message);
    if (rolesErr) throw new Error(rolesErr.message);
    if (presenceErr) throw new Error(presenceErr.message);

    const rolesMap = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = rolesMap.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesMap.set(r.user_id, arr);
    });

    const presMap = new Map((presence ?? []).map((p) => [p.user_id, p.last_seen_at]));
    const now = Date.now();

    const result: AdminUser[] = (profiles ?? []).map((profile) => {
      const lastSeen = presMap.get(profile.id) ?? null;
      return {
        id: profile.id,
        email: null,
        created_at: profile.created_at,
        last_sign_in_at: null,
        display_name: profile.display_name ?? null,
        friend_id: profile.friend_id ?? null,
        roles: rolesMap.get(profile.id) ?? [],
        last_seen_at: lastSeen,
        online: lastSeen ? now - new Date(lastSeen).getTime() < ONLINE_WINDOW_MS : false,
      };
    });

    result.sort((a, b) => Number(b.online) - Number(a.online) || (b.created_at > a.created_at ? 1 : -1));
    return { users: result };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .inputValidator(
    (input: { userId: string; role: "admin" | "moderador" | "user"; enabled: boolean }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdminAccess(supabase, userId);

    if (data.enabled) {
      const { error } = await supabase
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });

// ============ STAGE 4: Cronogramas admin ============

export type AdminCronograma = {
  id: string;
  nome: string;
  categoria: string | null;
  premium: boolean;
  imagem_url: string | null;
  total_materias: number;
  total_topicos: number;
  total_alunos_ativos: number;
  created_at: string;
};

export const listAdminCronogramas = createServerFn({ method: "POST" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireAdminOrModAccess(supabase, userId);

    const [{ data: crons }, { data: mats }, { data: tops }, { data: ativ }] = await Promise.all([
      supabase
        .from("cronogramas")
        .select("id, nome, categoria, premium, imagem_url, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("cronograma_materias").select("id, cronograma_id"),
      supabase.from("cronograma_topicos").select("id, materia_id"),
      supabase.from("user_cronograma_ativacao").select("cronograma_id, ativo"),
    ]);

    const matByCron = new Map<string, string[]>();
    (mats ?? []).forEach((m) => {
      const arr = matByCron.get(m.cronograma_id) ?? [];
      arr.push(m.id);
      matByCron.set(m.cronograma_id, arr);
    });
    const topByMat = new Map<string, number>();
    (tops ?? []).forEach((t) => {
      topByMat.set(t.materia_id, (topByMat.get(t.materia_id) ?? 0) + 1);
    });
    const ativByCron = new Map<string, number>();
    (ativ ?? [])
      .filter((a) => a.ativo)
      .forEach((a) => {
        ativByCron.set(a.cronograma_id, (ativByCron.get(a.cronograma_id) ?? 0) + 1);
      });

    const result: AdminCronograma[] = (crons ?? []).map((c) => {
      const mIds = matByCron.get(c.id) ?? [];
      const totalTopicos = mIds.reduce((s, id) => s + (topByMat.get(id) ?? 0), 0);
      return {
        id: c.id,
        nome: c.nome,
        categoria: c.categoria,
        premium: c.premium,
        imagem_url: c.imagem_url,
        total_materias: mIds.length,
        total_topicos: totalTopicos,
        total_alunos_ativos: ativByCron.get(c.id) ?? 0,
        created_at: c.created_at,
      };
    });

    return { cronogramas: result };
  });

export const updateCronograma = createServerFn({ method: "POST" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      nome?: string;
      categoria?: string | null;
      premium?: boolean;
      imagem_url?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdminOrModAccess(supabase, userId);
    const { id, ...patch } = data;
    const { error } = await supabase.from("cronogramas").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCronograma = createServerFn({ method: "POST" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdminOrModAccess(supabase, userId);
    // Cascade: delete topicos -> materias -> cronograma
    const { data: mats } = await supabase
      .from("cronograma_materias")
      .select("id")
      .eq("cronograma_id", data.id);
    const matIds = (mats ?? []).map((m) => m.id);
    if (matIds.length > 0) {
      await supabase.from("cronograma_topicos").delete().in("materia_id", matIds);
      await supabase.from("cronograma_materias").delete().in("id", matIds);
    }
    await supabase.from("user_calendar_events").delete().eq("cronograma_id", data.id);
    await supabase.from("user_cronograma_ativacao").delete().eq("cronograma_id", data.id);
    const { error } = await supabase.from("cronogramas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateCronograma = createServerFn({ method: "POST" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdminOrModAccess(supabase, userId);

    // 1. Load source cronograma
    const { data: src, error: srcErr } = await supabase
      .from("cronogramas")
      .select("nome, categoria, imagem_url, premium")
      .eq("id", data.id)
      .single();
    if (srcErr || !src) throw new Error(srcErr?.message ?? "Cronograma não encontrado");

    // 2. Create new cronograma
    const { data: novo, error: novoErr } = await supabase
      .from("cronogramas")
      .insert({
        nome: `${src.nome} (cópia)`,
        categoria: src.categoria,
        imagem_url: src.imagem_url,
        premium: src.premium,
        created_by: userId,
      })
      .select("id")
      .single();
    if (novoErr || !novo) throw new Error(novoErr?.message ?? "Erro ao criar cópia");

    // 3. Copy materias
    const { data: mats, error: matsErr } = await supabase
      .from("cronograma_materias")
      .select("id, nome, cor, ordem")
      .eq("cronograma_id", data.id)
      .order("ordem");
    if (matsErr) throw new Error(matsErr.message);

    const materiaIdMap = new Map<string, string>();
    if (mats && mats.length > 0) {
      const { data: novasMats, error: insMatsErr } = await supabase
        .from("cronograma_materias")
        .insert(
          mats.map((m) => ({
            cronograma_id: novo.id,
            nome: m.nome,
            cor: m.cor,
            ordem: m.ordem,
          })),
        )
        .select("id, nome, ordem");
      if (insMatsErr) throw new Error(insMatsErr.message);

      // Map old → new by (nome, ordem)
      mats.forEach((oldM) => {
        const match = (novasMats ?? []).find(
          (n) => n.nome === oldM.nome && n.ordem === oldM.ordem,
        );
        if (match) materiaIdMap.set(oldM.id, match.id);
      });

      // 4. Copy topicos for each materia
      const oldMatIds = mats.map((m) => m.id);
      const { data: tops, error: topsErr } = await supabase
        .from("cronograma_topicos")
        .select("materia_id, titulo, descricao, horas_estimadas, duracao_minutos, fontes, ordem")
        .in("materia_id", oldMatIds)
        .order("ordem");
      if (topsErr) throw new Error(topsErr.message);

      if (tops && tops.length > 0) {
        const novosTops = tops
          .map((t) => {
            const newMatId = materiaIdMap.get(t.materia_id);
            if (!newMatId) return null;
            return {
              materia_id: newMatId,
              titulo: t.titulo,
              descricao: t.descricao,
              horas_estimadas: t.horas_estimadas,
              duracao_minutos: t.duracao_minutos,
              fontes: t.fontes,
              ordem: t.ordem,
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);

        if (novosTops.length > 0) {
          const { error: insTopsErr } = await supabase
            .from("cronograma_topicos")
            .insert(novosTops);
          if (insTopsErr) throw new Error(insTopsErr.message);
        }
      }
    }

    return { ok: true, id: novo.id };
  });

// ============ STAGE 4: Alunos admin ============

export type AlunoListItem = {
  id: string;
  display_name: string | null;
  friend_id: string | null;
  ativacoes: number;
};

export const listAlunos = createServerFn({ method: "POST" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireAdminOrModAccess(supabase, userId);

    const [{ data: profiles }, { data: ativ }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, friend_id"),
      supabase.from("user_cronograma_ativacao").select("user_id, ativo"),
    ]);

    const ativMap = new Map<string, number>();
    (ativ ?? [])
      .filter((a) => a.ativo)
      .forEach((a) => ativMap.set(a.user_id, (ativMap.get(a.user_id) ?? 0) + 1));

    const result: AlunoListItem[] = (profiles ?? []).map((p) => ({
      id: p.id,
      display_name: p.display_name,
      friend_id: p.friend_id,
      ativacoes: ativMap.get(p.id) ?? 0,
    }));
    result.sort((a, b) => b.ativacoes - a.ativacoes);
    return { alunos: result };
  });

export type AlunoDetalhes = {
  profile: { id: string; display_name: string | null; friend_id: string | null };
  cronogramas: { id: string; nome: string; data_inicio: string; data_prova: string }[];
  eventos: {
    id: string;
    titulo: string;
    data: string;
    cronograma_id: string | null;
    materia_id: string | null;
    topico_id: string | null;
    concluido: boolean;
    is_revisao: boolean;
    cor: string | null;
  }[];
  progresso: { topico_id: string; concluido: boolean; minutos_estudados: number }[];
  sessoes: {
    id: string;
    topico_id: string;
    data: string;
    questoes: number;
    acertos: number;
    percentual_acerto: number;
    tempo_estudado: string | null;
  }[];
  topicos: { id: string; titulo: string; materia_id: string }[];
  materias: { id: string; nome: string; cronograma_id: string }[];
};

export const getAlunoDetalhes = createServerFn({ method: "POST" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .inputValidator((input: { alunoId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdminOrModAccess(supabase, userId);

    const aId = data.alunoId;
    const [
      { data: prof },
      { data: ativ },
      { data: evs },
      { data: progs },
      { data: sess },
      { data: mats },
      { data: tops },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, friend_id")
        .eq("id", aId)
        .maybeSingle(),
      supabase
        .from("user_cronograma_ativacao")
        .select("cronograma_id, data_inicio, data_prova, ativo, cronogramas(nome)")
        .eq("user_id", aId)
        .eq("ativo", true),
      supabase
        .from("user_calendar_events")
        .select(
          "id, titulo, data, cronograma_id, materia_id, topico_id, concluido, is_revisao, cor",
        )
        .eq("user_id", aId)
        .order("data", { ascending: false })
        .limit(500),
      supabase
        .from("user_topico_progresso")
        .select("topico_id, concluido, minutos_estudados")
        .eq("user_id", aId),
      supabase
        .from("user_sessions")
        .select("id, topico_id, data, questoes, acertos, percentual_acerto, tempo_estudado")
        .eq("user_id", aId)
        .order("data", { ascending: false })
        .limit(200),
      supabase.from("cronograma_materias").select("id, nome, cronograma_id"),
      supabase.from("cronograma_topicos").select("id, titulo, materia_id"),
    ]);

    if (!prof) throw new Error("Aluno não encontrado");

    const cronogramas = (ativ ?? []).map((a: any) => ({
      id: a.cronograma_id,
      nome: a.cronogramas?.nome ?? "—",
      data_inicio: a.data_inicio,
      data_prova: a.data_prova,
    }));

    return {
      profile: prof,
      cronogramas,
      eventos: evs ?? [],
      progresso: progs ?? [],
      sessoes: sess ?? [],
      topicos: tops ?? [],
      materias: mats ?? [],
    } as AlunoDetalhes;
  });

export const adminUpdateAlunoEvento = createServerFn({ method: "POST" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .inputValidator(
    (input: { eventoId: string; data?: string; concluido?: boolean; titulo?: string }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdminOrModAccess(supabase, userId);
    const { eventoId, ...patch } = data;
    const { error } = await supabase
      .from("user_calendar_events")
      .update(patch)
      .eq("id", eventoId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteAlunoEvento = createServerFn({ method: "POST" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .inputValidator((input: { eventoId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdminOrModAccess(supabase, userId);
    const { error } = await supabase
      .from("user_calendar_events")
      .delete()
      .eq("id", data.eventoId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteAlunoSessao = createServerFn({ method: "POST" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .inputValidator((input: { sessaoId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdminOrModAccess(supabase, userId);
    const { error } = await supabase.from("user_sessions").delete().eq("id", data.sessaoId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminToggleAlunoTopico = createServerFn({ method: "POST" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .inputValidator((input: { alunoId: string; topicoId: string; concluido: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdminOrModAccess(supabase, userId);
    const { error } = await supabase.from("user_topico_progresso").upsert(
      {
        user_id: data.alunoId,
        topico_id: data.topicoId,
        concluido: data.concluido,
        concluido_em: data.concluido ? new Date().toISOString() : null,
      },
      { onConflict: "user_id,topico_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
