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
  const matchText = document.getElementById('match-text');
  const shortVersionNote = document.getElementById('short-version-note');
  const btnFixMatch = document.getElementById('btn-fix-match');
  const matchForm = document.getElementById('match-form');
  const matchInput = document.getElementById('match-input');
  const matchError = document.getElementById('match-error');

  const recentList = document.getElementById('recent-list');

  const toggleSettings = document.getElementById('toggle-settings');
  const settingsPanel = document.getElementById('settings-panel');
  const settingsArrow = document.getElementById('settings-arrow');
  const thresholdSlider = document.getElementById('threshold-slider');
  const thresholdVal = document.getElementById('threshold-val');
  const toggleNotifications = document.getElementById('toggle-notifications');
  const toggleAutoStatus = document.getElementById('toggle-auto-status');
  const toggleAniSkip = document.getElementById('toggle-aniskip');
  const toggleManga = document.getElementById('toggle-manga');
  const toggleRewatch = document.getElementById('toggle-rewatch');
  const toggleShortVersions = document.getElementById('toggle-short-versions');
  const btnClearCache = document.getElementById('btn-clear-cache');

  // What the current session card shows: the latest of the anime being watched and
  // the manga being read. { kind: 'anime'|'manga', title, number, pct, site, malId, malTitle }
  let currentSession = null;
  let latestPlayback = null;
  let latestReading = null;

  // Initialize UI state
  async function init() {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      if (res && res.isLoggedIn) {
        renderLoggedIn(res.profile, res.currentPlayback, res.currentReading, res.recentSyncs, res.settings);
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

  function renderLoggedIn(profile, playback, reading, recentSyncs, settings) {
    statusPill.className = 'status-pill online';
    statusText.textContent = 'Tracking Active';

    viewLoggedOut.classList.add('hidden');
    viewLoggedIn.classList.remove('hidden');

    // Profile
    if (profile) {
      userName.textContent = profile.name || 'MyAnimeList User';
      userAvatar.src = profile.picture || chrome.runtime.getURL('icons/icon48.png');
    }

    // Playback / reading
    latestPlayback = playback;
    latestReading = reading;
    updateSessionUI();

    // Recent Syncs
    renderRecentList(recentSyncs || []);

    // Settings
    if (settings) {
      thresholdSlider.value = settings.syncThreshold || 80;
      thresholdVal.textContent = `${thresholdSlider.value}%`;
      toggleNotifications.checked = settings.notificationsEnabled !== false;
      toggleAutoStatus.checked = settings.autoUpdateStatus !== false;
      toggleAniSkip.checked = settings.useAniSkip !== false;
      toggleManga.checked = settings.trackManga !== false;
      toggleRewatch.checked = settings.trackRewatches === true;
      toggleShortVersions.checked = settings.syncShortVersions !== false;
    }
  }

  const SESSION_FRESH_MS = 15 * 60 * 1000;

  function toSession(playback, reading) {
    const fresh = (x) => x && x.updatedAt && Date.now() - x.updatedAt < SESSION_FRESH_MS;
    const anime = fresh(playback) && playback.animeTitle ? {
      kind: 'anime',
      title: playback.animeTitle,
      number: playback.episodeNumber,
      pct: playback.percentage || 0,
      // Share of the episode that actually played (skips excluded)
      // Hidden until the detector reports it (it doesn't yet), instead of a fake "watched 0%"
      playedPct: playback.duration > 0 && playback.playedSeconds != null ? (playback.playedSeconds / playback.duration) * 100 : null,
      site: playback.site,
      malId: playback.malId || null,
      malTitle: playback.malTitle || null,
      reason: playback.reason || null,
      shortVersion: playback.shortVersion || null,
      updatedAt: playback.updatedAt
    } : null;
    const manga = fresh(reading) && reading.mangaTitle ? {
      kind: 'manga',
      title: reading.mangaTitle,
      number: reading.chapterNumber,
      pct: reading.maxProgress || reading.progress || 0,
      site: reading.site,
      malId: reading.malId || null,
      malTitle: reading.malTitle || null,
      updatedAt: reading.updatedAt
    } : null;
    if (anime && manga) return anime.updatedAt >= manga.updatedAt ? anime : manga;
    return anime || manga;
  }

  function updateSessionUI() {
    const session = toSession(latestPlayback, latestReading);
    const changed = !currentSession || !session ||
      currentSession.kind !== session.kind || currentSession.title !== session.title;
    currentSession = session;

    if (!session) {
      noPlayback.classList.remove('hidden');
      activePlayback.classList.add('hidden');
      return;
    }
    noPlayback.classList.add('hidden');
    activePlayback.classList.remove('hidden');

    playbackTitle.textContent = session.title;
    playbackTitle.title = session.title;
    playbackEp.textContent = `${session.kind === 'manga' ? 'CH' : 'EP'} ${session.number ?? '?'}`;
    const pct = Math.min(100, Math.max(0, Math.round(session.pct)));
    progressBarFill.style.width = `${pct}%`;
    const playedPct = session.playedPct != null ? Math.min(100, Math.round(session.playedPct)) : null;
    playbackPercentage.textContent = session.kind === 'manga'
      ? `${pct}% read`
      : `${pct}%${playedPct != null ? ` · watched ${playedPct}%` : ''}`;
    playbackPercentage.title = session.kind === 'manga' ? '' : 'Position in the video · share that actually played (an episode needs 50% played to count)';
    playbackSite.textContent = session.site || (session.kind === 'manga' ? 'Manga Site' : 'Streaming Site');

    // The match line is one line cut off with "…" (MAL titles are often long), so
    // anything the user must see goes on the note line below it instead
    matchText.textContent = session.malTitle
      ? `MAL: ${session.malTitle}`
      : 'Not matched on MyAnimeList yet';
    matchText.title = matchText.textContent;

    const sv = session.kind === 'anime' ? session.shortVersion : null;
    let note = '';
    if (session.reason) {
      note = `Not syncing: ${session.reason}.`;
    } else if (sv) {
      const min = (s) => { const m = s / 60; return `${m < 10 ? Math.round(m * 10) / 10 : Math.round(m)} min`; };
      note = `This site's version is ${min(sv.videoSeconds)}, MyAnimeList's is ${min(sv.malSeconds)}: ` +
        'scenes may be cut. It still counts when you watch it (Preferences → Sync Shortened Episodes).';
    }
    shortVersionNote.textContent = note;
    shortVersionNote.classList.toggle('hidden', !note);

    if (changed) {
      matchForm.classList.add('hidden');
      matchError.classList.add('hidden');
    }
  }

  function renderRecentList(syncs) {
    if (!syncs || syncs.length === 0) {
      recentList.innerHTML = '<div class="empty-state-sm">No episodes synced yet.</div>';
      return;
    }

    recentList.innerHTML = '';
    syncs.slice(0, 5).forEach(item => {
      const isManga = item.kind === 'manga';
      const a = document.createElement('a');
      a.className = 'recent-item';
      a.href = isManga
        ? `https://myanimelist.net/manga/${item.mangaId}`
        : `https://myanimelist.net/anime/${item.animeId}`;
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
      const repeatTag = item.repeat ? (isManga ? ' (reread)' : ' (rewatch)') : '';
      meta.textContent = isManga
        ? `Chapter ${item.chapter}${item.totalChapters ? ` / ${item.totalChapters}` : ''}${repeatTag} • ${formatTimeAgo(item.syncedAt)}`
        : `Episode ${item.episode}${item.totalEpisodes ? ` / ${item.totalEpisodes}` : ''}${repeatTag} • ${formatTimeAgo(item.syncedAt)}`;

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
    const session = currentSession;
    if (!session) return;

    btnForceSync.disabled = true;
    btnForceSync.textContent = 'Syncing...';

    try {
      const res = await chrome.runtime.sendMessage(session.kind === 'manga'
        ? {
          type: 'SYNC_CHAPTER',
          data: { mangaTitle: session.title, chapterNumber: session.number, malId: session.malId }
        }
        : {
          type: 'SYNC_EPISODE',
          data: { animeTitle: session.title, episodeNumber: session.number, malId: session.malId }
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
        alert(res?.error || 'Failed to sync.');
        btnForceSync.disabled = false;
        btnForceSync.textContent = 'Force Sync Now';
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
      btnForceSync.disabled = false;
      btnForceSync.textContent = 'Force Sync Now';
    }
  });

  // ---------- "Wrong match?": point this title at the right MAL entry ----------

  btnFixMatch.addEventListener('click', () => {
    const show = matchForm.classList.contains('hidden');
    matchForm.classList.toggle('hidden', !show);
    matchError.classList.add('hidden');
    if (show) {
      matchInput.value = '';
      matchInput.placeholder = `MyAnimeList ${currentSession?.kind === 'manga' ? 'manga' : 'anime'} link or ID`;
      matchInput.focus();
    }
  });

  // Accepts "https://myanimelist.net/manga/2/Berserk", "myanimelist.net/anime/5114" or "5114"
  function parseMalInput(text) {
    const str = (text || '').trim();
    const link = str.match(/myanimelist\.net\/(anime|manga)\/(\d{1,7})/i);
    if (link) return { kind: link[1].toLowerCase(), id: Number(link[2]) };
    if (/^\d{1,7}$/.test(str) && Number(str) > 0) return { kind: null, id: Number(str) };
    return null;
  }

  function showMatchError(text) {
    matchError.textContent = text;
    matchError.classList.remove('hidden');
  }

  matchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const session = currentSession;
    if (!session) return;
    const parsed = parseMalInput(matchInput.value);
    if (!parsed) return showMatchError('Paste a MyAnimeList link (or just the number in it).');
    if (parsed.kind && parsed.kind !== session.kind) {
      return showMatchError(`That's a MyAnimeList ${parsed.kind} link, but this is ${session.kind === 'manga' ? 'a manga' : 'an anime'}.`);
    }

    const btn = document.getElementById('btn-save-match');
    btn.disabled = true;
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'SET_MATCH_OVERRIDE',
        data: { kind: session.kind, title: session.title, malId: parsed.id }
      });
      if (res?.success) {
        matchForm.classList.add('hidden');
        matchError.classList.add('hidden');
        session.malId = res.entry.id;
        session.malTitle = res.entry.title;
        matchText.textContent = `MAL: ${res.entry.title}`;
        matchText.title = matchText.textContent;
      } else {
        showMatchError(res?.error || 'Could not save the match.');
      }
    } catch (err) {
      showMatchError(err.message || 'Could not save the match.');
    } finally {
      btn.disabled = false;
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

  // Manga toggle change
  toggleManga.addEventListener('change', async (e) => {
    const { settings = {} } = await chrome.storage.local.get('settings');
    settings.trackManga = e.target.checked;
    await chrome.storage.local.set({ settings });
  });

  // Rewatch / reread tracking toggle
  toggleRewatch.addEventListener('change', async (e) => {
    const { settings = {} } = await chrome.storage.local.get('settings');
    settings.trackRewatches = e.target.checked;
    await chrome.storage.local.set({ settings });
  });

  // Count episodes the site shortened (e.g. scenes cut)
  toggleShortVersions.addEventListener('change', async (e) => {
    const { settings = {} } = await chrome.storage.local.get('settings');
    settings.syncShortVersions = e.target.checked;
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
    let text = `${meta.sites} anime sites · ${meta.mangaSites || 0} manga sites · ${meta.domains + (meta.mangaDomains || 0)} domains · checked ${formatTimeAgo(meta.checkedAt)} (${meta.source})`;
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
      const kinds = [st.builtinAnime && 'anime', st.builtinManga && 'manga'].filter(Boolean).join(' + ');
      siteState.textContent = `✓ Supported out of the box${kinds ? ` (${kinds})` : ''}`;
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
    const { current_playback, current_reading } = await chrome.storage.local.get(['current_playback', 'current_reading']);
    latestPlayback = current_playback || null;
    latestReading = current_reading || null;
    updateSessionUI();
  }, 3000);
});
