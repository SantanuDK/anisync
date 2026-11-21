// AniSync - Background Service Worker with Cloudflare Dynamic Site Sync

// Chrome loads this file as a service worker and needs importScripts.
// Firefox loads all files via background.scripts, so they are already present.
if (typeof importScripts === 'function') {
  importScripts('edition.js');
  // Only the full edition ships the site-index reader
  if (ANISYNC_EDITION.siteIndex) importScripts('site-index.js');
  importScripts('mal-client.js');
}

const LEGACY_DYNAMIC_SCRIPT_ID = 'anisync-dynamic-detector';
const USER_SITES_SCRIPT_ID = 'anisync-user-sites';

const DEFAULT_SETTINGS = {
  syncThreshold: 80,
  notificationsEnabled: true,
  autoUpdateStatus: true,
  useAniSkip: true
};

// ---------- Supported site list ----------

function normalizeDomain(d) {
  if (typeof d !== 'string') return null;
  const clean = d.trim().toLowerCase().replace(/^www\./, '');
  return clean.includes('.') ? clean : null;
}

function collectDomains(data) {
  const set = new Set();
  for (const d of data.domains || []) {
    const n = normalizeDomain(d);
    if (n) set.add(n);
  }
  for (const site of data.sites || []) {
    const list = Array.isArray(site.domains) ? site.domains : [site.domain];
    for (const d of list) {
      const n = normalizeDomain(d);
      if (n) set.add(n);
    }
  }
  return [...set];
}

let supportedDomainsCache = null;

async function getSupportedDomains() {
  if (!supportedDomainsCache) {
    const { supported_domains = [] } = await chrome.storage.local.get('supported_domains');
    supportedDomainsCache = new Set(supported_domains);
  }
  return supportedDomainsCache;
}

async function isSupportedHost(hostname) {
  const domains = await getSupportedDomains();
  const userDomains = await getUserDomains();
  const parts = (hostname || '').toLowerCase().replace(/^www\./, '').split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join('.');
    if (domains.has(candidate) || userDomains.has(candidate)) return true;
  }
  return false;
}

// ---------- User-enabled sites (chrome.storage.sync, follows the user's browser account) ----------
//
// user_sites: [{ domain: 'example.to', frames: ['player-host.example'] }]
// `frames` are embed/player hosts found on the page when the site was enabled; the
// store edition needs host permission for them so the detector can run in the player iframe.

let userSitesCache = null;

async function getUserSites() {
  if (!userSitesCache) {
    try {
      const { user_sites } = await chrome.storage.sync.get('user_sites');
      userSitesCache = Array.isArray(user_sites) ? user_sites.filter(s => s && typeof s.domain === 'string') : [];
    } catch (_) {
      userSitesCache = [];
    }
  }
  return userSitesCache;
}

async function getUserDomains() {
  return new Set((await getUserSites()).map(s => s.domain));
}

function originsFor(host) {
  return [`*://${host}/*`, `*://*.${host}/*`];
}

// Store edition: register the detector for user-enabled sites the user granted access to.
// Serialized so overlapping triggers can't race on the same script ID.
let userScriptsQueue = Promise.resolve();

function syncUserSiteScripts() {
  userScriptsQueue = userScriptsQueue.then(doSyncUserSiteScripts).catch(err => {
    console.warn('[AniSync] Could not register user site scripts:', err.message);
  });
  return userScriptsQueue;
}

async function doSyncUserSiteScripts() {
  if (ANISYNC_EDITION.staticContentScripts || !chrome.scripting?.registerContentScripts) return;

  const matches = new Set();
  for (const site of await getUserSites()) {
    for (const host of [site.domain, ...(site.frames || [])]) {
      const origins = originsFor(host);
      try {
        if (await chrome.permissions.contains({ origins })) origins.forEach(o => matches.add(o));
      } catch (_) {}
    }
  }

  try {
    await chrome.scripting.unregisterContentScripts({ ids: [USER_SITES_SCRIPT_ID] });
  } catch (_) {}

  if (matches.size === 0) return;
  await chrome.scripting.registerContentScripts([{
    id: USER_SITES_SCRIPT_ID,
    matches: [...matches],
    js: ['content/detector.js'],
    runAt: 'document_idle',
    allFrames: true
  }]);
}

// Which user sites are missing their host permission (e.g. list synced to a new computer)
async function getUserSitesNeedingAccess() {
  if (ANISYNC_EDITION.staticContentScripts) return [];
  const missing = [];
  for (const site of await getUserSites()) {
    const origins = [site.domain, ...(site.frames || [])].flatMap(originsFor);
    try {
      if (!(await chrome.permissions.contains({ origins }))) missing.push(site.domain);
    } catch (_) {
      missing.push(site.domain);
    }
  }
  return missing;
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.user_sites) {
    userSitesCache = null;
    syncUserSiteScripts();
  }
});

if (chrome.permissions?.onAdded) {
  chrome.permissions.onAdded.addListener(() => syncUserSiteScripts());
  chrome.permissions.onRemoved.addListener(() => syncUserSiteScripts());
}

// A remote list must look like a real list before it may replace the current one:
// at least MIN_REMOTE_DOMAINS domains, and not shrinking below 60% of what we have
// (protects against an outage, a format change or a half-empty response wiping sites).
const MIN_REMOTE_DOMAINS = 100;
const MAX_SHRINK_RATIO = 0.6;

async function saveSiteData(data, source, { checkPlausible = false } = {}) {
  const domains = collectDomains(data);
  if (domains.length === 0) return false;

  const { supported_domains: current = [] } = await chrome.storage.local.get('supported_domains');
  if (checkPlausible) {
    if (domains.length < MIN_REMOTE_DOMAINS) {
      throw new Error(`only ${domains.length} domains — looks broken, keeping current list`);
    }
    if (current.length > 0 && domains.length < current.length * MAX_SHRINK_RATIO) {
      throw new Error(`list shrank from ${current.length} to ${domains.length} domains — keeping current list`);
    }
  }

  const before = new Set(current);
  const after = new Set(domains);
  const added = domains.filter(d => !before.has(d));
  const removed = current.filter(d => !after.has(d));

  await chrome.storage.local.set({
    dynamic_site_rules: data.sites,
    supported_domains: domains,
    site_list_meta: {
      source,
      sites: Array.isArray(data.sites) ? data.sites.length : 0,
      domains: domains.length,
      checkedAt: Date.now(),
      // Keep the last real change, so the popup can show what changed
      lastChange: (added.length || removed.length) && current.length
        ? { at: Date.now(), added: added.slice(0, 50), removed: removed.slice(0, 50) }
        : ((await chrome.storage.local.get('site_list_meta')).site_list_meta?.lastChange || null)
    }
  });
  supportedDomainsCache = new Set(domains);
  if (added.length || removed.length) {
    console.log(`[AniSync] Site list (${source}): +${added.length} -${removed.length}`, { added, removed });
  }
  return true;
}

// Update the supported-site list. Full edition: the public site index directly (new
// mirrors in, dead ones out, no server redeploy needed), then the
// Cloudflare Worker, then the bundled copy (only if nothing is stored yet).
// The store edition has no remote list and always uses its bundled official list.
async function syncSitesFromCloudflare() {
  if (ANISYNC_EDITION.siteIndex && typeof fetchSiteIndex === 'function') {
    try {
      if (await saveSiteData(await fetchSiteIndex(), SITE_INDEX_LABEL, { checkPlausible: true })) return;
    } catch (err) {
      console.warn('[AniSync] Could not update sites from the site index:', err.message);
    }
  }

  if (ANISYNC_EDITION.sitesUrl) {
    try {
      const res = await fetch(ANISYNC_EDITION.sitesUrl, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`Cloudflare HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data.sites)) throw new Error('Malformed site list');
      if (await saveSiteData(data, 'AniSync server', { checkPlausible: true })) return;
    } catch (err) {
      console.warn('[AniSync] Could not update sites from Cloudflare:', err.message);
    }
  }

  // Remote sources failed: keep whatever list we already have
  if (ANISYNC_EDITION.sitesUrl || ANISYNC_EDITION.siteIndex) {
    const { supported_domains } = await chrome.storage.local.get('supported_domains');
    if (Array.isArray(supported_domains) && supported_domains.length > 0) return;
  }

  try {
    const res = await fetch(chrome.runtime.getURL(ANISYNC_EDITION.bundledSitesPath));
    await saveSiteData(await res.json(), 'built-in copy');
    console.log('[AniSync] Using bundled site list.');
  } catch (err) {
    console.error('[AniSync] Failed to load bundled site list:', err);
  }
}

// ---------- Lifecycle ----------

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('AniSync extension installed/updated:', details.reason);
  const { settings, recent_syncs } = await chrome.storage.local.get(['settings', 'recent_syncs']);
  await chrome.storage.local.set({
    settings: { ...DEFAULT_SETTINGS, ...(settings || {}) },
    recent_syncs: recent_syncs || []
  });

  // Older builds registered the detector dynamically; it is now a static content script.
  if (chrome.scripting?.unregisterContentScripts) {
    try {
      await chrome.scripting.unregisterContentScripts({ ids: [LEGACY_DYNAMIC_SCRIPT_ID] });
    } catch (_) {}
  }

  // Periodic alarm to check for new sites every 12 hours
  if (ANISYNC_EDITION.sitesUrl || ANISYNC_EDITION.siteIndex) {
    chrome.alarms.create('SYNC_CLOUDFLARE_SITES', { periodInMinutes: 720 });
  }
  await syncSitesFromCloudflare();
  await syncUserSiteScripts();
});

chrome.runtime.onStartup.addListener(() => {
  syncSitesFromCloudflare();
  syncUserSiteScripts();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'SYNC_CLOUDFLARE_SITES') {
    syncSitesFromCloudflare();
  } else if (alarm.name === 'CLEAR_BADGE') {
    chrome.action.setBadgeText({ text: '' });
  }
});

// ---------- UI helpers ----------

// Flash a badge. Uses an alarm (not setTimeout) because the service worker
// may be shut down before a timer fires.
async function flashBadge(text, color = '#10B981') {
  // Badges are partly unsupported on Firefox for Android
  try {
    await chrome.action.setBadgeBackgroundColor({ color });
    await chrome.action.setBadgeText({ text });
    chrome.alarms.create('CLEAR_BADGE', { delayInMinutes: 0.5 });
  } catch (_) {}
}

async function showNotification(title, message) {
  if (!chrome.notifications?.create) return; // Not available on Firefox for Android
  const { settings } = await chrome.storage.local.get('settings');
  if (settings && settings.notificationsEnabled === false) return;

  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: title,
    message: message,
    priority: 1
  });
}

// ---------- Tab-based login (Firefox) ----------
// Registered at top level so it also wakes a suspended background page.
if (malClient.authFlow === 'tab') {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    const url = changeInfo.url;
    if (!url || !url.startsWith(MAL_CONFIG.TAB_REDIRECT_URI)) return;

    malClient.completeLoginFromRedirect(url).then(async (profile) => {
      if (!profile) return;
      chrome.tabs.remove(tabId).catch(() => {});
      await flashBadge('OK');
      await showNotification('AniSync', `Logged in to MyAnimeList as ${profile.name}.`);
    }).catch((err) => {
      console.error('[AniSync] Login failed:', err);
    });
  });
}

// ---------- Messaging ----------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case 'LOGIN': {
          const result = await malClient.login();
          if (result.pending) {
            // Tab-based login: finished by the tabs.onUpdated listener below
            sendResponse({ success: true, pending: true });
            break;
          }
          await flashBadge('OK');
          sendResponse({ success: true, profile: result.profile });
          break;
        }

        case 'LOGOUT': {
          await chrome.storage.local.remove(['mal_tokens', 'mal_user_profile', 'current_playback']);
          await chrome.action.setBadgeText({ text: '' });
          sendResponse({ success: true });
          break;
        }

        case 'GET_STATUS': {
          const { mal_tokens, mal_user_profile, settings, recent_syncs, current_playback, dynamic_site_rules, site_list_meta } =
            await chrome.storage.local.get([
              'mal_tokens',
              'mal_user_profile',
              'settings',
              'recent_syncs',
              'current_playback',
              'dynamic_site_rules',
              'site_list_meta'
            ]);

          const isLoggedIn = !!(mal_tokens && mal_tokens.access_token);
          sendResponse({
            success: true,
            isLoggedIn,
            profile: mal_user_profile || null,
            settings: { ...DEFAULT_SETTINGS, ...(settings || {}) },
            recentSyncs: recent_syncs || [],
            currentPlayback: current_playback || null,
            dynamicSitesCount: dynamic_site_rules?.length || 0,
            siteList: site_list_meta || null,
            canRefreshSites: !!(ANISYNC_EDITION.sitesUrl || ANISYNC_EDITION.siteIndex)
          });
          break;
        }

        case 'REFRESH_SITES_NOW': {
          await syncSitesFromCloudflare();
          const { site_list_meta } = await chrome.storage.local.get('site_list_meta');
          sendResponse({ success: true, siteList: site_list_meta || null });
          break;
        }

        // Popup asks about the current tab's site
        case 'SITE_STATUS': {
          const host = (message.hostname || '').toLowerCase().replace(/^www\./, '');
          const userSites = await getUserSites();
          const builtin = await (async () => {
            const domains = await getSupportedDomains();
            const parts = host.split('.');
            for (let i = 0; i < parts.length - 1; i++) {
              if (domains.has(parts.slice(i).join('.'))) return true;
            }
            return false;
          })();
          const userSite = userSites.find(s => host === s.domain || host.endsWith('.' + s.domain)) || null;
          const needingAccess = await getUserSitesNeedingAccess();
          sendResponse({
            success: true,
            edition: ANISYNC_EDITION.name,
            staticContentScripts: ANISYNC_EDITION.staticContentScripts,
            builtin,
            userSite,
            userSites,
            needingAccess
          });
          break;
        }

        // Popup changed the user's site list: apply it before the tab reloads
        case 'APPLY_USER_SITES': {
          userSitesCache = null;
          await syncUserSiteScripts();
          sendResponse({ success: true });
          break;
        }

        case 'CLEAR_MATCH_CACHE': {
          const removed = await malClient.clearSearchCache();
          sendResponse({ success: true, removed });
          break;
        }

        // A player iframe asks whether the tab it lives in is a supported site.
        case 'FRAME_HELLO': {
          const tabUrl = sender.tab?.url;
          let active = true; // If the tab URL is unavailable, stay active rather than break playback
          if (tabUrl) {
            try {
              active = await isSupportedHost(new URL(tabUrl).hostname);
            } catch (_) {}
          }
          sendResponse({ success: true, active });
          break;
        }

        // Relay progress from a player iframe to the top frame of the same tab.
        // Going through the extension (instead of window.postMessage) means
        // page scripts and ads cannot fake playback progress.
        case 'IFRAME_PROGRESS': {
          if (sender.tab?.id != null && sender.frameId !== 0) {
            chrome.tabs.sendMessage(
              sender.tab.id,
              { type: 'FRAME_PROGRESS', data: message.data },
              { frameId: 0 }
            ).catch(() => {});
          }
          sendResponse({ success: true });
          break;
        }

        case 'UPDATE_PLAYBACK_STATUS': {
          const { animeTitle, episodeNumber, malId, percentage, currentTime, duration, site, eligible } = message.data;
          const { current_playback: prev } = await chrome.storage.local.get('current_playback');

          const sameShow = !!prev && normTitle(prev.animeTitle) === normTitle(animeTitle);
          const sameEpisode = sameShow && Number(prev.episodeNumber) === Number(episodeNumber);

          await chrome.storage.local.set({
            current_playback: {
              animeTitle,
              episodeNumber,
              malId: malId || null,
              percentage,
              // Furthest point reached in this episode (survives seeking back)
              maxPercentage: Math.max(percentage || 0, sameEpisode ? (prev.maxPercentage || prev.percentage || 0) : 0),
              currentTime,
              duration,
              // Latest verdict wins (the detector's first report may come before its plan)
              eligible: !!eligible,
              site,
              updatedAt: Date.now()
            }
          });

          // "Moved on to the next episode" rule: if you jump from ep N to ep N+1 of the
          // same show after watching most of ep N (e.g. skipping its ending), ep N counts.
          if (sameShow && !sameEpisode &&
              Number(episodeNumber) === Number(prev.episodeNumber) + 1 &&
              prev.eligible &&
              (prev.maxPercentage || prev.percentage || 0) >= NEXT_EPISODE_MIN_PERCENT &&
              Date.now() - (prev.updatedAt || 0) < NEXT_EPISODE_WINDOW_MS) {
            handleSyncEpisode(prev.animeTitle, prev.episodeNumber, prev.malId).catch((err) => {
              console.warn('[AniSync] Next-episode sync failed:', err.message);
            });
          }

          sendResponse({ success: true });
          break;
        }

        case 'GET_SYNC_PLAN': {
          const { animeTitle, episodeNumber, duration, malId } = message.data || {};
          const plan = await buildSyncPlan(animeTitle, episodeNumber, duration, malId);
          sendResponse({ success: true, plan });
          break;
        }

        case 'SYNC_EPISODE': {
          const { animeTitle, episodeNumber, malId } = message.data;
          const syncResult = await handleSyncEpisode(animeTitle, episodeNumber, malId);
          sendResponse(syncResult);
          break;
        }

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (err) {
      console.error('AniSync service worker error:', err);
      sendResponse({ success: false, error: err.message });
    }
  })();

  return true;
});

// ---------- Sync ----------

// ---------- Sync planning (works for any length: 2-min shorts to 2-hour movies) ----------
//
// For each video the detector asks for a plan. Using MAL's data for the show we:
//  1. check the video is about as long as an episode of that show should be
//     (filters fan edits, reactions, compilations without fixed length rules),
//  2. resolve movies (no episode number on the page) to episode 1,
//  3. find where the ending starts (AniSkip community data, or an estimate),
//  4. sync at whichever comes first: the user's threshold or the ending,
//     but never before half the video.

const LENGTH_RATIO_MIN = 0.6;   // shorter than 60% of MAL's length -> not the episode
const LENGTH_RATIO_MAX = 4;     // longer than 4x -> compilation (allows double-length specials)
const MIN_SYNC_FRACTION = 0.5;
const ANISKIP_API = 'https://api.aniskip.com/v2/skip-times';
const ANISKIP_TTL_FOUND_MS = 30 * 24 * 60 * 60 * 1000;
const ANISKIP_TTL_MISSING_MS = 3 * 24 * 60 * 60 * 1000;

// Credits scale with length: ~70s for a short, ~2.5 min for TV, up to 10 min for movies
function estimateCreditsSeconds(duration) {
  return Math.min(600, Math.max(60, 60 + 0.06 * duration));
}

// Ending (ED) start time from AniSkip, scaled to this video's length. null if unknown.
async function getAniSkipEnding(malId, episode, duration) {
  const key = `${ANISKIP_PREFIX}${malId}_${episode}`;
  let entry = (await chrome.storage.local.get(key))[key];
  const fresh = entry && Date.now() - entry.at < (entry.edStart == null ? ANISKIP_TTL_MISSING_MS : ANISKIP_TTL_FOUND_MS);

  if (!fresh) {
    try {
      const url = `${ANISKIP_API}/${malId}/${episode}?types[]=ed&types[]=mixed-ed&episodeLength=${Math.round(duration)}`;
      const res = await fetch(url);
      if (!res.ok && res.status !== 404) throw new Error(`AniSkip HTTP ${res.status}`);
      const data = res.ok ? await res.json() : {};
      const hit = (data.results || []).find(r => r.skipType === 'ed' || r.skipType === 'mixed-ed');
      entry = {
        edStart: hit ? hit.interval.startTime : null,
        length: hit ? (hit.episodeLength || 0) : 0,
        at: Date.now()
      };
      await chrome.storage.local.set({ [key]: entry });
    } catch (err) {
      console.warn('[AniSync] AniSkip lookup failed:', err.message);
      return null;
    }
  }

  if (entry.edStart == null) return null;
  let start = entry.edStart;
  // Timestamps were recorded on a slightly different cut: scale to this video
  if (entry.length > 0 && Math.abs(entry.length - duration) / duration > 0.03) {
    start = start * (duration / entry.length);
  }
  return start >= duration * 0.4 && start < duration ? start : null;
}

async function buildSyncPlan(animeTitle, episodeNumber, duration, malId = null) {
  if (!animeTitle || !(duration > 0)) return { available: false, reason: 'missing data' };
  const token = await malClient.getValidAccessToken();
  if (!token) return { available: false, reason: 'not logged in' };

  const anime = await malClient.resolveAnime(animeTitle, malId);
  if (!anime) return { available: true, eligible: false, reason: 'no confident MyAnimeList match' };

  const info = await malClient.getAnimeInfo(anime.id);
  const singleEpisode = info.numEpisodes === 1 || info.mediaType === 'movie';

  let episode = parseInt(episodeNumber, 10);
  if (!(episode >= 1)) {
    if (!singleEpisode) return { available: true, eligible: false, reason: 'no episode number on the page' };
    episode = 1; // movie / one-shot special
  }
  if (info.numEpisodes > 0 && episode > info.numEpisodes) {
    return { available: true, eligible: false, reason: `${anime.title} has only ${info.numEpisodes} episodes` };
  }

  let lengthChecked = false;
  if (info.avgDuration > 0) {
    const ratio = duration / info.avgDuration;
    if (ratio < LENGTH_RATIO_MIN || ratio > LENGTH_RATIO_MAX) {
      return {
        available: true, eligible: false,
        reason: `video is ${Math.round(duration / 60)} min but ${anime.title} episodes are ~${Math.round(info.avgDuration / 60)} min`
      };
    }
    lengthChecked = true;
  }

  const { settings } = await chrome.storage.local.get('settings');
  const s = { ...DEFAULT_SETTINGS, ...(settings || {}) };

  let endingStart = null;
  let endingSource = 'estimate';
  if (s.useAniSkip !== false) {
    endingStart = await getAniSkipEnding(anime.id, episode, duration);
    if (endingStart != null) endingSource = 'aniskip';
  }
  if (endingStart == null) endingStart = duration - estimateCreditsSeconds(duration);

  const threshold = Math.min(100, Math.max(1, s.syncThreshold || 80)) / 100;
  const syncAt = Math.max(duration * MIN_SYNC_FRACTION, Math.min(duration * threshold, endingStart));

  return {
    available: true,
    eligible: true,
    lengthChecked,
    malId: anime.id,
    malTitle: anime.title,
    episode,
    mediaType: info.mediaType,
    expectedDuration: info.avgDuration,
    endingStart: Math.round(endingStart),
    endingSource,
    syncAt: Math.round(syncAt)
  };
}

// Next-episode rule: how much of the previous episode must have been watched,
// and how long ago at most
const NEXT_EPISODE_MIN_PERCENT = 50;
const NEXT_EPISODE_WINDOW_MS = 60 * 60 * 1000;

function normTitle(t) {
  return (t || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// In-flight syncs keyed by title+episode, so duplicate requests from several
// frames or tabs share one MAL update instead of racing each other.
const inFlightSyncs = new Map();

function handleSyncEpisode(animeTitle, episodeNumber, malId = null) {
  const key = `${(animeTitle || '').toLowerCase().trim()}#${episodeNumber}`;
  if (inFlightSyncs.has(key)) return inFlightSyncs.get(key);

  const promise = doSyncEpisode(animeTitle, episodeNumber, malId)
    .finally(() => inFlightSyncs.delete(key));
  inFlightSyncs.set(key, promise);
  return promise;
}

// Decide which list status to send, or null to leave it unchanged
function decideStatus(listStatus, ep, totalEpisodes, autoUpdateStatus) {
  const current = listStatus?.status || null;
  const isFinal = totalEpisodes > 0 && ep >= totalEpisodes;

  // Not on the list yet: an entry needs a status
  if (!current) return isFinal ? 'completed' : 'watching';
  if (!autoUpdateStatus) return null;
  if (isFinal) return 'completed';
  if (current === 'watching') return null;
  // plan_to_watch / on_hold / dropped -> resuming means watching
  if (current !== 'completed') return 'watching';
  return null;
}

async function doSyncEpisode(animeTitle, episodeNumber, malId = null) {
  const token = await malClient.getValidAccessToken();
  if (!token) {
    return { success: false, error: 'User is not logged in to MyAnimeList' };
  }

  const ep = parseInt(episodeNumber, 10);
  if (!animeTitle || isNaN(ep) || ep < 1) {
    return { success: false, error: 'Invalid title or episode number' };
  }

  const syncLockKey = `last_sync_${animeTitle.toLowerCase().trim()}`;
  const { [syncLockKey]: lastSyncedEpisode } = await chrome.storage.local.get(syncLockKey);
  if (lastSyncedEpisode && lastSyncedEpisode >= ep) {
    return { success: true, alreadySynced: true, message: `Episode ${ep} already synced.` };
  }

  const anime = await malClient.resolveAnime(animeTitle, malId);
  if (!anime) {
    return { success: false, error: `No confident match for "${animeTitle}" on MyAnimeList` };
  }

  // Always read the live list status; the search cache may be days old
  const { numEpisodes, listStatus } = await malClient.getListStatus(anime.id);
  const totalEpisodes = numEpisodes || anime.num_episodes || 0;

  if (totalEpisodes > 0 && ep > totalEpisodes) {
    return { success: false, error: `Episode ${ep} exceeds ${anime.title}'s ${totalEpisodes} episodes — likely a wrong match` };
  }

  const currentMALWatched = listStatus?.num_episodes_watched || 0;
  if (currentMALWatched >= ep) {
    await chrome.storage.local.set({ [syncLockKey]: currentMALWatched });
    return { success: true, alreadySynced: true, message: `MAL is already at episode ${currentMALWatched}.` };
  }

  const { settings } = await chrome.storage.local.get('settings');
  const autoUpdateStatus = (settings?.autoUpdateStatus ?? DEFAULT_SETTINGS.autoUpdateStatus) !== false;
  const status = decideStatus(listStatus, ep, totalEpisodes, autoUpdateStatus);

  const updateResult = await malClient.updateWatchProgress(anime.id, ep, status);
  await chrome.storage.local.set({ [syncLockKey]: ep });

  const { recent_syncs = [] } = await chrome.storage.local.get('recent_syncs');
  const syncRecord = {
    animeId: anime.id,
    title: anime.title,
    episode: ep,
    totalEpisodes,
    imageUrl: anime.main_picture?.medium || null,
    syncedAt: Date.now()
  };

  const updatedRecent = [syncRecord, ...recent_syncs.filter(s => !(s.animeId === anime.id && s.episode === ep))].slice(0, 20);
  await chrome.storage.local.set({ recent_syncs: updatedRecent });

  await flashBadge(`EP${ep}`);
  await showNotification(
    'AniSync: Progress Synced!',
    `Updated ${anime.title} to Episode ${ep} on MyAnimeList.`
  );

  return { success: true, anime, updateResult };
}
