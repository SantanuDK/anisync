// AniSync - Fetch EverythingMoe Anime Sites & Proxies
const fs = require('fs');
const path = require('path');

async function run() {
  console.log('Fetching data from EverythingMoe cache...');
  const [resSearch, resMain] = await Promise.all([
    fetch('https://everythingmoe.com/data/cache/search.json').then(r => r.json()),
    fetch('https://everythingmoe.com/data/cache/main.json').then(r => r.json())
  ]);

  const animeSites = resSearch.filter(item => item.type === 'anime');
  const IGNORED_HOSTS = ['github.com', 'discord.gg', 'discord.com', 't.me', 'reddit.com', 'twitter.com', 'x.com', 'everythingmoe.com', 'patreon.com'];

  function extractHostname(urlStr) {
    if (!urlStr) return null;
    try {
      let clean = urlStr.trim();
      if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
        clean = 'https://' + clean;
      }
      const url = new URL(clean);
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      if (IGNORED_HOSTS.some(h => host === h || host.endsWith('.' + h))) return null;
      if (!host.includes('.')) return null;
      return host;
    } catch (_) {
      return null;
    }
  }

  function parseLinksFromText(rawText) {
    if (!rawText || typeof rawText !== 'string') return [];
    const domains = [];
    const urlMatches = rawText.match(/https?:\/\/[^\s#<>"',]+/g) || [];
    for (const u of urlMatches) {
      const h = extractHostname(u);
      if (h) domains.push(h);
    }
    const words = rawText.split(/[\s,]+/);
    for (const w of words) {
      if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?$/.test(w)) {
        const h = extractHostname(w);
        if (h) domains.push(h);
      }
    }
    return domains;
  }

  const result = [];
  const allUniqueDomains = new Set();

  for (const s of animeSites) {
    const siteDomains = new Set();
    const primaryHost = extractHostname(s.link);
    if (primaryHost) siteDomains.add(primaryHost);

    const mainDetail = resMain[s.id] || {};
    const altlinks = parseLinksFromText(mainDetail.altlink);
    const exAltlinks = parseLinksFromText(mainDetail['ex-altlink']);
    const extraDomains = parseLinksFromText(mainDetail.domains);

    for (const d of [...altlinks, ...exAltlinks, ...extraDomains]) {
      siteDomains.add(d);
    }

    const domainList = Array.from(siteDomains).sort();
    domainList.forEach(d => allUniqueDomains.add(d));

    result.push({
      id: s.id,
      name: s.title,
      primaryUrl: s.link,
      domains: domainList
    });
  }

  const sortedAllDomains = Array.from(allUniqueDomains).sort();
  const payload = {
    version: '1.0.0',
    updatedAt: new Date().toISOString(),
    totalSites: result.length,
    totalDomains: sortedAllDomains.length,
    domains: sortedAllDomains,
    sites: result
  };

  fs.mkdirSync('cloudflare-worker', { recursive: true });
  fs.writeFileSync('cloudflare-worker/sites.json', JSON.stringify(payload, null, 2));

  // Also build the standalone Cloudflare Worker script embedding this list!
  const workerJsContent = `/**
 * AniSync - Cloudflare Worker Backend
 * Live at: https://anisync-api.YOUR-SUBDOMAIN.workers.dev/
 * Generated with 109 Anime Sites & 324+ Proxies/Mirrors from EverythingMoe
 */

const DATA = ${JSON.stringify(payload, null, 2)};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (url.pathname === "/") {
      return new Response(JSON.stringify({
        status: "online",
        service: "AniSync Cloudflare Backend",
        version: DATA.version,
        totalSites: DATA.totalSites,
        totalDomains: DATA.totalDomains,
        endpoints: ["/sites", "/domains", "/health"]
      }, null, 2), { headers: corsHeaders });
    }

    // Full sites array with proxies and mirrors
    if (url.pathname === "/sites") {
      return new Response(JSON.stringify(DATA, null, 2), { headers: corsHeaders });
    }

    // Flat array of all supported domains and proxies
    if (url.pathname === "/domains") {
      return new Response(JSON.stringify({
        count: DATA.totalDomains,
        domains: DATA.domains
      }, null, 2), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: corsHeaders
    });
  }
};
`;

  fs.writeFileSync('cloudflare-worker/worker.js', workerJsContent);
  console.log('Successfully generated sites.json and worker.js with ' + result.length + ' sites and ' + sortedAllDomains.length + ' domains!');
}

run().catch(console.error);
