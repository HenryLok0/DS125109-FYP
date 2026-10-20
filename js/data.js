// Loads Hong Kong open data in the browser. GitHub Pages has no server,
// so every source here must allow cross-origin reads or ship as a local file.

export const VEHICLES = ["privateCar", "LGV", "HGV", "CV", "coach", "motorCycle"];

const ONESTOP = "https://api.data.gov.hk/v1/carpark-info-vacancy";
const VEHICLE_QUERY = VEHICLES.join(",");

export const SOURCES = [
  { id: "info", url: `${ONESTOP}?data=info&vehicleTypes=${VEHICLE_QUERY}&lang=zh_TW` },
  { id: "info-en", url: `${ONESTOP}?data=info&vehicleTypes=${VEHICLE_QUERY}&lang=en_US` },
  { id: "vacancy", url: `${ONESTOP}?data=vacancy&vehicleTypes=${VEHICLE_QUERY}&lang=en_US` },
  { id: "basic", url: "https://resource.data.one.gov.hk/td/carpark/basic_info_all.json" },
  { id: "basic-vacancy", url: "https://resource.data.one.gov.hk/td/carpark/vacancy_all.json" },
  { id: "meters", url: "https://resource.data.one.gov.hk/td/psiparkingspaces/spaceinfo/parkingspaces.csv" },
  { id: "meter-status", url: "https://resource.data.one.gov.hk/td/psiparkingspaces/occupancystatus/occupancystatus.csv" },
  { id: "nonmeter", url: "https://data.nmospiot.gov.hk/api/pvds/Download/parkingspace" },
  { id: "nonmeter-status", url: "https://data.nmospiot.gov.hk/api/pvds/Download/occupancystatus" },
  { id: "street-hki-tc", url: "https://www.td.gov.hk/datagovhk_td/metered-parking-spaces/resources/tc/hki_parking_spaces_chi.csv" },
  { id: "street-kln-tc", url: "https://www.td.gov.hk/datagovhk_td/metered-parking-spaces/resources/tc/kln_parking_spaces_chi.csv" },
  { id: "street-nt-tc", url: "https://www.td.gov.hk/datagovhk_td/metered-parking-spaces/resources/tc/nt_parking_spaces_chi.csv" },
  { id: "street-hki-en", url: "https://www.td.gov.hk/datagovhk_td/metered-parking-spaces/resources/en/hki_parking_spaces_eng.csv" },
  { id: "street-kln-en", url: "https://www.td.gov.hk/datagovhk_td/metered-parking-spaces/resources/en/kln_parking_spaces_eng.csv" },
  { id: "street-nt-en", url: "https://www.td.gov.hk/datagovhk_td/metered-parking-spaces/resources/en/nt_parking_spaces_eng.csv" },
  { id: "book-hki-tc", url: "https://www.td.gov.hk/datagovhk_td/metered-parking-spaces/resources/tc/hki_parking_spaces_chi.xlsx" },
  { id: "book-hki-en", url: "https://www.td.gov.hk/datagovhk_td/metered-parking-spaces/resources/en/hki_parking_spaces_eng.xlsx" },
  { id: "book-kln-tc", url: "https://www.td.gov.hk/datagovhk_td/metered-parking-spaces/resources/tc/kln_parking_spaces_chi.xlsx" },
  { id: "book-kln-en", url: "https://www.td.gov.hk/datagovhk_td/metered-parking-spaces/resources/en/kln_parking_spaces_eng.xlsx" },
  { id: "book-nt-tc", url: "https://www.td.gov.hk/datagovhk_td/metered-parking-spaces/resources/tc/nt_parking_spaces_chi.xlsx" },
  { id: "book-nt-en", url: "https://www.td.gov.hk/datagovhk_td/metered-parking-spaces/resources/en/nt_parking_spaces_eng.xlsx" },
  { id: "cam-tc", url: "https://static.data.gov.hk/td/traffic-snapshot-images/code/Traffic_Camera_Locations_Tc.xml" },
  { id: "cam-en", url: "https://static.data.gov.hk/td/traffic-snapshot-images/code/Traffic_Camera_Locations_En.xml" },
  { id: "notice-closure", url: "https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Temporary_Road_Closure.xml" },
  { id: "notice-speed", url: "https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Temporary_Speed_Limits.xml" },
  { id: "notice-zone", url: "https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Prohibited_Zone.xml" },
  { id: "notice-clearway", url: "https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Clearways.xml" },
  { id: "notice-express", url: "https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Expressways.xml" },
  { id: "notice-transport", url: "https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Public_Transports.xml" },
  { id: "notice-arrange", url: "https://www.td.gov.hk/datagovhk_tis/traffic-notices/Special_Traffic_and_Transport_Arrangement.xml" },
  { id: "notice-other", url: "https://www.td.gov.hk/datagovhk_tis/traffic-notices/Other_Notices.xml" },
  { id: "news-tc", url: "https://www.td.gov.hk/tc/special_news/trafficnews.xml" },
  { id: "news-en", url: "https://www.td.gov.hk/en/special_news/trafficnews.xml" },
  { id: "news-open-tc", url: "https://resource.data.one.gov.hk/td/tc/specialtrafficnews.xml" },
  { id: "news-open-en", url: "https://resource.data.one.gov.hk/td/en/specialtrafficnews.xml" },
  { id: "table61-tc", url: "https://www.td.gov.hk/datagovhk_tis/mttd-csv/tc/table61_tc.csv" },
  { id: "table61-en", url: "https://www.td.gov.hk/datagovhk_tis/mttd-csv/en/table61_eng.csv" },
  { id: "table62-tc", url: "https://www.td.gov.hk/datagovhk_tis/mttd-csv/tc/table62_tc.csv" },
  { id: "table62-en", url: "https://www.td.gov.hk/datagovhk_tis/mttd-csv/en/table62_eng.csv" },
  { id: "weather", url: "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=tc" },
  { id: "weather-en", url: "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=en" },
  { id: "warnings", url: "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warnsum&lang=en" },
  { id: "forecast-tc", url: "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=fnd&lang=tc" },
  { id: "forecast-en", url: "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=fnd&lang=en" },
  { id: "holidays", url: "https://www.1823.gov.hk/common/ical/en.json" },
];

const NOTICE_FEEDS = [
  ["closure", "notice-closure"],
  ["speed", "notice-speed"],
  ["zone", "notice-zone"],
  ["clearway", "notice-clearway"],
  ["express", "notice-express"],
  ["transport", "notice-transport"],
  ["arrange", "notice-arrange"],
  ["other", "notice-other"],
];

const BASIC_TYPE = {
  P: "privateCar",
  PC: "privateCar",
  L: "LGV",
  LGV: "LGV",
  H: "HGV",
  HGV: "HGV",
  M: "motorCycle",
  MC: "motorCycle",
  C: "coach",
  CV: "CV",
};

const status = {};
const memory = { at: 0 };

export function sourceStatus() {
  return { ...status };
}

export function sourceUrl(id) {
  return SOURCES.find((item) => item.id === id)?.url || "";
}

function mark(id, ok, error) {
  status[id] = { ok, error: error ? String(error) : "" };
}

async function getText(id, maxAge = 0) {
  const url = sourceUrl(id);
  if (maxAge && memory[id] && Date.now() - memory[id].at < maxAge) return memory[id].text;
  const started = Date.now();
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${response.status}`);
  const text = await response.text();
  memory[id] = { at: started, text };
  mark(id, true, "");
  return text;
}

async function getJson(id, maxAge = 0) {
  const text = await getText(id, maxAge);
  return JSON.parse(text);
}

async function settle(id, parser, maxAge = 0) {
  try {
    const text = await getText(id, maxAge);
    return parser(text);
  } catch (error) {
    mark(id, false, error.message || error);
    return null;
  }
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const src = String(text || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i += 1) {
    const char = src[i];
    if (quoted) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") cell += char;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((item) => item.some((value) => String(value).trim() !== ""));
}

function headerIndex(rows, token) {
  return rows.findIndex((row) => row.some((cell) => String(cell).trim() === token));
}

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asObject(value) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] : value;
}

function sumField(entries, field) {
  return entries.reduce((sum, entry) => {
    const value = Number(entry[field]);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

function readVacancy(entries) {
  if (!Array.isArray(entries) || !entries.length) return null;
  const numeric = entries.filter((entry) => entry.vacancy_type === "A");
  if (numeric.length) {
    return {
      kind: "A",
      vacancy: sumField(numeric, "vacancy"),
      vacancyEV: sumField(numeric, "vacancyEV"),
      vacancyDIS: sumField(numeric, "vacancyDIS"),
      vacancyUNL: sumField(numeric, "vacancyUNL"),
      updated: numeric.map((entry) => entry.lastupdate).filter(Boolean).sort().at(-1) || "",
    };
  }
  if (entries.every((entry) => entry.vacancy_type === "C")) {
    return { kind: "C", vacancy: 0, vacancyEV: 0, vacancyDIS: 0, vacancyUNL: 0, updated: entries[0].lastupdate || "" };
  }
  return { kind: "B", vacancy: null, vacancyEV: null, vacancyDIS: null, vacancyUNL: null, updated: entries[0].lastupdate || "" };
}

function hourlyPrice(block) {
  const charges = block?.hourlyCharges || [];
  for (const charge of charges) {
    if (Number.isFinite(Number(charge.price))) return Number(charge.price);
    const threshold = charge.usageThresholds?.[0]?.price;
    if (Number.isFinite(Number(threshold))) return Number(threshold);
  }
  return null;
}

function supplyOf(block) {
  const source = asObject(block);
  if (!source) return {};
  return {
    space: num(source.space),
    spaceEV: num(source.spaceEV),
    spaceDIS: num(source.spaceDIS),
    price: hourlyPrice(source),
  };
}

function inHongKong(lat, lng) {
  return lat >= 22.08 && lat <= 22.62 && lng >= 113.75 && lng <= 114.5;
}

function httpsPhoto(url) {
  return String(url || "").replace(/^http:\/\//i, "https://");
}

function blankPark(id, source) {
  return {
    id,
    source,
    name: { zh: "", en: "" },
    address: { zh: "", en: "" },
    district: { zh: "", en: "" },
    region: { zh: "", en: "" },
    lat: null,
    lng: null,
    nature: "",
    type: "",
    phone: "",
    website: "",
    opening: "",
    height: null,
    facilities: [],
    payments: [],
    openingHours: [],
    photo: "",
    vehicles: {},
  };
}

function applySide(park, record, lang) {
  if (!record) return;
  park.name[lang] = record.name || park.name[lang];
  park.address[lang] = record.displayAddress || park.address[lang];
  park.district[lang] = record.district || record.address?.dcDistrict || park.district[lang];
  park.region[lang] = record.address?.region || park.region[lang];
  if (lang === "en") {
    park.nature = record.nature || park.nature;
    park.type = record.carpark_Type || park.type;
    park.phone = record.contactNo || park.phone;
    park.website = record.website || park.website;
    park.opening = record.opening_status || park.opening;
    park.facilities = Array.isArray(record.facilities) ? record.facilities : park.facilities;
    park.payments = Array.isArray(record.paymentMethods) ? record.paymentMethods : park.payments;
    park.openingHours = Array.isArray(record.openingHours) ? record.openingHours : park.openingHours;
    const height = record.heightLimits?.[0]?.height;
    park.height = num(height);
    park.lat = num(record.latitude);
    park.lng = num(record.longitude);
    for (const key of VEHICLES) {
      const vac = readVacancy(null);
      const supply = supplyOf(record[key]);
      if (!supply.space && supply.price == null && !record[key]) continue;
      park.vehicles[key] = {
        kind: "A",
        vacancy: null,
        vacancyEV: null,
        vacancyDIS: null,
        vacancyUNL: null,
        updated: "",
        ...supply,
      };
    }
  }
}

function mergeVacancy(park, record) {
  if (!record) return;
  for (const key of VEHICLES) {
    const vac = readVacancy(record[key]);
    if (!vac) continue;
    park.vehicles[key] = { ...(park.vehicles[key] || {}), ...vac };
  }
}

function buildOnestop(zhList, enList, vacList) {
  const zh = new Map((zhList || []).map((item) => [String(item.park_Id), item]));
  const en = new Map((enList || []).map((item) => [String(item.park_Id), item]));
  const vac = new Map((vacList || []).map((item) => [String(item.park_Id), item]));
  const ids = new Set([...zh.keys(), ...en.keys(), ...vac.keys()]);
  const parks = [];
  for (const id of ids) {
    const park = blankPark(`os-${id}`, "onestop");
    applySide(park, en.get(id) || zh.get(id), "en");
    applySide(park, zh.get(id), "zh");
    if (!park.name.en) park.name.en = en.get(id)?.name || zh.get(id)?.name || id;
    if (!park.name.zh) park.name.zh = zh.get(id)?.name || park.name.en;
    if (!park.address.zh) park.address.zh = park.address.en;
    if (!park.district.zh) park.district.zh = park.district.en;
    mergeVacancy(park, vac.get(id));
    if (!inHongKong(park.lat, park.lng)) continue;
    parks.push(park);
  }
  return parks;
}

function basicVacancyMap(payload) {
  const map = new Map();
  for (const item of payload?.car_park || []) {
    const vehicles = {};
    for (const group of item.vehicle_type || []) {
      const key = BASIC_TYPE[group.type] || null;
      const categories = group.service_category || [];
      const chosen = categories.find((row) => row.category === "HOURLY") || categories[0];
      if (!chosen || !key) continue;
      const vac = readVacancy([chosen]);
      if (!vac) continue;
      if (group.type === "P_D") {
        vehicles.privateCar = vehicles.privateCar || { kind: vac.kind, vacancy: null, vacancyEV: 0, vacancyDIS: 0, vacancyUNL: 0, updated: vac.updated };
        vehicles.privateCar.vacancyDIS = (vehicles.privateCar.vacancyDIS || 0) + (vac.vacancy || 0);
        continue;
      }
      vehicles[key] = { ...(vehicles[key] || {}), ...vac };
    }
    map.set(item.park_id, vehicles);
  }
  return map;
}

function buildBasic(payload, vacancyMap) {
  const parks = [];
  for (const item of payload?.car_park || []) {
    const lat = num(item.latitude);
    const lng = num(item.longitude);
    if (!inHongKong(lat, lng)) continue;
    const park = blankPark(`td-${item.park_id}`, "basic");
    park.name = { zh: item.name_tc || item.name_en || item.park_id, en: item.name_en || item.name_tc || item.park_id };
    park.address = { zh: item.displayAddress_tc || "", en: item.displayAddress_en || "" };
    park.district = { zh: item.district_tc || "", en: item.district_en || "" };
    park.lat = lat;
    park.lng = lng;
    park.phone = item.contactNo || "";
    park.website = item.website_en || item.website_tc || "";
    park.opening = item.opening_status || "";
    park.height = num(item.height) || null;
    park.photo = httpsPhoto(item.carpark_photo);
    park.vehicles = vacancyMap.get(item.park_id) || {};
    parks.push(park);
  }
  return parks;
}

function gridKey(lat, lng) {
  return `${Math.round(lat * 1000)},${Math.round(lng * 1000)}`;
}

function dedupe(live, extra) {
  const grid = new Set();
  for (const park of live) grid.add(gridKey(park.lat, park.lng));
  const kept = [];
  for (const park of extra) {
    let near = false;
    for (let dx = -1; dx <= 1 && !near; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        if (grid.has(`${Math.round(park.lat * 1000) + dx},${Math.round(park.lng * 1000) + dy}`)) near = true;
      }
    }
    if (!near) kept.push(park);
  }
  return kept;
}

function attachPhotos(live, extra) {
  for (const park of live) {
    if (park.photo) continue;
    let best = null;
    let bestD = 0.0008 ** 2;
    for (const item of extra) {
      if (!item.photo) continue;
      const dLat = park.lat - item.lat;
      const dLng = park.lng - item.lng;
      const dist = dLat * dLat + dLng * dLng;
      if (dist < bestD) {
        best = item;
        bestD = dist;
      }
    }
    if (best) park.photo = best.photo;
  }
}

export async function loadCarparks() {
  const infoAge = 30 * 60 * 1000;
  const [zh, en, vac, basic, basicVac] = await Promise.all([
    settle("info", (text) => JSON.parse(text).results || [], infoAge),
    settle("info-en", (text) => JSON.parse(text).results || [], infoAge),
    settle("vacancy", (text) => JSON.parse(text).results || []),
    settle("basic", (text) => JSON.parse(text), infoAge),
    settle("basic-vacancy", (text) => JSON.parse(text)),
  ]);
  const live = buildOnestop(zh || [], en || [], vac || []);
  const catalogue = basic ? buildBasic(basic, basicVacancyMap(basicVac || {})) : [];
  attachPhotos(live, catalogue);
  const parks = [...live, ...dedupe(live, catalogue)];
  return { parks, live: live.length, catalogue: parks.length - live.length };
}

function rowObjects(text, token) {
  const rows = parseCsv(text);
  const index = headerIndex(rows, token);
  if (index < 0) return [];
  const header = rows[index].map((cell) => cell.trim());
  return rows.slice(index + 1).map((row) => {
    const item = {};
    header.forEach((key, cellIndex) => {
      item[key] = row[cellIndex] ?? "";
    });
    return item;
  });
}

export async function loadMeters() {
  const [spaces, occupancy] = await Promise.all([
    settle("meters", (text) => rowObjects(text, "ParkingSpaceId")),
    settle("meter-status", (text) => rowObjects(text, "ParkingSpaceId")),
  ]);
  const occ = new Map();
  for (const row of occupancy || []) occ.set(row.ParkingSpaceId, row);
  const meters = [];
  for (const row of spaces || []) {
    const lat = num(row.Latitude);
    const lng = num(row.Longitude);
    if (!inHongKong(lat, lng)) continue;
    const state = occ.get(row.ParkingSpaceId);
    meters.push({
      id: row.ParkingSpaceId,
      lat,
      lng,
      street: { zh: row.Street_tc || row.Street || "", en: row.Street || "" },
      section: { zh: row.SectionOfStreet_tc || "", en: row.SectionOfStreet || "" },
      district: { zh: row.District_tc || "", en: row.District || "" },
      region: { zh: row.Region_tc || "", en: row.Region || "" },
      vehicleType: row.VehicleType || "",
      period: row.OperatingPeriod || "",
      minutes: num(row.TimeUnit),
      fee: num(row.PaymentUnit),
      maxStay: num(row.LPP),
      occupancy: state?.OccupancyStatus || "",
      meterStatus: state?.ParkingMeterStatus || "",
      occupiedAt: state?.OccupancyDateChanged || "",
      kind: "meter",
    });
  }
  return meters;
}

export async function loadNonMetered() {
  const spaces = await settle("nonmeter", (text) => rowObjects(text, "ParkingSpaceId"));
  if (!spaces) return [];
  const occupancy = await settle("nonmeter-status", (text) => rowObjects(text, "ParkingSpaceId"));
  const occ = new Map((occupancy || []).map((row) => [row.ParkingSpaceId, row]));
  return spaces.map((row) => {
    const lat = num(row.Latitude);
    const lng = num(row.Longitude);
    if (!inHongKong(lat, lng)) return null;
    const state = occ.get(row.ParkingSpaceId);
    return {
      id: row.ParkingSpaceId,
      lat,
      lng,
      street: { zh: row.Street_tc || row.Street || "", en: row.Street || "" },
      section: { zh: row.SectionOfStreet_tc || "", en: row.SectionOfStreet || "" },
      district: { zh: row.District_tc || "", en: row.District || "" },
      region: { zh: row.Region_tc || "", en: row.Region || "" },
      vehicleType: row.VehicleType || "",
      period: "",
      minutes: null,
      fee: null,
      maxStay: null,
      occupancy: state?.OccupancyStatus || "",
      meterStatus: "",
      occupiedAt: state?.OccupancyDateChanged || "",
      kind: "sensor",
    };
  }).filter(Boolean);
}

function xmlNodes(xml, tag) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  if (doc.querySelector("parsererror")) return [];
  return [...doc.getElementsByTagName(tag)];
}

function xmlText(node, tag) {
  const child = node.getElementsByTagName(tag)[0];
  return child ? child.textContent.trim() : "";
}

export function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export async function loadCameras() {
  const [tc, en] = await Promise.all([
    settle("cam-tc", (text) => text),
    settle("cam-en", (text) => text),
  ]);
  const zh = new Map();
  for (const node of tc ? xmlNodes(tc, "image") : []) {
    zh.set(xmlText(node, "key"), {
      region: xmlText(node, "region"),
      district: xmlText(node, "district"),
      description: xmlText(node, "description"),
    });
  }
  const cameras = [];
  const source = en || tc;
  if (!source) return cameras;
  for (const node of xmlNodes(source, "image")) {
    const key = xmlText(node, "key");
    const local = zh.get(key) || {};
    const lat = num(xmlText(node, "latitude"));
    const lng = num(xmlText(node, "longitude"));
    if (!inHongKong(lat, lng)) continue;
    cameras.push({
      key,
      lat,
      lng,
      url: xmlText(node, "url"),
      region: { zh: local.region || xmlText(node, "region"), en: xmlText(node, "region") },
      district: { zh: local.district || xmlText(node, "district"), en: xmlText(node, "district") },
      description: { zh: local.description || xmlText(node, "description"), en: xmlText(node, "description") },
    });
  }
  return cameras;
}

function noticeDateKey(value) {
  const match = String(value || "").match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!match) return "";
  return `${match[3]}${match[2]}${match[1]}`;
}

export async function loadNotices() {
  const batches = await Promise.all(NOTICE_FEEDS.map(async ([category, id]) => {
    const xml = await settle(id, (text) => text);
    if (!xml) return [];
    return xmlNodes(xml, "Notice").map((node) => ({
      id: xmlText(node, "TNID"),
      category,
      title: { zh: xmlText(node, "Title_TC") || xmlText(node, "Title_EN"), en: xmlText(node, "Title_EN") || xmlText(node, "Title_TC") },
      date: xmlText(node, "StartEffectiveDate"),
      dateKey: noticeDateKey(xmlText(node, "StartEffectiveDate")),
      body: {
        zh: stripHtml(xmlText(node, "Content_TC")).slice(0, 420),
        en: stripHtml(xmlText(node, "Content_EN")).slice(0, 420),
      },
    }));
  }));
  return batches.flat().sort((a, b) => (b.dateKey || "").localeCompare(a.dateKey || ""));
}

function parseNews(xml) {
  if (!xml) return [];
  return xmlNodes(xml, "message").map((node) => ({
    id: xmlText(node, "INCIDENT_NUMBER") || xmlText(node, "ID"),
    title: { zh: xmlText(node, "INCIDENT_HEADING_CN"), en: xmlText(node, "INCIDENT_HEADING_EN") },
    detail: { zh: xmlText(node, "INCIDENT_DETAIL_CN"), en: xmlText(node, "INCIDENT_DETAIL_EN") },
    location: { zh: xmlText(node, "LOCATION_CN"), en: xmlText(node, "LOCATION_EN") },
    near: { zh: xmlText(node, "NEAR_LANDMARK_CN"), en: xmlText(node, "NEAR_LANDMARK_EN") },
    status: { zh: xmlText(node, "INCIDENT_STATUS_CN"), en: xmlText(node, "INCIDENT_STATUS_EN") },
    content: { zh: stripHtml(xmlText(node, "CONTENT_CN")).slice(0, 360), en: stripHtml(xmlText(node, "CONTENT_EN")).slice(0, 360) },
    at: xmlText(node, "ANNOUNCEMENT_DATE"),
  }));
}

export async function loadNews() {
  const [tc, en, openTc, openEn] = await Promise.all([
    settle("news-tc", (text) => text),
    settle("news-en", (text) => text),
    settle("news-open-tc", (text) => text),
    settle("news-open-en", (text) => text),
  ]);
  const merged = [...parseNews(tc), ...parseNews(en), ...parseNews(openTc), ...parseNews(openEn)];
  const seen = new Set();
  return merged.filter((item) => {
    if (!item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function sumStreets(text) {
  const rows = parseCsv(text);
  const headerAt = rows.findIndex((row) => row[0] && Number.isNaN(Number(row[3])));
  const start = headerAt >= 0 ? headerAt + 1 : 1;
  const totals = new Map();
  for (const row of rows.slice(start)) {
    const district = String(row[0] || "").trim();
    if (!district) continue;
    const count = [3, 4, 5].reduce((sum, index) => sum + (Number(row[index]) || 0), 0);
    if (!count) continue;
    totals.set(district, (totals.get(district) || 0) + count);
  }
  return [...totals.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function parseTable61(text) {
  const rows = rowObjects(text, "YR_MTH");
  if (!rows.length) return [];
  const latest = rows.map((row) => row.YR_MTH).sort().at(-1);
  return rows
    .filter((row) => row.YR_MTH === latest)
    .map((row) => ({
      month: latest,
      label: row.LOCATION,
      value: num(row.UTL_RATE),
      capacity: num(row.CAP),
    }))
    .filter((row) => row.value != null);
}

function parseTable62(text) {
  const rows = rowObjects(text, "YR_MTH");
  const byRegion = new Map();
  for (const row of rows) {
    const region = row.REGION;
    const list = byRegion.get(region) || [];
    list.push({ x: row.YR_MTH, y: num(row.UTL_RATE), spaces: num(row.NO_METER_PS) });
    byRegion.set(region, list);
  }
  for (const list of byRegion.values()) {
    list.sort((a, b) => a.x.localeCompare(b.x));
  }
  return byRegion;
}

export async function loadStatistics() {
  const [streetsZh, streetsEn, t61zh, t61en, t62zh, t62en] = await Promise.all([
    Promise.all(["street-hki-tc", "street-kln-tc", "street-nt-tc"].map((id) => settle(id, (text) => text))),
    Promise.all(["street-hki-en", "street-kln-en", "street-nt-en"].map((id) => settle(id, (text) => text))),
    settle("table61-tc", (text) => text),
    settle("table61-en", (text) => text),
    settle("table62-tc", (text) => text),
    settle("table62-en", (text) => text),
  ]);
  const combine = (parts) => {
    const map = new Map();
    for (const text of parts) {
      if (!text) continue;
      for (const row of sumStreets(text)) map.set(row.label, (map.get(row.label) || 0) + row.value);
    }
    return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  };
  return {
    streets: { zh: combine(streetsZh), en: combine(streetsEn) },
    table61: { zh: t61zh ? parseTable61(t61zh) : [], en: t61en ? parseTable61(t61en) : [] },
    table62: { zh: t62zh ? parseTable62(t62zh) : new Map(), en: t62en ? parseTable62(t62en) : new Map() },
  };
}

function rainfallTotal(payload) {
  const rows = payload?.rainfall?.data || [];
  return rows.reduce((sum, row) => sum + (Number(row.max) || 0), 0);
}

function temperatureOf(payload) {
  const rows = payload?.temperature?.data || [];
  const chosen = rows.find((row) => /天文台|observatory/i.test(row.place)) || rows[0];
  return chosen ? { place: chosen.place, value: chosen.value } : null;
}

function humidityOf(payload) {
  const rows = payload?.humidity?.data || [];
  const chosen = rows.find((row) => /天文台|observatory/i.test(row.place)) || rows[0];
  return chosen ? chosen.value : null;
}

export async function loadContext() {
  const [weatherZh, weatherEn, warnings, forecastZh, forecastEn, localHolidays] = await Promise.all([
    settle("weather", (text) => JSON.parse(text)),
    settle("weather-en", (text) => JSON.parse(text)),
    settle("warnings", (text) => JSON.parse(text)),
    settle("forecast-tc", (text) => JSON.parse(text)),
    settle("forecast-en", (text) => JSON.parse(text)),
    fetch("data/holidays.json").then((response) => (response.ok ? response.json() : null)).catch(() => null),
  ]);
  let events = localHolidays?.events || [];
  try {
    const live = await getJson("holidays");
    const liveEvents = live?.vcalendar?.[0]?.vevent || [];
    if (liveEvents.length) {
      events = liveEvents.map((event) => ({
        date: Array.isArray(event.dtstart) ? event.dtstart[0] : event.dtstart,
        name: event.summary,
      }));
      mark("holidays", true, "");
    }
  } catch (error) {
    mark("holidays", false, error.message || error);
  }
  const warningList = warnings && typeof warnings === "object"
    ? Object.values(warnings).map((item) => ({ code: item.code, name: item.name })).filter((item) => item.code)
    : [];
  const rainCodes = ["WRAIN", "WFNTSA", "WLNTSA", "WTMW", "WTCSG", "WTS"];
  return {
    weather: { zh: weatherZh, en: weatherEn },
    temperature: { zh: temperatureOf(weatherZh), en: temperatureOf(weatherEn) },
    humidity: humidityOf(weatherZh || weatherEn),
    rainfall: rainfallTotal(weatherZh || weatherEn),
    warnings: warningList,
    veryHot: warningList.some((item) => item.code === "WHOT"),
    rain: rainfallTotal(weatherZh || weatherEn) > 0 || warningList.some((item) => rainCodes.includes(item.code)),
    forecast: { zh: forecastZh, en: forecastEn },
    holidays: events,
  };
}

export function isHoliday(events, date = new Date()) {
  const key = date.toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" }).replaceAll("-", "");
  return (events || []).find((event) => event.date === key) || null;
}
