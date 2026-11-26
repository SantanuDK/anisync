# 🎬 AniSync — MyAnimeList Auto Tracker

> Automatic anime episode tracker for **Chrome** and **Firefox** that syncs watched episodes to **MyAnimeList** completely in the background.

---

## ✨ Features

- **🚀 Set-and-Forget Background Sync**: Watch anime on any supported streaming site — AniSync detects the show, watches playback progress, and updates your MyAnimeList account automatically when you cross the watch threshold (default 80%).
- **🔒 100% Client-Side & Private**: No backend server or external database required. Uses official MyAnimeList OAuth 2.0 PKCE with client-side token storage in `chrome.storage.local`.
- **📺 Dynamic Streaming Site Support**: Designed to work with dynamically loaded site definitions (via Cloudflare / remote config) and universal HTML5 video detection.
- **⚡ Iframe Video Support**: Detects players embedded inside iframes (MegaCloud, Vidstreaming, RapidCloud, StreamTape, etc.) via cross-frame postMessage synchronization.
- **📊 Interactive Popup UI**:
  - Live episode watch progress bar in real-time.
  - "Force Sync Now" button to manually update anytime.
  - Recent sync history with direct links to MAL entries.
  - Customizable watch threshold slider (50% - 95%) and notification toggles.
- **🦊 Cross-Browser Compatible**: Manifest V3 compliant for Google Chrome, Brave, Edge, and Mozilla Firefox.

---

## 🔑 Setup: Your Own MyAnimeList App (required)

AniSync needs a MyAnimeList API Client ID. **Please register your own** — don't reuse someone else's: everything sent with a Client ID counts against that app, and misuse can get it disabled for everyone using it.

1. Go to [myanimelist.net/apiconfig](https://myanimelist.net/apiconfig) → **Create ID**. App Type: **other** (public PKCE client, no secret needed).
2. Copy `background/private-config.example.js` to `background/private-config.js` and put your Client ID in `malClientId`. Optionally set `workerUrl` to your own deployed `cloudflare-worker/` (needed for the Firefox login and the remote site list).
3. Add your redirect URLs to the MAL app's **App Redirect URLs**:
   - Chrome: `https://<extension-id>.chromiumapp.org/` (the popup shows the exact address if MAL refuses the login).
   - Firefox: `<workerUrl>/oauth/callback`.

`private-config.js` is git-ignored, so your IDs never end up in the repository. Note that any *built* extension still contains its Client ID (the browser needs it to log in); that's normal for public PKCE clients and gives no access to your MAL account.

---

## 🛠️ How to Load and Test in Chrome

1. Open Google Chrome and navigate to:
   ```text
   chrome://extensions/
   ```
2. Enable **Developer mode** using the toggle switch in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the project folder (the one containing `manifest.json`).
5. You will see **AniSync - MyAnimeList Auto Tracker** loaded!
6. Click the extension icon in your toolbar and click **"Log in with MyAnimeList"**.
7. Authorize your MAL account, and you're ready to stream!

---

## 🦊 How to Load and Test in Firefox

1. Open Firefox and navigate to:
   ```text
   about:debugging#/runtime/this-firefox
   ```
2. Click **Load Temporary Add-on...**
3. Build the Firefox version first with `node scripts/build.js`, then select `dist/firefox/manifest.json`. (The root `manifest.json` is Chrome-only, so Chrome shows no warnings.)
4. Firefox treats MV3 host permissions as opt-in: open the add-on's **Permissions** tab and allow **Access your data for all websites**, otherwise the detector never runs.
5. **OAuth redirect:** Firefox logs in through a normal tab that ends at `<workerUrl>/oauth/callback` (from `background/private-config.js`). Register that URL in your MAL API app (or create a separate MAL client for Firefox if only one redirect is allowed).

Requires Firefox 115+.

## 🧩 Editions

| | Full edition (repo root) | Store edition (`dist/chrome-store`) |
|---|---|---|
| Built-in sites | Full Cloudflare / EverythingMoe list | Official services only (`data/official-sites.json`) |
| Remote site list | Yes | None |
| Extra sites | Popup → **Enable**: added to your list instantly | Popup → **Enable**: Chrome asks permission for the site (and its video player) |
| How to use | Load unpacked (developer mode) | Chrome Web Store |

Both editions save your enabled sites in `chrome.storage.sync`, so they follow your browser account. Don't run both editions at once, or episodes sync twice.

## 📦 Building Store Packages

```bash
node scripts/build.js
```

Creates `dist/anisync-chrome-<version>.zip` (Chrome Web Store, with the dev-only `key` removed) and `dist/anisync-firefox-<version>.zip` (Firefox add-on site, AMO). Bump `version` in `manifest.json` before each upload.

## 📱 Firefox for Android (unsigned, developer use)

Regular Firefox for Android only installs Mozilla-signed add-ons; **Firefox Nightly** can install unsigned ones.

1. One-time MAL setup: add `<workerUrl>/oauth/callback` as a redirect URL in your MAL API app. If MAL allows only one redirect per app, create a second MAL app with that URL and set `FIREFOX_MAL_CLIENT_ID` in `scripts/build.js`.
2. `node scripts/build.js` and copy `dist/anisync-firefox-<version>.zip` to the phone.
3. In Firefox Nightly: open `about:config` and set `xpinstall.signatures.required` to `false`.
4. Settings → About Firefox Nightly → tap the logo until the debug menu unlocks → Settings → **Install extension from file** → pick the zip.
5. In the add-on's settings, allow access to all websites.

On Firefox, login opens MyAnimeList in a normal tab; the tab closes itself once you're logged in (it may flash a "Not Found" page for a moment, which is harmless). Desktop notifications don't exist on Android; check the popup for recent syncs instead.

## ⏱️ When an Episode Counts as Watched

One rule for every length, from 2-minute shorts to 2-hour movies:

1. **Is it really the episode?** The video length is compared with MyAnimeList's average episode length for that show (60%–400%). Fan edits, reactions and compilations fail this; double-length specials pass.
2. **Where does the ending start?** From [AniSkip](https://aniskip.com) community timestamps when available, otherwise estimated from the length (≈70 s for shorts, ≈2.5 min for TV, up to 10 min for movies).
3. **Sync** at whichever comes first: your threshold (default 80%) or the start of the ending — never before half the video.
4. **Moved on early?** Going from episode N to N+1 of the same show after watching at least half of N also counts.
5. **Movies:** pages without an episode number sync as episode 1 when MyAnimeList says it's a movie (or a single-episode special) and the length matches.

If MyAnimeList can't be reached, the previous fixed rules are used as a fallback.

**Rewatching a Completed show** leaves MAL untouched by default. With **Preferences → Track Rewatches & Rereads** on, the first episode (not the last) turns on MAL's *Rewatching* flag. Reaching the last episode while rewatching adds 1 to *times rewatched* and turns the flag off. Your episode count stays at the full total throughout. Watching only the finale doesn't count as a rewatch. Manga works the same way with *Rereading* / *times reread*.

## 📖 When a Manga Chapter Counts as Read

Manga, manhwa and manhua readers from EverythingMoe's `manga` and `manhwa` categories are tracked by chapter (full edition; in the store edition, on sites you enable).

1. **Which chapter?** From the URL (`/chapter-12`, `/ch-12.5`, `/c12`, `?chapter=12`) or the page title / heading (`One Piece Chapter 1100`). The title comes from the page title, the heading or, as a last resort, the URL slug.
2. **Reached the end:** scrolling to the end of the chapter's pages after at least 20 seconds of active reading (idle tabs don't count).
3. **Moved on:** going from chapter N to N+1 (or N.5) of the same manga after at least 20 seconds on N counts N. This also covers page-by-page readers. Jumping ahead (13 → 20) does not.
4. **MyAnimeList rules:** decimal chapters count as the whole chapter before them (10.5 → 10), progress never moves backwards, chapters past MAL's chapter count are refused, and the status becomes Reading / Completed like Watching / Completed for anime. On a tie, a manga beats a light novel with the same title.
5. **Wrong match?** The popup shows which MAL entry was matched. **Wrong match?** lets you paste the correct MAL link; that title then always uses it (works for anime too).

Turn it off with **Preferences → Track Manga**.

## 🎯 How Detection Works

- The detector only activates on **supported streaming domains** (the Cloudflare list, with a bundled `cloudflare-worker/sites.json` fallback).
- Player iframes on any embed domain report progress only when their tab is a supported site, relayed through the extension so pages can't fake it.
- Videos shorter than 2 minutes (ads, previews) never trigger a sync.
- A title is only synced if a MyAnimeList result is a confident fuzzy match; otherwise nothing is written. Use **Preferences → Wrong Title Matched? → Reset** to clear saved automatic matches (matches you fixed by hand are kept).
- The full edition reads EverythingMoe's list itself every 12 hours, so new sites and mirrors are picked up and retired sites dropped without a new release. A list that looks broken (too small, or shrinking by more than 40%) is ignored and the current list is kept.

---

## 📂 Project Architecture

```
anisync extension/
├── manifest.json              # Manifest V3 configuration with fixed PKCE key
├── CHROMEWEBSTORE.md          # Store listing & permission justifications
├── icons/                     # Extension icons (16px, 48px, 128px)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── background/
│   ├── private-config.example.js # Template for your git-ignored private-config.js
│   ├── mal-client.js          # MAL REST API client with OAuth 2.0 PKCE
│   └── service-worker.js      # Background worker handling syncs & notifications
├── content/
│   └── detector.js            # Video player observer & anime metadata scraper
└── popup/
    ├── popup.html             # Extension popup structure
    ├── popup.css              # Modern dark anime theme
    └── popup.js               # Reactive popup logic & settings
```

---

## ☁️ Cloudflare Dynamic Backend

- **Endpoints** (on your own deployment, set as `workerUrl` in `background/private-config.js`): `/sites` (sites with mirrors and proxies), `/domains` (unique domains), `/oauth/callback` (Firefox login redirect)
- **Source**: Extracted directly from [EverythingMoe](https://everythingmoe.com/) index, covering all 109 anime streaming sites and their mirror/proxy networks.
- **Advantage**: Whenever anime streaming domains change (e.g. from `.to` to `.tv` or new proxies appear), you simply update the Cloudflare Worker or run `node scripts/fetch-everythingmoe.js` without having to resubmit the extension to the Chrome Web Store!
- **Local Code**: Stored in `cloudflare-worker/` with `wrangler.toml` and `sites.json`.

