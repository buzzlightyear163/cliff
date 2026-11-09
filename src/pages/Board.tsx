import { Link } from "react-router-dom";
import CoinTable from "../components/CoinTable";
import Tally from "../components/Tally";
import Led from "../components/Led";
import { useBoard } from "../lib/board";
import { ago, days, pct, tokens } from "../lib/format";

export default function Board() {
  const { board, error } = useBoard();
  const s = board?.stats;
  return (
    <main className="wrap" style={{ paddingTop: 40 }}>
      <div className="block-head">
        <div>
          <h1 style={{ margin: 0, fontSize: "clamp(34px,4.5vw,52px)", lineHeight: 1, fontWeight: 850, fontVariationSettings: '"wdth" 115', letterSpacing: "-0.03em" }}>
            Board
          </h1>
          <p className="sub" style={{ marginTop: 10 }}>
            Every coin here locked the dev bag on chain at launch. Click one to see exactly when it can move.
          </p>
        </div>
        <Link className="btn" to="/launch">
          Launch a coin
        </Link>
      </div>

      <div className="panel">
        <div className="stats">
          <div className="stat">
            <div className="k">Launched on CLIFF</div>
            <div className="v led-wrap"><Led text={s ? String(s.launched) : "-"} pitch={4.5} /></div>
          </div>
          <div className="stat">
            <div className="k">On the curve</div>
            <div className="v led-wrap"><Led text={s ? String(s.onCurve) : "-"} pitch={4.5} /></div>
          </div>
          <div className="stat">
            <div className="k">Graduated</div>
            <div className="v led-wrap"><Led text={s ? String(s.graduated) : "-"} pitch={4.5} /></div>
          </div>
          <div className="stat">
            <div className="k">Dev tokens still locked</div>
            <div className="v led-wrap"><Led text={s ? tokens(s.lockedTokens) : "-"} pitch={4.5} /></div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        {board && board.coins.length > 0 ? (
          <CoinTable coins={board.coins} />
        ) : (
          <div className="empty">
            <b>{error ? "The board could not load." : board ? "No coins yet." : "Loading the board."}</b>{" "}
            {error ? error : board ? "Launch the first one. It shows up here the moment it confirms." : ""}
          </div>
        )}
      </div>

      <section className="block">
        <div className="block-head">
          <div>
            <h2>Elsewhere on LaunchLab</h2>
            <p className="sub">The newest coins across Raydium LaunchLab and whether their dev bag is locked.</p>
          </div>
        </div>
        <Tally data={board?.elsewhere ?? null} />
        {board && board.elsewhere.recent.length > 0 && (
          <div className="panel" style={{ marginTop: 18 }}>
            <div className="table-wrap">
              <table className="coins">
                <thead>
                  <tr>
                    <th>Coin</th>
                    <th>Launched via</th>
                    <th>Curve</th>
                    <th>Dev bag</th>
                    <th>Age</th>
                  </tr>
                </thead>
                <tbody>
                  {board.elsewhere.recent.map((c) => (
                    <tr key={c.mint} onClick={() => window.open(`https://raydium.io/launchpad/token/?mint=${c.mint}`, "_blank")}>
                      <td>
                        <div className="coin-cell">
                          {c.image ? <img className="coin-img" src={c.image} alt="" loading="lazy" /> : <span className="coin-img" />}
                          <div>
                            <div className="coin-name">{c.name}</div>
                            <div className="coin-sym">${c.symbol}</div>
                          </div>
                        </div>
                      </td>
                      <td className="muted">{c.platform || "LaunchLab"}</td>
                      <td>
                        <span className="bar">
                          <i style={{ width: `${Math.max(2, c.fill * 100)}%` }} />
                        </span>
                        {pct(c.fill, 1)}
                      </td>
                      <td>
                        {c.lockRate > 0 ? (
                          <span className="pill lock">
                            {pct(c.lockRate)} locked, {days(c.cliffDays)} cliff
                          </span>
                        ) : (
                          <span className="pill none">Nothing locked</span>
                        )}
                      </td>
                      <td className="muted">{ago(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
