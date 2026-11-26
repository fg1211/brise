/* Länderauswahl für Ortsuche und Wetter. Die Namen kommen aus Intl, ein
   kleiner deutscher Fallback deckt den Fall ab, dass Intl.DisplayNames
   nicht verfügbar ist. */

export const COUNTRY_CODES = [
  'DE', 'AT', 'CH', 'NL', 'BE', 'LU', 'FR', 'IT', 'ES', 'PT', 'GB', 'IE',
  'DK', 'SE', 'NO', 'FI', 'IS', 'PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'GR',
  'HR', 'SI', 'EE', 'LV', 'LT', 'UA', 'TR', 'RS', 'BA', 'MK', 'AL', 'ME',
  'MD', 'BY', 'RU', 'US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'AU',
  'NZ', 'JP', 'CN', 'KR', 'IN', 'TH', 'VN', 'ID', 'MY', 'SG', 'PH', 'ZA',
  'EG', 'MA', 'NG', 'KE', 'AE', 'SA', 'IL', 'PK', 'BD', 'NP', 'LK', 'KZ',
  'UZ', 'GE', 'AM', 'AZ', 'IR', 'IQ', 'TW', 'HK',
];

const FALLBACK = {
  DE: 'Deutschland', AT: 'Österreich', CH: 'Schweiz', NL: 'Niederlande',
  BE: 'Belgien', LU: 'Luxemburg', FR: 'Frankreich', IT: 'Italien',
  ES: 'Spanien', PT: 'Portugal', GB: 'Vereinigtes Königreich', IE: 'Irland',
  DK: 'Dänemark', SE: 'Schweden', NO: 'Norwegen', FI: 'Finnland',
  IS: 'Island', PL: 'Polen', CZ: 'Tschechien', SK: 'Slowakei',
  HU: 'Ungarn', RO: 'Rumänien', BG: 'Bulgarien', GR: 'Griechenland',
  HR: 'Kroatien', SI: 'Slowenien', EE: 'Estland', LV: 'Lettland',
  LT: 'Litauen', UA: 'Ukraine', TR: 'Türkei', US: 'Vereinigte Staaten',
  CA: 'Kanada', MX: 'Mexiko', BR: 'Brasilien', AU: 'Australien',
  NZ: 'Neuseeland', JP: 'Japan', CN: 'China', IN: 'Indien',
  ZA: 'Südafrika',
};

const displayNames = new Map();
const LOCALE_TAGS = { de: 'de-DE', en: 'en-GB', nl: 'nl-NL' };

export function countryName(code, language = 'de') {
  const upper = String(code || '').toUpperCase();
  if (!upper) return '';
  const tag = LOCALE_TAGS[language] || LOCALE_TAGS.de;
  if (!displayNames.has(tag)) {
    try {
      displayNames.set(tag, new Intl.DisplayNames([tag], { type: 'region' }));
    } catch (_) {
      displayNames.set(tag, null);
    }
  }
  const formatter = displayNames.get(tag);
  try {
    const name = formatter?.of(upper);
    if (name && name !== upper) return name;
  } catch (_) {
    // Fallback unten
  }
  return FALLBACK[upper] || upper;
}

const WORLDWIDE_LABEL = { de: 'Weltweit', en: 'Worldwide', nl: 'Wereldwijd' };

export function countryOptions(language = 'de', selected = 'DE') {
  const worldwide = WORLDWIDE_LABEL[language] || WORLDWIDE_LABEL.de;
  return [
    { value: 'ALL', label: worldwide, selected: selected === 'ALL' },
    ...COUNTRY_CODES
      .map((code) => ({ code, name: countryName(code, language) }))
      .sort((a, b) => a.name.localeCompare(b.name, language === 'en' ? 'en' : language === 'nl' ? 'nl' : 'de'))
      .map(({ code, name }) => ({ value: code, label: name, selected: code === selected })),
  ];
}
