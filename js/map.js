// Leaflet map. Tiles, clustering and the Google embed URL are the ones
// published for this project. Marker clicks are handled by the page.

let map;
let carparkLayer;
let meterLayer;
let cameraLayer;
const pickers = { park: null };

function palette(park, vehicle) {
  const record = park.vehicles?.[vehicle];
  if (!record) return "#8aa0aa";
  if (record.kind === "C" || park.opening === "CLOSED") return "#8d8d8d";
  if (record.kind === "B") return "#3389ab";
  if (record.vacancy == null) return "#8aa0aa";
  if (record.space > 0) {
    const ratio = record.vacancy / record.space;
    if (record.vacancy <= 0 || ratio <= 0.05) return "#b42318";
    if (ratio < 0.2) return "#b86a12";
    return "#1f7a4d";
  }
  if (record.vacancy <= 0) return "#b42318";
  if (record.vacancy < 10) return "#b86a12";
  return "#1f7a4d";
}

export function mapReady() {
  return Boolean(map);
}

export function initMap(container) {
  if (!window.L) return false;
  map = L.map(container, { zoomControl: true, minZoom: 10 }).setView([22.3193, 114.1694], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  const group = () => (L.markerClusterGroup
    ? L.markerClusterGroup({ maxClusterRadius: 46, showCoverageOnHover: false, spiderfyOnMaxZoom: true })
    : L.layerGroup());
  carparkLayer = group().addTo(map);
  meterLayer = group().addTo(map);
  cameraLayer = group().addTo(map);
  return true;
}

export function invalidateMap() {
  if (map) map.invalidateSize();
}

export function mapCenter() {
  if (!map) return { lat: 22.3193, lng: 114.1694 };
  const center = map.getCenter();
  return { lat: center.lat, lng: center.lng };
}

export function flyTo(lat, lng, zoom = 16) {
  if (map && Number.isFinite(lat) && Number.isFinite(lng)) map.flyTo([lat, lng], zoom, { duration: 0.6 });
}

export function onParkPick(handler) {
  pickers.park = handler;
}

export function setCarparks(parks, vehicle, selectedId) {
  if (!carparkLayer) return;
  carparkLayer.clearLayers();
  for (const park of parks) {
    const selected = park.id === selectedId;
    const marker = L.circleMarker([park.lat, park.lng], {
      radius: selected ? 9 : 6,
      color: selected ? "#10212b" : "#ffffff",
      weight: selected ? 2 : 1,
      fillColor: palette(park, vehicle),
      fillOpacity: 0.92,
    });
    marker.on("click", () => pickers.park && pickers.park(park.id));
    carparkLayer.addLayer(marker);
  }
}

export function setMeters(meters, lang) {
  if (!meterLayer) return;
  meterLayer.clearLayers();
  for (const meter of meters) {
    const vacant = meter.occupancy === "V";
    const marker = L.circleMarker([meter.lat, meter.lng], {
      radius: 4,
      color: vacant ? "#1f7a4d" : "#8d8d8d",
      weight: 1,
      fillColor: vacant ? "#1f7a4d" : "#b42318",
      fillOpacity: 0.85,
    });
    const street = lang === "en" ? meter.street.en || meter.street.zh : meter.street.zh || meter.street.en;
    const section = lang === "en" ? meter.section.en || meter.section.zh : meter.section.zh || meter.section.en;
    const fee = meter.fee != null && meter.minutes ? `HK$${meter.fee} / ${meter.minutes} min` : "";
    marker.bindPopup(`<strong>${escapeHtml(street)}</strong><br>${escapeHtml(section)}<br>${escapeHtml(fee)}`);
    meterLayer.addLayer(marker);
  }
}

export function clearMeters() {
  if (meterLayer) meterLayer.clearLayers();
}

export function setCameras(cameras, lang) {
  if (!cameraLayer) return;
  cameraLayer.clearLayers();
  for (const camera of cameras) {
    const marker = L.circleMarker([camera.lat, camera.lng], {
      radius: 5,
      color: "#0e4f68",
      weight: 1,
      fillColor: "#3389ab",
      fillOpacity: 0.9,
    });
    const src = escapeHtml(camera.url);
    const caption = lang === "en" ? camera.description.en || camera.description.zh : camera.description.zh || camera.description.en;
    marker.bindPopup(`<strong>${escapeHtml(caption || camera.key)}</strong><br><img alt="" width="260" src="${src}">`);
    cameraLayer.addLayer(marker);
  }
}

export function clearCameras() {
  if (cameraLayer) cameraLayer.clearLayers();
}

export function locateUser() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("geolocation"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const origin = { lat: position.coords.latitude, lng: position.coords.longitude };
        if (map) {
          L.circleMarker([origin.lat, origin.lng], { radius: 8, color: "#3389ab", fillColor: "#3389ab", fillOpacity: 0.35 }).addTo(map);
          map.flyTo([origin.lat, origin.lng], 14);
        }
        resolve(origin);
      },
      () => reject(new Error("denied")),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}
