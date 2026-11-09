import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  Raydium,
  LAUNCHPAD_PROGRAM,
  LaunchpadPool,
  LaunchpadConfig,
  PlatformConfig,
  getPdaPlatformId,
  getPdaVestId,
} from "@raydium-io/raydium-sdk-v2";

export const RPC_URL = process.env.RPC_URL || "https://api.mainnet-beta.solana.com";
export const RAYDIUM_PLATFORM = new PublicKey("4Bu96XjU84XjPDSpveTVf6LYGCkfW5FK7SNkREWcEfV4");
export const SOL_CONFIG = new PublicKey("6s1xP3hpbAfFoNtUNF8mfHsjr2Bd97JxFJRWLbL6aHuX");
export const CPMM_CONFIG = new PublicKey("D4FPEruKEHrG5TenZ2mpDGEfu1iUvTiqBxvpU8HLBvC2");
export const LAUNCH_API = "https://launch-mint-v1.raydium.io";
export const SITE_URL = process.env.SITE_URL || "https://cliff.fun";

let _conn: Connection | null = null;
export function connection() {
  if (!_conn) _conn = new Connection(RPC_URL, { commitment: "confirmed" });
  return _conn;
}

export async function raydiumFor(owner: PublicKey) {
  return Raydium.load({
    connection: connection(),
    owner,
    cluster: "mainnet",
    disableLoadToken: true,
    disableFeatureCheck: true,
    blockhashCommitment: "confirmed",
  });
}

// The platform CLIFF launches through. Own platform when PLATFORM_ADMIN is set and exists on chain.
export function ownPlatformId(): PublicKey | null {
  const admin = process.env.PLATFORM_ADMIN;
  if (!admin) return null;
  try {
    return getPdaPlatformId(LAUNCHPAD_PROGRAM, new PublicKey(admin)).publicKey;
  } catch {
    return null;
  }
}

export type PlatformInfo = {
  id: string;
  own: boolean;
  name: string;
  feeRate: number; // fraction
  creatorFeeRate: number;
  restrictCurveParam: boolean;
};

let platformCache: { at: number; v: PlatformInfo } | null = null;
export async function activePlatform(): Promise<PlatformInfo> {
  if (platformCache && Date.now() - platformCache.at < 60_000) return platformCache.v;
  const own = ownPlatformId();
  const tryIds = own ? [own, RAYDIUM_PLATFORM] : [RAYDIUM_PLATFORM];
  for (const id of tryIds) {
    const acc = await connection().getAccountInfo(id);
    if (!acc) continue;
    const p = PlatformConfig.decode(acc.data);
    const name = Buffer.from(p.name)
      .toString("utf8")
      .replace(/\0/g, "")
      .trim();
    const v: PlatformInfo = {
      id: id.toBase58(),
      own: !!own && id.equals(own),
      name: name || "LaunchLab",
      feeRate: Number(p.feeRate.toString()) / 1e6,
      creatorFeeRate: Number(p.creatorFeeRate.toString()) / 1e6,
      restrictCurveParam: Number(p.restrictCurveParam) === 1,
    };
    platformCache = { at: Date.now(), v };
    return v;
  }
  throw new Error("No LaunchLab platform found");
}

export async function getConfigInfo() {
  const acc = await connection().getAccountInfo(SOL_CONFIG);
  if (!acc) throw new Error("LaunchLab config not found");
  return LaunchpadConfig.decode(acc.data);
}

export async function getPool(poolId: PublicKey) {
  const acc = await connection().getAccountInfo(poolId);
  if (!acc) return null;
  return LaunchpadPool.decode(acc.data);
}

export function vestRecordId(poolId: PublicKey, beneficiary: PublicKey) {
  return getPdaVestId(LAUNCHPAD_PROGRAM, poolId, beneficiary).publicKey;
}

export function txToBase64(tx: VersionedTransaction) {
  return Buffer.from(tx.serialize()).toString("base64");
}

export function pk(v: unknown, field: string): PublicKey {
  if (typeof v !== "string") throw new HttpError(400, `${field} is missing`);
  try {
    return new PublicKey(v);
  } catch {
    throw new HttpError(400, `${field} is not a valid address`);
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function handle(fn: (req: VercelRequest, res: VercelResponse) => Promise<unknown>) {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      const out = await fn(req, res);
      if (!res.headersSent) res.status(200).json(out);
    } catch (e: any) {
      const status = e instanceof HttpError ? e.status : 500;
      const message = e?.message ? String(e.message).slice(0, 400) : "Something failed on the server.";
      if (!res.headersSent) res.status(status).json({ error: message });
    }
  };
}

export function body(req: VercelRequest): Record<string, any> {
  if (req.method !== "POST") throw new HttpError(405, "Use POST");
  const b = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  if (!b || typeof b !== "object") throw new HttpError(400, "Missing body");
  return b;
}

export async function launchApi<T = any>(path: string): Promise<T> {
  const r = await fetch(`${LAUNCH_API}${path}`, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`LaunchLab API ${r.status}`);
  const j: any = await r.json();
  if (!j?.success) throw new Error("LaunchLab API returned no data");
  return j.data as T;
}

export async function solUsd(): Promise<{ usd: number; change24h: number | null }> {
  try {
    const r = await fetch("https://api-v3.raydium.io/mint/price?mints=So11111111111111111111111111111111111111112");
    const j: any = await r.json();
    const usd = Number(j?.data?.So11111111111111111111111111111111111111112);
    if (usd > 0) return { usd, change24h: null };
  } catch {}
  const r = await fetch("https://api.coinbase.com/v2/prices/SOL-USD/spot");
  const j: any = await r.json();
  return { usd: Number(j?.data?.amount), change24h: null };
}
