import { icon, weatherIcon, weatherArt, moonPhaseIcon, windCompass } from './icons.js';
import {
  CITIES,
  CITY_BY_ID,
  DEFAULT_FAVORITES,
  MAP_CITY_IDS,
  normalizeSearch,
  registerCity,
  searchCities,
} from './cities.js';
import {
  DEFAULT_SETTINGS,
  TIME_ZONE,
  buildModel,
  cardinalDirection,
  cardinalLong,
  beaufort,
  escapeHTML,
  formatDateLong,
  formatDateShort,
  formatDuration,
  formatPrecip,
  formatRelative,
  formatTemp,
  formatTime,
  formatTitleDate,
  formatWeekday,
  formatWind,
  iconForCondition,
  iconLabel,
  precipitationLabel,
  setWeatherLocale,
  solarTimes,
  sunProgress,
  tempValue,
  visibilityValue,
  windLabel,
  windValue,
} from './weather.js';
import { renderTrendChart, renderDayChart } from './charts.js';
import { fetchWeather, fetchSummaries, fetchRadar, searchPlaces, setHardwareAcceleration, setVsync } from './api.js';
import { setSession } from './session.js';
import { setLanguage, startTranslationObserver, translateDocument, t } from './i18n.js';
import { countryName, countryOptions } from './countries.js';
import { RadarRenderer, radarLegend } from './radar.js';
import { GERMANY_GEO } from './germany-geo.js';

const SETTINGS_KEY = 'brise.settings.v1';
const FAVORITES_KEY = 'brise.favorites.v1';
const CITY_KEY = 'brise.city.v1';
const ONBOARDING_KEY = 'brise.onboarding.v1';

const VIEW_IDS = new Set(['weather', 'radar', 'germany']);

const THEME_OPTIONS = [
  ['night', 'Mitternacht'],
  ['day', 'Tageslicht'],
  ['dusk', 'Abendrot'],
  ['ocean', 'Ozean'],
  ['forest', 'Nordwald'],
  ['system', 'System folgen'],
];
const THEME_IDS = new Set(THEME_OPTIONS.map(([id]) => id));

const ACCENT_OPTIONS = [
  ['mint', 'Minze'],
  ['sky', 'Himmelblau'],
  ['violet', 'Violett'],
  ['amber', 'Bernstein'],
  ['coral', 'Koralle'],
  ['slate', 'Schiefer'],
];
const ACCENT_IDS = new Set(ACCENT_OPTIONS.map(([id]) => id));

const SEARCH_COMMANDS = [
  { id: 'radar', title: 'Regenradar öffnen', subtitle: 'Niederschlag und 90-Minuten-Prognose', icon: 'radar' },
  { id: 'germany', title: 'Deutschlandkarte', subtitle: 'Wetter aller Regionen im direkten Vergleich', icon: 'mapPinned' },
  { id: 'refresh', title: 'Wetterdaten aktualisieren', subtitle: 'Neue DWD-Beobachtungen laden', icon: 'refresh' },
  { id: 'settings', title: 'Einstellungen', subtitle: 'Darstellung, Einheiten und Aktualisierung', icon: 'sliders' },
  { id: 'shortcuts', title: 'Tastenkürzel', subtitle: 'Alle Abkürzungen für Brise', icon: 'keyboard' },
  { id: 'about', title: 'Über Brise', subtitle: 'Datenquellen und Hintergründe', icon: 'info' },
];

const state = {
  settings: loadSettings(),
  favorites: loadFavorites(),
  selectedCityId: loadSelectedCity(),
  summaries: new Map(),
  weather: new Map(),
  weatherSeq: new Map(),
  weatherLoading: new Set(),
  offline: new Set(),
  favoriteSummariesLoading: false,
  germanyLoading: false,
  germanyLoadedAt: 0,
  germanyError: null,
  germanyMetric: 'temp',
  radarLoading: false,
  radarData: null,
  radarStatus: 'idle',
  radarError: null,
  radarRenderer: null,
  radarSeq: 0,
  view: 'weather',
  model: null,
  trendRange: '48h',
  searchItems: [],
  searchIndex: 0,
  remotePlaces: [],
  remoteLoading: false,
  remoteError: null,
  remoteTimer: null,
  searchGeneration: 0,
  refreshTimer: null,
  overlayOpen: false,
  overlayLocked: false,
  onboardingOpen: false,
  onboarding: {
    step: 1,
    items: [],
    places: [],
    index: 0,
    loading: false,
    error: null,
    timer: null,
    generation: 0,
  },
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function loadJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    if (value === null) return fallback;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local storage may be disabled; the app still works for this session.
  }
}

function loadSettings() {
  const stored = loadJSON(SETTINGS_KEY, {});
  const settings = { ...DEFAULT_SETTINGS, ...(stored && typeof stored === 'object' ? stored : {}) };
  if (!THEME_IDS.has(settings.theme)) settings.theme = DEFAULT_SETTINGS.theme;
  if (!ACCENT_IDS.has(settings.accent)) settings.accent = DEFAULT_SETTINGS.accent;
  if (!['c', 'f'].includes(settings.tempUnit)) settings.tempUnit = 'c';
  if (!['kmh', 'ms', 'mph'].includes(settings.windUnit)) settings.windUnit = 'kmh';
  if (!['mm', 'in'].includes(settings.precipUnit)) settings.precipUnit = 'mm';
  if (!Number.isFinite(Number(settings.refreshMinutes)) || Number(settings.refreshMinutes) < 0) {
    settings.refreshMinutes = DEFAULT_SETTINGS.refreshMinutes;
  }
  settings.refreshMinutes = Number(settings.refreshMinutes);
  settings.animations = settings.animations !== false;
  settings.hardwareAcceleration = settings.hardwareAcceleration !== false;
  settings.vsync = settings.vsync !== false;
  if (!['de', 'en', 'nl'].includes(settings.language)) settings.language = 'de';
  settings.country = String(settings.country || 'DE').toUpperCase();
  if (!/^(ALL|[A-Z]{2})$/.test(settings.country)) settings.country = 'DE';
  if (!['dwd', 'open-meteo'].includes(settings.provider)) settings.provider = 'dwd';
  if (settings.country !== 'DE') settings.provider = 'open-meteo';
  return settings;
}

function loadFavorites() {
  const stored = loadJSON(FAVORITES_KEY, null);
  if (!Array.isArray(stored)) return DEFAULT_FAVORITES.filter((id) => CITY_BY_ID[id]);
  return [...new Set(stored.filter((id) => typeof id === 'string' && CITY_BY_ID[id]))];
}

function loadSelectedCity() {
  const stored = loadJSON(CITY_KEY, null);
  if (typeof stored === 'string' && CITY_BY_ID[stored]) return stored;
  const favorites = loadFavorites();
  return favorites[0] || 'berlin';
}

function persistSettings() {
  saveJSON(SETTINGS_KEY, state.settings);
}

async function applyGraphicsSettings() {
  try { await setHardwareAcceleration(state.settings.hardwareAcceleration !== false); } catch (_) { /* nur in der Desktop-App */ }
  try { await setVsync(state.settings.vsync !== false); } catch (_) { /* nur in der Desktop-App */ }
}

function applyLocaleAndRegion() {
  const settings = state.settings;
  setSession({ country: settings.country, language: settings.language, provider: settings.provider });
  setLanguage(settings.language);
  setWeatherLocale(settings.language);
  const germanyNav = document.querySelector('[data-view-target="germany"]');
  if (germanyNav) germanyNav.hidden = settings.country !== 'DE';
  const providerLabel = settings.country === 'DE' && settings.provider === 'dwd' ? 'DWD' : 'Open-Meteo';
  for (const id of ['brandProvider', 'sourceProvider']) {
    const element = document.getElementById(id);
    if (element) element.textContent = providerLabel;
  }
  if (settings.country !== 'DE' && state.view === 'germany') switchView('weather');
}

function persistFavorites() {
  saveJSON(FAVORITES_KEY, state.favorites);
}

function persistSelectedCity() {
  saveJSON(CITY_KEY, state.selectedCityId);
}

function currentCity() {
  return CITY_BY_ID[state.selectedCityId] || CITY_BY_ID.berlin;
}

function isFavorite(cityId) {
  return state.favorites.includes(cityId);
}

function summaryFor(cityId) {
  return state.summaries.get(cityId) || null;
}

function summaryWeather(cityId) {
  return summaryFor(cityId)?.weather || null;
}

function preferredTheme() {
  if (state.settings.theme === 'system') {
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'day' : 'night';
  }
  return state.settings.theme;
}

function applyTheme() {
  const theme = preferredTheme();
  const metaColors = {
    day: '#edf5f3',
    dusk: '#160f18',
    ocean: '#06131f',
    forest: '#081712',
    night: '#081018',
  };
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.accent = state.settings.accent;
  document.documentElement.dataset.motion = state.settings.animations ? 'on' : 'off';
  document.documentElement.style.colorScheme = theme === 'day' ? 'light' : 'dark';
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', metaColors[theme] || metaColors.night);
}

function updateClock() {
  const now = new Date();
  const localeTags = { de: 'de-DE', en: 'en-GB', nl: 'nl-NL' };
  const time = new Intl.DateTimeFormat(localeTags[state.settings.language] || 'de-DE', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);
  const titleTime = $('#titleTime');
  const titleDate = $('#titleDate');
  if (titleTime && titleTime.textContent !== time) {
    titleTime.textContent = time;
    titleTime.classList.remove('is-ticking');
    void titleTime.offsetWidth;
    titleTime.classList.add('is-ticking');
  }
  if (titleDate) titleDate.textContent = formatTitleDate(now);
}

function setLiveState(mode, label) {
  const pill = $('#livePill');
  const text = $('#liveLabel');
  if (pill) pill.dataset.state = mode;
  if (text) text.textContent = label;
}

function showToast(message, options = {}) {
  const host = $('#toastHost');
  if (!host) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.dataset.tone = options.tone || 'info';
  toast.innerHTML = `${icon(options.icon || (options.tone === 'alert' ? 'warning' : 'info'), 15)}<span>${escapeHTML(message)}</span>`;
  host.append(toast);
  window.setTimeout(() => {
    toast.classList.add('is-leaving');
    window.setTimeout(() => toast.remove(), 220);
  }, options.duration || 3600);
}

let overlayReturnFocus = null;

function closeOverlay() {
  const root = $('#overlayRoot');
  if (!root) return;
  const hadOverlay = Boolean(root.firstElementChild);
  root.innerHTML = '';
  state.overlayOpen = false;
  state.overlayLocked = false;
  state.onboardingOpen = false;
  state.searchGeneration += 1;
  if (state.remoteTimer) {
    clearTimeout(state.remoteTimer);
    state.remoteTimer = null;
  }
  if (hadOverlay && overlayReturnFocus?.isConnected) {
    try { overlayReturnFocus.focus({ preventScroll: true }); } catch { /* noop */ }
  }
  overlayReturnFocus = null;
}

function showOverlay(markup, options = {}) {
  const root = $('#overlayRoot');
  if (!root) return null;
  if (!state.overlayOpen) overlayReturnFocus = document.activeElement;
  root.innerHTML = `<div class="overlay" data-overlay>${markup}</div>`;
  state.overlayOpen = true;
  state.overlayLocked = Boolean(options.locked);
  const overlay = $('[data-overlay]', root);
  overlay.addEventListener('click', (event) => {
    if (state.overlayLocked) return;
    if (event.target === overlay || event.target.closest('[data-close]')) {
      closeOverlay();
    }
  });
  const focusSelector = options.focusSelector || 'input, select, button';
  requestAnimationFrame(() => {
    const focusTarget = overlay.querySelector(focusSelector);
    if (focusTarget) {
      try { focusTarget.focus({ preventScroll: true }); } catch { /* noop */ }
    }
  });
  if (options.onMount) options.onMount(overlay);
  return overlay;
}

function usefulError(error) {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  return 'Unbekannter Fehler bei der Datenabfrage.';
}

function formatAlertPeriod(alert) {
  const parts = [];
  if (alert.onset) parts.push(`ab ${formatWeekday(alert.onset, true)} ${formatTime(alert.onset)} Uhr`);
  if (alert.expires) parts.push(`bis ${formatWeekday(alert.expires, true)} ${formatTime(alert.expires)} Uhr`);
  return parts.length ? parts.join(' · ') : 'Zeitpunkt unbekannt';
}

function formatAlertExpiry(alert) {
  return alert.expires ? `bis ${formatWeekday(alert.expires, true)} ${formatTime(alert.expires)}` : 'aktuell aktiv';
}

function cityNight(city) {
  const sun = solarTimes(new Date(), city.lat, city.lon);
  if (!sun.sunrise || !sun.sunset) return false;
  const now = new Date();
  return now < sun.sunrise || now >= sun.sunset;
}

function summaryIconName(city, weather) {
  if (!weather) return 'cloudy';
  if (weather.icon) return String(weather.icon);
  return iconForCondition(weather.condition || 'dry', weather.cloud_cover, cityNight(city));
}

function summaryLabel(city, weather) {
  if (!weather) return 'Keine Daten';
  return iconLabel(summaryIconName(city, weather), weather.condition || '');
}

function formatUpdated(value) {
  return formatRelative(value instanceof Date ? value : new Date(value));
}

function formatDateWithWeekday(value) {
  return `${formatWeekday(value)}, ${formatDateShort(value)}`;
}

function alertSeverityClass(severity) {
  if (severity === 'extreme' || severity === 'severe') return 'pill-alert';
  if (severity === 'moderate') return 'pill-warm';
  return 'pill-muted';
}

function summaryFromBundle(city, bundle) {
  return {
    city_id: city.id,
    name: city.name,
    state: city.state,
    fetched_at: bundle.fetched_at || Math.floor(Date.now() / 1000),
    stale: Boolean(bundle.stale),
    weather: bundle.current || {},
    sources: bundle.current_sources || [],
    alerts_available: bundle.alerts_available !== false,
  };
}

function applySummaries(results) {
  for (const result of results || []) {
    if (!result?.city_id || !CITY_BY_ID[result.city_id]) continue;
    const usableWeather = finite(result.weather?.temperature) && Object.keys(result.weather).length > 1;
    if (usableWeather) {
      const existing = state.summaries.get(result.city_id);
      if (!existing || (result.fetched_at || 0) >= (existing.fetched_at || 0)) {
        state.summaries.set(result.city_id, result);
      }
    } else if (!state.summaries.has(result.city_id)) {
      state.summaries.set(result.city_id, result);
    }
  }
}

function cacheBundleSummary(city, bundle) {
  if (!bundle?.current || !Object.keys(bundle.current).length) return;
  const summary = summaryFromBundle(city, bundle);
  const existing = state.summaries.get(city.id);
  if (!existing || (summary.fetched_at || 0) >= (existing.fetched_at || 0)) {
    state.summaries.set(city.id, summary);
  }
}

function metricBarWidth(value, max = 100) {
  return `${clamp((value / max) * 100, 0, 100).toFixed(1)}%`;
}

function formatPressure(value) {
  return finite(value) ? `${Math.round(value)}` : '–';
}

function formatVisibilityLine(meters) {
  return visibilityValue(meters) || '–';
}

function splitNumericUnit(value, unit) {
  if (value === '–' || value === null || value === undefined) return { value: '–', unit: '' };
  return { value, unit };
}

function instantHourLabel(value) {
  const date = value instanceof Date ? value : new Date(value);
  return `${formatWeekday(date, true)}, ${formatDateShort(date)} · ${formatTime(date)}`;
}

function setPageLive(stale) {
  if (stale) setLiveState('stale', 'Offline-Daten');
  else setLiveState('live', 'Daten aktuell');
}

let weatherAnimationTimer = 0;

// Beim Ortswechsel und bei Hintergrund-Updates sollen die Eingangsanimationen
// nicht erneut laufen – sonst flackert die Ansicht sichtbar.
function suppressWeatherAnimations() {
  document.documentElement.dataset.weatherSwitch = 'on';
  window.clearTimeout(weatherAnimationTimer);
  weatherAnimationTimer = window.setTimeout(() => {
    delete document.documentElement.dataset.weatherSwitch;
  }, 700);
}


async function loadWeather(cityId, options = {}) {
  const city = CITY_BY_ID[cityId];
  if (!city) return false;
  const force = Boolean(options.force);
  const quiet = Boolean(options.quiet);
  const hadExisting = state.weather.has(cityId);
  const seq = (state.weatherSeq.get(cityId) || 0) + 1;
  state.weatherSeq.set(cityId, seq);
  state.weatherLoading.add(cityId);

  if (state.selectedCityId === cityId && state.view === 'weather') {
    const existing = state.weather.get(cityId);
    if (!existing) {
      renderWeatherLoading(city);
      setLiveState('loading', 'Wetter lädt');
    } else {
      $('#refreshWeather')?.classList.add('is-loading');
      const indicator = $('#weatherUpdated');
      if (indicator && !quiet) indicator.textContent = 'Wird aktualisiert …';
      if (!quiet) setLiveState('loading', 'Wetter lädt');
    }
  }

  try {
    const bundle = await fetchWeather(city, force);
    if (state.weatherSeq.get(cityId) !== seq) return false;
    state.offline.delete(cityId);
    state.weather.set(cityId, { bundle, at: Date.now() });
    cacheBundleSummary(city, bundle);
    if (state.view === 'weather' && state.selectedCityId === cityId) {
      if (hadExisting) suppressWeatherAnimations();
      renderWeather();
      setPageLive(Boolean(bundle.stale));
    } else if (state.view === 'germany' && MAP_CITY_IDS.includes(cityId)) {
      renderGermanyView();
    }
    renderFavorites();
    return true;
  } catch (error) {
    if (state.weatherSeq.get(cityId) !== seq) return false;
    if (state.selectedCityId === cityId && state.view === 'weather') {
      const existing = state.weather.get(cityId);
      if (existing) {
        state.offline.add(cityId);
        suppressWeatherAnimations();
        renderWeather();
        setLiveState('stale', 'Offline-Daten');
        showToast('Keine Verbindung zum DWD. Brise zeigt die zuletzt geladenen Daten.', { tone: 'warn', icon: 'cloud' });
      } else {
        renderWeatherError(city, error);
        setLiveState('error', 'Wetter nicht erreichbar');
        const indicator = $('#weatherUpdated');
        if (indicator) {
          indicator.dataset.stale = 'false';
          indicator.classList.remove('is-loading');
          indicator.innerHTML = '<i class="live-dot"></i>Nicht erreichbar';
        }
      }
    }
    if (!quiet) console.warn('Brise: Wetter konnte nicht geladen werden', error);
    return false;
  } finally {
    if (state.weatherSeq.get(cityId) === seq) {
      state.weatherLoading.delete(cityId);
      $('#refreshWeather')?.classList.remove('is-loading');
      if (state.view === 'weather' && state.selectedCityId === cityId && state.weather.has(cityId)) {
        const indicator = $('#weatherUpdated');
        if (indicator) {
          const entry = state.weather.get(cityId);
          indicator.textContent = state.offline.has(cityId) || entry?.bundle?.stale
            ? 'Offline-Daten'
            : `Aktualisiert ${formatRelative(new Date(entry?.bundle?.fetched_at ? entry.bundle.fetched_at * 1000 : entry?.at || Date.now()))}`;
        }
      }
    }
  }
}

async function loadFavoriteSummaries(force = false) {
  const cities = state.favorites.map((id) => CITY_BY_ID[id]).filter(Boolean);
  if (!cities.length) {
    renderFavorites();
    return;
  }
  if (state.favoriteSummariesLoading) return;
  state.favoriteSummariesLoading = true;
  try {
    const results = await fetchSummaries(cities, force);
    applySummaries(results);
  } catch (error) {
    console.warn('Brise: Favoriten konnten nicht aktualisiert werden', error);
    for (const city of cities) {
      if (!state.summaries.has(city.id)) {
        state.summaries.set(city.id, { city_id: city.id, error: usefulError(error) });
      }
    }
    if (force) showToast('Die Ortsübersicht konnte nicht aktualisiert werden.', { tone: 'warn', icon: 'cloud' });
  } finally {
    state.favoriteSummariesLoading = false;
    renderFavorites();
  }
}

function renderFavorites() {
  const list = $('#favoritesList');
  const count = $('#favoriteCount');
  if (count) count.textContent = String(state.favorites.length);
  if (!list) return;
  const ids = state.favorites.filter((id) => CITY_BY_ID[id]);
  if (!ids.length) {
    if (!list.querySelector('.favorite-empty')) {
      list.textContent = '';
      const empty = document.createElement('div');
      empty.className = 'favorite-empty';
      empty.textContent = 'Noch keine Orte gespeichert. Suche nach einer deutschen Stadt und tippe auf den Stern.';
      list.append(empty);
    }
    return;
  }
  list.querySelector('.favorite-empty')?.remove();

  // Zeilen bleiben erhalten und werden nur bei geänderten Daten aktualisiert.
  // So startet die Eingangsanimation nicht bei jedem Wetter-Update erneut.
  const rows = new Map(
    [...list.querySelectorAll('[data-favorite-city]')].map((row) => [row.dataset.favoriteCity, row]),
  );
  for (const [id, row] of rows) {
    if (!ids.includes(id)) row.remove();
  }

  ids.forEach((id, index) => {
    const city = CITY_BY_ID[id];
    const weather = summaryWeather(id);
    const rawTemp = finite(weather?.temperature) ? formatTemp(weather.temperature, state.settings.tempUnit) : '–';
    const weatherIconMarkup = weather
      ? weatherIcon(summaryIconName(city, weather))
      : icon('pin', 16);
    const stateText = weather
      ? summaryLabel(city, weather)
      : (summaryFor(id)?.error ? 'Nicht erreichbar' : 'Wird geladen …');
    const signature = `${city.name}|${stateText}|${rawTemp}|${weather ? 'w' : '-'}`;

    let row = rows.get(id);
    if (!row) {
      row = document.createElement('div');
      row.className = 'favorite-row';
      row.dataset.favoriteCity = id;
      row.setAttribute('role', 'button');
      row.tabIndex = 0;
      list.insertBefore(row, list.children[index] ?? null);
    }
    if (row.dataset.signature !== signature) {
      row.innerHTML = `<span class="favorite-row-main">
        <span class="favorite-icon">${weatherIconMarkup}</span>
        <span class="favorite-copy">
          <span class="favorite-name">${escapeHTML(city.name)}</span>
          <span class="favorite-state">${escapeHTML(stateText)}</span>
        </span>
      </span>
      <span class="favorite-temp">${escapeHTML(rawTemp)}</span>
      <button class="favorite-remove" type="button" data-remove-favorite="${id}" title="${escapeHTML(city.name)} entfernen" aria-label="${escapeHTML(city.name)} aus Favoriten entfernen">${icon('x', 11)}</button>`;
      row.dataset.signature = signature;
      row.setAttribute('aria-label', `${city.name}, ${rawTemp}`);
    }
    row.classList.toggle('is-active', id === state.selectedCityId);
    row.setAttribute('aria-current', id === state.selectedCityId ? 'true' : 'false');
  });
}

function weatherToolbarMarkup(city) {
  return `<div class="weather-toolbar">
    <div class="weather-context">
      ${icon('pin', 12)}
      <span>${escapeHTML(countryName(city.country || state.settings.country, state.settings.language))}</span>
      <span class="context-sep">/</span>
      <strong>${escapeHTML(city.name)}</strong>
      <span class="context-state">${escapeHTML(city.state)}</span>
    </div>
    <div class="weather-toolbar-side">
      <span class="update-indicator" id="weatherUpdated" data-stale="false"><i class="live-dot"></i>Daten werden geladen</span>
      <button class="icon-button refresh-button" id="refreshWeather" type="button" data-refresh-weather aria-label="Wetter aktualisieren" title="Wetter aktualisieren">${icon('refresh', 14)}</button>
    </div>
  </div>`;
}

function renderWeatherLoading(city) {
  const container = $('#weatherContent');
  if (!container) return;
  container.innerHTML = `${weatherToolbarMarkup(city)}
    <div class="view-loading">
      <span class="loader-orbit"></span>
      <span>Der Himmel über ${escapeHTML(city.name)} wird geladen …</span>
    </div>`;
}

function renderWeatherError(city, error) {
  const container = $('#weatherContent');
  if (!container) return;
  container.innerHTML = `${weatherToolbarMarkup(city)}
    <div class="error-card">
      <span class="error-card-icon">${icon('cloud', 18)}</span>
      <div class="error-card-copy">
        <div class="error-card-title">Gerade kommt nichts vom DWD</div>
        <div class="error-card-text">Für ${escapeHTML(city.name)} sind die Wetterdaten gerade nicht da. Prüfe kurz deine Verbindung – dann versuchen wir es noch mal.<br><code>${escapeHTML(usefulError(error))}</code></div>
        <div class="error-actions"><button class="action-button" type="button" data-retry-weather>${icon('refresh', 13)} Noch mal probieren</button></div>
      </div>
    </div>`;
}

function metricTile(iconName, label, value, unit, sub, barPercent = null, tone = '') {
  return `<div class="metric-tile">
    <span class="metric-head">${icon(iconName, 11)} ${escapeHTML(label)}</span>
    <span class="metric-value">${escapeHTML(String(value))}${unit ? `<small>${escapeHTML(unit)}</small>` : ''}</span>
    ${barPercent === null ? '' : `<span class="metric-bar ${tone}"><i style="width:${barPercent}"></i></span>`}
    ${sub ? `<span class="metric-sub">${escapeHTML(sub)}</span>` : ''}
  </div>`;
}

function renderWeather() {
  const container = $('#weatherContent');
  if (!container) return;
  const previousChart = $('#trendChart', container);
  if (previousChart?._trendResizeObserver) {
    previousChart._trendResizeObserver.disconnect();
    previousChart._trendResizeObserver = null;
  }
  if (previousChart?._trendFrame) cancelAnimationFrame(previousChart._trendFrame);
  const city = currentCity();
  const entry = state.weather.get(city.id);
  if (!entry) {
    renderWeatherLoading(city);
    return;
  }
  const model = buildModel(entry.bundle, city, state.settings);
  if (state.offline.has(city.id)) model.stale = true;
  state.model = model;

  const current = model.current;
  const sun = model.sun;
  const moon = model.moon;
  const alerts = model.alerts;
  const today = model.today;
  const favorite = isFavorite(city.id);
  const temp = formatTemp(current.tempC, state.settings.tempUnit);
  const feels = formatTemp(current.apparentC, state.settings.tempUnit);
  const high = formatTemp(today?.high, state.settings.tempUnit);
  const low = formatTemp(today?.low, state.settings.tempUnit);
  const stale = model.stale;
  const updatedLabel = stale ? 'Offline-Daten' : `Aktualisiert ${formatUpdated(model.fetchedAt)}`;
  const stationName = model.station?.station_name || model.station?.id || 'DWD-Messstation';
  const observed = `${formatTime(model.observedAt)} Uhr`;
  const daylightProgress = Math.round(sunProgress(new Date(), sun.sunrise, sun.sunset) * 100);
  const isNight = daylightProgress <= 0 || daylightProgress >= 100;
  const nightSpanMs = Math.max(0, 86400000 - (sun.dayMinutes || 0) * 60000);
  let moonProgress = 0;
  if (sun.sunrise && sun.sunset && nightSpanMs > 0) {
    const now = new Date();
    if (now >= sun.sunset) moonProgress = (now - sun.sunset) / nightSpanMs;
    else if (now < sun.sunrise) moonProgress = (nightSpanMs - (sun.sunrise - now)) / nightSpanMs;
    moonProgress = clamp(moonProgress, 0, 1);
  }
  const moonAngle = Math.PI - Math.PI * moonProgress;
  const moonX = 160 + 116 * Math.cos(moonAngle);
  const moonY = 124 - 116 * Math.sin(moonAngle);
  document.documentElement.dataset.night = isNight ? 'on' : 'off';
  const sunrise = sun.sunrise ? formatTime(sun.sunrise) : '–';
  const sunset = sun.sunset ? formatTime(sun.sunset) : '–';
  const dayLength = sun.dayMinutes > 0 ? formatDuration(sun.dayMinutes) : '–';
  const rainStart = model.rainOutlook.startsAt ? formatTime(model.rainOutlook.startsAt) : null;
  const currentHumidity = finite(current.humidity) ? Math.round(current.humidity) : null;
  const visibility = formatVisibilityLine(current.visibility);
  const pressure = model.pressure;
  const sunshineMinutes = today?.sunshineMinutes;
  const cloudCover = finite(current.cloudCover) ? Math.round(current.cloudCover) : null;
  const dewPoint = formatTemp(current.dewPoint, state.settings.tempUnit);
  const windText = formatWind(current.windSpeed, state.settings.windUnit, 0);
  const gustText = finite(current.gustSpeed) ? formatWind(current.gustSpeed, state.settings.windUnit, 0) : '–';
  const windDir = finite(current.windDirection) ? `${cardinalDirection(current.windDirection)} · ${cardinalLong(current.windDirection)}` : 'Richtung unbekannt';
  const bft = beaufort(current.windSpeed);
  const weatherFamily = current.family || 'cloudy';

  const alertBanner = alerts.length
    ? `<button class="alert-banner" type="button" data-open-alerts>
        <span class="alert-banner-icon">${icon('warning', 15)}</span>
        <span class="alert-banner-copy">
          <strong>${alerts.length === 1 ? 'Amtliche Wetterwarnung' : `${alerts.length} amtliche Wetterwarnungen`}</strong>
          <span>${escapeHTML(alerts[0].event)}: ${escapeHTML(alerts[0].headline)}</span>
        </span>
        <span class="alert-banner-meta">${icon('clock', 12)} ${escapeHTML(formatAlertExpiry(alerts[0]))} ${icon('chevronRight', 12)}</span>
      </button>`
    : '';

  const heroWarning = alerts.length
    ? `<button class="pill hero-warning-chip" type="button" data-open-alerts>${icon('warning', 11)} ${alerts.length} ${alerts.length === 1 ? 'Warnung' : 'Warnungen'}</button>`
    : '';

  const hero = `<article class="card hero-card" data-family="${weatherFamily}">
    <div class="hero-scene">${weatherArt(current.icon, model.nightNow)}</div>
    <div class="hero-content">
      <div class="hero-topline">
        <span class="pill hero-live">${icon('sparkles', 11)} ${stale ? 'Offline-Daten' : 'DWD aktuell'}</span>
        <span class="hero-dateline">${escapeHTML(formatDateLong(model.observedAt))}</span>
        ${heroWarning}
        <span class="spacer"></span>
        <button class="hero-favorite ${favorite ? 'is-favorite' : ''}" type="button" data-toggle-favorite="${city.id}" aria-label="${favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}" title="${favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}">${icon(favorite ? 'starFilled' : 'star', 14)}</button>
      </div>
      <div class="hero-place">
        ${icon('pin', 15)}
        <h2>${escapeHTML(city.name)}</h2>
        <span class="hero-state">${escapeHTML(city.state)}</span>
      </div>
      <div class="hero-reading">
        <div class="hero-temp">${escapeHTML(temp)}</div>
        <div class="hero-weather-copy">
          <div class="hero-condition">${weatherIcon(current.icon)} ${escapeHTML(current.label)}</div>
          <div class="hero-feels">Gefühlt <strong>${escapeHTML(feels)}</strong><span class="dot-separator"></span>Luftfeuchte ${currentHumidity === null ? '–' : `${currentHumidity} %`}</div>
          <div class="hero-highlow"><span><span class="arrow-up">↑</span> ${escapeHTML(high)}</span><span><span class="arrow-down">↓</span> ${escapeHTML(low)}</span><span class="dot-separator"></span><span>${escapeHTML(windText)}</span></div>
        </div>
      </div>
      <div class="hero-footer">
        <div class="hero-outlook">
          <span class="hero-outlook-icon">${icon(rainStart ? 'umbrella' : 'sun', 14)}</span>
          <span class="hero-outlook-copy">
            <span>${rainStart ? 'Regen im Blick' : 'Nächste Stunden'}</span>
            <p>${escapeHTML(rainStart ? `Ab ${rainStart} Uhr wird Regen wahrscheinlich.` : 'Voraussichtlich trocken — ruhiges Wetter in Sicht.')}</p>
          </span>
        </div>
        <div class="hero-observation">
          <strong>${escapeHTML(stationName)}</strong>
          ${escapeHTML(observed)} · ${escapeHTML(updatedLabel)}
        </div>
      </div>
    </div>
  </article>`;

  const windDirectionIcon = finite(current.windDirection) ? 'navigation' : 'compass';
  const humidityBar = currentHumidity === null ? null : metricBarWidth(currentHumidity);
  const cloudBar = cloudCover === null ? null : metricBarWidth(cloudCover);
  const sunshineBar = finite(today?.dayMinutes) && today.dayMinutes > 0 && finite(sunshineMinutes)
    ? metricBarWidth((sunshineMinutes / today.dayMinutes) * 100)
    : null;
  const nowCard = `<aside class="card now-card">
    <header class="card-head">
      <div class="card-heading">
        <p class="kicker">Gerade gemessen</p>
        <h3 class="card-title">Jetzt</h3>
      </div>
      <span class="now-live"><i></i>${formatTime(model.observedAt)} Uhr</span>
    </header>
    <div class="wind-block">
      ${windCompass(current.windDirection || 0)}
      <div class="wind-copy">
        <div class="wind-value"><strong>${escapeHTML(windText.split(' ')[0])}</strong><span>${escapeHTML(windText.split(' ').slice(1).join(' '))}</span></div>
        <div class="wind-direction">${icon(windDirectionIcon, 11)} ${escapeHTML(windDir)}</div>
        <div class="wind-gust">
          <span>Böen <b>${escapeHTML(gustText)}</b></span>
          ${bft === null ? '' : `<span>Beaufort <b>${bft}</b></span>`}
        </div>
      </div>
    </div>
    <div class="now-metrics">
      ${metricTile('droplets', 'Luftfeuchtigkeit', currentHumidity === null ? '–' : currentHumidity, '%', 'Wie feucht die Luft ist', humidityBar, 'sky')}
      ${metricTile('gauge', 'Luftdruck', formatPressure(pressure.value), 'hPa', `Tendenz ${pressure.label}`)}
      ${metricTile('eye', 'Sichtweite', visibility, '', 'Von der Messstation')}
      ${metricTile('thermometer', 'Taupunkt', dewPoint, '', 'Wann der Tau kommt')}
      ${metricTile('cloud', 'Wolken', cloudCover === null ? '–' : cloudCover, '%', 'Wie viel vom Himmel bedeckt ist', cloudBar, 'violet')}
      ${metricTile('sun', 'Sonnenschein', finite(sunshineMinutes) ? formatDuration(sunshineMinutes) : '–', '', finite(today?.dayMinutes) ? `Tageslicht: ${formatDuration(today.dayMinutes)}` : 'seit Sonnenaufgang', sunshineBar, 'warm')}
    </div>
  </aside>`;


  const weekValues = [];
  for (const day of model.daily) {
    if (finite(day.low)) weekValues.push(tempValue(day.low, state.settings.tempUnit));
    if (finite(day.high)) weekValues.push(tempValue(day.high, state.settings.tempUnit));
  }
  const weekMin = weekValues.length ? Math.min(...weekValues) : 0;
  const weekMax = weekValues.length ? Math.max(...weekValues) : 1;
  const weekSpan = Math.max(1, weekMax - weekMin);

  const forecastRows = model.daily
    .map((day) => {
      const lowValue = tempValue(day.low, state.settings.tempUnit);
      const highValue = tempValue(day.high, state.settings.tempUnit);
      const start = clamp(((lowValue - weekMin) / weekSpan) * 100, 0, 100);
      const end = clamp(((highValue - weekMin) / weekSpan) * 100, 0, 100);
      const width = Math.max(8, end - start);
      const rain = Number.isFinite(day.probMax) ? `${Math.round(day.probMax)} %` : (day.precipSum > 0 ? formatPrecip(day.precipSum, state.settings.precipUnit) : 'trocken');
      const rainClass = !Number.isFinite(day.probMax) || day.probMax < 20 ? 'is-dry' : '';
      return `<button class="forecast-row ${day.isToday ? 'is-today' : ''}" type="button" data-day-key="${day.key}" aria-label="${escapeHTML(day.labelDay)}: ${escapeHTML(formatTemp(day.low, state.settings.tempUnit))} bis ${escapeHTML(formatTemp(day.high, state.settings.tempUnit))}, ${escapeHTML(day.label)}">
        <span class="fc-day"><strong>${escapeHTML(day.labelDay)}</strong><span>${escapeHTML(formatDateShort(day.date))}</span></span>
        <span class="fc-icon">${weatherIcon(day.icon)}</span>
        <span class="fc-condition"><strong>${escapeHTML(day.label)}</strong><span class="fc-rain ${rainClass}">${icon('droplet', 8)} ${escapeHTML(rain)}</span></span>
        <span class="fc-bar"><span class="fc-bar-fill" style="left:${start.toFixed(1)}%;width:${width.toFixed(1)}%"></span></span>
        <span class="fc-low">${escapeHTML(formatTemp(day.low, state.settings.tempUnit))}</span>
        <span class="fc-high">${escapeHTML(formatTemp(day.high, state.settings.tempUnit))}</span>
      </button>`;
    })
    .join('');

  const sunAngle = Math.PI - Math.PI * clamp(daylightProgress / 100, 0, 1);
  const sunDotX = 160 + 116 * Math.cos(sunAngle);
  const sunDotY = 124 - 116 * Math.sin(sunAngle);
  const sunProgressPath = daylightProgress > 0
    ? `M 44 124 A 116 116 0 0 1 ${sunDotX.toFixed(2)} ${sunDotY.toFixed(2)}`
    : '';
  const nowMs = Date.now();
  const dayPhase = sun.sunrise && sun.sunset
    ? (nowMs < sun.sunrise.getTime() ? 'before' : nowMs >= sun.sunset.getTime() ? 'after' : 'day')
    : 'day';

  const trendCard = `<section class="card trend-card">
    <header class="card-head">
      <div class="card-heading">
        <p class="kicker">${icon('calendar', 11)} Vorhersage</p>
        <h3 class="card-title">Temperatur & Regen</h3>
      </div>
      <div class="segmented" role="group" aria-label="Zeitraum wählen">
        <button type="button" data-range="24h" class="${state.trendRange === '24h' ? 'is-active' : ''}">24 Std.</button>
        <button type="button" data-range="48h" class="${state.trendRange === '48h' ? 'is-active' : ''}">48 Std.</button>
        <button type="button" data-range="7d" class="${state.trendRange === '7d' ? 'is-active' : ''}">7 Tage</button>
      </div>
    </header>
    <div class="trend-chart-container" id="trendChart"></div>
    <div class="hourly-rail">
      <div class="hourly-rail-head">
        <span class="hourly-rail-title">Stündlich</span>
        <span class="hourly-rail-hint">Regenwahrscheinlichkeit in %</span>
      </div>
      <div class="hourly-scroll">
        ${model.hourlyRail.map((hour, index) => {
          const prob = Number.isFinite(hour.prob) ? `${Math.round(hour.prob)}%` : (hour.precip > 0 ? formatPrecip(hour.precip, state.settings.precipUnit) : '–');
          const dry = !Number.isFinite(hour.prob) || hour.prob < 20;
          return `<div class="hour-item ${index === 0 ? 'is-now' : ''}" title="${escapeHTML(instantHourLabel(hour.timestamp))} · ${escapeHTML(hour.label)}">
            <span class="hour-time">${index === 0 ? 'Jetzt' : formatTime(hour.timestamp)}</span>
            <span class="hour-icon">${weatherIcon(hour.icon)}</span>
            <span class="hour-temp">${escapeHTML(formatTemp(hour.tempC, state.settings.tempUnit))}</span>
            <span class="hour-rain ${dry ? 'is-dry' : ''}">${icon('droplet', 8)} ${escapeHTML(prob)}</span>
          </div>`;
        }).join('')}
      </div>
    </div>
  </section>`;

  const sunCard = `<section class="card sun-card">
    <header class="card-head">
      <div class="card-heading">
        <p class="kicker">Tageslicht</p>
        <h3 class="card-title">Sonne & Mond</h3>
      </div>
      <span class="pill pill-muted">${dayPhase === 'before' ? 'Vor Sonnenaufgang' : dayPhase === 'after' ? 'Sonne ist untergegangen' : `${daylightProgress} % des Tages`}</span>
    </header>
    <div class="sun-arc">
      <svg viewBox="0 0 320 140" role="img" aria-label="Sonnenstand im Tagesverlauf">
        <defs>
          <linearGradient id="sunArcGradient" x1="44" y1="124" x2="276" y2="124" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#ffd08b" stop-opacity=".3"/>
            <stop offset=".45" stop-color="#ffd08b"/>
            <stop offset="1" stop-color="#7deed3"/>
          </linearGradient>
          <linearGradient id="sunArcFill" x1="160" y1="8" x2="160" y2="124" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#ffd08b" stop-opacity=".12"/>
            <stop offset="1" stop-color="#7deed3" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <line class="sun-arc-horizon" x1="18" y1="124" x2="302" y2="124"/>
        <path class="sun-arc-fill" d="M 44 124 A 116 116 0 0 1 276 124 Z"/>
        <path class="sun-arc-path" d="M 44 124 A 116 116 0 0 1 276 124"/>
        ${sunProgressPath ? `<path class="sun-arc-progress" d="${sunProgressPath}"/>` : ''}
        <circle class="sun-arc-dot" cx="${sunDotX.toFixed(2)}" cy="${sunDotY.toFixed(2)}" r="4.5"/>
        <circle cx="48" cy="128" r="1.7" fill="rgba(255,208,139,.7)"/>
        <circle cx="272" cy="128" r="1.7" fill="rgba(192,170,255,.7)"/>
        ${isNight ? `<g class="sun-arc-stars"><circle cx="78" cy="66" r="1.3"/><circle cx="236" cy="52" r="1.1"/><circle cx="276" cy="92" r="1.4"/><circle cx="118" cy="44" r="0.9"/></g>
        <path class="sun-arc-moon-path" d="M 44 124 A 116 116 0 0 1 ${moonX.toFixed(2)} ${moonY.toFixed(2)}"/>
        <circle class="sun-arc-moon" cx="${moonX.toFixed(2)}" cy="${moonY.toFixed(2)}" r="6"/>` : ''}
      </svg>
    </div>
    <div class="sun-times">
      <div class="sun-time">
        <span class="sun-time-icon">${icon('sunrise', 14)}</span>
        <span class="sun-time-copy"><span>Sonnenaufgang</span><strong>${sunrise}</strong></span>
      </div>
      <div class="sun-time">
        <span class="sun-time-icon dusk">${icon('sunset', 14)}</span>
        <span class="sun-time-copy"><span>Sonnenuntergang</span><strong>${sunset}</strong></span>
      </div>
    </div>
    <div class="daylight-row">
      <div class="daylight-caption"><span>Tageslicht</span><strong>${dayLength}</strong></div>
      <div class="daylight-line"><i style="width:${clamp(daylightProgress, 2, 100)}%"></i></div>
      <div class="daylight-caption"><span>${formatTime(sun.sunrise)}</span><span>${formatTime(sun.sunset)}</span></div>
    </div>
    <div class="moon-feature">
      <div class="moon-stage">
        <span class="moon-stage-glow" aria-hidden="true"></span>
        ${moonPhaseIcon(moon.illumination, 76, moon.waxing)}
      </div>
      <div class="moon-info">
        <span class="moon-kicker">Mondphase</span>
        <strong class="moon-name">${escapeHTML(moon.name)}</strong>
        <span class="moon-detail">${moon.waxing ? 'zunehmend' : 'abnehmend'} · ${Math.round(moon.age)} Tage alt</span>
        <div class="moon-meter" aria-hidden="true"><i style="width:${moon.percent}%"></i></div>
        <span class="moon-caption">${moon.percent} % beleuchtet</span>
      </div>
    </div>
  </section>`;

  const alertCard = `<article class="card alerts-card">
    <header class="card-head">
      <div class="card-heading">
        <p class="kicker">${icon('bell', 11)} DWD-Warnlage</p>
        <h3 class="card-title">Amtliche Warnungen</h3>
      </div>
      ${alerts.length ? `<button class="card-link" type="button" data-open-alerts>Alle ${alerts.length} ${icon('chevronRight', 12)}</button>` : ''}
    </header>
    ${alerts.length ? `<div class="mini-alerts">${alerts.slice(0, 2).map((alert) => `<button class="mini-alert" type="button" data-open-alerts>
        <span class="mini-alert-dot" style="background:${alert.severityRank >= 3 ? 'var(--alert)' : 'var(--warm)'}"></span>
        <span class="mini-alert-copy">
          <span class="mini-alert-title">${escapeHTML(alert.event)}: ${escapeHTML(alert.headline)}</span>
          <span class="mini-alert-meta">${escapeHTML(alert.severityLabel)} · ${escapeHTML(formatAlertExpiry(alert))}</span>
        </span>
        ${icon('chevronRight', 11)}
      </button>`).join('')}</div>` : `<div class="alert-safe">
        <span class="alert-safe-icon">${icon('info', 14)}</span>
        <p><strong>Keine aktiven Warnungen</strong>${model.alertsAvailable ? 'Der DWD meldet für diese Region derzeit keine amtliche Wetterwarnung.' : 'Die Warnlage konnte gerade nicht abgerufen werden.'}</p>
      </div>`}
  </article>`;

  const tip = model.tip;
  const sideStack = `<div class="side-stack">
    <article class="card tip-card" data-tone="${escapeHTML(tip.tone || 'neutral')}">
      <div class="tip-head">
        <span class="tip-icon">${icon(tip.icon || 'sparkles', 14)}</span>
        <span class="tip-eyebrow">Brise-Tipp</span>
      </div>
      <h3 class="tip-title">${escapeHTML(tip.title)}</h3>
      <p class="tip-text">${escapeHTML(tip.text)}</p>
    </article>
    ${alertCard}
    <button class="radar-teaser" type="button" data-open-radar>
      <span class="radar-teaser-art"></span>
      <span class="radar-teaser-copy">
        <span class="radar-teaser-eyebrow">${icon('radar', 11)} DWD-Radar</span>
        <h3>Regenradar</h3>
        <p>${escapeHTML(rainStart ? `Die nächsten Tropfen erreichen ${city.name} gegen ${rainStart} Uhr.` : `Behalte Regen und Schnee über ${city.name} im animierten 90-Minuten-Radar im Blick.`)}</p>
        <span class="radar-teaser-cta">Animierte Vorschau ${icon('arrowUpRight', 11)}</span>
      </span>
    </button>
  </div>`;

  container.innerHTML = `${weatherToolbarMarkup(city)}
    <div class="dashboard">
      ${alertBanner}
      ${hero}
      ${nowCard}
      ${trendCard}
      ${sunCard}
      <section class="card forecast-card">
        <header class="card-head">
          <div class="card-heading">
            <p class="kicker">Ausblick</p>
            <h3 class="card-title">Die nächsten 7 Tage</h3>
          </div>
          <span class="pill pill-muted">${escapeHTML(city.name)}</span>
        </header>
        <div class="forecast-list">${forecastRows}</div>
        <div class="forecast-footnote">${icon('info', 10)} Wähle einen Tag für die Stundenübersicht und Details aus.</div>
      </section>
      ${sideStack}
    </div>`;

  const updateIndicator = $('#weatherUpdated');
  if (updateIndicator) {
    updateIndicator.dataset.stale = String(stale);
    updateIndicator.innerHTML = `<i class="live-dot"></i>${escapeHTML(updatedLabel)}`;
    updateIndicator.title = `Letzte Abfrage: ${formatTime(model.fetchedAt)} Uhr`;
  }
  renderTrendChart($('#trendChart'), model, state.trendRange, state.settings);
  setPageLive(stale);
}

function toggleFavorite(cityId) {
  const city = CITY_BY_ID[cityId];
  if (!city) return;
  if (isFavorite(cityId)) {
    state.favorites = state.favorites.filter((id) => id !== cityId);
    persistFavorites();
    showToast(`${city.name} aus den Favoriten entfernt.`, { icon: 'star' });
  } else {
    state.favorites = [...state.favorites, cityId];
    persistFavorites();
    showToast(`${city.name} zu den Favoriten hinzugefügt.`, { icon: 'starFilled' });
    loadFavoriteSummaries();
  }
  renderFavorites();
  if (state.view === 'weather' && state.model) renderWeather();
  if (state.view === 'germany') renderGermanyView();
}

function removeFavorite(cityId) {
  if (isFavorite(cityId)) toggleFavorite(cityId);
}


function openAlertsModal() {
  const model = state.model;
  if (!model) return;
  const city = model.city;
  const alerts = model.alerts;
  const list = alerts.length
    ? `<div class="alert-list">${alerts.map((alert) => `<article class="alert-entry" data-severity="${escapeHTML(alert.severity)}">
        <div class="alert-entry-head">
          <span class="alert-badge">${icon('warning', 15)}</span>
          <div>
            <div class="alert-entry-title">${escapeHTML(alert.event)}</div>
            <div class="alert-entry-meta">
              <span class="pill ${alertSeverityClass(alert.severity)}">${escapeHTML(alert.severityLabel)}</span>
              <span>${escapeHTML(formatAlertPeriod(alert))}</span>
            </div>
          </div>
        </div>
        <div class="alert-entry-body">
          <p>${escapeHTML(alert.headline)}</p>
          ${alert.description ? `<p style="margin-top:7px">${escapeHTML(alert.description)}</p>` : ''}
          ${alert.instruction ? `<div class="alert-entry-instruction">${icon('info', 11)} ${escapeHTML(alert.instruction)}</div>` : ''}
        </div>
      </article>`).join('')}</div>`
    : `<div class="alert-safe" style="padding:22px 4px">
        <span class="alert-safe-icon">${icon('info', 14)}</span>
        <p><strong>Keine aktiven Warnungen</strong>${model.alertsAvailable ? 'Der Deutsche Wetterdienst meldet für diese Region derzeit keine amtliche Wetterwarnung.' : 'Die DWD-Warnlage konnte für diesen Ort nicht abgerufen werden.'}</p>
      </div>`;

  showOverlay(`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="alertsTitle">
    <div class="modal-head">
      <div class="modal-head-copy">
        <div class="modal-kicker">DWD-Warnlage · ${escapeHTML(city.name)}</div>
        <h2 class="modal-title" id="alertsTitle">${alerts.length ? `${alerts.length} amtliche ${alerts.length === 1 ? 'Warnung' : 'Warnungen'}` : 'Keine Warnungen'}</h2>
        <p class="modal-subtitle">Direkt vom Deutschen Wetterdienst · Stand ${formatTime(model.fetchedAt)} Uhr</p>
      </div>
      <button class="modal-close" type="button" data-close aria-label="Schließen">${icon('x', 15)}</button>
    </div>
    <div class="modal-body">${list}</div>
    <div class="modal-footer">
      <span style="margin-right:auto;font-size:9px;color:var(--text-3)">Amtliche Warnungen können sich kurzfristig ändern.</span>
      <button class="action-button" type="button" data-close>Schließen</button>
    </div>
  </div>`);
}

function openDayModal(dayKey) {
  const model = state.model;
  if (!model) return;
  const day = model.daily.find((entry) => entry.key === dayKey);
  if (!day) return;
  const rain = day.precipSum > 0 ? formatPrecip(day.precipSum, state.settings.precipUnit) : 'trocken';
  const maxWind = finite(day.maxGust) ? formatWind(day.maxGust, state.settings.windUnit, 0) : (finite(day.maxWind) ? formatWind(day.maxWind, state.settings.windUnit, 0) : '–');
  const rows = day.hours
    .map((hour) => {
      const prob = Number.isFinite(hour.prob) ? `${Math.round(hour.prob)} %` : '–';
      const amount = hour.precip > 0 ? formatPrecip(hour.precip, state.settings.precipUnit) : null;
      return `<div class="day-hour-row">
        <span class="day-hour-time">${formatTime(hour.timestamp)}</span>
        <span class="day-hour-icon">${weatherIcon(hour.icon)}</span>
        <span class="day-hour-main">
          <span class="day-hour-label">${escapeHTML(hour.label)}</span>
          <span class="day-hour-meta">Regen ${escapeHTML(prob)}${amount ? ` · ${escapeHTML(amount)}` : ''}${finite(hour.gustSpeed) ? ` · Böen ${escapeHTML(formatWind(hour.gustSpeed, state.settings.windUnit, 0))}` : ''}</span>
        </span>
        <span class="day-hour-temp">${escapeHTML(formatTemp(hour.tempC, state.settings.tempUnit))}</span>
      </div>`;
    })
    .join('');

  showOverlay(`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="dayTitle">
    <div class="modal-head">
      <div class="modal-head-copy">
        <div class="modal-kicker">${escapeHTML(model.city.name)} · Stundenverlauf</div>
        <h2 class="modal-title" id="dayTitle">${escapeHTML(day.labelDay)} · ${escapeHTML(formatDateWithWeekday(day.date))}</h2>
        <p class="modal-subtitle">${escapeHTML(day.label)} · Sonnenaufgang ${day.sunrise ? formatTime(day.sunrise) : '–'} · Sonnenuntergang ${day.sunset ? formatTime(day.sunset) : '–'}</p>
      </div>
      <button class="modal-close" type="button" data-close aria-label="Schließen">${icon('x', 15)}</button>
    </div>
    <div class="modal-body">
      <div class="day-summary-strip">
        <div class="day-summary-cell"><span>Höchstwert</span><strong>${escapeHTML(formatTemp(day.high, state.settings.tempUnit))}</strong></div>
        <div class="day-summary-cell"><span>Tiefstwert</span><strong>${escapeHTML(formatTemp(day.low, state.settings.tempUnit))}</strong></div>
        <div class="day-summary-cell"><span>Niederschlag</span><strong>${escapeHTML(rain)}</strong></div>
      </div>
      <div class="day-summary-strip">
        <div class="day-summary-cell"><span>Regenrisiko</span><strong>${Number.isFinite(day.probMax) ? `${Math.round(day.probMax)} %` : '–'}</strong></div>
        <div class="day-summary-cell"><span>Sonnenschein</span><strong>${formatDuration(day.sunshineMinutes)}</strong></div>
        <div class="day-summary-cell"><span>Stärkste Böen</span><strong>${escapeHTML(maxWind)}</strong></div>
      </div>
      <div class="day-detail-chart" id="dayChart"></div>
      <div class="day-hours">${rows}</div>
      <div class="settings-note">Alle Werte stammen aus offenen Wetterdaten. Zeiten in der Ortszeit des Ortes.</div>
    </div>
    <div class="modal-footer">
      <button class="action-button" type="button" data-close>Schließen</button>
    </div>
  </div>`, {
    onMount: (overlay) => {
      requestAnimationFrame(() => renderDayChart($('#dayChart', overlay), day, state.settings));
    },
  });
}

function settingsSelectOptions(values, selected) {
  return values.map(([value, label]) => `<option value="${escapeHTML(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${escapeHTML(label)}</option>`).join('');
}

function openSettingsModal() {
  const settings = state.settings;
  const languageOptions = [['de', 'Deutsch'], ['en', 'Englisch'], ['nl', 'Niederländisch']];
  const providerOptions = [['dwd', 'Deutscher Wetterdienst (DWD)'], ['open-meteo', 'Open-Meteo']];
  const countrySelect = countryOptions(settings.language, settings.country)
    .map(({ value, label, selected }) => `<option value="${value}" ${selected ? 'selected' : ''}>${escapeHTML(label)}</option>`)
    .join('');
  const overlayMarkup = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">
    <div class="modal-head">
      <div class="modal-head-copy">
        <div class="modal-kicker">Brise · Persönlich</div>
        <h2 class="modal-title" id="settingsTitle">Einstellungen</h2>
        <p class="modal-subtitle">Hier stellst du Brise so ein, wie es für dich am besten passt.</p>
      </div>
      <button class="modal-close" type="button" data-close aria-label="Schließen">${icon('x', 15)}</button>
    </div>
    <div class="modal-body">
      <div class="settings-section">
        <div class="settings-section-title">Darstellung</div>
        <div class="setting-row">
          <div class="setting-row-copy"><div class="setting-label">Farbwelt</div><div class="setting-hint">Dunkel, hell, warm oder kühl – such einfach aus, was sich gut anfühlt.</div></div>
          <div class="setting-control">
            <select class="settings-select" data-setting="theme" aria-label="Farbwelt">
              ${settingsSelectOptions(THEME_OPTIONS, settings.theme)}
            </select>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-row-copy"><div class="setting-label">Akzentfarbe</div><div class="setting-hint">Ein bisschen Farbe für Highlights und Diagramme.</div></div>
          <div class="setting-control">
            <div class="accent-swatches" role="group" aria-label="Akzentfarbe">
              ${ACCENT_OPTIONS.map(([id, label]) => `<button type="button" class="accent-swatch accent-${id}${state.settings.accent === id ? ' is-active' : ''}" data-accent-setting="${id}" title="${label}" aria-label="${label}" aria-pressed="${state.settings.accent === id}"></button>`).join('')}
            </div>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-row-copy"><div class="setting-label">Bewegung</div><div class="setting-hint">Sanfte Animationen. Du kannst sie jederzeit ausmachen.</div></div>
          <button class="toggle" type="button" role="switch" aria-checked="${settings.animations}" aria-label="Animationen" data-toggle-setting="animations"></button>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">Grafik</div>
        <div class="setting-row">
          <div class="setting-row-copy"><div class="setting-label">Hardwarebeschleunigung</div><div class="setting-hint">Grafikkarte nutzen, wenn verfügbar. Auf NVIDIA/Wayland wählt Brise automatisch den 180-Hz-Pfad.</div></div>
          <button class="toggle" type="button" role="switch" aria-checked="${settings.hardwareAcceleration}" aria-label="Hardwarebeschleunigung" data-toggle-setting="hardwareAcceleration"></button>
        </div>
        <div class="setting-row">
          <div class="setting-row-copy"><div class="setting-label">VSync</div><div class="setting-hint">Darstellung im Monitor-Takt bis 180 Hz. Aus aktiviert ein sparsames 60-fps-Limit – für flüssiges Scrollen eingeschaltet lassen.</div></div>
          <button class="toggle" type="button" role="switch" aria-checked="${settings.vsync}" aria-label="VSync" data-toggle-setting="vsync"></button>
        </div>
        <div class="settings-note">Grafikänderungen werden sofort übernommen. Für die volle Wirkung starte Brise neu.</div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">Einheiten</div>
        <div class="setting-row">
          <div class="setting-row-copy"><div class="setting-label">Temperatur</div><div class="setting-hint">Gilt für alle Anzeigen und Diagramme.</div></div>
          <div class="setting-control">
            <select class="settings-select" data-setting="tempUnit" aria-label="Temperatureinheit">
              ${settingsSelectOptions([['c', 'Celsius (°C)'], ['f', 'Fahrenheit (°F)']], settings.tempUnit)}
            </select>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-row-copy"><div class="setting-label">Windgeschwindigkeit</div><div class="setting-hint">Böen und Wind werden passend umgerechnet.</div></div>
          <div class="setting-control">
            <select class="settings-select" data-setting="windUnit" aria-label="Windeinheit">
              ${settingsSelectOptions([['kmh', 'Kilometer pro Stunde'], ['ms', 'Meter pro Sekunde'], ['mph', 'Meilen pro Stunde']], settings.windUnit)}
            </select>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-row-copy"><div class="setting-label">Niederschlagsmenge</div><div class="setting-hint">Millimeter oder Zoll in Details und Diagrammen.</div></div>
          <div class="setting-control">
            <select class="settings-select" data-setting="precipUnit" aria-label="Niederschlagseinheit">
              ${settingsSelectOptions([['mm', 'Millimeter'], ['in', 'Zoll']], settings.precipUnit)}
            </select>
          </div>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">Region & Sprache</div>
        <div class="setting-row">
          <div class="setting-row-copy"><div class="setting-label">Land</div><div class="setting-hint">Die Ortsuche ist weltweit. Dieses Land bestimmt die Wetterquelle (DWD nur für Deutschland) und die Deutschlandkarte.</div></div>
          <div class="setting-control"><select class="settings-select" data-setting="country" aria-label="Land">${countrySelect}</select></div>
        </div>
        <div class="setting-row">
          <div class="setting-row-copy"><div class="setting-label">Sprache</div><div class="setting-hint">Die Sprache der Oberfläche – unabhängig vom Land.</div></div>
          <div class="setting-control"><select class="settings-select" data-setting="language" aria-label="Sprache">${settingsSelectOptions(languageOptions, settings.language)}</select></div>
        </div>
        <div class="setting-row">
          <div class="setting-row-copy"><div class="setting-label">Wetterquelle</div><div class="setting-hint">Für Deutschland kannst du zwischen DWD und Open-Meteo wählen. Andere Länder nutzen Open-Meteo.</div></div>
          <div class="setting-control"><select class="settings-select" data-setting="provider" aria-label="Wetterquelle" ${settings.country === 'DE' ? '' : 'disabled'}>${settingsSelectOptions(providerOptions, settings.provider)}</select></div>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">Daten</div>
        <div class="setting-row">
          <div class="setting-row-copy"><div class="setting-label">Automatisch aktualisieren</div><div class="setting-hint">Brise holt neue Messwerte, ohne dass du etwas tun musst.</div></div>
          <div class="setting-control">
            <select class="settings-select" data-setting="refreshMinutes" aria-label="Aktualisierungsintervall">
              ${settingsSelectOptions([['5', 'Alle 5 Minuten'], ['10', 'Alle 10 Minuten'], ['15', 'Alle 15 Minuten'], ['30', 'Alle 30 Minuten'], ['0', 'Nur manuell']], settings.refreshMinutes)}
            </select>
          </div>
        </div>
        <div class="settings-note">Brise nutzt kostenlose, offene Wetterdaten von DWD und Open-Meteo. Es werden keine Konten, API-Schlüssel oder Tracking-Dienste benötigt.</div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">Tastatur</div>
        <div class="shortcut-grid">
          <div class="shortcut-row"><span>Suche & Befehle</span><kbd>Strg K</kbd></div>
          <div class="shortcut-row"><span>Einstellungen</span><kbd>Strg ,</kbd></div>
          <div class="shortcut-row"><span>Ansichten wechseln</span><kbd>1 – 3</kbd></div>
          <div class="shortcut-row"><span>Daten aktualisieren</span><kbd>Strg R</kbd></div>
        </div>
        <div class="settings-actions" style="margin-top:12px">
          <button class="action-button" type="button" data-settings-action="shortcuts">${icon('keyboard', 13)} Tastenkürzel ansehen</button>
          <button class="action-button" type="button" data-settings-action="reset-favorites">${icon('star', 13)} Favoriten löschen</button>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="action-button" type="button" data-settings-action="reset" style="margin-right:auto">${icon('refresh', 13)} Standardeinstellungen laden</button>
      <button class="action-button" type="button" data-close>Fertig</button>
      <button class="action-button primary" type="button" data-settings-action="refresh">${icon('refresh', 13)} Jetzt aktualisieren</button>
    </div>
  </div>`;

  const overlay = showOverlay(overlayMarkup, {
    onMount: (root) => {
      root.addEventListener('change', (event) => {
        const key = event.target.closest('[data-setting]')?.dataset.setting;
        if (!key) return;
        let value = event.target.value;
        if (key === 'refreshMinutes') value = Number(value);
        state.settings[key] = value;
        if (key === 'country' && state.settings.country !== 'DE') state.settings.provider = 'open-meteo';
        persistSettings();
        applyTheme();
        if (['country', 'language', 'provider'].includes(key)) {
          applyLocaleAndRegion();
          scheduleRefresh();
          refreshAllData();
          openSettingsModal();
          return;
        }
        if (key === 'refreshMinutes') scheduleRefresh();
        rerenderForSettings();
      });
      root.addEventListener('click', (event) => {
        const swatch = event.target.closest('[data-accent-setting]');
        if (swatch) {
          const accent = swatch.dataset.accentSetting;
          if (!ACCENT_IDS.has(accent)) return;
          state.settings.accent = accent;
          persistSettings();
          applyTheme();
          $$('[data-accent-setting]', root).forEach((other) => {
            const active = other === swatch;
            other.classList.toggle('is-active', active);
            other.setAttribute('aria-pressed', String(active));
          });
          rerenderForSettings();
          return;
        }
        const toggle = event.target.closest('[data-toggle-setting]');
        if (toggle) {
          const key = toggle.dataset.toggleSetting;
          state.settings[key] = !state.settings[key];
          toggle.setAttribute('aria-checked', String(state.settings[key]));
          persistSettings();
          applyTheme();
          if (key === 'hardwareAcceleration' || key === 'vsync') {
            applyGraphicsSettings();
            showToast(t('Für die volle Wirkung bitte Brise neu starten.'), { icon: 'settings' });
          }
          rerenderForSettings();
          return;
        }
        const action = event.target.closest('[data-settings-action]')?.dataset.settingsAction;
        if (!action) return;
        if (action === 'shortcuts') {
          openShortcutsModal();
        } else if (action === 'reset') {
          state.settings = { ...DEFAULT_SETTINGS };
          persistSettings();
          applyLocaleAndRegion();
          applyTheme();
          scheduleRefresh();
          rerenderForSettings();
          openSettingsModal();
          showToast('Einstellungen zurückgesetzt.', { icon: 'settings' });
        } else if (action === 'reset-favorites') {
          state.favorites = DEFAULT_FAVORITES.filter((id) => CITY_BY_ID[id]);
          persistFavorites();
          renderFavorites();
          loadFavoriteSummaries(true);
          if (state.view === 'germany') renderGermanyView();
          openSettingsModal();
          showToast('Favoriten zurückgesetzt.', { icon: 'star' });
        } else if (action === 'refresh') {
          closeOverlay();
          refreshAllData();
        }
      });
    },
  });
  return overlay;
}

function openAboutModal() {
  showOverlay(`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="aboutTitle">
    <div class="modal-head">
      <div class="modal-head-copy">
        <div class="modal-kicker">Brise · Über die App</div>
        <h2 class="modal-title" id="aboutTitle">Wetter, das sich richtig anfühlt.</h2>
        <p class="modal-subtitle">Eine native Linux-App für den Deutschen Wetterdienst — ruhig, präzise und für Wayland gebaut.</p>
      </div>
      <button class="modal-close" type="button" data-close aria-label="Schließen">${icon('x', 15)}</button>
    </div>
    <div class="modal-body">
      <div class="about-copy">
        <p>Brise zeigt amtliche DWD-Beobachtungen und Vorhersagen für jede deutsche Stadt. Die Daten stammen direkt vom Deutschen Wetterdienst und werden über die offene Bright-Sky-Schnittstelle aufbereitet. Kein API-Schlüssel, kein Konto, kein Tracking.</p>
        <p>Mit der Ortsuche lässt sich jeder Ort in Deutschland hinzufügen. Die Suche nutzt Open-Meteo Geocoding mit Daten von GeoNames; Wetter, Warnungen und Radar bleiben ausschließlich DWD-Daten.</p>
        <p>Die Deutschlandkarte basiert auf Natural-Earth-Geometrien (gemeinfrei) und zeigt ausschließlich reale Messwerte der nächstgelegenen DWD-Stationen. Warnungen stammen aus der amtlichen DWD-Warnlage.</p>
      </div>
      <div class="about-links">
        <div class="about-link">${icon('shield', 14)}<strong>Datenquelle</strong><span>Deutscher Wetterdienst (offene Daten)</span></div>
        <div class="about-link">${icon('layers', 14)}<strong>Schnittstelle</strong><span>Bright Sky · api.brightsky.dev</span></div>
        <div class="about-link">${icon('mapPinned', 14)}<strong>Karten</strong><span>Natural Earth · gemeinfrei</span></div>
        <div class="about-link">${icon('pin', 14)}<strong>Ortsuche</strong><span>Open-Meteo Geocoding · GeoNames</span></div>
        <div class="about-link">${icon('radar', 14)}<strong>Radar</strong><span>DWD Radarverbund, 5-Minuten-Komposite</span></div>
      </div>
      <div class="settings-note">Brise 1.1 · Tauri 2 · WebKitGTK · Wayland-optimiert. Kostenlose Wetterdaten von DWD und Open-Meteo.</div>
    </div>
    <div class="modal-footer">
      <span style="margin-right:auto;font-size:9px;color:var(--text-3)">Mit Sorgfalt für Linux gebaut.</span>
      <button class="action-button" type="button" data-close>Schließen</button>
    </div>
  </div>`);
}

function openShortcutsModal() {
  showOverlay(`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="shortcutsTitle">
    <div class="modal-head">
      <div class="modal-head-copy">
        <div class="modal-kicker">Brise · Schneller unterwegs</div>
        <h2 class="modal-title" id="shortcutsTitle">Tastenkürzel</h2>
        <p class="modal-subtitle">Die wichtigsten Abkürzungen – auch ohne Maus.</p>
      </div>
      <button class="modal-close" type="button" data-close aria-label="Schließen">${icon('x', 15)}</button>
    </div>
    <div class="modal-body">
      <div class="shortcut-grid">
        <div class="shortcut-row"><span>Suche & Befehle</span><kbd>Strg K</kbd></div>
        <div class="shortcut-row"><span>Einstellungen</span><kbd>Strg ,</kbd></div>
        <div class="shortcut-row"><span>Wetteransicht</span><kbd>1</kbd></div>
        <div class="shortcut-row"><span>Regenradar</span><kbd>2</kbd></div>
        <div class="shortcut-row"><span>Deutschlandkarte</span><kbd>3</kbd></div>
        <div class="shortcut-row"><span>Daten aktualisieren</span><kbd>Strg R</kbd></div>
        <div class="shortcut-row"><span>Overlay schließen</span><kbd>Esc</kbd></div>
        <div class="shortcut-row"><span>Diagramm steuern</span><kbd>← →</kbd></div>
      </div>
      <div class="settings-note">Tipp: Im Suchfeld mit ↑ und ↓ navigieren und mit Enter öffnen.</div>
    </div>
    <div class="modal-footer">
      <button class="action-button" type="button" data-close>Schließen</button>
    </div>
  </div>`);
}


function commandMatches(command, query) {
  if (!query) return true;
  const haystack = normalizeSearch(`${command.title} ${command.subtitle}`);
  return query.split(/\s+/).every((part) => haystack.includes(part));
}

function searchGroups(query) {
  const normalized = normalizeSearch(query);
  const groups = [];
  if (!normalized) {
    const favoriteCities = state.favorites.map((id) => CITY_BY_ID[id]).filter(Boolean).slice(0, 6);
    if (favoriteCities.length) groups.push({ label: 'Deine Favoriten', items: favoriteCities.map((city) => ({ kind: 'city', city })) });
    const popular = ['berlin', 'hamburg', 'muenchen', 'koeln', 'frankfurt', 'stuttgart']
      .filter((id) => !state.favorites.includes(id))
      .map((id) => CITY_BY_ID[id])
      .filter(Boolean)
      .slice(0, 6);
    if (popular.length) groups.push({ label: 'Städte entdecken', items: popular.map((city) => ({ kind: 'city', city })) });
    groups.push({ label: 'Schnellzugriff', items: SEARCH_COMMANDS.map((command) => ({ kind: 'command', command })) });
    return groups;
  }
  const cities = searchCities(query, 12);
  if (cities.length) groups.push({ label: 'Städte', items: cities.map((city) => ({ kind: 'city', city })) });
  const commands = SEARCH_COMMANDS.filter((command) => commandMatches(command, normalized));
  if (commands.length) groups.push({ label: 'Befehle', items: commands.map((command) => ({ kind: 'command', command })) });

  const seen = new Set(cities.map((city) => normalizeSearch(`${city.name}${city.state}`)));
  const remote = state.remotePlaces.filter((city) => {
    const key = normalizeSearch(`${city.name}${city.state}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (remote.length) {
    groups.push({ label: 'Weitere Orte weltweit', items: remote.map((city) => ({ kind: 'city', city, remote: true })) });
  }
  return groups;
}

function scheduleRemoteSearch(query) {
  if (state.remoteTimer) clearTimeout(state.remoteTimer);
  state.searchGeneration += 1;
  if (normalizeSearch(query).length < 2) {
    state.remotePlaces = [];
    state.remoteError = null;
    state.remoteLoading = false;
    renderSearchResults();
    return;
  }
  state.remoteTimer = setTimeout(() => runRemoteSearch(query), 250);
}

async function runRemoteSearch(query) {
  const generation = ++state.searchGeneration;
  state.remoteLoading = true;
  state.remoteError = null;
  state.remotePlaces = [];
  renderSearchResults();
  try {
    const data = await searchPlaces(query);
    if (generation !== state.searchGeneration) return;
    state.remotePlaces = (data?.results || []).map((place) => ({
      id: place.id,
      name: place.name,
      state: place.state,
      lat: place.lat,
      lon: place.lon,
      country: place.countryCode || 'DE',
    }));
  } catch (error) {
    if (generation !== state.searchGeneration) return;
    state.remoteError = error instanceof Error ? error.message : String(error);
  } finally {
    if (generation === state.searchGeneration) {
      state.remoteLoading = false;
      renderSearchResults();
    }
  }
}

function resolveSearchCity(item) {
  if (!item || item.kind !== 'city') return null;
  return (item.remote ? registerCity(item.city) : null) || item.city;
}

function searchItemMarkup(item, index) {
  const selected = index === state.searchIndex ? ' is-selected' : '';
  if (item.kind === 'city') {
    const city = item.city;
    const weather = summaryWeather(city.id);
    const favorite = isFavorite(city.id);
    const temp = finite(weather?.temperature) ? formatTemp(weather.temperature, state.settings.tempUnit) : '';
    const countryLabel = item.remote ? countryName(city.country, state.settings.language) : '';
    const placeLabel = countryLabel && countryLabel !== city.state
      ? `${city.state}, ${countryLabel}`
      : (city.state || countryLabel);
    const weatherLabel = weather
      ? `${summaryLabel(city, weather)} · ${placeLabel}`
      : placeLabel;
    const iconMarkup = weather ? weatherIcon(summaryIconName(city, weather)) : icon('pin', 15);
    return `<div class="command-item${selected}${item.remote ? ' is-remote' : ''}" data-search-item="${index}" role="option" aria-selected="${index === state.searchIndex}">
      <span class="command-item-icon">${iconMarkup}</span>
      <span class="command-item-copy">
        <span class="command-item-title">${escapeHTML(city.name)}</span>
        <span class="command-item-subtitle">${escapeHTML(weatherLabel)}</span>
      </span>
      <span class="command-item-meta">
        ${temp ? `<span class="command-item-temp">${escapeHTML(temp)}</span>` : ''}
        <button class="command-fav ${favorite ? 'is-favorite' : ''}" type="button" data-search-fav="${index}" aria-label="${favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}" title="${favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}">${icon(favorite ? 'starFilled' : 'star', 14)}</button>
      </span>
    </div>`;
  }
  const command = item.command;
  return `<div class="command-item${selected}" data-search-item="${index}" role="option" aria-selected="${index === state.searchIndex}">
    <span class="command-item-icon">${icon(command.icon, 15)}</span>
    <span class="command-item-copy">
      <span class="command-item-title">${escapeHTML(command.title)}</span>
      <span class="command-item-subtitle">${escapeHTML(command.subtitle)}</span>
    </span>
    <span class="command-item-meta"><kbd>↵</kbd></span>
  </div>`;
}

function renderSearchResults(resetIndex = false) {
  const input = $('#searchInput');
  const results = $('#searchResults');
  if (!input || !results) return;
  if (resetIndex) state.searchIndex = 0;
  const groups = searchGroups(input.value);
  state.searchItems = groups.flatMap((group) => group.items);
  if (state.searchIndex >= state.searchItems.length) state.searchIndex = Math.max(0, state.searchItems.length - 1);
  const status = [];
  if (state.remoteLoading) {
    status.push(`<div class="command-status"><span class="loader-orbit is-small"></span> Weitere Orte weltweit werden gesucht …</div>`);
  } else if (state.remoteError) {
    status.push(`<div class="command-status is-error">Ortsuche derzeit nicht verfügbar: ${escapeHTML(state.remoteError)}</div>`);
  }
  if (!groups.length) {
    if (!status.length) {
      status.push(`<div class="command-empty"><strong>Kein Ort gefunden</strong>Versuche einen anderen Ortsnamen oder einen Befehl wie „Radar“.</div>`);
    }
    results.innerHTML = status.join('');
    return;
  }
  let index = 0;
  results.innerHTML = groups.map((group) => {
    const items = group.items.map((item) => {
      const markup = searchItemMarkup(item, index);
      index += 1;
      return markup;
    }).join('');
    return `<div class="command-group-label">${escapeHTML(group.label)}</div>${items}`;
  }).join('') + status.join('');
  requestAnimationFrame(() => {
    const selected = results.querySelector(`[data-search-item="${state.searchIndex}"]`);
    selected?.scrollIntoView({ block: 'nearest' });
  });
}

function searchSetIndex(next) {
  if (!state.searchItems.length) return;
  state.searchIndex = (next + state.searchItems.length) % state.searchItems.length;
  const results = $('#searchResults');
  if (!results) return;
  $$('[data-search-item]', results).forEach((item) => {
    const active = Number(item.dataset.searchItem) === state.searchIndex;
    item.classList.toggle('is-selected', active);
    item.setAttribute('aria-selected', String(active));
    if (active) item.scrollIntoView({ block: 'nearest' });
  });
}

function executeSearchItem(index) {
  const item = state.searchItems[index];
  if (!item) return;
  if (item.kind === 'city') {
    const city = resolveSearchCity(item);
    closeOverlay();
    if (city) selectCity(city.id, { navigate: true });
    return;
  }
  closeOverlay();
  runCommand(item.command.id);
}

function runCommand(commandId) {
  if (commandId === 'radar') switchView('radar');
  else if (commandId === 'germany') switchView('germany');
  else if (commandId === 'settings') openSettingsModal();
  else if (commandId === 'shortcuts') openShortcutsModal();
  else if (commandId === 'about') openAboutModal();
  else if (commandId === 'refresh') refreshAllData();
}

function openSearch(prefill = '') {
  if (state.overlayOpen && !state.overlayLocked) closeOverlay();
  const overlay = showOverlay(`<div class="modal command-modal" role="dialog" aria-modal="true" aria-label="Orte und Befehle suchen">
    <div class="command-search">
      ${icon('search', 19)}
      <input class="command-input" id="searchInput" type="text" placeholder="Ort oder Befehl suchen …" autocomplete="off" spellcheck="false" aria-controls="searchResults" aria-autocomplete="list" value="${escapeHTML(prefill)}">
      <span class="command-esc"><kbd>ESC</kbd></span>
    </div>
    <div class="command-results" id="searchResults" role="listbox" aria-label="Suchergebnisse"></div>
    <div class="command-footer">
      <span class="shortcut"><kbd>↑</kbd><kbd>↓</kbd> Navigieren</span>
      <span class="shortcut"><kbd>↵</kbd> Öffnen</span>
      <span class="shortcut"><kbd>Strg K</kbd> Jederzeit</span>
      <span style="margin-left:auto">DWD · offene Daten</span>
    </div>
  </div>`, { focusSelector: '#searchInput' });

  if (!overlay) return;
  const input = $('#searchInput', overlay);
  const results = $('#searchResults', overlay);
  renderSearchResults(true);
  if (normalizeSearch(input.value).length >= 2) scheduleRemoteSearch(input.value);
  input.addEventListener('input', () => {
    renderSearchResults(true);
    scheduleRemoteSearch(input.value);
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      searchSetIndex(state.searchIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      searchSetIndex(state.searchIndex - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      executeSearchItem(state.searchIndex);
    }
  });
  results.addEventListener('click', (event) => {
    const favoriteButton = event.target.closest('[data-search-fav]');
    if (favoriteButton) {
      event.stopPropagation();
      const city = resolveSearchCity(state.searchItems[Number(favoriteButton.dataset.searchFav)]);
      if (city) toggleFavorite(city.id);
      renderSearchResults();
      return;
    }
    const item = event.target.closest('[data-search-item]');
    if (item) executeSearchItem(Number(item.dataset.searchItem));
  });
}


// ---------- Erste Einrichtung ----------

function needsOnboarding() {
  return loadJSON(ONBOARDING_KEY, false) !== true && loadJSON(CITY_KEY, null) === null;
}

function finishOnboarding(city) {
  if (state.onboarding.timer) {
    clearTimeout(state.onboarding.timer);
    state.onboarding.timer = null;
  }
  state.onboarding.generation += 1;
  saveJSON(ONBOARDING_KEY, true);
  if (city) {
    if (!isFavorite(city.id)) {
      state.favorites = [...state.favorites, city.id];
      persistFavorites();
      loadFavoriteSummaries();
    }
    selectCity(city.id, { navigate: true });
    showToast(`Brise ist eingerichtet. ${city.name} ist dein Startort.`, { icon: 'pin' });
  } else {
    showToast('Du kannst deinen Ort jederzeit über die Suche auswählen.', { icon: 'info' });
  }
  closeOverlay();
}

function onboardingItems() {
  const input = $('#onboardInput');
  const query = input ? input.value.trim() : '';
  if (normalizeSearch(query).length >= 2) {
    const items = searchCities(query, 8).map((city) => ({ city }));
    const seen = new Set(items.map((item) => normalizeSearch(`${item.city.name}${item.city.state}`)));
    for (const place of state.onboarding.places) {
      const key = normalizeSearch(`${place.name}${place.state}`);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ city: place, remote: true });
    }
    return items;
  }
  const ids = [...new Set([state.selectedCityId, ...state.favorites,
    'berlin', 'hamburg', 'muenchen', 'koeln', 'frankfurt', 'stuttgart'])];
  return ids.slice(0, 8).map((id) => CITY_BY_ID[id]).filter(Boolean).map((city) => ({ city }));
}

function renderOnboardingResults(resetIndex = false) {
  const results = $('#onboardResults');
  if (!results) return;
  const onboarding = state.onboarding;
  if (resetIndex) onboarding.index = 0;
  onboarding.items = onboardingItems();
  if (onboarding.index >= onboarding.items.length) {
    onboarding.index = Math.max(0, onboarding.items.length - 1);
  }
  const status = [];
  if (onboarding.loading) {
    status.push('<div class="onboard-status"><span class="loader-orbit is-small"></span> Orte weltweit werden gesucht …</div>');
  } else if (onboarding.error) {
    status.push(`<div class="onboard-status is-error">Ortsuche gerade nicht verfügbar: ${escapeHTML(onboarding.error)}. Die Orte unten funktionieren trotzdem.</div>`);
  }
  if (!onboarding.items.length && !onboarding.loading) {
    status.push('<div class="onboard-empty"><strong>Kein Ort gefunden</strong><span>Versuche einen anderen Ortsnamen.</span></div>');
  }
  results.innerHTML = onboarding.items.map((item, index) => {
    const city = item.city;
    const weather = summaryWeather(city.id);
    const temp = finite(weather?.temperature) ? formatTemp(weather.temperature, state.settings.tempUnit) : '';
    const countryLabel = item.remote ? countryName(city.country, state.settings.language) : '';
    const placeLabel = countryLabel && countryLabel !== city.state
      ? `${city.state}, ${countryLabel}`
      : (city.state || countryLabel);
    const detail = weather
      ? `${summaryLabel(city, weather)} · ${placeLabel}`
      : placeLabel;
    const selected = index === onboarding.index;
    return `<div class="onboard-city${selected ? ' is-selected' : ''}" data-onboard-item="${index}" role="option" aria-selected="${selected}">
      <span class="onboard-city-icon">${weather ? weatherIcon(summaryIconName(city, weather)) : icon('pin', 17)}</span>
      <span class="onboard-city-copy"><strong>${escapeHTML(city.name)}</strong><small>${escapeHTML(detail)}</small></span>
      ${temp ? `<span class="onboard-city-temp">${escapeHTML(temp)}</span>` : ''}
    </div>`;
  }).join('') + status.join('');
  requestAnimationFrame(() => {
    results.querySelector(`[data-onboard-item="${onboarding.index}"]`)?.scrollIntoView({ block: 'nearest' });
  });
}

async function runOnboardingSearch(query) {
  const generation = ++state.onboarding.generation;
  state.onboarding.loading = true;
  state.onboarding.error = null;
  state.onboarding.places = [];
  renderOnboardingResults();
  try {
    const data = await searchPlaces(query);
    if (generation !== state.onboarding.generation) return;
    state.onboarding.places = (data?.results || []).map((place) => ({
      id: place.id,
      name: place.name,
      state: place.state,
      lat: place.lat,
      lon: place.lon,
      country: place.countryCode || 'DE',
    }));
  } catch (error) {
    if (generation !== state.onboarding.generation) return;
    state.onboarding.error = usefulError(error);
  } finally {
    if (generation === state.onboarding.generation) {
      state.onboarding.loading = false;
      renderOnboardingResults();
    }
  }
}

function scheduleOnboardingSearch(query) {
  if (state.onboarding.timer) clearTimeout(state.onboarding.timer);
  state.onboarding.generation += 1;
  if (normalizeSearch(query).length < 2) {
    state.onboarding.places = [];
    state.onboarding.error = null;
    state.onboarding.loading = false;
    renderOnboardingResults(true);
    return;
  }
  state.onboarding.timer = setTimeout(() => runOnboardingSearch(query), 250);
}

function onboardingSetIndex(next) {
  const items = state.onboarding.items;
  if (!items.length) return;
  state.onboarding.index = (next + items.length) % items.length;
  const results = $('#onboardResults');
  if (!results) return;
  $$('[data-onboard-item]', results).forEach((item) => {
    const active = Number(item.dataset.onboardItem) === state.onboarding.index;
    item.classList.toggle('is-selected', active);
    item.setAttribute('aria-selected', String(active));
    if (active) item.scrollIntoView({ block: 'nearest' });
  });
}

function chooseOnboardingCity(index) {
  const item = state.onboarding.items[index];
  if (!item) return;
  const city = (item.remote ? registerCity(item.city) : null) || item.city;
  if (city) finishOnboarding(city);
}

function onboardingSetStep(step) {
  state.onboarding.step = step;
  const overlay = $('#overlayRoot [data-overlay]');
  if (!overlay) return;
  $$('[data-onboard-step]', overlay).forEach((section) => {
    section.hidden = Number(section.dataset.onboardStep) !== step;
  });
  $$('[data-onboard-dot]', overlay).forEach((dot) => {
    dot.classList.toggle('is-active', Number(dot.dataset.onboardDot) <= step);
  });
  const label = $('#onboardProgressLabel', overlay);
  if (label) label.textContent = step === 1 ? 'Hallo' : 'Dein Ort';
  $('[data-onboard-skip]', overlay).hidden = step !== 1;
  $('[data-onboard-next]', overlay).hidden = step !== 1;
  $('[data-onboard-back]', overlay).hidden = step !== 2;
  if (step === 2) {
    renderOnboardingResults(true);
    requestAnimationFrame(() => $('#onboardInput', overlay)?.focus({ preventScroll: true }));
  } else {
    requestAnimationFrame(() => $('[data-onboard-next]', overlay)?.focus({ preventScroll: true }));
  }
}

function openOnboarding() {
  if (state.onboardingOpen || !needsOnboarding()) return;
  const languageOptions = [['de', 'Deutsch'], ['en', 'Englisch'], ['nl', 'Niederländisch']];
  const onboardCountries = countryOptions(state.settings.language, state.settings.country)
    .map(({ value, label, selected }) => `<option value="${value}" ${selected ? 'selected' : ''}>${escapeHTML(label)}</option>`)
    .join('');
  Object.assign(state.onboarding, {
    step: 1, items: [], places: [], index: 0,
    loading: false, error: null, generation: state.onboarding.generation + 1,
  });
  if (state.onboarding.timer) {
    clearTimeout(state.onboarding.timer);
    state.onboarding.timer = null;
  }
  const overlay = showOverlay(`<div class="modal onboarding-modal" role="dialog" aria-modal="true" aria-label="Brise einrichten">
    <div class="onboarding-top">
      <img src="./assets/logo.svg" alt="" class="onboarding-logo">
      <div class="onboarding-top-copy">
        <span class="onboarding-kicker">Willkommen bei Brise</span>
        <h1 class="onboarding-title">Dein Wetter, dein Ort.</h1>
        <p class="onboarding-subtitle">Zwei kleine Schritte, dann kann’s losgehen.</p>
      </div>
    </div>
    <div class="onboarding-progress" aria-hidden="true">
      <span class="onboard-dot is-active" data-onboard-dot="1">1</span>
      <i></i>
      <span class="onboard-dot" data-onboard-dot="2">2</span>
      <span class="onboarding-progress-label" id="onboardProgressLabel">Hallo</span>
    </div>
    <div class="onboarding-scroll">
      <section class="onboarding-step" data-onboard-step="1">
        <div class="onboard-features">
          <div class="onboard-feature">
            <span class="onboard-feature-icon">${icon('weather', 17)}</span>
            <span><strong>Wetter aus offenen Quellen</strong><small>DWD und Open-Meteo, weltweit und kostenlos ohne Anmeldung.</small></span>
          </div>
          <div class="onboard-feature">
            <span class="onboard-feature-icon">${icon('pin', 17)}</span>
            <span><strong>Jeder Ort weltweit</strong><small>Städte und Gemeinden auf der ganzen Welt lassen sich hinzufügen.</small></span>
          </div>
          <div class="onboard-feature">
            <span class="onboard-feature-icon">${icon('settings', 17)}</span>
            <span><strong>Deine Darstellung</strong><small>Wähle, wie Brise für dich aussehen soll. Akzentfarben kommen später dazu.</small></span>
          </div>
        </div>
        <div class="onboard-theme">
          <span class="onboard-label">Farbwelt</span>
          <div class="onboard-theme-options">
            ${[['night', 'Mitternacht'], ['day', 'Tageslicht'], ['dusk', 'Abendrot'], ['ocean', 'Ozean'], ['forest', 'Nordwald']]
              .map(([id, label]) => `<button type="button" class="onboard-theme-option${state.settings.theme === id ? ' is-active' : ''}" data-onboard-theme="${id}">${label}</button>`)
              .join('')}
          </div>
        </div>
        <div class="onboard-region">
          <div class="onboard-region-row"><label class="onboard-label" for="onboardLanguage">Sprache</label><select class="settings-select" id="onboardLanguage">${settingsSelectOptions(languageOptions, state.settings.language)}</select></div>
          <div class="onboard-region-row"><label class="onboard-label" for="onboardCountry">Land</label><select class="settings-select" id="onboardCountry">${onboardCountries}</select></div>
        </div>
      </section>
      <section class="onboarding-step" data-onboard-step="2" hidden>
        <label class="onboard-label" for="onboardInput">Welcher Ort ist dein Startort?</label>
        <div class="onboard-search">
          ${icon('search', 18)}
          <input id="onboardInput" type="text" placeholder="Ort suchen, zum Beispiel Tokio …" autocomplete="off" spellcheck="false">
        </div>
        <p class="onboard-hint">Weltweit – mit Open-Meteo und DWD.</p>
        <div class="onboard-results" id="onboardResults" role="listbox" aria-label="Orte"></div>
      </section>
    </div>
    <div class="onboarding-footer">
      <button type="button" class="text-button" data-onboard-skip>Später einrichten</button>
      <button type="button" class="text-button" data-onboard-back hidden>← Zurück</button>
      <span class="onboard-footer-note">Keine Anmeldung. Kein API-Schlüssel.</span>
      <button type="button" class="action-button primary" data-onboard-next>Weiter →</button>
    </div>
  </div>`, { locked: true, focusSelector: '[data-onboard-next]' });

  if (!overlay) {
    state.onboardingOpen = false;
    return;
  }

  $('[data-onboard-next]', overlay).addEventListener('click', () => onboardingSetStep(2));
  $('[data-onboard-back]', overlay).addEventListener('click', () => onboardingSetStep(1));
  $('[data-onboard-skip]', overlay).addEventListener('click', () => finishOnboarding(null));
  $$('[data-onboard-theme]', overlay).forEach((button) => {
    button.addEventListener('click', () => {
      state.settings.theme = button.dataset.onboardTheme;
      persistSettings();
      applyTheme();
      $$('[data-onboard-theme]', overlay).forEach((other) => {
        other.classList.toggle('is-active', other === button);
      });
    });
  });

  $('#onboardLanguage', overlay)?.addEventListener('change', (event) => {
    state.settings.language = event.target.value;
    persistSettings();
    applyLocaleAndRegion();
  });
  $('#onboardCountry', overlay)?.addEventListener('change', (event) => {
    state.settings.country = event.target.value;
    if (state.settings.country !== 'DE') state.settings.provider = 'open-meteo';
    persistSettings();
    applyLocaleAndRegion();
  });

  const input = $('#onboardInput', overlay);
  const results = $('#onboardResults', overlay);
  input.addEventListener('input', () => scheduleOnboardingSearch(input.value));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      onboardingSetIndex(state.onboarding.index + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      onboardingSetIndex(state.onboarding.index - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      chooseOnboardingCity(state.onboarding.index);
    }
  });
  results.addEventListener('click', (event) => {
    const item = event.target.closest('[data-onboard-item]');
    if (item) chooseOnboardingCity(Number(item.dataset.onboardItem));
  });
  onboardingSetStep(1);
}


// ---------- Radar view ----------

function radarFrameIsForecast(frame) {
  return Boolean(frame?.date && frame.date.getTime() > Date.now() + 60000);
}

function radarRangeTrack(index, total) {
  const percent = total > 1 ? (index / (total - 1)) * 100 : 100;
  return `linear-gradient(90deg, var(--accent) 0%, var(--accent) ${percent}%, rgba(125, 238, 211, 0.18) ${percent}%)`;
}

function radarShellMarkup(city) {
  const data = state.radarCityId === city.id ? state.radarData : null;
  const loading = state.radarLoading || (!data && !state.radarError);
  const error = state.radarError;
  const frameCount = data?.frames?.length || 0;
  const first = data?.frames?.[0];
  const last = data?.frames?.[frameCount - 1];
  return `<div class="radar-layout">
    <section class="card radar-main">
      <header class="card-head">
        <div class="card-heading">
          <p class="kicker">Niederschlag · ${escapeHTML(city.name)}</p>
          <h2 class="card-title">Regenradar</h2>
        </div>
        <div class="radar-toolbar">
          <button class="radar-play" id="radarPlay" type="button" aria-label="Radar abspielen" title="Wiedergabe starten oder anhalten">${icon('play', 14)}</button>
          <button class="radar-now-button" id="radarNow" type="button">${icon('locate', 11)} Jetzt</button>
          <span class="radar-frame-label">
            <strong id="radarFrameTime">–:–</strong>
            <span class="radar-frame-badge" id="radarFrameBadge">Aktuell</span>
          </span>
        </div>
      </header>
      <div class="radar-stage" id="radarStage">
        <div class="radar-canvas-wrap"><canvas id="radarCanvas" aria-label="Animiertes DWD-Regenradar über ${escapeHTML(city.name)}"></canvas></div>
        <div class="radar-marker" id="radarMarker"><span>${escapeHTML(city.name)}</span></div>
        <div class="radar-overlay-top">
          <span class="radar-live-chip" id="radarLiveChip"><i></i>DWD-Radarverbund · 5-Minuten-Komposite</span>
          <span class="radar-live-chip" id="radarFrameChip"><i></i>${frameCount ? `${frameCount} Radarbilder` : 'lädt'}</span>
        </div>
        <div class="radar-legend">
          <div class="radar-legend-label"><span>Niederschlag</span><span>mm/h</span></div>
          <div class="radar-legend-bar"></div>
          <div class="radar-legend-scale"><span>leicht</span><span>mäßig</span><span>stark</span><span>extrem</span></div>
        </div>
        <div class="radar-attribution">DWD Radarverbund · via Bright Sky</div>
        ${loading ? `<div class="radar-loading"><span class="loader-orbit"></span><span>Radarkomposite werden geladen …</span></div>` : ''}
        ${error ? `<div class="radar-error">${icon('warning', 22)}<strong>Radar ist gerade nicht erreichbar</strong><p>${escapeHTML(usefulError(error))}</p><button class="action-button" type="button" data-radar-retry>${icon('refresh', 13)} Noch mal probieren</button></div>` : ''}
      </div>
      <div class="radar-scrubber">
        <span class="radar-scrubber-time">${first ? formatTime(first.timestamp) : '–:–'}</span>
        <div class="radar-range-wrap">
          <input class="radar-range" id="radarRange" type="range" min="0" max="${Math.max(0, frameCount - 1)}" value="0" step="1" aria-label="Radarzeitpunkt wählen" ${frameCount ? '' : 'disabled'}>
        </div>
        <span class="radar-scrubber-time">${last ? formatTime(last.timestamp) : '+90 Min.'}</span>
      </div>
      <div class="radar-range-marks"><span>Beobachtung</span><span>Jetzt</span><span>Prognose</span></div>
    </section>
    <aside class="radar-side" id="radarSide">
      <article class="card rain-now-card" data-tone="dry">
        <div class="rain-now-icon">${icon('radar', 18)}</div>
        <div class="rain-now-eyebrow">Über ${escapeHTML(city.name)}</div>
        <div class="rain-now-title">Radar wird ausgewertet …</div>
        <p class="rain-now-text">Die 5-Minuten-Komposite des DWD werden geladen.</p>
      </article>
      <article class="card radar-legend-card">
        <h3 class="radar-legend-title">Was die Farben bedeuten</h3>
        ${radarLegend().map((entry) => `<div class="radar-legend-row"><span class="radar-legend-swatch" style="background:${entry.color}"></span><span>${escapeHTML(entry.label)}</span><span>${escapeHTML(entry.range)}</span></div>`).join('')}
      </article>
      <article class="card radar-source-card">
        <div class="radar-source-head"><span class="radar-source-mark">DWD</span><span>Amtliches Radar</span></div>
        <p>Radarverbund des Deutschen Wetterdienstes, alle fünf Minuten neu. Vergangene Messungen und 90-Minuten-Prognose in einer Ansicht.</p>
        <div class="radar-source-stats">
          <div class="radar-source-stat"><span>Radius</span><strong>120 km</strong></div>
          <div class="radar-source-stat"><span>Radarbilder</span><strong>${frameCount || '–'}</strong></div>
          <div class="radar-source-stat"><span>Aktualisierung</span><strong>5 Min.</strong></div>
        </div>
      </article>
    </aside>
  </div>`;
}

function renderRadarSide(renderer) {
  const side = $('#radarSide');
  if (!side || !renderer) return;
  const summary = renderer.summarize();
  const points = summary.points || [];
  const maxValue = points.reduce((max, point) => Math.max(max, point.value), 0) || 1;
  const bars = points
    .map((point) => {
      const height = Math.max(2, Math.round((point.value / maxValue) * 100));
      const strong = point.value >= 6;
      const classes = ['rain-timeline-bar', point.forecast ? 'is-forecast' : '', strong ? 'is-strong' : ''].filter(Boolean).join(' ');
      return `<span class="${classes}" style="height:${height}%" title="${formatTime(point.time)} · ${point.forecast ? 'Prognose' : 'Messung'}"></span>`;
    })
    .join('');
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const iconName = summary.tone === 'rain' ? 'umbrella' : summary.tone === 'incoming' ? 'cloud' : 'sun';
  side.innerHTML = `<article class="card rain-now-card" data-tone="${escapeHTML(summary.tone)}">
      <div class="rain-now-icon">${icon(iconName, 18)}</div>
      <div class="rain-now-eyebrow">Über ${escapeHTML(renderer.city?.name || currentCity().name)}</div>
      <div class="rain-now-title">${escapeHTML(summary.headline)}</div>
      <p class="rain-now-text">${escapeHTML(summary.text)}</p>
      <div class="rain-timeline" aria-hidden="true">${bars}</div>
      <div class="rain-timeline-labels"><span>${firstPoint ? formatTime(firstPoint.time) : '–:–'}</span><span>Jetzt</span><span>${lastPoint ? formatTime(lastPoint.time) : '+90 Min.'}</span></div>
    </article>
    <article class="card radar-legend-card">
      <h3 class="radar-legend-title">Was die Farben bedeuten</h3>
      ${radarLegend().map((entry) => `<div class="radar-legend-row"><span class="radar-legend-swatch" style="background:${entry.color}"></span><span>${escapeHTML(entry.label)}</span><span>${escapeHTML(entry.range)}</span></div>`).join('')}
    </article>
    <article class="card radar-source-card">
      <div class="radar-source-head"><span class="radar-source-mark">DWD</span><span>Amtliches Radar</span></div>
      <p>Radarverbund des Deutschen Wetterdienstes, alle fünf Minuten neu. Vergangene Messungen und 90-Minuten-Prognose in einer Ansicht.</p>
      <div class="radar-source-stats">
        <div class="radar-source-stat"><span>Radius</span><strong>120 km</strong></div>
        <div class="radar-source-stat"><span>Radarbilder</span><strong>${renderer.frames.length}</strong></div>
        <div class="radar-source-stat"><span>Max. Intensität</span><strong>${escapeHTML(summary.intensity)}</strong></div>
      </div>
    </article>`;
}

function updateRadarFrameUI(frame, index) {
  const renderer = state.radarRenderer;
  if (!renderer) return;
  state.radarFrameIndex = index;
  const forecast = radarFrameIsForecast(frame);
  const timeEl = $('#radarFrameTime');
  const badge = $('#radarFrameBadge');
  const chip = $('#radarFrameChip');
  const liveChip = $('#radarLiveChip');
  if (timeEl) timeEl.textContent = `${formatTime(frame?.date)} Uhr`;
  if (badge) {
    badge.textContent = forecast ? 'Prognose' : 'Live';
    badge.classList.toggle('is-forecast', forecast);
  }
  if (chip) {
    chip.innerHTML = `<i></i>${forecast ? 'Vorhersage' : 'Messung'} · ${index + 1}/${renderer.frames.length}`;
    chip.classList.toggle('is-forecast', forecast);
  }
  if (liveChip) liveChip.classList.toggle('is-forecast', forecast);
  const range = $('#radarRange');
  if (range) {
    range.value = String(index);
    range.style.setProperty('--range-track', radarRangeTrack(index, renderer.frames.length));
  }
  const play = $('#radarPlay');
  if (play) {
    play.innerHTML = icon(renderer.playing ? 'pause' : 'play', 14);
    play.setAttribute('aria-label', renderer.playing ? 'Radar pausieren' : 'Radar abspielen');
  }
}

function mountRadarRenderer(city) {
  const canvas = $('#radarCanvas');
  const marker = $('#radarMarker');
  if (!canvas || !state.radarData || state.radarCityId !== city.id) return;
  state.radarRenderer?.destroy();
  const renderer = new RadarRenderer(canvas, {
    marker,
    onFrame: updateRadarFrameUI,
  });
  state.radarRenderer = renderer;
  try {
    renderer.setData(state.radarData, city);
  } catch (error) {
    renderer.destroy();
    state.radarRenderer = null;
    state.radarData = null;
    state.radarCityId = null;
    state.radarError = usefulError(error);
    state.radarStatus = 'error';
    renderRadarView();
    setLiveState('error', 'Radar nicht lesbar');
    return;
  }
  state.radarFrameIndex = renderer.index;
  renderRadarSide(renderer);
  updateRadarFrameUI(renderer.frames[renderer.index], renderer.index);
  if (renderer.frames.length > 1) renderer.play();
  window.setTimeout(() => {
    if (state.radarRenderer === renderer) {
      renderer.resize(true);
      updateRadarFrameUI(renderer.frames[renderer.index], renderer.index);
    }
  }, 90);
}

function renderRadarView() {
  const container = $('#radarContent');
  if (!container) return;
  state.radarRenderer?.destroy();
  state.radarRenderer = null;
  if (state.settings.country !== 'DE' || state.settings.provider !== 'dwd') {
    container.innerHTML = `<div class="radar-error">${icon('mapPinned', 22)}<strong>Radar nur für Deutschland</strong><p>Der Regenradar kommt vom DWD und ist nur für Deutschland verfügbar – auch wenn du für Deutschland Open-Meteo gewählt hast.</p></div>`;
    state.radarData = null;
    return;
  }
  const city = currentCity();
  container.innerHTML = radarShellMarkup(city);
  if (state.radarData && state.radarCityId === city.id) {
    requestAnimationFrame(() => mountRadarRenderer(city));
  }
}

async function loadRadar(force = false) {
  if (state.settings.country !== 'DE' || state.settings.provider !== 'dwd') {
    state.radarLoading = false;
    renderRadarView();
    return;
  }
  const city = currentCity();
  const cityChanged = state.radarCityId !== city.id;
  if (state.radarLoading && !cityChanged) return;
  const seq = ++state.radarSeq;
  state.radarLoading = true;
  state.radarError = null;
  const cacheValid = state.radarData && !cityChanged && Date.now() - state.radarFetchedAt < 4 * 60 * 1000;
  if (cacheValid && !force) {
    state.radarLoading = false;
    renderRadarView();
    return;
  }
  if (cityChanged) {
    state.radarData = null;
    state.radarCityId = null;
  }
  renderRadarView();
  setPageLive(false);
  try {
    const data = await fetchRadar(city);
    if (seq !== state.radarSeq) return;
    state.radarData = data;
    state.radarCityId = city.id;
    state.radarFetchedAt = Date.now();
    state.radarError = null;
    state.radarStatus = 'ready';
    renderRadarView();
    if (data?.stale) setLiveState('stale', 'Offline-Radar');
  } catch (error) {
    if (seq !== state.radarSeq) return;
    state.radarError = usefulError(error);
    state.radarStatus = 'error';
    renderRadarView();
    setLiveState('error', 'Radar ist gerade nicht erreichbar');
    console.warn('Brise: Radar konnte nicht geladen werden', error);
  } finally {
    if (seq === state.radarSeq) state.radarLoading = false;
  }
}


// ---------- Germany map ----------

const GERMANY_VIEW = { width: 620, height: 760, padding: 24 };

const GERMANY_METRICS = {
  temp: {
    label: 'Temperatur',
    short: 'Temperatur',
    icon: 'thermometer',
    unit: '°C',
    scale: [[-12, '#4576b8'], [-4, '#4f96cc'], [3, '#69c7c1'], [10, '#a9ddab'], [17, '#e7d486'], [24, '#eda36a'], [32, '#e36b5e']],
    raw: (weather) => weather?.temperature,
    display: (value) => ({ value: String(Math.round(tempValue(value, state.settings.tempUnit))), unit: state.settings.tempUnit === 'f' ? '°F' : '°C' }),
    mapValue: (value) => `${Math.round(tempValue(value, state.settings.tempUnit))}°`,
  },
  wind: {
    label: 'Wind',
    short: 'Wind',
    icon: 'wind',
    unit: 'km/h',
    scale: [[0, '#5a94bd'], [10, '#7fd8c3'], [20, '#a9ddab'], [32, '#e4d17f'], [45, '#eda36a'], [65, '#e36b5e']],
    raw: (weather) => weather?.wind_speed_10,
    display: (value) => ({ value: String(Math.round(windValue(value, state.settings.windUnit))), unit: windLabel(state.settings.windUnit) }),
    mapValue: (value) => `${Math.round(windValue(value, state.settings.windUnit))}`,
  },
  sun: {
    label: 'Sonne',
    short: 'Sonnenschein',
    icon: 'sun',
    unit: 'Min.',
    scale: [[0, '#5b6b7d'], [8, '#7199a9'], [18, '#a9c99a'], [32, '#e4d17f'], [46, '#ffca73'], [60, '#ffb35c']],
    raw: (weather) => weather?.sunshine_60,
    display: (value) => ({ value: String(Math.round(value)), unit: 'Min.' }),
    mapValue: (value) => `${Math.round(value)}`,
  },
};

const MAP_BUBBLE_OFFSETS = {
  duesseldorf: [-17, -9],
  koeln: [13, 12],
  dortmund: [11, -14],
  mainz: [13, 14],
  frankfurt: [-9, 11],
  saarbruecken: [-8, 11],
  freiburg: [-9, 11],
  hannover: [10, -10],
  magdeburg: [11, -9],
  nuernberg: [10, 10],
  stuttgart: [-10, 10],
  muenchen: [10, -8],
};

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  const int = Number.parseInt(value, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function interpolateColor(from, to, t) {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const mix = a.map((channel, index) => Math.round(channel + (b[index] - channel) * t));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

function metricColor(metricKey, value) {
  const metric = GERMANY_METRICS[metricKey] || GERMANY_METRICS.temp;
  if (!finite(value)) return 'rgba(108, 132, 140, 0.55)';
  const stops = metric.scale;
  if (value <= stops[0][0]) return stops[0][1];
  if (value >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];
  for (let i = 0; i < stops.length - 1; i += 1) {
    const [lowValue, lowColor] = stops[i];
    const [highValue, highColor] = stops[i + 1];
    if (value >= lowValue && value <= highValue) {
      return interpolateColor(lowColor, highColor, (value - lowValue) / (highValue - lowValue));
    }
  }
  return stops[0][1];
}

function germanyProjection() {
  const [minLon, minLat, maxLon, maxLat] = GERMANY_GEO.bounds;
  const { width, height, padding } = GERMANY_VIEW;
  const midLat = (minLat + maxLat) / 2;
  const cosLat = Math.cos((midLat * Math.PI) / 180);
  const lonSpan = (maxLon - minLon) * cosLat;
  const latSpan = maxLat - minLat;
  const scale = Math.min((width - padding * 2) / lonSpan, (height - padding * 2) / latSpan);
  const mapWidth = lonSpan * scale;
  const mapHeight = latSpan * scale;
  const originX = (width - mapWidth) / 2;
  const originY = (height - mapHeight) / 2;
  return (lon, lat) => [
    originX + (lon - minLon) * cosLat * scale,
    originY + (maxLat - lat) * scale,
  ];
}

function pathFromRings(rings, project) {
  return rings
    .map((ring) => ring.map(([lon, lat], index) => {
      const [x, y] = project(lon, lat);
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ') + ' Z')
    .join(' ');
}

function mapCityWeather(cityId) {
  return summaryWeather(cityId);
}

function mapCityMetricValue(cityId, metricKey) {
  const metric = GERMANY_METRICS[metricKey] || GERMANY_METRICS.temp;
  const weather = mapCityWeather(cityId);
  return finite(metric.raw(weather)) ? metric.raw(weather) : null;
}

function sortedMapCities(metricKey) {
  const metric = GERMANY_METRICS[metricKey] || GERMANY_METRICS.temp;
  return MAP_CITY_IDS
    .map((id) => CITY_BY_ID[id])
    .filter(Boolean)
    .map((city) => ({ city, value: mapCityMetricValue(city.id, metricKey) }))
    .sort((a, b) => {
      if (a.value === null && b.value === null) return a.city.name.localeCompare(b.city.name, 'de');
      if (a.value === null) return 1;
      if (b.value === null) return -1;
      return b.value - a.value;
    });
}

function mapLegendLabels(metricKey) {
  if (metricKey === 'wind') {
    const a = Math.round(windValue(0, state.settings.windUnit));
    const b = Math.round(windValue(65, state.settings.windUnit));
    return [`${a} ${windLabel(state.settings.windUnit)}`, `${b} ${windLabel(state.settings.windUnit)}`];
  }
  if (metricKey === 'sun') return ['0 Min.', '60 Min.'];
  return [formatTemp(-10, state.settings.tempUnit), formatTemp(32, state.settings.tempUnit)];
}

function germanyMapMarkup() {
  const metricKey = state.germanyMetric;
  const metric = GERMANY_METRICS[metricKey];
  const project = germanyProjection();
  const [haloX, haloY] = project(10.4, 51.2);
  const statePaths = GERMANY_GEO.states
    .map((stateGeo) => `<path class="geo-state" d="${pathFromRings(stateGeo.rings, project)}" />`)
    .join('');
  const outline = pathFromRings(GERMANY_GEO.outline, project);

  const cityMarkup = MAP_CITY_IDS.map((id) => {
    const city = CITY_BY_ID[id];
    if (!city) return '';
    const [x, y] = project(city.lon, city.lat);
    const [dx, dy] = MAP_BUBBLE_OFFSETS[id] || [0, 0];
    const weather = mapCityWeather(id);
    const rawValue = mapCityMetricValue(id, metricKey);
    const color = metricColor(metricKey, rawValue);
    const display = finite(rawValue) ? metric.mapValue(rawValue) : '–';
    const unit = metricKey === 'wind' ? windLabel(state.settings.windUnit) : metricKey === 'sun' ? 'min' : '';
    const favorite = isFavorite(id);
    const label = weather ? `${city.name}: ${summaryLabel(city, weather)}` : `${city.name}: keine Daten`;
    const leader = dx || dy ? `<line class="city-leader" x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + dx).toFixed(1)}" y2="${(y + dy).toFixed(1)}" />` : '';
    return `<g class="map-city${favorite ? ' is-favorite' : ''}" data-map-city="${id}" tabindex="0" role="button" aria-label="${escapeHTML(label)}">
      <circle class="city-halo" cx="${(x + dx).toFixed(1)}" cy="${(y + dy).toFixed(1)}" r="19" />
      ${leader}
      <circle class="city-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.1" />
      <circle class="city-bubble" cx="${(x + dx).toFixed(1)}" cy="${(y + dy).toFixed(1)}" r="14.5" fill="${color}" />
      <text class="city-value" x="${(x + dx).toFixed(1)}" y="${(y + dy - (unit ? 2 : 0)).toFixed(1)}">${escapeHTML(display)}</text>
      ${unit ? `<text class="city-unit" x="${(x + dx).toFixed(1)}" y="${(y + dy + 7.5).toFixed(1)}">${escapeHTML(unit)}</text>` : ''}
      <text class="city-label" x="${(x + dx).toFixed(1)}" y="${(y + dy + 25).toFixed(1)}">${favorite ? '★ ' : ''}${escapeHTML(city.name)}</text>
    </g>`;
  }).join('');

  return `<div class="germany-map-wrap">
    <svg class="germany-map-svg" viewBox="0 0 ${GERMANY_VIEW.width} ${GERMANY_VIEW.height}" role="img" aria-label="Deutschlandkarte mit aktuellen Werten für ${MAP_CITY_IDS.length} Städte">
      <defs>
        <radialGradient id="germanyFill" cx="48%" cy="34%" r="72%">
          <stop offset="0" stop-color="#102b33" />
          <stop offset="0.55" stop-color="#0c2029" />
          <stop offset="1" stop-color="#091922" />
        </radialGradient>
        <radialGradient id="germanyFillDay" cx="48%" cy="34%" r="72%">
          <stop offset="0" stop-color="#eaf5ef" />
          <stop offset="1" stop-color="#d9ebe5" />
        </radialGradient>
        <radialGradient id="germanyGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stop-color="rgba(90, 190, 175, 0.16)" />
          <stop offset="1" stop-color="rgba(90, 190, 175, 0)" />
        </radialGradient>
      </defs>
      <circle cx="${haloX.toFixed(1)}" cy="${haloY.toFixed(1)}" r="260" fill="url(#germanyGlow)" />
      <path class="geo-glow" d="${outline}" />
      <path class="geo-outline" d="${outline}" />
      ${statePaths}
      ${cityMarkup}
    </svg>
    <div class="map-tooltip" id="mapTooltip" hidden></div>
    ${state.germanyLoading && !MAP_CITY_IDS.some((id) => state.summaries.has(id)) ? `<div class="map-loading"><span class="loader-orbit"></span><span>Aktuelle Werte aus ${MAP_CITY_IDS.length} Städten werden geladen …</span></div>` : ''}
    ${state.germanyError && !MAP_CITY_IDS.some((id) => state.summaries.has(id)) ? `<div class="map-loading" style="flex-direction:column;gap:9px;text-align:center"><strong style="color:var(--text-2);font-size:12px">Karte läuft gerade nicht</strong><span style="max-width:330px">${escapeHTML(usefulError(state.germanyError))}</span><button class="action-button" type="button" data-germany-retry>${icon('refresh', 13)} Noch mal probieren</button></div>` : ''}
  </div>`;
}

function germanyRankingMarkup() {
  const metricKey = state.germanyMetric;
  const metric = GERMANY_METRICS[metricKey];
  const rows = sortedMapCities(metricKey).map(({ city, value }, index) => {
    const weather = mapCityWeather(city.id);
    const display = finite(value) ? metric.display(value) : { value: '–', unit: '' };
    const weatherLabel = weather ? summaryLabel(city, weather) : 'Keine Daten';
    const otherTemp = metricKey !== 'temp' && finite(weather?.temperature) ? formatTemp(weather.temperature, state.settings.tempUnit) : '';
    return `<button class="ranking-row${city.id === state.selectedCityId ? ' is-active' : ''}" type="button" data-rank-city="${city.id}" aria-label="${escapeHTML(city.name)}: ${escapeHTML(display.value)} ${escapeHTML(display.unit)}">
      <span class="rank-number">${index + 1}</span>
      <span class="rank-main">
        <span class="rank-name">${isFavorite(city.id) ? icon('starFilled', 9) : ''}${escapeHTML(city.name)}</span>
        <span class="rank-state">${escapeHTML(city.state)}</span>
      </span>
      <span class="rank-value-wrap">
        <span class="rank-value">${escapeHTML(display.value)}<span class="rank-unit">${escapeHTML(display.unit)}</span></span>
        <span class="rank-weather">${weather ? weatherIcon(summaryIconName(city, weather)) : ''}${escapeHTML(otherTemp || weatherLabel)}</span>
      </span>
    </button>`;
  }).join('');
  const title = metricKey === 'temp' ? 'Wärmste Städte' : metricKey === 'wind' ? 'Windigste Städte' : 'Sonnigste Städte';
  return `<aside class="card ranking-card">
    <header class="card-head">
      <div class="card-heading">
        <p class="kicker">Rangliste · ${escapeHTML(metric.short)}</p>
        <h3 class="card-title">${title}</h3>
      </div>
      <span class="pill pill-muted">${MAP_CITY_IDS.length} Städte</span>
    </header>
    <div class="ranking-list">${rows}</div>
    <div class="ranking-foot"><span>${icon('shield', 11)} Frische Werte vom DWD</span><span>${formatTime(state.germanyLoadedAt || Date.now())} Uhr</span></div>
  </aside>`;
}

function germanyHighlightsMarkup() {
  const cities = MAP_CITY_IDS.map((id) => CITY_BY_ID[id]).filter(Boolean);
  const withWeather = cities.filter((city) => mapCityWeather(city.id));
  if (!withWeather.length) return '';
  const tempOf = (city) => mapCityWeather(city.id)?.temperature;
  const windOf = (city) => mapCityWeather(city.id)?.wind_speed_10;
  const sunOf = (city) => mapCityWeather(city.id)?.sunshine_60;
  const pick = (fn, mode) => withWeather.filter((city) => finite(fn(city))).sort((a, b) => mode === 'max' ? fn(b) - fn(a) : fn(a) - fn(b))[0] || null;
  const warmest = pick(tempOf, 'max');
  const coldest = pick(tempOf, 'min');
  const windiest = pick(windOf, 'max');
  const sunniest = pick(sunOf, 'max');
  const cards = [];
  if (warmest) cards.push({ tone: 'warm', icon: 'sun', label: 'Wärmster Ort', value: formatTemp(tempOf(warmest), state.settings.tempUnit), unit: '', sub: `${warmest.name} · ${warmest.state}` });
  if (coldest) cards.push({ tone: 'cool', icon: 'thermometer', label: 'Kältester Ort', value: formatTemp(tempOf(coldest), state.settings.tempUnit), unit: '', sub: `${coldest.name} · ${coldest.state}` });
  if (windiest) cards.push({ tone: 'wind', icon: 'wind', label: 'Stärkster Wind', value: formatWind(windOf(windiest), state.settings.windUnit, 0), unit: '', sub: `${windiest.name} · ${windiest.state}` });
  if (sunniest) cards.push({ tone: 'sun', icon: 'sun', label: 'Meiste Sonne', value: `${Math.round(sunOf(sunniest))}`, unit: 'Min.', sub: `${sunniest.name} · ${sunniest.state}` });
  return `<div class="germany-highlights">${cards.map((card) => `<article class="card highlight-card" data-tone="${card.tone}">
    <div class="highlight-head">${icon(card.icon, 12)} ${escapeHTML(card.label)}</div>
    <div class="highlight-value">${escapeHTML(card.value)}${card.unit ? `<small>${escapeHTML(card.unit)}</small>` : ''}</div>
    <div class="highlight-sub">${escapeHTML(card.sub)}</div>
  </article>`).join('')}</div>`;
}

function renderGermanyView() {
  const container = $('#germanyContent');
  if (!container) return;
  const metricKey = state.germanyMetric;
  const metric = GERMANY_METRICS[metricKey];
  const loaded = MAP_CITY_IDS.filter((id) => mapCityWeather(id)).length;
  const updatedAt = state.germanyLoadedAt || Math.max(0, ...MAP_CITY_IDS.map((id) => (summaryFor(id)?.fetched_at || 0) * 1000));
  const [legendLow, legendHigh] = mapLegendLabels(metricKey);
  const metricButtons = Object.entries(GERMANY_METRICS).map(([key, entry]) => `<button type="button" data-germany-metric="${key}" class="${key === metricKey ? 'is-active' : ''}">${escapeHTML(entry.label)}</button>`).join('');

  container.innerHTML = `<div class="germany-layout">
    <section class="card germany-map-card">
      <header class="card-head">
        <div class="card-heading">
          <p class="kicker">Deutschland · aktuell</p>
          <h2 class="card-title">Wetterkarte</h2>
        </div>
        <div class="radar-toolbar">
          <div class="segmented" role="group" aria-label="Kartenwert wählen">${metricButtons}</div>
          <span class="map-meta"><i></i>${loaded}/${MAP_CITY_IDS.length} Stationen · ${updatedAt ? `${formatTime(updatedAt)} Uhr` : 'lädt'}</span>
          <button class="icon-button refresh-button ${state.germanyLoading ? 'is-loading' : ''}" type="button" data-germany-refresh aria-label="Deutschlandkarte aktualisieren" title="Deutschlandkarte aktualisieren">${icon('refresh', 14)}</button>
        </div>
      </header>
      ${germanyMapMarkup()}
      <div class="map-legend">
        <div class="map-legend-range"></div>
        <div class="map-legend-copy"><span>${escapeHTML(metric.label)}</span><strong>${escapeHTML(legendLow)} — ${escapeHTML(legendHigh)}</strong></div>
        <span class="map-legend-hint">Stadt anklicken für das komplette Wetter</span>
      </div>
    </section>
    ${germanyRankingMarkup()}
  </div>
  ${germanyHighlightsMarkup()}`;
}

async function loadGermany(force = false) {
  const cities = MAP_CITY_IDS.map((id) => CITY_BY_ID[id]).filter(Boolean);
  if (!cities.length || state.germanyLoading) return;
  const fresh = Date.now() - state.germanyLoadedAt < 8 * 60 * 1000 && cities.every((city) => mapCityWeather(city.id));
  if (!force && fresh) {
    renderGermanyView();
    return;
  }
  state.germanyLoading = true;
  state.germanyError = null;
  renderGermanyView();
  try {
    const results = await fetchSummaries(cities, force);
    applySummaries(results);
    state.germanyLoadedAt = Date.now();
    state.germanyError = null;
  } catch (error) {
    state.germanyError = usefulError(error);
    console.warn('Brise: Deutschlandkarte konnte nicht geladen werden', error);
    if (!MAP_CITY_IDS.some((id) => mapCityWeather(id))) {
      setLiveState('error', 'Wetter nicht erreichbar');
    } else {
      showToast('Die Karte zeigt den zuletzt geladenen Stand.', { tone: 'warn', icon: 'cloud' });
    }
  } finally {
    state.germanyLoading = false;
    renderGermanyView();
    if (state.view === 'germany') setPageLive(Boolean(state.germanyError));
  }
}

function updateMapMetric(metricKey) {
  if (!GERMANY_METRICS[metricKey] || state.germanyMetric === metricKey) return;
  state.germanyMetric = metricKey;
  renderGermanyView();
}

function showMapTooltip(cityId, x, y) {
  const wrap = $('.germany-map-wrap');
  const tooltip = $('#mapTooltip');
  const city = CITY_BY_ID[cityId];
  if (!wrap || !tooltip || !city) return;
  const weather = mapCityWeather(cityId);
  const rect = wrap.getBoundingClientRect();
  const left = clamp(x - rect.left, 92, rect.width - 92);
  const rawTop = y - rect.top;
  const below = rawTop < 118;
  const top = below
    ? clamp(rawTop, 8, rect.height - 8)
    : clamp(rawTop, 118, rect.height - 20);
  const temp = weather ? formatTemp(weather.temperature, state.settings.tempUnit) : '–';
  const condition = weather ? summaryLabel(city, weather) : 'Keine Daten';
  const wind = weather ? formatWind(weather.wind_speed_10, state.settings.windUnit, 0) : null;
  tooltip.innerHTML = `<div class="map-tooltip-title">${escapeHTML(city.name)} <span>${escapeHTML(city.state)}</span></div>
    <div class="map-tooltip-value">${escapeHTML(temp)} <small>${escapeHTML(condition)}</small></div>
    <div class="map-tooltip-meta">${weather ? weatherIcon(summaryIconName(city, weather)) : ''}${wind ? `${icon('wind', 9)} ${escapeHTML(wind)}` : 'Noch keine Werte da'}</div>`;
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  tooltip.classList.toggle('is-below', below);
  tooltip.hidden = false;
}

function hideMapTooltip() {
  const tooltip = $('#mapTooltip');
  if (tooltip) tooltip.hidden = true;
}


// ---------- Navigation, refresh and app shell ----------

function renderCurrentView() {
  if (state.view === 'weather') {
    const city = currentCity();
    if (state.weather.has(city.id)) renderWeather();
    else renderWeatherLoading(city);
  } else if (state.view === 'radar') {
    renderRadarView();
  } else if (state.view === 'germany') {
    renderGermanyView();
  }
}

function switchView(view, options = {}) {
  if (!VIEW_IDS.has(view)) return;
  const changed = state.view !== view;
  if (changed && state.view === 'radar' && view !== 'radar') {
    state.radarRenderer?.destroy();
    state.radarRenderer = null;
  }
  state.view = view;
  $$('.nav-item').forEach((button) => {
    const active = button.dataset.viewTarget === view;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  $$('.view').forEach((section) => {
    const active = section.dataset.view === view;
    section.hidden = !active;
    section.classList.toggle('is-active', active);
    if (active && changed && !options.silent) {
      section.classList.remove('view-enter');
      void section.offsetWidth;
      section.classList.add('view-enter');
    }
  });

  const main = $('#main');
  if (main && changed) main.scrollTop = 0;

  if (view === 'weather') {
    const city = currentCity();
    if (!state.weather.has(city.id) && !state.weatherLoading.has(city.id)) {
      renderWeatherLoading(city);
      loadWeather(city.id);
    } else if (state.weather.has(city.id)) {
      renderWeather();
    }
    const entry = state.weather.get(city.id);
    setPageLive(Boolean(entry?.bundle?.stale) || state.offline.has(city.id));
  } else if (view === 'radar') {
    const city = currentCity();
    const needsLoad = state.radarCityId !== city.id || !state.radarData || Date.now() - state.radarFetchedAt > 4 * 60 * 1000;
    if (needsLoad) loadRadar();
    else {
      renderRadarView();
      setPageLive(false);
    }
  } else if (view === 'germany') {
    const needsLoad = !state.germanyLoadedAt || Date.now() - state.germanyLoadedAt > 8 * 60 * 1000;
    if (needsLoad && !state.germanyLoading) loadGermany();
    else renderGermanyView();
  }
}

function selectCity(cityId, options = {}) {
  const city = CITY_BY_ID[cityId];
  if (!city) return;
  const changed = state.selectedCityId !== cityId;
  state.selectedCityId = cityId;
  persistSelectedCity();
  renderFavorites();
  if (options.navigate !== false) {
    if (state.view === 'weather' && changed) {
      const existing = state.weather.get(cityId);
      if (existing) {
        // Frische Daten werden nicht noch einmal vom Server geholt. Das verhindert
        // beim Wechsel zwischen Favoriten Ladebalken und kurzes Hängen.
        const minutes = Number(state.settings.refreshMinutes);
        const maxAge = (minutes > 0 ? minutes : 10) * 60 * 1000;
        const fresh = Date.now() - existing.at < maxAge && !state.offline.has(cityId);
        suppressWeatherAnimations();
        renderWeather();
        setPageLive(Boolean(existing.bundle?.stale) || state.offline.has(cityId));
        if (!fresh) loadWeather(cityId);
      } else {
        renderWeatherLoading(city);
        loadWeather(cityId);
      }
    } else {
      switchView('weather');
    }
  }
}

function rerenderForSettings() {
  renderCurrentView();
}

function refreshAllData() {
  const city = currentCity();
  loadWeather(city.id, { force: true });
  loadFavoriteSummaries(true);
  if (state.view === 'radar') loadRadar(true);
  if (state.view === 'germany') loadGermany(true);
}

function scheduleRefresh() {
  if (state.refreshTimer) {
    window.clearInterval(state.refreshTimer);
    state.refreshTimer = null;
  }
  const minutes = Number(state.settings.refreshMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return;
  state.refreshTimer = window.setInterval(() => {
    if (document.hidden) return;
    const city = currentCity();
    loadWeather(city.id, { force: true, quiet: true });
    loadFavoriteSummaries(true);
    if (state.view === 'radar') loadRadar(true);
    if (state.view === 'germany') loadGermany(true);
  }, minutes * 60 * 1000);
}

async function tauriWindow() {
  const tauri = window.__TAURI__;
  const api = tauri?.window;
  if (!api?.getCurrentWindow) return null;
  try {
    return api.getCurrentWindow();
  } catch {
    return null;
  }
}

async function updateMaximizeIcon() {
  const button = $('#windowMaximize');
  if (!button) return;
  const win = await tauriWindow();
  if (!win) return;
  try {
    const maximized = await win.isMaximized();
    button.innerHTML = icon(maximized ? 'maximizeRestore' : 'maximize', 12);
    button.setAttribute('aria-label', maximized ? 'Wiederherstellen' : 'Maximieren');
    button.title = maximized ? 'Wiederherstellen' : 'Maximieren';
  } catch {
    // Window API unavailable; keep the default icon.
  }
}

async function windowAction(action) {
  const win = await tauriWindow();
  if (!win) return;
  try {
    if (action === 'minimize') await win.minimize();
    else if (action === 'maximize') {
      await win.toggleMaximize();
      window.setTimeout(updateMaximizeIcon, 120);
    } else if (action === 'close') await win.close();
  } catch (error) {
    console.warn('Brise: Fensteraktion fehlgeschlagen', error);
  }
}

function injectStaticIcons() {
  $$('[data-ui-icon]').forEach((node) => {
    const name = node.dataset.uiIcon;
    if (name) node.innerHTML = icon(name, 16);
  });
}

function handleWeatherClick(event) {
  const favorite = event.target.closest('[data-toggle-favorite]');
  if (favorite) {
    toggleFavorite(favorite.dataset.toggleFavorite);
    return;
  }
  if (event.target.closest('[data-open-alerts]')) {
    openAlertsModal();
    return;
  }
  if (event.target.closest('[data-open-radar]')) {
    switchView('radar');
    return;
  }
  if (event.target.closest('[data-refresh-weather]')) {
    loadWeather(currentCity().id, { force: true });
    return;
  }
  if (event.target.closest('[data-retry-weather]')) {
    loadWeather(currentCity().id, { force: true });
    return;
  }
  const range = event.target.closest('[data-range]');
  if (range) {
    state.trendRange = range.dataset.range;
    renderWeather();
    return;
  }
  const day = event.target.closest('[data-day-key]');
  if (day) openDayModal(day.dataset.dayKey);
}

function handleRadarClick(event) {
  const renderer = state.radarRenderer;
  if (event.target.closest('[data-radar-retry]')) {
    loadRadar(true);
    return;
  }
  if (event.target.closest('#radarPlay') && renderer) {
    renderer.toggle();
    const frame = renderer.frames[renderer.index];
    if (frame) updateRadarFrameUI(frame, renderer.index);
    return;
  }
  if (event.target.closest('#radarNow') && renderer) {
    renderer.pause();
    renderer.setFrame(renderer.findLiveIndex());
    const frame = renderer.frames[renderer.index];
    if (frame) updateRadarFrameUI(frame, renderer.index);
  }
}

function handleGermanyClick(event) {
  const metric = event.target.closest('[data-germany-metric]');
  if (metric) {
    updateMapMetric(metric.dataset.germanyMetric);
    return;
  }
  if (event.target.closest('[data-germany-refresh]') || event.target.closest('[data-germany-retry]')) {
    loadGermany(true);
    return;
  }
  const rankCity = event.target.closest('[data-rank-city]');
  if (rankCity) {
    selectCity(rankCity.dataset.rankCity);
    return;
  }
  const mapCity = event.target.closest('[data-map-city]');
  if (mapCity) selectCity(mapCity.dataset.mapCity);
}

function bindEvents() {
  $$('.nav-item').forEach((button) => {
    button.addEventListener('click', () => switchView(button.dataset.viewTarget));
  });

  $('#openSearch')?.addEventListener('click', () => openSearch());
  $('#sidebarSearch')?.addEventListener('click', () => openSearch());
  $('#openSettings')?.addEventListener('click', () => openSettingsModal());
  $('#openAbout')?.addEventListener('click', () => openAboutModal());
  $('#discoverGermany')?.addEventListener('click', () => switchView('germany'));

  $('#windowMinimize')?.addEventListener('click', () => windowAction('minimize'));
  $('#windowMaximize')?.addEventListener('click', () => windowAction('maximize'));
  $('#windowClose')?.addEventListener('click', () => windowAction('close'));

  const favorites = $('#favoritesList');
  favorites?.addEventListener('click', (event) => {
    const remove = event.target.closest('[data-remove-favorite]');
    if (remove) {
      event.stopPropagation();
      removeFavorite(remove.dataset.removeFavorite);
      return;
    }
    const row = event.target.closest('[data-favorite-city]');
    if (row) selectCity(row.dataset.favoriteCity);
  });
  favorites?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.target.closest('[data-remove-favorite]') || event.target.tagName === 'BUTTON') return;
    const row = event.target.closest('[data-favorite-city]');
    if (!row) return;
    event.preventDefault();
    selectCity(row.dataset.favoriteCity);
  });

  $('#weatherContent')?.addEventListener('click', handleWeatherClick);
  $('#radarContent')?.addEventListener('click', handleRadarClick);
  $('#radarContent')?.addEventListener('input', (event) => {
    if (event.target.id !== 'radarRange') return;
    const renderer = state.radarRenderer;
    if (!renderer) return;
    renderer.pause();
    renderer.setFrame(Number(event.target.value));
  });
  $('#germanyContent')?.addEventListener('click', handleGermanyClick);

  $('#germanyContent')?.addEventListener('pointerover', (event) => {
    const cityGroup = event.target.closest('[data-map-city]');
    if (!cityGroup) return;
    showMapTooltip(cityGroup.dataset.mapCity, event.clientX, event.clientY);
  });
  $('#germanyContent')?.addEventListener('pointermove', (event) => {
    const cityGroup = event.target.closest('[data-map-city]');
    if (!cityGroup) return;
    showMapTooltip(cityGroup.dataset.mapCity, event.clientX, event.clientY);
  });
  $('#germanyContent')?.addEventListener('pointerout', (event) => {
    const cityGroup = event.target.closest('[data-map-city]');
    if (!cityGroup) return;
    if (event.relatedTarget && cityGroup.contains(event.relatedTarget)) return;
    hideMapTooltip();
  });
  $('#germanyContent')?.addEventListener('focusin', (event) => {
    const cityGroup = event.target.closest('[data-map-city]');
    if (!cityGroup) return;
    const rect = cityGroup.getBoundingClientRect();
    showMapTooltip(cityGroup.dataset.mapCity, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });
  $('#germanyContent')?.addEventListener('focusout', (event) => {
    if (event.target.closest('[data-map-city]')) hideMapTooltip();
  });
  $('#germanyContent')?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const cityGroup = event.target.closest('[data-map-city]');
    if (!cityGroup) return;
    event.preventDefault();
    selectCity(cityGroup.dataset.mapCity);
  });

  document.addEventListener('keydown', (event) => {
    const active = document.activeElement;
    const typing = active && (['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) || active.isContentEditable);
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (mod && state.overlayLocked) return;
    if (mod && key === 'k') {
      event.preventDefault();
      openSearch();
      return;
    }
    if (mod && key === ',') {
      event.preventDefault();
      openSettingsModal();
      return;
    }
    if (mod && key === 'r') {
      event.preventDefault();
      refreshAllData();
      return;
    }
    if (event.key === 'Escape') {
      if (state.overlayLocked) return;
      if (state.overlayOpen) closeOverlay();
      else hideMapTooltip();
      return;
    }
    if (typing || state.overlayOpen) return;
    if (event.key === '1') switchView('weather');
    else if (event.key === '2') switchView('radar');
    else if (event.key === '3') switchView('germany');
    else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      openSearch();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      state.radarRenderer?.pause();
    } else {
      const entry = state.weather.get(currentCity().id);
      const age = entry ? Date.now() - entry.at : Infinity;
      if (age > 10 * 60 * 1000) loadWeather(currentCity().id, { quiet: true });
    }
  });

  const media = window.matchMedia?.('(prefers-color-scheme: light)');
  media?.addEventListener?.('change', () => {
    if (state.settings.theme === 'system') applyTheme();
  });

  window.addEventListener('online', () => {
    showToast('Verbindung wieder da. Brise lädt frische DWD-Daten.', { icon: 'refresh' });
    refreshAllData();
  });

  window.addEventListener('offline', () => {
    setLiveState('stale', 'Offline-Daten');
    showToast('Keine Internetverbindung. Brise zeigt den letzten Stand.', { tone: 'warn', icon: 'cloud' });
  });
}

function setupScrollPerformance() {
  let idleTimer = 0;
  document.addEventListener(
    'scroll',
    () => {
      document.documentElement.dataset.scrolling = 'on';
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        delete document.documentElement.dataset.scrolling;
        translateDocument();
      }, 180);
    },
    { passive: true, capture: true },
  );
}

function startApp() {
  injectStaticIcons();
  applyTheme();
  applyLocaleAndRegion();
  applyGraphicsSettings();
  startTranslationObserver();
  setupScrollPerformance();
  updateClock();
  window.setInterval(updateClock, 1000);
  renderFavorites();
  bindEvents();
  scheduleRefresh();
  const city = currentCity();
  loadWeather(city.id);
  loadFavoriteSummaries();
  updateMaximizeIcon();
  if (needsOnboarding()) openOnboarding();
}

startApp();
