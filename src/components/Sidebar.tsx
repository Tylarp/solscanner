
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
    <aside className="w-60 shrink-0 bg-slate-900/80 border-r border-slate-800 flex flex-col h-screen sticky top-0">
      
      {/* Logo / Brand */}
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <img
            src="/solscanner-logo.png"
            alt="SolScanner"
            className="w-10 h-10 object-contain shrink-0"
          />

          <div className="min-w-0">
            <div className="font-bold text-slate-100 text-sm tracking-tight">
              SOLSCANNER
            </div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">
              Memecoin Intel
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1
