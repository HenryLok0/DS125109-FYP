import React, { useEffect, useMemo, useState } from 'react';
import { Card, Spinner } from 'react-bootstrap';
import {
  forecastPark,
  loadVacancySeries,
  readPrivateCar,
  recordObservation,
} from '../vacancyForecast';

const COPY = {
  en: {
    title: 'Vacancy in 30 minutes',
    loading: 'Loading the vacancy history…',
    waiting: 'Reading the live vacancy…',
    noCount: 'This car park has no private-car hourly count, so the forecast is paused.',
    missing: 'The vacancy history file is not available yet. Run npm run series, then reload.',
    short: 'There is not enough 15-minute history for this car park yet. Readings from this device will be kept for the next forecast.',
    now: 'Now',
    predicted: 'In 30 minutes',
    baseline: 'Previous-hour average',
    seasonal: 'Estimated from the same time yesterday.',
    live: 'Estimated from the last hour on this device.',
    compared: (mae, base, hit, baseHit) => `On past data, this forecast missed by ${mae} spaces on average, and the previous-hour average missed by ${base}. Within 5 spaces: ${hit}% versus ${baseHit}%.`,
    foot: 'Updates every 60 seconds.',
    spaces: 'spaces',
  },
  tc: {
    title: '未來 30 分鐘空位',
    loading: '正在載入空位歷史…',
    waiting: '正在讀取即時空位…',
    noCount: '這個場沒有私家車時租的實際空位數，預測暫停。',
    missing: '空位歷史檔暫時讀不到。請先執行 npm run series，再重新載入。',
    short: '這個場的 15 分鐘歷史還不夠。這部裝置之後收集到的讀數會用來預測。',
    now: '而家',
    predicted: '30 分鐘後',
    baseline: '上一小時平均',
    seasonal: '跟住昨日同一時間的變化估計。',
    live: '跟住最近一小時的變化估計。',
    compared: (mae, base, hit, baseHit) => `過去試過：預測平均差 ${mae} 個位，上一小時平均差 ${base} 個位。差 5 個位以內，預測 ${hit}%，上一小時平均 ${baseHit}%。`,
    foot: '每 60 秒更新。',
    spaces: '個位',
  },
  sc: {
    title: '未来 30 分钟空位',
    loading: '正在载入空位历史…',
    waiting: '正在读取实时空位…',
    noCount: '这个场没有私家车时租的实际空位数，预测暂停。',
    missing: '空位历史档暂时读不到。请先执行 npm run series，再重新载入。',
    short: '这个场的 15 分钟历史还不够。这部装置之后收集到的读数会用来预测。',
    now: '现在',
    predicted: '30 分钟后',
    baseline: '上一小时平均',
    seasonal: '跟着昨日同一时间的变化估计。',
    live: '跟着最近一小时的变化估计。',
    compared: (mae, base, hit, baseHit) => `过去试过：预测平均差 ${mae} 个位，上一小时平均差 ${base} 个位。差 5 个位以内，预测 ${hit}%，上一小时平均 ${baseHit}%。`,
    foot: '每 60 秒更新。',
    spaces: '个位',
  },
};

function Sparkline({ points }) {
  const width = 360;
  const height = 78;
  const pad = 8;
  const low = Math.min(...points.map((point) => point.v));
  const high = Math.max(...points.map((point) => point.v));
  const span = high - low || 1;
  const coords = points.map((point, index) => ({
    x: pad + (index * (width - pad * 2)) / Math.max(points.length - 1, 1),
    y: pad + (1 - (point.v - low) / span) * (height - pad * 2),
    forecast: point.forecast,
  }));
  const history = coords.filter((point) => !point.forecast);
  const forecast = coords.filter((point) => point.forecast);
  const line = history.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  const bridge = history.length && forecast.length
    ? `M${history[history.length - 1].x.toFixed(1)},${history[history.length - 1].y.toFixed(1)} L${forecast[0].x.toFixed(1)},${forecast[0].y.toFixed(1)}`
    : '';
  return (
    <svg className="forecast-spark" viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true">
      <path d={line} fill="none" stroke="#1976d2" strokeWidth="2.5" />
      {bridge && <path d={bridge} fill="none" stroke="#e07a12" strokeWidth="2.5" strokeDasharray="5 4" />}
      {forecast.map((point) => <circle key={point.x} cx={point.x} cy={point.y} r="4" fill="#e07a12" />)}
    </svg>
  );
}

function VacancyForecast({ parkId, vacancy, lang = 'en', refreshedAt }) {
  const copy = COPY[lang] || COPY.en;
  const [bundle, setBundle] = useState(null);
  const [failed, setFailed] = useState(false);
  const live = useMemo(() => readPrivateCar(vacancy), [vacancy]);

  useEffect(() => {
    let cancelled = false;
    loadVacancySeries()
      .then((data) => {
        if (!cancelled) setBundle(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!live) return;
    recordObservation(parkId, live.value, live.timeMs || Date.now());
  }, [parkId, live]);

  const result = useMemo(() => {
    if (!bundle || !live) return null;
    return forecastPark(bundle, parkId, live, Date.now());
  }, [bundle, parkId, live, refreshedAt]);

  let body = null;
  if (!bundle && !failed) {
    body = <p className="mb-0"><Spinner animation="border" size="sm" className="me-2" />{copy.loading}</p>;
  } else if (failed) {
    body = <p className="mb-0">{copy.missing}</p>;
  } else if (!live && !vacancy) {
    body = <p className="mb-0"><Spinner animation="border" size="sm" className="me-2" />{copy.waiting}</p>;
  } else if (!live) {
    body = <p className="mb-0">{copy.noCount}</p>;
  } else if (!result?.ok) {
    body = (
      <>
        <div className="forecast-stats">
          <div className="forecast-stat">
            <span>{copy.now}</span>
            <strong>{live.value}</strong>
            <em>{copy.spaces}</em>
          </div>
        </div>
        <p className="mb-0 mt-3">{copy.short}</p>
      </>
    );
  } else {
    const metrics = result.metrics;
    body = (
      <>
        <div className="forecast-stats">
          <div className="forecast-stat">
            <span>{copy.now}</span>
            <strong>{result.current}</strong>
            <em>{copy.spaces}</em>
          </div>
          <div className="forecast-stat accent">
            <span>{copy.predicted}</span>
            <strong>{result.predicted}</strong>
            <em>{copy.spaces}</em>
          </div>
          <div className="forecast-stat">
            <span>{copy.baseline}</span>
            <strong>{result.baseline}</strong>
            <em>{copy.spaces}</em>
          </div>
        </div>
        <Sparkline points={result.spark} />
        <p className="forecast-note">{result.anchor === 'live' ? copy.live : copy.seasonal}</p>
        {metrics && (
          <p className="forecast-note">
            {copy.compared(
              metrics.mae.toFixed(1),
              metrics.baselineMae.toFixed(1),
              Math.round(metrics.hitRate * 100),
              Math.round(metrics.baselineHitRate * 100),
            )}
          </p>
        )}
      </>
    );
  }

  return (
    <Card className="mb-3 forecast-panel">
      <Card.Body>
        <Card.Title>{copy.title}</Card.Title>
        {body}
        <p className="forecast-foot mb-0">{copy.foot}</p>
      </Card.Body>
    </Card>
  );
}

export default VacancyForecast;
