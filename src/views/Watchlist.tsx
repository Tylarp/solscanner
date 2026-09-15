import { useEffect, useState, useCallback } from "react";
import type { WatchlistEntry, Token } from "@/types";
import { supabase } from "@/lib/supabase";
import { fetchTokenDetail } from "@/lib/api";
import { TokenLogo } from "@/components/TokenLogo";
import { RiskBadge, ChangeBadge } from "@/components/Badge";
import { computeRiskReport, formatPrice, formatUsd, formatNumber, formatPct, timeAgo, shortenAddress } from "@/lib/analysis";
import { Star, Trash2, Loader2, ExternalLink } from "lucide-react";

interface WatchlistProps {
  watchlist: WatchlistEntry[];
  onTokenClick: (address: string) => void;
  onRemove: (id: string) => void;
  refreshKey: number;
}

export function Watchlist({ watchlist, onTokenClick, onRemove, refreshKey }: WatchlistProps) {
  const [liveData, setLiveData] = useState<Record<string, Token>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (watchlist.length === 0) {
      setLiveData({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const results: Record<string, Token> = {};
    await Promise.all(
      watchlist.map(async (entry) => {
        try {
          const detail = await fetchTokenDetail(entry.token_address);
          results[entry.token_address] = { ...detail.info, ...detail.market };
        } catch {
          /* leave as undefined */
        }
      })
    );
    setLiveData(results);
    setLoading(false);
  }, [watchlist]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load, refreshKey]);

  if (watchlist.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Star size={24} className="text-amber-400" /> Watchlist
          </h1>
          <p className="text-sm text-slate-500 mt-1">Save and track real Solana tokens</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <Star size={32} className="text-slate-700" />
          <p className="text-sm text-slate-500">Your watchlist is empty</p>
          <p className="text-xs text-slate-600">Click the star icon on any token to add it here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Star size={24} className="text-amber-400" /> Watchlist
        </h1>
        <p className="text-sm text-slate-500 mt-1">Tracking {watchlist.length} tokens with live data</p>
      </div>

      {loading && Object.keys(liveData).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          <p className="text-sm text-slate-400">Loading live data for your tokens…</p>
        </div>
      ) : (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase text-slate-500">
                <th className="py-3 px-4 text-left font-medium">Token</th>
                <th className="py-3 px-4 text-right font-medium">Price</th>
                <th className="py-3 px-4 text-right font-medium">Liquidity</th>
                <th className="py-3 px-4 text-right font-medium">Vol 24h</th>
                <th className="py-3 px-4 text-right font-medium">Change 24h</th>
                <th className="py-3 px-4 text-right font-medium">Holders</th>
                <th className="py-3 px-4 text-right font-medium">Risk</th>
                <th className="py-3 px-4 text-right font-medium">Added</th>
                <th className="py-3 px-2 text-center font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {watchlist.map((entry) => {
                const token = liveData[entry.token_address];
                const risk = token ? computeRiskReport(token) : null;
                return (
                  <tr
                    key={entry.id}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer group"
                    onClick={() => onTokenClick(entry.token_address)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <TokenLogo symbol={entry.token_symbol} logo={token?.logo ?? null} size={36} />
                        <div>
                          <div className="font-semibold text-slate-100 group-hover:text-sky-400 transition-colors">{entry.token_symbol}</div>
                          <div className="text-xs text-slate-500">{entry.token_name ?? shortenAddress(entry.token_address)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">
                      {token ? formatPrice(token.price) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">
                      {token ? formatUsd(token.liquidity) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">
                      {token ? formatUsd(token.volume_24h) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {token ? <ChangeBadge value={token.price_change_24h} /> : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">
                      {token ? formatNumber(token.holders) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {risk ? <RiskBadge cls={risk.riskClass} /> : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-3 px-4 text-right text-xs text-slate-500">{timeAgo(entry.added_at)}</td>
                    <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onRemove(entry.id)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
