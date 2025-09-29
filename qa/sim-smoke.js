// Simple QA harness for sim-worker.js (no installs required)
// Usage: node qa/sim-smoke.js

const fs = require('fs');
const vm = require('vm');
let __FAILS = 0;

function loadSim() {
  const code = fs.readFileSync('sim-worker.js', 'utf8');
  const self = { addEventListener: () => {}, postMessage: () => {} };
  const ctx = { console, Date, Math, self };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return ctx;
}

function computePayload(ctx, inputs) {
  // Emulate worker message handling minimally
  const messages = [];
  const self = {
    _handler: null,
    addEventListener(type, handler) { this._handler = handler; },
    postMessage(msg) { messages.push(msg); }
  };
  const nestedCtx = { console, Date, Math, self };
  vm.createContext(nestedCtx);
  vm.runInContext(fs.readFileSync('sim-worker.js', 'utf8'), nestedCtx);
  self._handler({ data: { type: 'run', payload: { inputs } } });
  return messages[0].payload;
}

function assessSuccess(ctx, params) {
  const { age, retireAge, spend, ss70, startCash, startStocks } = params;
  const H = Math.max(0, 95 - retireAge);
  const needs = ctx.computeNeeds(spend, ss70, retireAge, H);
  const cover = ctx.allocateStartingCash(startCash, needs, H).cover;
  return ctx.monteCarlo(startStocks, needs, cover, retireAge, 1000, 0.05, 0.18, 123456).successPct;
}

function nearlyEqual(a, b, tol = 1e-6) { return Math.abs(a - b) <= tol; }
function assert(condition, msg) { if (!condition) { console.error('ASSERT FAIL:', msg); __FAILS++; process.exitCode = 1; } }
function assertEq(actual, expected, msg) { if (actual !== expected) { console.error('ASSERT FAIL:', msg, 'expected=', expected, 'actual=', actual); __FAILS++; process.exitCode = 1; } }
function assertClose(actual, expected, tol, msg) { if (!nearlyEqual(actual, expected, tol)) { console.error('ASSERT FAIL:', msg, 'expected≈', expected, 'actual=', actual); __FAILS++; process.exitCode = 1; } }

function testInvariants(ctx) {
  // Zero-need => success 100%
  {
    const age=58, retireAge=65, spend=0, ss70=0;
    const H=Math.max(0,95-retireAge);
    const needs=ctx.computeNeeds(spend,ss70,retireAge,H);
    const cover=ctx.allocateStartingCash(0,needs,H).cover;
    const mc=ctx.monteCarlo(0,needs,cover,retireAge,1000,0.05,0.18,123456);
    assertClose(mc.successPct, 100, 1e-9, 'Zero-need path should be 100%');
  }

  // Start Cash Needed (v9) = year-1 need only
  {
    const age=52, retireAge=60, spend=180000, ss70=60000;
    const H=Math.max(0,95-retireAge);
    const needs=ctx.computeNeeds(spend,ss70,retireAge,H);
    const startCashNeeded = (H>0? needs[0] : 0);
    assertEq(startCashNeeded, 180000, 'Start Cash Needed mismatch (expected 180k for year 1)');
  }

  // Initial covered years counts full-only coverage
  {
    const age=52, retireAge=60, spend=180000, ss70=0; // need=180k before 70
    const H=Math.max(0,95-retireAge);
    const needs=ctx.computeNeeds(spend,ss70,retireAge,H);
    const ac1=ctx.allocateStartingCash(360000, needs, H); // 2 full years
    assertEq(ac1.initialCoveredYears, 2, 'initialCoveredYears should be 2');
    const ac2=ctx.allocateStartingCash(500000, needs, H); // 2 full + partial
    assertEq(ac2.initialCoveredYears, 2, 'initialCoveredYears ignores partials');
  }

  // Monotonicity: success% non-decreasing with more cash/stocks
  {
    const base = { age:58, retireAge:65, spend:120000, ss70:36000 };
    const stocksGrid = [0, 1e5, 2e5, 5e5, 1e6, 2e6, 5e6, 1e7, 5e7];
    const cashGrid = [0, 1e5, 2e5, 4e5, 6e5, 8e5, 1e6, 1.2e6, 1.5e6];
    const sAt400 = stocksGrid.map(S => assessSuccess(ctx, { ...base, startCash: 400000, startStocks: S }));
    const sAt1020 = stocksGrid.map(S => assessSuccess(ctx, { ...base, startCash: 1020000, startStocks: S }));
    const cAt3M = cashGrid.map(C => assessSuccess(ctx, { ...base, startCash: C, startStocks: 3000000 }));
    const mono = arr => arr.every((v,i)=> i===0 || v >= arr[i-1] - 1e-9);
    assert(mono(sAt400), 'Monotonicity fail: stocks @cash=400k');
    assert(mono(sAt1020), 'Monotonicity fail: stocks @cash=1.02M');
    assert(mono(cAt3M), 'Monotonicity fail: cash @stocks=3M');
  }

  // Baseline sanity: no refill in the first year
  {
    const age=52, retireAge=60, spend=180000, ss70=60000;
    const H=Math.max(0,95-retireAge);
    const needs=ctx.computeNeeds(spend,ss70,retireAge,H);
    const fullCash=needs.slice(0, Math.min(10,H)).reduce((a,b)=>a+b,0);
    const cover=ctx.allocateStartingCash(fullCash, needs, H).cover;
    const rows = ctx.baselineTable(1e8, needs, cover, retireAge, age, 0.05, 0.18, 246813);
    assertEq(rows[0].refillAmount, 0, 'Baseline: first year should not refill');
  }
}

function runUserScenario(ctx) {
  // User-provided inputs
  const inp = { age:52, retireAge:60, spend:180000, ss70:60000, startCash:500000, startStocks:900000 };
  const p = computePayload(ctx, inp);
  console.log('\n=== User Scenario 52→60 spend180k ss60k cash500k stocks900k ===');
  console.log({
    startCashNeeded: p.startCashNeeded,
    feasible90: p.feasible90,
    startStocksNeeded: p.startStocksNeeded,
    minCashFor90: p.minCashFor90,
    stocksNeededAtMinCash: p.stocksNeededAtMinCash,
    successPct: p.successPct,
    firstTroubleYearAge: p.firstTroubleYearAge,
    initialCoveredYears: p.initialCoveredYears,
  });

  // Expected Start Cash Needed (v9) = 1-year need = 180k
  assertEq(p.startCashNeeded, 180000, 'User scenario: Start Cash Needed should be 180k');

  // Initial coverage = floor(500k / 180k) = 2 years
  assertEq(p.initialCoveredYears, 2, 'User scenario: initialCoveredYears should be 2');

  // Sanity: success% should increase with more stocks/cash around the point
  const moreStocks = [900000, 1500000, 3000000];
  const sCurve = moreStocks.map(S => assessSuccess(ctx, { age:inp.age, retireAge:inp.retireAge, spend:inp.spend, ss70:inp.ss70, startCash:inp.startCash, startStocks:S }));
  assert(sCurve[1] >= sCurve[0] - 1e-9 && sCurve[2] >= sCurve[1] - 1e-9, 'User scenario: stocks monotonicity');

  const moreCash = [500000, 900000, 1200000, 1800000];
  const cCurve = moreCash.map(C => assessSuccess(ctx, { age:inp.age, retireAge:inp.retireAge, spend:inp.spend, ss70:inp.ss70, startCash:C, startStocks:inp.startStocks }));
  assert(cCurve[1] >= cCurve[0] - 1e-9 && cCurve[2] >= cCurve[1] - 1e-9, 'User scenario: cash monotonicity');
}

function testMetadataAndRepro(ctx) {
  const inp = { age:58, retireAge:65, spend:120000, ss70:36000, startCash:400000, startStocks:900000 };
  const p1 = computePayload(ctx, inp);
  const p2 = computePayload(ctx, inp);
  // Reproducibility: deterministic seeds → identical results
  assertEq(p1.startStocksNeeded, p2.startStocksNeeded, 'Repro: startStocksNeeded should match across runs');
  assertEq(p1.successPct, p2.successPct, 'Repro: successPct should match across runs');
  assertEq(p1.startingCash, inp.startCash, 'startingCash should equal user input');
  // Metadata presence bounds
  assert(p1.successTrials >= 1000 && p1.successTrials <= 5000, 'MC trials should be between 1k and 5k');
  assert(p1.solverTrials >= 1000 && p1.solverTrials <= 5000, 'Solver trials should be between 1k and 5k');
  assert(typeof p1.successSE === 'number', 'successSE missing');
  assert(typeof p1.solverSE === 'number', 'solverSE missing');
}

function testStocksNeededMonotoneByCash(ctx) {
  const base = { age:58, retireAge:65, spend:120000, ss70:36000 };
  const cashes = [200000, 400000, 800000, 1020000];
  const values = cashes.map(C => computePayload(ctx, { ...base, startCash: C, startStocks: 0 }).startStocksNeeded);
  // Non-increasing with more cash (allow small numerical chatter ≤ $5k)
  for (let i=1;i<values.length;i++) {
    assert(values[i] <= values[i-1] + 5000, `StartStocksNeeded should not increase with more cash: ${values[i-1]} -> ${values[i]}`);
  }
}

function main() {
  const ctx = loadSim();
  // Export helpers present
  if (!ctx.adaptiveSaleBudget) console.warn('adaptiveSaleBudget not in context (older worker?)');
  if (!ctx.allocateBudgetEarliestFirst) console.warn('allocateBudgetEarliestFirst not in context (older worker?)');
  // Run invariant tests
  testInvariants(ctx);

  // Run user scenario checks
  runUserScenario(ctx);
  testMetadataAndRepro(ctx);
  testStocksNeededMonotoneByCash(ctx);

  // Baseline recovery reserves/invariants (debug data)
  (function testBaselineRecoveryReserves(){
    const inp = { age:58, retireAge:65, spend:120000, ss70:36000, startCash:400000, startStocks:1500000 };
    const H=Math.max(0,95-inp.retireAge);
    const needs=ctx.computeNeeds(inp.spend,inp.ss70,inp.retireAge,H);
    const cover=ctx.allocateStartingCash(inp.startCash,needs,H).cover;
    const rows = ctx.baselineTable(inp.startStocks,needs,cover,inp.retireAge,inp.age,0.05,0.18,246813);
    let checked=false;
    for (const r of rows){
      if (r.debug && r.debug.recovery && r.debug.recovery.triggered){
        const d=r.debug.recovery;
        assert(d.saleBudget <= d.reserveCap + 1e-6, 'Recovery sale should respect reserve cap');
        assert(d.S_after >= 0.7*d.S_before - 1e-6, 'Post-recovery stocks should respect 70% reserve');
        checked=true; break;
      }
    }
    assert(checked, 'No recovery sale present in baseline to validate');
  })();
  const cases = [
    { name: 'Baseline 58→65 spend120k ss36k cash400k stocks900k', inp: { age:58, retireAge:65, spend:120000, ss70:36000, startCash:400000, startStocks:900000 } },
    { name: 'Lower spend 55→62 spend60k ss30k cash300k stocks1.5M', inp: { age:55, retireAge:62, spend:60000, ss70:30000, startCash:300000, startStocks:1500000 } },
    { name: 'Full buffer cash 58→65 spend120k ss36k cash1.02M stocks3M', inp: { age:58, retireAge:65, spend:120000, ss70:36000, startCash:1020000, startStocks:3000000 } },
    { name: 'Retire at 70 spend120k ss36k cash840k stocks2M', inp: { age:65, retireAge:70, spend:120000, ss70:36000, startCash:840000, startStocks:2000000 } },
  ];

  for (const c of cases) {
    const p = computePayload(ctx, c.inp);
    const summary = {
      startCashNeeded: p.startCashNeeded,
      feasible90: p.feasible90,
      startStocksNeeded: p.startStocksNeeded,
      minCashFor90: p.minCashFor90,
      stocksNeededAtMinCash: p.stocksNeededAtMinCash,
      successPct: p.successPct,
      firstTroubleYearAge: p.firstTroubleYearAge,
      initialCoveredYears: p.initialCoveredYears,
    };
    console.log(`\n=== ${c.name} ===`);
    console.log(summary);
  }

  // Monotonicity checks
  const base = { age:58, retireAge:65, spend:120000, ss70:36000 };
  const stocksGrid = [0, 1e5, 2e5, 5e5, 1e6, 2e6, 5e6, 1e7, 5e7];
  const cashGrid = [0, 1e5, 2e5, 4e5, 6e5, 8e5, 1e6, 1.2e6, 1.5e6];

  function monotone(arr, tol=0.6){ for (let i=1;i<arr.length;i++) if (arr[i] < arr[i-1] - tol) return false; return true; }

  const sAt400 = stocksGrid.map(S => assessSuccess(ctx, { ...base, startCash: 400000, startStocks: S }));
  console.log('\nStocks monotone @cash=400k =>', sAt400, 'monotone?', monotone(sAt400));
  const sAt1020 = stocksGrid.map(S => assessSuccess(ctx, { ...base, startCash: 1020000, startStocks: S }));
  console.log('Stocks monotone @cash=1.02M =>', sAt1020, 'monotone?', monotone(sAt1020));
  const cAt3M = cashGrid.map(C => assessSuccess(ctx, { ...base, startCash: C, startStocks: 3000000 }));
  console.log('Cash monotone @stocks=3M =>', cAt3M, 'monotone?', monotone(cAt3M));

  // Recovery refill sanity: sale <= band+reserve budget and stocks respect reserve
  (function testAdaptiveBudget() {
    const age=52, retireAge=60, spend=180000, ss70=60000, startCash=500000, startStocks=900000;
    const H=Math.max(0,95-retireAge);
    const needs=ctx.computeNeeds(spend,ss70,retireAge,H);
    const cover=ctx.allocateStartingCash(startCash, needs, H).cover;
    let S=startStocks, P=1.0, lastSale=1.0, peak=1.0, hadDD=false;
    const rand=ctx.mulberry32? ctx.mulberry32(13579) : (s=>()=>Math.random());
    function normal(){ return ctx.normalRandom? ctx.normalRandom(rand) : 0; }
    let found=false;
    for(let y=0;y<H && !found;y++){
      const need=needs[y];
      let use=Math.min(need, cover[y]||0); let gap=need-use; cover[y]=0;
      if(gap>0){ const sellNow=Math.min(S,gap); if(sellNow>0){ cover[y]=(cover[y]||0)+sellNow; S-=sellNow; use+=sellNow; gap-=sellNow; } if(gap<=0){ const t=y+1; if(t<H){ const needT=Math.max(0,needs[t]-(cover[t]||0)); if(needT>0&&S>0){ const buy=Math.min(needT,S); cover[t]=(cover[t]||0)+buy; S-=buy; } } } }
      const r=ctx.clampReturn? ctx.clampReturn(0.05+0.18*normal()) : 0.05;
      S=Math.max(0,S*(1+r)); P*= (1+r);
      if(P>peak) peak=P; if(P<peak) hadDD=true;
      if(P>=peak && hadDD){
        const gap10 = ctx.sumUnfundedNeedsWithin(cover,needs,y,10);
        const K = Math.min(10, 3 + 3 * (S/(S+gap10)));
        const gapToK = ctx.dollarsToReachK(cover,needs,y,Math.ceil(K));
        const f = 1 - Math.exp(-(S)/(2*Math.max(1e-9,gap10)));
        const reserveR = 0.7; const reserveCap = Math.max(0, (1-reserveR)*S);
        const budget = Math.min(gapToK, gap10) * f;
        const capBudget = Math.min(budget, reserveCap);
        const beforeS=S;
        const spent = ctx.allocateBudgetEarliestFirst(capBudget, cover, needs, y, 10);
        S -= spent;
        assert(spent <= capBudget + 1e-6, 'Spent should not exceed band+reserve budget');
        assert(S >= beforeS - capBudget - 1e-6, 'Post-sale stocks should respect budget');
        assert(S >= reserveR*beforeS - 1e-6, 'Reserve floor should hold');
        found=true;
      }
    }
    assert(found, 'Did not encounter a recovery sale to test');
  })();

  if (__FAILS === 0) {
    console.log('\nQA PASS');
  } else {
    console.log(`\nQA FAIL — ${__FAILS} assertion(s) failed`);
  }
}

if (require.main === module) main();
