"""Hourly vacancy snapshots stored in a JSON file, not a user database."""
import json
import os
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path

HISTORY_DAYS = 60
HISTORY_PATH = Path(__file__).resolve().parent / "data" / "vacancy_history.json"
_LOCK = threading.Lock()


def _as_count(value):
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None
    if number < 0:
        return None
    return number


def load_history():
    if not HISTORY_PATH.exists():
        return {"hours": {}}
    try:
        return json.loads(HISTORY_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"hours": {}}


def _save(history):
    HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = HISTORY_PATH.with_suffix(".tmp")
    temporary.write_text(json.dumps(history, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    temporary.replace(HISTORY_PATH)


def record_hourly_snapshot(carparks):
    """Save the current UTC hour once. Later calls in the same hour do nothing."""
    bucket = datetime.utcnow().strftime("%Y-%m-%dT%H")
    with _LOCK:
        history = load_history()
        hours = history.setdefault("hours", {})
        if bucket in hours:
            return
        snapshot = {}
        for carpark in carparks:
            park_id = str(carpark.get("park_id") or carpark.get("park_Id") or "")
            if not park_id:
                continue
            snapshot[park_id] = [
                _as_count(carpark.get("privateCar_vacancy")),
                _as_count(carpark.get("motorCycle_vacancy")),
            ]
        hours[bucket] = snapshot
        cutoff = (datetime.utcnow() - timedelta(days=HISTORY_DAYS)).strftime("%Y-%m-%dT%H")
        history["hours"] = {key: value for key, value in hours.items() if key >= cutoff}
        _save(history)


def typical_for_now(park_ids):
    """Average of earlier snapshots on this UTC weekday and hour. Needs at least 3."""
    now = datetime.utcnow()
    bucket = now.strftime("%Y-%m-%dT%H")
    hours = load_history().get("hours") or {}
    typical = {}
    for park_id in park_ids:
        samples = []
        for key, rows in hours.items():
            if key == bucket or park_id not in rows:
                continue
            try:
                stamp = datetime.strptime(key, "%Y-%m-%dT%H")
            except ValueError:
                continue
            if stamp.weekday() != now.weekday() or stamp.hour != now.hour:
                continue
            samples.append(rows[park_id])
        cars = [row[0] for row in samples if row and row[0] is not None]
        bikes = [row[1] for row in samples if row and len(row) > 1 and row[1] is not None]
        typical[park_id] = {
            "samples": len(samples),
            "private_car": round(sum(cars) / len(cars)) if len(cars) >= 3 else None,
            "motorcycle": round(sum(bikes) / len(bikes)) if len(bikes) >= 3 else None,
        }
    return typical


def _seconds_until_next_hour():
    now = datetime.utcnow()
    nxt = (now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1))
    return max(30, (nxt - now).total_seconds() + 15)


def start_hourly_recorder():
    """Keep recording after startup, even when nobody opens the map."""
    if getattr(start_hourly_recorder, "started", False):
        return
    from app import app
    # The debug reloader imports the app twice. Only the serving process records.
    debug = os.environ.get("FLASK_DEBUG") in ("1", "true")
    if debug and os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        return
    start_hourly_recorder.started = True

    def loop():
        from app.govdata import fetch_zh_carparks
        while True:
            try:
                record_hourly_snapshot(fetch_zh_carparks())
            except Exception:
                app.logger.exception("hourly vacancy snapshot failed")
            time.sleep(_seconds_until_next_hour())

    threading.Thread(target=loop, name="vacancy-hour", daemon=True).start()
