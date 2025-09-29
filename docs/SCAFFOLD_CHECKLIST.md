# Scaffold Checklist

Use this as a fast path to recreate the app.

## File structure
- `index.html` — sections: `#landing`, `#inputs`, `#results`
- `app.css` — hero, chips, tables, hint, loader
- `app.js` — DOM wiring, validation, worker messaging, rendering
- `sim-worker.js` — Monte Carlo + solver
- `docs/` — product, inputs, simulation design, UX, TECH_NOTES

## Landing
- Hero with:
  - Badge: “Today’s dollars • Real returns”
  - H1 split: “Two clear numbers!”/“Retire with confidence.”
  - Bullets with icons: Start Cash Needed, Start Stocks Needed, Tough‑market test, Refill only after recovery
  - CTA: Get Started (mobile sticky bottom)

## Inputs
- 6 fields with live currency formatting; auto‑focus age
- Button: full‑width Run Plan
- Hint callout: retirement year + SS start year
- Native validation + custom checks (non‑negative, `retireAge ≥ age`)

## Results
- Summary chips row:
  - Start Stocks Needed (rounded)
  - Your Starting Cash (Short/Enough/Extra badge)
  - Your Starting Stocks (badge)
  - Chance of success (animated number)
- Banner: red when infeasible, otherwise muted reminder about today’s dollars
- Input Snapshot: 2‑column grid
- Baseline Table: per‑year (see TECH_NOTES)
- Charts: ladder total and stocks balance (Chart.js)
- Header: “Back to Inputs” visible on results only
- Debug footer (only if `?debug=true`): Export JSON button at bottom; small “Trials used” line under chips

## Worker API
- Message in: `{ type:'run', payload:{ inputs } }`
- Message out: `{ type:'result', payload:{ ... } }` with fields:
  - `startCashNeeded` (year‑1 need), `startStocksNeeded`, `feasible90`, `maxSuccessCap`
  - `minCashFor90`, `stocksNeededAtMinCash` (when infeasible)
  - `startingCash`, `startingStocks`
  - `successPct`, `firstTroubleYearAge`
  - `successTrials`, `successSE`, `solverTrials`, `solverSE`
  - `baselineRows`, `seriesYears`, `stocks`, `coverage`, `initialCoveredYears`

## Core functions
- `computeNeeds(spend, ss70, retireAge, H)`
- `allocateStartingCash(startCash, needs, H)` → `cover[y]` for earliest years
- `simulateTrial(S0, needs, cover, retireAge, mean, stdev, seed)` → firstTrouble, series
- `monteCarlo(S0, needs, cover, retireAge, trials, mean, stdev, baseSeed)` → successPct, stderrPct, trials
- `solveStartStocksNeeded(needs, cover, retireAge, target=90, trialsInit=1000, ...)` with adaptive batching
- `solveMinCashForFeasibility(needs, startCash, retireAge, target)`
- `baselineTable(S0, needs, cover, retireAge, ageNow, ...)`

## Display rounding
- Start Cash Needed: round up $1,000
- Start Stocks Needed: round up to $25k/$50k/$100k by magnitude

## Randomness
- mulberry32 PRNG
- CRN: base seed 123456, per‑trial `base + i*9973`
- Baseline seed 246813; Results MC base seed 78901

