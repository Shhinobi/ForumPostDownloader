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
        image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.heic', '.heif', '.jfif', '.jpe', '.svg', '.tif', '.tiff', '.jif'],
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
            '.mkv',
            '.ts',
            '.m2ts',
            '.flv',
            '.mov',
            '.mpg',
            '.ogg',
        ],
    },
};

// --- Persistent User Preferences (Per-Thread + Global Defaults) ---------------------------------
const XFPD_USER_PREFS_KEY = 'xfpd_user_prefs';
const XFPD_THREAD_PREFS_KEY = 'xfpd_thread_prefs';
const XFPD_MAX_STORED_THREADS = 500;

const XFPD_VALID_VIDEO_QUALITIES = ['best', '1080p', '720p', 'all'];
const XFPD_VALID_FOLDER_LAYOUTS = ['media', 'post', 'post-media', 'flat', 'albums'];
const XFPD_VALID_SAVE_MODES = ['auto', 'folder', 'agent', 'browser'];

const XFPD_DEFAULT_USER_PREFS = Object.freeze({
    zipped: true,
    saveMode: 'auto',
    folderLayout: 'media',
    organizeMedia: true,
    includeComments: true,
    extractArchives: true,
    contentDedup: true,
    smartMirrors: true,
    autoUnlockReaction: true,
    autoReactAfterDownload: false,
    videoQuality: 'best',
    flatten: false,
    generateLinks: false,
    generateLog: false,
    skipDuplicates: false,
    skipDownload: false,
    verifyBunkrLinks: false,
});

const XFPD_USER_PREF_KEYS = Object.keys(XFPD_DEFAULT_USER_PREFS);

// Link-level filename hints extracted from forum DOM (e.g. XenForo unfurl card titles / anchor text)
// and Pixeldrain /api/file/<id>/info metadata cache.
const linkHintNameByUrl = new Map();
const pixeldrainInfoById = new Map();

let xfpdGlobalPrefsMirror = null;
let xfpdThreadPrefsMapMirror = null;
let xfpdPrefsListenerBound = false;
const xfpdPrefsSubscribers = new Set();

function xfpdGetCurrentThreadKey() {
    try {
        if (typeof location === 'undefined') return '';
        const host = String(location.hostname || '').toLowerCase();
        const forumScope = /(^|\.)socialmediagirls\.com$/i.test(host)
            ? 'smg'
            : /(^|\.)simpcity\.[a-z]+$/i.test(host)
              ? 'simpcity'
              : host || 'forum';
        const path = String(location.pathname || '');
        const mId = /\/threads\/(?:[^\/?#]+\.)?(\d+)(?:\/|$)/i.exec(path);
        if (mId && mId[1]) {
            return `${forumScope}:${mId[1]}`;
        }
        const mSlug = /\/threads\/([^\/?#]+)/i.exec(path);
        if (mSlug && mSlug[1]) {
            return `${forumScope}:${mSlug[1].toLowerCase()}`;
        }
    } catch (e) {}
    return '';
}

function xfpdDeriveFolderLayout(src) {
    if (src && XFPD_VALID_FOLDER_LAYOUTS.includes(src.folderLayout)) {
        return src.folderLayout;
    }
    if (src && typeof src.organizeMedia === 'boolean') {
        if (src.organizeMedia) return 'media';
        return src.flatten ? 'flat' : 'albums';
    }
    if (src && src.flatten === true) return 'flat';
    return XFPD_DEFAULT_USER_PREFS.folderLayout;
}

function xfpdNormalizeUserPrefs(rawObj) {
    const src = rawObj && typeof rawObj === 'object' ? rawObj : {};
    const normalized = {};
    for (const key of XFPD_USER_PREF_KEYS) {
        if (key === 'videoQuality') {
            normalized.videoQuality = XFPD_VALID_VIDEO_QUALITIES.includes(src.videoQuality)
                ? src.videoQuality
                : XFPD_DEFAULT_USER_PREFS.videoQuality;
        } else if (key === 'saveMode') {
            normalized.saveMode = XFPD_VALID_SAVE_MODES.includes(src.saveMode)
                ? src.saveMode
                : XFPD_DEFAULT_USER_PREFS.saveMode;
        } else if (key === 'folderLayout') {
            normalized.folderLayout = xfpdDeriveFolderLayout(src);
        } else {
            normalized[key] = typeof src[key] === 'boolean' ? src[key] : XFPD_DEFAULT_USER_PREFS[key];
        }
    }
    // Keep legacy boolean flags synchronized with folderLayout for backward compatibility.
    normalized.organizeMedia = normalized.folderLayout === 'media';
    normalized.flatten = normalized.folderLayout === 'flat';

    const pre = src.preSkipDownload && typeof src.preSkipDownload === 'object' ? src.preSkipDownload : null;
    const preLayout =
        pre && XFPD_VALID_FOLDER_LAYOUTS.includes(pre.folderLayout)
            ? pre.folderLayout
            : normalized.skipDownload
              ? 'media'
              : normalized.folderLayout;
    normalized.preSkipDownload = {
        folderLayout: preLayout,
        organizeMedia: preLayout === 'media',
        flatten: preLayout === 'flat',
        extractArchives:
            pre && typeof pre.extractArchives === 'boolean'
                ? pre.extractArchives
                : (normalized.skipDownload ? true : normalized.extractArchives),
        contentDedup:
            pre && typeof pre.contentDedup === 'boolean'
                ? pre.contentDedup
                : (normalized.skipDownload ? true : normalized.contentDedup),
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
        normalized.organizeMedia = false;
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

function xfpdReadStoredObject(storageKey, mirrorObj) {
    const candidates = [];
    if (mirrorObj && typeof mirrorObj === 'object') candidates.push(mirrorObj);
    try {
        if (typeof GM_getValue === 'function') {
            const gmParsed = xfpdParsePrefsJson(GM_getValue(storageKey, ''));
            if (gmParsed) candidates.push(gmParsed);
        }
    } catch (e) {}
    try {
        if (typeof localStorage !== 'undefined' && localStorage) {
            const lsParsed = xfpdParsePrefsJson(localStorage.getItem(storageKey));
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
    return chosen;
}

function xfpdWriteStoredObject(storageKey, obj) {
    const serialized = JSON.stringify(obj);
    try {
        if (typeof GM_setValue === 'function') {
            GM_setValue(storageKey, serialized);
        }
    } catch (e) {}
    try {
        if (typeof localStorage !== 'undefined' && localStorage) {
            localStorage.setItem(storageKey, serialized);
        }
    } catch (e) {}
}

function xfpdLoadGlobalPrefs() {
    const chosen = xfpdReadStoredObject(XFPD_USER_PREFS_KEY, xfpdGlobalPrefsMirror);
    const normalized = xfpdNormalizeUserPrefs(chosen);
    xfpdGlobalPrefsMirror = normalized;
    return xfpdNormalizeUserPrefs(normalized);
}

function xfpdLoadThreadPrefsMap() {
    const chosen = xfpdReadStoredObject(XFPD_THREAD_PREFS_KEY, xfpdThreadPrefsMapMirror);
    const rawThreads = chosen && chosen.threads && typeof chosen.threads === 'object' ? chosen.threads : {};
    const mapObj = {
        _updatedAt: Number((chosen && chosen._updatedAt) || 0) || 0,
        threads: { ...rawThreads },
    };
    xfpdThreadPrefsMapMirror = mapObj;
    return mapObj;
}

function xfpdHasThreadPrefs(threadKey = xfpdGetCurrentThreadKey()) {
    if (!threadKey) return false;
    const mapObj = xfpdLoadThreadPrefsMap();
    return !!(mapObj.threads && mapObj.threads[threadKey] && typeof mapObj.threads[threadKey] === 'object');
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

    const notifyRemoteUpdate = () => {
        const effective = xfpdLoadUserPrefs();
        xfpdPrefsSubscribers.forEach(cb => {
            try {
                cb(effective, XFPD_USER_PREF_KEYS.slice(), 'storage');
            } catch (e) {}
        });
    };

    try {
        addListener(XFPD_USER_PREFS_KEY, (_name, _oldVal, newVal, remote) => {
            const parsed = xfpdParsePrefsJson(newVal);
            if (!parsed) return;
            xfpdGlobalPrefsMirror = xfpdNormalizeUserPrefs(parsed);
            try {
                if (typeof localStorage !== 'undefined' && localStorage) {
                    localStorage.setItem(XFPD_USER_PREFS_KEY, JSON.stringify(xfpdGlobalPrefsMirror));
                }
            } catch (e) {}
            if (remote && !xfpdHasThreadPrefs()) {
                notifyRemoteUpdate();
            }
        });
    } catch (e) {}

    try {
        addListener(XFPD_THREAD_PREFS_KEY, (_name, _oldVal, newVal, remote) => {
            const parsed = xfpdParsePrefsJson(newVal);
            if (!parsed || typeof parsed !== 'object') return;
            xfpdThreadPrefsMapMirror = {
                _updatedAt: Number(parsed._updatedAt || 0) || 0,
                threads: parsed.threads && typeof parsed.threads === 'object' ? { ...parsed.threads } : {},
            };
            try {
                if (typeof localStorage !== 'undefined' && localStorage) {
                    localStorage.setItem(XFPD_THREAD_PREFS_KEY, JSON.stringify(xfpdThreadPrefsMapMirror));
                }
            } catch (e) {}
            if (remote) {
                notifyRemoteUpdate();
            }
        });
    } catch (e) {}
}

function xfpdLoadUserPrefs(explicitThreadKey = null) {
    xfpdBindUserPrefsStorageListener();
    const globalPrefs = xfpdLoadGlobalPrefs();
    const tKey = explicitThreadKey !== null ? explicitThreadKey : xfpdGetCurrentThreadKey();
    if (!tKey) {
        return globalPrefs;
    }
    const mapObj = xfpdLoadThreadPrefsMap();
    const threadEntry = mapObj.threads && mapObj.threads[tKey];
    if (!threadEntry || typeof threadEntry !== 'object') {
        return globalPrefs;
    }
    return xfpdNormalizeUserPrefs({
        ...globalPrefs,
        ...threadEntry,
        preSkipDownload: {
            ...globalPrefs.preSkipDownload,
            ...(threadEntry.preSkipDownload && typeof threadEntry.preSkipDownload === 'object' ? threadEntry.preSkipDownload : {}),
        },
    });
}

function xfpdSaveUserPrefs(patch, source = 'post', explicitChangedKeys = null) {
    const tKey = xfpdGetCurrentThreadKey();
    const current = xfpdLoadUserPrefs(tKey);
    const nextStamp = Math.max(Date.now(), (Number(current._updatedAt || 0) || 0) + 1);
    const merged = {
        ...current,
        ...(patch && typeof patch === 'object' ? patch : {}),
        preSkipDownload: {
            ...current.preSkipDownload,
            ...(patch && patch.preSkipDownload && typeof patch.preSkipDownload === 'object' ? patch.preSkipDownload : {}),
        },
        _updatedAt: nextStamp,
    };
    const next = xfpdNormalizeUserPrefs(merged);
    const changedKeys =
        Array.isArray(explicitChangedKeys) && explicitChangedKeys.length
            ? explicitChangedKeys.filter(k => XFPD_USER_PREF_KEYS.includes(k))
            : XFPD_USER_PREF_KEYS.filter(k => current[k] !== next[k]);

    if (tKey) {
        const mapObj = xfpdLoadThreadPrefsMap();
        mapObj.threads[tKey] = next;
        mapObj._updatedAt = Math.max(Date.now(), (Number(mapObj._updatedAt || 0) || 0) + 1);

        // Bound stored thread count via LRU (_updatedAt) so storage stays compact forever.
        const entries = Object.entries(mapObj.threads);
        if (entries.length > XFPD_MAX_STORED_THREADS) {
            entries.sort((a, b) => (Number(b[1]?._updatedAt || 0) || 0) - (Number(a[1]?._updatedAt || 0) || 0));
            mapObj.threads = Object.fromEntries(entries.slice(0, XFPD_MAX_STORED_THREADS));
        }
        xfpdThreadPrefsMapMirror = mapObj;
        xfpdWriteStoredObject(XFPD_THREAD_PREFS_KEY, mapObj);
    } else {
        xfpdGlobalPrefsMirror = next;
        xfpdWriteStoredObject(XFPD_USER_PREFS_KEY, next);
    }

    xfpdPrefsSubscribers.forEach(cb => {
        try {
            cb(xfpdNormalizeUserPrefs(next), changedKeys, source);
        } catch (e) {}
    });

    return xfpdNormalizeUserPrefs(next);
}

function xfpdSaveGlobalDefaultPrefs(prefsSnapshot = null) {
    const base = prefsSnapshot && typeof prefsSnapshot === 'object' ? prefsSnapshot : xfpdLoadUserPrefs();
    const currentGlobal = xfpdLoadGlobalPrefs();
    const nextGlobal = xfpdNormalizeUserPrefs({
        ...currentGlobal,
        ...base,
        _updatedAt: Math.max(Date.now(), (Number(currentGlobal._updatedAt || 0) || 0) + 1),
    });
    xfpdGlobalPrefsMirror = nextGlobal;
    xfpdWriteStoredObject(XFPD_USER_PREFS_KEY, nextGlobal);
    return xfpdNormalizeUserPrefs(nextGlobal);
}

function xfpdResetThreadPrefs(explicitThreadKey = null) {
    const tKey = explicitThreadKey !== null ? explicitThreadKey : xfpdGetCurrentThreadKey();
    if (tKey) {
        const mapObj = xfpdLoadThreadPrefsMap();
        if (mapObj.threads && Object.prototype.hasOwnProperty.call(mapObj.threads, tKey)) {
            delete mapObj.threads[tKey];
            mapObj._updatedAt = Math.max(Date.now(), (Number(mapObj._updatedAt || 0) || 0) + 1);
            xfpdThreadPrefsMapMirror = mapObj;
            xfpdWriteStoredObject(XFPD_THREAD_PREFS_KEY, mapObj);
        }
    }
    const fallbackGlobal = xfpdLoadGlobalPrefs();
    xfpdPrefsSubscribers.forEach(cb => {
        try {
            cb(xfpdNormalizeUserPrefs(fallbackGlobal), XFPD_USER_PREF_KEYS.slice(), 'page');
        } catch (e) {}
    });
    return fallbackGlobal;
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
        folderLayout: prefs.folderLayout,
        organizeMedia: prefs.organizeMedia,
        includeComments: prefs.includeComments,
        contentDedup: prefs.contentDedup,
        smartMirrors: prefs.smartMirrors,
        autoUnlockReaction: prefs.autoUnlockReaction,
        videoQuality: prefs.videoQuality,
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

// --- Fast Zero-Copy Content Hashing & Persistent Per-Thread Dedup Store --------------------------
const XFPD_THREAD_DEDUP_KEY = 'xfpd_thread_dedup';
const XFPD_DEDUP_MAX_THREADS = 150;
const XFPD_DEDUP_MAX_ITEMS_PER_THREAD = 35000;
const XFPD_FULL_HASH_MAX_BYTES = 8 * 1024 * 1024; // <= 8 MB: full-file SHA-256; > 8 MB: 4 x 256 KB sparse SHA-256
const XFPD_SPARSE_CHUNK_BYTES = 262144; // 256 KB

let xfpdDedupStoreCache = null; // { _updatedAt, threads: { [tKey]: { u: Set, h: Set, s: Set, _t: number } } }
let xfpdDedupFlushTimer = null;

function xfpdEnsureDedupStore() {
    if (xfpdDedupStoreCache) return xfpdDedupStoreCache;
    const raw = xfpdReadStoredObject(XFPD_THREAD_DEDUP_KEY, null);
    const threads = {};
    if (raw && raw.threads && typeof raw.threads === 'object') {
        for (const [tKey, entry] of Object.entries(raw.threads)) {
            if (!entry || typeof entry !== 'object') continue;
            const hSet = new Set(Array.isArray(entry.h) ? entry.h : []);
            const sSet = new Set();
            hSet.forEach(fp => {
                const parts = String(fp).split(':');
                if (parts.length >= 3) {
                    const sz = Number(parts[1]);
                    if (sz > 0) sSet.add(sz);
                }
            });
            threads[tKey] = {
                u: new Set(Array.isArray(entry.u) ? entry.u : []),
                h: hSet,
                s: sSet,
                _t: Number(entry._t || 0) || 0,
            };
        }
    }
    xfpdDedupStoreCache = { _updatedAt: Number((raw && raw._updatedAt) || 0) || 0, threads };
    return xfpdDedupStoreCache;
}

function xfpdGetThreadDedupBucket(explicitThreadKey = null, createIfMissing = false) {
    const store = xfpdEnsureDedupStore();
    const tKey = (explicitThreadKey !== null ? explicitThreadKey : xfpdGetCurrentThreadKey()) || '_session';
    let bucket = store.threads[tKey];
    if (!bucket && createIfMissing) {
        bucket = { u: new Set(), h: new Set(), s: new Set(), _t: Date.now() };
        store.threads[tKey] = bucket;
    }
    return bucket || null;
}

function xfpdFlushDedupStoreNow() {
    if (xfpdDedupFlushTimer) {
        clearTimeout(xfpdDedupFlushTimer);
        xfpdDedupFlushTimer = null;
    }
    if (!xfpdDedupStoreCache) return;
    const entries = Object.entries(xfpdDedupStoreCache.threads).filter(([k]) => k !== '_session');
    entries.sort((a, b) => (Number(b[1]._t || 0) || 0) - (Number(a[1]._t || 0) || 0));

    const serializedThreads = {};
    for (const [tKey, b] of entries.slice(0, XFPD_DEDUP_MAX_THREADS)) {
        const uArr = Array.from(b.u);
        const hArr = Array.from(b.h);
        serializedThreads[tKey] = {
            u: uArr.length > XFPD_DEDUP_MAX_ITEMS_PER_THREAD ? uArr.slice(-XFPD_DEDUP_MAX_ITEMS_PER_THREAD) : uArr,
            h: hArr.length > XFPD_DEDUP_MAX_ITEMS_PER_THREAD ? hArr.slice(-XFPD_DEDUP_MAX_ITEMS_PER_THREAD) : hArr,
            _t: b._t || Date.now(),
        };
    }
    const payload = { _updatedAt: Date.now(), threads: serializedThreads };
    xfpdWriteStoredObject(XFPD_THREAD_DEDUP_KEY, payload);
}

function xfpdScheduleDedupFlush() {
    if (xfpdDedupFlushTimer) return;
    xfpdDedupFlushTimer = setTimeout(() => {
        xfpdDedupFlushTimer = null;
        try {
            xfpdFlushDedupStoreNow();
        } catch (e) {}
    }, 200);
}

function xfpdHasSeenThreadUrl(urlKey, explicitThreadKey = null) {
    if (!urlKey) return false;
    const bucket = xfpdGetThreadDedupBucket(explicitThreadKey, false);
    return !!(bucket && bucket.u.has(urlKey));
}

function xfpdMarkSeenThreadUrl(urlKey, explicitThreadKey = null) {
    if (!urlKey) return;
    const bucket = xfpdGetThreadDedupBucket(explicitThreadKey, true);
    bucket.u.add(urlKey);
    bucket._t = Date.now();
    xfpdScheduleDedupFlush();
}

function xfpdHasSeenThreadHash(fingerprint, explicitThreadKey = null) {
    if (!fingerprint) return false;
    const bucket = xfpdGetThreadDedupBucket(explicitThreadKey, false);
    return !!(bucket && bucket.h.has(fingerprint));
}

function xfpdThreadHasSeenExactSize(byteSize, explicitThreadKey = null) {
    const n = Number(byteSize || 0) || 0;
    if (n <= 0) return false;
    const bucket = xfpdGetThreadDedupBucket(explicitThreadKey, false);
    return !!(bucket && bucket.s.has(n));
}

function xfpdMarkSeenThreadHash(fingerprint, explicitThreadKey = null) {
    if (!fingerprint) return;
    const bucket = xfpdGetThreadDedupBucket(explicitThreadKey, true);
    bucket.h.add(fingerprint);
    const parts = String(fingerprint).split(':');
    if (parts.length >= 3) {
        const sz = Number(parts[1]);
        if (sz > 0) bucket.s.add(sz);
    }
    bucket._t = Date.now();
    xfpdScheduleDedupFlush();
}

function xfpdGetThreadDedupCount(explicitThreadKey = null) {
    const bucket = xfpdGetThreadDedupBucket(explicitThreadKey, false);
    if (!bucket) return 0;
    return Math.max(bucket.h.size, bucket.u.size);
}

function xfpdClearThreadDedup(explicitThreadKey = null) {
    const store = xfpdEnsureDedupStore();
    const tKey = (explicitThreadKey !== null ? explicitThreadKey : xfpdGetCurrentThreadKey()) || '_session';
    delete store.threads[tKey];
    xfpdFlushDedupStoreNow();
    if (typeof xfpdClearThreadLedger === 'function') {
        xfpdClearThreadLedger(tKey);
    }
}

// --- Persistent Per-Thread Post & Page Coverage Ledger -------------------------------------------
const XFPD_THREAD_LEDGER_KEY = 'xfpd_thread_ledger';
const XFPD_MAX_LEDGER_THREADS = 250;

let xfpdLedgerMirror = null;
let xfpdLedgerListenerBound = false;

function xfpdBindLedgerListener() {
    if (xfpdLedgerListenerBound) return;
    xfpdLedgerListenerBound = true;
    const addListener =
        (typeof GM_addValueChangeListener === 'function' ? GM_addValueChangeListener : null) ||
        (typeof window !== 'undefined' && typeof window.GM_addValueChangeListener === 'function'
            ? window.GM_addValueChangeListener.bind(window)
            : null);
    if (addListener) {
        try {
            addListener(XFPD_THREAD_LEDGER_KEY, (_k, _oldV, newV) => {
                const parsed = xfpdParsePrefsJson(newV);
                if (parsed && parsed.threads && typeof parsed.threads === 'object') {
                    xfpdLedgerMirror = parsed;
                }
            });
        } catch (e) {}
    }
}

function xfpdLoadLedgerStore() {
    xfpdBindLedgerListener();
    const raw = xfpdReadStoredObject(XFPD_THREAD_LEDGER_KEY, xfpdLedgerMirror);
    const store = {
        _updatedAt: Number((raw && raw._updatedAt) || 0) || 0,
        threads: raw && raw.threads && typeof raw.threads === 'object' ? { ...raw.threads } : {},
    };
    xfpdLedgerMirror = store;
    return store;
}

function xfpdSaveLedgerStore(store) {
    const prevTime = Number((xfpdLedgerMirror && xfpdLedgerMirror._updatedAt) || 0) || 0;
    store._updatedAt = Math.max(Date.now(), prevTime + 1);
    const keys = Object.keys(store.threads || {});
    if (keys.length > XFPD_MAX_LEDGER_THREADS) {
        keys
            .sort((a, b) => (Number(store.threads[a]?._t) || 0) - (Number(store.threads[b]?._t) || 0))
            .slice(0, keys.length - XFPD_MAX_LEDGER_THREADS)
            .forEach(k => delete store.threads[k]);
    }
    xfpdLedgerMirror = store;
    xfpdWriteStoredObject(XFPD_THREAD_LEDGER_KEY, store);
}

function xfpdEnsureThreadLedgerBucket(store, threadKey) {
    if (!store.threads[threadKey] || typeof store.threads[threadKey] !== 'object') {
        store.threads[threadKey] = { p: {}, sp: [], fp: [], _t: Date.now() };
    }
    const b = store.threads[threadKey];
    if (!b.p || typeof b.p !== 'object') b.p = {};
    if (!Array.isArray(b.sp)) b.sp = [];
    if (!Array.isArray(b.fp)) b.fp = [];
    return b;
}

function xfpdRecordThreadPostOutcome(explicitThreadKey, info) {
    const tKey = explicitThreadKey || xfpdGetCurrentThreadKey();
    if (!tKey || !info || !info.postId || info.status === 'cancelled') return;
    const store = xfpdLoadLedgerStore();
    const b = xfpdEnsureThreadLedgerBucket(store, tKey);
    const codeMap = { done: 'd', dedup: 'u', partial: 'p', failed: 'f' };
    const code = codeMap[info.status] || 'd';
    b.p[String(info.postId)] = [
        String(info.postNumber || ''),
        code,
        Number(info.succeeded || 0) || 0,
        Number(info.total || 0) || 0,
        Number(info.deduped || 0) || 0,
    ];
    b._t = Date.now();
    xfpdSaveLedgerStore(store);
}

function xfpdRecordThreadPageOutcome(explicitThreadKey, pageNum, ok) {
    const tKey = explicitThreadKey || xfpdGetCurrentThreadKey();
    const pNum = parseInt(pageNum, 10) || 0;
    if (!tKey || pNum <= 0) return;
    const store = xfpdLoadLedgerStore();
    const b = xfpdEnsureThreadLedgerBucket(store, tKey);
    if (ok) {
        if (!b.sp.includes(pNum)) {
            b.sp.push(pNum);
            b.sp.sort((a, c) => a - c);
        }
        b.fp = b.fp.filter(x => x !== pNum);
    } else {
        if (!b.fp.includes(pNum)) {
            b.fp.push(pNum);
            b.fp.sort((a, c) => a - c);
        }
    }
    b._t = Date.now();
    xfpdSaveLedgerStore(store);
}

function xfpdGetThreadPostRecord(postId, explicitThreadKey = null) {
    const tKey = explicitThreadKey || xfpdGetCurrentThreadKey();
    if (!tKey || !postId) return null;
    const store = xfpdLoadLedgerStore();
    const b = store.threads && store.threads[tKey];
    const row = b && b.p && b.p[String(postId)];
    if (!Array.isArray(row) || row.length < 5) return null;
    const revMap = { d: 'done', u: 'dedup', p: 'partial', f: 'failed' };
    return {
        postNumber: row[0],
        status: revMap[row[1]] || 'done',
        succeeded: Number(row[2] || 0) || 0,
        total: Number(row[3] || 0) || 0,
        deduped: Number(row[4] || 0) || 0,
    };
}

function xfpdGetThreadLedgerSummary(explicitThreadKey = null) {
    const tKey = explicitThreadKey || xfpdGetCurrentThreadKey();
    if (!tKey) return { postCount: 0, savedPosts: 0, scannedPages: [], failedPages: [] };
    const store = xfpdLoadLedgerStore();
    const b = store.threads && store.threads[tKey];
    if (!b) return { postCount: 0, savedPosts: 0, scannedPages: [], failedPages: [] };
    const entries = Object.values(b.p || {});
    const savedPosts = entries.filter(r => Array.isArray(r) && (r[1] === 'd' || r[1] === 'u' || r[1] === 'p')).length;
    return {
        postCount: entries.length,
        savedPosts,
        scannedPages: Array.isArray(b.sp) ? b.sp.slice() : [],
        failedPages: Array.isArray(b.fp) ? b.fp.slice() : [],
    };
}

function xfpdClearThreadLedger(explicitThreadKey = null) {
    const tKey = explicitThreadKey || xfpdGetCurrentThreadKey();
    if (!tKey) return;
    const store = xfpdLoadLedgerStore();
    if (store.threads && store.threads[tKey]) {
        delete store.threads[tKey];
        xfpdSaveLedgerStore(store);
    }
}

async function xfpdReadBlobArrayBuffer(blob) {
    if (!blob) return new ArrayBuffer(0);
    if (typeof blob.arrayBuffer === 'function') {
        return await blob.arrayBuffer();
    }
    return await new Promise((resolve, reject) => {
        try {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result || new ArrayBuffer(0));
            fr.onerror = err => reject(err);
            fr.readAsArrayBuffer(blob);
        } catch (e) {
            resolve(new ArrayBuffer(0));
        }
    });
}

async function xfpdDigestUint8ArrayToTag(bytes) {
    if (!bytes || !bytes.byteLength) return '';
    try {
        const subtle =
            (typeof crypto !== 'undefined' && crypto && crypto.subtle) ||
            (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) ||
            null;
        if (subtle && typeof subtle.digest === 'function') {
            const hashBuf = await subtle.digest('SHA-256', bytes);
            const arr = new Uint8Array(hashBuf, 0, 18); // 144 bits -> compact 24-char base64url
            let bin = '';
            for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
            return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        }
    } catch (e) {}
    // Fallback FNV-1a + window.sha256 for environments without WebCrypto subtle
    try {
        let h1 = 0x811c9dc5;
        let h2 = 0x01000193;
        for (let i = 0; i < bytes.length; i++) {
            const b = bytes[i];
            h1 ^= b;
            h1 = Math.imul(h1, 0x01000193) >>> 0;
            h2 ^= b + (i & 0xff);
            h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
        }
        if (typeof sha256 === 'function') {
            return String(sha256(`${bytes.length}:${h1}:${h2}`)).slice(0, 24);
        }
        return `${h1.toString(36)}_${h2.toString(36)}`;
    } catch (e) {
        return '';
    }
}

async function xfpdComputeBlobFingerprint(blob) {
    if (!blob || typeof blob.size !== 'number' || blob.size <= 0) return '';
    const size = blob.size;
    try {
        if (size <= XFPD_FULL_HASH_MAX_BYTES) {
            const ab = await xfpdReadBlobArrayBuffer(blob);
            const tag = await xfpdDigestUint8ArrayToTag(new Uint8Array(ab));
            return tag ? `f:${size}:${tag}` : '';
        }

        // Sparse 4 x 256 KB zero-copy slice sampling for large videos (> 8 MB): < 0.5ms CPU, 1 MB temp buffer!
        const chunk = XFPD_SPARSE_CHUNK_BYTES;
        const offsets = [
            0,
            Math.floor(size / 3),
            Math.floor((size * 2) / 3),
            Math.max(0, size - chunk),
        ];
        const parts = await Promise.all(
            offsets.map(off => xfpdReadBlobArrayBuffer(blob.slice(off, Math.min(size, off + chunk)))),
        );
        const sizeFooter = new TextEncoder().encode(`|sz:${size}`);
        const totalBytes = parts.reduce((acc, p) => acc + p.byteLength, 0) + sizeFooter.byteLength;
        const combined = new Uint8Array(totalBytes);
        let cursor = 0;
        for (const p of parts) {
            combined.set(new Uint8Array(p), cursor);
            cursor += p.byteLength;
        }
        combined.set(sizeFooter, cursor);
        const tag = await xfpdDigestUint8ArrayToTag(combined);
        return tag ? `s:${size}:${tag}` : '';
    } catch (e) {
        return '';
    }
}

// --- In-Memory Archive Auto-Extractor (.zip / .rar RAR4+RAR5 / .7z / .tar.gz) -------------------
const XFPD_MAX_EXTRACT_ARCHIVE_BYTES = 650 * 1024 * 1024; // 650 MB safe browser RAM ceiling
const XFPD_7Z_WASM_URLS = [
    'https://cdn.jsdelivr.net/npm/7z-wasm@1.2.0/7zz.wasm',
    'https://unpkg.com/7z-wasm@1.2.0/7zz.wasm',
];

let xfpdCached7zWasmBinaryPromise = null;
let xfpdDynamicSevenZipFactory = null;

function xfpdIsMultiVolumePartName(fileName) {
    const s = String(fileName || '').trim().toLowerCase();
    if (!s) return false;
    return (
        /\.part0*\d+\.rar$/i.test(s) ||
        /\.(?:r|z)\d{2,3}$/i.test(s) ||
        /\.(?:7z|zip|rar)\.\d{3}$/i.test(s)
    );
}

function xfpdIsNonMediaContainerZipExt(fileName) {
    return /\.(?:docx|xlsx|pptx|odt|ods|odp|epub|apk|ipa|jar|xpi|cbz|cbr)$/i.test(String(fileName || '').trim());
}

function xfpdIsExtractableArchiveCandidate(fileName, contentTypeHint = '') {
    const name = String(fileName || '').trim();
    if (xfpdIsMultiVolumePartName(name) || xfpdIsNonMediaContainerZipExt(name)) return false;
    if (/\.(?:zip|rar|7z|tar|tgz|tbz2|txz|tar\.(?:gz|bz2|xz|zst))$/i.test(name)) {
        return true;
    }
    const ct = String(contentTypeHint || '').toLowerCase();
    return /application\/(?:zip|x-zip-compressed|vnd\.rar|x-rar|x-rar-compressed|x-7z-compressed|x-tar)/i.test(ct);
}

function xfpdGuessMimeFromExt(extRaw) {
    const e = String(extRaw || '').replace(/^\./, '').toLowerCase();
    if (e === 'jpg' || e === 'jpeg' || e === 'jfif') return 'image/jpeg';
    if (e === 'png') return 'image/png';
    if (e === 'webp') return 'image/webp';
    if (e === 'gif') return 'image/gif';
    if (e === 'avif') return 'image/avif';
    if (e === 'bmp') return 'image/bmp';
    if (e === 'mp4' || e === 'm4v') return 'video/mp4';
    if (e === 'webm') return 'video/webm';
    if (e === 'mov') return 'video/quicktime';
    if (e === 'mkv') return 'video/x-matroska';
    if (e === 'avi') return 'video/x-msvideo';
    if (e === 'ts' || e === 'm2ts') return 'video/mp2t';
    return 'application/octet-stream';
}

function xfpdIsJunkArchiveEntryPath(relPath) {
    const norm = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!norm || norm.endsWith('/')) return true;
    const segs = norm.split('/').filter(Boolean);
    if (!segs.length) return true;
    if (segs.some(seg => seg === '__MACOSX' || seg === '.Spotlight-V100' || seg === '.Trashes')) return true;
    const base = segs[segs.length - 1];
    if (!base || base.startsWith('._')) return true;
    const low = base.toLowerCase();
    return low === '.ds_store' || low === 'thumbs.db' || low === 'desktop.ini';
}

async function xfpdInspectArchiveHeader(blob) {
    if (!blob || typeof blob.size !== 'number' || blob.size < 8) {
        return { kind: '', zipEncrypted: false };
    }
    try {
        const headAb = await xfpdReadBlobArrayBuffer(blob.slice(0, 12));
        const b = new Uint8Array(headAb);
        if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) {
            const flags = b[6] | (b[7] << 8);
            return { kind: 'zip', zipEncrypted: (flags & 0x01) !== 0 };
        }
        if (b[0] === 0x52 && b[1] === 0x61 && b[2] === 0x72 && b[3] === 0x21 && b[4] === 0x1a && b[5] === 0x07) {
            return { kind: 'rar', zipEncrypted: false };
        }
        if (b[0] === 0x37 && b[1] === 0x7a && b[2] === 0xbc && b[3] === 0xaf && b[4] === 0x27 && b[5] === 0x1c) {
            return { kind: '7z', zipEncrypted: false };
        }
    } catch (e) {}
    return { kind: '', zipEncrypted: false };
}

async function xfpdLoad7zWasmResources() {
    let factory =
        xfpdSevenZipFactory ||
        xfpdDynamicSevenZipFactory ||
        (typeof SevenZip === 'function' ? SevenZip : null) ||
        (typeof window !== 'undefined' && typeof window.SevenZip === 'function' ? window.SevenZip : null);

    if (!factory) {
        try {
            const mod = await import('https://cdn.jsdelivr.net/npm/7z-wasm@1.2.0/7zz.es6.js');
            factory = (mod && (mod.default || mod.SevenZip || mod)) || null;
            if (typeof factory === 'function') xfpdDynamicSevenZipFactory = factory;
        } catch (e) {}
    }
    if (typeof factory !== 'function') {
        throw new Error('SevenZip WASM factory unavailable');
    }

    if (
        typeof window !== 'undefined' &&
        window.__XFPD_7Z_WASM_BINARY &&
        typeof window.__XFPD_7Z_WASM_BINARY.byteLength === 'number' &&
        window.__XFPD_7Z_WASM_BINARY.byteLength > 100000
    ) {
        return { factory, wasmBinary: window.__XFPD_7Z_WASM_BINARY };
    }

    if (!xfpdCached7zWasmBinaryPromise) {
        xfpdCached7zWasmBinaryPromise = (async () => {
            const fetchFn =
                (typeof fetch === 'function' && fetch) ||
                (typeof window !== 'undefined' && typeof window.fetch === 'function' && window.fetch.bind(window));
            if (fetchFn) {
                for (const wasmUrl of XFPD_7Z_WASM_URLS) {
                    try {
                        const res = await fetchFn(wasmUrl, { mode: 'cors', credentials: 'omit' });
                        if (res && res.ok) {
                            const ab = await res.arrayBuffer();
                            if (ab && ab.byteLength > 100000) return ab;
                        }
                    } catch (e) {}
                }
            }
            throw new Error('Failed to fetch 7zz.wasm from CDN');
        })().catch(err => {
            xfpdCached7zWasmBinaryPromise = null;
            throw err;
        });
    }

    const wasmBinary = await xfpdCached7zWasmBinaryPromise;
    return { factory, wasmBinary };
}

async function xfpdExtractArchiveBlob(blob, archiveName, candidatePasswords = [], _depth = 0) {
    if (!blob || typeof blob.size !== 'number' || blob.size <= 0) {
        return { ok: false, reason: 'empty_blob' };
    }
    if (blob.size > XFPD_MAX_EXTRACT_ARCHIVE_BYTES) {
        return { ok: false, reason: 'too_large' };
    }
    if (xfpdIsMultiVolumePartName(archiveName) || xfpdIsNonMediaContainerZipExt(archiveName)) {
        return { ok: false, reason: 'multipart_or_container' };
    }

    const headerInfo = await xfpdInspectArchiveHeader(blob);
    const nameMatch = /\.(?:zip|rar|7z|tar|tgz|tbz2|txz|gz|bz2|xz)$/i.exec(String(archiveName || ''));
    const archiveExt = headerInfo.kind || (nameMatch ? nameMatch[0].slice(1).toLowerCase() : '');
    if (!archiveExt) {
        return { ok: false, reason: 'not_archive' };
    }

    const sortAndFinalizeEntries = async (rawEntries, engineName) => {
        rawEntries.sort((a, b) =>
            a.relPath.localeCompare(b.relPath, undefined, { numeric: true, sensitivity: 'base' }),
        );
        // Unwrap 1-level nested archive (e.g. .tar.gz or a .zip/.rar packed inside an outer .rar/.zip)
        if (
            _depth < 1 &&
            rawEntries.length === 1 &&
            rawEntries[0].size <= XFPD_MAX_EXTRACT_ARCHIVE_BYTES &&
            (xfpdIsExtractableArchiveCandidate(rawEntries[0].basename) || /\.tar$/i.test(rawEntries[0].basename))
        ) {
            const nestedRes = await xfpdExtractArchiveBlob(
                rawEntries[0].blob,
                rawEntries[0].basename,
                candidatePasswords,
                _depth + 1,
            );
            if (nestedRes && nestedRes.ok && nestedRes.entries && nestedRes.entries.length > 0) {
                return nestedRes;
            }
        }
        return { ok: true, engine: engineName, entries: rawEntries };
    };

    // Tier 1: Zero-network fast path via JSZip for standard unencrypted .zip archives
    if (headerInfo.kind === 'zip' && !headerInfo.zipEncrypted && typeof JSZip === 'function' && typeof JSZip.loadAsync === 'function') {
        try {
            const z = await JSZip.loadAsync(blob);
            const extracted = [];
            const fileKeys = Object.keys(z.files || {});
            for (const k of fileKeys) {
                const entry = z.files[k];
                if (!entry || entry.dir) continue;
                const relPath = String(entry.name || k).replace(/\\/g, '/').replace(/^\/+/, '');
                if (xfpdIsJunkArchiveEntryPath(relPath)) continue;
                const u8 = await entry.async('uint8array');
                if (!u8 || u8.byteLength === 0) continue;
                const base = relPath.split('/').pop();
                const dotIdx = base.lastIndexOf('.');
                const ext = dotIdx > 0 ? base.slice(dotIdx + 1).toLowerCase() : '';
                const mime = xfpdGuessMimeFromExt(ext);
                extracted.push({
                    relPath,
                    basename: base,
                    ext,
                    mime,
                    size: u8.byteLength,
                    blob: new Blob([u8], { type: mime }),
                });
            }
            if (extracted.length > 0) {
                return await sortAndFinalizeEntries(extracted, 'jszip');
            }
        } catch (e) {
            // Encrypted, Deflate64, LZMA, or Zstd ZIP -> fall through seamlessly to Tier 2 (7z-wasm)
        }
    }

    // Tier 2: Universal 7-Zip 24.09 WASM engine (.rar RAR4+RAR5, .7z, encrypted .zip/.rar/.7z, .tar/.gz/.xz)
    try {
        const { factory, wasmBinary } = await xfpdLoad7zWasmResources();
        const archiveAb = await xfpdReadBlobArrayBuffer(blob);
        const archiveU8 = new Uint8Array(archiveAb);

        const pwCandidates = [''];
        for (const rawPw of candidatePasswords || []) {
            const p = String(rawPw || '').trim();
            if (p && !pwCandidates.includes(p)) pwCandidates.push(p);
        }

        const inputName = `/in.${archiveExt || 'bin'}`;

        for (const pw of pwCandidates) {
            let exitCode = 0;
            const sz = await factory({
                wasmBinary,
                print: () => {},
                printErr: () => {},
                quit: code => {
                    exitCode = typeof code === 'number' ? code : 2;
                },
            });

            sz.FS.mkdir('/out');
            sz.FS.writeFile(inputName, archiveU8);

            try {
                const ret = sz.callMain(['x', '-y', `-p${pw}`, '-o/out', inputName]);
                if (typeof ret === 'number') exitCode = ret;
            } catch (err) {
                exitCode = err && typeof err.status === 'number' ? err.status : 2;
            }

            if (exitCode >= 2) {
                // Fatal error / wrong password -> try next password candidate!
                continue;
            }

            const walkMemFs = dir => {
                const items = [];
                for (const name of sz.FS.readdir(dir)) {
                    if (name === '.' || name === '..') continue;
                    const full = `${dir}/${name}`;
                    const st = sz.FS.stat(full);
                    if (sz.FS.isDir(st.mode)) {
                        items.push(...walkMemFs(full));
                    } else if (st.size > 0) {
                        const relPath = full.slice(5).replace(/^\/+/, '');
                        if (!xfpdIsJunkArchiveEntryPath(relPath)) {
                            const bytes = sz.FS.readFile(full);
                            const copy = new Uint8Array(bytes.byteLength);
                            copy.set(bytes);
                            const base = relPath.split('/').pop();
                            const dotIdx = base.lastIndexOf('.');
                            const ext = dotIdx > 0 ? base.slice(dotIdx + 1).toLowerCase() : '';
                            const mime = xfpdGuessMimeFromExt(ext);
                            items.push({
                                relPath,
                                basename: base,
                                ext,
                                mime,
                                size: copy.byteLength,
                                blob: new Blob([copy], { type: mime }),
                            });
                        }
                    }
                }
                return items;
            };

            const extracted = walkMemFs('/out');
            if (extracted.length > 0) {
                return await sortAndFinalizeEntries(extracted, '7z-wasm');
            }
        }

        return { ok: false, reason: 'extract_failed_or_locked' };
    } catch (err) {
        return { ok: false, reason: String((err && err.message) || err || 'wasm_error') };
    }
}

// --- Background Worker Queue IPC (Persistent Cross-Tab Download Queue) --------------------------
const XFPD_WORKER_PARAM = 'xfpd_worker';
const XFPD_WORKER_VAL = '1';
const XFPD_K_QUEUE_CMD = 'xfpd_q_cmds';
const XFPD_K_QUEUE_STATE = 'xfpd_q_state';
const XFPD_K_QUEUE_PING = 'xfpd_q_ping';
const XFPD_K_WORKER_SPAWN = 'xfpd_q_spawning';

const XFPD_WORKER_HEARTBEAT_MS = 1800;
const XFPD_WORKER_ALIVE_TTL_MS = 6500;
const XFPD_WORKER_IDLE_CLOSE_MS = 4500;

let xfpdQueueCmdMirror = '';
let xfpdQueueStateMirror = '';
let xfpdQueueListenersBound = false;
let xfpdSpawnedWorkerHandle = null;
let xfpdCmdSeq = 0;
let xfpdLastPingSentAt = 0;
let xfpdBroadcastBus = null;

const xfpdQueueStateSubscribers = new Set();
const xfpdQueueCmdSubscribers = new Set();
const xfpdQueuePingSubscribers = new Set();

function xfpdIsWorkerTab() {
    try {
        const hashRaw = String(location.hash || '').replace(/^#/, '');
        if (hashRaw && new URLSearchParams(hashRaw).get(XFPD_WORKER_PARAM) === XFPD_WORKER_VAL) {
            return true;
        }
        return new URLSearchParams(location.search || '').get(XFPD_WORKER_PARAM) === XFPD_WORKER_VAL;
    } catch (e) {
        return false;
    }
}

function xfpdDefaultQueueState() {
    return {
        workerId: '',
        workerHeartbeat: 0,
        workerClosing: false,
        workerStandby: false,
        ackCmdIds: [],
        active: null,
        activePosts: [],
        lanes: [],
        queued: [],
        history: [],
        stats: {
            postsDone: 0,
            postsSkipped: 0,
            filesSaved: 0,
            filesDeduped: 0,
            filesFailed: 0,
            failedPostsCount: 0,
            pagesScanned: 0,
            startedAt: 0,
        },
        _updatedAt: 0,
    };
}

function xfpdGetBroadcastBus() {
    if (xfpdBroadcastBus) return xfpdBroadcastBus;
    try {
        if (typeof BroadcastChannel === 'function') {
            xfpdBroadcastBus = new BroadcastChannel('xfpd_queue_ipc_v1');
        }
    } catch (e) {}
    return xfpdBroadcastBus;
}

function xfpdBindQueueStorageListeners() {
    if (xfpdQueueListenersBound) return;
    xfpdQueueListenersBound = true;

    const handleIncomingStateRaw = newV => {
        if (newV) xfpdQueueStateMirror = typeof newV === 'string' ? newV : JSON.stringify(newV);
        const st = xfpdReadQueueState();
        if (st.workerClosing && xfpdSpawnedWorkerHandle) {
            try { xfpdCloseTabHandle(xfpdSpawnedWorkerHandle); } catch (e) {}
            xfpdSpawnedWorkerHandle = null;
        }
        xfpdQueueStateSubscribers.forEach(cb => {
            try { cb(st); } catch (e) {}
        });
    };

    const handleIncomingCmdRaw = newV => {
        if (newV) xfpdQueueCmdMirror = typeof newV === 'string' ? newV : JSON.stringify(newV);
        xfpdQueueCmdSubscribers.forEach(cb => {
            try { cb(); } catch (e) {}
        });
    };

    const handleIncomingPing = () => {
        xfpdQueuePingSubscribers.forEach(cb => {
            try { cb(); } catch (e) {}
        });
    };

    const addListener =
        (typeof GM_addValueChangeListener === 'function' ? GM_addValueChangeListener : null) ||
        (typeof window !== 'undefined' && typeof window.GM_addValueChangeListener === 'function'
            ? window.GM_addValueChangeListener.bind(window)
            : null);

    if (addListener) {
        try {
            addListener(XFPD_K_QUEUE_STATE, (_name, _oldV, newV) => handleIncomingStateRaw(newV));
        } catch (e) {}
        try {
            addListener(XFPD_K_QUEUE_CMD, (_name, _oldV, newV) => handleIncomingCmdRaw(newV));
        } catch (e) {}
        try {
            addListener(XFPD_K_QUEUE_PING, () => handleIncomingPing());
        } catch (e) {}
    }

    const bus = xfpdGetBroadcastBus();
    if (bus) {
        try {
            bus.onmessage = ev => {
                const msg = ev && ev.data;
                if (!msg || typeof msg !== 'object') return;
                if (msg.kind === 'state' && msg.data) {
                    handleIncomingStateRaw(msg.data);
                } else if (msg.kind === 'cmd' && msg.data) {
                    handleIncomingCmdRaw(msg.data);
                } else if (msg.kind === 'ping') {
                    handleIncomingPing();
                }
            };
        } catch (e) {}
    }
}

function xfpdReadRawGmOrLs(key, mirrorStr = '') {
    const candidates = [];
    if (mirrorStr) {
        const p = xfpdParsePrefsJson(mirrorStr);
        if (p) candidates.push(p);
    }
    try {
        const getVal =
            (typeof GM_getValue === 'function' ? GM_getValue : null) ||
            (typeof window !== 'undefined' && typeof window.GM_getValue === 'function' ? window.GM_getValue.bind(window) : null);
        if (getVal) {
            const p = xfpdParsePrefsJson(getVal(key, ''));
            if (p) candidates.push(p);
        }
    } catch (e) {}
    try {
        if (typeof localStorage !== 'undefined' && localStorage) {
            const p = xfpdParsePrefsJson(localStorage.getItem(key));
            if (p) candidates.push(p);
        }
    } catch (e) {}

    let best = null;
    for (const c of candidates) {
        if (!best || (Number(c._updatedAt || 0) || 0) > (Number(best._updatedAt || 0) || 0)) {
            best = c;
        }
    }
    return best;
}

function xfpdReadQueueState() {
    xfpdBindQueueStorageListeners();
    const raw = xfpdReadRawGmOrLs(XFPD_K_QUEUE_STATE, xfpdQueueStateMirror);
    if (!raw || typeof raw !== 'object') return xfpdDefaultQueueState();
    const defStats = xfpdDefaultQueueState().stats;
    const rawStats = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
    return {
        workerId: String(raw.workerId || ''),
        workerHeartbeat: Number(raw.workerHeartbeat || 0) || 0,
        workerClosing: !!raw.workerClosing,
        workerStandby: !!raw.workerStandby,
        ackCmdIds: Array.isArray(raw.ackCmdIds) ? raw.ackCmdIds : [],
        active: raw.active && typeof raw.active === 'object' ? raw.active : null,
        activePosts: Array.isArray(raw.activePosts) ? raw.activePosts : [],
        lanes: Array.isArray(raw.lanes) ? raw.lanes : [],
        queued: Array.isArray(raw.queued) ? raw.queued : [],
        history: Array.isArray(raw.history) ? raw.history : [],
        stats: {
            postsDone: Number(rawStats.postsDone || 0) || 0,
            postsSkipped: Number(rawStats.postsSkipped || 0) || 0,
            filesSaved: Number(rawStats.filesSaved || 0) || 0,
            filesDeduped: Number(rawStats.filesDeduped || 0) || 0,
            filesFailed: Number(rawStats.filesFailed || 0) || 0,
            failedPostsCount: Number(rawStats.failedPostsCount || 0) || 0,
            pagesScanned: Number(rawStats.pagesScanned || 0) || 0,
            startedAt: Number(rawStats.startedAt || 0) || 0,
        },
        _updatedAt: Number(raw._updatedAt || 0) || 0,
    };
}

function xfpdWriteQueueState(stateObj) {
    const prev = xfpdReadQueueState();
    const payload = {
        ...xfpdDefaultQueueState(),
        ...stateObj,
        _updatedAt: Math.max(Date.now(), (Number(prev._updatedAt || 0) || 0) + 1),
    };
    const rawStr = JSON.stringify(payload);
    xfpdQueueStateMirror = rawStr;
    xfpdWriteStoredObject(XFPD_K_QUEUE_STATE, payload);
    const bus = xfpdGetBroadcastBus();
    if (bus) {
        try { bus.postMessage({ kind: 'state', data: rawStr }); } catch (e) {}
    }
    xfpdQueueStateSubscribers.forEach(cb => {
        try { cb(payload); } catch (e) {}
    });
    return payload;
}

function xfpdPingQueueWorker() {
    const now = Date.now();
    if (now - xfpdLastPingSentAt < 1200) return;
    xfpdLastPingSentAt = now;
    try {
        const setVal =
            (typeof GM_setValue === 'function' ? GM_setValue : null) ||
            (typeof window !== 'undefined' && typeof window.GM_setValue === 'function' ? window.GM_setValue.bind(window) : null);
        if (setVal) setVal(XFPD_K_QUEUE_PING, String(now));
    } catch (e) {}
    const bus = xfpdGetBroadcastBus();
    if (bus) {
        try { bus.postMessage({ kind: 'ping', ts: now }); } catch (e) {}
    }
}

function xfpdIsQueueWorkerAlive(stateSnapshot = null) {
    const st = stateSnapshot || xfpdReadQueueState();
    if (st.workerClosing || !st.workerHeartbeat) return false;
    const age = Date.now() - st.workerHeartbeat;
    if (age > 2600 && age < XFPD_WORKER_ALIVE_TTL_MS * 2 && !xfpdIsWorkerTab()) {
        xfpdPingQueueWorker();
    }
    return age < XFPD_WORKER_ALIVE_TTL_MS;
}

function xfpdSendQueueCommand(type, payload = {}) {
    xfpdBindQueueStorageListeners();
    const state = xfpdReadQueueState();
    const ackSet = new Set(state.ackCmdIds || []);
    const existingObj = xfpdReadRawGmOrLs(XFPD_K_QUEUE_CMD, xfpdQueueCmdMirror);
    const existingCmds = existingObj && Array.isArray(existingObj.cmds) ? existingObj.cmds : [];

    // Keep only unacknowledged recent commands (< 5 min old) so the command log stays tiny!
    const now = Date.now();
    const pendingCmds = existingCmds.filter(c => c && c.id && !ackSet.has(c.id) && now - (Number(c.ts) || 0) < 300000);

    const cmdId = `cmd_${now}_${Math.random().toString(36).slice(2, 7)}_${++xfpdCmdSeq}`;
    pendingCmds.push({
        id: cmdId,
        type: String(type),
        payload,
        ts: now,
    });

    const nextBox = {
        _updatedAt: Math.max(now, (Number((existingObj && existingObj._updatedAt) || 0) || 0) + 1),
        cmds: pendingCmds,
    };
    const rawStr = JSON.stringify(nextBox);
    xfpdQueueCmdMirror = rawStr;
    xfpdWriteStoredObject(XFPD_K_QUEUE_CMD, nextBox);
    const bus = xfpdGetBroadcastBus();
    if (bus) {
        try { bus.postMessage({ kind: 'cmd', data: rawStr }); } catch (e) {}
    }
    xfpdQueueCmdSubscribers.forEach(cb => {
        try { cb(); } catch (e) {}
    });
    return cmdId;
}

function xfpdReadPendingQueueCommands(processedIdsSet) {
    const box = xfpdReadRawGmOrLs(XFPD_K_QUEUE_CMD, xfpdQueueCmdMirror);
    if (!box || !Array.isArray(box.cmds)) return [];
    return box.cmds.filter(c => c && c.id && !processedIdsSet.has(c.id));
}

function xfpdOnQueueStateChange(cb) {
    if (typeof cb !== 'function') return () => {};
    xfpdBindQueueStorageListeners();
    xfpdQueueStateSubscribers.add(cb);
    return () => xfpdQueueStateSubscribers.delete(cb);
}

function xfpdOnQueueCommand(cb) {
    if (typeof cb !== 'function') return () => {};
    xfpdBindQueueStorageListeners();
    xfpdQueueCmdSubscribers.add(cb);
    return () => xfpdQueueCmdSubscribers.delete(cb);
}

function xfpdOnQueuePing(cb) {
    if (typeof cb !== 'function') return () => {};
    xfpdBindQueueStorageListeners();
    xfpdQueuePingSubscribers.add(cb);
    return () => xfpdQueuePingSubscribers.delete(cb);
}

function xfpdBuildWorkerUrl() {
    // Use URL hash (`#xfpd_worker=1`) so Cloudflare/XenForo never sees an extra query parameter,
    // canonical 301 redirects cannot strip it, and the browser can reuse its local HTTP cache!
    const base = String(location.href || '').split('#')[0];
    return `${base}#${XFPD_WORKER_PARAM}=${XFPD_WORKER_VAL}`;
}

function xfpdEnsureQueueWorkerTab() {
    if (xfpdIsWorkerTab()) return true;
    if (xfpdIsQueueWorkerAlive()) return true;

    const getVal =
        (typeof GM_getValue === 'function' ? GM_getValue : null) ||
        (typeof window !== 'undefined' && typeof window.GM_getValue === 'function' ? window.GM_getValue.bind(window) : null);
    const setVal =
        (typeof GM_setValue === 'function' ? GM_setValue : null) ||
        (typeof window !== 'undefined' && typeof window.GM_setValue === 'function' ? window.GM_setValue.bind(window) : null);
    const openTabFn =
        (typeof GM_openInTab === 'function' ? GM_openInTab : null) ||
        (typeof window !== 'undefined' && typeof window.GM_openInTab === 'function' ? window.GM_openInTab.bind(window) : null) ||
        (typeof GM === 'object' && GM && typeof GM.openInTab === 'function' ? GM.openInTab.bind(GM) : null);

    let spawnUntil = 0;
    try {
        if (getVal) spawnUntil = Number(getVal(XFPD_K_WORKER_SPAWN, 0) || 0) || 0;
    } catch (e) {}
    if (Date.now() < spawnUntil) {
        return true;
    }

    if (!openTabFn) {
        return false;
    }

    try {
        if (setVal) {
            setVal(XFPD_K_WORKER_SPAWN, Date.now() + 6500);
        }
    } catch (e) {}

    try {
        const workerUrl = xfpdBuildWorkerUrl();
        const handle = openTabFn(workerUrl, { active: false, insert: true, setParent: true });
        if (handle) {
            xfpdSpawnedWorkerHandle = handle;
            return true;
        }
    } catch (e) {}
    return false;
}

// --- Hybrid Direct-Disk Save Engine (Go Agent 127.0.0.1 + Browser File System API + GM_download) ---
const XFPD_GO_AGENT_BASE = 'http://127.0.0.1:48721';
const XFPD_FS_IDB_NAME = 'xfpd_fs_handles_v1';
const XFPD_FS_IDB_STORE = 'handles';
const XFPD_FS_FOLDER_LS_KEY = 'xfpd_direct_folder_name';

let xfpdGoAgentState = { online: false, checkedAt: 0, rootDir: '', lanes: [], checkingPromise: null };
let xfpdAgentActiveLoopback = 0;
const XFPD_AGENT_MAX_LOOPBACK_CONCURRENCY = 5; // Leaves 1 of Chrome's 6 HTTP/1.1 sockets free for instant /poll-jobs & /ping!
const xfpdAgentWaitQueue = [];

// Shared async job poller for Go Agent v2.0 (`/api/v1/submit-item` + `/api/v1/poll-jobs`)
const xfpdPendingGoJobs = new Map(); // jobId -> { resolve }
let xfpdGoPollTimer = null;
let xfpdGoPollInFlight = false;

// Global Independent Per-Host + Media-Type (Photos vs Videos) Lane Semaphores (shared across all concurrent posts!)
const XFPD_LANE_CAPS = Object.freeze({
    // Resolution lanes (independent per host)
    'res:fast-img': 14,
    'res:goonbox': 8,
    'res:bunkr': 4,
    'res:gofile': 2,
    'res:pixeldrain': 4,
    'res:cyberdrop': 4,
    'res:filester': 3,
    'res:turbo': 2,
    'res:redgifs': 4,
    // Download lanes (independent per host AND split Photos vs Videos!)
    'cdn:photos': 14,
    'cdn:videos': 6,
    'bunkr:photos': 4,
    'bunkr:videos': 3,
    'gofile:photos': 3,
    'gofile:videos': 2,
    'cyberdrop:photos': 4,
    'cyberdrop:videos': 3,
    'pixeldrain': 4,
    'filester': 3,
    'turbo': 2,
});

const xfpdLaneStates = new Map();

function xfpdGetOrInitLane(laneName) {
    let st = xfpdLaneStates.get(laneName);
    if (!st) {
        st = {
            name: laneName,
            cap: XFPD_LANE_CAPS[laneName] || 6,
            active: 0,
            done: 0,
            waiters: [],
        };
        xfpdLaneStates.set(laneName, st);
    }
    return st;
}

function xfpdAcquireHostLane(laneName) {
    const st = xfpdGetOrInitLane(laneName);
    if (st.active < st.cap) {
        st.active++;
        return Promise.resolve();
    }
    return new Promise(resolve => st.waiters.push(resolve));
}

function xfpdReleaseHostLane(laneName) {
    const st = xfpdGetOrInitLane(laneName);
    st.done++;
    if (st.waiters.length > 0) {
        const next = st.waiters.shift();
        next();
    } else {
        st.active = Math.max(0, st.active - 1);
    }
}

function xfpdClassifyResolveLane(hostObj, rawUrl) {
    const hName = String((hostObj && hostObj.name) || '').toLowerCase();
    const u = String(rawUrl || '').toLowerCase();
    if (hName === 'gofile' || u.includes('gofile.io')) return 'res:gofile';
    if (hName === 'bunkr' || u.includes('bunkr')) return 'res:bunkr';
    if (hName === 'cyberdrop' || hName === 'cyberfile' || u.includes('cyberdrop') || u.includes('cyberfile')) return 'res:cyberdrop';
    if (hName === 'pixeldrain' || u.includes('pixeldrain') || u.includes('pixeldra.in')) return 'res:pixeldrain';
    if (hName === 'filester' || u.includes('filester.')) return 'res:filester';
    if (hName === 'turbo' || u.includes('turbo')) return 'res:turbo';
    if (hName === 'goonbox' || u.includes('goonbox.cr')) return 'res:goonbox';
    if (hName === 'redgifs' || u.includes('redgifs.com')) return 'res:redgifs';
    return 'res:fast-img';
}

function xfpdClassifyDownloadLane(itemObj) {
    const u = String((itemObj && itemObj.url) || '').toLowerCase();
    const hName = String((itemObj && itemObj.host && itemObj.host.name) || '').toLowerCase();
    const hCat = String((itemObj && itemObj.host && itemObj.host.category) || '').toLowerCase();
    const cleanNoQs = u.split('#')[0].split('?')[0];
    const dotIdx = cleanNoQs.lastIndexOf('.');
    const ext = dotIdx > 0 ? cleanNoQs.slice(dotIdx + 1).toLowerCase() : '';
    const isVidExt = settings.extensions.video.includes(`.${ext}`);
    const isImgExt = settings.extensions.image.includes(`.${ext}`);
    const isPhoto = isImgExt || (!isVidExt && hCat.includes('image'));

    if (/(?:turbocdn\.st|turbo\.cr|turbovid\.cr)/.test(u) || hName === 'turbo') return 'turbo';
    if (u.includes('filester.') || hName === 'filester') return 'filester';
    if (/(?:pixeldrain\.|pixeldra\.in)/.test(u) || hName === 'pixeldrain') return 'pixeldrain';
    if (u.includes('gofile.io') || hName === 'gofile') return isPhoto ? 'gofile:photos' : 'gofile:videos';
    if (/(?:bunkr|scdn\.st|cdn\.cr)/.test(u) || hName === 'bunkr') return isPhoto ? 'bunkr:photos' : 'bunkr:videos';
    if (u.includes('cyberdrop') || u.includes('cyberfile') || u.includes('gigachad-cdn') || hName === 'cyberdrop') {
        return isPhoto ? 'cyberdrop:photos' : 'cyberdrop:videos';
    }
    return isPhoto ? 'cdn:photos' : 'cdn:videos';
}

function xfpdGetActiveLaneSnapshot() {
    // Merge Go Agent's live native lanes (when online) with browser resolution/download lanes!
    const map = new Map();
    const order = [
        'cdn:photos',
        'cdn:videos',
        'bunkr:photos',
        'bunkr:videos',
        'gofile:photos',
        'gofile:videos',
        'cyberdrop:photos',
        'cyberdrop:videos',
        'pixeldrain',
        'filester',
        'turbo',
        'res:fast-img',
        'res:goonbox',
        'res:bunkr',
        'res:gofile',
        'res:cyberdrop',
    ];
    for (const k of order) {
        const bSt = xfpdLaneStates.get(k);
        map.set(k, {
            name: k,
            workers: XFPD_LANE_CAPS[k] || 4,
            active: bSt ? bSt.active : 0,
            queued: bSt ? bSt.waiters.length : 0,
            done: bSt ? bSt.done : 0,
        });
    }
    if (xfpdGoAgentState.online && Array.isArray(xfpdGoAgentState.lanes)) {
        for (const gl of xfpdGoAgentState.lanes) {
            if (!gl || !gl.name) continue;
            const prev = map.get(gl.name);
            map.set(gl.name, {
                name: gl.name,
                workers: Number(gl.workers || (prev && prev.workers) || 4),
                active: Math.max(Number(gl.active || 0), prev ? prev.active : 0),
                queued: Number(gl.queued || 0) + (prev ? prev.queued : 0),
                done: Math.max(Number(gl.done || 0), prev ? prev.done : 0),
            });
        }
    }
    return [...map.values()];
}

function xfpdAcquireAgentSlot() {
    if (xfpdAgentActiveLoopback < XFPD_AGENT_MAX_LOOPBACK_CONCURRENCY) {
        xfpdAgentActiveLoopback++;
        return Promise.resolve();
    }
    return new Promise(resolve => xfpdAgentWaitQueue.push(resolve));
}

function xfpdReleaseAgentSlot() {
    if (xfpdAgentWaitQueue.length > 0) {
        const next = xfpdAgentWaitQueue.shift();
        next();
    } else {
        xfpdAgentActiveLoopback = Math.max(0, xfpdAgentActiveLoopback - 1);
    }
}

let xfpdCachedRootDirHandle = null;
const xfpdSubDirHandleCache = new Map();

function xfpdGetGoAgentCachedState() {
    return xfpdGoAgentState;
}

async function xfpdCheckGoAgentOnline(force = false) {
    // If active loopback transfers are already talking to Go Agent right now, never waste a socket on /ping!
    if (!force && xfpdGoAgentState.online && xfpdAgentActiveLoopback > 0) {
        return true;
    }
    const now = Date.now();
    if (!force && xfpdGoAgentState.checkedAt > 0 && now - xfpdGoAgentState.checkedAt < (xfpdGoAgentState.online ? 10000 : 3000)) {
        return xfpdGoAgentState.online;
    }
    if (xfpdGoAgentState.checkingPromise) {
        return await xfpdGoAgentState.checkingPromise;
    }

    xfpdGoAgentState.checkingPromise = (async () => {
        try {
            const fetchFn =
                (typeof fetch === 'function' && fetch) ||
                (typeof window !== 'undefined' && typeof window.fetch === 'function' && window.fetch.bind(window));
            if (!fetchFn) {
                xfpdGoAgentState = { online: false, checkedAt: Date.now(), rootDir: '', checkingPromise: null };
                return false;
            }
            const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
            const timer = ctrl ? setTimeout(() => ctrl.abort(), 2200) : null;
            const res = await fetchFn(`${XFPD_GO_AGENT_BASE}/api/v1/ping`, {
                method: 'GET',
                mode: 'cors',
                credentials: 'omit',
                ...(ctrl ? { signal: ctrl.signal } : {}),
            });
            if (timer) clearTimeout(timer);
            if (res && res.ok) {
                const j = await res.json();
                if (j && j.ok) {
                    xfpdGoAgentState = {
                        online: true,
                        nativeManager: !!j.nativeManager,
                        version: String(j.version || ''),
                        checkedAt: Date.now(),
                        rootDir: String(j.rootDir || ''),
                        lanes: Array.isArray(j.lanes) ? j.lanes : xfpdGoAgentState.lanes || [],
                        checkingPromise: null,
                    };
                    return true;
                }
            }
        } catch (e) {}
        xfpdGoAgentState = {
            online: false,
            nativeManager: false,
            version: '',
            checkedAt: Date.now(),
            rootDir: '',
            lanes: [],
            checkingPromise: null,
        };
        return false;
    })();

    return await xfpdGoAgentState.checkingPromise;
}

// ============================================================================
// NATIVE RUST DOWNLOAD MANAGER v3.0 — EVENT-DRIVEN WEBSOCKET & ZERO-TAB RPC
// ============================================================================
const xfpdNativeManagerListeners = new Set();
const xfpdNativeManagerLive = {
    wsConnected: false,
    speedMbps: 0,
    activeStreams: 0,
    queuedTasks: 0,
    saved: 0,
    deduped: 0,
    failed: 0,
    postStates: new Map(), // `${threadKey}::${postId}` -> { status, total, completed, succeeded, failed, deduped, postNumber }
    threadCrawl: null, // { threadKey, threadTitle, currentPage, endPage, statusText, done }
};
let xfpdNativeWsInstance = null;
let xfpdNativeWsReconnectTimer = null;

function xfpdGetNativeManagerLive() {
    return xfpdNativeManagerLive;
}

function xfpdOnNativeManagerEvent(cb) {
    if (typeof cb !== 'function') return () => {};
    xfpdNativeManagerListeners.add(cb);
    return () => xfpdNativeManagerListeners.delete(cb);
}

function xfpdNotifyNativeListeners(ev) {
    xfpdNativeManagerListeners.forEach(cb => {
        try { cb(ev, xfpdNativeManagerLive); } catch (e) {}
    });
}

async function xfpdCollectForumCookieHeader() {
    let docCookies = '';
    try { docCookies = String(document.cookie || ''); } catch (e) {}
    try {
        if (typeof GM_cookie !== 'undefined' && GM_cookie && typeof GM_cookie.list === 'function') {
            const gmList = await new Promise(resolve => {
                let settled = false;
                const timer = setTimeout(() => {
                    if (!settled) {
                        settled = true;
                        resolve(null);
                    }
                }, 800);
                try {
                    GM_cookie.list({ url: location.href }, (cookies, err) => {
                        if (settled) return;
                        settled = true;
                        clearTimeout(timer);
                        resolve(!err && Array.isArray(cookies) ? cookies : null);
                    });
                } catch (e) {
                    if (!settled) {
                        settled = true;
                        clearTimeout(timer);
                        resolve(null);
                    }
                }
            });
            if (gmList && gmList.length > 0) {
                return gmList.map(c => `${c.name}=${c.value}`).join('; ');
            }
        }
    } catch (e) {}
    return docCookies;
}

function xfpdEnsureNativeManagerWs() {
    if (typeof WebSocket !== 'function') return;
    if (
        xfpdNativeWsInstance &&
        (xfpdNativeWsInstance.readyState === WebSocket.OPEN || xfpdNativeWsInstance.readyState === WebSocket.CONNECTING)
    ) {
        return;
    }
    if (xfpdNativeWsReconnectTimer) {
        clearTimeout(xfpdNativeWsReconnectTimer);
        xfpdNativeWsReconnectTimer = null;
    }

    try {
        const wsUrl = `${XFPD_GO_AGENT_BASE.replace(/^http/i, 'ws')}/api/v3/ws`;
        const ws = new WebSocket(wsUrl);
        xfpdNativeWsInstance = ws;

        ws.onopen = async () => {
            xfpdNativeManagerLive.wsConnected = true;
            xfpdGoAgentState.online = true;
            xfpdGoAgentState.nativeManager = true;
            xfpdGoAgentState.checkedAt = Date.now();
            try {
                const cookies = await xfpdCollectForumCookieHeader();
                ws.send(
                    JSON.stringify({
                        cmd: 'sync_cookies',
                        domain: location.origin,
                        cookies,
                        userAgent: navigator.userAgent || '',
                        gofileToken: (settings && settings.hosts && settings.hosts.goFile && settings.hosts.goFile.token) || '',
                    }),
                );
            } catch (e) {}
            xfpdNotifyNativeListeners({ event: 'ws_open' });
        };

        ws.onmessage = ev => {
            try {
                const msg = JSON.parse(ev.data);
                if (!msg || !msg.event) return;
                if (msg.event === 'snapshot' || msg.event === 'stats_tick') {
                    xfpdGoAgentState.online = true;
                    xfpdGoAgentState.nativeManager = true;
                    xfpdGoAgentState.checkedAt = Date.now();
                    if (msg.root_dir) xfpdGoAgentState.rootDir = String(msg.root_dir);
                    if (Array.isArray(msg.lanes)) xfpdGoAgentState.lanes = msg.lanes;
                    xfpdNativeManagerLive.speedMbps = Number(msg.speed_mbps || 0);
                    xfpdNativeManagerLive.activeStreams = Number(msg.active_streams || 0);
                    xfpdNativeManagerLive.queuedTasks = Number(msg.queued_tasks || 0);
                    xfpdNativeManagerLive.saved = Number(msg.saved || 0);
                    xfpdNativeManagerLive.deduped = Number(msg.deduped || 0);
                    xfpdNativeManagerLive.failed = Number(msg.failed || 0);
                } else if (msg.event === 'post_summary' && msg.post_id) {
                    const pKey = `${msg.thread_key || ''}::${msg.post_id}`;
                    xfpdNativeManagerLive.postStates.set(pKey, {
                        threadKey: msg.thread_key || '',
                        postId: String(msg.post_id),
                        postNumber: String(msg.post_number || ''),
                        status: String(msg.status || 'downloading'),
                        total: Number(msg.total || 0),
                        completed: Number(msg.completed || 0),
                        succeeded: Number(msg.succeeded || 0),
                        failed: Number(msg.failed || 0),
                        deduped: Number(msg.deduped || 0),
                    });
                    if (
                        msg.status !== 'downloading' &&
                        typeof xfpdRecordThreadPostOutcome === 'function'
                    ) {
                        try {
                            xfpdRecordThreadPostOutcome(msg.thread_key, {
                                postId: String(msg.post_id),
                                postNumber: String(msg.post_number || ''),
                                status: msg.status,
                                total: Number(msg.total || 0),
                                succeeded: Number(msg.succeeded || 0),
                                failed: Number(msg.failed || 0),
                                deduped: Number(msg.deduped || 0),
                            });
                        } catch (e) {}
                    }
                } else if (msg.event === 'thread_crawl_progress') {
                    xfpdNativeManagerLive.threadCrawl = msg.done
                        ? null
                        : {
                              threadKey: msg.thread_key || '',
                              threadTitle: msg.thread_title || '',
                              currentPage: Number(msg.current_page || 1),
                              endPage: Number(msg.end_page || 1),
                              statusText: String(msg.status_text || ''),
                          };
                }
                xfpdNotifyNativeListeners(msg);
            } catch (e) {}
        };

        ws.onclose = () => {
            xfpdNativeManagerLive.wsConnected = false;
            xfpdNativeWsInstance = null;
            xfpdNotifyNativeListeners({ event: 'ws_close' });
            xfpdNativeWsReconnectTimer = setTimeout(() => {
                xfpdCheckGoAgentOnline(true).then(ok => {
                    if (ok && xfpdGoAgentState.nativeManager) xfpdEnsureNativeManagerWs();
                });
            }, 4000);
        };
    } catch (e) {}
}

async function xfpdEnqueueNativePostJobs(serializedJobs) {
    const fetchFn =
        (typeof fetch === 'function' && fetch) ||
        (typeof window !== 'undefined' && typeof window.fetch === 'function' && window.fetch.bind(window));
    if (!fetchFn || !Array.isArray(serializedJobs) || !serializedJobs.length) return false;

    xfpdEnsureNativeManagerWs();
    const cookies = await xfpdCollectForumCookieHeader();
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    const gfTok = (settings && settings.hosts && settings.hosts.goFile && settings.hosts.goFile.token) || '';

    let allOk = true;
    for (const job of serializedJobs) {
        const urls = [];
        for (const hObj of job.parsedHosts || []) {
            if (!hObj || !hObj.enabled || !Array.isArray(hObj.resources)) continue;
            for (const u of hObj.resources) {
                if (u && !urls.includes(u)) urls.push(u);
            }
        }
        const hintMap = {};
        if (job.hints && Array.isArray(job.hints.linkNames)) {
            for (const pair of job.hints.linkNames) {
                if (Array.isArray(pair) && pair[0] && pair[1]) hintMap[pair[0]] = pair[1];
            }
        }
        const ps = job.postSettings || {};
        const pKey = `${job.threadKey || ''}::${job.postId}`;
        xfpdNativeManagerLive.postStates.set(pKey, {
            threadKey: job.threadKey || '',
            postId: String(job.postId),
            postNumber: String(job.postNumber || ''),
            status: 'downloading',
            total: urls.length,
            completed: 0,
            succeeded: 0,
            failed: 0,
            deduped: 0,
        });

        try {
            const res = await fetchFn(`${XFPD_GO_AGENT_BASE}/api/v3/enqueue-post`, {
                method: 'POST',
                mode: 'cors',
                credentials: 'omit',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    threadKey: job.threadKey || '',
                    threadTitle: job.threadTitle || 'Thread',
                    pageUrl: job.pageUrl || location.href,
                    pageNumber: Number(job.pageNumber || 1),
                    postId: String(job.postId || ''),
                    postNumber: String(job.postNumber || '1'),
                    postCaption: String(job.postCaption || ''),
                    folderLayout: String(ps.folderLayout || 'media'),
                    extractArchives: ps.extractArchives !== false,
                    contentDedup: ps.contentDedup !== false,
                    autoUnlockReaction: ps.autoUnlockReaction !== false,
                    autoReactAfterDownload: ps.autoReactAfterDownload === true,
                    videoQuality: String(ps.videoQuality || 'source'),
                    spoilers: Array.isArray(job.spoilers) ? job.spoilers : [],
                    urls,
                    unlockReactUrls: Array.isArray(job.unlockReactUrls) ? job.unlockReactUrls : [],
                    completionReactUrl: job.completionReactUrl || null,
                    csrfToken: job.csrfToken || '',
                    forumCookies: cookies,
                    userAgent: ua,
                    linkNameHints: hintMap,
                    gofileToken: gfTok,
                }),
            });
            if (!res || !res.ok) allOk = false;
        } catch (e) {
            allOk = false;
        }
    }
    xfpdNotifyNativeListeners({ event: 'local_enqueued' });
    return allOk;
}

async function xfpdEnqueueNativeThreadCrawl(crawlJob) {
    const fetchFn =
        (typeof fetch === 'function' && fetch) ||
        (typeof window !== 'undefined' && typeof window.fetch === 'function' && window.fetch.bind(window));
    if (!fetchFn || !crawlJob) return false;

    xfpdEnsureNativeManagerWs();
    const cookies = await xfpdCollectForumCookieHeader();
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    const gfTok = (settings && settings.hosts && settings.hosts.goFile && settings.hosts.goFile.token) || '';
    const ps = crawlJob.postSettings || {};

    xfpdNativeManagerLive.threadCrawl = {
        threadKey: crawlJob.threadKey || '',
        threadTitle: crawlJob.threadTitle || 'Thread',
        currentPage: Number(crawlJob.startPage || 1),
        endPage: Number(crawlJob.endPage || 1),
        statusText: `Starting native crawl (${crawlJob.startPage}–${crawlJob.endPage})...`,
    };
    xfpdNotifyNativeListeners({ event: 'local_thread_enqueued' });

    try {
        const res = await fetchFn(`${XFPD_GO_AGENT_BASE}/api/v3/enqueue-thread`, {
            method: 'POST',
            mode: 'cors',
            credentials: 'omit',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                threadKey: crawlJob.threadKey || '',
                threadTitle: crawlJob.threadTitle || 'Thread',
                threadUrl: location.href,
                pages: Array.isArray(crawlJob.pages) ? crawlJob.pages : [],
                startPage: Number(crawlJob.startPage || 1),
                endPage: Number(crawlJob.endPage || 1),
                includeComments: ps.includeComments !== false,
                folderLayout: String(ps.folderLayout || 'media'),
                extractArchives: ps.extractArchives !== false,
                contentDedup: ps.contentDedup !== false,
                autoUnlockReaction: ps.autoUnlockReaction !== false,
                autoReactAfterDownload: ps.autoReactAfterDownload === true,
                videoQuality: String(ps.videoQuality || 'source'),
                csrfToken: crawlJob.csrfToken || '',
                forumCookies: cookies,
                userAgent: ua,
                gofileToken: gfTok,
            }),
        });
        return !!(res && res.ok);
    } catch (e) {
        return false;
    }
}

function xfpdCancelNativePostJob(postId, threadKey = '') {
    const pKey = `${threadKey || ''}::${postId}`;
    xfpdNativeManagerLive.postStates.delete(pKey);
    if (xfpdNativeWsInstance && xfpdNativeWsInstance.readyState === WebSocket.OPEN) {
        try {
            xfpdNativeWsInstance.send(JSON.stringify({ cmd: 'cancel_post', postId: String(postId) }));
        } catch (e) {}
    }
    xfpdNotifyNativeListeners({ event: 'local_cancelled' });
}

async function xfpdAgentWriteBlob(threadTitle, relFn, blob, useDedup = true) {
    await xfpdAcquireAgentSlot();
    try {
        const fetchFn =
            (typeof fetch === 'function' && fetch) ||
            (typeof window !== 'undefined' && typeof window.fetch === 'function' && window.fetch.bind(window));
        if (!fetchFn) return null;
        const qs = new URLSearchParams({
            thread: String(threadTitle || 'Thread'),
            relPath: String(relFn || 'file'),
            dedup: useDedup ? '1' : '0',
        }).toString();
        const res = await fetchFn(`${XFPD_GO_AGENT_BASE}/api/v1/write-blob?${qs}`, {
            method: 'POST',
            mode: 'cors',
            credentials: 'omit',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: blob,
        });
        if (!res || !res.ok) return null;
        const j = await res.json();
        if (j && j.ok) {
            xfpdGoAgentState.online = true;
            xfpdGoAgentState.checkedAt = Date.now();
            return j;
        }
        return null;
    } catch (e) {
        xfpdGoAgentState.online = false;
        xfpdGoAgentState.checkedAt = 0;
        return null;
    } finally {
        xfpdReleaseAgentSlot();
    }
}

function xfpdEnsureGoAgentPoller() {
    if (xfpdGoPollTimer) return;
    xfpdGoPollTimer = setInterval(async () => {
        if (xfpdGoPollInFlight || xfpdPendingGoJobs.size === 0) {
            if (xfpdPendingGoJobs.size === 0 && xfpdGoPollTimer) {
                clearInterval(xfpdGoPollTimer);
                xfpdGoPollTimer = null;
            }
            return;
        }
        xfpdGoPollInFlight = true;
        try {
            const fetchFn =
                (typeof fetch === 'function' && fetch) ||
                (typeof window !== 'undefined' && typeof window.fetch === 'function' && window.fetch.bind(window));
            if (!fetchFn) return;
            const ids = [...xfpdPendingGoJobs.keys()].slice(0, 250);
            const res = await fetchFn(`${XFPD_GO_AGENT_BASE}/api/v1/poll-jobs`, {
                method: 'POST',
                mode: 'cors',
                credentials: 'omit',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids }),
            });
            if (res && res.ok) {
                const j = await res.json();
                if (j && j.ok) {
                    xfpdGoAgentState.online = true;
                    xfpdGoAgentState.checkedAt = Date.now();
                    if (Array.isArray(j.lanes)) {
                        xfpdGoAgentState.lanes = j.lanes;
                    }
                    const comp = j.completed || {};
                    for (const [id, resultObj] of Object.entries(comp)) {
                        const waiter = xfpdPendingGoJobs.get(id);
                        if (waiter) {
                            xfpdPendingGoJobs.delete(id);
                            waiter.resolve(resultObj);
                        }
                    }
                }
            }
        } catch (e) {
            // If agent died mid-run, unblock all waiting promises so they fail/fallback cleanly
            for (const [id, waiter] of xfpdPendingGoJobs.entries()) {
                xfpdPendingGoJobs.delete(id);
                waiter.resolve(null);
            }
        } finally {
            xfpdGoPollInFlight = false;
        }
    }, 110);
}

async function xfpdAgentDownloadItem(reqPayload, abortSignal = null) {
    if (abortSignal && abortSignal.aborted) return null;
    const fetchFn =
        (typeof fetch === 'function' && fetch) ||
        (typeof window !== 'undefined' && typeof window.fetch === 'function' && window.fetch.bind(window));
    if (!fetchFn) return null;

    // 1) Non-blocking Go v2.0 Multi-Queue Submission (takes <0.5ms and releases Chrome socket immediately!)
    let submitRes = null;
    await xfpdAcquireAgentSlot();
    try {
        if (abortSignal && abortSignal.aborted) return null;
        const r = await fetchFn(`${XFPD_GO_AGENT_BASE}/api/v1/submit-item`, {
            method: 'POST',
            mode: 'cors',
            credentials: 'omit',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqPayload),
        });
        if (r && r.status === 404) {
            // Older v1.x Go agent fallback
            const rLegacy = await fetchFn(`${XFPD_GO_AGENT_BASE}/api/v1/download-item`, {
                method: 'POST',
                mode: 'cors',
                credentials: 'omit',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reqPayload),
                ...(abortSignal ? { signal: abortSignal } : {}),
            });
            return rLegacy && rLegacy.ok ? await rLegacy.json() : null;
        }
        if (r && r.ok) {
            submitRes = await r.json();
        }
    } catch (e) {
        return null;
    } finally {
        xfpdReleaseAgentSlot();
    }

    if (!submitRes || !submitRes.ok) return null;
    xfpdGoAgentState.online = true;
    xfpdGoAgentState.checkedAt = Date.now();

    if (submitRes.done) {
        return submitRes.result || { ok: true, status: 'dedup' };
    }

    const goJobId = submitRes.jobId;
    if (!goJobId) return null;

    return await new Promise(resolve => {
        const onAbort = () => {
            if (xfpdPendingGoJobs.delete(goJobId)) {
                fetchFn(`${XFPD_GO_AGENT_BASE}/api/v1/cancel-jobs`, {
                    method: 'POST',
                    mode: 'cors',
                    credentials: 'omit',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: [goJobId] }),
                }).catch(() => {});
                resolve({ ok: false, cancelled: true, reason: 'cancelled' });
            }
        };
        if (abortSignal) {
            if (abortSignal.aborted) {
                onAbort();
                return;
            }
            abortSignal.addEventListener('abort', onAbort, { once: true });
        }
        xfpdPendingGoJobs.set(goJobId, {
            resolve: resObj => {
                if (abortSignal) {
                    try { abortSignal.removeEventListener('abort', onAbort); } catch (e) {}
                }
                resolve(resObj);
            },
        });
        xfpdEnsureGoAgentPoller();
    });
}

function xfpdOpenFsHandlesDb() {
    return new Promise((resolve, reject) => {
        try {
            const idb =
                (typeof indexedDB !== 'undefined' && indexedDB) ||
                (typeof window !== 'undefined' && window.indexedDB);
            if (!idb) return resolve(null);
            const req = idb.open(XFPD_FS_IDB_NAME, 1);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(XFPD_FS_IDB_STORE)) {
                    db.createObjectStore(XFPD_FS_IDB_STORE);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        } catch (e) {
            resolve(null);
        }
    });
}

async function xfpdLoadDirectDirHandleFromIdb() {
    if (xfpdCachedRootDirHandle) return xfpdCachedRootDirHandle;
    try {
        const db = await xfpdOpenFsHandlesDb();
        if (!db) return null;
        const handle = await new Promise(resolve => {
            try {
                const tx = db.transaction(XFPD_FS_IDB_STORE, 'readonly');
                const getReq = tx.objectStore(XFPD_FS_IDB_STORE).get('root');
                getReq.onsuccess = () => resolve(getReq.result || null);
                getReq.onerror = () => resolve(null);
            } catch (e) {
                resolve(null);
            }
        });
        if (handle) xfpdCachedRootDirHandle = handle;
        return handle || null;
    } catch (e) {
        return null;
    }
}

async function xfpdSaveDirectDirHandleToIdb(handle) {
    xfpdCachedRootDirHandle = handle || null;
    xfpdSubDirHandleCache.clear();
    try {
        if (typeof localStorage !== 'undefined' && localStorage) {
            if (handle && handle.name) localStorage.setItem(XFPD_FS_FOLDER_LS_KEY, String(handle.name));
            else localStorage.removeItem(XFPD_FS_FOLDER_LS_KEY);
        }
    } catch (e) {}
    try {
        const db = await xfpdOpenFsHandlesDb();
        if (!db) return;
        await new Promise(resolve => {
            try {
                const tx = db.transaction(XFPD_FS_IDB_STORE, 'readwrite');
                const st = tx.objectStore(XFPD_FS_IDB_STORE);
                if (handle) st.put(handle, 'root');
                else st.delete('root');
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve();
            } catch (e) {
                resolve();
            }
        });
    } catch (e) {}
}

function xfpdGetDirectFolderLabel() {
    try {
        if (xfpdCachedRootDirHandle && xfpdCachedRootDirHandle.name) {
            return String(xfpdCachedRootDirHandle.name);
        }
        if (typeof localStorage !== 'undefined' && localStorage) {
            return String(localStorage.getItem(XFPD_FS_FOLDER_LS_KEY) || '');
        }
    } catch (e) {}
    return '';
}

function xfpdIsFileSystemAccessSupported() {
    return (
        (typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function') ||
        typeof showDirectoryPicker === 'function'
    );
}

async function xfpdPickDirectSaveDirectory() {
    const picker =
        (typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
            ? window.showDirectoryPicker.bind(window)
            : null) || (typeof showDirectoryPicker === 'function' ? showDirectoryPicker : null);
    if (!picker) {
        throw new Error('File System Access API is not enabled in this browser.');
    }
    const handle = await picker({ id: 'xfpd_direct_root', mode: 'readwrite' });
    if (handle) {
        await xfpdSaveDirectDirHandleToIdb(handle);
        return handle.name || 'Selected';
    }
    return '';
}

async function xfpdEnsureDirectFolderPermissionOnGesture() {
    try {
        const prefs = xfpdGetEffectivePrefs();
        if (prefs.saveMode === 'browser' || prefs.zipped) return false;
        if (prefs.saveMode === 'auto' && xfpdGoAgentState.online) return true;
        const handle = await xfpdLoadDirectDirHandleFromIdb();
        if (!handle || typeof handle.queryPermission !== 'function') return false;
        let perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm === 'granted') return true;
        if (perm === 'prompt' && typeof handle.requestPermission === 'function') {
            perm = await handle.requestPermission({ mode: 'readwrite' });
            return perm === 'granted';
        }
    } catch (e) {}
    return false;
}

async function xfpdWriteBlobToDirectFolder(saveAsPath, blob) {
    try {
        const rootHandle = await xfpdLoadDirectDirHandleFromIdb();
        if (!rootHandle || typeof rootHandle.getDirectoryHandle !== 'function') return false;
        if (typeof rootHandle.queryPermission === 'function') {
            const perm = await rootHandle.queryPermission({ mode: 'readwrite' });
            if (perm !== 'granted') return false;
        }

        const cleanSegs = String(saveAsPath || '')
            .replace(/\\/g, '/')
            .split('/')
            .map(s => s.trim())
            .filter(Boolean);
        if (!cleanSegs.length) return false;

        const fileName = cleanSegs.pop();
        let dirHandle = rootHandle;
        let pathKey = '';

        for (const seg of cleanSegs) {
            pathKey = pathKey ? `${pathKey}/${seg}` : seg;
            if (xfpdSubDirHandleCache.has(pathKey)) {
                dirHandle = xfpdSubDirHandleCache.get(pathKey);
            } else {
                dirHandle = await dirHandle.getDirectoryHandle(seg, { create: true });
                xfpdSubDirHandleCache.set(pathKey, dirHandle);
                if (xfpdSubDirHandleCache.size > 300) {
                    const firstK = xfpdSubDirHandleCache.keys().next().value;
                    if (firstK !== undefined) xfpdSubDirHandleCache.delete(firstK);
                }
            }
        }

        const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
    } catch (e) {
        xfpdSubDirHandleCache.clear();
        return false;
    }
}

async function xfpdSaveBlobUnified({ blob, threadTitle, relFn, saveAsName, saveMode = 'auto', useDedup = true }) {
    const mode = XFPD_VALID_SAVE_MODES.includes(saveMode) ? saveMode : 'auto';

    // 1) Option 2: Native Go Companion Agent (127.0.0.1:48721)
    if (mode === 'auto' || mode === 'agent') {
        const agentOnline = await xfpdCheckGoAgentOnline(false);
        if (agentOnline) {
            const agentRes = await xfpdAgentWriteBlob(threadTitle, relFn, blob, useDedup);
            if (agentRes && agentRes.ok) {
                return { via: 'agent', status: agentRes.status || 'saved', fingerprint: agentRes.fingerprint || '' };
            }
        }
    }

    // 2) Option 1: Browser Native File System Access API (Direct Folder Handle)
    if (mode === 'auto' || mode === 'folder' || mode === 'agent') {
        const cleanThread = String(threadTitle || 'Thread').trim();
        const fullRel = `${cleanThread}/${String(relFn || 'file').replace(/^\/+/, '')}`;
        const wroteDirect = await xfpdWriteBlobToDirectFolder(fullRel, blob);
        if (wroteDirect) {
            return { via: 'folder', status: 'saved', fingerprint: '' };
        }
    }

    // 3) Fallback: Classic Browser Download Manager (GM_download)
    await new Promise(resolveSave => {
        const bUrl = URL.createObjectURL(blob);
        let settled = false;
        const done = () => {
            if (settled) return;
            settled = true;
            setTimeout(() => {
                try { URL.revokeObjectURL(bUrl); } catch (e) {}
            }, 1000);
            resolveSave();
        };
        const safetyTimer = setTimeout(done, 15000);
        try {
            GM_download({
                url: bUrl,
                name: saveAsName,
                onload: () => {
                    clearTimeout(safetyTimer);
                    done();
                },
                onerror: () => {
                    clearTimeout(safetyTimer);
                    done();
                },
                ontimeout: () => {
                    clearTimeout(safetyTimer);
                    done();
                },
            });
        } catch (e) {
            clearTimeout(safetyTimer);
            done();
        }
    });
    return { via: 'browser', status: 'saved', fingerprint: '' };
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
