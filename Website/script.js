/* ══════════════════════════════════════
   ⚙️  CONFIG — replace these or use modal
══════════════════════════════════════ */
let CHANNEL_ID  = '';   // ← YOUR THINGSPEAK CHANNEL ID
let API_KEY     = '';   // ← YOUR THINGSPEAK READ API KEY
let RESULTS     = 20;

/* Normalise raw ThinkSpeak field1 value at ingest time.
   Accepts any casing/spacing variant and returns canonical form. */
function normaliseRaw(raw) {
  const v = (raw || '').toString().toUpperCase().replace(/[_\s-]+/g, '_').trim();
  if (v === 'GREEN')                              return 'GREEN';
  if (v === 'DOUBLE_YELLOW' || v === 'DOUBLEYELLOW') return 'DOUBLE_YELLOW';
  if (v === 'YELLOW')                             return 'YELLOW';
  if (v === 'RED')                                return 'RED';
  return null;
}

/* ══════════════════════════════════════
   STATE
══════════════════════════════════════ */
let barChartInst     = null;
let timelineChartInst = null;
let donutChartInst   = null;
let countdown        = 5;
let countdownTimer   = null;
let refreshTimer     = null;

const meanings = { RED:'STOP', YELLOW:'CAUTION', DOUBLE_YELLOW:'CAUTION AHEAD', GREEN:'PROCEED' };

/* ══════════════════════════════════════
   MODAL ACTIONS
══════════════════════════════════════ */
function connectThinkSpeak() {
  const cid  = document.getElementById('inputChannelId').value.trim();
  const akey = document.getElementById('inputApiKey').value.trim();
  const res  = parseInt(document.getElementById('inputResults').value) || 20;
  if (!cid || !akey) { alert('Please enter both Channel ID and API Key'); return; }
  CHANNEL_ID = cid;
  API_KEY    = akey;
  RESULTS    = res;
  document.getElementById('configModal').style.display = 'none';
  document.getElementById('channelLabel').textContent = `Channel: ${CHANNEL_ID} · ThinkSpeak IoT · field1`;
  fetchData();
  startAutoRefresh();
  maybeAddCurrentAsChannel();
}

function loadDemoData() {
  document.getElementById('configModal').style.display = 'none';
  document.getElementById('channelLabel').textContent = 'Demo Mode · Sample Data · field1';
  const demo = [
    { created_at:'2025-07-29T12:50:00Z', entry_id:1,  field1:'RED'    },
    { created_at:'2025-07-29T12:51:55Z', entry_id:2,  field1:'YELLOW' },
    { created_at:'2025-07-29T12:52:30Z', entry_id:3,  field1:'GREEN'  },
    { created_at:'2025-07-29T13:12:50Z', entry_id:4,  field1:'RED'    },
    { created_at:'2025-07-29T13:13:10Z', entry_id:5,  field1:'RED'    },
    { created_at:'2025-07-29T13:25:40Z', entry_id:6,  field1:'YELLOW' },
    { created_at:'2025-07-29T13:26:00Z', entry_id:7,  field1:'GREEN'  },
    { created_at:'2025-07-29T13:26:20Z', entry_id:8,  field1:'YELLOW' },
    { created_at:'2025-07-29T13:26:50Z', entry_id:9,  field1:'RED'    },
    { created_at:'2025-07-29T13:43:40Z', entry_id:10, field1:'RED'    },
  ];
  renderDashboard(demo);
  startAutoRefresh();
}

/* ══════════════════════════════════════
   FETCH FROM THINGSPEAK
══════════════════════════════════════ */
async function fetchData() {
  if (!CHANNEL_ID || !API_KEY) return;
  const btn = document.getElementById('refreshBtn');
  btn.disabled = true; btn.textContent = '↺ Loading...';
  try {
    // ThinkSpeak supports CORS — must use https and include the api_key as param
    const url = `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json?api_key=${API_KEY}&results=${RESULTS}&timezone=Asia%2FKolkata`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      mode: 'cors'          // ThinkSpeak allows CORS from browsers
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} — check your Channel ID and API Key`);
    const json = await res.json();
    const feeds = (json.feeds || []).map(f => ({
      created_at: f.created_at,
      entry_id:   Number(f.entry_id),
      field1:     (f.field1 || '').toString().toUpperCase().trim()
    })).map(f => ({
      ...f,
      field1: normaliseRaw(f.field1)  // normalise at ingest time
    })).filter(f => f.field1 !== null);

    if (feeds.length === 0) {
      showToast('⚠️ Connected but no valid signal values found in field1 yet.');
    }
    renderDashboard(feeds.length ? feeds : getDemoFeeds());
  } catch(e) {
    console.error('ThinkSpeak fetch error:', e);
    showToast('❌ ' + e.message + ' — showing last data');
  }
  btn.disabled = false; btn.textContent = '↻ Refresh';
  resetCountdown();
}

function getDemoFeeds() {
  return [
    { created_at:'2025-07-29T12:50:00Z', entry_id:1,  field1:'RED'    },
    { created_at:'2025-07-29T12:51:55Z', entry_id:2,  field1:'YELLOW' },
    { created_at:'2025-07-29T12:52:30Z', entry_id:3,  field1:'GREEN'  },
    { created_at:'2025-07-29T13:12:50Z', entry_id:4,  field1:'RED'    },
    { created_at:'2025-07-29T13:13:10Z', entry_id:5,  field1:'RED'    },
    { created_at:'2025-07-29T13:25:40Z', entry_id:6,  field1:'YELLOW' },
    { created_at:'2025-07-29T13:26:00Z', entry_id:7,  field1:'GREEN'  },
    { created_at:'2025-07-29T13:26:20Z', entry_id:8,  field1:'YELLOW' },
    { created_at:'2025-07-29T13:26:50Z', entry_id:9,  field1:'RED'    },
    { created_at:'2025-07-29T13:43:40Z', entry_id:10, field1:'RED'    },
  ];
}

function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = `position:fixed;bottom:28px;left:50%;transform:translateX(-50%);
      background:#1e2535;border:1px solid rgba(255,255,255,0.1);color:#e2e8f4;
      padding:12px 22px;border-radius:12px;font-size:13px;font-family:'Plus Jakarta Sans',sans-serif;
      z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,0.5);transition:opacity 0.3s;`;
    document.body.appendChild(t);
  }
  t.textContent = msg; t.style.opacity = '1';
  setTimeout(() => { t.style.opacity = '0'; }, 4000);
}

/* ══════════════════════════════════════
   RENDER
══════════════════════════════════════ */
function renderDashboard(feeds) {
  if (!feeds.length) return;
  lastFeeds = feeds;
  syncSecondaryPages(feeds);
  lastFeeds = feeds;
  syncSecondaryPages(feeds);

  const total  = feeds.length;
  const redC   = feeds.filter(f=>normaliseSignal(f.field1)==='RED').length;
  const yelC   = feeds.filter(f=>{ const n=normaliseSignal(f.field1); return n==='YELLOW'||n==='DOUBLE_YELLOW'; }).length;
  const grnC   = feeds.filter(f=>normaliseSignal(f.field1)==='GREEN').length;
  const redPct = Math.round(redC/total*100);
  const yelPct = Math.round(yelC/total*100);
  const grnPct = Math.round(grnC/total*100);

  // Stats
  document.getElementById('s-total').textContent    = total;
  document.getElementById('s-red').textContent      = redC;
  document.getElementById('s-yellow').textContent   = yelC;
  document.getElementById('s-green').textContent    = grnC;
  document.getElementById('s-total-sub').textContent= `${total} entries fetched`;
  document.getElementById('s-red-pct').textContent  = `${redPct}% of total`;
  document.getElementById('s-yellow-pct').textContent = `${yelPct}% of total`;
  document.getElementById('s-green-pct').textContent = `${grnPct}% of total`;

  // Alert badge
  document.getElementById('alertCount').textContent = redC;

  // Progress bars
  document.getElementById('pb-red').style.width    = redPct+'%';
  document.getElementById('pb-yellow').style.width = yelPct+'%';
  document.getElementById('pb-green').style.width  = grnPct+'%';
  document.getElementById('pp-red').textContent    = redPct+'%';
  document.getElementById('pp-yellow').textContent = yelPct+'%';
  document.getElementById('pp-green').textContent  = grnPct+'%';

  // Donut legend
  document.getElementById('dl-red').textContent    = redC;
  document.getElementById('dl-yellow').textContent = yelC;
  document.getElementById('dl-green').textContent  = grnC;
  document.getElementById('donut-pct').textContent = redPct+'%';

  // Live signal (latest)
  const latest = feeds[feeds.length-1];
  setSignalTower(latest);

  // Bar chart
  renderBarChart(feeds);

  // Timeline chart (for Timeline page)
  renderTimelineChart(feeds);

  // Donut chart
  renderDonutChart(redC, yelC, grnC);

  // Table
  renderTable(feeds);

  document.getElementById('table-count').textContent = `${total} entries`;
  document.getElementById('chart-range').textContent = `Last ${total} entries`;
  document.getElementById('timeline-chart-range').textContent = `Last ${total} entries`;
}

/* ══════════════════════════════════════
   SIGNAL TOWER
══════════════════════════════════════ */
/* Railway signal states:
   GREEN        → top light lit (Proceed)
   DOUBLE_YELLOW→ top + bottom-of-top lit (Caution ahead)
   YELLOW       → middle light lit (Caution, prepare stop)
   RED          → bottom light lit (STOP)
   field1 values: GREEN / DOUBLE_YELLOW / YELLOW / RED  */
const SIGNAL_CONFIG = {
  GREEN:         { lights:['green'],                 color:'var(--green)',  label:'GREEN',         meaning:'Proceed at authorised speed' },
  DOUBLE_YELLOW: { lights:['dyellow-top','yellow'],  color:'var(--yellow)', label:'DOUBLE YELLOW', meaning:'Proceed — next signal at Caution' },
  YELLOW:        { lights:['yellow'],                color:'var(--yellow)', label:'YELLOW',         meaning:'Caution — prepare to STOP at next signal' },
  RED:           { lights:['red'],                   color:'var(--red)',    label:'RED',            meaning:'STOP the train prior to the signal' },
};

/* Map old 3-value data to new 4-value system */
function normaliseSignal(raw) {
  // Since field1 is already normalised at ingest (via normaliseRaw),
  // this is mostly a pass-through — but kept for safety
  return normaliseRaw(raw);
}

function applySignalLights(state, prefix) {
  // prefix = '' for dashboard tower, 'sm-' for signal monitor
  const cfg = SIGNAL_CONFIG[state];
  ['dyellow-top','green','yellow','red'].forEach(id => {
    const el = document.getElementById((prefix||'light-') + (prefix ? id.replace('dyellow-top','dyellow') : id));
    // dashboard uses id="light-green" etc, monitor uses "sm-light-green" etc
    const el2 = document.getElementById((prefix||'') + 'light-' + id);
    const target = el2 || el;
    if (!target) return;
    const litClass = 'lit-' + (id.includes('yellow') ? 'yellow' : id.includes('green') ? 'green' : 'red');
    target.className = 'sig-light' + (cfg && cfg.lights.some(l => id.startsWith(l) || l === id) ? ' ' + litClass : '');
  });
}

function setSignalTower(entry) {
  const raw = entry.field1;
  const s   = normaliseSignal(raw) || 'RED';
  const cfg = SIGNAL_CONFIG[s];

  applySignalLights(s, '');

  const colMap = { GREEN:'var(--green)', DOUBLE_YELLOW:'var(--yellow)', YELLOW:'var(--yellow)', RED:'var(--red)' };
  const chip = document.getElementById('current-chip');
  if (chip) { chip.textContent = cfg.label; chip.className = 'pill ' + (s==='GREEN'?'green':s==='RED'?'red':'yellow'); }

  setText('ci-state',   cfg.label,   colMap[s]);
  setText('ci-meaning', cfg.meaning);
  setText('ci-entry',   '#' + entry.entry_id);
  setText('ci-time',    entry.created_at.replace('T',' ').replace('Z','').replace(/[+-]\d{2}:\d{2}$/,''));
}

/* ══════════════════════════════════════
   BAR CHART
══════════════════════════════════════ */
function renderBarChart(feeds) {
  const labels = feeds.map(f => '#'+f.entry_id);
  const colorMap = { RED:'#ff4d6a', YELLOW:'#fbbf24', GREEN:'#22d38a' };

  // Build a horizontal-stripe canvas pattern for DOUBLE_YELLOW bars
  // Pattern tile = full bar height split into 2 halves (yellow / dark gap / yellow)
  // Use a tall tile so 'repeat' only tiles once vertically across the bar
  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = 2; tmpCanvas.height = 200;
  const tmpCtx = tmpCanvas.getContext('2d');
  tmpCtx.fillStyle = '#fbbf24';
  tmpCtx.fillRect(0, 0, 2, 85);       // top yellow half
  tmpCtx.fillStyle = '#1a2030';
  tmpCtx.fillRect(0, 85, 2, 6);      // 12px dark divider (at 0.5 line)
  tmpCtx.fillStyle = '#fbbf24';
  tmpCtx.fillRect(0, 91, 2, 85);     // bottom yellow half (symmetric)

  const ctx = document.getElementById('barChart').getContext('2d');  // must be before createPattern
  const dyPattern = ctx.createPattern(tmpCanvas, 'repeat');

  const colors = feeds.map(f => {
    const ns = normaliseSignal(f.field1);
    if (ns === 'DOUBLE_YELLOW') return dyPattern;
    return colorMap[ns] || '#6b7a99';
  });
  const vals = feeds.map(() => 1);

  if (barChartInst) barChartInst.destroy();

  const barThick = feeds.length > 60 ? 5 : feeds.length > 30 ? 8 : 13;

  barChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: vals,
        backgroundColor: colors,
        borderRadius: 3,
        borderSkipped: false,
        barThickness: barThick,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => 'Entry ' + labels[items[0].dataIndex],
            label: item => {
              const ns = normaliseSignal(feeds[item.dataIndex].field1) || 'RED';
              const cfg = SIGNAL_CONFIG[ns];
              return ' ' + cfg.label + ' — ' + cfg.meaning.split('.')[0];
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#6b7a99',
            font: { size: feeds.length > 50 ? 8 : 10 },
            maxRotation: 90,
            autoSkip: true,
            maxTicksLimit: 20,
          },
          grid: { color: 'rgba(255,255,255,0.04)' }
        },
        y: {
          display: false,
          grid: { display: false },
          min: 0,
          max: 1.05
        }
      },
      layout: { padding: { top: 2, bottom: 0 } }
    }
  });
}

/* ══════════════════════════════════════
   TIMELINE CHART (same as bar chart for Timeline page)
══════════════════════════════════════ */
function renderTimelineChart(feeds) {
  // Check if timelineChart canvas exists (only on Timeline page)
  const timelineCanvas = document.getElementById('timelineChart');
  if (!timelineCanvas) return;

  const labels = feeds.map(f => '#'+f.entry_id);
  const colorMap = { RED:'#ff4d6a', YELLOW:'#fbbf24', GREEN:'#22d38a' };

  // Build a horizontal-stripe canvas pattern for DOUBLE_YELLOW bars
  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = 2; tmpCanvas.height = 200;
  const tmpCtx = tmpCanvas.getContext('2d');
  tmpCtx.fillStyle = '#fbbf24';
  tmpCtx.fillRect(0, 0, 2, 85);
  tmpCtx.fillStyle = '#1a2030';
  tmpCtx.fillRect(0, 85, 2, 6);
  tmpCtx.fillStyle = '#fbbf24';
  tmpCtx.fillRect(0, 91, 2, 85);

  const ctx = timelineCanvas.getContext('2d');
  const dyPattern = ctx.createPattern(tmpCanvas, 'repeat');

  const colors = feeds.map(f => {
    const ns = normaliseSignal(f.field1);
    if (ns === 'DOUBLE_YELLOW') return dyPattern;
    return colorMap[ns] || '#6b7a99';
  });
  const vals = feeds.map(() => 1);

  if (timelineChartInst) timelineChartInst.destroy();

  const barThick = feeds.length > 60 ? 5 : feeds.length > 30 ? 8 : 13;

  timelineChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: vals,
        backgroundColor: colors,
        borderRadius: 3,
        borderSkipped: false,
        barThickness: barThick,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => 'Entry ' + labels[items[0].dataIndex],
            label: item => {
              const ns = normaliseSignal(feeds[item.dataIndex].field1) || 'RED';
              const cfg = SIGNAL_CONFIG[ns];
              return ' ' + cfg.label + ' — ' + cfg.meaning.split('.')[0];
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#6b7a99',
            font: { size: feeds.length > 50 ? 8 : 10 },
            maxRotation: 90,
            autoSkip: true,
            maxTicksLimit: 20,
          },
          grid: { color: 'rgba(255,255,255,0.04)' }
        },
        y: {
          display: false,
          grid: { display: false },
          min: 0,
          max: 1.05
        }
      },
      layout: { padding: { top: 2, bottom: 0 } }
    }
  });
}

/* ══════════════════════════════════════
   DONUT CHART
══════════════════════════════════════ */
function renderDonutChart(r, y, g) {
  const ctx = document.getElementById('donutChart').getContext('2d');
  if (donutChartInst) donutChartInst.destroy();

  donutChartInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['RED','YELLOW','GREEN'],
      datasets:[{
        data: [r, y, g],
        backgroundColor: ['#ff4d6a','#fbbf24','#22d38a'],
        borderColor: '#1a2030',
        borderWidth: 3,
        hoverOffset: 4,
      }]
    },
    options: {
      cutout: '72%',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });
}

/* ══════════════════════════════════════
   TABLE
══════════════════════════════════════ */
function renderTable(feeds) {
  const body = document.getElementById('tableBody');
  body.innerHTML = '';
  const msgMap = { RED:'Train Must Halt', YELLOW:'Reduce Speed', DOUBLE_YELLOW:'Caution Ahead', GREEN:'Clear to Proceed' };
  [...feeds].reverse().forEach(f => {
    const ns2  = normaliseSignal(f.field1) || 'RED';
    const cfg2 = SIGNAL_CONFIG[ns2];
    const cls  = ns2 === 'GREEN' ? 'green' : ns2 === 'RED' ? 'red' : 'yellow';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="entry-num">#${f.entry_id}</span></td>
      <td><span class="ts-mono">${f.created_at.replace('T',' ').replace('Z','').replace(/[+-]\d{2}:\d{2}$/,'')}</span></td>
      <td><span class="sig-chip ${cls}"><span class="sig-dot ${cls}"></span>${cfg2.label}</span></td>
      <td style="font-size:12px;color:var(--muted)">${cfg2.meaning}</td>
    `;
    body.appendChild(tr);
  });
}

/* ══════════════════════════════════════
   AUTO REFRESH
══════════════════════════════════════ */
function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  if (countdownTimer) clearInterval(countdownTimer);
  refreshTimer = setInterval(() => { fetchData(); }, 5000);
  resetCountdown();
}

function resetCountdown() {
  countdown = 5;
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    countdown--;
    document.getElementById('countdown').textContent = countdown + 's';
    if (countdown <= 0) { countdown = 5; }
  }, 1000);
}
/* ══════════════════════════════════════
   NAVIGATION
══════════════════════════════════════ */
const PAGE_TITLES = {
  'dashboard':      'Dashboard',
  'signal-monitor': 'Signal Monitor',
  'iot-channels':   'IoT Channels',
  'signal-log':     'Signal Log',
  'reports':        'Reports',
  'timeline':       'Timeline',
  'settings':       'Settings',
};

let lastFeeds = [];

function navigate(el) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');
  const page = el.dataset.page;
  document.querySelectorAll('.page-section').forEach(p => p.style.display = 'none');
  document.getElementById('page-' + page).style.display = 'block';
  const tb = document.getElementById('topbar-title');
  if (tb) tb.textContent = PAGE_TITLES[page] || page;
  
  // Update IoT Channels list when viewing that page
  if (page === 'iot-channels') {
    updateIotChannelsList();
  }
  
  // Update account details when viewing settings page
  if (page === 'settings') {
    updateAccountDetails();
  }
  
  if (lastFeeds.length) syncSecondaryPages(lastFeeds);
}

function syncSecondaryPages(feeds) {
  if (!feeds.length) return;
  const latest = feeds[feeds.length - 1];
  const colHex = { RED:'#ff4d6a', DOUBLE_YELLOW:'#fbbf24', YELLOW:'#fbbf24', GREEN:'#22d38a' };
  const colVar = { RED:'var(--red)', DOUBLE_YELLOW:'var(--yellow)', YELLOW:'var(--yellow)', GREEN:'var(--green)' };
  const msgMap = { RED:'Train Must Halt', DOUBLE_YELLOW:'Caution Ahead', YELLOW:'Reduce Speed', GREEN:'Clear to Proceed' };
  const s = latest.field1;

  // Signal Monitor — 4-light tower
  const ns = normaliseSignal(s) || 'RED';
  const scfg = SIGNAL_CONFIG[ns];
  ['dyellow','green','yellow','red'].forEach(function(c) {
    const el = document.getElementById('sm-light-' + c);
    if (!el) return;
    const litId = c === 'dyellow' ? 'dyellow-top' : c;
    const litClass = 'lit-' + (c.includes('yellow')||c==='dyellow' ? 'yellow' : c==='green' ? 'green' : 'red');
    el.className = 'sig-light' + (scfg && scfg.lights.some(function(l){ return litId.startsWith(l)||l===litId; }) ? ' '+litClass : '');
  });
  const smChip = document.getElementById('sm-chip');
  if (smChip) { smChip.textContent = scfg.label; smChip.className = 'pill '+(ns==='GREEN'?'green':ns==='RED'?'red':'yellow'); }
  setText('sm-state',   scfg.label, colVar[s] || colVar['RED']);
  setText('sm-meaning', scfg.meaning);
  setText('sm-entry',   '#' + latest.entry_id);
  setText('sm-time',    latest.created_at.replace('T',' ').replace('Z','').replace(/[+-]\d{2}:\d{2}$/,''));

  // IoT Channels
  setText('iot-channel-id', CHANNEL_ID || 'Demo Mode');
  setText('iot-api-key',    API_KEY ? API_KEY.slice(0,6)+'**********' : 'Demo Mode');
  setText('iot-results',    feeds.length + ' entries');
  const iotChip = document.getElementById('iot-status-chip');
  if (iotChip) { iotChip.textContent = CHANNEL_ID ? 'Connected' : 'Demo Mode'; iotChip.className = 'pill green'; }

  // Signal Log
  const logBody = document.getElementById('logTableBody');
  if (logBody) {
    logBody.innerHTML = '';
    [...feeds].reverse().forEach((f, i) => {
      const ns3 = normaliseSignal(f.field1)||'RED';
      const cfg3 = SIGNAL_CONFIG[ns3];
      const cls3 = ns3==='GREEN'?'green':ns3==='RED'?'red':'yellow';
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td><span class="entry-num">#'+f.entry_id+'</span></td>'+
        '<td><span class="ts-mono">'+f.created_at.replace('T',' ').replace('Z','').replace(/[+-]\d{2}:\d{2}$/,'')+'</span></td>'+
        '<td><span class="sig-chip '+cls3+'"><span class="sig-dot '+cls3+'"></span>'+cfg3.label+'</span></td>'+
        '<td style="font-size:12px;color:var(--muted)">'+cfg3.meaning+'</td>'+
        '<td style="font-size:12px;color:var(--muted)">'+(feeds.length - i)+'</td>';
      logBody.appendChild(tr);
    });
  }
  setText('log-count', feeds.length + ' entries');

  // Reports
  const total = feeds.length;
  const redC  = feeds.filter(f=>normaliseSignal(f.field1)==='RED').length;
  const yelC  = feeds.filter(f=>{ const n=normaliseSignal(f.field1); return n==='YELLOW'||n==='DOUBLE_YELLOW'; }).length;
  const grnC  = feeds.filter(f=>normaliseSignal(f.field1)==='GREEN').length;
  setText('rp-red',        redC,  colVar.RED);
  setText('rp-yellow',     yelC,  colVar.YELLOW);
  setText('rp-green',      grnC,  colVar.GREEN);
  setText('rp-red-pct',    Math.round(redC/total*100)+'%');
  setText('rp-yellow-pct', Math.round(yelC/total*100)+'%');
  setText('rp-green-pct',  Math.round(grnC/total*100)+'%');
  const rpCtx = document.getElementById('reportChart');
  if (rpCtx) {
    if (window._rpChart) window._rpChart.destroy();
    window._rpChart = new Chart(rpCtx.getContext('2d'), {
      type:'bar',
      data:{ labels:['RED — Stop','YELLOW — Caution','GREEN — Proceed'],
             datasets:[{ data:[redC,yelC,grnC], backgroundColor:['rgba(255,77,106,0.7)','rgba(251,191,36,0.7)','rgba(34,211,138,0.7)'], borderColor:['#ff4d6a','#fbbf24','#22d38a'], borderWidth:2, borderRadius:8 }]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}} ,
                scales:{ x:{ticks:{color:'#6b7a99'},grid:{color:'rgba(255,255,255,0.04)'}}, y:{ticks:{color:'#6b7a99'},grid:{color:'rgba(255,255,255,0.04)'}} }}
    });
  }

  // Timeline
  const tl = document.getElementById('timeline-list');
  if (tl) {
    tl.innerHTML = '';
    feeds.forEach((f, i) => {
      const isLast = i === feeds.length - 1;
      const div = document.createElement('div');
      div.style.cssText = 'display:flex;gap:16px;';
      div.innerHTML =
        '<div style="display:flex;flex-direction:column;align-items:center;">'+
          '<div style="width:14px;height:14px;border-radius:50%;background:'+({RED:'#ff4d6a',DOUBLE_YELLOW:'#fbbf24',YELLOW:'#fbbf24',GREEN:'#22d38a'}[normaliseSignal(f.field1)]||'#ff4d6a')+';box-shadow:0 0 8px '+({RED:'#ff4d6a',DOUBLE_YELLOW:'#fbbf24',YELLOW:'#fbbf24',GREEN:'#22d38a'}[normaliseSignal(f.field1)]||'#ff4d6a')+';flex-shrink:0;margin-top:3px;"></div>'+
          (isLast?'':'<div style="width:2px;flex:1;background:rgba(255,255,255,0.06);margin:4px 0;min-height:28px;"></div>')+
        '</div>'+
        '<div style="flex:1;padding-bottom:'+(isLast?'0':'18px')+';border-bottom:'+(isLast?'none':'1px solid rgba(255,255,255,0.04)')+';">'+
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;">'+
            '<span style="font-family:Sora,sans-serif;font-weight:700;font-size:13px;color:'+colHex[f.field1]+'">'+f.field1+' — '+(msgMap[f.field1]||'')+'</span>'+
            '<span style="font-size:11px;color:var(--muted);font-family:monospace">Entry #'+f.entry_id+'</span>'+
          '</div>'+
          '<div style="font-size:11px;color:var(--muted);">'+f.created_at.replace('T',' ').replace('Z','').replace(/[+-]\d{2}:\d{2}$/,'')+'</div>'+
        '</div>';
      tl.appendChild(div);
    });
  }
}

function setText(id, val, color) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = val;
  if (color) el.style.color = color;
}

function applySettings() {
  const cid = document.getElementById('set-channel').value.trim();
  const key = document.getElementById('set-apikey').value.trim();
  const res = parseInt(document.getElementById('set-results').value) || 20;
  if (!cid || !key) { showToast('Please enter Channel ID and API Key'); return; }
  CHANNEL_ID = cid; API_KEY = key; RESULTS = res;
  document.getElementById('channelLabel').textContent = 'Channel: '+CHANNEL_ID+' · ThinkSpeak IoT · field1';
  fetchData(); startAutoRefresh();
  showToast('Settings saved! Fetching data...');
}

/* ══════════════════════════════════════
   TOPBAR DROPDOWN LOGIC
══════════════════════════════════════ */
function toggleDropdown(id) {
  const all = ['avatar-dropdown'];
  all.forEach(did => {
    const el = document.getElementById(did);
    if (!el) return;
    if (did === id) {
      el.style.display = el.style.display === 'none' ? 'block' : 'none';
    } else {
      el.style.display = 'none';
    }
  });
}

function toggleChannelDropdown() {
  const dropdown = document.getElementById('channel-dropdown');
  if (!dropdown) return;
  const isHidden = dropdown.style.display === 'none';
  if (isHidden) {
    renderChannelList(); // Refresh list when opening
  }
  dropdown.style.display = isHidden ? 'block' : 'none';
  if (!isHidden) {
    document.getElementById('avatar-dropdown').style.display = 'none';
  }
}

// Close dropdowns on outside click
document.addEventListener('click', function(e) {
  if (!e.target.closest('.topbar-right')) {
    ['avatar-dropdown','channel-dropdown'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }
});

function navToPage(page) {
  ['avatar-dropdown'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const navItem = document.querySelector('.nav-item[data-page="'+page+'"]');
  if (navItem) navigate(navItem);
}

function navToSettings() {
  navToPage('settings');
}



/* ══════════════════════════════════════
   CHANNEL MANAGEMENT
══════════════════════════════════════ */
let channels = [];
let activeChannelIdx = -1;

function openAddChannel() {
  ['bell-dropdown','grid-dropdown','avatar-dropdown','channel-dropdown'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});
  document.getElementById('addChannelModal').style.display = 'flex';
  document.getElementById('ac-name').value = '';
  document.getElementById('ac-id').value = '';
  document.getElementById('ac-key').value = '';
  document.getElementById('ac-icon').value = '🚆';
}

function saveChannel() {
  const name = document.getElementById('ac-name').value.trim();
  const cid  = document.getElementById('ac-id').value.trim();
  const key  = document.getElementById('ac-key').value.trim();
  const icon = document.getElementById('ac-icon').value.trim() || '🚆';
  if (!name || !cid || !key) { showToast('Please fill in all fields'); return; }
  channels.push({ id: Date.now(), name, channelId: cid, apiKey: key, icon });
  document.getElementById('addChannelModal').style.display = 'none';
  renderChannelList();
  updateIotChannelsList();
  switchChannel(channels.length - 1);
  saveChannelsToStorage();
  showToast('Channel "' + name + '" added!');
}

function renderChannelList() {
  const list = document.getElementById('channel-list');
  if (!list) return;
  if (channels.length === 0) {
    list.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted);font-size:13px;">No channels yet — click + Add</div>';
    return;
  }
  list.innerHTML = '';
  channels.forEach(function(ch, i) {
    const isActive = i === activeChannelIdx;
    const div = document.createElement('div');
    div.className = 'channel-item' + (isActive ? ' active-ch' : '');
    div.innerHTML =
      '<div class="ch-icon">' + ch.icon + '</div>' +
      '<div class="ch-info">' +
        '<div class="ch-name">' + ch.name + '</div>' +
        '<div class="ch-meta">ID: ' + ch.channelId + (isActive ? ' · Active' : '') + '</div>' +
      '</div>' +
      '<div class="ch-status-dot ' + (isActive ? 'online' : 'offline') + '"></div>' +
      '<div class="ch-actions">' +
        '<div class="ch-action-btn del" title="Remove" onclick="event.stopPropagation();deleteChannel(' + i + ')">✕</div>' +
      '</div>';
    div.onclick = function(){ switchChannel(i); };
    list.appendChild(div);
  });
}

function updateIotChannelsList() {
  const listContainer = document.getElementById('iot-channels-list');
  const countEl = document.getElementById('iot-ch-count');
  
  if (!listContainer) return;
  
  if (channels.length === 0) {
    listContainer.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);font-size:13px;">No channels yet. Click <b style="color:var(--accent1)">+ Add Channel</b> to get started.</div>';
    if (countEl) countEl.textContent = '0 channels';
    return;
  }
  
  listContainer.innerHTML = '';
  channels.forEach(function(ch, i) {
    const isActive = i === activeChannelIdx;
    const div = document.createElement('div');
    div.className = 'channel-item' + (isActive ? ' active-ch' : '');
    div.innerHTML =
      '<div class="ch-icon">' + ch.icon + '</div>' +
      '<div class="ch-info">' +
        '<div class="ch-name">' + ch.name + '</div>' +
        '<div class="ch-meta">ID: ' + ch.channelId + (isActive ? ' · Active' : '') + '</div>' +
      '</div>' +
      '<div class="ch-status-dot ' + (isActive ? 'online' : 'offline') + '"></div>' +
      '<div class="ch-actions">' +
        '<div class="ch-action-btn del" title="Remove" onclick="event.stopPropagation();deleteChannel(' + i + ')">✕</div>' +
      '</div>';
    div.onclick = function(){ switchChannel(i); };
    listContainer.appendChild(div);
  });
  
  if (countEl) countEl.textContent = channels.length + ' channel' + (channels.length !== 1 ? 's' : '');
}

function updateAccountDetails() {
  const session = getSession();
  if (!session) return;
  
  const users = getUsers();
  const user = users[session.email];
  if (!user) return;
  
  // Update account details in settings page
  setText('account-name', user.name);
  setText('account-email', session.email);
  setText('account-channels', channels.length);
  setText('account-status', 'Active');
}

function switchChannel(idx) {
  if (idx < 0 || idx >= channels.length) return;
  activeChannelIdx = idx;
  const ch = channels[idx];
  CHANNEL_ID = ch.channelId;
  API_KEY    = ch.apiKey;
  RESULTS    = 20;
  const label = document.getElementById('channelLabel');
  if (label) label.textContent = ch.name + '  ·  Channel ' + ch.channelId + '  ·  field1';
  ['channel-dropdown','avatar-dropdown'].forEach(function(id){ const e=document.getElementById(id); if(e) e.style.display='none'; });
  renderChannelList();
  updateIotChannelsList();
  fetchData();
  startAutoRefresh();
  saveChannelsToStorage();
  showToast('Switched to ' + ch.icon + ' ' + ch.name);
}

function deleteChannel(idx) {
  const name = channels[idx].name;
  channels.splice(idx, 1);
  if (activeChannelIdx === idx) {
    activeChannelIdx = -1;
    CHANNEL_ID = ''; API_KEY = '';
    const label = document.getElementById('channelLabel');
    if (label) label.textContent = 'No channel active — add a channel';
    if (channels.length > 0) switchChannel(0);
  } else if (activeChannelIdx > idx) {
    activeChannelIdx--;
  }
  renderChannelList();
  updateIotChannelsList();
  saveChannelsToStorage();
  showToast('Channel "' + name + '" removed');
}

function maybeAddCurrentAsChannel() {
  if (CHANNEL_ID && API_KEY && channels.length === 0) {
    channels.push({ id: Date.now(), name: 'My Channel', channelId: CHANNEL_ID, apiKey: API_KEY, icon: '🚆' });
    activeChannelIdx = 0;
    renderChannelList();
    updateIotChannelsList();
    saveChannelsToStorage();
  }
}

/* ══════════════════════════════════════
   AUTH & PERSISTENCE  (localStorage)
   Storage:
     rs_users   → { email: { name, passwordHash, channels[], results } }
     rs_session → { email, name }
══════════════════════════════════════ */

function hashPass(p) {
  var h = 0;
  for (var i = 0; i < p.length; i++) { h = Math.imul(31, h) + p.charCodeAt(i) | 0; }
  return 'h' + Math.abs(h).toString(36);
}

function getUsers()     { try { return JSON.parse(localStorage.getItem('rs_users') || '{}'); }  catch(e) { return {}; } }
function saveUsers(u)   { localStorage.setItem('rs_users', JSON.stringify(u)); }
function getSession()   { try { return JSON.parse(localStorage.getItem('rs_session') || 'null'); } catch(e) { return null; } }
function saveSession(s) { localStorage.setItem('rs_session', JSON.stringify(s)); }
function clearSession() { localStorage.removeItem('rs_session'); }

function saveChannelsToStorage() {
  const session = getSession();
  if (!session) return;
  const users = getUsers();
  const user = users[session.email];
  if (user) {
    user.channels = channels.map(ch => ({ ...ch })); // Deep copy
    saveUsers(users);
  }
}

function showLogin() {
  document.getElementById('registerModal').style.display = 'none';
  document.getElementById('loginModal').style.display    = 'flex';
}
function showRegister() {
  document.getElementById('loginModal').style.display    = 'none';
  document.getElementById('registerModal').style.display = 'flex';
}
function hideAuthModals() {
  document.getElementById('loginModal').style.display    = 'none';
  document.getElementById('registerModal').style.display = 'none';
}

function doLogin() {
  var email = document.getElementById('login-email').value.trim().toLowerCase();
  var pass  = document.getElementById('login-password').value;
  var errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  if (!email || !pass) { errEl.textContent = 'Please enter email and password.'; errEl.style.display = 'block'; return; }
  var users = getUsers();
  var user  = users[email];
  if (!user || user.passwordHash !== hashPass(pass)) {
    errEl.textContent = 'Incorrect email or password.'; errEl.style.display = 'block'; return;
  }
  saveSession({ email: email, name: user.name });
  hideAuthModals();
  onLoggedIn(email, user);
}

function doRegister() {
  var name    = document.getElementById('reg-name').value.trim();
  var email   = document.getElementById('reg-email').value.trim().toLowerCase();
  var pass    = document.getElementById('reg-password').value;
  var confirm = document.getElementById('reg-confirm').value;
  var errEl   = document.getElementById('reg-error');
  errEl.style.display = 'none';
  if (!name || !email || !pass) { errEl.textContent = 'All fields are required.'; errEl.style.display = 'block'; return; }
  if (pass.length < 6)  { errEl.textContent = 'Password must be at least 6 characters.'; errEl.style.display = 'block'; return; }
  if (pass !== confirm) { errEl.textContent = 'Passwords do not match.'; errEl.style.display = 'block'; return; }
  var users = getUsers();
  if (users[email]) { errEl.textContent = 'An account with this email already exists.'; errEl.style.display = 'block'; return; }
  users[email] = { name: name, passwordHash: hashPass(pass), channels: [], results: 20 };
  saveUsers(users);
  saveSession({ email: email, name: name });
  hideAuthModals();
  onLoggedIn(email, users[email]);
  showToast('Account created! Welcome, ' + name + ' \u2728');
}

function doSignOut() {
  clearSession();
  if (refreshTimer)   clearInterval(refreshTimer);
  if (countdownTimer) clearInterval(countdownTimer);
  CHANNEL_ID = ''; API_KEY = '';
  channels = []; activeChannelIdx = -1;
  renderChannelList();
  updateIotChannelsList();
  var ids = ['s-total','s-red','s-yellow','s-green'];
  ids.forEach(function(id) { var el = document.getElementById(id); if (el) el.textContent = '\u2013'; });
  var lbl = document.getElementById('channelLabel');
  if (lbl) lbl.textContent = 'Not connected';
  showLogin();
}

function onLoggedIn(email, user) {
  // Update topbar & sidebar with real name
  document.querySelectorAll('.tb-avatar').forEach(function(el) {
    el.textContent = user.name.charAt(0).toUpperCase();
  });
  document.querySelectorAll('.avatar-name').forEach(function(el) { el.textContent = user.name; });
  document.querySelectorAll('.avatar-role').forEach(function(el) { el.textContent = email; });
  // Also update sidebar bottom
  var sidebarName = document.querySelector('.avatar-info .avatar-name');
  var sidebarRole = document.querySelector('.avatar-info .avatar-role');
  if (sidebarName) sidebarName.textContent = user.name;
  if (sidebarRole) sidebarRole.textContent = 'Signal Operator';

  channels = (user.channels || []).map(function(ch) { return Object.assign({}, ch); });
  RESULTS  = user.results || 20;
  activeChannelIdx = -1;
  renderChannelList();
  updateIotChannelsList();

  if (channels.length > 0) {
    switchChannel(0);
  } else {
    showToast('Welcome ' + user.name + '! Go to IoT Channels to add your ThinkSpeak channel.');
  }
}

/* ══════════════════════════════════════
   PAGE INITIALIZATION
══════════════════════════════════════ */
window.addEventListener('load', function() {
  // Auto-restore session if user was previously logged in
  const session = getSession();
  if (session) {
    const users = getUsers();
    const user = users[session.email];
    if (user) {
      // User is still logged in - restore their session
      onLoggedIn(session.email, user);
      return;
    }
  }
  // No valid session - show login screen
  document.getElementById('loginModal').style.display = 'flex';
});