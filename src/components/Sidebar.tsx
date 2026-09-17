
import type { View } from "@/types";
import {
  LayoutDashboard,
  Flame,
  GraduationCap,
  Users,
  TrendingUp,
  Brain,
  ScanLine,
  ShieldAlert,
  Bell,
  Star,
  Sparkles,
  Github,
} from "lucide-react";

interface SidebarProps {
  current: View;
  onNavigate: (view: View) => void;
  alertCount: number;
}

const navItems: { view: View; label: string; icon: typeof LayoutDashboard }[] = [
  { view: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { view: "new-trending", label: "New & Trending", icon: Flame },
  { view: "graduated", label: "Graduated", icon: GraduationCap },
  { view: "most-held", label: "Most Held", icon: Users },
  { view: "top-movers", label: "Top Movers", icon: TrendingUp },
  { view: "signal-score", label: "AI Signal Score", icon: Brain },
  { view: "token-scanner", label: "Token Scanner", icon: ScanLine },
  { view: "risk-scanner", label: "Risk Scanner", icon: ShieldAlert },
  { view: "alerts", label: "Alerts", icon: Bell },
  { view: "watchlist", label: "Watchlist", icon: Star },
  { view: "market-overview", label: "AI Market Overview", icon: Sparkles },
];

export function Sidebar({ current, onNavigate, alertCount }: SidebarProps) {
  return (
    <aside className="w-full md:w-60 md:shrink-0 bg-slate-900/80 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col md:h-screen md:sticky md:top-0">
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <img
            src="/solscanner-logo.png"
            alt="SolScanner"
            className="w-9 h-9 object-contain"
          />

          <div>
            <div className="font-bold text-slate-100 text-sm tracking-tight">
              SOLSCAN AI
            </div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">
              Memecoin Intel
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-x-auto md:overflow-y-auto md:overflow-x-hidden py-3 px-2 space-x-1 md:space-x-0 md:space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = current === item.view;

          return (
            <button
              key={item.view}
              onClick={() => onNavigate(item.view)}
              className={`shrink-0 md:shrink md:w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
              }`}
            >
              <Icon
                size={17}
                className={active ? "text-sky-400" : "text-slate-500"}
              />

              <span className="flex-1 text-left whitespace-nowrap">
                {item.label}
              </span>

              {item.view === "alerts" && alertCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold">
                  {alertCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* GitHub Project */}
      <div className="px-3 py-3 border-t border-slate-800">
        <a
          href="https://github.com/Tylarp/QuantBot"
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg border border-slate-800 bg-slate-950/50 p-4 hover:border-slate-700 hover:bg-slate-800/50 transition-all"
        >
          <div className="flex items-center gap-2.5">
            <Github size={21} className="text-slate-400" />

            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-200">
                QuantBot
              </div>

              <div className="text-[10px] text-slate-500 truncate">
                View original AI bot this site is based on
              </div>
            </div>
          </div>
        </a>
      </div>

      <div className="hidden md:block px-4 py-3 border-t border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Live on-chain data
        </div>

        <div className="mt-1.5 text-[10px] text-slate-600">
          Powered by DexScreener · Solana
        </div>
      </div>
    </aside>
  );
}

