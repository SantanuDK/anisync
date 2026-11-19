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
      if (res && res.success) {
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
