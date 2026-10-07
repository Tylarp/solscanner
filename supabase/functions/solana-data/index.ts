const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TokenInfo {
  address: string;
  symbol: string;
  name: string | null;
  decimals: number;
  holders: number;
  supply: number;
  logo: string | null;
}

interface MarketData {
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

type Token = TokenInfo & MarketData;

interface HolderInfo {
  owner: string;
  balance: number;
  pct: number;
}

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceNative: string;
  priceUsd?: string;
  fdv?: number;
  marketCap?: number;
  liquidity?: { usd?: number; base?: number; quote?: number };
  volume?: { h24?: number; h6?: number; h1?: number; m5?: number };
  priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
  txns?: {
    m5?: { buys: number; sells: number };
    h1?: { buys: number; sells: number };
    h6?: { buys: number; sells: number };
    h24?: { buys: number; sells: number };
  };
  pairCreatedAt?: number;
  info?: {
    imageUrl?: string;
    websites?: { url: string }[];
    socials?: { type: string; url: string }[];
  };
}

// ---------------------------------------------------------------------------
// DexScreener API — no key required, 300 req/min
// ---------------------------------------------------------------------------

const DEXSCREENER_API = "https://api.dexscreener.com";

async function dexFetch(path: string): Promise<any> {
  const resp = await fetch(`${DEXSCREENER_API}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) {
    throw new Error(`DexScreener API error ${resp.status} on ${path}`);
  }
  return resp.json();
}

// ---------------------------------------------------------------------------
// Jupiter API — requires API key, used for real-time prices and swap quotes
// ---------------------------------------------------------------------------

const JUPITER_API = "https://api.jup.ag";
const JUPITER_KEY = "jup_978c3424d25296ab543f788e363eaf52d3e6dd16b7967589a5c22b943024e06c";

// SOL mint address — used as the quote currency for swap quotes
const SOL_MINT = "So11111111111111111111111111111111111111112";
// USDC mint address
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// Fetch real-time USD price for a token from Jupiter Price API v3
async function getJupiterPrice(mint: string): Promise<number | null> {
  try {
    const resp = await fetch(
      `${JUPITER_API}/price/v3?ids=${mint}`,
      {
        headers: { "x-api-key": JUPITER_KEY },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    // v3 returns { data: { "<mint>": { id, price } } }
    const price = data?.data?.[mint]?.price;
    return price ? Number(price) : null;
  } catch {
    return null;
  }
}

// Fetch swap quote from Jupiter — shows how much output you get for a given input amount
// Returns price impact, routes, and expected output amount
async function getJupiterSwapQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: number = 50
): Promise<SwapQuote | null> {
  try {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount,
      slippageBps: String(slippageBps),
      restrictIntermediateTokens: "true",
    });

    const resp = await fetch(
      `${JUPITER_API}/swap/v1/quote?${params}`,
      {
        headers: { "x-api-key": JUPITER_KEY },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data || !data.outAmount) return null;

    return {
      inputMint,
      outputMint,
      inAmount: data.inAmount,
      outAmount: data.outAmount,
      otherAmountThreshold: data.otherAmountThreshold,
      swapMode: data.swapMode,
      slippageBps: data.slippageBps,
      priceImpactPct: data.priceImpactPct ? Number(data.priceImpactPct) * 100 : 0,
      routePlan: (data.routePlan ?? []).slice(0, 5).map((r: any) => ({
        swapInfo: {
          ammKey: r.swapInfo?.ammKey ?? "",
          label: r.swapInfo?.label ?? "",
          inputMint: r.swapInfo?.inputMint ?? "",
          outputMint: r.swapInfo?.outputMint ?? "",
          inAmount: r.swapInfo?.inAmount ?? "",
          outAmount: r.swapInfo?.outAmount ?? "",
          feeAmount: r.swapInfo?.feeAmount ?? "",
          feeMint: r.swapInfo?.feeMint ?? "",
        },
      })),
    };
  } catch {
    return null;
  }
}

interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: number;
  routePlan: { swapInfo: {
    ammKey: string;
    label: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    feeAmount: string;
    feeMint: string;
  } }[];
}

// ---------------------------------------------------------------------------
// Solana RPC — used ONLY for the single-token detail page.
// List views use DexScreener data exclusively to avoid timeouts.
// ---------------------------------------------------------------------------

const RPC_ENDPOINTS = [
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
  "https://solana-mainnet.api.syndica.io/api-key/public",
];

async function rpcCallWithFallback(method: string, params: any[]): Promise<any> {
  let lastErr: Error | null = null;
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) throw new Error(`RPC error ${resp.status}`);
      const data = await resp.json();
      if (data?.error) throw new Error(data.error.message);
      return data?.result;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error("All RPC endpoints failed");
}

async function rpcBatchWithFallback(calls: { method: string; params: any[] }[]): Promise<any[]> {
  let lastErr: Error | null = null;
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const body = calls.map((c, i) => ({ jsonrpc: "2.0", id: i + 1, method: c.method, params: c.params }));
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) throw new Error(`RPC batch error ${resp.status}`);
      const data = await resp.json();
      if (!Array.isArray(data)) throw new Error("RPC batch returned non-array");
      return data.sort((a: any, b: any) => a.id - b.id).map((d: any) => d?.result);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  // Last resort: try individually
  return Promise.all(
    calls.map(async (c) => {
      try {
        return await rpcCallWithFallback(c.method, c.params);
      } catch {
        return null;
      }
    })
  );
}

// ---------------------------------------------------------------------------
// On-chain data helpers (detail page only)
// ---------------------------------------------------------------------------

async function getTokenSupply(mint: string): Promise<{ supply: number; decimals: number } | null> {
  try {
    const result = await rpcCallWithFallback("getTokenSupply", [mint]);
    if (result?.value) {
      return {
        supply: Number(result.value.uiAmount ?? 0),
        decimals: result.value.decimals ?? 9,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function getLargestAccounts(mint: string): Promise<{ address: string; amount: number }[]> {
  try {
    const result = await rpcCallWithFallback("getTokenLargestAccounts", [mint]);
    const accounts = result?.value;
    if (!Array.isArray(accounts)) return [];
    return accounts.slice(0, 20).map((acc: any) => ({
      address: acc.address ?? "unknown",
      amount: Number(acc.uiAmount ?? 0),
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Holder count estimation — uses DexScreener data only, no RPC calls.
//
// DexScreener gives us buy/sell transaction counts per timeframe. We use these
// to estimate holder count:
// - unique_wallets_24h = max(buys, sells) is a proxy for unique active wallets
// - total unique wallets over the token's lifetime is much higher than 24h active
// - We scale the 24h active wallets by the token's age to estimate total holders
// - For very new tokens, the 24h activity is a good proxy since most holders are recent
// ---------------------------------------------------------------------------

function estimateHolderCount(
  trades24h: number,
  buys24h: number,
  sells24h: number,
  createdAt: string | null,
  marketCap: number,
  liquidity: number
): number {
  const uniqueWallets24h = Math.max(buys24h, sells24h, Math.floor(trades24h * 0.7));

  if (trades24h === 0 && uniqueWallets24h === 0) {
    // No trade activity — estimate from market cap / liquidity as a last resort
    if (marketCap > 1000000) return Math.max(500, Math.floor(marketCap / 10000));
    if (marketCap > 100000) return Math.max(50, Math.floor(marketCap / 5000));
    if (liquidity > 50000) return Math.max(30, Math.floor(liquidity / 5000));
    return 0;
  }

  // Base estimate from 24h unique wallets
  let estimate = uniqueWallets24h;

  // Scale up based on token age — older tokens have accumulated more holders
  // than their 24h active count suggests
  if (createdAt) {
    const ageHours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
    if (ageHours < 24) {
      // Very new token — most holders are active in 24h, minimal scaling
      estimate = Math.round(uniqueWallets24h * 1.5);
    } else if (ageHours < 168) {
      // 1-7 days old — moderate scaling
      const ageDays = ageHours / 24;
      estimate = Math.round(uniqueWallets24h * (1.5 + ageDays * 0.3));
    } else {
      // Older than a week — many holders may not be active in 24h
      const ageDays = ageHours / 24;
      // Scale up but cap the multiplier at 10x
      const multiplier = Math.min(10, 1.5 + ageDays * 0.5);
      estimate = Math.round(uniqueWallets24h * multiplier);
    }
  } else {
    // Unknown age — use a conservative 3x multiplier
    estimate = Math.round(uniqueWallets24h * 3);
  }

  // Market cap also correlates with holder count — use as a floor
  if (marketCap > 0) {
    const mcFloor = Math.floor(marketCap / 5000);
    estimate = Math.max(estimate, Math.min(mcFloor, estimate * 5));
  }

  // Ensure minimum of the 24h active wallets
  estimate = Math.max(estimate, uniqueWallets24h);

  // Clamp to reasonable range
  return Math.max(1, Math.min(100000, estimate));
}

// Estimate supply from market cap and price (no RPC call needed)
function estimateSupply(marketCap: number, price: number): number {
  if (price > 0 && marketCap > 0) {
    return Math.round(marketCap / price);
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Exclusion lists — infrastructure / DeFi / stable tokens that are NOT memecoins
// ---------------------------------------------------------------------------

const INFRA_TOKENS = new Set([
  "So11111111111111111111111111111111111111112",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  "5wykSvLxbgBY7J7Q5hbh4SCaQcigngDxzfUc17nHxXU9",
  "J1toso1uCk3RLmjorhTtrVwYFxHqtH97RTUlyVGuDRJ8",
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  "rndrizKT3MK1iimdxRdWdaF5zGVb7Wev1UPQRxXfU",
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaZ1p3bSc",
]);

const INFRA_SYMBOLS = new Set([
  "SOL", "WSOL", "USDC", "USDT", "USDH", "USDR", "MSOL", "JUPSOL",
  "BSOL", "STSOL", "JITO", "JITOSOL",
  "JUP", "RAY", "ORCA", "MET", "METEORA",
  "BNB", "ETH", "WBTC", "BTC",
  "PYTH", "PYTHS", "RNDR", "RENDER",
  "MNGO", "STEP", "SBR", "SLND", "PORT",
  "KIN", "TULIP", "SUNNY", "ROPE",
  "FIDA", "SLIM", "ATLAS", "POLIS",
  "SAMO", "ORC",
  "COIN", "DUST", "WUMBO",
  "AURY", "SHDW", "PRISM", "PRISMA",
  "LIKE", "GARI", "MEDIA",
  "JST", "SABER", "CREMA", "CASHIO",
  "UXD", "UXP",
  "GOAT", "MIMO",
  "JTO",
  "DRIFT", "DRF", "ZETA", "ZBCN",
  "PERP", "PSI",
  "LIQ", "INF",
  "RIB",
]);

const INFRA_NAME_FRAGMENTS = [
  "usd coin", "tether", "usdc", "usdt",
  "wrapped solana", "wsol",
  "jito", "jitosol",
  "marinade", "msol",
  "raydium", "orca", "meteora",
  "jupiter",
  "pyth", "render", "rndr",
  "mango", "stepn", "saber",
  "drift", "zeta",
  "solend", "port finance",
  "uxd", "uxp",
  "bonk",
  "jito staked",
];

function isMemecoin(pair: DexScreenerPair): boolean {
  const addr = pair.baseToken.address;
  const sym = (pair.baseToken.symbol ?? "").toUpperCase();
  const name = (pair.baseToken.name ?? "").toLowerCase();

  if (INFRA_TOKENS.has(addr)) return false;
  if (INFRA_SYMBOLS.has(sym)) return false;
  if (sym.length <= 2) return false;

  for (const frag of INFRA_NAME_FRAGMENTS) {
    if (name.includes(frag)) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Transform DexScreener pair → our Token model (DexScreener data only, no RPC)
// ---------------------------------------------------------------------------

function pairToToken(pair: DexScreenerPair): Token {
  const addr = pair.baseToken.address;
  const price = parseFloat(pair.priceUsd ?? "0") || 0;
  const liq = pair.liquidity?.usd ?? 0;
  const mc = pair.marketCap ?? pair.fdv ?? 0;
  const vol24 = pair.volume?.h24 ?? 0;
  const vol6 = pair.volume?.h6 ?? 0;
  const vol1 = pair.volume?.h1 ?? 0;
  const vol5 = pair.volume?.m5 ?? 0;

  const txns24 = pair.txns?.h24;
  const buys24 = txns24?.buys ?? 0;
  const sells24 = txns24?.sells ?? 0;
  const totalTxns = buys24 + sells24;

  const uniqueWallets = Math.max(buys24, sells24, Math.floor(totalTxns * 0.7));

  const pc = pair.priceChange;
  const createdAt = pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : null;

  const graduatedDexs = ["raydium", "orca", "meteora", "raydium-clmm", "raydium-v4", "openbook", "pumpswap"];
  const graduated = liq > 20000 && graduatedDexs.includes(pair.dexId);

  const logo = pair.info?.imageUrl ?? null;

  const holders = estimateHolderCount(totalTxns, buys24, sells24, createdAt, mc, liq);
  const supply = estimateSupply(mc, price);

  return {
    address: addr,
    symbol: pair.baseToken.symbol ?? "UNKNOWN",
    name: pair.baseToken.name ?? null,
    decimals: 9,
    holders,
    supply,
    logo,
    price,
    volume_24h: vol24,
    volume_6h: vol6,
    volume_1h: vol1,
    volume_5m: vol5,
    liquidity: liq,
    market_cap: mc,
    fdv: pair.fdv ?? 0,
    price_change_5m: pc?.m5 ?? 0,
    price_change_1h: pc?.h1 ?? 0,
    price_change_6h: pc?.h6 ?? 0,
    price_change_24h: pc?.h24 ?? 0,
    trades_24h: totalTxns,
    buys_24h: buys24,
    sells_24h: sells24,
    unique_wallets_24h: uniqueWallets,
    created_at: createdAt,
    graduated,
    holder_change_24h: 0,
    last_trade_at: null,
  };
}

function deduplicatePairs(pairs: DexScreenerPair[]): DexScreenerPair[] {
  const best = new Map<string, DexScreenerPair>();
  for (const p of pairs) {
    if (p.chainId !== "solana") continue;
    const addr = p.baseToken.address;
    if (!addr) continue;
    const existing = best.get(addr);
    if (!existing || (p.liquidity?.usd ?? 0) > (existing.liquidity?.usd ?? 0)) {
      best.set(addr, p);
    }
  }
  return Array.from(best.values());
}

function filterMemecoins(pairs: DexScreenerPair[]): DexScreenerPair[] {
  return pairs.filter(isMemecoin);
}

// ---------------------------------------------------------------------------
// DexScreener data fetching helpers
// ---------------------------------------------------------------------------

async function fetchCuratedPairs(): Promise<DexScreenerPair[]> {
  let pairs: DexScreenerPair[] = [];

  try {
    const boostsData = await dexFetch("/token-boosts/top/v1");
    const boosts: any[] = Array.isArray(boostsData) ? boostsData : [];
    const solanaAddrs = boosts
      .filter((b) => b.chainId === "solana" && b.tokenAddress)
      .slice(0, 30)
      .map((b) => b.tokenAddress);

    if (solanaAddrs.length > 0) {
      const pairsData = await dexFetch(`/tokens/v1/solana/${solanaAddrs.join(",")}`);
      pairs = [...pairs, ...((Array.isArray(pairsData) ? pairsData : []) as DexScreenerPair[])];
    }
  } catch { /* ignore */ }

  try {
    const profilesData = await dexFetch("/token-profiles/latest/v1");
    const profiles: any[] = Array.isArray(profilesData) ? profilesData : [];
    const solanaAddresses = profiles
      .filter((p) => p.chainId === "solana" && p.tokenAddress)
      .slice(0, 30)
      .map((p) => p.tokenAddress);

    if (solanaAddresses.length > 0) {
      const pairsData = await dexFetch(`/tokens/v1/solana/${solanaAddresses.join(",")}`);
      pairs = [...pairs, ...((Array.isArray(pairsData) ? pairsData : []) as DexScreenerPair[])];
    }
  } catch { /* ignore */ }

  try {
    const takeoversData = await dexFetch("/community-takeovers/latest/v1");
    const takeovers: any[] = Array.isArray(takeoversData) ? takeoversData : [];
    const solanaAddrs = takeovers
      .filter((t) => t.chainId === "solana" && t.tokenAddress)
      .slice(0, 30)
      .map((t) => t.tokenAddress);

    if (solanaAddrs.length > 0) {
      const pairsData = await dexFetch(`/tokens/v1/solana/${solanaAddrs.join(",")}`);
      pairs = [...pairs, ...((Array.isArray(pairsData) ? pairsData : []) as DexScreenerPair[])];
    }
  } catch { /* ignore */ }

  try {
    const latestBoostsData = await dexFetch("/token-boosts/latest/v1");
    const latestBoosts: any[] = Array.isArray(latestBoostsData) ? latestBoostsData : [];
    const solanaAddrs = latestBoosts
      .filter((b) => b.chainId === "solana" && b.tokenAddress)
      .slice(0, 30)
      .map((b) => b.tokenAddress);

    if (solanaAddrs.length > 0) {
      const pairsData = await dexFetch(`/tokens/v1/solana/${solanaAddrs.join(",")}`);
      pairs = [...pairs, ...((Array.isArray(pairsData) ? pairsData : []) as DexScreenerPair[])];
    }
  } catch { /* ignore */ }

  return pairs;
}

async function searchMemecoins(terms: string[]): Promise<DexScreenerPair[]> {
  const results = await Promise.all(
    terms.map(async (q) => {
      try {
        const data = await dexFetch(`/latest/dex/search?q=${encodeURIComponent(q)}&chain=solana`);
        return (data?.pairs ?? []) as DexScreenerPair[];
      } catch {
        return [];
      }
    })
  );
  return results.flat();
}

// ---------------------------------------------------------------------------
// List view data functions — DexScreener only, no RPC calls
// ---------------------------------------------------------------------------

async function getNewTrending(): Promise<{ tokens: Token[] }> {
  const curated = await fetchCuratedPairs();
  const deduped = deduplicatePairs(curated);
  const filtered = filterMemecoins(deduped);
  const sorted = filtered.sort((a, b) => (b.pairCreatedAt ?? 0) - (a.pairCreatedAt ?? 0));
  const tokens = sorted.slice(0, 25).map((p) => pairToToken(p));
  return { tokens };
}

async function getGraduated(): Promise<{ tokens: Token[] }> {
  const curated = await fetchCuratedPairs();
  const deduped = deduplicatePairs(curated);
  const filtered = filterMemecoins(deduped);

  const graduated = filtered
    .filter((p) => {
      const liq = p.liquidity?.usd ?? 0;
      const isGraduatedDex = ["raydium", "orca", "meteora", "raydium-clmm", "raydium-v4", "openbook", "pumpswap"].includes(p.dexId);
      return liq > 20000 && isGraduatedDex;
    })
    .sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0))
    .slice(0, 25);

  const tokens = graduated.map((p) => pairToToken(p));
  return { tokens };
}

async function getMostHeld(): Promise<{ tokens: Token[] }> {
  const curated = await fetchCuratedPairs();

  const memecoinSearches = [
    "cat", "doge", "pepe", "frog", "dog", "wojak",
    "chad", "moon", "based", "brett", "floki", "shib",
    "wif", "popcat", "nana", "michi", "myro", "silly",
    "slerf", "gigachad", "mumu", "raccoon",
  ];
  const searchPairs = await searchMemecoins(memecoinSearches);

  const allPairs = [...curated, ...searchPairs];
  const deduped = deduplicatePairs(allPairs);
  const filtered = filterMemecoins(deduped);

  const ranked = filtered
    .sort((a, b) => {
      const aTxns = (a.txns?.h24?.buys ?? 0) + (a.txns?.h24?.sells ?? 0);
      const bTxns = (b.txns?.h24?.buys ?? 0) + (b.txns?.h24?.sells ?? 0);
      if (bTxns !== aTxns) return bTxns - aTxns;
      return (b.marketCap ?? 0) - (a.marketCap ?? 0);
    })
    .slice(0, 25);

  const tokens = ranked.map((p) => pairToToken(p));
  // Sort by estimated holder count
  tokens.sort((a, b) => b.holders - a.holders);
  return { tokens };
}

async function getTopMovers(): Promise<{ tokens: Token[] }> {
  const curated = await fetchCuratedPairs();

  const memecoinSearches = ["cat", "doge", "pepe", "wif", "popcat", "michi", "myro", "slerf", "brett", "floki"];
  const searchPairs = await searchMemecoins(memecoinSearches);

  const allPairs = [...curated, ...searchPairs];
  const deduped = deduplicatePairs(allPairs);
  const filtered = filterMemecoins(deduped);

  const sorted = filtered
    .map((p) => ({ pair: p, absChange: Math.abs(p.priceChange?.h24 ?? 0) }))
    .sort((a, b) => b.absChange - a.absChange)
    .slice(0, 25)
    .map((x) => x.pair);

  const tokens = sorted.map((p) => pairToToken(p));
  return { tokens };
}

// ---------------------------------------------------------------------------
// TOKEN DETAIL — full data for a single token (uses RPC for real on-chain data)
// ---------------------------------------------------------------------------

async function getTokenDetail(mint: string): Promise<{
  info: TokenInfo;
  market: MarketData;
  trades: { side: "buy" | "sell"; volume_usd: number; time: number }[];
  holders: HolderInfo[];
}> {
  let pairs: DexScreenerPair[] = [];
  try {
    const pairsData = await dexFetch(`/tokens/v1/solana/${mint}`);
    pairs = Array.isArray(pairsData) ? pairsData : [];
  } catch { /* ignore */ }

  if (pairs.length === 0) {
    try {
      const searchData = await dexFetch(`/latest/dex/search?q=${mint}`);
      pairs = (searchData?.pairs ?? []).filter(
        (p: DexScreenerPair) => p.chainId === "solana" && p.baseToken.address === mint
      );
    } catch { /* ignore */ }
  }

  const bestPair = pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];

  // Start with DexScreener-based estimate
  let token: Token;
  if (bestPair) {
    token = pairToToken(bestPair);
  } else {
    token = {
      address: mint,
      symbol: "UNKNOWN",
      name: null,
      decimals: 9,
      holders: 0,
      supply: 0,
      logo: null,
      price: 0,
      volume_24h: 0,
      volume_6h: 0,
      volume_1h: 0,
      volume_5m: 0,
      liquidity: 0,
      market_cap: 0,
      fdv: 0,
      price_change_5m: 0,
      price_change_1h: 0,
      price_change_6h: 0,
      price_change_24h: 0,
      trades_24h: 0,
      buys_24h: 0,
      sells_24h: 0,
      unique_wallets_24h: 0,
      created_at: null,
      graduated: false,
      holder_change_24h: 0,
      last_trade_at: null,
    };
  }

  // Try to enrich with real on-chain data + Jupiter price (single token, safe to make RPC calls)
  const [supplyData, largestAccounts, jupiterPrice] = await Promise.all([
    getTokenSupply(mint),
    getLargestAccounts(mint),
    getJupiterPrice(mint),
  ]);

  if (supplyData) {
    token.supply = supplyData.supply;
    token.decimals = supplyData.decimals;
  }

  // Override price with Jupiter's real-time price if available (more accurate)
  if (jupiterPrice && jupiterPrice > 0) {
    token.price = jupiterPrice;
    // Recalculate market cap from real price + real supply
    if (token.supply > 0) {
      token.market_cap = token.supply * jupiterPrice;
      token.fdv = token.market_cap;
    }
  }

  // Resolve top holder wallet addresses via batch getAccountInfo
  let topHolders: HolderInfo[] = [];
  if (largestAccounts.length > 0) {
    const totalSupply = supplyData?.supply ?? largestAccounts.reduce((s, a) => s + a.amount, 0);

    try {
      const ownerCalls = largestAccounts.map((acc) => ({
        method: "getAccountInfo",
        params: [acc.address, { encoding: "jsonParsed" }],
      }));
      const ownerResults = await rpcBatchWithFallback(ownerCalls);

      const holders: HolderInfo[] = largestAccounts.map((acc, i) => {
        const ownerData = ownerResults?.[i]?.value?.data?.parsed;
        const walletOwner = ownerData?.info?.owner ?? acc.address;
        const balance = acc.amount;
        const pct = totalSupply > 0 ? (balance / totalSupply) * 100 : 0;
        return { owner: walletOwner, balance, pct };
      });

      // Deduplicate by wallet owner
      const byOwner = new Map<string, { balance: number; pct: number }>();
      for (const h of holders) {
        const existing = byOwner.get(h.owner);
        if (existing) {
          existing.balance += h.balance;
          existing.pct += h.pct;
        } else {
          byOwner.set(h.owner, { balance: h.balance, pct: h.pct });
        }
      }

      topHolders = Array.from(byOwner.entries())
        .map(([owner, data]) => ({ owner, balance: data.balance, pct: data.pct }))
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 20);
    } catch {
      // Fallback: use token account addresses without owner resolution
      topHolders = largestAccounts.map((acc) => ({
        owner: acc.address,
        balance: acc.amount,
        pct: totalSupply > 0 ? (acc.amount / totalSupply) * 100 : 0,
      }));
    }
  }

  // Build trade data from DexScreener txn counts
  const trades: { side: "buy" | "sell"; volume_usd: number; time: number }[] = [];
  const txns = bestPair?.txns;
  if (txns) {
    const now = Date.now();
    const intervals: { key: keyof typeof txns; ms: number; vol: number }[] = [
      { key: "m5", ms: 300_000, vol: bestPair.volume?.m5 ?? 0 },
      { key: "h1", ms: 3_600_000, vol: bestPair.volume?.h1 ?? 0 },
      { key: "h6", ms: 21_600_000, vol: bestPair.volume?.h6 ?? 0 },
      { key: "h24", ms: 86_400_000, vol: bestPair.volume?.h24 ?? 0 },
    ];
    for (const { key, ms, vol } of intervals) {
      const t = txns[key];
      if (t) {
        const totalTxns = t.buys + t.sells;
        if (totalTxns > 0) {
          const volPerTrade = vol / totalTxns;
          for (let i = 0; i < Math.min(totalTxns, 30); i++) {
            trades.push({
              side: i < t.buys ? "buy" : "sell",
              volume_usd: volPerTrade,
              time: now - ms + Math.floor((ms / Math.min(totalTxns, 30)) * i),
            });
          }
        }
      }
    }
  }

  const { address, symbol, name, decimals, holders, supply, logo, ...market } = token;
  return {
    info: { address, symbol, name, decimals, holders, supply, logo },
    market: market as MarketData,
    trades,
    holders: topHolders,
    jupiterPrice: jupiterPrice,
  };
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace("/functions/v1/solana-data", "");
    const params = url.searchParams;
    const action = params.get("action") || path.split("/").filter(Boolean)[0] || "";

    let result: unknown;

    switch (action) {
      case "new":
      case "new-trending":
        result = await getNewTrending();
        break;
      case "graduated":
        result = await getGraduated();
        break;
      case "most-held":
        result = await getMostHeld();
        break;
      case "top-movers":
      case "trending":
        result = await getTopMovers();
        break;
      case "token": {
        const mint = params.get("mint") || path.split("/").filter(Boolean)[1] || "";
        if (!mint) {
          return new Response(
            JSON.stringify({ error: "Missing mint address" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        result = await getTokenDetail(mint);
        break;
      }
      case "swap-quote": {
        const inputMint = params.get("inputMint") || SOL_MINT;
        const outputMint = params.get("outputMint") || params.get("mint") || "";
        const amount = params.get("amount") || "1000000";
        const slippage = parseInt(params.get("slippageBps") || "50", 10);
        if (!outputMint) {
          return new Response(
            JSON.stringify({ error: "Missing outputMint or mint parameter" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const quote = await getJupiterSwapQuote(inputMint, outputMint, amount, slippage);
        if (!quote) {
          return new Response(
            JSON.stringify({ error: "No swap route found. The token may not have sufficient liquidity." }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        result = quote;
        break;
      }
      case "price": {
        const mint = params.get("mint") || "";
        if (!mint) {
          return new Response(
            JSON.stringify({ error: "Missing mint parameter" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const price = await getJupiterPrice(mint);
        result = { mint, price };
        break;
      }
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
