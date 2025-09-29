# Retirement Planner — Static Site with Docs

Live site: **https://benkruger.github.io/my-financial-planner/**

All amounts are in **today’s dollars** (inflation‑adjusted). Stocks use **real, after‑inflation** returns.
We never sell stocks to pay living costs—only to refill the cash buffer after a **drawdown and subsequent recovery** (high‑water‑mark with drawdown gate).

## Docs
- **Product Goals:** [docs/1_product_goals.md](docs/1_product_goals.md)  
- **Inputs:** [docs/2_inputs.md](docs/2_inputs.md)  
- **Simulation Design:** [docs/3_simulation_design.md](docs/3_simulation_design.md)  
- **Outputs & UX:** [docs/4_outputs_ux.md](docs/4_outputs_ux.md)
- **Tech Notes:** [docs/TECH_NOTES.md](docs/TECH_NOTES.md)
 - **Scaffold Checklist:** [docs/SCAFFOLD_CHECKLIST.md](docs/SCAFFOLD_CHECKLIST.md)

## Quick start (local)
Open `index.html` via a static server (some browsers block Web Workers on `file://`).  
Example: `python3 -m http.server` → http://localhost:8000/
If you see stale assets after deploy, do a hard reload in DevTools (Disable cache + Empty cache and hard reload).

## QA / Tests
Run the smoke + invariant tests with Node:

```
node qa/sim-smoke.js
```
The script executes invariant checks (zero-need path, monotonicity, reserve constraints), a user scenario, baseline sanity, and reproducibility + metadata checks (trials/SE). It exits non‑zero on any assertion failure.
