/* app.js — Client-only SPA */
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

function toNumberFromMoney(input) {
  const s = (typeof input === 'string') ? input : input.value;
  if (!s) return 0;
  const digits = s.replace(/[^0-9]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}
function formatMoney(n) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}
function formatPercent(p) { return `${p.toFixed(1)}%`; }

function wireMoneyFormatting() {
  $$('.money').forEach(inp => {
    inp.addEventListener('input', () => {
      const n = toNumberFromMoney(inp);
      inp.value = n ? formatMoney(n) : '';
    });
  });
}

function showSection(id) {
  $$('.section').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById(id);
  if (sec) sec.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  document.body.setAttribute('data-page', id);
  if (id === 'inputs') {
    setTimeout(() => {
      const ageEl = document.getElementById('age');
      if (ageEl) { ageEl.focus(); ageEl.select(); }
    }, 50);
  }
  const backBtn = document.getElementById('backHeaderBtn');
  if (backBtn) backBtn.classList.toggle('d-none', id !== 'results');
}

// Saved inputs removed (no localStorage persistence)

// Derived hints
function renderDerivedHints(age, retireAge) {
  const nowYear = new Date().getFullYear();
  const yrsToRetire = Math.max(0, retireAge - age);
  const retireYear = nowYear + yrsToRetire;
  const ssYear = nowYear + Math.max(0, 70 - age);
  const el = document.getElementById('derivedHints');
  if (el) el.innerHTML = `Retirement starts in <strong>${yrsToRetire}</strong> year(s) (Year <strong>${retireYear}</strong>). Social Security starts in Year <strong>${ssYear}</strong> (when you turn 70).`;
}

// Chips and status
function chip(label, valueHtml, tooltip='', icon='', extraClass='', valueId='') {
  const col = document.createElement('div');
  col.className = 'col-sm-6 col-lg-4 col-xxl-3';
  const tip = tooltip ? `data-bs-toggle="tooltip" title="${tooltip.replace(/"/g, '&quot;')}"` : '';
  const iconHtml = icon ? `<i class="bi ${icon} chip-icon"></i>` : '';
  const idAttr = valueId ? `id="${valueId}"` : '';
  col.innerHTML = `<div class="summary-chip ${extraClass}" ${tip}><div class="label">${iconHtml}${label}</div><div class="value" ${idAttr}>${valueHtml}</div></div>`;
  return col;
}
function statusBadge(status) {
  const cls = status === 'Short' ? 'short' : status === 'Extra' ? 'extra' : 'enough';
  return `<span class="badge badge-status ${cls}">${status}</span>`;
}

// Charts
let lineLadderChart, lineStocksBaseChart;
function renderBarsStartNeeded(ctx, startCash, needCash, startStocks, needStocks) {
  if (barsChart) barsChart.destroy();
  barsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Cash', 'Stocks'],
      datasets: [
        { label: 'Starting', data: [startCash, startStocks] },
        { label: 'Needed', data: [needCash, needStocks] }
      ]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true, ticks: { callback: v => formatMoney(v) } } },
      plugins: { legend: { position: 'bottom' } }
    }
  });
}
function renderLineSingle(ctx, years, series, money=true, label='Value') {
  const fmt = v => money ? formatMoney(v) : v.toFixed(0);
  const ticks = money ? { callback: v => formatMoney(v) } : { stepSize: 1, callback: v => v.toFixed(0) };
  const labelY = money ? "Today's $" : 'Years ahead';
  const labelX = 'Year';
  let chart = (ctx.id === 'lineLadder') ? lineLadderChart : lineStocksBaseChart;
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'line',
    data: { labels: years, datasets: [{ label, data: series, borderWidth: 2, pointRadius: 0 }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${label}: ${fmt(c.parsed.y)}` } } },
      scales: { x: { title: { display: true, text: labelX } }, y: { title: { display: true, text: labelY }, ticks } },
      elements: { line: { tension: 0.2 } }
    }
  });
  if (ctx.id === 'lineLadder') lineLadderChart = chart; else lineStocksBaseChart = chart;
}

function refreshTooltips() {
  if (window.bootstrap && bootstrap.Tooltip) {
    const t = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    t.forEach(el => new bootstrap.Tooltip(el));
  }
}

// Worker
const worker = new Worker('./sim-worker.js');
let __lastRun = null; // { inputs, payload, meta }
function runPlan(inputs) {
  return new Promise((resolve) => {
    const listener = (e) => {
      if (e.data && e.data.type === 'result') {
        worker.removeEventListener('message', listener);
        resolve(e.data.payload);
      }
    };
    worker.addEventListener('message', listener);
    worker.postMessage({ type: 'run', payload: { inputs } });
  });
}

// Rendering
function renderSummary(payload) {
  const sb = document.getElementById('summaryBar');
  sb.innerHTML = '';

  const roundCash = (n) => Math.ceil(n / 1000) * 1000;
  const roundStocks = (n) => (n < 500000) ? Math.ceil(n/25000)*25000 : (n <= 2000000 ? Math.ceil(n/50000)*50000 : Math.ceil(n/100000)*100000);

  const startCashNeededDisp = roundCash(payload.startCashNeeded); // year-1 need
  const startStocksNeededDisp = (payload.startStocksNeeded != null) ? roundStocks(payload.startStocksNeeded) : null;

  const cashStatus = (payload.startingCash < startCashNeededDisp - 1000) ? 'Short' : (payload.startingCash > startCashNeededDisp + 1000 ? 'Extra' : 'Enough');
  const stocksStep = (startStocksNeededDisp != null && startStocksNeededDisp >= 500000) ? 25000 : 1000;
  const stocksStatus = (startStocksNeededDisp === null) ? 'Short' : ((payload.startingStocks < startStocksNeededDisp - stocksStep) ? 'Short' : (payload.startingStocks > startStocksNeededDisp + stocksStep ? 'Extra' : 'Enough'));

  const accentForStatus = (s) => s === 'Short' ? 'chip-accent-short' : (s === 'Extra' ? 'chip-accent-extra' : 'chip-accent-enough');
  const solverTip = `Auto-refined solver near 90%: n=${payload.solverTrials || 1000}, SE≈${(payload.solverSE||0).toFixed(2)}%`;
  const mcTip = `Monte Carlo of current starting stocks: n=${payload.successTrials || 1000}, SE≈${(payload.successSE||0).toFixed(2)}%`;
  const chips = [
    chip('Start Stocks Needed', (startStocksNeededDisp===null? '—' : formatMoney(startStocksNeededDisp)), solverTip, 'bi-graph-up-arrow', 'chip-accent-primary'),
    chip('Your Starting Cash', `${formatMoney(payload.startingCash)} ${statusBadge(cashStatus)}`, 'Year‑1 cash vs year‑1 need. Longer ladders are optional and may be built via refills.', 'bi-cash-coin', accentForStatus(cashStatus)),
    chip('Your Starting Stocks', `${formatMoney(payload.startingStocks)} ${statusBadge(stocksStatus)}`, 'How your current stocks compare to what’s needed.', 'bi-piggy-bank', accentForStatus(stocksStatus)),
    chip('Chance of success', formatPercent(payload.successPct), mcTip, 'bi-speedometer2', 'chip-accent-info', 'successValue')
  ];
  chips.forEach(c => sb.appendChild(c));
  refreshTooltips();

  // Meta line: trials/SE summary under chips (always shown, subtle)
  {
    const dbg = document.createElement('div');
    dbg.className = 'col-12';
    const seSolve = (payload.solverSE||0).toFixed(2);
    const seMc = (payload.successSE||0).toFixed(2);
    const nSolve = payload.solverTrials || 1000;
    const nMc = payload.successTrials || 1000;
    dbg.innerHTML = `<div class="debug-line">Trials used — Solver: n=${nSolve}, SE≈${seSolve}% • MC: n=${nMc}, SE≈${seMc}%</div>`;
    sb.appendChild(dbg);
  }

  // Animate success percentage
  const succEl = document.getElementById('successValue');
  if (succEl) {
    const target = payload.successPct;
    const start = 0;
    const dur = 700; // ms
    const t0 = performance.now();
    function step(t){
      const p = Math.min(1, (t - t0)/dur);
      const val = start + (target - start) * (0.5 - Math.cos(Math.PI*p)/2);
      succEl.textContent = `${val.toFixed(1)}%`;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // Banner: red when infeasible
  const banner = document.querySelector('.top-banner');
  if (!payload.feasible90) {
    banner.classList.remove('text-muted');
    banner.classList.add('bg-danger-subtle','text-danger','fw-semibold');
    banner.innerHTML = 'We can\'t reach a ≥90% success plan with the current Starting Cash and rules. ' +
      'Max achievable success is ' + formatPercent(payload.maxSuccessCap) + '. ' +
      'Try increasing Starting Cash, lowering yearly spending, or delaying retirement.';
  } else {
    banner.classList.remove('bg-danger-subtle','text-danger','fw-semibold');
    banner.classList.add('text-muted');
    banner.innerHTML = 'All amounts are in <strong>today\'s dollars</strong> (inflation-adjusted). We use <strong>real, after-inflation</strong> market returns.';
  }
}

function renderInputSnapshot(inputs, payload) {
  const nowYear = new Date().getFullYear();
  const yrsToRetire = Math.max(0, inputs.retireAge - inputs.age);
  const retireYear = nowYear + yrsToRetire;

  document.getElementById('inputSnapshot').innerHTML = `
    <div class="col-md-4"><strong>Your age:</strong> ${inputs.age}</div>
    <div class="col-md-4"><strong>Retirement age:</strong> ${inputs.retireAge} <span class="text-muted">(${yrsToRetire} yrs; ${retireYear})</span></div>
    <div class="col-md-4"><strong>All-in spending:</strong> ${formatMoney(inputs.spend)}</div>
    <div class="col-md-4"><strong>SS at 70:</strong> ${formatMoney(inputs.ss70)}/yr</div>
    <div class="col-md-4"><strong>Starting Cash:</strong> ${formatMoney(inputs.startCash)}</div>
    <div class="col-md-4"><strong>Starting Stocks:</strong> ${formatMoney(inputs.startStocks)}</div>
    <div class="col-md-4"><strong>Initial cash coverage:</strong> ${payload.initialCoveredYears} year(s)</div>
    <div class="col-md-4"><strong>Buffer target:</strong> 10 years</div>
  `;
}

function renderBaselineTable(rows) {
  const tbody = document.querySelector('#baselineTable tbody');
  tbody.innerHTML = '';
  rows.forEach(r => {
    const tr = document.createElement('tr');
    if (r.refillAmount > 0) tr.classList.add('refill');
    if (r.shortfall > 0) tr.classList.add('shortfall');
    tr.innerHTML = `
      <td>${r.year}</td>
      <td>${r.age}</td>
      <td class="text-end">${formatMoney(r.spend)}</td>
      <td class="text-end">${formatMoney(r.ss)}</td>
      <td class="text-end">${formatMoney(r.cashUsed)}</td>
      <td class="text-end">${r.soldEmergency > 0 ? formatMoney(r.soldEmergency) : '—'}</td>
      <td class="text-end">${r.soldRecovery > 0 ? formatMoney(r.soldRecovery) : '—'}</td>
      <td class="text-end">${formatMoney(r.cashEnd)}</td>
      <td class="text-end">${formatMoney(r.stocksEnd)}</td>
      <td class="text-end">${r.fundedAhead}</td>
    `;
    tbody.appendChild(tr);
  });
  refreshTooltips();
}

function renderHealth(successPct, firstTroubleYearAge) {
  document.getElementById('successPct').textContent = formatPercent(successPct);
  document.getElementById('firstTrouble').textContent = firstTroubleYearAge ? `Age ${firstTroubleYearAge}` : 'None expected';
}

function renderRecs(payload) {
  const el = document.getElementById('recoBody');
  if (payload.feasible90) {
    el.classList.remove('text-danger');
    el.innerHTML = 'No recommendations — plan looks feasible.';
    return;
  }
  if (payload.minCashFor90 === null) {
    el.classList.add('text-danger');
    el.innerHTML = 'Even with a full 10-year buffer, the ≥90% standard is not reachable under current assumptions. Consider lowering spending, delaying retirement, or relaxing the refill rule (advanced).';
    return;
  }
  el.classList.remove('text-danger');
  const cashLine = `<div><strong>Minimum Starting Cash to reach ≥90%:</strong> ${formatMoney(payload.minCashFor90)}</div>`;
  const stockLine = (payload.stocksNeededAtMinCash != null)
      ? `<div><strong>Start Stocks Needed at that cash:</strong> ${formatMoney(payload.stocksNeededAtMinCash)}</div>`
      : '';
  el.innerHTML = cashLine + stockLine;
}

function renderCharts(payload) {
  const rows = payload.baselineRows || [];
  const years = rows.map((_,i)=>i+1);
  const ladder = rows.map(r => r.cashEnd);
  const stocks = rows.map(r => r.stocksEnd);
  renderLineSingle(document.getElementById('lineLadder'), years, ladder, true, 'Ladder');
  renderLineSingle(document.getElementById('lineStocksBaseline'), years, stocks, true, 'Stocks');
}

// Collect & validate
function toInt(v){ return parseInt(String(v).replace(/[^0-9]/g,'')) || 0; }
function collectInputs() {
  return {
    age: toInt(document.getElementById('age').value),
    retireAge: toInt(document.getElementById('retireAge').value),
    spend: toNumberFromMoney(document.getElementById('spend')),
    ss70: toNumberFromMoney(document.getElementById('ss70')),
    startCash: toNumberFromMoney(document.getElementById('startCash')),
    startStocks: toNumberFromMoney(document.getElementById('startStocks'))
  };
}
function validateInputs(inp) {
  const errs = [];
  if (inp.age < 0) errs.push('Age must be ≥ 0');
  if (inp.retireAge < inp.age) errs.push('Retirement age must be ≥ your age');
  ['spend','ss70','startCash','startStocks'].forEach(k => { if (inp[k] < 0) errs.push('Amounts must be non-negative'); });
  return errs;
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
  // Debug query param to show extra actions
  try {
    const usp = new URLSearchParams(location.search);
    const isDebug = (usp.get('debug') === 'true' || usp.has('debug'));
    const dbg = document.getElementById('debugActions');
    if (dbg && isDebug) dbg.classList.remove('d-none');
  } catch {}
  // Navigation
  document.addEventListener('click', (e) => {
    const navEl = e.target.closest('[data-nav]');
    if (navEl) { e.preventDefault(); showSection(navEl.dataset.nav); }
  });

  // Resume/save removed

  wireMoneyFormatting();

  // Live hints
  ['#age', '#retireAge'].forEach(sel => {
    document.querySelector(sel).addEventListener('input', () => {
      const age = toInt(document.getElementById('age').value);
      const retireAge = toInt(document.getElementById('retireAge').value);
      if (retireAge >= age) renderDerivedHints(age, retireAge);
    });
  });
  renderDerivedHints(58, 65);

  // Submit
  const form = document.getElementById('planForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // Use native validation first
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const inputs = collectInputs();
    const errs = validateInputs(inputs);
    if (errs.length) { alert('Please fix:\n• ' + errs.join('\n• ')); return; }
    // no-op: persistence removed

    const btn = document.querySelector('#planForm button[type="submit"]');
    btn.querySelector('.run-label').classList.add('d-none');
    btn.querySelector('.run-spinner').classList.remove('d-none');
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('d-none');

    try {
      const minDelay = new Promise(res => setTimeout(res, 2000));
      const payload = (await Promise.all([runPlan(inputs), minDelay]))[0];
      __lastRun = { inputs, payload, meta: { ts: new Date().toISOString(), trials: 1000, mean: 0.05, stdev: 0.18, policy: 'cash-only spending; refill on high-water-mark; 10-year max buffer' } };
      renderSummary(payload);
      renderInputSnapshot(inputs, payload);
      renderBaselineTable(payload.baselineRows);
      renderCharts(payload);
      showSection('results');
    } catch (err) {
      console.error(err);
      alert('Something went wrong. Please try again.');
    } finally {
      btn.querySelector('.run-label').classList.remove('d-none');
      btn.querySelector('.run-spinner').classList.add('d-none');
      if (overlay) overlay.classList.add('d-none');
    }
  });

  // Export Results (JSON)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="export-json"]');
    if (!btn) return;
    if (!__lastRun) { alert('No results to export yet. Run a plan first.'); return; }
    try {
      const data = JSON.stringify(__lastRun, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date().toISOString().replace(/[:.]/g,'-');
      const i = __lastRun.inputs;
      a.href = url;
      a.download = `planner_result_${i.age}to${i.retireAge}_${ts}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Could not export results.');
    }
  });
});
