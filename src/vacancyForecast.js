/* 30-minute private-car vacancy forecast.

   History comes from the Transport Department 15-minute archive.
   ARIMA(p,1,0) is fit by least squares; p is chosen with AIC.
   The baseline predicts that vacancy stays at the previous-hour average.
*/

const STEP_MINUTES = 15;
const HORIZON_STEPS = 2;
const HIT_THRESHOLD = 5;
const STORE_KEY = 'easepark_vacancy_obs_v1';

let seriesCache = null;

export function parseVacancyTime(text) {
  const matched = String(text || '').match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!matched) return null;
  const stamp = Date.parse(`${matched[1]}-${matched[2]}-${matched[3]}T${matched[4]}:${matched[5]}:00+08:00`);
  return Number.isFinite(stamp) ? stamp : null;
}

export function readPrivateCar(row) {
  const types = row?.vehicle_type || [];
  const vehicle = types.find((item) => item.type === 'P');
  const hourly = (vehicle?.service_category || []).find((item) => item.category === 'HOURLY');
  if (!hourly || hourly.vacancy_type === 'C') return null;
  const value = Number(hourly.vacancy);
  if (!Number.isFinite(value) || value < 0) return null;
  return {
    value: Math.round(value),
    timeMs: parseVacancyTime(hourly.lastupdate),
    updatedText: hourly.lastupdate || '',
  };
}

function readStore() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}

export function readObservations(parkId) {
  const list = readStore()[parkId];
  return Array.isArray(list) ? list : [];
}

export function recordObservation(parkId, value, timeMs = Date.now()) {
  if (typeof localStorage === 'undefined' || !parkId || !Number.isFinite(value) || value < 0) return;
  const all = readStore();
  const step = STEP_MINUTES * 60 * 1000;
  const slot = Math.floor(timeMs / step) * step;
  const kept = (Array.isArray(all[parkId]) ? all[parkId] : []).filter((point) => (
    timeMs - point.t < 36 * 60 * 60 * 1000 && Math.floor(point.t / step) * step !== slot
  ));
  kept.push({ t: timeMs, v: Math.round(value) });
  kept.sort((a, b) => a.t - b.t);
  all[parkId] = kept.slice(-96);
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch (error) {
    // Quota failures still leave the current reading available for this forecast.
  }
}

export function hkClock(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Hong_Kong',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekdays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;
  return {
    hour,
    minute: Number(map.minute),
    weekday: weekdays[map.weekday] ?? 0,
  };
}

export function featureRow(values, index) {
  if (index < 4) return null;
  const current = values[index];
  const lag15 = values[index - 1];
  const lag30 = values[index - 2];
  const lag60 = values[index - 4];
  const hourPoints = [current, values[index - 1], values[index - 2], values[index - 3]];
  if ([current, lag15, lag30, lag60, hourPoints[3]].some((value) => value == null || !Number.isFinite(value))) {
    return null;
  }
  return {
    lag15,
    lag30,
    lag60,
    rollingMean60: hourPoints.reduce((sum, value) => sum + value, 0) / hourPoints.length,
  };
}

function differences(values) {
  const deltas = [];
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] == null || values[index - 1] == null) deltas.push(null);
    else deltas.push(values[index] - values[index - 1]);
  }
  return deltas;
}

function solveLinear(matrix, vector) {
  const size = vector.length;
  const rows = matrix.map((row, index) => [...row, vector[index]]);
  for (let col = 0; col < size; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < size; row += 1) {
      if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) pivot = row;
    }
    if (Math.abs(rows[pivot][col]) < 1e-8) return null;
    const hold = rows[col];
    rows[col] = rows[pivot];
    rows[pivot] = hold;
    const scale = rows[col][col];
    for (let colIndex = col; colIndex <= size; colIndex += 1) rows[col][colIndex] /= scale;
    for (let row = 0; row < size; row += 1) {
      if (row === col) continue;
      const factor = rows[row][col];
      if (factor === 0) continue;
      for (let colIndex = col; colIndex <= size; colIndex += 1) {
        rows[row][colIndex] -= factor * rows[col][colIndex];
      }
    }
  }
  return rows.map((row) => row[size]);
}

function fitOrder(deltas, order) {
  const rows = [];
  const targets = [];
  for (let time = order; time < deltas.length; time += 1) {
    if (deltas[time] == null) continue;
    const row = [1];
    let complete = true;
    for (let lag = 1; lag <= order; lag += 1) {
      if (deltas[time - lag] == null) {
        complete = false;
        break;
      }
      row.push(deltas[time - lag]);
    }
    if (!complete) continue;
    rows.push(row);
    targets.push(deltas[time]);
  }
  if (rows.length < order + 8) return null;
  const width = order + 1;
  const xtx = Array.from({ length: width }, () => Array(width).fill(0));
  const xty = Array(width).fill(0);
  rows.forEach((row, rowIndex) => {
    for (let column = 0; column < width; column += 1) {
      xty[column] += row[column] * targets[rowIndex];
      for (let other = 0; other < width; other += 1) xtx[column][other] += row[column] * row[other];
    }
  });
  const solved = solveLinear(xtx, xty);
  if (!solved || solved.some((value) => !Number.isFinite(value))) return null;
  const phi = solved.slice(1);
  if (phi.some((value) => Math.abs(value) > 1.5)) return null;
  let rss = 0;
  rows.forEach((row, rowIndex) => {
    const predicted = row.reduce((sum, value, column) => sum + value * solved[column], 0);
    rss += (targets[rowIndex] - predicted) ** 2;
  });
  const sigma = Math.max(rss, 1e-8) / rows.length;
  const score = rows.length * Math.log(sigma) + 2 * width;
  return { order, intercept: solved[0], phi, score };
}

export function fitArima(values, maxOrder = 3) {
  const deltas = differences(values);
  const known = deltas.filter((value) => value != null);
  if (known.length < 12) return null;
  let best = null;
  for (let order = 0; order <= maxOrder; order += 1) {
    const fitted = fitOrder(deltas, order);
    if (fitted && (!best || fitted.score < best.score)) best = fitted;
  }
  if (!best) return null;
  return {
    name: `ARIMA(${best.order},1,0)`,
    p: best.order,
    c: best.intercept,
    phi: best.phi,
  };
}

export function forecastLevels(recent, model, steps) {
  if (!model || recent.length < model.p + 1) return null;
  const tail = recent.slice(-(Math.max(model.p + 1, 2)));
  if (tail.some((value) => value == null || !Number.isFinite(value))) return null;
  const history = [];
  for (let index = 1; index < tail.length; index += 1) history.push(tail[index] - tail[index - 1]);
  if (history.length < model.p) return null;
  let level = tail[tail.length - 1];
  const path = [];
  for (let step = 0; step < steps; step += 1) {
    let delta = model.c;
    model.phi.forEach((weight, lag) => {
      delta += weight * history[history.length - 1 - lag];
    });
    if (!Number.isFinite(delta)) return null;
    history.push(delta);
    level = Math.max(0, level + delta);
    path.push(level);
  }
  return path;
}

function scoreErrors(errors) {
  const samples = errors.length;
  const absolute = errors.map((error) => Math.abs(error));
  return {
    mae: absolute.reduce((sum, error) => sum + error, 0) / samples,
    rmse: Math.sqrt(errors.reduce((sum, error) => sum + error * error, 0) / samples),
    hitRate: absolute.filter((error) => error <= HIT_THRESHOLD).length / samples,
    samples,
  };
}

export function evaluateForecasts(values, trainRatio = 0.6) {
  const model = fitArima(values.slice(0, Math.max(24, Math.floor(values.length * trainRatio))));
  if (!model) return null;
  const trainEnd = Math.max(24, Math.floor(values.length * trainRatio));
  const modelErrors = [];
  const baselineErrors = [];
  const lookback = Math.max(8, model.p + 2);
  for (let time = trainEnd; time + HORIZON_STEPS < values.length; time += 1) {
    const actual = values[time + HORIZON_STEPS];
    const features = featureRow(values, time);
    const tail = values.slice(time - lookback + 1, time + 1);
    if (actual == null || !features || tail.length < lookback || tail.some((value) => value == null)) continue;
    const path = forecastLevels(tail, model, HORIZON_STEPS);
    if (!path) continue;
    modelErrors.push(Math.max(0, Math.round(path[path.length - 1])) - actual);
    baselineErrors.push(Math.max(0, Math.round(features.rollingMean60)) - actual);
  }
  if (modelErrors.length < 20) return { model, metrics: null };
  const modelScore = scoreErrors(modelErrors);
  const baselineScore = scoreErrors(baselineErrors);
  return {
    model,
    metrics: {
      mae: modelScore.mae,
      rmse: modelScore.rmse,
      hitRate: modelScore.hitRate,
      baselineMae: baselineScore.mae,
      baselineRmse: baselineScore.rmse,
      baselineHitRate: baselineScore.hitRate,
      samples: modelScore.samples,
      hitThreshold: HIT_THRESHOLD,
    },
  };
}

function seasonalWindow(values, originMs, nowMs) {
  const step = STEP_MINUTES * 60 * 1000;
  const index = Math.round((nowMs - 24 * 60 * 60 * 1000 - originMs) / step);
  for (let shift = 0; shift <= 4; shift += 1) {
    const candidates = shift === 0 ? [index] : [index - shift, index + shift];
    for (const candidate of candidates) {
      if (candidate < 7 || candidate >= values.length) continue;
      const window = values.slice(candidate - 7, candidate + 1);
      if (window.length === 8 && window.every((value) => value != null)) {
        return { window, index: candidate };
      }
    }
  }
  return null;
}

function trailingLive(points, nowMs, minCount) {
  const step = STEP_MINUTES * 60 * 1000;
  const buckets = new Map();
  points.forEach((point) => {
    if (!Number.isFinite(point?.t) || !Number.isFinite(point?.v)) return;
    const slot = Math.floor(point.t / step) * step;
    const previous = buckets.get(slot);
    if (!previous || point.t >= previous.t) buckets.set(slot, point);
  });
  const latestSlot = [...buckets.keys()].sort((a, b) => b - a)[0];
  if (latestSlot == null || nowMs - latestSlot > 20 * 60 * 1000) return null;
  const window = [];
  for (let slot = latestSlot; window.length < 8; slot -= step) {
    const hit = buckets.get(slot);
    if (!hit) break;
    window.push(hit.v);
  }
  window.reverse();
  return window.length >= minCount ? window : null;
}

function roundSpaces(value) {
  return Math.max(0, Math.round(value));
}

export function forecastFromSeries({
  values,
  originMs,
  filled = 0,
  current,
  storedPoints = [],
  nowMs = Date.now(),
}) {
  if (!current || !Number.isFinite(current.value)) {
    return { ok: false, reason: 'no-count' };
  }
  const trained = values?.length ? evaluateForecasts(values) : null;
  const model = trained?.model || (values?.length ? fitArima(values) : null);
  const publishedAge = current.timeMs ? Math.abs(nowMs - current.timeMs) : Infinity;
  const anchorTime = publishedAge < 30 * 60 * 1000 ? current.timeMs : nowMs;
  const liveWindow = trailingLive(
    [...storedPoints, { t: anchorTime, v: current.value }],
    anchorTime,
    5,
  );
  let window = liveWindow;
  let anchor = 'live';
  let alignedAt = null;
  if (!window && values?.length) {
    const seasonal = seasonalWindow(values, originMs, anchorTime);
    if (seasonal) {
      const delta = current.value - seasonal.window[seasonal.window.length - 1];
      window = seasonal.window.map((value) => value + delta);
      window[window.length - 1] = current.value;
      anchor = 'seasonal';
      alignedAt = originMs + seasonal.index * STEP_MINUTES * 60 * 1000;
    }
  }
  const validPoints = values ? values.filter((value) => value != null).length : 0;
  if (!window || !model) {
    return { ok: false, reason: 'short-history', current: current.value, validPoints, filled };
  }
  const path = forecastLevels(window, model, HORIZON_STEPS);
  const features = featureRow(window, window.length - 1);
  if (!path || !features) {
    return { ok: false, reason: 'short-history', current: current.value, validPoints, filled };
  }
  const predicted = roundSpaces(path[path.length - 1]);
  const baseline = roundSpaces(features.rollingMean60);
  return {
    ok: true,
    modelName: model.name,
    anchor,
    alignedAt,
    current: current.value,
    predicted,
    baseline,
    features,
    metrics: trained?.metrics || null,
    spark: [
      ...window.map((value) => ({ v: roundSpaces(value), forecast: false })),
      { v: predicted, forecast: true },
    ],
    validPoints,
    filled,
    slots: values.length,
    hitThreshold: HIT_THRESHOLD,
  };
}

export function loadVacancySeries() {
  if (!seriesCache) {
    const base = process.env.PUBLIC_URL || '';
    seriesCache = fetch(`${base}/data/vacancy_series.json`).then((response) => {
      if (!response.ok) throw new Error('Missing vacancy series');
      return response.json();
    }).catch((error) => {
      seriesCache = null;
      throw error;
    });
  }
  return seriesCache;
}

export function forecastPark(bundle, parkId, current, nowMs = Date.now()) {
  const encoded = bundle?.parks?.[parkId];
  const values = encoded ? encoded.v.map((value) => (value < 0 ? null : value)) : null;
  return forecastFromSeries({
    values,
    originMs: bundle ? Date.parse(bundle.origin) : NaN,
    filled: encoded?.filled || 0,
    current,
    storedPoints: readObservations(parkId),
    nowMs,
  });
}
