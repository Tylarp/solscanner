import type { Token } from "@/types";
import { formatPrice, formatUsd, formatNumber, formatPct, shortenAddress, timeAgo } from "@/lib/analysis";
import { TokenLogo } from "./TokenLogo";
import { ChangeBadge, RiskBadge } from "./Badge";
import { computeRiskReport } from "@/lib/analysis";

interface TokenRowProps {
  token: Token;
  onClick: (address: string) => void;
  onWatch: (token: Token) => void;
  isWatched: boolean;
}

export function TokenRow({ token, onClick, onWatch, isWatched }: TokenRowProps) {
  const risk = computeRiskReport(token);

  return (
    <tr
      className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer group"
      onClick={() => onClick(token.address)}
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <TokenLogo symbol={token.symbol} logo={token.logo} size={36} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-100 group-hover:text-sky-400 transition-colors">{token.symbol}</span>
              {token.graduated && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">GRAD</span>
              )}
            </div>
            <div className="text-xs text-slate-500 truncate max-w-[120px]">{token.name ?? shortenAddress(token.address)}</div>
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-right font-mono text-sm text-slate-300">{formatPrice(token.price)}</td>
      <td className="py-3 px-4 text-right font-mono text-sm text-slate-300">{formatUsd(token.market_cap)}</td>
      <td className="py-3 px-4 text-right font-mono text-sm text-slate-300">{formatUsd(token.liquidity)}</td>
      <td className="py-3 px-4 text-right font-mono text-sm text-slate-300">{formatUsd(token.volume_24h)}</td>
      <td className="py-3 px-4 text-right">
        <ChangeBadge value={token.price_change_24h} />
      </td>
      <td className="py-3 px-4 text-right font-mono text-sm text-slate-400">{formatNumber(token.holders)}</td>
      <td className="py-3 px-4 text-right">
        <RiskBadge cls={risk.riskClass} />
      </td>
      <td className="py-3 px-4 text-right text-xs text-slate-500">{timeAgo(token.created_at)}</td>
      <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onWatch(token)}
          className={`p-1.5 rounded-lg transition-colors ${
            isWatched ? "text-amber-400 hover:bg-amber-500/10" : "text-slate-600 hover:text-slate-400 hover:bg-slate-700/50"
          }`}
          title={isWatched ? "Remove from watchlist" : "Add to watchlist"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={isWatched ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      </td>
    </tr>
  );
}
