import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  color: string;
}

export function StatCard({ label, value, sub, icon: Icon, color }: StatCardProps) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">{label}</span>
        <Icon size={16} className={color} />
      </div>
      <div className="text-xl font-bold text-slate-100 font-mono">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}
