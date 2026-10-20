// Forecasts, rankings, and the on-device parking assistant.
// History stays in the browser. Nothing is sent to a model API.

const HISTORY_KEY = "easepark.history.v1";
const MAX_POINTS = 36;
const BUCKET_MS = 10 * 60 * 1000;

// Expected occupancy by hour in Hong Kong, before weather or holiday adjustments.
// This is a documented prior, not an official Transport Department curve.
export const PRIOR_PRESSURE = [
  0.22, 0.18, 0.15, 0.14, 0.15, 0.2,
  0.45, 0.72, 0.88, 0.8, 0.62, 0.7,
  0.78, 0.74, 0.6, 0.55, 0.66, 0.86,
  0.95, 0.9, 0.72, 0.5, 0.38, 0.28,
];

const DISTRICTS = [
  { en: "Central and Western", zh: ["中西", "中環", "上環", "西環"], enKeys: ["central and western", "central", "sheung wan", "sai ying pun"] },
  { en: "Wan Chai", zh: ["灣仔", "銅鑼灣", "跑馬地"], enKeys: ["wan chai", "causeway bay", "happy valley"] },
  { en: "Eastern", zh: ["東區", "太古", "鰂魚涌", "杏花邨", "柴灣"], enKeys: ["eastern district", "quarry bay", "chai wan", "taikoo"] },
  { en: "Southern", zh: ["南區", "香港仔", "鴨脷洲", "薄扶林"], enKeys: ["southern", "aberdeen", "pok fu lam"] },
  { en: "Yau Tsim Mong", zh: ["油尖旺", "油麻地", "尖沙咀", "旺角", "佐敦"], enKeys: ["yau tsim", "tsim sha tsui", "mong kok", "jordan"] },
  { en: "Sham Shui Po", zh: ["深水埗", "長沙灣", "荔枝角"], enKeys: ["sham shui po", "cheung sha wan"] },
  { en: "Kowloon City", zh: ["九龍城", "紅磡", "土瓜灣", "何文田"], enKeys: ["kowloon city", "hung hom", "to kwa wan"] },
  { en: "Wong Tai Sin", zh: ["黃大仙", "鑽石山"], enKeys: ["wong tai sin"] },
  { en: "Kwun Tong", zh: ["觀塘", "牛頭角", "藍田", "油塘"], enKeys: ["kwun tong", "ngau tau kok", "lam tin", "yau tong"] },
  { en: "Kwai Tsing", zh: ["葵青", "葵涌", "青衣"], enKeys: ["kwai tsing", "kwai chung", "tsing yi"] },
  { en: "Tsuen Wan", zh: ["荃灣"], enKeys: ["tsuen wan"] },
  { en: "Tuen Mun", zh: ["屯門"], enKeys: ["tuen mun"] },
  { en: "Yuen Long", zh: ["元朗", "天水圍"], enKeys: ["yuen long", "tin shui wai"] },
  { en: "North", zh: ["北區", "上水", "粉嶺"], enKeys: ["sheung shui", "fanling", "north district"] },
  { en: "Tai Po", zh: ["大埔"], enKeys: ["tai po"] },
  { en: "Sha Tin", zh: ["沙田", "馬鞍山"], enKeys: ["sha tin", "shatin", "ma on shan"] },
  { en: "Sai Kung", zh: ["西貢", "將軍澳"], enKeys: ["sai kung", "tseung kwan o"] },
  { en: "Islands", zh: ["離島", "東涌"], enKeys: ["islands", "tung chung"] },
];

export function hkHour(date) {
  const text = date.toLocaleString("en-GB", { timeZone: "Asia/Hong_Kong", hour: "2-digit", hourCycle: "h23" });
  return Number(text);
}

export function hkDow(date) {
  const text = date.toLocaleString("en-US", { timeZone: "Asia/Hong_Kong", weekday: "short" });
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(text);
}

export function haversine(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function districtKey(park) {
  return String(park.district?.en || park.district?.zh || "")
    .replace(/ District$/i, "")
    .replace("&", "and")
    .replace(/\s+/g, " ")
    .trim();
}

function emptyHistory() {
  return { parks: {}, city: [] };
}

export function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return emptyHistory();
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return emptyHistory();
    data.parks = data.parks || {};
    data.city = Array.isArray(data.city) ? data.city : [];
    return data;
  } catch {
    return emptyHistory();
  }
}

function saveHistory(data) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(data));
    return true;
  } catch {
    // Quota can fail on a long session. Keep the newest half and retry once.
    const slim = { parks: {}, city: data.city.slice(-12) };
    for (const [id, points] of Object.entries(data.parks)) slim.parks[id] = points.slice(-12);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(slim));
      return true;
    } catch {
      return false;
    }
  }
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

export function remember(parks) {
  const data = loadHistory();
  const bucket = Math.floor(Date.now() / BUCKET_MS) * BUCKET_MS;
  let available = 0;
  let capacity = 0;
  let full = 0;
  let counted = 0;

  for (const park of parks) {
    const vehicle = park.vehicles?.privateCar;
    if (!vehicle || vehicle.vacancy == null || vehicle.kind === "B") continue;
    const point = { t: bucket, v: vehicle.vacancy, c: vehicle.space ?? null };
    const list = data.parks[park.id] || [];
    if (list.length && list[list.length - 1].t === bucket) list[list.length - 1] = point;
    else list.push(point);
    data.parks[park.id] = list.slice(-MAX_POINTS);
    available += vehicle.vacancy;
    if (vehicle.space > 0) capacity += vehicle.space;
    if (vehicle.vacancy <= 0 || vehicle.kind === "C") full += 1;
    counted += 1;
  }

  const cityPoint = { t: bucket, v: available, c: capacity || null, full, n: counted };
  if (data.city.length && data.city[data.city.length - 1].t === bucket) data.city[data.city.length - 1] = cityPoint;
  else data.city.push(cityPoint);
  data.city = data.city.slice(-MAX_POINTS);
  saveHistory(data);
  return data;
}

function pressureAt(date, ctx) {
  let pressure = PRIOR_PRESSURE[hkHour(date)] ?? 0.5;
  const dow = hkDow(date);
  const hour = hkHour(date);
  if (ctx?.holiday || dow === 0) {
    if (hour >= 10 && hour <= 19) pressure += 0.06;
  } else if (dow === 6) {
    if (hour >= 11 && hour <= 20) pressure += 0.04;
  }
  if (ctx?.veryHot && hour >= 11 && hour <= 18) pressure += 0.04;
  if (ctx?.rain) pressure += 0.07;
  return Math.min(0.98, Math.max(0.05, pressure));
}

function dampedTrend(points) {
  if (!points || points.length < 4) return 0;
  const first = points[0];
  const last = points[points.length - 1];
  const hours = (last.t - first.t) / 36e5;
  if (hours < 0.4) return 0;
  return (last.v - first.v) / hours;
}

// Seasonal prior, shrunk toward the observed mean for that hour, plus a damped trend.
export function projectVacancy(current, capacity, fromDate, toDate, history, ctx) {
  if (current == null || !Number.isFinite(Number(current))) return null;
  const fromP = pressureAt(fromDate, ctx);
  const toP = pressureAt(toDate, ctx);
  const fromFree = Math.max(0.08, 1 - fromP);
  const toFree = Math.max(0.08, 1 - toP);
  let seasonal = Number(current) * (toFree / fromFree);
  const targetHour = hkHour(toDate);
  const sameHour = (history || []).filter((point) => point.v != null && hkHour(new Date(point.t)) === targetHour);
  let weight = 0;
  if (sameHour.length) {
    const mean = sameHour.reduce((sum, point) => sum + point.v, 0) / sameHour.length;
    weight = Math.min(1, sameHour.length / 8);
    seasonal = weight * mean + (1 - weight) * seasonal;
  }
  const hoursAhead = (toDate.getTime() - fromDate.getTime()) / 36e5;
  const trend = dampedTrend(history) * hoursAhead * 0.35;
  let value = seasonal + trend;
  if (capacity != null && capacity > 0) value = Math.min(capacity, value);
  value = Math.max(0, value);
  let confidence = "low";
  if (weight >= 0.7 && (history || []).length >= 8) confidence = "high";
  else if (weight > 0 || (history || []).length >= 4) confidence = "medium";
  return {
    value,
    weight,
    confidence,
    method: weight > 0 ? "blend" : "prior",
  };
}

export function projectSeries(current, capacity, history, ctx, steps = 6) {
  const now = new Date();
  const series = [{ hour: hkHour(now), offset: 0, value: Number(current), method: "now", confidence: "high" }];
  for (let step = 1; step <= steps; step += 1) {
    const at = new Date(now.getTime() + step * 3600000);
    const projected = projectVacancy(current, capacity, now, at, history, ctx);
    if (!projected) break;
    series.push({ hour: hkHour(at), offset: step, at, ...projected });
  }
  return series;
}

export function backtestSeries(points, ctx) {
  if (!points || points.length < 4) return null;
  let abs = 0;
  let n = 0;
  for (let i = 0; i < points.length; i += 1) {
    const later = points.find((point, index) => index > i && point.t - points[i].t >= 45 * 60 * 1000 && point.t - points[i].t <= 100 * 60 * 1000);
    if (!later || points[i].v == null || later.v == null) continue;
    const predicted = projectVacancy(points[i].v, points[i].c, new Date(points[i].t), new Date(later.t), points.slice(0, i), ctx);
    if (!predicted) continue;
    abs += Math.abs(predicted.value - later.v);
    n += 1;
  }
  if (!n) return null;
  return { mae: abs / n, n };
}

export function liveSummary(parks, vehicle = "privateCar") {
  let spaces = 0;
  let capacity = 0;
  let withCapacity = 0;
  let full = 0;
  let ev = 0;
  let disabled = 0;
  let numeric = 0;
  const byDistrict = new Map();
  const byVehicle = {};

  for (const park of parks) {
    for (const [key, record] of Object.entries(park.vehicles || {})) {
      if (record?.vacancy == null) continue;
      byVehicle[key] = (byVehicle[key] || 0) + record.vacancy;
    }
    const record = park.vehicles?.[vehicle];
    if (!record || record.vacancy == null) continue;
    numeric += 1;
    spaces += record.vacancy;
    ev += record.vacancyEV || 0;
    disabled += record.vacancyDIS || 0;
    if (record.vacancy <= 0 || record.kind === "C") full += 1;
    if (record.space > 0) {
      capacity += record.space;
      withCapacity += 1;
    }
    const key = districtKey(park) || "—";
    const bucket = byDistrict.get(key) || { key, zh: park.district.zh, en: park.district.en, spaces: 0, parks: 0 };
    bucket.spaces += record.vacancy;
    bucket.parks += 1;
    byDistrict.set(key, bucket);
  }

  const districts = [...byDistrict.values()].sort((a, b) => b.spaces - a.spaces);
  const util = capacity > 0 ? 1 - spaces / capacity : null;
  return { spaces, capacity, withCapacity, full, ev, disabled, numeric, util, districts, byVehicle };
}

export function filterParks(parks, filters) {
  const query = String(filters.q || "").trim().toLowerCase();
  const vehicle = filters.vehicle || "privateCar";
  const rows = parks.filter((park) => {
    if (filters.district && filters.district !== "all" && districtKey(park) !== filters.district) return false;
    if (filters.nature && filters.nature !== "all" && park.nature !== filters.nature) return false;
    if (filters.openOnly && park.opening === "CLOSED") return false;
    const record = park.vehicles?.[vehicle];
    if (filters.availableOnly) {
      if (!record || record.kind === "C" || record.vacancy == null || record.vacancy <= 0) return false;
    }
    if (filters.evOnly) {
      const matched = park.facilities?.includes("evCharger") || record?.vacancyEV > 0 || record?.spaceEV > 0;
      if (!matched) return false;
    }
    if (filters.disOnly) {
      const matched = park.facilities?.includes("disabilities") || record?.vacancyDIS > 0 || record?.spaceDIS > 0;
      if (!matched) return false;
    }
    if (query) {
      const blob = `${park.name.zh} ${park.name.en} ${park.address.zh} ${park.address.en} ${park.district.zh} ${park.district.en}`.toLowerCase();
      if (!blob.includes(query)) return false;
    }
    return true;
  });

  rows.sort((a, b) => compareParks(a, b, filters.sort, vehicle, filters.origin));
  return rows;
}

function vacancyOf(park, vehicle) {
  const record = park.vehicles?.[vehicle];
  if (!record || record.vacancy == null) return -1;
  return record.vacancy;
}

function compareParks(a, b, sort, vehicle, origin) {
  if (sort === "name") {
    return `${a.name.zh}${a.name.en}`.localeCompare(`${b.name.zh}${b.name.en}`, "zh-Hant");
  }
  if (sort === "price") {
    const pa = a.vehicles?.[vehicle]?.price;
    const pb = b.vehicles?.[vehicle]?.price;
    if (pa == null && pb == null) return vacancyOf(b, vehicle) - vacancyOf(a, vehicle);
    if (pa == null) return 1;
    if (pb == null) return -1;
    return pa - pb;
  }
  if (sort === "distance" && origin) {
    return haversine(origin, a) - haversine(origin, b);
  }
  return vacancyOf(b, vehicle) - vacancyOf(a, vehicle);
}

function ageHours(updated) {
  const match = String(updated || "").match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!match) return null;
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]) - 8, Number(match[5]));
  return (Date.now() - utc) / 36e5;
}

function findDistrict(query) {
  const lower = query.toLowerCase();
  return DISTRICTS.find((item) => item.zh.some((alias) => query.includes(alias)) || item.enKeys.some((alias) => lower.includes(alias))) || null;
}

function detectIntent(query) {
  const original = query.trim();
  const lower = original.toLowerCase();
  const district = findDistrict(original);
  let vehicle = "privateCar";
  if (/電單車|電單|motorcycle|motor cycle/.test(lower) || /電單車|電單/.test(original)) vehicle = "motorCycle";
  else if (/旅遊巴|coach/.test(lower) || /旅遊巴/.test(original)) vehicle = "coach";
  else if (/貨櫃|\bcv\b/.test(lower)) vehicle = "CV";
  else if (/重型貨車|\bhgv\b/.test(lower) || /重型貨車/.test(original)) vehicle = "HGV";
  else if (/輕型貨車|\blgv\b|貨車/.test(lower) || /貨車/.test(original)) vehicle = "LGV";

  const intent = {
    vehicle,
    district,
    ev: /電動|充電|\bev\b/.test(lower) || /電動|充電/.test(original),
    disabled: /殘疾|傷殘|disabled|wheelchair/.test(lower) || /殘疾|傷殘/.test(original),
    cheap: /平|便宜|cheap|時租/.test(lower) || /平|便宜|時租/.test(original),
    nearest: /最近|附近|nearest|near me/.test(lower) || /最近|附近/.test(original),
    forecast: /預測|forecast|小時後/.test(lower) || /預測/.test(original),
    government: /政府|government/.test(lower) || /政府/.test(original),
  };

  let text = original;
  const strips = [/電動車位/g, /電動/g, /充電/g, /殘疾人士/g, /殘疾/g, /傷殘/g, /電單車/g, /電單/g, /輕型貨車/g, /重型貨車/g, /貨車/g, /旅遊巴/g, /貨櫃/g, /停車場/g, /車位/g, /咪錶/g, /附近/g, /最近/g, /便宜/g, /時租/g, /預測/g, /政府/g, /商場/g, /商業/g, /有位/g, /幫我/g, /我想/g, /找/g, /的/g];
  for (const pattern of strips) text = text.replace(pattern, " ");
  if (district) {
    for (const alias of district.zh) text = text.replaceAll(alias, " ");
    for (const alias of district.enKeys) text = text.replace(new RegExp(alias, "ig"), " ");
  }
  text = text.replace(/parking|car\s*park|carpark|spaces?|hourly|cheap|nearest|near me|disabled|wheelchair|motorcycle|forecast|government|commercial|ev\b|please/ig, " ");
  text = text.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (text.length < 2) text = "";
  intent.text = text;
  return intent;
}

function scoreOne(park, intent, origin, ctx, history) {
  const record = park.vehicles?.[intent.vehicle];
  if (intent.district && districtKey(park) !== intent.district.en && !(park.district.zh || "").includes(intent.district.zh[0])) {
    // Chinese district labels on basic-info parks may not match the English key.
    const zhHit = intent.district.zh.some((alias) => `${park.district.zh}${park.address.zh}${park.name.zh}`.includes(alias));
    const enHit = districtKey(park) === intent.district.en;
    if (!zhHit && !enHit) return null;
  }
  if (intent.ev && !(park.facilities?.includes("evCharger") || record?.vacancyEV > 0 || record?.spaceEV > 0)) return null;
  if (intent.disabled && !(park.facilities?.includes("disabilities") || record?.vacancyDIS > 0 || record?.spaceDIS > 0)) return null;
  if (intent.government && park.nature && park.nature !== "government") return null;
  if (intent.text) {
    const blob = `${park.name.zh} ${park.name.en} ${park.address.zh} ${park.address.en}`.toLowerCase();
    if (!blob.includes(intent.text.toLowerCase())) return null;
  }
  if ((intent.cheap || intent.nearest) && record && record.vacancy === 0) return null;

  let vacancyScore = 0.3;
  if (!record || record.kind === "C") vacancyScore = 0.05;
  else if (record.space > 0 && record.vacancy != null) vacancyScore = Math.min(1, record.vacancy / Math.max(8, record.space * 0.35));
  else if (record.vacancy != null) vacancyScore = Math.min(1, record.vacancy / 25);

  let km = null;
  let distanceScore = 0.45;
  if (origin && Number.isFinite(park.lat) && Number.isFinite(park.lng)) {
    km = haversine(origin, park);
    distanceScore = Math.max(0, 1 - km / (intent.nearest ? 8 : 15));
  }

  const age = ageHours(record?.updated);
  const freshScore = age == null ? 0.45 : age < 1 ? 1 : age < 3 ? 0.65 : 0.2;
  let priceScore = 0.5;
  if (record?.price != null) priceScore = Math.max(0, 1 - record.price / 40);
  else if (intent.cheap) priceScore = 0.15;

  const weights = intent.nearest
    ? { vacancy: 0.28, distance: 0.46, fresh: 0.1, price: 0.08, facility: 0.08 }
    : intent.cheap
      ? { vacancy: 0.3, distance: 0.16, fresh: 0.1, price: 0.36, facility: 0.08 }
      : { vacancy: 0.46, distance: 0.22, fresh: 0.14, price: 0.08, facility: 0.1 };

  let facility = 0.35;
  if (intent.ev) facility = 1;
  if (intent.disabled) facility = 1;

  const score = 100 * (
    weights.vacancy * vacancyScore +
    weights.distance * distanceScore +
    weights.fresh * freshScore +
    weights.price * priceScore +
    weights.facility * facility
  );

  const reasons = [];
  if (record?.vacancy != null) reasons.push({ code: "vacancy", vars: { n: String(record.vacancy) } });
  if (km != null) reasons.push({ code: "distance", vars: { km: km.toFixed(1) } });
  if (record?.price != null) reasons.push({ code: "price", vars: { n: String(record.price) } });
  if (intent.ev) reasons.push({ code: "ev" });
  if (intent.disabled) reasons.push({ code: "disabled" });
  if (age != null && age > 3) reasons.push({ code: "stale" });

  let forecast = null;
  if (intent.forecast && record?.vacancy != null) {
    const points = history?.parks?.[park.id] || [];
    forecast = projectSeries(record.vacancy, record.space, points, ctx, 2);
  }

  return { park, score, reasons, km, forecast };
}

export function answerQuery(query, parks, origin, ctx, history) {
  const intent = detectIntent(query);
  if (!query.trim()) return { intent, results: [], relaxed: false };
  let results = parks
    .map((park) => scoreOne(park, intent, origin, ctx, history))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  let relaxed = false;
  if (!results.length && intent.text) {
    const loose = { ...intent, text: "" };
    results = parks
      .map((park) => scoreOne(park, loose, origin, ctx, history))
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
    relaxed = results.length > 0;
  }
  return { intent, results, relaxed };
}

export function moverLists(parks, history, ctx) {
  const filling = [];
  const freeing = [];
  for (const park of parks) {
    const record = park.vehicles?.privateCar;
    if (!record || record.vacancy == null || record.kind === "B") continue;
    const points = history?.parks?.[park.id] || [];
    const series = projectSeries(record.vacancy, record.space, points, ctx, 2);
    const next = series.find((point) => point.offset === 2);
    if (!next) continue;
    const delta = next.value - record.vacancy;
    const row = { park, now: record.vacancy, next: next.value, delta };
    if (delta <= -3) filling.push(row);
    if (delta >= 3) freeing.push(row);
  }
  filling.sort((a, b) => a.delta - b.delta);
  freeing.sort((a, b) => b.delta - a.delta);
  return { filling: filling.slice(0, 6), freeing: freeing.slice(0, 6) };
}
