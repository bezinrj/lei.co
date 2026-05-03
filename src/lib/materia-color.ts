// Cores determinísticas por matéria.
// Paleta unificada — toda matéria devolve { background, color, border }.
//
// - getCorMateriaPastel: paleta usada em badges, pills, fundos suaves
// - getCorMateria: cor SÓLIDA (border) usada em pills do calendário,
//   bolinhas de legenda, coluna `cor` salva no banco, etc.

export type MateriaPastel = { background: string; color: string; border: string };

function normalize(materia: string): string {
  return (materia || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Paleta principal — pastel + texto escuro + cor sólida (border). */
export function getCorMateriaPastel(materia: string): MateriaPastel {
  const m = normalize(materia);

  // Verificações com duas palavras SEMPRE antes das genéricas
  if (m.includes("processo civil") || m.includes("processual civil"))
    return { border: "#A0522D", background: "#F5EAE6", color: "#5C2010" };

  if (m.includes("processo penal") || m.includes("processual penal"))
    return { border: "#C0392B", background: "#FDECEA", color: "#5C1008" };

  if (m.includes("constitucional"))
    return { border: "#BA7517", background: "#FAEEDA", color: "#412402" };

  if (m.includes("civil"))
    return { border: "#1D9E75", background: "#E1F5EE", color: "#085041" };

  if (m.includes("penal"))
    return { border: "#E8750A", background: "#FEF0E3", color: "#5C2800" };

  if (m.includes("administrativo"))
    return { border: "#F472B6", background: "#FDE8F4", color: "#7C1A5A" };

  if (m.includes("empresarial"))
    return { border: "#7F77DD", background: "#EEEDFE", color: "#26215C" };

  if (m.includes("tributario") || m.includes("tributário"))
    return { border: "#7B52D4", background: "#EDE8FA", color: "#2D1A6E" };

  if (m.includes("revisao") || m.includes("revisão"))
    return { border: "#9B6DCC", background: "#F0EAF8", color: "#3D1A6E" };

  if (m.includes("simulado"))
    return { border: "#B06DB0", background: "#F5EAF5", color: "#4A1A4A" };

  return { border: "#888780", background: "#F1EFE8", color: "#444441" };
}

/** Cor SÓLIDA da matéria (= border da paleta). */
export function getCorMateria(materia: string): string {
  return getCorMateriaPastel(materia).border;
}

/**
 * Mantido para retrocompatibilidade. Retorna a cor SÓLIDA derivada do nome
 * (o segundo argumento é ignorado).
 */
export function colorForMateria(nome: string, _stored?: string | null): string {
  return getCorMateria(nome);
}
