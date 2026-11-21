// AniSync - MyAnimeList API Client (OAuth 2.0 PKCE)

const EDITION_CONFIG = typeof ANISYNC_EDITION !== 'undefined' ? ANISYNC_EDITION : {};

const MAL_CONFIG = {
  // A build can use its own MAL app (e.g. if MAL allows only one redirect URL per app)
  CLIENT_ID: EDITION_CONFIG.malClientId || 'YOUR_MAL_CLIENT_ID',
  AUTH_URL: 'https://myanimelist.net/v1/oauth2/authorize',
  TOKEN_URL: 'https://myanimelist.net/v1/oauth2/token',
  API_BASE: 'https://api.myanimelist.net/v2',
  // Redirect used by the tab-based login (Firefox, where identity.launchWebAuthFlow is
  // missing on Android). Must be registered in the MAL API app.
  TAB_REDIRECT_URI: 'https://anisync-api.YOUR-SUBDOMAIN.workers.dev/oauth/callback'
};

const SEARCH_CACHE_PREFIX = 'cache_anime_';
const ANIME_INFO_PREFIX = 'anime_info_';
const ANISKIP_PREFIX = 'aniskip_';
const SEARCH_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MIN_MATCH_SCORE = 0.6; // Dice similarity required to accept a search result

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
            const err = chrome.runtime.lastError?.message || 'Login was cancelled or failed to open.';
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

  // Sørensen–Dice similarity on word tokens (0..1)
  _similarity(a, b) {
    const ta = this._tokens(a);
    const tb = this._tokens(b);
    if (ta.length === 0 || tb.length === 0) return 0;
    const pool = [...tb];
    let common = 0;
    for (const t of ta) {
      const idx = pool.indexOf(t);
      if (idx !== -1) {
        common++;
        pool.splice(idx, 1);
      }
    }
    return (2 * common) / (ta.length + tb.length);
  }

  _cacheKey(cleanTitle) {
    return `${SEARCH_CACHE_PREFIX}${cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  }

  // Search anime on MAL by title. Returns { id, title, num_episodes, main_picture } or null
  // when no result is a confident match.
  async searchAnime(title) {
    const token = await this.getValidAccessToken();
    if (!token) throw new Error('Not authenticated with MyAnimeList');

    const cleanTitle = this.normalizeTitle(title);
    if (!cleanTitle) throw new Error('Empty anime title');

    const cacheKey = this._cacheKey(cleanTitle);
    const cached = (await chrome.storage.local.get(cacheKey))[cacheKey];
    if (cached && cached.node && Date.now() - cached.cachedAt < SEARCH_CACHE_TTL_MS) {
      return cached.node;
    }

    // MAL rejects queries longer than 64 characters
    const query = cleanTitle.slice(0, 64);
    const url = `${MAL_CONFIG.API_BASE}/anime?q=${encodeURIComponent(query)}&limit=10&fields=id,title,alternative_titles,num_episodes,main_picture`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      throw new Error(`Anime search failed: ${res.status}`);
    }

    const data = await res.json();
    if (!data.data || data.data.length === 0) {
      return null;
    }

    const candidate = this.selectBestMatch(cleanTitle, data.data);
    if (candidate) {
      const node = {
        id: candidate.id,
        title: candidate.title,
        num_episodes: candidate.num_episodes || 0,
        main_picture: candidate.main_picture || null
      };
      await chrome.storage.local.set({ [cacheKey]: { node, cachedAt: Date.now() } });
      return node;
    }
    return null;
  }

  // Pick the result whose title (or any alternative title) is most similar to the query.
  // Returns null if nothing clears MIN_MATCH_SCORE, so we never guess.
  selectBestMatch(query, items) {
    let best = null;
    let bestScore = 0;

    for (const item of items) {
      const node = item.node;
      const alts = node.alternative_titles || {};
      const names = [node.title, alts.en, alts.ja, ...(alts.synonyms || [])].filter(Boolean);

      for (const name of names) {
        const score = this._similarity(query, name);
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
    const keys = Object.keys(all).filter(k =>
      k.startsWith(SEARCH_CACHE_PREFIX) || k.startsWith('last_sync_') ||
      k.startsWith(ANIME_INFO_PREFIX) || k.startsWith(ANISKIP_PREFIX));
    if (keys.length > 0) await chrome.storage.local.remove(keys);
    return keys.length;
  }

  // Show facts used to plan syncing: type (tv/movie/...), episode count and the
  // average episode length in seconds. Cached for 7 days.
  async getAnimeInfo(animeId) {
    const key = `${ANIME_INFO_PREFIX}${animeId}`;
    const cached = (await chrome.storage.local.get(key))[key];
    if (cached && Date.now() - cached.cachedAt < SEARCH_CACHE_TTL_MS) return cached.info;

    const token = await this.getValidAccessToken();
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`${MAL_CONFIG.API_BASE}/anime/${animeId}?fields=num_episodes,media_type,average_episode_duration`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Failed to fetch anime info: ${res.status}`);

    const data = await res.json();
    const info = {
      numEpisodes: data.num_episodes || 0,
      mediaType: data.media_type || 'unknown',
      avgDuration: data.average_episode_duration || 0
    };
    await chrome.storage.local.set({ [key]: { info, cachedAt: Date.now() } });
    return info;
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
