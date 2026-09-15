interface TokenLogoProps {
  symbol: string;
  logo: string | null;
  size?: number;
}

export function TokenLogo({ symbol, logo, size = 32 }: TokenLogoProps) {
  if (logo) {
    return (
      <img
        src={logo}
        alt={symbol}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  const colors = ["bg-sky-500/20 text-sky-400", "bg-emerald-500/20 text-emerald-400", "bg-amber-500/20 text-amber-400", "bg-rose-500/20 text-rose-400", "bg-indigo-500/20 text-indigo-400"];
  const colorIdx = symbol.charCodeAt(0) % colors.length;
  const display = symbol.slice(0, 3).toUpperCase();

  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold ${colors[colorIdx]}`}
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {display}
    </div>
  );
}
