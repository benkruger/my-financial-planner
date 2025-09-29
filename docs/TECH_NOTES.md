# TECH NOTES

This document captures the technical details needed to re‑implement or audit the model and UI.

## Overview
- Client‑only static SPA. No server or persistence.
- Everything in today’s dollars (real terms). Stocks modeled with real returns.
- Spending comes from cash only. Stocks are sold to refill cash under policy.

## Inputs
- Age now, Retirement age
- All‑in yearly spending (today’s $)
- Social Security at 70 (today’s $/yr)
- Starting Cash, Starting Stocks

Validation: non‑negative amounts; `retirementAge ≥ age`.

## Time and Units
- Yearly simulation from `retirementAge → 95`.
- `NEED[y] = max(0, spending – SS(y))`, where `SS(y)=SS70` if age ≥70, else 0.

## Start Cash Needed
- Defined as the first retirement year’s `NEED` (one‑year cash at start).
- Longer cash ladders (up to 10 years) are optional and may be built via refills.

## Initial Allocation
Given `Starting Cash`, allocate earliest‑first to `cover[y]` for the first up to 10 retirement years.
Track `initialCoveredYears` (count of fully funded years among the next 10).

## Monte Carlo Model (real terms)
- Per‑year real stock return `r ~ Normal(μ=0.05, σ=0.18)`, truncated at −95%.
- Trials: default 1,000; common random numbers (CRN) via a fixed base seed for stability across solver calls.

## Annual Mechanics
For each year `y` in horizon:
1) Spend from `cover[y]`. If shortfall `gap > 0`:
   - Emergency sale: sell up to `gap` immediately to cover year `y`.
   - Scaled prefill: if stocks are abundant, allocate a conservative budget across the next 10 years (earliest‑first) subject to reserves:
     - Keep at least ~65% of pre‑emergency stocks invested.
     - Total emergency sales in a year capped at ~35% of pre‑emergency stocks.
2) Apply stock return `r` to remaining stocks.
3) Refill on recovery (High‑Water‑Mark gate): after a drawdown and subsequent recovery to the prior peak, sell a conservative budget to fill earliest‑first needs within the next 10 years:
   - Reserve at least ~70% of stocks invested after sales.
   - Dynamic target band ~3–6 years depending on `S` vs unfunded `gap10`.

Success for a trial: no shortfall in all retirement years.

## Start Stocks Needed Solver
Goal: minimum starting stocks `S0` so ≥90% of trials succeed given the user’s cash allocation.

- Bisection on `S0` with CRN. Upper bound expands geometrically until success ≥90% or cap.
- Trials: start 1,000, with adaptive batching near the 90% threshold:
  - If `|success−90| ≤ ~1.2` and sampling error (SE) `> 0.6%`, increase trials to 3,000, then 5,000 max.
  - Re‑run bisection at increased trials. Report `trialsUsed` and `stderrPct`.

## Minimum Starting Cash (optional guidance)
When current cash cannot reach ≥90% at any stock level:
1) Compute a full 10‑year buffer (sum of first `min(10,horizon)` `NEED`s) as an upper bound.
2) Bisection between current cash and full buffer to find the smallest cash that makes ≥90% achievable.
3) Re‑solve Start Stocks Needed at that cash.

## Baseline Path
- One representative (fixed‑seed) Monte Carlo path for illustrative table and charts.
- Table columns: Year, Age, Spend, SS, Cash used, Sold (emergency), Sold (recovery), Future coverage cash (earmarked), Stocks end, Funded years ahead (next 10).

## Display and Rounding
- Start Stocks Needed: round up to $25k/$50k/$100k steps by magnitude.
- Start Cash Needed: round up to $1,000.
- Chance of success: 1 decimal; animated counter on results.
- Chips show tooltips with trials + SE used (solver and MC run).

## Randomness and Seeds
- PRNG: mulberry32 with integral seeds.
- CRN for solver/MC: base seed `123456`; per‑trial seed = `baseSeed + i*9973`.
- Baseline table: fixed seed `246813` (independent of solver/MC seeds).
- Results MC (the "Chance of success" run): base seed `78901`.

## UI Conventions
- Inputs page styled with gradient hero; “Your age” auto‑focused; validation prevents empty submits.
- Results header left‑aligned brand; “Back to Inputs” button in header on Results.
- Export JSON hidden by default; appears at bottom only if `?debug=true` (or `?debug`).
- Charts use Chart.js 4.x (line charts for ladder and stocks). Any equivalent charting library is acceptable; values are provided as arrays per year.

## Performance Notes
- 1k trials keep the app responsive on typical hardware.
- Adaptive solver increases trials only when near the feasibility boundary; otherwise most runs stay at 1k.

## File Map
- index.html — layout for Landing, Inputs, Results.
- app.css — styles for hero, chips, tables, hints, loader.
- app.js — UI logic, worker comms, rendering, loader with 2s min.
- sim-worker.js — Monte Carlo, HWM logic, solver, adaptive batching.
- docs/*.md — product, inputs, simulation design, UX, and this file.

## QA Tips
- Use `?debug=true` to expose export. The JSON includes inputs, solver metadata (trials/SE), and baseline rows.
- To exercise adaptive batching, try inputs close to feasibility: small Starting Cash, high spending, or earlier retirement.
