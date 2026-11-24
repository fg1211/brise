export const CITIES = [
  { id: 'berlin', name: 'Berlin', state: 'Berlin', lat: 52.52, lon: 13.405, map: true },
  { id: 'hamburg', name: 'Hamburg', state: 'Hamburg', lat: 53.5511, lon: 9.9937, map: true },
  { id: 'muenchen', name: 'München', state: 'Bayern', lat: 48.1351, lon: 11.582, map: true },
  { id: 'koeln', name: 'Köln', state: 'Nordrhein-Westfalen', lat: 50.9375, lon: 6.9603, map: true },
  { id: 'frankfurt', name: 'Frankfurt', state: 'Hessen', lat: 50.1109, lon: 8.6821, map: true },
  { id: 'stuttgart', name: 'Stuttgart', state: 'Baden-Württemberg', lat: 48.7758, lon: 9.1829, map: true },
  { id: 'duesseldorf', name: 'Düsseldorf', state: 'Nordrhein-Westfalen', lat: 51.2277, lon: 6.7735, map: true },
  { id: 'leipzig', name: 'Leipzig', state: 'Sachsen', lat: 51.3397, lon: 12.3731, map: true },
  { id: 'dortmund', name: 'Dortmund', state: 'Nordrhein-Westfalen', lat: 51.5136, lon: 7.4653, map: true },
  { id: 'bremen', name: 'Bremen', state: 'Bremen', lat: 53.0793, lon: 8.8017, map: true },
  { id: 'dresden', name: 'Dresden', state: 'Sachsen', lat: 51.0504, lon: 13.7373, map: true },
  { id: 'hannover', name: 'Hannover', state: 'Niedersachsen', lat: 52.3759, lon: 9.732, map: true },
  { id: 'nuernberg', name: 'Nürnberg', state: 'Bayern', lat: 49.4521, lon: 11.0767, map: true },
  { id: 'rostock', name: 'Rostock', state: 'Mecklenburg-Vorpommern', lat: 54.0924, lon: 12.0991, map: true },
  { id: 'kiel', name: 'Kiel', state: 'Schleswig-Holstein', lat: 54.3233, lon: 10.1228, map: true },
  { id: 'magdeburg', name: 'Magdeburg', state: 'Sachsen-Anhalt', lat: 52.1205, lon: 11.6276, map: true },
  { id: 'erfurt', name: 'Erfurt', state: 'Thüringen', lat: 50.9848, lon: 11.0299, map: true },
  { id: 'saarbruecken', name: 'Saarbrücken', state: 'Saarland', lat: 49.2402, lon: 6.9969, map: true },
  { id: 'freiburg', name: 'Freiburg', state: 'Baden-Württemberg', lat: 47.999, lon: 7.8421, map: true },
  { id: 'mainz', name: 'Mainz', state: 'Rheinland-Pfalz', lat: 49.9929, lon: 8.2473, map: true },
  { id: 'muenster', name: 'Münster', state: 'Nordrhein-Westfalen', lat: 51.9607, lon: 7.6261, map: true },
  { id: 'essen', name: 'Essen', state: 'Nordrhein-Westfalen', lat: 51.4556, lon: 7.0116 },
  { id: 'duisburg', name: 'Duisburg', state: 'Nordrhein-Westfalen', lat: 51.4344, lon: 6.7623 },
  { id: 'bochum', name: 'Bochum', state: 'Nordrhein-Westfalen', lat: 51.4818, lon: 7.2162 },
  { id: 'wuppertal', name: 'Wuppertal', state: 'Nordrhein-Westfalen', lat: 51.2562, lon: 7.1508 },
  { id: 'bielefeld', name: 'Bielefeld', state: 'Nordrhein-Westfalen', lat: 52.0302, lon: 8.5325 },
  { id: 'bonn', name: 'Bonn', state: 'Nordrhein-Westfalen', lat: 50.7374, lon: 7.0982 },
  { id: 'mannheim', name: 'Mannheim', state: 'Baden-Württemberg', lat: 49.4875, lon: 8.466 },
  { id: 'karlsruhe', name: 'Karlsruhe', state: 'Baden-Württemberg', lat: 49.0069, lon: 8.4037 },
  { id: 'augsburg', name: 'Augsburg', state: 'Bayern', lat: 48.3705, lon: 10.8978 },
  { id: 'wiesbaden', name: 'Wiesbaden', state: 'Hessen', lat: 50.0782, lon: 8.2398 },
  { id: 'moenchengladbach', name: 'Mönchengladbach', state: 'Nordrhein-Westfalen', lat: 51.1805, lon: 6.4428 },
  { id: 'gelsenkirchen', name: 'Gelsenkirchen', state: 'Nordrhein-Westfalen', lat: 51.5177, lon: 7.0857 },
  { id: 'aachen', name: 'Aachen', state: 'Nordrhein-Westfalen', lat: 50.7753, lon: 6.0839 },
  { id: 'braunschweig', name: 'Braunschweig', state: 'Niedersachsen', lat: 52.2689, lon: 10.5268 },
  { id: 'chemnitz', name: 'Chemnitz', state: 'Sachsen', lat: 50.8278, lon: 12.9214 },
  { id: 'halle', name: 'Halle (Saale)', state: 'Sachsen-Anhalt', lat: 51.4969, lon: 11.9688 },
  { id: 'krefeld', name: 'Krefeld', state: 'Nordrhein-Westfalen', lat: 51.3388, lon: 6.5853 },
  { id: 'luebeck', name: 'Lübeck', state: 'Schleswig-Holstein', lat: 53.8655, lon: 10.6866 },
  { id: 'oberhausen', name: 'Oberhausen', state: 'Nordrhein-Westfalen', lat: 51.4963, lon: 6.8516 },
  { id: 'kassel', name: 'Kassel', state: 'Hessen', lat: 51.3127, lon: 9.4797 },
  { id: 'hagen', name: 'Hagen', state: 'Nordrhein-Westfalen', lat: 51.3671, lon: 7.4633 },
  { id: 'potsdam', name: 'Potsdam', state: 'Brandenburg', lat: 52.3906, lon: 13.0645 },
  { id: 'hamm', name: 'Hamm', state: 'Nordrhein-Westfalen', lat: 51.6739, lon: 7.815 },
  { id: 'ludwigshafen', name: 'Ludwigshafen', state: 'Rheinland-Pfalz', lat: 49.4774, lon: 8.4452 },
  { id: 'oldenburg', name: 'Oldenburg', state: 'Niedersachsen', lat: 53.1435, lon: 8.2146 },
  { id: 'osnabrueck', name: 'Osnabrück', state: 'Niedersachsen', lat: 52.2799, lon: 8.0472 },
  { id: 'leverkusen', name: 'Leverkusen', state: 'Nordrhein-Westfalen', lat: 51.0459, lon: 7.0192 },
  { id: 'heidelberg', name: 'Heidelberg', state: 'Baden-Württemberg', lat: 49.3988, lon: 8.6724 },
  { id: 'darmstadt', name: 'Darmstadt', state: 'Hessen', lat: 49.8728, lon: 8.6512 },
  { id: 'regensburg', name: 'Regensburg', state: 'Bayern', lat: 49.0134, lon: 12.1016 },
  { id: 'wuerzburg', name: 'Würzburg', state: 'Bayern', lat: 49.7913, lon: 9.9534 },
  { id: 'ulm', name: 'Ulm', state: 'Baden-Württemberg', lat: 48.4011, lon: 9.9876 },
  { id: 'heilbronn', name: 'Heilbronn', state: 'Baden-Württemberg', lat: 49.1427, lon: 9.2109 },
  { id: 'pforzheim', name: 'Pforzheim', state: 'Baden-Württemberg', lat: 48.8922, lon: 8.6946 },
  { id: 'wolfsburg', name: 'Wolfsburg', state: 'Niedersachsen', lat: 52.4227, lon: 10.7865 },
  { id: 'goettingen', name: 'Göttingen', state: 'Niedersachsen', lat: 51.5413, lon: 9.9158 },
  { id: 'reutlingen', name: 'Reutlingen', state: 'Baden-Württemberg', lat: 48.4919, lon: 9.2043 },
  { id: 'koblenz', name: 'Koblenz', state: 'Rheinland-Pfalz', lat: 50.3569, lon: 7.589 },
  { id: 'flensburg', name: 'Flensburg', state: 'Schleswig-Holstein', lat: 54.7937, lon: 9.4469 },
  { id: 'trier', name: 'Trier', state: 'Rheinland-Pfalz', lat: 49.75, lon: 6.6333 },
  { id: 'jena', name: 'Jena', state: 'Thüringen', lat: 50.9271, lon: 11.5892 },
  { id: 'cottbus', name: 'Cottbus', state: 'Brandenburg', lat: 51.7563, lon: 14.3329 },
  { id: 'schwerin', name: 'Schwerin', state: 'Mecklenburg-Vorpommern', lat: 53.6355, lon: 11.4012 },
  { id: 'goerlitz', name: 'Görlitz', state: 'Sachsen', lat: 51.1526, lon: 14.9885 },
  { id: 'konstanz', name: 'Konstanz', state: 'Baden-Württemberg', lat: 47.6779, lon: 9.1732 },
  { id: 'garmisch', name: 'Garmisch-Partenkirchen', state: 'Bayern', lat: 47.4917, lon: 11.0955 },
  { id: 'westerland', name: 'Sylt (Westerland)', state: 'Schleswig-Holstein', lat: 54.9079, lon: 8.3033 },
  { id: 'berchtesgaden', name: 'Berchtesgaden', state: 'Bayern', lat: 47.6325, lon: 13.001 },
  { id: 'norderney', name: 'Norderney', state: 'Niedersachsen', lat: 53.7086, lon: 7.1544 },
  { id: 'zugspitze', name: 'Zugspitze', state: 'Bayern', lat: 47.4211, lon: 10.9853 },
];

const CUSTOM_CITIES_KEY = 'brise.customCities.v1';

function loadCustomCities() {
  try {
    const stored = JSON.parse(localStorage.getItem(CUSTOM_CITIES_KEY) || '[]');
    if (!Array.isArray(stored)) return [];
    return stored.filter((city) => (
      city
      && typeof city.id === 'string'
      && city.id.startsWith('ort-')
      && typeof city.name === 'string'
      && Number.isFinite(city.lat)
      && Number.isFinite(city.lon)
    )).map((city) => ({
      id: city.id,
      name: city.name,
      state: typeof city.state === 'string' ? city.state : 'Deutschland',
      lat: city.lat,
      lon: city.lon,
      custom: true,
    }));
  } catch {
    return [];
  }
}

export const CUSTOM_CITIES = loadCustomCities();

export const CITY_BY_ID = Object.fromEntries(
  [...CITIES, ...CUSTOM_CITIES].map((city) => [city.id, city]),
);

/** Register a place found by the location search and remember it for later. */
export function registerCity(place) {
  if (!place || typeof place.id !== 'string' || !place.id.startsWith('ort-')) return null;
  const city = {
    id: place.id,
    name: String(place.name || '').trim(),
    state: String(place.state || 'Deutschland').trim(),
    lat: Number(place.lat),
    lon: Number(place.lon),
    custom: true,
  };
  if (!city.name || !Number.isFinite(city.lat) || !Number.isFinite(city.lon)) return null;

  CUSTOM_CITIES.push(city);
  CITY_BY_ID[city.id] = city;
  try {
    localStorage.setItem(CUSTOM_CITIES_KEY, JSON.stringify(CUSTOM_CITIES));
  } catch {
    // Without storage the city still works for this session.
  }
  return city;
}

export const DEFAULT_FAVORITES = ['berlin', 'hamburg', 'muenchen', 'koeln'];

export const MAP_CITY_IDS = CITIES.filter((city) => city.map).map((city) => city.id);

const ALIASES = {
  koeln: ['cologne', 'köln'],
  muenchen: ['munich', 'muenchen'],
  nuernberg: ['nuremberg', 'nürnberg'],
  frankfurt: ['frankfurt am main', 'mainhattan'],
  westerland: ['sylt'],
  goettingen: ['göttingen'],
  osnabrueck: ['osnabrück'],
  luebeck: ['lübeck'],
  muenster: ['münster'],
  duesseldorf: ['düsseldorf'],
  moenchengladbach: ['mönchengladbach'],
  saarbruecken: ['saarbrücken'],
  wuerzburg: ['würzburg'],
};

export function normalizeSearch(value = '') {
  return value
    .toLocaleLowerCase('de-DE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .trim();
}

export function cityMatches(city, query) {
  if (!query) return true;
  const normalized = normalizeSearch(query);
  const haystack = [
    city.name,
    city.state,
    ...(ALIASES[city.id] || []),
  ]
    .map(normalizeSearch)
    .join(' ');
  return normalized.split(/\s+/).every((part) => haystack.includes(part));
}

export function searchCities(query, limit = 20) {
  const matches = [...CITIES, ...CUSTOM_CITIES].filter((city) => cityMatches(city, query));
  if (!query) return matches.slice(0, limit);
  const score = (city) => {
    const name = normalizeSearch(city.name);
    const q = normalizeSearch(query);
    if (name === q) return 0;
    if (name.startsWith(q)) return 1;
    return 2;
  };
  return matches.sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name, 'de')).slice(0, limit);
}

export function cityWithPosition(city) {
  return { ...city, latitude: city.lat, longitude: city.lon };
}
