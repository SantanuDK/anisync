// AniSync - Streaming Page Content Script & Video Observer
//
// Runs in every frame. Top frames only activate on supported streaming domains.
// Player iframes (which live on arbitrary embed domains) ask the background whether
// their tab is a supported site, then relay progress through the extension.

(() => {
  if (window.__anisyncDetectorLoaded) return;
  window.__anisyncDetectorLoaded = true;

  const isTopFrame = window === window.top;

  // Shorter videos (ads, trailers, previews) never count as an episode
  const MIN_EPISODE_SECONDS = 120;
  const STATUS_THROTTLE_MS = 3000;
  const IFRAME_THROTTLE_MS = 2000;
  const SYNC_RETRY_MS = 60 * 1000;

  let activeVideo = null;
  let detachVideo = null;
  let customRules = [];
  let syncThreshold = 80;

  // ---------- Domain helpers ----------

  function hostMatches(hostname, domain) {
    const h = hostname.toLowerCase().replace(/^www\./, '');
    const d = (domain || '').toLowerCase().replace(/^www\./, '');
    return !!d && (h === d || h.endsWith('.' + d));
  }

  function isSupportedHost(hostname, domains) {
    return domains.some(d => hostMatches(hostname, d));
  }

  // ---------- Metadata extraction ----------

  // "/episode-12", "-ep12", "/ep/12", "?ep=12", "?episode=12"
  const EP_URL_RE = /(?:^|[\/\-_.?&=])(?:episode|ep)[-_\/=]?(\d{1,4})(?=$|[\/\-_.?&#])/i;
  // "s01e05"
  const SXE_RE = /\bs\d{1,2}e(\d{1,4})\b/i;
  // "Episode 5", "Ep. 5", "Ep5", "S01E05", "E05", and Ani-One style "《Title》#5"
  const EP_TEXT_RE = /\b(?:episode|ep\.?)\s*(\d{1,4})\b|\bS\d{1,2}E(\d{1,4})\b|\bE(\d{1,4})\b|[》」』]\s*#(\d{1,4})(?=[\s(\[【]|$)/i;

  // Videos about an episode rather than the episode itself (matters on YouTube/Bilibili,
  // which are on the supported list because of official anime channels)
  const NOT_EPISODE_RE = /\b(reactions?|reacts?|reacting|review|recap|explained|breakdown|analysis|amv|trailer|teaser|pv|preview|opening|ending|op|ed|ost|soundtrack|clip|scene|edit|shorts|tier list|top \d+|podcast|cosplay|abridged|parody|fan ?made|fan ?dub|live[- ]action|full movie|compilation)\b|\bepisodes?\s*\d+\s*(?:to|-|–|~)\s*\d+/i;

  // General video platforms host lots of fan content around anime. There, only
  // episode-length videos count (official uploads are ~20-25 min).
  const GENERAL_PLATFORMS = ['youtube.com', 'bilibili.com', 'bilibili.tv', 'dailymotion.com'];
  const PLATFORM_MIN_SECONDS = 15 * 60;
  const PLATFORM_MAX_SECONDS = 40 * 60;

  function isEpisodeLength(duration) {
    const onPlatform = GENERAL_PLATFORMS.some(d => hostMatches(window.location.hostname, d));
    if (onPlatform) return duration >= PLATFORM_MIN_SECONDS && duration <= PLATFORM_MAX_SECONDS;
    return duration >= MIN_EPISODE_SECONDS;
  }

  // First visible, non-empty <h1>. SPA sites (e.g. YouTube) keep hidden or stale
  // headings from previous pages in the DOM.
  function mainHeading() {
    for (const h of document.querySelectorAll('h1')) {
      const text = h.textContent.trim();
      if (text.length > 1 && h.getClientRects().length > 0) return text;
    }
    return '';
  }

  function toEpisode(str) {
    const n = parseInt(str, 10);
    return n >= 1 && n <= 5000 ? n : null;
  }

  function extractAnimeMetadata() {
    const hostname = window.location.hostname;
    let title = '';
    let episode = null;

    // 1. Site-specific selectors, if the remote rules provide them
    const matchedRule = customRules.find(r => {
      const list = Array.isArray(r.domains) ? r.domains : [r.domain];
      return list.some(d => hostMatches(hostname, d));
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
          const match = val.match(/\b(\d{1,4})\b/);
          if (match) episode = toEpisode(match[1]);
        }
      }
    }

    // 2. Highlighted entry in the episode list (SPA streaming sites)
    if (!episode) {
      const activeEpEl = document.querySelector(
        'a.active[href*="ep"], a[class*="active"][href*="ep"], [class*="active"][data-number], .episode-item.active, .ep-item.active, .ssl-item.active, li.active a[href*="ep"]'
      );
      if (activeEpEl) {
        const dataNum = activeEpEl.getAttribute('data-number');
        if (dataNum) {
          episode = toEpisode(dataNum);
        } else {
          const href = activeEpEl.getAttribute('href') || '';
          const hrefMatch = href.match(EP_URL_RE) || href.match(SXE_RE);
          if (hrefMatch) {
            episode = toEpisode(hrefMatch[1]);
          } else {
            const textMatch = activeEpEl.textContent.match(/\b(\d{1,4})\b/);
            if (textMatch) episode = toEpisode(textMatch[1]);
          }
        }
      }
    }

    // 3. URL path / query
    if (!episode) {
      const path = window.location.pathname;
      const urlMatch = path.match(EP_URL_RE) || path.match(SXE_RE) || window.location.search.match(EP_URL_RE);
      if (urlMatch) episode = toEpisode(urlMatch[1]);
    }

    // 4. Main heading
    const h1Text = mainHeading();
    if (!title) {
      if (h1Text) {
        const parsedH1 = parseDocTitle(h1Text);
        if (parsedH1.title) {
          title = parsedH1.title;
          if (!episode && parsedH1.episode) episode = parsedH1.episode;
        } else {
          title = h1Text;
        }
      }
    }

    // 5. Document title
    if (!title || !episode) {
      const parsed = parseDocTitle(document.title);
      if (!title && parsed.title) title = parsed.title;
      if (!episode && parsed.episode) episode = parsed.episode;
    }

    if (NOT_EPISODE_RE.test(document.title) || NOT_EPISODE_RE.test(h1Text)) return null;

    if (title) title = cleanTitle(title);

    if (title && title.length > 1 && episode) {
      return { title, episode };
    }
    return null;
  }

  // Strip a trailing " - SiteName" / " | SiteName" only when it really looks like a
  // site name, so subtitles like "Re:Zero - Starting Life in Another World" survive.
  function stripSiteSuffix(str) {
    const m = str.match(/^(.+?)\s+[-–|]\s+([^-–|]+)$/);
    if (!m) return str;
    const suffix = m[2].toLowerCase().replace(/[^a-z0-9]/g, '');
    const labels = window.location.hostname.toLowerCase().replace(/^www\./, '').split('.');
    const siteBase = (labels.length > 1 ? labels[labels.length - 2] : labels[0]).replace(/[^a-z0-9]/g, '');
    const looksLikeSite = (siteBase.length > 2 && suffix.includes(siteBase)) ||
      /anime|watch|stream|online|free|\btv$/.test(m[2].toLowerCase());
    return looksLikeSite ? m[1] : str;
  }

  function cleanTitle(str) {
    let out = str
      .replace(/【[^】]*】/g, ' ')        // channel tags like 【Ani-One Asia】
      .replace(/[《》「」『』]/g, ' ')    // title brackets
      .replace(/^\s*(Watch|Stream)\s+/i, '')
      .replace(/\s+(English\s+Sub(?:bed)?|Eng\s+Dub|Sub|Dub|Free\s+Online|HD|1080p|720p)\b.*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    out = stripSiteSuffix(out);
    return out.replace(/[-–:|]\s*$/, '').trim();
  }

  // Parse strings like "Watch Jujutsu Kaisen Episode 5 English Sub"
  function parseDocTitle(docTitle) {
    if (!docTitle) return { title: null, episode: null };

    const cleaned = docTitle
      .replace(/^(Watch|Stream)\s+/i, '')
      .replace(/\s+(HD|1080p|720p|Subbed|Dubbed|Online|Free)\b.*$/i, '');

    const epMatch = cleaned.match(EP_TEXT_RE);
    if (!epMatch) return { title: null, episode: null };

    const episode = toEpisode(epMatch[1] || epMatch[2] || epMatch[3] || epMatch[4]);
    const title = cleaned.substring(0, epMatch.index)
      .replace(/[-–:|]\s*$/, '')
      .trim();

    return { title: title || null, episode };
  }

  // ---------- Video observation (shared by top frame and iframes) ----------

  // Prefer the longest video on the page so small preview/ad players are ignored
  function pickVideo() {
    const videos = [...document.querySelectorAll('video')];
    if (videos.length <= 1) return videos[0] || null;
    return videos.reduce((best, v) => ((v.duration || 0) > (best.duration || 0) ? v : best));
  }

  function watchVideos(onProgress) {
    const attach = () => {
      const video = pickVideo();
      if (!video || video === activeVideo) return;

      if (detachVideo) detachVideo();
      activeVideo = video;

      const handler = (isFinished) => () => {
        const duration = video.duration;
        if (!duration || !isFinite(duration)) return;
        onProgress({
          percentage: isFinished ? 100 : Math.round((video.currentTime / duration) * 100),
          currentTime: isFinished ? duration : video.currentTime,
          duration,
          isFinished
        });
      };

      const onTime = handler(false);
      const onEnd = handler(true);
      video.addEventListener('timeupdate', onTime);
      video.addEventListener('ended', onEnd);
      detachVideo = () => {
        video.removeEventListener('timeupdate', onTime);
        video.removeEventListener('ended', onEnd);
      };
    };

    attach();

    // Debounced: some players mutate the DOM many times per second
    let pending = null;
    const observer = new MutationObserver(() => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        attach();
      }, 1000);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  // ---------- Player iframe mode ----------

  function startIframe() {
    let lastSent = 0;
    watchVideos((progress) => {
      const now = Date.now();
      if (!progress.isFinished && now - lastSent < IFRAME_THROTTLE_MS) return;
      lastSent = now;
      chrome.runtime.sendMessage({ type: 'IFRAME_PROGRESS', data: progress }).catch(() => {});
    });
  }

  // ---------- Top frame mode ----------

  function startTopFrame() {
    let currentMeta = null;
    let syncState = 'idle'; // idle | pending | done
    let retryAt = 0;
    let lastStatusSent = 0;

    chrome.storage.local.get('settings').then(({ settings }) => {
      if (settings?.syncThreshold) syncThreshold = settings.syncThreshold;
    }).catch(() => {});

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.settings?.newValue?.syncThreshold) {
        syncThreshold = changes.settings.newValue.syncThreshold;
      }
      if (Array.isArray(changes.dynamic_site_rules?.newValue)) {
        customRules = changes.dynamic_site_rules.newValue;
      }
    });

    function refreshMeta() {
      const meta = extractAnimeMetadata();
      if (!meta) {
        // Navigated to something that isn't an episode: forget the old one so its
        // progress can't be credited with the new video's playback
        currentMeta = null;
      } else if (!currentMeta || currentMeta.episode !== meta.episode || currentMeta.title !== meta.title) {
        currentMeta = meta;
        syncState = 'idle';
        retryAt = 0;
      }
      return currentMeta;
    }

    function handleProgress({ percentage, currentTime, duration, isFinished }) {
      const meta = currentMeta || refreshMeta();
      if (!meta) return;

      const now = Date.now();
      if (isFinished || now - lastStatusSent >= STATUS_THROTTLE_MS) {
        lastStatusSent = now;
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
      }

      if (!isEpisodeLength(duration)) return;
      if (syncState !== 'idle' || now < retryAt) return;
      if (percentage < syncThreshold && !isFinished) return;

      // Mark pending synchronously so rapid timeupdate events cannot double-send
      syncState = 'pending';
      const syncedMeta = meta;
      console.log(`[AniSync] Threshold reached (${percentage}%). Syncing "${meta.title}" Episode ${meta.episode}...`);

      chrome.runtime.sendMessage({
        type: 'SYNC_EPISODE',
        data: { animeTitle: meta.title, episodeNumber: meta.episode }
      }).then((res) => {
        if (currentMeta !== syncedMeta) return; // Episode changed meanwhile
        if (res?.success) {
          syncState = 'done';
          console.log('[AniSync] Synced with MyAnimeList:', res.message || res.anime?.title);
        } else {
          syncState = 'idle';
          retryAt = Date.now() + SYNC_RETRY_MS;
          console.warn('[AniSync] Sync failed:', res?.error);
        }
      }).catch((err) => {
        if (currentMeta !== syncedMeta) return;
        syncState = 'idle';
        retryAt = Date.now() + SYNC_RETRY_MS;
        console.warn('[AniSync] Sync error:', err?.message);
      });
    }

    refreshMeta();
    setInterval(refreshMeta, 2500);

    // Progress relayed by the background from this tab's player iframes
    chrome.runtime.onMessage.addListener((message) => {
      if (message?.type === 'FRAME_PROGRESS' && message.data) {
        handleProgress(message.data);
      }
    });

    watchVideos(handleProgress);
  }

  // ---------- Boot ----------

  if (isTopFrame) {
    chrome.storage.local.get(['supported_domains', 'dynamic_site_rules']).then(({ supported_domains, dynamic_site_rules }) => {
      if (Array.isArray(dynamic_site_rules)) customRules = dynamic_site_rules;
      const domains = Array.isArray(supported_domains) ? supported_domains : [];
      if (isSupportedHost(window.location.hostname, domains)) {
        startTopFrame();
      }
    }).catch(() => {});
  } else {
    chrome.runtime.sendMessage({ type: 'FRAME_HELLO' }).then((res) => {
      if (res?.active) startIframe();
    }).catch(() => {});
  }
})();
