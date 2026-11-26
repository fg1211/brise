import { session } from './session.js';

const tauri = window.__TAURI__;
const core = tauri?.core;

export const isDesktop = Boolean(core?.invoke);

async function invoke(command, args = {}) {
  if (!isDesktop) {
    throw new Error('Die Wetterdaten sind nur in der Desktop-App verfügbar. Bitte starte Brise über die App.');
  }
  try {
    return await core.invoke(command, args);
  } catch (error) {
    if (typeof error === 'string') throw new Error(error);
    if (error instanceof Error) throw error;
    throw new Error(String(error));
  }
}

function cityPayload(city) {
  const settings = session();
  const country = String(city.country || settings.country || 'DE').toUpperCase();
  const provider = country === 'DE' ? (settings.provider || 'dwd') : 'open-meteo';
  return {
    id: city.id,
    name: city.name,
    state: city.state,
    lat: city.lat,
    lon: city.lon,
    country,
    provider,
  };
}

export async function fetchWeather(city, force = false) {
  return invoke('get_weather', { city: cityPayload(city), force });
}

export async function fetchSummaries(cities, force = false) {
  return invoke('get_current_summaries', {
    cities: cities.map(cityPayload),
    force,
  });
}

/** Ortsuche im ausgewählten Land und in der ausgewählten Sprache. */
export async function searchPlaces(query) {
  const settings = session();
  return invoke('search_places', {
    query,
    country: settings.country || 'DE',
    language: settings.language || 'de',
  });
}

export async function fetchRadar(city, distance = 120000) {
  return invoke('get_radar', {
    request: {
      lat: city.lat,
      lon: city.lon,
      distance,
    },
  });
}

/** Grafikoptionen an das WebKit-Fenster durchreichen. */
export async function setHardwareAcceleration(enabled) {
  return invoke('set_hardware_acceleration', { enabled });
}

export async function setVsync(enabled) {
  return invoke('set_vsync', { enabled });
}
