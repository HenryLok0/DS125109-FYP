import { getLang, initLang, setLang, t } from "./i18n.js";
import {
  VEHICLES,
  SOURCES,
  isHoliday,
  loadCameras,
  loadCarparks,
  loadContext,
  loadMeters,
  loadNews,
  loadNonMetered,
  loadNotices,
  loadStatistics,
  sourceStatus,
} from "./data.js";
import {
  PRIOR_PRESSURE,
  answerQuery,
  backtestSeries,
  clearHistory,
  districtKey,
  filterParks,
  liveSummary,
  loadHistory,
  moverLists,
  projectSeries,
  remember,
} from "./intel.js";
import { renderHBars, renderLines, renderSplit } from "./charts.js";
import {
  clearCameras,
  clearMeters,
  flyTo,
  initMap,
  invalidateMap,
  locateUser,
  mapCenter,
  onParkPick,
  setCameras,
  setCarparks,
  setMeters,
} from "./map.js";

const NAV = ["map", "list", "analytics", "forecast", "meters", "cameras", "notices", "assistant", "about"];
const METER_CAP = 2500;
const NOTICE_PAGE = 20;

const state = {
  parks: [],
  meters: null,
  sensors: [],
  cameras: null,
  notices: null,
  news: [],
  stats: null,
  context: null,
  history: loadHistory(),
  meta: { live: 0, catalogue: 0 },
  vehicle: "privateCar",
  district: "all",
  q: "",
  openOnly: false,
  availableOnly: false,
  evOnly: false,
  disOnly: false,
  nature: "all",
  sort: "vacancy",
  selectedId: null,
  origin: null,
  showMeters: false,
  showCameras: false,
  noticeCat: "all",
  noticeQ: "",
  noticePage: 0,
  cameraQ: "",
  cameraDistrict: "all",
  cameraLimit: 24,
  assistantQ: "",
  assistant: null,
  route: "map",
  statusKey: "status.loading",
  failed: false,
  filtersBuilt: false,
  meterNote: "",
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));
}

function loc(pair) {
  if (!pair) return "";
  return getLang() === "en" ? pair.en || pair.zh || "" : pair.zh || pair.en || "";
}

function filters() {
  return {
    q: state.q,
    district: state.district,
    vehicle: state.vehicle,
    nature: state.nature,
    openOnly: state.openOnly,
    availableOnly: state.availableOnly,
    evOnly: state.evOnly,
    disOnly: state.disOnly,
    sort: state.sort,
    origin: state.origin || mapCenter(),
  };
}

function rows() {
  return filterParks(state.parks, filters());
}

function modelCtx() {
  const holiday = isHoliday(state.context?.holidays);
  return { holiday: Boolean(holiday), veryHot: Boolean(state.context?.veryHot), rain: Boolean(state.context?.rain) };
}

function selectedPark() {
  return state.parks.find((park) => park.id === state.selectedId) || null;
}

function themeName() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
  localStorage.setItem("easepark.theme", document.documentElement.dataset.theme);
}

function vehicleRecord(park) {
  return park.vehicles?.[state.vehicle] || null;
}

function vacText(record) {
  if (!record) return t("common.na");
  if (record.kind === "C") return t("detail.closed");
  if (record.kind === "B" || record.vacancy == null) return t("detail.approx");
  return String(record.vacancy);
}

function hoursText(rules) {
  if (!rules?.length) return t("hours.unknown");
  const rule = rules[0];
  const allDay = rules.length === 1 && rule.periodStart === "00:00" && (rule.periodEnd === "00:00" || rule.periodEnd === "24:00");
  if (allDay) return t("hours.24");
  return rules.slice(0, 2).map((item) => `${(item.weekdays || []).join(" ")} ${item.periodStart}–${item.periodEnd}`).join(" · ");
}

function facilityLabel(code) {
  const key = `facility.${code}`;
  const label = t(key);
  return label === key ? code : label;
}

function renderChrome() {
  document.getElementById("brand-sub").textContent = t("brand.sub");
  document.getElementById("lang-btn").textContent = t("action.lang");
  document.getElementById("theme-btn").textContent = themeName() === "dark" ? t("action.themeLight") : t("action.themeDark");
  document.getElementById("refresh-btn").textContent = t("action.refresh");
  document.getElementById("filter-fab").textContent = t("action.filters");
  document.title = getLang() === "en" ? "EaseParkHK" : "EaseParkHK 泊易香港";
  document.getElementById("nav").innerHTML = NAV.map((name) => (
    `<button type="button" data-action="nav" data-view="${name}" class="${state.route === name ? "active" : ""}">${esc(t(`nav.${name}`))}</button>`
  )).join("");
  const status = document.getElementById("status");
  if (state.statusKey === "status.ready") {
    status.textContent = t("status.ready", { n: state.parks.length, live: state.meta.live, extra: state.meta.catalogue });
  } else status.textContent = t(state.statusKey);
}

function renderKpis() {
  const summary = liveSummary(state.parks, state.vehicle);
  const temp = state.context?.temperature?.[getLang() === "en" ? "en" : "zh"];
  const cards = [
    [t("kpi.parks"), state.parks.length || "—"],
    [t("kpi.spaces"), summary.numeric ? summary.spaces : "—"],
    [t("kpi.full"), summary.numeric ? summary.full : "—"],
    [t("kpi.ev"), summary.ev || "—"],
    [t("kpi.weather"), temp ? `${temp.value}°C` : "—"],
  ];
  document.getElementById("kpis").innerHTML = cards.map(([label, value]) => (
    `<div class="kpi"><b>${esc(value)}</b><span>${esc(label)}</span></div>`
  )).join("");
}

function renderBanner() {
  const notes = [];
  const holiday = isHoliday(state.context?.holidays);
  if (holiday) notes.push(`<p>${esc(t("banner.holiday", { name: holiday.name }))}</p>`);
  if (state.context?.veryHot) notes.push(`<p>${esc(t("banner.hot"))}</p>`);
  if (state.context?.rain) notes.push(`<p>${esc(t("banner.rain"))}</p>`);
  const news = state.news[0];
  if (news) notes.push(`<p><strong>${esc(t("banner.news"))}</strong> ${esc(loc(news.title))} · ${esc(loc(news.location))}</p>`);
  document.getElementById("banner").innerHTML = notes.join("");
}

function renderFilters() {
  const districts = [...new Set(state.parks.map(districtKey).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const options = districts.map((key) => {
    const park = state.parks.find((item) => districtKey(item) === key);
    return `<option value="${esc(key)}" ${state.district === key ? "selected" : ""}>${esc(loc(park?.district) || key)}</option>`;
  }).join("");
  const vehicles = VEHICLES.map((key) => `<option value="${key}" ${state.vehicle === key ? "selected" : ""}>${esc(t(`vehicle.${key}`))}</option>`).join("");
  const sorts = ["vacancy", "name", "price", "distance"].map((key) => `<option value="${key}" ${state.sort === key ? "selected" : ""}>${esc(t(`sort.${key}`))}</option>`).join("");
  document.getElementById("filters").innerHTML = `
    <label class="field"><span>${esc(t("search.placeholder"))}</span><input id="q" type="search" value="${esc(state.q)}" placeholder="${esc(t("search.placeholder"))}"></label>
    <label class="field"><span>${esc(t("filter.district"))}</span><select id="district"><option value="all">${esc(t("filter.all"))}</option>${options}</select></label>
    <label class="field"><span>${esc(t("filter.vehicle"))}</span><select id="vehicle">${vehicles}</select></label>
    <label class="field"><span>${esc(t("filter.sort"))}</span><select id="sort">${sorts}</select></label>
    <label class="field"><span>${esc(t("filter.nature"))}</span>
      <select id="nature">
        <option value="all">${esc(t("nature.all"))}</option>
        <option value="government" ${state.nature === "government" ? "selected" : ""}>${esc(t("nature.government"))}</option>
        <option value="commercial" ${state.nature === "commercial" ? "selected" : ""}>${esc(t("nature.commercial"))}</option>
      </select>
    </label>
    <label class="check"><input id="openOnly" type="checkbox" ${state.openOnly ? "checked" : ""}> ${esc(t("filter.open"))}</label>
    <label class="check"><input id="availableOnly" type="checkbox" ${state.availableOnly ? "checked" : ""}> ${esc(t("filter.available"))}</label>
    <label class="check"><input id="evOnly" type="checkbox" ${state.evOnly ? "checked" : ""}> ${esc(t("filter.ev"))}</label>
    <label class="check"><input id="disOnly" type="checkbox" ${state.disOnly ? "checked" : ""}> ${esc(t("filter.disabled"))}</label>
    <div class="actions">
      <button type="button" class="text-btn" data-action="locate">${esc(t("action.locate"))}</button>
      <button type="button" class="text-btn" data-action="toggle-meters">${esc(state.showMeters ? t("action.metersOff") : t("action.metersOn"))}</button>
      <button type="button" class="text-btn" data-action="toggle-cameras">${esc(state.showCameras ? t("action.camerasOff") : t("action.camerasOn"))}</button>
    </div>
    <div class="legend-title">${esc(t("legend.easy"))}</div>
    <div class="legend">
      <span><i style="background:#1f7a4d"></i>${esc(t("legend.easy"))}</span>
      <span><i style="background:#b86a12"></i>${esc(t("legend.tight"))}</span>
      <span><i style="background:#b42318"></i>${esc(t("legend.full"))}</span>
      <span><i style="background:#8aa0aa"></i>${esc(t("legend.unknown"))}</span>
    </div>`;
  state.filtersBuilt = true;
}

function renderDetail() {
  const root = document.getElementById("detail");
  const park = selectedPark();
  if (!park) {
    root.hidden = true;
    root.innerHTML = "";
    return;
  }
  const record = vehicleRecord(park);
  const points = state.history?.parks?.[park.id] || [];
  const series = record?.vacancy != null ? projectSeries(record.vacancy, record.space, points, modelCtx(), 3) : [];
  const forecast = series.filter((point) => point.offset > 0).map((point) => (
    `<div>${point.offset}h · ${Math.round(point.value)} · ${esc(t(`method.${point.method}`))} · ${esc(t(`confidence.${point.confidence}`))}</div>`
  )).join("");
  const facilities = (park.facilities || []).map((code) => `<span class="badge">${esc(facilityLabel(code))}</span>`).join("");
  const lat = park.lat.toFixed(5);
  const lng = park.lng.toFixed(5);
  root.hidden = false;
  root.innerHTML = `
    <button type="button" class="text-btn" data-action="close-detail">${esc(t("action.close"))}</button>
    <h2>${esc(loc(park.name))}</h2>
    <p class="muted">${esc(loc(park.address))}</p>
    <p>
      <span class="badge">${esc(park.source === "onestop" ? t("common.sourceLive") : t("common.sourceList"))}</span>
      <span class="badge">${esc(loc(park.district))}</span>
      ${park.nature ? `<span class="badge">${esc(t(`nature.${park.nature}`) === `nature.${park.nature}` ? park.nature : t(`nature.${park.nature}`))}</span>` : ""}
    </p>
    ${park.photo ? `<img class="photo" alt="" src="${esc(park.photo)}">` : ""}
    <p><strong>${esc(t("detail.vacancy"))}</strong> ${esc(vacText(record))}</p>
    <p><strong>${esc(t("detail.capacity"))}</strong> ${esc(record?.space ?? t("common.na"))}</p>
    <p><strong>${esc(t("detail.price"))}</strong> ${record?.price != null ? `HK$${esc(record.price)}` : esc(t("common.na"))}</p>
    ${record?.vacancyEV ? `<p>EV ${esc(record.vacancyEV)}</p>` : ""}
    ${record?.vacancyDIS ? `<p>${esc(t("facility.disabilities"))} ${esc(record.vacancyDIS)}</p>` : ""}
    <p><strong>${esc(t("detail.hours"))}</strong> ${esc(hoursText(park.openingHours))}</p>
    <p><strong>${esc(t("detail.height"))}</strong> ${park.height ? `${esc(park.height)} m` : esc(t("common.na"))}</p>
    <p><strong>${esc(t("detail.phone"))}</strong> ${esc(park.phone || t("common.na"))}</p>
    <p><strong>${esc(t("detail.updated"))}</strong> ${esc(record?.updated || t("common.na"))}</p>
    <p>${facilities}</p>
    ${forecast ? `<h3>${esc(t("detail.forecast"))}</h3>${forecast}` : ""}
    <iframe class="map-frame" title="Google Maps" loading="lazy" src="https://maps.google.com/?q=${lat},${lng}&output=embed"></iframe>
    <p><a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener">${esc(t("action.google"))}</a></p>`;
}

function renderList() {
  const root = document.getElementById("list-root");
  const matched = rows();
  const shown = matched.slice(0, 300);
  const items = shown.map((park) => {
    const record = vehicleRecord(park);
    return `<button type="button" class="park-row" data-action="pick-park" data-id="${esc(park.id)}">
      <span><strong>${esc(loc(park.name))}</strong><br><span class="muted">${esc(loc(park.district))} · ${esc(loc(park.address))}</span></span>
      <span class="vac">${esc(vacText(record))}</span>
    </button>`;
  }).join("");
  root.innerHTML = `
    <h1>${esc(t("nav.list"))}</h1>
    <p class="lead">${esc(t("list.count", { shown: shown.length, total: matched.length }))}</p>
    ${matched.length > 300 ? `<p class="muted">${esc(t("list.more"))}</p>` : ""}
    ${items || `<p>${esc(t("list.empty"))}</p>`}`;
}

function renderAnalytics() {
  const root = document.getElementById("analytics-root");
  const summary = liveSummary(state.parks, "privateCar");
  const util = summary.util == null ? t("common.na") : `${Math.round(summary.util * 100)}%`;
  root.innerHTML = `
    <h1>${esc(t("analytics.title"))}</h1>
    <p class="lead">${esc(t("analytics.lead"))}</p>
    <div class="grid">
      <div class="stat"><span>${esc(t("kpi.spaces"))}</span><b>${esc(summary.spaces)}</b></div>
      <div class="stat"><span>${esc(t("analytics.liveUtil"))}</span><b>${esc(util)}</b></div>
      <div class="stat"><span>${esc(t("kpi.full"))}</span><b>${esc(summary.full)}</b></div>
    </div>
    <section class="panel"><h2>${esc(t("analytics.district"))}</h2><div id="chart-district"></div></section>
    <section class="panel"><h2>${esc(t("analytics.mix"))}</h2><div id="chart-mix"></div></section>
    <section class="panel"><h2>${esc(t("analytics.streets"))}</h2><div id="chart-streets"></div></section>
    <section class="panel"><h2>${esc(t("analytics.gov"))}</h2><div id="chart-gov"></div></section>
    <section class="panel"><h2>${esc(t("analytics.meterTrend"))}</h2><div id="chart-trend"></div></section>`;
  const lang = getLang() === "en" ? "en" : "zh";
  renderHBars(root.querySelector("#chart-district"), summary.districts.slice(0, 12).map((row) => ({
    label: loc(row),
    value: row.spaces,
  })), { empty: t("list.empty") });
  renderSplit(root.querySelector("#chart-mix"), VEHICLES.map((key, index) => ({
    label: t(`vehicle.${key}`),
    value: summary.byVehicle[key] || 0,
    color: ["#3389ab", "#1f7a4d", "#b86a12", "#b42318", "#6b5b95", "#0e4f68"][index],
  })));
  const streets = state.stats?.streets?.[lang] || [];
  renderHBars(root.querySelector("#chart-streets"), streets.slice(0, 12), { empty: t("status.loading") });
  const gov = state.stats?.table61?.[lang] || [];
  renderHBars(root.querySelector("#chart-gov"), gov.map((row) => ({ label: row.label, value: row.value })), {
    empty: t("status.loading"),
    format: (value) => `${Math.round(value)}%`,
  });
  const trend = state.stats?.table62?.[lang];
  const series = trend ? [...trend.entries()].map(([name, points]) => ({
    name,
    points: points.filter((point) => point.y != null).slice(-18).map((point) => ({ x: String(point.x).slice(2), y: point.y })),
  })) : [];
  renderLines(root.querySelector("#chart-trend"), series, { empty: t("status.loading"), format: (value) => `${Math.round(value)}` });
}

function renderForecast() {
  const root = document.getElementById("forecast-root");
  const summary = liveSummary(state.parks, "privateCar");
  const ctx = modelCtx();
  const city = projectSeries(summary.spaces, summary.capacity || null, state.history.city || [], ctx, 6);
  const test = backtestSeries(state.history.city || [], ctx);
  const movers = moverLists(state.parks, state.history, ctx);
  const outlook = state.context?.forecast?.[getLang() === "en" ? "en" : "zh"];
  const days = (outlook?.weatherForecast || []).slice(0, 5).map((day) => (
    `<div class="stat"><b>${esc(day.forecastMaxtemp?.value ?? "")}°</b><span>${esc(day.week || day.forecastDate)}</span><span>${esc(day.forecastWeather || "")}</span></div>`
  )).join("");
  const list = (items) => items.map((item) => (
    `<button type="button" class="park-row" data-action="pick-park" data-id="${esc(item.park.id)}"><span>${esc(loc(item.park.name))}</span><span>${Math.round(item.now)} → ${Math.round(item.next)}</span></button>`
  )).join("") || `<p class="muted">${esc(t("forecast.none"))}</p>`;
  root.innerHTML = `
    <h1>${esc(t("forecast.title"))}</h1>
    <p class="lead">${esc(t("forecast.lead"))}</p>
    <p>${esc(t("forecast.samples", { n: state.history.city?.length || 0 }))}</p>
    <p>${test ? esc(t("forecast.mae", { mae: test.mae.toFixed(1), n: test.n })) : esc(t("forecast.maeNone"))}</p>
    <section class="panel"><h2>${esc(t("forecast.city"))}</h2><div id="chart-city"></div></section>
    <section class="panel"><h2>${esc(t("forecast.prior"))}</h2><div id="chart-prior"></div></section>
    <div class="grid">
      <section class="panel"><h2>${esc(t("forecast.fill"))}</h2>${list(movers.filling)}</section>
      <section class="panel"><h2>${esc(t("forecast.free"))}</h2>${list(movers.freeing)}</section>
    </div>
    <section class="panel"><h2>${esc(t("forecast.weather"))}</h2><p>${esc(outlook?.generalSituation || "")}</p><div class="grid">${days}</div></section>
    <div class="actions">
      <button type="button" data-action="export-history">${esc(t("action.export"))}</button>
      <button type="button" data-action="clear-history">${esc(t("action.clear"))}</button>
    </div>`;
  renderLines(root.querySelector("#chart-city"), [{
    name: t("kpi.spaces"),
    points: city.map((point) => ({ x: point.offset === 0 ? t("forecast.now") : `+${point.offset}h`, y: point.value })),
  }]);
  renderHBars(root.querySelector("#chart-prior"), PRIOR_PRESSURE.map((value, hour) => ({
    label: String(hour).padStart(2, "0"),
    value: Math.round(value * 100),
  })), { format: (value) => `${value}%` });
}

function meterPool() {
  return [...(state.meters || []), ...(state.sensors || [])];
}

function renderMeters() {
  const root = document.getElementById("meters-root");
  if (!state.meters) {
    root.innerHTML = `<h1>${esc(t("meters.title"))}</h1><p>${esc(state.meterNote || t("meters.loading"))}</p>`;
    return;
  }
  const all = meterPool();
  const vacant = all.filter((meter) => meter.occupancy === "V").length;
  const taken = all.filter((meter) => meter.occupancy === "O").length;
  const byDistrict = new Map();
  for (const meter of all) {
    if (meter.occupancy !== "V") continue;
    const label = loc(meter.district) || "—";
    byDistrict.set(label, (byDistrict.get(label) || 0) + 1);
  }
  const bars = [...byDistrict.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 12);
  root.innerHTML = `
    <h1>${esc(t("meters.title"))}</h1>
    <p class="lead">${esc(t("meters.lead"))}</p>
    <p>${esc(t("meters.count", { vacant, taken, unknown: all.length - vacant - taken, total: all.length }))}</p>
    <p class="muted">${esc(t("meters.cap", { n: METER_CAP }))}</p>
    ${state.meterNote ? `<p>${esc(state.meterNote)}</p>` : ""}
    <button type="button" class="primary" data-action="toggle-meters">${esc(state.showMeters ? t("action.metersOff") : t("action.metersOn"))}</button>
    <section class="panel"><h2>${esc(t("meters.district"))}</h2><div id="chart-meter"></div></section>`;
  renderHBars(root.querySelector("#chart-meter"), bars, { empty: t("meters.fail") });
}

function renderCameras() {
  const root = document.getElementById("cameras-root");
  if (!state.cameras) {
    root.innerHTML = `<h1>${esc(t("cameras.title"))}</h1><p>${esc(t("cameras.loading"))}</p>`;
    return;
  }
  const query = state.cameraQ.trim().toLowerCase();
  const districts = [...new Set(state.cameras.map((camera) => loc(camera.district)).filter(Boolean))].sort();
  const matched = state.cameras.filter((camera) => {
    if (state.cameraDistrict !== "all" && loc(camera.district) !== state.cameraDistrict) return false;
    if (!query) return true;
    return `${loc(camera.description)} ${loc(camera.district)} ${camera.key}`.toLowerCase().includes(query);
  });
  const cards = matched.slice(0, state.cameraLimit).map((camera) => `
    <figure>
      <img alt="${esc(loc(camera.description))}" loading="lazy" src="${esc(camera.url)}">
      <figcaption><strong>${esc(camera.key)}</strong><br>${esc(loc(camera.description))}</figcaption>
    </figure>`).join("");
  root.innerHTML = `
    <h1>${esc(t("cameras.title"))}</h1>
    <p class="lead">${esc(t("cameras.lead"))}</p>
    <div class="grid">
      <label class="field"><span>${esc(t("search.placeholder"))}</span><input id="camera-q" type="search" value="${esc(state.cameraQ)}"></label>
      <label class="field"><span>${esc(t("filter.district"))}</span>
        <select id="camera-district"><option value="all">${esc(t("filter.all"))}</option>
          ${districts.map((name) => `<option ${state.cameraDistrict === name ? "selected" : ""}>${esc(name)}</option>`).join("")}
        </select>
      </label>
    </div>
    <div class="actions"><button type="button" data-action="toggle-cameras">${esc(state.showCameras ? t("action.camerasOff") : t("action.camerasOn"))}</button></div>
    <div class="camera-grid">${cards || `<p>${esc(t("cameras.empty"))}</p>`}</div>
    ${matched.length > state.cameraLimit ? `<button type="button" data-action="camera-more">${esc(t("action.more"))}</button>` : ""}`;
}

function renderNotices() {
  const root = document.getElementById("notices-root");
  if (!state.notices) {
    root.innerHTML = `<h1>${esc(t("notices.title"))}</h1><p>${esc(t("notices.loading"))}</p>`;
    return;
  }
  const query = state.noticeQ.trim().toLowerCase();
  const matched = state.notices.filter((notice) => {
    if (state.noticeCat !== "all" && notice.category !== state.noticeCat) return false;
    if (!query) return true;
    return `${loc(notice.title)} ${loc(notice.body)}`.toLowerCase().includes(query);
  });
  const pageCount = Math.max(1, Math.ceil(matched.length / NOTICE_PAGE));
  state.noticePage = Math.min(state.noticePage, pageCount - 1);
  const slice = matched.slice(state.noticePage * NOTICE_PAGE, state.noticePage * NOTICE_PAGE + NOTICE_PAGE);
  const cats = ["all", "closure", "speed", "zone", "clearway", "express", "transport", "arrange", "other"];
  const news = state.news.slice(0, 4).map((item) => `
    <article class="notice"><strong>${esc(loc(item.title))}</strong>
      <span class="muted">${esc(item.at)} · ${esc(loc(item.location))} ${esc(loc(item.near))}</span>
      <span>${esc(loc(item.content))}</span></article>`).join("");
  root.innerHTML = `
    <h1>${esc(t("notices.title"))}</h1>
    <p class="lead">${esc(t("notices.lead"))}</p>
    <h2>${esc(t("news.title"))}</h2>
    ${news || `<p class="muted">${esc(t("notices.empty"))}</p>`}
    <label class="field"><span>${esc(t("notices.search"))}</span><input id="notice-q" type="search" value="${esc(state.noticeQ)}"></label>
    <div class="actions">${cats.map((cat) => `<button type="button" data-action="notice-cat" data-cat="${cat}" class="${state.noticeCat === cat ? "primary" : "text-btn"}">${esc(t(`cat.${cat}`))}</button>`).join("")}</div>
    ${slice.map((notice) => `<article class="notice"><span class="badge">${esc(t(`cat.${notice.category}`))}</span> <span class="muted">${esc(notice.date)}</span><strong>${esc(loc(notice.title))}</strong><span>${esc(loc(notice.body))}</span></article>`).join("") || `<p>${esc(t("notices.empty"))}</p>`}
    <div class="actions">
      <button type="button" data-action="notice-prev" ${state.noticePage === 0 ? "disabled" : ""}>${esc(t("action.prev"))}</button>
      <span>${state.noticePage + 1} / ${pageCount}</span>
      <button type="button" data-action="notice-next" ${state.noticePage >= pageCount - 1 ? "disabled" : ""}>${esc(t("action.next"))}</button>
    </div>`;
}

function renderAssistant() {
  const root = document.getElementById("assistant-root");
  const examples = [1, 2, 3, 4].map((index) => (
    `<button type="button" class="text-btn" data-action="example" data-q="${esc(t(`ex.${index}`))}">${esc(t(`ex.${index}`))}</button>`
  )).join("");
  let body = `<p class="muted">${esc(t("assistant.empty"))}</p>`;
  if (state.assistant) {
    if (!state.assistant.results.length) body = `<p>${esc(t("assistant.none"))}</p>`;
    else {
      body = `${state.assistant.relaxed ? `<p>${esc(t("assistant.relaxed"))}</p>` : ""}` + state.assistant.results.map((item) => `
        <button type="button" class="answer" data-action="pick-park" data-id="${esc(item.park.id)}">
          <strong>${esc(loc(item.park.name))}</strong>
          <span>${esc(t("assistant.score", { n: Math.round(item.score) }))} · ${esc(loc(item.park.district))}</span>
          <span class="muted">${item.reasons.map((reason) => esc(t(`reason.${reason.code}`, reason.vars))).join(" · ")}</span>
        </button>`).join("");
    }
  }
  root.innerHTML = `
    <h1>${esc(t("assistant.title"))}</h1>
    <p class="lead">${esc(t("assistant.lead"))}</p>
    <textarea id="assistant-q">${esc(state.assistantQ)}</textarea>
    <div class="actions"><button type="button" class="primary" data-action="ask">${esc(t("action.ask"))}</button>${examples}</div>
    ${body}`;
}

function renderAbout() {
  const root = document.getElementById("about-root");
  const reported = sourceStatus();
  const rowsHtml = SOURCES.map((source) => {
    const item = reported[source.id];
    let label = t("about.link");
    if (item?.ok) label = t("about.ok");
    else if (item && !item.ok) label = t("about.fail");
    return `<tr><td>${esc(source.id)}</td><td><a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.url)}</a></td><td>${esc(label)}</td></tr>`;
  }).join("");
  root.innerHTML = `
    <h1>${esc(t("about.title"))}</h1>
    <p>${esc(t("about.p1"))}</p>
    <p>${esc(t("about.p2"))}</p>
    <p>${esc(t("about.p3"))}</p>
    <p>${esc(t("about.p4"))}</p>
    <p>${esc(t("about.p5"))}</p>
    <p>${esc(t("about.limit"))}</p>
    <p>${esc(t("about.books"))}</p>
    <h2>${esc(t("about.sources"))}</h2>
    <table><tbody>${rowsHtml}</tbody></table>
    <p class="muted">OpenStreetMap https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png · Leaflet 1.9.4 · MarkerCluster 1.5.3</p>`;
}

function syncCarparks() {
  setCarparks(rows(), state.vehicle, state.selectedId);
}

function syncMeters() {
  if (!state.showMeters || !state.meters) {
    clearMeters();
    return;
  }
  const vacant = meterPool().filter((meter) => meter.occupancy === "V").slice(0, METER_CAP);
  setMeters(vacant, getLang());
}

function syncCameras() {
  if (!state.showCameras || !state.cameras) {
    clearCameras();
    return;
  }
  setCameras(state.cameras, getLang());
}

function renderRoute() {
  renderChrome();
  renderKpis();
  renderBanner();
  if (!state.filtersBuilt) renderFilters();
  if (state.route === "map") {
    syncCarparks();
    renderDetail();
    requestAnimationFrame(() => invalidateMap());
  } else if (state.route === "list") renderList();
  else if (state.route === "analytics") renderAnalytics();
  else if (state.route === "forecast") renderForecast();
  else if (state.route === "meters") renderMeters();
  else if (state.route === "cameras") renderCameras();
  else if (state.route === "notices") renderNotices();
  else if (state.route === "assistant") renderAssistant();
  else if (state.route === "about") renderAbout();
}

function applyRoute() {
  const name = (location.hash || "#map").slice(1);
  state.route = NAV.includes(name) ? name : "map";
  document.body.dataset.view = state.route;
  document.querySelectorAll("main [data-view]").forEach((section) => {
    section.hidden = section.dataset.view !== state.route;
  });
  if (state.route === "analytics") ensureStats();
  if (state.route === "meters") ensureMeters();
  if (state.route === "cameras") ensureCameras();
  if (state.route === "notices") ensureNotices();
  renderRoute();
}

async function ensureMeters() {
  if (state.meters) return;
  state.meterNote = t("meters.loading");
  if (state.route === "meters") renderMeters();
  const [meters, sensors] = await Promise.all([loadMeters(), loadNonMetered()]);
  state.meters = meters;
  state.sensors = sensors;
  const reported = sourceStatus();
  if (!reported.meters?.ok) state.meterNote = t("meters.fail");
  else if (!reported.nonmeter?.ok) state.meterNote = "";
  if (state.route === "meters") renderMeters();
  syncMeters();
}

async function ensureCameras() {
  if (state.cameras) return;
  state.cameras = await loadCameras();
  if (state.route === "cameras") renderCameras();
  syncCameras();
}

async function ensureNotices() {
  if (state.notices) return;
  state.notices = await loadNotices();
  if (state.route === "notices") renderNotices();
}

async function ensureStats() {
  if (state.stats) return;
  state.stats = await loadStatistics();
  if (state.route === "analytics") renderAnalytics();
}

function ask() {
  const field = document.getElementById("assistant-q");
  state.assistantQ = field ? field.value : state.assistantQ;
  state.assistant = answerQuery(state.assistantQ, state.parks, state.origin || mapCenter(), modelCtx(), state.history);
  renderAssistant();
}

function selectPark(id) {
  state.selectedId = id;
  const park = selectedPark();
  if (park) flyTo(park.lat, park.lng);
  if (state.route !== "map") location.hash = "map";
  else {
    syncCarparks();
    renderDetail();
  }
}

async function reload() {
  state.statusKey = "status.loading";
  renderChrome();
  try {
    const [core, context, news] = await Promise.all([loadCarparks(), loadContext(), loadNews()]);
    state.parks = core.parks;
    state.meta = { live: core.live, catalogue: core.catalogue };
    state.context = context;
    state.news = news;
    state.history = remember(state.parks);
    state.statusKey = state.parks.length ? "status.ready" : "status.failed";
    state.failed = Object.values(sourceStatus()).some((item) => item && item.ok === false);
    state.filtersBuilt = false;
    renderRoute();
  } catch {
    state.statusKey = "status.failed";
    renderChrome();
  }
}

function bind() {
  document.addEventListener("click", (event) => {
    const node = event.target.closest("[data-action]");
    if (!node) return;
    const action = node.dataset.action;
    if (action === "nav") location.hash = node.dataset.view;
    else if (action === "lang") {
      setLang(getLang() === "zh" ? "en" : "zh");
      state.filtersBuilt = false;
      state.cameraDistrict = "all";
      renderRoute();
      syncMeters();
      syncCameras();
    } else if (action === "theme") applyTheme(themeName() === "dark" ? "light" : "dark");
    else if (action === "refresh") reload();
    else if (action === "toggle-filters") document.getElementById("filters").classList.toggle("open");
    else if (action === "locate") {
      locateUser().then((origin) => {
        state.origin = origin;
        state.sort = "distance";
        state.filtersBuilt = false;
        renderRoute();
      }).catch(() => {});
    } else if (action === "toggle-meters") {
      state.showMeters = !state.showMeters;
      state.filtersBuilt = false;
      if (state.showMeters && state.meters) syncMeters();
      else if (state.showMeters) ensureMeters();
      else syncMeters();
      renderRoute();
    } else if (action === "toggle-cameras") {
      state.showCameras = !state.showCameras;
      state.filtersBuilt = false;
      if (state.showCameras && state.cameras) syncCameras();
      else if (state.showCameras) ensureCameras();
      else syncCameras();
      renderRoute();
    } else if (action === "close-detail") {
      state.selectedId = null;
      renderDetail();
      syncCarparks();
    } else if (action === "pick-park") selectPark(node.dataset.id);
    else if (action === "example") {
      state.assistantQ = node.dataset.q;
      state.assistant = answerQuery(state.assistantQ, state.parks, state.origin || mapCenter(), modelCtx(), state.history);
      renderAssistant();
    } else if (action === "ask") ask();
    else if (action === "notice-cat") {
      state.noticeCat = node.dataset.cat;
      state.noticePage = 0;
      renderNotices();
    } else if (action === "notice-prev") {
      state.noticePage = Math.max(0, state.noticePage - 1);
      renderNotices();
    } else if (action === "notice-next") {
      state.noticePage += 1;
      renderNotices();
    } else if (action === "camera-more") {
      state.cameraLimit += 24;
      renderCameras();
    } else if (action === "export-history") {
      const blob = new Blob([JSON.stringify(loadHistory())], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "easepark-history.json";
      link.click();
    } else if (action === "clear-history") {
      clearHistory();
      state.history = loadHistory();
      renderForecast();
    }
  });

  document.addEventListener("change", (event) => {
    const id = event.target.id;
    if (id === "district") state.district = event.target.value;
    else if (id === "vehicle") state.vehicle = event.target.value;
    else if (id === "sort") state.sort = event.target.value;
    else if (id === "nature") state.nature = event.target.value;
    else if (id === "openOnly") state.openOnly = event.target.checked;
    else if (id === "availableOnly") state.availableOnly = event.target.checked;
    else if (id === "evOnly") state.evOnly = event.target.checked;
    else if (id === "disOnly") state.disOnly = event.target.checked;
    else if (id === "camera-district") {
      state.cameraDistrict = event.target.value;
      state.cameraLimit = 24;
      renderCameras();
      return;
    } else return;
    syncCarparks();
    renderKpis();
    if (state.route === "list") renderList();
    if (state.selectedId) renderDetail();
  });

  document.addEventListener("input", (event) => {
    if (event.target.id === "q") {
      state.q = event.target.value;
      syncCarparks();
      if (state.route === "list") renderList();
    } else if (event.target.id === "notice-q") {
      state.noticeQ = event.target.value;
      state.noticePage = 0;
      renderNotices();
    } else if (event.target.id === "camera-q") {
      state.cameraQ = event.target.value;
      state.cameraLimit = 24;
      renderCameras();
    } else if (event.target.id === "assistant-q") state.assistantQ = event.target.value;
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.selectedId) {
      state.selectedId = null;
      renderDetail();
      syncCarparks();
    }
    if (event.key === "Enter" && event.target.id === "assistant-q" && !event.shiftKey) {
      event.preventDefault();
      ask();
    }
  });

  window.addEventListener("hashchange", applyRoute);
  onParkPick((id) => selectPark(id));
}

function boot() {
  const saved = localStorage.getItem("easepark.theme");
  applyTheme(saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  initLang();
  bind();
  const mapOk = initMap(document.getElementById("map"));
  if (!mapOk) document.getElementById("status").textContent = "Leaflet did not load.";
  applyRoute();
  reload();
  window.setInterval(reload, 5 * 60 * 1000);
}

boot();
