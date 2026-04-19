import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  listAdminCronogramas,
  deleteCronograma,
  duplicateCronograma,
  type AdminCronograma,
} from "@/server/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, ExternalLink, Search, Crown, Users, Copy } from "lucide-react";
import { toast } from "sonner";
import { NovoCronogramaDialog } from "@/components/cronogramas/NovoCronogramaDialog";
import { EditarCronogramaDialog } from "./EditarCronogramaDialog";

export function CronogramasAdminTab() {
  const [items, setItems] = useState<AdminCronograma[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [novoOpen, setNovoOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCronograma | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAdminCronogramas();
      setItems(res?.cronogramas ?? []);
    } catch (e) {
      toast.error("Erro ao carregar cronogramas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(c: AdminCronograma) {
    if (
      !confirm(
        `Excluir "${c.nome}"?\n\nTodos os tópicos, eventos de calendário e ativações serão removidos. Esta ação é irreversível.`,
      )
    )
      return;
    try {
      await deleteCronograma({ data: { id: c.id } });
      toast.success("Cronograma excluído");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    }
  }

  const filtered = items.filter((c) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return c.nome.toLowerCase().includes(q) || (c.categoria ?? "").toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="relative w-full max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cronograma..."
            className="pl-9 bg-background"
          />
        </div>
        <Button
          onClick={() => setNovoOpen(true)}
          className="bg-sage-dark hover:bg-sage-dark/90 text-white rounded-[10px] gap-2"
        >
          <Plus size={14} /> Novo Cronograma
        </Button>
      </div>

      <div className="lei-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/50 text-text-muted text-[11px] uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">Cronograma</th>
                <th className="text-left px-4 py-3">Categoria</th>
                <th className="text-center px-4 py-3">Matérias</th>
                <th className="text-center px-4 py-3">Tópicos</th>
                <th className="text-center px-4 py-3">Alunos ativos</th>
                <th className="text-center px-4 py-3">Plano</th>
                <th className="text-right px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-text-muted">
                    Carregando...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-text-muted">
                    Nenhum cronograma encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {c.imagem_url ? (
                          <img
                            src={c.imagem_url}
                            alt=""
                            className="w-9 h-12 object-cover rounded-[6px] border border-border"
                          />
                        ) : (
                          <div className="w-9 h-12 rounded-[6px] bg-muted border border-border" />
                        )}
                        <div className="text-text-main font-medium">{c.nome}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-muted">{c.categoria ?? "—"}</td>
                    <td className="px-4 py-3 text-center tabular-nums">{c.total_materias}</td>
                    <td className="px-4 py-3 text-center tabular-nums">{c.total_topicos}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-text-main tabular-nums">
                        <Users size={12} className="text-text-muted" />
                        {c.total_alunos_ativos}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.premium ? (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-medium rounded-[20px] px-2 py-[2px]"
                          style={{ background: "#FAC775", color: "#633806" }}
                        >
                          <Crown size={10} /> Premium
                        </span>
                      ) : (
                        <span className="inline-block text-[10px] font-medium rounded-[20px] px-2 py-[2px] bg-sage-light text-sage-dark">
                          Gratuito
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          to="/cronograma/$id"
                          params={{ id: c.id }}
                          className="p-1.5 rounded-[6px] hover:bg-muted text-text-muted hover:text-text-main"
                          title="Gerenciar matriz"
                        >
                          <ExternalLink size={14} />
                        </Link>
                        <button
                          onClick={() => setEditing(c)}
                          className="p-1.5 rounded-[6px] hover:bg-muted text-text-muted hover:text-text-main"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          className="p-1.5 rounded-[6px] hover:bg-destructive/10 text-text-muted hover:text-destructive"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-text-muted mt-3">
        Para gerenciar matérias e tópicos (adicionar, editar, reordenar), abra o cronograma
        clicando em <ExternalLink size={10} className="inline" /> e use a aba <strong>Matriz</strong>.
      </p>

      <NovoCronogramaDialog open={novoOpen} onOpenChange={setNovoOpen} onCreated={load} />
      <EditarCronogramaDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        cronograma={editing}
        onSaved={load}
      />
    </div>
  );
}
