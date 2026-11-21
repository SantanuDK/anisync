# Chrome Web Store Listing — AniSync

> Last Updated: 2026-11-20 — describes the **store edition** built by `node scripts/build.js` (`dist/anisync-chrome-store-*.zip`), not the full developer edition in the repo root.

## Store Listing

**Extension Name** [REQUIRED]
AniSync - Anime Tracker for MyAnimeList

**Short Description** [REQUIRED]
Automatically detects anime episodes as you watch on streaming websites and syncs your progress to MyAnimeList in the background.

**Detailed Description** [REQUIRED]
AniSync is a seamless, set-it-and-forget-it anime tracker for MyAnimeList (MAL).

Tired of forgetting to update your episode list after a binge session? With AniSync, you only need to connect your MyAnimeList account once. As you stream anime across supported platforms, AniSync quietly detects the show and episode number, observes your playback progress, and automatically marks the episode as watched on your MAL profile once you reach your chosen threshold (default 80%).

Key Features:
- Automatic Episode Tracking: Detects the anime title and episode directly from video players.
- Smart Sync Threshold: Updates your list only when you've actually watched the episode.
- No Account Server or Database: Your data stays client-side in your browser using official MyAnimeList OAuth 2.0 PKCE.
- Live Status Popup: See the currently playing episode and real-time watch percentage at a glance.
- Cross-Platform Support: Built for Chrome and fully compatible with Firefox.

How to Use:
1. Click the AniSync icon in your browser toolbar and click "Log in with MyAnimeList".
2. Authorize the extension via the official MyAnimeList prompt.
3. Open any supported anime streaming site and start watching! AniSync takes care of the rest.

Privacy Notice:
AniSync never collects, transmits, or sells your personal browsing data. Authentication tokens and user preferences are stored strictly inside your browser's local storage.

**Category** [REQUIRED]
Fun

**Single Purpose** [REQUIRED]
Automatically syncs watched anime episode progress from streaming sites to the user's MyAnimeList account.

**Primary Language** [REQUIRED]
English

---

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `icons/icon128.png` |
| Screenshot 1 [REQUIRED] | 1280×800 | ⬜ Not created | `screenshots/screenshot1.png` |
| Screenshot 2 [RECOMMENDED] | 1280×800 | ⬜ Not created | `screenshots/screenshot2.png` |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | `promo/small-tile.png` |

---

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `storage` | permissions | Stores OAuth tokens, preferences and sync history locally; the list of sites the user enabled is kept in the user's own browser sync storage. |
| `identity` | permissions | Opens the official MyAnimeList OAuth 2.0 login via `launchWebAuthFlow`. |
| `notifications` | permissions | Tells the user when an episode was synced to MyAnimeList. |
| `alarms` | permissions | Clears the toolbar badge shortly after a sync. |
| `activeTab` | permissions | When the user opens the popup, reads the current tab's address to show whether AniSync works on that site and offer to enable it. |
| `scripting` | permissions | Registers the episode detector on sites the user explicitly enabled, and (on click) lists the page's video-player iframes so they can be included in the permission request. |
| `https://api.myanimelist.net/*`, `https://myanimelist.net/*` | host_permissions | MyAnimeList API calls (search, update the user's list) and token exchange. |
| `https://api.aniskip.com/*` | host_permissions | Looks up when an episode's ending starts (public community timestamps) so short episodes sync even if the user skips the ending. Only the MyAnimeList anime ID, episode number and video length are sent. Can be turned off in Preferences. |
| Crunchyroll, YouTube, Netflix, HIDIVE, Bilibili, RetroCrush, Hulu | host_permissions + content_scripts | Official streaming services supported out of the box: reads the page title, episode number and `<video>` playback position. |
| `*://*/*` | optional_host_permissions | Never granted automatically. Requested per site only when the user clicks **Enable** in the popup, through Chrome's own permission prompt; the user can revoke it at any time. |

---

## Privacy & Data Use

### Data Collection
- Website Content: Only on the official services above and on sites the user explicitly enabled, the page title, episode number and video playback position are read locally to detect what is being watched.
- User Activity: Episode watch count and anime title (transmitted solely to `api.myanimelist.net` to update the user's own list).
- Enabled Sites: The domains a user enables are stored in their own browser sync storage (Chrome/Google account sync) and never sent to the developer.
- Remote Config: None. The store edition does not download any remote configuration or code.
- Ending Timestamps: The MyAnimeList anime ID, episode number and video length are sent to AniSkip (api.aniskip.com) to find where the ending starts. No personal data, account info or browsing history is included. Optional (Preferences).
- Personal Data: None collected by the developer or third parties.
