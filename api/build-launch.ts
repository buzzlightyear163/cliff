import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";
import {
  LAUNCHPAD_PROGRAM,
  TxVersion,
  createVestingAccount,
  getMainLookupTableCache,
  getPdaLaunchpadPoolId,
} from "@raydium-io/raydium-sdk-v2";
import { NATIVE_MINT } from "@solana/spl-token";
import { planLaunch, RULES, DAY } from "../shared/curve";
import {
  HttpError,
  SOL_CONFIG,
  activePlatform,
  body,
  connection,
  getConfigInfo,
  handle,
  pk,
  raydiumFor,
  txToBase64,
  vestRecordId,
} from "./_lib/solana";

const PRIORITY_MICROLAMPORTS = Number(process.env.PRIORITY_MICROLAMPORTS || 20_000);
const CU_LIMIT = 600_000;

export type LaunchRequest = {
  owner: string;
  name: string;
  symbol: string;
  uri: string;
  startMcSol: number;
  gradMcSol: number;
  lockRate: number;
  cliffDays: number;
  unlockDays: number;
  devBuySol?: number;
  beneficiary?: string;
};

export function validateLaunch(b: Record<string, any>) {
  const name = String(b.name ?? "").trim();
  const symbol = String(b.symbol ?? "").trim().replace(/^\$/, "").toUpperCase();
  const uri = String(b.uri ?? "").trim();
  if (!name || name.length > 32) throw new HttpError(400, "Name has to be 1 to 32 characters.");
  if (!symbol || symbol.length > 10) throw new HttpError(400, "Ticker has to be 1 to 10 characters.");
  if (!/^https:\/\//.test(uri) || uri.length > 200) throw new HttpError(400, "Upload the coin image first.");
  const lockRate = Number(b.lockRate);
  const cliffDays = Number(b.cliffDays);
  const unlockDays = Number(b.unlockDays);
  const startMcSol = Number(b.startMcSol);
  const gradMcSol = Number(b.gradMcSol);
  const devBuySol = Math.max(0, Number(b.devBuySol || 0));
  if (!(lockRate >= RULES.minLock - 1e-9 && lockRate <= RULES.maxLock + 1e-9))
    throw new HttpError(400, `The dev bag has to be between ${RULES.minLock * 100}% and ${RULES.maxLock * 100}% of supply.`);
  if (!(cliffDays >= RULES.minCliffDays && cliffDays <= 365)) throw new HttpError(400, `The cliff has to be ${RULES.minCliffDays} days or more.`);
  if (!(unlockDays >= RULES.minUnlockDays && unlockDays <= 730)) throw new HttpError(400, `The release has to run ${RULES.minUnlockDays} days or more.`);
  if (!(startMcSol > 0 && gradMcSol > 0)) throw new HttpError(400, "Pick where the coin starts and graduates.");
  const plan = planLaunch({ startMcSol, gradMcSol, lockRate });
  if (!plan.ok) throw new HttpError(400, plan.errors[0]);
  if (devBuySol > plan.raiseSol / 2) throw new HttpError(400, `Dev buy can be at most ${(plan.raiseSol / 2).toFixed(1)} SOL on this curve.`);
  return { name, symbol, uri, lockRate, cliffDays, unlockDays, startMcSol, gradMcSol, devBuySol, plan };
}

export async function buildLaunch(b: Record<string, any>, opts: { mint?: Keypair } = {}) {
  const owner = pk(b.owner, "owner");
  const beneficiary = b.beneficiary ? pk(b.beneficiary, "beneficiary") : owner;
  const v = validateLaunch(b);
  const conn = connection();
  const [platform, configInfo, raydium] = await Promise.all([activePlatform(), getConfigInfo(), raydiumFor(owner)]);

  const mint = opts.mint ?? Keypair.generate();
  const { publicKey: poolId } = getPdaLaunchpadPoolId(LAUNCHPAD_PROGRAM, mint.publicKey, NATIVE_MINT);
  const lockedRaw = new BN(v.plan.raw.totalLockedAmount);

  const res = await raydium.launchpad.createLaunchpad({
    programId: LAUNCHPAD_PROGRAM,
    mintA: mint.publicKey,
    name: v.name,
    symbol: v.symbol,
    uri: v.uri,
    decimals: 6,
    migrateType: "cpmm",
    configId: SOL_CONFIG,
    configInfo,
    platformId: new PublicKey(platform.id),
    txVersion: TxVersion.V0,
    slippage: new BN(300), // 3% on the dev buy
    buyAmount: new BN(Math.floor(v.devBuySol * 1e9)),
    createOnly: v.devBuySol <= 0,
    extraSigners: [mint],
    supply: new BN(v.plan.raw.supply),
    totalSellA: new BN(v.plan.raw.totalSellA),
    totalFundRaisingB: new BN(v.plan.raw.totalFundRaisingB),
    totalLockedAmount: lockedRaw,
    cliffPeriod: new BN(Math.round(v.cliffDays * DAY)),
    unlockPeriod: new BN(Math.round(v.unlockDays * DAY)),
  });

  const sdkIx: TransactionInstruction[] = res.builder.allInstructions.filter(
    (ix) => !ix.programId.equals(ComputeBudgetProgram.programId),
  );
  // Lock the whole dev bag to the creator in the same transaction as the launch.
  const vestIx = createVestingAccount(
    LAUNCHPAD_PROGRAM,
    owner,
    beneficiary,
    poolId,
    vestRecordId(poolId, beneficiary),
    lockedRaw,
  );

  const instructions = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_MICROLAMPORTS }),
    ...sdkIx,
    vestIx,
  ];
  const [luts, { blockhash, lastValidBlockHeight }] = await Promise.all([
    getMainLookupTableCache(conn),
    conn.getLatestBlockhash("confirmed"),
  ]);
  const msg = new TransactionMessage({ payerKey: owner, recentBlockhash: blockhash, instructions }).compileToV0Message(
    Object.values(luts),
  );
  const tx = new VersionedTransaction(msg);
  tx.sign([mint]);
  const size = tx.serialize().length;
  if (size > 1232) throw new Error(`Launch transaction is too large (${size} bytes). Lower the dev buy to 0 and try again.`);

  return {
    tx,
    mint: mint.publicKey.toBase58(),
    poolId: poolId.toBase58(),
    platformId: platform.id,
    lastValidBlockHeight,
    plan: v.plan,
    swap: res.extInfo?.swapInfo
      ? { tokensOut: Number(res.extInfo.swapInfo.decimalOutAmount?.toString?.() ?? 0) }
      : null,
  };
}

export default handle(async (req) => {
  const b = body(req);
  const out = await buildLaunch(b);
  return {
    tx: txToBase64(out.tx),
    mint: out.mint,
    poolId: out.poolId,
    platformId: out.platformId,
    lastValidBlockHeight: out.lastValidBlockHeight,
    plan: out.plan,
  };
});
