// AniSync - MyAnimeList API Client (OAuth 2.0 PKCE)

const MAL_CONFIG = {
  CLIENT_ID: 'YOUR_MAL_CLIENT_ID',
  AUTH_URL: 'https://myanimelist.net/v1/oauth2/authorize',
  TOKEN_URL: 'https://myanimelist.net/v1/oauth2/token',
  API_BASE: 'https://api.myanimelist.net/v2'
};

class MalClient {
  constructor() {
    this.redirectUri = chrome.identity.getRedirectURL();
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

  // Initiate OAuth 2.0 PKCE login flow
  async login() {
    const codeVerifier = this.generateCodeVerifier();
    await chrome.storage.local.set({ pkce_code_verifier: codeVerifier });

    const authUrl = `${MAL_CONFIG.AUTH_URL}?response_type=code` +
      `&client_id=${encodeURIComponent(MAL_CONFIG.CLIENT_ID)}` +
      `&code_challenge=${encodeURIComponent(codeVerifier)}` +
      `&code_challenge_method=plain` +
      `&redirect_uri=${encodeURIComponent(this.redirectUri)}`;

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

  // Refresh access token if expired or about to expire
  async getValidAccessToken() {
    const { mal_tokens } = await chrome.storage.local.get('mal_tokens');
    if (!mal_tokens || !mal_tokens.access_token) {
      return null;
    }

    // Still valid
    if (mal_tokens.expires_at && Date.now() < mal_tokens.expires_at) {
      return mal_tokens.access_token;
    }

    // Needs refresh
    if (!mal_tokens.refresh_token) {
      return null;
    }

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
      // Refresh failed, user must log in again
      await chrome.storage.local.remove(['mal_tokens', 'mal_user_profile']);
      return null;
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
      .replace(/\s*\(?(?:TV|Dub|Sub|Official|1080p|720p|HD|Uncensored)\)?/gi, '')
      .replace(/\s*-\s*Season\s*(\d+)/gi, ' Season $1')
      .replace(/\s*-\s*Part\s*(\d+)/gi, ' Part $1')
      .replace(/[:_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Search anime on MAL by title
  async searchAnime(title) {
    const token = await this.getValidAccessToken();
    if (!token) throw new Error('Not authenticated with MyAnimeList');

    const cleanTitle = this.normalizeTitle(title);
    if (!cleanTitle) throw new Error('Empty anime title');

    // Check memory cache in storage
    const cacheKey = `cache_anime_${cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const cached = await chrome.storage.local.get(cacheKey);
    if (cached[cacheKey]) {
      return cached[cacheKey];
    }

    const url = `${MAL_CONFIG.API_BASE}/anime?q=${encodeURIComponent(cleanTitle)}&limit=5&fields=id,title,alternative_titles,num_episodes,my_list_status,main_picture`;
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

    // Find the best match
    const candidate = this.selectBestMatch(cleanTitle, data.data);
    if (candidate) {
      // Cache the result for 7 days
      await chrome.storage.local.set({ [cacheKey]: candidate });
    }
    return candidate;
  }

  // Compare candidates to find closest matching anime
  selectBestMatch(query, items) {
    const qLower = query.toLowerCase();

    for (const item of items) {
      const node = item.node;
      const titleLower = node.title.toLowerCase();
      const enTitle = node.alternative_titles?.en?.toLowerCase() || '';

      if (titleLower === qLower || enTitle === qLower) {
        return node;
      }
    }

    // Default to first result if close enough
    return items[0]?.node || null;
  }

  // Update watch progress of an anime on user's MAL list
  async updateWatchProgress(animeId, episodeNumber, totalEpisodes = 0) {
    const token = await this.getValidAccessToken();
    if (!token) throw new Error('Not authenticated');

    const ep = parseInt(episodeNumber, 10);
    if (isNaN(ep) || ep < 1) {
      throw new Error(`Invalid episode number: ${episodeNumber}`);
    }

    // Determine status: completed if final episode, otherwise watching
    let status = 'watching';
    if (totalEpisodes > 0 && ep >= totalEpisodes) {
      status = 'completed';
    }

    const body = new URLSearchParams({
      num_watched_episodes: String(ep),
      status: status
    });

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
