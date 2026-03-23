let data = [];
let geojson;
const maps = {};

const els = {
  q: document.getElementById("q"),
  state: document.getElementById("state"),
  area: document.getElementById("area"),
  type: document.getElementById("type"),
  tenure: document.getElementById("tenure"),
  price: document.getElementById("price"),
  period: document.getElementById("period"),
  rows: document.getElementById("rows"),
  count: document.getElementById("resultCount"),
  apply: document.getElementById("applyBtn"),
  clear: document.getElementById("clearBtn"),
  summaryText: document.getElementById("summaryText"),
  statP25Psm: document.getElementById("statP25Psm"),
  statMedianPsm: document.getElementById("statMedianPsm"),
  statP75Psm: document.getElementById("statP75Psm"),
  statP25Price: document.getElementById("statP25Price"),
  statMedianPrice: document.getElementById("statMedianPrice"),
  statP75Price: document.getElementById("statP75Price")
};

const i18n = {
  en: {
    noData: "No data",
    transactions: "transactions",
    results: "results",
    noDataAvailable: "No data available.",
    summary: (count, first, last, medianPrice, medianPsm) => `${count.toLocaleString("en-MY")} transactions from ${first || "--"} to ${last || "--"}. Median price ${medianPrice} (${medianPsm}/m2).`,
    labels: {
      date: "Date",
      project: "Project / Street",
      area: "Area",
      state: "State",
      type: "Type",
      tenure: "Tenure",
      size: "Size (m2)",
      price: "Price (RM)",
      psm: "Price / m2"
    }
  },
  fr: {
    noData: "Pas de données",
    transactions: "transactions",
    results: "résultats",
    noDataAvailable: "Aucune donnée disponible.",
    summary: (count, first, last, medianPrice, medianPsm) => `${count.toLocaleString("fr-FR")} transactions de ${first || "--"} à ${last || "--"}. Prix médian ${medianPrice} (${medianPsm}/m2).`,
    labels: {
      date: "Date",
      project: "Projet / Rue",
      area: "Zone",
      state: "État",
      type: "Type",
      tenure: "Tenure",
      size: "Surface (m2)",
      price: "Prix (RM)",
      psm: "Prix / m2"
    }
  }
};

function currentLang() {
  return document.body.getAttribute("data-lang") === "fr" ? "fr" : "en";
}

function updateStaticInputs() {
  document.querySelectorAll("option[data-fr][data-en]").forEach(option => {
    option.textContent = option.getAttribute("data-" + currentLang());
  });
  document.querySelectorAll("[data-placeholder-fr][data-placeholder-en]").forEach(input => {
    input.setAttribute("placeholder", input.getAttribute("data-placeholder-" + currentLang()));
  });
}

const monthIndex = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12"
};

function uniqueValues(key){
  return Array.from(new Set(data.map(d => d[key]).filter(Boolean))).sort();
}

function fillSelect(select, values){
  values.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  });
}

function formatMoney(n){
  return n.toLocaleString("en-MY");
}

function formatCurrency(n){
  if(!Number.isFinite(n)) return "--";
  return `RM ${formatMoney(n)}`;
}

function formatPsm(n){
  if(!Number.isFinite(n)) return "--";
  return `RM ${formatMoney(Math.round(n))}`;
}

function parseNumber(raw){
  if(!raw) return null;
  const cleaned = String(raw).replace(/RM/gi, "").replace(/,/g, "").trim();
  if(cleaned === "-" || cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function normalizeText(value){
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseMonthYear(raw){
  const value = normalizeText(raw);
  if(!value) return null;
  const [monthRaw, yearRaw] = value.split(" ");
  const month = monthIndex[(monthRaw || "").toLowerCase()];
  if(!month || !yearRaw) return null;
  return `${yearRaw}-${month}-01`;
}

function parseTsv(text){
  const lines = text.split(/\r?\n/).filter(Boolean);
  if(lines.length === 0) return [];
  const headers = lines[0].split("\t").map(h => normalizeText(h));
  const rows = [];
  for(let i = 1; i < lines.length; i++){
    const parts = lines[i].split("\t");
    if(parts.length < headers.length) continue;
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = normalizeText(parts[idx]);
    });
    rows.push(row);
  }
  return rows;
}

function buildRow(row){
  const date = parseMonthYear(row["Month, Year of Transaction Date"]);
  const scheme = normalizeText(row["Scheme Name/Area"]);
  const road = normalizeText(row["Road Name"]);
  const area = normalizeText(row["Mukim"]);
  const state = normalizeText(row["District"]);
  const type = normalizeText(row["Property Type"]);
  const tenure = normalizeText(row["Tenure"]);
  const mainFloor = parseNumber(row["Main Floor Area"]);
  const land = parseNumber(row["Land/Parcel Area"]);
  const size = mainFloor || land;
  const price = parseNumber(row["Transaction Price"]);
  const project = [scheme, road].filter(Boolean).join(" - ") || scheme || road || "Unknown";
  return {
    date: date || "",
    dateLabel: date ? `${date.slice(0, 7)}` : "",
    project,
    area,
    state,
    type,
    tenure,
    size,
    price
  };
}

function renderRows(rows){
  els.rows.innerHTML = "";
  const labels = i18n[currentLang()].labels;
  rows.forEach(r => {
    const tr = document.createElement("tr");
    const pricePsm = r.size ? Math.round(r.price / r.size) : null;
    tr.innerHTML = `
      <td data-label="${labels.date}">${r.dateLabel || r.date || "--"}</td>
      <td data-label="${labels.project}">${r.project}</td>
      <td data-label="${labels.area}">${r.area}</td>
      <td data-label="${labels.state}">${r.state}</td>
      <td data-label="${labels.type}">${r.type}</td>
      <td data-label="${labels.tenure}">${r.tenure}</td>
      <td data-label="${labels.size}" class="num">${r.size ? formatMoney(Math.round(r.size)) : "--"}</td>
      <td data-label="${labels.price}" class="num">${r.price ? formatMoney(Math.round(r.price)) : "--"}</td>
      <td data-label="${labels.psm}" class="num">${pricePsm ? formatMoney(pricePsm) : "--"}</td>
    `;
    els.rows.appendChild(tr);
  });
  els.count.textContent = `${rows.length} ${i18n[currentLang()].results}`;
}

function normalizeKey(value){
  return normalizeText(value).toLowerCase();
}

const stateAliases = new Map([
  ["kuala lumpur", "Kuala Lumpur"],
  ["wp kuala lumpur", "Kuala Lumpur"],
  ["wilayah persekutuan kuala lumpur", "Kuala Lumpur"],
  ["putrajaya", "Putrajaya"],
  ["wp putrajaya", "Putrajaya"],
  ["wilayah persekutuan putrajaya", "Putrajaya"],
  ["labuan", "Labuan"],
  ["wp labuan", "Labuan"],
  ["wilayah persekutuan labuan", "Labuan"]
]);

function resolveStateName(value){
  const key = normalizeKey(value);
  return stateAliases.get(key) || value;
}

function computeStateStats(){
  const buckets = new Map();
  data.forEach(row => {
    const name = resolveStateName(row.state);
    if(!name) return;
    if(!buckets.has(name)){
      buckets.set(name, { prices: [], psms: [], count: 0 });
    }
    const bucket = buckets.get(name);
    bucket.count += 1;
    if(Number.isFinite(row.price)){
      bucket.prices.push(row.price);
    }
    if(Number.isFinite(row.price) && Number.isFinite(row.size) && row.size > 0){
      bucket.psms.push(row.price / row.size);
    }
  });

  const stats = new Map();
  buckets.forEach((bucket, name) => {
    const sortedPrices = bucket.prices.sort((a,b) => a - b);
    const sortedPsm = bucket.psms.sort((a,b) => a - b);
    const median = arr => {
      if(!arr.length) return null;
      const mid = Math.floor(arr.length / 2);
      return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
    };
    stats.set(name, {
      medianPrice: median(sortedPrices),
      medianPsm: median(sortedPsm),
      count: bucket.count
    });
  });
  return stats;
}

function colorScale(value, breaks, colors){
  if(value == null) return "#e2e8f0";
  for(let i = 0; i < breaks.length; i++){
    if(value <= breaks[i]) return colors[i];
  }
  return colors[colors.length - 1];
}

function buildBreaks(values){
  const sorted = values.filter(Number.isFinite).sort((a,b) => a - b);
  if(sorted.length === 0) return [0, 0, 0, 0, 0];
  const pick = pct => sorted[Math.floor((sorted.length - 1) * pct)];
  return [pick(0.2), pick(0.4), pick(0.6), pick(0.8), pick(1)];
}

function renderChoropleth(mapId, statKey, formatFn){
  const mapEl = document.getElementById(mapId);
  if(!mapEl || !window.L || !geojson) return;
  if(maps[mapId]){
    maps[mapId].remove();
  }
  const map = L.map(mapEl, { scrollWheelZoom: false }).setView([4.2105, 101.9758], 6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const stats = computeStateStats();
  const values = Array.from(stats.values()).map(s => s[statKey]).filter(Number.isFinite);
  const breaks = buildBreaks(values);
  const colors = ["#fee8d6", "#fdbb84", "#fc8d59", "#ef6548", "#d7301f"];

  const layer = L.geoJSON(geojson, {
    style: feature => {
      const name = feature.properties?.shapeName;
      const stat = stats.get(name);
      return {
        color: "#4b5563",
        weight: 0.7,
        fillOpacity: 0.8,
        fillColor: colorScale(stat ? stat[statKey] : null, breaks, colors)
      };
    },
    onEachFeature: (feature, layer) => {
      const name = feature.properties?.shapeName;
      const stat = stats.get(name);
      const value = stat ? stat[statKey] : null;
      const label = value == null ? i18n[currentLang()].noData : formatFn(value);
      const count = stat ? stat.count : 0;
      layer.bindPopup(`<strong>${name}</strong><br>${label}<br>${count} ${i18n[currentLang()].transactions}`);
    }
  }).addTo(map);

  map.fitBounds(layer.getBounds(), { padding: [20, 20] });
  maps[mapId] = map;
}

function applyFilters(){
  const q = els.q.value.trim().toLowerCase();
  const state = els.state.value;
  const area = els.area.value;
  const type = els.type.value;
  const tenure = els.tenure.value;
  const price = els.price.value;
  const period = els.period.value;

  const [pMin, pMax] = price ? price.split("-").map(Number) : [null, null];
  const [dStart, dEnd] = period ? period.split("|") : [null, null];

  const filtered = data.filter(d => {
    if(q){
      const hay = `${d.project} ${d.area} ${d.state}`.toLowerCase();
      if(!hay.includes(q)) return false;
    }
    if(state && d.state !== state) return false;
    if(area && d.area !== area) return false;
    if(type && d.type !== type) return false;
    if(tenure && d.tenure !== tenure) return false;
    if(pMin !== null && (d.price == null || d.price < pMin || d.price > pMax)) return false;
    if(dStart && (d.date < dStart || d.date > dEnd)) return false;
    return true;
  });

  renderRows(filtered);
}

function clearFilters(){
  els.q.value = "";
  els.state.value = "";
  els.area.value = "";
  els.type.value = "";
  els.tenure.value = "";
  els.price.value = "";
  els.period.value = "";
  renderRows(data);
}

function fillPeriodOptions(){
  const years = Array.from(new Set(data.map(d => (d.date || "").slice(0, 4)).filter(Boolean))).sort();
  years.forEach(year => {
    const opt = document.createElement("option");
    opt.value = `${year}-01-01|${year}-12-31`;
    opt.textContent = year;
    els.period.appendChild(opt);
  });
}

function updateSummary(){
  if(!data.length){
    els.summaryText.textContent = i18n[currentLang()].noDataAvailable;
    return;
  }
  const dates = data.map(d => d.date).filter(Boolean).sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  const prices = data.map(d => d.price).filter(Number.isFinite).sort((a,b) => a - b);
  const psm = data.map(d => (d.size ? d.price / d.size : null)).filter(Number.isFinite).sort((a,b) => a - b);

  const pick = (arr, pct) => {
    if(!arr.length) return null;
    const idx = Math.max(0, Math.min(arr.length - 1, Math.round((arr.length - 1) * pct)));
    return arr[idx];
  };

  els.summaryText.textContent = i18n[currentLang()].summary(
    data.length,
    first,
    last,
    formatCurrency(pick(prices, 0.5)),
    formatPsm(pick(psm, 0.5))
  );
  els.statP25Psm.textContent = formatPsm(pick(psm, 0.25));
  els.statMedianPsm.textContent = formatPsm(pick(psm, 0.5));
  els.statP75Psm.textContent = formatPsm(pick(psm, 0.75));
  els.statP25Price.textContent = formatCurrency(pick(prices, 0.25));
  els.statMedianPrice.textContent = formatCurrency(pick(prices, 0.5));
  els.statP75Price.textContent = formatCurrency(pick(prices, 0.75));
}

async function loadGeoJson(){
  const res = await fetch("assets/data/geoBoundaries-MYS-ADM1_simplified.geojson", { cache: "no-store" });
  geojson = await res.json();
}

async function loadData(){
  await loadGeoJson();
  const res = await fetch("assets/data/open-transaction-data.csv", { cache: "no-store" });
  const buffer = await res.arrayBuffer();
  const decoder = new TextDecoder("utf-16le");
  let text = decoder.decode(buffer);
  text = text.replace(/^\uFEFF/, "");
  const rows = parseTsv(text);
  data = rows.map(buildRow).filter(row => row.price != null && row.size != null);

  fillSelect(els.state, uniqueValues("state"));
  fillSelect(els.area, uniqueValues("area"));
  fillSelect(els.type, uniqueValues("type"));
  fillSelect(els.tenure, uniqueValues("tenure"));
  fillPeriodOptions();
  updateStaticInputs();
  updateSummary();
  renderRows(data);
  renderChoropleth("mapPrice", "medianPrice", value => formatCurrency(value));
  renderChoropleth("mapPsm", "medianPsm", value => `${formatPsm(value)}/m2`);
  renderChoropleth("mapCount", "count", value => `${formatMoney(Math.round(value))}`);
}

function initToggle(){
  const buttons = Array.from(document.querySelectorAll(".toggle-btn"));
  const cards = Array.from(document.querySelectorAll(".map-card"));
  if(!buttons.length || !cards.length) return;
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      cards.forEach(card => card.classList.remove("active"));
      btn.classList.add("active");
      const target = document.getElementById(btn.dataset.target);
      if(target){
        target.classList.add("active");
        const mapDiv = target.querySelector(".map");
        if(mapDiv && maps[mapDiv.id]){
          maps[mapDiv.id].invalidateSize();
        }
      }
    });
  });
}

els.apply.addEventListener("click", applyFilters);
els.clear.addEventListener("click", clearFilters);
els.q.addEventListener("input", applyFilters);

initToggle();
loadData();

document.addEventListener("languagechange", () => {
  updateStaticInputs();
  updateSummary();
  renderRows(data);
  renderChoropleth("mapPrice", "medianPrice", value => formatCurrency(value));
  renderChoropleth("mapPsm", "medianPsm", value => `${formatPsm(value)}/m2`);
  renderChoropleth("mapCount", "count", value => `${formatMoney(Math.round(value))}`);
});

