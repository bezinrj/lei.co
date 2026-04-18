type LogoProps = {
  size?: number;
  showTagline?: boolean;
};

export function Logo({ size = 28, showTagline = false }: LogoProps) {
  return (
    <div className="flex flex-col">
      <div
        className="font-serif leading-none text-text-main"
        style={{ fontSize: size, fontWeight: 500, letterSpacing: "-0.02em" }}
      >
        Lei<span className="text-sage-dark">.co</span>
      </div>
      {showTagline && (
        <span className="mt-1 text-[11px] text-text-muted">Estude com propósito</span>
      )}
    </div>
  );
}
