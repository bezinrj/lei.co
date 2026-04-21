import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { updateCronograma, type AdminCronograma } from "@/server/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload } from "lucide-react";

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
  const [precoCentavos, setPrecoCentavos] = useState<string>("");
  const [stripePriceId, setStripePriceId] = useState("");
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cronograma) {
      setNome(cronograma.nome);
      setCategoria(cronograma.categoria ?? "");
      setPremium(cronograma.premium);
      setPrecoCentavos(
        cronograma.preco_centavos != null ? String(cronograma.preco_centavos) : "",
      );
      setStripePriceId(cronograma.stripe_price_id ?? "");
      setImagemUrl(cronograma.imagem_url);
      setFile(null);
      setPreview(null);
    }
  }, [cronograma]);

  function handleFile(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cronograma || !nome.trim()) return;
    setSaving(true);
    try {
      let novaImagem = imagemUrl;
      if (file) {
        const ext = file.name.split(".").pop();
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("cronogramas-covers")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("cronogramas-covers").getPublicUrl(path);
        novaImagem = pub.publicUrl;
      }

      const precoNum = precoCentavos.trim() ? Number(precoCentavos) : null;
      if (premium && precoNum !== null && (Number.isNaN(precoNum) || precoNum < 0)) {
        throw new Error("Preço inválido");
      }

      await updateCronograma({
        data: {
          id: cronograma.id,
          nome: nome.trim(),
          categoria: categoria.trim() || null,
          premium,
          imagem_url: novaImagem,
          preco_centavos: premium ? precoNum : null,
          stripe_price_id: premium ? stripePriceId.trim() || null : null,
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
      <DialogContent className="bg-card sm:max-w-[460px] rounded-[14px] max-h-[90vh] overflow-y-auto">
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

          <div>
            <Label className="text-[12px] text-text-muted">Imagem de capa</Label>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-1 w-full border border-dashed border-border rounded-[12px] bg-background hover:bg-muted/50 transition-colors p-4 flex flex-col items-center justify-center gap-2"
            >
              {preview || imagemUrl ? (
                <img
                  src={preview ?? imagemUrl ?? ""}
                  alt="prévia"
                  className="w-20 h-[107px] object-cover rounded-[8px]"
                />
              ) : (
                <>
                  <Upload size={20} className="text-text-muted" />
                  <span className="text-[12px] text-text-main">Clique para enviar imagem</span>
                </>
              )}
              <span className="text-[10px] text-text-muted text-center">
                Tamanho ideal: 540 × 720 px (3:4)
              </span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="flex items-center justify-between rounded-[10px] bg-background border border-border px-3 py-2">
            <div>
              <div className="text-[13px] text-text-main">Premium</div>
              <div className="text-[11px] text-text-muted">Restrito a assinantes</div>
            </div>
            <Switch checked={premium} onCheckedChange={setPremium} />
          </div>

          {premium && (
            <>
              <div>
                <Label className="text-[12px] text-text-muted">
                  Preço em centavos (ex: 4990 = R$ 49,90)
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={precoCentavos}
                  onChange={(e) => setPrecoCentavos(e.target.value)}
                  placeholder="4990"
                  className="mt-1 bg-background"
                />
              </div>
              <div>
                <Label className="text-[12px] text-text-muted">Stripe Price ID (opcional)</Label>
                <Input
                  value={stripePriceId}
                  onChange={(e) => setStripePriceId(e.target.value)}
                  placeholder="price_..."
                  className="mt-1 bg-background"
                />
              </div>
            </>
          )}

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
