# Chrome Web Store Listing — AniSync

> Last Updated: 2026-11-18

## Store Listing

**Extension Name** [REQUIRED]
AniSync - MyAnimeList Auto Tracker

**Short Description** [REQUIRED]
Automatically detects anime episodes as you watch on streaming websites and syncs your progress to MyAnimeList in the background.

**Detailed Description** [REQUIRED]
AniSync is a seamless, set-it-and-forget-it anime tracker for MyAnimeList (MAL).

Tired of forgetting to update your episode list after a binge session? With AniSync, you only need to connect your MyAnimeList account once. As you stream anime across supported platforms, AniSync quietly detects the show and episode number, observes your playback progress, and automatically marks the episode as watched on your MAL profile once you reach your chosen threshold (default 80%).

Key Features:
- Automatic Episode Tracking: Detects the anime title and episode directly from video players.
- Smart Sync Threshold: Updates your list only when you've actually watched the episode.
- Zero Server/Database Dependence: Runs completely client-side in your browser using official MyAnimeList OAuth 2.0 PKCE.
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
| `storage` | permissions | Stores the user's OAuth tokens and sync preferences locally on their device. |
| `identity` | permissions | Initiates official MyAnimeList OAuth 2.0 authorization dialog via `launchWebAuthFlow`. |
| `notifications` | permissions | Notifies the user when an episode has successfully synced to MyAnimeList. |
| `alarms` | permissions | Schedules background token validity checks. |
| `https://api.myanimelist.net/*` | host_permissions | Communicates with the official MyAnimeList REST API to search anime and update watch lists. |
| `https://myanimelist.net/*` | host_permissions | Handles user authentication and token exchange endpoints. |
| `scripting` | permissions | Enables dynamic execution of playback observers on anime streaming sites. |

---

## Privacy & Data Use

### Data Collection
- User Activity: Episode watch count and anime title (transmitted solely to `api.myanimelist.net` to update the user's own list).
- Personal Data: None collected by the developer or third parties.
