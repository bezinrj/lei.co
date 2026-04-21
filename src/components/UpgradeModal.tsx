import { useNavigate } from "@tanstack/react-router";
import { Lock, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  ctaLabel?: string;
};

export function UpgradeModal({
  open,
  onOpenChange,
  title = "Conteúdo Premium",
  description = "Este cronograma é premium. Adquira o acesso ou assine o Plano Diamante para liberar.",
  ctaLabel = "Ver planos",
}: Props) {
  const navigate = useNavigate();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="w-12 h-12 rounded-full bg-sage-light mx-auto flex items-center justify-center mb-2">
            <Lock className="text-sage-dark" size={20} />
          </div>
          <DialogTitle className="font-serif text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="bg-sage-dark hover:bg-sage-dark/90 text-white gap-2"
            onClick={() => {
              onOpenChange(false);
              navigate({ to: "/meu-plano" });
            }}
          >
            <Sparkles size={14} /> {ctaLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
