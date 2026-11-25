import { GERMANY_GEO } from './germany-geo.js';
import { CITIES } from './cities.js';
import { formatTime, toDate, localDayKey } from './weather.js';

// Bright-Sky-Rohwerte * 0.12 = mm/h. Die Stufen orientieren sich
// deshalb an echten Niederschlagsklassen statt an willkürlichen Rohwerten.
const RADAR_COLORS = [
  { max: 8, color: [102, 191, 255, 44] },
  { max: 17, color: [82, 185, 255, 92] },
  { max: 34, color: [70, 220, 206, 132] },
  { max: 50, color: [119, 233, 139, 164] },
  { max: 84, color: [249, 226, 100, 195] },
  { max: 125, color: [255, 168, 76, 218] },
  { max: 209, color: [255, 91, 88, 235] },
  { max: Infinity, color: [232, 84, 201, 244] },
];

const MAP_LABELS = new Set([
  'berlin', 'hamburg', 'muenchen', 'koeln', 'frankfurt', 'stuttgart', 'leipzig',
  'dresden', 'hannover', 'nuernberg', 'bremen', 'kiel', 'magdeburg', 'erfurt',
  'rostock', 'duesseldorf', 'dortmund', 'mainz', 'saarbruecken', 'freiburg',
]);

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function geometryBounds(geometry) {
  const coords = [];
  const walk = (node) => {
    if (!Array.isArray(node)) return;
    if (node.length === 2 && typeof node[0] === 'number' && typeof node[1] === 'number') {
      coords.push(node);
    } else {
      node.forEach(walk);
    }
  };
  walk(geometry?.coordinates);
  if (!coords.length) return null;
  const lons = coords.map((p) => p[0]);
  const lats = coords.map((p) => p[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

function haversine(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function intensityLabel(raw) {
  const mmh = raw * 0.12;
  if (mmh <= 0.15) return 'trocken';
  if (mmh < 1.2) return 'Nieselregen';
  if (mmh < 4) return 'leichter Regen';
  if (mmh < 10) return 'mäßiger Regen';
  if (mmh < 25) return 'starker Regen';
  return 'sehr starker Regen';
}

function drawRoundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radius);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export class RadarRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.marker = options.marker || null;
    this.onFrame = options.onFrame || (() => {});
    this.data = null;
    this.city = null;
    this.frames = [];
    this.index = 0;
    this.colorCache = new Map();
    this.baseCanvas = null;
    this.projection = null;
    this.size = { width: 0, height: 0, dpr: 1 };
    this.timer = null;
    this.playing = false;
    this.resizeObserver = null;
    this.nearby = [];

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas.parentElement || canvas);
    }
  }

  setData(data, city) {
    this.pause();
    this.data = data;
    this.city = city;
    if (!Array.isArray(data?.frames) || !data.frames.length) {
      throw new Error('Die Radardaten sind unvollständig.');
    }
    this.frames = data.frames.map((frame) => {
      let bytes;
      try {
        bytes = decodeBase64(frame?.data);
      } catch {
        throw new Error('Ein Radarbild konnte nicht gelesen werden.');
      }
      if (!Number.isInteger(frame?.width) || !Number.isInteger(frame?.height)
        || frame.width <= 0 || frame.height <= 0
        || bytes.length < frame.width * frame.height) {
        throw new Error('Ein Radarbild hat eine ungültige Größe.');
      }
      return { ...frame, date: toDate(frame.timestamp), bytes, colorCanvas: null };
    });
    this.colorCache.clear();
    this.index = this.findLiveIndex();
    this.nearby = this.findNearbyCities();
    this.resize(true);
    this.setFrame(this.index);
  }

  findLiveIndex() {
    const now = Date.now();
    let best = 0;
    let bestDistance = Infinity;
    this.frames.forEach((frame, index) => {
      if (!frame.date) return;
      const distance = Math.abs(frame.date.getTime() - now);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    return best;
  }

  findNearbyCities() {
    if (!this.city) return [];
    return CITIES
      .filter((candidate) => candidate.id !== this.city.id && MAP_LABELS.has(candidate.id))
      .map((candidate) => ({
        ...candidate,
        distance: haversine(this.city.lat, this.city.lon, candidate.lat, candidate.lon),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 8);
  }

  resize(force = false) {
    if (!this.canvas || !this.data) return;
    const rect = (this.canvas.parentElement || this.canvas).getBoundingClientRect();
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);
    if (!width || !height) return;
    if (!force && width === this.size.width && height === this.size.height) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.size = { width, height, dpr };
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.projection = this.createProjection(width, height);
    this.buildBase();
    this.draw();
    this.positionMarker();
  }

  createProjection(width, height) {
    const bounds = geometryBounds(this.data.geometry);
    if (!bounds) return null;
    const [minLon, minLat, maxLon, maxLat] = bounds;
    const midLat = (minLat + maxLat) / 2;
    const cosLat = Math.cos((midLat * Math.PI) / 180);
    const lonSpan = Math.max(0.001, (maxLon - minLon) * cosLat);
    const latSpan = Math.max(0.001, maxLat - minLat);
    const padding = Math.max(22, Math.min(44, width * 0.045));
    const scale = Math.min((width - padding * 2) / lonSpan, (height - padding * 2) / latSpan);
    const mapWidth = lonSpan * scale;
    const mapHeight = latSpan * scale;
    const originX = (width - mapWidth) / 2;
    const originY = (height - mapHeight) / 2;
    const toXY = (lon, lat) => [
      originX + (lon - minLon) * cosLat * scale,
      originY + (maxLat - lat) * scale,
    ];
    return { bounds, minLon, minLat, maxLon, maxLat, scale, originX, originY, mapWidth, mapHeight, width, height, toXY, cosLat };
  }

  buildBase() {
    if (!this.projection) return;
    const { width, height, dpr } = this.size;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, 'rgba(9, 22, 30, 0.96)');
    bg.addColorStop(0.48, 'rgba(10, 28, 37, 0.98)');
    bg.addColorStop(1, 'rgba(7, 18, 26, 0.98)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width * 0.54, height * 0.46, 0, width * 0.54, height * 0.46, Math.max(width, height) * 0.68);
    glow.addColorStop(0, 'rgba(58, 126, 133, 0.13)');
    glow.addColorStop(0.55, 'rgba(28, 68, 80, 0.045)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    this.drawGraticule(ctx);
    this.drawGermany(ctx);
    this.drawVignette(ctx);
    this.baseCanvas = canvas;
  }

  drawGraticule(ctx) {
    const proj = this.projection;
    ctx.save();
    ctx.strokeStyle = 'rgba(180, 218, 220, 0.045)';
    ctx.lineWidth = 1;
    const lonStep = proj.width > 700 ? 0.5 : 0.75;
    const latStep = 0.35;
    const minLon = Math.floor(proj.minLon / lonStep) * lonStep;
    const maxLon = Math.ceil(proj.maxLon / lonStep) * lonStep;
    const minLat = Math.floor(proj.minLat / latStep) * latStep;
    const maxLat = Math.ceil(proj.maxLat / latStep) * latStep;
    for (let lon = minLon; lon <= maxLon; lon += lonStep) {
      const [x] = proj.toXY(lon, proj.minLat);
      ctx.beginPath();
      ctx.moveTo(x, proj.originY);
      ctx.lineTo(x, proj.originY + proj.mapHeight);
      ctx.stroke();
    }
    for (let lat = minLat; lat <= maxLat; lat += latStep) {
      const [, y] = proj.toXY(proj.minLon, lat);
      ctx.beginPath();
      ctx.moveTo(proj.originX, y);
      ctx.lineTo(proj.originX + proj.mapWidth, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawGermany(ctx) {
    const proj = this.projection;
    if (!proj) return;
    const polygonPath = (rings) => {
      const path = new Path2D();
      for (const ring of rings) {
        if (!ring?.length) continue;
        ring.forEach(([lon, lat], index) => {
          const [x, y] = proj.toXY(lon, lat);
          if (index === 0) path.moveTo(x, y);
          else path.lineTo(x, y);
        });
        path.closePath();
      }
      return path;
    };

    const outline = polygonPath(GERMANY_GEO.outline);
    ctx.save();
    const fill = ctx.createLinearGradient(proj.originX, proj.originY, proj.originX + proj.mapWidth, proj.originY + proj.mapHeight);
    fill.addColorStop(0, 'rgba(31, 69, 72, 0.36)');
    fill.addColorStop(0.55, 'rgba(22, 53, 58, 0.28)');
    fill.addColorStop(1, 'rgba(15, 38, 46, 0.24)');
    ctx.fillStyle = fill;
    ctx.fill(outline);
    ctx.strokeStyle = 'rgba(175, 233, 218, 0.22)';
    ctx.lineWidth = 1.1;
    ctx.stroke(outline);

    ctx.strokeStyle = 'rgba(160, 214, 203, 0.11)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([2, 4]);
    for (const state of GERMANY_GEO.states) {
      const path = polygonPath(state.rings);
      ctx.stroke(path);
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  drawVignette(ctx) {
    const { width, height } = this.size;
    const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.25, width / 2, height / 2, Math.max(width, height) * 0.74);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(1, 7, 11, 0.52)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  getColorCanvas(frame) {
    if (frame.colorCanvas) return frame.colorCanvas;
    const offscreen = document.createElement('canvas');
    offscreen.width = frame.width;
    offscreen.height = frame.height;
    const ctx = offscreen.getContext('2d');
    const image = ctx.createImageData(frame.width, frame.height);
    const bytes = frame.bytes;
    for (let i = 0; i < bytes.length; i += 1) {
      const value = bytes[i];
      if (!value) continue;
      const color = RADAR_COLORS.find((entry) => value < entry.max)?.color || RADAR_COLORS.at(-1).color;
      const offset = i * 4;
      image.data[offset] = color[0];
      image.data[offset + 1] = color[1];
      image.data[offset + 2] = color[2];
      image.data[offset + 3] = color[3];
    }
    ctx.putImageData(image, 0, 0);
    frame.colorCanvas = offscreen;
    return offscreen;
  }

  drawFrameImage(frame) {
    const ctx = this.ctx;
    const proj = this.projection;
    if (!proj || !frame) return;
    const layer = this.getColorCanvas(frame);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    try {
      ctx.filter = 'blur(7px)';
      ctx.globalAlpha = 0.34;
      ctx.drawImage(layer, proj.originX, proj.originY, proj.mapWidth, proj.mapHeight);
    } catch {
      // Older WebKit builds ignore canvas filters gracefully.
    }
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.drawImage(layer, proj.originX, proj.originY, proj.mapWidth, proj.mapHeight);
    ctx.restore();
  }

  drawRadarRings(ctx) {
    const proj = this.projection;
    if (!proj || !this.city) return;
    const [cx, cy] = proj.toXY(this.city.lon, this.city.lat);
    const kmToPx = (km) => (km / 111.32) * proj.scale;
    ctx.save();
    ctx.strokeStyle = 'rgba(186, 240, 231, 0.14)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 7]);
    [25, 50, 100, 150].forEach((km) => {
      const radius = kmToPx(km);
      if (radius > Math.max(proj.mapWidth, proj.mapHeight) * 0.62) return;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      const angle = -Math.PI / 4;
      const lx = cx + Math.cos(angle) * radius;
      const ly = cy + Math.sin(angle) * radius;
      ctx.save();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(196, 232, 228, 0.4)';
      ctx.font = '500 9px Inter, sans-serif';
      ctx.fillText(`${km} km`, lx + 4, ly - 4);
      ctx.restore();
    });
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(225, 255, 248, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy);
    ctx.lineTo(cx + 7, cy);
    ctx.moveTo(cx, cy - 7);
    ctx.lineTo(cx, cy + 7);
    ctx.stroke();
    ctx.restore();
  }

  drawNearbyLabels(ctx) {
    const proj = this.projection;
    if (!proj) return;
    const occupied = [];
    const overlaps = (rect) => occupied.some((other) => !(rect.x + rect.w < other.x || rect.x > other.x + other.w || rect.y + rect.h < other.y || rect.y > other.y + other.h));
    ctx.save();
    ctx.font = '500 10px Inter, sans-serif';
    ctx.textBaseline = 'middle';
    for (const city of this.nearby) {
      const [x, y] = proj.toXY(city.lon, city.lat);
      if (x < 12 || x > proj.width - 12 || y < 18 || y > proj.height - 18) continue;
      const center = this.city ? proj.toXY(this.city.lon, this.city.lat) : null;
      if (center && Math.hypot(x - center[0], y - center[1]) < 34) continue;
      const text = city.name.replace(' (Saale)', '').replace(' (Westerland)', '');
      const textWidth = ctx.measureText(text).width;
      const candidates = [
        { x: x + 8, y: y - 8, w: textWidth + 4, h: 15 },
        { x: x - textWidth - 12, y: y - 8, w: textWidth + 4, h: 15 },
        { x: x + 8, y: y + 3, w: textWidth + 4, h: 15 },
      ];
      const placement = candidates.find((candidate) => !overlaps(candidate) && candidate.x > 4 && candidate.x + candidate.w < proj.width - 4);
      if (!placement) continue;
      occupied.push(placement);
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(208, 243, 237, 0.8)';
      ctx.fill();
      ctx.fillStyle = 'rgba(6, 16, 21, 0.48)';
      drawRoundRect(ctx, placement.x - 3, placement.y, placement.w, placement.h, 5);
      ctx.fill();
      ctx.fillStyle = 'rgba(214, 239, 234, 0.8)';
      ctx.fillText(text, placement.x, placement.y + placement.h / 2 + 0.5);
    }
    ctx.restore();
  }

  drawScale(ctx) {
    const proj = this.projection;
    if (!proj) return;
    const km = proj.mapWidth > 650 ? 50 : 25;
    const px = (km / 111.32) * proj.scale;
    const x = 18;
    const y = this.size.height - 20;
    ctx.save();
    ctx.strokeStyle = 'rgba(214, 243, 236, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + px, y);
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x, y + 4);
    ctx.moveTo(x + px, y - 4);
    ctx.lineTo(x + px, y + 4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(214, 243, 236, 0.5)';
    ctx.font = '500 9px Inter, sans-serif';
    ctx.fillText(`${km} km`, x + px + 7, y + 3);
    ctx.restore();
  }

  draw() {
    if (!this.ctx || !this.baseCanvas || !this.frames.length) return;
    const { width, height, dpr } = this.size;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.drawImage(this.baseCanvas, 0, 0, width * dpr, height * dpr, 0, 0, width, height);
    this.drawFrameImage(this.frames[this.index]);
    this.drawNearbyLabels(this.ctx);
    this.drawRadarRings(this.ctx);
    this.drawScale(this.ctx);
  }

  positionMarker() {
    if (!this.marker || !this.projection || !this.city) return;
    const [x, y] = this.projection.toXY(this.city.lon, this.city.lat);
    this.marker.style.left = `${x}px`;
    this.marker.style.top = `${y}px`;
  }

  setFrame(index) {
    if (!this.frames.length) return;
    this.index = Math.max(0, Math.min(this.frames.length - 1, index));
    this.draw();
    this.onFrame(this.frames[this.index], this.index);
  }

  play() {
    if (!this.frames.length) return;
    if (this.playing) return;
    if (this.index >= this.frames.length - 1) this.setFrame(0);
    this.playing = true;
    this.timer = window.setInterval(() => {
      const next = this.index + 1 >= this.frames.length ? 0 : this.index + 1;
      this.setFrame(next);
    }, 620);
  }

  pause() {
    this.playing = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  toggle() {
    if (this.playing) {
      this.pause();
      return false;
    }
    this.play();
    return true;
  }

  frameAt(index) {
    return this.frames[index] || null;
  }

  get liveIndex() {
    return this.findLiveIndex();
  }

  centerValue(frame) {
    if (!frame || !this.data) return 0;
    const pos = this.data.latlon_position;
    const width = frame.width;
    const height = frame.height;
    let cx = Math.floor(width / 2);
    let cy = Math.floor(height / 2);
    if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
      cx = Math.max(0, Math.min(width - 1, Math.floor(pos.x / this.data.step)));
      cy = Math.max(0, Math.min(height - 1, Math.floor(pos.y / this.data.step)));
    }
    let max = 0;
    for (let y = cy - 1; y <= cy + 1; y += 1) {
      for (let x = cx - 1; x <= cx + 1; x += 1) {
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        max = Math.max(max, frame.bytes[y * width + x] || 0);
      }
    }
    return max;
  }

  summarize() {
    if (!this.frames.length) {
      return { tone: 'dry', headline: 'Keine Radardaten', text: 'Das DWD-Radar ist derzeit nicht erreichbar.', current: 0, future: [] };
    }
    const now = Date.now();
    const points = this.frames.map((frame) => ({
      date: frame.date,
      value: this.centerValue(frame),
      raw: frame,
    }));
    // 1.3 raw units ≈ 0.16 mm/h; below that intensityLabel() calls it "trocken".
    const threshold = 1.3;
    const currentPoint = [...points].reverse().find((point) => point.date && point.date.getTime() <= now) || points[0];
    const future = points.filter((point) => point.date && point.date.getTime() > now);
    const nextRain = future.find((point) => point.value >= threshold);
    const currentlyRaining = currentPoint && currentPoint.value >= threshold;
    const futureRain = future.filter((point) => point.value >= threshold);
    let tone = 'dry';
    let headline = 'Trocken in Sicht';
    let text = 'Die Radardaten zeigen für die nächsten 90 Minuten keinen Regen über deinem Ort.';

    if (currentlyRaining) {
      const nextDry = future.find((point) => point.value < threshold);
      tone = 'rain';
      headline = intensityLabel(currentPoint.value);
      if (nextDry) {
        headline = intensityLabel(currentPoint.value);
        text = `Aktuell ${intensityLabel(currentPoint.value)}. Die Radardaten deuten auf ein Nachlassen gegen ${formatTime(nextDry.date)} Uhr hin.`;
      } else if (futureRain.length) {
        text = `Aktuell ${intensityLabel(currentPoint.value)}. Auch in den nächsten 90 Minuten bleibt Regen in der Nähe.`;
      } else {
        text = `Aktuell ${intensityLabel(currentPoint.value)}. In der zweiten Hälfte des Radarfensters wird es voraussichtlich weniger.`;
      }
    } else if (nextRain) {
      tone = 'incoming';
      headline = 'Regen im Anmarsch';
      text = `Die ersten Radarpixel erreichen deinen Ort gegen ${formatTime(nextRain.date)} Uhr. ${intensityLabel(Math.max(...futureRain.map((point) => point.value)))} ist möglich.`;
    } else if (points.some((point) => point.value >= threshold)) {
      tone = 'clearing';
      headline = 'Regen zieht ab';
      text = 'Der Regen verlagert sich. Für die nächsten 90 Minuten ist kaum neuer Niederschlag über deinem Ort zu erwarten.';
    }

    const strongest = points.reduce((max, point) => Math.max(max, point.value), 0);
    return {
      tone,
      headline,
      text,
      current: currentPoint?.value || 0,
      max: strongest,
      intensity: intensityLabel(strongest),
      points: points.map((point) => ({ time: point.date, value: point.value, forecast: point.date ? point.date.getTime() > now : false })),
      rainStart: nextRain?.date || null,
    };
  }

  destroy() {
    this.pause();
    if (this.resizeObserver) this.resizeObserver.disconnect();
    this.resizeObserver = null;
  }
}

export function radarLegend() {
  return [
    { label: 'leicht', range: '< 2 mm/h', color: 'rgba(95, 193, 255, .75)' },
    { label: 'mäßig', range: '2–6 mm/h', color: 'rgba(70, 220, 206, .8)' },
    { label: 'kräftig', range: '6–10 mm/h', color: 'rgba(249, 226, 100, .9)' },
    { label: 'stark', range: '10–25 mm/h', color: 'rgba(255, 168, 76, .95)' },
    { label: 'extrem', range: '> 25 mm/h', color: 'rgba(232, 84, 201, 1)' },
  ];
}
