export interface TokenInfo {
  address: string;
  symbol: string;
  name: string | null;
  decimals: number;
  holders: number;
  supply: number;
  logo: string | null;
}

export interface MarketData {
  address: string;
  price: number;
  volume_24h: number;
  volume_6h: number;
  volume_1h: number;
  volume_5m: number;
  liquidity: number;
  market_cap: number;
  fdv: number;
  price_change_5m: number;
  price_change_1h: number;
  price_change_6h: number;
  price_change_24h: number;
  trades_24h: number;
  buys_24h: number;
  sells_24h: number;
  unique_wallets_24h: number;
  created_at: string | null;
  graduated: boolean;
  holder_change_24h: number;
  last_trade_at: string | null;
}

export type Token = TokenInfo & MarketData;

export interface Trade {
  side: "buy" | "sell";
  volume_usd: number;
  time: number;
}

export interface Holder {
  owner: string;
  balance: number;
  pct: number;
}

export interface TokenDetail {
  info: TokenInfo;
  market: MarketData;
  trades: Trade[];
  holders: Holder[];
}

export interface TokenListResponse {
  tokens: Token[];
}

export type RiskClass = "Early" | "Developing" | "Extended" | "High Risk";

export interface RiskFactor {
  label: string;
  severity: "low" | "medium" | "high" | "critical";
  detail: string;
  verified: boolean;
}

export interface RiskReport {
  riskClass: RiskClass;
  score: number;
  factors: RiskFactor[];
}

export interface SignalScore {
  score: number;
  classification: RiskClass;
  factors: { label: string; value: string; weight: number; contribution: number }[];
}

export interface WatchlistEntry {
  id: string;
  token_address: string;
  token_symbol: string;
  token_name: string | null;
  notes: string | null;
  added_at: string;
}

export interface AlertEntry {
  id: string;
  token_address: string;
  token_symbol: string;
  alert_type: "price_up" | "price_down" | "volume_spike" | "liquidity_drop" | "holder_change" | "momentum";
  threshold: number | null;
  timeframe: string;
  active: boolean;
  created_at: string;
}

export interface AlertHistoryEntry {
  id: string;
  alert_id: string | null;
  token_address: string;
  token_symbol: string;
  alert_type: string;
  triggered_value: number | null;
  message: string;
  triggered_at: string;
}

export type View =
  | "dashboard"
  | "new-trending"
  | "graduated"
  | "most-held"
  | "top-movers"
  | "signal-score"
  | "token-scanner"
  | "risk-scanner"
  | "alerts"
  | "watchlist"
  | "market-overview";

export type Timeframe = "5m" | "1h" | "6h" | "24h";
