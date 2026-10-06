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
// Solana RPC — multiple free endpoints for resilience
// getTokenLargestAccounts and getTokenSupply are cheap and work on free tiers.
// getTokenProgramAccounts is very expensive (10K CU) and often fails on free RPCs,
// so we only use it for the single-token detail view with a fallback.
// ---------------------------------------------------------------------------

const RPC_ENDPOINTS = [
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
  "https://solana-mainnet.api.syndica.io/api-key/public",
];

let rpcIndex = 0;

function nextRpc(): string {
  const rpc = RPC_ENDPOINTS[rpcIndex % RPC_ENDPOINTS.length];
  rpcIndex++;
  return rpc;
}

async function rpcCall(method: string, params: any[], rpc?: string): Promise<any> {
  const endpoint = rpc ?? nextRpc();
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) throw new Error(`RPC error ${resp.status}`);
  const data = await resp.json();
  if (data?.error) throw new Error(data.error.message);
  return data?.result;
}

// Try an RPC call across multiple endpoints until one succeeds
async function rpcCallWithFallback(method: string, params: any[]): Promise<any> {
  let lastErr: Error | null = null;
  for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
    try {
      return await rpcCall(method, params, RPC_ENDPOINTS[i]);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error("All RPC endpoints failed");
}

// Batch multiple RPC calls in a single request to reduce latency
async function rpcBatch(calls: { method: string; params: any[] }[]): Promise<any[]> {
  const body = calls.map((c, i) => ({ jsonrpc: "2.0", id: i + 1, method: c.method, params: c.params }));
  const resp = await fetch(nextRpc(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });
  if (!resp.ok) throw new Error(`RPC batch error ${resp.status}`);
  const data = await resp.json();
  if (!Array.isArray(data)) return [];
  return data.sort((a: any, b: any) => a.id - b.id).map((d: any) => d?.result);
}

// Batch with fallback across multiple endpoints
async function rpcBatchWithFallback(calls: { method: string; params: any[] }[]): Promise<any[]> {
  let lastErr: Error | null = null;
  for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
    try {
      return await rpcBatchOnEndpoint(calls, RPC_ENDPOINTS[i]);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  // Last resort: try individually with fallback
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

async function rpcBatchOnEndpoint(calls: { method: string; params: any[] }[], endpoint: string): Promise<any[]> {
  const body = calls.map((c, i) => ({ jsonrpc: "2.0", id: i + 1, method: c.method, params: c.params }));
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });
  if (!resp.ok) throw new Error(`RPC batch error ${resp.status}`);
  const data = await resp.json();
  if (!Array.isArray(data)) throw new Error("RPC batch returned non-array");
  return data.sort((a: any, b: any) => a.id - b.id).map((d: any) => d?.result);
}

// ---------------------------------------------------------------------------
// On-chain data helpers
// ---------------------------------------------------------------------------

// Get token supply + decimals (cheap call, works on free RPCs)
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

// Get largest token accounts (cheap call, works on free RPCs).
// Returns up to 20 entries with their balances.
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

// Estimate total holder count from the largest accounts data.
//
// getTokenLargestAccounts returns the top 20 token accounts by balance.
// If we know what percentage of total supply these top 20 hold, we can
// estimate the total number of holders statistically:
//   estimated_holders = 20 / (top20_supply_pct / 100)
//
// For example, if top 20 hold 40% of supply, we estimate ~50 total holders.
// If top 20 hold 5% of supply, we estimate ~400 total holders.
//
// We also use transaction activity from DexScreener as a secondary signal
// to sanity-check the estimate — a token with 500 trades in 24h likely has
// more than 20 holders even if concentration is high.
function estimateHolderCount(
  largestAccounts: { address: string; amount: number }[],
  totalSupply: number,
  trades24h: number
): number {
  if (largestAccounts.length === 0) {
    // No on-chain data — estimate from trade activity alone
    if (trades24h > 0) return Math.min(500, Math.max(10, Math.floor(trades24h / 5)));
    return 0;
  }

  const accountCount = largestAccounts.length;
  const top20Balance = largestAccounts.reduce((s, a) => s + a.amount, 0);

  if (totalSupply > 0 && top20Balance > 0) {
    const top20Pct = (top20Balance / totalSupply) * 100;
    if (top20Pct > 0 && top20Pct < 100) {
      const statisticalEstimate = Math.round((accountCount / top20Pct) * 100);
      // Clamp to reasonable range
      const clamped = Math.max(accountCount, Math.min(100000, statisticalEstimate));
      // If we got exactly 20 accounts back, there are likely more holders
      // Use trade activity as a floor when available
      if (accountCount >= 20 && trades24h > 0) {
        const activityFloor = Math.floor(trades24h / 3);
        return Math.max(clamped, Math.min(activityFloor, 50000));
      }
      return clamped;
    }
  }

  // Fallback: use account count with trade activity
  if (trades24h > 0) {
    return Math.max(accountCount, Math.min(Math.floor(trades24h / 5), 500));
  }
  return accountCount;
}

// Get top holders with real wallet addresses for the detail view.
// getTokenLargestAccounts returns token account addresses (ATAs), not wallet owners.
// We batch-resolve each account's owner via getAccountInfo to get the actual wallet.
async function getTopHolders(mint: string): Promise<HolderInfo[]> {
  try {
    const largest = await getLargestAccounts(mint);
    if (largest.length === 0) return [];

    // Get total supply for percentage calculation
    const supplyData = await getTokenSupply(mint);
    const totalSupply = supplyData?.supply ?? 0;

    // Calculate total from largest accounts if supply unavailable
    const total = totalSupply > 0 ? totalSupply : largest.reduce((s, a) => s + a.amount, 0);

    // Batch getAccountInfo to resolve wallet owners
    const ownerCalls = largest.map((acc) => ({
      method: "getAccountInfo",
      params: [acc.address, { encoding: "jsonParsed" }],
    }));

    let ownerResults: any[] = [];
    try {
      ownerResults = await rpcBatchWithFallback(ownerCalls);
    } catch {
      // If batch fails, use token account addresses as fallback
      return largest.map((acc) => ({
        owner: acc.address,
        balance: acc.amount,
        pct: total > 0 ? (acc.amount / total) * 100 : 0,
      }));
    }

    const holders: HolderInfo[] = largest.map((acc, i) => {
      const ownerData = ownerResults?.[i]?.value?.data?.parsed;
      const walletOwner = ownerData?.info?.owner ?? acc.address;
      const balance = acc.amount;
      const pct = total > 0 ? (balance / total) * 100 : 0;
      return { owner: walletOwner, balance, pct };
    });

    // Deduplicate by wallet owner (one wallet can have multiple token accounts)
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

    return Array.from(byOwner.entries())
      .map(([owner, data]) => ({ owner, balance: data.balance, pct: data.pct }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 20);
  } catch {
    return [];
  }
}

// Try to get real holder count via getTokenProgramAccounts (expensive, single token only).
// Falls back to estimate from largest accounts if the expensive call fails.
async function getRealHolderCount(mint: string): Promise<number | null> {
  const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
  const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

  for (const program of [TOKEN_PROGRAM, TOKEN_2022_PROGRAM]) {
    try {
      const result = await rpcCall("getTokenProgramAccounts", [
        program,
        {
          encoding: "jsonParsed",
          filters: [
            { dataSize: 165 },
            { memcmp: { offset: 0, bytes: mint } },
          ],
        },
        { commitment: "confirmed" },
      ], RPC_ENDPOINTS[1]); // Use non-primary endpoint for this expensive call

      const accounts = result?.value;
      if (Array.isArray(accounts) && accounts.length > 0) {
        const nonZero = accounts.filter((acc: any) => {
          const amount = acc?.account?.data?.parsed?.info?.tokenAmount;
          return amount && Number(amount.uiAmount ?? 0) > 0;
        });
        return nonZero.length > 0 ? nonZero.length : accounts.length;
      }
      // If we got an empty array (not an error), the token has 0 holders on this program
      // Try the other program before returning 0
    } catch {
      // Rate limited or error — try next endpoint/program
      continue;
    }
  }
  return null;
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
// Transform DexScreener pair → our Token model
// ---------------------------------------------------------------------------

function pairToToken(pair: DexScreenerPair, holderCount: number = 0, supply: number = 0, decimals: number = 9): Token {
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

  // Unique wallets approximation: use the higher of buys/sells as a proxy
  // since DexScreener doesn't expose unique wallet counts directly
  const uniqueWallets = Math.max(buys24, sells24, Math.floor(totalTxns * 0.7));

  const pc = pair.priceChange;
  const createdAt = pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : null;

  const graduatedDexs = ["raydium", "orca", "meteora", "raydium-clmm", "raydium-v4", "openbook", "pumpswap"];
  const graduated = liq > 20000 && graduatedDexs.includes(pair.dexId);

  const logo = pair.info?.imageUrl ?? null;

  return {
    address: addr,
    symbol: pair.baseToken.symbol ?? "UNKNOWN",
    name: pair.baseToken.name ?? null,
    decimals,
    holders: holderCount,
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
// Token enrichment — fetch real on-chain data for a batch of tokens
// Uses only cheap RPC calls (getTokenSupply + getTokenLargestAccounts) that
// work reliably on free RPC endpoints.
// ---------------------------------------------------------------------------

async function enrichWithOnChainData(pairs: DexScreenerPair[]): Promise<Token[]> {
  // Batch-fetch supply + largest accounts for all tokens in one request.
  // Both are cheap calls that work on free RPCs.
  const allCalls: { method: string; params: any[] }[] = [];
  for (const p of pairs) {
    allCalls.push({ method: "getTokenSupply", params: [p.baseToken.address] });
    allCalls.push({ method: "getTokenLargestAccounts", params: [p.baseToken.address] });
  }

  let results: any[] = [];
  try {
    results = await rpcBatchWithFallback(allCalls);
  } catch {
    results = pairs.map(() => null);
  }

  const tokens: Token[] = pairs.map((p, i) => {
    const supplyResult = results?.[i * 2];
    const largestResult = results?.[i * 2 + 1];

    const supply = supplyResult?.value ? Number(supplyResult.value.uiAmount ?? 0) : 0;
    const decimals = supplyResult?.value?.decimals ?? 9;

    const largestAccounts: { address: string; amount: number }[] = Array.isArray(largestResult?.value)
      ? largestResult.value.slice(0, 20).map((acc: any) => ({
          address: acc.address ?? "unknown",
          amount: Number(acc.uiAmount ?? 0),
        }))
      : [];

    const trades24h = (p.txns?.h24?.buys ?? 0) + (p.txns?.h24?.sells ?? 0);
    const holderCount = estimateHolderCount(largestAccounts, supply, trades24h);

    return pairToToken(p, holderCount, supply, decimals);
  });

  return tokens;
}

// Fetch curated token pairs from DexScreener's various endpoints
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
// Data fetching functions
// ---------------------------------------------------------------------------

async function getNewTrending(): Promise<{ tokens: Token[] }> {
  const curated = await fetchCuratedPairs();
  const deduped = deduplicatePairs(curated);
  const filtered = filterMemecoins(deduped);
  const sorted = filtered.sort((a, b) => (b.pairCreatedAt ?? 0) - (a.pairCreatedAt ?? 0));
  const top = sorted.slice(0, 20);
  const tokens = await enrichWithOnChainData(top);
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
    .slice(0, 20);

  const tokens = await enrichWithOnChainData(graduated);
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
    .slice(0, 20);

  const tokens = await enrichWithOnChainData(ranked);
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
    .slice(0, 20)
    .map((x) => x.pair);

  const tokens = await enrichWithOnChainData(sorted);
  return { tokens };
}

// TOKEN DETAIL — full data for a single token
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

  // Fetch supply, top holders, and try real holder count in parallel.
  // getRealHolderCount uses the expensive getTokenProgramAccounts call —
  // only可行 for a single token, not list views.
  const [supplyData, topHolders, realHolderCount] = await Promise.all([
    getTokenSupply(mint),
    getTopHolders(mint),
    getRealHolderCount(mint),
  ]);

  const decimals = supplyData?.decimals ?? 9;
  const supply = supplyData?.supply ?? 0;

  // Determine holder count: prefer real count, fall back to estimate
  let holderCount: number;
  if (realHolderCount != null && realHolderCount > 0) {
    holderCount = realHolderCount;
  } else {
    // Estimate from top holders data
    const trades24h = bestPair ? (bestPair.txns?.h24?.buys ?? 0) + (bestPair.txns?.h24?.sells ?? 0) : 0;
    const largestAccounts = topHolders.map((h) => ({ address: h.owner, amount: h.balance }));
    holderCount = estimateHolderCount(largestAccounts, supply, trades24h);
  }

  let token: Token;
  if (bestPair) {
    token = pairToToken(bestPair, holderCount, supply, decimals);
  } else {
    token = {
      address: mint,
      symbol: "UNKNOWN",
      name: null,
      decimals,
      holders: holderCount,
      supply,
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

  const { address, symbol, name, decimals: dec, holders: h, supply: sup, logo, ...market } = token;
  return {
    info: { address, symbol, name, decimals: dec, holders: h, supply: sup, logo },
    market: market as MarketData,
    trades,
    holders: topHolders,
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
