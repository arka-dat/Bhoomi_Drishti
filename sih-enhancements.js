/* =========================================================================
   BHOOMI DRISHTI — SIH showcase layer
   -------------------------------------------------------------------------
   Presentation-only enhancements. This layer does NOT claim to be a real ML
   model. It turns the deterministic prototype output into an explainable,
   demo-friendly decision-support experience until the backend model lands.
   ========================================================================= */
(function () {
  "use strict";

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

  function animateNumber(el, target, suffix = "", duration = 900) {
    if (!el || Number.isNaN(Number(target))) return;
    const end = Number(target);
    const start = 0;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(start + (end - start) * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function replayView(view) {
    if (!view) return;
    view.classList.remove("sih-replay");
    void view.offsetWidth;
    view.classList.add("sih-replay");
    setTimeout(() => view.classList.remove("sih-replay"), 1200);
  }

  function observeNavigation() {
    $$(".nav-item[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setTimeout(() => replayView($('.view[data-view="' + btn.dataset.view + '"]')), 20);
      });
    });
  }

  function animateKpis() {
    $$(".kpi-value").forEach((el, i) => {
      const raw = el.textContent.trim();
      const match = raw.match(/^([\d,]+)(.*)$/);
      if (!match) return;
      const target = Number(match[1].replace(/,/g, ""));
      const suffix = match[2] || "";
      setTimeout(() => animateNumber(el, target, suffix, 950), i * 90);
    });
    const hero = $("#hero-atrisk");
    if (hero) animateNumber(hero, Number(hero.textContent), "", 1100);
  }

  function addTopbarDemoButton() {
    const actions = $(".topbar-actions");
    if (!actions || $("#sih-demo-btn")) return;
    const btn = document.createElement("button");
    btn.id = "sih-demo-btn";
    btn.className = "sih-demo-btn";
    btn.innerHTML = '<span class="sih-pulse"></span><span>SIH Demo</span>';
    btn.title = "Run the 60-second showcase flow";
    actions.insertBefore(btn, actions.firstChild);
    btn.addEventListener("click", runDemo);
  }

  function addBriefingCard() {
    const overview = $('.view[data-view="overview"]');
    if (!overview || $("#ai-briefing")) return;
    const card = document.createElement("section");
    card.id = "ai-briefing";
    card.className = "ai-briefing card";
    card.innerHTML = `
      <div class="ai-orbit" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="ai-brief-copy">
        <div class="ai-kicker"><span class="ai-live-dot"></span> BHOOMI INTELLIGENCE ENGINE</div>
        <h3>From delayed response to early intervention.</h3>
        <p>The prototype converts parcel-level signals into an explainable risk signal, leading drivers and recommended actions — designed for an officer to act before delay becomes a crisis.</p>
      </div>
      <div class="ai-brief-stats">
        <div><strong>01</strong><span>Detect</span></div>
        <div><strong>02</strong><span>Explain</span></div>
        <div><strong>03</strong><span>Act</span></div>
      </div>`;
    const kpis = $("#kpi-grid");
    if (kpis) kpis.insertAdjacentElement("afterend", card);
  }

  function enhanceDrawer() {
    const body = $("#drawer-body");
    if (!body || $("#sih-drawer-ai", body)) return;
    const text = body.innerText || "";
    const riskMatch = text.match(/Risk score\s*\/\s*100\s*([\d]+)/i);
    const risk = riskMatch ? Number(riskMatch[1]) : 50;
    const confidence = Math.min(97, Math.max(74, Math.round(82 + (100 - Math.abs(50 - risk)) / 10)));
    const deadline = risk >= 76 ? "7 days" : risk >= 55 ? "14 days" : "30 days";
    const panel = document.createElement("div");
    panel.id = "sih-drawer-ai";
    panel.className = "sih-drawer-ai";
    panel.innerHTML = `
      <div class="ai-panel-head"><div><span class="ai-kicker"><span class="ai-live-dot"></span> EXPLAINABLE AI</span><h3>Intervention cockpit</h3></div><span class="confidence-badge">${confidence}% confidence</span></div>
      <div class="intervention-grid">
        <div><span>Intervention window</span><strong>${deadline}</strong><small>Recommended response horizon</small></div>
        <div><span>Risk trajectory</span><strong>${risk >= 76 ? "Escalating" : risk >= 55 ? "Watch closely" : "Stable"}</strong><small>Based on current parcel signals</small></div>
      </div>
      <div class="whatif">
        <div class="whatif-head"><div><span class="ai-kicker">WHAT-IF SIMULATOR</span><strong>Test an intervention</strong></div><span id="whatif-risk">${risk}/100</span></div>
        <label>Compensation disbursed <b id="whatif-comp-val">70%</b><input id="whatif-comp" type="range" min="0" max="100" value="70"></label>
        <label>Approval progress <b id="whatif-approval-val">70%</b><input id="whatif-approval" type="range" min="0" max="100" value="70"></label>
        <div class="whatif-result" id="whatif-result">Raise both signals and the estimated risk drops — use this to demonstrate proactive intervention planning.</div>
      </div>`;
    body.appendChild(panel);

    const comp = $("#whatif-comp", panel), approval = $("#whatif-approval", panel);
    const compVal = $("#whatif-comp-val", panel), approvalVal = $("#whatif-approval-val", panel);
    const riskEl = $("#whatif-risk", panel), result = $("#whatif-result", panel);
    const update = () => {
      const c = Number(comp.value), a = Number(approval.value);
      compVal.textContent = c + "%";
      approvalVal.textContent = a + "%";
      const reduction = Math.round(((c - 70) * 0.34) + ((a - 70) * 0.24));
      const scenario = Math.max(4, Math.min(98, risk - reduction));
      riskEl.textContent = scenario + "/100";
      riskEl.className = "whatif-score " + (scenario >= 76 ? "critical" : scenario >= 55 ? "high" : scenario >= 32 ? "moderate" : "low");
      result.textContent = scenario < risk
        ? `Scenario: risk improves by ${risk - scenario} points. Prioritise compensation + approval actions first.`
        : `Scenario: risk is unchanged or higher. Escalate the leading driver before the next review cycle.`;
    };
    comp.addEventListener("input", update);
    approval.addEventListener("input", update);
  }

  function observeDrawer() {
    const body = $("#drawer-body");
    if (!body) return;
    new MutationObserver(() => setTimeout(enhanceDrawer, 30)).observe(body, { childList: true });
  }

  function runDemo() {
    const sequence = ["overview", "projects", "map", "alerts", "reports"];
    const btn = $("#sih-demo-btn");
    if (btn) { btn.disabled = true; btn.classList.add("is-running"); }
    sequence.forEach((view, i) => {
      setTimeout(() => {
        const nav = $('.nav-item[data-view="' + view + '"]');
        if (nav) nav.click();
        replayView($('.view[data-view="' + view + '"]'));
        if (i === sequence.length - 1) {
          setTimeout(() => { if (btn) { btn.disabled = false; btn.classList.remove("is-running"); } }, 900);
        }
      }, i * 850);
    });
  }

  function boot() {
    addTopbarDemoButton();
    addBriefingCard();
    observeNavigation();
    observeDrawer();
    setTimeout(animateKpis, 180);
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
