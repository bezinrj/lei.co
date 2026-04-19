import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { updateCronograma, type AdminCronograma } from "@/server/admin.functions";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cronograma: AdminCronograma | null;
  onSaved: () => void;
};

export function EditarCronogramaDialog({ open, onOpenChange, cronograma, onSaved }: Props) {
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [premium, setPremium] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (cronograma) {
      setNome(cronograma.nome);
      setCategoria(cronograma.categoria ?? "");
      setPremium(cronograma.premium);
    }
  }, [cronograma]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cronograma || !nome.trim()) return;
    setSaving(true);
    try {
      await updateCronograma({
        data: {
          id: cronograma.id,
          nome: nome.trim(),
          categoria: categoria.trim() || null,
          premium,
        },
      });
      toast.success("Cronograma atualizado");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card sm:max-w-[440px] rounded-[14px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-[18px] text-text-main">
            Editar Cronograma
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div>
            <Label className="text-[12px] text-text-muted">Nome</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              className="mt-1 bg-background"
            />
          </div>
          <div>
            <Label className="text-[12px] text-text-muted">Categoria</Label>
            <Input
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="mt-1 bg-background"
            />
          </div>
          <div className="flex items-center justify-between rounded-[10px] bg-background border border-border px-3 py-2">
            <div>
              <div className="text-[13px] text-text-main">Premium</div>
              <div className="text-[11px] text-text-muted">Restrito a assinantes</div>
            </div>
            <Switch checked={premium} onCheckedChange={setPremium} />
          </div>
          <Button
            type="submit"
            disabled={saving}
            className="w-full bg-sage-dark hover:bg-sage-dark/90 text-white rounded-[10px]"
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
