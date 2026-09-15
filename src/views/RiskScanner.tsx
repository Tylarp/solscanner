import { useEffect, useState, useCallback } from "react";
import type { Token, RiskClass } from "@/types";
import { fetchNewTrending, fetchTopMovers } from "@/lib/api";
import { computeRiskReport, formatPrice, formatUsd, formatNumber, getSeverityColor } from "@/lib/analysis";
import { TokenLogo } from "@/components/TokenLogo";
import { RiskBadge, VerifiedBadge } from "@/components/Badge";
import { ShieldAlert, RefreshCw, Loader2 } from "lucide-react";

interface RiskScannerProps {
  onTokenClick: (address: string) => void;
}

export function RiskScanner({ onTokenClick }: RiskScannerProps) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RiskClass | "All">("All");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [n, m] = await Promise.all([fetchNewTrending(), fetchTopMovers()]);
      const all = [...n.tokens, ...m.tokens];
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
    .map((t) => ({ token: t, risk: computeRiskReport(t) }))
    .sort((a, b) => b.risk.score - a.risk.score);

  const filtered = filter === "All" ? scored : scored.filter((s) => s.risk.riskClass === filter);
  const counts: Record<string, number> = { "Early": 0, "Developing": 0, "Extended": 0, "High Risk": 0 };
  scored.forEach((s) => { counts[s.risk.riskClass]++; });

  const filters: (RiskClass | "All")[] = ["All", "High Risk", "Extended", "Developing", "Early"];

  if (loading && tokens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
        <p className="text-sm text-slate-400">Scanning for risk factors…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <p className="text-sm text-red-400">Data unavailable</p>
          <p className="text-xs text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <ShieldAlert size={24} className="text-red-400" /> Risk Scanner
          </h1>
          <p className="text-sm text-slate-500 mt-1">Real warning signs: concentrated holders, low liquidity, suspicious activity, rug risks</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-sm text-slate-300 hover:border-slate-600 transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {(Object.keys(counts) as RiskClass[]).map((cls) => (
          <button
            key={cls}
            onClick={() => setFilter(cls)}
            className={`p-4 rounded-xl border transition-all text-left ${
              filter === cls ? "border-sky-500/30 bg-sky-500/5" : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
            }`}
          >
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{cls}</div>
            <div className="text-2xl font-bold text-slate-100 font-mono">{counts[cls]}</div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f ? "bg-sky-500/20 text-sky-400 border border-sky-500/30" : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:text-slate-200"
            }`}
          >
            {f === "All" ? "All Tokens" : f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(({ token, risk }) => (
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
                  <div className="text-xs text-slate-500">{formatPrice(token.price)} · {formatUsd(token.market_cap)}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className={`text-2xl font-bold font-mono ${
                    risk.score >= 75 ? "text-red-400" : risk.score >= 50 ? "text-amber-400" : risk.score >= 25 ? "text-sky-400" : "text-emerald-400"
                  }`}>{risk.score}</div>
                  <div className="text-xs text-slate-500">risk score</div>
                </div>
                <RiskBadge cls={risk.riskClass} size="md" />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {risk.factors.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    f.severity === "critical" ? "bg-red-500" : f.severity === "high" ? "bg-orange-500" : f.severity === "medium" ? "bg-amber-500" : "bg-emerald-500"
                  }`} />
                  <div>
                    <div className="text-slate-400">{f.label}</div>
                    <div className={`font-medium ${getSeverityColor(f.severity)}`}>{f.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-4 text-xs text-slate-500">
              <span>Liquidity: <span className="text-slate-300 font-mono">{formatUsd(token.liquidity)}</span></span>
              <span>Holders: <span className="text-slate-300 font-mono">{formatNumber(token.holders)}</span></span>
              <span>Vol 24h: <span className="text-slate-300 font-mono">{formatUsd(token.volume_24h)}</span></span>
              <VerifiedBadge />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
