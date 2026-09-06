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
  function escapeHtml(value) { return String(value).replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c])); }

  function initMap() {
    const el = document.getElementById("land-acquisition-map");
    if (!el || typeof L === "undefined" || el.dataset.ready) return;
    el.dataset.ready = "true";

    const map = L.map(el, {zoomControl:true, scrollWheelZoom:true}).setView([22.9, 79.0], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    const markers = L.layerGroup().addTo(map);
    const list = document.getElementById("map-project-list");
    const search = document.getElementById("map-project-search");
    const filter = document.getElementById("map-risk-filter");
    const stats = document.getElementById("map-stats");

    function popup(p) {
      return `<div class="map-popup"><strong>${escapeHtml(p.name)}</strong><div>${escapeHtml(p.district)}, ${escapeHtml(p.state)}</div><hr><b>Risk: ${p.risk}/100</b><br>Delay probability: ${p.delay}%<br>Land: ${p.area} acres<br>Stage: ${escapeHtml(p.stage)}<br><button class="map-view-project" data-project="${escapeHtml(p.name)}">View project details</button></div>`;
    }

    function render(items) {
      markers.clearLayers();
      if (list) list.innerHTML = "";
      items.forEach(p => {
        const marker = L.circleMarker([p.lat,p.lng], {radius:9,weight:2,color:"#fff",fillColor:p.risk>=76?"#ef4444":p.risk>=55?"#f59e0b":p.risk>=32?"#3b82f6":"#22c55e",fillOpacity:.9});
        marker.bindPopup(popup(p));
        marker.addTo(markers);
        marker.on("click", () => highlight(p.name));
        if (list) {
          const item = document.createElement("button");
          item.className = "map-project-item";
          item.dataset.project = p.name;
          item.innerHTML = `<span class="map-dot ${riskClass(p.risk)}"></span><span><strong>${escapeHtml(p.district)}</strong><small>${escapeHtml(p.state)} · ${p.risk}/100 risk</small></span>`;
          item.addEventListener("click", () => { map.flyTo([p.lat,p.lng], 9, {duration:.7}); setTimeout(() => marker.openPopup(), 700); });
          list.appendChild(item);
        }
      });
      if (stats) stats.textContent = `${items.length} projects · ${items.reduce((s,p)=>s+p.area,0).toLocaleString()} acres under monitoring`;
    }

    function highlight(name) {
      document.querySelectorAll(".map-project-item").forEach(x => x.classList.toggle("is-selected", x.dataset.project === name));
    }

    function applyFilters() {
      const q = (search?.value || "").toLowerCase().trim();
      const f = filter?.value || "all";
      const items = projects.filter(p => {
        const text = `${p.name} ${p.district} ${p.state}`.toLowerCase();
        const matchesSearch = !q || text.includes(q);
        const matchesRisk = f === "all" || riskClass(p.risk) === f;
        return matchesSearch && matchesRisk;
      });
      render(items);
    }

    search?.addEventListener("input", applyFilters);
    filter?.addEventListener("change", applyFilters);
    render(projects);
    setTimeout(() => map.invalidateSize(), 250);
  }

  window.BhoomiLandMap = { init: initMap };
  document.addEventListener("DOMContentLoaded", initMap);
})();