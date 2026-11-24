const tauri = window.__TAURI__;
const core = tauri?.core;

export const isDesktop = Boolean(core?.invoke);

async function invoke(command, args = {}) {
  if (!isDesktop) {
    throw new Error('Die DWD-Schnittstelle ist nur in der Desktop-App verfügbar. Bitte starte Brise über die App.');
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
  return {
    id: city.id,
    name: city.name,
    state: city.state,
    lat: city.lat,
    lon: city.lon,
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

/** Look up any German town by name (Open-Meteo/GeoNames, filtered to DE). */
export async function searchPlaces(query) {
  return invoke('search_places', { query });
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
