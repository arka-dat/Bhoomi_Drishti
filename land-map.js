/* BHOOMI DRISHTI — Interactive land acquisition map */
(function () {
  "use strict";

  const projects = [
    {name:"Kolkata–Howrah Industrial Corridor",district:"Howrah",state:"West Bengal",lat:22.5958,lng:88.2636,risk:82,delay:68,area:184,stage:"Compensation"},
    {name:"Durgapur Logistics Hub",district:"Paschim Bardhaman",state:"West Bengal",lat:23.5204,lng:87.3119,risk:64,delay:49,area:312,stage:"Approval"},
    {name:"Delhi–Mumbai Freight Link",district:"Ahmedabad",state:"Gujarat",lat:23.0225,lng:72.5714,risk:47,delay:35,area:526,stage:"Documentation"},
    {name:"Eastern Dedicated Freight Link",district:"Patna",state:"Bihar",lat:25.5941,lng:85.1376,risk:76,delay:61,area:268,stage:"Dispute review"},
    {name:"Bengaluru Peripheral Corridor",district:"Bengaluru Rural",state:"Karnataka",lat:13.1986,lng:77.7066,risk:38,delay:27,area:421,stage:"Survey"},
    {name:"Amritsar Industrial Park",district:"Amritsar",state:"Punjab",lat:31.6340,lng:74.8723,risk:88,delay:74,area:156,stage:"Legal dispute"},
    {name:"Nagpur Multimodal Hub",district:"Nagpur",state:"Maharashtra",lat:21.1458,lng:79.0882,risk:56,delay:43,area:377,stage:"Rehabilitation"},
    {name:"Chennai–Bengaluru Expressway",district:"Kanchipuram",state:"Tamil Nadu",lat:12.8342,lng:79.7036,risk:31,delay:22,area:489,stage:"Award"}
  ];

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
      .bhoomi-map-legend span{display:flex;align-items:center;gap:5px}.bhoomi-map-legend i{width:8px;height:8px;border-radius:50%}
      .bhoomi-map-side{padding:14px;border:1px solid rgba(15,23,42,.1);border-radius:18px;background:rgba(255,255,255,.52);backdrop-filter:blur(14px);min-height:610px}
      .bhoomi-map-side h4{margin:0 0 4px}.bhoomi-map-side p{font-size:12px;opacity:.65;margin:0 0 12px}.bhoomi-map-stats{font-size:11px;opacity:.65;margin-bottom:10px}
      .bhoomi-map-list{display:flex;flex-direction:column;gap:7px;max-height:520px;overflow:auto;padding-right:3px}
      .bhoomi-map-item{display:flex;align-items:center;gap:9px;width:100%;text-align:left;border:1px solid rgba(15,23,42,.08);background:rgba(255,255,255,.64);padding:10px;border-radius:11px;cursor:pointer;transition:.2s}
      .bhoomi-map-item:hover,.bhoomi-map-item.is-selected{transform:translateY(-1px);background:#fff;box-shadow:0 7px 18px rgba(15,23,42,.1)}
      .bhoomi-map-item strong,.bhoomi-map-item small{display:block}.bhoomi-map-item small{font-size:10px;opacity:.62;margin-top:2px}.bhoomi-map-dot{width:9px;height:9px;border-radius:50%;flex:none}
      .bhoomi-map-popup{font:13px/1.5 Arial,sans-serif;min-width:205px}.bhoomi-map-popup strong{font-size:14px}.bhoomi-map-popup hr{border:0;border-top:1px solid #ddd;margin:7px 0}.bhoomi-map-popup .risk{font-weight:700}.bhoomi-map-popup button{margin-top:8px;border:0;border-radius:7px;padding:7px 10px;background:#111827;color:#fff;cursor:pointer}
      @media(max-width:1050px){.bhoomi-map-shell{grid-template-columns:1fr}.bhoomi-map-side{min-height:0}.bhoomi-map-list{max-height:220px}#bhoomi-leaflet-map{height:520px}}
      @media(max-width:620px){.bhoomi-map-controls{position:static;display:flex;flex-wrap:wrap;padding:10px;background:rgba(255,255,255,.85)}.bhoomi-map-controls input{min-width:100%}#bhoomi-leaflet-map{height:440px}}
    `;
    document.head.appendChild(style);
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
          <div class="bhoomi-map-legend"><span><i style="background:#22c55e"></i>Low</span><span><i style="background:#3b82f6"></i>Moderate</span><span><i style="background:#f59e0b"></i>High</span><span><i style="background:#ef4444"></i>Critical</span></div>
        </div>
        <aside class="bhoomi-map-side"><h4>Acquisition projects</h4><p>Click a project to fly to its location and inspect the risk popup.</p><div class="bhoomi-map-stats" id="bhoomi-map-stats"></div><div class="bhoomi-map-list" id="bhoomi-map-list"></div></aside>
      </div>`;

    loadLeaflet(() => {
      const map = L.map("bhoomi-leaflet-map", {zoomControl:true, scrollWheelZoom:true}).setView([22.9,79.0],5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom:18, attribution:"&copy; OpenStreetMap contributors"}).addTo(map);
      const markers = L.layerGroup().addTo(map);
      const list = document.getElementById("bhoomi-map-list");
      const stats = document.getElementById("bhoomi-map-stats");
      const search = document.getElementById("bhoomi-map-search");
      const risk = document.getElementById("bhoomi-map-risk");

      function popup(p){return `<div class="bhoomi-map-popup"><strong>${esc(p.name)}</strong><div>${esc(p.district)}, ${esc(p.state)}</div><hr><span class="risk">Risk ${p.risk}/100</span><br>Delay probability: ${p.delay}%<br>Land under acquisition: ${p.area} acres<br>Current stage: ${esc(p.stage)}<br><button type="button" data-bhoomi-project="${esc(p.name)}">Open project details</button></div>`;}
      function select(name){document.querySelectorAll(".bhoomi-map-item").forEach(x=>x.classList.toggle("is-selected",x.dataset.project===name));}
      function render(items){
        markers.clearLayers(); list.innerHTML="";
        items.forEach(p=>{
          const marker=L.circleMarker([p.lat,p.lng],{radius:9,weight:2,color:"#fff",fillColor:riskColor(p.risk),fillOpacity:.92});
          marker.bindPopup(popup(p)).addTo(markers).on("click",()=>select(p.name));
          const item=document.createElement("button"); item.type="button"; item.className="bhoomi-map-item"; item.dataset.project=p.name;
          item.innerHTML=`<span class="bhoomi-map-dot" style="background:${riskColor(p.risk)}"></span><span><strong>${esc(p.district)}</strong><small>${esc(p.state)} · Risk ${p.risk}/100 · ${p.delay}% delay</small></span>`;
          item.onclick=()=>{select(p.name);map.flyTo([p.lat,p.lng],9,{duration:.7});setTimeout(()=>marker.openPopup(),650);}; list.appendChild(item);
        });
        stats.textContent=`${items.length} projects · ${items.reduce((s,p)=>s+p.area,0).toLocaleString()} acres monitored`;
      }
      function apply(){const q=(search.value||"").toLowerCase().trim(), f=risk.value;render(projects.filter(p=>(!q||`${p.name} ${p.district} ${p.state}`.toLowerCase().includes(q))&&(f==="all"||riskClass(p.risk)===f)));}
      search.addEventListener("input",apply); risk.addEventListener("change",apply); render(projects); setTimeout(()=>map.invalidateSize(),300);
    });
  }

  window.BhoomiLandMap={init:initMap};
  document.addEventListener("DOMContentLoaded",initMap);
})();