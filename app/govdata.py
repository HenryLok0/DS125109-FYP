"""Cached fetches for Hong Kong car park and government open data."""
import json
import threading
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

import pandas as pd
import requests

# Vacancy data changes often; keep a short cache so repeat page loads stay fast.
JSON_TTL_SECONDS = 60
EXCEL_TTL_SECONDS = 300
OSM_TTL_SECONDS = 24 * 3600
OSM_FAIL_TTL_SECONDS = 600
REQUEST_TIMEOUT = 8
OSM_TIMEOUT = 25

VEHICLE_TYPES = ("privateCar", "motorCycle", "LGV", "HGV", "coach")
HIDDEN_VACANCY = {"N/A", "none", "-1", "0", "", "None"}
URL_EN_INFO = "https://api.data.gov.hk/v1/carpark-info-vacancy?lang=en_US"
URL_ZH_INFO = "https://api.data.gov.hk/v1/carpark-info-vacancy?lang=zh_TW"
URL_VACANCY = (
    "https://api.data.gov.hk/v1/carpark-info-vacancy"
    "?data=vacancy&vehicleTypes=privateCar,motorCycle,LGV,HGV,coach&lang=en_US"
)
OSM_ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)
OSM_QUERY = """
[out:json][timeout:25];
(
  nwr["amenity"="parking"]["name"](22.15,113.82,22.57,114.44);
);
out center tags;
"""
OSM_COUNT_QUERY = """
[out:json][timeout:25];
(
  nwr["amenity"="parking"]["parking"!="lane"]["parking"!="street_side"](22.15,113.82,22.57,114.44);
);
out count;
"""
# Seed from a recent Overpass count so the coverage meter can render before refresh.
OSM_PARKING_TOTAL_FALLBACK = 3042
OSM_SKIP_PARKING = {"lane", "street_side", "on_kerb", "half_on_kerb"}
OSM_SKIP_ACCESS = {"private", "no", "military", "residents", "staff", "permit"}
# Match parks within about 100 metres when merging OSM into the live feed.
DEDUP_DEGREE2 = (0.001) ** 2

DISTRICT_TC = {
    "Central & Western": "中西區",
    "Wan Chai": "灣仔",
    "Eastern": "東區",
    "Southern": "南區",
    "Yau Tsim Mong": "油尖旺",
    "Sham Shui Po": "深水埗",
    "Kowloon City": "九龍城",
    "Wong Tai Sin": "黃大仙",
    "Kwun Tong": "觀塘",
    "Kwai Tsing": "葵青",
    "Tsuen Wan": "荃灣",
    "Yuen Long": "元朗",
    "Tuen Mun": "屯門",
    "North": "北區",
    "Tai Po": "大埔",
    "Sha Tin": "沙田",
    "Sai Kung": "西貢",
    "Islands": "離島",
}

_CACHE = {}
_OSM_LOCK = threading.Lock()
_OSM_LOADING = False


def _cache_get(key, ttl):
    entry = _CACHE.get(key)
    if entry and (time.time() - entry["ts"]) < ttl:
        return entry["data"]
    return None


def _cache_set(key, data):
    _CACHE[key] = {"ts": time.time(), "data": data}
    return data


def get_json(url, utf8_sig=False):
    cached = _cache_get(url, JSON_TTL_SECONDS)
    if cached is not None:
        return cached

    response = requests.get(url, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    if utf8_sig:
        data = json.loads(response.content.decode("utf-8-sig"))
    else:
        data = response.json()
    return _cache_set(url, data)


def get_json_parallel(*specs):
    """Fetch several JSON URLs at once. A spec is a url or (url, utf8_sig)."""
    def load(spec):
        if isinstance(spec, tuple):
            return get_json(spec[0], utf8_sig=bool(spec[1]))
        return get_json(spec)

    workers = max(1, len(specs))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        return list(pool.map(load, specs))


def read_excel_rows(url):
    cached = _cache_get(url, EXCEL_TTL_SECONDS)
    if cached is not None:
        return cached

    dataframe = pd.read_excel(url)
    rows = dataframe.to_dict(orient="records")
    return _cache_set(url, rows)


def _normalize_district(value):
    text = (value or "").strip()
    if text.endswith(" District"):
        text = text[:-9]
    if text.endswith("區") and text not in DISTRICT_TC.values():
        inverse = {zh: en for en, zh in DISTRICT_TC.items()}
        text = inverse.get(text, text)
    return text


def _status_upper(value):
    text = str(value or "OPEN").strip().upper()
    if text in {"OPEN", "CLOSED", "NONE"}:
        return text
    return "OPEN"


def _name_key(value):
    text = (value or "").lower()
    for token in ("car park", "carpark", "parking", "停車場", "停車埸"):
        text = text.replace(token, "")
    return "".join(ch for ch in text if ch.isalnum())


def _coords(carpark):
    try:
        return float(carpark.get("latitude")), float(carpark.get("longitude"))
    except (TypeError, ValueError):
        return None


def _classify_operator(carpark):
    nature = (carpark.get("nature") or "").lower()
    website = " ".join([
        str(carpark.get("website") or ""),
        str(carpark.get("website_en") or ""),
        str(carpark.get("website_tc") or ""),
    ]).lower()
    name = " ".join([
        str(carpark.get("name") or ""),
        str(carpark.get("name_tc") or ""),
        str(carpark.get("operator_raw") or ""),
    ]).lower()
    park_id = str(carpark.get("park_Id") or carpark.get("park_id") or "")

    if park_id.startswith("osm-"):
        raw = (carpark.get("operator_raw") or "").strip()
        return "private", raw or "OpenStreetMap", raw or "OpenStreetMap"
    if nature == "government" or "gov.hk" in website or "housingauthority" in website:
        return "government", "Government", "政府"
    if "wilson" in website or "wilson" in name:
        return "private", "Wilson Parking", "威信停車場"
    if "sino" in website or "sinoparking" in name:
        return "private", "Sino Parking", "信和停車場"
    if "linkreit" in website or "link.com.hk" in website:
        return "private", "Link", "領展"
    if "mtr.com.hk" in website:
        return "private", "MTR", "港鐵"
    if "mackcarpark" in website or "mack " in name:
        return "private", "Mack", "Mack"
    if "urban" in website and "park" in website:
        return "private", "Urban", "富城"
    if nature == "commercial":
        return "private", "Commercial", "商業"
    if any(token in name for token in ("estate", "邨", "房屋")):
        return "government", "Housing", "房屋"
    return "private", "Private operator", "私人營辦商"


def _vacancy_by_park(vacancy_payload):
    mapping = {}
    for item in vacancy_payload.get("results", []):
        park_id = item.get("park_Id")
        mapping[park_id] = {
            vehicle_type: (item.get(vehicle_type) or [{}])[0]
            for vehicle_type in VEHICLE_TYPES
        }
    return mapping


def _apply_vacancy(carpark, vacancy_info):
    park_id = carpark.get("park_Id") or carpark.get("park_id")
    slots = vacancy_info.get(park_id) or vacancy_info.get(str(park_id)) or {}
    for vehicle_type in VEHICLE_TYPES:
        slot = slots.get(vehicle_type) or {}
        vacancy = slot.get("vacancy", "N/A")
        if vacancy is None:
            vacancy = "N/A"
        carpark["{}_vacancy".format(vehicle_type)] = str(vacancy)
        carpark["{}_vacancy_type".format(vehicle_type)] = slot.get("vacancy_type") or ""
        carpark["{}_lastupdate".format(vehicle_type)] = slot.get("lastupdate") or "—"
    return carpark


def _enrich_live_park(en_row, zh_row, vacancy_info):
    park_id = str(en_row.get("park_Id") or zh_row.get("park_Id") or "")
    district_en = _normalize_district(en_row.get("district") or zh_row.get("district") or "")
    carpark = dict(en_row)
    carpark["park_Id"] = park_id
    carpark["park_id"] = park_id
    carpark["district"] = district_en
    carpark["district_en"] = district_en
    carpark["district_tc"] = DISTRICT_TC.get(district_en) or zh_row.get("district") or district_en
    carpark["name"] = en_row.get("name") or zh_row.get("name") or ""
    carpark["name_tc"] = zh_row.get("name") or en_row.get("name") or ""
    carpark["displayAddress"] = en_row.get("displayAddress") or ""
    carpark["displayAddress_tc"] = zh_row.get("displayAddress") or carpark["displayAddress"]
    carpark["website"] = en_row.get("website") or zh_row.get("website") or ""
    carpark["website_en"] = carpark["website"]
    carpark["website_tc"] = zh_row.get("website") or carpark["website"]
    carpark["opening_status"] = _status_upper(en_row.get("opening_status") or zh_row.get("opening_status"))
    carpark["has_live_vacancy"] = True
    carpark["source"] = "live"
    private_car = carpark.get("privateCar") or {}
    hourly = private_car.get("hourlyCharges") or []
    carpark["price"] = hourly[0]["price"] if hourly else "N/A"
    _apply_vacancy(carpark, vacancy_info)
    kind, label, label_tc = _classify_operator(carpark)
    carpark["operator_kind"] = kind
    carpark["operator_label"] = label
    carpark["operator_label_tc"] = label_tc
    return carpark


def _osm_useful(tags):
    if tags.get("parking") in OSM_SKIP_PARKING:
        return False
    if tags.get("access") in OSM_SKIP_ACCESS:
        return False
    if tags.get("parking") in {"multi-storey", "underground", "garage", "rooftop"}:
        return True
    if tags.get("fee") == "yes" or tags.get("operator"):
        return True
    return False


def _element_coords(element):
    if "lat" in element and "lon" in element:
        return element["lat"], element["lon"]
    center = element.get("center") or {}
    if "lat" in center and "lon" in center:
        return center["lat"], center["lon"]
    return None


def _overpass(query):
    encoded = urllib.parse.urlencode({"data": query})
    headers = {
        "User-Agent": "EaseParkHK-FYP/1.0",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    }
    last_error = None
    for endpoint in OSM_ENDPOINTS:
        try:
            response = requests.post(
                endpoint,
                data=encoded,
                headers=headers,
                timeout=OSM_TIMEOUT,
            )
            response.raise_for_status()
            return response.json()
        except (requests.RequestException, ValueError) as error:
            last_error = error
    raise RuntimeError("OpenStreetMap query failed: {}".format(last_error))


def _download_osm_parking_total():
    payload = _overpass(OSM_COUNT_QUERY)
    for element in payload.get("elements") or []:
        if element.get("type") != "count":
            continue
        tags = element.get("tags") or {}
        return int(tags.get("total") or 0)
    return OSM_PARKING_TOTAL_FALLBACK


def _osm_total_value():
    cached = _cache_get("osm_parking_total", OSM_TTL_SECONDS)
    if cached:
        return int(cached)
    entry = _CACHE.get("osm_parking_total")
    if entry:
        return int(entry["data"])
    return OSM_PARKING_TOTAL_FALLBACK


def _update_coverage_stats(listed_parks):
    listed_count = len(listed_parks or [])
    live_count = sum(1 for park in listed_parks if park.get("has_live_vacancy"))
    total = max(_osm_total_value(), listed_count)
    percent = (100.0 * listed_count / total) if total else 0
    live_percent = (100.0 * live_count / total) if total else 0
    stats = {
        "listed_count": listed_count,
        "live_count": live_count,
        "total_count": total,
        "percent": round(percent, 1),
        "percent_int": int(round(percent)),
        "live_percent": round(live_percent, 1),
        "live_percent_int": int(round(live_percent)),
        "bar_width": min(100, max(0, round(percent, 1))),
    }
    return _cache_set("coverage_stats", stats)


def get_coverage_stats():
    cached = _cache_get("coverage_stats", JSON_TTL_SECONDS)
    if cached is not None:
        return cached
    entry = _CACHE.get("coverage_stats")
    if entry:
        return entry["data"]
    return None


def _download_osm_carparks():
    payload = _overpass(OSM_QUERY)

    carparks = []
    for element in payload.get("elements") or []:
        tags = element.get("tags") or {}
        if not _osm_useful(tags):
            continue
        coords = _element_coords(element)
        if not coords:
            continue
        lat, lng = coords
        name_en = tags.get("name:en") or tags.get("name") or ""
        name_tc = tags.get("name:zh-Hant") or tags.get("name:zh") or tags.get("name") or name_en
        if not name_en:
            continue
        address_parts = [
            tags.get("addr:housenumber"),
            tags.get("addr:street"),
            tags.get("addr:district"),
            tags.get("addr:city") or "Hong Kong",
        ]
        address = tags.get("addr:full") or ", ".join(part for part in address_parts if part)
        park_id = "osm-{}{}".format(element.get("type", "n")[0], element.get("id"))
        carpark = {
            "park_Id": park_id,
            "park_id": park_id,
            "name": name_en,
            "name_tc": name_tc,
            "displayAddress": address,
            "displayAddress_tc": address,
            "latitude": lat,
            "longitude": lng,
            "website": tags.get("website") or "",
            "website_en": tags.get("website") or "",
            "website_tc": tags.get("website") or "",
            "contactNo": tags.get("phone") or "",
            "opening_status": "OPEN",
            "has_live_vacancy": False,
            "source": "osm",
            "nature": "commercial",
            "operator_raw": tags.get("operator") or "",
            "price": "N/A",
            "privateCar_vacancy": "—",
            "privateCar_vacancy_type": "location",
            "privateCar_lastupdate": "—",
        }
        for vehicle_type in VEHICLE_TYPES:
            if vehicle_type == "privateCar":
                continue
            carpark["{}_vacancy".format(vehicle_type)] = "N/A"
            carpark["{}_vacancy_type".format(vehicle_type)] = ""
            carpark["{}_lastupdate".format(vehicle_type)] = "—"
        kind, label, label_tc = _classify_operator(carpark)
        carpark["operator_kind"] = kind
        carpark["operator_label"] = label
        carpark["operator_label_tc"] = label_tc
        carparks.append(carpark)
    return carparks


def _start_osm_refresh():
    global _OSM_LOADING
    with _OSM_LOCK:
        if _OSM_LOADING:
            return
        _OSM_LOADING = True

    def job():
        global _OSM_LOADING
        try:
            try:
                _cache_set("osm_parking_total", _download_osm_parking_total())
            except Exception:
                pass
            _cache_set("osm_carparks", _download_osm_carparks())
            live = _cache_get("live_carparks", JSON_TTL_SECONDS)
            osm = _cache_get("osm_carparks", OSM_TTL_SECONDS) or []
            if live is not None:
                merged = live + _assign_osm_districts(_dedupe_osm(osm, live), live)
                _update_coverage_stats(merged)
        except Exception:
            _cache_set("osm_carparks_fail", [])
        finally:
            with _OSM_LOCK:
                _OSM_LOADING = False

    threading.Thread(target=job, daemon=True).start()


def fetch_osm_carparks():
    cached = _cache_get("osm_carparks", OSM_TTL_SECONDS)
    if cached is not None:
        return cached
    failed = _cache_get("osm_carparks_fail", OSM_FAIL_TTL_SECONDS)
    if failed is not None:
        return []
    _start_osm_refresh()
    return []


def _assign_osm_districts(osm_carparks, live_carparks):
    live_points = []
    for carpark in live_carparks:
        coords = _coords(carpark)
        if not coords:
            continue
        live_points.append((coords[0], coords[1], carpark.get("district") or ""))

    for carpark in osm_carparks:
        coords = _coords(carpark)
        district = ""
        if coords and live_points:
            best = None
            for lat, lng, live_district in live_points:
                dist = (coords[0] - lat) ** 2 + (coords[1] - lng) ** 2
                if best is None or dist < best[0]:
                    best = (dist, live_district)
            district = (best or (0, ""))[1]
        district = _normalize_district(district)
        carpark["district"] = district
        carpark["district_en"] = district
        carpark["district_tc"] = DISTRICT_TC.get(district, district)
    return osm_carparks


def _dedupe_osm(osm_carparks, live_carparks):
    live_points = []
    live_names = set()
    for carpark in live_carparks:
        coords = _coords(carpark)
        if coords:
            live_points.append(coords)
        live_names.add(_name_key(carpark.get("name")))
        live_names.add(_name_key(carpark.get("name_tc")))
    live_names.discard("")

    unique = []
    for carpark in osm_carparks:
        name_keys = {_name_key(carpark.get("name")), _name_key(carpark.get("name_tc"))}
        name_keys.discard("")
        if name_keys & live_names:
            continue
        coords = _coords(carpark)
        if coords and any(
            (coords[0] - lat) ** 2 + (coords[1] - lng) ** 2 < DEDUP_DEGREE2
            for lat, lng in live_points
        ):
            continue
        unique.append(carpark)
    return unique


def fetch_live_carparks():
    cached = _cache_get("live_carparks", JSON_TTL_SECONDS)
    if cached is not None:
        return cached

    en_payload, zh_payload, vacancy_payload = get_json_parallel(
        URL_EN_INFO,
        URL_ZH_INFO,
        URL_VACANCY,
    )
    vacancy_info = _vacancy_by_park(vacancy_payload)
    zh_map = {
        str(item.get("park_Id")): item
        for item in (zh_payload.get("results") or [])
    }
    carparks = []
    for en_row in en_payload.get("results") or []:
        park_id = str(en_row.get("park_Id") or "")
        carparks.append(_enrich_live_park(en_row, zh_map.get(park_id) or {}, vacancy_info))
    return _cache_set("live_carparks", carparks)


def fetch_all_carparks():
    live = fetch_live_carparks()
    osm = _assign_osm_districts(_dedupe_osm(fetch_osm_carparks(), live), live)
    parks = live + osm
    _update_coverage_stats(parks)
    return parks


def fetch_en_carparks():
    return fetch_all_carparks()


def fetch_zh_carparks():
    return fetch_all_carparks()


def get_carpark_by_id(park_id):
    park_id = str(park_id or "")
    for carpark in fetch_all_carparks():
        if str(carpark.get("park_Id") or carpark.get("park_id")) == park_id:
            return dict(carpark)
    return None


def search_carparks(query, lang="en"):
    query = (query or "").strip().lower()
    if not query:
        return []
    results = []
    for carpark in fetch_all_carparks():
        haystack = " ".join([
            str(carpark.get("name") or ""),
            str(carpark.get("name_tc") or ""),
            str(carpark.get("displayAddress") or ""),
            str(carpark.get("displayAddress_tc") or ""),
            str(carpark.get("operator_label") or ""),
            str(carpark.get("district") or ""),
            str(carpark.get("district_tc") or ""),
        ]).lower()
        if query in haystack:
            results.append(carpark)
    return results


def vacancy_cards(carpark, lang="en"):
    names = {
        "en": {
            "privateCar": "Private Car",
            "LGV": "Large Goods Vehicle",
            "HGV": "Heavy Goods Vehicle",
            "motorCycle": "Motor Cycle",
            "coach": "Coach",
        },
        "zh": {
            "privateCar": "私家車",
            "LGV": "大型貨車",
            "HGV": "重型貨車",
            "motorCycle": "電單車",
            "coach": "旅遊巴",
        },
    }[lang]
    cards = []
    for vehicle_type in VEHICLE_TYPES:
        vacancy = carpark.get("{}_vacancy".format(vehicle_type))
        if vacancy in HIDDEN_VACANCY or vacancy is None:
            continue
        cards.append({
            "type": names[vehicle_type],
            "vacancy": vacancy,
            "last_update": carpark.get("{}_lastupdate".format(vehicle_type)) or "—",
        })
    return cards
