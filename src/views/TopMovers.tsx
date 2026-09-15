import { useEffect, useState, useCallback } from "react";
import type { Token, Timeframe } from "@/types";
import { fetchTopMovers } from "@/lib/api";
import { TokenTable } from "@/components/TokenTable";
import { TrendingUp, RefreshCw } from "lucide-react";

interface TopMoversProps {
  onTokenClick: (address: string) => void;
  onWatch: (token: Token) => void;
  watchedAddresses: Set<string>;
}

export function TopMovers({ onTokenClick, onWatch, watchedAddresses }: TopMoversProps) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("24h");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTopMovers();
      setTokens(data.tokens);
      setLastUpdate(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 45000);
    return () => clearInterval(interval);
  }, [load]);

  const tfKey = `price_change_${timeframe}` as keyof Token;
  const sorted = [...tokens].sort((a, b) => Number(b[tfKey] ?? 0) - Number(a[tfKey] ?? 0));

  const timeframes: { key: Timeframe; label: string }[] = [
    { key: "5m", label: "5m" },
    { key: "1h", label: "1h" },
    { key: "6h", label: "6h" },
    { key: "24h", label: "24h" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <TrendingUp size={24} className="text-amber-400" /> Top Movers
          </h1>
          <p className="text-sm text-slate-500 mt-1">Biggest gainers and volume spikes across timeframes</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-800/50 border border-slate-700 rounded-lg p-0.5">
            {timeframes.map((tf) => (
              <button
                key={tf.key}
                onClick={() => setTimeframe(tf.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  timeframe === tf.key ? "bg-sky-500/20 text-sky-400" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-sm text-slate-300 hover:border-slate-600 transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>
      {lastUpdate && <p className="text-xs text-slate-600">Last updated: {lastUpdate.toLocaleTimeString()}</p>}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
        <TokenTable tokens={sorted} loading={loading} error={error} onTokenClick={onTokenClick} onWatch={onWatch} watchedAddresses={watchedAddresses} title={`Top Movers — ${timeframe}`} />
      </div>
    </div>
  );
}
