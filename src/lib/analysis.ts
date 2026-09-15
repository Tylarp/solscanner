import type { Token, RiskClass, RiskFactor, RiskReport, SignalScore } from "@/types";

export function formatPrice(price: number): string {
  if (!price || price === 0) return "$0";
  if (price < 0.000001) return `$${price.toExponential(2)}`;
  if (price < 0.01) return `$${price.toFixed(8)}`;
  if (price < 1) return `$${price.toFixed(6)}`;
  if (price < 1000) return `$${price.toFixed(2)}`;
  return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function formatNumber(n: number): string {
  if (!n || n === 0) return "0";
  if (n < 1000) return n.toFixed(0);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return `${(n / 1_000_000_000).toFixed(1)}B`;
}

export function formatUsd(n: number): string {
  return `$${formatNumber(n)}`;
}

export function formatPct(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Unknown";
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = now - date.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function computeRiskReport(token: Token): RiskReport {
  const factors: RiskFactor[] = [];

  const topHolderPct = 0;
  factors.push({
    label: "Liquidity Level",
    severity: token.liquidity < 10000 ? "critical" : token.liquidity < 50000 ? "high" : token.liquidity < 100000 ? "medium" : "low",
    detail: `Liquidity: ${formatUsd(token.liquidity)}`,
    verified: true,
  });

  factors.push({
    label: "Holder Count",
    severity: token.holders < 50 ? "high" : token.holders < 200 ? "medium" : "low",
    detail: `${token.holders} holders`,
    verified: true,
  });

  factors.push({
    label: "Volume / Liquidity Ratio",
    severity:
      token.liquidity > 0 && token.volume_24h / token.liquidity > 10
        ? "high"
        : token.liquidity > 0 && token.volume_24h / token.liquidity > 3
        ? "medium"
        : "low",
    detail: token.liquidity > 0 ? `${(token.volume_24h / token.liquidity).toFixed(1)}x` : "N/A",
    verified: true,
  });

  factors.push({
    label: "Buy / Sell Balance",
    severity:
      token.trades_24h > 0 && Math.abs(token.buys_24h - token.sells_24h) / token.trades_24h > 0.7
        ? "medium"
        : "low",
    detail: `${token.buys_24h} buys / ${token.sells_24h} sells`,
    verified: true,
  });

  factors.push({
    label: "Market Cap",
    severity: token.market_cap < 50000 ? "high" : token.market_cap < 500000 ? "medium" : "low",
    detail: `MCap: ${formatUsd(token.market_cap)}`,
    verified: true,
  });

  const scoreMap = { low: 0, medium: 25, high: 50, critical: 75 };
  const score = Math.min(100, factors.reduce((s, f) => s + scoreMap[f.severity], 0));

  let riskClass: RiskClass = "Early";
  if (score >= 75) riskClass = "High Risk";
  else if (score >= 50) riskClass = "Extended";
  else if (score >= 25) riskClass = "Developing";
  else riskClass = "Early";

  return { riskClass, score, factors };
}

export function computeSignalScore(token: Token): SignalScore {
  const factors: SignalScore["factors"] = [];

  const volLiqRatio = token.liquidity > 0 ? token.volume_24h / token.liquidity : 0;
  factors.push({
    label: "Volume / Liquidity",
    value: volLiqRatio > 0 ? `${volLiqRatio.toFixed(1)}x` : "N/A",
    weight: 20,
    contribution: Math.min(20, volLiqRatio * 4),
  });

  const holderScore = Math.min(20, (token.holders / 500) * 20);
  factors.push({
    label: "Holder Count",
    value: `${token.holders}`,
    weight: 20,
    contribution: holderScore,
  });

  const momentumScore = Math.min(20, Math.max(0, (token.price_change_24h + 20) / 2));
  factors.push({
    label: "Price Momentum (24h)",
    value: formatPct(token.price_change_24h),
    weight: 20,
    contribution: momentumScore,
  });

  const liqScore = Math.min(20, (token.liquidity / 500000) * 20);
  factors.push({
    label: "Liquidity Depth",
    value: formatUsd(token.liquidity),
    weight: 20,
    contribution: liqScore,
  });

  const tradeScore = Math.min(20, (token.trades_24h / 1000) * 20);
  factors.push({
    label: "Trade Activity",
    value: `${token.trades_24h} trades`,
    weight: 20,
    contribution: tradeScore,
  });

  const score = Math.round(factors.reduce((s, f) => s + f.contribution, 0));

  let classification: RiskClass = "Early";
  if (score >= 75) classification = "Extended";
  else if (score >= 50) classification = "Developing";
  else if (score >= 25) classification = "Early";
  else classification = "High Risk";

  return { score, classification, factors };
}

export function getRiskClassColor(cls: RiskClass): string {
  switch (cls) {
    case "Early":
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    case "Developing":
      return "text-sky-400 bg-sky-500/10 border-sky-500/30";
    case "Extended":
      return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    case "High Risk":
      return "text-red-400 bg-red-500/10 border-red-500/30";
  }
}

export function getSeverityColor(severity: RiskFactor["severity"]): string {
  switch (severity) {
    case "low":
      return "text-emerald-400";
    case "medium":
      return "text-amber-400";
    case "high":
      return "text-orange-400";
    case "critical":
      return "text-red-400";
  }
}
