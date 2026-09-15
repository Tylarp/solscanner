import type { RiskClass } from "@/types";
import { getRiskClassColor } from "@/lib/analysis";

export function RiskBadge({ cls, size = "sm" }: { cls: RiskClass; size?: "sm" | "md" }) {
  const padding = size === "md" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-medium ${padding} ${getRiskClassColor(cls)}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {cls}
    </span>
  );
}

export function ChangeBadge({ value, size = "sm" }: { value: number; size?: "sm" | "md" }) {
  const positive = value >= 0;
  const padding = size === "md" ? "px-2.5 py-1 text-sm" : "px-1.5 py-0.5 text-xs";
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-md font-mono font-medium ${padding} ${
      positive ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"
    }`}>
      {positive ? "▲" : "▼"} {Math.abs(value).toFixed(2)}%
    </span>
  );
}

export function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium text-emerald-400">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      Verified
    </span>
  );
}

export function AiBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-xs font-medium text-violet-400">
      AI Analysis
    </span>
  );
}
