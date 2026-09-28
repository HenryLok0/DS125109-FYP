"""Store hourly vacancy counts and estimate a typical value for the same weekday and hour."""
from datetime import datetime, timedelta

from app import db
from app.models import VacancySnapshot

HISTORY_DAYS = 60
MIN_SAMPLES = 3


def _as_count(value):
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None
    if number < 0:
        return None
    return number


def _hour_bucket(moment):
    return moment.replace(minute=0, second=0, microsecond=0)


def record_hourly_snapshot(carparks):
    """Save the current hour once. Repeat visits in the same hour do not add rows."""
    db.create_all()
    bucket = _hour_bucket(datetime.utcnow())
    latest = db.session.query(db.func.max(VacancySnapshot.recorded_at)).scalar()
    if latest is not None and latest >= bucket:
        return

    for carpark in carparks:
        park_id = str(carpark.get("park_id") or carpark.get("park_Id") or "")
        if not park_id:
            continue
        db.session.add(VacancySnapshot(
            park_id=park_id,
            recorded_at=bucket,
            private_car=_as_count(carpark.get("privateCar_vacancy")),
            motorcycle=_as_count(carpark.get("motorCycle_vacancy")),
        ))
    db.session.commit()


def typical_for_now(park_ids):
    """Average of earlier snapshots on this weekday and hour. Needs at least 3 samples."""
    now = datetime.utcnow()
    bucket = _hour_bucket(now)
    cutoff = now - timedelta(days=HISTORY_DAYS)
    rows = VacancySnapshot.query.filter(
        VacancySnapshot.park_id.in_(list(park_ids)),
        VacancySnapshot.recorded_at >= cutoff,
        VacancySnapshot.recorded_at < bucket,
    ).all()

    grouped = {}
    for row in rows:
        if row.recorded_at.weekday() != now.weekday() or row.recorded_at.hour != now.hour:
            continue
        bucket_rows = grouped.setdefault(row.park_id, [])
        bucket_rows.append(row)

    typical = {}
    for park_id, samples in grouped.items():
        cars = [row.private_car for row in samples if row.private_car is not None]
        bikes = [row.motorcycle for row in samples if row.motorcycle is not None]
        typical[park_id] = {
            "samples": len(samples),
            "private_car": round(sum(cars) / len(cars)) if len(cars) >= MIN_SAMPLES else None,
            "motorcycle": round(sum(bikes) / len(bikes)) if len(bikes) >= MIN_SAMPLES else None,
        }
    return typical
