export let TIME_ZONE = 'Europe/Berlin';

export const DEFAULT_SETTINGS = {
  theme: 'night',
  accent: 'mint',
  tempUnit: 'c',
  windUnit: 'kmh',
  precipUnit: 'mm',
  animations: true,
  refreshMinutes: 10,
  country: 'DE',
  language: 'de',
  provider: 'dwd',
  hardwareAcceleration: true,
  vsync: true,
};

const ICON_LABELS = {
  'clear-day': 'Klar',
  'clear-night': 'Klar',
  'partly-cloudy-day': 'Leicht bewölkt',
  'partly-cloudy-night': 'Leicht bewölkt',
  cloudy: 'Bewölkt',
  fog: 'Nebel',
  wind: 'Windig',
  rain: 'Regen',
  sleet: 'Schneeregen',
  snow: 'Schnee',
  hail: 'Hagel',
  thunderstorm: 'Gewitter',
};

const CONDITION_LABELS = {
  dry: 'Trocken',
  fog: 'Nebel',
  rain: 'Regen',
  sleet: 'Schneeregen',
  snow: 'Schnee',
  hail: 'Hagel',
  thunderstorm: 'Gewitter',
};

const DAY_LABELS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const DAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

const LOCALE_TAGS = { de: 'de-DE', en: 'en-GB', nl: 'nl-NL' };

let activeLocaleTag = LOCALE_TAGS.de;
let partsFormatter;
let timeFormatter;
let weekdayFormatter;
let weekdayShortFormatter;
let titleDateFormatter;

function rebuildFormatters() {
  partsFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  timeFormatter = new Intl.DateTimeFormat(activeLocaleTag, {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  weekdayFormatter = new Intl.DateTimeFormat(activeLocaleTag, {
    timeZone: TIME_ZONE,
    weekday: 'long',
  });
  weekdayShortFormatter = new Intl.DateTimeFormat(activeLocaleTag, {
    timeZone: TIME_ZONE,
    weekday: 'short',
  });
  titleDateFormatter = new Intl.DateTimeFormat(activeLocaleTag, {
    timeZone: TIME_ZONE,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
  rebuildFormatters.ready = true;
}

rebuildFormatters();

export function formatTitleDate(value = new Date()) {
  const date = toDate(value) || new Date();
  return titleDateFormatter.format(date).replace('.,', ',');
}

export function setWeatherLocale(language = 'de') {
  activeLocaleTag = LOCALE_TAGS[language] || LOCALE_TAGS.de;
  rebuildFormatters();
}

/** Zeiten im Falle eines ausländischen Ortes in dessen Zeitzone zeigen. */
export function setWeatherTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || !timeZone || timeZone === TIME_ZONE) return;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone });
  } catch {
    return;
  }
  TIME_ZONE = timeZone;
  rebuildFormatters();
}

export function escapeHTML(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function toDate(value) {
  if (value instanceof Date) return value;
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function localParts(date = new Date()) {
  const values = {};
  for (const part of partsFormatter.formatToParts(toDate(date) || new Date())) {
    if (part.type !== 'literal') values[part.type] = part.value;
  }
  return values;
}

export function localDayKey(value = new Date()) {
  const parts = localParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function dayKeyDate(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 12));
}

export function formatTime(value, withFallback = true) {
  const date = toDate(value);
  if (!date) return withFallback ? '–' : '';
  return timeFormatter.format(date);
}

export function formatWeekday(value, short = false) {
  const date = toDate(value);
  if (!date) return '–';
  if (short) return weekdayShortFormatter.format(date).replace('.', '');
  return weekdayFormatter.format(date);
}

export function formatDateLong(value = new Date()) {
  const date = toDate(value) || new Date();
  const parts = localParts(date);
  const weekday = formatWeekday(date);
  const month = MONTHS[Number(parts.month) - 1];
  return `${weekday}, ${Number(parts.day)}. ${month} ${parts.year}`;
}

export function formatDateShort(value = new Date()) {
  const date = toDate(value) || new Date();
  const parts = localParts(date);
  return `${Number(parts.day)}.${parts.month}.`;
}

export function formatRelative(value, now = new Date()) {
  const date = toDate(value);
  if (!date) return 'gerade eben';
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (minutes < -1) {
    const ahead = Math.ceil(-minutes / 60);
    if (ahead <= 1) return 'in Kürze';
    return ahead === 1 ? 'in 1 Stunde' : `in ${ahead} Stunden`;
  }
  if (minutes < 1) return 'gerade eben';
  if (minutes === 1) return 'vor 1 Minute';
  if (minutes < 60) return `vor ${minutes} Minuten`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return 'vor 1 Stunde';
  if (hours < 24) return `vor ${hours} Stunden`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'vor 1 Tag' : `vor ${days} Tagen`;
}

export function iconLabel(icon, condition = '') {
  return ICON_LABELS[icon] || CONDITION_LABELS[condition] || 'Unbekannt';
}

export function iconFamily(icon = '') {
  if (String(icon).startsWith('clear')) return 'clear';
  if (String(icon).startsWith('partly')) return 'partly';
  if (['rain', 'sleet', 'snow', 'hail', 'thunderstorm', 'fog', 'wind', 'cloudy'].includes(icon)) return icon;
  return 'cloudy';
}

export function isNightIcon(icon = '') {
  return String(icon).includes('night');
}

export function normalizeDailyIcon(icon = '') {
  if (String(icon).includes('night')) return String(icon).replace('-night', '-day');
  return icon || 'cloudy';
}

export function iconForCondition(condition = 'dry', cloudCover = 50, night = false) {
  if (condition === 'rain') return 'rain';
  if (condition === 'snow') return 'snow';
  if (condition === 'sleet') return 'sleet';
  if (condition === 'hail') return 'hail';
  if (condition === 'thunderstorm') return 'thunderstorm';
  if (condition === 'fog') return 'fog';
  if (cloudCover < 22) return night ? 'clear-night' : 'clear-day';
  if (cloudCover < 68) return night ? 'partly-cloudy-night' : 'partly-cloudy-day';
  return 'cloudy';
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function tempValue(celsius, unit = 'c') {
  if (!finite(celsius)) return null;
  return unit === 'f' ? (celsius * 9) / 5 + 32 : celsius;
}

export function formatTemp(celsius, unit = 'c', showUnit = false) {
  const value = tempValue(celsius, unit);
  if (value === null) return '–';
  return `${Math.round(value)}°${showUnit ? (unit === 'f' ? 'F' : 'C') : ''}`;
}

export function formatTempExact(celsius, unit = 'c') {
  const value = tempValue(celsius, unit);
  if (value === null) return '–';
  return `${value.toFixed(1)}°`;
}

export function windValue(kmh, unit = 'kmh') {
  if (!finite(kmh)) return null;
  if (unit === 'ms') return kmh / 3.6;
  if (unit === 'mph') return kmh * 0.621371;
  return kmh;
}

export function windLabel(unit = 'kmh') {
  if (unit === 'ms') return 'm/s';
  if (unit === 'mph') return 'mph';
  return 'km/h';
}

export function formatWind(kmh, unit = 'kmh', decimals = 0) {
  const value = windValue(kmh, unit);
  if (value === null) return '–';
  return `${value.toFixed(decimals)} ${windLabel(unit)}`;
}

export function precipitationValue(mm, unit = 'mm') {
  return unit === 'in' ? mm / 25.4 : mm;
}

export function precipitationLabel(unit = 'mm') {
  return unit === 'in' ? 'in' : 'mm';
}

export function formatPrecip(mm, unit = 'mm', decimals = null) {
  if (!finite(mm)) return '–';
  const value = precipitationValue(mm, unit);
  const places = decimals === null ? (unit === 'in' ? 2 : value < 10 ? 1 : 0) : decimals;
  return `${value.toFixed(places)} ${precipitationLabel(unit)}`;
}

export function visibilityValue(meters) {
  if (!finite(meters)) return null;
  return meters >= 1000 ? `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km` : `${Math.round(meters)} m`;
}

export function cardinalDirection(degrees) {
  if (!finite(degrees)) return '–';
  const directions = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return directions[Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16];
}

export function cardinalLong(degrees) {
  if (!finite(degrees)) return 'unbekannt';
  const directions = ['Norden', 'Nordnordosten', 'Nordosten', 'Ostnordosten', 'Osten', 'Ostsüdosten', 'Südosten', 'Südsüdosten', 'Süden', 'Südsüdwesten', 'Südwesten', 'Westsüdwesten', 'Westen', 'Westnordwesten', 'Nordwesten', 'Nordnordwesten'];
  return directions[Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16];
}

export function beaufort(kmh) {
  if (!finite(kmh)) return null;
  const limits = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117];
  const index = limits.findIndex((limit) => kmh <= limit);
  return index === -1 ? 12 : index;
}

export function feelsLikeCelsius(tempC, humidity, windKmh) {
  if (!finite(tempC)) return null;
  const v = finite(windKmh) ? windKmh : 0;
  if (tempC <= 10 && v >= 5) {
    return 13.12 + 0.6215 * tempC - 11.37 * v ** 0.16 + 0.3965 * tempC * v ** 0.16;
  }
  if (tempC >= 26 && finite(humidity)) {
    const hum = Math.max(0, Math.min(100, humidity));
    const f = (tempC * 9) / 5 + 32;
    const hi = -42.379 + 2.04901523 * f + 10.14333127 * hum
      - 0.22475541 * f * hum - 0.00683783 * f * f
      - 0.05481717 * hum * hum + 0.00122874 * f * f * hum
      + 0.00085282 * f * hum * hum - 0.00000199 * f * f * hum * hum;
    return ((hi - 32) * 5) / 9;
  }
  return tempC;
}

export function solarTimes(value, lat, lon) {
  const date = toDate(value) || new Date();
  const key = localDayKey(date);
  const [year, month, day] = key.split('-').map(Number);
  const start = Date.UTC(year, month - 1, day);
  const dayOfYear = Math.floor((start - Date.UTC(year, 0, 1)) / 86400000) + 1;
  const daysInYear = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
  const rad = Math.PI / 180;
  const gamma = (2 * Math.PI / daysInYear) * (dayOfYear - 0.5);
  const eqTime = 229.18 * (
    0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma)
  );
  const declination = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
    - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
    - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const zenith = 90.833 * rad;
  const cosHourAngle = Math.cos(zenith) / (Math.cos(lat * rad) * Math.cos(declination))
    - Math.tan(lat * rad) * Math.tan(declination);

  if (cosHourAngle > 1) {
    return { sunrise: null, sunset: null, solarNoon: null, dayMinutes: 0, polarNight: true, polarDay: false };
  }
  if (cosHourAngle < -1) {
    return { sunrise: null, sunset: null, solarNoon: null, dayMinutes: 1440, polarNight: false, polarDay: true };
  }

  const hourAngle = (Math.acos(cosHourAngle) * 180) / Math.PI;
  const solarNoonMinutes = 720 - 4 * lon - eqTime;
  const sunrise = new Date(start + (solarNoonMinutes - 4 * hourAngle) * 60000);
  const sunset = new Date(start + (solarNoonMinutes + 4 * hourAngle) * 60000);
  const solarNoon = new Date(start + solarNoonMinutes * 60000);
  return {
    sunrise,
    sunset,
    solarNoon,
    dayMinutes: Math.max(0, (sunset - sunrise) / 60000),
    polarNight: false,
    polarDay: false,
  };
}

export function sunProgress(now, sunrise, sunset) {
  if (!sunrise || !sunset) return 0;
  const total = sunset.getTime() - sunrise.getTime();
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, (now.getTime() - sunrise.getTime()) / total));
}

export function formatDuration(minutes) {
  if (!finite(minutes)) return '–';
  const full = Math.round(minutes);
  const hours = Math.floor(full / 60);
  const mins = full % 60;
  if (hours <= 0) return `${mins} Min.`;
  return `${hours} Std. ${mins} Min.`;
}

export function formatDurationShort(minutes) {
  if (!finite(minutes)) return '–';
  const full = Math.max(0, Math.round(minutes));
  const hours = Math.floor(full / 60);
  const mins = full % 60;
  return `${hours}:${String(mins).padStart(2, '0')} Std.`;
}

export function moonInfo(value = new Date()) {
  const date = toDate(value) || new Date();
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
  const cycle = 29.530588853;
  const days = (date.getTime() - knownNewMoon) / 86400000;
  const age = ((days % cycle) + cycle) % cycle;
  const fraction = age / cycle;
  const illumination = (1 - Math.cos(2 * Math.PI * fraction)) / 2;
  let name = 'Neumond';
  if (fraction >= 0.03 && fraction < 0.22) name = 'Zunehmende Sichel';
  else if (fraction >= 0.22 && fraction < 0.28) name = 'Zunehmender Halbmond';
  else if (fraction >= 0.28 && fraction < 0.47) name = 'Zunehmender Mond';
  else if (fraction >= 0.47 && fraction < 0.53) name = 'Vollmond';
  else if (fraction >= 0.53 && fraction < 0.72) name = 'Abnehmender Mond';
  else if (fraction >= 0.72 && fraction < 0.78) name = 'Abnehmender Halbmond';
  else if (fraction >= 0.78 && fraction < 0.97) name = 'Abnehmende Sichel';
  return {
    age,
    fraction,
    illumination,
    percent: Math.round(illumination * 100),
    name,
    waxing: fraction < 0.5,
  };
}

function pressureTrend(hourly, current) {
  const reference = current?.pressureMsl ?? hourly.find((hour) => hour.pressureMsl !== null)?.pressureMsl;
  if (!finite(reference)) return { label: 'stabil', delta: 0 };
  const now = Date.now();
  const target = now - 3 * 3600000;
  const prior = hourly
    .filter((hour) => hour.timestamp.getTime() <= target + 30 * 60000)
    .at(-1);
  const older = prior?.pressureMsl;
  if (!finite(older)) return { label: 'stabil', delta: 0 };
  const delta = reference - older;
  if (delta > 0.7) return { label: 'steigend', delta };
  if (delta < -0.7) return { label: 'fallend', delta };
  return { label: 'stabil', delta };
}

function dominantIcon(hours) {
  const all = hours.filter((hour) => hour.icon);
  if (!all.length) return 'cloudy';
  if (all.some((hour) => hour.icon === 'thunderstorm' || hour.condition === 'thunderstorm')) return 'thunderstorm';
  const snowCount = all.filter((hour) => hour.icon === 'snow').length;
  const rainCount = all.filter((hour) => ['rain', 'sleet', 'hail'].includes(hour.icon)).length;
  const rainTotal = all.reduce((sum, hour) => sum + (hour.precip || 0), 0);
  if (snowCount >= 2) return 'snow';
  if (rainTotal >= 1.1 || rainCount >= Math.max(3, all.filter((hour) => hour.isDaytime).length * 0.35)) return 'rain';
  const daytime = all.filter((hour) => hour.isDaytime);
  const pool = daytime.length >= 3 ? daytime : all;
  const counts = new Map();
  for (const hour of pool) {
    const key = normalizeDailyIcon(hour.icon);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const severity = ['thunderstorm', 'snow', 'sleet', 'rain', 'fog', 'cloudy', 'partly-cloudy-day', 'clear-day'];
  return [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return severity.indexOf(a[0]) - severity.indexOf(b[0]);
  })[0]?.[0] || 'cloudy';
}

export function buildModel(bundle, city, settings = DEFAULT_SETTINGS) {
  setWeatherTimeZone(bundle?.timezone);
  const now = new Date();
  const sun = solarTimes(now, city.lat, city.lon);
  const nightNow = sun.sunrise && sun.sunset
    ? now < sun.sunrise || now >= sun.sunset
    : false;

  const rawCurrent = bundle?.current || {};
  const currentTimestamp = toDate(rawCurrent.timestamp) || now;
  const hourlyRaw = Array.isArray(bundle?.hourly) ? bundle.hourly : [];

  const hourly = hourlyRaw
    .map((record) => {
      const timestamp = toDate(record.timestamp);
      if (!timestamp || !finite(record.temperature)) return null;
      const parts = localParts(timestamp);
      const hourNumber = Number(parts.hour);
      const hourSun = solarTimes(timestamp, city.lat, city.lon);
      const hourNight = hourSun.sunrise && hourSun.sunset
        ? timestamp < hourSun.sunrise || timestamp >= hourSun.sunset
        : nightNow;
      const icon = record.icon || iconForCondition(record.condition, record.cloud_cover, hourNight);
      return {
        timestamp,
        dayKey: localDayKey(timestamp),
        hourNumber,
        isDaytime: !hourNight,
        tempC: record.temperature,
        apparentC: feelsLikeCelsius(record.temperature, record.relative_humidity, record.wind_speed),
        icon,
        label: iconLabel(icon, record.condition),
        condition: record.condition || 'dry',
        precip: finite(record.precipitation) ? record.precipitation : 0,
        prob: finite(record.precipitation_probability) ? record.precipitation_probability : null,
        windDirection: finite(record.wind_direction) ? record.wind_direction : null,
        windSpeed: finite(record.wind_speed) ? record.wind_speed : null,
        gustSpeed: finite(record.wind_gust_speed) ? record.wind_gust_speed : null,
        humidity: finite(record.relative_humidity) ? record.relative_humidity : null,
        dewPoint: finite(record.dew_point) ? record.dew_point : null,
        pressureMsl: finite(record.pressure_msl) ? record.pressure_msl : null,
        visibility: finite(record.visibility) ? record.visibility : null,
        cloudCover: finite(record.cloud_cover) ? record.cloud_cover : null,
        sunshine: finite(record.sunshine) ? record.sunshine : 0,
        solar: finite(record.solar) ? record.solar : 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);

  const currentIconRaw = rawCurrent.icon || iconForCondition(rawCurrent.condition, rawCurrent.cloud_cover, nightNow);
  const currentIcon = nightNow
    ? currentIconRaw.replace('-day', '-night')
    : currentIconRaw.replace('-night', '-day');
  const fallbackHour = hourly
    .filter((hour) => hour.timestamp <= now)
    .at(-1) || hourly[0] || null;
  const nearestFuture = hourly.find((hour) => hour.timestamp >= now - 30 * 60000) || fallbackHour;

  const currentTemp = finite(rawCurrent.temperature) ? rawCurrent.temperature : nearestFuture?.tempC ?? null;
  const currentHumidity = finite(rawCurrent.relative_humidity)
    ? rawCurrent.relative_humidity
    : nearestFuture?.humidity ?? null;
  const currentWind = finite(rawCurrent.wind_speed_10) ? rawCurrent.wind_speed_10 : nearestFuture?.windSpeed ?? null;
  const currentGust = finite(rawCurrent.wind_gust_speed_10) ? rawCurrent.wind_gust_speed_10 : nearestFuture?.gustSpeed ?? null;
  const currentDirection = finite(rawCurrent.wind_direction_10) ? rawCurrent.wind_direction_10 : nearestFuture?.windDirection ?? null;
  const currentPressure = finite(rawCurrent.pressure_msl) ? rawCurrent.pressure_msl : nearestFuture?.pressureMsl ?? null;
  const currentVisibility = finite(rawCurrent.visibility) ? rawCurrent.visibility : nearestFuture?.visibility ?? null;
  const currentCloud = finite(rawCurrent.cloud_cover) ? rawCurrent.cloud_cover : nearestFuture?.cloudCover ?? null;
  const currentProb = nearestFuture?.prob ?? null;

  const current = {
    timestamp: currentTimestamp,
    tempC: currentTemp,
    apparentC: feelsLikeCelsius(currentTemp, currentHumidity, currentWind),
    icon: currentIcon,
    family: iconFamily(currentIcon),
    label: iconLabel(currentIconRaw, rawCurrent.condition),
    condition: rawCurrent.condition || nearestFuture?.condition || 'dry',
    humidity: currentHumidity,
    windSpeed: currentWind,
    gustSpeed: currentGust,
    windDirection: currentDirection,
    pressureMsl: currentPressure,
    visibility: currentVisibility,
    cloudCover: currentCloud,
    dewPoint: finite(rawCurrent.dew_point) ? rawCurrent.dew_point : nearestFuture?.dewPoint ?? null,
    prob: currentProb,
    precip60: finite(rawCurrent.precipitation_60) ? rawCurrent.precipitation_60 : 0,
    sunshine60: finite(rawCurrent.sunshine_60) ? rawCurrent.sunshine_60 : 0,
    solar60: finite(rawCurrent.solar_60) ? rawCurrent.solar_60 : 0,
  };

  const todayKey = localDayKey(now);
  const daily = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(Date.UTC(
      Number(todayKey.slice(0, 4)),
      Number(todayKey.slice(5, 7)) - 1,
      Number(todayKey.slice(8, 10)) + offset,
      12,
    ));
    const key = localDayKey(date);
    const hours = hourly.filter((hour) => hour.dayKey === key);
    if (!hours.length) continue;
    const temps = hours.map((hour) => hour.tempC).filter(finite);
    const rainTotal = hours.reduce((sum, hour) => sum + (hour.precip || 0), 0);
    const probabilities = hours.map((hour) => hour.prob).filter(finite);
    const sunshine = hours.reduce((sum, hour) => sum + (hour.sunshine || 0), 0);
    const windGusts = hours.map((hour) => hour.gustSpeed).filter(finite);
    const windSpeeds = hours.map((hour) => hour.windSpeed).filter(finite);
    const icon = dominantIcon(hours);
    const sunForDay = solarTimes(date, city.lat, city.lon);
    daily.push({
      key,
      date,
      hours,
      high: temps.length ? Math.max(...temps) : current.tempC,
      low: temps.length ? Math.min(...temps) : current.tempC,
      icon,
      label: iconLabel(icon, hours[0]?.condition),
      precipSum: rainTotal,
      probMax: probabilities.length ? Math.max(...probabilities) : null,
      sunshineMinutes: sunshine,
      sunshineHours: sunshine / 60,
      maxWind: windSpeeds.length ? Math.max(...windSpeeds) : null,
      maxGust: windGusts.length ? Math.max(...windGusts) : null,
      sunrise: sunForDay.sunrise,
      sunset: sunForDay.sunset,
      dayMinutes: sunForDay.dayMinutes,
      isToday: key === todayKey,
      labelDay: offset === 0 ? 'Heute' : offset === 1 ? 'Morgen' : formatWeekday(date, true),
      weekday: formatWeekday(date, true),
    });
  }

  const today = daily.find((day) => day.isToday) || daily[0];
  if (today) {
    current.high = today.high;
    current.low = today.low;
  }

  const hourlyRail = hourly
    .filter((hour) => hour.timestamp >= now - 30 * 60000)
    .slice(0, 48);

  const next12 = hourly.filter((hour) => hour.timestamp >= now).slice(0, 12);
  const next24 = hourly.filter((hour) => hour.timestamp >= now).slice(0, 24);
  const rainWindow = next12.find((hour) => (hour.prob ?? 0) >= 55 || (hour.precip || 0) > 0.05);
  const totalRain12 = next12.reduce((sum, hour) => sum + (hour.precip || 0), 0);
  const highProb12 = next12.reduce((max, hour) => Math.max(max, hour.prob ?? 0), 0);
  const rainOutlook = {
    startsAt: rainWindow?.timestamp || null,
    total12: totalRain12,
    maxProbability: highProb12,
    text: rainWindow
      ? `Ab ${formatTime(rainWindow.timestamp)} Uhr wird Regen wahrscheinlich.`
      : 'In den nächsten 12 Stunden bleibt es voraussichtlich trocken.',
  };

  const activeAlerts = (bundle?.alerts || [])
    .map((alert) => {
      const onset = toDate(alert.onset);
      const expires = toDate(alert.expires);
      const severity = String(alert.severity || 'minor').toLowerCase();
      const severityRank = { extreme: 4, severe: 3, moderate: 2, minor: 1 }[severity] || 1;
      return {
        ...alert,
        onset,
        expires,
        severity,
        severityRank,
        severityLabel: {
          extreme: 'Extrem',
          severe: 'Schwer',
          moderate: 'Mäßig',
          minor: 'Wetterwarnung',
        }[severity] || 'Wetterwarnung',
        headline: alert.headline_de || alert.headline_en || 'Amtliche DWD-Warnung',
        description: alert.description_de || alert.description_en || '',
        instruction: alert.instruction_de || alert.instruction_en || '',
        event: alert.event_de || alert.event_en || 'Wetterereignis',
      };
    })
    .filter((alert) => !alert.expires || alert.expires.getTime() > now.getTime() - 300000)
    .filter((alert) => !alert.status || alert.status === 'actual')
    .sort((a, b) => b.severityRank - a.severityRank || (a.onset?.getTime() || 0) - (b.onset?.getTime() || 0));

  const sources = Array.isArray(bundle?.current_sources) ? bundle.current_sources : [];
  const station = sources.find((source) => source.id === rawCurrent.source_id) || sources[0] || null;
  const trend = pressureTrend(hourly, current);
  const pressure = {
    value: currentPressure,
    ...trend,
  };

  const feels = current.apparentC;
  const temp = current.tempC;
  const gust = current.gustSpeed;
  const nextRainLine = rainWindow
    ? `Ab ${formatTime(rainWindow.timestamp)} Uhr steigt die Regenwahrscheinlichkeit.`
    : 'Die nächsten Stunden bleiben voraussichtlich trocken.';

  let tip;
  const severeAlert = activeAlerts.find((alert) => alert.severityRank >= 3);
  if (severeAlert) {
    tip = {
      title: 'Amtliche Warnung beachten',
      text: `${severeAlert.event}: ${severeAlert.headline.replace(/^Amtliche WARNUNG vor /i, '')}. Prüfe die DWD-Hinweise für deine Region.`,
      icon: 'warning',
      tone: 'warning',
    };
  } else if (current.condition === 'thunderstorm' || next12.some((hour) => hour.icon === 'thunderstorm')) {
    tip = {
      title: 'Gewitter im Anmarsch',
      text: 'Halte dich von offenen Flächen und hohen Bäumen fern. Lose Gegenstände auf Balkon und Terrasse sichern.',
      icon: 'warning',
      tone: 'warning',
    };
  } else if ((finite(temp) && temp <= 2.5) || next12.some((hour) => hour.icon === 'snow' || hour.icon === 'sleet')) {
    tip = {
      title: 'Warm durch den Tag',
      text: `${finite(temp) && temp <= 2.5 ? 'Es ist frostig.' : 'Schnee und Schneeregen sind möglich.'} Eine warme Schicht, Handschuhe und feste Schuhe machen den Weg angenehmer.`,
      icon: 'thermometer',
      tone: 'cool',
    };
  } else if ((finite(gust) && gust >= 55) || next12.some((hour) => (hour.gustSpeed || 0) >= 55)) {
    tip = {
      title: 'Der Wind legt zu',
      text: 'Mit kräftigen Böen rechnen. Fahrradanhänger, Schirme und alles Leichte lieber gut sichern.',
      icon: 'wind',
      tone: 'breeze',
    };
  } else if ((highProb12 >= 55 || totalRain12 > 0.3) && rainWindow) {
    tip = {
      title: 'Regenjacke einpacken',
      text: `${nextRainLine} ${totalRain12 > 1 ? 'Heute kommt einiges zusammen.' : 'Für den Weg reicht meist ein leichter Schutz.'}`,
      icon: 'umbrella',
      tone: 'rain',
    };
  } else if (finite(temp) && temp >= 28) {
    tip = {
      title: 'Sommerlich warm',
      text: 'Trinke genug Wasser und such dir für die Mittagsstunden ein schattiges Plätzchen. Die Abendluft wird angenehmer.',
      icon: 'sun',
      tone: 'warm',
    };
  } else if (current.family === 'clear' && sun.sunrise && sun.sunset) {
    const golden = new Date(sun.sunset.getTime() - 70 * 60000);
    tip = {
      title: now < sun.sunrise ? 'Der Morgen bleibt klar' : 'Die goldene Stunde wartet',
      text: `Kaum Wolken am Himmel. ${now < sun.sunset ? `Rund um ${formatTime(golden)} Uhr taucht die Sonne alles in warmes Licht.` : 'Ein guter Abend für einen langen Spaziergang.'}`,
      icon: 'sparkles',
      tone: 'clear',
    };
  } else if ((current.cloudCover ?? 0) > 85 && !rainWindow) {
    tip = {
      title: 'Grau, aber trocken',
      text: 'Dichte Wolken, aber kaum Regen in Sicht. Die Luft bleibt ruhig — ein guter Moment für eine Runde draußen.',
      icon: 'cloud',
      tone: 'neutral',
    };
  } else {
    tip = {
      title: 'Ein ruhiger Tag',
      text: `${iconLabel(current.icon, current.condition)} bei ${formatTemp(temp, settings.tempUnit)}. ${rainWindow ? 'Später kann etwas Regen dazukommen.' : 'Für die nächsten Stunden ist kaum Regen unterwegs.'}`,
      icon: 'sparkles',
      tone: 'neutral',
    };
  }

  return {
    city,
    current,
    hourly,
    hourlyRail,
    next24,
    daily,
    today,
    sun,
    nightNow,
    moon: moonInfo(now),
    alerts: activeAlerts,
    rainOutlook,
    pressure,
    station,
    fetchedAt: new Date((bundle?.fetched_at || Math.floor(Date.now() / 1000)) * 1000),
    observedAt: currentTimestamp,
    stale: Boolean(bundle?.stale),
    alertsAvailable: bundle?.alerts_available !== false,
    tip,
    settings,
  };
}

export function formatHourKey(hour) {
  return formatTime(hour.timestamp);
}

export function weatherSummaryText(model, settings) {
  const temp = formatTemp(model.current.tempC, settings.tempUnit);
  return `${temp} und ${model.current.label.toLowerCase()} in ${model.city.name}`;
}
