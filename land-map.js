/* BHOOMI DRISHTI — Interactive land acquisition map
   Map source of truth:
   - Project rows rendered by app.js (#projects-tbody), so district/state/risk data
     are never duplicated here.
   - Optional surveyed geometry can be supplied as ./surveyed-geometry.geojson.
     Each Feature should expose properties.district (and optionally state).
   - If surveyed geometry is absent, the map falls back to district centroids.
*/
(function () {
  "use strict";

  const DISTRICT_CENTROIDS = {
    "Howrah": [22.5958, 88.2636], "Paschim Bardhaman": [23.5204, 87.3119],
    "Ahmedabad": [23.0225, 72.5714], "Patna": [25.5941, 85.1376],
    "Bengaluru Rural": [13.1986, 77.7066], "Amritsar": [31.6340, 74.8723],
    "Nagpur": [21.1458, 79.0882], "Kanchipuram": [12.8342, 79.7036],
    "Pune": [18.5204, 73.8567], "Nashik": [19.9975, 73.7898],
    "Lucknow": [26.8467, 80.9462], "Varanasi": [25.3176, 82.9739], "Meerut": [28.9845, 77.7064],
    "Surat": [21.1702, 72.8311], "Vadodara": [22.3072, 73.1812], "Rajkot": [22.3039, 70.8022],
    "Coimbatore": [11.0168, 76.9558], "Madurai": [9.9252, 78.1198], "Salem": [11.6643, 78.1460],
    "Hooghly": [22.9000, 88.4000], "Nadia": [23.4700, 88.5600],
    "Gaya": [24.7955, 84.9994], "Muzaffarpur": [26.1209, 85.3647],
    "Jaipur": [26.9124, 75.7873], "Jodhpur": [26.2389, 73.0243], "Udaipur": [24.5854, 73.7125],
    "Belagavi": [15.8497, 74.4977], "Mysuru": [12.2958, 76.6394],
    "Cuttack": [20.4625, 85.8830], "Khordha": [20.1820, 85.6160], "Sambalpur": [21.4669, 83.9812],
    "Indore": [22.7196, 75.8577], "Bhopal": [23.2599, 77.4126], "Gwalior": [26.2183, 78.1828]
  };

  function riskClass(risk) { return risk >= 76 ? "critical" : risk >= 55 ? "high" : risk >= 32 ? "moderate" : "low"; }
  function riskColor(risk) { return risk >= 76 ? "#ef4444" : risk >= 55 ? "#f59e0b" : risk >= 32 ? "#3b82f6" : "#22c55e"; }
  function esc(value) { return String(value).replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c])); }

  function loadLeaflet(done) {
    if (window.L) return done();
    if (!document.querySelector('link[data-bhoomi-leaflet]')) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      css.crossOrigin = "";
      css.dataset.bhoomiLeaflet = "true";
      document.head.appendChild(css);
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.crossOrigin = "";
    script.onload = done;
    script.onerror = () => console.warn("Bhoomi Drishti: Leaflet could not be loaded.");
    document.head.appendChild(script);
  }

  function addStyles() {
    if (document.getElementById("bhoomi-land-map-styles")) return;
    const style = document.createElement("style");
    style.id = "bhoomi-land-map-styles";
    style.textContent = `
      .bhoomi-map-shell{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:16px;margin-top:14px}
      .bhoomi-map-wrap{position:relative;min-width:0;border-radius:18px;overflow:hidden;border:1px solid rgba(15,23,42,.12);background:#e8edf3;box-shadow:inset 0 0 40px rgba(15,23,42,.08)}
      #bhoomi-leaflet-map{height:610px;width:100%;z-index:1}
      .bhoomi-map-controls{position:absolute;z-index:900;top:14px;left:14px;right:14px;display:flex;gap:8px;pointer-events:none}
      .bhoomi-map-controls>*{pointer-events:auto;background:rgba(255,255,255,.94);backdrop-filter:blur(12px);border:1px solid rgba(15,23,42,.12);border-radius:11px;padding:10px 12px;box-shadow:0 8px 24px rgba(15,23,42,.12);outline:none}
      .bhoomi-map-controls input{flex:1;min-width:180px}.bhoomi-map-controls select{min-width:145px}
      .bhoomi-map-legend{position:absolute;z-index:900;left:14px;bottom:14px;background:rgba(255,255,255,.92);backdrop-filter:blur(12px);border-radius:12px;padding:9px 11px;box-shadow:0 8px 24px rgba(15,23,42,.12);font-size:11px;display:flex;gap:10px;flex-wrap:wrap}
      .bhoomi-map-legend span{display:flex;align-items:center;gap:5px}.bhoomi-map-legend i{width:8px;height:8px;border-radius:50%}.bhoomi-map-legend .survey{width:11px;height:11px;border-radius:2px;background:transparent;border:2px solid #111827}
      .bhoomi-map-side{padding:14px;border:1px solid rgba(15,23,42,.1);border-radius:18px;background:rgba(255,255,255,.52);backdrop-filter:blur(14px);min-height:610px}
      .bhoomi-map-side h4{margin:0 0 4px}.bhoomi-map-side p{font-size:12px;opacity:.65;margin:0 0 12px}.bhoomi-map-stats{font-size:11px;opacity:.65;margin-bottom:10px}
      .bhoomi-map-list{display:flex;flex-direction:column;gap:7px;max-height:520px;overflow:auto;padding-right:3px}
      .bhoomi-map-item{display:flex;align-items:center;gap:9px;width:100%;text-align:left;border:1px solid rgba(15,23,42,.08);background:rgba(255,255,255,.64);padding:10px;border-radius:11px;cursor:pointer;transition:.2s}
      .bhoomi-map-item:hover,.bhoomi-map-item.is-selected{transform:translateY(-1px);background:#fff;box-shadow:0 7px 18px rgba(15,23,42,.1)}
      .bhoomi-map-item strong,.bhoomi-map-item small{display:block}.bhoomi-map-item small{font-size:10px;opacity:.62;margin-top:2px}.bhoomi-map-dot{width:9px;height:9px;border-radius:50%;flex:none}
      .bhoomi-map-popup{font:13px/1.5 Arial,sans-serif;min-width:205px}.bhoomi-map-popup strong{font-size:14px}.bhoomi-map-popup hr{border:0;border-top:1px solid #ddd;margin:7px 0}.bhoomi-map-popup .risk{font-weight:700}
      .bhoomi-survey-badge{display:inline-block;margin-top:7px;padding:3px 6px;border-radius:6px;background:#eef2ff;color:#1e293b;font-size:10px}
      @media(max-width:1050px){.bhoomi-map-shell{grid-template-columns:1fr}.bhoomi-map-side{min-height:0}.bhoomi-map-list{max-height:220px}#bhoomi-leaflet-map{height:520px}}
      @media(max-width:620px){.bhoomi-map-controls{position:static;display:flex;flex-wrap:wrap;padding:10px;background:rgba(255,255,255,.85)}.bhoomi-map-controls input{min-width:100%}#bhoomi-leaflet-map{height:440px}}
    `;
    document.head.appendChild(style);
  }

  // Read the exact project/district values rendered by app.js. This removes the
  // old duplicated marker table and keeps the map aligned with the register.
  function readProjectRegister() {
    return Array.from(document.querySelectorAll("#projects-tbody tr")).map((tr) => {
      const cells = tr.querySelectorAll("td");
      if (cells.length < 11) return null;
      const text = (i) => cells[i].textContent.trim();
      const risk = Number(text(8)) || 0;
      const delay = Number(text(9).replace(/[^0-9.-]/g, "")) || 0;
      return {
        id: text(0), name: text(1), state: text(2), district: text(3), type: text(4),
        areaHa: Number(text(5)) || 0, families: Number(text(6)) || 0,
        compensationPct: Number(text(7).replace(/[^0-9.-]/g, "")) || 0,
        risk, delay, tier: text(10),
        coords: DISTRICT_CENTROIDS[text(3)] || null
      };
    }).filter(Boolean);
  }

  async function loadSurveyedGeometry(map) {
    try {
      const response = await fetch("./surveyed-geometry.geojson", {cache:"no-store"});
      if (!response.ok) return null;
      const geojson = await response.json();
      if (!geojson || geojson.type !== "FeatureCollection") return null;

      const layer = L.geoJSON(geojson, {
        style: (feature) => {
          const district = feature?.properties?.district || feature?.properties?.DISTRICT;
          const state = feature?.properties?.state || feature?.properties?.STATE;
          const match = readProjectRegister().filter(p => p.district === district && (!state || p.state === state));
          const avgRisk = match.length ? Math.round(match.reduce((s,p)=>s+p.risk,0) / match.length) : 0;
          return {color:"#111827", weight:1.5, fillColor:avgRisk ? riskColor(avgRisk) : "#94a3b8", fillOpacity:avgRisk ? .24 : .08};
        },
        onEachFeature: (feature, layer) => {
          const district = feature?.properties?.district || feature?.properties?.DISTRICT || "Unknown district";
          const state = feature?.properties?.state || feature?.properties?.STATE || "";
          const projects = readProjectRegister().filter(p => p.district === district && (!state || p.state === state));
          const avgRisk = projects.length ? Math.round(projects.reduce((s,p)=>s+p.risk,0) / projects.length) : 0;
          layer.bindPopup(`<div class="bhoomi-map-popup"><strong>${esc(district)}</strong><div>${esc(state)}</div><hr>${projects.length} project(s)<br>Average risk: <b>${avgRisk}/100</b><div class="bhoomi-survey-badge">Surveyed geometry</div></div>`);
        }
      }).addTo(map);
      return layer;
    } catch (error) {
      console.info("Bhoomi Drishti: surveyed-geometry.geojson not available; using district centroids.");
      return null;
    }
  }

  function initMap() {
    const host = document.getElementById("india-map");
    if (!host || host.dataset.bhoomiReady) return;
    host.dataset.bhoomiReady = "true";
    addStyles();

    host.innerHTML = `
      <div class="bhoomi-map-shell">
        <div class="bhoomi-map-wrap">
          <div class="bhoomi-map-controls"><input id="bhoomi-map-search" placeholder="Search project, district or state…" aria-label="Search land acquisition projects"><select id="bhoomi-map-risk" aria-label="Filter by risk"><option value="all">All risk levels</option><option value="critical">Critical</option><option value="high">High</option><option value="moderate">Moderate</option><option value="low">Low</option></select></div>
          <div id="bhoomi-leaflet-map"></div>
          <div class="bhoomi-map-legend"><span><i style="background:#22c55e"></i>Low</span><span><i style="background:#3b82f6"></i>Moderate</span><span><i style="background:#f59e0b"></i>High</span><span><i style="background:#ef4444"></i>Critical</span><span><i class="survey"></i>Surveyed boundary</span></div>
        </div>
        <aside class="bhoomi-map-side"><h4>Acquisition projects</h4><p>Project register is the source of truth. Surveyed boundaries override centroid fallback automatically when supplied.</p><div class="bhoomi-map-stats" id="bhoomi-map-stats"></div><div class="bhoomi-map-list" id="bhoomi-map-list"></div></aside>
      </div>`;

    loadLeaflet(async () => {
      const projects = readProjectRegister();
      const map = L.map("bhoomi-leaflet-map", {zoomControl:true, scrollWheelZoom:true}).setView([22.9,79.0],5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom:18, attribution:"&copy; OpenStreetMap contributors"}).addTo(map);
      const markers = L.layerGroup().addTo(map);
      const list = document.getElementById("bhoomi-map-list");
      const stats = document.getElementById("bhoomi-map-stats");
      const search = document.getElementById("bhoomi-map-search");
      const risk = document.getElementById("bhoomi-map-risk");

      function popup(p){return `<div class="bhoomi-map-popup"><strong>${esc(p.name)}</strong><div>${esc(p.district)}, ${esc(p.state)}</div><hr><span class="risk">Risk ${p.risk}/100</span><br>Delay probability: ${p.delay}%<br>Land area: ${p.areaHa} ha<br>Type: ${esc(p.type)}<br><span class="bhoomi-survey-badge">District-linked project</span></div>`;}
      function select(id){document.querySelectorAll(".bhoomi-map-item").forEach(x=>x.classList.toggle("is-selected",x.dataset.id===id));}
      function render(items){
        markers.clearLayers(); list.innerHTML="";
        items.forEach(p=>{
          if (!p.coords) return;
          const marker=L.circleMarker(p.coords,{radius:8,weight:2,color:"#fff",fillColor:riskColor(p.risk),fillOpacity:.92});
          marker.bindPopup(popup(p)).addTo(markers).on("click",()=>select(p.id));
          const item=document.createElement("button"); item.type="button"; item.className="bhoomi-map-item"; item.dataset.id=p.id;
          item.innerHTML=`<span class="bhoomi-map-dot" style="background:${riskColor(p.risk)}"></span><span><strong>${esc(p.district)}</strong><small>${esc(p.state)} · ${esc(p.id)} · Risk ${p.risk}/100</small></span>`;
          item.onclick=()=>{select(p.id);map.flyTo(p.coords,9,{duration:.7});setTimeout(()=>marker.openPopup(),650);}; list.appendChild(item);
        });
        const unmapped = items.filter(p=>!p.coords).length;
        stats.textContent=`${items.length} register records · ${items.reduce((s,p)=>s+p.areaHa,0).toLocaleString()} ha${unmapped ? ` · ${unmapped} without centroid` : ""}`;
      }
      function apply(){const q=(search.value||"").toLowerCase().trim(), f=risk.value;render(projects.filter(p=>(!q||`${p.id} ${p.name} ${p.district} ${p.state}`.toLowerCase().includes(q))&&(f==="all"||riskClass(p.risk)===f)));}
      search.addEventListener("input",apply); risk.addEventListener("change",apply); render(projects);
      await loadSurveyedGeometry(map);
      setTimeout(()=>map.invalidateSize(),300);
    });
  }

  window.BhoomiLandMap={init:initMap};
  document.addEventListener("DOMContentLoaded",initMap);
})();