import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Papa from "papaparse";
import type { AdminUserReport } from "@/server/admin-extra.functions";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function downloadCSV(report: AdminUserReport) {
  const p = report.profile;
  const sections: string[] = [];

  sections.push(
    Papa.unparse({
      fields: ["Campo", "Valor"],
      data: [
        ["Nome", p.display_name ?? ""],
        ["Email", p.email ?? ""],
        ["Telefone", p.telefone ?? ""],
        ["Friend ID", p.friend_id ?? ""],
        ["ID", p.id],
        ["Roles", p.roles.join(", ")],
        ["Plano", p.plano_atual],
        ["Cadastro", fmtDate(p.created_at)],
        ["Última atividade", fmtDate(p.last_seen)],
        ["Bloqueado", p.bloqueado ? "Sim" : "Não"],
        ["Horas estudadas", String(p.metrics.horasEstudadas)],
        ["Questões feitas", String(p.metrics.questoesFeitas)],
        ["% médio acerto", `${p.metrics.acertosMedio}%`],
        ["Streak", String(p.metrics.streak)],
        ["Badges", String(p.metrics.badges)],
      ],
    }),
  );

  sections.push("\n\nProgresso por cronograma\n");
  sections.push(
    Papa.unparse(
      report.cronogramas.map((c) => ({
        Cronograma: c.nome,
        Concluídos: c.concluidos,
        Total: c.total_topicos,
        Percentual: `${c.pct}%`,
      })),
    ),
  );

  sections.push("\n\nHistórico de sessões\n");
  sections.push(
    Papa.unparse(
      report.sessoes.map((s) => ({
        Data: fmtDate(s.data),
        Matéria: s.materia,
        Tópico: s.topico,
        Tempo: s.tempo,
        Questões: s.questoes,
        Acertos: s.acertos,
        Percentual: `${s.pct}%`,
      })),
    ),
  );

  sections.push("\n\nBadges\n");
  sections.push(
    Papa.unparse(
      report.badges.map((b) => ({ Badge: b.nome, Desbloqueada: fmtDate(b.data) })),
    ),
  );

  const blob = new Blob([sections.join("\n")], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `relatorio_${p.display_name ?? p.id}.csv`);
}

export function downloadPDF(report: AdminUserReport) {
  const p = report.profile;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(61, 56, 48);
  doc.text("Lei.co", 40, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(120, 120, 120);
  doc.text("Relatório do aluno", 40, 68);
  doc.setDrawColor(220, 215, 200);
  doc.line(40, 80, pageWidth - 40, 80);

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(p.display_name ?? "Sem nome", 40, 110);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110, 110, 110);
  doc.text(`${p.email ?? "—"}  •  ${p.telefone ?? "Sem telefone"}`, 40, 126);
  doc.text(`Plano: ${p.plano_atual}  •  Membro desde ${fmtDate(p.created_at)}`, 40, 142);

  autoTable(doc, {
    startY: 160,
    head: [["Métrica", "Valor"]],
    body: [
      ["Horas estudadas", `${p.metrics.horasEstudadas}h`],
      ["Questões feitas", String(p.metrics.questoesFeitas)],
      ["% médio acerto", `${p.metrics.acertosMedio}%`],
      ["Streak atual", `${p.metrics.streak} dias`],
      ["Badges conquistadas", String(p.metrics.badges)],
    ],
    theme: "grid",
    headStyles: { fillColor: [184, 201, 176], textColor: [40, 40, 40] },
    styles: { fontSize: 10 },
  });

  const finalY1 = (doc as any).lastAutoTable.finalY + 20;
  autoTable(doc, {
    startY: finalY1,
    head: [["Cronograma", "Concluídos", "Total", "%"]],
    body: report.cronogramas.map((c) => [c.nome, c.concluidos, c.total_topicos, `${c.pct}%`]),
    theme: "grid",
    headStyles: { fillColor: [233, 198, 175], textColor: [40, 40, 40] },
    styles: { fontSize: 10 },
  });

  const finalY2 = (doc as any).lastAutoTable.finalY + 20;
  autoTable(doc, {
    startY: finalY2,
    head: [["Data", "Matéria", "Tópico", "Tempo", "Q", "✓", "%"]],
    body: report.sessoes.slice(0, 100).map((s) => [
      fmtDate(s.data),
      s.materia,
      s.topico,
      s.tempo,
      s.questoes,
      s.acertos,
      `${s.pct}%`,
    ]),
    theme: "striped",
    headStyles: { fillColor: [200, 187, 222], textColor: [40, 40, 40] },
    styles: { fontSize: 9 },
  });

  if (report.badges.length > 0) {
    const finalY3 = (doc as any).lastAutoTable.finalY + 20;
    autoTable(doc, {
      startY: finalY3,
      head: [["Badge", "Desbloqueada em"]],
      body: report.badges.map((b) => [b.nome, fmtDate(b.data)]),
      theme: "grid",
      headStyles: { fillColor: [184, 201, 176], textColor: [40, 40, 40] },
      styles: { fontSize: 10 },
    });
  }

  doc.save(`relatorio_${p.display_name ?? p.id}.pdf`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
