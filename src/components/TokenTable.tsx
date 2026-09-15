import { useState, useMemo } from "react";
import type { Token } from "@/types";
import { TokenRow } from "./TokenRow";
import { ArrowUpDown, Loader2 } from "lucide-react";

interface TokenTableProps {
  tokens: Token[];
  loading: boolean;
  error: string | null;
  onTokenClick: (address: string) => void;
  onWatch: (token: Token) => void;
  watchedAddresses: Set<string>;
  title?: string;
}

type SortKey = "symbol" | "price" | "market_cap" | "liquidity" | "volume_24h" | "price_change_24h" | "holders" | "created_at";

export function TokenTable({ tokens, loading, error, onTokenClick, onWatch, watchedAddresses, title }: TokenTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("volume_24h");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");

  const sorted = useMemo(() => {
    let filtered = tokens;
    if (search) {
      const q = search.toLowerCase();
      filtered = tokens.filter(
        (t) => t.symbol.toLowerCase().includes(q) || t.address.toLowerCase().includes(q) || (t.name?.toLowerCase().includes(q) ?? false)
      );
    }
    return [...filtered].sort((a, b) => {
      let av: string | number = (a[sortKey] as string | number | null) ?? "";
      let bv: string | number = (b[sortKey] as string | number | null) ?? "";
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "desc" ? bv.localeCompare(av) : av.localeCompare(bv);
      }
      av = Number(av) || 0;
      bv = Number(bv) || 0;
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [tokens, sortKey, sortDir, search]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const headers: { key: SortKey; label: string; align: string }[] = [
    { key: "symbol", label: "Token", align: "text-left" },
    { key: "price", label: "Price", align: "text-right" },
    { key: "market_cap", label: "Mkt Cap", align: "text-right" },
    { key: "liquidity", label: "Liquidity", align: "text-right" },
    { key: "volume_24h", label: "Vol 24h", align: "text-right" },
    { key: "price_change_24h", label: "Change 24h", align: "text-right" },
    { key: "holders", label: "Holders", align: "text-right" },
    { key: "created_at", label: "Age", align: "text-right" },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
        <p className="text-sm text-slate-400">Fetching live on-chain data…</p>
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

  if (tokens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2">
        <p className="text-sm text-slate-400">No tokens found</p>
        <p className="text-xs text-slate-500">Live data will appear here when available.</p>
      </div>
    );
  }

  return (
    <div>
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
          <input
            type="text"
            placeholder="Search tokens…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500/50 w-48"
          />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs uppercase text-slate-500">
              {headers.map((h) => (
                <th
                  key={h.key}
                  className={`py-2 px-4 font-medium cursor-pointer hover:text-slate-300 transition-colors ${h.align}`}
                  onClick={() => toggleSort(h.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {h.label}
                    <ArrowUpDown size={11} className={sortKey === h.key ? "text-sky-400" : "text-slate-700"} />
                  </span>
                </th>
              ))}
              <th className="py-2 px-4 text-right font-medium">Risk</th>
              <th className="py-2 px-2 text-center font-medium">★</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((token) => (
              <TokenRow
                key={token.address}
                token={token}
                onClick={onTokenClick}
                onWatch={onWatch}
                isWatched={watchedAddresses.has(token.address)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
