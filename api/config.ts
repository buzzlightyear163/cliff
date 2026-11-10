import { PublicKey } from "@solana/web3.js";
import { activePlatform, connection, handle, ownPlatformId, solUsd } from "./_lib/solana";

// Only show the CA once the mint exists on chain, so the site never points buyers at an address that isn't live.
async function liveCa(): Promise<string | null> {
  const ca = (process.env.CLIFF_CA || "").trim();
  if (!ca) return null;
  try {
    const acc = await connection().getAccountInfo(new PublicKey(ca));
    return acc ? ca : null;
  } catch {
    return null;
  }
}

let cache: { at: number; v: any } | null = null;

export default handle(async (_req, res) => {
  res.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=60");
  if (cache && Date.now() - cache.at < 20_000) return cache.v;
  const [platform, sol, ca] = await Promise.all([
    activePlatform().catch(() => null),
    solUsd().catch(() => ({ usd: 0, change24h: null })),
    liveCa(),
  ]);
  const v = {
    ticker: "CLIFF",
    ca,
    caPending: !!process.env.CLIFF_CA && !ca,
    x: process.env.X_URL || null,
    platform,
    ownPlatformExpected: ownPlatformId()?.toBase58() ?? null,
    protocolFee: 0.0025,
    solUsd: sol.usd,
  };
  cache = { at: Date.now(), v };
  return v;
});
