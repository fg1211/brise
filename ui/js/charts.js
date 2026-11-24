import { weatherIcon } from './icons.js';
import {
  formatDateShort,
  formatTime,
  formatWeekday,
  localDayKey,
  localParts,
  tempValue,
  solarTimes,
  dayKeyDate,
  toDate,
} from './weather.js';

const RANGE_CONFIG = {
  '24h': { count: 25, labels: 5 },
  '48h': { count: 49, labels: 6 },
  '7d': { count: Infinity, labels: 7 },
};

function rangeData(model, range) {
  const now = new Date();
  const future = model.hourly.filter((hour) => hour.timestamp >= now - 45 * 60000);
  if (range === '7d') {
    const end = now.getTime() + 7 * 86400000;
    const filtered = future.filter((hour) => hour.timestamp.getTime() <= end);
    if (filtered.length <= 80) return filtered;
    const stride = Math.ceil(filtered.length / 60);
    return filtered.filter((_, index) => index === 0 || index === filtered.length - 1 || index % stride === 0);
  }
  return future.slice(0, RANGE_CONFIG[range]?.count || 25);
}

function tempDomain(data, settings) {
  const values = data.map((hour) => tempValue(hour.tempC, settings.tempUnit)).filter(Number.isFinite);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max(1.2, (max - min) * 0.2);
  return { min: Math.floor(min - padding), max: Math.ceil(max + padding) };
}

function smoothPath(points) {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const prev = points[i - 1] || points[i];
    const current = points[i];
    const next = points[i + 1];
    const after = points[i + 2] || next;
    const tension = 0.16;
    const cp1x = current.x + (next.x - prev.x) * tension;
    const cp1y = current.y + (next.y - prev.y) * tension;
    const cp2x = next.x - (after.x - current.x) * tension;
    const cp2y = next.y - (after.y - current.y) * tension;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }
  return d;
}

function nightIntervals(model, start, end) {
  const intervals = [];
  const startKey = localDayKey(new Date(start.getTime() - 86400000));
  const [year, month, day] = startKey.split('-').map(Number);
  for (let i = -1; i < 9; i += 1) {
    const date = new Date(Date.UTC(year, month - 1, day + i, 12));
    const key = localDayKey(date);
    const nextKeyDate = dayKeyDate(key);
    nextKeyDate.setUTCDate(nextKeyDate.getUTCDate() + 1);
    const sun = solarTimes(date, model.city.lat, model.city.lon);
    const nextSun = solarTimes(nextKeyDate, model.city.lat, model.city.lon);
    if (!sun.sunset || !nextSun.sunrise) continue;
    const from = new Date(Math.max(start.getTime(), sun.sunset.getTime()));
    const to = new Date(Math.min(end.getTime(), nextSun.sunrise.getTime()));
    if (from < to) intervals.push([from, to]);
  }
  return intervals;
}

function xTicks(data, range) {
  const ticks = [];
  if (range === '7d') {
    for (const hour of data) {
      if (hour.hourNumber === 12) ticks.push({ date: hour.timestamp, label: `${formatWeekday(hour.timestamp, true)} ${formatDateShort(hour.timestamp)}` });
    }
    if (ticks.length > 9) return ticks.filter((_, index) => index % 2 === 0);
    return ticks;
  }
  const first = data[0].timestamp;
  const last = data.at(-1).timestamp;
  const stepHours = range === '24h' ? 6 : 6;
  const candidate = new Date(first);
  candidate.setMinutes(0, 0, 0);
  candidate.setHours(candidate.getHours() + ((stepHours - (candidate.getHours() % stepHours)) % stepHours));
  while (candidate <= last) {
    ticks.push({ date: new Date(candidate), label: formatTime(candidate) });
    candidate.setHours(candidate.getHours() + stepHours);
  }
  return ticks;
}

function renderEmpty(container) {
  container.innerHTML = `<div class="chart-empty">Noch keine Verlaufsdaten verfügbar.</div>`;
}

export function renderTrendChart(container, model, range = '48h', settings = { tempUnit: 'c' }) {
  if (!container) return;
  if (container._trendResizeObserver) {
    container._trendResizeObserver.disconnect();
    container._trendResizeObserver = null;
  }

  const draw = () => {
    const width = Math.max(420, Math.floor(container.clientWidth));
    const height = Math.max(210, Math.min(280, Math.round(width * 0.34)));
    const data = rangeData(model, range);
    if (data.length < 2) {
      renderEmpty(container);
      return;
    }

    const top = 22;
    const bottom = 34;
    const left = 39;
    const right = 17;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const start = data[0].timestamp;
    const end = data.at(-1).timestamp;
    const domain = tempDomain(data, settings);
    const xFor = (date) => left + ((date.getTime() - start.getTime()) / Math.max(1, end.getTime() - start.getTime())) * plotWidth;
    const yFor = (temp) => top + (1 - (tempValue(temp, settings.tempUnit) - domain.min) / (domain.max - domain.min)) * plotHeight;
    const points = data.map((hour) => ({ x: xFor(hour.timestamp), y: yFor(hour.tempC), hour }));
    const linePath = smoothPath(points);
    const baseline = top + plotHeight;
    const areaPath = `${linePath} L ${points.at(-1).x.toFixed(2)} ${baseline} L ${points[0].x.toFixed(2)} ${baseline} Z`;
    const nights = nightIntervals(model, start, end);
    const xTicksValue = xTicks(data, range);
    const nowX = xFor(new Date(Math.max(start.getTime(), Date.now())));
    const maxProb = data.reduce((max, hour) => Math.max(max, hour.prob || 0), 0);

    const gridTicks = 4;
    let grid = '';
    for (let i = 0; i <= gridTicks; i += 1) {
      const ratio = i / gridTicks;
      const y = top + ratio * plotHeight;
      const value = domain.max - ratio * (domain.max - domain.min);
      grid += `<line class="chart-gridline" x1="${left}" y1="${y.toFixed(1)}" x2="${width - right}" y2="${y.toFixed(1)}"/>
        <text class="chart-axis-label" x="${left - 8}" y="${(y + 3.5).toFixed(1)}" text-anchor="end">${Math.round(value)}°</text>`;
    }

    const nightRects = nights.map(([from, to]) => {
      const x = xFor(from);
      const x2 = xFor(to);
      return `<rect x="${x.toFixed(1)}" y="${top}" width="${Math.max(0, x2 - x).toFixed(1)}" height="${plotHeight}" fill="var(--chart-night)"/>`;
    }).join('');

    const bars = data.map((hour) => {
      const prob = hour.prob;
      if (!Number.isFinite(prob) || prob <= 3) return '';
      const x = xFor(hour.timestamp);
      const barWidth = Math.max(2, Math.min(7, plotWidth / data.length - 2));
      const barHeight = 5 + Math.pow(prob / 100, 0.8) * 36;
      return `<rect class="chart-rain-bar" x="${(x - barWidth / 2).toFixed(1)}" y="${(baseline - barHeight).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="${(barWidth / 2).toFixed(1)}" opacity="${(0.24 + prob / 160).toFixed(2)}"/>`;
    }).join('');

    const xtickMarkup = xTicksValue.map((tick) => {
      const x = xFor(tick.date);
      return `<line class="chart-x-tick" x1="${x.toFixed(1)}" y1="${baseline}" x2="${x.toFixed(1)}" y2="${baseline + 4}"/>
        <text class="chart-axis-label chart-x-label" x="${x.toFixed(1)}" y="${baseline + 18}" text-anchor="middle">${tick.label}</text>`;
    }).join('');

    const gradientId = `chartArea-${Math.random().toString(36).slice(2, 8)}`;

    container.innerHTML = `
      <div class="trend-chart-wrap">
        <svg class="trend-chart" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Temperatur- und Regenprognose">
          <defs>
            <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="var(--chart-line)" stop-opacity=".32"/>
              <stop offset=".75" stop-color="var(--chart-line)" stop-opacity=".06"/>
              <stop offset="1" stop-color="var(--chart-line)" stop-opacity="0"/>
            </linearGradient>
            <linearGradient id="${gradientId}-bar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="var(--chart-rain)" stop-opacity=".9"/>
              <stop offset="1" stop-color="var(--chart-rain)" stop-opacity=".12"/>
            </linearGradient>
          </defs>
          ${nightRects}
          ${grid}
          ${bars.replaceAll('class="chart-rain-bar"', `class="chart-rain-bar" fill="url(#${gradientId}-bar)"`)}
          <path class="chart-area" d="${areaPath}" fill="url(#${gradientId})"/>
          <path class="chart-line" d="${linePath}"/>
          <line class="chart-now-line" x1="${nowX}" y1="${top}" x2="${nowX}" y2="${baseline}"/>
          <circle class="chart-now-dot" cx="${points[0].x}" cy="${points[0].y}" r="3.5"/>
          <text class="chart-now-label" x="${Math.min(width - right - 20, Math.max(left + 20, nowX))}" y="${top - 7}" text-anchor="middle">JETZT</text>
          <line class="chart-baseline" x1="${left}" y1="${baseline}" x2="${width - right}" y2="${baseline}"/>
          ${xtickMarkup}
          <g class="chart-hover" opacity="0">
            <line class="chart-hover-line" y1="${top}" y2="${baseline}"/>
            <circle class="chart-hover-dot" r="5"/>
          </g>
          <rect class="chart-hitarea" x="${left}" y="0" width="${plotWidth}" height="${height - bottom + 5}" tabindex="0" aria-label="Wetterdiagramm. Mit den Pfeiltasten einen Zeitpunkt wählen."/>
        </svg>
        <div class="chart-tooltip" hidden></div>
      </div>
      <div class="chart-legend">
        <span class="legend-item"><i class="legend-line"></i> Temperatur</span>
        <span class="legend-item"><i class="legend-bar"></i> Regenwahrscheinlichkeit</span>
        <span class="chart-range-hint">${maxProb > 0 ? `bis ${maxProb} % Regen` : 'trocken'}</span>
      </div>`;

    const svg = container.querySelector('svg');
    const hover = svg.querySelector('.chart-hover');
    const hoverLine = svg.querySelector('.chart-hover-line');
    const hoverDot = svg.querySelector('.chart-hover-dot');
    const tooltip = container.querySelector('.chart-tooltip');
    const hitarea = svg.querySelector('.chart-hitarea');
    let selected = points.length - 1;

    const show = (index) => {
      const point = points[index];
      if (!point) return;
      const hour = point.hour;
      const parts = localParts(hour.timestamp);
      hover.setAttribute('opacity', '1');
      hoverLine.setAttribute('x1', point.x);
      hoverLine.setAttribute('x2', point.x);
      hoverDot.setAttribute('cx', point.x);
      hoverDot.setAttribute('cy', point.y);
      const dayLabel = `${formatWeekday(hour.timestamp, true)}, ${Number(parts.day)}.${parts.month}. · ${formatTime(hour.timestamp)}`;
      const temp = tempValue(hour.tempC, settings.tempUnit);
      const rain = hour.prob === null ? '–' : `${hour.prob} %`;
      tooltip.innerHTML = `
        <div class="chart-tip-time">${dayLabel}</div>
        <div class="chart-tip-main"><span class="chart-tip-icon">${weatherIcon(hour.icon)}</span><strong>${Math.round(temp)}°</strong><span>${hour.label}</span></div>
        <div class="chart-tip-meta"><span>Regen ${rain}</span><span>${hour.precip > 0 ? `${hour.precip.toFixed(1)} mm` : 'trocken'}</span></div>`;
      tooltip.hidden = false;
      const tooltipWidth = 182;
      let x = point.x + 12;
      if (x + tooltipWidth > width) x = point.x - tooltipWidth - 12;
      tooltip.style.left = `${Math.max(4, x)}px`;
      tooltip.style.top = `${Math.max(8, Math.min(point.y - 30, height - 100))}px`;
    };

    const hide = () => {
      hover.setAttribute('opacity', '0');
      tooltip.hidden = true;
    };

    const nearest = (clientX) => {
      const rect = svg.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * width;
      let best = 0;
      let distance = Infinity;
      points.forEach((point, index) => {
        const d = Math.abs(point.x - x);
        if (d < distance) {
          distance = d;
          best = index;
        }
      });
      return best;
    };

    svg.addEventListener('pointermove', (event) => {
      if (event.target.closest('.chart-hitarea')) show(nearest(event.clientX));
    });
    svg.addEventListener('pointerleave', hide);
    hitarea.addEventListener('focus', () => show(selected));
    hitarea.addEventListener('blur', hide);
    hitarea.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        selected = Math.max(0, Math.min(points.length - 1, selected + (event.key === 'ArrowRight' ? 1 : -1)));
        show(selected);
      } else if (event.key === 'Escape') {
        hide();
        hitarea.blur();
      }
    });
  };

  draw();
  if (typeof ResizeObserver !== 'undefined') {
    let frame = 0;
    container._trendResizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => draw());
    });
    container._trendResizeObserver.observe(container);
  }
}

export function renderDayChart(container, day, settings = { tempUnit: 'c' }) {
  if (!container || !day?.hours?.length) return;
  const width = Math.max(340, container.clientWidth);
  const height = 150;
  const top = 16;
  const bottom = 25;
  const left = 26;
  const right = 12;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const data = day.hours;
  const start = data[0].timestamp;
  const end = data.at(-1).timestamp;
  const domain = tempDomain(data, settings);
  const xFor = (date) => left + ((date.getTime() - start.getTime()) / Math.max(1, end.getTime() - start.getTime())) * plotWidth;
  const yFor = (temp) => top + (1 - (tempValue(temp, settings.tempUnit) - domain.min) / (domain.max - domain.min)) * plotHeight;
  const points = data.map((hour) => ({ x: xFor(hour.timestamp), y: yFor(hour.tempC) }));
  const path = smoothPath(points);
  const area = `${path} L ${points.at(-1).x} ${top + plotHeight} L ${points[0].x} ${top + plotHeight} Z`;
  const gradientId = `dayArea-${Math.random().toString(36).slice(2, 8)}`;
  const labels = data.filter((hour) => [3, 9, 15, 21].includes(hour.hourNumber));

  container.innerHTML = `<svg class="day-chart" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">
    <defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--chart-line)" stop-opacity=".28"/><stop offset="1" stop-color="var(--chart-line)" stop-opacity="0"/>
    </linearGradient></defs>
    ${labels.map((hour) => `<line class="chart-gridline" x1="${xFor(hour.timestamp)}" y1="${top}" x2="${xFor(hour.timestamp)}" y2="${top + plotHeight}"/>`).join('')}
    <path d="${area}" fill="url(#${gradientId})"/>
    <path class="chart-line" d="${path}"/>
    ${data.filter((_, index) => index % 3 === 0).map((hour) => `<circle class="day-chart-dot" cx="${xFor(hour.timestamp)}" cy="${yFor(hour.tempC)}" r="2.4"/>`).join('')}
    ${labels.map((hour) => `<text class="chart-axis-label" x="${xFor(hour.timestamp)}" y="${height - 6}" text-anchor="middle">${String(hour.hourNumber).padStart(2, '0')} Uhr</text>`).join('')}
    ${data.filter((_, index) => index % 6 === 0).map((hour) => `<text class="chart-temp-float" x="${xFor(hour.timestamp)}" y="${yFor(hour.tempC) - 8}" text-anchor="middle">${Math.round(tempValue(hour.tempC, settings.tempUnit))}°</text>`).join('')}
  </svg>`;
}
