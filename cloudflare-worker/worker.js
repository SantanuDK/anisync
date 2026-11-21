/**
 * AniSync - Cloudflare Worker Backend
 * Live at: https://anisync-api.YOUR-SUBDOMAIN.workers.dev/
 * Generated with 109 Anime Sites & 324+ Proxies/Mirrors from EverythingMoe
 */

const DATA = {
  "version": "1.0.0",
  "updatedAt": "2026-11-18T20:18:48.287Z",
  "totalSites": 109,
  "totalDomains": 324,
  "domains": [
    "123anime.la",
    "123animehub.cc",
    "123animes.ru",
    "2dhive.com",
    "4animo.xyz",
    "9anime.br",
    "9anime.cc",
    "9anime.org.lv",
    "9anime.org.ua",
    "9animez.org",
    "9animstv.to",
    "9aniwatch.to",
    "9ime.live",
    "a.214hz.com",
    "all-wish.me",
    "allmanga.to",
    "ani.lol",
    "ani.nz",
    "ani.pm",
    "anibd.app",
    "aniblue.site",
    "anichan.to",
    "anichi.to",
    "anicine.sbs",
    "aniclipse.com",
    "aniclover.cc",
    "anicore.tv",
    "anidap.lol",
    "anidoor.me",
    "anidream.to",
    "anify.to",
    "anigato.lol",
    "anighar.cloud",
    "anigum.com",
    "anihosts.xyz",
    "anihq.cc",
    "anihq.org",
    "anihq.to",
    "anikage.cc",
    "anikairo.sbs",
    "anikoto.cx",
    "anikoto.site",
    "anikototv.bz",
    "anikototv.to",
    "anikura.club",
    "anilast.xyz",
    "anilet.fi",
    "anilight.live",
    "anime-dunya.com",
    "anime-loads.org",
    "anime-update.com",
    "anime-world.app",
    "anime-world.cc",
    "anime-world.co",
    "anime-world.to",
    "anime.kaizoku.site",
    "anime.nexus",
    "anime.streamxtv.tech",
    "anime.uniquestream.net",
    "animealpha.cc",
    "animecool.xyz",
    "animedefenders.me",
    "animedekho.app",
    "animedekho.co",
    "animedekho.com",
    "animedekho.net",
    "animedex.fun",
    "animedub.app",
    "animeflixer.com",
    "animegers.com",
    "animegg.org",
    "animego.net",
    "animeheaven.me",
    "animehunter.to",
    "animejoker.com",
    "animekai.be",
    "animekai.ro",
    "animekizz.live",
    "animenana.com",
    "animenexus.tv",
    "animenosub.to",
    "animeonsen.xyz",
    "animepahe.com",
    "animepahe.ng",
    "animepahe.org",
    "animepahe.pw",
    "animepahe.ru",
    "animepahe.si",
    "animepahe.ws",
    "animepahetv.to",
    "animeparadise.moe",
    "animesaga.net",
    "animesalt.cx",
    "animesilo.cc",
    "animesogo.to",
    "animesuge.com.in",
    "animet.to",
    "animetake.tv",
    "animetsu.site",
    "animetvplus.com",
    "animetvplus.site",
    "animetvplus.xyz",
    "animeuwutv.com",
    "animex.one",
    "animeya.cc",
    "animeyee.lol",
    "animeyubi.com",
    "animixplay.best",
    "animixplay.fun",
    "animixplay.la",
    "animixplay.name",
    "animixplay.st",
    "animixplay.tube",
    "animotv.ru",
    "animotvslash.nl",
    "animotvslash.org",
    "animotvslash.ru",
    "animotvslash.to",
    "anipub.xyz",
    "anirex.to",
    "anisakura.xyz",
    "anisnatch.ru",
    "anisnatch.site",
    "anisnatch.to",
    "anisnatch.top",
    "anistream.one",
    "anisuge.tv",
    "anitaku.com.co",
    "anivault.lol",
    "anivault.tv",
    "aniverse.sbs",
    "aniwatch.cx",
    "aniwatch.fit",
    "aniwatch.su",
    "aniwatchtv.com.ro",
    "aniwatchx.to",
    "aniwave.at",
    "aniwave.com.es",
    "aniwave.com.se",
    "aniwave.fr",
    "aniwave.gr",
    "aniwave.se",
    "aniwaves.ru",
    "aniwaves.tv",
    "aniwitch.cc",
    "aniworld.domains",
    "aniworld.to",
    "anixeo.tv",
    "anixo.buzz",
    "anixo.cfd",
    "anixo.live",
    "anixo.online",
    "anixtv.me",
    "anixx.fun",
    "anizen.tr",
    "anizone.to",
    "anv.to",
    "av1encodes.com",
    "av1please.com",
    "babastream.top",
    "babyanime.top",
    "beta.otaku-streamers.com",
    "bettermelon.ru",
    "bilibili.com",
    "bilibili.tv",
    "cihuynime.net",
    "cove-ani.online",
    "crunchyroll.com",
    "databasegdriveplayer.co",
    "dragonroll.to",
    "enma.lol",
    "fanyme.net",
    "flixeo.tv",
    "gogoanime.by",
    "gogoanime.ovh",
    "gogoanime.ru.com",
    "gogoanimes.cv",
    "gogoanimes.me.uk",
    "gogoanimez.to",
    "gojolive.site",
    "gotaku.to",
    "guts.to",
    "hianime.at",
    "hianime.de.com",
    "hianime.help",
    "hianime.ing",
    "hianimes.cz",
    "hianimes.ru",
    "hianimes.se",
    "hianimetv.su",
    "hianimez.org",
    "hidive.com",
    "hindianimeverse.org",
    "hls.hiasian.to",
    "hopmarks.com",
    "hulu.com",
    "hypeanime.com",
    "itachi.tv",
    "itasha.live",
    "jjba.lol",
    "just4anime.online",
    "justanime.fun",
    "justanime.to",
    "kaa.lt",
    "kaa.mx",
    "kaa.rs",
    "kaa.to",
    "kaas.ro",
    "kaas.to",
    "kaorii.app",
    "kartoons.to",
    "kawaiianime.cc",
    "kayoanimetv.com",
    "kazora.cc",
    "kickass-anime.ro",
    "kickass-anime.ru",
    "kickassanime.cx",
    "kickassanime.mx",
    "kickassanimes.ru",
    "kimoitv.com",
    "kissanime.ba",
    "kissanime.com.cv",
    "kissanimefree.cc",
    "kisskh.co",
    "kisskh.la",
    "koianime.lol",
    "kooanime.lol",
    "kotoplay.to",
    "kototv.to",
    "krussdomi.com",
    "kuroanime.lol",
    "kuroko.cc",
    "kyren.moe",
    "lite.aniwaves.tv",
    "lunaranime.ru",
    "lunarindex.lol",
    "lunarx.lol",
    "lunarx.to",
    "manga.ramenflix.com",
    "meguanime.com",
    "meguanime.net",
    "meguanime.org",
    "mgread.io",
    "miruro.bz",
    "miruro.com",
    "miruro.cx",
    "miruro.online",
    "miruro.ro",
    "miruro.su",
    "miruro.to",
    "miruro.tv",
    "mkissa.to",
    "mmani.com",
    "moetaku.online",
    "nekomiru.com",
    "nekowatch.xyz",
    "nestzone.site",
    "netflix.com",
    "nukitashith.top",
    "oceanveil.net",
    "okarun.moe",
    "onianime.eu",
    "otaku-streamers.com",
    "otakutsu.cc",
    "owocdn.top",
    "pahenime.com",
    "pimpanime.nl",
    "piratexplay.cc",
    "playeng.animeapps.top",
    "projectjust.xyz",
    "ramenflix.com",
    "rareanimes.mov",
    "reanime.bz",
    "reanime.cz",
    "reanime.to",
    "reanime.wtf",
    "reindex.to",
    "retrocrush.tv",
    "sakusaku.to",
    "sankanime.web.id",
    "senpaiflix.fun",
    "shinora.fun",
    "shonen.to",
    "streamex.sh",
    "stronghole.site",
    "tenzora.top",
    "theanimeworld.in",
    "toonstream.dad",
    "ume.to",
    "v3-dev.animeonsen.xyz",
    "vidcloud.sbs",
    "vumeto.com",
    "vumeto.live",
    "w1.zoro.se",
    "watchanime.io",
    "watchanimeworld.in",
    "watchanimeworld.one",
    "watchanimez.me",
    "watchcartoononline.cc",
    "wco.tv",
    "wcoanimedub.tv",
    "wcoanimesub.tv",
    "wcoflix.tv",
    "wcoforever.tv",
    "wcofun.net",
    "wcostatus.com",
    "wcostream.tv",
    "weebtube.cc",
    "xanime.app",
    "xanime.me",
    "xanivsrc10.org",
    "yenime.net",
    "yoanime.me",
    "yomi.to",
    "youtube.com",
    "ytube.site",
    "yumezone.live",
    "zangetsu.cc",
    "zanix.tr",
    "zanora.lol",
    "zanora.xyz",
    "zenkai.to",
    "zokoanime.video",
    "zorotv.cc"
  ],
  "sites": [
    {
      "id": "reanime",
      "name": "Re:Anime",
      "primaryUrl": "https://reanime.cz/home",
      "domains": [
        "reanime.bz",
        "reanime.cz",
        "reanime.to",
        "reanime.wtf",
        "reindex.to",
        "stronghole.site"
      ]
    },
    {
      "id": "anikoto",
      "name": "KotoPlay",
      "primaryUrl": "https://kotoplay.to",
      "domains": [
        "9animez.org",
        "anichi.to",
        "anikoto.site",
        "anikototv.bz",
        "anikototv.to",
        "animepahetv.to",
        "animesogo.to",
        "animixplay.tube",
        "anisuge.tv",
        "anixtv.me",
        "hianimez.org",
        "kotoplay.to"
      ]
    },
    {
      "id": "miruro",
      "name": "Miruro",
      "primaryUrl": "https://www.miruro.cx/",
      "domains": [
        "animeuwutv.com",
        "animeyee.lol",
        "anivault.tv",
        "miruro.bz",
        "miruro.com",
        "miruro.cx",
        "miruro.online",
        "miruro.to",
        "miruro.tv"
      ]
    },
    {
      "id": "gotaku",
      "name": "Gotaku",
      "primaryUrl": "https://gotaku.to/",
      "domains": [
        "gotaku.to"
      ]
    },
    {
      "id": "animepahe",
      "name": "animepahe",
      "primaryUrl": "https://animepahe.pw/",
      "domains": [
        "animepahe.com",
        "animepahe.org",
        "animepahe.pw",
        "animepahe.ru",
        "animepahe.si",
        "owocdn.top"
      ]
    },
    {
      "id": "anipm",
      "name": "ani.pm",
      "primaryUrl": "https://ani.pm/",
      "domains": [
        "ani.nz",
        "ani.pm",
        "ume.to"
      ]
    },
    {
      "id": "anizone",
      "name": "AniZone",
      "primaryUrl": "https://anizone.to/",
      "domains": [
        "anizone.to"
      ]
    },
    {
      "id": "Crunchyroll",
      "name": "Crunchyroll",
      "primaryUrl": "https://www.crunchyroll.com/",
      "domains": [
        "crunchyroll.com"
      ]
    },
    {
      "id": "AllAnime",
      "name": "MKissa",
      "primaryUrl": "https://mkissa.to/anime",
      "domains": [
        "allmanga.to",
        "mkissa.to"
      ]
    },
    {
      "id": "KickAssAnime",
      "name": "KickAssAnime",
      "primaryUrl": "https://kaa.lt/",
      "domains": [
        "kaa.lt",
        "kaa.mx",
        "kaa.rs",
        "kaa.to",
        "kaas.ro",
        "kaas.to",
        "kickass-anime.ro",
        "kickass-anime.ru",
        "kickassanime.cx",
        "kickassanime.mx",
        "kickassanimes.ru",
        "krussdomi.com",
        "watchanime.io"
      ]
    },
    {
      "id": "anisnatch",
      "name": "AniSnatch",
      "primaryUrl": "https://anisnatch.to/home",
      "domains": [
        "anisnatch.ru",
        "anisnatch.site",
        "anisnatch.to",
        "anisnatch.top"
      ]
    },
    {
      "id": "animenexus",
      "name": "Anime Nexus",
      "primaryUrl": "https://anime.nexus/",
      "domains": [
        "anime.nexus",
        "animenexus.tv"
      ]
    },
    {
      "id": "123animes",
      "name": "aniwaves.tv",
      "primaryUrl": "https://aniwaves.tv/home",
      "domains": [
        "123animes.ru",
        "9anime.cc",
        "animecool.xyz",
        "animet.to",
        "animixplay.name",
        "animixplay.st",
        "aniwave.se",
        "aniwaves.ru",
        "aniwaves.tv",
        "guts.to",
        "hianimes.ru",
        "kissanimefree.cc",
        "lite.aniwaves.tv",
        "okarun.moe",
        "w1.zoro.se",
        "zorotv.cc"
      ]
    },
    {
      "id": "Bilibili",
      "name": "Bilibili",
      "primaryUrl": "https://www.bilibili.tv/en/anime",
      "domains": [
        "bilibili.com",
        "bilibili.tv"
      ]
    },
    {
      "id": "Youtube",
      "name": "YouTube",
      "primaryUrl": "https://youtube.com/",
      "domains": [
        "youtube.com"
      ]
    },
    {
      "id": "otakuu",
      "name": "AnimeX",
      "primaryUrl": "https://animex.one/home",
      "domains": [
        "animex.one",
        "anistream.one",
        "aniwave.at"
      ]
    },
    {
      "id": "shiro",
      "name": "anv",
      "primaryUrl": "https://anv.to/",
      "domains": [
        "anv.to"
      ]
    },
    {
      "id": "anilight",
      "name": "AniLight",
      "primaryUrl": "https://anilight.live/",
      "domains": [
        "anilight.live"
      ]
    },
    {
      "id": "AnimeOnsen",
      "name": "AnimeOnsen",
      "primaryUrl": "https://www.animeonsen.xyz/",
      "domains": [
        "animeonsen.xyz",
        "v3-dev.animeonsen.xyz"
      ]
    },
    {
      "id": "anifyto",
      "name": "Anify",
      "primaryUrl": "https://anify.to/",
      "domains": [
        "anify.to",
        "anime-update.com",
        "animenana.com",
        "animetake.tv"
      ]
    },
    {
      "id": "uniquestream",
      "name": "AnimeStream",
      "primaryUrl": "https://anime.uniquestream.net/",
      "domains": [
        "anime.uniquestream.net"
      ]
    },
    {
      "id": "xanime",
      "name": "Xanime",
      "primaryUrl": "https://xanime.me/",
      "domains": [
        "xanime.app",
        "xanime.me",
        "xanivsrc10.org"
      ]
    },
    {
      "id": "animedefenders",
      "name": "Mmani.com",
      "primaryUrl": "https://mmani.com/",
      "domains": [
        "ani.lol",
        "anibd.app",
        "animedefenders.me",
        "mmani.com",
        "nukitashith.top",
        "playeng.animeapps.top"
      ]
    },
    {
      "id": "animotvslash",
      "name": "Animotvslash",
      "primaryUrl": "https://www.animotvslash.org/",
      "domains": [
        "animotv.ru",
        "animotvslash.nl",
        "animotvslash.org",
        "animotvslash.ru",
        "animotvslash.to"
      ]
    },
    {
      "id": "animestreamio",
      "name": "AniHQ",
      "primaryUrl": "https://anihq.cc/home/",
      "domains": [
        "anihq.cc",
        "anihq.org",
        "anihq.to"
      ]
    },
    {
      "id": "AnimeHeaven",
      "name": "AnimeHeaven",
      "primaryUrl": "https://animeheaven.me/",
      "domains": [
        "animeheaven.me"
      ]
    },
    {
      "id": "AnimeParadise",
      "name": "AnimeParadise",
      "primaryUrl": "https://www.animeparadise.moe/",
      "domains": [
        "animeparadise.moe"
      ]
    },
    {
      "id": "ANIMEGG",
      "name": "ANIMEGG",
      "primaryUrl": "https://www.animegg.org/",
      "domains": [
        "animegg.org"
      ]
    },
    {
      "id": "lunaranime",
      "name": "Lunar",
      "primaryUrl": "https://lunarx.lol/anime",
      "domains": [
        "lunaranime.ru",
        "lunarindex.lol",
        "lunarx.lol",
        "lunarx.to"
      ]
    },
    {
      "id": "just4anime",
      "name": "Just4Anime",
      "primaryUrl": "https://just4anime.online/",
      "domains": [
        "just4anime.online"
      ]
    },
    {
      "id": "anistream",
      "name": "Anistream",
      "primaryUrl": "https://anistream.one/home",
      "domains": [
        "anistream.one"
      ]
    },
    {
      "id": "bettermelon",
      "name": "bettermelon",
      "primaryUrl": "https://bettermelon.ru/",
      "domains": [
        "bettermelon.ru"
      ]
    },
    {
      "id": "anidap",
      "name": "Anidap",
      "primaryUrl": "https://anidap.lol/home",
      "domains": [
        "anidap.lol"
      ]
    },
    {
      "id": "kototv",
      "name": "KotoTV",
      "primaryUrl": "https://kototv.to/",
      "domains": [
        "hianime.help",
        "hls.hiasian.to",
        "kototv.to"
      ]
    },
    {
      "id": "anihosts",
      "name": "AniHosts",
      "primaryUrl": "https://anihosts.xyz/",
      "domains": [
        "anihosts.xyz"
      ]
    },
    {
      "id": "2dhive",
      "name": "2Dhive",
      "primaryUrl": "https://2dhive.com/",
      "domains": [
        "2dhive.com",
        "babastream.top"
      ]
    },
    {
      "id": "AniWorld",
      "name": "AniWorld",
      "primaryUrl": "https://aniworld.to/",
      "domains": [
        "aniworld.domains",
        "aniworld.to"
      ]
    },
    {
      "id": "anichan",
      "name": "AniChan",
      "primaryUrl": "https://anichan.to/",
      "domains": [
        "anichan.to"
      ]
    },
    {
      "id": "anigato",
      "name": "AniGato",
      "primaryUrl": "https://anigato.lol/",
      "domains": [
        "anigato.lol",
        "jjba.lol",
        "weebtube.cc"
      ]
    },
    {
      "id": "nekomiru",
      "name": "Nekomiru",
      "primaryUrl": "https://nekomiru.com/",
      "domains": [
        "nekomiru.com"
      ]
    },
    {
      "id": "hidive",
      "name": "HIDIVE",
      "primaryUrl": "https://www.hidive.com/",
      "domains": [
        "hidive.com"
      ]
    },
    {
      "id": "oceanveilnet",
      "name": "OceanVeil",
      "primaryUrl": "https://oceanveil.net/",
      "domains": [
        "oceanveil.net"
      ]
    },
    {
      "id": "kisskhanime",
      "name": "Kisskh",
      "primaryUrl": "https://kisskh.co/Explore?type=3&sub=1&country=3",
      "domains": [
        "kisskh.co",
        "kisskh.la"
      ]
    },
    {
      "id": "4animo",
      "name": "Zanix",
      "primaryUrl": "https://zanix.tr/home",
      "domains": [
        "4animo.xyz",
        "zangetsu.cc",
        "zanix.tr"
      ]
    },
    {
      "id": "mgread",
      "name": "Mgread - Anime",
      "primaryUrl": "https://mgread.io/genre/anime/",
      "domains": [
        "mgread.io"
      ]
    },
    {
      "id": "pahenime",
      "name": "Pahenime",
      "primaryUrl": "https://pahenime.com/",
      "domains": [
        "pahenime.com"
      ]
    },
    {
      "id": "zokoanime",
      "name": "hianimes.se",
      "primaryUrl": "https://hianimes.se/home",
      "domains": [
        "hianime.at",
        "hianimes.se",
        "zokoanime.video"
      ]
    },
    {
      "id": "databasegdriveplayer",
      "name": "animekai.ro",
      "primaryUrl": "https://animekai.ro/",
      "domains": [
        "animekai.ro",
        "animepahe.ng",
        "databasegdriveplayer.co"
      ]
    },
    {
      "id": "kuroanime",
      "name": "Kuroko",
      "primaryUrl": "https://kuroko.cc/home",
      "domains": [
        "kuroanime.lol",
        "kuroko.cc"
      ]
    },
    {
      "id": "animeloads",
      "name": "Anime-Loads",
      "primaryUrl": "https://www.anime-loads.org/",
      "domains": [
        "anime-loads.org"
      ]
    },
    {
      "id": "WCO",
      "name": "WCO",
      "primaryUrl": "https://www.wcostream.tv/",
      "domains": [
        "watchcartoononline.cc",
        "wco.tv",
        "wcoanimedub.tv",
        "wcoanimesub.tv",
        "wcoflix.tv",
        "wcoforever.tv",
        "wcofun.net",
        "wcostatus.com",
        "wcostream.tv"
      ]
    },
    {
      "id": "AnimeNoSub",
      "name": "AnimeNoSub",
      "primaryUrl": "https://animenosub.to/",
      "domains": [
        "animenosub.to"
      ]
    },
    {
      "id": "kimoitv",
      "name": "KimoiTV",
      "primaryUrl": "https://kimoitv.com/list/Anime.html",
      "domains": [
        "kimoitv.com"
      ]
    },
    {
      "id": "otakustreamers",
      "name": "Otaku-Streamers",
      "primaryUrl": "https://otaku-streamers.com/",
      "domains": [
        "beta.otaku-streamers.com",
        "otaku-streamers.com"
      ]
    },
    {
      "id": "av1please",
      "name": "AnimeAlpha",
      "primaryUrl": "https://animealpha.cc/",
      "domains": [
        "animealpha.cc",
        "av1encodes.com",
        "av1please.com"
      ]
    },
    {
      "id": "zenkai",
      "name": "Zenkai",
      "primaryUrl": "https://zenkai.to/home",
      "domains": [
        "hianime.help",
        "kototv.to",
        "zenkai.to"
      ]
    },
    {
      "id": "animetvplus",
      "name": "animeTVplus",
      "primaryUrl": "https://animetvplus.xyz/",
      "domains": [
        "animetvplus.com",
        "animetvplus.site",
        "animetvplus.xyz"
      ]
    },
    {
      "id": "kawaiianime",
      "name": "Kawaii Anime",
      "primaryUrl": "https://kawaiianime.cc/",
      "domains": [
        "kawaiianime.cc"
      ]
    },
    {
      "id": "123anime",
      "name": "123anime",
      "primaryUrl": "https://123animehub.cc/home",
      "domains": [
        "123anime.la",
        "123animehub.cc",
        "animixplay.la"
      ]
    },
    {
      "id": "anikura",
      "name": "Anikura",
      "primaryUrl": "https://anikura.club/",
      "domains": [
        "anikura.club"
      ]
    },
    {
      "id": "meguanime",
      "name": "MeguAnimes",
      "primaryUrl": "https://meguanime.com/",
      "domains": [
        "anisakura.xyz",
        "meguanime.com",
        "meguanime.net",
        "meguanime.org"
      ]
    },
    {
      "id": "kazora",
      "name": "Kazora",
      "primaryUrl": "https://kazora.cc/",
      "domains": [
        "kazora.cc"
      ]
    },
    {
      "id": "kaizokusite",
      "name": "Itasha",
      "primaryUrl": "https://itasha.live/",
      "domains": [
        "anime.kaizoku.site",
        "itasha.live"
      ]
    },
    {
      "id": "shonento",
      "name": "shonen.to",
      "primaryUrl": "https://shonen.to/",
      "domains": [
        "shonen.to"
      ]
    },
    {
      "id": "otakutsu",
      "name": "Otakutsu",
      "primaryUrl": "https://otakutsu.cc/",
      "domains": [
        "otakutsu.cc"
      ]
    },
    {
      "id": "anicore",
      "name": "Anikage",
      "primaryUrl": "https://anikage.cc/home",
      "domains": [
        "anicore.tv",
        "anikage.cc"
      ]
    },
    {
      "id": "justanime",
      "name": "JustAnime",
      "primaryUrl": "https://www.justanime.to/",
      "domains": [
        "justanime.fun",
        "justanime.to",
        "projectjust.xyz"
      ]
    },
    {
      "id": "vumeto",
      "name": "Vumeto",
      "primaryUrl": "https://vumeto.live/#/anime",
      "domains": [
        "vumeto.com",
        "vumeto.live"
      ]
    },
    {
      "id": "animeyubi",
      "name": "Animeyubi",
      "primaryUrl": "https://animeyubi.com/",
      "domains": [
        "animeyubi.com"
      ]
    },
    {
      "id": "9ime",
      "name": "9ime",
      "primaryUrl": "https://9ime.live/home",
      "domains": [
        "9ime.live"
      ]
    },
    {
      "id": "anidream",
      "name": "AniDream",
      "primaryUrl": "https://anidream.to/",
      "domains": [
        "anidream.to"
      ]
    },
    {
      "id": "anixo",
      "name": "AniXo",
      "primaryUrl": "https://anixo.online/home",
      "domains": [
        "anixo.buzz",
        "anixo.cfd",
        "anixo.live",
        "anixo.online",
        "vidcloud.sbs"
      ]
    },
    {
      "id": "kooanime",
      "name": "KooAnime",
      "primaryUrl": "https://kooanime.lol/home",
      "domains": [
        "anirex.to",
        "kooanime.lol"
      ]
    },
    {
      "id": "last1234",
      "name": "AniLast",
      "primaryUrl": "https://anilast.xyz/",
      "domains": [
        "anilast.xyz"
      ]
    },
    {
      "id": "nekowatch",
      "name": "NekoWatch",
      "primaryUrl": "https://nekowatch.xyz/",
      "domains": [
        "nekowatch.xyz"
      ]
    },
    {
      "id": "yumezone",
      "name": "YumeZone",
      "primaryUrl": "https://yumezone.live/",
      "domains": [
        "yumezone.live"
      ]
    },
    {
      "id": "itachitv",
      "name": "Itachi",
      "primaryUrl": "https://itachi.tv/",
      "domains": [
        "itachi.tv"
      ]
    },
    {
      "id": "kaorii",
      "name": "Kaori",
      "primaryUrl": "https://kaorii.app/",
      "domains": [
        "kaorii.app"
      ]
    },
    {
      "id": "animekizz",
      "name": "AnimeKizz",
      "primaryUrl": "https://animekizz.live/",
      "domains": [
        "animekizz.live"
      ]
    },
    {
      "id": "kyren",
      "name": "Kyren",
      "primaryUrl": "https://kyren.moe/",
      "domains": [
        "kyren.moe"
      ]
    },
    {
      "id": "watchanimez",
      "name": "WatchAnimeX",
      "primaryUrl": "https://watchanimez.me/",
      "domains": [
        "watchanimez.me"
      ]
    },
    {
      "id": "pimpanime",
      "name": "PimpAnime",
      "primaryUrl": "https://pimpanime.nl/",
      "domains": [
        "pimpanime.nl"
      ]
    },
    {
      "id": "megaplaysu",
      "name": "megaplay.su",
      "primaryUrl": "https://aniwatchtv.com.ro/",
      "domains": [
        "aniwatch.su",
        "aniwatchtv.com.ro",
        "gogoanime.by",
        "gogoanime.ovh",
        "gogoanime.ru.com",
        "hianimetv.su",
        "kissanime.ba",
        "kissanime.com.cv",
        "miruro.ro",
        "miruro.su"
      ]
    },
    {
      "id": "netflix",
      "name": "Netflix",
      "primaryUrl": "https://www.netflix.com/browse/genre/7424",
      "domains": [
        "netflix.com"
      ]
    },
    {
      "id": "retrocrush",
      "name": "RetroCrush",
      "primaryUrl": "https://www.retrocrush.tv/",
      "domains": [
        "retrocrush.tv"
      ]
    },
    {
      "id": "yomito",
      "name": "Yomi",
      "primaryUrl": "https://yomi.to/",
      "domains": [
        "anime.streamxtv.tech",
        "animego.net",
        "animehunter.to",
        "animesaga.net",
        "animetsu.site",
        "anivault.lol",
        "aniwatch.cx",
        "aniwitch.cc",
        "anixx.fun",
        "cihuynime.net",
        "cove-ani.online",
        "dragonroll.to",
        "fanyme.net",
        "gojolive.site",
        "koianime.lol",
        "sakusaku.to",
        "senpaiflix.fun",
        "tenzora.top",
        "yomi.to",
        "ytube.site"
      ]
    },
    {
      "id": "hopmarks",
      "name": "a.214hz",
      "primaryUrl": "https://a.214hz.com/",
      "domains": [
        "a.214hz.com",
        "hopmarks.com"
      ]
    },
    {
      "id": "anilet",
      "name": "anilet",
      "primaryUrl": "https://anilet.fi/",
      "domains": [
        "anilet.fi"
      ]
    },
    {
      "id": "sankanime",
      "name": "Sankanime",
      "primaryUrl": "https://sankanime.web.id/",
      "domains": [
        "sankanime.web.id"
      ]
    },
    {
      "id": "anikotoclones",
      "name": "Aniverse",
      "primaryUrl": "https://www.aniverse.sbs/home",
      "domains": [
        "9anime.org.lv",
        "all-wish.me",
        "animeflixer.com",
        "animekai.be",
        "animepahe.ws",
        "animesilo.cc",
        "animesuge.com.in",
        "anitaku.com.co",
        "aniverse.sbs",
        "aniwatchx.to",
        "anixeo.tv",
        "anizen.tr",
        "babyanime.top",
        "flixeo.tv",
        "gogoanimes.cv",
        "gogoanimes.me.uk",
        "gogoanimez.to",
        "hianime.de.com",
        "hianime.ing",
        "hypeanime.com",
        "moetaku.online",
        "yenime.net",
        "yoanime.me"
      ]
    },
    {
      "id": "animedex",
      "name": "AnimeDex",
      "primaryUrl": "https://animedex.fun/",
      "domains": [
        "animedex.fun"
      ]
    },
    {
      "id": "aniblue",
      "name": "AniBlue",
      "primaryUrl": "https://aniblue.site/",
      "domains": [
        "aniblue.site"
      ]
    },
    {
      "id": "nestzone",
      "name": "NestZone",
      "primaryUrl": "https://nestzone.site/",
      "domains": [
        "nestzone.site"
      ]
    },
    {
      "id": "aniclipse",
      "name": "AniClipse",
      "primaryUrl": "https://aniclipse.com/",
      "domains": [
        "aniclipse.com",
        "anikoto.cx"
      ]
    },
    {
      "id": "onianime",
      "name": "Onianime",
      "primaryUrl": "https://onianime.eu/home",
      "domains": [
        "onianime.eu"
      ]
    },
    {
      "id": "animegers",
      "name": "Animegers",
      "primaryUrl": "https://animegers.com/",
      "domains": [
        "animegers.com"
      ]
    },
    {
      "id": "shinora",
      "name": "Zanora",
      "primaryUrl": "https://zanora.xyz/home",
      "domains": [
        "aniclover.cc",
        "shinora.fun",
        "zanora.lol",
        "zanora.xyz"
      ]
    },
    {
      "id": "anigum",
      "name": "StreamX",
      "primaryUrl": "https://streamex.sh/anime",
      "domains": [
        "anicine.sbs",
        "anidoor.me",
        "anigum.com",
        "anikairo.sbs",
        "streamex.sh"
      ]
    },
    {
      "id": "aniwaveclones",
      "name": "aniwavebr",
      "primaryUrl": "https://aniwave.gr/",
      "domains": [
        "9anime.br",
        "9anime.org.ua",
        "9aniwatch.to",
        "aniwave.com.es",
        "aniwave.com.se",
        "aniwave.fr",
        "aniwave.gr"
      ]
    },
    {
      "id": "hulu",
      "name": "Hulu",
      "primaryUrl": "https://www.hulu.com/hub/anime",
      "domains": [
        "hulu.com"
      ]
    },
    {
      "id": "9animstv",
      "name": "9animstv",
      "primaryUrl": "https://9animstv.to/",
      "domains": [
        "9animstv.to"
      ]
    },
    {
      "id": "animesheaven",
      "name": "Animeya",
      "primaryUrl": "https://www.animeya.cc/home",
      "domains": [
        "anighar.cloud",
        "animeya.cc"
      ]
    },
    {
      "id": "enmalol",
      "name": "Enma",
      "primaryUrl": "https://www.enma.lol/",
      "domains": [
        "anipub.xyz",
        "aniwatch.fit",
        "enma.lol",
        "hianimes.cz"
      ]
    },
    {
      "id": "ramenflix",
      "name": "RamenFlix",
      "primaryUrl": "https://ramenflix.com/home",
      "domains": [
        "manga.ramenflix.com",
        "ramenflix.com"
      ]
    },
    {
      "id": "anime-dunya",
      "name": "Anime-Dunya",
      "primaryUrl": "https://anime-dunya.com/",
      "domains": [
        "anime-dunya.com"
      ]
    },
    {
      "id": "kayoanimetv",
      "name": "Kayoanimetv",
      "primaryUrl": "https://animixplay.fun/",
      "domains": [
        "animixplay.best",
        "animixplay.fun",
        "kayoanimetv.com"
      ]
    },
    {
      "id": "animeworldin",
      "name": "AnimeWorld",
      "primaryUrl": "https://watchanimeworld.one/",
      "domains": [
        "anime-world.app",
        "anime-world.cc",
        "anime-world.co",
        "anime-world.to",
        "animezoker.com",
        "animesalt.cx",
        "hindianimeverse.org",
        "piratexplay.cc",
        "rareanimes.mov",
        "theanimeworld.in",
        "toonstream.dad",
        "watchanimeworld.in",
        "watchanimeworld.one"
      ]
    },
    {
      "id": "animedekho",
      "name": "AnimeDekho",
      "primaryUrl": "https://animedekho.app/home",
      "domains": [
        "animedekho.app",
        "animedekho.co",
        "animedekho.com",
        "animedekho.net"
      ]
    },
    {
      "id": "animedubpro",
      "name": "AnimeDUB",
      "primaryUrl": "https://animedub.app/home",
      "domains": [
        "animedub.app",
        "kartoons.to"
      ]
    }
  ]
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (url.pathname === "/") {
      return new Response(JSON.stringify({
        status: "online",
        service: "AniSync Cloudflare Backend",
        version: DATA.version,
        totalSites: DATA.totalSites,
        totalDomains: DATA.totalDomains,
        endpoints: ["/sites", "/domains", "/oauth/callback"]
      }, null, 2), { headers: corsHeaders });
    }

    // Full sites array with proxies and mirrors
    if (url.pathname === "/sites") {
      return new Response(JSON.stringify(DATA, null, 2), { headers: corsHeaders });
    }

    // OAuth landing page for AniSync's tab-based login (Firefox / Android).
    // The extension reads the code from this tab's URL; the page never touches it.
    if (url.pathname === "/oauth/callback") {
      return new Response(
        '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>AniSync</title></head><body style="font-family:system-ui,sans-serif;background:#0F172A;color:#F8FAFC;text-align:center;padding-top:30vh">' +
        '<p>Logging you in to AniSync&hellip; you can close this tab.</p></body></html>',
        { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } }
      );
    }

    // Flat array of all supported domains and proxies
    if (url.pathname === "/domains") {
      return new Response(JSON.stringify({
        count: DATA.totalDomains,
        domains: DATA.domains
      }, null, 2), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: corsHeaders
    });
  }
};
