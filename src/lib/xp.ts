import { supabase } from "@/integrations/supabase/client";

// =====================================================
// CONFIGURAÇÃO DO SISTEMA DE XP
// =====================================================
export const XP_CONFIG = {
  // Limites diários anti-abuso
  MAX_HORAS_DIA: 6,
  MAX_QUESTOES_DIA: 100,

  // XP base
  XP_POR_HORA: 15, // por hora estudada (máx 6h = 90 XP/dia)
  XP_POR_10_QUESTOES: 8, // a cada 10 questões (máx 100 = 80 XP/dia)
  XP_BONUS_70: 5, // acerto ≥ 70% numa sessão
  XP_BONUS_90: 12, // acerto ≥ 90% numa sessão
  XP_TOPICO_CONCLUIDO: 10, // tópico concluído na matriz
  XP_STREAK_DIA: 5, // por dia de streak
  XP_BONUS_STREAK_7: 25, // bônus ao completar 7 dias
  XP_BONUS_STREAK_30: 100, // bônus ao completar 30 dias
  XP_META_COLETIVA: 30, // meta do grupo batida
  XP_DESAFIO_LIDER: 10, // desafio personalizado (teto máximo)
  XP_REVISAO_60: 20, // revisão concluída com ≥ 60%
} as const;

// =====================================================
// TABELA DE NÍVEIS
// =====================================================
export type NivelInfo = {
  nivel: number;
  nome: string;
  xp_minimo: number;
};

export const NIVEIS: NivelInfo[] = [
  { nivel: 0, nome: "🐭 Camundongo", xp_minimo: 0 },
  { nivel: 1, nome: "📚 Rato de Biblioteca", xp_minimo: 500 },
  { nivel: 2, nome: "📜 Rato de Lei Seca", xp_minimo: 2000 },
  { nivel: 3, nome: "✏️ Rato de Questões", xp_minimo: 5000 },
  { nivel: 4, nome: "🖊️ Rato de Discursivas", xp_minimo: 10000 },
  { nivel: 5, nome: "⭐ Rato de Elite", xp_minimo: 20000 },
  { nivel: 6, nome: "⚖️ Rato de Tribunal", xp_minimo: 40000 },
  { nivel: 7, nome: "🏆 Rato Imparável", xp_minimo: 80000 },
];

export const NIVEL_MAX = NIVEIS.length - 1;

export function calcularNivel(xp: number): number {
  for (let i = NIVEIS.length - 1; i >= 0; i--) {
    if (xp >= NIVEIS[i].xp_minimo) return NIVEIS[i].nivel;
  }
  return 0;
}

export function getNivelInfo(nivel: number): NivelInfo {
  return NIVEIS[nivel] ?? NIVEIS[0];
}

export type ProgressoNivel = {
  xp_faltando: number;
  xp_proximo: number;
  xp_no_nivel: number;
  xp_para_proximo: number;
  progresso: number; // 0-100
};

export function getXpProximoNivel(
  xp_total: number,
  nivel: number,
): ProgressoNivel | null {
  if (nivel >= NIVEL_MAX) return null;
  const atual = NIVEIS[nivel];
  const proximo = NIVEIS[nivel + 1];
  const xp_no_nivel = xp_total - atual.xp_minimo;
  const xp_para_proximo = proximo.xp_minimo - atual.xp_minimo;
  return {
    xp_faltando: Math.max(0, proximo.xp_minimo - xp_total),
    xp_proximo: proximo.xp_minimo,
    xp_no_nivel,
    xp_para_proximo,
    progresso: Math.min(
      100,
      Math.max(0, (xp_no_nivel / xp_para_proximo) * 100),
    ),
  };
}

// =====================================================
// CONCESSÃO DE XP COM LIMITES DIÁRIOS
// =====================================================

export type TipoXP =
  | "horas"
  | "questoes"
  | "bonus_acerto_70"
  | "bonus_acerto_90"
  | "topico_concluido"
  | "streak_dia"
  | "bonus_streak_7"
  | "bonus_streak_30"
  | "meta_coletiva"
  | "desafio_lider"
  | "revisao_60";

export type ConcederXPDados = {
  horas?: number;
  questoes?: number;
  valor_custom?: number; // para desafio_lider (com teto)
};

export type ConcederXPResultado = {
  xp_ganho: number;
  levelUp: boolean;
  nivel_novo: number;
  xp_total: number;
};

const ZERO_RES: ConcederXPResultado = {
  xp_ganho: 0,
  levelUp: false,
  nivel_novo: 0,
  xp_total: 0,
};

function hojeISO(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Concede XP para um usuário aplicando limites diários quando aplicável.
 * Retorna { xp_ganho: 0 } se o limite diário foi atingido.
 */
export async function concederXP(
  user_id: string,
  tipo: TipoXP,
  dados?: ConcederXPDados,
): Promise<ConcederXPResultado> {
  const hoje = hojeISO();

  // Buscar registro diário (pode não existir)
  const { data: diarioRow } = await supabase
    .from("user_xp_diario")
    .select("*")
    .eq("user_id", user_id)
    .eq("data", hoje)
    .maybeSingle();

  let xp_final = 0;
  let horas_hoje = Number(diarioRow?.horas_computadas ?? 0);
  let questoes_hoje = Number(diarioRow?.questoes_computadas ?? 0);

  switch (tipo) {
    case "horas": {
      const horas_brutas = dados?.horas ?? 0;
      const disponivel = Math.max(0, XP_CONFIG.MAX_HORAS_DIA - horas_hoje);
      const horas_validas = Math.min(horas_brutas, disponivel);
      if (horas_validas <= 0) return { ...ZERO_RES };
      xp_final = Math.floor(horas_validas * XP_CONFIG.XP_POR_HORA);
      horas_hoje += horas_validas;
      break;
    }
    case "questoes": {
      const q_brutas = dados?.questoes ?? 0;
      const disponivel = Math.max(0, XP_CONFIG.MAX_QUESTOES_DIA - questoes_hoje);
      const q_validas = Math.min(q_brutas, disponivel);
      if (q_validas <= 0) return { ...ZERO_RES };
      xp_final =
        Math.floor(q_validas / 10) * XP_CONFIG.XP_POR_10_QUESTOES;
      questoes_hoje += q_validas;
      break;
    }
    case "bonus_acerto_70":
      xp_final = XP_CONFIG.XP_BONUS_70;
      break;
    case "bonus_acerto_90":
      xp_final = XP_CONFIG.XP_BONUS_90;
      break;
    case "topico_concluido":
      xp_final = XP_CONFIG.XP_TOPICO_CONCLUIDO;
      break;
    case "streak_dia":
      xp_final = XP_CONFIG.XP_STREAK_DIA;
      break;
    case "bonus_streak_7":
      xp_final = XP_CONFIG.XP_BONUS_STREAK_7;
      break;
    case "bonus_streak_30":
      xp_final = XP_CONFIG.XP_BONUS_STREAK_30;
      break;
    case "meta_coletiva":
      xp_final = XP_CONFIG.XP_META_COLETIVA;
      break;
    case "desafio_lider": {
      const v = dados?.valor_custom ?? XP_CONFIG.XP_DESAFIO_LIDER;
      xp_final = Math.min(v, XP_CONFIG.XP_DESAFIO_LIDER);
      break;
    }
    case "revisao_60":
      xp_final = XP_CONFIG.XP_REVISAO_60;
      break;
  }

  if (xp_final <= 0) return { ...ZERO_RES };

  // Upsert do diário
  await supabase.from("user_xp_diario").upsert(
    {
      user_id,
      data: hoje,
      horas_computadas: horas_hoje,
      questoes_computadas: questoes_hoje,
      xp_ganho: Number(diarioRow?.xp_ganho ?? 0) + xp_final,
    },
    { onConflict: "user_id,data" },
  );

  // Buscar XP total e atualizar
  const { data: xpRow } = await supabase
    .from("user_xp")
    .select("xp_total, nivel")
    .eq("user_id", user_id)
    .maybeSingle();

  const nivel_anterior = xpRow?.nivel ?? 0;
  const xp_novo = (xpRow?.xp_total ?? 0) + xp_final;
  const nivel_novo = calcularNivel(xp_novo);
  const levelUp = nivel_novo > nivel_anterior;

  await supabase.from("user_xp").upsert(
    {
      user_id,
      xp_total: xp_novo,
      nivel: nivel_novo,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  return {
    xp_ganho: xp_final,
    levelUp,
    nivel_novo,
    xp_total: xp_novo,
  };
}
