# Strategy notes — tiny trend-rotation bot

## What the dev tape says (136 hourly bars, 2026-10-29–2026-11-03)

Measured on the kit's dev dataset before writing the bot. Window returns,
first close to last close, per symbol:

- SOL −8.73%, WETH −3.00%, FARTCOIN −10.60%, JITOSOL −8.65%,
  POPCAT −8.82%, RAY −13.92%, WIF −5.81%.

Every asset fell. Buy-and-hold loses on all seven, so the bar for a prize
is low: a bot that mostly sits in cash and only rides genuine uptrends
beats it. The risk is the opposite regime in the unseen final window
(3 whole UTC days from the deadline): a strong uptrend where buy-and-hold
gains a lot. A trend follower that stays invested while the fast EMA is
above the slow EMA captures most of such a move, which is why the bot
holds uptrends instead of trading only mean-reversion bounces.

## The bot

- Fast EMA (8 bars) vs slow EMA (24 bars), seeded through the warm-up
  bars so the EMAs are meaningful at the first tradeable bar.
- Wanted: fast EMA above slow EMA. Hold at most 3 symbols, strongest
  EMA spread first, 30% of equity each.
- Exit when the trend flips or the close falls 4% below the entry close.
- Top up only when a held position has drifted below 24% of equity.
- Skip a buy when the modelled price impact tops 50 bps.
- Orders fill at the next bar's open; sells never fund a buy in the
  same reply (the harness settles that way), so entries size from cash
  on hand.

## The sweep (all graded with the real harness, grade-local --driver process)

Capital is $10,000 USDC (inferred from the returns). Buy-and-hold on the
dev window loses on every symbol (SOL −8.73% ≈ −$873), so anything near
zero already beats the bar; the prize goes to the top 3 by net PnL on the
unseen 3-day final window, so the aim is a shape that survives a bad
regime and catches a good one, not a dev-window maximum.

- Trend follower v1 (EMA 8/24, 30% × 3, stop 4%): **−$661.59**,
  35 trades, win rate 5.3%. Every round trip lost.
- Trend v2 (+ spread 30 bps, momentum > 0): **−$445.24**, 29 trades, 0 wins.
- Trend v4 (slower EMAs 12/36): **−$363.62**, 18 trades, 0 wins.
- Trend v7 (spread 50, momentum +1%, stop 2%, TP 3%): **−$317.06**, 20 trades.
- Mean reversion v1 (dip 2%, TP 1.5%, stop 1.5%, hold 8): **−$324.06**,
  50 trades, win rate 48%, fees $121.98 — the edge is real but the
  round-trip costs eat the small targets.
- Mean reversion v2 (dip 2%, TP 3%, stop 2%, hold 8): **+$8.78**,
  50 trades, win rate 44%, fees $124.15.
- **Mean reversion v3 — SHIPPED (dip 2%, TP 3%, stop 2%, hold 8,
  exits measured from the fill price, 4-bar cooldown after an exit):
  +$35.53, 44 trades over 6 symbols, win rate 54.5%, max drawdown
  3.88%, exposure 24.8%, fees $109.85.** At 2× fees it falls to −$73.81,
  so the edge is thin — stated plainly.
- Neighbor check (dip 2.5%, hold 6, same mechanics): **−$218.64**,
  win rate 33%. The dev window is one noisy sample and the region is
  not robust to small changes; v3 is shipped because it is the best
  measured config AND the offline pass (with a 30 bps round-trip cost
  model) independently ranked the same parameters first (+$551 over 16
  trades, 12 wins), not because the dev number is large.

Honest note: this entry is a bet that the unseen final window rewards
buying hourly dips the way the dev window did, and that the cooldown
keeps it out of falling knives. If the final window trends hard in one
direction, a dip-buyer either banks small bounces (uptrend) or grinds
down on stops (downtrend); the 2% stop and 8-bar timeout bound the
damage, and the drawdown guardrail (25%) was never close to binding
on dev (3.9%).
