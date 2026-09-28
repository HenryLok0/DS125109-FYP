"""Cached fetches for Hong Kong government open data."""
import json
import time
from concurrent.futures import ThreadPoolExecutor

import pandas as pd
import requests

# Vacancy data changes often; keep a short cache so repeat page loads stay fast.
JSON_TTL_SECONDS = 60
EXCEL_TTL_SECONDS = 300
REQUEST_TIMEOUT = 8

VEHICLE_TYPES = ("privateCar", "motorCycle", "LGV", "HGV", "coach")
URL_EN_INFO = "https://api.data.gov.hk/v1/carpark-info-vacancy"
URL_VACANCY = (
    "https://api.data.gov.hk/v1/carpark-info-vacancy"
    "?data=vacancy&vehicleTypes=privateCar,motorCycle,LGV,HGV,coach&lang=en_US"
)
URL_ZH_INFO = "https://resource.data.one.gov.hk/td/carpark/basic_info_all.json"

_CACHE = {}


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


def _vacancy_by_park(vacancy_payload):
    mapping = {}
    for item in vacancy_payload.get("results", []):
        park_id = item.get("park_Id")
        mapping[park_id] = {
            vehicle_type: (item.get(vehicle_type) or [{}])[0]
            for vehicle_type in VEHICLE_TYPES
        }
    return mapping


def _apply_vacancy(carparks, vacancy_payload, id_key):
    vacancy_info = _vacancy_by_park(vacancy_payload)
    for carpark in carparks:
        park_id = carpark.get(id_key)
        if park_id not in vacancy_info:
            continue
        for vehicle_type in VEHICLE_TYPES:
            slot = vacancy_info[park_id].get(vehicle_type) or {}
            carpark["{}_vacancy".format(vehicle_type)] = slot.get("vacancy", "N/A")
            carpark["{}_vacancy_type".format(vehicle_type)] = slot.get("vacancy_type", "")
    return carparks


def fetch_en_carparks():
    info_payload, vacancy_payload = get_json_parallel(URL_EN_INFO, URL_VACANCY)
    carparks = list(info_payload.get("results") or [])
    _apply_vacancy(carparks, vacancy_payload, "park_Id")
    for carpark in carparks:
        private_car = carpark.get("privateCar") or {}
        hourly = private_car.get("hourlyCharges") or []
        carpark["price"] = hourly[0]["price"] if hourly else "N/A"
    return carparks


def fetch_zh_carparks():
    info_payload, vacancy_payload = get_json_parallel(
        (URL_ZH_INFO, True),
        URL_VACANCY,
    )
    carparks = list(info_payload.get("car_park") or [])
    _apply_vacancy(carparks, vacancy_payload, "park_id")
    return carparks
