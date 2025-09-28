/* sim-worker.js — Monte Carlo + auto-size (real terms) v6 */
/* Always solve Start Stocks Needed using the user's actual Starting Cash (partial buffer allowed).
 * Mark infeasible only if even unlimited stocks cannot reach ≥90% success under the sell-after-recovery rule.
 */
function mulberry32(seed){let t=seed>>>0;return function(){t+=0x6D2B79F5;let r=Math.imul(t^(t>>>15),1|t);r^=r+Math.imul(r^(r>>>7),61|r);return((r^(r>>>14))>>>0)/4294967296;};}
function normalRandom(rand){let u=0,v=0;while(u===0)u=rand();while(v===0)v=rand();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
function clampReturn(r){return Math.max(r,-0.95);}

function computeNeeds(spend, ss70, retireAge, H){
  const needs=new Array(H).fill(0);
  for(let y=0;y<H;y++){const age=retireAge+y;const ss=(age>=70)?ss70:0;needs[y]=Math.max(0,spend-ss);}return needs;
}
function allocateStartingCash(startCash, needs, H){
  const cover=new Array(H).fill(0);let rem=startCash;
  for(let y=0;y<H&&y<10;y++){const buy=Math.min(needs[y],rem);cover[y]=buy;rem-=buy;if(rem<=0)break;}
  let covered=0;for(let y=0;y<Math.min(10,H);y++) if(cover[y]>=needs[y]) covered++;
  return {cover,initialCoveredYears:covered};
}
function countCoverageYears(cover,needs,fromYear){let cnt=0;for(let k=1;k<=10;k++){const t=fromYear+k;if(t>=needs.length)break;if(cover[t]>=needs[t])cnt++;else break;}return cnt;}
function sumFutureCash(cover,fromYear){let s=0;for(let t=fromYear+1;t<cover.length;t++)s+=cover[t];return s;}
function dollarsToReachK(cover,needs,fromYear,K){
  const H=needs.length; const endT=Math.min(H-1, fromYear+10);
  let needed=0, have=0;
  for(let t=fromYear+1; t<=endT && have<K; t++){
    const needT=needs[t]||0; const cov=cover[t]||0; const short=Math.max(0, needT - cov);
    needed += short; have += 1; // after filling short, this year would be fully covered
  }
  return needed;
}
function sumUnfundedNeedsWithin(cover,needs,fromYear,yrs){let s=0;const endT=Math.min(needs.length-1,fromYear+yrs);for(let t=fromYear+1;t<=endT;t++){const needT=Math.max(0,needs[t]-(cover[t]||0));s+=needT;}return s;}
function allocateBudgetEarliestFirst(budget,cover,needs,fromYear,yrs){
  if (budget<=0) return 0; let spent=0;
  const endT=Math.min(needs.length-1,fromYear+yrs);
  for(let t=fromYear+1;t<=endT;t++){
    const needT=Math.max(0,needs[t]-(cover[t]||0)); if(needT<=0) continue;
    const buy=Math.min(needT, budget); if(buy>0){ cover[t]=(cover[t]||0)+buy; budget-=buy; spent+=buy; if(budget<=0) break; }
  }
  return spent;
}
// Adaptive sale budget: conservative mixing of stocks and unfunded need
function adaptiveSaleBudget(S, gap10){
  if (S<=0 || gap10<=0) return 0;
  // More conservative than gap/(gap+S): use gap/(gap + 2*S)
  const weight = gap10 / (gap10 + 2*S);
  return Math.min(S, gap10) * weight;
}

function simulateTrial(S0,needs,coverInit,retireAge,mean=0.05,stdev=0.18,seed=1234){
  const H=needs.length, cover=coverInit.slice(); let S=S0, P=1.0, lastSale=1.0, firstTrouble=null;
  // Drawdown gate: require price to drop below the peak since the last sale, then recover to that peak (or higher)
  let peakSinceSale = 1.0; // running max of P since last sale
  let hadDrawdownSinceSale = false;
  let troughSinceSale = 1.0;
  const stocksSeries=new Array(H).fill(0), coverageSeries=new Array(H).fill(0);
  const rand=mulberry32(seed);
  for(let y=0;y<H;y++){
    const age=retireAge+y, need=needs[y];
    let useNotes=Math.min(need,cover[y]||0); let gap=need-useNotes; cover[y]=0;
    // Emergency sale: scale prefill when stocks are abundant
    if (gap > 0) {
      const preS = S; // stocks before any emergency selling this year
      const sellNow = Math.min(S, gap);
      if (sellNow > 0) { cover[y] = (cover[y]||0) + sellNow; S -= sellNow; useNotes += sellNow; gap -= sellNow; }
      if (gap <= 0) {
        // scalable prefill for next few years based on abundance
        const gap10f = sumUnfundedNeedsWithin(cover,needs,y,10);
        if (gap10f > 0 && S > 0) {
          const Ke = Math.max(1, Math.min(6, 1 + Math.round(3 * preS / (preS + gap10f))));
          const extraNeed = dollarsToReachK(cover,needs,y,Ke);
          const fe = 1 - Math.exp(-(preS)/(2*Math.max(1e-9,gap10f)));
          const B0 = Math.min(extraNeed, gap10f) * fe;
          const reserveAllow = Math.max(0, S - 0.65*preS); // keep ≥65% of pre-emergency stocks
          const annualCap = Math.max(0, 0.35*preS - sellNow); // limit total emergency this year to ≤35% of preS
          const Be = Math.min(B0, reserveAllow, annualCap);
          if (Be > 0) {
            const spentE = allocateBudgetEarliestFirst(Be, cover, needs, y, 10);
            S -= spentE;
          }
        }
      } else if (firstTrouble===null) { firstTrouble = age; }
    }
    const r=clampReturn(mean+stdev*normalRandom(rand)); S=Math.max(0,S*(1+r)); P=P*(1+r);
    if (P > peakSinceSale) peakSinceSale = P;
    if (P < troughSinceSale) troughSinceSale = P;
    if (P < peakSinceSale) hadDrawdownSinceSale = true;
    let sold=0; if(P>=peakSinceSale && hadDrawdownSinceSale){
      const gap10 = sumUnfundedNeedsWithin(cover,needs,y,10);
      if (gap10 > 0 && S > 0){
        const K = Math.min(10, 3 + 3 * (S/(S+gap10)));
        const gapToK = dollarsToReachK(cover,needs,y,Math.ceil(K));
        const f = 1 - Math.exp(-(S)/(2*Math.max(1e-9,gap10)));
        const depth = Math.max(0, (peakSinceSale - troughSinceSale) / Math.max(1e-9, peakSinceSale));
        const rho = Math.min(1, (P - troughSinceSale) / Math.max(1e-9, peakSinceSale - troughSinceSale));
        const g = Math.min(1, depth / 0.3) * Math.min(1, rho);
        const reserveR = 0.7; const reserveCap = Math.max(0, (1-reserveR)*S);
        const saleBudget0 = Math.min(gapToK, gap10) * f * g;
        const saleBudget = Math.min(saleBudget0, reserveCap);
        const spent = allocateBudgetEarliestFirst(saleBudget, cover, needs, y, 10);
        S -= spent; sold += spent;
      }
      if(sold>0){ lastSale=P; peakSinceSale=P; troughSinceSale=P; hadDrawdownSinceSale=false; }
    }
    stocksSeries[y]=S; coverageSeries[y]=countCoverageYears(cover,needs,y);
  }
  return { firstTrouble, stocksSeries, coverageSeries };
}
function quantile(arr,q){ if(arr.length===0)return 0; const a=arr.slice().sort((x,y)=>x-y); const idx=Math.min(a.length-1,Math.max(0,Math.floor(q*(a.length-1)))); return a[idx]; }

function monteCarlo(S0,needs,coverInit,retireAge,trials=1000,mean=0.05,stdev=0.18,baseSeed=123456){
  const H=needs.length; const successFlags=new Array(trials).fill(false); const troubleAges=new Array(trials).fill(null);
  const stocksByYear=Array.from({length:H},()=>[]), coverageByYear=Array.from({length:H},()=>[]);
  for(let i=0;i<trials;i++){const seed=baseSeed+i*9973; const {firstTrouble,stocksSeries,coverageSeries}=simulateTrial(S0,needs,coverInit,retireAge,mean,stdev,seed);
    successFlags[i]=(firstTrouble===null); troubleAges[i]=firstTrouble;
    for(let y=0;y<H;y++){stocksByYear[y].push(stocksSeries[y]); coverageByYear[y].push(coverageSeries[y]);}}
  const successPct=100*(successFlags.filter(Boolean).length/trials);
  const failingAges=troubleAges.filter(v=>v!==null); let firstTroubleYearAge=null; if(failingAges.length>0){ firstTroubleYearAge=Math.round(quantile(failingAges,0.1)); }
  const p10Stocks=stocksByYear.map(a=>quantile(a,0.1)), p50Stocks=stocksByYear.map(a=>quantile(a,0.5)), p90Stocks=stocksByYear.map(a=>quantile(a,0.9));
  const p10Cover=coverageByYear.map(a=>quantile(a,0.1)), p50Cover=coverageByYear.map(a=>quantile(a,0.5)), p90Cover=coverageByYear.map(a=>quantile(a,0.9));
  return { successPct, firstTroubleYearAge, stocks:{p10:p10Stocks,p50:p50Stocks,p90:p90Stocks}, coverage:{p10:p10Cover,p50:p50Cover,p90:p90Cover} };
}

// Auto-size Start Stocks Needed for given cover
function solveStartStocksNeeded(needs,coverInit,retireAge,targetSuccess=90,trials=1000,mean=0.05,stdev=0.18){
  let L=0, U=50*(needs.reduce((a,b)=>a+b,0)/10+1);
  const baseSeed=123456;
  const assess=(S0)=>monteCarlo(S0,needs,coverInit,retireAge,trials,mean,stdev,baseSeed).successPct;
  let suc=assess(U), safety=0;
  while (suc < targetSuccess && U < 50000000 && safety < 18) { U *= 1.8; safety++; suc = assess(U); }
  if (suc < targetSuccess) return { feasible:false, needed:null, maxSuccessPct:suc, bound:U };
  for (let iter=0; iter<24; iter++){ const M=0.5*(L+U); const s=assess(M); if(s>=targetSuccess) U=M; else L=M; if (Math.abs(U-L)<1000) break; }
  return { feasible:true, needed:U, maxSuccessPct:suc, bound:U };
}

// Minimum Starting Cash to make ≥90% achievable (optional guidance)
function solveMinCashForFeasibility(needs,startCashCurrent,retireAge,targetSuccess=90){
  const H=needs.length;
  const full = needs.slice(0, Math.min(10,H)).reduce((a,b)=>a+b,0);
  const fullCover = allocateStartingCash(full, needs, H).cover;
  const fullFeasible = solveStartStocksNeeded(needs, fullCover, retireAge, targetSuccess, 700).feasible;
  if (!fullFeasible) return { minCash:null, stocksAtMin:null };
  let L = Math.max(0, startCashCurrent), U = full;
  for (let i=0; i<14; i++){
    const M = 0.5*(L+U);
    const coverM = allocateStartingCash(M, needs, H).cover;
    const feasM = solveStartStocksNeeded(needs, coverM, retireAge, targetSuccess, 700).feasible;
    if (feasM) U = M; else L = M;
    if (Math.abs(U-L) < 1000) break;
  }
  const coverU = allocateStartingCash(U, needs, H).cover;
  const stocksSolve = solveStartStocksNeeded(needs, coverU, retireAge, targetSuccess, 900);
  return { minCash: U, stocksAtMin: stocksSolve.needed };
}

// Baseline (mean path)
function countFundedNext10(cover,needs,fromYear){let cnt=0;const endT=Math.min(needs.length-1,fromYear+10);for(let t=fromYear+1;t<=endT;t++){if((cover[t]||0)>=needs[t]) cnt++;}return cnt;}

function baselineTable(S0,needs,coverInit,retireAge,ageNow,mean=0.05,stdev=0.18,seed=246813){
  const H=needs.length, cover=coverInit.slice(); let S=S0, P=1.0, lastSale=1.0;
  let peakSinceSale=1.0, troughSinceSale=1.0, hadDrawdownSinceSale=false;
  const rows=[]; const startYear=new Date().getFullYear()+Math.max(0,retireAge-ageNow);
  const rand=mulberry32(seed);
  for(let y=0;y<H;y++){
    const age=retireAge+y, year=startYear+y, need=needs[y];
    let useNotes=Math.min(need,cover[y]||0); let gap=need-useNotes; cover[y]=0;
    let soldEmergency = 0;
    // Debug hooks
    let dbgEmergency = { preS:null, sellNow:null, gap10f:null, Ke:null, extraNeed:null, fe:null, B0:null, reserveAllow:null, annualCap:null, Be:null };
    let dbgRecovery  = { triggered:false, P:null, peak:null, gap10:null, K:null, f:null, b0:null, reserveCap:null, saleBudget:null, S_before:null, S_after:null };
    if (gap > 0) {
      const preS = S; dbgEmergency.preS = preS;
      const sellNow=Math.min(S,gap); dbgEmergency.sellNow = sellNow;
      if(sellNow>0){ cover[y]=(cover[y]||0)+sellNow; S-=sellNow; useNotes+=sellNow; gap-=sellNow; soldEmergency += sellNow; }
      if (gap<=0){
        const gap10f = sumUnfundedNeedsWithin(cover,needs,y,10); dbgEmergency.gap10f = gap10f;
        if (gap10f > 0 && S > 0) {
          const Ke = Math.max(1, Math.min(3, 1 + Math.round(2 * preS / (preS + gap10f)))); dbgEmergency.Ke = Ke;
          const extraNeed = dollarsToReachK(cover,needs,y,Ke); dbgEmergency.extraNeed = extraNeed;
          const fe = 1 - Math.exp(-(preS)/(2*Math.max(1e-9,gap10f))); dbgEmergency.fe = fe;
          const B0 = Math.min(extraNeed, gap10f) * fe; dbgEmergency.B0 = B0;
          const reserveAllow = Math.max(0, S - 0.65*preS); dbgEmergency.reserveAllow = reserveAllow;
          const annualCap = Math.max(0, 0.35*preS - sellNow); dbgEmergency.annualCap = annualCap;
          const Be = Math.min(B0, reserveAllow, annualCap); dbgEmergency.Be = Be;
          if (Be > 0) { const spentE = allocateBudgetEarliestFirst(Be, cover, needs, y, 10); S -= spentE; soldEmergency += spentE; }
        }
      }
    }
    const r=clampReturn(mean+stdev*normalRandom(rand)); S=Math.max(0,S*(1+r)); P=P*(1+r);
    if (P > peakSinceSale) peakSinceSale = P;
    if (P < troughSinceSale) troughSinceSale = P;
    if (P < peakSinceSale) hadDrawdownSinceSale = true;
    let sold=0; if(P>=peakSinceSale && hadDrawdownSinceSale){
      const gap10 = sumUnfundedNeedsWithin(cover,needs,y,10); dbgRecovery.gap10 = gap10; dbgRecovery.P=P; dbgRecovery.peak=peakSinceSale; dbgRecovery.S_before=S;
      if (gap10 > 0 && S > 0){
        const K = Math.min(10, 5 + 5 * (S/(S+gap10))); dbgRecovery.K=K; dbgRecovery.K_final=K;
        const gapToK = dollarsToReachK(cover,needs,y,Math.ceil(K));
        const f = 1 - Math.exp(-(S)/(Math.max(1e-9,gap10))); dbgRecovery.f=f; dbgRecovery.f_final=f;
        const depth = Math.max(0, (peakSinceSale - troughSinceSale) / Math.max(1e-9, peakSinceSale)); dbgRecovery.depth=depth;
        const rho = Math.min(1, (P - troughSinceSale) / Math.max(1e-9, peakSinceSale - troughSinceSale)); dbgRecovery.rho=rho;
        const g = Math.min(1, depth / 0.3) * Math.min(1, rho); dbgRecovery.g=g;
        const reserveR = 0.7; const reserveCap = Math.max(0, (1-reserveR)*S); dbgRecovery.reserveCap=reserveCap;
        const saleBudget0 = Math.min(gapToK, gap10) * f * g; dbgRecovery.b0=saleBudget0;
        const saleBudget = Math.min(saleBudget0, reserveCap); dbgRecovery.saleBudget=saleBudget; dbgRecovery.triggered=true;
        const spent = allocateBudgetEarliestFirst(saleBudget, cover, needs, y, 10);
        S -= spent; sold += spent;
      }
      if(sold>0){ lastSale=P; peakSinceSale=P; troughSinceSale=P; hadDrawdownSinceSale=false; }
      dbgRecovery.S_after=S;
    }
    rows.push({ year, age, cashUsed:useNotes, soldEmergency:soldEmergency, soldRecovery:sold, refillAmount:(soldEmergency+sold), cashEnd: sumFutureCash(cover,y), stocksEnd:S, fundedAhead: countFundedNext10(cover,needs,y), shortfall:gap, debug:{ emergency:dbgEmergency, recovery:dbgRecovery } });
  }
  return rows;
}

self.addEventListener('message',(e)=>{
  const {type,payload}=e.data||{}; if(type!=='run') return;
  const { age, retireAge, spend, ss70, startCash, startStocks } = payload.inputs;
  const H=Math.max(0,95-retireAge);
  const needs=computeNeeds(spend,ss70,retireAge,H);
  // Start Cash Needed: Year-1 need only (not full 10-year ladder)
  const startCashNeeded = (H>0? needs[0] : 0);
  const startCashEffective = Math.max(startCash, startCashNeeded);
  const ac=allocateStartingCash(startCashEffective,needs,H);
  const coverInit=ac.cover, initialCoveredYears=ac.initialCoveredYears;

  // Solve stocks needed for user's actual cover (partial OK)
  const solve = solveStartStocksNeeded(needs,coverInit,retireAge,90,1000,0.05,0.18);
  const feasible90 = solve.feasible;
  const startStocksNeeded = (solve.needed!=null? solve.needed : solve.bound);
  const maxSuccessCap = solve.maxSuccessPct;

  // Optional guidance: min cash to make ≥90% achievable
  let minCashFor90 = null, stocksNeededAtMinCash = null;
  if (!feasible90) {
    const res = solveMinCashForFeasibility(needs,startCash,retireAge,90);
    minCashFor90 = res.minCash;
    stocksNeededAtMinCash = res.stocksAtMin;
  }

  // Monte Carlo for current starting stocks
  const mc=monteCarlo(startStocks,needs,coverInit,retireAge,1000,0.05,0.18,78901);

  // Baseline rows
  const baselineRowsRaw=baselineTable(startStocks,needs,coverInit,retireAge,age,0.05,0.18,13579);
  const baselineRows=baselineRowsRaw.map((r,idx)=>{
    const ageRow=retireAge+idx; const ss=(ageRow>=70)?ss70:0; const spendReal=spend;
    return {...r, spend: spendReal, ss };
  });
  const years=Array.from({length:H},(_,i)=>i+1);

  self.postMessage({ type:'result', payload:{
    feasible90, maxSuccessCap,
    minCashFor90, stocksNeededAtMinCash,
    startCashNeeded, startStocksNeeded,
    startingCash:startCashEffective, startingStocks:startStocks,
    successPct: mc.successPct, firstTroubleYearAge: mc.firstTroubleYearAge,
    baselineRows, seriesYears: years, stocks: mc.stocks, coverage: mc.coverage,
    initialCoveredYears
  }});
});
