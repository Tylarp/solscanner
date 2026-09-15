import type { TokenListResponse, TokenDetail } from "@/types";

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/solana-data`;
const HEADERS = {
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
};

export async function fetchNewTrending(): Promise<TokenListResponse> {
  return fetchEndpoint("?action=new");
}

export async function fetchGraduated(): Promise<TokenListResponse> {
  return fetchEndpoint("?action=graduated");
}

export async function fetchMostHeld(): Promise<TokenListResponse> {
  return fetchEndpoint("?action=most-held");
}

export async function fetchTopMovers(): Promise<TokenListResponse> {
  return fetchEndpoint("?action=top-movers");
}

export async function fetchTokenDetail(mint: string): Promise<TokenDetail> {
  return fetchEndpoint(`?action=token&mint=${encodeURIComponent(mint)}`);
}

async function fetchEndpoint<T>(path: string): Promise<T> {
  const resp = await fetch(`${EDGE_URL}${path}`, { headers: HEADERS });
  if (!resp.ok) {
    let msg = `Request failed (${resp.status})`;
    try {
      const body = await resp.json();
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const data = await resp.json();
  if (data?.error) throw new Error(data.error);
  return data as T;
}
