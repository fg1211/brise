import { LOCALES } from './locales.js';

/* Übersetzt sichtbare Texte über die deutschen Ausgangstexte als Schlüssel.
   Das Original bleibt in WeakMaps erhalten, damit ein Sprachwechsel in beide
   Richtungen funktioniert. Der Observer greift erst nach dem Rendern ein und
   pausiert während des Scrollens – das hält die Oberfläche flüssig. */

const ATTRIBUTES = ['title', 'aria-label', 'placeholder', 'alt'];
const originalText = new WeakMap();
const originalAttribute = new WeakMap();
const patterns = new Map();
const patternIndex = new Map();

let language = 'de';
let queued = false;
let observerStarted = false;

function table() {
  return LOCALES[language] || {};
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function patternFor(key) {
  if (!patterns.has(key)) {
    const names = [...key.matchAll(/\{([a-zA-Z]+)\}/g)].map((match) => match[1]);
    const parts = key.split(/\{[a-zA-Z]+\}/);
    patterns.set(key, {
      names,
      regex: new RegExp(`^${parts.map(escapeRegExp).join('(.+?)')}$`, 's'),
      first: parts[0].trim(),
      last: parts.at(-1).trim(),
    });
  }
  return patterns.get(key);
}

function ensureIndex() {
  if (patternIndex.size || language === 'de') return;
  for (const key of Object.keys(table())) {
    if (!key.includes('{')) continue;
    const pattern = patternFor(key);
    const first = pattern.first || '';
    if (!patternIndex.has(first)) patternIndex.set(first, []);
    patternIndex.get(first).push(key);
  }
}

function translateValue(text) {
  if (!text || language === 'de') return null;
  const current = table();
  if (Object.prototype.hasOwnProperty.call(current, text)) return current[text];
  const german = LOCALES.de || {};
  if (Object.prototype.hasOwnProperty.call(german, text)) return german[text];

  ensureIndex();
  for (const [first, keys] of patternIndex) {
    if (!text.startsWith(first)) continue;
    for (const key of keys) {
      const pattern = patternFor(key);
      if (pattern.last && !text.endsWith(pattern.last)) continue;
      const match = pattern.regex.exec(text);
      if (!match) continue;
      let result = current[key] ?? german[key];
      if (result === undefined) continue;
      pattern.names.forEach((name, index) => {
        const captured = match[index + 1];
        result = result.replaceAll(`{${name}}`, translateValue(captured) ?? captured);
      });
      return result;
    }
  }
  return null;
}

function translateTextNode(node) {
  const parent = node.parentElement;
  if (parent && parent.closest('script, style, noscript')) return;
  let original = originalText.get(node);
  if (original === undefined) {
    original = node.nodeValue;
    originalText.set(node, original);
  }
  const value = language === 'de' ? original : (translateValue(original.trim()) ?? original);
  const padded = original.startsWith(' ') ? ` ${value}` : value;
  const next = original.endsWith(' ') ? `${padded} ` : padded;
  if (node.nodeValue !== next) node.nodeValue = next;
}

function translateElement(element) {
  if (element.matches('script, style, noscript, [data-i18n-ignore]')) return;
  let stored = originalAttribute.get(element);
  if (!stored) {
    stored = {};
    originalAttribute.set(element, stored);
  }
  for (const name of ATTRIBUTES) {
    if (!element.hasAttribute(name)) continue;
    if (stored[name] === undefined) stored[name] = element.getAttribute(name);
    const original = stored[name];
    const value = language === 'de' ? original : (translateValue(original) ?? original);
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  }
}

function translateTree(root) {
  if (!root) return;
  if (root.nodeType === 3) {
    translateTextNode(root);
    return;
  }
  if (root.nodeType !== 1) return;
  translateElement(root);
  if (root.matches('script, style, noscript')) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      if (node.nodeType === 1 && node.matches('script, style, noscript, [data-i18n-ignore]')) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === 1) translateElement(node);
    else translateTextNode(node);
    node = walker.nextNode();
  }
}

export function translateDocument() {
  const title = document.title;
  if (!translateDocument.originalTitle) translateDocument.originalTitle = title;
  document.title = language === 'de'
    ? translateDocument.originalTitle
    : (translateValue(translateDocument.originalTitle) ?? translateDocument.originalTitle);
  translateTree(document.body);
}

export function setLanguage(next) {
  language = Object.prototype.hasOwnProperty.call(LOCALES, next) ? next : 'de';
  document.documentElement.lang = language;
  patternIndex.clear();
  translateDocument();
}

export function currentLanguage() {
  return language;
}

/** Direkte Übersetzung für Texte, die nicht im DOM landen. */
export function t(text) {
  return translateValue(text) ?? text;
}

export function startTranslationObserver() {
  if (observerStarted || typeof MutationObserver === 'undefined') return;
  observerStarted = true;
  const observer = new MutationObserver((records) => {
    if (language === 'de' || document.documentElement.dataset.scrolling === 'on') return;
    const roots = new Set();
    const attributeRoots = new Set();
    for (const record of records) {
      if (record.type === 'attributes') {
        if (record.target.nodeType === 1) attributeRoots.add(record.target);
        continue;
      }
      for (const node of record.addedNodes) {
        if (node.nodeType === 1 || node.nodeType === 3) roots.add(node);
      }
      if (record.target.nodeType === 1 && record.type === 'characterData') {
        roots.add(record.target.parentElement);
      }
    }
    if (!roots.size && !attributeRoots.size) return;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      roots.forEach(translateTree);
      attributeRoots.forEach(translateElement);
    });
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRIBUTES,
  });
}
