import { useEffect, useState, useCallback } from "react";
import type { TokenDetail } from "@/types";
import { fetchTokenDetail } from "@/lib/api";
import { computeRiskReport, computeSignalScore, formatPrice, formatUsd, formatNumber, formatPct, shortenAddress, timeAgo, getSeverityColor } from "@/lib/analysis";
import { TokenLogo } from "@/components/TokenLogo";
import { RiskBadge, ChangeBadge, VerifiedBadge, AiBadge } from "@/components/Badge";
import { Sparkline } from "@/components/Sparkline";
import { ScanLine, ArrowLeft, Loader2, ExternalLink, Copy, Search } from "lucide-react";

function TokenSearchBar({
  searchInput,
  setSearchInput,
  onSearch,
}: {
  searchInput: string;
  setSearchInput: (v: string) => void;
  onSearch: () => void;
}) {
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          placeholder="Enter Solana token mint address…"
          className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-10 pr-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
        />
      </div>
      <button
        onClick={onSearch}
        className="px-4 py-2.5 rounded-lg bg-sky-500 text-white text-sm font-medium hover:bg-sky-400 transition-colors"
      >
        Scan
      </button>
    </div>
  );
}

interface TokenScannerProps {
  mint: string;
  onBack: () => void;
  onScan: (address: string) => void;
}

export function TokenScanner({ mint, onBack, onScan }: TokenScannerProps) {
  const [detail, setDetail] = useState<TokenDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [searchInput, setSearchInput] = useState("");

  const load = useCallback(async (address: string) => {
    setLoading(true);
    setError(null);
    setDetail(null);
    try {
      const data = await fetchTokenDetail(address);
      setDetail(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load token data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mint) {
      load(mint);
      const interval = setInterval(() => load(mint), 30000);
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [mint, load]);

  const handleSearch = () => {
    const addr = searchInput.trim();
    if (addr) {
      onScan(addr);
      load(addr);
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(mint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && !detail) {
    return (
      <div className="space-y-5">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
          <ArrowLeft size={16} /> Back
        </button>
        <TokenSearchBar searchInput={searchInput} setSearchInput={setSearchInput} onSearch={handleSearch} />
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
          <p className="text-sm text-slate-400">Scanning token on-chain…</p>
        </div>
      </div>
    );
  }

  if (!mint && !detail) {
    return (
      <div className="space-y-5">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
          <ArrowLeft size={16} /> Back
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <ScanLine size={24} className="text-sky-400" /> Token Scanner
          </h1>
          <p className="text-sm text-slate-500 mt-1">Enter any Solana token mint address to see full on-chain details</p>
        </div>
        <TokenSearchBar searchInput={searchInput} setSearchInput={setSearchInput} onSearch={handleSearch} />
        {error && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <p className="text-sm text-red-400">Data unavailable</p>
            <p className="text-xs text-slate-500">{error}</p>
          </div>
        )}
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center">
          <ScanLine size={32} className="text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Paste a Solana token mint address above to scan it</p>
          <p className="text-xs text-slate-600 mt-2">e.g. Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB</p>
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="space-y-5">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
          <ArrowLeft size={16} /> Back
        </button>
        <TokenSearchBar searchInput={searchInput} setSearchInput={setSearchInput} onSearch={handleSearch} />
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <p className="text-sm text-red-400">Data unavailable</p>
          <p className="text-xs text-slate-500">{error}</p>
          <p className="text-xs text-slate-600 mt-2">Try searching for a different token address above</p>
        </div>
      </div>
    );
  }

  const { info, market, trades, holders } = detail;
  const risk = computeRiskReport({ ...info, ...market });
  const signal = computeSignalScore({ ...info, ...market });

  const tradeVolumes = trades.slice(-50).map((t) => t.volume_usd);
  const buyTrades = trades.filter((t) => t.side === "buy").length;
  const sellTrades = trades.filter((t) => t.side === "sell").length;

  const topHolders = holders.slice(0, 10);
  const holderPcts = topHolders.map((h) => h.pct);
  const topHolderConcentration = holderPcts.slice(0, 5).reduce((s, p) => s + p, 0);

  const solscanUrl = `https://solscan.io/token/${mint}`;
  const dexscreenerUrl = `https://dexscreener.com/solana/${mint}`;

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
        <ArrowLeft size={16} /> Back to list
      </button>

      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <TokenLogo symbol={info.symbol} logo={info.logo} size={56} />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-100">{info.symbol}</h1>
                {market.graduated && (
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">GRADUATED</span>
                )}
              </div>
              <div className="text-sm text-slate-500 mt-0.5">{info.name ?? "Unknown name"}</div>
              <div className="flex items-center gap-2 mt-2">
                <code className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded">{shortenAddress(mint)}</code>
                <button onClick={copyAddress} className="text-slate-500 hover:text-slate-300 transition-colors">
                  {copied ? <Copy size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
                <a href={solscanUrl} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-sky-400 transition-colors">
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-slate-100 font-mono">{formatPrice(market.price)}</div>
            <div className="mt-1"><ChangeBadge value={market.price_change_24h} size="md" /></div>
            <div className="mt-2 flex gap-2">
              <RiskBadge cls={risk.riskClass} size="md" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {[
            { label: "Market Cap", value: formatUsd(market.market_cap) },
            { label: "Liquidity", value: formatUsd(market.liquidity) },
            { label: "Volume 24h", value: formatUsd(market.volume_24h) },
            { label: "FDV", value: formatUsd(market.fdv) },
            { label: "Holders", value: formatNumber(info.holders) },
            { label: "Trades (recent)", value: formatNumber(trades.length) },
            { label: "Buys / Sells", value: `${buyTrades} / ${sellTrades}` },
            { label: "Created", value: timeAgo(market.created_at) },
          ].map((s) => (
            <div key={s.label} className="bg-slate-800/30 rounded-lg p-3">
              <div className="text-xs text-slate-500 uppercase tracking-wider">{s.label}</div>
              <div className="text-lg font-semibold text-slate-200 font-mono mt-1">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-4">
          <a href={dexscreenerUrl} target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 hover:border-slate-600 transition-colors flex items-center gap-1.5">
            <ExternalLink size={12} /> DexScreener
          </a>
          <a href={solscanUrl} target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 hover:border-slate-600 transition-colors flex items-center gap-1.5">
            <ExternalLink size={12} /> Solscan
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-100 flex items-center gap-2">
              <ScanLine size={16} className="text-sky-400" /> Trade Volume (Recent)
            </h3>
            <VerifiedBadge />
          </div>
          {tradeVolumes.length > 1 ? (
            <div className="mb-3">
              <Sparkline data={tradeVolumes} width={500} height={120} color="#38bdf8" />
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-8 text-center">Insufficient trade data for chart</p>
          )}
          <div className="grid grid-cols-4 gap-2 text-xs mt-3">
            <div><div className="text-slate-500">Vol 5m</div><div className="text-slate-300 font-mono">{formatUsd(market.volume_5m)}</div></div>
            <div><div className="text-slate-500">Vol 1h</div><div className="text-slate-300 font-mono">{formatUsd(market.volume_1h)}</div></div>
            <div><div className="text-slate-500">Vol 6h</div><div className="text-slate-300 font-mono">{formatUsd(market.volume_6h)}</div></div>
            <div><div className="text-slate-500">Vol 24h</div><div className="text-slate-300 font-mono">{formatUsd(market.volume_24h)}</div></div>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-100 flex items-center gap-2">
              <ScanLine size={16} className="text-emerald-400" /> Holder Distribution
            </h3>
            <VerifiedBadge />
          </div>
          {topHolders.length > 0 ? (
            <>
              <div className="mb-4">
                <div className="text-xs text-slate-500 mb-1.5">Top 5 holder concentration</div>
                <div className="h-3 bg-slate-800 rounded-full overflow-hidden flex">
                  {holderPcts.slice(0, 5).map((pct, i) => {
                    const colors = ["bg-red-500", "bg-orange-500", "bg-amber-500", "bg-sky-500", "bg-emerald-500"];
                    return <div key={i} className={colors[i]} style={{ width: `${Math.min(100, pct)}%` }} />;
                  })}
                </div>
                <div className="text-xs text-slate-400 mt-1.5 font-mono">{topHolderConcentration.toFixed(1)}% held by top 5</div>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {topHolders.map((h, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-mono">{i + 1}. {shortenAddress(h.owner)}</span>
                    <span className="text-slate-300 font-mono">{h.pct.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500 py-8 text-center">Holder data unavailable</p>
          )}
        </div>
      </div>

      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-100 flex items-center gap-2">
            <ScanLine size={16} className="text-violet-400" /> AI Signal Score
          </h3>
          <AiBadge />
        </div>
        <div className="flex items-center gap-6 mb-4">
          <div className="text-center">
            <div className={`text-4xl font-bold font-mono ${
              signal.score >= 75 ? "text-emerald-400" : signal.score >= 50 ? "text-sky-400" : signal.score >= 25 ? "text-amber-400" : "text-red-400"
            }`}>{signal.score}</div>
            <div className="text-xs text-slate-500">/ 100</div>
          </div>
          <div className="flex-1 space-y-2">
            {signal.factors.map((f) => (
              <div key={f.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-400">{f.label}</span>
                  <span className="text-slate-300 font-mono">{f.value}</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-sky-400" style={{ width: `${(f.contribution / f.weight) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500 italic">AI-generated analysis based on verified on-chain data. Does not guarantee future price movement.</p>
      </div>

      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-100 flex items-center gap-2">
            <ScanLine size={16} className="text-red-400" /> Risk Factors
          </h3>
          <VerifiedBadge />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {risk.factors.map((f, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg">
              <div className={`w-2 h-2 rounded-full mt-1.5 ${
                f.severity === "critical" ? "bg-red-500" : f.severity === "high" ? "bg-orange-500" : f.severity === "medium" ? "bg-amber-500" : "bg-emerald-500"
              }`} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-200">{f.label}</span>
                  <span className={`text-xs font-medium ${getSeverityColor(f.severity)}`}>{f.severity.toUpperCase()}</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{f.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-100">Recent Trades</h3>
          <VerifiedBadge />
        </div>
        {trades.length > 0 ? (
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="py-2 px-3 text-left">Side</th>
                  <th className="py-2 px-3 text-right">Volume</th>
                  <th className="py-2 px-3 text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {trades.slice(-30).reverse().map((t, i) => (
                  <tr key={i} className="border-b border-slate-800/50">
                    <td className="py-1.5 px-3">
                      <span className={t.side === "buy" ? "text-emerald-400" : "text-red-400"}>{t.side.toUpperCase()}</span>
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono text-slate-300">{formatUsd(t.volume_usd)}</td>
                    <td className="py-1.5 px-3 text-right text-slate-500">{new Date(t.time).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500 py-8 text-center">No recent trade data available</p>
        )}
      </div>
    </div>
  );
}
