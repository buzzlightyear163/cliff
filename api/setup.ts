import { ComputeBudgetProgram, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import BN from "bn.js";
import {
  LAUNCHPAD_PROGRAM,
  LaunchpadCurveRuleField as F,
  LaunchpadCurveRuleOp as Op,
  createPlatformConfig,
  createPlatformCurveRuleIns,
  getPdaPlatformCurveRule,
  getPdaPlatformId,
  updatePlatformConfig,
  updatePlatformCurveRuleIns,
} from "@raydium-io/raydium-sdk-v2";
import { RULES, DAY } from "../shared/curve";
import { CPMM_CONFIG, HttpError, SITE_URL, SOL_CONFIG, body, connection, handle, pk, txToBase64 } from "./_lib/solana";

// One-time platform setup, signed by the admin wallet in the browser.
// step "platform": creates CLIFF's LaunchLab platform (fees go to the admin wallet).
// step "rules": writes the lock rule on chain and turns enforcement on.
// step "status": reports what exists.
export default handle(async (req) => {
  const b = body(req);
  const admin = pk(b.owner, "owner");
  const platformId = getPdaPlatformId(LAUNCHPAD_PROGRAM, admin).publicKey;
  const ruleId = getPdaPlatformCurveRule(LAUNCHPAD_PROGRAM, platformId, SOL_CONFIG).publicKey;
  const conn = connection();
  const [pAcc, rAcc] = await conn.getMultipleAccountsInfo([platformId, ruleId]);

  if (b.step === "status") {
    return { platformId: platformId.toBase58(), platformExists: !!pAcc, ruleExists: !!rAcc };
  }

  const ixs: TransactionInstruction[] = [ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 20_000 })];
  if (b.step === "platform") {
    if (pAcc) throw new HttpError(400, "The platform already exists for this wallet.");
    const feeRate = Math.round(Number(b.feeRate ?? 0.005) * 1e6);
    const creatorFeeRate = Math.round(Number(b.creatorFeeRate ?? 0.003) * 1e6);
    if (!(feeRate >= 0 && feeRate <= 10_000)) throw new HttpError(400, "Platform fee has to be between 0% and 1%.");
    if (!(creatorFeeRate >= 0 && creatorFeeRate <= 10_000)) throw new HttpError(400, "Creator fee has to be between 0% and 1%.");
    ixs.push(
      createPlatformConfig(
        LAUNCHPAD_PROGRAM,
        admin,
        admin,
        admin,
        admin,
        platformId,
        CPMM_CONFIG,
        admin,
        { platformScale: new BN(0), creatorScale: new BN(100_000), burnScale: new BN(900_000) },
        new BN(feeRate),
        new BN(creatorFeeRate),
        String(b.name || "CLIFF").slice(0, 30),
        String(b.web || SITE_URL).slice(0, 120),
        String(b.img || `${SITE_URL}/mark-512.png`).slice(0, 200),
        new BN(0),
      ),
    );
  } else if (b.step === "rules") {
    if (!pAcc) throw new HttpError(400, "Create the platform first.");
    if (!rAcc) ixs.push(createPlatformCurveRuleIns(LAUNCHPAD_PROGRAM, admin, platformId, SOL_CONFIG, ruleId));
    ixs.push(
      updatePlatformCurveRuleIns(LAUNCHPAD_PROGRAM, admin, platformId, SOL_CONFIG, ruleId, 0, [
        { field: F.LockRate, op: Op.Gte, value: new BN(Math.round(RULES.minLock * 1e6)) },
        { field: F.LockRate, op: Op.Lte, value: new BN(Math.round(RULES.maxLock * 1e6)) },
        { field: F.CliffPeriod, op: Op.Gte, value: new BN(RULES.minCliffDays * DAY) },
        { field: F.UnlockPeriod, op: Op.Gte, value: new BN(RULES.minUnlockDays * DAY) },
      ]),
    );
    ixs.push(updatePlatformConfig(LAUNCHPAD_PROGRAM, admin, platformId, { type: "updateRestrictCurveParam", value: new BN(1) }));
  } else {
    throw new HttpError(400, "Unknown step");
  }

  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const tx = new VersionedTransaction(new TransactionMessage({ payerKey: admin, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message());
  return { tx: txToBase64(tx), lastValidBlockHeight, platformId: platformId.toBase58() };
});
