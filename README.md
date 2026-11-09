# CLIFF

A launchpad on Raydium LaunchLab where the dev's bag is locked on-chain. The bag can't move while the coin is on the curve, then waits a cliff after graduation, then releases linearly.

## How it is built

- `src/` Vite + React site (home, launch, board, coin page, docs, setup).
- `api/` Vercel functions. They build every transaction server-side with `@raydium-io/raydium-sdk-v2`; the user's wallet signs.
  - `build-launch` creates the coin on LaunchLab with `totalLockedAmount`, `cliffPeriod` and `unlockPeriod`, and assigns the whole locked bag to the creator (`CreateVestingAccount`) in the same transaction.
  - `build-claim` claims unlocked tokens (or assigns an unassigned bag while on the curve).
  - `coins`, `coin` read pools from chain and names/images from Raydium's LaunchLab index.
  - `upload` stores the coin image and metadata in Vercel Blob.
  - `setup` creates CLIFF's own LaunchLab platform and writes the on-chain lock rule.
  - `selftest` simulates two full launches against mainnet without sending anything.
- `shared/curve.ts` the launch math, shared by site and API.

## Environment

| Variable | What |
| --- | --- |
| `RPC_URL` | Solana RPC (a Helius free key works). Falls back to the public RPC. |
| `BLOB_READ_WRITE_TOKEN` | Set automatically when a Vercel Blob store is connected. |
| `PLATFORM_ADMIN` | Wallet that ran `/setup`. Launches then go through CLIFF's own platform. Without it they use Raydium's default platform. |
| `CLIFF_CA` | $CLIFF contract address. Shows the live strip on every page once set. |
| `X_URL` | X profile link. |
| `SITE_URL` | Public site URL, used in token metadata. |
