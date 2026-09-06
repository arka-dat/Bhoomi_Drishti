/* =========================================================================
   BHOOMI DRISHTI — application shell
   -------------------------------------------------------------------------
   This file contains NO predictive model. Every risk score, delay
   probability, driver weight and recommendation below comes from
   `mockPredict()`, a deterministic placeholder that stands in for your
   team's ML service.

   TO PLUG IN THE REAL MODEL:
   1. Replace the body of `mockPredict(project)` with a call to your API,
      e.g.  const r = await fetch('/api/predict', {method:'POST', body:...})
   2. Keep the return shape identical:
         { riskScore, delayProbability, tier, drivers, actions, timeline }
   3. Everywhere this file calls `mockPredict`, make it `await`-able if your
      call becomes asynchronous (buildDataset already isolates the call).
   ========================================================================= */

(function () {
  "use strict";

  /* ----------------------------- seeded RNG ----------------------------- */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(20260906);
  const rand = (min, max) => min + rng() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const choice = (arr) => arr[randInt(0, arr.length - 1)];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const round = (v) => Math.round(v);

  /* ----------------------------- reference data -------------------------- */
  const STATE_DISTRICTS = {
    "Maharashtra": ["Pune", "Nagpur", "Nashik"],
    "Uttar Pradesh": ["Lucknow", "Varanasi", "Meerut"],
    "Gujarat": ["Surat", "Vadodara", "Rajkot"],
    "Tamil Nadu": ["Coimbatore", "Madurai", "Salem"],
    "West Bengal": ["Howrah", "Hooghly", "Nadia"],
    "Bihar": ["Patna", "Gaya", "Muzaffarpur"],
    "Rajasthan": ["Jaipur", "Jodhpur", "Udaipur"],
    "Karnataka": ["Bengaluru Rural", "Belagavi", "Mysuru"],
    "Odisha": ["Cuttack", "Khordha", "Sambalpur"],
    "Madhya Pradesh": ["Indore", "Bhopal", "Gwalior"]
  };
  const STATE_CODE = {
    "Maharashtra": "MH", "Uttar Pradesh": "UP", "Gujarat": "GJ", "Tamil Nadu": "TN",
    "West Bengal": "WB", "Bihar": "BR", "Rajasthan": "RJ", "Karnataka": "KA",
    "Odisha": "OD", "Madhya Pradesh": "MP"
  };
  const PROJECT_TYPES = [
    "National Highway", "Railway Corridor", "Irrigation Canal",
    "Power Transmission Line", "Industrial Corridor", "Urban Metro",
    "River Linking", "Port Connectivity Road"
  ];
  const RECOMMENDATION_MAP = {
    "Pending compensation disbursement": "Expedite pending compensation cases through the district disbursement cell; prioritise awards older than 60 days.",
    "Administrative approval backlog": "Escalate stalled approvals to the state-level single-window committee for time-bound clearance.",
    "Rehabilitation & resettlement delays": "Convene an R&R task force to fast-track resettlement site allotment for affected families.",
    "Legal disputes over land ownership": "Refer contested titles to fast-track land tribunals; pursue mediation where feasible before litigation.",
    "Incomplete documentation": "Deploy a documentation drive with revenue department support to close outstanding record gaps.",
    "Stakeholder non-responsiveness": "Schedule a joint stakeholder consultation to re-engage unresponsive parties and reset commitments."
  };
  const TIER_ORDER = ["Low", "Moderate", "High", "Critical"];
  const TIER_COLOR = { Low: "#4b7a5e", Moderate: "#a9821f", High: "#c17418", Critical: "#a63d2e" };

  function tierOf(score) {
    if (score >= 76) return "Critical";
    if (score >= 55) return "High";
    if (score >= 32) return "Moderate";
    return "Low";
  }

  /* ----------------------------- placeholder model ----------------------- */
  function mockPredict(p) {
    const compensationGap = 100 - p.compensationPct;
    const approvalGap = 100 - p.approvalPct;
    const rehabGap = 100 - p.rehabPct;
    const legalPenalty = clamp(p.legalDisputes * 18, 0, 54);
    const docPenalty = p.docsComplete ? 0 : 20;
    const stakeholderGap = 100 - p.stakeholderScore;

    const contributions = [
      { factor: "Pending compensation disbursement", val: 0.28 * compensationGap },
      { factor: "Administrative approval backlog", val: 0.20 * approvalGap },
      { factor: "Rehabilitation & resettlement delays", val: 0.16 * rehabGap },
      { factor: "Legal disputes over land ownership", val: 0.16 * (legalPenalty / 54 * 100) },
      { factor: "Incomplete documentation", val: 0.08 * (docPenalty / 20 * 100) },
      { factor: "Stakeholder non-responsiveness", val: 0.12 * stakeholderGap }
    ];

    const riskScoreRaw = contributions.reduce((s, c) => s + c.val, 0);
    const riskScore = clamp(round(riskScoreRaw), 0, 100);
    const delayProbability = clamp(round(riskScore * 0.92 + rand(-6, 6)), 2, 98);
    const tier = tierOf(riskScore);

    const totalVal = contributions.reduce((s, c) => s + c.val, 0) || 1;
    const drivers = contributions
      .map((c) => ({ factor: c.factor, weight: round((c.val / totalVal) * 100) }))
      .sort((a, b) => b.weight - a.weight);

    const actions = drivers.slice(0, 3).map((d) => RECOMMENDATION_MAP[d.factor]);

    const timeline = [
      { stage: "Notification & land survey", status: p.approvalPct >= 45 ? "Completed" : p.approvalPct >= 15 ? "InProgress" : "Pending" },
      { stage: "Compensation assessment", status: p.compensationPct >= 15 ? "Completed" : p.approvalPct >= 45 ? "InProgress" : "Pending" },
      { stage: "Compensation disbursement", status: p.compensationPct >= 90 ? "Completed" : p.compensationPct >= 15 ? (compensationGap > 60 ? "Delayed" : "InProgress") : "Pending" },
      { stage: "Possession handover", status: p.possessionStatus },
      { stage: "Rehabilitation & resettlement", status: p.rehabPct >= 90 ? "Completed" : p.rehabPct > 10 ? (rehabGap > 60 ? "Delayed" : "InProgress") : "Pending" }
    ];

    return { riskScore, delayProbability, tier, drivers, actions, timeline };
  }

  /* ----------------------------- dataset build --------------------------- */
  function buildDataset() {
    const projects = [];
    let seq = {};
    Object.keys(STATE_DISTRICTS).forEach((state) => {
      STATE_DISTRICTS[state].forEach((district) => {
        const count = randInt(2, 3);
        for (let i = 0; i < count; i++) {
          const type = choice(PROJECT_TYPES);
          const code = STATE_CODE[state] + "-" + district.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "");
          seq[code] = (seq[code] || 0) + 1;
          const id = code + "-" + String(seq[code]).padStart(3, "0");

          const base = {
            id, state, district, type,
            name: `${type} — ${district} Segment ${seq[code]}`,
            areaHa: round(rand(8, 420)),
            families: randInt(6, 940),
            compensationPct: round(rand(5, 100)),
            approvalPct: round(rand(10, 100)),
            legalDisputes: randInt(0, 3),
            docsComplete: rng() > 0.35,
            rehabPct: round(rand(0, 100)),
            stakeholderScore: round(rand(20, 95)),
            historicalPerformance: round(rand(30, 95)),
            possessionStatus: choice(["Completed", "InProgress", "Pending", "Delayed"]),
            lastUpdated: recentDate(randInt(1, 30))
          };
          const pred = mockPredict(base);
          projects.push(Object.assign(base, pred));
        }
      });
    });
    return projects;
  }

  function recentDate(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  function buildTrend(projects) {
    const currentAvg = avg(projects.map((p) => p.delayProbability));
    const months = [];
    const now = new Date();
    let v = clamp(currentAvg - rand(6, 14), 15, 60);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ label: d.toLocaleDateString("en-IN", { month: "short" }), value: v });
      v = clamp(v + rand(-2.5, 3.4), 10, 92);
    }
    months[months.length - 1].value = currentAvg;
    return months;
  }

  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  /* ============================== STATE =================================== */
  const DATA = buildDataset();
  const TREND = buildTrend(DATA);
  const ALERTS = buildAlerts(DATA);
  const AUDIT = [
    { time: recentDate(6), role: "System", action: "Dataset loaded", detail: `${DATA.length} projects across ${Object.keys(STATE_DISTRICTS).length} states` },
    { time: recentDate(6), role: "System", action: "Platform initialised", detail: "UI shell v0.3, prediction engine pending integration" }
  ];

  const ui = {
    currentRole: "Administrator",
    query: "",
    filterState: "",
    filterTier: "",
    filterType: "",
    filterDistrict: "",
    alertSeverity: "",
    sortKey: "riskScore",
    sortDir: "desc"
  };

  function buildAlerts(projects) {
    const list = [];
    let n = 0;
    projects.forEach((p) => {
      const qualifies = p.tier === "Critical" || p.tier === "High" || (p.tier === "Moderate" && p.legalDisputes >= 2);
      if (!qualifies) return;
      n++;
      const topDriver = p.drivers[0];
      list.push({
        alertId: "AL-" + String(n).padStart(3, "0"),
        projectId: p.id,
        projectName: p.name,
        state: p.state,
        district: p.district,
        severity: p.tier === "Moderate" ? "Moderate" : p.tier,
        message: `${topDriver.factor} is the leading factor (${topDriver.weight}% of predicted risk).`,
        time: recentDate(randInt(0, 14)),
        acknowledged: rng() > 0.85
      });
    });
    return list.sort((a, b) => (a.severity === b.severity ? 0 : TIER_ORDER.indexOf(b.severity) - TIER_ORDER.indexOf(a.severity)));
  }

  function logAudit(action, detail) {
    AUDIT.unshift({ time: new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }), role: ui.currentRole, action, detail });
    renderAudit();
  }

  /* ============================== SVG CHARTS =============================== */
  function svgLine(months) {
    const w = 640, h = 220, padL = 34, padR = 14, padT = 16, padB = 26;
    const vals = months.map((m) => m.value);
    const max = Math.max(...vals, 10) * 1.15;
    const min = 0;
    const xw = w - padL - padR, yh = h - padT - padB;
    const x = (i) => padL + (i / (months.length - 1)) * xw;
    const y = (v) => padT + yh - ((v - min) / (max - min)) * yh;

    let grid = "";
    for (let g = 0; g <= 4; g++) {
      const gy = padT + (yh / 4) * g;
      const val = Math.round(max - (max / 4) * g);
      grid += `<line x1="${padL}" y1="${gy}" x2="${w - padR}" y2="${gy}" stroke="var(--line)" stroke-width="1"/>`;
      grid += `<text x="${padL - 8}" y="${gy + 3}" text-anchor="end" class="axis-label">${val}</text>`;
    }
    let path = "", area = `M ${x(0)} ${y(0)} `;
    months.forEach((m, i) => {
      path += (i === 0 ? "M " : "L ") + x(i) + " " + y(m.value) + " ";
      area += "L " + x(i) + " " + y(m.value) + " ";
    });
    area += `L ${x(months.length - 1)} ${padT + yh} L ${x(0)} ${padT + yh} Z`;

    let dots = "", labels = "";
    months.forEach((m, i) => {
      dots += `<circle cx="${x(i)}" cy="${y(m.value)}" r="2.6" fill="var(--ink-700)"/>`;
      if (i % 2 === 0 || i === months.length - 1) labels += `<text x="${x(i)}" y="${h - 6}" text-anchor="middle" class="axis-label">${m.label}</text>`;
    });

    return `<svg viewBox="0 0 ${w} ${h}">
      ${grid}
      <path d="${area}" fill="var(--ink-700)" opacity="0.07"/>
      <path d="${path}" fill="none" stroke="var(--ink-700)" stroke-width="2"/>
      ${dots}${labels}
    </svg>`;
  }

  function svgHBar(items) {
    const w = 640, rowH = 34, padL = 210, padR = 60, top = 6;
    const h = items.length * rowH + top + 6;
    const max = Math.max(...items.map((d) => d.value), 1);
    let rows = "";
    items.forEach((d, i) => {
      const y = top + i * rowH;
      const barW = ((w - padL - padR) * d.value) / max;
      const color = d.color || "var(--ink-700)";
      rows += `
        <text x="${padL - 12}" y="${y + rowH / 2 + 4}" text-anchor="end" class="bar-label">${d.label}</text>
        <rect x="${padL}" y="${y + 7}" width="${w - padL - padR}" height="12" rx="2" fill="var(--paper-2)"/>
        <rect x="${padL}" y="${y + 7}" width="${barW}" height="12" rx="2" fill="${color}"/>
        <text x="${padL + barW + 8}" y="${y + rowH / 2 + 4}" class="bar-value">${d.value}%</text>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}">${rows}</svg>`;
  }

  function svgVBar(items) {
    const w = 640, h = 240, padL = 34, padR = 10, padT = 14, padB = 44;
    const bw = (w - padL - padR) / items.length;
    const max = Math.max(...items.map((d) => d.value), 10) * 1.15;
    const yh = h - padT - padB;
    let grid = "";
    for (let g = 0; g <= 3; g++) {
      const gy = padT + (yh / 3) * g;
      grid += `<line x1="${padL}" y1="${gy}" x2="${w - padR}" y2="${gy}" stroke="var(--line)" stroke-width="1"/>`;
    }
    let bars = "";
    items.forEach((d, i) => {
      const bh = (d.value / max) * yh;
      const x = padL + i * bw + bw * 0.2;
      const barW = bw * 0.6;
      const y = padT + yh - bh;
      bars += `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="2" fill="${d.color || 'var(--ink-700)'}"/>
        <text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle" class="bar-value">${Math.round(d.value)}</text>
        <text x="${x + barW / 2}" y="${h - padB + 16}" text-anchor="middle" class="axis-label">${d.label}</text>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}">${grid}${bars}</svg>`;
  }

  function svgDonut(items) {
    const size = 240, r = 78, cx = 120, cy = 120, stroke = 30;
    const total = items.reduce((s, d) => s + d.value, 0) || 1;
    const circ = 2 * Math.PI * r;
    let offset = 0, arcs = "";
    items.forEach((d) => {
      const frac = d.value / total;
      const len = frac * circ;
      arcs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${d.color}" stroke-width="${stroke}"
        stroke-dasharray="${len} ${circ - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
      offset += len;
    });
    let legend = items.map((d) => `<div style="display:flex;align-items:center;gap:7px;font-size:12px;color:var(--text-600);margin-top:6px;">
      <span style="width:10px;height:10px;border-radius:2px;background:${d.color};display:inline-block;"></span>${d.label} — ${d.value}</div>`).join("");
    return `<div style="display:flex;align-items:center;gap:26px;flex-wrap:wrap;">
      <svg viewBox="0 0 ${size} ${size}" style="width:200px;height:200px;flex-shrink:0;">${arcs}</svg>
      <div>${legend}</div>
    </div>`;
  }

  function svgGauge(value, label, color) {
    const w = 160, h = 100, r = 62, cx = 80, cy = 90;
    const circ = Math.PI * r;
    const len = (clamp(value, 0, 100) / 100) * circ;
    return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;max-width:180px;">
      <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="var(--paper-2)" stroke-width="12" stroke-linecap="round"/>
      <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"
        stroke-dasharray="${len} ${circ - len}"/>
      <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-family="var(--font-display)" font-size="24" font-weight="600" fill="var(--ink-900)">${value}</text>
    </svg><div class="gauge-label">${label}</div>`;
  }

  /* ============================== FILTERING ================================ */
  function getFilteredProjects() {
    return DATA.filter((p) => {
      if (ui.filterState && p.state !== ui.filterState) return false;
      if (ui.filterDistrict && p.district !== ui.filterDistrict) return false;
      if (ui.filterTier && p.tier !== ui.filterTier) return false;
      if (ui.filterType && p.type !== ui.filterType) return false;
      if (ui.query) {
        const q = ui.query.toLowerCase();
        if (!(p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.district.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }

  function sortProjects(list) {
    const { sortKey, sortDir } = ui;
    const dir = sortDir === "asc" ? 1 : -1;
    return list.slice().sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
  }

  /* ============================== RENDERERS ================================ */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $all = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function renderRuler() {
    const g = $("#ruler-ticks");
    let s = "";
    for (let x = 0; x <= 1000; x += 20) {
      const major = x % 100 === 0;
      s += `<line x1="${x}" y1="${major ? 14 : 22}" x2="${x}" y2="30" stroke="currentColor" stroke-width="${major ? 1 : 0.6}" opacity="${major ? 0.55 : 0.25}"/>`;
      if (major) s += `<text x="${x + 3}" y="12" font-family="var(--font-mono)" font-size="8" fill="currentColor" opacity="0.55">${x}</text>`;
    }
    g.innerHTML = s;
    $("#asof-date").textContent = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  }

  function renderKPIs() {
    const total = DATA.length;
    const highCritical = DATA.filter((p) => p.tier === "High" || p.tier === "Critical").length;
    const avgDelay = round(avg(DATA.map((p) => p.delayProbability)));
    const openAlerts = ALERTS.filter((a) => !a.acknowledged).length;
    const trendDelta = round(TREND[TREND.length - 1].value - TREND[TREND.length - 2].value);

    $("#hero-atrisk").textContent = highCritical;
    const items = [
      { label: "Total projects tracked", value: total, delta: null },
      { label: "High + critical risk", value: highCritical, delta: `${round((highCritical / total) * 100)}% of portfolio` },
      { label: "Avg. delay probability", value: avgDelay + "%", delta: (trendDelta >= 0 ? "▲ " : "▼ ") + Math.abs(trendDelta) + " pts vs last month", cls: trendDelta >= 0 ? "up" : "down" },
      { label: "Open alerts", value: openAlerts, delta: `of ${ALERTS.length} total raised` }
    ];
    $("#kpi-grid").innerHTML = items.map((k) => `
      <div class="kpi">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value">${k.value}</div>
        ${k.delta ? `<div class="kpi-delta ${k.cls || ''}">${k.delta}</div>` : ""}
      </div>`).join("");
  }

  function renderOverviewCharts() {
    $("#trend-chart").innerHTML = svgLine(TREND);
    const driverAgg = computeAggregates(DATA).slice(0, 6);
    $("#driver-chart").innerHTML = svgHBar(driverAgg.map((d) => ({ label: d.factor, value: d.pct })));
  }

  function computeAggregates(projects) {
    const totals = {}, counts = {};
    projects.forEach((p) => {
      p.drivers.forEach((d, idx) => {
        totals[d.factor] = (totals[d.factor] || 0) + d.weight;
        if (idx < 2) counts[d.factor] = (counts[d.factor] || 0) + 1;
      });
    });
    const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
    return Object.keys(totals)
      .map((f) => ({ factor: f, pct: round((totals[f] / sum) * 100), count: counts[f] || 0 }))
      .sort((a, b) => b.pct - a.pct);
  }

  function renderStateTable() {
    const states = Object.keys(STATE_DISTRICTS).map((state) => {
      const list = DATA.filter((p) => p.state === state);
      const riskAvg = round(avg(list.map((p) => p.riskScore)));
      const hc = list.filter((p) => p.tier === "High" || p.tier === "Critical").length;
      return { state, count: list.length, riskAvg, hc };
    }).sort((a, b) => b.riskAvg - a.riskAvg);

    $("#state-table tbody").innerHTML = states.map((s, i) => `
      <tr data-state="${s.state}">
        <td>${s.state}</td>
        <td class="mono">${s.count}</td>
        <td class="mono">${s.riskAvg}</td>
        <td class="mono">${s.hc}</td>
        <td class="trend-arrow ${i % 3 === 0 ? "up" : i % 3 === 1 ? "down" : "flat"}">${i % 3 === 0 ? "▲ rising" : i % 3 === 1 ? "▼ easing" : "— stable"}</td>
      </tr>`).join("");

    $all("#state-table tbody tr").forEach((tr) => tr.addEventListener("click", () => {
      ui.filterState = tr.dataset.state; ui.filterDistrict = "";
      $("#filter-state").value = ui.filterState;
      switchView("projects"); renderProjectsView();
    }));
  }

  function renderProjectsFilters() {
    const stateSel = $("#filter-state"), typeSel = $("#filter-type");
    if (!stateSel.dataset.filled) {
      Object.keys(STATE_DISTRICTS).forEach((s) => stateSel.insertAdjacentHTML("beforeend", `<option value="${s}">${s}</option>`));
      PROJECT_TYPES.forEach((t) => typeSel.insertAdjacentHTML("beforeend", `<option value="${t}">${t}</option>`));
      stateSel.dataset.filled = "1";
    }
  }

  function renderProjectsTable() {
    const filtered = sortProjects(getFilteredProjects());
    $("#filter-count").textContent = `${filtered.length} of ${DATA.length} projects`;
    $("#projects-tbody").innerHTML = filtered.map((p) => `
      <tr data-id="${p.id}">
        <td class="mono">${p.id}</td>
        <td>${p.name}</td>
        <td>${p.state}</td>
        <td>${p.district}</td>
        <td>${p.type}</td>
        <td class="mono">${p.areaHa}</td>
        <td class="mono">${p.families}</td>
        <td class="mono">${p.compensationPct}%</td>
        <td class="mono">${p.riskScore}</td>
        <td class="mono">${p.delayProbability}%</td>
        <td><span class="tier-pill ${p.tier}">${p.tier}</span></td>
      </tr>`).join("");

    $all("#projects-tbody tr").forEach((tr) => tr.addEventListener("click", () => openDrawer(tr.dataset.id)));

    $all("#projects-table th[data-key]").forEach((th) => {
      th.textContent = th.textContent.replace(" ▲", "").replace(" ▼", "");
      if (th.dataset.key === ui.sortKey) th.textContent += ui.sortDir === "asc" ? " ▲" : " ▼";
    });
  }

  function renderProjectsView() {
    $("#filter-state").value = ui.filterState;
    $("#filter-tier").value = ui.filterTier;
    $("#filter-type").value = ui.filterType;
    renderProjectsTable();
  }

  function renderDistrictGrid() {
    const districts = [];
    Object.keys(STATE_DISTRICTS).forEach((state) => {
      STATE_DISTRICTS[state].forEach((district) => {
        const list = DATA.filter((p) => p.state === state && p.district === district);
        const riskAvg = round(avg(list.map((p) => p.riskScore)));
        districts.push({ state, district, riskAvg, tier: tierOf(riskAvg) });
      });
    });
    $("#district-grid").innerHTML = districts.map((d) => `
      <div class="district-tile ${d.tier}" data-state="${d.state}" data-district="${d.district}">
        <div>
          <div class="d-name">${d.district}</div>
          <div class="d-state">${d.state}</div>
        </div>
        <div class="d-score">${d.riskAvg}</div>
      </div>`).join("");
    $all(".district-tile").forEach((tile) => tile.addEventListener("click", () => {
      ui.filterState = tile.dataset.state; ui.filterDistrict = tile.dataset.district;
      ui.filterTier = ""; ui.filterType = "";
      switchView("projects"); renderProjectsView();
      logAudit("Filtered by district", `${tile.dataset.district}, ${tile.dataset.state} — from Risk Map`);
    }));
  }

  function renderAlerts() {
    const list = ALERTS.filter((a) => !ui.alertSeverity || a.severity === ui.alertSeverity);
    $("#alert-list").innerHTML = list.map((a) => `
      <div class="alert-card ${a.severity} ${a.acknowledged ? "is-ack" : ""}" data-alert="${a.alertId}">
        <div class="alert-main">
          <div class="alert-top">
            <span class="tier-pill ${a.severity}">${a.severity}</span>
            <span class="mono" style="font-size:12px;">${a.projectId}</span>
          </div>
          <div class="alert-msg">${a.projectName} — ${a.message}</div>
          <div class="alert-meta">${a.district}, ${a.state} · raised ${a.time}${a.acknowledged ? " · acknowledged" : ""}</div>
        </div>
        <div class="alert-actions">
          <button class="link-btn" data-view-project="${a.projectId}">View project</button>
          ${a.acknowledged ? "" : `<button class="btn-ghost" data-ack="${a.alertId}">Acknowledge</button>`}
        </div>
      </div>`).join("") || `<div class="card"><p class="card-sub">No alerts match this filter.</p></div>`;

    $all("[data-ack]").forEach((btn) => btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const a = ALERTS.find((x) => x.alertId === btn.dataset.ack);
      a.acknowledged = true;
      logAudit("Acknowledged alert", `${a.alertId} — ${a.projectName}`);
      renderAlerts(); renderNavBadge(); renderKPIs();
    }));
    $all("[data-view-project]").forEach((btn) => btn.addEventListener("click", (e) => {
      e.stopPropagation(); openDrawer(btn.dataset.viewProject);
    }));
  }

  function renderNavBadge() {
    const open = ALERTS.filter((a) => !a.acknowledged).length;
    const badge = $("#alert-badge");
    badge.textContent = open;
    badge.dataset.zero = open === 0 ? "true" : "false";
    $("#bell-dot").classList.toggle("show", open > 0);
  }

  function renderReports() {
    const byState = Object.keys(STATE_DISTRICTS).map((s) => {
      const list = DATA.filter((p) => p.state === s);
      return { label: STATE_CODE[s], value: round(avg(list.map((p) => p.delayProbability))) };
    }).sort((a, b) => b.value - a.value);
    $("#state-bar-chart").innerHTML = svgVBar(byState);

    const tierCounts = TIER_ORDER.map((t) => ({ label: t, value: DATA.filter((p) => p.tier === t).length, color: TIER_COLOR[t] }));
    $("#tier-donut-chart").innerHTML = svgDonut(tierCounts);

    const drivers = computeAggregates(DATA);
    $("#driver-table tbody").innerHTML = drivers.map((d) => `
      <tr><td>${d.factor}</td><td class="mono">${d.pct}%</td><td class="mono">${d.count}</td></tr>`).join("");
  }

  function renderAudit() {
    $("#audit-table tbody").innerHTML = AUDIT.map((a) => `
      <tr><td class="mono">${a.time}</td><td>${a.role}</td><td>${a.action}</td><td>${a.detail}</td></tr>`).join("");
  }

  /* ============================== DRAWER ================================ */
  function openDrawer(id) {
    const p = DATA.find((x) => x.id === id);
    if (!p) return;
    $("#drawer-id").textContent = p.id + " · " + p.state + " / " + p.district;
    $("#drawer-name").textContent = p.name;
    $("#drawer-body").innerHTML = `
      <div class="gauge-row">
        ${svgGauge(p.riskScore, "Risk score / 100", TIER_COLOR[p.tier])}
        ${svgGauge(p.delayProbability, "Delay probability %", "var(--ink-700)")}
      </div>
      <div>
        <div class="d-section-title">Project details</div>
        <dl class="info-grid">
          <div><dt>Type</dt><dd>${p.type}</dd></div>
          <div><dt>Risk tier</dt><dd><span class="tier-pill ${p.tier}">${p.tier}</span></dd></div>
          <div><dt>Land area</dt><dd>${p.areaHa} ha</dd></div>
          <div><dt>Affected families</dt><dd>${p.families}</dd></div>
          <div><dt>Compensation disbursed</dt><dd>${p.compensationPct}%</dd></div>
          <div><dt>Approval progress</dt><dd>${p.approvalPct}%</dd></div>
          <div><dt>Rehabilitation progress</dt><dd>${p.rehabPct}%</dd></div>
          <div><dt>Open legal disputes</dt><dd>${p.legalDisputes}</dd></div>
          <div><dt>Documentation</dt><dd>${p.docsComplete ? "Complete" : "Incomplete"}</dd></div>
          <div><dt>Last updated</dt><dd>${p.lastUpdated}</dd></div>
        </dl>
      </div>
      <div>
        <div class="d-section-title">Key delay drivers</div>
        ${p.drivers.slice(0, 4).map((d) => `
          <div class="driver-row">
            <div class="driver-row-top"><span>${d.factor}</span><span class="mono">${d.weight}%</span></div>
            <div class="driver-bar-bg"><div class="driver-bar-fill" style="width:${d.weight}%"></div></div>
          </div>`).join("")}
      </div>
      <div>
        <div class="d-section-title">Recommended actions</div>
        <ul class="action-list">${p.actions.map((a) => `<li>${a}</li>`).join("")}</ul>
      </div>
      <div>
        <div class="d-section-title">Acquisition timeline</div>
        <div class="timeline">
          ${p.timeline.map((t) => `
            <div class="tl-step">
              <div class="tl-dot ${t.status}"></div>
              <div><div class="tl-stage">${t.stage}</div><div class="tl-status">${t.status.replace("InProgress", "In progress")}</div></div>
            </div>`).join("")}
        </div>
      </div>
      <div class="mock-note">Risk score, drivers and recommendations shown here are placeholder output from <code>mockPredict()</code> in app.js — connect your team's model to replace them.</div>
    `;
    $("#drawer").classList.add("is-open");
    $("#drawer-backdrop").classList.add("is-open");
  }
  function closeDrawer() {
    $("#drawer").classList.remove("is-open");
    $("#drawer-backdrop").classList.remove("is-open");
  }

  /* ============================== NAV / VIEWS ============================ */
  const VIEW_TITLES = { overview: "Overview", projects: "Project register", map: "Risk map", alerts: "Alerts", reports: "Reports", audit: "Audit log" };

  function switchView(view) {
    $all(".view").forEach((v) => v.classList.toggle("is-active", v.dataset.view === view));
    $all(".nav-item").forEach((n) => n.classList.toggle("is-active", n.dataset.view === view));
    $("#view-title").textContent = VIEW_TITLES[view] || "Overview";
    $("#sidebar").classList.remove("is-open");
  }

  /* ============================== ROLE-BASED UI =========================== */
  function applyRole(role) {
    ui.currentRole = role;
    const isAuditor = role === "Auditor";
    const isPM = role === "Project Manager";
    $all("[data-ack]").forEach((b) => (b.disabled = isAuditor));
    $("#export-csv").style.opacity = isPM ? "0.5" : "1";
    $("#export-csv").disabled = isPM;
    $("#export-csv").title = isPM ? "Export is limited to Administrator and Auditor roles" : "";
  }

  /* ============================== CSV EXPORT ============================== */
  function exportCSV() {
    const rows = getFilteredProjects();
    const headers = ["id", "name", "state", "district", "type", "areaHa", "families", "compensationPct", "approvalPct", "rehabPct", "legalDisputes", "docsComplete", "possessionStatus", "riskScore", "delayProbability", "tier", "lastUpdated"];
    const csv = [headers.join(",")].concat(
      rows.map((p) => headers.map((h) => `"${String(p[h]).replace(/"/g, '""')}"`).join(","))
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "bhoomi-drishti-register.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    logAudit("Exported CSV", `${rows.length} project records`);
  }

  /* ============================== INIT / EVENTS ============================ */
  function init() {
    renderRuler();
    renderKPIs();
    renderOverviewCharts();
    renderStateTable();
    renderProjectsFilters();
    renderProjectsView();
    renderDistrictGrid();
    renderAlerts();
    renderNavBadge();
    renderReports();
    renderAudit();

    $all(".nav-item[data-view]").forEach((btn) => btn.addEventListener("click", () => switchView(btn.dataset.view)));
    $("#hamburger").addEventListener("click", () => $("#sidebar").classList.toggle("is-open"));

    $("#global-search").addEventListener("input", (e) => {
      ui.query = e.target.value.trim();
      if (ui.query) switchView("projects");
      renderProjectsTable();
    });

    $("#filter-state").addEventListener("change", (e) => { ui.filterState = e.target.value; ui.filterDistrict = ""; renderProjectsTable(); });
    $("#filter-tier").addEventListener("change", (e) => { ui.filterTier = e.target.value; renderProjectsTable(); });
    $("#filter-type").addEventListener("change", (e) => { ui.filterType = e.target.value; renderProjectsTable(); });
    $("#filter-reset").addEventListener("click", () => {
      ui.filterState = ""; ui.filterTier = ""; ui.filterType = ""; ui.filterDistrict = ""; ui.query = "";
      $("#global-search").value = "";
      renderProjectsView();
    });

    $all("#projects-table th[data-key]").forEach((th) => th.addEventListener("click", () => {
      if (ui.sortKey === th.dataset.key) ui.sortDir = ui.sortDir === "asc" ? "desc" : "asc";
      else { ui.sortKey = th.dataset.key; ui.sortDir = "desc"; }
      renderProjectsTable();
    }));

    $("#drawer-close").addEventListener("click", closeDrawer);
    $("#drawer-backdrop").addEventListener("click", closeDrawer);

    $all("#alert-chip-row .chip").forEach((chip) => chip.addEventListener("click", () => {
      $all("#alert-chip-row .chip").forEach((c) => c.classList.remove("is-active"));
      chip.classList.add("is-active");
      ui.alertSeverity = chip.dataset.sev;
      renderAlerts();
    }));
    $("#bell-btn").addEventListener("click", () => switchView("alerts"));

    $("#role-select").addEventListener("change", (e) => {
      applyRole(e.target.value);
      logAudit("Switched role", `Now viewing as ${e.target.value}`);
    });
    applyRole(ui.currentRole);

    $("#export-csv").addEventListener("click", exportCSV);

    switchView("overview");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
