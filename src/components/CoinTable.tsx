import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Coin } from "../lib/api";
import { ago, days, pct, until, usd } from "../lib/format";
import { useSite } from "../lib/site";

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function coinPhase(c: Coin, now: number) {
  if (!c.startTime) return { phase: "curve" as const, text: `${days(c.cliffDays)} after graduation` };
  if (now < c.startTime) return { phase: "cliff" as const, text: `in ${until(c.startTime - now)}`, left: c.startTime - now };
  const end = c.startTime + c.unlockDays * 86400;
  if (now < end) {
    const r = (now - c.startTime) / (end - c.startTime);
    return { phase: "unlocking" as const, text: `Releasing, ${pct(r)} out`, rate: r };
  }
  return { phase: "unlocked" as const, text: "Fully released" };
}

export function mcapUsd(c: Coin, solUsd: number) {
  if (c.status === "curve" && c.mcSol != null) return c.mcSol * solUsd;
  return c.mcUsd;
}

export default function CoinTable({ coins, limit }: { coins: Coin[]; limit?: number }) {
  const nav = useNavigate();
  const now = useNow();
  const { solUsd } = useSite();
  const rows = limit ? coins.slice(0, limit) : coins;
  return (
    <div className="table-wrap">
      <table className="coins">
        <thead>
          <tr>
            <th>Coin</th>
            <th>Market cap</th>
            <th className="hide-sm">Curve</th>
            <th className="hide-sm">Dev bag</th>
            <th>Dev bag unlocks</th>
            <th className="hide-sm">Age</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const ph = coinPhase(c, now);
            return (
              <tr key={c.mint} onClick={() => nav(`/c/${c.mint}`)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && nav(`/c/${c.mint}`)}>
                <td>
                  <div className="coin-cell">
                    {c.image ? <img className="coin-img" src={c.image} alt="" loading="lazy" /> : <span className="coin-img" />}
                    <div>
                      <div className="coin-name">{c.name || "Unnamed"}</div>
                      <div className="coin-sym">${c.symbol}</div>
                    </div>
                  </div>
                </td>
                <td>{usd(mcapUsd(c, solUsd))}</td>
                <td className="hide-sm">
                  {c.status === "curve" ? (
                    <>
                      <span className="bar">
                        <i style={{ width: `${Math.max(2, c.fill * 100)}%` }} />
                      </span>
                      {pct(c.fill, 1)}
                    </>
                  ) : (
                    <span className="sea">Graduated</span>
                  )}
                </td>
                <td className="hide-sm">
                  <span className="pill lock">{pct(c.lockRate)} locked</span>
                </td>
                <td className={ph.phase === "cliff" ? "num" : ""}>{ph.text}</td>
                <td className="muted hide-sm">{ago(c.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
