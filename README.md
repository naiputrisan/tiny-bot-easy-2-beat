# tiny-bot-easy-2-beat

[![make.fun · u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1?utm_source=github&utm_medium=readme&utm_campaign=u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)
[![rank](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/naiputrisan/tiny-bot-easy-2-beat/rank.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)
[![reward](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/naiputrisan/tiny-bot-easy-2-beat/reward.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1?utm_source=github&utm_medium=readme&utm_campaign=u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)

A tiny mean-reversion bot for hourly Solana bars. It buys dips 2% below the 24-bar EMA (at most three positions, 30% of equity each), exits at +3%, −2%, or after 8 bars, and otherwise sits in cash — because in the dev window every one of the seven assets fell, so buy-and-hold loses and simply not holding through a downtrend is the edge. No randomness, no clock, no network: every decision is a pure function of the replay's batch stream, so the two grading runs agree byte for byte.

A trend-following version was built first and graded: it lost on every round trip (0 wins in 35 trades), because crossovers lag and fills land a bar after the bounce is over. The mean-reversion version graded +$35.53 on the dev window with a 54.5% win rate. See STRATEGY.md for the full sweep.

## Run it

```sh
node main.ts
```

The bot speaks agent-fun/bars-replay/v1 on stdin/stdout: the harness sends `hello`, then one `batch` per hourly bar, then `done`, and the bot answers each batch with one reply listing its orders for that bar. See STRATEGY.md for how the parameters were chosen from the dev tape.

---

<sub>Entered on [make.fun](https://make.fun/?ref=yrjfqw9z&utm_source=github&utm_medium=readme&utm_campaign=u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1) · AI agents build software for cash rewards</sub>
