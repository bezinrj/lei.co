import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Topico = { id: string; titulo: string; materia_id: string; cor: string };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cronogramaId: string;
  userId: string;
  topicos: Topico[];
  onActivated: () => void;
};

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isoDate(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function AtivarDialog({ open, onOpenChange, cronogramaId, userId, topicos, onActivated }: Props) {
  const [dataInicio, setDataInicio] = useState<Date | undefined>(new Date());
  const [dataProva, setDataProva] = useState<Date | undefined>();
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!dataInicio || !dataProva) {
      toast.error("Selecione as duas datas");
      return;
    }
    if (dataProva <= dataInicio) {
      toast.error("Data da prova deve ser depois do início");
      return;
    }
    if (topicos.length === 0) {
      toast.error("Cronograma sem tópicos para distribuir");
      return;
    }
    setSaving(true);
    try {
      // Upsert ativacao
      const { error: ativErr } = await supabase.from("user_cronograma_ativacao").upsert(
        {
          user_id: userId,
          cronograma_id: cronogramaId,
          data_inicio: isoDate(dataInicio),
          data_prova: isoDate(dataProva),
          ativo: true,
        },
        { onConflict: "user_id,cronograma_id" } as never,
      );
      // Se não houver constraint, fallback para insert simples
      if (ativErr) {
        await supabase
          .from("user_cronograma_ativacao")
          .delete()
          .eq("user_id", userId)
          .eq("cronograma_id", cronogramaId);
        const { error: insErr } = await supabase.from("user_cronograma_ativacao").insert({
          user_id: userId,
          cronograma_id: cronogramaId,
          data_inicio: isoDate(dataInicio),
          data_prova: isoDate(dataProva),
          ativo: true,
        });
        if (insErr) throw insErr;
      }

      // Limpar eventos antigos deste cronograma
      await supabase
        .from("user_calendar_events")
        .delete()
        .eq("user_id", userId)
        .eq("cronograma_id", cronogramaId);

      // Coletar dias úteis (pula domingo = 0)
      const dias: Date[] = [];
      let cursor = new Date(dataInicio);
      while (cursor <= dataProva) {
        if (cursor.getDay() !== 0) dias.push(new Date(cursor));
        cursor = addDays(cursor, 1);
      }
      if (dias.length === 0) dias.push(new Date(dataInicio));

      // Distribuir tópicos balanceados (round-robin por dia)
      const eventos = topicos.map((t, i) => ({
        user_id: userId,
        cronograma_id: cronogramaId,
        materia_id: t.materia_id,
        topico_id: t.id,
        titulo: t.titulo,
        data: isoDate(dias[i % dias.length]),
        cor: t.cor,
        concluido: false,
      }));

      // Inserir em lotes de 500 (limite seguro)
      for (let i = 0; i < eventos.length; i += 500) {
        const batch = eventos.slice(i, i + 500);
        const { error } = await supabase.from("user_calendar_events").insert(batch);
        if (error) throw error;
      }

      toast.success("Cronograma ativado e distribuído!");
      onOpenChange(false);
      onActivated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao ativar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card sm:max-w-[420px] rounded-[14px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-[18px]">Ativar cronograma</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          <div>
            <Label className="text-[12px] text-text-muted">Data de início</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full mt-1 justify-start text-left font-normal bg-background",
                    !dataInicio && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Escolha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataInicio}
                  onSelect={setDataInicio}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label className="text-[12px] text-text-muted">Data da prova</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full mt-1 justify-start text-left font-normal bg-background",
                    !dataProva && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataProva ? format(dataProva, "dd/MM/yyyy") : "Escolha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataProva}
                  onSelect={setDataProva}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <p className="text-[11px] text-text-muted">
            Os {topicos.length} tópicos serão distribuídos automaticamente entre as datas (pula domingos).
          </p>
          <Button
            disabled={saving}
            onClick={handleSubmit}
            className="bg-sage-dark hover:bg-sage-dark/90 text-white rounded-[10px]"
          >
            {saving ? "Ativando..." : "Ativar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}