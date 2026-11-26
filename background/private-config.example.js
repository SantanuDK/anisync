// AniSync - Private config TEMPLATE
//
// Copy this file to background/private-config.js and fill in your own values.
// private-config.js is git-ignored, so your IDs never end up in the repository.
//
//   malClientId  Client ID of YOUR MyAnimeList API app (myanimelist.net/apiconfig,
//                App Type "other"). Please register your own app; don't reuse someone else's.
//   workerUrl    Your deployed cloudflare-worker/ (no trailing slash), or null.
//                Used for the remote site list and for the Firefox login redirect
//                (<workerUrl>/oauth/callback, which must be in your MAL app's redirect URLs).
const ANISYNC_PRIVATE = {
  malClientId: 'YOUR_MAL_CLIENT_ID',
  workerUrl: null
};
