// AniSync - Generic Streaming Page Content Script & Video Observer

(() => {
  const isTopFrame = window === window.top;
  let activeVideoElement = null;
  let hasSyncedThisEpisode = false;
  let currentEpisodeProgress = 0;
  let currentAnimeMetadata = null;
  let customRules = [];

  // Load any dynamically configured rules from storage
  chrome.storage.local.get('dynamic_site_rules').then(({ dynamic_site_rules }) => {
    if (Array.isArray(dynamic_site_rules)) {
      customRules = dynamic_site_rules;
    }
  }).catch(() => {});

  // Universal metadata extractor (agnostic to any specific site)
  function extractAnimeMetadata() {
    const hostname = window.location.hostname.toLowerCase();
    let title = '';
    let episode = null;

    // Check dynamic rules (configured via Cloudflare or user)
    const matchedRule = customRules.find(r => {
      if (Array.isArray(r.domains)) {
        return r.domains.some(d => hostname === d || hostname.endsWith('.' + d));
      }
      return r.domain && (hostname === r.domain || hostname.endsWith('.' + r.domain));
    });
    if (matchedRule) {
      if (matchedRule.titleSelector) {
        const el = document.querySelector(matchedRule.titleSelector);
        if (el) title = el.textContent.trim();
      }
      if (matchedRule.epSelector) {
        const el = document.querySelector(matchedRule.epSelector);
        if (el) {
          const val = el.getAttribute('data-number') || el.textContent;
          const match = val.match(/\b(\d+)\b/);
          if (match) episode = parseInt(match[1], 10);
        }
      }
    }

    // Universal Fallback: Document title and heading parsing
    if (!title || !episode) {
      const parsed = parseDocTitle(document.title);
      if (!title && parsed.title) title = parsed.title;
      if (!episode && parsed.episode) episode = parsed.episode;
    }

    // Additional generic fallback: Check primary page headings
    if (!title) {
      const h1 = document.querySelector('h1');
      if (h1) {
        const parsedH1 = parseDocTitle(h1.textContent);
        if (parsedH1.title) title = parsedH1.title;
        if (!episode && parsedH1.episode) episode = parsedH1.episode;
      }
    }

    // Clean up title
    if (title) {
      title = title
        .replace(/^(Watch|Stream)\s+/i, '')
        .replace(/\s+(English\s+Sub(?:bed)?|Eng\s+Dub|Sub|Dub|Free\s+Online).*$/i, '')
        .replace(/\s*[-–|:]\s*[\w\s.-]+$/i, '') // Strips generic trailing site name
        .trim();
    }

    if (title && episode) {
      return { title, episode };
    }

    return null;
  }

  // Parse generic strings like: "Watch Jujutsu Kaisen Episode 5 English Sub"
  function parseDocTitle(docTitle) {
    if (!docTitle) return { title: null, episode: null };

    let cleaned = docTitle
      .replace(/^(Watch|Stream)\s+/i, '')
      .replace(/\s+(HD|1080p|720p|Subbed|Dubbed|Online|Free).*$/i, '');

    const epMatch = cleaned.match(/(?:Episode|Ep\.?|E)\s*(\d+)/i);
    let episode = null;
    let title = null;

    if (epMatch) {
      episode = parseInt(epMatch[1], 10);
      title = cleaned.substring(0, epMatch.index)
        .replace(/[-–:]\s*$/, '')
        .trim();
    }

    return { title, episode };
  }

  // Top Frame: Periodically inspect metadata and broadcast to iframes
  if (isTopFrame) {
    setInterval(() => {
      const meta = extractAnimeMetadata();
      if (meta && (!currentAnimeMetadata || currentAnimeMetadata.episode !== meta.episode || currentAnimeMetadata.title !== meta.title)) {
        currentAnimeMetadata = meta;
        hasSyncedThisEpisode = false;

        // Broadcast to player iframes
        window.postMessage({
          source: 'ANISYNC_TOP_FRAME',
          type: 'METADATA_UPDATE',
          data: meta
        }, '*');
      }
    }, 2500);

    // Listen to messages from child player iframes
    window.addEventListener('message', (event) => {
      if (event.data?.source === 'ANISYNC_PLAYER_IFRAME') {
        const meta = currentAnimeMetadata || extractAnimeMetadata();
        if (!meta) return;

        const { percentage, currentTime, duration, isFinished } = event.data;

        chrome.runtime.sendMessage({
          type: 'UPDATE_PLAYBACK_STATUS',
          data: {
            animeTitle: meta.title,
            episodeNumber: meta.episode,
            percentage,
            currentTime,
            duration,
            site: window.location.hostname
          }
        }).catch(() => {});

        checkAndTriggerSync(meta.title, meta.episode, percentage, isFinished);
      }
    });
  }

  // Monitor Video Elements (runs in top frame and in player iframes)
  function setupVideoListeners(video) {
    if (activeVideoElement === video) return;
    activeVideoElement = video;

    const onProgress = () => {
      if (!video.duration || isNaN(video.duration)) return;
      const percentage = Math.round((video.currentTime / video.duration) * 100);
      currentEpisodeProgress = percentage;

      if (isTopFrame) {
        const meta = currentAnimeMetadata || extractAnimeMetadata();
        if (meta) {
          chrome.runtime.sendMessage({
            type: 'UPDATE_PLAYBACK_STATUS',
            data: {
              animeTitle: meta.title,
              episodeNumber: meta.episode,
              percentage,
              currentTime: video.currentTime,
              duration: video.duration,
              site: window.location.hostname
            }
          }).catch(() => {});

          checkAndTriggerSync(meta.title, meta.episode, percentage, false);
        }
      } else {
        window.parent.postMessage({
          source: 'ANISYNC_PLAYER_IFRAME',
          percentage,
          currentTime: video.currentTime,
          duration: video.duration,
          isFinished: false
        }, '*');
      }
    };

    const onEnded = () => {
      if (isTopFrame) {
        const meta = currentAnimeMetadata || extractAnimeMetadata();
        if (meta) checkAndTriggerSync(meta.title, meta.episode, 100, true);
      } else {
        window.parent.postMessage({
          source: 'ANISYNC_PLAYER_IFRAME',
          percentage: 100,
          currentTime: video.duration,
          duration: video.duration,
          isFinished: true
        }, '*');
      }
    };

    video.addEventListener('timeupdate', onProgress);
    video.addEventListener('ended', onEnded);
  }

  // Trigger sync with background
  async function checkAndTriggerSync(animeTitle, episodeNumber, percentage, isFinished) {
    if (hasSyncedThisEpisode) return;

    const { settings } = await chrome.storage.local.get('settings');
    const threshold = settings?.syncThreshold || 80;

    if (percentage >= threshold || isFinished) {
      hasSyncedThisEpisode = true;
      console.log(`[AniSync] Threshold reached (${percentage}%). Syncing "${animeTitle}" Episode ${episodeNumber}...`);

      chrome.runtime.sendMessage({
        type: 'SYNC_EPISODE',
        data: { animeTitle, episodeNumber }
      }, (res) => {
        if (res?.success) {
          console.log('[AniSync] Successfully synced with MyAnimeList:', res);
        } else {
          console.warn('[AniSync] Sync response:', res?.error || res?.message);
        }
      });
    }
  }

  // DOM observer to find <video> tags
  function findAndAttachVideo() {
    const video = document.querySelector('video');
    if (video) {
      setupVideoListeners(video);
    }
  }

  findAndAttachVideo();
  const observer = new MutationObserver(() => {
    findAndAttachVideo();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
