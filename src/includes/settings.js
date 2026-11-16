const settings = {
    naming: {
        allowEmojis: false,
        invalidCharSubstitute: '-',
    },
    hosts: {
        goFile: {
            token: '',
        },
    },
    ui: {
        checkboxes: {
            toggleAllCheckboxLabel: '',
        },
    },
    extensions: {
        documents: ['.txt', '.doc', '.docx', '.pdf'],
        compressed: ['.zip', '.rar', '.7z', '.tar', '.bz2', '.gzip'],
        image: ['.jpg', '.jpeg', '.png', '.gif', '.gif', '.webp', '.jpe', '.svg', '.tif', '.tiff', '.jif'],
        video: [
            '.mpeg',
            '.avchd',
            '.webm',
            '.mpv',
            '.swf',
            '.avi',
            '.m4p',
            '.wmv',
            '.mp2',
            '.m4v',
            '.qt',
            '.mpe',
            '.mp4',
            '.flv',
            '.mov',
            '.mpg',
            '.ogg',
        ],
    },
};

// --- Persistent User Preferences (Post & Download Page Settings) --------------------------------
const XFPD_USER_PREFS_KEY = 'xfpd_user_prefs';

const XFPD_DEFAULT_USER_PREFS = Object.freeze({
    zipped: true,
    flatten: false,
    generateLinks: false,
    generateLog: false,
    skipDuplicates: false,
    skipDownload: false,
    verifyBunkrLinks: false,
});

const XFPD_USER_PREF_KEYS = Object.keys(XFPD_DEFAULT_USER_PREFS);

let xfpdPrefsMirror = null;
let xfpdPrefsListenerBound = false;
const xfpdPrefsSubscribers = new Set();

function xfpdNormalizeUserPrefs(rawObj) {
    const src = rawObj && typeof rawObj === 'object' ? rawObj : {};
    const normalized = {};
    for (const key of XFPD_USER_PREF_KEYS) {
        normalized[key] = typeof src[key] === 'boolean' ? src[key] : XFPD_DEFAULT_USER_PREFS[key];
    }
    const pre = src.preSkipDownload && typeof src.preSkipDownload === 'object' ? src.preSkipDownload : null;
    normalized.preSkipDownload = {
        flatten: pre && typeof pre.flatten === 'boolean' ? pre.flatten : (normalized.skipDownload ? false : normalized.flatten),
        skipDuplicates:
            pre && typeof pre.skipDuplicates === 'boolean'
                ? pre.skipDuplicates
                : (normalized.skipDownload ? false : normalized.skipDuplicates),
        generateLinks:
            pre && typeof pre.generateLinks === 'boolean'
                ? pre.generateLinks
                : (normalized.skipDownload ? false : normalized.generateLinks),
    };
    if (normalized.skipDownload) {
        normalized.flatten = false;
        normalized.skipDuplicates = false;
        normalized.generateLinks = true;
    }
    normalized._updatedAt = Number(src._updatedAt || 0) || 0;
    return normalized;
}

function xfpdParsePrefsJson(raw) {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    try {
        const parsed = JSON.parse(String(raw));
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (e) {
        return null;
    }
}

function xfpdBindUserPrefsStorageListener() {
    if (xfpdPrefsListenerBound) return;
    const addListener =
        (typeof GM_addValueChangeListener === 'function' ? GM_addValueChangeListener : null) ||
        (typeof window !== 'undefined' && typeof window.GM_addValueChangeListener === 'function'
            ? window.GM_addValueChangeListener.bind(window)
            : null);
    if (!addListener) return;
    xfpdPrefsListenerBound = true;
    try {
        addListener(XFPD_USER_PREFS_KEY, (_name, _oldVal, newVal, remote) => {
            const parsed = xfpdParsePrefsJson(newVal);
            if (!parsed) return;
            const prev = xfpdPrefsMirror;
            xfpdPrefsMirror = xfpdNormalizeUserPrefs(parsed);
            try {
                if (typeof localStorage !== 'undefined' && localStorage) {
                    localStorage.setItem(XFPD_USER_PREFS_KEY, JSON.stringify(xfpdPrefsMirror));
                }
            } catch (e) {}
            if (remote) {
                const changed = prev
                    ? XFPD_USER_PREF_KEYS.filter(k => prev[k] !== xfpdPrefsMirror[k])
                    : XFPD_USER_PREF_KEYS.slice();
                if (changed.length) {
                    xfpdPrefsSubscribers.forEach(cb => {
                        try {
                            cb(xfpdNormalizeUserPrefs(xfpdPrefsMirror), changed, 'storage');
                        } catch (e) {}
                    });
                }
            }
        });
    } catch (e) {}
}

function xfpdLoadUserPrefs() {
    xfpdBindUserPrefsStorageListener();
    const candidates = [];
    if (xfpdPrefsMirror) candidates.push(xfpdPrefsMirror);
    try {
        if (typeof GM_getValue === 'function') {
            const gmParsed = xfpdParsePrefsJson(GM_getValue(XFPD_USER_PREFS_KEY, ''));
            if (gmParsed) candidates.push(gmParsed);
        }
    } catch (e) {}
    try {
        if (typeof localStorage !== 'undefined' && localStorage) {
            const lsParsed = xfpdParsePrefsJson(localStorage.getItem(XFPD_USER_PREFS_KEY));
            if (lsParsed) candidates.push(lsParsed);
        }
    } catch (e) {}

    let chosen = null;
    for (const c of candidates) {
        if (!chosen) {
            chosen = c;
            continue;
        }
        const cTime = Number(c._updatedAt || 0) || 0;
        const chosenTime = Number(chosen._updatedAt || 0) || 0;
        if (cTime > chosenTime) {
            chosen = c;
        }
    }

    const normalized = xfpdNormalizeUserPrefs(chosen);
    xfpdPrefsMirror = normalized;
    return xfpdNormalizeUserPrefs(normalized);
}

function xfpdSaveUserPrefs(patch, source = 'post', explicitChangedKeys = null) {
    const current = xfpdLoadUserPrefs();
    const merged = {
        ...current,
        ...(patch && typeof patch === 'object' ? patch : {}),
        preSkipDownload: {
            ...current.preSkipDownload,
            ...(patch && patch.preSkipDownload && typeof patch.preSkipDownload === 'object' ? patch.preSkipDownload : {}),
        },
        _updatedAt: Math.max(Date.now(), (Number(current._updatedAt || 0) || 0) + 1),
    };
    const next = xfpdNormalizeUserPrefs(merged);
    const changedKeys =
        Array.isArray(explicitChangedKeys) && explicitChangedKeys.length
            ? explicitChangedKeys.filter(k => XFPD_USER_PREF_KEYS.includes(k))
            : XFPD_USER_PREF_KEYS.filter(k => current[k] !== next[k]);

    xfpdPrefsMirror = next;
    const serialized = JSON.stringify(next);
    try {
        if (typeof GM_setValue === 'function') {
            GM_setValue(XFPD_USER_PREFS_KEY, serialized);
        }
    } catch (e) {}
    try {
        if (typeof localStorage !== 'undefined' && localStorage) {
            localStorage.setItem(XFPD_USER_PREFS_KEY, serialized);
        }
    } catch (e) {}

    xfpdPrefsSubscribers.forEach(cb => {
        try {
            cb(xfpdNormalizeUserPrefs(next), changedKeys, source);
        } catch (e) {}
    });

    return xfpdNormalizeUserPrefs(next);
}

function xfpdOnUserPrefsChange(cb) {
    if (typeof cb !== 'function') return () => {};
    xfpdBindUserPrefsStorageListener();
    xfpdPrefsSubscribers.add(cb);
    return () => xfpdPrefsSubscribers.delete(cb);
}

function xfpdCreatePostSettings() {
    const prefs = xfpdLoadUserPrefs();
    const postSettings = {
        zipped: prefs.zipped,
        flatten: prefs.flatten,
        generateLinks: prefs.generateLinks,
        generateLog: prefs.generateLog,
        skipDuplicates: prefs.skipDuplicates,
        skipDownload: prefs.skipDownload,
        verifyBunkrLinks: prefs.verifyBunkrLinks,
        preSkipDownload: { ...prefs.preSkipDownload },
        output: [],
    };
    Object.defineProperty(postSettings, '_overridden', {
        value: new Set(),
        enumerable: false,
        writable: true,
        configurable: true,
    });
    return postSettings;
}

// GoFile filename hints (from API) so we don't rely on URL-encoded path segments
const gofileNameById = new Map();
const gofileNameByUrl = new Map();

// GoFile: the site itself authenticates CDN downloads (store*/cache*.gofile.io) via an
// "accountToken" cookie, set client-side in account.js as:
//   document.cookie = "accountToken=" + activeAccount.token + ";path=/;domain=gofile.io;SameSite=Lax;Secure;"
// Our GM_xmlhttpRequest download calls send cookies (anonymous: false), so mirroring that
// cookie with OUR already-resolved guest token keeps resolution and download on the same
// account. (The old warm-up-tab-only approach loaded a bare gofile.io tab whose own JS has
// no knowledge of our token -- it creates and cookies a brand-new, unrelated guest account,
// which only works by chance.) Cheap local browser API, safe to call before every request.
//
// Whatever accountToken cookie already exists (e.g. the user's own logged-in GoFile session)
// gets overwritten by this. Capture it once per run so it can be restored via
// gofileRestoreCookie() once no post is still processing (see setProcessing() below).
let gofileCookieCaptured = false;
let gofileOriginalCookieValue = null; // null = no cookie existed originally

const gofileCaptureOriginalCookie = () =>
    new Promise(resolve => {
        if (gofileCookieCaptured || typeof GM_cookie === 'undefined' || !GM_cookie || typeof GM_cookie.list !== 'function') {
            resolve();
            return;
        }
        try {
            GM_cookie.list({ url: 'https://gofile.io/', domain: 'gofile.io', name: 'accountToken' }, (cookies, error) => {
                if (error) {
                    console.warn('[GoFile] GM_cookie.list failed while capturing original accountToken cookie:', error);
                } else {
                    const existing = Array.isArray(cookies) ? cookies.find(c => c && c.name === 'accountToken') : null;
                    gofileOriginalCookieValue = existing ? existing.value : null;
                }
                gofileCookieCaptured = true;
                resolve();
            });
        } catch (e) {
            console.warn('[GoFile] GM_cookie.list threw while capturing original accountToken cookie:', e);
            gofileCookieCaptured = true;
            resolve();
        }
    });

const gofileSyncCookie = token =>
    new Promise(resolve => {
        (async () => {
            try {
                if (!token || typeof GM_cookie === 'undefined' || !GM_cookie || typeof GM_cookie.set !== 'function') {
                    resolve(false);
                    return;
                }
                await gofileCaptureOriginalCookie();
                GM_cookie.set(
                    {
                        url: 'https://gofile.io/',
                        name: 'accountToken',
                        value: String(token),
                        domain: 'gofile.io',
                        path: '/',
                        secure: true,
                        sameSite: 'lax',
                    },
                    error => {
                        if (error) console.warn('[GoFile] GM_cookie.set failed for accountToken:', error);
                        resolve(!error);
                    },
                );
            } catch (e) {
                console.warn('[GoFile] gofileSyncCookie threw:', e);
                resolve(false);
            }
        })();
    });

// Restore whatever accountToken cookie existed before we started overwriting it (or remove
// ours if none existed). Called once no post is still processing -- see setProcessing() below.
const gofileRestoreCookie = () =>
    new Promise(resolve => {
        try {
            if (!gofileCookieCaptured || typeof GM_cookie === 'undefined' || !GM_cookie) {
                resolve();
                return;
            }
            const originalValue = gofileOriginalCookieValue;
            gofileCookieCaptured = false;
            gofileOriginalCookieValue = null;

            if (originalValue === null) {
                if (typeof GM_cookie.delete === 'function') {
                    GM_cookie.delete({ url: 'https://gofile.io/', name: 'accountToken', domain: 'gofile.io', path: '/' }, error => {
                        if (error) console.warn('[GoFile] Failed to remove guest accountToken cookie during restore:', error);
                        resolve();
                    });
                    return;
                }
                resolve();
                return;
            }

            GM_cookie.set(
                {
                    url: 'https://gofile.io/',
                    name: 'accountToken',
                    value: originalValue,
                    domain: 'gofile.io',
                    path: '/',
                    secure: true,
                    sameSite: 'lax',
                },
                error => {
                    if (error) console.warn('[GoFile] Failed to restore original accountToken cookie:', error);
                    resolve();
                },
            );
        } catch (e) {
            resolve();
        }
    });

// Cyberdrop filename hints (from API)
const cyberdropNameBySlug = new Map();
const cyberdropNameByUrl = new Map();

// Filester filename/size hints (from API)
const filesterNameBySlug = new Map();
const filesterNameByUrl = new Map();
const filesterSizeBySlug = new Map();
const filesterSizeByUrl = new Map();
const filesterSlugByUrl = new Map();
const filesterRefByUrl = new Map();

// Filester: cache candidate fallback (some tokens are served from different cacheN hosts; cache6 is common but not guaranteed)
const filesterCandidatesByToken = new Map(); // token -> string[]
const filesterTriedByToken = new Map();      // token -> Set<string> of tried candidate URLs
const filester429AttemptsByKey = new Map(); // token/url -> number of 429 retries (rate limiting)
const filesterRetryAttemptsByKey = new Map(); // token/url -> number of retries on transient HTTP errors (429/400/etc)


function filesterTokenFromVUrl(u) {
    try {
        const m = /\/v\/([^\/?#]+)/i.exec(String(u || ''));
        return m && m[1] ? String(m[1]) : '';
    } catch (e) { return ''; }
}

// Stream hosts, in probe order. Filester migrated its CDN to fscN.cdn.cr (2026-07), so those go
// first. The legacy cacheN.filester.me set is kept as a fallback tail — Filester had maintenance
// recently and may restore them.
//
// Ordering matters more than membership here. As of 2026-07-29 cache2/3/4/5/7/8 are NXDOMAIN, which
// costs nothing (instant failure), but cache1 and cache6 still resolve and then **accept the
// connection and never answer** — ~78s each against Chrome's socket timeout. Two of those in the old
// order (apiBase, cache6, cache1, ...) is exactly the ~157s per link that was observed.
const FILESTER_STREAM_HOSTS = [
    'https://fsc1.cdn.cr',
    'https://fsc2.cdn.cr',
    'https://fsc3.cdn.cr',
    // Legacy tail, cheapest-first: these six are NXDOMAIN today, so they fail instantly and cost
    // nothing if Filester has not restored them.
    'https://cache2.filester.me',
    'https://cache3.filester.me',
    'https://cache4.filester.me',
    'https://cache5.filester.me',
    'https://cache7.filester.me',
    'https://cache8.filester.me',
    // Last: these two resolve but black-hole the connection, so each costs a full probe timeout.
    // Kept only so they start working again by themselves if Filester brings them back.
    'https://cache6.filester.me',
    'https://cache1.filester.me',
];

// Per-request deadline for a speculative probe, and a cap on the whole sweep. Both are load-bearing:
// without them a single black-holing host stalls the entire resolution loop.
const FILESTER_PROBE_TIMEOUT_MS = 8000;
const FILESTER_PROBE_BUDGET_MS = 25000;
// API/HTML steps are on the critical path (no fallback host to try), so they get a looser deadline.
const FILESTER_API_TIMEOUT_MS = 20000;

// `apiBase` first on Chrome: Tampermonkey downloads are more reliable started from the site origin,
// since the redirects preserve a Filester referrer.
function filesterStreamBases(apiBase) {
    const base = String(apiBase || 'https://filester.me').replace(/\/$/, '');
    const out = [];
    if (!isFF) out.push(base);
    for (const h of FILESTER_STREAM_HOSTS) out.push(h);
    if (isFF) out.push(base);
    return out.filter((v, i, a) => a.indexOf(v) === i);
}

function filesterBuildCandidates(token, apiBase) {
    const t = String(token || '').trim();
    if (!t) return [];
    return filesterStreamBases(apiBase).map(b => `${b}/v/${t}`);
}

// Filester v2 public API -- the only resolver that still works. The v1 /api/public/download
// endpoint keeps answering 200 with a legacy-shaped payload whose /v/<token> URL now 404s on every
// CDN host, so anything still calling it silently produces dead links.
//   POST {apiBase}/v2/api/public/download  {file_slug}
//     -> { server, file: "<uuid>.<ext>", token, name, expires_in }
//   URL = `${server}/v2/${file}?token=${token}&download=true&n=${name}`
// `server` is whichever host Filester picks (fsc1/fsc2/fsc3.cdn.cr today, and it does vary per
// request) -- take it as given rather than validating it against a known-host list, which is what
// broke a third-party build when fsc3 started appearing. There is no host ladder to walk here:
// the token is only valid for the server that issued it, so `filesterBuildCandidates` must not be
// used on a v2 URL.
//
// Shared by the /d/ link resolver and by the download-time resolver for album (/f/) slugs. The
// latter used to carry its own v1 copy of this, which is why single links worked while albums
// still fell back to fscN.cdn.cr/v/<token> and 404'd.
//
// Tokens are IP-bound and expire in ~30 min, so callers should resolve as late as possible.
async function filesterResolveV2(http, apiBase, slug, progressCB) {
    const base = String(apiBase || 'https://filester.me').replace(/\/$/, '');
    const s = String(slug || '').trim();
    if (!s) return null;

    try {
        if (typeof progressCB === 'function') progressCB('[Filester] Requesting download token (v2)...');

        const res = await http.base(
            'POST',
            `${base}/v2/api/public/download`,
            {},
            {
                Accept: 'application/json, text/plain, */*',
                'Content-Type': 'application/json;charset=UTF-8',
                Origin: base,
                Referer: `${base}/d/${s}`,
                __xfpd_withCredentials: true,
                __xfpd_timeout: FILESTER_API_TIMEOUT_MS,
            },
            JSON.stringify({ file_slug: s }),
            'text',
        );

        let j = null;
        try { j = JSON.parse(String((res && res.source) || '')); } catch (e) {}

        const server = String((j && j.server) || '').replace(/\/$/, '');
        const file = String((j && j.file) || '');
        const token = String((j && j.token) || '');
        const name = String((j && j.name) || '');
        if (!server || !file || !token) return null;

        // Encode per path segment, not with encodeURI: encodeURI leaves `#` alone, which would
        // truncate the URL at the fragment. `file` is "<uuid>.<ext>" today, so this normally
        // changes nothing -- it just stops a stray character from silently killing the download.
        const filePath = String(file).split('/').map(encodeURIComponent).join('/');
        let streamUrl = `${server}/v2/${filePath}?token=${encodeURIComponent(token)}&download=true`;
        if (name) streamUrl += `&n=${encodeURIComponent(name)}`;

        // The response carries the real filename, so there is no extension guessing to do beyond
        // the (rare) case of a nameless response.
        const finalName = name || `Filester_${s}${(/\.[A-Za-z0-9]{1,8}$/.exec(file) || [''])[0]}`;
        // The CDN wants a Filester referer; the /d/ page is the one the site itself uses.
        const ref = `${base}/d/${s}`;

        try { filesterSlugByUrl.set(String(streamUrl), String(s)); } catch (e) {}
        try { filesterRefByUrl.set(String(streamUrl), String(ref)); } catch (e) {}
        try {
            filesterNameBySlug.set(String(s), String(finalName));
            filesterNameByUrl.set(String(streamUrl), String(finalName));
        } catch (e) {}

        return { url: streamUrl, name: finalName, ref, token, server, file };
    } catch (e) {}

    return null;
}

// A resolved Filester stream URL lives on a CDN host we do not control the naming of, so recognise
// it by the slug map we populate at resolution time rather than by hostname -- pattern-matching
// fscN.cdn.cr would break again the next time Filester renames its CDN.
function isFilesterUrl(u) {
    const s = String(u || '');
    if (/(?:^|\/\/)(?:[a-z0-9-]+\.)*filester\.(me|sh|si|gg)\/(?:d|v)\//i.test(s)) return true;
    try { if (filesterSlugByUrl.has(s)) return true; } catch (e) {}
    return false;
}

// Bunkr filename hints (from /v/ pages)
const bunkrNameByUrl = new Map();

// Goonbox: embedded medium-res thumbnail per /img/ link, used as a download fallback when the
// API's original_url 404s (post-migration, some originals are missing but the .md. thumbnail --
// also hosted on cuckcapital.cr -- still exists).
const goonboxThumbByUrl = new Map();

// ImagePond (SocialMediaGirls official media host): human filenames + direct CDN URL hints captured
// from embedded [URL=imagepond.net/i/...][IMG]media.imagepond.net/...[/IMG][/URL] tags and album tiles.
const imagepondNameByUrl = new Map();
const imagepondDirectByPageUrl = new Map();

// --- Goonbox same-origin API bridge -------------------------------------------------------------
// Goonbox's API sits behind Cloudflare and requires the first-party goonbox.cr cookies. On Firefox
// a GM_xmlhttpRequest issued from the SimpCity tab is a third-party request and does not carry
// them, so /api/images/* and /api/albums/* answer 403. No header we can set fixes that -- the
// cookies are not ours to send.
//
// The workaround (from a contributor) is to keep one inactive goonbox.cr tab. This script also runs
// there (see the @match), where it *is* same-origin and `fetch(..., {credentials:'include'})`
// carries the real cookies. The two tabs talk over GM storage, which is shared per-script across
// tabs.
//
// The direct GM_xmlhttpRequest stays the first attempt: it still works on Chrome/Tampermonkey and
// costs a single request. The tab is only opened when that first attempt comes back 403, empty, or
// unparseable, so nothing changes for users who were never affected.
const GOONBOX_ORIGIN = 'https://goonbox.cr';

const GBX_K_READY = 'xfpd_gbx_ready';
const GBX_K_REQ = 'xfpd_gbx_req';
const GBX_K_RES = 'xfpd_gbx_res';

const GBX_POLL_MS = 150;
const GBX_HEARTBEAT_MS = 1000;
const GBX_READY_TIMEOUT_MS = 20000;
const GBX_REQ_TIMEOUT_MS = 25000;
// Close a few seconds after the *last* request, not after each one: a post usually resolves several
// Goonbox links, and reopening a tab per link would be slow and conspicuous.
const GBX_IDLE_CLOSE_MS = 5000;
// Cloudflare may still be settling when the helper tab first runs, so a single same-origin attempt
// is not enough to conclude anything.
const GBX_FETCH_ATTEMPTS = 3;
const GBX_FETCH_RETRY_MS = 800;

// The helper tab is opened on a *real* Goonbox page (the image or album being resolved) with this
// marker appended, rather than on the bare origin.
//
// Two reasons, both from contributor testing of b08. First, empirical: on Firefox + Tampermonkey a
// tab opened at `https://goonbox.cr/` never ran this script at all -- no heartbeat ever arrived, so
// every resolve ate the full 20s readiness timeout and then failed. Opening the actual content URL
// works. The most likely mechanism is that the bare origin redirects somewhere the @match does not
// cover (`www.`, most plausibly), so the script is never injected; hence the added wildcard @match
// as well. Chrome + Tampermonkey and Firefox + Violentmonkey were unaffected, which is why b08
// tested clean everywhere else.
//
// Second, the marker gates the worker: only a tab we opened serves the bridge. A user browsing
// goonbox.cr normally no longer becomes an unwitting bridge, and `gbxBridgeAlive()` now reflects
// only our own helper tab, which makes readiness mean one specific thing instead of two.
const GBX_MARKER_KEY = 'xfpd_gbx';
const GBX_MARKER_VAL = '1';

// Only these two API shapes may cross the bridge. The helper tab builds the final URL itself as
// GOONBOX_ORIGIN + path and never accepts a full URL, so an unexpected value in GM storage cannot
// turn a cookie-bearing tab into a general-purpose authenticated proxy. Enforced on both sides.
const GBX_ALLOWED_PATHS = [
    /^\/api\/images\/[A-Za-z0-9_-]{1,64}$/,
    /^\/api\/albums\/[A-Za-z0-9._~-]{1,128}\/images\?page=\d{1,4}$/,
];

function goonboxBridgePathAllowed(p) {
    const s = String(p || '');
    return GBX_ALLOWED_PATHS.some(rx => rx.test(s));
}

// --- cross-tab delivery ---------------------------------------------------------------------
// GM storage reads are NOT reliably cross-tab. Tampermonkey keeps a per-tab in-memory cache, and
// GM_getValue reads that cache -- so a tab polling for another tab's write can sit reading its own
// stale copy indefinitely. That is exactly what stalled the bridge on Firefox + Tampermonkey
// (b13): the helper tab heartbeated correctly and the script was confirmed running in it, while
// the SimpCity tab polled its own cache, saw nothing, and timed out after two 20s waits. Chrome +
// TM and Firefox + VM happen to propagate, which is why it worked there and hid the assumption.
//
// GM_addValueChangeListener is the documented mechanism for this: the callback is handed newValue
// directly, so no cache is ever consulted. Polling is **kept alongside** it rather than replaced --
// it demonstrably works on the configurations that already worked, and the two paths dedupe
// naturally (by request id, and by taking whichever heartbeat is newer), so whichever arrives
// first wins and neither can double-handle a request.
const xfpdAddValueChangeListener =
    (typeof GM_addValueChangeListener === 'function' ? GM_addValueChangeListener : null) ||
    (typeof window.GM_addValueChangeListener === 'function' ? window.GM_addValueChangeListener.bind(window) : null);

// Mirrors fed by the listener, consulted alongside the polled value.
let gbxReadyMirror = 0;
let gbxResMirror = '';
let gbxListenersBound = false;

function gbxBindListeners() {
    if (gbxListenersBound || !xfpdAddValueChangeListener) return;
    gbxListenersBound = true;
    try {
        xfpdAddValueChangeListener(GBX_K_READY, (name, oldV, newV) => {
            // Last write wins: heartbeats are monotonic, and tab close writes 0 to clear.
            gbxReadyMirror = Number(newV || 0) || 0;
        });
    } catch (e) {}
    try {
        xfpdAddValueChangeListener(GBX_K_RES, (name, oldV, newV) => {
            gbxResMirror = String(newV || '');
        });
    } catch (e) {}
}

const gbxSleep = ms => new Promise(r => setTimeout(r, ms));

function gbxGet(key, dflt = '') {
    try { return GM_getValue(key, dflt); } catch (e) { return dflt; }
}

function gbxSet(key, val) {
    try { GM_setValue(key, val); } catch (e) {}
}

// --- requester side (runs in the SimpCity tab) ---
let gbxTabHandle = null;
let gbxIdleTimer = null;
let gbxChain = Promise.resolve();
let gbxSeq = 0;
// Circuit breaker. If the helper tab never announces itself -- almost always a Cloudflare
// interstitial that needs a human -- every later link would otherwise pay the full readiness
// timeout again, since the tab handle exists and so is never reopened. A five-page album would
// stall for minutes to produce nothing. Back off instead, but not permanently: the user may well
// go and clear the interstitial in the tab we just opened for them.
let gbxUnavailableUntil = 0;
let gbxInFlight = 0;
const GBX_BREAKER_MS = 120000;

// The helper tab heartbeats while it is alive, so a stale value from a previous session (browser
// closed, tab killed) reads as dead rather than wedging the next run.
function gbxBridgeAlive() {
    // Whichever source is fresher. The polled read is authoritative where propagation works; the
    // listener mirror is the only source that sees anything at all on Firefox + Tampermonkey.
    const polled = Number(gbxGet(GBX_K_READY, 0) || 0) || 0;
    const t = Math.max(polled, gbxReadyMirror);
    return t > 0 && (Date.now() - t) < (GBX_HEARTBEAT_MS * 5);
}

function gbxCloseTab() {
    try { if (gbxIdleTimer) clearTimeout(gbxIdleTimer); } catch (e) {}
    gbxIdleTimer = null;
    // window.close() from inside the tab is unreliable on Chrome; close via the GM_openInTab
    // handle instead (xfpdCloseTabHandle also copes with implementations returning Promise<Tab>).
    try { xfpdCloseTabHandle(gbxTabHandle); } catch (e) {}
    gbxTabHandle = null;
    gbxSet(GBX_K_READY, 0);
    gbxSet(GBX_K_REQ, '');
    gbxSet(GBX_K_RES, '');
}

// The idle timer must be cancelled when a request *starts*, not only re-armed when one finishes.
// In b08 it was armed on settle only, so the 5s timer left by request N could fire in the middle of
// request N+1 and close the tab out from under it -- the in-flight request then saw a dead bridge
// and returned null. Back-to-back album pages usually finished inside the 5s window and hid it, but
// any request slower than that (or one that had to wait out a tab reopen) hit it.
function gbxCancelIdleTimer() {
    try { if (gbxIdleTimer) clearTimeout(gbxIdleTimer); } catch (e) {}
    gbxIdleTimer = null;
}

function gbxMaybeArmIdleTimer() {
    gbxCancelIdleTimer();
    // Only once nothing is outstanding. gbxInFlight is a counter rather than a boolean so this
    // stays correct if the serialization above is ever relaxed.
    if (gbxInFlight > 0) return;
    gbxIdleTimer = setTimeout(() => { try { gbxCloseTab(); } catch (e) {} }, GBX_IDLE_CLOSE_MS);
}

// A real Goonbox URL plus the marker that tells the injected script to serve the bridge.
function gbxHelperUrl(pageUrl) {
    const base = String(pageUrl || '').trim();
    try {
        const u = new URL(base);
        if (/(^|\.)goonbox\.cr$/i.test(u.hostname)) {
            u.searchParams.set(GBX_MARKER_KEY, GBX_MARKER_VAL);
            return u.href;
        }
    } catch (e) {}
    // No usable content URL -- fall back to the origin. Known not to work on Firefox +
    // Tampermonkey (see GBX_MARKER_KEY), but better than not trying.
    return `${GOONBOX_ORIGIN}/?${GBX_MARKER_KEY}=${GBX_MARKER_VAL}`;
}

function gbxOpenTab(pageUrl) {
    gbxSet(GBX_K_READY, 0);
    try {
        return GM_openInTab(gbxHelperUrl(pageUrl), { active: false, insert: true, setParent: true });
    } catch (e) {
        return null;
    }
}

async function gbxAwaitReady() {
    const deadline = Date.now() + GBX_READY_TIMEOUT_MS;
    while (Date.now() < deadline) {
        if (gbxBridgeAlive()) return true;
        await gbxSleep(GBX_POLL_MS);
    }
    return false;
}

async function gbxEnsureTab(pageUrl) {
    // Must happen before the first gbxBridgeAlive() read, or the heartbeat that arrives while we
    // are opening the tab has nowhere to land.
    gbxBindListeners();

    if (gbxBridgeAlive()) {
        gbxUnavailableUntil = 0;
        return true;
    }
    if (Date.now() < gbxUnavailableUntil) return false;

    if (!gbxTabHandle) {
        gbxTabHandle = gbxOpenTab(pageUrl);
        if (!gbxTabHandle) return false;
    }

    if (await gbxAwaitReady()) {
        gbxUnavailableUntil = 0;
        return true;
    }

    // No heartbeat. The tab may exist but have had no script injected into it, in which case it
    // will never come good on its own and waiting longer is pointless -- discard it and open a
    // fresh one once. (Contributor's suggestion, from hitting exactly this on Firefox + TM.)
    try { xfpdCloseTabHandle(gbxTabHandle); } catch (e) {}
    gbxTabHandle = gbxOpenTab(pageUrl);
    if (gbxTabHandle && await gbxAwaitReady()) {
        gbxUnavailableUntil = 0;
        return true;
    }

    // Still nothing after a clean retry: most likely a Cloudflare interstitial that needs a human.
    // Leave this second tab open -- it is where they would solve it, and the next attempt after the
    // backoff will find it alive.
    gbxUnavailableUntil = Date.now() + GBX_BREAKER_MS;
    return false;
}

// Sends one API path through the helper tab. Serialized: exactly one bridge request is in flight at
// a time, which keeps the handshake race-free (a shared queue would need a read-modify-write on a
// single GM key) and keeps the Goonbox API calls sequential. Resolves to {ok, status, body} or null.
function goonboxBridgeGet(path, pageUrl) {
    const run = async () => {
        if (!goonboxBridgePathAllowed(path)) return null;
        if (!(await gbxEnsureTab(pageUrl))) return null;

        const id = `${Date.now()}_${++gbxSeq}`;
        gbxResMirror = '';
        gbxSet(GBX_K_RES, '');
        gbxSet(GBX_K_REQ, JSON.stringify({ id, path, t: Date.now() }));

        const deadline = Date.now() + GBX_REQ_TIMEOUT_MS;
        while (Date.now() < deadline) {
            await gbxSleep(GBX_POLL_MS);

            // Listener mirror first -- on Firefox + Tampermonkey the polled read never updates.
            let res = null;
            for (const raw of [gbxResMirror, gbxGet(GBX_K_RES, '')]) {
                try {
                    const p = JSON.parse(String(raw || ''));
                    if (p && p.id === id) { res = p; break; }
                } catch (e) {}
            }
            if (res) return res;

            // Tab was closed or crashed mid-request; no point waiting out the full deadline.
            if (!gbxBridgeAlive()) break;
        }
        return null;
    };

    // Count in, cancel any pending close, run, count out, then re-arm only if nothing else is
    // outstanding. Incrementing here rather than inside run() is deliberate: the request is queued
    // from this moment, so the tab must survive until the chain drains, not just until the
    // currently-executing run() returns.
    gbxInFlight++;
    gbxCancelIdleTimer();

    const settle = () => {
        gbxInFlight = Math.max(0, gbxInFlight - 1);
        gbxMaybeArmIdleTimer();
    };

    gbxChain = gbxChain.catch(() => {}).then(run);
    const p = gbxChain;
    p.then(settle, settle);
    return p;
}

// Debug switch: force every Goonbox API call down the bridge path even when the direct request
// succeeds. From the devtools console on a SimpCity tab:
//
//     localStorage.setItem('xfpd_gbx_force_bridge', 'true')   // enable
//     localStorage.removeItem('xfpd_gbx_force_bridge')        // disable
//
// localStorage rather than GM storage because `GM_setValue` does not exist in the page console --
// the GM_* functions live only inside the userscript sandbox, so they cannot be called from
// devtools. The flag is read exclusively in the SimpCity tab (the helper tab never consults it), so
// page-origin storage is sufficient. GM storage is still honoured as well, for anyone setting it
// through Tampermonkey's Storage tab.
//
// This exists because the 403 the bridge was built for has not reproduced in **any** configuration
// across six test runs (Chrome+TM, Firefox+TM, Firefox+VM). With the direct request always
// succeeding, not one line of the bridge executes against the real site, so the feature cannot be
// validated by ordinary testing at all. Forcing the path exercises tab open -> marker -> same-origin
// fetch -> handshake end to end, independently of whether the symptom reproduces.
//
// Off unless explicitly enabled, and it only ever *adds* an attempt -- with the flag set, a failed
// bridge still falls through to whatever the direct call returned, so enabling it cannot make a
// download fail that would otherwise have worked.
const GBX_K_FORCE = 'xfpd_gbx_force_bridge';

function gbxForceEnabled() {
    // Page-origin storage first, since that is the one reachable from devtools.
    try {
        const v = localStorage.getItem(GBX_K_FORCE);
        if (v !== null && String(v).toLowerCase() === 'true') return true;
    } catch (e) {}
    try {
        const v = gbxGet(GBX_K_FORCE, false);
        if (v === true || String(v).toLowerCase() === 'true') return true;
    } catch (e) {}
    return false;
}

// One Goonbox API call: direct first, bridge second. Returns parsed JSON, or null if both failed.
// `pageUrl` is the real Goonbox page being resolved: it is both the Referer for the direct request
// and, with a marker appended, the URL the helper tab is opened on.
async function goonboxApiJson(http, path, pageUrl, postId) {
    const referer = pageUrl;
    const say = (msg) => {
        try { log.host.info(postId, msg, 'goonbox.cr'); } catch (e) {}
    };
    const parse = (s) => {
        try {
            const j = JSON.parse(String(s || ''));
            return (j && typeof j === 'object') ? j : null;
        } catch (e) { return null; }
    };

    let status = 0;
    let source = '';
    try {
        const r = await http.get(
            `${GOONBOX_ORIGIN}${path}`,
            {},
            { Referer: referer || `${GOONBOX_ORIGIN}/`, Accept: 'application/json' },
            'text',
        );
        status = Number((r && r.status) || 0) || 0;
        source = String((r && r.source) || '');
    } catch (e) {}

    const direct = (status && status < 400) ? parse(source) : null;
    const forced = gbxForceEnabled();

    if (direct && !forced) return direct;

    // Whether the bridge engages has been invisible in the logs until now, which is exactly why six
    // runs produced no usable evidence about it. Say so, and say why.
    if (forced) {
        say(`::Bridge forced (debug flag)::: ${path}`);
    } else {
        // 403 from Cloudflare, an empty body, or an HTML challenge page that will not parse as JSON
        // -- all mean the same thing here, so retry same-origin rather than telling them apart.
        say(`::API direct failed (${status || 'no response'}) -> bridge::: ${path}`);
    }

    const viaBridge = await goonboxBridgeGet(path, pageUrl);

    if (viaBridge && viaBridge.ok) {
        const j = parse(viaBridge.body);
        if (j) {
            say(`::Bridge OK (${viaBridge.status})::: ${path}`);
            return j;
        }
        say(`::Bridge returned ${viaBridge.status} but body was not JSON::: ${path}`);
    } else {
        say(`::Bridge failed (${viaBridge ? viaBridge.status : 'no response'})::: ${path}`);
    }

    // Forcing must never be able to break a working download: fall back to the direct result.
    if (direct) return direct;

    return null;
}

// --- helper-tab side (runs only on goonbox.cr) ---
// Only serves in a tab *we* opened, identified by the marker in the URL. A user browsing
// goonbox.cr normally runs this script too (the @match is origin-wide) but must not silently
// become a bridge for it.
function gbxIsHelperTab() {
    try {
        return new URLSearchParams(location.search).get(GBX_MARKER_KEY) === GBX_MARKER_VAL;
    } catch (e) {
        return false;
    }
}

function goonboxBridgeServe() {
    if (!gbxIsHelperTab()) return;

    let lastId = '';
    let busy = false;

    const beat = () => gbxSet(GBX_K_READY, Date.now());
    beat();
    setInterval(beat, GBX_HEARTBEAT_MS);

    const handle = async (raw) => {
        if (busy) return;

        let req = null;
        try { req = JSON.parse(String(raw || '')); } catch (e) { req = null; }
        if (!req || !req.id || req.id === lastId) return;

        lastId = req.id;
        busy = true;

        const reply = (payload) => {
            try { gbxSet(GBX_K_RES, JSON.stringify({ id: req.id, ...payload })); } catch (e) {}
        };

        try {
            // Re-check here and not only on the requesting side: this tab is the one holding the
            // cookies, so it is the only place the restriction actually protects anything.
            if (!goonboxBridgePathAllowed(req.path)) {
                reply({ ok: false, status: 0, body: '' });
                return;
            }

            // Cloudflare may still be settling in a tab that has only just loaded, so a single
            // attempt is not enough to conclude the cookies are unusable. Retry a few times, but
            // only while the answer still looks like a challenge or a transport failure -- a clean
            // 404 is a real answer and is returned immediately.
            let last = { ok: false, status: 0, body: '' };
            for (let attempt = 1; attempt <= GBX_FETCH_ATTEMPTS; attempt++) {
                try {
                    const r = await fetch(`${GOONBOX_ORIGIN}${req.path}`, {
                        credentials: 'include',
                        headers: { Accept: 'application/json' },
                    });
                    const body = await r.text();
                    last = { ok: !!r.ok, status: Number(r.status) || 0, body };
                } catch (e) {
                    last = { ok: false, status: 0, body: '' };
                }

                let parsed = null;
                try { parsed = JSON.parse(String(last.body || '')); } catch (e) { parsed = null; }
                if (last.ok && parsed && typeof parsed === 'object') break;
                if (last.status && last.status !== 403 && last.status !== 429 && last.status < 500) break;

                if (attempt < GBX_FETCH_ATTEMPTS) await gbxSleep(GBX_FETCH_RETRY_MS);
            }

            reply(last);
        } catch (e) {
            reply({ ok: false, status: 0, body: '' });
        } finally {
            busy = false;
        }
    };

    // Listener first: on Firefox + Tampermonkey the poll below never observes the SimpCity tab's
    // write at all, because it only ever reads this tab's own cached copy.
    if (xfpdAddValueChangeListener) {
        try {
            xfpdAddValueChangeListener(GBX_K_REQ, (name, oldV, newV) => { handle(newV); });
        } catch (e) {}
    }

    // Polling retained deliberately: it is what works on the configurations that already worked,
    // and `lastId` makes double-delivery a no-op.
    setInterval(() => { handle(gbxGet(GBX_K_REQ, '')); }, GBX_POLL_MS);
}


// Bunkr/Cloudflare: best-effort warm-up to let the browser complete a JS-only CF interstitial ("Just a moment...").
// NOTE: This does NOT solve interactive Turnstile/CAPTCHA challenges; in that case you still need to do it manually.
const BUNKR_CF_WARMUP_MS = 6000;
const BUNKR_CF_MAX_RETRIES = 3;
const BUNKR_CF_WARMUP_ACTIVE_TAB = false;

const BUNKR_CF_WARMUP_COOLDOWN_MS = 15000; // reduce repeated warm-up tabs


// Bunkr fast-fail + domain blacklist:
// - On first 403 or obvious CF interstitial on a non-last domain, immediately switch to next domain (no extra retries).
// - Blacklist the failing domain for a while so subsequent links skip it entirely.
const BUNKR_FASTFAIL_ON_403 = true;
const BUNKR_DOMAIN_BLACKLIST_MS = 60 * 60 * 1000; // 60 minutes
const xfpdBunkrDomainBanUntil = new Map(); // baseOrigin -> timestamp

function xfpdBunkrNormalizeBase(baseOrUrl) {
    try {
        const u = new URL(String(baseOrUrl || ''));
        return u.origin;
    } catch (e) {
        return String(baseOrUrl || '').replace(/\/+$/, '');
    }
}

function xfpdBunkrIsBaseBanned(baseOrUrl) {
    try {
        const base = xfpdBunkrNormalizeBase(baseOrUrl);
        const until = xfpdBunkrDomainBanUntil.get(base);
        if (!until) return false;
        if (Date.now() >= until) {
            xfpdBunkrDomainBanUntil.delete(base);
            return false;
        }
        return true;
    } catch (e) {
        return false;
    }
}

function xfpdBunkrBanBase(baseOrUrl) {
    try {
        const base = xfpdBunkrNormalizeBase(baseOrUrl);
        // Don't blacklist the last-resort domain (it may be the only thing left).
        if (base === 'https://bunkr.cr') return;
        xfpdBunkrDomainBanUntil.set(base, Date.now() + BUNKR_DOMAIN_BLACKLIST_MS);
    } catch (e) {}
}

function xfpdBunkrFilterBases(bases) {
    const uniq = [];
    const seen = new Set();
    for (const b of (bases || [])) {
        const base = xfpdBunkrNormalizeBase(b);
        if (!base || seen.has(base)) continue;
        seen.add(base);
        uniq.push(base);
    }
    const filtered = uniq.filter(b => b === 'https://bunkr.cr' || !xfpdBunkrIsBaseBanned(b));
    // Never return an empty list; keep last-resort behavior intact.
    return filtered.length ? filtered : uniq;
}

function xfpdLooksLikeCfChallenge(source, dom) {
    try {
        const s = String(source || '');
        const head = s.slice(0, 8000).toLowerCase();

        const title =
            String(dom?.querySelector?.('title')?.textContent || '').trim();

        if (title && /just a moment|attention required|checking your browser/i.test(title)) return true;
        if (title && /cloudflare/i.test(title)) return true;

        if (head.includes('cdn-cgi/challenge-platform')) return true;
        if (head.includes('challenges.cloudflare.com')) return true;
        if (head.includes('cf-browser-verification')) return true;
        if (head.includes('checking your browser')) return true;
        if (head.includes('just a moment')) return true;
        if (head.includes('attention required')) return true;

        // DOM markers (when we have it)
        if (dom?.querySelector?.('#cf-challenge-running, #challenge-form, .cf-browser-verification, .cf-challenge')) return true;
    } catch (e) {}
    return false;
}

function xfpdLooksLikeCfFilenameHint(name) {
    const n = String(name || '').trim();
    return /^(?:just a moment\.{0,3}|checking your browser\.{0,3}|attention required\.{0,3})$/i.test(n) || /cloudflare/i.test(n);
}


// Try to extract the original filename from Bunkr /api/vs JSON (when /v/ is blocked by CF/403).
function xfpdBunkrExtractNameFromVsData(data) {
    try {
        const cands = [];
        const add = (v) => {
            if (!v) return;
            if (typeof v === 'string') cands.push(v);
            else if (typeof v === 'number') cands.push(String(v));
        };

        add(data?.name);
        add(data?.filename);
        add(data?.file_name);
        add(data?.original);
        add(data?.title);

        // common nesting patterns
        if (data?.data && typeof data.data === 'object') {
            add(data.data.name);
            add(data.data.filename);
            add(data.data.file_name);
            add(data.data.original);
            add(data.data.title);
        }
        if (data?.file && typeof data.file === 'object') {
            add(data.file.name);
            add(data.file.filename);
            add(data.file.original);
            add(data.file.title);
        }

        const norm = (s) => {
            let t = String(s || '').replace(/\s+/g, ' ').trim();
            t = t.replace(/\s*\|\s*Bunkr\s*$/i, '').trim();
            return t;
        };

        // Prefer candidates that look like a real filename with an extension.
        for (const raw of cands) {
            const t = norm(raw);
            if (!t) continue;
            if (xfpdLooksLikeCfFilenameHint(t)) continue;
            if (/\.[A-Za-z0-9]{1,8}$/.test(t)) return t;
        }
        // Otherwise, return the first non-empty non-CF string.
        for (const raw of cands) {
            const t = norm(raw);
            if (!t) continue;
            if (xfpdLooksLikeCfFilenameHint(t)) continue;
            return t;
        }
    } catch (e) {}
    return '';
}


async function xfpdWarmupTab(url, ms = BUNKR_CF_WARMUP_MS, active = BUNKR_CF_WARMUP_ACTIVE_TAB) {
    try {
        const tab = GM_openInTab(url, { active: !!active, insert: true, setParent: true });
        await h.delayedResolve(ms);
        try { tab?.close?.(); } catch (e) {}
    } catch (e) {
        // Ignore - warm-up is best-effort
        try { await h.delayedResolve(ms); } catch (e2) {}
    }
}

let xfpdBunkrCfWarmupPromise = null;
let xfpdBunkrCfWarmupLastAt = 0;

// Ensure we open at most ONE warm-up tab at a time (and no more than once per cooldown window).
async function xfpdBunkrCfWarmup(url) {
    try {
        const now = Date.now();

        // If a warm-up is already running, just wait for it.
        if (xfpdBunkrCfWarmupPromise) {
            return await xfpdBunkrCfWarmupPromise;
        }

        // If we recently warmed up, don't open another tab; just wait a bit to avoid hammering.
        if (now - xfpdBunkrCfWarmupLastAt < BUNKR_CF_WARMUP_COOLDOWN_MS) {
            try { await h.delayedResolve(Math.min(1000, BUNKR_CF_WARMUP_MS)); } catch (e) {}
            return null;
        }

        xfpdBunkrCfWarmupLastAt = now;

        xfpdBunkrCfWarmupPromise = (async () => {
            await xfpdWarmupTab(url);
        })();

        try {
            return await xfpdBunkrCfWarmupPromise;
        } finally {
            xfpdBunkrCfWarmupPromise = null;
        }
    } catch (e) {
        // Best-effort
        return null;
    }
}

async function xfpdBunkrGetWithCfRetry(http, url, warmUrlOrOrigin, allowWarmup = true) {
    let last = null;
    for (let attempt = 0; attempt <= BUNKR_CF_MAX_RETRIES; attempt++) {
        try {
            last = await http.get(url);
        } catch (e) {
            last = null;
        }

        const dom = last?.dom;
        const source = last?.source || '';


// Fast-fail on 403 / CF interstitial for non-last domains:
// Immediately blacklist this domain and return, so the caller can try the next domain.
const status = Number(last?.status || 0);
if (BUNKR_FASTFAIL_ON_403 && (status === 403) && !allowWarmup) {
    xfpdBunkrBanBase(warmUrlOrOrigin || url);
    return last || { dom: null, source: '' };
}
if (BUNKR_FASTFAIL_ON_403 && !allowWarmup && last && xfpdLooksLikeCfChallenge(source, dom)) {
    xfpdBunkrBanBase(warmUrlOrOrigin || url);
    return last || { dom: null, source: '' };
}

        if (last && !xfpdLooksLikeCfChallenge(source, dom)) return last;

        if (attempt < BUNKR_CF_MAX_RETRIES) {
            if (allowWarmup) {
                await xfpdBunkrCfWarmup(String(warmUrlOrOrigin || url));
            } else {
                try { await h.delayedResolve(200); } catch (e) {}
            }
}
    }
    return last || { dom: null, source: '' };
}

async function xfpdBunkrPostVsWithCfRetry(http, endpoint, slug, refererUrl, originUrl, allowWarmup = true) {
    let lastText = '';
    let lastStatus = 0;
    for (let attempt = 0; attempt <= BUNKR_CF_MAX_RETRIES; attempt++) {
        try {
            const response = await http.post(
                endpoint,
                JSON.stringify({ slug }),
                {},
                {
                    'Content-Type': 'application/json',
                    Referer: refererUrl,
                    Origin: originUrl,
                },
            );
            lastText = String(response?.source || '');
            lastStatus = Number(response?.status || 0);
        } catch (e) {
            lastText = '';
            lastStatus = 0;
        }



// Fast-fail on 403 / CF interstitial for non-last domains:
// Immediately blacklist this domain and return null so the caller tries the next domain.
if (BUNKR_FASTFAIL_ON_403 && (Number(lastStatus || 0) === 403) && !allowWarmup) {
    xfpdBunkrBanBase(originUrl || refererUrl || endpoint);
    return null;
}
if (BUNKR_FASTFAIL_ON_403 && !allowWarmup && xfpdLooksLikeCfChallenge(lastText, null)) {
    xfpdBunkrBanBase(originUrl || refererUrl || endpoint);
    return null;
}
try {
            return JSON.parse(lastText || '{}');
        } catch (e) {
            if (xfpdLooksLikeCfChallenge(lastText, null) && attempt < BUNKR_CF_MAX_RETRIES) {
                if (allowWarmup) {
                    await xfpdBunkrCfWarmup(String(refererUrl || originUrl || endpoint));
                } else {
                    try { await h.delayedResolve(200); } catch (e2) {}
                }
continue;
            }
            return null;
        }
    }
    return null;
}







// Sign a bunkr cdn.cr URL via glb-apisign.cdn.cr — required for download (unsigned URLs return 403).
async function xfpdBunkrSignCdnUrl(http, rawUrl) {
    try {
        const urlObj = new URL(rawUrl);
        const path = decodeURIComponent(urlObj.pathname);
        const signRes = await http.get(
            `https://glb-apisign.cdn.cr/sign?path=${encodeURIComponent(path)}`
        );
        const signText = String(signRes?.source || '');
        const signData = JSON.parse(signText);
        if (signData?.token && signData?.ex) {
            urlObj.searchParams.set('token', String(signData.token));
            urlObj.searchParams.set('ex', String(signData.ex));
            return urlObj.toString();
        }
    } catch (e) {}
    return rawUrl;
}

// Turbo mapping: signed turbocdn URL -> Turbo id (needed for re-sign when resolving from /a/ albums)
const turboIdBySignedUrl = new Map();
