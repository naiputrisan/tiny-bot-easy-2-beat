// Tiny mean-reversion bot for "Tiny Bot, Easy $2: Beat Buy-and-Hold on Solana".
//
// What the dev tape showed (136 hourly bars, 2026-10-29–2026-11-03): every
// one of the seven assets fell 3–14%, and a trend follower lost on every
// single round trip (0 wins in 35 trades) — crossovers lag, and fills land
// a bar after the bounce is over. But the tape is noisy around the drift:
// hourly returns average −0.07% with a 0.63% standard deviation, and dips
// bounce. An offline pass over the dev bars found the edge in buying the
// dip: buy 2% below the slow EMA, sell at +3% or −2% or after 8 bars
// won 12 of 16 trades in the offline pass (with a 30 bps round-trip
// cost model); the harness grade below confirms the shape on the real
// fills, fees and impact.
//
// Rules, all deterministic (no clock, no randomness, no environment):
//   - Track each symbol's closes; maintain a slow EMA (24 bars), seeded
//     through the warm-up bars so it is meaningful at the open.
//   - Buy a symbol when its close sits DIP_BPS below its slow EMA and it
//     is not already held. Hold at most MAX_POS symbols.
//   - Each position targets TARGET_W_BPS of equity.
//   - Exit a symbol at +TP_BPS (take the bounce), at −STOP_BPS (cut the
//     knife), or after MAX_HOLD_BARS bars (the bounce never came). The
//     take-profit and stop are measured from the actual fill price (cost
//     over quantity of the filled position), not the decision close.
//   - After any exit, a symbol rests COOLDOWN_BARS bars before it can be
//     bought again: a dip that persists is a falling knife, not a bounce,
//     and re-buying it every bar is churn.
//   - Skip a buy when the modelled price impact is over MAX_IMPACT_BPS.
//   - Never trade during the warm-up bars.
import { runBars, type OrderInput } from './vendor/makefun-bars.ts';

const SLOW_SPAN = 24;
const MAX_POS = 3;
const TARGET_W_BPS = 3000;
const DIP_BPS = 200;
const TP_BPS = 300;
const STOP_BPS = 200;
const MAX_HOLD_BARS = 8;
const COOLDOWN_BARS = 4;
const MAX_IMPACT_BPS = 50;
const SLIPPAGE_BPS = 100;

const emaSlow = new Map<string, bigint>();
const entryPrice = new Map<string, bigint>();
const entrySeq = new Map<string, number>();
const lastExitSeq = new Map<string, number>();

function emaUpdate(prev: bigint | undefined, close: bigint, span: number): bigint {
  if (prev === undefined) return close;
  const kNum = 2n;
  const kDen = BigInt(span + 1);
  return prev + ((close - prev) * kNum) / kDen;
}

function trackBars(state: { latest: Map<string, { c: string }> }): void {
  for (const [symbol, bar] of state.latest) {
    const close = BigInt(bar.c);
    emaSlow.set(symbol, emaUpdate(emaSlow.get(symbol), close, SLOW_SPAN));
  }
}

await runBars({
  onBatch(state) {
    trackBars(state);
    if (state.warmingUp) return [];

    const orders: OrderInput[] = [];

    // Learn each held position's fill price (cost over quantity) the
    // first batch it is seen, so exits measure from the real entry.
    for (const [symbol, pos] of state.positions) {
      if (!entryPrice.has(symbol)) {
        const spec = state.symbols.get(symbol);
        if (spec !== undefined && pos.qty > 0n) {
          const price =
            (pos.cost * 10n ** BigInt(spec.qty_scale + spec.price_scale)) /
            (pos.qty * 10n ** BigInt(state.hello.capital.quote_scale));
          if (price > 0n) entryPrice.set(symbol, price);
        }
      }
      if (!entrySeq.has(symbol)) entrySeq.set(symbol, state.seq);
    }

    // Exits first: take profit, stop out, or timed out.
    for (const [symbol, pos] of state.positions) {
      const close = state.close(symbol);
      if (close === null) continue;
      const entry = entryPrice.get(symbol);
      const heldBars = state.seq - (entrySeq.get(symbol) ?? state.seq);
      const profited = entry !== undefined && close >= (entry * BigInt(10000 + TP_BPS)) / 10000n;
      const stopped = entry !== undefined && close <= (entry * BigInt(10000 - STOP_BPS)) / 10000n;
      const timedOut = heldBars >= MAX_HOLD_BARS;
      if (profited || stopped || timedOut) {
        orders.push({ side: 'sell', symbol, qty: pos.qty, max_slippage_bps: SLIPPAGE_BPS });
        entryPrice.delete(symbol);
        entrySeq.delete(symbol);
        lastExitSeq.set(symbol, state.seq);
      }
    }

    // Entries: symbols dipping DIP_BPS below their slow EMA, strongest
    // dip first, up to MAX_POS open positions. A symbol that just exited
    // rests COOLDOWN_BARS bars first.
    const openSlots = MAX_POS - state.positions.size;
    if (openSlots > 0) {
      const dips = [...state.symbols.keys()]
        .map((symbol) => {
          const slow = emaSlow.get(symbol);
          const close = state.close(symbol);
          if (slow === undefined || close === null) return null;
          if (state.positions.has(symbol)) return null;
          const lastExit = lastExitSeq.get(symbol);
          if (lastExit !== undefined && state.seq - lastExit < COOLDOWN_BARS) return null;
          if (close >= (slow * BigInt(10000 - DIP_BPS)) / 10000n) return null;
          const dipBps = ((slow - close) * 10000n) / slow;
          return { symbol, dipBps, close };
        })
        .filter((x): x is { symbol: string; dipBps: bigint; close: bigint } => x !== null)
        .sort((a, b) => (a.dipBps > b.dipBps ? -1 : a.dipBps < b.dipBps ? 1 : 0))
        .slice(0, openSlots);
      for (const d of dips) {
        const target = (state.equity * BigInt(TARGET_W_BPS)) / 10000n;
        const room = state.weightRoom(d.symbol);
        let amount = target < room ? target : room;
        if (amount > state.cash) amount = state.cash;
        if (amount <= 0n) continue;
        const impact = state.impactBps(d.symbol, amount);
        if (impact !== null && impact > BigInt(MAX_IMPACT_BPS)) continue;
        orders.push({ side: 'buy', symbol: d.symbol, notional_quote_units: amount, max_slippage_bps: SLIPPAGE_BPS });
      }
    }

    return orders;
  },
});
