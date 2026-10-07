import bundle from '../public/data/vacancy_series.json';
import { evaluateForecasts, featureRow, forecastFromSeries, forecastPark, readPrivateCar } from './vacancyForecast';

test('reads a numeric private-car hourly vacancy and skips closed or empty text', () => {
  expect(readPrivateCar({
    vehicle_type: [{
      type: 'P',
      service_category: [{ category: 'HOURLY', vacancy_type: 'A', vacancy: '8', lastupdate: '2026-10-07 16:00:00' }],
    }],
  })).toMatchObject({ value: 8 });

  expect(readPrivateCar({
    vehicle_type: [{
      type: 'P',
      service_category: [{ category: 'HOURLY', vacancy_type: 'C', vacancy: 0 }],
    }],
  })).toBeNull();
});

test('previous-hour feature needs the last hour and the 60-minute lag', () => {
  expect(featureRow([1, 2, 3], 2)).toBeNull();
  expect(featureRow([4, 8, 12, 16, 20], 4)).toMatchObject({
    lag15: 16,
    lag30: 12,
    lag60: 4,
    rollingMean60: 14,
  });
});

test('ARIMA beats the previous-hour average on a steady climb', () => {
  const values = Array.from({ length: 80 }, (_, index) => index * 4);
  const result = evaluateForecasts(values);
  expect(result.model.name).toBe('ARIMA(0,1,0)');
  expect(result.metrics.mae).toBeLessThan(result.metrics.baselineMae);
  expect(result.metrics.hitRate).toBeGreaterThan(result.metrics.baselineHitRate);
  expect(result.metrics.samples).toBeGreaterThanOrEqual(20);
});

test('applies yesterday’s 30-minute change to the vacancy published now', () => {
  const originMs = Date.parse('2026-10-01T00:00:00+08:00');
  const values = Array.from({ length: 200 }, (_, index) => index * 2);
  const nowMs = originMs + (150 * 15 * 60 * 1000) + (24 * 60 * 60 * 1000);
  const result = forecastFromSeries({
    values,
    originMs,
    current: { value: 40, timeMs: nowMs },
    storedPoints: [],
    nowMs,
  });

  expect(result.ok).toBe(true);
  expect(result.anchor).toBe('seasonal');
  expect(result.predicted).toBe(44);
  expect(result.baseline).toBe(37);
});

test('forecasts a real archived car park for 16:00 on the day after the series', () => {
  const when = Date.parse('2026-10-07T16:00:00+08:00');
  const parkId = Object.keys(bundle.parks).find((id) => {
    const values = bundle.parks[id].v;
    return values.filter((value) => value >= 0).length > 400;
  });
  const latest = [...bundle.parks[parkId].v].reverse().find((value) => value >= 0);
  const result = forecastPark(bundle, parkId, { value: latest, timeMs: when }, when);
  expect(result.ok).toBe(true);
  expect(result.predicted).toBeGreaterThanOrEqual(0);
  expect(result.metrics.samples).toBeGreaterThanOrEqual(20);
  expect(Number.isFinite(result.metrics.mae)).toBe(true);
  expect(Number.isFinite(result.metrics.baselineMae)).toBe(true);
});
