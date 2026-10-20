// Small SVG charts. No chart library, so the page stays static and self-contained.

function clear(container) {
  container.replaceChildren();
}

function svgEl(name, attrs) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

export function renderHBars(container, rows, options = {}) {
  clear(container);
  const data = (rows || []).filter((row) => Number.isFinite(row.value));
  if (!data.length) {
    container.append(note(options.empty || ""));
    return;
  }
  const width = 640;
  const rowH = 28;
  const labelW = 168;
  const height = data.length * rowH + 12;
  const max = Math.max(...data.map((row) => row.value), 1);
  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img" });
  if (options.label) {
    const title = svgEl("title", {});
    title.textContent = options.label;
    svg.append(title);
  }
  data.forEach((row, index) => {
    const y = index * rowH + 4;
    const barW = Math.max(2, ((width - labelW - 64) * row.value) / max);
    const label = svgEl("text", { x: 0, y: y + 16, class: "chart-label" });
    label.textContent = row.label;
    const rect = svgEl("rect", { x: labelW, y: y + 4, width: barW, height: 16, rx: 6, fill: row.color || "var(--brand)" });
    const value = svgEl("text", { x: labelW + barW + 8, y: y + 16, class: "chart-value" });
    value.textContent = options.format ? options.format(row.value) : String(Math.round(row.value));
    svg.append(label, rect, value);
  });
  container.append(svg);
}

export function renderLines(container, series, options = {}) {
  clear(container);
  const usable = (series || []).filter((item) => item.points?.length);
  if (!usable.length) {
    container.append(note(options.empty || ""));
    return;
  }
  const width = 680;
  const height = 260;
  const pad = { l: 42, r: 12, t: 16, b: 36 };
  const all = usable.flatMap((item) => item.points);
  const min = Math.min(...all.map((point) => point.y));
  const max = Math.max(...all.map((point) => point.y));
  const span = max - min || 1;
  const xAt = (index, count) => pad.l + ((width - pad.l - pad.r) * index) / Math.max(count - 1, 1);
  const yAt = (value) => pad.t + ((height - pad.t - pad.b) * (max - value)) / span;
  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img" });

  for (let tick = 0; tick < 4; tick += 1) {
    const value = min + (span * tick) / 3;
    const y = yAt(value);
    svg.append(svgEl("line", { x1: pad.l, x2: width - pad.r, y1: y, y2: y, class: "chart-grid" }));
    const text = svgEl("text", { x: 0, y: y + 4, class: "chart-tick" });
    text.textContent = options.format ? options.format(value) : String(Math.round(value));
    svg.append(text);
  }

  const colors = ["#3389ab", "#c4552a", "#1f7a4d", "#8a6a2f"];
  usable.forEach((item, seriesIndex) => {
    const color = item.color || colors[seriesIndex % colors.length];
    const d = item.points.map((point, index) => `${index === 0 ? "M" : "L"} ${xAt(index, item.points.length).toFixed(1)} ${yAt(point.y).toFixed(1)}`).join(" ");
    svg.append(svgEl("path", { d, fill: "none", stroke: color, "stroke-width": 2.4, "stroke-linejoin": "round" }));
    const last = item.points[item.points.length - 1];
    const text = svgEl("text", { x: xAt(item.points.length - 1, item.points.length) - 8, y: yAt(last.y) - 6, fill: color, class: "chart-series" });
    text.textContent = item.name;
    svg.append(text);
  });

  const labels = usable[0].points;
  const marks = [0, Math.floor((labels.length - 1) / 2), labels.length - 1];
  for (const index of new Set(marks)) {
    const point = labels[index];
    if (!point) continue;
    const text = svgEl("text", { x: xAt(index, labels.length), y: height - 10, "text-anchor": "middle", class: "chart-tick" });
    text.textContent = point.x;
    svg.append(text);
  }
  container.append(svg);
}

export function renderSplit(container, parts) {
  clear(container);
  const data = (parts || []).filter((part) => part.value > 0);
  const total = data.reduce((sum, part) => sum + part.value, 0);
  if (!total) {
    container.append(note(""));
    return;
  }
  const bar = document.createElement("div");
  bar.className = "split";
  for (const part of data) {
    const seg = document.createElement("span");
    seg.style.width = `${(part.value / total) * 100}%`;
    seg.style.background = part.color;
    seg.title = `${part.label} ${part.value}`;
    bar.append(seg);
  }
  const legend = document.createElement("div");
  legend.className = "split-legend";
  for (const part of data) {
    const item = document.createElement("span");
    const swatch = document.createElement("i");
    swatch.style.background = part.color;
    item.append(swatch, document.createTextNode(`${part.label} ${part.value}`));
    legend.append(item);
  }
  container.append(bar, legend);
}

function note(text) {
  const node = document.createElement("p");
  node.className = "muted";
  node.textContent = text;
  return node;
}
