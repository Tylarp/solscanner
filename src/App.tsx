
import { useEffect, useState, useCallback } from "react";
import type { View, Token, WatchlistEntry } from "@/types";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "@/components/Sidebar";
import { Dashboard } from "@/views/Dashboard";
import { NewTrending } from "@/views/NewTrending";
import { Graduated } from "@/views/Graduated";
import { MostHeld } from "@/views/MostHeld";
import { TopMovers } from "@/views/TopMovers";
import { SignalScoreView } from "@/views/SignalScore";
import { TokenScanner } from "@/views/TokenScanner";
import { RiskScanner } from "@/views/RiskScanner";
import { Alerts } from "@/views/Alerts";
import { Watchlist } from "@/views/Watchlist";
import { MarketOverview } from "@/views/MarketOverview";

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [scannerMint, setScannerMint] = useState<string>("");
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [watchedAddresses, setWatchedAddresses] = useState<Set<string>>(new Set());
  const [activeAlerts, setActiveAlerts] = useState(0);
  const [watchlistRefreshKey, setWatchlistRefreshKey] = useState(0);

  const loadWatchlist = useCallback(async () => {
    const { data } = await supabase
      .from("watchlist")
      .select("*")
      .order("added_at", { ascending: false });

    setWatchlist(data ?? []);
    setWatchedAddresses(
      new Set((data ?? []).map((w) => w.token_address))
    );
  }, []);

  const loadActiveAlerts = useCallback(async () => {
    const { count } = await supabase
      .from("alerts")
      .select("*", { count: "exact", head: true })
      .eq("active", true);

    setActiveAlerts(count ?? 0);
  }, []);

  useEffect(() => {
    loadWatchlist();
    loadActiveAlerts();
  }, [loadWatchlist, loadActiveAlerts]);

  const handleTokenClick = (address: string) => {
    setScannerMint(address);
    setView("token-scanner");
  };

  const handleWatch = async (token: Token) => {
    if (watchedAddresses.has(token.address)) {
      const entry = watchlist.find((w) => w.token_address === token.address);

      if (entry) {
        await supabase.from("watchlist").delete().eq("id", entry.id);
      }
    } else {
      await supabase.from("watchlist").insert({
        token_address: token.address,
        token_symbol: token.symbol,
        token_name: token.name,
      });
    }

    await loadWatchlist();
    setWatchlistRefreshKey((k) => k + 1);
  };

  const handleRemoveFromWatchlist = async (id: string) => {
    await supabase.from("watchlist").delete().eq("id", id);
    await loadWatchlist();
    setWatchlistRefreshKey((k) => k + 1);
  };

  const handleNavigate = (v: View) => {
    setView(v);
  };

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-slate-950 text-slate-200">
      <Sidebar
        current={view}
        onNavigate={handleNavigate}
        alertCount={activeAlerts}
      />

      <main className="flex-1 min-w-0 overflow-y-auto p-3 sm:p-4 md:p-6">
        {view === "dashboard" && (
          <Dashboard
            onTokenClick={handleTokenClick}
            onNavigate={handleNavigate}
            onWatch={handleWatch}
            watchedAddresses={watchedAddresses}
          />
        )}

        {view === "new-trending" && (
          <NewTrending
            onTokenClick={handleTokenClick}
            onWatch={handleWatch}
            watchedAddresses={watchedAddresses}
          />
        )}

        {view === "graduated" && (
          <Graduated
            onTokenClick={handleTokenClick}
            onWatch={handleWatch}
            watchedAddresses={watchedAddresses}
          />
        )}

        {view === "most-held" && (
          <MostHeld
            onTokenClick={handleTokenClick}
            onWatch={handleWatch}
            watchedAddresses={watchedAddresses}
          />
        )}

        {view === "top-movers" && (
          <TopMovers
            onTokenClick={handleTokenClick}
            onWatch={handleWatch}
            watchedAddresses={watchedAddresses}
          />
        )}

        {view === "signal-score" && (
          <SignalScoreView
            onTokenClick={handleTokenClick}
            onWatch={handleWatch}
            watchedAddresses={watchedAddresses}
          />
        )}

        {view === "token-scanner" && (
          <TokenScanner
            mint={scannerMint}
            onBack={() => setView("dashboard")}
            onScan={(addr) => setScannerMint(addr)}
          />
        )}

        {view === "risk-scanner" && (
          <RiskScanner onTokenClick={handleTokenClick} />
        )}

        {view === "alerts" && (
          <Alerts onTokenClick={handleTokenClick} />
        )}

        {view === "watchlist" && (
          <Watchlist
            watchlist={watchlist}
            onTokenClick={handleTokenClick}
            onRemove={handleRemoveFromWatchlist}
            refreshKey={watchlistRefreshKey}
          />
        )}

        {view === "market-overview" && (
          <MarketOverview onTokenClick={handleTokenClick} />
        )}
      </main>
    </div>
  );
}

