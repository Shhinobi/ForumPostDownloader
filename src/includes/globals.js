// --- tab handle helper (Tampermonkey can return either a Tab object or a Promise<Tab>) ---
function xfpdCloseTabHandle(tabOrPromise) {
    try {
        if (!tabOrPromise) return;
        // Promise-like (e.g., some GM implementations return Promise<Tab>)
        if (typeof tabOrPromise.then === 'function') {
            try {
                tabOrPromise.then(t => {
                    try { if (t && typeof t.close === 'function') t.close(); } catch (e) {}
                }).catch(() => {});
            } catch (e) {}
            return;
        }
        // Direct tab handle
        if (typeof tabOrPromise.close === 'function') {
            try { tabOrPromise.close(); } catch (e) {}
        }
    } catch (e) {}
}
// ---------------------------------------------------------------------------
const JSZip =
    (typeof window !== 'undefined' && window.JSZip) ||
    (typeof globalThis !== 'undefined' && globalThis.JSZip);
const tippy =
    (typeof window !== 'undefined' && window.tippy) ||
    (typeof globalThis !== 'undefined' && globalThis.tippy);
const http =
    (typeof GM_xmlhttpRequest === 'function' && GM_xmlhttpRequest) ||
    (typeof window !== 'undefined' && window.GM_xmlhttpRequest) ||
    (typeof GM === 'object' && GM && typeof GM.xmlHttpRequest === 'function' && GM.xmlHttpRequest.bind(GM));
window.isFF = typeof InstallTrigger !== 'undefined';
window.logs = [];

// Script version, logged once per post run so a pasted log identifies its own build. Test reports
// were previously ambiguous about which version produced them, which is a bad way to lose an
// afternoon. GM_info needs no @grant in either manager, but read it defensively through the same
// fallback shape used elsewhere -- a missing value here must never break a download.
const xfpdVersion = (() => {
    try {
        const info =
            (typeof GM_info !== 'undefined' && GM_info) ||
            (typeof window !== 'undefined' && window.GM_info) ||
            (typeof GM === 'object' && GM && GM.info) ||
            null;
        const v = info && info.script && info.script.version;
        return v ? String(v) : 'unknown';
    } catch (e) {
        return 'unknown';
    }
})();
