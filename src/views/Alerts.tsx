import { useEffect, useState, useCallback } from "react";
import type { AlertEntry, AlertHistoryEntry, Token } from "@/types";
import { supabase } from "@/lib/supabase";
import { fetchNewTrending, fetchTopMovers } from "@/lib/api";
import { Bell, Plus, Trash2, Loader2, AlertCircle } from "lucide-react";
import { formatNumber } from "@/lib/analysis";

interface AlertsProps {
  onTokenClick: (address: string) => void;
}

const ALERT_TYPES: { value: AlertEntry["alert_type"]; label: string }[] = [
  { value: "price_up", label: "Price Increase %" },
  { value: "price_down", label: "Price Drop %" },
  { value: "volume_spike", label: "Volume Spike %" },
  { value: "liquidity_drop", label: "Liquidity Drop %" },
  { value: "holder_change", label: "Holder Change %" },
  { value: "momentum", label: "Momentum Shift" },
];

const TIMEFRAMES = ["5m", "1h", "6h", "24h"];

export function Alerts({ onTokenClick }: AlertsProps) {
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [history, setHistory] = useState<AlertHistoryEntry[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [alertType, setAlertType] = useState<AlertEntry["alert_type"]>("price_up");
  const [threshold, setThreshold] = useState<string>("");
  const [timeframe, setTimeframe] = useState("24h");

  const loadAlerts = useCallback(async () => {
    const [a, h] = await Promise.all([
      supabase.from("alerts").select("*").order("created_at", { ascending: false }),
      supabase.from("alert_history").select("*").order("triggered_at", { ascending: false }).limit(50),
    ]);
    setAlerts(a.data ?? []);
    setHistory(h.data ?? []);
  }, []);

  const loadTokens = useCallback(async () => {
    try {
      const [n, m] = await Promise.all([fetchNewTrending(), fetchTopMovers()]);
      const dedup = new Map<string, Token>();
      [...n.tokens, ...m.tokens].forEach((t) => dedup.set(t.address, t));
      setTokens(Array.from(dedup.values()));
    } catch {
      /* handled by individual views */
    }
  }, []);

  useEffect(() => {
    Promise.all([loadAlerts(), loadTokens()]).finally(() => setLoading(false));
    const interval = setInterval(loadAlerts, 30000);
    return () => clearInterval(interval);
  }, [loadAlerts, loadTokens]);

  const createAlert = async () => {
    const token = tokens.find((t) => t.address === selectedToken);
    if (!token) return;
    await supabase.from("alerts").insert({
      token_address: token.address,
      token_symbol: token.symbol,
      alert_type: alertType,
      threshold: threshold ? parseFloat(threshold) : null,
      timeframe,
      active: true,
    });
    setShowForm(false);
    setSelectedToken("");
    setThreshold("");
    await loadAlerts();
  };

  const deleteAlert = async (id: string) => {
    await supabase.from("alerts").delete().eq("id", id);
    await loadAlerts();
  };

  const toggleAlert = async (id: string, active: boolean) => {
    await supabase.from("alerts").update({ active: !active }).eq("id", id);
    await loadAlerts();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
        <p className="text-sm text-slate-400">Loading alerts…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Bell size={24} className="text-sky-400" /> Alerts
          </h1>
          <p className="text-sm text-slate-500 mt-1">Detect real-time changes in volume, price, holders, liquidity, and momentum</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-500/20 border border-sky-500/30 text-sm text-sky-400 hover:bg-sky-500/30 transition-colors"
        >
          <Plus size={14} /> New Alert
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-slate-100">Create Alert</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider">Token</label>
              <select
                value={selectedToken}
                onChange={(e) => setSelectedToken(e.target.value)}
                className="w-full mt-1 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500/50"
              >
                <option value="">Select a token…</option>
                {tokens.map((t) => (
                  <option key={t.address} value={t.address}>{t.symbol} — {t.address.slice(0, 8)}…</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider">Alert Type</label>
              <select
                value={alertType}
                onChange={(e) => setAlertType(e.target.value as AlertEntry["alert_type"])}
                className="w-full mt-1 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500/50"
              >
                {ALERT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider">Threshold (optional)</label>
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="e.g. 50"
                className="w-full mt-1 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider">Timeframe</label>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="w-full mt-1 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500/50"
              >
                {TIMEFRAMES.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={createAlert} disabled={!selectedToken} className="px-4 py-2 rounded-lg bg-sky-500 text-white text-sm font-medium hover:bg-sky-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Create Alert
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-sm text-slate-300 hover:border-slate-600 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
        <h3 className="font-semibold text-slate-100 mb-4">Active Alerts ({alerts.length})</h3>
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <AlertCircle size={24} className="text-slate-600" />
            <p className="text-sm text-slate-500">No alerts configured yet</p>
            <p className="text-xs text-slate-600">Click "New Alert" to set up your first alert</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleAlert(alert.id, alert.active)}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors ${alert.active ? "bg-sky-500" : "bg-slate-700"}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${alert.active ? "translate-x-4" : ""}`} />
                  </button>
                  <div>
                    <div className="text-sm font-medium text-slate-200">
                      {alert.token_symbol}
                      <span className="text-slate-500 ml-2">{ALERT_TYPES.find((t) => t.value === alert.alert_type)?.label}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {alert.threshold ? `Threshold: ${alert.threshold}%` : "No threshold"} · {alert.timeframe}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onTokenClick(alert.token_address)}
                    className="text-xs text-sky-400 hover:text-sky-300 px-2 py-1"
                  >
                    View Token
                  </button>
                  <button onClick={() => deleteAlert(alert.id)} className="text-slate-500 hover:text-red-400 p-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
        <h3 className="font-semibold text-slate-100 mb-4">Alert History ({formatNumber(history.length)})</h3>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">No alerts have been triggered yet</p>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between text-xs p-2 bg-slate-800/20 rounded">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="text-slate-200 font-medium">{h.token_symbol}</span>
                  <span className="text-slate-500">{h.message}</span>
                </div>
                <span className="text-slate-600">{new Date(h.triggered_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
