/* Download Transport Department vacancy archives and write a 15-minute series.

   Private-car hourly counts only. Closed parks and non-numeric vacancy stay missing.
   Gaps of one or two intervals (15–30 minutes) are filled in a straight line.
*/

import { execFile } from 'child_process';
import { mkdir, readdir, readFile, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const FILE_URL = 'https://resource.data.one.gov.hk/td/carpark/vacancy_all.json';
const STEP_MS = 15 * 60 * 1000;
const DAYS = 7;

function hkDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const read = (type) => Number(parts.find((part) => part.type === type).value);
  return { y: read('year'), m: read('month'), d: read('day') };
}

function shiftDays(parts, delta) {
  const utc = new Date(Date.UTC(parts.y, parts.m - 1, parts.d + delta));
  return { y: utc.getUTCFullYear(), m: utc.getUTCMonth() + 1, d: utc.getUTCDate() };
}

function ymd(parts) {
  return `${parts.y}${String(parts.m).padStart(2, '0')}${String(parts.d).padStart(2, '0')}`;
}

function isoStart(parts) {
  return `${parts.y}-${String(parts.m).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}T00:00:00+08:00`;
}

function privateCarVacancy(park) {
  const vehicle = (park.vehicle_type || []).find((item) => item.type === 'P');
  const hourly = (vehicle?.service_category || []).find((item) => item.category === 'HOURLY');
  if (!hourly || hourly.vacancy_type === 'C') return null;
  const value = Number(hourly.vacancy);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

function fillShortGaps(values, maxGap = 2) {
  const next = values.slice();
  let filled = 0;
  let index = 0;
  while (index < next.length) {
    if (next[index] !== -1) {
      index += 1;
      continue;
    }
    let end = index;
    while (end < next.length && next[end] === -1) end += 1;
    const gap = end - index;
    const left = index - 1;
    if (gap <= maxGap && left >= 0 && end < next.length && next[left] !== -1 && next[end] !== -1) {
      for (let cursor = index; cursor < end; cursor += 1) {
        const weight = (cursor - left) / (end - left);
        next[cursor] = Math.round(next[left] + weight * (next[end] - next[left]));
        filled += 1;
      }
    }
    index = end;
  }
  return { values: next, filled };
}

function assertGapFill() {
  const { values, filled } = fillShortGaps([1, -1, -1, 4, -1, -1, -1, 8], 2);
  if (filled !== 2 || values[1] !== 2 || values[2] !== 3 || values[4] !== -1) {
    throw new Error('Short-gap fill failed its self-check');
  }
}

async function walkJson(dir) {
  const found = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await walkJson(fullPath));
    else if (entry.name.endsWith('.json')) found.push(fullPath);
  }
  return found;
}

function partsFromYmd(text) {
  return { y: Number(text.slice(0, 4)), m: Number(text.slice(4, 6)), d: Number(text.slice(6, 8)) };
}

async function listDailyArchives() {
  const end = shiftDays(hkDateParts(new Date()), -1);
  const start = shiftDays(end, -21);
  const url = `https://app.data.gov.hk/v1/historical-archive/list-file-versions?url=${encodeURIComponent(FILE_URL)}&start=${ymd(start)}&end=${ymd(end)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Archive list returned ${response.status}`);
  const payload = await response.json();
  return (payload['data-files'] || [])
    .filter((file) => file.period === 'D')
    .map((file) => file.timestamp)
    .sort()
    .slice(-DAYS);
}

async function downloadDay(day, destination) {
  const url = `https://app.data.gov.hk/v1/historical-archive/get-file?url=${encodeURIComponent(FILE_URL)}&time=${day}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${day} returned ${response.status}`);
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

async function main() {
  assertGapFill();
  const days = await listDailyArchives();
  if (!days.length) throw new Error('No daily vacancy archives were found');
  const origin = isoStart(partsFromYmd(days[0]));
  const originMs = Date.parse(origin);
  const endMs = Date.parse(isoStart(partsFromYmd(days[days.length - 1]))) + (24 * 60 * 60 * 1000);
  const slots = Math.round((endMs - originMs) / STEP_MS);
  console.log(`Using ${days.join(', ')} (${slots} slots)`);
  const series = new Map();
  const tempRoot = await mkdir(path.join(os.tmpdir(), 'easepark-vacancy'), { recursive: true }).then(() => (
    path.join(os.tmpdir(), 'easepark-vacancy')
  ));

  for (const day of days) {
    const zipPath = path.join(tempRoot, `${day}.zip`);
    const extractDir = path.join(tempRoot, day);
    console.log(`Downloading ${day}`);
    await downloadDay(day, zipPath);
    await rm(extractDir, { recursive: true, force: true });
    await mkdir(extractDir, { recursive: true });
    await execFileAsync('tar', ['-xf', zipPath, '-C', extractDir]);
    const files = await walkJson(extractDir);
    console.log(`  ${files.length} snapshots`);
    for (const filePath of files) {
      const matched = path.basename(filePath).match(/(\d{8}-\d{4})/);
      if (!matched) continue;
      const [year, month, date, hour, minute] = [
        matched[1].slice(0, 4),
        matched[1].slice(4, 6),
        matched[1].slice(6, 8),
        matched[1].slice(9, 11),
        matched[1].slice(11, 13),
      ];
      const slot = Math.round((Date.parse(`${year}-${month}-${date}T${hour}:${minute}:00+08:00`) - originMs) / STEP_MS);
      if (slot < 0 || slot >= slots) continue;
      const raw = await readFile(filePath, 'utf8');
      const payload = JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
      for (const park of payload.car_park || []) {
        const vacancy = privateCarVacancy(park);
        if (vacancy == null || !park.park_id) continue;
        let values = series.get(park.park_id);
        if (!values) {
          values = new Int16Array(slots);
          values.fill(-1);
          series.set(park.park_id, values);
        }
        values[slot] = vacancy;
      }
    }
    await rm(extractDir, { recursive: true, force: true });
    await rm(zipPath, { force: true });
  }

  const parks = {};
  let filledTotal = 0;
  for (const [parkId, raw] of series) {
    const { values, filled } = fillShortGaps(Array.from(raw), 2);
    const valid = values.filter((value) => value >= 0).length;
    if (valid / slots < 0.5) continue;
    filledTotal += filled;
    parks[parkId] = { v: values, filled };
  }

  const output = {
    stepMinutes: 15,
    origin,
    slots,
    source: FILE_URL,
    builtAt: new Date().toISOString(),
    parks,
  };
  const outputPath = path.join(process.cwd(), 'public', 'data', 'vacancy_series.json');
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(output));
  const bytes = (await readFile(outputPath)).length;
  console.log(`Kept ${Object.keys(parks).length} car parks, filled ${filledTotal} short gaps, ${bytes} bytes`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
