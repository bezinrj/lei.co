import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Upload, ImageIcon } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
};

export function NovoCronogramaDialog({ open, onOpenChange, onCreated }: Props) {
  const { isAdminOrMod } = useAuth();
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [premium, setPremium] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setNome("");
    setCategoria("");
    setPremium(false);
    setFile(null);
    setPreview(null);
  }

  function handleFile(f: File | null) {
    setFile(f);
    if (f) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Verifica se é admin/mod para decidir se é cronograma "próprio" do aluno
      let isStaff = false;
      if (user) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        isStaff = (roles ?? []).some(
          (r) => r.role === "admin" || r.role === "moderador",
        );
      }

      // Alunos só podem criar 1 cronograma pessoal
      if (!isStaff && user) {
        const { data: existente } = await supabase
          .from("cronogramas")
          .select("id")
          .eq("criado_por", user.id)
          .eq("is_proprio", true)
          .maybeSingle();
        if (existente) {
          toast.error("Você já possui um cronograma pessoal.");
          setSaving(false);
          return;
        }
      }

      let imagem_url: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop();
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("cronogramas-covers")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("cronogramas-covers").getPublicUrl(path);
        imagem_url = pub.publicUrl;
      }

      const categoriaFinal = isStaff
        ? (categoria.trim() || null)
        : "Cronograma Pessoal";

      const { error } = await supabase.from("cronogramas").insert({
        nome: nome.trim(),
        categoria: categoriaFinal,
        imagem_url,
        premium: isStaff ? premium : false,
        created_by: user?.id ?? null,
        criado_por: !isStaff ? user?.id ?? null : null,
        is_proprio: !isStaff,
      });
      if (error) throw error;

      toast.success("Cronograma criado!");
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao criar cronograma";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card sm:max-w-[440px] rounded-[14px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-[18px] text-text-main">
            Novo Cronograma
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div>
            <Label className="text-[12px] text-text-muted">
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Delegado de Polícia Civil - DF"
              required
              className="mt-1 bg-background"
            />
          </div>
          <div>
            <Label className="text-[12px] text-text-muted">Carreira / Categoria</Label>
            <Input
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Ex: Delegado"
              className="mt-1 bg-background"
            />
          </div>
          <div>
            <Label className="text-[12px] text-text-muted">Imagem de capa</Label>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-1 w-full border border-dashed border-border rounded-[12px] bg-background hover:bg-muted/50 transition-colors p-5 flex flex-col items-center justify-center gap-2"
            >
              {preview ? (
                <img
                  src={preview}
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
                Tamanho ideal: 540 × 720 px (proporção 3:4, JPG ou PNG)
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
          <Button
            type="submit"
            disabled={saving || !nome.trim()}
            className="w-full bg-sage-dark hover:bg-sage-dark/90 text-white rounded-[10px]"
          >
            {saving ? "Criando..." : "Criar"}
          </Button>
        </form>
        {/* placeholder so unused import is referenced */}
        <ImageIcon className="hidden" />
      </DialogContent>
    </Dialog>
  );
}
