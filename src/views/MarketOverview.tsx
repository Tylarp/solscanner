import { useEffect, useState, useCallback } from "react";
import type { Token } from "@/types";
import { fetchNewTrending, fetchGraduated, fetchMostHeld, fetchTopMovers } from "@/lib/api";
import { computeSignalScore, computeRiskReport, formatUsd, formatPct, formatNumber } from "@/lib/analysis";
import { TokenLogo } from "@/components/TokenLogo";
import { RiskBadge, AiBadge, VerifiedBadge } from "@/components/Badge";
import { Sparkles, Loader2, TrendingUp, TrendingDown, Zap, Users, Activity } from "lucide-react";

interface MarketOverviewProps {
  onTokenClick: (address: string) => void;
}

export function MarketOverview({ onTokenClick }: MarketOverviewProps) {
  const [tokens, setTokens] = useState<Token[]>([]);
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
      const dedup = new Map<string, Token>();
      [...n.tokens, ...g.tokens, ...h.tokens, ...m.tokens].forEach((t) => dedup.set(t.address, t));
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        <p className="text-sm text-slate-400">Analyzing market data…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2">
        <p className="text-sm text-red-400">Data unavailable</p>
        <p className="text-xs text-slate-500">{error}</p>
      </div>
    );
  }

  const scored = tokens.map((t) => ({ token: t, signal: computeSignalScore(t) })).sort((a, b) => b.signal.score - a.signal.score);
  const topMovers = [...tokens].sort((a, b) => b.price_change_24h - a.price_change_24h);
  const topVolume = [...tokens].sort((a, b) => b.volume_24h - a.volume_24h);
  const mostHeld = [...tokens].sort((a, b) => b.holders - a.holders);

  const gainers = topMovers.filter((t) => t.price_change_24h > 0).slice(0, 5);
  const losers = topMovers.filter((t) => t.price_change_24h < 0).reverse().slice(0, 5);
  const highRisk = tokens.filter((t) => computeRiskReport(t).riskClass === "High Risk");
  const totalVol = tokens.reduce((s, t) => s + t.volume_24h, 0);
  const avgLiquidity = tokens.length > 0 ? tokens.reduce((s, t) => s + t.liquidity, 0) / tokens.length : 0;

  const topSignals = scored.slice(0, 5).map(({ token, signal }) => {
    const reasons: string[] = [];
    if (token.volume_24h > token.liquidity * 2) reasons.push(`Volume is ${(token.volume_24h / Math.max(1, token.liquidity)).toFixed(1)}x liquidity, indicating high trading activity`);
    if (token.price_change_24h > 10) reasons.push(`Price up ${formatPct(token.price_change_24h)} in 24h with sustained momentum`);
    if (token.holders > 200) reasons.push(`${formatNumber(token.holders)} holders showing broad distribution`);
    if (token.liquidity > 100000) reasons.push(`Deep liquidity pool of ${formatUsd(token.liquidity)} reduces slippage risk`);
    if (token.trades_24h > 500) reasons.push(`${formatNumber(token.trades_24h)} recent trades showing active market participation`);
    if (token.graduated) reasons.push("Token has graduated from a launch platform to a DEX pool");
    if (reasons.length === 0) reasons.push("Moderate on-chain metrics with no dominant signal");

    return { token, signal, reasons };
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Sparkles size={24} className="text-violet-400" /> AI Market Overview
        </h1>
        <p className="text-sm text-slate-500 mt-1">AI-generated analysis of which real tokens are gaining momentum and why</p>
      </div>

      <div className="flex items-center gap-2 p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
        <AiBadge />
        <p className="text-xs text-slate-400">
          This analysis is AI-generated from verified on-chain data. It does not constitute financial advice and does not guarantee future price movement.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Activity size={16} className="text-sky-400" />
            <span className="text-xs text-slate-500 uppercase tracking-wider">Tokens Analyzed</span>
          </div>
          <div className="text-xl font-bold text-slate-100 font-mono">{formatNumber(tokens.length)}</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={16} className="text-emerald-400" />
            <span className="text-xs text-slate-500 uppercase tracking-wider">Total Volume 24h</span>
          </div>
          <div className="text-xl font-bold text-slate-100 font-mono">{formatUsd(totalVol)}</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-amber-400" />
            <span className="text-xs text-slate-500 uppercase tracking-wider">Avg Liquidity</span>
          </div>
          <div className="text-xl font-bold text-slate-100 font-mono">{formatUsd(avgLiquidity)}</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users size={16} className="text-red-400" />
            <span className="text-xs text-slate-500 uppercase tracking-wider">High Risk Tokens</span>
          </div>
          <div className="text-xl font-bold text-slate-100 font-mono">{formatNumber(highRisk.length)}</div>
        </div>
      </div>

      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold text-slate-100">Top Momentum Signals</h2>
          <AiBadge />
        </div>
        <div className="space-y-3">
          {topSignals.map(({ token, signal, reasons }, i) => (
            <div
              key={token.address}
              onClick={() => onTokenClick(token.address)}
              className="flex gap-4 p-4 bg-slate-800/30 rounded-xl hover:bg-slate-800/50 transition-colors cursor-pointer group"
            >
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div className={`text-2xl font-bold font-mono ${
                  signal.score >= 75 ? "text-emerald-400" : signal.score >= 50 ? "text-sky-400" : "text-amber-400"
                }`}>
                  #{i + 1}
                </div>
                <div className="text-xs text-slate-500 font-mono">{signal.score}/100</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <TokenLogo symbol={token.symbol} logo={token.logo} size={40} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-slate-100 group-hover:text-sky-400 transition-colors">{token.symbol}</span>
                  <RiskBadge cls={signal.classification} />
                  {token.graduated && <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">GRAD</span>}
                </div>
                <ul className="space-y-1">
                  {reasons.map((r, ri) => (
                    <li key={ri} className="text-xs text-slate-400 flex items-start gap-1.5">
                      <span className="text-violet-500 mt-0.5">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-4 mt-2 text-xs">
                  <span className="text-slate-500">Price: <span className="text-slate-300 font-mono">{formatUsd(token.price)}</span></span>
                  <span className="text-slate-500">Vol: <span className="text-slate-300 font-mono">{formatUsd(token.volume_24h)}</span></span>
                  <span className="text-slate-500">Liq: <span className="text-slate-300 font-mono">{formatUsd(token.liquidity)}</span></span>
                  <span className="text-slate-500">Holders: <span className="text-slate-300 font-mono">{formatNumber(token.holders)}</span></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-100 flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-400" /> Top Gainers (24h)
            </h3>
            <VerifiedBadge />
          </div>
          {gainers.length > 0 ? (
            <div className="space-y-2">
              {gainers.map((t) => (
                <div key={t.address} onClick={() => onTokenClick(t.address)} className="flex items-center justify-between p-2.5 bg-slate-800/30 rounded-lg cursor-pointer hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <TokenLogo symbol={t.symbol} logo={t.logo} size={28} />
                    <span className="text-sm font-medium text-slate-200">{t.symbol}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 font-mono">{formatUsd(t.volume_24h)} vol</span>
                    <span className="text-sm font-mono text-emerald-400">+{t.price_change_24h.toFixed(2)}%</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-slate-500 py-6 text-center">No gainers in current data</p>}
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-100 flex items-center gap-2">
              <TrendingDown size={16} className="text-red-400" /> Top Losers (24h)
            </h3>
            <VerifiedBadge />
          </div>
          {losers.length > 0 ? (
            <div className="space-y-2">
              {losers.map((t) => (
                <div key={t.address} onClick={() => onTokenClick(t.address)} className="flex items-center justify-between p-2.5 bg-slate-800/30 rounded-lg cursor-pointer hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <TokenLogo symbol={t.symbol} logo={t.logo} size={28} />
                    <span className="text-sm font-medium text-slate-200">{t.symbol}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 font-mono">{formatUsd(t.volume_24h)} vol</span>
                    <span className="text-sm font-mono text-red-400">{t.price_change_24h.toFixed(2)}%</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-slate-500 py-6 text-center">No losers in current data</p>}
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-100 flex items-center gap-2">
              <Zap size={16} className="text-amber-400" /> Highest Volume
            </h3>
            <VerifiedBadge />
          </div>
          <div className="space-y-2">
            {topVolume.slice(0, 5).map((t) => (
              <div key={t.address} onClick={() => onTokenClick(t.address)} className="flex items-center justify-between p-2.5 bg-slate-800/30 rounded-lg cursor-pointer hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-2">
                  <TokenLogo symbol={t.symbol} logo={t.logo} size={28} />
                  <span className="text-sm font-medium text-slate-200">{t.symbol}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-amber-400">{formatUsd(t.volume_24h)}</span>
                  <span className="text-xs text-slate-500">{formatNumber(t.trades_24h)} trades</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-100 flex items-center gap-2">
              <Users size={16} className="text-sky-400" /> Most Held
            </h3>
            <VerifiedBadge />
          </div>
          <div className="space-y-2">
            {mostHeld.slice(0, 5).map((t) => (
              <div key={t.address} onClick={() => onTokenClick(t.address)} className="flex items-center justify-between p-2.5 bg-slate-800/30 rounded-lg cursor-pointer hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-2">
                  <TokenLogo symbol={t.symbol} logo={t.logo} size={28} />
                  <span className="text-sm font-medium text-slate-200">{t.symbol}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-sky-400">{formatNumber(t.holders)}</span>
                  <span className="text-xs text-slate-500">holders</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
