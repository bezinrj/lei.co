import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listAlunos,
  getAlunoDetalhes,
  adminDeleteAlunoEvento,
  adminUpdateAlunoEvento,
  adminDeleteAlunoSessao,
  adminToggleAlunoTopico,
  type AlunoListItem,
  type AlunoDetalhes,
} from "@/server/admin.functions";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, ArrowLeft, Trash2, Calendar, BookOpen, Activity, RefreshCw, Download, Mail, Phone, Crown } from "lucide-react";
import { toast } from "sonner";

export function AlunosAdminTab() {
  const [alunos, setAlunos] = useState<AlunoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAlunos();
      setAlunos(res?.alunos ?? []);
    } catch {
      toast.error("Erro ao carregar alunos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = alunos.filter((a) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      (a.display_name ?? "").toLowerCase().includes(q) ||
      (a.friend_id ?? "").toLowerCase().includes(q)
    );
  });

  if (selected) {
    return <AlunoDetail alunoId={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="relative w-full max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou Friend ID..."
            className="pl-9 bg-background"
          />
        </div>
        <button onClick={load} className="text-[12px] text-text-muted hover:text-text-main">
          Atualizar
        </button>
      </div>

      <div className="lei-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/50 text-text-muted text-[11px] uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">Aluno</th>
                <th className="text-left px-4 py-3">Friend ID</th>
                <th className="text-center px-4 py-3">Cronogramas ativos</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-text-muted">
                    Carregando...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-text-muted">
                    Nenhum aluno encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr
                    key={a.id}
                    className="border-t border-border hover:bg-muted/20 cursor-pointer"
                    onClick={() => setSelected(a.id)}
                  >
                    <td className="px-4 py-3 text-text-main font-medium">
                      {a.display_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-text-muted">
                      {a.friend_id ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">{a.ativacoes}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-[12px] text-sage-dark hover:underline">Abrir →</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// =================== Detalhe do aluno ===================

function AlunoDetail({ alunoId, onBack }: { alunoId: string; onBack: () => void }) {
  const [data, setData] = useState<AlunoDetalhes | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"calendario" | "progresso" | "sessoes">("calendario");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAlunoDetalhes({ data: { alunoId } });
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar aluno");
    } finally {
      setLoading(false);
    }
  }, [alunoId]);

  useEffect(() => {
    load();
  }, [load]);

  const topicoMap = useMemo(() => {
    if (!data) return new Map<string, { titulo: string; materia: string }>();
    const matMap = new Map(data.materias.map((m) => [m.id, m.nome]));
    return new Map(
      data.topicos.map((t) => [
        t.id,
        { titulo: t.titulo, materia: matMap.get(t.materia_id) ?? "—" },
      ]),
    );
  }, [data]);

  if (loading) {
    return (
      <div className="lei-card text-center py-12 text-text-muted text-[13px]">Carregando...</div>
    );
  }
  if (!data) {
    return (
      <div className="lei-card text-center py-12 text-text-muted text-[13px]">
        Aluno não encontrado
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-[13px] text-text-muted hover:text-text-main mb-4"
      >
        <ArrowLeft size={14} /> Voltar para a lista
      </button>

      <div className="lei-card mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-serif text-[20px] text-text-main">
                {data.profile.display_name ?? "—"}
              </h2>
              {data.profile.plano === "premium" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-amber-100 to-amber-200 text-amber-900 border border-amber-300">
                  <Crown size={12} className="fill-current" /> 👑 Diamante
                </span>
              )}
            </div>
            <div className="font-mono text-[11px] text-text-muted mt-0.5">
              {data.profile.friend_id}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
              <a
                href={data.profile.email ? `mailto:${data.profile.email}` : undefined}
                className={`inline-flex items-center gap-1.5 ${
                  data.profile.email
                    ? "text-text-main hover:underline"
                    : "text-text-muted pointer-events-none"
                }`}
              >
                <Mail size={13} className="text-text-muted" />
                {data.profile.email ?? "Email não informado"}
              </a>
              {data.profile.telefone ? (
                <a
                  href={`tel:${data.profile.telefone.replace(/\D/g, "")}`}
                  className="inline-flex items-center gap-1.5 text-text-main hover:underline"
                >
                  <Phone size={13} className="text-text-muted" />
                  {data.profile.telefone}
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-text-muted">
                  <Phone size={13} />
                  Não informado
                </span>
              )}
            </div>
          </div>
          <button onClick={load} className="text-[12px] text-text-muted hover:text-text-main shrink-0">
            <RefreshCw size={14} className="inline mr-1" /> Atualizar
          </button>
        </div>

        {data.cronogramas.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {data.cronogramas.map((c) => (
              <span
                key={c.id}
                className="text-[11px] px-2 py-1 rounded-[20px] bg-sage-light text-sage-dark"
              >
                {c.nome} · prova {new Date(c.data_prova + "T00:00").toLocaleDateString("pt-BR")}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex bg-muted rounded-full p-1 text-[12px] w-fit mb-4">
        {(
          [
            { k: "calendario", label: "Calendário", icon: Calendar },
            { k: "progresso", label: "Progresso", icon: BookOpen },
            { k: "sessoes", label: "Sessões", icon: Activity },
          ] as const
        ).map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 transition-colors ${
              tab === t.k
                ? "bg-card text-text-main shadow-sm"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "calendario" && (
        <CalendarioAdminView eventos={data.eventos} topicoMap={topicoMap} onChange={load} />
      )}
      {tab === "progresso" && (
        <ProgressoAdminView
          alunoId={alunoId}
          progresso={data.progresso}
          topicoMap={topicoMap}
          onChange={load}
        />
      )}
      {tab === "sessoes" && (
        <SessoesAdminView
          sessoes={data.sessoes}
          topicoMap={topicoMap}
          onChange={load}
          alunoNome={data.profile.display_name ?? data.profile.friend_id ?? "aluno"}
        />
      )}
    </div>
  );
}

function CalendarioAdminView({
  eventos,
  topicoMap,
  onChange,
}: {
  eventos: AlunoDetalhes["eventos"];
  topicoMap: Map<string, { titulo: string; materia: string }>;
  onChange: () => void;
}) {
  async function toggleConcluido(eId: string, v: boolean) {
    try {
      await adminUpdateAlunoEvento({ data: { eventoId: eId, concluido: v } });
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }
  async function alterarData(eId: string, novaData: string) {
    try {
      await adminUpdateAlunoEvento({ data: { eventoId: eId, data: novaData } });
      toast.success("Data atualizada");
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }
  async function deletar(eId: string) {
    if (!confirm("Excluir evento?")) return;
    try {
      await adminDeleteAlunoEvento({ data: { eventoId: eId } });
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <div className="lei-card p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/50 text-text-muted text-[11px] uppercase tracking-wider">
            <tr>
              <th className="text-center px-4 py-3 w-12">OK</th>
              <th className="text-left px-4 py-3">Data</th>
              <th className="text-left px-4 py-3">Título</th>
              <th className="text-left px-4 py-3">Tipo</th>
              <th className="text-right px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {eventos.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-text-muted">
                  Nenhum evento.
                </td>
              </tr>
            ) : (
              eventos.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-4 py-3 text-center">
                    <Checkbox
                      checked={e.concluido}
                      onCheckedChange={(v) => toggleConcluido(e.id, !!v)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="date"
                      defaultValue={e.data}
                      onBlur={(ev) => {
                        if (ev.target.value !== e.data) alterarData(e.id, ev.target.value);
                      }}
                      className="bg-background border border-border rounded-[6px] px-2 py-1 text-[12px]"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {e.cor && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: e.cor }}
                        />
                      )}
                      <span className={e.concluido ? "line-through text-text-muted" : "text-text-main"}>
                        {e.titulo}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {e.is_revisao ? (
                      <span className="text-[10px] px-2 py-[2px] rounded-full bg-lilac/30 text-text-main">
                        Revisão
                      </span>
                    ) : (
                      <span className="text-[10px] text-text-muted">Estudo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deletar(e.id)}
                      className="p-1.5 rounded-[6px] hover:bg-destructive/10 text-text-muted hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProgressoAdminView({
  alunoId,
  progresso,
  topicoMap,
  onChange,
}: {
  alunoId: string;
  progresso: AlunoDetalhes["progresso"];
  topicoMap: Map<string, { titulo: string; materia: string }>;
  onChange: () => void;
}) {
  async function toggle(topicoId: string, v: boolean) {
    try {
      await adminToggleAlunoTopico({ data: { alunoId, topicoId, concluido: v } });
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <div className="lei-card p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/50 text-text-muted text-[11px] uppercase tracking-wider">
            <tr>
              <th className="text-center px-4 py-3 w-12">OK</th>
              <th className="text-left px-4 py-3">Tópico</th>
              <th className="text-left px-4 py-3">Matéria</th>
              <th className="text-right px-4 py-3">Min. estudados</th>
            </tr>
          </thead>
          <tbody>
            {progresso.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-10 text-text-muted">
                  Sem progresso registrado.
                </td>
              </tr>
            ) : (
              progresso.map((p) => {
                const info = topicoMap.get(p.topico_id);
                return (
                  <tr key={p.topico_id} className="border-t border-border">
                    <td className="px-4 py-3 text-center">
                      <Checkbox
                        checked={p.concluido}
                        onCheckedChange={(v) => toggle(p.topico_id, !!v)}
                      />
                    </td>
                    <td className="px-4 py-3 text-text-main">{info?.titulo ?? "—"}</td>
                    <td className="px-4 py-3 text-text-muted">{info?.materia ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{p.minutos_estudados}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SessoesAdminView({
  sessoes,
  topicoMap,
  onChange,
  alunoNome,
}: {
  sessoes: AlunoDetalhes["sessoes"];
  topicoMap: Map<string, { titulo: string; materia: string }>;
  onChange: () => void;
  alunoNome: string;
}) {
  async function deletar(sId: string) {
    if (!confirm("Excluir sessão?")) return;
    try {
      await adminDeleteAlunoSessao({ data: { sessaoId: sId } });
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  function exportarCSV() {
    if (sessoes.length === 0) {
      toast.error("Nenhuma sessão para exportar");
      return;
    }
    const headers = ["Data", "Matéria", "Tópico", "Questões", "Acertos", "% Acerto", "Tempo Estudado"];
    const escape = (v: string | number) => {
      const s = String(v ?? "");
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = sessoes.map((s) => {
      const info = topicoMap.get(s.topico_id);
      return [
        s.data,
        info?.materia ?? "",
        info?.titulo ?? "",
        s.questoes,
        s.acertos,
        s.percentual_acerto,
        s.tempo_estudado ?? "",
      ].map(escape).join(",");
    });
    const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = alunoNome.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `sessoes-${slug || "aluno"}-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`${sessoes.length} sessões exportadas`);
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          onClick={exportarCSV}
          disabled={sessoes.length === 0}
          className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-[6px] border border-border bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed text-text-main"
        >
          <Download size={13} /> Exportar CSV
        </button>
      </div>
      <div className="lei-card p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/50 text-text-muted text-[11px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3">Data</th>
              <th className="text-left px-4 py-3">Tópico</th>
              <th className="text-right px-4 py-3">Questões</th>
              <th className="text-right px-4 py-3">Acertos</th>
              <th className="text-right px-4 py-3">%</th>
              <th className="text-right px-4 py-3">Tempo</th>
              <th className="text-right px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {sessoes.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-text-muted">
                  Nenhuma sessão registrada.
                </td>
              </tr>
            ) : (
              sessoes.map((s) => {
                const info = topicoMap.get(s.topico_id);
                return (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-4 py-3 text-text-muted">
                      {new Date(s.data + "T00:00").toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-text-main">{info?.titulo ?? "—"}</div>
                      <div className="text-[11px] text-text-muted">{info?.materia ?? ""}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{s.questoes}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{s.acertos}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span
                        className="font-medium"
                        style={{ color: s.percentual_acerto >= 60 ? "#1D9E75" : "#D85A30" }}
                      >
                        {s.percentual_acerto}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-text-muted">
                      {s.tempo_estudado ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => deletar(s.id)}
                        className="p-1.5 rounded-[6px] hover:bg-destructive/10 text-text-muted hover:text-destructive"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}
