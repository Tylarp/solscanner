import { useEffect, useState, useCallback } from "react";
import type { Token } from "@/types";
import { fetchTopMovers, fetchNewTrending } from "@/lib/api";
import { computeSignalScore, formatPrice, formatUsd, formatNumber } from "@/lib/analysis";
import { TokenLogo } from "@/components/TokenLogo";
import { RiskBadge, AiBadge } from "@/components/Badge";
import { Brain, RefreshCw, Loader2 } from "lucide-react";

interface SignalScoreProps {
  onTokenClick: (address: string) => void;
  onWatch: (token: Token) => void;
  watchedAddresses: Set<string>;
}

export function SignalScoreView({ onTokenClick }: SignalScoreProps) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, n] = await Promise.all([fetchTopMovers(), fetchNewTrending()]);
      const all = [...m.tokens, ...n.tokens];
      const dedup = new Map<string, Token>();
      all.forEach((t) => dedup.set(t.address, t));
      setTokens(Array.from(dedup.values()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  const scored = tokens
    .map((t) => ({ token: t, signal: computeSignalScore(t) }))
    .sort((a, b) => b.signal.score - a.signal.score);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Brain size={24} className="text-violet-400" /> AI Signal Score
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            AI-weighted analysis of real price, volume, liquidity, holder growth, and wallet activity
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-sm text-slate-300 hover:border-slate-600 transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="flex items-center gap-2 p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
        <AiBadge />
        <p className="text-xs text-slate-400">
          Signal scores are AI-generated analysis based on verified on-chain data. They do not guarantee future price movement.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          <p className="text-sm text-slate-400">Analyzing on-chain data…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <p className="text-sm text-red-400">Data unavailable</p>
          <p className="text-xs text-slate-500">{error}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {scored.map(({ token, signal }) => (
            <div
              key={token.address}
              onClick={() => onTokenClick(token.address)}
              className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <TokenLogo symbol={token.symbol} logo={token.logo} size={40} />
                  <div>
                    <div className="font-bold text-slate-100 group-hover:text-sky-400 transition-colors">{token.symbol}</div>
                    <div className="text-xs text-slate-500">{formatPrice(token.price)} · {formatUsd(token.volume_24h)} vol</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-bold font-mono ${
                    signal.score >= 75 ? "text-emerald-400" : signal.score >= 50 ? "text-sky-400" : signal.score >= 25 ? "text-amber-400" : "text-red-400"
                  }`}>
                    {signal.score}
                  </div>
                  <div className="text-xs text-slate-500">/ 100</div>
                </div>
              </div>

              <div className="mb-4">
                <RiskBadge cls={signal.classification} size="md" />
              </div>

              <div className="space-y-2.5">
                {signal.factors.map((f) => (
                  <div key={f.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-400">{f.label}</span>
                      <span className="text-slate-300 font-mono">{f.value}</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-sky-400 transition-all"
                        style={{ width: `${(f.contribution / f.weight) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-slate-500">Liquidity</div>
                  <div className="text-slate-300 font-mono">{formatUsd(token.liquidity)}</div>
                </div>
                <div>
                  <div className="text-slate-500">Holders</div>
                  <div className="text-slate-300 font-mono">{formatNumber(token.holders)}</div>
                </div>
                <div>
                  <div className="text-slate-500">Trades 24h</div>
                  <div className="text-slate-300 font-mono">{formatNumber(token.trades_24h)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
