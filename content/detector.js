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
  // Endings run ~90s. On short episodes that's a big share of the runtime, so reaching
  // the last 90s also counts as watched (with at least half the episode played).
  const OUTRO_SECONDS = 90;
  const OUTRO_MIN_PERCENT = 50;
  // Pages without an episode number are only considered when the video is movie-length
  const MOVIE_MIN_SECONDS = 30 * 60;
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
  const NOT_EPISODE_RE = /\b(reactions?|reacts?|reacting|review|recap|explained|breakdown|analysis|amv|trailer|teaser|pv|preview|opening|ending|op|ed|ost|soundtrack|clip|scene|edit|shorts|tier list|top \d+|podcast|cosplay|abridged|parody|fan ?made|fan ?dub|live[- ]action|compilation)\b|\bepisodes?\s*\d+\s*(?:to|-|–|~)\s*\d+/i;

  // General video platforms host lots of fan content around anime. There, only
  // episode-length videos count (official uploads are ~20-25 min; double-length
  // specials like Oshi no Ko ep 1 run ~90 min). Longer uploads are compilations.
  const GENERAL_PLATFORMS = ['youtube.com', 'bilibili.com', 'bilibili.tv', 'dailymotion.com'];
  const PLATFORM_MIN_SECONDS = 15 * 60;
  const PLATFORM_MAX_SECONDS = 100 * 60;

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
    const activeEpEl = document.querySelector(
      'a.active[href*="ep"], a[class*="active"][href*="ep"], [class*="active"][data-number], [class*="active"][data-num], .episode-item.active, .ep-item.active, .ssl-item.active, li.active a[href*="ep"]'
    );
    if (!episode) {
      if (activeEpEl) {
        const dataNum = activeEpEl.getAttribute('data-number') || activeEpEl.getAttribute('data-num');
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

    // 6. No episode number anywhere: keep a title-only candidate. It may be a movie;
    //    the background confirms with MyAnimeList (type + length) before anything syncs.
    if (!title && document.title) title = stripSiteSuffix(document.title.trim());

    if (title) title = cleanTitle(title);

    // Many streaming sites put the MyAnimeList ID on their episode links
    // (e.g. <a data-mal="62983">). That's exact, so no title search is needed.
    let malId = null;
    let malRaw = (activeEpEl?.closest('[data-mal]')?.getAttribute('data-mal') || '').trim();
    if (!malRaw) {
      // Page-wide IDs only count if they all agree: "related"/"recommended" lists
      // carry other shows' IDs, and picking one of those would sync the wrong anime.
      const ids = new Set([...document.querySelectorAll('[data-mal]')]
        .map(el => (el.getAttribute('data-mal') || '').trim())
        .filter(Boolean));
      if (ids.size === 1) malRaw = [...ids][0];
    }
    if (/^\d{1,7}$/.test(malRaw) && Number(malRaw) > 0) malId = Number(malRaw);

    if (title && title.length > 1) {
      return { title, episode: episode || null, malId };
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
        resetPlan();
      }
      return currentMeta;
    }

    // ----- Sync plan from the background (MAL length/type + ending start) -----
    let plan = null;
    let planState = 'none'; // none | pending | ready | unavailable
    let planKey = '';
    let lastProgress = null;

    function resetPlan() {
      plan = null;
      planState = 'none';
      planKey = '';
    }

    function requestPlan(meta, duration) {
      // Re-plan if the duration changes a lot (e.g. a pre-roll ad, then the episode)
      const key = `${meta.title}#${meta.episode}#${meta.malId}#${Math.round(duration / 30)}`;
      if (key === planKey) return;
      planKey = key;
      planState = 'pending';
      plan = null;

      chrome.runtime.sendMessage({
        type: 'GET_SYNC_PLAN',
        data: { animeTitle: meta.title, episodeNumber: meta.episode, malId: meta.malId, duration }
      }).then((res) => {
        if (planKey !== key) return;
        if (res?.success && res.plan?.available) {
          plan = res.plan;
          planState = 'ready';
          if (!plan.eligible) console.log(`[AniSync] Not syncing "${meta.title}": ${plan.reason}`);
        } else {
          planState = 'unavailable';
        }
        // Re-evaluate right away (the user may already be past the sync point and paused)
        if (lastProgress) handleProgress(lastProgress);
      }).catch(() => {
        if (planKey !== key) return;
        planState = 'unavailable';
        if (lastProgress) handleProgress(lastProgress);
      });
    }

    function handleProgress(progress) {
      const { percentage, currentTime, duration, isFinished } = progress;
      lastProgress = progress;
      const meta = currentMeta || refreshMeta();
      if (!meta) return;

      // A page without an episode number only matters for movie-length videos
      const titleOnly = !meta.episode;
      if (titleOnly && !(duration >= MOVIE_MIN_SECONDS)) return;

      requestPlan(meta, duration);
      const ready = planState === 'ready';

      // MAL-based length check when available, fixed rules if MAL is unreachable,
      // and "not yet" while the plan is still loading
      const eligible = ready
        ? plan.eligible && (plan.lengthChecked || isEpisodeLength(duration))
        : planState === 'unavailable' && !titleOnly && isEpisodeLength(duration);
      const episode = ready && plan.eligible ? plan.episode : meta.episode;

      const now = Date.now();
      const showStatus = !titleOnly || (ready && plan.eligible);
      if (showStatus && (isFinished || now - lastStatusSent >= STATUS_THROTTLE_MS)) {
        lastStatusSent = now;
        chrome.runtime.sendMessage({
          type: 'UPDATE_PLAYBACK_STATUS',
          data: {
            animeTitle: meta.title,
            episodeNumber: episode,
            malId: meta.malId,
            percentage,
            currentTime,
            duration,
            // Lets the background apply the "moved on to the next episode" rule
            eligible,
            site: window.location.hostname
          }
        }).catch(() => {});
      }

      if (syncState !== 'idle' || now < retryAt) return;
      if (planState === 'pending') return; // decide once the plan arrives
      if (!eligible) return;

      let due;
      if (ready) {
        // Universal rule: threshold or start of the ending, whichever comes first
        due = isFinished || currentTime >= plan.syncAt;
      } else {
        // Fallback (MAL unreachable): fixed threshold, or the last 90s of the video
        const inOutro = duration - currentTime <= OUTRO_SECONDS && percentage >= OUTRO_MIN_PERCENT;
        due = isFinished || percentage >= syncThreshold || inOutro;
      }
      if (!due) return;

      // Mark pending synchronously so rapid timeupdate events cannot double-send
      syncState = 'pending';
      const syncedMeta = meta;
      const why = ready ? `reached ${plan.endingSource === 'aniskip' ? 'ending (AniSkip)' : 'sync point'} at ${Math.round(currentTime)}s` : `${percentage}%`;
      console.log(`[AniSync] Syncing "${meta.title}" Episode ${episode} (${why})...`);

      chrome.runtime.sendMessage({
        type: 'SYNC_EPISODE',
        data: { animeTitle: meta.title, episodeNumber: episode, malId: meta.malId }
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

    // Embedded players (MegaCloud/MegaPlay, Vidstreaming, ...) post their own progress
    // to the page: {"channel":"megacloud","event":"time","time":..,"duration":..} or
    // {"type":"watching-log","currentTime":..,"duration":..}. Reading those works even
    // when our script can't see the video inside the player iframe. Only messages from
    // this page's own iframes are accepted, and they can only advance the episode the
    // page itself shows.
    let lastPlayerMsg = 0;
    window.addEventListener('message', (event) => {
      // Never let a strange message break tracking (Firefox can also throw when a
      // content script reads some page-owned message data)
      try {
        if (event.source === window) return;
        const progress = parsePlayerMessage(event.data);
        if (!progress || !acceptPlayerSource(event.source, progress)) return;
        const now = Date.now();
        if (!progress.isFinished && now - lastPlayerMsg < 1000) return;
        lastPlayerMsg = now;
        handleProgress(progress);
      } catch (_) {}
    });

    console.info(`[AniSync] Tracking active on ${window.location.hostname}`);
    watchVideos(handleProgress);
  }

  // Which iframe is the video player? The first sizeable iframe on this page that reports
  // a real video (>= 60s; ads are shorter) becomes "the player", and from then on only
  // its messages count, as long as it is still on the page. Overlay ads, comment widgets
  // and other frames can't feed or disturb the progress.
  const PLAYER_MIN_WIDTH = 200;
  const PLAYER_MIN_HEIGHT = 120;
  const PLAYER_MIN_DURATION = 60;
  let playerSource = null;

  function acceptPlayerSource(source, progress) {
    if (!source) return false;
    const frames = [...document.querySelectorAll('iframe')];
    const frame = frames.find(f => f.contentWindow === source);
    if (!frame) return false; // not one of this page's own iframes

    if (playerSource && frames.some(f => f.contentWindow === playerSource)) {
      return source === playerSource;
    }
    const sizeable = frame.offsetWidth >= PLAYER_MIN_WIDTH && frame.offsetHeight >= PLAYER_MIN_HEIGHT;
    if (sizeable && progress.duration >= PLAYER_MIN_DURATION) {
      playerSource = source;
      return true;
    }
    return false;
  }

  function parsePlayerMessage(raw) {
    let data = raw;
    if (typeof raw === 'string') {
      if (raw.length > 2000 || raw[0] !== '{') return null;
      try { data = JSON.parse(raw); } catch (_) { return null; }
    }
    if (!data || typeof data !== 'object') return null;

    const event = String(data.event || data.type || '').toLowerCase();
    const isFinished = event === 'complete' || event === 'ended' || event === 'end';
    const currentTime = Number(data.time ?? data.currentTime ?? data.position);
    const duration = Number(data.duration);
    if (!(duration > 0) || !Number.isFinite(duration)) return null;
    if (!isFinished && !(currentTime >= 0 && currentTime <= duration + 5)) return null;

    const time = isFinished ? duration : Math.min(currentTime, duration);
    return {
      percentage: Math.round((time / duration) * 100),
      currentTime: time,
      duration,
      isFinished
    };
  }

  // ---------- Boot ----------

  if (isTopFrame) {
    // Sites the user enabled themselves live in sync storage (follows their browser account)
    const userSitesPromise = chrome.storage.sync
      ? chrome.storage.sync.get('user_sites').then(r => r.user_sites).catch(() => [])
      : Promise.resolve([]);

    Promise.all([
      chrome.storage.local.get(['supported_domains', 'dynamic_site_rules']),
      userSitesPromise
    ]).then(([{ supported_domains, dynamic_site_rules }, user_sites]) => {
      if (Array.isArray(dynamic_site_rules)) customRules = dynamic_site_rules;
      const domains = [
        ...(Array.isArray(supported_domains) ? supported_domains : []),
        ...(Array.isArray(user_sites) ? user_sites.map(s => s?.domain).filter(Boolean) : [])
      ];
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
