import { useEffect, useState, useCallback } from "react";
import type { Token, View } from "@/types";
import { fetchNewTrending, fetchGraduated, fetchMostHeld, fetchTopMovers } from "@/lib/api";
import { TokenTable } from "@/components/TokenTable";
import { StatCard } from "@/components/StatCard";
import { formatUsd, formatNumber, computeRiskReport } from "@/lib/analysis";
import { Flame, GraduationCap, Users, TrendingUp, Activity, DollarSign, Zap, AlertTriangle } from "lucide-react";

interface DashboardProps {
  onTokenClick: (address: string) => void;
  onNavigate: (view: View) => void;
  onWatch: (token: Token) => void;
  watchedAddresses: Set<string>;
}

export function Dashboard({ onTokenClick, onNavigate, onWatch, watchedAddresses }: DashboardProps) {
  const [newTokens, setNewTokens] = useState<Token[]>([]);
  const [graduated, setGraduated] = useState<Token[]>([]);
  const [mostHeld, setMostHeld] = useState<Token[]>([]);
  const [movers, setMovers] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [n, g, h, m] = await Promise.all([
        fetchNewTrending(),
        fetchGraduated(),
        fetchMostHeld(),
        fetchTopMovers(),
      ]);
      setNewTokens(n.tokens);
      setGraduated(g.tokens);
      setMostHeld(h.tokens);
      setMovers(m.tokens);
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

  const allTokens = [...newTokens, ...graduated, ...mostHeld, ...movers];
  const totalVolume = allTokens.reduce((s, t) => s + t.volume_24h, 0);
  const totalLiquidity = allTokens.reduce((s, t) => s + t.liquidity, 0);
  const totalMarketCap = allTokens.reduce((s, t) => s + t.market_cap, 0);
  const highRiskCount = allTokens.filter((t) => computeRiskReport(t).riskClass === "High Risk").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Real-time Solana memecoin intelligence — live on-chain data from Jupiter API</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Tokens Tracked" value={formatNumber(allTokens.length)} icon={Activity} color="text-sky-400" />
        <StatCard label="Total Volume 24h" value={formatUsd(totalVolume)} icon={DollarSign} color="text-emerald-400" />
        <StatCard label="Total Liquidity" value={formatUsd(totalLiquidity)} icon={Zap} color="text-amber-400" />
        <StatCard label="High Risk Tokens" value={formatNumber(highRiskCount)} icon={AlertTriangle} color="text-red-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <Flame size={18} className="text-orange-400" /> New & Trending
            </h2>
            <button onClick={() => onNavigate("new-trending")} className="text-xs text-sky-400 hover:text-sky-300">
              View all →
            </button>
          </div>
          <TokenTable
            tokens={newTokens.slice(0, 5)}
            loading={loading}
            error={error}
            onTokenClick={onTokenClick}
            onWatch={onWatch}
            watchedAddresses={watchedAddresses}
          />
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <GraduationCap size={18} className="text-emerald-400" /> Graduated
            </h2>
            <button onClick={() => onNavigate("graduated")} className="text-xs text-sky-400 hover:text-sky-300">
              View all →
            </button>
          </div>
          <TokenTable
            tokens={graduated.slice(0, 5)}
            loading={loading}
            error={error}
            onTokenClick={onTokenClick}
            onWatch={onWatch}
            watchedAddresses={watchedAddresses}
          />
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <Users size={18} className="text-sky-400" /> Most Held
            </h2>
            <button onClick={() => onNavigate("most-held")} className="text-xs text-sky-400 hover:text-sky-300">
              View all →
            </button>
          </div>
          <TokenTable
            tokens={mostHeld.slice(0, 5)}
            loading={loading}
            error={error}
            onTokenClick={onTokenClick}
            onWatch={onWatch}
            watchedAddresses={watchedAddresses}
          />
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <TrendingUp size={18} className="text-amber-400" /> Top Movers
            </h2>
            <button onClick={() => onNavigate("top-movers")} className="text-xs text-sky-400 hover:text-sky-300">
              View all →
            </button>
          </div>
          <TokenTable
            tokens={movers.slice(0, 5)}
            loading={loading}
            error={error}
            onTokenClick={onTokenClick}
            onWatch={onWatch}
            watchedAddresses={watchedAddresses}
          />
        </div>
      </div>
    </div>
  );
}
