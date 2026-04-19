import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { colorForMateria } from "@/lib/materia-color";

export type Fonte = {
  sigla: string;
  descricao: string;
  link_questoes: string;
  link_dod: string;
};

type Props = {
  cronogramaId: string;
  materias: { id: string; nome: string }[];
  onAdded: () => void;
};

export function NovoTopicoForm({ cronogramaId, materias, onAdded }: Props) {
  const [materia, setMateria] = useState("");
  const [assunto, setAssunto] = useState("");
  const [horas, setHoras] = useState(3);
  const [fontes, setFontes] = useState<Fonte[]>([
    { sigla: "", descricao: "", link_questoes: "", link_dod: "" },
  ]);
  const [saving, setSaving] = useState(false);

  function updateFonte(i: number, key: keyof Fonte, value: string) {
    setFontes((f) => f.map((x, idx) => (idx === i ? { ...x, [key]: value } : x)));
  }
  function addFonte() {
    setFontes((f) => [...f, { sigla: "", descricao: "", link_questoes: "", link_dod: "" }]);
  }
  function removeFonte(i: number) {
    setFontes((f) => f.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (!materia.trim() || !assunto.trim()) {
      toast.error("Preencha matéria e assunto");
      return;
    }
    setSaving(true);
    try {
      // Find or create matéria
      let materiaId = materias.find(
        (m) => m.nome.toLowerCase() === materia.trim().toLowerCase(),
      )?.id;
      if (!materiaId) {
        const { data: novaM, error: errM } = await supabase
          .from("cronograma_materias")
          .insert({
            cronograma_id: cronogramaId,
            nome: materia.trim(),
            cor: colorForMateria(materia.trim()),
            ordem: materias.length,
          })
          .select("id")
          .single();
        if (errM) throw errM;
        materiaId = novaM.id;
      }

      // Find next ordem
      const { count } = await supabase
        .from("cronograma_topicos")
        .select("*", { count: "exact", head: true })
        .eq("materia_id", materiaId);

      const fontesClean = fontes
        .filter((f) => f.sigla.trim() || f.descricao.trim())
        .map((f) => ({
          sigla: f.sigla.trim(),
          descricao: f.descricao.trim(),
          link_questoes: f.link_questoes.trim(),
          link_dod: f.link_dod.trim(),
        }));

      const { error } = await supabase.from("cronograma_topicos").insert({
        materia_id: materiaId,
        titulo: assunto.trim(),
        ordem: count ?? 0,
        horas_estimadas: horas,
        fontes: fontesClean,
      });
      if (error) throw error;

      setAssunto("");
      setHoras(3);
      setFontes([{ sigla: "", descricao: "", link_questoes: "", link_dod: "" }]);
      toast.success("Tópico adicionado");
      onAdded();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="lei-card mt-4">
      <h3 className="font-serif text-[15px] text-text-main mb-3">Adicionar tópico</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="text-[11px] text-text-muted mb-1 block">Matéria</label>
          <Input
            list="materias-list"
            value={materia}
            onChange={(e) => setMateria(e.target.value)}
            placeholder="Ex: Direito Constitucional"
            className="bg-background h-9"
          />
          <datalist id="materias-list">
            {materias.map((m) => (
              <option key={m.id} value={m.nome} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="text-[11px] text-text-muted mb-1 block">Assunto</label>
          <Input
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            placeholder="Ex: Princípios fundamentais"
            className="bg-background h-9"
          />
        </div>
        <div>
          <label className="text-[11px] text-text-muted mb-1 block">Horas estimadas</label>
          <Input
            type="number"
            min={1}
            value={horas}
            onChange={(e) => setHoras(Number(e.target.value) || 3)}
            className="bg-background h-9"
          />
        </div>
      </div>

      <div className="border-t border-border pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-medium text-text-main">Fontes legais</span>
          <Button size="sm" variant="outline" onClick={addFonte} className="h-7 text-[11px]">
            <Plus size={12} /> Adicionar fonte
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {fontes.map((f, i) => (
            <div
              key={i}
              className="grid grid-cols-[80px_1fr_1fr_1fr_28px] gap-2 items-center"
            >
              <Input
                value={f.sigla}
                onChange={(e) => updateFonte(i, "sigla", e.target.value)}
                placeholder="CF"
                className="bg-background h-8 text-[12px] font-semibold"
              />
              <Input
                value={f.descricao}
                onChange={(e) => updateFonte(i, "descricao", e.target.value)}
                placeholder="Art.1 ao Art.4"
                className="bg-background h-8 text-[12px]"
              />
              <Input
                value={f.link_questoes}
                onChange={(e) => updateFonte(i, "link_questoes", e.target.value)}
                placeholder="Link questões"
                className="bg-background h-8 text-[12px]"
              />
              <Input
                value={f.link_dod}
                onChange={(e) => updateFonte(i, "link_dod", e.target.value)}
                placeholder="Link DOD"
                className="bg-background h-8 text-[12px]"
              />
              <button
                onClick={() => removeFonte(i)}
                className="text-text-muted hover:text-destructive p-1"
                aria-label="Remover fonte"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <Button
          onClick={save}
          disabled={saving}
          className="bg-sage-dark hover:bg-sage-dark/90 text-white"
        >
          {saving ? "Salvando..." : "Adicionar tópico"}
        </Button>
      </div>
    </div>
  );
}
