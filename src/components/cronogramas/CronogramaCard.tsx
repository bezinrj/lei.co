import { Calendar, Lock, Pencil, Copy, Trash2 } from "lucide-react";
import { useState } from "react";

type Props = {
  nome: string;
  imagem_url: string | null;
  premium: boolean;
  locked?: boolean;
  isProprio?: boolean;
  showActions?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
};

export function CronogramaCard({
  nome,
  imagem_url,
  premium,
  locked,
  isProprio,
  showActions,
  onClick,
  onEdit,
  onDuplicate,
  onDelete,
}: Props) {
  const [hovered, setHovered] = useState(false);

  function stop(e: React.MouseEvent, fn?: () => void) {
    e.stopPropagation();
    e.preventDefault();
    fn?.();
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative shrink-0 w-[160px] h-[213px] rounded-[12px] overflow-hidden border border-border bg-muted"
    >
      <button
        onClick={onClick}
        className="absolute inset-0 cursor-pointer transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-sage"
        aria-label={nome}
      >
        {imagem_url ? (
          <img src={imagem_url} alt={nome} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <Calendar size={32} className="text-text-muted" />
          </div>
        )}
      </button>

      {/* Badges */}
      <span
        className="absolute top-2 left-2 text-[10px] font-medium rounded-[20px] px-2 py-[2px] pointer-events-none"
        style={
          isProprio
            ? { background: "var(--color-sage-light)", color: "var(--color-sage-dark)" }
            : premium
              ? { background: "#FAC775", color: "#633806" }
              : { background: "var(--color-sage-light)", color: "var(--color-sage-dark)" }
        }
      >
        {isProprio ? "Meu" : premium ? "Premium" : "Gratuito"}
      </span>

      {locked && (
        <div className="absolute inset-0 bg-black/35 flex items-center justify-center pointer-events-none">
          <div className="w-9 h-9 rounded-full bg-white/95 flex items-center justify-center shadow">
            <Lock size={16} className="text-text-main" />
          </div>
        </div>
      )}

      {/* Hover actions (admin/mod) */}
      {showActions && (
        <div
          className="absolute top-2 right-2 flex gap-1 transition-opacity"
          style={{ opacity: hovered ? 1 : 0 }}
        >
          {onEdit && (
            <button
              type="button"
              title="Editar"
              onClick={(e) => stop(e, onEdit)}
              className="w-7 h-7 rounded-[8px] bg-white/95 border border-border hover:bg-white flex items-center justify-center text-text-main shadow-sm"
            >
              <Pencil size={13} />
            </button>
          )}
          {onDuplicate && (
            <button
              type="button"
              title="Duplicar"
              onClick={(e) => stop(e, onDuplicate)}
              className="w-7 h-7 rounded-[8px] bg-white/95 border border-border hover:bg-white flex items-center justify-center text-text-main shadow-sm"
            >
              <Copy size={13} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              title="Excluir"
              onClick={(e) => stop(e, onDelete)}
              className="w-7 h-7 rounded-[8px] bg-white/95 border border-border hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center text-text-main shadow-sm"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      )}

      {/* Bottom gradient + name */}
      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none">
        <div className="text-[13px] text-white text-left leading-tight line-clamp-3">{nome}</div>
      </div>
    </div>
  );
}
