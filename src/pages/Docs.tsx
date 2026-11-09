import { useSite } from "../lib/site";
import { pct } from "../lib/format";
import { RULES } from "../../shared/curve";

const SECTIONS = [
  ["how", "How it works"],
  ["lock", "The lock"],
  ["traders", "What it means for traders"],
  ["curve", "The curve"],
  ["fees", "Fees"],
  ["token", "$CLIFF"],
  ["risks", "Risks"],
];

export default function Docs() {
  const { config } = useSite();
  const p = config?.platform;
  const platformFee = p?.feeRate ?? 0.0075;
  const creatorFee = p?.creatorFeeRate ?? 0.0005;
  const total = 0.0025 + platformFee + creatorFee;
  return (
    <main className="wrap">
      <div className="docs">
        <nav aria-label="Docs sections">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
        </nav>
        <article>
          <h1>The dev's bag waits</h1>
          <p>
            On every launchpad the dev holds the whole bag from the first second. That is why the biggest seller on most charts is the wallet that made the coin, and why so many
            coins dump right at graduation. CLIFF launches on Raydium LaunchLab with the dev bag locked inside LaunchLab's own program, so it can't be sold until well after the
            coin has graduated.
          </p>

          <h2 id="how">How it works</h2>
          <ol>
            <li><b>You pick the lock:</b> how much of the supply is your bag, how many days it waits after graduation, and how many days it takes to release.</li>
            <li><b>Your wallet signs one transaction.</b> It creates the coin on LaunchLab, sets the lock, and assigns the locked bag to your wallet.</li>
            <li><b>The coin trades on its curve.</b> The locked tokens sit in the pool's vault, controlled by the program, not by anyone's key.</li>
            <li><b>At graduation</b> the raise and the rest of the supply move into a Raydium pool. The program stamps the time and the cliff starts.</li>
            <li><b>After the cliff</b> the bag unlocks linearly, second by second. You claim what has unlocked whenever you want.</li>
          </ol>

          <h2 id="lock">The lock</h2>
          <table>
            <tbody>
              <tr><td>Dev bag</td><td>{pct(RULES.minLock)} to {pct(RULES.maxLock)} of supply</td></tr>
              <tr><td>Cliff, counted from graduation</td><td>{RULES.minCliffDays} days or more</td></tr>
              <tr><td>Release after the cliff</td><td>{RULES.minUnlockDays} days or more, linear</td></tr>
              <tr><td>If the coin never graduates</td><td>The bag never unlocks</td></tr>
              <tr><td>Schedule changes after launch</td><td>Not possible</td></tr>
            </tbody>
          </table>
          <p>
            The locked tokens never enter the curve and are not part of the pool at graduation. They stay in the pool's vault until claimed, and the vault only pays out what the
            schedule allows.
          </p>
          <pre>{`unlocked = bag × (now − cliff_end) ÷ release     (between 0 and bag)
cliff_end = graduation + cliff`}</pre>
          {p?.own && p.restrictCurveParam ? (
            <p>CLIFF's platform on LaunchLab enforces these limits on chain. A launch through it that locks less is rejected by the program itself.</p>
          ) : (
            <p>These limits are checked when CLIFF builds the launch, and the board only lists coins that meet them.</p>
          )}

          <h2 id="traders">What it means for traders</h2>
          <ul>
            <li>No dev bag can be sold into the curve or at graduation.</li>
            <li>The dev only gets paid if the coin graduates and survives the cliff.</li>
            <li>Every unlock date is public. You know exactly when supply can move.</li>
            <li>A dev can still buy with a separate wallet. The lock can't stop that, so check the holders like you always would.</li>
          </ul>

          <h2 id="curve">The curve</h2>
          <p>Pick where the coin starts and where it graduates, or keep LaunchLab's standard curve. The locked bag is taken out first; the rest is split between the curve and the pool.</p>
          <pre>{`run     = graduation ÷ start
free    = supply × (1 − lock)
pool    = free ÷ (1 + √run)
sold    = free − pool
raise   = graduation × pool ÷ supply        in SOL`}</pre>
          <p>LaunchLab's own limits still apply: at least 24 SOL raised, at least 20% sold on the curve and at least 15% left for the pool.</p>

          <h2 id="fees">Fees</h2>
          <table>
            <tbody>
              <tr><td>Trading fee on the curve</td><td>{pct(total, 2)}</td></tr>
              <tr><td>Raydium protocol</td><td>{pct(0.0025, 2)}</td></tr>
              <tr><td>Platform</td><td>{pct(platformFee, 2)}</td></tr>
              <tr><td>Coin creator</td><td>{pct(creatorFee, 2)}</td></tr>
              <tr><td>Launching</td><td>Network fees, about 0.02 SOL</td></tr>
            </tbody>
          </table>
          <p>At graduation 90% of the LP is burned and 10% is locked for the creator's fee share.</p>

          <h2 id="token">$CLIFF</h2>
          <p>
            $CLIFF launches on CLIFF, with its own dev bag locked by the same rules as every other coin here. Its contract address shows at the top of every page the moment it is
            live, and nowhere before that.
          </p>

          <h2 id="risks">Risks</h2>
          <ul>
            <li>Memecoins usually go to zero. A locked dev bag does not make a coin good.</li>
            <li>CLIFF builds transactions; your wallet signs them. Check what you sign.</li>
            <li>Coins launched here can also be traded directly on Raydium and in any terminal.</li>
          </ul>
        </article>
      </div>
    </main>
  );
}
