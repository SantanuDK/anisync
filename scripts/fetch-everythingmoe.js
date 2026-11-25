// AniSync - Fetch EverythingMoe Anime Sites & Proxies
//
// Refreshes the BUNDLED fallback list (cloudflare-worker/sites.json) and regenerates
// cloudflare-worker/worker.js. You don't need to run this for users to get updates:
// the full edition already reads EverythingMoe directly every 12 hours. Run it before
// building a release so the bundled fallback is current. Uses the same parser as the
// extension (background/site-index.js).
//
// Usage: node scripts/fetch-everythingmoe.js
const fs = require('fs');
const path = require('path');
const { parseEverythingMoe, EVERYTHINGMOE_SEARCH_URL, EVERYTHINGMOE_MAIN_URL } = require('../background/site-index.js');

async function run() {
  process.chdir(path.resolve(__dirname, '..'));
  console.log('Fetching data from EverythingMoe cache...');
  const [resSearch, resMain] = await Promise.all([
    fetch(EVERYTHINGMOE_SEARCH_URL).then(r => { if (!r.ok) throw new Error('search.json HTTP ' + r.status); return r.json(); }),
    fetch(EVERYTHINGMOE_MAIN_URL).then(r => { if (!r.ok) throw new Error('main.json HTTP ' + r.status); return r.json(); })
  ]);

  const payload = parseEverythingMoe(resSearch, resMain);
  if (payload.totalDomains < 100) throw new Error('Only ' + payload.totalDomains + ' domains parsed - EverythingMoe format may have changed. Nothing written.');
  if (payload.totalMangaDomains < 50) throw new Error('Only ' + payload.totalMangaDomains + ' manga domains parsed - EverythingMoe format may have changed. Nothing written.');

  // Show what changed compared to the current bundled list
  let previous = {};
  try { previous = JSON.parse(fs.readFileSync('cloudflare-worker/sites.json', 'utf8')); } catch (_) {}
  const report = (label, oldList, newList) => {
    const before = new Set(oldList || []), after = new Set(newList);
    const added = newList.filter(d => !before.has(d));
    const removed = (oldList || []).filter(d => !after.has(d));
    console.log(label + ' added (' + added.length + '): ' + (added.join(', ') || '-'));
    console.log(label + ' removed (' + removed.length + '): ' + (removed.join(', ') || '-'));
  };
  console.log('Anime: ' + payload.totalSites + ' sites, ' + payload.totalDomains + ' domains');
  console.log('Manga: ' + payload.totalMangaSites + ' sites, ' + payload.totalMangaDomains + ' domains');
  report('Anime', previous.domains, payload.domains);
  report('Manga', previous.mangaDomains, payload.mangaDomains);

  fs.mkdirSync('cloudflare-worker', { recursive: true });
  fs.writeFileSync('cloudflare-worker/sites.json', JSON.stringify(payload, null, 2));

  // Also build the standalone Cloudflare Worker script embedding this list!
  const workerJsContent = `/**
 * AniSync - Cloudflare Worker Backend
 * Live at: https://anisync-api.YOUR-SUBDOMAIN.workers.dev/
 * Generated with ${payload.totalSites} anime sites (${payload.totalDomains} domains) and ${payload.totalMangaSites} manga sites (${payload.totalMangaDomains} domains) from EverythingMoe
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
        endpoints: ["/sites", "/domains", "/oauth/callback"]
      }, null, 2), { headers: corsHeaders });
    }

    // Full sites array with proxies and mirrors
    if (url.pathname === "/sites") {
      return new Response(JSON.stringify(DATA, null, 2), { headers: corsHeaders });
    }

    // OAuth landing page for AniSync's tab-based login (Firefox / Android).
    // The extension reads the code from this tab's URL; the page never touches it.
    if (url.pathname === "/oauth/callback") {
      return new Response(
        '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>AniSync</title></head><body style="font-family:system-ui,sans-serif;background:#0F172A;color:#F8FAFC;text-align:center;padding-top:30vh">' +
        '<p>Logging you in to AniSync&hellip; you can close this tab.</p></body></html>',
        { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } }
      );
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
  console.log('Successfully generated sites.json and worker.js.');
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
