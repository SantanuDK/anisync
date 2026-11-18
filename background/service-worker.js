// AniSync - Background Service Worker with Cloudflare Dynamic Site Sync

importScripts('mal-client.js');

const CLOUDFLARE_API_URL = 'https://anisync-api.YOUR-SUBDOMAIN.workers.dev/sites';
const DYNAMIC_SCRIPT_ID = 'anisync-dynamic-detector';

// Dynamic Site Synchronization via Cloudflare
async function syncSitesFromCloudflare() {
  try {
    console.log('[AniSync] Fetching latest site definitions from Cloudflare...');
    const res = await fetch(CLOUDFLARE_API_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Cloudflare HTTP ${res.status}`);

    const data = await res.json();
    if (!data.sites || !Array.isArray(data.sites)) return;

    // Save rules to local storage for detector.js to use
    await chrome.storage.local.set({ dynamic_site_rules: data.sites });

    // Build URL match patterns for dynamic script registration
    const domainSet = new Set(data.domains || []);
    if (Array.isArray(data.sites)) {
      for (const site of data.sites) {
        if (Array.isArray(site.domains)) {
          site.domains.forEach(d => domainSet.add(d));
        } else if (site.domain) {
          domainSet.add(site.domain);
        }
      }
    }

    const matchPatterns = [];
    for (const d of domainSet) {
      if (typeof d === 'string' && d.trim().length > 0) {
        const clean = d.trim().toLowerCase();
        matchPatterns.push(`*://*.${clean}/*`);
        matchPatterns.push(`*://${clean}/*`);
      }
    }

    if (matchPatterns.length === 0) return;

    // Unregister existing dynamic script if present
    try {
      const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [DYNAMIC_SCRIPT_ID] });
      if (existing.length > 0) {
        await chrome.scripting.unregisterContentScripts({ ids: [DYNAMIC_SCRIPT_ID] });
      }
    } catch (_) {}

    // Register new dynamic content script
    await chrome.scripting.registerContentScripts([
      {
        id: DYNAMIC_SCRIPT_ID,
        matches: matchPatterns,
        js: ['content/detector.js'],
        runAt: 'document_idle',
        allFrames: true
      }
    ]);

    console.log(`[AniSync] Successfully registered ${matchPatterns.length} streaming sites from Cloudflare.`);
  } catch (err) {
    console.warn('[AniSync] Could not update sites from Cloudflare:', err.message);
  }
}

// Installation and setup
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('AniSync extension installed/updated:', details.reason);
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings) {
    await chrome.storage.local.set({
      settings: {
        syncThreshold: 80,
        notificationsEnabled: true,
        autoUpdateStatus: true
      },
      recent_syncs: []
    });
  }

  // Periodic alarm to check for new sites every 12 hours
  chrome.alarms.create('SYNC_CLOUDFLARE_SITES', { periodInMinutes: 720 });
  await syncSitesFromCloudflare();
});

// Run on browser startup & periodic alarm
chrome.runtime.onStartup.addListener(() => {
  syncSitesFromCloudflare();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'SYNC_CLOUDFLARE_SITES') {
    syncSitesFromCloudflare();
  }
});

// Flash success badge
async function flashBadge(text, color = '#10B981') {
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeText({ text });
  setTimeout(async () => {
    await chrome.action.setBadgeText({ text: '' });
  }, 4000);
}

// Show desktop notification
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

// Message handler for Popup and Content Scripts
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
            settings: settings || { syncThreshold: 80, notificationsEnabled: true },
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

// Centralized sync handler
async function handleSyncEpisode(animeTitle, episodeNumber) {
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
    return { success: false, error: `Could not find "${animeTitle}" on MyAnimeList` };
  }

  const currentMALWatched = anime.my_list_status?.num_episodes_watched || 0;
  if (currentMALWatched >= ep) {
    await chrome.storage.local.set({ [syncLockKey]: currentMALWatched });
    return { success: true, alreadySynced: true, message: `MAL is already at episode ${currentMALWatched}.` };
  }

  const updateResult = await malClient.updateWatchProgress(anime.id, ep, anime.num_episodes);
  await chrome.storage.local.set({ [syncLockKey]: ep });

  const { recent_syncs = [] } = await chrome.storage.local.get('recent_syncs');
  const syncRecord = {
    animeId: anime.id,
    title: anime.title,
    episode: ep,
    totalEpisodes: anime.num_episodes,
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
