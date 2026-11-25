const UI_ICONS = {
  weather: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 6-6M12 3v2M21 12h-2M12 21v-2M3 12h2"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15M15 6v15"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.2-4.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  settings: '<path d="M4 6h7M15 6h5M4 12h3M11 12h9M4 18h9M17 18h3"/><circle cx="13" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="18" r="2"/>',
  refresh: '<path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2.1 5"/><path d="M20 12h-4"/>',
  minimize: '<path d="M5 12h14"/>',
  maximize: '<rect x="5" y="5" width="14" height="14" rx="1.4"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
  starFilled: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" fill="currentColor"/>',
  x: '<path d="m7 7 10 10M17 7 7 17"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronUp: '<path d="m18 15-6-6-6 6"/>',
  droplet: '<path d="M12 2.8s6.2 7 6.2 11.4a6.2 6.2 0 0 1-12.4 0C5.8 9.8 12 2.8 12 2.8Z"/>',
  wind: '<path d="M3 8h11.4a2.6 2.6 0 1 0-2.6-2.6M3 12h15a2.6 2.6 0 1 1-2.6 2.6M3 16h8"/>',
  gauge: '<path d="M4.9 19a9 9 0 1 1 14.2 0"/><path d="m12 13 3.5-3.5"/><circle cx="12" cy="13" r="1.2" fill="currentColor" stroke="none"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  cloud: '<path d="M6.5 19a4.5 4.5 0 0 1-.4-9A6.5 6.5 0 0 1 18.7 11 4 4 0 0 1 18 19Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"/>',
  sunrise: '<path d="M4 18h16M6 14a6 6 0 0 1 12 0M12 2v4M4.9 8.9l1.4 1.4M19.1 8.9l-1.4 1.4"/><path d="m9 5 3 3 3-3"/>',
  sunset: '<path d="M4 18h16M6 14a6 6 0 0 1 12 0M12 2v4M4.9 8.9l1.4 1.4M19.1 8.9l-1.4 1.4"/><path d="m9 3 3 3 3-3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  pin: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  warning: '<path d="M10.3 3.8 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  arrowUpRight: '<path d="M7 17 17 7M8 7h9v9"/>',
  play: '<path d="m8 5 11 7-11 7Z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  sparkles: '<path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4Z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7Z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  thermometer: '<path d="M9 14.8V5a3 3 0 0 1 6 0v9.8a5 5 0 1 1-6 0Z"/><path d="M12 8v9"/>',
  navigation: '<path d="m3 11 18-8-8 18-2.5-7.5L3 11Z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
  umbrella: '<path d="M3 12a9 9 0 0 1 18 0Z"/><path d="M12 12v6.5a2.5 2.5 0 0 0 5 0M12 3v1"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  command: '<path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6Z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  sort: '<path d="M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4"/>',
  wave: '<path d="M2 8c3 0 3 3 6 3s3-3 6-3 3 3 6 3 3-3 6-3M2 16c3 0 3 3 6 3s3-3 6-3 3 3 6 3 3-3 6-3" transform="translate(-2)"/>',
  maximizeRestore: '<rect x="8" y="8" width="10" height="10" rx="1"/><path d="M6 15H4V4h11v2"/>',
};

export function icon(name, size = 18, className = '') {
  const body = UI_ICONS[name] || UI_ICONS.info;
  return `<svg class="ui-icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

function sunCore(cx, cy, r = 8) {
  return `<circle class="wx-sun-core" cx="${cx}" cy="${cy}" r="${r}"/>`;
}

function sunRays(cx = 24, cy = 24, inner = 12.5, outer = 17) {
  const rays = [];
  for (let i = 0; i < 8; i += 1) {
    const a = (Math.PI / 4) * i;
    rays.push(
      `<line class="wx-sun-ray" x1="${(cx + Math.cos(a) * inner).toFixed(2)}" y1="${(cy + Math.sin(a) * inner).toFixed(2)}" x2="${(cx + Math.cos(a) * outer).toFixed(2)}" y2="${(cy + Math.sin(a) * outer).toFixed(2)}"/>`,
    );
  }
  return `<g class="wx-rays">${rays.join('')}</g>`;
}

function moonCore(cx = 24, cy = 22, r = 9) {
  return `<g class="wx-moon">
    <circle cx="${cx}" cy="${cy}" r="${r}"/>
    <circle cx="${cx - r * 0.3}" cy="${cy - r * 0.2}" r="${r * 0.24}" class="wx-crater"/>
    <circle cx="${cx + r * 0.34}" cy="${cy + r * 0.26}" r="${r * 0.16}" class="wx-crater"/>
  </g>${[0, 1, 2].map((i) => `<circle class="wx-star" cx="${[7, 40, 33][i]}" cy="${[13, 10, 34][i]}" r="${i === 1 ? 1.1 : 0.8}"/>`).join('')}`;
}

function cloud(x, y, scale = 1, opacity = 1, extraClass = '') {
  return `<g class="wx-cloud ${extraClass}" transform="translate(${x} ${y}) scale(${scale})" opacity="${opacity}">
    <circle cx="-9" cy="2" r="8"/>
    <circle cx="3" cy="-5" r="10.5"/>
    <circle cx="16" cy="1" r="8"/>
    <rect x="-9" y="1" width="26" height="9" rx="4.5"/>
  </g>`;
}

function rainLines(count = 3, y = 36) {
  return `<g class="wx-rain">${Array.from({ length: count }, (_, i) => {
    const x = 17 + i * 7;
    return `<line x1="${x}" y1="${y}" x2="${x - 2}" y2="${y + 6}"/>`;
  }).join('')}</g>`;
}

function snowDots(positions = [[18, 39], [25, 43], [32, 39]]) {
  return `<g class="wx-snow">${positions.map(([cx, cy], i) => `<circle cx="${cx}" cy="${cy}" r="${i === 1 ? 1.5 : 1.2}"/>`).join('')}</g>`;
}

const WEATHER_ICON_NAMES = new Set([
  'clear-day', 'clear-night', 'partly-cloudy-day', 'partly-cloudy-night',
  'cloudy', 'fog', 'wind', 'rain', 'sleet', 'snow', 'hail', 'thunderstorm',
]);

export function weatherIcon(iconName = 'cloudy', className = '') {
  const requested = String(iconName || 'cloudy');
  const name = WEATHER_ICON_NAMES.has(requested) ? requested : 'cloudy';
  const safeClass = String(className || '').replace(/[^\w\s-]/g, '');
  const night = name.includes('night');
  let body = '';

  if (name.startsWith('clear')) {
    body = night ? moonCore(24, 24, 10) : `${sunCore(24, 24, 8)}${sunRays()}`;
  } else if (name.startsWith('partly')) {
    body = `
      <g transform="translate(4 -2) scale(.83)">${night ? moonCore(25, 23, 9) : `${sunCore(25, 23, 7.5)}${sunRays(25, 23, 11.5, 15.5)}`}</g>
      ${cloud(25, 29, 1.02, 1, 'wx-cloud-front')}
    `;
  } else if (name === 'cloudy') {
    body = `${cloud(20, 26, 1.08, 0.95, 'wx-cloud-front')}${cloud(31, 19, 0.6, 0.42, 'wx-cloud-back')}`;
  } else if (name === 'fog') {
    body = `${cloud(24, 23, 0.92, 0.86, 'wx-cloud-front')}
      <g class="wx-fog"><line x1="12" y1="35" x2="34" y2="35"/><line x1="9" y1="40" x2="39" y2="40"/></g>`;
  } else if (name === 'wind') {
    body = `<g class="wx-wind">
      <path d="M8 17h18.5a4 4 0 1 0-4-4"/>
      <path d="M8 24h25a4 4 0 1 1-4 4"/>
      <path d="M8 31h13"/>
    </g>`;
  } else if (name === 'rain') {
    body = `${cloud(23, 24, 1.04, 1, 'wx-cloud-front')}${rainLines(3, 35)}`;
  } else if (name === 'sleet') {
    body = `${cloud(23, 24, 1.04, 1, 'wx-cloud-front')}
      <g class="wx-rain"><line x1="16" y1="35" x2="14" y2="41"/><line x1="32" y1="35" x2="30" y2="41"/></g>
      ${snowDots([[24, 39], [38, 40], [10, 40]])}`;
  } else if (name === 'snow') {
    body = `${cloud(23, 24, 1.04, 1, 'wx-cloud-front')}${snowDots([[15, 37], [24, 42], [33, 37], [39, 42]])}`;
  } else if (name === 'hail') {
    body = `${cloud(23, 23, 1.04, 1, 'wx-cloud-front')}
      <g class="wx-hail"><circle cx="16" cy="38" r="1.7"/><circle cx="25" cy="42" r="1.7"/><circle cx="34" cy="37" r="1.7"/></g>`;
  } else if (name === 'thunderstorm') {
    body = `${cloud(23, 20, 1.08, 1, 'wx-cloud-front')}
      <path class="wx-bolt" d="m25 29-5 11h5l-2 7 9-12h-5l3-6Z"/>
      <g class="wx-rain"><line x1="13" y1="32" x2="11" y2="38"/><line x1="38" y1="32" x2="36" y2="38"/></g>`;
  } else {
    body = `${cloud(23, 25, 1.06, 0.95, 'wx-cloud-front')}${sunRays(36, 13, 0, 0)}`;
  }

  return `<svg class="wx-icon wx-${name} ${safeClass}" viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">${body}</svg>`;
}

function starsMarkup() {
  const fixed = [
    [334, 67, 1.5, '0s'], [398, 44, 1, '-1.2s'], [456, 90, 1.3, '-2.1s'], [514, 48, 0.9, '-0.4s'],
    [284, 113, 0.9, '-3.2s'], [542, 132, 1.4, '-1.7s'], [368, 145, 1, '-4.1s'], [489, 187, 1.1, '-2.8s'],
    [313, 198, 0.8, '-0.9s'], [433, 25, 1.1, '-3.7s'], [560, 223, 0.7, '-2.3s'], [249, 158, 0.7, '-1.5s'],
  ];
  return `<g class="art-stars">${fixed
    .map(
      ([cx, cy, r, delay], i) =>
        `<circle class="art-star${i % 3 === 0 ? ' is-bright' : ''}" cx="${cx}" cy="${cy}" r="${r}" style="animation-delay:${delay}"/>`,
    )
    .join('')}</g>`;
}

function cloudGroup({ x, y, scale, variant = 'light', className = '', opacity = 1 }) {
  const fill = variant === 'dark' ? 'url(#artCloudDark)' : variant === 'silver' ? 'url(#artCloudSilver)' : 'url(#artCloudLight)';
  return `<g class="art-cloud ${className}" transform="translate(${x} ${y}) scale(${scale})" opacity="${opacity}">
    <ellipse cx="0" cy="42" rx="153" ry="61" fill="${fill}"/>
    <circle cx="-72" cy="19" r="55" fill="${fill}"/>
    <circle cx="5" cy="-13" r="78" fill="${fill}"/>
    <circle cx="83" cy="15" r="64" fill="${fill}"/>
    <circle cx="127" cy="43" r="38" fill="${fill}"/>
    <ellipse cx="-38" cy="-15" rx="106" ry="42" fill="url(#artCloudHighlight)" opacity=".55"/>
  </g>`;
}

function rainMarkup(night) {
  const drops = Array.from({ length: 15 }, (_, i) => {
    const x = 183 + ((i * 53) % 268);
    const y = 265 + ((i * 37) % 72);
    const length = 23 + (i % 4) * 5;
    return `<line x1="${x}" y1="${y}" x2="${x - 8}" y2="${y + length}" style="animation-delay:-${(i * 0.17).toFixed(2)}s"/>`;
  }).join('');
  return `<g class="art-rain ${night ? 'is-night' : ''}">${drops}</g>`;
}

function snowMarkup() {
  const flakes = Array.from({ length: 22 }, (_, i) => {
    const x = 175 + ((i * 71) % 285);
    const y = 250 + ((i * 41) % 135);
    return `<circle cx="${x}" cy="${y}" r="${1.2 + (i % 3) * 0.75}" style="animation-delay:-${(i * 0.31).toFixed(2)}s"/>`;
  }).join('');
  return `<g class="art-snow">${flakes}</g>`;
}

export function weatherArt(iconName = 'cloudy', forceNight = false) {
  const name = String(iconName || 'cloudy');
  const night = forceNight || name.includes('night');
  const family = name.startsWith('clear')
    ? 'clear'
    : name.startsWith('partly')
      ? 'partly'
      : ['rain', 'sleet', 'snow', 'hail', 'thunderstorm', 'fog', 'wind', 'cloudy'].includes(name)
        ? name
        : 'cloudy';

  const sun = `
    <circle class="art-aura" cx="410" cy="150" r="218" fill="url(#artSunGlow)"/>
    <circle cx="410" cy="150" r="136" fill="none" stroke="rgba(255,255,255,.13)" stroke-dasharray="2 8"/>
    <circle cx="410" cy="150" r="182" fill="none" stroke="rgba(255,255,255,.06)"/>
    <g class="art-sun">
      <circle cx="410" cy="150" r="83" fill="url(#artSunBody)"/>
      <circle cx="384" cy="122" r="27" fill="#FFF9E9" opacity=".32" filter="url(#artBlurSmall)"/>
      <circle cx="410" cy="150" r="99" fill="none" stroke="rgba(255,240,200,.15)"/>
    </g>`;

  const moon = `
    <circle class="art-aura" cx="412" cy="156" r="195" fill="url(#artMoonGlow)"/>
    <circle cx="412" cy="156" r="150" fill="none" stroke="rgba(255,255,255,.09)" stroke-dasharray="2 9"/>
    <g class="art-moon">
      <circle cx="412" cy="156" r="73" fill="url(#artMoonBody)"/>
      <circle cx="386" cy="134" r="14" fill="#A8B8D1" opacity=".28"/>
      <circle cx="434" cy="171" r="21" fill="#A8B8D1" opacity=".18"/>
      <circle cx="419" cy="119" r="7" fill="#A8B8D1" opacity=".22"/>
      <circle cx="451" cy="198" r="8" fill="#A8B8D1" opacity=".14"/>
      <circle cx="412" cy="156" r="87" fill="none" stroke="rgba(220,232,255,.2)"/>
    </g>`;

  const orbit = `
    <circle cx="346" cy="214" r="248" fill="none" stroke="rgba(255,255,255,.055)" stroke-dasharray="1 13"/>
    <circle cx="346" cy="214" r="198" fill="none" stroke="rgba(255,255,255,.06)"/>`;

  const birds = `
    <g class="art-birds" stroke="rgba(255,255,255,.42)" stroke-width="2" stroke-linecap="round" fill="none">
      <path d="M212 126c8-8 13-8 20 0 7-8 13-8 20 0"/>
      <path d="M266 156c6-6 10-6 15 0 5-6 10-6 15 0"/>
    </g>`;

  let scene = '';
  if (family === 'clear') {
    scene = night
      ? `${starsMarkup()}${moon}${orbit}
         ${cloudGroup({ x: 468, y: 304, scale: 0.38, variant: 'silver', className: 'drift-slow', opacity: 0.2 })}`
      : `${sun}${orbit}${birds}
         ${cloudGroup({ x: 481, y: 300, scale: 0.42, variant: 'light', className: 'drift-slow', opacity: 0.17 })}`;
  } else if (family === 'partly') {
    scene = `
      ${night ? `${starsMarkup()}${moon}` : sun}
      ${orbit}
      ${cloudGroup({ x: 306, y: 245, scale: 0.95, variant: night ? 'silver' : 'light', className: 'drift-main' })}
      ${cloudGroup({ x: 505, y: 316, scale: 0.42, variant: night ? 'dark' : 'light', className: 'drift-slow', opacity: 0.3 })}`;
  } else if (family === 'cloudy') {
    scene = `
      ${night ? `${starsMarkup()}${moon}` : sun}
      <g opacity=".62">
        ${cloudGroup({ x: 388, y: 145, scale: 0.82, variant: 'silver', className: 'drift-slow', opacity: 0.5 })}
      </g>
      ${cloudGroup({ x: 302, y: 244, scale: 1.02, variant: night ? 'dark' : 'light', className: 'drift-main' })}
      ${cloudGroup({ x: 513, y: 314, scale: 0.5, variant: night ? 'silver' : 'light', className: 'drift-slow', opacity: 0.34 })}`;
  } else if (family === 'rain' || family === 'thunderstorm') {
    scene = `
      <circle class="art-aura" cx="420" cy="145" r="210" fill="url(#artStormGlow)"/>
      ${night ? starsMarkup() : ''}
      ${cloudGroup({ x: 300, y: 170, scale: 1.08, variant: 'dark', className: 'drift-main' })}
      ${cloudGroup({ x: 478, y: 246, scale: 0.47, variant: 'silver', className: 'drift-slow', opacity: 0.34 })}
      ${rainMarkup(night)}
      ${family === 'thunderstorm' ? `<path class="art-bolt" d="m382 296-33 74h33l-16 56 67-91h-37l24-39Z" fill="url(#artBolt)" filter="url(#artBoltGlow)"/>` : ''}`;
  } else if (family === 'snow' || family === 'sleet' || family === 'hail') {
    scene = `
      <circle class="art-aura" cx="410" cy="155" r="210" fill="url(#artSnowGlow)"/>
      ${cloudGroup({ x: 286, y: 186, scale: 1.06, variant: 'dark', className: 'drift-main' })}
      ${cloudGroup({ x: 486, y: 252, scale: 0.45, variant: 'silver', className: 'drift-slow', opacity: 0.38 })}
      ${family === 'sleet' ? rainMarkup(night) : ''}
      ${snowMarkup()}`;
  } else if (family === 'fog') {
    scene = `
      ${night ? starsMarkup() : `<circle class="art-aura" cx="418" cy="150" r="195" fill="url(#artSunGlow)" opacity=".6"/>`}
      <circle cx="416" cy="150" r="60" fill="${night ? 'url(#artMoonBody)' : 'url(#artSunBody)'}" opacity=".3"/>
      ${cloudGroup({ x: 310, y: 205, scale: 0.95, variant: 'silver', className: 'drift-main', opacity: 0.4 })}
      <g class="art-fog">
        <rect x="140" y="272" width="392" height="23" rx="11.5"/>
        <rect x="94" y="313" width="478" height="17" rx="8.5"/>
        <rect x="188" y="346" width="336" height="13" rx="6.5"/>
        <rect x="120" y="374" width="432" height="10" rx="5"/>
      </g>`;
  } else if (family === 'wind') {
    scene = `
      ${night ? `${starsMarkup()}${moon}` : sun}
      <circle cx="346" cy="214" r="248" fill="none" stroke="rgba(255,255,255,.055)" stroke-dasharray="1 13"/>
      ${cloudGroup({ x: 365, y: 218, scale: 0.72, variant: night ? 'silver' : 'light', className: 'drift-slow', opacity: 0.35 })}
      <g class="art-wind" fill="none" stroke-linecap="round">
        <path d="M113 244c75-41 151-33 226 3 73 34 128 31 198-14" stroke-width="9"/>
        <path d="M154 302c63-28 127-22 185 5 65 31 120 22 164-10" stroke-width="5" opacity=".65"/>
        <path d="M196 348c48-17 98-12 141 7" stroke-width="3" opacity=".4"/>
      </g>`;
  }

  return `<svg class="hero-scene-art art-${family}${night ? ' is-night' : ''}" viewBox="0 0 620 440" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="artSunGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(410 150) rotate(90) scale(218)">
        <stop stop-color="#FFE8B5" stop-opacity=".52"/><stop offset=".45" stop-color="#FFBD80" stop-opacity=".16"/><stop offset="1" stop-color="#FFBD80" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="artMoonGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(412 156) rotate(90) scale(195)">
        <stop stop-color="#CFE0FF" stop-opacity=".32"/><stop offset=".6" stop-color="#B4C4FF" stop-opacity=".08"/><stop offset="1" stop-color="#B4C4FF" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="artStormGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(420 145) rotate(90) scale(220)">
        <stop stop-color="#9EDCFF" stop-opacity=".2"/><stop offset="1" stop-color="#83A7D6" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="artSnowGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(410 155) rotate(90) scale(220)">
        <stop stop-color="#D7F5FF" stop-opacity=".24"/><stop offset="1" stop-color="#A9CBFF" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="artSunBody" x1="346" y1="97" x2="456" y2="206" gradientUnits="userSpaceOnUse">
        <stop stop-color="#FFF7DF"/><stop offset=".48" stop-color="#FFE0A4"/><stop offset="1" stop-color="#FFAD78"/>
      </linearGradient>
      <radialGradient id="artMoonBody" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(388 128) rotate(90) scale(120)">
        <stop stop-color="#FBF7EC"/><stop offset=".75" stop-color="#D4DDF0"/><stop offset="1" stop-color="#B7C4DF"/>
      </radialGradient>
      <linearGradient id="artCloudLight" x1="140" y1="100" x2="370" y2="330" gradientUnits="userSpaceOnUse">
        <stop stop-color="#F6FBFF" stop-opacity=".8"/><stop offset=".52" stop-color="#D4E4EE" stop-opacity=".53"/><stop offset="1" stop-color="#8FAEBF" stop-opacity=".22"/>
      </linearGradient>
      <linearGradient id="artCloudSilver" x1="200" y1="120" x2="450" y2="330" gradientUnits="userSpaceOnUse">
        <stop stop-color="#E4EDF7" stop-opacity=".48"/><stop offset=".65" stop-color="#9AB1C6" stop-opacity=".24"/><stop offset="1" stop-color="#7C93A9" stop-opacity=".08"/>
      </linearGradient>
      <linearGradient id="artCloudDark" x1="190" y1="130" x2="440" y2="340" gradientUnits="userSpaceOnUse">
        <stop stop-color="#C5D5E8" stop-opacity=".5"/><stop offset=".55" stop-color="#7D96B3" stop-opacity=".44"/><stop offset="1" stop-color="#3D526C" stop-opacity=".28"/>
      </linearGradient>
      <linearGradient id="artCloudHighlight" x1="190" y1="100" x2="320" y2="230" gradientUnits="userSpaceOnUse">
        <stop stop-color="#FFFFFF" stop-opacity=".55"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="artBolt" x1="350" y1="295" x2="392" y2="428" gradientUnits="userSpaceOnUse">
        <stop stop-color="#FFF7D2"/><stop offset=".55" stop-color="#FFD77D"/><stop offset="1" stop-color="#FFAE5A"/>
      </linearGradient>
      <linearGradient id="artRainGrad" x1="0" y1="0" x2="0" y2="1">
        <stop stop-color="#BDEBFF" stop-opacity=".9"/><stop offset="1" stop-color="#7DCBF5" stop-opacity=".05"/>
      </linearGradient>
      <filter id="artBlurSmall" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="13"/></filter>
      <filter id="artBoltGlow" x="-80%" y="-40%" width="260%" height="220%"><feGaussianBlur stdDeviation="8" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="artFogBlur" x="-20%" y="-100%" width="140%" height="300%"><feGaussianBlur stdDeviation="7"/></filter>
      <filter id="artCloudBlur" x="-30%" y="-40%" width="160%" height="180%"><feGaussianBlur stdDeviation="10"/></filter>
    </defs>
    ${scene}
  </svg>`;
}

export function moonPhaseIcon(phase = 0.5, size = 32, waxing = true) {
  const illumination = Math.max(0, Math.min(1, phase));
  const id = `moon${size}${Math.round(illumination * 100)}${waxing ? 'w' : 'x'}`;
  const rx = Math.abs(1 - 2 * illumination) * 10;
  const outerSweep = waxing ? 1 : 0;
  const innerSweep = waxing ? (illumination < 0.5 ? 0 : 1) : (illumination < 0.5 ? 1 : 0);
  const litPath = illumination >= 0.999
    ? 'M 16 6 A 10 10 0 0 1 16 26 A 10 10 0 0 1 16 6 Z'
    : illumination <= 0.001
      ? ''
      : `M 16 6 A 10 10 0 0 ${outerSweep} 16 26 A ${rx.toFixed(2)} 10 0 0 ${innerSweep} 16 6 Z`;
  return `<svg class="moon-phase-icon" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
    <defs>
      <radialGradient id="${id}Surface" cx="35%" cy="28%" r="78%">
        <stop offset="0" stop-color="#ffffff"/>
        <stop offset="0.55" stop-color="#e9eeff"/>
        <stop offset="1" stop-color="#aebbd6"/>
      </radialGradient>
      <radialGradient id="${id}Glow">
        <stop offset="0.32" stop-color="#dbe6ff" stop-opacity="0.45"/>
        <stop offset="1" stop-color="#c4d4ff" stop-opacity="0"/>
      </radialGradient>
      <clipPath id="${id}Lit"><path d="${litPath}"/></clipPath>
    </defs>
    <circle cx="16" cy="16" r="14.5" fill="url(#${id}Glow)"/>
    <circle cx="16" cy="16" r="10" fill="#202d43"/>
    <path d="${litPath}" fill="url(#${id}Surface)"/>
    <g clip-path="url(#${id}Lit)" fill="#7f8dab" opacity="0.3">
      <circle cx="12" cy="12.5" r="2.1"/>
      <circle cx="19.5" cy="10.5" r="1.3"/>
      <circle cx="17.5" cy="19" r="2.5"/>
      <circle cx="10.5" cy="20" r="1.1"/>
    </g>
    <circle cx="16" cy="16" r="10" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="0.6"/>
  </svg>`;
}

export function windCompass(degrees = 0, className = '') {
  const dir = Number.isFinite(degrees) ? degrees : 0;
  return `<div class="wind-compass ${className}" aria-hidden="true">
    <span class="compass-n">N</span><span class="compass-e">O</span><span class="compass-s">S</span><span class="compass-w">W</span>
    <div class="compass-ring"></div>
    <div class="compass-ticks"></div>
    <div class="compass-needle" style="transform: rotate(${dir}deg)">
      <svg viewBox="0 0 48 48"><path d="M24 5 31 25H17Z" fill="currentColor"/><path d="M24 43 17 25h14Z" fill="currentColor" opacity=".22"/></svg>
    </div>
    <span class="compass-dot"></span>
  </div>`;
}
