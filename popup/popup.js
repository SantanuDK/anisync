// AniSync - Popup UI Script

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const statusPill = document.getElementById('status-pill');
  const statusText = document.getElementById('status-text');

  const viewLoggedOut = document.getElementById('view-logged-out');
  const viewLoggedIn = document.getElementById('view-logged-in');

  const btnLogin = document.getElementById('btn-login');
  const btnLogout = document.getElementById('btn-logout');
  const authError = document.getElementById('auth-error');

  const userAvatar = document.getElementById('user-avatar');
  const userName = document.getElementById('user-name');

  const noPlayback = document.getElementById('no-playback');
  const activePlayback = document.getElementById('active-playback');
  const playbackTitle = document.getElementById('playback-title');
  const playbackEp = document.getElementById('playback-ep');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const playbackPercentage = document.getElementById('playback-percentage');
  const playbackSite = document.getElementById('playback-site');
  const btnForceSync = document.getElementById('btn-force-sync');

  const recentList = document.getElementById('recent-list');

  const toggleSettings = document.getElementById('toggle-settings');
  const settingsPanel = document.getElementById('settings-panel');
  const settingsArrow = document.getElementById('settings-arrow');
  const thresholdSlider = document.getElementById('threshold-slider');
  const thresholdVal = document.getElementById('threshold-val');
  const toggleNotifications = document.getElementById('toggle-notifications');
  const toggleAutoStatus = document.getElementById('toggle-auto-status');
  const toggleAniSkip = document.getElementById('toggle-aniskip');
  const btnClearCache = document.getElementById('btn-clear-cache');

  let currentPlaybackData = null;

  // Initialize UI state
  async function init() {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      if (res && res.isLoggedIn) {
        renderLoggedIn(res.profile, res.currentPlayback, res.recentSyncs, res.settings);
      } else {
        renderLoggedOut();
      }
    } catch (err) {
      console.error('Failed to get status:', err);
      renderLoggedOut();
    }
  }

  function renderLoggedOut() {
    statusPill.className = 'status-pill offline';
    statusText.textContent = 'Disconnected';
    viewLoggedOut.classList.remove('hidden');
    viewLoggedIn.classList.add('hidden');
  }

  function renderLoggedIn(profile, playback, recentSyncs, settings) {
    statusPill.className = 'status-pill online';
    statusText.textContent = 'Tracking Active';

    viewLoggedOut.classList.add('hidden');
    viewLoggedIn.classList.remove('hidden');

    // Profile
    if (profile) {
      userName.textContent = profile.name || 'MyAnimeList User';
      userAvatar.src = profile.picture || chrome.runtime.getURL('icons/icon48.png');
    }

    // Playback
    updatePlaybackUI(playback);

    // Recent Syncs
    renderRecentList(recentSyncs || []);

    // Settings
    if (settings) {
      thresholdSlider.value = settings.syncThreshold || 80;
      thresholdVal.textContent = `${thresholdSlider.value}%`;
      toggleNotifications.checked = settings.notificationsEnabled !== false;
      toggleAutoStatus.checked = settings.autoUpdateStatus !== false;
      toggleAniSkip.checked = settings.useAniSkip !== false;
    }
  }

  function updatePlaybackUI(playback) {
    currentPlaybackData = playback;
    // Consider active if updated within the last 15 minutes
    const isRecent = playback && playback.updatedAt && (Date.now() - playback.updatedAt < 15 * 60 * 1000);

    if (isRecent && playback.animeTitle) {
      noPlayback.classList.add('hidden');
      activePlayback.classList.remove('hidden');

      playbackTitle.textContent = playback.animeTitle;
      playbackTitle.title = playback.animeTitle;
      playbackEp.textContent = `EP ${playback.episodeNumber || '?'}`;
      const pct = Math.min(100, Math.max(0, playback.percentage || 0));
      progressBarFill.style.width = `${pct}%`;
      playbackPercentage.textContent = `${pct}%`;
      playbackSite.textContent = playback.site || 'Streaming Site';
    } else {
      noPlayback.classList.remove('hidden');
      activePlayback.classList.add('hidden');
    }
  }

  function renderRecentList(syncs) {
    if (!syncs || syncs.length === 0) {
      recentList.innerHTML = '<div class="empty-state-sm">No episodes synced yet.</div>';
      return;
    }

    recentList.innerHTML = '';
    syncs.slice(0, 5).forEach(item => {
      const a = document.createElement('a');
      a.className = 'recent-item';
      a.href = `https://myanimelist.net/anime/${item.animeId}`;
      a.target = '_blank';
      a.rel = 'noopener';

      const img = document.createElement('img');
      img.className = 'recent-thumb';
      img.src = item.imageUrl || chrome.runtime.getURL('icons/icon48.png');
      img.alt = item.title;

      const info = document.createElement('div');
      info.className = 'recent-info';

      const title = document.createElement('div');
      title.className = 'recent-title';
      title.textContent = item.title;

      const meta = document.createElement('div');
      meta.className = 'recent-meta';
      meta.textContent = `Episode ${item.episode}${item.totalEpisodes ? ` / ${item.totalEpisodes}` : ''} • ${formatTimeAgo(item.syncedAt)}`;

      info.appendChild(title);
      info.appendChild(meta);
      a.appendChild(img);
      a.appendChild(info);
      recentList.appendChild(a);
    });
  }

  function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Just now';
    const elapsed = Math.floor((Date.now() - timestamp) / 1000);
    if (elapsed < 60) return 'Just now';
    if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ago`;
    if (elapsed < 86400) return `${Math.floor(elapsed / 3600)}h ago`;
    return `${Math.floor(elapsed / 86400)}d ago`;
  }

  // Login handler
  btnLogin.addEventListener('click', async () => {
    btnLogin.disabled = true;
    btnLogin.textContent = 'Connecting to MAL...';
    authError.classList.add('hidden');

    try {
      const res = await chrome.runtime.sendMessage({ type: 'LOGIN' });
      if (res && res.success && res.pending) {
        // Firefox / Android: login continues in the MyAnimeList tab that just opened
        authError.textContent = 'Finish logging in on the MyAnimeList tab, then open AniSync again.';
        authError.classList.remove('hidden');
      } else if (res && res.success) {
        init();
      } else {
        authError.textContent = res?.error || 'Login failed. Please try again.';
        authError.classList.remove('hidden');
      }
    } catch (err) {
      authError.textContent = err.message || 'Login encountered an error.';
      authError.classList.remove('hidden');
    } finally {
      btnLogin.disabled = false;
      btnLogin.innerHTML = `
        <svg class="mal-icon" viewBox="0 0 24 24" width="18" height="18">
          <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm4 0h-2v-6h2v6zm-2-8c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
        </svg>
        Log in with MyAnimeList
      `;
    }
  });

  // Logout handler
  btnLogout.addEventListener('click', async () => {
    if (confirm('Disconnect MyAnimeList account?')) {
      await chrome.runtime.sendMessage({ type: 'LOGOUT' });
      renderLoggedOut();
    }
  });

  // Force Sync button
  btnForceSync.addEventListener('click', async () => {
    if (!currentPlaybackData || !currentPlaybackData.animeTitle) return;

    btnForceSync.disabled = true;
    btnForceSync.textContent = 'Syncing...';

    try {
      const res = await chrome.runtime.sendMessage({
        type: 'SYNC_EPISODE',
        data: {
          animeTitle: currentPlaybackData.animeTitle,
          episodeNumber: currentPlaybackData.episodeNumber
        }
      });

      if (res && res.success) {
        btnForceSync.textContent = 'Synced ✓';
        setTimeout(() => {
          btnForceSync.disabled = false;
          btnForceSync.textContent = 'Force Sync Now';
        }, 2000);
        // Refresh recent
        const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
        if (status?.recentSyncs) renderRecentList(status.recentSyncs);
      } else {
        alert(res?.error || 'Failed to sync episode.');
        btnForceSync.disabled = false;
        btnForceSync.textContent = 'Force Sync Now';
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
      btnForceSync.disabled = false;
      btnForceSync.textContent = 'Force Sync Now';
    }
  });

  // Settings toggle
  toggleSettings.addEventListener('click', () => {
    const isHidden = settingsPanel.classList.toggle('hidden');
    settingsArrow.textContent = isHidden ? '▼' : '▲';
  });

  // Threshold slider change
  thresholdSlider.addEventListener('input', (e) => {
    thresholdVal.textContent = `${e.target.value}%`;
  });

  thresholdSlider.addEventListener('change', async (e) => {
    const { settings = {} } = await chrome.storage.local.get('settings');
    settings.syncThreshold = parseInt(e.target.value, 10);
    await chrome.storage.local.set({ settings });
  });

  // Notification toggle change
  toggleNotifications.addEventListener('change', async (e) => {
    const { settings = {} } = await chrome.storage.local.get('settings');
    settings.notificationsEnabled = e.target.checked;
    await chrome.storage.local.set({ settings });
  });

  // Auto status toggle change
  toggleAutoStatus.addEventListener('change', async (e) => {
    const { settings = {} } = await chrome.storage.local.get('settings');
    settings.autoUpdateStatus = e.target.checked;
    await chrome.storage.local.set({ settings });
  });

  // AniSkip toggle change
  toggleAniSkip.addEventListener('change', async (e) => {
    const { settings = {} } = await chrome.storage.local.get('settings');
    settings.useAniSkip = e.target.checked;
    await chrome.storage.local.set({ settings });
  });

  // ---------- Site list freshness (full edition) ----------
  const siteListRow = document.getElementById('site-list-row');
  const siteListInfo = document.getElementById('site-list-info');
  const btnRefreshSites = document.getElementById('btn-refresh-sites');

  function renderSiteList(meta, canRefresh) {
    siteListRow.classList.toggle('hidden', !canRefresh);
    if (!meta) {
      siteListInfo.textContent = 'Not loaded yet';
      return;
    }
    let text = `${meta.sites} sites · ${meta.domains} domains · checked ${formatTimeAgo(meta.checkedAt)} (${meta.source})`;
    const ch = meta.lastChange;
    if (ch) text += ` · last change ${formatTimeAgo(ch.at)}: +${ch.added.length} / −${ch.removed.length}`;
    siteListInfo.textContent = text;
    siteListInfo.title = ch ? `Added: ${ch.added.join(', ') || '—'}\nRemoved: ${ch.removed.join(', ') || '—'}` : '';
  }

  chrome.runtime.sendMessage({ type: 'GET_STATUS' }).then((res) => {
    if (res) renderSiteList(res.siteList, res.canRefreshSites);
  }).catch(() => {});

  btnRefreshSites.addEventListener('click', async () => {
    btnRefreshSites.disabled = true;
    btnRefreshSites.textContent = 'Updating...';
    try {
      const res = await chrome.runtime.sendMessage({ type: 'REFRESH_SITES_NOW' });
      renderSiteList(res?.siteList, true);
    } catch (_) {}
    btnRefreshSites.disabled = false;
    btnRefreshSites.textContent = 'Update now';
  });

  // Clear cached title matches so the next sync re-searches MAL
  btnClearCache.addEventListener('click', async () => {
    btnClearCache.disabled = true;
    try {
      const res = await chrome.runtime.sendMessage({ type: 'CLEAR_MATCH_CACHE' });
      btnClearCache.textContent = res?.success ? 'Cleared ✓' : 'Failed';
    } catch (err) {
      btnClearCache.textContent = 'Failed';
    }
    setTimeout(() => {
      btnClearCache.disabled = false;
      btnClearCache.textContent = 'Reset';
    }, 2000);
  });

  // ---------- This site / user-enabled sites ----------

  const siteSection = document.getElementById('site-section');
  const siteHost = document.getElementById('site-host');
  const siteState = document.getElementById('site-state');
  const siteHint = document.getElementById('site-hint');
  const btnSiteToggle = document.getElementById('btn-site-toggle');
  const userSitesList = document.getElementById('user-sites-list');
  const siteAccessBanner = document.getElementById('site-access-banner');
  const siteAccessCount = document.getElementById('site-access-count');
  const btnGrantAll = document.getElementById('btn-grant-all');

  // Embeds that are never the video player (ads, comments, captchas, analytics)
  const IGNORED_FRAME_HOSTS = [
    'google.com', 'googlesyndication.com', 'doubleclick.net', 'googletagmanager.com', 'gstatic.com',
    'facebook.com', 'twitter.com', 'x.com', 'disqus.com', 'recaptcha.net', 'hcaptcha.com',
    'discord.com', 'cloudflare.com', 'amazon-adsystem.com', 'youtube.com'
  ];

  let siteCtx = null;    // { tabId, host, frames }
  let siteStatus = null; // response of SITE_STATUS

  const originsFor = (host) => [`*://${host}/*`, `*://*.${host}/*`];
  const normalizeHost = (h) => (h || '').toLowerCase().replace(/^www\./, '');

  // Player iframes live on other domains; the store edition needs access to them too.
  async function collectFrameHosts(tabId, host) {
    if (!chrome.scripting?.executeScript) return [];
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => [...document.querySelectorAll('iframe')]
          .map(f => f.src || f.getAttribute('data-src') || '')
          .filter(Boolean)
      });
      const hosts = new Set();
      for (const src of results?.[0]?.result || []) {
        try {
          const h = normalizeHost(new URL(src).hostname);
          const ignored = IGNORED_FRAME_HOSTS.some(i => h === i || h.endsWith('.' + i));
          if (h && h !== host && !h.endsWith('.' + host) && !ignored) hosts.add(h);
        } catch (_) {}
      }
      return [...hosts].slice(0, 6);
    } catch (_) {
      return [];
    }
  }

  function renderUserSites(sites) {
    userSitesList.innerHTML = '';
    if (!sites || sites.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state-sm';
      empty.textContent = 'No sites added yet.';
      userSitesList.appendChild(empty);
      return;
    }
    for (const site of sites) {
      const row = document.createElement('div');
      row.className = 'user-site-item';
      const name = document.createElement('span');
      name.textContent = site.domain;
      name.title = site.frames?.length ? `Player: ${site.frames.join(', ')}` : site.domain;
      const btn = document.createElement('button');
      btn.className = 'btn-remove';
      btn.title = `Remove ${site.domain}`;
      btn.textContent = '×';
      btn.addEventListener('click', async () => {
        await removeUserSite(site.domain);
        await initSite();
      });
      row.appendChild(name);
      row.appendChild(btn);
      userSitesList.appendChild(row);
    }
  }

  function renderSite() {
    const st = siteStatus;
    renderUserSites(st?.userSites || []);

    const needing = st?.needingAccess || [];
    siteAccessBanner.classList.toggle('hidden', needing.length === 0);
    siteAccessCount.textContent = String(needing.length);

    if (!siteCtx || !st) {
      siteSection.classList.add('hidden');
      return;
    }
    siteSection.classList.remove('hidden');
    siteHost.textContent = siteCtx.host;
    siteState.classList.remove('site-state-on');
    siteHint.classList.add('hidden');
    btnSiteToggle.classList.remove('hidden');
    btnSiteToggle.disabled = false;

    if (st.builtin) {
      siteState.textContent = '✓ Supported out of the box';
      siteState.classList.add('site-state-on');
      btnSiteToggle.classList.add('hidden');
    } else if (st.userSite) {
      siteState.textContent = '✓ Enabled by you';
      siteState.classList.add('site-state-on');
      btnSiteToggle.textContent = 'Disable';
    } else {
      siteState.textContent = 'Not tracked on this site';
      btnSiteToggle.textContent = 'Enable';
      if (!st.staticContentScripts) siteHint.classList.remove('hidden');
    }
  }

  async function initSite() {
    let tab = null;
    try {
      [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    } catch (_) {}

    let host = null;
    try {
      const url = new URL(tab?.url || '');
      if (url.protocol === 'http:' || url.protocol === 'https:') host = normalizeHost(url.hostname);
    } catch (_) {}

    try {
      siteStatus = await chrome.runtime.sendMessage({ type: 'SITE_STATUS', hostname: host || '' });
    } catch (_) {
      siteStatus = null;
    }

    siteCtx = host ? { tabId: tab.id, host, frames: siteCtx?.host === host ? siteCtx.frames : [] } : null;
    renderSite();

    // Look for the player iframe up front, so the click handler can request
    // permission immediately (permission prompts need a direct user click)
    if (siteCtx && siteStatus && !siteStatus.staticContentScripts && !siteStatus.builtin && !siteStatus.userSite) {
      siteCtx.frames = await collectFrameHosts(siteCtx.tabId, siteCtx.host);
    }
  }

  async function removeUserSite(domain) {
    const { user_sites = [] } = await chrome.storage.sync.get('user_sites');
    const site = user_sites.find(s => s.domain === domain);
    const remaining = user_sites.filter(s => s.domain !== domain);
    await chrome.storage.sync.set({ user_sites: remaining });

    if (site && siteStatus && !siteStatus.staticContentScripts) {
      // Don't revoke a player host another enabled site still uses
      const stillUsed = new Set(remaining.flatMap(s => [s.domain, ...(s.frames || [])]));
      const hosts = [site.domain, ...(site.frames || [])].filter(h => !stillUsed.has(h));
      if (hosts.length) {
        try {
          await chrome.permissions.remove({ origins: hosts.flatMap(originsFor) });
        } catch (_) {}
      }
    }
    await chrome.runtime.sendMessage({ type: 'APPLY_USER_SITES' }).catch(() => {});
  }

  btnSiteToggle.addEventListener('click', async () => {
    if (!siteCtx || !siteStatus) return;
    const { tabId, host, frames } = siteCtx;

    if (siteStatus.userSite) {
      btnSiteToggle.disabled = true;
      await removeUserSite(siteStatus.userSite.domain);
      chrome.tabs.reload(tabId).catch(() => {});
      await initSite();
      return;
    }

    // Store edition: ask the browser for access first (must be the first await after the click)
    if (!siteStatus.staticContentScripts) {
      let granted = false;
      try {
        granted = await chrome.permissions.request({ origins: [host, ...frames].flatMap(originsFor) });
      } catch (err) {
        siteState.textContent = `Could not request access: ${err.message}`;
        return;
      }
      if (!granted) {
        siteState.textContent = 'Access was not granted';
        return;
      }
    }

    btnSiteToggle.disabled = true;
    const { user_sites = [] } = await chrome.storage.sync.get('user_sites');
    const next = user_sites.filter(s => s.domain !== host).concat([{ domain: host, frames }]);
    await chrome.storage.sync.set({ user_sites: next });

    // Make sure the detector is registered before reloading the page
    await chrome.runtime.sendMessage({ type: 'APPLY_USER_SITES' }).catch(() => {});
    chrome.tabs.reload(tabId).catch(() => {});
    await initSite();
  });

  btnGrantAll.addEventListener('click', async () => {
    const needing = new Set(siteStatus?.needingAccess || []);
    const sites = (siteStatus?.userSites || []).filter(s => needing.has(s.domain));
    const origins = sites.flatMap(s => [s.domain, ...(s.frames || [])]).flatMap(originsFor);
    if (origins.length === 0) return;
    try {
      const granted = await chrome.permissions.request({ origins });
      if (granted) await chrome.runtime.sendMessage({ type: 'APPLY_USER_SITES' }).catch(() => {});
    } catch (_) {}
    await initSite();
  });

  initSite();

  // Initial load
  init();

  // Poll for live playback changes while popup is open
  setInterval(async () => {
    const { current_playback } = await chrome.storage.local.get('current_playback');
    if (current_playback) {
      updatePlaybackUI(current_playback);
    }
  }, 3000);
});
