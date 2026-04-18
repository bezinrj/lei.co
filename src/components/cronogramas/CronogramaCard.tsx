import { Calendar } from "lucide-react";

type Props = {
  nome: string;
  imagem_url: string | null;
  premium: boolean;
  onClick?: () => void;
};

export function CronogramaCard({ nome, imagem_url, premium, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="relative shrink-0 w-[160px] h-[213px] rounded-[12px] overflow-hidden border border-border bg-muted cursor-pointer transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-sage"
    >
      {imagem_url ? (
        <img src={imagem_url} alt={nome} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          <Calendar size={32} className="text-text-muted" />
        </div>
      )}

      {/* Badge */}
      <span
        className="absolute top-2 left-2 text-[10px] font-medium rounded-[20px] px-2 py-[2px]"
        style={
          premium
            ? { background: "#FAC775", color: "#633806" }
            : { background: "var(--color-sage-light)", color: "var(--color-sage-dark)" }
        }
      >
        {premium ? "Premium" : "Gratuito"}
      </span>

      {/* Bottom gradient + name */}
      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
        <div className="text-[13px] text-white text-left leading-tight line-clamp-3">{nome}</div>
      </div>
    </button>
  );
}
