# Retirement Planner — Static Site with Docs (v8)

Live site: **https://benkruger.github.io/my-financial-planner/**

All amounts are in **today’s dollars** (inflation‑adjusted). Stocks use **real, after‑inflation** returns.
We never sell stocks to pay living costs—only to refill the cash buffer after a **drawdown and subsequent recovery** (high‑water‑mark with drawdown gate).

## Repo layout
```
/
├── index.html
├── app.css
├── app.js
├── sim-worker.js
├── README.md
└── docs/
    ├── 1_product_goals.md
    ├── 2_inputs.md
    ├── 3_simulation_design.md
    └── 4_outputs_ux.md
```

## Docs
- **Product Goals:** [docs/1_product_goals.md](docs/1_product_goals.md)  
- **Inputs:** [docs/2_inputs.md](docs/2_inputs.md)  
- **Simulation Design:** [docs/3_simulation_design.md](docs/3_simulation_design.md)  
- **Outputs & UX:** [docs/4_outputs_ux.md](docs/4_outputs_ux.md)

## Quick start (local)
Open `index.html` via a static server (some browsers block Web Workers on `file://`).  
Example: `python3 -m http.server` → http://localhost:8000/

## Deploy (GitHub Pages)
1. Commit these files at the repo **root**.  
2. **Settings → Pages:** “Deploy from a branch”, choose `main`, folder `/ (root)`.  
3. Hard‑reload the site (disable cache in DevTools) or append `?v=7` to force a fresh load.

## Exporting Results
From the Results page, use “Export Results (JSON)” to download the latest run’s inputs, simulation payload, and metadata (trials, parameters, timestamp, policy). This is useful for QA and reproducibility.

## Notes on the Baseline Table
- The baseline is now a representative Monte Carlo path (fixed seed), not a flat average-return path. It will show drawdowns, recoveries, and refills according to policy.
- We never spend stocks on living costs. Stocks are only sold to refill the cash ladder after a drawdown and recovery to the previous high‑water‑mark.
- “Future coverage cash (earmarked)” is the sum of cash already allocated to future years; it isn’t immediately spendable.
- “Funded years ahead (next 10)” counts funded years within the 10-year window ahead; it may not be contiguous.
