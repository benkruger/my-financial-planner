# 1) Product Goals — v8 (LOCKED)

## Purpose
Give a **macro, two-number answer** for retirement readiness—all in **today’s dollars**:
1. **Start Cash Needed** (safe buffer for early years, up to 10).  
2. **Start Stocks Needed** to reach **≥ 90%** success (money lasts to **age 95**) under **sell‑after‑recovery** rules.

If the user’s **current cash** is too low to hit ≥90% no matter how much stock they own, we still answer with **exactly what they need**:
- **Minimum Starting Cash** to make ≥90% **achievable**, and  
- **Start Stocks Needed at that cash**.

## Philosophy (6th‑grade clear)
- Everything is in **today’s dollars** (already adjusted for inflation).  
- **Stocks** are modeled with **after‑inflation** (real) returns.  
- You **spend from cash**, not stocks. Stocks are **only sold** to **refill** the cash buffer **after markets fully recover** (the **high‑water‑mark** rule).
- Keep inputs and outputs simple; give clear guidance if something won’t work.

## Time & Units
- **Yearly**, horizon from **retirement age → age 95**.  
- **Social Security starts at 70** (entered in today’s $/yr).

## Core Strategy
1) **Cash buffer (“notes ladder”)** starts with **1 year** of NEED at retirement; longer ladders (up to 10 years) are optional and can be built from refills over time.  
2) **Stocks refill on recovery only** (high‑water‑mark gate).  
3) **Emergency sale** prevents cash shortfalls: if a cash gap appears in a year, sell stocks to cover that year (and try to pre‑fund the next year).  
4) **Partial ladders are expected**; Monte Carlo sizes the **stocks** required for your current cash.

## Inputs (ultra‑minimal)
- Your **age**
- **Retirement age**
- **All‑in yearly spending** (today’s $)
- **Social Security at 70** (today’s $/yr)
- **Starting Cash**
- **Starting Stocks**
- **“Save last inputs on this device”** is **ON by default**

## What the app computes
- **Start Cash Needed** = sum of first **min(10, horizon)** years of **NEED**.  
- **Start Stocks Needed (with your cash)** = minimum stocks at retirement so **≥90%** of 1000 market paths reach **age 95** given your cash buffer and the HWM sell rule.
- If ≥90% is **not solvable with your cash**, we compute:
  - **Minimum Starting Cash** that makes ≥90% **achievable**, and  
  - **Start Stocks Needed at that cash**.  
  We also show **stock shortfall** in two ways: (a) if you **add** the cash from outside, and (b) if you **shift** that cash out of stocks.

## Outputs (decision‑ready)
- Summary chips: **Start Cash Needed**, **Start Stocks Needed**, **Your Starting Cash/Stocks** (Short/Enough/Extra), **Chance of success**, **First trouble year**.  
- **Recommendations** card:
  - If feasible: **Stock needed** with your cash and your **stock shortfall**; optional note for **cash to full 10‑yr buffer**.  
  - If infeasible with current cash: **Minimum Starting Cash**, **Stocks at that cash**, and **stock shortfalls** (add vs shift).  
- **Baseline table** (average‑return story) and two simple **range charts** (“typical range”, not percentiles).

## Guardrails & Policy (v1)
- **High‑Water‑Mark (drawdown gate)**: sell stocks to refill **only after** there has been a **drawdown** since the last sale and the real index is back **to or above** that last sale level; an **emergency sale** is allowed to avoid a cash shortfall in the current year (and try to fund one year ahead).  
- **Never sell** stocks for living costs directly.  
- **Partial ladders OK**.  
- **Target**: ≥90% success, **1,000** trials, to **age 95**.  
- **Rounding (display)**: cash to **$1k**; stocks to **$25k/$50k/$100k** steps by size.  
- **Alerts**: infeasible states show a **red banner**.  
- Removed **Copy Snapshot**; “**Back to Inputs**” is a **primary** button.
