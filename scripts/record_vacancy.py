"""Record one hourly vacancy snapshot into docs/data/history.json.

Used by GitHub Actions so history grows even when nobody opens the site.
The browser reads the same file on GitHub Pages.
"""
import json
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

INFO_URL = "https://resource.data.one.gov.hk/td/carpark/basic_info_all.json"
VACANCY_URL = (
    "https://api.data.gov.hk/v1/carpark-info-vacancy"
    "?data=vacancy&vehicleTypes=privateCar,motorCycle&lang=en_US"
)
HISTORY_PATH = Path(__file__).resolve().parents[1] / "docs" / "data" / "history.json"
HISTORY_DAYS = 60


def _count(value):
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None
    if number < 0:
        return None
    return number


def _get_json(url):
    with urllib.request.urlopen(url, timeout=30) as response:
        raw = response.read().decode("utf-8-sig")
    return json.loads(raw)


def main():
    info = _get_json(INFO_URL)
    vacancy = _get_json(VACANCY_URL)
    by_id = {}
    for item in vacancy.get("results") or []:
        park_id = str(item.get("park_Id") or "")
        if not park_id:
            continue
        car = (item.get("privateCar") or [{}])[0]
        bike = (item.get("motorCycle") or [{}])[0]
        by_id[park_id] = [_count(car.get("vacancy")), _count(bike.get("vacancy"))]

    snapshot = {}
    for carpark in info.get("car_park") or []:
        park_id = str(carpark.get("park_id") or "")
        if park_id:
            snapshot[park_id] = by_id.get(park_id, [None, None])

    if HISTORY_PATH.exists():
        history = json.loads(HISTORY_PATH.read_text(encoding="utf-8"))
    else:
        history = {"hours": {}}
    hours = history.setdefault("hours", {})
    bucket = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H")
    hours[bucket] = snapshot

    cutoff = (datetime.now(timezone.utc) - timedelta(days=HISTORY_DAYS)).strftime("%Y-%m-%dT%H")
    history["hours"] = {key: value for key, value in hours.items() if key >= cutoff}
    HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    HISTORY_PATH.write_text(json.dumps(history, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("recorded", bucket, "parks", len(snapshot))


if __name__ == "__main__":
    main()
