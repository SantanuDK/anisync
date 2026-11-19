// AniSync - Background Service Worker with Cloudflare Dynamic Site Sync

// Chrome loads this file as a service worker and needs importScripts.
// Firefox loads both files via background.scripts, so mal-client.js is already present.
if (typeof importScripts === 'function') {
  importScripts('mal-client.js');
}

const CLOUDFLARE_API_URL = 'https://anisync-api.YOUR-SUBDOMAIN.workers.dev/sites';
const BUNDLED_SITES_PATH = 'cloudflare-worker/sites.json';
const LEGACY_DYNAMIC_SCRIPT_ID = 'anisync-dynamic-detector';

const DEFAULT_SETTINGS = {
  syncThreshold: 80,
  notificationsEnabled: true,
  autoUpdateStatus: true
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
  const parts = (hostname || '').toLowerCase().replace(/^www\./, '').split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    if (domains.has(parts.slice(i).join('.'))) return true;
  }
  return false;
}

async function saveSiteData(data) {
  const domains = collectDomains(data);
  if (domains.length === 0) return false;
  await chrome.storage.local.set({
    dynamic_site_rules: data.sites,
    supported_domains: domains
  });
  supportedDomainsCache = new Set(domains);
  return true;
}

// Fetch the latest list from Cloudflare. Falls back to the copy bundled with the
// extension if the network fails and nothing is stored yet.
async function syncSitesFromCloudflare() {
  try {
    const res = await fetch(CLOUDFLARE_API_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Cloudflare HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.sites)) throw new Error('Malformed site list');
    if (await saveSiteData(data)) {
      console.log(`[AniSync] Loaded ${data.sites.length} sites from Cloudflare.`);
      return;
    }
  } catch (err) {
    console.warn('[AniSync] Could not update sites from Cloudflare:', err.message);
  }

  const { supported_domains } = await chrome.storage.local.get('supported_domains');
  if (Array.isArray(supported_domains) && supported_domains.length > 0) return;

  try {
    const res = await fetch(chrome.runtime.getURL(BUNDLED_SITES_PATH));
    await saveSiteData(await res.json());
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
  chrome.alarms.create('SYNC_CLOUDFLARE_SITES', { periodInMinutes: 720 });
  await syncSitesFromCloudflare();
});

chrome.runtime.onStartup.addListener(() => {
  syncSitesFromCloudflare();
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
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeText({ text });
  chrome.alarms.create('CLEAR_BADGE', { delayInMinutes: 0.5 });
}

async function showNotification(title, message) {
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

// ---------- Messaging ----------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case 'LOGIN': {
          const result = await malClient.login();
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
          const { mal_tokens, mal_user_profile, settings, recent_syncs, current_playback, dynamic_site_rules } =
            await chrome.storage.local.get([
              'mal_tokens',
              'mal_user_profile',
              'settings',
              'recent_syncs',
              'current_playback',
              'dynamic_site_rules'
            ]);

          const isLoggedIn = !!(mal_tokens && mal_tokens.access_token);
          sendResponse({
            success: true,
            isLoggedIn,
            profile: mal_user_profile || null,
            settings: { ...DEFAULT_SETTINGS, ...(settings || {}) },
            recentSyncs: recent_syncs || [],
            currentPlayback: current_playback || null,
            dynamicSitesCount: dynamic_site_rules?.length || 0
          });
          break;
        }

        case 'REFRESH_SITES_NOW': {
          await syncSitesFromCloudflare();
          const { dynamic_site_rules = [] } = await chrome.storage.local.get('dynamic_site_rules');
          sendResponse({ success: true, count: dynamic_site_rules.length });
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
          const { animeTitle, episodeNumber, percentage, currentTime, duration, site } = message.data;
          await chrome.storage.local.set({
            current_playback: {
              animeTitle,
              episodeNumber,
              percentage,
              currentTime,
              duration,
              site,
              updatedAt: Date.now()
            }
          });
          sendResponse({ success: true });
          break;
        }

        case 'SYNC_EPISODE': {
          const { animeTitle, episodeNumber } = message.data;
          const syncResult = await handleSyncEpisode(animeTitle, episodeNumber);
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

// In-flight syncs keyed by title+episode, so duplicate requests from several
// frames or tabs share one MAL update instead of racing each other.
const inFlightSyncs = new Map();

function handleSyncEpisode(animeTitle, episodeNumber) {
  const key = `${(animeTitle || '').toLowerCase().trim()}#${episodeNumber}`;
  if (inFlightSyncs.has(key)) return inFlightSyncs.get(key);

  const promise = doSyncEpisode(animeTitle, episodeNumber)
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

async function doSyncEpisode(animeTitle, episodeNumber) {
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

  const anime = await malClient.searchAnime(animeTitle);
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
