# 4) Outputs & UX

## Pages
1) **Landing** — value prop, CTA (Get Started).  
2) **Inputs** — 6 fields with live currency formatting; the **Your age** field auto‑focuses.  
3) **Results** — summary chips, **Recommendations**, input snapshot, baseline table, charts.

## Summary chips
- **Start Stocks Needed** (with your current cash).  
- **Your Starting Cash/Stocks** with **Short / Enough / Extra** (cash compared to year‑1 need).  
- **Chance of success** (to 1 decimal).  
- **First trouble year** (age) or “None expected”.

## Banner
- If current cash cannot produce a ≥90% plan at any stock level, show a **red** banner explaining the issue and **max achievable success %**.

## Recommendations card
**Feasible with current cash**  
- **Stock needed (with your current cash)** and whether you are **short $X** (or already there).  
- Optional note: **cash to fully fund a 10‑year buffer** (FYI only).

**Not feasible with current cash**  
- **Minimum Starting Cash to reach ≥90%**.  
- **Start Stocks Needed at that cash**.  
- Two stock shortfalls: if you **add** that cash vs **shift** it out of your current stocks.

## Snapshot & Actions
- Input Snapshot shows your inputs + initial coverage.  
- **Back to Inputs** appears in the header (not at the bottom).
- “Export Results (JSON)” is hidden by default; it appears at the bottom only when the URL contains `?debug=true` (or `?debug`).

## Baseline & Charts
- **Baseline table** (representative path): Year/Age, Spending, SS, Cash used, **Sold (emergency)**, **Sold (recovery)**, Future coverage cash (earmarked), Stocks ending, and **Funded years ahead (next 10)**. The baseline is a single illustrative Monte Carlo path (fixed seed) that includes drawdowns and recoveries.  
- **Visual appendix**: Start vs Needed bars; two compact **typical‑range** lines (stocks balance, contiguous buffer coverage).

All amounts are **today’s dollars**; stocks use **real** returns; we **never** spend stocks on living costs. We only refill the cash buffer after a **drawdown and subsequent recovery** (high‑water‑mark).
