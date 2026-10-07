/* Live parking context: address lookup, district notices, weather, and major-road speed. */

const ALS_URL = "https://www.als.gov.hk/lookup";
const WEATHER_URL = "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warnsum&lang=tc";
const SPEED_URL = "https://resource.data.one.gov.hk/td/traffic-detectors/irnAvgSpeed-all.xml";
const NOTICE_URLS = [
  "https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Temporary_Road_Closure.xml",
  "https://www.td.gov.hk/datagovhk_tis/traffic-notices/Special_Traffic_and_Transport_Arrangement.xml",
];

const SHORT_DISTRICTS = new Set(["north", "islands", "eastern", "southern"]);

export function distanceKm(lat1, lon1, lat2, lon2) {
  const a1 = Number(lat1);
  const o1 = Number(lon1);
  const a2 = Number(lat2);
  const o2 = Number(lon2);
  if (![a1, o1, a2, o2].every(Number.isFinite)) return null;
  const radius = 6371;
  const dLat = ((a2 - a1) * Math.PI) / 180;
  const dLon = ((o2 - o1) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a1 * Math.PI) / 180) * Math.cos((a2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

function nodeText(parent, selector) {
  return parent.querySelector(selector)?.textContent?.trim() || "";
}

export async function geocodeAddress(query) {
  const trimmed = (query || "").trim();
  if (!trimmed) return null;
  const response = await fetch(`${ALS_URL}?n=1&q=${encodeURIComponent(trimmed)}`);
  if (!response.ok) return null;
  const doc = new DOMParser().parseFromString(await response.text(), "application/xml");
  const address = doc.querySelector("SuggestedAddress PremisesAddress");
  if (!address) return null;
  const latitude = Number(nodeText(address, "Latitude"));
  const longitude = Number(nodeText(address, "Longitude"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const chinese = [
    nodeText(address, "ChiEstate EstateName"),
    nodeText(address, "ChiStreet StreetName"),
    nodeText(address, "ChiStreet BuildingNoFrom"),
  ].filter(Boolean).join(" ");
  const english = [
    nodeText(address, "EngStreet BuildingNoFrom"),
    nodeText(address, "EngStreet StreetName"),
    nodeText(address, "EngEstate EstateName"),
  ].filter(Boolean).join(" ");
  return {
    latitude,
    longitude,
    label: chinese || english || trimmed,
  };
}

export function parseNotices(xml) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return [...doc.querySelectorAll("Notice")].map((node) => ({
    id: nodeText(node, "TNID"),
    title_en: nodeText(node, "Title_EN"),
    title_tc: nodeText(node, "Title_TC"),
    title_sc: nodeText(node, "Title_SC"),
  })).filter((notice) => notice.title_en || notice.title_tc);
}

export function noticeMatchesPark(notice, park) {
  const districtEn = String(park.district_en || "").toLowerCase();
  const titleEn = String(notice.title_en || "").toLowerCase();
  const titleTc = notice.title_tc || "";
  const titleSc = notice.title_sc || "";
  const districtTc = park.district_tc || "";
  const districtSc = park.district_sc || "";
  if (districtTc && (titleTc.includes(districtTc) || titleTc.includes(districtTc.replace(/區$/, "")))) {
    return true;
  }
  if (districtSc && titleSc.includes(districtSc)) return true;
  if (!districtEn) return false;
  if (SHORT_DISTRICTS.has(districtEn)) {
    return titleEn.includes(`${districtEn} district`);
  }
  const aliases = [districtEn, districtEn.replace("&", "and"), districtEn.replace(" and ", " & ")];
  return aliases.some((alias) => alias && titleEn.includes(alias));
}

export function parseWeather(payload) {
  const alerts = [];
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (!value || value.actionCode === "CANCEL") return;
    alerts.push({
      key,
      name: value.name || key,
      type: value.type || "",
      code: value.code || key,
    });
  });
  const severe = alerts.some((alert) => /WRAIN|WTCSG|TC8|TC9|TC10/.test(`${alert.key}${alert.code}`));
  return { alerts, severe };
}

export function parseSpeed(xml) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  let valid = 0;
  let slow = 0;
  let jammed = 0;
  doc.querySelectorAll("segment").forEach((segment) => {
    if (nodeText(segment, "valid") !== "Y") return;
    const speed = Number(nodeText(segment, "speed"));
    if (!Number.isFinite(speed)) return;
    valid += 1;
    if (speed < 25) jammed += 1;
    else if (speed < 40) slow += 1;
  });
  return {
    valid,
    slow,
    jammed,
    time: nodeText(doc, "time"),
  };
}

async function readNotices() {
  const batches = await Promise.all(NOTICE_URLS.map(async (url) => {
    try {
      const response = await fetch(url);
      if (!response.ok) return [];
      return parseNotices(await response.text());
    } catch (error) {
      return [];
    }
  }));
  return batches.flat();
}

export async function loadParkingContext() {
  const [weatherResult, speedResult, notices] = await Promise.all([
    fetch(WEATHER_URL).then((response) => response.json()).then(parseWeather).catch(() => ({ alerts: [], severe: false })),
    fetch(SPEED_URL).then((response) => response.text()).then(parseSpeed).catch(() => ({ valid: 0, slow: 0, jammed: 0, time: "" })),
    readNotices(),
  ]);
  return {
    weather: weatherResult,
    speed: speedResult,
    notices,
  };
}
