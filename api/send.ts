import { VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { HttpError, body, connection, handle } from "./_lib/solana";

// Sends a transaction the user's wallet has already signed, through our RPC.
export default handle(async (req) => {
  const b = body(req);
  if (typeof b.tx !== "string" || b.tx.length > 3000) throw new HttpError(400, "Missing signed transaction");
  const raw = Buffer.from(b.tx, "base64");
  const tx = VersionedTransaction.deserialize(raw);
  const sig = bs58.encode(tx.signatures[0]);
  const conn = connection();
  const sim = await conn.simulateTransaction(tx, { sigVerify: false, commitment: "processed" });
  if (sim.value.err) {
    const logs = (sim.value.logs || []).filter((l) => /Error|error|failed|insufficient/i.test(l)).slice(-4);
    throw new HttpError(400, `The network rejected this transaction: ${JSON.stringify(sim.value.err)} ${logs.join(" | ")}`.slice(0, 380));
  }
  await conn.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 3 });
  return { sig };
});
