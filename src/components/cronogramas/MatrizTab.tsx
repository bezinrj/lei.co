import { useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Topico = {
  id: string;
  titulo: string;
  duracao_minutos: number;
  materia_id: string;
  ordem: number;
};

type Materia = {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  topicos: Topico[];
};

type Props = {
  cronogramaId: string;
  materias: Materia[];
  canEdit: boolean;
  onChange: () => void;
};

export function MatrizTab({ cronogramaId, materias, canEdit, onChange }: Props) {
  const [novaMateria, setNovaMateria] = useState("");
  const [novoTopico, setNovoTopico] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, string>>({});

  async function addMateria() {
    const nome = novaMateria.trim();
    if (!nome) return;
    const { error } = await supabase.from("cronograma_materias").insert({
      cronograma_id: cronogramaId,
      nome,
      ordem: materias.length,
    });
    if (error) return toast.error(error.message);
    setNovaMateria("");
    onChange();
  }

  async function delMateria(id: string) {
    if (!confirm("Excluir esta matéria e todos seus tópicos?")) return;
    const { error } = await supabase.from("cronograma_materias").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onChange();
  }

  async function renameMateria(id: string, nome: string) {
    if (!nome.trim()) return;
    const { error } = await supabase
      .from("cronograma_materias")
      .update({ nome: nome.trim() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    setEditing((s) => ({ ...s, [id]: "" }));
    onChange();
  }

  async function addTopico(materiaId: string) {
    const titulo = (novoTopico[materiaId] ?? "").trim();
    if (!titulo) return;
    const m = materias.find((x) => x.id === materiaId);
    const ordem = m ? m.topicos.length : 0;
    const { error } = await supabase.from("cronograma_topicos").insert({
      materia_id: materiaId,
      titulo,
      ordem,
    });
    if (error) return toast.error(error.message);
    setNovoTopico((s) => ({ ...s, [materiaId]: "" }));
    onChange();
  }

  async function delTopico(id: string) {
    const { error } = await supabase.from("cronograma_topicos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onChange();
  }

  if (materias.length === 0 && !canEdit) {
    return (
      <div className="lei-card text-center py-12 text-text-muted text-[13px]">
        Este cronograma ainda não tem matérias.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {materias.map((m) => (
        <div key={m.id} className="lei-card">
          <div className="flex items-center justify-between mb-3">
            {editing[m.id] !== undefined && editing[m.id] !== "" ? (
              <div className="flex gap-2 flex-1">
                <Input
                  value={editing[m.id]}
                  onChange={(e) => setEditing((s) => ({ ...s, [m.id]: e.target.value }))}
                  className="bg-background h-8"
                />
                <Button size="sm" onClick={() => renameMateria(m.id, editing[m.id])}>
                  Salvar
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-6 rounded-full"
                  style={{ background: "var(--color-sage-dark)" }}
                />
                <h3 className="font-serif text-[16px] text-text-main">{m.nome}</h3>
                <span className="text-[11px] text-text-muted">({m.topicos.length})</span>
              </div>
            )}
            {canEdit && editing[m.id] === undefined && (
              <div className="flex gap-1">
                <button
                  onClick={() => setEditing((s) => ({ ...s, [m.id]: m.nome }))}
                  className="text-text-muted hover:text-text-main p-1"
                  aria-label="Editar"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => delMateria(m.id)}
                  className="text-text-muted hover:text-destructive p-1"
                  aria-label="Excluir"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
          <ul className="flex flex-col gap-1">
            {m.topicos.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between text-[13px] text-text-main py-1 px-2 rounded hover:bg-muted/50"
              >
                <span>{t.titulo}</span>
                {canEdit && (
                  <button
                    onClick={() => delTopico(t.id)}
                    className="text-text-muted hover:text-destructive opacity-0 hover:opacity-100 group-hover:opacity-100"
                    aria-label="Remover tópico"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {canEdit && (
            <div className="flex gap-2 mt-3">
              <Input
                value={novoTopico[m.id] ?? ""}
                onChange={(e) => setNovoTopico((s) => ({ ...s, [m.id]: e.target.value }))}
                placeholder="Novo tópico"
                className="bg-background h-8 text-[13px]"
                onKeyDown={(e) => e.key === "Enter" && addTopico(m.id)}
              />
              <Button size="sm" variant="outline" onClick={() => addTopico(m.id)}>
                <Plus size={14} />
              </Button>
            </div>
          )}
        </div>
      ))}

      {canEdit && (
        <div className="lei-card flex gap-2">
          <Input
            value={novaMateria}
            onChange={(e) => setNovaMateria(e.target.value)}
            placeholder="Nova matéria (ex: Direito Constitucional)"
            className="bg-background"
            onKeyDown={(e) => e.key === "Enter" && addMateria()}
          />
          <Button onClick={addMateria} className="bg-sage-dark hover:bg-sage-dark/90 text-white">
            <Plus size={16} /> Adicionar
          </Button>
        </div>
      )}
    </div>
  );
}