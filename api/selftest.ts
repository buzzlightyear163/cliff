import { Keypair } from "@solana/web3.js";
import { LL } from "../shared/curve";
import { activePlatform, connection, getConfigInfo, handle } from "./_lib/solana";
import { buildLaunch } from "./build-launch";

// Simulates a full CLIFF launch (create + locked dev bag, optional dev buy) against mainnet without sending it.
export default handle(async (req) => {
  const owner = String(req.query.owner || "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9");
  const conn = connection();
  const [platform, cfg] = await Promise.all([activePlatform(), getConfigInfo()]);
  const config = {
    maxLockRate: Number(cfg.maxLockRate.toString()) / 1e6,
    minSellRateA: Number(cfg.minSellRateA.toString()) / 1e6,
    minMigrateRateA: Number(cfg.minMigrateRateA.toString()) / 1e6,
    minFundRaisingSol: Number(cfg.minFundRaisingB.toString()) / 1e9,
    migrateFeeSol: Number(cfg.migrateFee.toString()) / 1e9,
    tradeFeeRate: Number(cfg.tradeFeeRate.toString()) / 1e6,
  };
  const cases = [
    { label: "standard curve, 10% lock, no dev buy", startMcSol: LL.defaultStartMcSol, gradMcSol: LL.defaultGradMcSol, lockRate: 0.1, devBuySol: 0 },
    { label: "higher start, 15% lock, 0.5 SOL dev buy", startMcSol: 140, gradMcSol: 1050, lockRate: 0.15, devBuySol: 0.5 },
  ];
  const results = [];
  for (const c of cases) {
    try {
      const out = await buildLaunch(
        { owner, name: "Cliff Test", symbol: "CTEST", uri: "https://example.com/meta.json", cliffDays: 30, unlockDays: 90, ...c },
        { mint: Keypair.generate() },
      );
      const sim = await conn.simulateTransaction(out.tx, { sigVerify: false, replaceRecentBlockhash: true, commitment: "processed" });
      results.push({
        label: c.label,
        bytes: out.tx.serialize().length,
        err: sim.value.err,
        units: sim.value.unitsConsumed,
        logs: (sim.value.logs || []).filter((l) => /Instruction:|error|Error|failed|success/i.test(l)).slice(-14),
        plan: { raiseSol: out.plan.raiseSol, soldRate: out.plan.soldRate, poolRate: out.plan.poolRate, lockTokens: out.plan.lockTokens },
      });
    } catch (e: any) {
      results.push({ label: c.label, buildError: String(e?.message || e) });
    }
  }
  return { platform, config, results };
});
