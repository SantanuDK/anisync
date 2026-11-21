// AniSync - Edition config
//
// This file is the FULL (developer) edition used when loading the repo unpacked.
// `node scripts/build.js` replaces it in dist/chrome-store/ with the store edition.

const ANISYNC_EDITION = {
  name: 'full',
  // Remote site list (null = bundled list only)
  sitesUrl: 'https://anisync-api.YOUR-SUBDOMAIN.workers.dev/sites',
  // Read the public site index (EverythingMoe) directly every 12h: new mirrors in, dead ones out
  siteIndex: true,
  // Bundled fallback list, relative to the extension root
  bundledSitesPath: 'cloudflare-worker/sites.json',
  // true  = the manifest content script runs everywhere; enabling a site just adds it to the list
  // false = sites the user enables need a host permission + a dynamically registered content script
  staticContentScripts: true
};
