import { useEffect, useState, useCallback } from "react";
import type { Token } from "@/types";
import { fetchMostHeld } from "@/lib/api";
import { TokenTable } from "@/components/TokenTable";
import { Users, RefreshCw } from "lucide-react";

interface MostHeldProps {
  onTokenClick: (address: string) => void;
  onWatch: (token: Token) => void;
  watchedAddresses: Set<string>;
}

export function MostHeld({ onTokenClick, onWatch, watchedAddresses }: MostHeldProps) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMostHeld();
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
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Users size={24} className="text-sky-400" /> Most Held Tokens
          </h1>
          <p className="text-sm text-slate-500 mt-1">Real tokens ranked by holder count from on-chain data</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-sm text-slate-300 hover:border-slate-600 transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>
      {lastUpdate && <p className="text-xs text-slate-600">Last updated: {lastUpdate.toLocaleTimeString()}</p>}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
        <TokenTable tokens={tokens} loading={loading} error={error} onTokenClick={onTokenClick} onWatch={onWatch} watchedAddresses={watchedAddresses} title="Tokens by Holder Count" />
      </div>
    </div>
  );
}
