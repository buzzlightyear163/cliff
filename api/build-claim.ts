import { ComputeBudgetProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { LAUNCHPAD_PROGRAM, LaunchpadVesting, claimVestedToken, createVestingAccount, getPdaLaunchpadAuth } from "@raydium-io/raydium-sdk-v2";
import { HttpError, body, connection, getPool, handle, pk, txToBase64, vestRecordId } from "./_lib/solana";

// action "claim": beneficiary claims unlocked tokens after the cliff.
// action "allocate": creator assigns the unallocated part of the lock to a wallet (only while on the curve).
export default handle(async (req) => {
  const b = body(req);
  const owner = pk(b.owner, "owner");
  const poolId = pk(b.poolId, "poolId");
  const conn = connection();
  const pool = await getPool(poolId);
  if (!pool) throw new HttpError(404, "Pool not found");
  const ixs = [ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 20_000 })];

  if (b.action === "allocate") {
    if (!pool.creator.equals(owner)) throw new HttpError(403, "Only the creator can assign the locked bag.");
    if (pool.status !== 0) throw new HttpError(400, "The bag can only be assigned while the coin is on the curve.");
    const left = pool.vestingSchedule.totalLockedAmount.sub(pool.vestingSchedule.totalAllocatedShare);
    if (left.lten(0)) throw new HttpError(400, "The whole bag is already assigned.");
    const beneficiary = b.beneficiary ? pk(b.beneficiary, "beneficiary") : owner;
    ixs.push(createVestingAccount(LAUNCHPAD_PROGRAM, owner, beneficiary, poolId, vestRecordId(poolId, beneficiary), left));
  } else {
    const rec = vestRecordId(poolId, owner);
    const recAcc = await conn.getAccountInfo(rec);
    if (!recAcc) throw new HttpError(404, "This wallet has no locked bag on this coin.");
    const v = LaunchpadVesting.decode(recAcc.data);
    const start = Number(pool.vestingSchedule.startTime.toString());
    const now = Math.floor(Date.now() / 1000);
    if (!start || now < start) throw new HttpError(400, "Nothing has unlocked yet. The cliff is still running.");
    const unlockPeriod = Number(pool.vestingSchedule.unlockPeriod.toString());
    const share = Number(v.tokenShareAmount.toString());
    const unlocked = unlockPeriod <= 0 ? share : Math.floor((share * Math.min(now - start, unlockPeriod)) / unlockPeriod);
    if (unlocked - Number(v.claimedAmount.toString()) <= 0) throw new HttpError(400, "Everything unlocked so far is already claimed.");
    const ata = getAssociatedTokenAddressSync(pool.mintA, owner, false, TOKEN_PROGRAM_ID);
    ixs.push(createAssociatedTokenAccountIdempotentInstruction(owner, ata, owner, pool.mintA, TOKEN_PROGRAM_ID));
    ixs.push(
      claimVestedToken(
        LAUNCHPAD_PROGRAM,
        owner,
        getPdaLaunchpadAuth(LAUNCHPAD_PROGRAM).publicKey,
        poolId,
        rec,
        ata,
        pool.vaultA,
        pool.mintA,
        TOKEN_PROGRAM_ID,
      ),
    );
  }
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const tx = new VersionedTransaction(new TransactionMessage({ payerKey: owner, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message());
  return { tx: txToBase64(tx), lastValidBlockHeight };
});
