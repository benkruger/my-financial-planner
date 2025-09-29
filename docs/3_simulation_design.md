# 3) Simulation Design

## Modeling (real terms)
- **Stocks**: yearly **real** returns ~ Normal(**mean 5%**, **stdev 18%**), capped at −95% to avoid pathological tails.  
- **Cash/notes**: treated as **safe purchasing power** (we model everything in today’s dollars).  
- **Trials**: **1000**. **Target**: **≥90%** success to **age 95**.

## Core mechanics
1) **Need** per retirement year: `NEED[y] = max(0, spending − SS(y))`, with `SS(y)=SS70` for ages **≥ 70**, else 0.  
2) **Start Cash Needed**: the first retirement year’s `NEED` only (1‑year cash at start). Longer ladders are optional and may be built over time via refills.  
3) **Allocate starting cash** into a year‑indexed cover array `cover[y]` for the earliest years (up to 10).  
4) **Annual simulation**:
   - Spend from `cover[y]`. Any gap marks a **trouble** year in that path.  
   - **Emergency sale (scaled)**: if there is a cash gap, sell stocks immediately to cover the current year; then, if stocks are abundant, pre‑fill multiple rungs. Prefill band `K_e = clamp(1 + round(3·S_pre/(S_pre+gap10f)), 1..6)`. Budget `B_e = min(extraNeed, gap10f) · (1 − e^{−S_pre/(2·gap10f)})`, capped so at least **65%** of pre‑emergency stocks remain invested and total emergency sales in the year are ≤ **35%** of pre‑emergency stocks. Allocate earliest‑first across next 10 years.  
   - Apply stock return `r`.  
   - **Smart Refill on recovery (HWM)**: after a drawdown and recovery to the prior peak (high‑water‑mark), compute the total unfunded NEED within the next 10 years (`gap10`). Let `S` be current stocks. Target a dynamic band `K = 3 + 3·S/(S+gap10)` (≈3–6 years). Compute dollars to reach `K` years ahead (earliest‑first). Set a conservative budget `B0 = min(gapToK, gap10) · (1 − e^{−S/(2·gap10)})`. Apply a reserve so at least **70%** of stocks remain invested: `B = min(B0, 0.3·S)`. Allocate `B` earliest‑first across the next 10 years.
5) **Success**: no shortfall in all retirement years.

## Solvers
### A. Start Stocks Needed (with user’s current cash)
- Let `cover_init` be the allocation from **Starting Cash**.  
- Use **bisection** on starting stocks `S0` to reach **≥90%** success (Monte Carlo with **common random numbers** for stability).  
- If even very large `S0` can’t get ≥90% (due to early uncovered years + HWM), mark **feasible=false**.

### B. Minimum Starting Cash to make ≥90% achievable
- Compute the **full 10‑year buffer** cash (sum of first `min(10,horizon)` years of `NEED`) as an upper bound.  
- Test if a **full buffer** is feasible at any stock; if **not**, return `minCash=null` and show guidance.  
- Otherwise, **bisection** between **current cash** and **full buffer** to find the **smallest cash** that makes ≥90% achievable; then re‑solve **Start Stocks Needed** at that cash.

## Outputs to UI
- `startCashNeeded` (year‑1 need), `startStocksNeeded` (for current cash), `feasible90`, `maxSuccessCap`.  
- If infeasible: `minCashFor90`, `stocksNeededAtMinCash`.  
- Baseline rows (mean return): show `cashUsed`, `refillAmount`, end balances, and `fundedAhead` (count of funded years within the next 10; not necessarily contiguous).  
- Series quantiles for **stocks** and **contiguous coverage** used in “typical range” charts.

## Rounding & Trials
- **Start Stocks Needed** (display): round up to **$25k / $50k / $100k** steps by magnitude.  
- **Start Cash Needed** (display): round up to **$1,000**.
### Trials and Adaptive Batching
- Default trials: **1,000** (interactive)
- If the solver’s success rate at the **90%** threshold is within about **±1.2%** and the sampling error (SE) is **>0.6%**, increase trials to **3,000**, then **5,000** max, using common random numbers.
- UI shows tooltips with the trials and SE used for the solver and for the displayed success metric.
