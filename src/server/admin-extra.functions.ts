import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase as browserSupabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const attachAuthHeader = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await browserSupabase.auth.getSession();
  const token = data.session?.access_token;
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});

async function requireAdmin(supabase: any, userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Acesso negado");
}

// =================== Métricas Dashboard ===================

export type AdminDashMetrics = {
  totalUsers: number;
  online: number;
  ativos24h: number;
  bloqueados: number;
  assinaturasAtivas: number;
  cortesiasAtivas: number;
};

export const getAdminDashMetrics = createServerFn({ method: "POST" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);

    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const nowIso = now.toISOString();

    const [
      { count: totalUsers },
      { count: online },
      { count: ativos24h },
      { count: bloqueados },
      { data: assAtivas },
      { data: cortAtivas },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gt("last_seen", fiveMinAgo),
      supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gt("last_seen", dayAgo),
      supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("bloqueado", true),
      supabaseAdmin
        .from("assinaturas")
        .select("id, status, fim")
        .eq("status", "ativa"),
      supabaseAdmin
        .from("assinaturas")
        .select("id, status, fim")
        .eq("status", "cortesia"),
    ]);

    const stillValid = (rows: any[] | null) =>
      (rows ?? []).filter((r) => !r.fim || new Date(r.fim) > new Date(nowIso)).length;

    return {
      totalUsers: totalUsers ?? 0,
      online: online ?? 0,
      ativos24h: ativos24h ?? 0,
      bloqueados: bloqueados ?? 0,
      assinaturasAtivas: stillValid(assAtivas),
      cortesiasAtivas: stillValid(cortAtivas),
    } satisfies AdminDashMetrics;
  });

// =================== Perfil completo do usuário ===================

export type AdminUserProfile = {
  id: string;
  email: string | null;
  display_name: string | null;
  friend_id: string | null;
  telefone: string | null;
  bio: string | null;
  concurso_alvo: string | null;
  avatar_url: string | null;
  created_at: string;
  last_seen: string | null;
  bloqueado: boolean;
  plano_atual: string;
  roles: string[];
  assinatura: {
    id: string;
    status: string;
    inicio: string;
    fim: string | null;
    plano_nome: string | null;
    plano_tipo: string | null;
  } | null;
  metrics: {
    horasEstudadas: number;
    questoesFeitas: number;
    acertosMedio: number;
    streak: number;
    badges: number;
  };
};

export const getAdminUserProfile = createServerFn({ method: "POST" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);

    const id = data.userId;
    const [
      { data: profile },
      { data: roles },
      { data: ass },
      { data: progresso },
      { data: sessoes },
      { data: badges },
      authRes,
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", id).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", id),
      supabaseAdmin
        .from("assinaturas")
        .select("id, status, inicio, fim, planos(nome, tipo)")
        .eq("user_id", id)
        .order("inicio", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("user_topico_progresso")
        .select("minutos_estudados")
        .eq("user_id", id),
      supabaseAdmin
        .from("user_sessions")
        .select("questoes, acertos, percentual_acerto, data")
        .eq("user_id", id),
      supabaseAdmin.from("user_badges").select("id").eq("user_id", id),
      supabaseAdmin.auth.admin.getUserById(id),
    ]);

    if (!profile) throw new Error("Usuário não encontrado");

    const horasEstudadas = Math.round(
      ((progresso ?? []).reduce((s, p) => s + (p.minutos_estudados ?? 0), 0) / 60) * 10,
    ) / 10;
    const questoesFeitas = (sessoes ?? []).reduce((s, x) => s + (x.questoes ?? 0), 0);
    const acertos = (sessoes ?? []).reduce((s, x) => s + (x.acertos ?? 0), 0);
    const acertosMedio = questoesFeitas > 0 ? Math.round((acertos / questoesFeitas) * 100) : 0;

    // streak simples: dias consecutivos com sessão até hoje
    const dias = new Set((sessoes ?? []).map((s) => s.data));
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (dias.has(key)) streak++;
      else if (i > 0) break;
    }

    const assPlano = ass?.planos as any;
    return {
      id: profile.id,
      email: authRes.data?.user?.email ?? null,
      display_name: profile.display_name,
      friend_id: profile.friend_id,
      telefone: profile.telefone,
      bio: profile.bio,
      concurso_alvo: profile.concurso_alvo,
      avatar_url: profile.avatar_url,
      created_at: profile.created_at,
      last_seen: (profile as any).last_seen ?? null,
      bloqueado: (profile as any).bloqueado ?? false,
      plano_atual: profile.plano_atual ?? "gratuito",
      roles: (roles ?? []).map((r) => r.role as string),
      assinatura: ass
        ? {
            id: ass.id,
            status: ass.status,
            inicio: ass.inicio,
            fim: ass.fim,
            plano_nome: assPlano?.nome ?? null,
            plano_tipo: assPlano?.tipo ?? null,
          }
        : null,
      metrics: { horasEstudadas, questoesFeitas, acertosMedio, streak, badges: (badges ?? []).length },
    } satisfies AdminUserProfile;
  });

// =================== Toggle bloqueado ===================

export const toggleUserBloqueado = createServerFn({ method: "POST" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .inputValidator((input: { userId: string; bloqueado: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ bloqueado: data.bloqueado })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =================== Conceder cortesia / teste ===================

export const concederCortesia = createServerFn({ method: "POST" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .inputValidator(
    (input: {
      userId: string;
      dias: number;
      tipo?: "cortesia" | "teste";
      planoTipo?: "diamante" | "anual" | "trimestral" | "mensal";
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);

    const planoTipo = data.planoTipo ?? "diamante";

    const { data: plano } = await supabaseAdmin
      .from("planos")
      .select("id")
      .eq("tipo", planoTipo)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();

    const status = data.tipo ?? "cortesia";
    const fim = new Date(Date.now() + data.dias * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabaseAdmin.from("assinaturas").insert({
      user_id: data.userId,
      plano_id: plano?.id ?? null,
      status,
      inicio: new Date().toISOString(),
      fim,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =================== Reset de senha ===================

export const enviarResetSenha = createServerFn({ method: "POST" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .inputValidator((input: { email: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const siteUrl = process.env.SITE_URL ?? "https://lei-purpose-flow.lovable.app";
    const { error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
      options: { redirectTo: `${siteUrl}/auth` },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =================== Deletar usuário ===================

export const deletarUsuario = createServerFn({ method: "POST" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    if (data.userId === userId) throw new Error("Você não pode deletar a própria conta");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =================== Dados completos para relatório ===================

export type AdminUserReport = {
  profile: AdminUserProfile;
  cronogramas: {
    nome: string;
    total_topicos: number;
    concluidos: number;
    pct: number;
  }[];
  sessoes: {
    data: string;
    materia: string;
    topico: string;
    tempo: string;
    questoes: number;
    acertos: number;
    pct: number;
  }[];
  badges: { nome: string; data: string }[];
};

export const getAdminUserReport = createServerFn({ method: "POST" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);

    const id = data.userId;
    const profileRes = await getAdminUserProfile({ data: { userId: id } });

    const [
      { data: ativ },
      { data: progs },
      { data: sess },
      { data: mats },
      { data: tops },
      { data: ub },
      { data: badgesAll },
    ] = await Promise.all([
      supabaseAdmin
        .from("user_cronograma_ativacao")
        .select("cronograma_id, ativo, cronogramas(nome)")
        .eq("user_id", id)
        .eq("ativo", true),
      supabaseAdmin
        .from("user_topico_progresso")
        .select("topico_id, concluido")
        .eq("user_id", id),
      supabaseAdmin
        .from("user_sessions")
        .select("data, topico_id, questoes, acertos, percentual_acerto, tempo_estudado")
        .eq("user_id", id)
        .order("data", { ascending: false })
        .limit(500),
      supabaseAdmin.from("cronograma_materias").select("id, nome, cronograma_id"),
      supabaseAdmin.from("cronograma_topicos").select("id, titulo, materia_id"),
      supabaseAdmin
        .from("user_badges")
        .select("badge_id, desbloqueada_em")
        .eq("user_id", id),
      supabaseAdmin.from("badges").select("id, nome"),
    ]);

    const matById = new Map((mats ?? []).map((m) => [m.id, m]));
    const topById = new Map((tops ?? []).map((t) => [t.id, t]));
    const concluidosByTop = new Map(
      (progs ?? []).map((p) => [p.topico_id, p.concluido]),
    );

    const cronogramas = (ativ ?? []).map((a: any) => {
      const cronTops = (tops ?? []).filter((t) => {
        const m = matById.get(t.materia_id);
        return m && m.cronograma_id === a.cronograma_id;
      });
      const concluidos = cronTops.filter((t) => concluidosByTop.get(t.id)).length;
      const total = cronTops.length;
      return {
        nome: a.cronogramas?.nome ?? "—",
        total_topicos: total,
        concluidos,
        pct: total > 0 ? Math.round((concluidos / total) * 100) : 0,
      };
    });

    const sessoes = (sess ?? []).map((s) => {
      const t = topById.get(s.topico_id);
      const m = t ? matById.get(t.materia_id) : null;
      return {
        data: s.data,
        materia: m?.nome ?? "—",
        topico: t?.titulo ?? "—",
        tempo: s.tempo_estudado ?? "—",
        questoes: s.questoes,
        acertos: s.acertos,
        pct: s.percentual_acerto,
      };
    });

    const badgeNameById = new Map((badgesAll ?? []).map((b) => [b.id, b.nome]));
    const badges = (ub ?? []).map((b) => ({
      nome: badgeNameById.get(b.badge_id) ?? b.badge_id,
      data: b.desbloqueada_em,
    }));

    return { profile: profileRes, cronogramas, sessoes, badges } satisfies AdminUserReport;
  });
