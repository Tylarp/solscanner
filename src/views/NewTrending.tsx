import { useEffect, useState, useCallback } from "react";
import type { Token } from "@/types";
import { fetchNewTrending } from "@/lib/api";
import { TokenTable } from "@/components/TokenTable";
import { Flame, RefreshCw } from "lucide-react";

interface NewTrendingProps {
  onTokenClick: (address: string) => void;
  onWatch: (token: Token) => void;
  watchedAddresses: Set<string>;
}

export function NewTrending({ onTokenClick, onWatch, watchedAddresses }: NewTrendingProps) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNewTrending();
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Flame size={24} className="text-orange-400" /> New & Trending
          </h1>
          <p className="text-sm text-slate-500 mt-1">Newly launched Solana tokens with live market data</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-sm text-slate-300 hover:border-slate-600 transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>
      {lastUpdate && (
        <p className="text-xs text-slate-600">Last updated: {lastUpdate.toLocaleTimeString()}</p>
      )}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
        <TokenTable tokens={tokens} loading={loading} error={error} onTokenClick={onTokenClick} onWatch={onWatch} watchedAddresses={watchedAddresses} title="Newly Launched Tokens" />
      </div>
    </div>
  );
}
