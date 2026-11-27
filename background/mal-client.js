// AniSync - MyAnimeList API Client (OAuth 2.0 PKCE)

const EDITION_CONFIG = typeof ANISYNC_EDITION !== 'undefined' ? ANISYNC_EDITION : {};
// Developer-specific values live in the git-ignored background/private-config.js
const PRIVATE_CONFIG = typeof ANISYNC_PRIVATE !== 'undefined' ? ANISYNC_PRIVATE : {};

const MAL_CONFIG = {
  // A build can use its own MAL app (e.g. if MAL allows only one redirect URL per app)
  CLIENT_ID: EDITION_CONFIG.malClientId || PRIVATE_CONFIG.malClientId || '',
  AUTH_URL: 'https://myanimelist.net/v1/oauth2/authorize',
  TOKEN_URL: 'https://myanimelist.net/v1/oauth2/token',
  API_BASE: 'https://api.myanimelist.net/v2',
  // Redirect used by the tab-based login (Firefox, where identity.launchWebAuthFlow is
  // missing on Android). Must be registered in the MAL API app.
  TAB_REDIRECT_URI: PRIVATE_CONFIG.workerUrl ? PRIVATE_CONFIG.workerUrl + '/oauth/callback' : ''
};

const SEARCH_CACHE_PREFIX = 'cache_anime_';
const ANIME_INFO_PREFIX = 'anime_info_';
const MANGA_SEARCH_CACHE_PREFIX = 'cache_manga_';
const MANGA_INFO_PREFIX = 'manga_info_';
const ANISKIP_PREFIX = 'aniskip_';
// Titles the user matched by hand in the popup: { 'anime:<title>': id, 'manga:<title>': id }
const MATCH_OVERRIDES_KEY = 'match_overrides';
// MAL's manga search also returns light novels; on a manga reader the comic wins a tie
const NOVEL_TYPES = ['light_novel', 'novel'];
const NOVEL_PENALTY = 0.05;
const SEARCH_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MIN_MATCH_SCORE = 0.6; // Dice similarity required to accept a search result
// Lower bar when the site itself gave us the MAL ID: we only need to rule out an
// unrelated show, and sites often use their own spelling of the title
const MAL_ID_MIN_TITLE_SCORE = 0.3;

class MalClient {
  constructor() {
    // 'webauth' = browser login popup (Chrome); 'tab' = login in a normal tab (Firefox / Android)
    const hasWebAuthFlow = !!(chrome.identity && chrome.identity.launchWebAuthFlow);
    this.authFlow = EDITION_CONFIG.authFlow === 'tab' || !hasWebAuthFlow ? 'tab' : 'webauth';
    this.redirectUri = this.authFlow === 'tab' ? MAL_CONFIG.TAB_REDIRECT_URI : chrome.identity.getRedirectURL();
    this._refreshPromise = null;
    this._handledCodes = new Set();
  }

  _buildAuthUrl(codeVerifier) {
    return `${MAL_CONFIG.AUTH_URL}?response_type=code` +
      `&client_id=${encodeURIComponent(MAL_CONFIG.CLIENT_ID)}` +
      `&code_challenge=${encodeURIComponent(codeVerifier)}` +
      `&code_challenge_method=plain` +
      `&redirect_uri=${encodeURIComponent(this.redirectUri)}`;
  }

  // Tab-based login, step 2: called by the background when a tab reaches the redirect URL.
  // Works even if the background was suspended in between (state is in storage).
  async completeLoginFromRedirect(redirectUrl) {
    const url = new URL(redirectUrl);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    if (error) throw new Error(`MAL Auth Error: ${error}`);
    if (!code || this._handledCodes.has(code)) return null; // tabs.onUpdated can fire twice
    this._handledCodes.add(code);

    const { pkce_code_verifier } = await chrome.storage.local.get('pkce_code_verifier');
    if (!pkce_code_verifier) return null; // no login in progress

    const tokenData = await this.exchangeCodeForToken(code, pkce_code_verifier);
    await chrome.storage.local.remove('pkce_code_verifier');
    const profile = await this.fetchUserProfile(tokenData.access_token);
    await chrome.storage.local.set({ mal_user_profile: profile });
    return profile;
  }

  // Generate 64-char URL-safe cryptographically random string for PKCE
  generateCodeVerifier() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const array = new Uint8Array(64);
    crypto.getRandomValues(array);
    let result = '';
    for (let i = 0; i < array.length; i++) {
      result += chars[array[i] % chars.length];
    }
    return result;
  }

  // Initiate OAuth 2.0 PKCE login flow (MAL only supports the "plain" method)
  async login() {
    const codeVerifier = this.generateCodeVerifier();
    if (!MAL_CONFIG.CLIENT_ID || MAL_CONFIG.CLIENT_ID === 'YOUR_MAL_CLIENT_ID') {
      throw new Error('No MAL Client ID set: copy background/private-config.example.js to private-config.js and add yours.');
    }
    if (this.authFlow === 'tab' && !this.redirectUri) {
      throw new Error('Tab login needs workerUrl in background/private-config.js (its /oauth/callback is the redirect).');
    }
    await chrome.storage.local.set({ pkce_code_verifier: codeVerifier });
    const authUrl = this._buildAuthUrl(codeVerifier);

    // Tab-based login, step 1: open MAL in a normal tab; the background finishes
    // the login when that tab lands on the redirect URL.
    if (this.authFlow === 'tab') {
      await chrome.tabs.create({ url: authUrl });
      return { pending: true };
    }

    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: authUrl,
          interactive: true
        },
        async (redirectUrl) => {
          if (chrome.runtime.lastError || !redirectUrl) {
            let err = chrome.runtime.lastError?.message || 'Login was cancelled or failed to open.';
            // MAL refuses login addresses that aren't registered in the MAL API app
            // (Chrome only says the page "could not be loaded"). Each extension ID has
            // its own address, e.g. a store install or an unpacked copy without "key".
            if (/could not be loaded/i.test(err)) {
              err = `MyAnimeList refused this login address: ${this.redirectUri} — add it to the ` +
                'App Redirect URLs of the MAL API app (myanimelist.net/apiconfig), then try again.';
            }
            return reject(new Error(err));
          }

          try {
            const url = new URL(redirectUrl);
            const code = url.searchParams.get('code');
            const error = url.searchParams.get('error');

            if (error) {
              return reject(new Error(`MAL Auth Error: ${error}`));
            }

            if (!code) {
              return reject(new Error('No authorization code found in redirect URL.'));
            }

            const { pkce_code_verifier } = await chrome.storage.local.get('pkce_code_verifier');
            const tokenData = await this.exchangeCodeForToken(code, pkce_code_verifier || codeVerifier);
            await chrome.storage.local.remove('pkce_code_verifier');

            const profile = await this.fetchUserProfile(tokenData.access_token);
            await chrome.storage.local.set({ mal_user_profile: profile });

            resolve({ tokenData, profile });
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  }

  // Exchange authorization code for access and refresh tokens
  async exchangeCodeForToken(code, codeVerifier) {
    const body = new URLSearchParams({
      client_id: MAL_CONFIG.CLIENT_ID,
      grant_type: 'authorization_code',
      code: code,
      code_verifier: codeVerifier,
      redirect_uri: this.redirectUri
    });

    const res = await fetch(MAL_CONFIG.TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to exchange token: ${res.status} ${errText}`);
    }

    const data = await res.json();
    const expiresAt = Date.now() + (data.expires_in * 1000) - (60 * 1000); // 1 min buffer

    const tokenPayload = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: expiresAt
    };

    await chrome.storage.local.set({ mal_tokens: tokenPayload });
    return tokenPayload;
  }

  // Return a valid access token, refreshing it if expired.
  // Concurrent callers share a single in-flight refresh so a rotated
  // refresh token is never used twice.
  async getValidAccessToken() {
    const { mal_tokens } = await chrome.storage.local.get('mal_tokens');
    if (!mal_tokens || !mal_tokens.access_token) {
      return null;
    }

    if (mal_tokens.expires_at && Date.now() < mal_tokens.expires_at) {
      return mal_tokens.access_token;
    }

    if (!mal_tokens.refresh_token) {
      return null;
    }

    if (!this._refreshPromise) {
      this._refreshPromise = this._refreshToken(mal_tokens)
        .finally(() => { this._refreshPromise = null; });
    }
    return this._refreshPromise;
  }

  async _refreshToken(mal_tokens) {
    const body = new URLSearchParams({
      client_id: MAL_CONFIG.CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: mal_tokens.refresh_token
    });

    const res = await fetch(MAL_CONFIG.TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    if (!res.ok) {
      // Only an explicit rejection of the refresh token means the session is dead.
      // Server errors / rate limits should not log the user out.
      if (res.status === 400 || res.status === 401) {
        await chrome.storage.local.remove(['mal_tokens', 'mal_user_profile']);
        return null;
      }
      throw new Error(`Token refresh failed: ${res.status}`);
    }

    const data = await res.json();
    const expiresAt = Date.now() + (data.expires_in * 1000) - (60 * 1000);

    const refreshedPayload = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || mal_tokens.refresh_token,
      expires_at: expiresAt
    };

    await chrome.storage.local.set({ mal_tokens: refreshedPayload });
    return refreshedPayload.access_token;
  }

  // Fetch logged in user profile (@me)
  async fetchUserProfile(providedToken = null) {
    const token = providedToken || await this.getValidAccessToken();
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`${MAL_CONFIG.API_BASE}/users/@me?fields=id,name,picture`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      throw new Error(`Profile fetch error: ${res.status}`);
    }

    return await res.json();
  }

  // Clean and normalize title for search
  normalizeTitle(rawTitle) {
    if (!rawTitle) return '';
    return rawTitle
      .replace(/^\s*(?:Watch|Stream)\s+/i, '')
      .replace(/\s*\(?\b(?:TV|Dub|Sub|Official|1080p|720p|HD|Uncensored)\b\)?/gi, '')
      .replace(/\s*-\s*Season\s*(\d+)/gi, ' Season $1')
      .replace(/\s*-\s*Part\s*(\d+)/gi, ' Part $1')
      .replace(/[:_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Tokenize a title for fuzzy comparison
  _tokens(str) {
    return (str || '')
      .toLowerCase()
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/(\d+)(?:st|nd|rd|th)\b/g, '$1')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  // Sørensen–Dice similarity on word tokens (0..1). Words that differ by one letter
  // (romanization: "Kamui" / "Kamuy") count as 0.75 of a match, but only when the titles
  // also share an exact real word (4+ letters, not "x" / "no" / "the"), so "Bleach" can
  // never match "Breach" and "Hunter x Hunter" can't match "Hunted x Hunted".
  _similarity(a, b) {
    const ta = this._tokens(a);
    const tb = this._tokens(b);
    if (ta.length === 0 || tb.length === 0) return 0;
    const pool = [...tb];
    let exact = 0;
    let anchor = false; // shares an exact word of 4+ letters
    const unmatched = [];
    for (const t of ta) {
      const idx = pool.indexOf(t);
      if (idx !== -1) {
        exact++;
        if (t.length >= 4) anchor = true;
        pool.splice(idx, 1);
      } else {
        unmatched.push(t);
      }
    }
    let near = 0;
    if (anchor) {
      for (const t of unmatched) {
        const idx = pool.findIndex(p => this._oneEditApart(t, p));
        if (idx !== -1) {
          near++;
          pool.splice(idx, 1);
        }
      }
    }
    return (2 * (exact + 0.75 * near)) / (ta.length + tb.length);
  }

  // True if two words (5+ letters, not numbers) differ by exactly one letter
  // substituted, added or removed
  _oneEditApart(a, b) {
    if (a.length < 5 || b.length < 5 || /\d/.test(a + b) || Math.abs(a.length - b.length) > 1) return false;
    let i = 0;
    let j = 0;
    let edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length > b.length) i++;
      else if (b.length > a.length) j++;
      else { i++; j++; }
    }
    return edits + (a.length - i) + (b.length - j) === 1;
  }

  _cacheKey(cleanTitle, kind = 'anime') {
    const prefix = kind === 'manga' ? MANGA_SEARCH_CACHE_PREFIX : SEARCH_CACHE_PREFIX;
    return `${prefix}${cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  }

  // Search anime on MAL by title. Returns { id, title, num_episodes, main_picture } or null
  // when no result is a confident match.
  async searchAnime(title) {
    return this._searchTitle(title, 'anime');
  }

  // Search manga (incl. manhwa / manhua) on MAL by title.
  // Returns { id, title, num_chapters, media_type, main_picture } or null.
  async searchManga(title) {
    return this._searchTitle(title, 'manga');
  }

  async _searchTitle(title, kind) {
    const token = await this.getValidAccessToken();
    if (!token) throw new Error('Not authenticated with MyAnimeList');

    const cleanTitle = this.normalizeTitle(title);
    if (!cleanTitle) throw new Error(`Empty ${kind} title`);

    const cacheKey = this._cacheKey(cleanTitle, kind);
    const cached = (await chrome.storage.local.get(cacheKey))[cacheKey];
    if (cached && cached.node && Date.now() - cached.cachedAt < SEARCH_CACHE_TTL_MS) {
      return cached.node;
    }

    // MAL's search is strict about words: sites often use a slightly different English
    // title ("...Love Meter is Broken" vs MAL's "...Love Meter Malfunction"). If the full
    // title finds nothing usable, retry with shorter prefixes. Every result is still
    // scored against the FULL title, so a shorter query can't pull in the wrong show.
    for (const query of this._queryVariants(cleanTitle)) {
      const results = await this._searchRequest(query, token, kind);
      const candidate = results.length ? this.selectBestMatch(cleanTitle, results, kind) : null;
      if (candidate) {
        const node = kind === 'manga'
          ? {
            id: candidate.id,
            title: candidate.title,
            num_chapters: candidate.num_chapters || 0,
            media_type: candidate.media_type || 'unknown',
            main_picture: candidate.main_picture || null
          }
          : {
            id: candidate.id,
            title: candidate.title,
            num_episodes: candidate.num_episodes || 0,
            main_picture: candidate.main_picture || null
          };
        await chrome.storage.local.set({ [cacheKey]: { node, cachedAt: Date.now() } });
        return node;
      }
    }
    return null;
  }

  // Full title first (cut to whole words), the main clause before a comma, then shorter
  // word prefixes (never below 2 words / half the title). MAL rejects queries longer than
  // 64 characters: light-novel titles ("Now That I Can Control Reality with a Mouse
  // Cursor, I'm Going to ...") used to be cut mid-word, and every shorter prefix was
  // still over 64 characters, so they all collapsed into that one broken query.
  _queryVariants(cleanTitle) {
    const MAX_QUERY = 64;
    const tidy = (s) => s.replace(/[\s,.;:!?\-–]+$/, '').trim();
    const fit = (words) => {
      let n = words.length;
      while (n > 1 && words.slice(0, n).join(' ').length > MAX_QUERY) n--;
      return n;
    };
    const words = cleanTitle.split(' ').filter(Boolean);
    const fitted = fit(words);
    const variants = [words.slice(0, fitted).join(' ')];

    const clause = cleanTitle.split(/[,，]/)[0].trim();
    if (clause !== cleanTitle) {
      const clauseWords = clause.split(' ').filter(Boolean);
      if (clauseWords.length >= 3) variants.push(clauseWords.slice(0, fit(clauseWords)).join(' '));
    }

    const minWords = Math.max(2, Math.ceil(words.length / 2));
    for (let n = fitted - 1; n >= minWords && variants.length < 5; n--) {
      variants.push(words.slice(0, n).join(' '));
    }
    return [...new Set(variants.map(tidy))].filter(v => v.length >= 3 && v.length <= MAX_QUERY);
  }

  async _searchRequest(query, token, kind = 'anime') {
    // nsfw=true: without it MAL silently hides every ecchi/fanservice title ("gray"),
    // e.g. "Marika's Love Meter Malfunction" -> zero results. We only use the results
    // to match what the user is already watching.
    const fields = kind === 'manga'
      ? 'id,title,alternative_titles,num_chapters,media_type,main_picture'
      : 'id,title,alternative_titles,num_episodes,main_picture';
    const url = `${MAL_CONFIG.API_BASE}/${kind}?q=${encodeURIComponent(query)}&limit=10&nsfw=true&fields=${fields}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      throw new Error(`${kind === 'manga' ? 'Manga' : 'Anime'} search failed: ${res.status}`);
    }

    const data = await res.json();
    return Array.isArray(data.data) ? data.data : [];
  }

  // Pick the result whose title (or any alternative title) is most similar to the query.
  // Returns null if nothing clears MIN_MATCH_SCORE, so we never guess.
  selectBestMatch(query, items, kind = 'anime') {
    let best = null;
    let bestScore = 0;

    for (const item of items) {
      const node = item.node;
      const alts = node.alternative_titles || {};
      const names = [node.title, alts.en, alts.ja, ...(alts.synonyms || [])].filter(Boolean);
      const penalty = kind === 'manga' && NOVEL_TYPES.includes(node.media_type) ? NOVEL_PENALTY : 0;

      for (const name of names) {
        const score = this._similarity(query, name) - penalty;
        if (score > bestScore) {
          bestScore = score;
          best = node;
        }
      }
      if (bestScore === 1) break;
    }

    return bestScore >= MIN_MATCH_SCORE ? best : null;
  }

  // Remove all cached title -> anime matches
  async clearSearchCache() {
    const all = await chrome.storage.local.get(null);
    // Hand-made matches (MATCH_OVERRIDES_KEY) are the user's own choice and are kept
    const keys = Object.keys(all).filter(k =>
      k.startsWith(SEARCH_CACHE_PREFIX) || k.startsWith('last_sync_') ||
      k.startsWith(ANIME_INFO_PREFIX) || k.startsWith(ANISKIP_PREFIX) ||
      k.startsWith(MANGA_SEARCH_CACHE_PREFIX) || k.startsWith(MANGA_INFO_PREFIX));
    if (keys.length > 0) await chrome.storage.local.remove(keys);
    return keys.length;
  }

  // Show facts used to plan syncing: type (tv/movie/...), episode count and the
  // average episode length in seconds. Cached for 7 days.
  async getAnimeInfo(animeId) {
    const key = `${ANIME_INFO_PREFIX}${animeId}`;
    const cached = (await chrome.storage.local.get(key))[key];
    if (cached && cached.info?.title && Array.isArray(cached.info.names) && Date.now() - cached.cachedAt < SEARCH_CACHE_TTL_MS) {
      return cached.info;
    }

    const token = await this.getValidAccessToken();
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`${MAL_CONFIG.API_BASE}/anime/${animeId}?fields=num_episodes,media_type,average_episode_duration,main_picture,alternative_titles`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Failed to fetch anime info: ${res.status}`);

    const data = await res.json();
    const alts = data.alternative_titles || {};
    const info = {
      title: data.title || '',
      // Every name MAL knows the show by (romaji, English, Japanese, synonyms)
      names: [data.title, alts.en, alts.ja, ...(alts.synonyms || [])].filter(Boolean),
      mainPicture: data.main_picture || null,
      numEpisodes: data.num_episodes || 0,
      mediaType: data.media_type || 'unknown',
      avgDuration: data.average_episode_duration || 0
    };
    await chrome.storage.local.set({ [key]: { info, cachedAt: Date.now() } });
    return info;
  }

  // Same shape as searchAnime(), but from an exact MAL ID (e.g. read from the page)
  async getAnimeById(animeId) {
    const info = await this.getAnimeInfo(animeId);
    if (!info.title) return null;
    return {
      id: Number(animeId),
      title: info.title,
      num_episodes: info.numEpisodes,
      main_picture: info.mainPicture
    };
  }

  // Exact ID when the site provides one, otherwise a title search. The page's ID is
  // only trusted if MAL's names for it resemble the page title: a site bug or a stray
  // ID must never put a different anime on the user's list.
  async resolveAnime(title, malId) {
    const overrideId = await this.getOverride('anime', title);
    if (overrideId) {
      const byOverride = await this.getAnimeById(overrideId).catch(() => null);
      if (byOverride) return byOverride;
    }
    if (malId > 0) {
      try {
        const info = await this.getAnimeInfo(malId);
        const byId = await this.getAnimeById(malId);
        const score = title ? Math.max(0, ...(info.names || []).map(n => this._similarity(title, n))) : 1;
        if (byId && score >= MAL_ID_MIN_TITLE_SCORE) return byId;
        if (byId) console.warn(`[AniSync] Page MAL ID ${malId} (${byId.title}) doesn't match "${title}" — using title search`);
      } catch (err) {
        console.warn('[AniSync] MAL ID lookup failed, falling back to title search:', err.message);
      }
    }
    return this.searchAnime(title);
  }

  // Change any list fields (e.g. is_rewatching / num_times_rewatched) on an anime or
  // manga entry. Returns MAL's full list status for the entry, including the rewatch /
  // reread counter (which a normal GET doesn't return).
  async patchListStatus(kind, id, fields) {
    const token = await this.getValidAccessToken();
    if (!token) throw new Error('Not authenticated');

    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(fields)) body.set(k, String(v));
    const res = await fetch(`${MAL_CONFIG.API_BASE}/${kind === 'manga' ? 'manga' : 'anime'}/${id}/my_list_status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to update list status: ${res.status} ${errText}`);
    }
    return await res.json();
  }

  // ---------- Hand-made matches ("Wrong match?" in the popup) ----------

  _overrideKey(kind, title) {
    return `${kind}:${this._tokens(this.normalizeTitle(title)).join(' ')}`;
  }

  async getOverride(kind, title) {
    if (!title) return null;
    const { [MATCH_OVERRIDES_KEY]: map = {} } = await chrome.storage.local.get(MATCH_OVERRIDES_KEY);
    const id = map[this._overrideKey(kind, title)];
    return id > 0 ? id : null;
  }

  // Always points this site title at the given MAL entry. Returns the entry, or throws
  // if the ID doesn't exist on MAL.
  async setOverride(kind, title, malId) {
    const id = parseInt(malId, 10);
    if (!title || !(id > 0)) throw new Error('Missing title or MyAnimeList ID');
    let entry = null;
    try {
      entry = kind === 'manga' ? await this.getMangaById(id) : await this.getAnimeById(id);
    } catch (err) {
      if (!/\b404\b/.test(err.message)) throw err;
    }
    if (!entry) throw new Error(`No ${kind} with ID ${id} on MyAnimeList`);

    const { [MATCH_OVERRIDES_KEY]: map = {} } = await chrome.storage.local.get(MATCH_OVERRIDES_KEY);
    map[this._overrideKey(kind, title)] = id;
    // The automatic match and the "already synced" marker belonged to the old entry
    const cleanTitle = this.normalizeTitle(title);
    await chrome.storage.local.remove([
      this._cacheKey(cleanTitle, kind),
      `${kind === 'manga' ? 'last_sync_manga_' : 'last_sync_'}${title.toLowerCase().trim()}`
    ]);
    await chrome.storage.local.set({ [MATCH_OVERRIDES_KEY]: map });
    return entry;
  }

  // ---------- Manga ----------

  // Facts used to sync chapters: type (manga/manhwa/one_shot/...), chapter count
  // (0 while ongoing) and every name MAL knows it by. Cached for 7 days.
  async getMangaInfo(mangaId) {
    const key = `${MANGA_INFO_PREFIX}${mangaId}`;
    const cached = (await chrome.storage.local.get(key))[key];
    if (cached && cached.info?.title && Date.now() - cached.cachedAt < SEARCH_CACHE_TTL_MS) {
      return cached.info;
    }

    const token = await this.getValidAccessToken();
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`${MAL_CONFIG.API_BASE}/manga/${mangaId}?fields=num_chapters,num_volumes,media_type,main_picture,alternative_titles`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Failed to fetch manga info: ${res.status}`);

    const data = await res.json();
    const alts = data.alternative_titles || {};
    const info = {
      title: data.title || '',
      names: [data.title, alts.en, alts.ja, ...(alts.synonyms || [])].filter(Boolean),
      mainPicture: data.main_picture || null,
      numChapters: data.num_chapters || 0,
      numVolumes: data.num_volumes || 0,
      mediaType: data.media_type || 'unknown'
    };
    await chrome.storage.local.set({ [key]: { info, cachedAt: Date.now() } });
    return info;
  }

  async getMangaById(mangaId) {
    const info = await this.getMangaInfo(mangaId);
    if (!info.title) return null;
    return {
      id: Number(mangaId),
      title: info.title,
      num_chapters: info.numChapters,
      media_type: info.mediaType,
      main_picture: info.mainPicture
    };
  }

  // Same rules as resolveAnime(): hand-made match, then a page ID that agrees with the
  // title, then a title search
  async resolveManga(title, malId) {
    const overrideId = await this.getOverride('manga', title);
    if (overrideId) {
      const byOverride = await this.getMangaById(overrideId).catch(() => null);
      if (byOverride) return byOverride;
    }
    if (malId > 0) {
      try {
        const info = await this.getMangaInfo(malId);
        const byId = await this.getMangaById(malId);
        const score = title ? Math.max(0, ...(info.names || []).map(n => this._similarity(title, n))) : 1;
        if (byId && score >= MAL_ID_MIN_TITLE_SCORE) return byId;
        if (byId) console.warn(`[AniSync] Page MAL manga ID ${malId} (${byId.title}) doesn't match "${title}" — using title search`);
      } catch (err) {
        console.warn('[AniSync] MAL manga ID lookup failed, falling back to title search:', err.message);
      }
    }
    return this.searchManga(title);
  }

  // The user's current list status for a manga (always fresh, never cached)
  async getMangaListStatus(mangaId) {
    const token = await this.getValidAccessToken();
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`${MAL_CONFIG.API_BASE}/manga/${mangaId}?fields=num_chapters,my_list_status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Failed to fetch manga list status: ${res.status}`);

    const data = await res.json();
    return {
      numChapters: data.num_chapters || 0,
      listStatus: data.my_list_status || null
    };
  }

  // Update chapters read. `status` is optional; omit it to leave the list status unchanged.
  async updateReadProgress(mangaId, chapterNumber, status = null) {
    const token = await this.getValidAccessToken();
    if (!token) throw new Error('Not authenticated');

    const ch = parseInt(chapterNumber, 10);
    if (isNaN(ch) || ch < 1) throw new Error(`Invalid chapter number: ${chapterNumber}`);

    const body = new URLSearchParams({ num_chapters_read: String(ch) });
    if (status) body.set('status', status);

    const res = await fetch(`${MAL_CONFIG.API_BASE}/manga/${mangaId}/my_list_status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to update manga list status: ${res.status} ${errText}`);
    }
    return await res.json();
  }

  // Fetch the user's current list status for an anime (always fresh, never cached)
  async getListStatus(animeId) {
    const token = await this.getValidAccessToken();
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`${MAL_CONFIG.API_BASE}/anime/${animeId}?fields=num_episodes,my_list_status`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch list status: ${res.status}`);
    }

    const data = await res.json();
    return {
      numEpisodes: data.num_episodes || 0,
      listStatus: data.my_list_status || null
    };
  }

  // Update watch progress. `status` is optional; omit it to leave the list status unchanged.
  async updateWatchProgress(animeId, episodeNumber, status = null) {
    const token = await this.getValidAccessToken();
    if (!token) throw new Error('Not authenticated');

    const ep = parseInt(episodeNumber, 10);
    if (isNaN(ep) || ep < 1) {
      throw new Error(`Invalid episode number: ${episodeNumber}`);
    }

    const body = new URLSearchParams({ num_watched_episodes: String(ep) });
    if (status) body.set('status', status);

    const res = await fetch(`${MAL_CONFIG.API_BASE}/anime/${animeId}/my_list_status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to update list status: ${res.status} ${errText}`);
    }

    return await res.json();
  }
}

// Global instance for background script
const malClient = new MalClient();
