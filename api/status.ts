import { HttpError, connection, handle } from "./_lib/solana";

export default handle(async (req) => {
  const sig = String(req.query.sig || "");
  if (!/^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(sig)) throw new HttpError(400, "Bad signature");
  const st = await connection().getSignatureStatuses([sig], { searchTransactionHistory: false });
  const s = st.value[0];
  return {
    confirmed: !!s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized") && !s.err,
    failed: !!s?.err,
    err: s?.err ?? null,
  };
});
