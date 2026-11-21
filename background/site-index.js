// AniSync - Site index reader (EverythingMoe), full edition only
//
// Shared by the extension background (importScripts / background.scripts) and by
// scripts/fetch-everythingmoe.js (require). Turns EverythingMoe's public cache files
// into AniSync's site list: { sites: [{ id, name, primaryUrl, domains }], domains: [...] }.

const EVERYTHINGMOE_SEARCH_URL = 'https://everythingmoe.com/data/cache/search.json';
const EVERYTHINGMOE_MAIN_URL = 'https://everythingmoe.com/data/cache/main.json';

// Links on EverythingMoe that are not streaming sites
const EVERYTHINGMOE_IGNORED_HOSTS = [
  'github.com', 'discord.gg', 'discord.com', 't.me', 'reddit.com',
  'twitter.com', 'x.com', 'everythingmoe.com', 'patreon.com'
];

function emExtractHostname(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return null;
  try {
    let clean = urlStr.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) clean = 'https://' + clean;
    const host = new URL(clean).hostname.toLowerCase().replace(/^www\./, '');
    if (EVERYTHINGMOE_IGNORED_HOSTS.some(h => host === h || host.endsWith('.' + h))) return null;
    return host.includes('.') ? host : null;
  } catch (_) {
    return null;
  }
}

function emParseLinksFromText(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  const domains = [];
  for (const u of rawText.match(/https?:\/\/[^\s#<>"',]+/g) || []) {
    const h = emExtractHostname(u);
    if (h) domains.push(h);
  }
  for (const w of rawText.split(/[\s,]+/)) {
    if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?$/.test(w)) {
      const h = emExtractHostname(w);
      if (h) domains.push(h);
    }
  }
  return domains;
}

function parseEverythingMoe(search, main) {
  if (!Array.isArray(search) || !main || typeof main !== 'object') {
    throw new Error('Unexpected EverythingMoe data format');
  }
  const sites = [];
  const allDomains = new Set();

  for (const s of search.filter(item => item && item.type === 'anime')) {
    const siteDomains = new Set();
    const primary = emExtractHostname(s.link);
    if (primary) siteDomains.add(primary);

    const detail = main[s.id] || {};
    for (const d of [
      ...emParseLinksFromText(detail.altlink),
      ...emParseLinksFromText(detail['ex-altlink']),
      ...emParseLinksFromText(detail.domains)
    ]) {
      siteDomains.add(d);
    }

    const domainList = [...siteDomains].sort();
    domainList.forEach(d => allDomains.add(d));
    sites.push({ id: s.id, name: s.title, primaryUrl: s.link, domains: domainList });
  }

  const domains = [...allDomains].sort();
  return {
    version: '1.0.0',
    updatedAt: new Date().toISOString(),
    totalSites: sites.length,
    totalDomains: domains.length,
    domains,
    sites
  };
}

// Shown in the popup as the list's source
const SITE_INDEX_LABEL = 'EverythingMoe';

// Used by the extension background (full edition only)
async function fetchSiteIndex() {
  const [searchRes, mainRes] = await Promise.all([
    fetch(EVERYTHINGMOE_SEARCH_URL, { cache: 'no-cache' }),
    fetch(EVERYTHINGMOE_MAIN_URL, { cache: 'no-cache' })
  ]);
  if (!searchRes.ok || !mainRes.ok) {
    throw new Error(`EverythingMoe HTTP ${searchRes.status}/${mainRes.status}`);
  }
  return parseEverythingMoe(await searchRes.json(), await mainRes.json());
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseEverythingMoe, EVERYTHINGMOE_SEARCH_URL, EVERYTHINGMOE_MAIN_URL };
}
