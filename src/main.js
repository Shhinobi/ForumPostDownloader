// Holds the posts that are processing downloads.
let processing = [];

/**
 * An array of arrays defining how to match hosts inside the posts.
 *
 * The first item in the array is the signature.
 * The second item is an array of matchers.
 *
 * A matcher is a regular expression matching a substring inside the post.
 *
 * The first matcher matches a single resource (e.g. an image or a video).
 * The second matcher matches a folder or an album (e.g. a set of related images)
 *
 * [0: signature(name+category), 1: [single_regex, album_regex]]
 *
 * When applied, every matcher is prefixed with https?:\/\/(www.)?
 *
 * Every matcher is matched against the following attributes:
 *
 * href, src, data-url
 *
 * You must not include the pattern to match attributes.
 * They are automatically handled when a matcher is run.
 *
 * For a completely custom pattern, put !! (two excl. characters) anywhere in it:
 *
 * [/!!https:\/\/cyberfile.su\/\w+(?=")/, /cyberfile.su\/folder\//]
 *
 * @signature string The name and categories of the host, separated by a colon.
 * @matchers array The name and categories of the host, separated by a colon.
 *
 * Matchers can include the following options anywhere
 * (preferably where it doesn't break the pattern) within a pattern.
 *
 * @option <no_qs> Removes query string
 * @option <keep_ts> Keeps the trailing slash
 *
 * The following placeholders can be used inside any matcher pattern:
 *
 * @placeholder ~an@ -> a-zA-Z0-9
 *
 */
const isSmgForum = () => {
    try {
        return typeof location !== 'undefined' && /(^|\.)socialmediagirls\.com$/i.test(location.hostname || '');
    } catch (e) {
        return false;
    }
};

const hosts = [
    [`${isSmgForum() ? 'SMG' : 'Simpcity'}:Attachments`, [/(\/attachments\/|\/data\/video\/|smgmedia\.socialmediagirls\.com\/)/]],
    [
        'ImagePond:Media',
        [
            /(?:(?:www\.)?(?:imagepond\.net|images\.socialmediagirls\.com)\/(?:i|image|video|videos)\/[~an@._-]+|media\.imagepond\.net\/media\/(?!.*(?:_thumb\.|\.m3u8|android-chrome|placeholder)))/,
            /(?:www\.)?(?:imagepond\.net|images\.socialmediagirls\.com)\/(?:a|album)\/[~an@._-]+<no_qs>/,
        ],
    ],
    ['Coomer:Profiles', [/coomer\.(st|su|party)\/[~an@._-]+\/user/]],
    ['Coomer:image', [/(\w+\.)?coomer\.(st|su|party)\/(data|thumbnail)/]],
    ['JPGX:image', [/(simp\d+\.)?(cuckcapital\.cr|jpg\d?\.(church|fish|fishing|pet|su|cr))\/(?!(img\/|a\/|album\/))/, /jpe?g\d\.(church|fish|fishing|pet|su|cr)(\/a\/|\/album\/)[~an@-_.]+<no_qs>/]],
    [
        'PutMega:image',
        [
            /(?:(?:[\w-]+\.)?putmega\.com\/images\/|(?:www\.)?(?:putmega\.com|putme\.ga)\/image\/[~an@._-]+)/,
            /(?:www\.)?(?:putmega\.com|putme\.ga)\/(?:a|album)\/[~an@._-]+<no_qs>/,
        ],
    ],
    ['Goonbox:image', [/goonbox\.cr\/img\//, /goonbox\.cr\/a\//]],
    ['kemono:direct link', [/.{2,6}\.kemono\.(cr|su|party)\/data\//]],
    ['Postimg:image', [/!!https?:\/\/(www.)?i\.?(postimg|pixxxels).cc\/(.{8})/]], //[/!!https?:\/\/(www.)?postimg.cc\/(.{8})/]],
    ['Ibb:image',
     [
         /!!(?<=href=")https?:\/\/(www.)?([a-z](\d+)?\.)?ibb\.co\/([a-zA-Z0-9_.-]){7}((?=")|\/)(([a-zA-Z0-9_.-])+(?="))?/,
         /ibb.co\/album\/[~an@_.-]+/,
     ],
    ],
    ['Ibb:direct link', [/!!(?<=data-src=")https?:\/\/(www.)?([a-z](\d+)?\.)?ibb\.co\/([a-zA-Z0-9_.-]){7}((?=")|\/)(([a-zA-Z0-9_.-])+(?="))?/]],
    ['Imagevenue:image', [/!!https?:\/\/(www.)?imagevenue\.com\/(.{8})/]],
    ['Imgvb:image', [/imgvb.com\/images\//, /imgvb.com\/album/]],
    ['Imgbox:image', [/(thumbs|images)(\d+)?.imgbox.com\//, /imgbox.com\/g\//]],
    ['Onlyfans:image', [/public.onlyfans.com\/files/]],
    ['Reddit:image', [/(\w+)?.redd.it/]],
    ['Pomf2:File', [/pomf2.lain.la/]],
    ['Nitter:image', [/nitter\.(.{1,20})\/pic/]],
    ['Twitter:image', [/([~an@.]+)?twimg.com\//]],
    [
        'Pixhost:image',
        [
            /(?:(t|img)(\d+)?\.(?:pixhost\.(?:to|cc)|pixho\.st)\/|(?:pixhost\.(?:to|cc)|pixho\.st)\/show\/)/,
            /(?:pixhost\.(?:to|cc)|pixho\.st)\/gallery\//,
        ],
    ],
    ['Erome:Albums', [/erome\.com\/a\/[~an@._-]+<no_qs>/]],
    ['Imagebam:image', [/imagebam.com\/(view|gallery)/]],
    ['Imagebam:full embed', [/images\d.imagebam.com/]],
    ['turbo:video', [/([\w-]+\.)?turbo\.cr\/(embed|v|d)\//]],
    ['turbo:albums', [/([\w-]+\.)?turbo\.cr\/a\//]],
    ['Redgifs:video', [/!!redgifs.com(\/|\\\/)ifr.*?(?=["']|&quot;)/]],
    ['Redgifs:user', [/redgifs\.com\/users\//]],
    ['Bunkr:',
     [
         /!!(?<=href=")https:\/\/((stream|cdn(\d+)?)\.)?bunkrr?r?\.(lu|lv|bi|cm|at|by|cx|sx|ac|ax|black|cat|ci|cr|fi|is|media|nu|pk|ph|ps|red|ru|se|si|site|sk|ws|ru|su|org)(?!(\/a\/)).*?(?=")|(?<=(href=")|(src="))https:\/\/((i|cdn|i-pizza|big-taco-1img)(\d+)?\.)?bunkrr?r?\.(lu|lv|bi|cm|at|by|cx|sx|ac|ax|black|cat|ci|cr|fi|is|media|nu|pk|ph|ps|red|ru|se|si|site|sk|ws|ru|su|org)(?!(\/a\/))\/(v\/)?.*?(?=")/,
     ]
    ],
    ['Bunkr:Albums', [/bunkrr?r?\.(lu|lv|bi|cm|at|by|cx|sx|ac|ax|black|cat|ci|cr|fi|is|media|nu|pk|ph|ps|red|ru|se|si|site|sk|ws|ru|su|org)\/a\//]],
    ['Give.xxx:Profiles', [/give.xxx\/[~an@_-]+/]],
    ['Pixeldrain:', [/(focus\.)?(?:pixeldrain\.com|pixeldrain\.net|pixeldra\.in)\/[lu]\//]],
    ['Gofile:', [/gofile.io\/d/]],
    ['Filester:links', [/filester\.(me|sh|si|gg)\/d\//]],
    ['Filester:albums', [/filester\.(me|sh|si|gg)\/f\/[~an@-_.]+<no_qs>/]],
    ['Box.com:', [/m\.box\.com\//]],
    ['Yandex:', [/(disk\.)?yandex\.[a-z]+/]],
    ['Cyberfile:', [/!!https:\/\/cyberfile.(su|me)\/\w+(\/)?(?=")/, /cyberfile.(su|me)\/folder\//]],
    ['Cyberdrop:', [/fs-\d+\.cyberdrop\.[a-z]{2,}\/|cyberdrop\.[a-z]{2,}\/(f|e)\//, /cyberdrop\.[a-z]{2,}\/a\//]],
    ['Pornhub:video', [/([~an@]+\.)?pornhub.com\/view_video/]],
    ['Noodlemagazine:video', [/(adult.)?noodlemagazine.com\/watch\//]],
    ['Spankbang:video', [/spankbang.com\/.*?\/video/]],
];

/**
 * An array of url resolvers.
 *
 * @type {((RegExp[]|(function(*): *))[]|(RegExp[]|(function(*, *): Promise<{dom: *, source: *, folderName: *, resolved}>))[]|(RegExp[]|(function(*, *): Promise<string>))[]|(RegExp[]|(function(*, *): Promise<{dom: *, source: *, folderName: *, resolved}>))[]|(RegExp[]|(function(*): *))[])[]}
 */
/* -------------------------------------------------------------------------
 * Turbo sign hardening:
 * - timeout 5000ms
 * - retry 2x with jitter delay 700–1400ms
 * This avoids rare ~50s "waiting" stalls on https://turbo.cr/api/sign
 * ------------------------------------------------------------------------- */
const XFPD_TURBO_SIGN_TIMEOUT_MS = 5000;
const XFPD_TURBO_SIGN_RETRIES = 2;
const XFPD_TURBO_SIGN_JITTER_MIN_MS = 700;
const XFPD_TURBO_SIGN_JITTER_MAX_MS = 1400;

const xfpdSleepMs = ms => new Promise(r => setTimeout(r, ms));
const xfpdJitterMs = (minMs, maxMs) => {
    const lo = Math.min(minMs, maxMs);
    const hi = Math.max(minMs, maxMs);
    return lo + Math.floor(Math.random() * (hi - lo + 1));
};

const xfpdGmGetText = (getUrl, headers, timeoutMs) => new Promise(resolve => {
    try {
        GM_xmlhttpRequest({
            method: 'GET',
            url: String(getUrl),
            headers: headers || {},
            responseType: 'text',
            anonymous: false,
            timeout: Number(timeoutMs) || 0,
            onload: r => resolve({ ok: true, status: r.status || 0, text: String(r.responseText || r.response || '') }),
            onerror: () => resolve({ ok: false, status: 0, text: '' }),
            ontimeout: () => resolve({ ok: false, status: 0, text: '' }),
        });
    } catch (e) {
        resolve({ ok: false, status: 0, text: '' });
    }
});

const xfpdTurboFetchSignJsonWithTimeout = async (turboId, refererUrl) => {
    const id = String(turboId || '').trim();
    if (!id) return null;

    const embedUrl = String(refererUrl || `https://turbo.cr/embed/${id}`);
    const headers = {
        Accept: 'application/json, text/plain, */*',
        Referer: embedUrl,
    };

    const signUrls = [
        `https://turbo.cr/api/sign?v=${encodeURIComponent(id)}`,
        `https://turbo.cr/sign?v=${encodeURIComponent(id)}`, // legacy fallback
    ];

    for (let attempt = 0; attempt <= XFPD_TURBO_SIGN_RETRIES; attempt++) {
        for (const signUrl of signUrls) {
            const r = await xfpdGmGetText(signUrl, headers, XFPD_TURBO_SIGN_TIMEOUT_MS);
            if (!r || !r.ok || r.status !== 200 || !r.text) continue;

            let j = null;
            try { j = JSON.parse(r.text); } catch (e) { j = null; }
            if (!j || !j.url) continue;

            const ok = (j.success === undefined) ? true : !!j.success;
            if (ok) return j;
        }
        if (attempt < XFPD_TURBO_SIGN_RETRIES) {
            await xfpdSleepMs(xfpdJitterMs(XFPD_TURBO_SIGN_JITTER_MIN_MS, XFPD_TURBO_SIGN_JITTER_MAX_MS));
        }
    }
    return null;
};

const xfpdTurboSignUrlWithTimeout = async (turboId, refererUrl, nameHint) => {
    const j = await xfpdTurboFetchSignJsonWithTimeout(turboId, refererUrl);
    if (!j || !j.url) return null;

    let signed = j.url;
    const originalName = j.original_filename || nameHint;

    // Preserve filename for Turbo CDN downloads (used later for saveAs)
    if (signed && originalName && !/[?&]fn=/.test(String(signed))) {
        const enc = encodeURIComponent(String(originalName)).replace(/%20/g, '+');
        signed += (signed.includes('?') ? '&' : '?') + 'fn=' + enc;
    }
    return signed;
};

const xfpdNormalizeImagePondPageUrl = rawUrl => {
    let u = String(rawUrl || '').trim().split('#')[0];
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = `https://${u.replace(/^\/+/, '')}`;
    u = u.replace(/^https?:\/\/(?:www\.)?images\.socialmediagirls\.com\b/i, 'https://www.imagepond.net');
    u = u.replace(/^https?:\/\/imagepond\.net\b/i, 'https://www.imagepond.net');

    // Normalize /i/<id>/thumb/<size>, /i/<id>/embed, /i/<id>/download(/file), and /videos?/<id> -> /i/<id>
    u = u.replace(/\/i\/([^\/?#]+)\/(?:thumb\/\d+|embed|download(?:\/file)?).*$/i, '/i/$1');
    u = u.replace(/\/videos?\/([^\/?#]+).*$/i, '/i/$1');
    return u.split('?')[0].replace(/\/+$/, '');
};

const xfpdResolveImagePondItem = async (rawUrl, http, fallbackNameHint = '') => {
    try {
        const cleanRaw = String(rawUrl || '').trim().split('#')[0];
        if (!cleanRaw) return null;

        if (/^https?:\/\/media\.imagepond\.net\/media\//i.test(cleanRaw)) {
            if (/(?:_thumb\.|\.m3u8(?:$|\?)|android-chrome|placeholder)/i.test(cleanRaw)) return null;
            if (fallbackNameHint) {
                try { imagepondNameByUrl.set(cleanRaw, String(fallbackNameHint)); } catch (e) {}
            }
            return cleanRaw;
        }

        const viewUrl = xfpdNormalizeImagePondPageUrl(cleanRaw);
        if (!viewUrl) return null;

        const strip = s => String(s || '').split('#')[0].split('?')[0].replace(/\/+$/, '');
        const preHintedDirect =
            imagepondDirectByPageUrl.get(viewUrl) ||
            imagepondDirectByPageUrl.get(strip(cleanRaw)) ||
            null;
        if (preHintedDirect) {
            const nameHint =
                fallbackNameHint ||
                imagepondNameByUrl.get(viewUrl) ||
                imagepondNameByUrl.get(strip(cleanRaw)) ||
                '';
            if (nameHint) {
                try { imagepondNameByUrl.set(preHintedDirect, String(nameHint)); } catch (e) {}
            }
            return preHintedDirect;
        }

        const res = await http.get(
            viewUrl,
            {},
            {
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                Referer: 'https://forums.socialmediagirls.com/',
            },
            'text',
        );
        const src = String(res?.source || '');
        if (!src) return null;

        const doc = new DOMParser().parseFromString(src, 'text/html');

        let titleHint =
            doc.querySelector('[data-title]')?.getAttribute('data-title') ||
            doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
            doc.querySelector('h1[title]')?.getAttribute('title') ||
            fallbackNameHint ||
            '';
        titleHint = String(titleHint || '').replace(/\s*-\s*ImagePond\s*$/i, '').trim();

        const ogType = (doc.querySelector('meta[property="og:type"]')?.getAttribute('content') || '').toLowerCase();

        // 1) Video direct URL (<video data-src="...">, <source src="...">, og:video, or inline directUrl)
        let mediaUrl =
            doc.querySelector('video[data-src]')?.getAttribute('data-src') ||
            [...doc.querySelectorAll('video source[src]')]
                .map(s => s.getAttribute('src'))
                .find(s => s && !/\.m3u8(?:$|\?)/i.test(s)) ||
            doc.querySelector('meta[property="og:video"]')?.getAttribute('content') ||
            '';

        // 2) Inline JS imageUrl / directUrl
        if (!mediaUrl) {
            const mJs =
                /(?:directUrl|imageUrl)\s*[:=]\s*["'](https?:\\?\/\\?\/media\.imagepond\.net\\?\/media\\?\/[^"']+)["']/i.exec(src);
            if (mJs && mJs[1]) {
                const candidate = mJs[1].replace(/\\\//g, '/');
                if (!/(?:_thumb\.|\.m3u8(?:$|\?))/i.test(candidate)) {
                    mediaUrl = candidate;
                }
            }
        }

        // 3) og:image (for image items, never video _thumb.jpg)
        if (!mediaUrl && !ogType.startsWith('video')) {
            const ogImg = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
            if (/^https?:\/\/media\.imagepond\.net\/media\//i.test(ogImg) && !/(?:_thumb\.|\/thumb\/)/i.test(ogImg)) {
                mediaUrl = ogImg;
            }
        }

        // 4) Archive / fallback direct download route (/i/<realId>/download/file)
        if (!mediaUrl) {
            const pageUrlAttr = doc.querySelector('[data-page-url]')?.getAttribute('data-page-url') || '';
            const dlHref = doc.querySelector('a[href*="/download"]')?.getAttribute('href') || '';
            const mId = /\/i\/([^\/?#]+)/i.exec(pageUrlAttr) || /\/i\/([^\/?#]+)\/download/i.exec(dlHref) || /\/i\/([^\/?#]+)/i.exec(viewUrl);
            if (mId && mId[1]) {
                mediaUrl = `https://www.imagepond.net/i/${mId[1]}/download/file`;
            }
        }

        mediaUrl = String(mediaUrl || '').trim();
        if (!mediaUrl) return null;

        if (titleHint && !xfpdLooksLikeCfFilenameHint(titleHint)) {
            try {
                imagepondNameByUrl.set(mediaUrl, titleHint);
                imagepondNameByUrl.set(strip(mediaUrl), titleHint);
                imagepondNameByUrl.set(viewUrl, titleHint);
                imagepondNameByUrl.set(strip(cleanRaw), titleHint);
            } catch (e) {}
        }

        return mediaUrl;
    } catch (e) {
        return null;
    }
};

const xfpdResolveImagePondAlbum = async (rawUrl, http, progressCB) => {
    try {
        let baseUrl = String(rawUrl || '').trim().split('#')[0].split('?')[0].replace(/\/+$/, '');
        if (!baseUrl) return null;
        if (!/^https?:\/\//i.test(baseUrl)) baseUrl = `https://${baseUrl.replace(/^\/+/, '')}`;
        baseUrl = baseUrl
            .replace(/^https?:\/\/(?:www\.)?images\.socialmediagirls\.com\b/i, 'https://www.imagepond.net')
            .replace(/^https?:\/\/imagepond\.net\b/i, 'https://www.imagepond.net');

        const albumId = baseUrl.split('/').filter(Boolean).pop() || 'album';
        let folderName = '';
        let firstDom = null;
        let firstSource = '';

        const itemEntries = [];
        const seenSlugs = new Set();
        const MAX_PAGES = 200;

        for (let page = 1; page <= MAX_PAGES; page++) {
            const pageUrl = page === 1 ? baseUrl : `${baseUrl}?page=${page}`;
            if (typeof progressCB === 'function') {
                progressCB(`[ImagePond] Resolving album page ${page}...`);
            }

            let src = '';
            try {
                const r = await http.get(
                    pageUrl,
                    {},
                    {
                        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        Referer: 'https://forums.socialmediagirls.com/',
                    },
                    'text',
                );
                src = String(r?.source || '');
            } catch (e) {
                break;
            }
            if (!src) break;

            const doc = new DOMParser().parseFromString(src, 'text/html');
            if (page === 1) {
                firstDom = doc;
                firstSource = src;
                const rawTitle =
                    doc.querySelector('.ip-block-album-header h1, h1')?.textContent?.trim() ||
                    (doc.querySelector('title')?.textContent || '').replace(/\s*-\s*ImagePond\s*$/i, '').trim();
                folderName = rawTitle || `imagepond_${albumId}`;
            }

            const beforeCount = seenSlugs.size;

            // ImagePond album tiles use Alpine `:href="manageMode ? ... : 'https://www.imagepond.net/i/<id>'"` as well as plain hrefs.
            doc.querySelectorAll('.dr-tile, .ip-block-gallery a').forEach(node => {
                const anchor = node.tagName === 'A' ? node : node.querySelector('a');
                if (!anchor) return;
                const attrHref =
                    anchor.getAttribute('href') ||
                    anchor.getAttribute(':href') ||
                    anchor.getAttribute('x-bind:href') ||
                    '';
                const m = /(?:imagepond\.net|images\.socialmediagirls\.com)\/i\/([A-Za-z0-9_-]+)/i.exec(attrHref) ||
                          /^\/i\/([A-Za-z0-9_-]+)$/i.exec(attrHref.trim());
                if (!m || !m[1]) return;
                const slug = m[1];
                if (seenSlugs.has(slug)) return;
                seenSlugs.add(slug);

                const tileName = (node.querySelector?.('p')?.textContent || '').trim();
                itemEntries.push({
                    url: `https://www.imagepond.net/i/${slug}`,
                    nameHint: tileName,
                });
            });

            // Regex fallback if markup changes
            const rx = /https?:\/\/(?:www\.)?(?:imagepond\.net|images\.socialmediagirls\.com)\/i\/([A-Za-z0-9_-]+)(?=['"\s<>?#]|$)/gi;
            let mRx;
            while ((mRx = rx.exec(src)) !== null) {
                const slug = mRx[1];
                if (!slug || seenSlugs.has(slug)) continue;
                seenSlugs.add(slug);
                itemEntries.push({ url: `https://www.imagepond.net/i/${slug}`, nameHint: '' });
            }

            const added = seenSlugs.size - beforeCount;
            if (added <= 0) break;

            const hasNextPage =
                !!doc.querySelector(`a[rel="next"], a[href*="page=${page + 1}"]`) ||
                new RegExp(`[?&]page=${page + 1}\\b`, 'i').test(src);
            if (!hasNextPage) break;
        }

        if (!itemEntries.length) return null;

        const CONCURRENCY = 5;
        const results = new Array(itemEntries.length);
        let cursor = 0;

        const workers = Array.from({ length: Math.min(CONCURRENCY, itemEntries.length) }, async () => {
            while (true) {
                const idx = cursor++;
                if (idx >= itemEntries.length) break;
                if (typeof progressCB === 'function') {
                    progressCB(`[ImagePond] Resolving ${idx + 1}/${itemEntries.length}`);
                }
                const entry = itemEntries[idx];
                results[idx] = await xfpdResolveImagePondItem(entry.url, http, entry.nameHint);
            }
        });
        await Promise.all(workers);

        const resolved = results.filter(Boolean);
        return {
            dom: firstDom,
            source: firstSource,
            folderName: folderName || `imagepond_${albumId}`,
            resolved,
        };
    } catch (e) {
        return null;
    }
};

const resolvers = [
    [
        [/https?:\/\/nitter\.(.{1,20})\/pic\/(orig\/)?media%2F(.{1,15})/i],
        url => url.replace(/https?:\/\/nitter\.(.{1,20})\/pic\/(orig\/)?media%2F(.{1,15})/i, 'https://pbs.twimg.com/media/$3'),
    ],
    [
        [/imagevenue.com/],
        async (url, http) => {
            const { dom } = await http.get(url);
            return dom.querySelector('.col-md-12 > a > img').getAttribute('src');
        },
    ],
    [[/pomf2.lain.la/], url => url.replace(/pomf2.lain.la\/f\/(.*)\.(\w{3,4})(\?.*)?/, 'pomf2.lain.la/f/$1.$2')],
    [
        [
            /(?:imagepond\.net|images\.socialmediagirls\.com)\/(?:i|image|video|videos)\/|media\.imagepond\.net\/media\//i,
            /:!(?:imagepond\.net|images\.socialmediagirls\.com)\/(?:a|album)\//i,
        ],
        async (url, http) => {
            return await xfpdResolveImagePondItem(url, http);
        },
    ],
    [
        [/(?:imagepond\.net|images\.socialmediagirls\.com)\/(?:a|album)\//i],
        async (url, http, _spoilers, _postId, _postSettings, progressCB) => {
            return await xfpdResolveImagePondAlbum(url, http, progressCB);
        },
    ],
    [[/coomer\.(st|su|party)\/(data|thumbnail)/i], url => String(url || '').replace(/coomer\.(su|party)/i, 'coomer.st')],
    [
        [/coomer\.(st|su|party)/i, /:!coomer\.(st|su|party)\/(data|thumbnail)/i],
        async (url, http) => {
            const host = `https://coomer.st`;

            const normalizedInput = String(url || '').replace(/https?:\/\/(?:www\.)?coomer\.(?:st|su|party)/i, host);
            const profileId = normalizedInput.replace(/\?.*/, '').split('/').reverse()[0];

            let finalURL = normalizedInput.replace(/\?.*/, '');

            let nextPage = null;

            const posts = [];

            console.log(`[coomer.st] Resolving profile: ${profileId}`);

            let page = 1;

            do {
                const { dom } = await http.get(finalURL);

                const links = [...dom.querySelectorAll('.card-list__items > article')]
                .map(a => a.querySelector('.post-card__heading > a'))
                .map(a => {
                    return {
                        link: `${host}${a.getAttribute('href')}`,
                        id: a.getAttribute('href').split('/').reverse()[0],
                    };
                });

                posts.push(...links);
                nextPage = dom.querySelector('a[title="Next page"]');

                if (nextPage) {
                    finalURL = `${host}${nextPage.getAttribute('href')}`;
                }

                console.log(`[coomer.st] Resolved page: ${page}`);

                page++;
            } while (nextPage);

            const resolved = [];

            let index = 1;

            for (const post of posts) {
                const { dom } = await http.get(post.link);
                const filesContainer = dom.querySelector('.post__files');

                if (filesContainer) {
                    const images = filesContainer.querySelectorAll('.post__thumbnail > .fileThumb');

                    if (images.length) {
                        resolved.push(
                            ...[...images].map(a => {
                                return {
                                    url: `${host}${a.getAttribute('href')}`,
                                    folderName: post.id,
                                };
                            }),
                        );
                    }
                }

                const attachments = dom.querySelectorAll('.post__attachments > .post__attachment > .post__attachment-link');

                if (attachments.length) {
                    resolved.push(
                        ...[...attachments].map(a => {
                            const url = `${host}${a.getAttribute('href')}`;

                            let folder = 'Images';

                            const ext = h.ext(url.replace(/\?.*/, ''));

                            if (settings.extensions.video.includes(`.${ext.toLowerCase()}`)) {
                                folder = 'Videos';
                            }

                            {
                                return {
                                    url,
                                    folderName: `${post.id}/${folder}`,
                                };
                            }
                        }),
                    );
                }

                console.log(`[coomer.st] Resolved post ${index} / ${posts.length}`);

                index++;
            }

            return {
                folderName: profileId,
                resolved,
            };
        },
    ],
    [
        [/(postimg|pixxxels).cc/],
        async (url, http) => {
            url = url.replace(/https?:\/\/(www.)?i\.?(postimg|pixxxels).cc\/(.{8})(.*)/, 'https://postimg.cc/$3');
            const { dom } = await http.get(url);
            return dom.querySelector('.controls > nobr > a').getAttribute('href');
        },
    ],
    [[/kemono\.(cr|su|party)\/data/i], url => String(url || '').replace(/kemono\.(su|party)/i, 'kemono.cr')],
    [
        [/goonbox\.cr\/img\//],
        async (url, http, spoilers, postId) => {
            const id = url.split('/').pop().split('?')[0];
            const fallback = goonboxThumbByUrl.get(url.replace(/\?.*/, '').replace(/\/$/, '')) || null;

            // Direct request first, same-origin bridge tab only if Cloudflare rejects it -- see
            // goonboxApiJson.
            const data = await goonboxApiJson(http, `/api/images/${id}`, url, postId);

            // Take the first original_url anywhere in the response rather than pinning to
            // data.image.original_url. That pin yields undefined the moment Goonbox moves the
            // field, and the only symptom is a silently lower-resolution file -- observed
            // 2026-08-06, where the album endpoint (images[].original_url) returned full-res
            // originals for the very same images this path was quietly downgrading.
            const findOriginal = (obj, depth = 0) => {
                if (!obj || typeof obj !== 'object' || depth > 6) return null;
                if (Array.isArray(obj)) {
                    for (const it of obj) {
                        const v = findOriginal(it, depth + 1);
                        if (v) return v;
                    }
                    return null;
                }
                for (const k of ['original_url', 'originalUrl', 'original']) {
                    const v = obj[k];
                    if (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) return v.trim();
                }
                for (const k of Object.keys(obj)) {
                    const v = findOriginal(obj[k], depth + 1);
                    if (v) return v;
                }
                return null;
            };

            const originalUrl = findOriginal(data);

            if (!originalUrl) {
                // Silent downgrade to a thumbnail is the worst failure mode here, so say so.
                try {
                    log.host.info(postId, `::No original_url in API response -> thumbnail::: ${url}`, 'goonbox.cr');
                } catch (e) {}
                return fallback;
            }

            // Post-migration, some "original_url" targets genuinely 404 even though the medium-res
            // thumbnail on the same cuckcapital.cr host still exists, so the original is worth
            // verifying. But only a definitive "gone" justifies discarding it: a HEAD that is
            // refused outright (0 / 403 / 405) says nothing about whether the file is there --
            // plenty of CDN edges simply do not serve HEAD -- and treating that as absent throws
            // away a perfectly good original. Confirm with a ranged GET before falling back.
            const probe = async (method, headers) => {
                try {
                    const r = await http.base(method, originalUrl, {}, { Referer: url, ...headers }, null, 'text');
                    return Number((r && r.status) || 0) || 0;
                } catch (e) {
                    return 0;
                }
            };

            let status = await probe('HEAD', {});
            let reachable = status >= 200 && status < 400;

            if (!reachable) {
                // A refused HEAD is not evidence of absence, so let the ranged GET be the
                // authority: it is the same method the download itself will use.
                status = await probe('GET', { Range: 'bytes=0-0' });
                reachable = status >= 200 && status < 400;
            }

            if (!reachable) {
                try {
                    log.host.info(postId, `::Original unreachable (${status}) -> thumbnail::: ${originalUrl}`, 'goonbox.cr');
                } catch (e) {}
                return fallback || originalUrl;
            }

            return originalUrl;
        },
    ],
    [
        [/goonbox\.cr\/a\//],
        async (url, http, spoilers, postId) => {
            const albumSlug = url.replace(/\?.*/, '').split('/').filter(Boolean).pop();

            // Direct request first, same-origin bridge tab only if Cloudflare rejects it -- see
            // goonboxApiJson. The helper tab is reused across every page of the album.
            const fetchPage = async page =>
            await goonboxApiJson(http, `/api/albums/${albumSlug}/images?page=${page}`, url, postId);

            const first = await fetchPage(1);
            if (!first || !h.isArray(first.images)) return null;

            const resolved = first.images.map(img => img.original_url).filter(Boolean);
            const lastPage = first.pagination?.last_page || 1;

            for (let page = 2; page <= lastPage; page++) {
                const data = await fetchPage(page);
                if (data && h.isArray(data.images)) {
                    resolved.push(...data.images.map(img => img.original_url).filter(Boolean));
                }
            }

            return {
                folderName: `goonbox_${albumSlug}`,
                resolved,
            };
        },
    ],
    [
        [/(jpg\d\.(church|fish|fishing|pet|su|cr))|cuckcapital\.cr\//i, /:!jpe?g\d\.(church|fish|fishing|pet|su|cr)(\/a\/|\/album\/)/i],
        url =>
        url
        .replace('.th.', '.')
        .replace('.md.', '.')
    ],
    [
        [/jpe?g\d\.(church|fish|fishing|pet|su|cr)(\/a\/|\/album\/)/i],
        async (url, http, spoilers, postId) => {
            url = url.replace(/\?.*/, '');

            let reFetch = false;

            let { source, dom } = await http.get(url, {
                onStateChange: response => {
                    // If it's a redirect, we'll have to fetch the new url.
                    if (response.readyState === 2 && response.finalUrl !== url) {
                        url = response.finalUrl;
                        reFetch = true;
                    }
                },
            });

            if (reFetch) {
                const { source: src, dom: d } = await http.get(url);
                source = src;
                dom = d;
            }

            if (h.contains('Please enter your password to continue', source)) {
                const authTokenNode = dom.querySelector('input[name="auth_token"]');
                const authToken = !authTokenNode ? null : authTokenNode.getAttribute('value');

                if (!authToken || !spoilers || !spoilers.length) {
                    return null;
                }

                const albumOrigin = (() => {
                    try { return new URL(url).origin; } catch (e) { return 'https://jpg6.su'; }
                })();

                const attemptWithPassword = async password => {
                    const { source, dom } = await http.post(
                        url,
                        `auth_token=${encodeURIComponent(authToken)}&content-password=${encodeURIComponent(password)}`,
                        {},
                        {
                            Referer: url,
                            Origin: albumOrigin,
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                    );
                    return { source, dom };
                };

                let authenticated = false;

                for (const spoiler of spoilers) {
                    const { source: src, dom: d } = await attemptWithPassword(spoiler.trim());
                    if (!h.contains('Please enter your password to continue', src)) {
                        authenticated = true;
                        source = src;
                        dom = d;
                        break;
                    }
                }

                if (!authenticated) {
                    log.host.error(postId, `::Could not resolve password protected album::: ${url}`, 'jpg6.su');
                    return null;
                }
            }

            const resolvePageImages = async dom => {
                const images = [...dom.querySelectorAll('.list-item-image > a > img')]
                .map(img => img.getAttribute('src'))
                .map(url =>
                     url
                     .replace('.md.', '.')
                     .replace('.th.', '.')
                    );

                const nextPage = dom.querySelector('a[data-pagination="next"]');

                if (nextPage && nextPage.hasAttribute('href')) {
                    const { dom } = await http.get(nextPage.getAttribute('href'));
                    images.push(...(await resolvePageImages(dom)));
                }

                return images;
            };

            const resolved = await resolvePageImages(dom);

            return {
                dom,
                source,
                folderName: dom.querySelector('meta[property="og:title"]').content.trim(),
                resolved,
            };
        },
    ],
    [
        [/\/\/ibb.co\/[a-zA-Z0-9-_.]+/, /:!([a-z](\d+)?\.)?ibb.co\/album\/[a-zA-Z0-9_.-]+/],
        async (url, http) => {
            try{
                const { dom } = await http.get(url);
                return dom.querySelector('.header-content-right > a').getAttribute('href');
            } catch (err){
                url => url;
            }
        },
    ],

    [[/i\.ibb\.co\/[a-zA-Z0-9-_.]+/, /:!([a-z](\d+)?\.)?ibb.co\/album\/[a-zA-Z0-9_.-]+/], url => url],
    [
        [/([a-z](\d+)?\.)?ibb.co\/album\/[a-zA-Z0-9_.-]+/],
        async (url, http, spoilers, postId) => {
            const albumId = url.replace(/\?.*/, '').split('/').reverse()[0];
            let { source, dom } = await http.get(url);

            if (source && h.contains('Please enter your password to continue', source)) {
                const pwToken = dom?.querySelector('input[name="auth_token"]')?.getAttribute('value') || h.re.match(/(?<=auth_token=").*?(?=")/i, source);
                if (!pwToken || !spoilers || !spoilers.length) {
                    log.host.error(postId, `::Password required for ibb.co album::: ${url}`, 'ibb.co');
                    return null;
                }
                let unlocked = false;
                for (const sp of spoilers) {
                    const { source: src, dom: d } = await http.post(
                        url,
                        `auth_token=${encodeURIComponent(pwToken)}&content-password=${encodeURIComponent(sp.trim())}`,
                        {},
                        {
                            Referer: url,
                            Origin: new URL(url).origin,
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                    );
                    if (src && !h.contains('Please enter your password to continue', src)) {
                        source = src;
                        dom = d;
                        unlocked = true;
                        break;
                    }
                }
                if (!unlocked) {
                    log.host.error(postId, `::Could not unlock password-protected ibb.co album::: ${url}`, 'ibb.co');
                    return null;
                }
            }

            const countEl = dom && dom.querySelector('span[data-text="image-count"]');
            const imageCount = Number((countEl && (countEl.innerText || countEl.textContent)) || 0) || 0;
            const pageCount = Math.max(1, Math.ceil(imageCount / 32));
            const authToken = h.re.match(/(?<=auth_token=").*?(?=")/i, source);

            const fetchPageData = async (albumId, page, seekEnd, authToken) => {
                const seek = seekEnd || '';
                const data = `action=list&list=images&sort=date_desc&page=${page}&from=album&albumid=${albumId}&params_hidden%5Blist%5D=images&params_hidden%5Bfrom%5D=album&params_hidden%5Balbumid%5D=${albumId}&auth_token=${authToken}&seek=${seek}&items_per_page=32`;
                const { source: response } = await http.post(
                    'https://ibb.co/json',
                    data,
                    {},
                    {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                );

                try {
                    const parsed = JSON.parse(response);

                    if (parsed && parsed.status_code && parsed.status_code === 200) {
                        const html = parsed.html.replace('"', '"');
                        return {
                            urls: h.re.matchAll(/(?<=data-object=').*?(?=')/gi, html).map(o => JSON.parse(decodeURIComponent(o)).url),
                            parsed,
                        };
                    }

                    return { urls: [], parsed };
                } catch (e) {
                    return { urls: [], parsed };
                }
            };

            const resolved = [];

            let seekEnd = '';

            for (let i = 1; i <= pageCount; i++) {
                const data = await fetchPageData(albumId, i, seekEnd, authToken);
                seekEnd = data.parsed.seekEnd;
                resolved.push(...data.urls);
            }

            return {
                dom,
                source,
                folderName: dom.querySelector('meta[property="og:title"]').content.trim(),
                resolved,
            };
        },
    ],
    [
        [/(t|img)(\d+)?\.(?:pixhost\.(?:to|cc)|pixho\.st)\//i, /:!(?:pixhost\.(?:to|cc)|pixho\.st)\/(?:gallery|show)\//i],
        url =>
            String(url || '')
                .replace(/(^|\/\/)t(\d+)\./i, '$1img$2.')
                .replace(/\/thumbs\//i, '/images/'),
    ],
    [
        [/(?:pixhost\.(?:to|cc)|pixho\.st)\/show\//i],
        async (url, http) => {
            const { source, dom } = await http.get(url);
            const directImg =
                dom?.querySelector('#image.image-img, img#image, .image-img')?.getAttribute('src') ||
                (h.re.match(/https?:\/\/img\d+\.(?:pixhost\.(?:to|cc)|pixho\.st)\/images\/[^"'\s<>]+/i, source || '') || null);
            if (directImg) return directImg;
            const ogImg = dom?.querySelector('meta[property="og:image"]')?.getAttribute('content');
            if (ogImg) {
                return ogImg.replace(/(^|\/\/)t(\d+)\./i, '$1img$2.').replace(/\/thumbs\//i, '/images/');
            }
            return null;
        },
    ],
    [
        [/(?:pixhost\.(?:to|cc)|pixho\.st)\/gallery\//i],
        async (url, http) => {
            const { source, dom } = await http.get(url);

            let imageLinksInput =
                dom?.querySelector('.share input[value*="[img]"]') ||
                dom?.querySelector('.share > div:nth-child(2) > input') ||
                dom?.querySelector('.share > input:nth-child(2)');

            let resolved = [];
            if (imageLinksInput && imageLinksInput.getAttribute('value')) {
                resolved = h.re
                    .matchAll(/(?<=\[img])https?:\/\/t\d+.*?(?=\[\/img])/gis, imageLinksInput.getAttribute('value'))
                    .map(u => u.replace(/(^|\/\/)t(\d+)\./gi, '$1img$2.').replace(/\/thumbs\//i, '/images/'));
            }

            if (!resolved.length && dom) {
                resolved = [...dom.querySelectorAll('img[src*="/thumbs/"]')]
                    .map(img => img.getAttribute('src'))
                    .filter(Boolean)
                    .map(u => u.replace(/(^|\/\/)t(\d+)\./gi, '$1img$2.').replace(/\/thumbs\//i, '/images/'))
                    .unique();
            }

            const folderName =
                dom?.querySelector('.link > h2, .gallery-title, h1')?.textContent?.trim() ||
                h.basename(String(url || '').replace(/\?.*/, ''));

            return {
                dom,
                source,
                folderName,
                resolved,
            };
        },
    ],
    [
        [/putmega\.com\/images\//i, /:!(?:putmega\.com|putme\.ga)\/(?:a|album|image)\//i],
        url => String(url || '').replace('.th.', '.').replace('.md.', '.'),
    ],
    [
        [/(?:putmega\.com|putme\.ga)\/image\//i, /:!(?:putmega\.com|putme\.ga)\/(?:a|album)\//i],
        async (url, http) => {
            const { dom } = await http.get(url);
            return (
                dom?.querySelector('meta[property="og:image"]')?.getAttribute('content')?.replace('.md.', '.').replace('.th.', '.') ||
                dom?.querySelector('.header-content-right > a[href]')?.getAttribute('href') ||
                null
            );
        },
    ],
    [
        [/(?:putmega\.com|putme\.ga)\/(?:a|album)\//i],
        async (url, http, spoilers, postId) => {
            url = String(url || '').replace(/\?.*/, '');
            let { source, dom } = await http.get(url);

            if (source && h.contains('Please enter your password to continue', source)) {
                const authToken = dom?.querySelector('input[name="auth_token"]')?.getAttribute('value');
                if (!authToken || !spoilers || !spoilers.length) return null;

                let authenticated = false;
                for (const spoiler of spoilers) {
                    const { source: src, dom: d } = await http.post(
                        url,
                        `auth_token=${authToken}&content-password=${encodeURIComponent(spoiler.trim())}`,
                        {},
                        {
                            Referer: url,
                            Origin: new URL(url).origin,
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                    );
                    if (!h.contains('Please enter your password to continue', src || '')) {
                        authenticated = true;
                        source = src;
                        dom = d;
                        break;
                    }
                }
                if (!authenticated) {
                    log.host.error(postId, `::Could not resolve password protected album::: ${url}`, 'putmega.com');
                    return null;
                }
            }

            const resolvePageImages = async pageDom => {
                const images = [...(pageDom?.querySelectorAll('.list-item-image > a > img, .image-container > img') || [])]
                    .map(img => img.getAttribute('src'))
                    .filter(Boolean)
                    .map(u => u.replace('.md.', '.').replace('.th.', '.'));

                const nextPage = pageDom?.querySelector('a[data-pagination="next"]');
                if (nextPage && nextPage.hasAttribute('href')) {
                    const nextHref = new URL(nextPage.getAttribute('href'), url).toString();
                    const { dom: nextDom } = await http.get(nextHref);
                    images.push(...(await resolvePageImages(nextDom)));
                }
                return images;
            };

            const resolved = await resolvePageImages(dom);
            const folderName =
                dom?.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() ||
                h.basename(url);

            return {
                dom,
                source,
                folderName,
                resolved,
            };
        },
    ],
    [
        [/erome\.com\/a\//i],
        async (url, http) => {
            const { source, dom } = await http.get(url, {}, { Referer: 'https://www.erome.com/' });
            const resolved = [];

            dom?.querySelectorAll('.media-group').forEach(mediaGroup => {
                const imgSource =
                    mediaGroup.querySelector('.img[data-src]')?.getAttribute('data-src') ||
                    mediaGroup.querySelector('img.img-front')?.getAttribute('data-src') ||
                    mediaGroup.querySelector('img.img-front')?.getAttribute('src');

                const videoSources = [...mediaGroup.querySelectorAll('video source[src]')];
                videoSources.sort((a, b) => (Number(b.getAttribute('res') || 0) - Number(a.getAttribute('res') || 0)));
                const videoSource = videoSources[0]?.getAttribute('src') || mediaGroup.querySelector('source')?.getAttribute('src');

                const chosen = videoSource || imgSource || null;
                if (chosen) resolved.push(chosen);
            });

            const folderName =
                dom?.querySelector('h1.album-title-page, .page-content > h1, h1')?.textContent?.trim() ||
                h.basename(String(url || '').replace(/\?.*/, ''));

            return {
                dom,
                source,
                folderName,
                resolved,
            };
        },
    ],
    [
        [/((stream|cdn(\d+)?)\.)?bunkrr?r?\.(lu|lv|bi|cm|at|by|cx|sx|ac|ax|black|cat|ci|cr|fi|is|media|nu|pk|ph|ps|red|ru|se|si|site|sk|ws|su|org).*?\.|((i|cdn)(\d+)?\.)?bunkrr?r?\.(lu|lv|bi|cm|at|by|cx|sx|ac|ax|black|cat|ci|cr|fi|is|media|nu|pk|ph|ps|red|ru|se|si|site|sk|ws|su|org)\/(v\/)?/i, /:!bunkrr?r?\.(lu|lv|bi|cm|at|by|cx|sx|ac|ax|black|cat|ci|cr|fi|is|media|nu|pk|ph|ps|red|ru|se|si|site|sk|ws|su|org)\/a\//],
        async (url, http) => {
            try {
                const cleanUrl = String(url || '').split('#')[0];

                // Legacy Bunkr CDN hosts no longer serve files directly: as of 2026-07-28,
                // cdn*.bunkr.*/<name>.mp4 responds 301 -> bunkr.*/f/<slug>, an HTML page. So these
                // links still need the metadata + signing flow, and must NOT be treated as final.
                const isLegacyBunkrCdn = /^https?:\/\/(?:cdn\d*|stream)\.bunkrr?r?\./i.test(cleanUrl);

                // If this already looks like a direct media file URL, keep it (don't call /api/vs).
                // (CDN links usually include the real filename already.)
                if (
                    !isLegacyBunkrCdn &&
                    /\.(?:mp4|m4v|webm|mov|mkv|jpg|jpeg|png|gif|webp|zip|rar|7z|pdf)(?:$|\?)/i.test(cleanUrl) &&
                    !/\/(?:v|f|d)\//i.test(cleanUrl)
                ) {
                    return cleanUrl;
                }

                const u = new URL(cleanUrl);
                const origin = u.origin;
                const pathname = u.pathname || '';

                const segments = pathname.split('/').filter(Boolean);
                const index = segments.findIndex(s => ['f', 'v', 'd'].includes(s));
                const id = index > -1 ? segments.slice(index + 1).join('/') : segments.pop();
                let bunkrDataId = null;

// Best-effort: read the human filename from the view page (og:title / h1 / <title>).
// This lets us rename CDN GUID links back to the original filename.
try {
    const strip = (s) => String(s || '').split('#')[0].split('?')[0];
    const bases = xfpdBunkrFilterBases(
        isLegacyBunkrCdn
            ? ['https://bunkr.cr', 'https://bunkr.pk']
            : [origin, 'https://bunkr.pk', 'https://bunkr.cr']
    );
    // DIAGNOSTIC (b02): tracing why some /f/ links resolve to nothing and get downloaded as HTML.
    console.log(`[Bunkr] resolve start: url=${cleanUrl} origin=${origin} id=${id} legacyCdn=${isLegacyBunkrCdn} bases=${JSON.stringify(bases)}`);

    for (const base of bases) {
        const base0 = String(base || '').replace(/\/$/, '');
        const candidates = [];
        if (/\/v\//i.test(pathname) && base0 === origin) candidates.push(cleanUrl);
        candidates.push(`${base0}/v/${id}`);
        candidates.push(`${base0}/f/${id}`);

        const uniq = candidates.filter((v, i, a) => a.indexOf(v) === i);
        let found = false;

        for (const viewUrl of uniq) {
            const viewRes = await xfpdBunkrGetWithCfRetry(http, viewUrl, base0, base0 === 'https://bunkr.cr');
            const dom = viewRes?.dom;
            const viewSource = viewRes?.source || '';

            const cfHit = xfpdLooksLikeCfChallenge(viewSource, dom);
            console.log(`[Bunkr] view ${viewUrl}: bytes=${viewSource.length} dom=${!!dom} cfChallenge=${cfHit}`);

            // If Cloudflare interstitial is active, don't capture a bogus "Just a moment..." title as a filename hint.
            if (cfHit) continue;

            if (!bunkrDataId) {
                bunkrDataId = dom?.querySelector?.('[data-file-id]')?.getAttribute?.('data-file-id') || null;
                console.log(`[Bunkr] data-file-id from ${viewUrl}: ${bunkrDataId || 'NOT FOUND'}`
                    + (bunkrDataId ? '' : ` (page mentions dl.bunkr link: ${/dl\.bunkr\.[a-z]+\/file\/\d+/i.test(viewSource)})`));
            }

            let title =
                dom?.querySelector?.('meta[property="og:title"]')?.getAttribute?.('content') ||
                dom?.querySelector?.('h1')?.textContent ||
                dom?.querySelector?.('title')?.textContent ||
                '';
            title = String(title || '').replace(/\s+/g, ' ').trim();
            title = title.replace(/\s*\|\s*Bunkr\s*$/i, '').trim();

            if (title && !xfpdLooksLikeCfFilenameHint(title)) {
                bunkrNameByUrl.set(cleanUrl, title);
                bunkrNameByUrl.set(strip(cleanUrl), title);
                bunkrNameByUrl.set(viewUrl, title);
                bunkrNameByUrl.set(strip(viewUrl), title);
                found = true;
                break;
            }
        }

        if (found) break;
    }
} catch (e) {}

                const decodeFinalUrl = data => {
                    try {
                        if (!data || !data.url) return null;
                        if (!data.encrypted) return data.url;

                        const binaryString = atob(data.url);
                        const keyBytes = new TextEncoder().encode(`SECRET_KEY_${Math.floor(data.timestamp / 3600)}`);

                        return Array.from(binaryString)
                            .map((char, i) => String.fromCharCode(char.charCodeAt(0) ^ keyBytes[i % keyBytes.length]))
                            .join('');
                    } catch (e) {
                        return null;
                    }
                };

                const tryNewApi = async () => {
                    if (!bunkrDataId) {
                        console.log('[Bunkr] tryNewApi skipped: no data-file-id was found on any view page');
                        return null;
                    }
                    try {
                        const refererUrl = `https://get.bunkrr.su/file/${bunkrDataId}`;
                        const response = await http.post(
                            'https://apidl.bunkr.ru/api/_001_v2',
                            JSON.stringify({ id: bunkrDataId }),
                            {},
                            {
                                'Content-Type': 'application/json',
                                Referer: refererUrl,
                                Origin: 'https://get.bunkrr.su',
                            }
                        );
                        const text = String(response?.source || '');
                        console.log(`[Bunkr] api _001_v2 id=${bunkrDataId}: bytes=${text.length} head=${text.slice(0, 160)}`);
                        if (!text) return null;
                        const data = JSON.parse(text);
                        if (!data) return null;

                        let finalUrl = decodeFinalUrl(data);
                        console.log(`[Bunkr] decoded final url: ${finalUrl || 'DECODE FAILED'}`);
                        if (!finalUrl || typeof finalUrl !== 'string') return null;
                        finalUrl = finalUrl.trim();
                        if (finalUrl.startsWith('//')) finalUrl = 'https:' + finalUrl;

                        finalUrl = await xfpdBunkrSignCdnUrl(http, finalUrl);

                        try {
                            const strip = (s) => String(s || '').split('#')[0].split('?')[0];
                            const hint =
                                xfpdBunkrExtractNameFromVsData(data) ||
                                bunkrNameByUrl.get(cleanUrl) ||
                                bunkrNameByUrl.get(strip(cleanUrl)) ||
                                '';
                            if (hint && String(hint).trim()) {
                                const h0 = String(hint).trim();
                                bunkrNameByUrl.set(cleanUrl, h0);
                                bunkrNameByUrl.set(strip(cleanUrl), h0);
                                bunkrNameByUrl.set(finalUrl, h0);
                                bunkrNameByUrl.set(strip(finalUrl), h0);
                            }
                        } catch (e) {}

                        return finalUrl;
                    } catch (e) {
                        console.log(`[Bunkr] tryNewApi threw: ${(e && e.message) || e}`);
                        return null;
                    }
                };

                const finalURL = await tryNewApi();
                if (!finalURL) {
                    console.log(`[Bunkr] UNRESOLVED -> falling back to the page URL, which will download as HTML: ${cleanUrl}`);
                }
                return finalURL || cleanUrl;
            } catch (error) {
                console.error(error?.message || error);
                return url;
            }
        },
    ],
[
    [/bunkrr?r?\.(lu|lv|bi|cm|at|by|cx|sx|ac|ax|black|cat|ci|cr|fi|is|media|nu|pk|ph|ps|red|ru|se|si|site|sk|ws|su|org)\/a\//],
    async (url, http, _, __, ___, progressCB) => {
        const cleanUrl = String(url || '').split('#')[0];
        const baseUrl = cleanUrl.split('?')[0].replace(/\/+$/, '');

        const resolved = [];
        const seen = new Set();

        // Bunkr album: keep the human filename from the album grid (title / .theName) and attach it to resolved CDN URLs.
        const nameHintBySlug = new Map();

        let firstDom = null;
        let firstSource = null;

        const sanitizeName = s => String(s || '')
            .replace(/[\\/:*?"<>|]/g, '-')
            .replace(/\s+/g, ' ')
            .trim();

        const decodeFinalUrl = data => {
            try {
                if (!data || !data.url) return null;
                if (!data.encrypted) return data.url;

                const binaryString = atob(data.url);
                const keyBytes = new TextEncoder().encode(`SECRET_KEY_${Math.floor(data.timestamp / 3600)}`);

                return Array.from(binaryString)
                    .map((char, i) => String.fromCharCode(char.charCodeAt(0) ^ keyBytes[i % keyBytes.length]))
                    .join('');
            } catch (e) {
                return null;
            }
        };

        const extractSlugsFromDom = dom => {
            const containers = dom?.querySelectorAll?.('.grid-images > div') || [];
            const slugs = [];

            for (const c of containers) {
                const a =
                    c.querySelector('a[class="after:absolute after:z-10 after:inset-0"]') ||
                    c.querySelector('a[href*="/f/"]') ||
                    c.querySelector('a[href*="/v/"]') ||
                    c.querySelector('a[href*="/d/"]');

                const href = a?.getAttribute?.('href') || '';
                const m = href.match(/\/(f|v|d)\/([^\/?#]+)/i);
                if (m && m[2]) {
                    const slug = m[2];
                    slugs.push(slug);

                    // Name hint is visible on /a/ pages (e.g. <div title="...mp4"> or .theName). Use it later when we only have a CDN GUID URL.
                    try {
                        let hint = c?.getAttribute?.('title') || '';
                        if (!hint) hint = c?.querySelector?.('.theName')?.textContent || '';
                        if (!hint) hint = c?.querySelector?.('p.truncate')?.textContent || '';
                        if (!hint) hint = c?.querySelector?.('.grid-images_box-txt p')?.textContent || '';
                        hint = String(hint || '').replace(/\s+/g, ' ').trim();
                        if (hint) nameHintBySlug.set(slug, hint);
                    } catch (e) {}
                }
            }

            return slugs;
        };

        const asyncPool = async (limit, items, worker) => {
            const results = new Array(items.length);
            let i = 0;

            const runners = Array.from({ length: Math.max(1, limit) }, async () => {
                while (true) {
                    const idx = i++;
                    if (idx >= items.length) break;
                    try {
                        results[idx] = await worker(items[idx], idx);
                    } catch (e) {
                        results[idx] = null;
                    }
                }
            });

            await Promise.all(runners);
            return results;
        };

        const origin = (() => {
            try { return new URL(baseUrl).origin; } catch (e) { return 'https://bunkr.cr'; }
        })();

        const vsBasesAll = [origin, 'https://bunkr.pk', 'https://bunkr.cr'].filter((v, i, a) => a.indexOf(v) === i);

        let folderName = null;

        const MAX_PAGES = 500;
        const CONCURRENCY = 8;

        const albumUrlObj = (() => {
            try { return new URL(baseUrl); } catch (e) { return null; }
        })();
        const albumPath = (albumUrlObj && albumUrlObj.pathname) ? albumUrlObj.pathname : (() => {
            try { return new URL(cleanUrl).pathname; } catch (e) { return '/'; }
        })();
        const albumBasesAll = [origin, 'https://bunkr.pk', 'https://bunkr.cr'].filter((v, i, a) => a.indexOf(v) === i);
        let albumBaseChosen = null;

        for (let page = 1; page <= MAX_PAGES; page++) {
            const requestedPageUrl = `${baseUrl}?page=${page}`;

            if (typeof progressCB === 'function') {
                progressCB(`Resolving: ${requestedPageUrl}`);
            }

            const pageBases = albumBaseChosen
                ? [albumBaseChosen, ...xfpdBunkrFilterBases(albumBasesAll).filter(b => b !== albumBaseChosen)]
                : xfpdBunkrFilterBases(albumBasesAll);

            let dom = null, source = '';
            let pageUrl = requestedPageUrl;
            let slugs = [];

            for (const base of pageBases) {
                const base0 = String(base || '').replace(/\/$/, '');
                const candidate = `${base0}${albumPath}?page=${page}`;
                pageUrl = candidate;

                try {
                    ({ dom, source } = await xfpdBunkrGetWithCfRetry(http, candidate, base0, base0 === 'https://bunkr.cr'));
                } catch (e) {
                    dom = null;
                    source = '';
                }

                if (xfpdLooksLikeCfChallenge(source, dom)) continue;

                slugs = extractSlugsFromDom(dom);
                if (page === 1 && !slugs.length) {
                    continue;
                }

                if (!albumBaseChosen) albumBaseChosen = base0;
                break;
            }

            if (!dom) break;
            if (!slugs.length) break;
if (page === 1) {
                firstDom = dom;
                firstSource = source;

                const h1 = dom?.querySelector?.('h1');
                const title = (h1?.innerText || h1?.textContent || '').split('\n')[0]?.trim();
                if (title) folderName = sanitizeName(title);
            }

            const fresh = [];
            for (const s of slugs) {
                if (!s || seen.has(s)) continue;
                seen.add(s);
                fresh.push(s);
            }

            if (!fresh.length) break;

            const urls = await asyncPool(CONCURRENCY, fresh, async (slug) => {
                // Fetch /f/{slug} to get the numeric file ID required by the new API.
                const fileBase = String(albumBaseChosen || origin || 'https://bunkr.cr').replace(/\/$/, '');
                const filePageUrl = `${fileBase}/f/${slug}`;
                let dataId = null;
                try {
                    const fileRes = await xfpdBunkrGetWithCfRetry(http, filePageUrl, fileBase, fileBase === 'https://bunkr.cr');
                    const fileDom = fileRes?.dom;
                    if (fileDom && !xfpdLooksLikeCfChallenge(fileRes?.source || '', fileDom)) {
                        dataId = fileDom?.querySelector?.('[data-file-id]')?.getAttribute?.('data-file-id') || null;
                    }
                } catch (e) {}
                if (!dataId) return null;

                let data = null;
                try {
                    const refererUrl = `https://get.bunkrr.su/file/${dataId}`;
                    const response = await http.post(
                        'https://apidl.bunkr.ru/api/_001_v2',
                        JSON.stringify({ id: dataId }),
                        {},
                        {
                            'Content-Type': 'application/json',
                            Referer: refererUrl,
                            Origin: 'https://get.bunkrr.su',
                        }
                    );
                    const text = String(response?.source || '');
                    data = text ? JSON.parse(text) : null;
                } catch (e) {}
                if (!data) return null;

                let finalUrl = decodeFinalUrl(data);
                if (!finalUrl || typeof finalUrl !== 'string') return null;
                finalUrl = finalUrl.trim();
                if (finalUrl.startsWith('//')) finalUrl = 'https:' + finalUrl;

                finalUrl = await xfpdBunkrSignCdnUrl(http, finalUrl);

                try {
                    const strip = (s) => String(s || '').split('#')[0].split('?')[0];
                    const hint = nameHintBySlug.get(slug) || xfpdBunkrExtractNameFromVsData(data) || '';
                    if (hint && String(hint).trim()) {
                        const h0 = String(hint).trim();
                        bunkrNameByUrl.set(finalUrl, h0);
                        bunkrNameByUrl.set(strip(finalUrl), h0);
                    }
                } catch (e) {}

                return finalUrl;
            });

            for (const u of urls) if (u) resolved.push(u);
        }

        if (!folderName) folderName = h.basename(baseUrl);

        return {
            dom: firstDom,
            source: firstSource,
            folderName,
            resolved,
        };
    }
],

    [
        [/give.xxx\//],
        async (url, http) => {
            const { source, dom } = await http.get(url);
            const profileId = h.re.match(/(?<=profile-id=")\d+/, source);

            const resolved = [];

            let username = null;

            let firstMediaId = null;

            let mediaId = 1;

            let iteration = 1;

            while (true) {
                let endpoint = `https://give.xxx/api/web/v1/accounts/${profileId}/statuses?only_media=true`;
                endpoint += iteration === 1 ? '&min_id=1' : `&max_id=${mediaId}`;
                const { source } = await http.get(endpoint);
                if (h.contains('_v', source)) {
                    const parsed = JSON.parse(source);

                    if (username === null) {
                        username = parsed[0].account.username;
                    }

                    if (firstMediaId === null) {
                        firstMediaId = parsed[0].id;
                    } else {
                        if (firstMediaId === parsed[0].id) {
                            break;
                        }
                    }
                    resolved.push(
                        ...parsed.flatMap(i => {
                            return i.media_attachments
                                .map(a => {
                                return a.sizes;
                            })
                                .map(s => s.large || s.normal || s.small);
                        }),
                    );
                    mediaId = parsed[parsed.length - 1].id;
                } else {
                    break;
                }

                iteration++;
            }

            return {
                dom,
                source,
                folderName: username,
                resolved,
            };
        },
    ],
    [
        [/(?:focus\.)?(?:pixeldrain\.com|pixeldrain\.net|pixeldra\.in)\/[ul]/],
        url => {
            let resolved = url.replace('/u/', '/api/file/').replace('/l/', '/api/list/');
            resolved = h.contains('/api/list', resolved) ? `${resolved}/zip` : resolved;
            resolved = h.contains('/api/file', resolved) ? `${resolved}?download` : resolved;
            return resolved;
        },
    ],
    [
        [/([~an@]+\.)?pornhub.com\/view_video/],
        async (url, http) => {
            url = url.replace(/([a-zA-Z0-9]+\.)?pornhub/, 'pornhub');

            const resolvePH = async url => {
                const { dom } = await http.get(
                    url,
                    {},
                    {
                        referer: url,
                        cookie: 'age-verified: 1; platform=tv; cookiesBannerSeen=1; hasVisited=1',
                    },
                );
                const script = [...dom.querySelectorAll('script')]
                .map(s => s.innerText)
                .filter(s => /var\smedia_\d+/gis.test(s))
                .map(s => {
                    return {
                        mediaVars: h.re.matchAll(/var\smedia_\d+=.*?;/gis, s),
                        flashVars: s,
                    };
                })[0];

                const { mediaVars, flashVars } = script;

                return mediaVars
                    .map(m => {
                    const cleaned = m
                    .replace(/\/\*.*?\*\//gis, '')
                    .replace(/var\smedia_\d+=/i, '')
                    .replace(';', '');

                    return cleaned
                        .split('+')
                        .map(s => s.trim())
                        .map(s => {
                        let value = new RegExp(`var ${s}=".*?"`, 'isg').exec(flashVars)[0];
                        value = value.replace(/.*?"/i, '').replace(/"/i, '');
                        return value;
                    })
                        .join('');
                })
                    .find(url => url.indexOf('pornhub.com/video/get_media?s=') > -1);
            };

            let parsed = null;

            let tries = 0;

            // Scumbag pornhub won't send the right json link the first time.
            // Still, there are ocassional 403s / redirects.
            // TODO: Fix me
            do {
                const infoURL = await resolvePH(url);

                if (!infoURL) {
                    continue;
                }

                try {
                    const { source } = await h.http.get(infoURL);
                    const json = JSON.parse(source);
                    const fetchedFormats = json.reverse();
                    const qualities = ['1080', '720', '480', '320', '240'];
                    for (const q of qualities) {
                        const f = fetchedFormats.find(f => f.quality === q);
                        if (f && f.videoUrl) {
                            parsed = f.videoUrl;
                            break;
                        }
                    }
                } catch (e) {}
                await h.delayedResolve(1000);
                tries++;
            } while (!parsed && tries < 20);

            return parsed;
        },
    ],
    [
        [/gofile.io\/d/],
        async (url, http, spoilers, postId) => {
        const WT_KEY = 'xfpd_gofile_wt';
        const AT_KEY = 'xfpd_gofile_at';
        const WT_MAX_AGE_MS = 24 * 3600 * 1000;
        const AT_MAX_AGE_MS = 24 * 3600 * 1000;

        const gmGet = (key, fallback) => {
            try {
                return typeof GM_getValue === 'function' ? GM_getValue(key, fallback) : fallback;
            } catch (e) {
                return fallback;
            }
        };

        const gmSet = (key, val) => {
            try {
                if (typeof GM_setValue === 'function') GM_setValue(key, val);
            } catch (e) {}
        };

        const gmReq = async (method, url, data = null, headers = {}, responseType = 'text') => {
            return await http.base(method, url, {}, headers, data, responseType);
        };

        // GoFile no longer uses the static appdata.wt from config.js for /contents.
        // The website now derives a per-request X-Website-Token from the account token
        // via generateWT() in https://gofile.io/js/wt.obf.js (moved from /dist/js/ in a
        // 2026-08-13 site redesign -- the old path now 404s to the SPA shell's index.html,
        // which silently fails the /generateWT/ source check below), i.e.:
        //   WT = sha256(navigator.userAgent + "::" + navigator.language + "::" + token + "::<time>::<salt>")
        // <time> is NOT a static value -- it's Math.floor(Date.now() / 1000 / 14400) (a
        // 4-hour bucket), recomputed live inside generateWT() itself. <salt> is the one
        // actual fixed constant, which can still change whenever GoFile updates the file.
        // We fetch the script live, eval it in a scoped Function (it only reads navigator,
        // and the function declaration stays local, not leaked to global), and cache the
        // source for a day -- safe because we call the eval'd generateWT() fresh on every
        // request, so Date.now() is always evaluated at call time, not baked in when the
        // source was cached. WT must be computed with the same UA/language the request is
        // sent with; the language is also echoed back to the server via the X-BL header.
        let cachedGenerateWT = null;

        const getGenerateWT = async (force = false) => {
            if (!force && cachedGenerateWT) return cachedGenerateWT;

            const now = Date.now();
            const cached = gmGet(WT_KEY, null);
            let src =
                !force && cached && cached.src && cached.ts && now - cached.ts < WT_MAX_AGE_MS
                    ? cached.src
                    : null;

            if (!src) {
                const { source } = await gmReq('GET', 'https://gofile.io/js/wt.obf.js', null, {}, 'text');
                src = source || '';
                if (!src || !/generateWT/.test(src)) {
                    throw new Error('Could not fetch GoFile wt.obf.js (generateWT).');
                }
                gmSet(WT_KEY, { src, ts: now });
            }

            try {
                const factory = new Function(
                    'navigator',
                    `${src}\nreturn (typeof generateWT === 'function') ? generateWT : null;`,
                );
                const fn = factory(navigator);
                if (typeof fn !== 'function') throw new Error('no generateWT');
                cachedGenerateWT = fn;
                return fn;
            } catch (e) {
                throw new Error('Could not evaluate GoFile generateWT().');
            }
        };

        const computeWebsiteToken = async (token, force = false) => {
            const gen = await getGenerateWT(force);
            return gen(token);
        };

        const createAccountToken = async () => {
            // Live site creates the guest account with a plain POST (no website-token).
            const { source } = await gmReq(
                'POST',
                'https://api.gofile.io/accounts',
                JSON.stringify({}),
                {
                    accept: 'application/json',
                    'content-type': 'application/json',
                },
                'text',
            );

            const json = JSON.parse(source || '{}');

            if (!json || json.status !== 'ok' || !json.data || !json.data.token) {
                throw new Error(`createAccount failed: ${json?.message || json?.status || 'unknown'}`);
            }

            const token = json.data.token;

            // Sync/activate the fresh guest token server-side. The website does this via
            // GET /accounts/website before it will resolve /contents for that token.
            try {
                await gmReq(
                    'GET',
                    'https://api.gofile.io/accounts/website',
                    null,
                    { accept: 'application/json', authorization: `Bearer ${token}` },
                    'text',
                );
            } catch (e) {}

            try {
                settings.hosts.goFile.token = token;
            } catch (e) {}

            gmSet(AT_KEY, { token, ts: Date.now() });
            await gofileSyncCookie(token);
            return token;
        };

        const getAccountToken = async (force = false) => {
            // If the user provided a personal Bearer token, always use it.
            // (This is optional; leaving it empty keeps the anonymous account-token flow.)
            let token = null;
            try {
                const override = settings?.hosts?.goFile?.bearerOverride;
                if (override && String(override).trim() !== '') {
                    token = String(override).trim();
                }
            } catch (e) {}

            if (!token) {
                const now = Date.now();
                const cached = gmGet(AT_KEY, null);
                if (!force && cached && cached.token && cached.ts && now - cached.ts < AT_MAX_AGE_MS) {
                    token = cached.token;
                    try {
                        settings.hosts.goFile.token = token;
                    } catch (e) {}
                }
            }

            if (!token) {
                try {
                    if (!force && settings && settings.hosts && settings.hosts.goFile && settings.hosts.goFile.token) {
                        token = settings.hosts.goFile.token;
                    }
                } catch (e) {}
            }

            if (!token) {
                // createAccountToken() already syncs the cookie for this token; avoid a double sync below.
                return await createAccountToken();
            }

            await gofileSyncCookie(token);
            return token;
        };

        const apiContentsRaw = async (contentId, passwordHash, token) => {
            const wt = await computeWebsiteToken(token);

            // Match the website's getContent() query shape (pagination + sort) exactly.
            const params = [
                'contentFilter=',
                'page=1',
                'pageSize=1000',
                'sortField=createTime',
                'sortDirection=-1',
            ];
            if (passwordHash) params.push(`password=${encodeURIComponent(passwordHash)}`);
            const apiUrl = `https://api.gofile.io/contents/${encodeURIComponent(contentId)}?${params.join('&')}`;

            const { source } = await gmReq(
                'GET',
                apiUrl,
                null,
                {
                    accept: 'application/json',
                    authorization: `Bearer ${token}`,
                    'x-website-token': wt,
                    'x-bl': (typeof navigator !== 'undefined' && navigator.language) || '',
                },
                'text',
            );

            return JSON.parse(source || '{}');
        };

        const apiContents = async (contentId, passwordHash) => {
            let token = await getAccountToken(false);

            let json = await apiContentsRaw(contentId, passwordHash, token);
            if (json && json.status === 'ok') return json;

            const s = String(json?.status || json?.message || '').toLowerCase();

            if (s.includes('unauthorized') || s.includes('token') || s.includes('invalid')) {
                // Refresh both the salts (wt.obf.js may have rotated) and the guest token.
                await getGenerateWT(true);
                token = await getAccountToken(true);
                json = await apiContentsRaw(contentId, passwordHash, token);
                return json;
            }

            return json;
        };

        const resolveAlbum = async (urlOrId, spoilers) => {
            const id = String(urlOrId).includes('gofile.io/d/') ? String(urlOrId).split('/').reverse()[0] : String(urlOrId);

            let props = await apiContents(id, null);

            if (props && props.status === 'error-notFound') {
                log.host.error(postId, `::Album not found::: ${urlOrId}`, 'gofile.io');
                    return null;
                }

            if (props && props.status === 'error-notPublic') {
                log.host.error(postId, `::Album not public::: ${urlOrId}`, 'gofile.io');
                    return null;
                }

            if (props && props.status === 'error-passwordRequired') {
                log.host.info(postId, `::Album requires password::: ${urlOrId}`, 'gofile.io');

                if (!spoilers || !spoilers.length) {
                    return props;
                }

                        log.host.info(postId, `::Trying with ${spoilers.length} available password(s)::`, 'gofile.io');

                    const computeSha256Hex = async str => {
                        const fn =
                            (typeof sha256 === 'function' && sha256) ||
                            (typeof window !== 'undefined' && typeof window.sha256 === 'function' && window.sha256);
                        if (fn) return String(fn(String(str)));
                        const subtle =
                            (typeof crypto !== 'undefined' && crypto && crypto.subtle) ||
                            (typeof window !== 'undefined' && window.crypto && window.crypto.subtle);
                        if (subtle && typeof subtle.digest === 'function') {
                            const buf = await subtle.digest('SHA-256', new TextEncoder().encode(String(str)));
                            return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
                        }
                        return '';
                    };

                    for (const spoiler of spoilers) {
                        const hash = await computeSha256Hex(spoiler);
                    const attempt = await apiContents(id, hash);

                    if (attempt && attempt.status === 'ok') {
                            log.host.info(postId, `::Successfully authenticated with:: ${spoiler}`, 'gofile.io');
                        props = attempt;
                        break;
                        }
                    }
                }

                return props;
            };

            const props = await resolveAlbum(url, spoilers);

            let folderName = h.basename(url);

        if (!props || props.status !== 'ok' || !props.data) {
            if (props && props.status === 'error-passwordRequired') {
                log.host.error(postId, `::Password required (no valid password found)::: ${url}`, 'gofile.io');
            } else {
                log.host.error(postId, `::Unable to resolve album::: ${url}`, 'gofile.io');
            }

                return {
                    dom: null,
                    source: null,
                    folderName,
                    resolved: [],
                };
            }

            const resolved = [];

            // Some /d/ links point directly at a file, not a folder -- /contents/{id} then
            // returns data.type === 'file' with no data.children. Shared by the root-level
            // case below and the folder-iteration loop, so the link-picking logic (and the
            // filename-cache side effect) only lives in one place.
            const resolveGofileFileLink = obj => {
                if (!obj) return null;

                const fileId = obj.id || obj.code;
                const fileName = encodeURIComponent(obj.name || fileId || 'file');

                // Prefer direct/CDN links when available. Do NOT force /download/web/
                // (web flow can return album HTML).
                const candidates = [obj.directLink, obj.link, obj.downloadLink].filter(Boolean);
                const link =
                    candidates.find(u => /\/download\/direct\//i.test(String(u))) ||
                    candidates[0] ||
                    (fileId ? `https://gofile.io/download/web/${fileId}/${fileName}` : null);

                if (link) {
                    // Preserve original GoFile filename (from API) so we don't rely on URL-encoded path segment.
                    try {
                        if (obj.name) {
                            if (fileId) gofileNameById.set(String(fileId), String(obj.name));
                            gofileNameByUrl.set(String(link), String(obj.name));
                        }
                    } catch (e) {}
                }

                return link;
            };

            const getChildAlbums = async (props, spoilers) => {
                if (!props || props.status !== 'ok' || !props.data) {
                    return [];
                }

                const resolved = [];

            folderName = props.data.name || folderName;

                if (props.data.type === 'file') {
                    const link = resolveGofileFileLink(props.data);
                    if (link) resolved.push(link);
                    return resolved;
                }

                if (!props.data.children) {
                    return [];
                }

                const files = props.data.children;

                for (const file in files) {
                    const obj = files[file];

                if (!obj) continue;

                    if (obj.type === 'file') {
                        const link = resolveGofileFileLink(obj);
                        if (link) resolved.push(link);
                } else if (obj.type === 'folder') {
                    const folderId = obj.id || obj.code;
                    if (!folderId) continue;

                    const folderProps = await resolveAlbum(folderId, spoilers);
                        resolved.push(...(await getChildAlbums(folderProps, spoilers)));
                    }
                }

                return resolved;
            };

            resolved.push(...(await getChildAlbums(props, spoilers)));

            if (!resolved.length) {
                log.host.error(postId, `::Empty album::: ${url}`, 'gofile.io');
            }

            return {
                dom: null,
                source: null,
                folderName,
                resolved,
            };
        },
    ],
    [
        [/cyberfile.(su|me)\//, /:!cyberfile.(su|me)\/folder\//],
        async (url, http, spoilers) => {
            const { source } = await http.get(url);
            const u = h.re.matchAll(/(?<=showFileInformation\()\d+(?=\))/gis, source)[0];

            const getFileInfo = async () => {
                const { source } = await http.post(
                    'https://cyberfile.me/account/ajax/file_details',
                    `u=${u}`,
                    {},
                    {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                );
                return source;
            };

            let response = await getFileInfo();

            let requiredPassword = false;
            let unlocked = false;

            if ((h.contains('albumPasswordModel', response) || h.contains('This folder requires a password', response)) && spoilers.length) {
                const html = JSON.parse(response).html;

                const matches = /value="(\d+)"\sid="folderId"|value="(\d+)"\sname="folderId"/is.exec(html);

                const folderId = matches.length ? matches[1] : null;

                if (!folderId) {
                    return null;
                }

                requiredPassword = true;
                for (const password of spoilers) {
                    const { source } = await http.post(
                        'https://cyberfile.me/ajax/folder_password_process',
                        `submitme=1&folderId=${folderId}&folderPassword=${password}`,
                        {},
                        {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                    );

                    if (h.contains('success', source) && JSON.parse(source).success === true) {
                        unlocked = true;
                        break;
                    }
                }
            }

            if (requiredPassword && unlocked) {
                response = await getFileInfo();
            }

            return h.re.matchAll(/(?<=openUrl\(').*?(?=')/gi, response)[0]?.replace(/\\\//gi, '/');
        },
    ],
    [
        [/cyberfile.(su|me)\/folder\//],
        async (url, http, spoilers) => {
            const { source, dom } = await http.get(url);

            const script = [...dom.querySelectorAll('script')].map(s => s.innerText).filter(s => h.contains('data-toggle="tab"', s))[0];

            const nodeId = h.re.matchAll(/(?<='folder',\s').*?(?=')/gis, script);

            const loadFiles = async () => {
                const { source } = await http.post(
                    'https://cyberfile.me/account/ajax/load_files',
                    `pageType=folder&nodeId=${nodeId}`,
                    {},
                    {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                );
                return source;
            };

            let response = await loadFiles();

            let requiredPassword = false;
            let unlocked = false;

            if ((h.contains('albumPasswordModel', response) || h.contains('This folder requires a password', response)) && spoilers.length) {
                requiredPassword = true;
                for (const password of spoilers) {
                    const { source } = await http.post(
                        'https://cyberfile.me/ajax/folder_password_process',
                        `submitme=1&folderId=${nodeId}&folderPassword=${password}`,
                        {},
                        {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                    );

                    if (h.contains('success', source) && JSON.parse(source).success === true) {
                        unlocked = true;
                        break;
                    }
                }
            }

            if (!unlocked) {
                return null;
            }

            if (requiredPassword && unlocked) {
                response = await loadFiles();
            }

            const resolved = [];

            let folderName = h.basename(url);

            const props = JSON.parse(response);

            if (props && props.html) {
                folderName = props.page_title || folderName;

                const urls = h.re.matchAll(/(?<=dtfullurl=").*?(?=")/gis, props.html);

                for (const fileUrl of urls) {
                    const { source } = await http.get(fileUrl);
                    const u = h.re.matchAll(/(?<=showFileInformation\()\d+(?=\))/gis, source)[0];
                    const { source: response } = await http.post(
                        'https://cyberfile.me/account/ajax/file_details',
                        `u=${u}`,
                        {},
                        {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                    );
                    resolved.push(h.re.matchAll(/(?<=openUrl\(').*?(?=')/gi, response)[0]?.replace(/\\\//gi, '/'));
                }
            }

            return {
                dom,
                source,
                folderName,
                resolved,
            };
        },
    ],
    [
        [/([\w-]+\.)?turbo\.cr\/a\//],
        async (url, http) => {
            const { dom, source } = await http.get(url);

            // Album folder naming (stable + readable): turbo_<albumId> - <title>
            const mAlbum = url.match(/\/a\/([^\/?#]+)/i);
            const albumId = mAlbum ? mAlbum[1] : null;
            const base = albumId ? `turbo_${albumId}` : 'turbo_album';

            const rawTitle = dom?.querySelector('h1')?.textContent?.trim() || '';
            const invalidSub = settings.naming.invalidCharSubstitute || '_';

            let safeTitle = rawTitle
            .replace(/[\\/:*?"<>|]/g, invalidSub)
            .replace(/\s+/g, ' ')
            .trim();

            // Cap title to avoid extremely long Windows paths
            if (safeTitle.length > 120) safeTitle = safeTitle.slice(0, 120).trim();

            let folderName = base;
            if (safeTitle && safeTitle.toLowerCase() !== base.toLowerCase()) {
                folderName = `${safeTitle} - ${base}`;
            }

            // Final sanitize (defensive)
            folderName = folderName
                .replace(/[\\/:*?"<>|]/g, invalidSub)
                .replace(/\s+/g, ' ')
                .trim();

            // Hard cap for safety
            if (folderName.length > 180) folderName = folderName.slice(0, 180).trim();

            // Map videoId -> original filename (from album HTML)
            const idToName = new Map();

            // Collect video ids (and names) from the table rows (server-rendered HTML)
            let ids = Array.from(dom?.querySelectorAll('tr.file-row') || [])
            .map(row => {
                const a = row.querySelector('a[href^="/v/"]');
                const id = (a?.getAttribute('href') || '').match(/\/v\/([^\/?#]+)/i)?.[1];
                if (id) {
                    const nm = row.getAttribute('data-name') || row.dataset?.name;
                    if (nm) idToName.set(id, nm);
                }
                return id;
            })
            .filter(Boolean)
            .unique();

            // Fallback: regex scan (if DOM parsing fails)
            if (!ids.length && source) {
                ids = (source.match(/href="\/v\/([^"?#]+)"/gi) || [])
                    .map(s => (s.match(/\/v\/([^"?#]+)/i) || [null, null])[1])
                    .filter(Boolean)
                    .unique();
            }

            const resolved = [];

            for (const id of ids) {
                const embedUrl = `https://turbo.cr/embed/${id}`;
                let signed = null;
                try {
                    signed = await xfpdTurboSignUrlWithTimeout(id, embedUrl, idToName.get(id));
                } catch (e) {}

// Fallback: if signing fails, try to read media URL from the embed page
                if (!signed) {
                    try {
                        const { dom: edom } = await http.get(embedUrl, {}, { Referer: embedUrl });
                        const src =
                              edom?.querySelector('source[src]')?.getAttribute('src') ||
                              edom?.querySelector('video[src]')?.getAttribute('src');
                        if (src) {
                            signed = new URL(src, embedUrl).toString();
                        }
                    } catch (e) {}
                }

                // If we got a Turbo CDN URL and have an original name, attach fn=
                if (signed && /turbocdn\.st/i.test(signed)) {
                    const originalName = idToName.get(id);
                    if (originalName && !/[?&]fn=/.test(signed)) {
                        const enc = encodeURIComponent(String(originalName)).replace(/%20/g, '+');
                        signed += (signed.includes('?') ? '&' : '?') + 'fn=' + enc;
                    }
                }

                // If sign fails, keep a workable fallback
                if (signed && id) {
                    try { turboIdBySignedUrl.set(String(signed), String(id)); } catch (e) {}
                }
                resolved.push(signed || `https://turbo.cr/d/${id}`);
            }

            return {
                dom,
                source,
                folderName,
                resolved,
            };
        },
    ],
    [
        [/([\w-]+\.)?turbo\.cr\/(v|d)\//],
        async (url, http) => {
            const mm = url.match(/\/(v|d)\/([^\/?#]+)/i);
            let id = mm ? mm[2] : null;
            if (!id) {
                return url;
            }

            const embedUrl = `https://turbo.cr/embed/${id}`;
            try {
                const signed = await xfpdTurboSignUrlWithTimeout(id, embedUrl, null);
                if (signed) return signed;
            } catch (e) {}

// Fallback: try to read <source>/<video> directly from the embed page
            try {
                const { dom } = await http.get(embedUrl, {}, { Referer: embedUrl });
                const src =
                      dom?.querySelector('source[src]')?.getAttribute('src') ||
                      dom?.querySelector('video[src]')?.getAttribute('src');
                if (src) {
                    return new URL(src, embedUrl).toString();
                }
            } catch (e) {}

            // Last fallback: the site's direct download route
            return `https://turbo.cr/d/${id}`;
        },
    ],
    [[/public.onlyfans.com\/files/], async url => url],
    [
        [/([\w-]+\.)?turbo\.cr\/embed/],
        async (url, http) => {
            const m = url.match(/\/embed\/([^\/?#]+)/i);
            const id = m ? m[1] : null;
            if (!id) {
                return null;
            }

            const embedUrl = `https://turbo.cr/embed/${id}`;
            try {
                const signed = await xfpdTurboSignUrlWithTimeout(id, embedUrl, null);
                if (signed) return signed;
            } catch (e) {}

// Fallback: try to read <source> / <video> directly if present
            try {
                const { dom } = await http.get(embedUrl, {}, { Referer: embedUrl });
                const src =
                      dom?.querySelector('source[src]')?.getAttribute('src') ||
                      dom?.querySelector('video[src]')?.getAttribute('src');
                if (src) {
                    return new URL(src, embedUrl).toString();
                }
            } catch (e) {}

            return null;

        },
    ],

    [
        [/redgifs\.com\/users\//i],
        async (url, http, passwords, postId, postSettings, progressCB) => {
            const raw = String(url || '');
            const m = raw.match(/redgifs\.com\/users\/([^\/?#]+)/i);
            const username = m && m[1] ? decodeURIComponent(m[1]) : '';

            if (!username) {
                return null;
            }

            const baseUrl = `https://www.redgifs.com/users/${username}`;

            const fetchTempToken = async () => {
                try {
                    const { source, status } = await http.get(
                        'https://api.redgifs.com/v2/auth/temporary',
                        {},
                        { __xfpd_timeout: 8000 },
                        'text',
                    );
                    if (status === 200 && source && h.contains('token', source)) {
                        const token = JSON.parse(source).token;
                        if (token) {
                            GM_setValue('redgifs_token', token);
                        }
                        return token || null;
                    }
                } catch (e) {}
                return null;
            };

            let token = GM_getValue('redgifs_token', null);
            if (!token) {
                token = await fetchTempToken();
            }
            if (!token) {
                return null;
            }

            const preferredKeys = ['hd', 'hd1080', 'hd720', 'sd', 'mp4'];
            const resolved = [];

            const MAX_PAGES = 5000;
            const COUNT = 80;
            const ORDER = 'new';

            const fetchPage = async (page, t) => {
                const apiUrl = `https://api.redgifs.com/v2/users/${encodeURIComponent(username)}/search?order=${ORDER}&page=${page}&count=${COUNT}`;
                try {
                    return await http.get(apiUrl, {}, { Authorization: `Bearer ${t}` }, 'text');
                } catch (e) {
                    return { source: null, status: 0 };
                }
            };

            const tryFetchPage = async (page) => {
                let attempt = 0;
                let last = { source: null, status: 0 };

                while (attempt < 3) {
                    attempt++;

                    last = await fetchPage(page, token);

                    if (last.status === 429) {
                        await new Promise(r => setTimeout(r, 800 * attempt));
                        continue;
                    }

                    if (last.status === 401 || last.status === 403 || (last.source && /unauthorized|forbidden/i.test(last.source))) {
                        token = await fetchTempToken();
                        if (!token) {
                            return last;
                        }
                        last = await fetchPage(page, token);
                    }

                    return last;
                }

                return last;
            };

            let pages = 1;

            for (let page = 1; page <= pages && page <= MAX_PAGES; page++) {
                if (typeof progressCB === 'function') {
                    progressCB(`Resolving: ${baseUrl} (page ${page}/${pages})`);
                }

                const { source, status } = await tryFetchPage(page);

                if (status !== 200 || !source) {
                    break;
                }

                let j;
                try {
                    j = JSON.parse(source);
                } catch (e) {
                    break;
                }

                const gifs = Array.isArray(j?.gifs) ? j.gifs : (Array.isArray(j?.results) ? j.results : []);
                pages = Number(j?.pages) || pages;

                for (const g of gifs) {
                    const urls = g?.urls || g?.gif?.urls;
                    if (!urls) {
                        continue;
                    }

                    let best = null;

                    for (const k of preferredKeys) {
                        const v = urls[k];
                        if (typeof v === 'string' && /^https?:\/\//i.test(v)) {
                            best = v;
                            break;
                        }
                    }

                    if (!best) {
                        for (const v of Object.values(urls)) {
                            if (typeof v === 'string' && /^https?:\/\//i.test(v) && /\.mp4(\?|$)/i.test(v)) {
                                best = v;
                                break;
                            }
                        }
                    }

                    if (best) {
                        resolved.push(best);
                    }
                }

                if (!gifs.length) {
                    break;
                }

                await new Promise(r => setTimeout(r, 75));
            }

            if (!resolved.length) {
                return null;
            }

            return {
                folderName: username,
                resolved,
            };
        },
    ],
[
        [/redgifs\.com(\/|\\\/)(ifr|watch|gifs\/detail|gifs\/watch)/i],
        async (url, http) => {
            const raw = String(url || '');
            const idMatch =
                  raw.match(/redgifs\.com(?:\/|\\\/)(?:ifr(?:\/|\\\/)|watch(?:\/|\\\/)|gifs(?:\/|\\\/)detail(?:\/|\\\/))?([a-z0-9_-]+)/i) ||
                  raw.match(/\/([a-z0-9_-]+)(?:\?.*)?$/i);
            const id = (idMatch && idMatch[1] ? String(idMatch[1]) : '').match(/[a-z0-9_-]+/i)?.[0];

            if (!id) {
                return null;
            }

            const fetchTempToken = async () => {
                try {
                    const { source, status } = await http.get(
                        'https://api.redgifs.com/v2/auth/temporary',
                        {},
                        { __xfpd_timeout: 8000 },
                        'text',
                    );
                    if (status === 200 && source && h.contains('token', source)) {
                        const token = JSON.parse(source).token;
                        if (token) {
                            GM_setValue('redgifs_token', token);
                        }
                        return token || null;
                    }
                } catch (e) {}
                return null;
            };

            let token = GM_getValue('redgifs_token', null);
            if (!token) {
                token = await fetchTempToken();
            }
            if (!token) {
                return null;
            }

            const apiUrl = `https://api.redgifs.com/v2/gifs/${id}`;

            const fetchGif = async t => {
                try {
                    return await http.get(apiUrl, {}, { Authorization: `Bearer ${t}` }, 'text');
                } catch (e) {
                    return { source: null, status: 0 };
                }
            };

            let { source, status } = await fetchGif(token);

            if (status === 401 || status === 403 || (source && /unauthorized|forbidden/i.test(source))) {
                token = await fetchTempToken();
                if (!token) {
                    return null;
                }
                ({ source, status } = await fetchGif(token));
            }

            if (status !== 200 || !source) {
                return null;
            }

            let j;
            try {
                j = JSON.parse(source);
            } catch (e) {
                return null;
            }

            const urls = j?.gif?.urls || j?.urls;
            if (!urls) {
                return null;
            }

            const preferredKeys = ['hd', 'hd1080', 'hd720', 'sd', 'mp4'];
            for (const k of preferredKeys) {
                const v = urls[k];
                if (typeof v === 'string' && /^https?:\/\//i.test(v)) {
                    return v;
                }
            }

            for (const v of Object.values(urls)) {
                if (typeof v === 'string' && /\.mp4(\?|$)/i.test(v)) {
                    return v;
                }
            }

            return null;
        },
    ],

    [
        [/fs-\d+\.cyberdrop\.[a-z]{2,}\/|cyberdrop\.[a-z]{2,}\/a\//],
        async (url, http, passwords, postId, postSettings, progressCB) => {
            // Cyberdrop albums (/a/<id>) are HTML pages listing many /f/<id> file links.
            // Resolve the album to a list of signed CDN URLs via the file auth API (no per-file warm-up tabs).
            try {
                url = String(url || '').trim();
                if (url.startsWith('//')) url = 'https:' + url;
                if (!/^https?:\/\//i.test(url)) url = 'https://' + url.replace(/^\/+/, '');

                const albumIdMatch = url.match(/\/a\/([^\/?#]+)/i);
                const albumId = albumIdMatch ? albumIdMatch[1] : '';

                const pageUrl = url;
                let pageOrigin = 'https://cyberdrop.cr';
                try { pageOrigin = new URL(pageUrl).origin; } catch (e) {}

                const decodeHtml = (s) => {
                    try {
                        const t = document.createElement('textarea');
                        t.innerHTML = String(s || '');
                        return t.value;
                    } catch (e) {
                        return String(s || '');
                    }
                };

                const getAlbumHtml = async () => {
                    progressCB?.('Cyberdrop: loading album page');
                    const r = await http.get(pageUrl, {}, {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Referer': pageOrigin + '/',
                        'Origin': pageOrigin,
                    }, 'text');
                    return r && r.source ? r.source : '';
                };

                let html = await getAlbumHtml();

                const extractSlugs = (src) => {
                    const slugs = [];
                    const seen = new Set();
                    const re = /href\s*=\s*["'](?:https?:\/\/(?:[\w-]+\.)*cyberdrop\.[a-z.]+)?\/f\/([A-Za-z0-9_-]+)(?:[\/?#"'])/ig;
                    let m;
                    while ((m = re.exec(src || '')) !== null) {
                        const s = m[1];
                        if (s && !seen.has(s)) {
                            seen.add(s);
                            slugs.push(s);
                        }
                    }
                    return slugs;
                };

                let slugs = extractSlugs(html);

                // If the HTML is gated/empty, do a single warm-up of the album page and retry once.
                if (!slugs.length && typeof cyberdropWarmupOnce === 'function') {
                    await cyberdropWarmupOnce(pageUrl);
                    html = await getAlbumHtml();
                    slugs = extractSlugs(html);
                }

                if (!slugs.length) return url;

                const pickTitle = (src) => {
                    const m1 = src.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                               src.match(/content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
                    const m2 = src.match(/<h1[^>]*>([^<]+)<\/h1>/i);
                    const m3 = src.match(/<title[^>]*>([^<]+)<\/title>/i);
                    let t = (m1 && (m1[1] || m1[2])) || (m2 && m2[1]) || (m3 && m3[1]) || '';
                    t = decodeHtml(t).trim();
                    // Strip common site suffixes
                    t = t.replace(/\s*\|\s*CyberDrop.*$/i, '').replace(/\s*-\s*CyberDrop.*$/i, '').trim();
                    if (!t) t = albumId ? `cyberdrop_${albumId}` : 'cyberdrop_album';
                    return t;
                };

                const folderName = pickTitle(html);

                // Capture per-file names from the album page so downloads keep extensions.
                try {
                    const doc = new DOMParser().parseFromString(html, 'text/html');
                    const nodes = doc.querySelectorAll('a#file[href^="/f/"], a[id="file"][href^="/f/"], a[href^="/f/"][title][href^="/f/"]');
                    nodes.forEach((a) => {
                        const href = a.getAttribute('href') || '';
                        const m = href.match(/\/f\/([A-Za-z0-9]+)/);
                        if (!m) return;
                        const slug = m[1];
                        const nm = (a.getAttribute('title') || a.textContent || '').trim();
                        if (nm) cyberdropNameBySlug.set(slug, nm);
                    });
                } catch (e) { /* ignore */ }

                // Regex fallback (in case DOMParser is blocked).
                try {
                    const rxName = /href=["']\/f\/([A-Za-z0-9]+)["'][^>]*\btitle=["']([^"']+)["']/gi;
                    let m;
                    while ((m = rxName.exec(html)) !== null) {
                        const slug = m[1];
                        const nm = decodeHtml(m[2]).trim();
                        if (nm) cyberdropNameBySlug.set(slug, nm);
                    }
                } catch (e) { /* ignore */ }

                const host = (() => { try { return new URL(pageUrl).hostname; } catch (e) { return ''; } })();
                const root = (String(host || '').match(/cyberdrop\.[a-z]+$/i) || [null])[0];
                const apiBases = [];
                if (root) apiBases.push(`https://api.${root}`);
                apiBases.push('https://api.cyberdrop.cr');
                const apiBaseList = [...new Set(apiBases)];

                const resolved = [];
                for (let i = 0; i < slugs.length; i++) {
                    const slug = slugs[i];
                    progressCB?.(`Cyberdrop: resolving ${i + 1}/${slugs.length}`);

                    let j = null;

                    for (const base of apiBaseList) {
                        const apiUrl = `${base}/api/file/auth/${slug}`;

                        const r = await http.get(apiUrl, {}, {
                            'Accept': 'application/json, text/plain, */*',
                            'Origin': pageOrigin,
                            'Referer': pageOrigin + '/',
                        }, 'text');

                        if (!r || !r.source) continue;

                        try { j = JSON.parse(r.source); } catch (e) { j = null; }
                        if (j) break;
                    }

                    if (!j) continue;

                    let direct = null;
                    if (typeof j.url === 'string') direct = j.url;
                    else if (j.data && typeof j.data.url === 'string') direct = j.data.url;
                    else if (typeof j.file === 'string') direct = j.file;
                    else if (j.data && typeof j.data.file === 'string') direct = j.data.file;

                    if (typeof direct !== 'string' || !direct.trim()) continue;
                    direct = direct.trim();
                    if (direct.startsWith('//')) direct = 'https:' + direct;

                    if (!/^https?:\/\//i.test(direct)) continue;
                    resolved.push(direct);
                }

                if (!resolved.length) return url;

                return { folderName, resolved };
            } catch (e) {
                return url;
            }
        },
    ],
    [
        [/fs-\d+\.cyberdrop\.[a-z]{2,}\/|cyberdrop\.[a-z]{2,}\/(f|e)\//, /:!cyberdrop\.[a-z]{2,}\/a\//],
        async (url, http) => {
            // Cyberdrop embeds (/e/) expose the real file URL only after loading the /f/ page.
            // Preferred approach:
            //  1) Call the info API to get the signed CDN URL
            //  2) If blocked, briefly warm up /f/ in an inactive tab and retry once
            try {
                // Ensure absolute URL (some posts omit the scheme, e.g. "cyberdrop.cr/e/<slug>")
                url = String(url || '').trim();
                if (url.startsWith('//')) url = 'https:' + url;
                if (!/^https?:\/\//i.test(url)) url = 'https://' + url.replace(/^\/+/, '');

                // Normalize legacy fs-*/img-* hosts (old Cyberdrop mirrors)
                if (url.includes('fs-') || url.includes('img-')) {
                    url = url.replace(/(fs|img)-\d+/i, '').replace(/(to|cc|nl)-\d+/i, 'me');
                }

                const u = new URL(url);
                const origin = `${u.protocol}//${u.hostname}`;
                const slugMatch = String(url).match(/\/([ef])\/([^\/?#]+)/i);
                if (!slugMatch || !slugMatch[2]) {
                    // Not a /f/ or /e/ URL; return as-is.
                    return url;
                }

                const slug = slugMatch[2];
                const pageUrl = `${origin}/f/${slug}`;

                const apiCandidates = [];

                // New API style (observed on cyberdrop.cr): https://api.cyberdrop.cr/api/file/info/<slug>
                const root = (u.hostname.match(/cyberdrop\.[a-z]+$/i) || [null])[0];
                const apiBaseDefault = root ? `https://api.${root}` : 'https://api.cyberdrop.cr';
                if (root) {
                    apiCandidates.push(`https://api.${root}/api/file/info/${slug}`);
                    apiCandidates.push(`https://api.${root}/api/file/auth/${slug}`);
                }
                // Known working for cyberdrop.cr even if the embed is on /e/
                apiCandidates.push(`https://api.cyberdrop.cr/api/file/info/${slug}`);
                apiCandidates.push(`https://api.cyberdrop.cr/api/file/auth/${slug}`);
                // Additional API variants seen in the wild
                if (root) {
                    apiCandidates.push(`https://api.${root}/api/file/url/${slug}`);
                    apiCandidates.push(`https://api.${root}/api/file/${slug}`);
                    apiCandidates.push(`https://api.${root}/api/file/auth/${slug}`);
                }
                apiCandidates.push(`https://api.cyberdrop.cr/api/file/url/${slug}`);
                apiCandidates.push(`https://api.cyberdrop.cr/api/file/auth/${slug}`);
                apiCandidates.push(`https://api.cyberdrop.cr/api/file/${slug}`);

                // Legacy API style (older Cyberdrop): https://cyberdrop.me/api/f/<slug>
                apiCandidates.push(`${origin}/api/f/${slug}`);

                const headers = {
                    Accept: 'application/json, text/plain, */*',
                    Referer: `${origin}/`,
                    Origin: origin,
                };

                const cyberdropGmGetText = (reqUrl, hdrs) => new Promise(resolve => {
                    try {
                        GM_xmlhttpRequest({
                            method: 'GET',
                            url: String(reqUrl),
                            headers: hdrs || {},
                            responseType: 'text',
                            anonymous: false,
                            timeout: 6000,
                            onload: r => resolve({ status: r.status || 0, source: String(r.responseText || r.response || '') }),
                            onerror: () => resolve({ status: 0, source: '' }),
                            ontimeout: () => resolve({ status: 0, source: '' }),
                        });
                    } catch (e) {
                        resolve({ status: 0, source: '' });
                    }
                });

                const cyberdropFetchText = async reqUrl => {
                    let r = await cyberdropGmGetText(reqUrl, headers);
                    if ((r.status === 0) && (headers.Origin || headers.Referer)) {
                        r = await cyberdropGmGetText(reqUrl, { Accept: headers.Accept });
                    }
                    return r;
                };

                const fetchInfo = async () => {
                    const parseInfoText = (txt, baseHint) => {
                        const out = { direct: null, name: null, token: null, base: null, auth: null };
                        const s = String(txt || '');
                        const apiBase = (typeof baseHint === 'string' && /^https?:\/\//i.test(baseHint))
                            ? baseHint.replace(/\/$/, '')
                            : apiBaseDefault;
                        if (!s) return out;

                        // 1) Quick regex for absolute token URL (unescaped or JSON-escaped)
                        const rePlain = new RegExp(`https?:\/\/[^"'\\s]+\/api\/file\/d\/${slug}\?[^"'\\s]*token=[^"'\\s]+`, 'i');
                        let m = s.match(rePlain);
                        if (m && m[0]) out.direct = m[0];

                        if (!out.direct) {
                            const reEsc = new RegExp(`https?:\\/\\/[^"\\s]+\\/api\\/file\\/d\\/${slug}\\?[^"\\s]*token=[^"\\s]+`, 'i');
                            m = s.match(reEsc);
                            if (m && m[0]) out.direct = m[0].replace(/\\\//g, '/');
                        }

                        // 2) Relative token URL (e.g. "/api/file/d/<slug>?token=...")
                        if (!out.direct) {
                            const reRel1 = new RegExp(`\/api\/file\/d\/${slug}\?[^"'\\s]*token=[^"'\\s]+`, 'i');
                            m = s.match(reRel1);
                            if (m && m[0]) out.direct = `${apiBase}${m[0]}`;
                        }

                        if (!out.direct) {
                            const reRel2 = new RegExp(`api\/file\/d\/${slug}\?[^"'\\s]*token=[^"'\\s]+`, 'i');
                            m = s.match(reRel2);
                            if (m && m[0]) out.direct = `${apiBase}/${m[0].replace(/^\//, '')}`;
                        }

                        // 3) JSON parse + deep scan for filename and/or token/host components
                        try {
                            const j = JSON.parse(s);
                            const seen = new Set();

                            const looksLikeName = v => {
                                if (!v || typeof v !== 'string') return false;
                                if (v.length > 260) return false;
                                if (/^https?:\/\//i.test(v)) return false;
                                const base = v.split(/[\\/]/).pop();
                                return /^[^<>:"|?*\x00-\x1F]+\.[a-z0-9]{2,8}$/i.test(base);
                            };

                            const looksLikeJwt = v => {
                                if (!v || typeof v !== 'string') return false;
                                // Typical JWT: header.payload.sig (base64url)
                                if (/^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v)) return true;
                                return false;
                            };

                            const isTokenUrl = v => {
                                if (!v || typeof v !== 'string') return false;
                                return v.includes(`/api/file/d/${slug}`) && /token=/i.test(v);
                            };

                            const looksLikeBase = v => {
                                if (!v || typeof v !== 'string') return false;
                                // Accept origins or hostnames that look like Cyberdrop CDN
                                if (/gigachad-cdn\.ru/i.test(v) || /cyberdrop\./i.test(v)) return true;
                                if (/^k\d+-cd\./i.test(v)) return true;
                                return false;
                            };

                            const normalizeBase = v => {
                                try {
                                    const t = String(v || '').trim();
                                    if (!t) return null;
                                    if (/^https?:\/\//i.test(t)) {
                                        const uu = new URL(t);
                                        return `${uu.protocol}//${uu.hostname}`;
                                    }
                                    // plain hostname
                                    if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(t)) return `https://${t}`;
                                } catch (e) {}
                                return null;
                            };

                            const walk = (val, key = '') => {
                                if (val === null || val === undefined) return;

                                if (typeof val === 'string') {
                                    const v = val;

                                    if (isTokenUrl(v) && (!out.direct || v.length > out.direct.length)) out.direct = v;

                                    if (!out.name) {
                                        if (looksLikeName(v) || /(file)?name/i.test(String(key))) {
                                            const base = v.split(/[\\/]/).pop();
                                            if (looksLikeName(base)) out.name = base;
                                        }
                                    }

                                    // token can be stored separately (e.g. "token": "eyJ...")
                                    if (!out.token) {
                                        if (/(^|[^a-z])token([^a-z]|$)/i.test(String(key)) && looksLikeJwt(v)) {
                                            out.token = v;
                                        } else if (looksLikeJwt(v)) {
                                            // last resort: any JWT-looking string
                                            out.token = v;
                                        }
                                    }

                                    // auth URL can be provided separately (new API flow: info -> auth -> direct)
                                    if (!out.auth) {
                                        if (/(^|[^a-z])auth([^a-z]|$)/i.test(String(key)) && /\/api\/file\/auth\//i.test(v)) {
                                            out.auth = v;
                                        } else if (/\/api\/file\/auth\//i.test(v) && /cyberdrop/i.test(v)) {
                                            out.auth = v;
                                        }
                                    }

                                    if (!out.base && (/(cdn|host|domain|server|origin)/i.test(String(key)) || looksLikeBase(v))) {
                                        const b = normalizeBase(v);
                                        if (b) out.base = b;
                                    }

                                    return;
                                }

                                if (typeof val !== 'object') return;
                                if (seen.has(val)) return;
                                seen.add(val);

                                if (Array.isArray(val)) {
                                    for (const v of val) walk(v, key);
                                } else {
                                    for (const [k, v] of Object.entries(val)) walk(v, k);
                                }
                            };

                            walk(j, '');

                            // Common direct URL fields
                            if (!out.direct) {
                                const direct =
                                    (j &&
                                        (j.url ||
                                            j.downloadUrl ||
                                            j.download_url ||
                                            (j.data && (j.data.url || j.data.downloadUrl || j.data.download_url)) ||
                                            (j.file && (j.file.url || j.file.downloadUrl || j.file.download_url)) ||
                                            (j.data && j.data.file && (j.data.file.url || j.data.file.downloadUrl || j.data.file.download_url)))) ||
                                    null;
                                if (direct && typeof direct === 'string') out.direct = direct;
                            }

                            // Common auth URL fields (new Cyberdrop API flow: info -> auth -> direct)
                            if (!out.auth) {
                                const a =
                                    (j &&
                                        (j.auth_url ||
                                            j.authUrl ||
                                            (j.data && (j.data.auth_url || j.data.authUrl)) ||
                                            (j.file && (j.file.auth_url || j.file.authUrl)) ||
                                            (j.data && j.data.file && (j.data.file.auth_url || j.data.file.authUrl)))) ||
                                    null;
                                if (a && typeof a === 'string') out.auth = a;
                            }

                            // Common filename fields
                            if (!out.name) {
                                const n =
                                    (j &&
                                        (j.name ||
                                            j.filename ||
                                            j.fileName ||
                                            j.originalName ||
                                            (j.file && (j.file.name || j.file.filename || j.file.fileName || j.file.originalName)) ||
                                            (j.data && (j.data.name || j.data.filename || j.data.fileName || j.data.originalName)) ||
                                            (j.data && j.data.file && (j.data.file.name || j.data.file.filename || j.data.file.fileName || j.data.file.originalName)))) ||
                                    null;
                                if (n && typeof n === 'string' && looksLikeName(n)) out.name = n.split(/[\\/]/).pop();
                            }

                            // If we got token but not direct, try to build a direct URL
                            if (!out.direct && out.token) {
                                const tok = out.token.includes('%') ? out.token : encodeURIComponent(out.token);
                                const base = out.base || apiBase;
                                out.direct = `${base.replace(/\/$/, '')}/api/file/d/${slug}?token=${tok}`;
                            }
                        } catch (e) {}

                        // Normalize escaped slashes if needed
                        if (out.direct && typeof out.direct === 'string' && out.direct.includes('\\/')) {
                            out.direct = out.direct.replace(/\\\//g, '/');
                        }

                        // If out.direct is relative, make it absolute
                        if (out.direct && typeof out.direct === 'string' && out.direct.startsWith('/')) {
                            out.direct = `${apiBase}${out.direct}`;
                        }

                        // Normalize escaped slashes and relative auth URLs
                        if (out.auth && typeof out.auth === 'string' && out.auth.includes('\\/')) {
                            out.auth = out.auth.replace(/\\\//g, '/');
                        }
                        if (out.auth && typeof out.auth === 'string') {
                            if (out.auth.startsWith('/')) {
                                out.auth = `${apiBase}${out.auth}`;
                            } else if (!/^https?:\/\//i.test(out.auth) && /api\/file\/auth\//i.test(out.auth)) {
                                out.auth = `${apiBase}/${out.auth.replace(/^\/+/, '')}`;
                            }
                        }

                        return out;
                    };

                    for (const apiUrl of apiCandidates) {
                        try {
                            const { source, status } = await cyberdropFetchText(apiUrl);
                            if (status !== 200 || !source) continue;

                            let baseHint = apiBaseDefault;
                            try { baseHint = new URL(apiUrl).origin; } catch (e) {}
                            const { direct, name, auth } = parseInfoText(source, baseHint);

                            let resolvedName = name || null;
                            let resolvedDirect = direct || null;

                            // New flow: info returns auth_url; auth returns tokenized direct URL
                            if (!resolvedDirect && auth && typeof auth === 'string') {
                                const authUrl = auth;
                                try {
                                    const { source: authSource, status: authStatus } = await cyberdropFetchText(authUrl);
                                    if (authStatus === 200 && authSource) {
                                        let authBase = baseHint;
                                        try { authBase = new URL(authUrl).origin; } catch (e) {}
                                        const parsedAuth = parseInfoText(authSource, authBase);
                                        if (!resolvedName && parsedAuth && parsedAuth.name) resolvedName = parsedAuth.name;
                                        if (!resolvedDirect && parsedAuth && parsedAuth.direct) resolvedDirect = parsedAuth.direct;
                                    }
                                } catch (e) {}
                            }

                            if (resolvedName) cyberdropNameBySlug.set(String(slug), String(resolvedName));

                            if (resolvedDirect && typeof resolvedDirect === 'string') {
                                if (resolvedName) cyberdropNameByUrl.set(String(resolvedDirect), String(resolvedName));
                                return resolvedDirect;
                            }
                        } catch (e) {}
                    }
                    return null;
                };

                // 1st attempt: API directly (some setups need two requests for ddos-guard cookies)
                let directUrl = await fetchInfo();
                if (!directUrl) directUrl = await fetchInfo();
                if (directUrl) return directUrl;

                // Warm-up (only one tab at a time) then retry
                let warmKey = 'cyberdrop';
                try { warmKey = `cyberdrop:${new URL(pageUrl).origin}`; } catch (e) { }
                await cyberdropWarmupOnce(warmKey, pageUrl, CYBERDROP_WARMUP_DEFAULT_MS);

                directUrl = await fetchInfo();
                if (!directUrl) directUrl = await fetchInfo();
                return directUrl || url;
            } catch (e) {
                return url;
            }
        },
    ],
[
        [/noodlemagazine.com\/watch\//],
        async (url, http) => {
            const { dom } = await http.get(url);
            let playerIFrameUrl = dom.querySelector('#iplayer')?.getAttribute('src');

            if (!playerIFrameUrl) {
                return null;
            }

            playerIFrameUrl = playerIFrameUrl.replace('/player/', 'https://noodlemagazine.com/playlist/');

            const { source } = await http.get(playerIFrameUrl);

            // noinspection JSCheckFunctionSignatures
            const props = JSON.parse(source || JSON.stringify([]));

            if (props.sources && props.sources.length) {
                return props.sources[0].file;
            }

            return null;
        },
    ],
    [
        [/spankbang.com\/.*?\/video/],
        async (url, http) => {
            const { source } = await http.get(url);

            let streamData = h.re.matchAll(/(?<=stream_data\s=\s){.*?}.*?(?=;)/gis, source)[0].replace(/'/g, '"');

            streamData = JSON.parse(streamData);

            const qualities = ['240p', '320p', '480p', '720p', '1080p', '4k'].reverse();

            for (const quality of qualities) {
                if (streamData[quality].length) {
                    return streamData[quality][0];
                }
            }

            return null;
        },
    ],

    [
        [/imagebam.com\/(view|gallery)/],
        async (url, http) => {
            const date = new Date();
            date.setTime(date.getTime() + 6 * 60 * 60 * 1000);
            const expires = '; expires=' + date.toUTCString();
            const { source, dom } = await http.get(
                url,
                {},
                {
                    cookie: 'nsfw_inter=1' + expires + '; path=/',
                },
            );

            if (h.contains('gallery-name', source)) {
                const resolved = [];

                const imageLinksInput = dom.querySelector('.links.gallery > div:nth-child(2) > div > input');

                const rawImageLinks = h.re.matchAll(/(?<=\[URL=).*?(?=])/gis, imageLinksInput.getAttribute('value'));

                for (const link of rawImageLinks) {
                    const { dom } = await http.get(link);
                    resolved.push(dom?.querySelector('.main-image')?.getAttribute('src'));
                }

                return {
                    dom,
                    source,
                    folderName: dom?.querySelector('#gallery-name').innerText.trim(),
                    resolved,
                };
            } else {
                return dom?.querySelector('.main-image')?.getAttribute('src');
            }
        },
    ],

[[/images\d.imagebam.com/], url => url],
    [[/imgvb.com\/images\//, /:!imgvb.com\/album\//], url => url.replace('.th.', '.').replace('.md.', '.')],
    [
        [/imgvb.com\/album\//],
        async (url, http) => {
            const { source, dom } = await http.get(url);
            const resolved = [...dom.querySelectorAll('.image-container > img')]
            .map(i => i.getAttribute('src'))
            .map(url => url.replace('.th.', '.').replace('.md.', '.'));

            return {
                dom,
                source,
                folderName: dom?.querySelector('meta[property="og:title"]').content.trim(),
                resolved,
            };
        },
    ],
    [
        [/(\/attachments\/|\/data\/video\/|smgmedia\.socialmediagirls\.com\/)/i],
        async (url) => {
            // Normalize broken "https:///..." and accidental double-scheme cases.
            url = String(url || '').trim();
            url = url.replace(/^https?:\/\/https?:\/\//i, 'https://');
            url = url.replace(/^https?:\/\/\//i, '/');

            // If it's already absolute, keep it (don't rewrite hosts).
            if (/^https?:\/\//i.test(url)) return url;

            // Otherwise it's a path; prefix with the active forum's origin (SimpCity or SocialMediaGirls).
            if (!url.startsWith('/')) url = '/' + url;

            const currentOrigin =
                typeof location !== 'undefined' && location && /^https?:\/\//i.test(location.origin)
                    ? location.origin
                    : 'https://simpcity.cr';

            return `${currentOrigin}${url}`;
        },
    ],
    [[/(thumbs|images)(\d+)?.imgbox.com\//, /:!imgbox.com\/g\//], url => url.replace(/_t\./gi, '_o.').replace(/thumbs/i, 'images')],
    [
        [/imgbox.com\/g\//],
        async (url, http) => {
            const { source, dom } = await http.get(url);

            const resolved = [...dom?.querySelectorAll('#gallery-view-content > a > img')]
            .map(img => img.getAttribute('src'))
            .map(url => url.replace(/(thumbs|t)(\d+)\./gis, 'images$2.').replace('_b.', '_o.'));

            return {
                dom,
                source,
                folderName: dom?.querySelector('#gallery-view > h1').innerText.trim(),
                resolved,
            };
        },
    ],

[
    [/filester\.(me|sh|si|gg)\/f\//],
    async (url, http, spoilers, postId, postSettings, progressCB) => {
        try {
            url = String(url || '').trim();
            if (!url) return null;

            if (url.startsWith('//')) url = 'https:' + url;
            if (!/^https?:\/\//i.test(url)) url = 'https://' + url.replace(/^\/+/, '');

            const u0 = new URL(url);
            const origin = `${u0.protocol}//${u0.hostname}`;

            const mId = (u0.pathname || '').match(/\/f\/([^\/?#]+)/i);
            if (!mId || !mId[1]) return url;

            const albumId = mId[1];
            const baseUrl = `${origin}/f/${albumId}`;

            const resolved = [];
            const seen = new Set();

            let firstDom = null;
            let firstSource = '';
            let folderName = '';

            const MAX_PAGES = 500;

            const getFolderName = (dom, html) => {
                try {
                    const pickClean = (s) => {
                        s = String(s || '').trim();
                        if (!s) return '';

                        // Strip common suffixes.
                        s = s.replace(/\s*\|\s*filester\.(me|sh|si|gg)\s*$/i, '').trim();
                        s = s.replace(/\s*-\s*filester\.(me|sh|si|gg)\s*$/i, '').trim();

                        // Replace remaining pipes with a Windows-safe separator.
                        if (s.includes('|')) s = s.replace(/\s*\|\s*/g, ' - ').trim();

                        // Final cleanup
                        s = s.replace(/\s+/g, ' ').trim();

                        return s;
                    };

                    const isBad = (t) => {
                        const x = String(t || '').trim();
                        if (!x) return true;
                        if (/^filester\.(me|sh|si|gg)\b/i.test(x)) return true;
                        if (/BETA\s*\d/i.test(x)) return true;
                        return false;
                    };

                    let t = '';

                    // DOM: og:title first
                    try {
                        t = pickClean(dom?.querySelector('meta[property="og:title"]')?.getAttribute('content') || '');
                    } catch (e) {}
                    try {
                        if (!t) t = pickClean(dom?.querySelector('meta[name="og:title"]')?.getAttribute('content') || '');
                    } catch (e) {}
                    try {
                        if (!t) t = pickClean(dom?.querySelector('title')?.textContent || '');
                    } catch (e) {}

                    // HTML fallback (order-independent meta parsing)
                    if (isBad(t)) {
                        const s = String(html || '');
                        if (s) {
                            try {
                                const mTag =
                                    /<meta\b[^>]*\b(?:property|name)=["']og:title["'][^>]*>/i.exec(s) ||
                                    /<meta\b[^>]*\bcontent=["'][^"']+["'][^>]*\b(?:property|name)=["']og:title["'][^>]*>/i.exec(s);
                                if (mTag && mTag[0]) {
                                    const mC = /\bcontent=["']([^"']+)["']/i.exec(mTag[0]);
                                    if (mC && mC[1]) t = pickClean(mC[1]);
                                }
                            } catch (e) {}

                            try {
                                if (isBad(t)) {
                                    const mT = /<title[^>]*>\s*([^<]+?)\s*<\/title>/i.exec(s);
                                    if (mT && mT[1]) t = pickClean(mT[1]);
                                }
                            } catch (e) {}
                        }
                    }

                    if (isBad(t)) return albumId;
                    return t;
                } catch (e) {}
                return albumId;
            };

            const addHint = (slug, name, sizeBytes) => {
                try {
                    const dUrl = `${origin}/d/${slug}`;
                    if (name) {
                        try { filesterNameBySlug.set(String(slug), String(name)); } catch (e) {}
                        try { filesterNameByUrl.set(String(dUrl), String(name)); } catch (e) {}
                    }
                    if (sizeBytes) {
                        try { filesterSizeBySlug.set(String(slug), Number(sizeBytes)); } catch (e) {}
                        try { filesterSizeByUrl.set(String(dUrl), Number(sizeBytes)); } catch (e) {}
                    }
                    try { filesterSlugByUrl.set(String(dUrl), String(slug)); } catch (e) {}
                } catch (e) {}
            };

            const parsePage = (dom, html) => {
                const out = [];
                try {
                    const items = dom ? [...dom.querySelectorAll('div.file-item')] : [];
                    for (const el of items) {
                        let slug = '';
                        try {
                            const oc = String(el.getAttribute('onclick') || '');
                            const m = /\/d\/([^'"?\s]+)/i.exec(oc);
                            if (m && m[1]) slug = m[1];
                        } catch (e) {}

                        if (!slug) {
                            try {
                                const btn = el.querySelector('button.download-btn');
                                const oc2 = String(btn?.getAttribute?.('onclick') || '');
                                const m2 = /downloadFile\(\s*'([^']+)'/i.exec(oc2);
                                if (m2 && m2[1]) slug = m2[1];
                            } catch (e) {}
                        }

                        if (!slug) {
                            try {
                                const a = el.querySelector('a[href*="/d/"]');
                                const href = String(a?.getAttribute?.('href') || '');
                                const m3 = /\/d\/([^\/?#]+)/i.exec(href);
                                if (m3 && m3[1]) slug = m3[1];
                            } catch (e) {}
                        }

                        if (!slug) continue;

                        let name = '';
                        let size = 0;

                        try { name = String(el.getAttribute('data-name') || '').trim(); } catch (e) {}
                        if (!name) {
                            try { name = String(el.querySelector('.file-name')?.textContent || '').trim(); } catch (e) {}
                        }

                        try { size = Number(el.getAttribute('data-size') || 0) || 0; } catch (e) {}

                        out.push({ slug, name, size });
                    }
                } catch (e) {}

                // Regex fallback if DOM parsing is incomplete
                try {
                    const s = String(html || '');
                    if (s) {
                        const rx = /data-name="([^"]+)"[^>]*\bonclick="window\.location\.href='\/d\/([^']+)'/gi;
                        let m;
                        while ((m = rx.exec(s)) !== null) {
                            const name = String(m[1] || '').trim();
                            const slug = String(m[2] || '').trim();
                            if (!slug) continue;
                            out.push({ slug, name, size: 0 });
                        }
                    }
                } catch (e) {}

                return out;
            };

            for (let page = 1; page <= MAX_PAGES; page++) {
                const u = new URL(baseUrl);
                u.searchParams.set('page', String(page));
                const pageUrl = u.toString();

                if (typeof progressCB === 'function') {
                    progressCB(`[Filester] Resolving album page ${page}`);
                }

                let dom = null;
                let source = '';
                try {
                    const r = await http.get(pageUrl, {}, {
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    Referer: baseUrl,
                    __xfpd_withCredentials: true,
                });
                    dom = r?.dom;
                    source = r?.source || '';
                } catch (e) {
                    break;
                }

                if (page === 1) {
                    firstDom = dom;
                    firstSource = source;
                    folderName = getFolderName(dom, source);
                }

                const before = seen.size;

                const entries = parsePage(dom, source);
                for (const it of entries) {
                    const slug = String(it.slug || '').trim();
                    if (!slug || seen.has(slug)) continue;
                    seen.add(slug);

                    const name = String(it.name || '').trim();
                    const size = Number(it.size || 0) || 0;
                    addHint(slug, name, size);

                    resolved.push(`${origin}/d/${slug}`);
                }

                const added = seen.size - before;
                if (added <= 0) break;
            }

            if (!folderName) folderName = albumId;

            if (!resolved.length) return url;

            return { dom: firstDom, source: firstSource, folderName, resolved };
        } catch (e) {
            return url;
        }
    },
],
[
    [/filester\.(me|sh|si|gg)\/d\//],
    async (url, http, spoilers, postId, postSettings, progressCB) => {
        const slug = (() => {
            try {
                const u = new URL(url);
                const parts = String(u.pathname || '').split('/').filter(Boolean);
                return parts.length ? parts[parts.length - 1] : '';
            } catch (e) {
                // Group 1 is the TLD, group 2 is the slug. This returned m[1] and so yielded
                // "si"/"gg" as the slug for scheme-less links, which then collapsed every filename
                // to Filester_si.bin and made them all collide.
                const m = /filester\.(me|sh|si|gg)\/d\/([^\/?#]+)/i.exec(String(url || ''));
                return m && m[2] ? m[2] : '';
            }
        })();

        if (!slug) return null;

        // The URL patterns accept .me/.sh/.si/.gg, so follow whichever domain the post actually links
        // to rather than forcing every API call at .me.
        const apiBase = (() => {
            try {
                const u = new URL(url);
                if (/^(?:[a-z0-9-]+\.)*filester\.(me|sh|si|gg)$/i.test(u.hostname)) return `https://${u.hostname}`;
            } catch (e) {}
            return 'https://filester.me';
        })();

        const mkHeaders = () => ({
            Accept: 'application/json, text/plain, */*',
            'Content-Type': 'application/json;charset=UTF-8',
            Origin: apiBase,
            Referer: url,
            __xfpd_withCredentials: true,
            __xfpd_timeout: FILESTER_API_TIMEOUT_MS,
        });

        const safeJson = (txt) => {
            try { return JSON.parse(String(txt || '')); } catch (e) { return null; }
        };

        const walk = (obj, cb, maxNodes = 5000) => {
            const seen = new Set();
            const q = [obj];
            let nodes = 0;
            while (q.length && nodes++ < maxNodes) {
                const cur = q.shift();
                if (!cur || typeof cur !== 'object') continue;
                if (seen.has(cur)) continue;
                seen.add(cur);
                try {
                    if (cb(cur) === true) return true;
                } catch (e) {}
                if (Array.isArray(cur)) {
                    for (const it of cur) q.push(it);
                } else {
                    for (const k of Object.keys(cur)) q.push(cur[k]);
                }
            }
            return false;
        };

        const deepFindValueByKeys = (obj, keys) => {
            const keySet = new Set((keys || []).map(k => String(k).toLowerCase()));
            let out = null;
            walk(obj, (o) => {
                if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
                for (const k of Object.keys(o)) {
                    if (keySet.has(String(k).toLowerCase())) {
                        const v = o[k];
                        if (v !== null && v !== undefined) {
                            out = v;
                            return true;
                        }
                    }
                }
                return false;
            });
            return out;
        };

        const normalizeUrl = (s) => {
            if (!s || typeof s !== 'string') return null;
            const t = s.trim();
            if (/^https?:\/\//i.test(t)) return t;
            if (t.startsWith('/')) {
                try { return new URL(t, apiBase).href; } catch (e) { return null; }
            }
            if (/^[dv]\//i.test(t)) {
                try { return new URL('/' + t.replace(/^\/+/, ''), apiBase).href; } catch (e) { return null; }
            }
            return null;
        };

        const pickBestUrl = (obj) => {
            const candidates = [];
            const push = (v) => {
                const u = normalizeUrl(v);
                if (u) candidates.push(u);
            };

            const prefer = deepFindValueByKeys(obj, ['download_url', 'downloadUrl', 'url', 'link', 'href', 'direct', 'download', 'view_url', 'viewUrl']);
            if (prefer) push(prefer);

            walk(obj, (o) => {
                for (const k of Object.keys(o || {})) {
                    const v = o[k];
                    if (typeof v === 'string') push(v);
                }
                if (Array.isArray(o)) {
                    for (const it of o) if (typeof it === 'string') push(it);
                }
                return false;
            });

            const clean = candidates
                .map(s => String(s))
                .filter(s => !/filester\.(me|sh|si|gg)\/api\//i.test(s))
                .filter(s => !/filester\.(me|sh|si|gg)\/(css|js)\//i.test(s));

            if (!clean.length) return null;

            const score = (s) => {
                let sc = 0;
                // Strongly prefer CDN /v/ stream URLs.
                if (/https?:\/\/cache\d+\.filester\.(me|sh|si|gg)\/v\//i.test(s)) sc += 200;
                else if (/cache\d+\.filester\.(me|sh|si|gg)/i.test(s)) sc += 160;
                if (/\/v\//i.test(s)) sc += 80;
                if (/\.filester\.(me|sh|si|gg)\//i.test(s)) sc += 10;
                // De-prioritize HTML view tokens (/d/).
                if (/\/d\//i.test(s)) sc -= 25;
                if (/\.mp4(\?|$)/i.test(s)) sc += 2;
                return sc;
            };

            clean.sort((a, b) => score(b) - score(a));
            return clean[0];
        };

        const pickName = (obj) => {
            const v = deepFindValueByKeys(obj, ['filename', 'file_name', 'name', 'original_name', 'originalName', 'title']);
            if (typeof v === 'string' && v.trim()) return v.trim();
            return null;
        };

        const pickSize = (obj) => {
            const v = deepFindValueByKeys(obj, ['size', 'bytes', 'file_size', 'fileSize', 'length']);
            const n = Number(v);
            return Number.isFinite(n) ? n : 0;
        };

        let nameHint = null;
        let sizeHint = 0;
        let relViewPath = null;
        let streamUrlImmediate = null;

        const filesterExtFromCt = (ct) => {
            const t = String(ct || '').toLowerCase();
            if (t.includes('video/mp4')) return 'mp4';
            if (t.includes('video/webm')) return 'webm';
            if (t.includes('image/jpeg') || t.includes('image/jpg')) return 'jpg';
            if (t.includes('image/png')) return 'png';
            if (t.includes('image/gif')) return 'gif';
            if (t.includes('application/zip')) return 'zip';
            if (t.includes('application/x-7z-compressed')) return '7z';
            if (t.includes('application/x-rar') || t.includes('application/vnd.rar')) return 'rar';
            return 'bin';
        };

        const filesterParseViewMeta = (html) => {
            const out = { fileName: '', fileType: '' };
            const s = String(html || '');
            try {
                // Prefer JSON-style double-quoted assignment: window.fileName = "..."
                const m1 = /window\.fileName\s*=\s*("([^"\\]|\\.)*")\s*;?/m.exec(s);
                if (m1 && m1[1]) out.fileName = JSON.parse(m1[1]);
            } catch (e) {}
            try {
                // Fallback: single-quoted assignment: window.fileName = '...'
                if (!out.fileName) {
                    const m1b = /window\.fileName\s*=\s*'([^'\\]*(?:\\.[^'\\]*)*)'\s*;?/m.exec(s);
                    if (m1b && m1b[1]) out.fileName = String(m1b[1]).replace(/\\'/g, "'").replace(/\\n/g, "\n");
                }
            } catch (e) {}
            try {
                const m2 = /window\.fileType\s*=\s*("([^"\\]|\\.)*")\s*;?/m.exec(s);
                if (m2 && m2[1]) out.fileType = JSON.parse(m2[1]);
            } catch (e) {}
            try {
                if (!out.fileType) {
                    const m2b = /window\.fileType\s*=\s*'([^'\\]*(?:\\.[^'\\]*)*)'\s*;?/m.exec(s);
                    if (m2b && m2b[1]) out.fileType = String(m2b[1]).replace(/\\'/g, "'").replace(/\\n/g, "\n");
                }
            } catch (e) {}
            return out;
        };



        const filesterNormalizeFilename = (s) => {
            let name = String(s || '').trim();
            if (!name) return '';

            // If UTF-8 bytes were interpreted as Latin-1 (common in Chrome/Tampermonkey),
            // decode it back to proper UTF-8.
            try {
                let hasHigh = false;
                let allByte = true;
                for (let i = 0; i < name.length; i++) {
                    const c = name.charCodeAt(i);
                    if (c > 255) { allByte = false; break; }
                    if (c >= 128) hasHigh = true;
                }
                if (allByte && hasHigh && typeof TextDecoder !== 'undefined') {
                    const bytes = new Uint8Array(name.length);
                    for (let i = 0; i < name.length; i++) bytes[i] = name.charCodeAt(i) & 0xFF;
                    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
                    if (decoded && decoded !== name) name = decoded;
                }
            } catch (e) {}

            // Strip control chars (Windows will refuse these in filenames; mojibake often introduces them)
            name = name.replace(/[\u0000-\u001F\u007F\u0080-\u009F]/g, '').trim();
            return name;
        };

const filesterParseDispositionFilename = (headersRaw) => {
            try {
                const h = String(headersRaw || '');
                const mLine = /content-disposition:\s*([^\r\n]+)/i.exec(h);
                if (!mLine || !mLine[1]) return '';
                const v = String(mLine[1] || '');

                // RFC5987: filename*=UTF-8''...
                let m = /filename\*\s*=\s*([^;]+)/i.exec(v);
                if (m && m[1]) {
                    let val = String(m[1]).trim();
                    val = val.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');

                    const mEnc = /^([^']*)''(.*)$/.exec(val);
                    if (mEnc) {
                        let data = String(mEnc[2] || '').trim();
                        try {
                            data = decodeURIComponent(data.replace(/\+/g, '%20'));
                        } catch (e) {
                            // best-effort
                        }
                        if (data) return filesterNormalizeFilename(data);
                    } else {
                        try {
                            const decoded = decodeURIComponent(val.replace(/\+/g, '%20'));
                            if (decoded) return filesterNormalizeFilename(decoded);
                        } catch (e) {}
                        if (val) return filesterNormalizeFilename(val);
                    }
                }

                // Basic: filename="..."
                m = /filename\s*=\s*([^;]+)/i.exec(v);
                if (m && m[1]) {
                    let val = String(m[1]).trim();
                    val = val.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
                    val = val.replace(/\\(.)/g, '$1');
                    return filesterNormalizeFilename(val);
                }
            } catch (e) {}
            return '';
        };



        const filesterProbe = async (probeUrl) => {
            try {
                const r = await http.base(
                    'GET',
                    probeUrl,
                    { onResponseHeadersReceieved: () => {} },
                    { Range: 'bytes=0-0', Referer: `${apiBase}/`, __xfpd_withCredentials: true, __xfpd_timeout: FILESTER_PROBE_TIMEOUT_MS },
                    null,
                    'text',
                );
                const status = Number(r && r.status) || 0;
                const headers = String((r && r.responseHeaders) || '');
                const dispName = filesterParseDispositionFilename(headers);
                const mCt = /content-type:\s*([^\r\n]+)/i.exec(headers);
                const ct = (mCt && mCt[1]) ? mCt[1].trim() : '';
                const mCr = /content-range:\s*bytes\s+\d+-\d+\/(\d+)/i.exec(headers);
                const mCl = /content-length:\s*(\d+)/i.exec(headers);
                const size = mCr && mCr[1] ? Number(mCr[1]) : (mCl && mCl[1] ? Number(mCl[1]) : 0);
                const isHtmlOrJson = /text\/html|application\/xhtml\+xml|application\/json/i.test(ct);
                const ok = status >= 200 && status < 400 && !isHtmlOrJson;
                return { ok, status, headers, contentType: ct, size: Number.isFinite(size) ? size : 0, fileName: dispName || '' };
            } catch (e) {
                return { ok: false, status: 0, headers: '', contentType: '', size: 0 };
            }
        };

        const filesterResolveDownloadToken = async (tokenUrl) => {
            try {
                const ref = `${apiBase}/d/${slug}`;

                const normalizeMaybeUrl = (v) => {
                    try {
                        if (!v) return '';
                        const s = String(v).trim();
                        if (!s) return '';
                        if (s.startsWith('/')) return new URL(s, apiBase).href;
                        if (/^https?:\/\//i.test(s)) return s;
                        return '';
                    } catch (e) {
                        return '';
                    }
                };

                // Phase 1: range request (follows redirects) to capture finalUrl without downloading the whole file.
                const r1 = await http.base(
                    'GET',
                    tokenUrl,
                    {},
                    { Range: 'bytes=0-0', Referer: ref, __xfpd_withCredentials: true, __xfpd_timeout: FILESTER_API_TIMEOUT_MS },
                    null,
                    'text',
                );

                const headers1 = String((r1 && r1.responseHeaders) || '');
                const fu1 = String((r1 && r1.finalUrl) || '');

                const mLoc1 = /(?:^|\r?\n)location:\s*([^\r\n]+)/i.exec(headers1);
                const loc1Abs = normalizeMaybeUrl(mLoc1 && mLoc1[1] ? mLoc1[1] : '');
                if (loc1Abs && /\/v\//i.test(loc1Abs)) return loc1Abs;
                if (fu1 && /\/v\//i.test(fu1)) return fu1;

                // If this looks like HTML, fetch the full HTML page (small) and extract the /v/ link.
                const mCt1 = /content-type:\s*([^\r\n]+)/i.exec(headers1);
                const ct1 = (mCt1 && mCt1[1]) ? String(mCt1[1]).trim() : '';
                const isHtml = /text\/html|application\/xhtml\+xml/i.test(ct1);

                if (isHtml) {
                    const r2 = await http.base(
                        'GET',
                        tokenUrl,
                        {},
                        { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', Referer: ref, __xfpd_withCredentials: true, __xfpd_timeout: FILESTER_API_TIMEOUT_MS },
                        null,
                        'text',
                    );

                    const headers2 = String((r2 && r2.responseHeaders) || '');
                    const fu2 = String((r2 && r2.finalUrl) || '');

                    const mLoc2 = /(?:^|\r?\n)location:\s*([^\r\n]+)/i.exec(headers2);
                    const loc2Abs = normalizeMaybeUrl(mLoc2 && mLoc2[1] ? mLoc2[1] : '');
                    if (loc2Abs && /\/v\//i.test(loc2Abs)) return loc2Abs;
                    if (fu2 && /\/v\//i.test(fu2)) return fu2;

                    const body = String((r2 && r2.source) || '');

                    const mFull = /(https?:\/\/cache\d+\.filester\.(me|sh|si|gg)\/v\/[^\"'<>\s]+)/i.exec(body);
                    if (mFull && mFull[1]) return String(mFull[1]).trim();

                    const mRel = /[\"'](\/v\/[^\"'<>\s]+)[\"']/i.exec(body);
                    if (mRel && mRel[1]) return new URL(String(mRel[1]), apiBase).href;
                }

                return null;
            } catch (e) {
                return null;
            }
        };

        // --- v2 API (current) ---------------------------------------------------------------
        // Filester came back from its outage on a v2 public API and a new CDN. Everything below this
        // block talks to the old /api/public/* endpoints, which still answer 200 but hand back a
        // legacy-shaped payload whose server/download_url combination now 404s -- which is why
        // downloads were failing with "blocked/tiny response" while resolution looked like it worked.
        // See filesterResolveV2 for the endpoint shape; it is shared with the album (/f/) path,
        // which resolves its slugs at download time rather than here.
        try {
            const v2 = await filesterResolveV2(http, apiBase, slug, progressCB);
            if (v2 && v2.url) {
                // filesterResolveV2 keys its hints off the resolved URL; the original /d/ URL needs
                // the same name and referer so later lookups on it agree.
                try { filesterNameByUrl.set(String(url), String(v2.name)); } catch (e) {}
                try { filesterRefByUrl.set(String(url), String(v2.ref)); } catch (e) {}
                return v2.url;
            }
        } catch (e) {}

        // --- legacy v1 fallback -------------------------------------------------------------
        // Kept in case v2 is unavailable for a given file or domain. Everything from here down is
        // the pre-outage flow.
        try {
            if (progressCB) progressCB('[Filester] Fetching metadata...');
            const viewRes = await http.base(
                'POST',
                `${apiBase}/api/public/view`,
                {},
                mkHeaders(),
                JSON.stringify({ file_slug: slug }),
                'text',
            );
            const viewJson = safeJson(viewRes && viewRes.source);
            if (viewJson) {
                nameHint = pickName(viewJson) || nameHint;
                sizeHint = pickSize(viewJson) || sizeHint;
                try {
                    const relView = deepFindValueByKeys(viewJson, ['view_url', 'viewUrl', 'view']);
                    if (typeof relView === 'string' && relView.trim()) {
                        const s = String(relView).trim();
                        if (s.startsWith('/v/')) {
                            relViewPath = s;
                        } else if (s.startsWith('v/')) {
                            relViewPath = '/' + s;
                        } else if (/^https?:\/\//i.test(s)) {
                            try {
                                const u0 = new URL(s);
                                if (/^\/v\//i.test(String(u0.pathname || ''))) {
                                    relViewPath = String(u0.pathname || '') + String(u0.search || '');
                                }
                                // If the API already gave us a cache /v/ URL, keep it as an immediate candidate.
                                if (!streamUrlImmediate && /https?:\/\/cache6\.filester\.(me|sh|si|gg)\/v\//i.test(s)) {
                                    streamUrlImmediate = s;
                                }
                            } catch (e) {}
                        }
                    }
                } catch (e) {}
            }
        } catch (e) {}

        // Try to extract the real filename (window.fileName = "...") from the HTML view.
// Some Filester API responses don't include the filename, but the HTML view does.
try {
    // First try the slug page (it may redirect to /v/... or even directly to a cacheX /v/ stream).
    // We use it for both filename hints and to discover the real /v/ path when the public API is blocked.
    if (!nameHint || (!relViewPath && !streamUrlImmediate)) {
        const slugPageUrl = `${apiBase}/d/${slug}`;
        const htmlRes0 = await http.base(
            'GET',
            slugPageUrl,
            {},
            { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', __xfpd_withCredentials: true, __xfpd_timeout: FILESTER_API_TIMEOUT_MS },
            {},
            'text',
        );
        const html0 = String((htmlRes0 && htmlRes0.source) || '');
        const meta0 = filesterParseViewMeta(html0);
        if (meta0 && meta0.fileName) nameHint = String(meta0.fileName);

        // If this request ended up at a /v/ URL, capture it.
        try {
            const fu0 = String((htmlRes0 && htmlRes0.finalUrl) || '');
            if (fu0 && /\/v\//i.test(fu0)) {
                if (!streamUrlImmediate && /https?:\/\/cache6\.filester\.(me|sh|si|gg)\/v\//i.test(fu0)) {
                    streamUrlImmediate = fu0;
                }
                if (!relViewPath) {
                    try {
                        const u1 = new URL(fu0);
                        if (/^\/v\//i.test(String(u1.pathname || ''))) {
                            relViewPath = String(u1.pathname || '') + String(u1.search || '');
                        }
                    } catch (e) {}
                }
            }
        } catch (e) {}

        // Fallback: extract a /v/... token from the HTML itself.
        if (!streamUrlImmediate) {
            try {
                const mFull = /(https?:\/\/cache\d+\.filester\.(me|sh|si|gg)\/v\/[^\s"'<>]+)/i.exec(html0);
                if (mFull && mFull[1] && /https?:\/\/cache6\.filester\.(me|sh|si|gg)\/v\//i.test(mFull[1])) streamUrlImmediate = mFull[1];
            } catch (e) {}
        }
        if (!relViewPath) {
            try {
                const mRel = /["'](\/v\/[^"'<>\s]+)["']/i.exec(html0) || /(\/v\/[0-9a-f]{16,}[^"'<>\s]*)/i.exec(html0);
                if (mRel && mRel[1] && String(mRel[1]).startsWith('/v/')) relViewPath = mRel[1];
            } catch (e) {}
        }
    }

    // If still missing, try the explicit view_url returned by the API.
    if (!nameHint && relViewPath && /^\/v\//i.test(String(relViewPath))) {
        const viewPageUrl = `${apiBase}${relViewPath}`;
        const htmlRes = await http.base(
            'GET',
            viewPageUrl,
            {},
            { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', __xfpd_withCredentials: true, __xfpd_timeout: FILESTER_API_TIMEOUT_MS },
            {},
            'text',
        );
        const html = String((htmlRes && htmlRes.source) || '');
        const meta = filesterParseViewMeta(html);
        if (meta && meta.fileName) nameHint = filesterNormalizeFilename(String(meta.fileName));
    }
} catch (e) {}

                // Download API can return a /d/<token> which then redirects to the real /v/... stream URL.
        // Use it as a fallback to discover the stream path when /api/public/view doesn't provide it.
        try {
            if (!streamUrlImmediate && !relViewPath) {
                if (progressCB) progressCB('[Filester] Resolving download token...');
                const dlRes0 = await http.base(
                    'POST',
                    `${apiBase}/api/public/download`,
                    {},
                    mkHeaders(),
                    JSON.stringify({ file_slug: slug }),
                    'text',
                );

                const src0 = String((dlRes0 && dlRes0.source) || '');
                const dlJson0 = safeJson(src0);

                let tokenUrl = null;
                try {
                    const rel = dlJson0 ? deepFindValueByKeys(dlJson0, ['download_url', 'downloadUrl', 'url']) : null;
                    if (typeof rel === 'string' && rel.trim()) tokenUrl = normalizeUrl(rel);
                } catch (e) {}

                if (!tokenUrl) {
                    const m0 = /"download_url"\s*:\s*"([^"]+)"/i.exec(src0);
                    if (m0 && m0[1]) tokenUrl = normalizeUrl(m0[1]);
                }

                if (tokenUrl) {
                    // If the API returned a token (or /d/<token>), the actual stream is usually /v/<token> on cacheX.
                    // Build relViewPath early so the probe loop can find a working cache host (cache6 preferred).
                    try {
                        let tokenStr = '';
                        try {
                            const tk = dlJson0 ? deepFindValueByKeys(dlJson0, ['token']) : null;
                            if (typeof tk === 'string') tokenStr = String(tk).trim();
                        } catch (e) {}
                        if (!tokenStr) {
                            const mTok = /\/d\/([^\/\?#]+)/i.exec(String(tokenUrl || ''));
                            if (mTok && mTok[1]) tokenStr = String(mTok[1]).trim();
                        }
                        if (tokenStr && !relViewPath) {
                            if (tokenStr.startsWith('/v/')) relViewPath = tokenStr;
                            else if (tokenStr.startsWith('v/')) relViewPath = '/' + tokenStr;
                            else if (tokenStr.startsWith('/d/')) relViewPath = tokenStr.replace(/^\/d\//i, '/v/');
                            else if (tokenStr.startsWith('d/')) relViewPath = '/' + tokenStr.replace(/^d\//i, 'v/');
                            else relViewPath = `/v/${tokenStr}`;
                        }
                    } catch (e) {}

                    const sUrl = await filesterResolveDownloadToken(tokenUrl);
                    if (sUrl) {
                        try {
                            const u2 = new URL(sUrl);
                            if (/^\/v\//i.test(String(u2.pathname || ''))) {
                                relViewPath = String(u2.pathname || '') + String(u2.search || '');
                                if (/https?:\/\/cache6\.filester\.(me|sh|si|gg)\/v\//i.test(sUrl)) streamUrlImmediate = String(sUrl);
                            }
                        } catch (e) {
                            if (String(sUrl).startsWith('/v/')) relViewPath = String(sUrl);
                        }
                    }
                }
            }
        } catch (e) {}

// If we already discovered a cache /v/ stream URL from redirects or HTML, prefer it.
        try {
            if (streamUrlImmediate) {
                if (progressCB) progressCB('[Filester] Probing discovered stream URL...');
                const p0 = await filesterProbe(streamUrlImmediate);
                if (p0 && p0.ok) {
                    const streamUrl = String(streamUrlImmediate);
                    const streamCt = String(p0.contentType || '');
                    const streamSize = Number(p0.size || 0) || 0;
                    const streamHdrName = String((p0 && p0.fileName) || '');

                    try { filesterSlugByUrl.set(String(streamUrl), String(slug)); } catch (e) {}
                    try {
                        const ref0 = (relViewPath ? `${apiBase}${relViewPath}` : `${apiBase}/d/${slug}`);
                        if (ref0 && String(ref0).startsWith('http')) {
                            filesterRefByUrl.set(String(streamUrl), String(ref0));
                            filesterRefByUrl.set(String(url), String(ref0));
                            filesterRefByUrl.set(`${apiBase}/d/${slug}`, String(ref0));
                        }
                    } catch (e) {}
                    try { if (!nameHint && streamHdrName) nameHint = String(streamHdrName); } catch (e) {}

                    const ext = filesterExtFromCt(streamCt);
                    let finalName = '';
                    try { if (nameHint) finalName = String(nameHint); } catch (e) {}
                    if (!finalName) finalName = `Filester_${slug}.${ext || 'bin'}`;
                    try {
                        const hasExt = /\.[A-Za-z0-9]{1,8}$/.test(String(finalName || ''));
                        if (!hasExt && ext) finalName = `${finalName}.${ext}`;
                    } catch (e) {}

                    try {
                        filesterNameBySlug.set(String(slug), String(finalName));
                        filesterNameByUrl.set(String(streamUrl), String(finalName));
                        try { filesterNameByUrl.set(String(url), String(finalName)); } catch (e) {}
                        try { filesterNameByUrl.set(`${apiBase}/d/${slug}`, String(finalName)); } catch (e) {}
                        try { if (relViewPath) filesterNameByUrl.set(`${apiBase}${relViewPath}`, String(finalName)); } catch (e) {}
                    } catch (e) {}
                    if (streamSize) {
                        try {
                            filesterSizeBySlug.set(String(slug), Number(streamSize));
                            filesterSizeByUrl.set(String(streamUrl), Number(streamSize));
                        } catch (e) {}
                    }

                    return streamUrl;
                }
            }
        } catch (e) {}

        // Authoritative and fast: /api/public/download returns the current CDN URL directly (today
        // an fscN.cdn.cr one). This runs *before* the speculative host sweep below, because that
        // sweep guesses at which host serves /v/<token> and the new CDN does not use that path at
        // all -- so it always failed, after burning its whole budget on hosts that never answer.
        try {
            if (progressCB) progressCB('[Filester] Resolving download URL...');
            const dlRes = await http.base(
                'POST',
                `${apiBase}/api/public/download`,
                {},
                mkHeaders(),
                JSON.stringify({ file_slug: slug }),
                'text',
            );

            const src = String((dlRes && dlRes.source) || '');
            const dlJson = safeJson(src);
            let dlUrl = null;

            if (dlJson) {
                dlUrl = pickBestUrl(dlJson);
            }
            if (dlJson && !dlUrl) {
                try {
                    const rel = deepFindValueByKeys(dlJson, ['download_url', 'downloadUrl', 'url']);
                    if (typeof rel === 'string' && rel.startsWith('/')) dlUrl = `${apiBase}${rel}`;
                } catch (e) {}
            }

            if (dlJson && !dlUrl) {
                const waitRaw = deepFindValueByKeys(dlJson, ['wait', 'wait_time', 'waitSeconds', 'wait_seconds', 'seconds']);
                const waitSec = Number(waitRaw);
                if (Number.isFinite(waitSec) && waitSec > 0 && waitSec <= 300) {
                    try {
                        if (progressCB) progressCB(`[Filester] Waiting ${Math.ceil(waitSec)}s...`);
                    } catch (e) {}
                    await new Promise(r => setTimeout(r, Math.ceil(waitSec) * 1000));
                    const dlRes2 = await http.base(
                        'POST',
                        `${apiBase}/api/public/download`,
                        {},
                        mkHeaders(),
                        JSON.stringify({ file_slug: slug }),
                        'text',
                    );
                    const src2 = String((dlRes2 && dlRes2.source) || '');
                    const dlJson2 = safeJson(src2);
                    if (dlJson2) dlUrl = pickBestUrl(dlJson2);
                    if (!dlUrl) {
                        const m2 = /(https?:\/\/[^\s"'<>]+)/i.exec(src2);
                        if (m2 && m2[1]) dlUrl = m2[1];
                    }
                }
            }

            if (!dlUrl) {
                const m = /(https?:\/\/[^\s"'<>]+)/i.exec(src);
                if (m && m[1]) dlUrl = m[1];
            }

            if (dlUrl) {
                try { filesterSlugByUrl.set(String(dlUrl), String(slug)); } catch (e) {}

                if (nameHint) {
                    filesterNameBySlug.set(String(slug), String(nameHint));
                    filesterNameByUrl.set(String(dlUrl), String(nameHint));
                }
                if (sizeHint) {
                    filesterSizeBySlug.set(String(slug), Number(sizeHint));
                    filesterSizeByUrl.set(String(dlUrl), Number(sizeHint));
                }
                return dlUrl;
            }
        } catch (e) {}

        // Fallback only: probe for a /v/ stream URL by guessing the host. Still worth keeping for
        // the case where the download API is blocked or rate-limited, and because the /d/ token can
        // require a Filester referer (otherwise it returns not_whitelisted). Bounded by
        // FILESTER_PROBE_BUDGET_MS since most candidates are currently dead or black holes.
        try {
            if (relViewPath && /^\/v\//i.test(String(relViewPath))) {
                if (progressCB) progressCB('[Filester] Probing cache stream URL...');
                const bases = filesterStreamBases(apiBase);

                let streamUrl = null;
                let streamCt = '';
                let streamSize = 0;
                let streamHdrName = '';

                // Hard budget for the whole sweep. The authoritative /api/public/download call above
                // has already failed if we are here, so this is pure guesswork -- worth a few seconds,
                // never worth minutes.
                const probeDeadline = Date.now() + FILESTER_PROBE_BUDGET_MS;

                for (const base of bases) {
                    if (Date.now() > probeDeadline) break;
                    const cand = String(base).replace(/\/$/, '') + String(relViewPath);
                    const p = await filesterProbe(cand);
                    if (p && p.ok) {
                        streamUrl = cand;
                        streamCt = String(p.contentType || '');
                        streamSize = Number(p.size || 0) || 0;
                        streamHdrName = String((p && p.fileName) || '');
                        break;
                    }
                }

                if (streamUrl) {
                    try { filesterSlugByUrl.set(String(streamUrl), String(slug)); } catch (e) {}
                    try {
                        const ref0 = (relViewPath ? `${apiBase}${relViewPath}` : `${apiBase}/d/${slug}`);
                        if (ref0 && String(ref0).startsWith('http')) {
                            filesterRefByUrl.set(String(streamUrl), String(ref0));
                            filesterRefByUrl.set(String(url), String(ref0));
                            filesterRefByUrl.set(`${apiBase}/d/${slug}`, String(ref0));
                        }
                    } catch (e) {}
                    try { if (!nameHint && streamHdrName) nameHint = String(streamHdrName); } catch (e) {}
                    const ext = filesterExtFromCt(streamCt);
                    let finalName = '';
                    try { if (nameHint) finalName = String(nameHint); } catch (e) {}
                    if (!finalName) finalName = `Filester_${slug}.${ext || 'bin'}`;
                    try {
                        const hasExt = /\.[A-Za-z0-9]{1,8}$/.test(String(finalName || ''));
                        if (!hasExt && ext) finalName = `${finalName}.${ext}`;
                    } catch (e) {}

                    try {
                        filesterNameBySlug.set(String(slug), String(finalName));
                        filesterNameByUrl.set(String(streamUrl), String(finalName));
                    try { filesterNameByUrl.set(String(url), String(finalName)); } catch (e) {}
                    try { filesterNameByUrl.set(`${apiBase}/d/${slug}`, String(finalName)); } catch (e) {}
                    try { if (relViewPath) filesterNameByUrl.set(`${apiBase}${relViewPath}`, String(finalName)); } catch (e) {}

                    } catch (e) {}
                    if (streamSize) {
                        try {
                            filesterSizeBySlug.set(String(slug), Number(streamSize));
                            filesterSizeByUrl.set(String(streamUrl), Number(streamSize));
                        } catch (e) {}
                    }

                    return streamUrl;
                }
            }
        } catch (e) {}

        return null;
    },
],
    [
        [/m\.box\.com\//],
        async (url, http) => {
            const { source, dom } = await http.get(url);
            const files = [...dom.querySelectorAll('.files-item-anchor')].map(el => `https://m.box.com${el.getAttribute('href')}`);

            const resolved = [];

            for (const fileUrl of files) {
                const { source, dom } = await http.get(fileUrl);
                if (h.contains('image-preview', source)) {
                    resolved.push(dom.querySelector('.image-preview').getAttribute('src'));
                } else {
                    resolved.push(dom.querySelector('.mtl > a').getAttribute('href'));
                }
            }

            return {
                source,
                dom,
                folderName: dom.querySelector('.folder-nav-title')?.innerText.trim(),
                resolved: resolved.map(u => `https://m.box.com${u}`),
            };
        },
    ],
    [
        [/twimg.com\//],
        url => url.replace(/https?:\/\/pbs.twimg\.com\/media\/(.{1,15})(\?format=)?(.*)&amp;name=(.*)/, 'https://pbs.twimg.com/media/$1.$3'),
    ],
    [
        [/(disk\.)?yandex\.[a-z]+/],
        async (url, http) => {
            const { dom } = await http.get(url);

            const script = dom.querySelector('script[id="store-prefetch"]');

            if (!script) {
                return null;
            }

            const json = JSON.parse(script.innerText);

            let sk,
                hash = null;

            if (json && json.environment && json.resources) {
                sk = json.environment.sk;
                const resourcesKeys = Object.keys(json.resources);
                hash = json.resources[resourcesKeys[0]]?.hash;
            }

            const data = JSON.stringify({ hash, sk });

            const { source } = await http.post(
                'https://disk.yandex.ru/public/api/download-url',
                data,
                {},
                {
                    'Content-Type': 'text/plain',
                },
            );

            const response = JSON.parse(source);

            if (response && response.error !== 'true' && response.data) {
                return response.data.url;
            }

            return null;
        },
    ],
    [[/(\w+)?.redd.it/], url => url.replace(/&amp;/g, '&')],
];

const setProcessing = (isProcessing, postId) => {
    const p = processing.find(p => p.postId === postId);
    if (p) {
        p.processing = isProcessing;
    } else {
        processing.push({ postId, processing: isProcessing });
    }
};

const isPostProcessing = postId => !!processing.find(p => p.postId === postId && p.processing);

const activePostControllers = new Map();
const postLastLogs = new Map();
let compiledResolversCache = null;

const getCompiledResolvers = resolversList => {
    if (compiledResolversCache && compiledResolversCache.source === resolversList) {
        return compiledResolversCache.items;
    }
    const items = (resolversList || []).map(resolver => ({
        checks: (resolver[0] || []).map(pattern => {
            let strPattern = pattern.toString();
            const shouldMatch = !h.contains(':!', strPattern);
            strPattern = strPattern.replace(':!', '');
            return {
                shouldMatch,
                regex: h.re.toRegExp(h.re.toString(strPattern), 'is'),
            };
        }),
        resolverCB: resolver[1],
    }));
    compiledResolversCache = { source: resolversList, items };
    return items;
};

const copyTextToClipboard = async text => {
    try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (e) {}
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return !!ok;
    } catch (e) {
        return false;
    }
};

const appendCopyLogButton = (statusLabel, postId) => {
    const savedLog = postLastLogs.get(postId);
    if (!statusLabel || !savedLog) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'xfpd-copy-log-btn';
    btn.textContent = 'Copy Log';
    btn.addEventListener('click', async e => {
        e.preventDefault();
        e.stopPropagation();
        const ok = await copyTextToClipboard(savedLog);
        btn.textContent = ok ? 'Copied!' : 'Failed';
        setTimeout(() => {
            if (btn.isConnected) btn.textContent = 'Copy Log';
        }, 1600);
    });
    statusLabel.appendChild(btn);
};

const downloadPost = async (parsedPost, parsedHosts, enabledHostsCB, resolvers, getSettingsCB, statusUI, callbacks = {}) => {
    const { postId, postNumber } = parsedPost;
    if (isPostProcessing(postId)) {
        return;
    }

    const cancelController = callbacks.cancelController || {
        cancelled: false,
        abortHandlers: new Set(),
        cancel() {
            this.cancelled = true;
            this.abortHandlers.forEach(fn => {
                try { fn(); } catch (e) {}
            });
            this.abortHandlers.clear();
        },
    };
    const isCancelled = () => !!cancelController.cancelled;

    activePostControllers.set(postId, cancelController);
    setProcessing(true, postId);

    const postSettings = getSettingsCB();

    const enabledHosts = enabledHostsCB(parsedHosts);

    window.logs = window.logs.filter(l => l.postId !== postId);

    log.separator(postId);
    log.post.info(postId, `::Using ${enabledHosts.length} host(s)::: ${enabledHosts.map(h => h.name).join(', ')}`, postNumber);

    log.separator(postId);
    log.post.info(postId, `::Script version::: ${xfpdVersion}`, postNumber);
    log.post.info(postId, `::Preparing download::`, postNumber);

    let completed = 0;
    let succeededCount = 0;
    let failedCount = 0;
    const zip =
        typeof JSZip === 'function'
            ? new JSZip()
            : {
                  file() {},
                  async generateAsync() {
                      return new Blob();
                  },
              };
    let zipFileCount = 0;
    let resolved = [];

    const statusLabel = statusUI.status;
    const filePB = statusUI.filePB;
    const totalPB = statusUI.totalPB;

    h.ui.setElProps(statusLabel, {
        color: '#469cf3',
        marginBottom: '3px',
        fontSize: '12px',
    });

    h.ui.setElProps(filePB, {
        width: '0%',
        marginBottom: '1px',
    });

    h.ui.setElProps(totalPB, {
        width: '0%',
        marginBottom: '10px',
    });

    h.show(statusLabel);
    h.show(filePB);
    h.show(totalPB);

    h.ui.setText(statusLabel, 'Resolving...');



// Bunkr: capture filename hints from visible link text (works even when CF blocks /v/ pages).
try {
    const cc = parsedPost && parsedPost.contentContainer;
    if (cc && cc.querySelectorAll) {
        const strip = (s) => String(s || '').split('#')[0].split('?')[0];
        const normUrl = (u) => {
            u = String(u || '').replace(/&amp;/g, '&').trim();
            u = u.split(/[\s"'<>]/)[0].trim();
            if (u && !/^https?:\/\//i.test(u)) u = `https://${u}`;
            if (u.endsWith('/')) u = u.slice(0, -1);
            return u;
        };
        const extractName = (t) => {
            let s = String(t || '').replace(/\s+/g, ' ').trim();
            if (!s) return '';
            // If link text is itself a URL, it isn't a filename hint.
            if (/^https?:\/\//i.test(s)) return '';
            // Whole string looks like a filename (keep spaces).
            if (/\.[A-Za-z0-9]{1,8}$/.test(s) && s.length <= 200) return s;
            // Otherwise pick the last token-like filename.
            const m = s.match(/[^\\/:*?"<>|\s]+\.[A-Za-z0-9]{1,8}/g);
            if (m && m.length) {
                const cand = m[m.length - 1];
                if (cand && cand.length <= 200) return cand;
            }
            return '';
        };

        cc.querySelectorAll('a[href]').forEach(a => {
            const href0 = normUrl(a.getAttribute('href'));
            if (!href0) return;

            // only for bunkr-ish links (skip direct scdn links)
            if (!/bunkrr?r?\./i.test(href0)) return;
            if (/scdn\.st\//i.test(href0)) return;

            const nm = extractName(a.textContent || '');
            if (!nm) return;
            if (xfpdLooksLikeCfFilenameHint(nm)) return;

            bunkrNameByUrl.set(href0, nm);
            bunkrNameByUrl.set(strip(href0), nm);
        });

        cc.querySelectorAll('a[href*="goonbox.cr/img/"]').forEach(a => {
            const href0 = strip(normUrl(a.getAttribute('href')));
            if (!href0) return;

            const img = a.querySelector('img');
            const thumbUrl = img && (img.getAttribute('data-url') || img.getAttribute('src'));
            if (!thumbUrl) return;

            goonboxThumbByUrl.set(href0, thumbUrl);
        });
    }
} catch (e) {}

    try {
    log.post.info(postId, '::Url resolution started::', postNumber);

    const activeThreadKey =
        parsedPost && parsedPost.threadKey ? String(parsedPost.threadKey) : xfpdGetCurrentThreadKey();
    const threadTitle =
        parsedPost && parsedPost.threadTitle ? String(parsedPost.threadTitle) : parsers.thread.parseTitle();
    const useContentDedup = postSettings.contentDedup !== false;
    let dedupedCount = 0;
    let resolveFailedCount = 0;

    const canonicalizeMediaUrl = rawUrl => {
        const clean = String(rawUrl || '').trim().split('#')[0];
        if (!clean) return '';
        try {
            const u = new URL(clean, typeof location !== 'undefined' ? location.origin : 'https://simpcity.su');
            let host = (u.hostname || '').toLowerCase().replace(/^www\./, '');
            host = host.replace(/^simp\d+\.(cuckcapital\.cr)$/i, '$1');
            host = host.replace(/^jpe?g\d+\.(church|fish|fishing|pet|su|cr)$/i, 'jpg.$1');
            const path = u.pathname || '';
            if (
                /(?:cuckcapital\.cr|jpg\.(?:church|fish|fishing|pet|su|cr)|imagepond\.net|ibb\.co|pixhost\.|pixho\.st|postimg\.cc|pixxxels\.cc|imgbox\.com|putmega\.com|twimg\.com|redd\.it|coomer\.|kemono\.|cdn\.cr|bunkr|scdn\.st|turbocdn\.st|erome\.com|pixeldrain\.|pixeldra\.in|gofile\.io)$/i.test(
                    host,
                )
            ) {
                return `${host}${path}`;
            }
            return `${host}${path}${u.search || ''}`;
        } catch (e) {
            return clean;
        }
    };

    const totalResourcesToResolve = enabledHosts.reduce((acc, host) => acc + host.resources.length, 0);
    let resolvingIndex = 0;
    const compiledResolvers = getCompiledResolvers(resolvers);
    const passwords = parsedPost.spoilers.concat(parsedPost.spoilers.map(s => s.toLowerCase()));
    let lastResolveUiUpdate = 0;

    if (callbacks && typeof callbacks.onProgress === 'function') {
        callbacks.onProgress({ phase: 'resolving', completed: 0, total: totalResourcesToResolve, succeeded: 0, failed: 0 });
    }

    for (const host of enabledHosts.filter(host => host.resources.length)) {
        if (isCancelled()) break;
        const resources = host.resources;

        for (const resource of resources) {
            if (isCancelled()) break;
            resolvingIndex++;

            // Fast pre-resolution skip: if this single-file link was already downloaded in this thread,
            // skip making any HTTP resolution request at all!
            if (useContentDedup && host.type === 'single' && typeof xfpdHasSeenThreadUrl === 'function') {
                const origKey = canonicalizeMediaUrl(resource);
                if (origKey && xfpdHasSeenThreadUrl(origKey, activeThreadKey)) {
                    dedupedCount++;
                    log.post.info(postId, `::Skipped already-downloaded link (pre-resolve)::: ${resource}`, postNumber);
                    continue;
                }
            }
            const nowMs = Date.now();
            if (nowMs - lastResolveUiUpdate >= 50 || resolvingIndex === 1 || resolvingIndex === totalResourcesToResolve) {
                lastResolveUiUpdate = nowMs;
                h.ui.setElProps(statusLabel, { color: '#469cf3', fontWeight: 'bold' });
                h.ui.setText(statusLabel, `Resolving: ${resolvingIndex} / ${totalResourcesToResolve} 🢒 ${h.limit(resource, 80)}`);
                if (callbacks && typeof callbacks.onProgress === 'function') {
                    callbacks.onProgress({
                        phase: 'resolving',
                        completed: resolvingIndex,
                        total: totalResourcesToResolve,
                        succeeded: resolved.length,
                        failed: 0,
                    });
                }
            }

            for (let ri = 0; ri < compiledResolvers.length; ri++) {
                if (isCancelled()) break;
                const { checks, resolverCB } = compiledResolvers[ri];

                let matched = true;
                for (let ci = 0; ci < checks.length; ci++) {
                    const chk = checks[ci];
                    const hit = chk.regex.test(resource);
                    if ((chk.shouldMatch && !hit) || (!chk.shouldMatch && hit)) {
                        matched = false;
                        break;
                    }
                }

                if (!matched) {
                    continue;
                }

                let r = null;

                try {
                    const progressCB = t => {
                        try {
                            h.ui.setElProps(statusLabel, { color: '#469cf3', fontWeight: 'bold' });
                            h.ui.setText(statusLabel, t);
                        } catch (e) {}
                    };

                    r = await h.promise(resolve => resolve(resolverCB(resource, h.http, passwords, postId, postSettings, progressCB)));
                } catch (e) {
                    if (host.name === 'Cyberdrop' && /cyberdrop\.[a-z]{2,}\/a\//i.test(String(resource))) {
                        continue;
                    }
                    resolveFailedCount++;
                    log.post.error(postId, `::Error resolving::: ${resource}`, postNumber);
                    continue;
                }

                if (isCancelled()) break;

                if (h.isNullOrUndef(r)) {
                    resolveFailedCount++;
                    log.post.error(postId, `::Could not resolve::: ${resource}`, postNumber);
                    continue;
                }

                const addResolved = (url, folderName) => {
                    if (!resolved.length) {
                        log.separator(postId);
                    }

                    if (h.isObject(url)) {
                        resolved.push({
                            url: url.url,
                            host,
                            original: resource,
                            folderName: url.folderName,
                            forceUnzipped: false,
                            forceDirect: false,
                        });
                        log.post.info(postId, `::Resolved::: ${url.url}`, postNumber);
                    } else {
                        resolved.push({
                            url,
                            host,
                            original: resource,
                            folderName,
                            forceUnzipped: false,
                            forceDirect: false,
                        });
                        log.post.info(postId, `::Resolved::: ${url}`, postNumber);
                    }
                };

                if (h.isArray(r.resolved)) {
                    if (r.resolved.length === 0) {
                        resolveFailedCount++;
                    }
                    r.resolved.forEach(url => {
                        try {
                            addResolved(url, r.folderName);
                        } catch (e) {}
                    });
                } else {
                    addResolved(r, null);
                }

                const nowResolvedMs = Date.now();
                if (nowResolvedMs - lastResolveUiUpdate >= 50) {
                    lastResolveUiUpdate = nowResolvedMs;
                    h.ui.setElProps(statusLabel, { color: '#47ba24', fontWeight: 'bold' });
                    h.ui.setText(statusLabel, `Resolved: ${resolved.length}`);
                }
            }
        }
    }

    if (isCancelled()) {
        log.post.info(postId, '::Download cancelled during resolution::', postNumber);
        h.hide(filePB);
        h.hide(totalPB);
        h.ui.setElProps(statusLabel, { color: '#e8a838', fontWeight: 'bold' });
        h.ui.setText(statusLabel, 'Cancelled');
        h.show(statusLabel);
        if (callbacks && typeof callbacks.onCancel === 'function') {
            callbacks.onCancel(0, 0);
        }
        return;
    }

    if (resolved.length) {
        log.separator(postId);
    }

    log.post.info(postId, '::Url resolution completed::', postNumber);

    // Smart deduplication:
    // 1) If a post includes both single preview links AND an album link resolving to the exact same media,
    //    prefer the album entry (preserving album sequence & album metadata) and drop the duplicate preview.
    // 2) Deduplicate identical canonical URLs within the post and (when running Download Page) across selected posts.
    let runtimeDedupedCount = 0;
    {
        const validResolved = resolved.filter(r => r && r.url);
        const albumKeys = new Set();
        for (const item of validResolved) {
            if (item.folderName && String(item.folderName).trim() !== '') {
                const k = canonicalizeMediaUrl(item.url);
                if (k) albumKeys.add(k);
            }
        }

        const sharedSeen = callbacks && callbacks.sharedSeenKeys instanceof Set ? callbacks.sharedSeenKeys : null;
        const postSeen = new Set();
        const deduped = [];

        for (const item of validResolved) {
            const hasFolder = !!(item.folderName && String(item.folderName).trim() !== '');
            const key = canonicalizeMediaUrl(item.url);
            item._canonicalKey = key;
            if (!hasFolder && key && albumKeys.has(key)) {
                dedupedCount++;
                log.post.info(postId, `::Skipped single preview (already in album)::: ${item.url}`, postNumber);
                continue;
            }
            if (
                key &&
                (postSeen.has(key) ||
                    (sharedSeen && sharedSeen.has(key)) ||
                    (useContentDedup && typeof xfpdHasSeenThreadUrl === 'function' && xfpdHasSeenThreadUrl(key, activeThreadKey)))
            ) {
                dedupedCount++;
                log.post.info(postId, `::Skipped already-downloaded media URL::: ${item.url}`, postNumber);
                continue;
            }
            if (key) {
                postSeen.add(key);
                if (sharedSeen) sharedSeen.add(key);
            }
            deduped.push(item);
        }
        resolved = deduped;
    }

    // --- Smart Mirror Grouping & Video Quality Filtering ----------------------------------------
    // Handles multi-mirror posts (e.g. same file uploaded to Pixeldrain + Filester + GoFile + Bunkr)
    // and multi-resolution video posts (e.g. 2160p/4K + 1080p + 720p variants of the same video).
    const useSmartMirrors = postSettings.smartMirrors !== false;
    const videoQualityPref = String(postSettings.videoQuality || 'best');

    const getHostMirrorRank = item => {
        const hName = String((item && item.host && item.host.name) || '').toLowerCase();
        const u = String((item && item.url) || '').toLowerCase();
        if (hName === 'simpcity' || hName === 'smg' || hName === 'pomf2' || hName === 'imagepond' || hName === 'goonbox' || hName === 'jpgx') return 10;
        if (hName === 'gofile' || u.includes('gofile.io')) return 20;
        if (hName === 'pixeldrain' || u.includes('pixeldrain.') || u.includes('pixeldra.in')) return 30;
        if (hName === 'filester' || u.includes('filester.') || filesterSlugByUrl.has(String(item && item.url))) return 35;
        if (hName === 'bunkr' || u.includes('bunkr')) return 45;
        if (hName === 'cyberdrop' || hName === 'cyberfile' || u.includes('cyberdrop')) return 55;
        if (hName === 'turbo' || u.includes('turbo')) return 70;
        return 60;
    };

    const inferItemKnownFilename = item => {
        if (!item) return '';
        if (item.hintedFilename) return String(item.hintedFilename);
        const u = String(item.url || '');
        const orig = String(item.original || '');
        const strip = s => String(s || '').split('#')[0].split('?')[0].replace(/\/+$/, '');

        // 1. Host-resolved metadata maps
        const flSlug = filesterSlugByUrl.get(u) || '';
        const fromFilester = filesterNameByUrl.get(u) || filesterNameByUrl.get(orig) || (flSlug ? filesterNameBySlug.get(flSlug) : '');
        if (fromFilester && String(fromFilester).trim()) return String(fromFilester).trim();

        const mGf = u.match(/\/download\/(?:web|direct)\/([^\/?#]+)\//i);
        const gfName = (mGf && mGf[1] && gofileNameById.get(mGf[1])) || gofileNameByUrl.get(u) || '';
        if (gfName && String(gfName).trim()) return String(gfName).trim();

        const bkName = bunkrNameByUrl.get(u) || bunkrNameByUrl.get(strip(u)) || bunkrNameByUrl.get(orig) || bunkrNameByUrl.get(strip(orig)) || '';
        if (bkName && String(bkName).trim() && !xfpdLooksLikeCfFilenameHint(bkName)) return String(bkName).trim();

        const cdName = cyberdropNameByUrl.get(u) || '';
        if (cdName && String(cdName).trim()) return String(cdName).trim();

        const ipName = imagepondNameByUrl.get(u) || imagepondNameByUrl.get(strip(u)) || imagepondNameByUrl.get(orig) || imagepondNameByUrl.get(strip(orig)) || '';
        if (ipName && String(ipName).trim()) return String(ipName).trim();

        const mPd = /(?:pixeldrain\.com|pixeldrain\.net|pixeldra\.in)\/(?:api\/file|u)\/([^\/?#]+)/i.exec(u) ||
            /(?:pixeldrain\.com|pixeldrain\.net|pixeldra\.in)\/u\/([^\/?#]+)/i.exec(orig);
        if (mPd && mPd[1] && pixeldrainInfoById.has(mPd[1])) {
            const pdInfo = pixeldrainInfoById.get(mPd[1]);
            if (pdInfo && pdInfo.filename) return String(pdInfo.filename).trim();
        }

        // 2. Signed URL query parameters (?fn= on Turbo, &n= on Filester v2, ?f= on Kemono)
        try {
            const uo = new URL(u, typeof location !== 'undefined' ? location.origin : 'https://simpcity.su');
            for (const qk of ['fn', 'n', 'f', 'filename']) {
                const qv = uo.searchParams.get(qk);
                if (qv && /\.[A-Za-z0-9]{2,5}$/.test(qv.trim())) {
                    return qv.trim();
                }
            }
        } catch (e) {}

        // 3. Forum DOM anchor / unfurl card title hints
        const domHint =
            linkHintNameByUrl.get(orig) ||
            linkHintNameByUrl.get(strip(orig)) ||
            linkHintNameByUrl.get(u) ||
            linkHintNameByUrl.get(strip(u)) ||
            '';
        if (domHint && String(domHint).trim()) return String(domHint).trim();

        // 4. URL pathname basename if it carries a real extension (exclude bare /api/file/<id> paths)
        if (!/\/api\/(?:file|list)\//i.test(u)) {
            let base = h.basename(strip(u));
            try { base = decodeURIComponent(base); } catch (e) {}
            if (base && /\.[A-Za-z0-9]{2,5}$/.test(base) && !/^[0-9a-f-]{32,}\.[a-z0-9]+$/i.test(base)) {
                return base.trim();
            }
        }

        return '';
    };

    // Lightweight Pixeldrain /info probe ONLY when smartMirrors or videoQuality filtering is active
    // AND a Pixeldrain single-file link has no DOM card title yet (e.g. text link "[Mirror 1]").
    if ((useSmartMirrors || videoQualityPref !== 'all') && resolved.length > 1 && !isCancelled()) {
        for (const item of resolved) {
            if (isCancelled()) break;
            if (inferItemKnownFilename(item)) continue;
            const mPd = /(?:pixeldrain\.com|pixeldrain\.net|pixeldra\.in)\/api\/file\/([^\/?#]+)/i.exec(String(item.url || ''));
            if (!mPd || !mPd[1] || pixeldrainInfoById.has(mPd[1])) continue;
            try {
                const pdId = mPd[1];
                const pdRes = await h.http.get(`https://pixeldrain.com/api/file/${pdId}/info`, {}, { __xfpd_timeout: 6000 }, 'text');
                if (pdRes && pdRes.status === 200 && pdRes.source) {
                    const j = JSON.parse(String(pdRes.source));
                    const v = j && (j.value || j.data || j);
                    const pdName = String((v && (v.name ?? v.filename ?? v.title)) ?? (j && (j.name ?? j.filename)) ?? '').trim();
                    const pdSize = Number((v && (v.size ?? v.bytes)) ?? (j && (j.size ?? j.bytes)) ?? 0) || 0;
                    if (pdName) {
                        pixeldrainInfoById.set(pdId, { filename: pdName, size: pdSize });
                    }
                }
            } catch (e) {}
        }
    }

    // Attach inferred filenames onto resolved items so downloaders (including Pixeldrain) benefit from them.
    for (const item of resolved) {
        const knownName = inferItemKnownFilename(item);
        if (knownName) {
            item.hintedFilename = knownName;
        }
    }

    const buildMirrorFileKey = rawName => {
        let s = String(rawName || '').trim();
        if (!s) return '';
        try { if (/%[0-9A-Fa-f]{2}/.test(s)) s = decodeURIComponent(s); } catch (e) {}
        const ext = String(h.extension(s) || h.ext(s) || '').toLowerCase();
        if (!ext) return '';
        let stem = h.fnNoExt(s).toLowerCase();
        stem = stem.replace(/\s*\(online-video-cutter\.com\)\s*/gi, ' ');
        // Normalize spaces, underscores, dots, and hyphens into single underscores so
        // "Title s04 2160p h264.mp4" and "Title_s04_2160p_h264.mp4" match identically!
        const normStem = stem.replace(/[\s._\-]+/g, '_').replace(/^_+|_+$/g, '');
        if (normStem.length < 6) return '';
        // Never treat generic placeholder names ("video.mp4", "image_1.jpg", "download.zip") as mirrors of each other!
        if (/^(?:video|vid|clip|movie|scene|image|img|photo|pic|file|download|output|untitled|sample)_?\d*$/i.test(normStem)) {
            return '';
        }
        return `${normStem}.${ext}`;
    };

    const parseVideoResolutionVariant = rawName => {
        let s = String(rawName || '').trim();
        if (!s) return null;
        try { if (/%[0-9A-Fa-f]{2}/.test(s)) s = decodeURIComponent(s); } catch (e) {}
        const ext = String(h.extension(s) || h.ext(s) || '').toLowerCase();
        if (!ext || !/^(?:mp4|m4v|mkv|webm|mov|avi|wmv|flv|ts|m2ts|mpg|mpeg)$/i.test(ext)) {
            return null;
        }
        const stem = h.fnNoExt(s).toLowerCase();
        const rawTokens = stem.split(/[\s._\-()\[\]]+/).filter(Boolean);
        if (rawTokens.length < 2) return null;

        let detectedHeight = 0;
        const workTokens = [];

        for (const tok of rawTokens) {
            let resH = 0;
            const mP = /^(4320|2160|1440|1080|720|576|540|480|360|240)[pi]$/i.exec(tok);
            const mWxH = /^\d{3,4}x(4320|2160|1440|1080|720|576|540|480|360|240)$/i.exec(tok);
            if (mP) resH = Number(mP[1]);
            else if (mWxH) resH = Number(mWxH[1]);
            else if (tok === '8k') resH = 4320;
            else if (tok === '4k' || tok === 'uhd') resH = 2160;
            else if (tok === '2k' || tok === 'qhd') resH = 1440;
            else if (tok === 'fhd' || tok === 'fullhd') resH = 1080;

            if (resH > 0 && detectedHeight === 0) {
                detectedHeight = resH;
                continue;
            }
            // Strip pure video codec/hdr/fps encoding tags so 4K HEVC and 1080p H264 of the same scene match.
            if (/^(?:h264|x264|avc|h265|x265|hevc|av1|vp9|aac|mp3|10bit|8bit|hdr|sdr|60fps|30fps)$/i.test(tok)) {
                continue;
            }
            workTokens.push(tok);
        }

        if (!detectedHeight || !workTokens.length) return null;
        const workKey = workTokens.join('_');
        if (workKey.length < 5) return null;
        if (/^(?:video|vid|clip|movie|scene)_?\d*$/i.test(workKey)) return null;
        return { workKey, height: detectedHeight };
    };

    // Pass 1: Group mirrors of the exact same file across different hosts (primary + ordered fallbacks).
    if (useSmartMirrors && resolved.length > 1) {
        const groupsByMirrorKey = new Map();
        const orderedEntries = [];

        for (const item of resolved) {
            // Only group standalone items (or items from the same folder context) with a valid mirrorFileKey.
            const hasFolder = !!(item.folderName && String(item.folderName).trim() !== '');
            const mKey = !hasFolder ? buildMirrorFileKey(item.hintedFilename || '') : '';
            if (!mKey) {
                orderedEntries.push({ single: item });
                continue;
            }
            if (!groupsByMirrorKey.has(mKey)) {
                const bucket = [];
                groupsByMirrorKey.set(mKey, bucket);
                orderedEntries.push({ groupKey: mKey, bucket });
            }
            groupsByMirrorKey.get(mKey).push(item);
        }

        const merged = [];
        for (const entry of orderedEntries) {
            if (entry.single) {
                merged.push(entry.single);
                continue;
            }
            const bucket = entry.bucket;
            if (bucket.length === 1) {
                merged.push(bucket[0]);
                continue;
            }
            bucket.sort((a, b) => getHostMirrorRank(a) - getHostMirrorRank(b));
            const primary = bucket[0];
            const fallbacks = bucket.slice(1);
            primary.mirrorFallbacks = (primary.mirrorFallbacks || []).concat(fallbacks);
            dedupedCount += fallbacks.length;
            log.post.info(
                postId,
                `::Mirror group (${bucket.length} mirrors for "${primary.hintedFilename || entry.groupKey}") -> primary: ${primary.host.name}, fallback(s): ${fallbacks.map(f => f.host.name).join(', ')}::`,
                postNumber,
            );
            merged.push(primary);
        }
        resolved = merged;
    }

    // Pass 2: Filter multi-resolution variants of the same video according to postSettings.videoQuality.
    if (videoQualityPref !== 'all' && resolved.length > 1) {
        const resGroups = new Map();
        const slots = [];

        for (const item of resolved) {
            const hasFolder = !!(item.folderName && String(item.folderName).trim() !== '');
            const info = !hasFolder ? parseVideoResolutionVariant(item.hintedFilename || '') : null;
            if (!info) {
                slots.push({ single: item });
                continue;
            }
            item._resHeight = info.height;
            if (!resGroups.has(info.workKey)) {
                const list = [];
                resGroups.set(info.workKey, list);
                slots.push({ workKey: info.workKey, list });
            }
            resGroups.get(info.workKey).push(item);
        }

        const pickPreferredVariant = variants => {
            // Sort highest resolution first; ties broken by host priority rank.
            const sorted = variants.slice().sort((a, b) => (b._resHeight - a._resHeight) || (getHostMirrorRank(a) - getHostMirrorRank(b)));
            if (videoQualityPref === 'best') {
                return sorted[0];
            }
            const cap = videoQualityPref === '1080p' ? 1080 : videoQualityPref === '720p' ? 720 : 99999;
            const withinCap = sorted.filter(v => v._resHeight <= cap);
            if (withinCap.length > 0) {
                // Highest resolution <= cap
                return withinCap[0];
            }
            // If all available versions exceed cap (e.g. only 2160p exists), pick the smallest one above cap so we never drop the video!
            return sorted[sorted.length - 1];
        };

        const qualityFiltered = [];
        for (const slot of slots) {
            if (slot.single) {
                qualityFiltered.push(slot.single);
                continue;
            }
            const variants = slot.list;
            const distinctHeights = new Set(variants.map(v => v._resHeight));
            if (variants.length <= 1 || distinctHeights.size <= 1) {
                qualityFiltered.push(...variants);
                continue;
            }
            const chosen = pickPreferredVariant(variants);
            const others = variants
                .filter(v => v !== chosen)
                .sort((a, b) => Math.abs(a._resHeight - chosen._resHeight) - Math.abs(b._resHeight - chosen._resHeight));

            // Keep unselected resolutions (and their mirrors) as last-resort fallbacks if smartMirrors is ON!
            if (useSmartMirrors && others.length) {
                const extraFallbacks = [];
                for (const other of others) {
                    extraFallbacks.push(other);
                    if (Array.isArray(other.mirrorFallbacks) && other.mirrorFallbacks.length) {
                        extraFallbacks.push(...other.mirrorFallbacks);
                    }
                }
                chosen.mirrorFallbacks = (chosen.mirrorFallbacks || []).concat(extraFallbacks);
            }

            dedupedCount += others.length;
            log.post.info(
                postId,
                `::Video Quality (${videoQualityPref}) -> selected ${chosen._resHeight}p (${chosen.hintedFilename || chosen.url}), skipped ${others.map(o => `${o._resHeight}p`).join(', ')}::`,
                postNumber,
            );
            qualityFiltered.push(chosen);
        }
        resolved = qualityFiltered;
    }

    let totalDownloadable = resolved.filter(r => r.url).length;

    const totalResources = enabledHosts.reduce((acc, h) => h.resources.length + acc, 0);

    h.ui.setElProps(statusLabel, { color: '#47ba24', fontWeight: 'bold' });
    h.ui.setText(
        statusLabel,
        `Resolved: ${totalDownloadable}${dedupedCount > 0 ? ` (${dedupedCount} dupes skipped)` : ''} 🢒 ${totalResources} Total Links`,
    );

    const filenames = [];
    const mimeTypes = [];

    const XFPD_PHOTO_EXTS = new Set([
        'jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'heic', 'heif', 'jfif', 'jpe', 'svg', 'tif', 'tiff', 'jif', 'jxl',
    ]);
    const XFPD_VIDEO_EXTS = new Set([
        'mp4', 'm4v', 'mkv', 'webm', 'mov', 'avi', 'wmv', 'flv', 'ts', 'm2ts', 'mpg', 'mpeg', '3gp', 'avchd', 'mpv', 'ogv', 'ogg', 'qt', 'mpe', 'm4p', 'swf',
    ]);

    const formatPostOrderTag = rawPostNum => {
        const s = String(rawPostNum || '1').trim().replace(/^#/, '');
        if (/^\d+$/.test(s)) {
            return `P${s.padStart(4, '0')}`;
        }
        const mDisc = /^D(\d+)$/i.exec(s);
        if (mDisc) {
            return `PD${mDisc[1].padStart(3, '0')}`;
        }
        return `P${s.replace(/[^A-Za-z0-9_-]/g, '') || '0001'}`;
    };

    const cleanAlbumLabel = rawFolder => {
        let f = String(rawFolder || '').trim();
        if (!f) return '';
        f = f.replace(/^(?:goonbox|bunkr|cyberdrop|filester|imagepond|pixhost|imgbox|ibb|putmega|erome)[_-]+/i, '');
        f = f.replace(/\.[A-Za-z0-9]{5,8}$/, '');
        f = f.trim();
        // Ignore bare short random IDs (e.g. "aHSQr5") that carry no human-readable album name.
        if (/^[A-Za-z0-9]{4,8}$/.test(f)) return '';
        return f;
    };

    const classifyMediaBucket = (fileName, contentTypeHint, hostCategoryHint) => {
        const extLower = String(h.extension(fileName) || h.ext(fileName) || '').toLowerCase();
        if (extLower && XFPD_VIDEO_EXTS.has(extLower)) return 'Videos';
        if (extLower && XFPD_PHOTO_EXTS.has(extLower)) return 'Photos';
        const ct = String(contentTypeHint || '').toLowerCase();
        if (ct.startsWith('video/')) return 'Videos';
        if (ct.startsWith('image/')) return 'Photos';
        const hc = String(hostCategoryHint || '').toLowerCase();
        if (hc.includes('video')) return 'Videos';
        if (hc.includes('image')) return 'Photos';
        return 'Archives';
    };

    const resolveEffectiveLayout = () => {
        if (postSettings.folderLayout && ['media', 'post', 'post-media', 'flat', 'albums'].includes(postSettings.folderLayout)) {
            return postSettings.folderLayout;
        }
        if (postSettings.organizeMedia !== false) return 'media';
        return postSettings.flatten ? 'flat' : 'albums';
    };

    const firstAlbumHint = (() => {
        for (const it of resolved) {
            const lbl = cleanAlbumLabel(it && it.folderName);
            if (lbl) return lbl;
        }
        return '';
    })();

    const buildPostSubfolderName = sanitizeSegFn => {
        const postTag = formatPostOrderTag(postNumber);
        let label = String(parsedPost.postCaption || '').trim();
        if (label && threadTitle && label.toLowerCase() === String(threadTitle).trim().toLowerCase()) {
            label = '';
        }
        if (!label && firstAlbumHint) {
            label = firstAlbumHint;
        }
        if (!label) {
            return postTag;
        }
        const cleanLbl = sanitizeSegFn(label, '').replace(/[-_. ]+$/g, '').trim();
        if (!cleanLbl || cleanLbl === 'file' || cleanLbl === '_') {
            return postTag;
        }
        const trimmedLbl = cleanLbl.length > 75 ? cleanLbl.slice(0, 75).trim().replace(/[-_. ]+$/g, '') : cleanLbl;
        return sanitizeSegFn(`${postTag} - ${trimmedLbl}`, postTag);
    };

    const buildTargetRelativePath = ({
        basename,
        folderName,
        seqIndex,
        subSeqTag = '',
        contentType,
        hostCategory,
        sanitizeSegFn,
        sanitizePathFn,
    }) => {
        const layout = resolveEffectiveLayout();

        if (layout === 'media' || layout === 'post' || layout === 'post-media') {
            const bucket = classifyMediaBucket(basename, contentType, hostCategory);
            const postTag = formatPostOrderTag(postNumber);
            const seqWidth = Math.max(3, String(totalDownloadable || 1).length);
            const seqTag = String(seqIndex || 1).padStart(seqWidth, '0');

            const ext = String(h.extension(basename) || h.ext(basename) || '').trim();
            let stem = ext ? h.fnNoExt(basename) : String(basename || 'file');
            try {
                if (/%[0-9A-Fa-f]{2}/.test(stem)) {
                    stem = decodeURIComponent(stem);
                }
            } catch (e) {}
            // Strip common online converter watermark noise while preserving meaningful names.
            stem = stem.replace(/\s*\(online-video-cutter\.com\)\s*/gi, ' ').replace(/\s+/g, ' ').trim();

            const albumLabel = cleanAlbumLabel(folderName);
            const looksOpaqueStem =
                /^[0-9a-f]{12,}$/i.test(stem) ||
                /^[0-9a-f]{8}-[0-9a-f-]{13,}$/i.test(stem) ||
                /^\d{1,6}$/.test(stem) ||
                /^(?:image|img|photo|video|file)[_-]?\d*$/i.test(stem);

            // In unified 'media' mode, inject album label onto opaque stems; in 'post'/'post-media' mode,
            // only inject if the post folder didn't already use that album label!
            const postFolder = layout === 'media' ? '' : buildPostSubfolderName(sanitizeSegFn);
            if (albumLabel && looksOpaqueStem && (layout === 'media' || !postFolder.includes(albumLabel.slice(0, 20)))) {
                const shortAlbum = albumLabel.length > 70 ? albumLabel.slice(0, 70).trim() : albumLabel;
                stem = `${shortAlbum} - ${stem}`;
            }

            const basePrefix = layout === 'media' ? `${postTag}_${seqTag}` : seqTag;
            const filePrefix = subSeqTag ? `${basePrefix}_${subSeqTag}` : basePrefix;
            stem = sanitizeSegFn(stem || 'file');
            const maxStemLen = Math.max(24, 155 - filePrefix.length - (ext ? ext.length + 4 : 3));
            if (stem.length > maxStemLen) {
                stem = stem.slice(0, maxStemLen).trim().replace(/[. ]+$/g, '');
            }

            const finalFile = ext ? `${filePrefix} - ${stem}.${ext}` : `${filePrefix} - ${stem}`;

            if (layout === 'media') {
                return sanitizePathFn(`${bucket}/${finalFile}`);
            }
            if (layout === 'post') {
                return postSettings.zipped ? sanitizePathFn(finalFile) : sanitizePathFn(`${postFolder}/${finalFile}`);
            }
            // layout === 'post-media'
            return postSettings.zipped
                ? sanitizePathFn(`${bucket}/${finalFile}`)
                : sanitizePathFn(`${postFolder}/${bucket}/${finalFile}`);
        }

        const folder = folderName || '';
        let rel = basename;
        if (layout === 'albums' && folder && folder.trim() !== '') {
            rel = `${folder}/${basename}`;
        }
        return sanitizePathFn(rel);
    };

    // Windows-safe sanitizers (used for folder/zip names). Kept local to downloadPost so it has access to settings.
    const sanitizeWinSegment = (seg, fallback = 'file') => {
        let s = String(seg ?? '').trim();


        // If emojis are disabled, strip emoji/pictographs for consistent behavior across hosts.
        if (settings?.naming?.allowEmojis === false) {
            try {
                s = s.replace(/\p{Extended_Pictographic}/gu, '');
            } catch (e) {
                // Fallback: strip surrogate pairs (covers most emoji)
                s = s.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '');
            }
            // Remove variation selectors + ZWJ
            s = s.replace(/[\uFE0E\uFE0F\u200D]/g, '');
        }

        // Replace Windows-invalid chars and control chars.
        const sub = (settings?.naming?.invalidCharSubstitute ?? '-');
        s = s
            .replace(/[\u0000-\u001f\u007f]/g, '')
            .replace(/[<>:"/\\|?*]/g, sub)
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/[. ]+$/g, ''); // no trailing dots/spaces on Windows

        if (!s) s = String(fallback || 'file');

        // Avoid reserved device names on Windows.
        if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(s)) s = `_${s}`;

        // Very long segments can cause path issues; keep it reasonable.
        if (s.length > 180) s = s.slice(0, 180).trim();

        return s;
    };

    const sanitizeWinPath = (p) => {
        const parts = String(p ?? '')
            .split('/')
            .map(x => sanitizeWinSegment(x, ''))
            .filter(Boolean);
        return parts.join('/');
    };

    const usedPaths = new Set();

    const ensureUniquePath = path => {
        let p = String(path || '').trim();
        if (!p) {
            p = 'file';
        }

        if (!usedPaths.has(p)) {
            usedPaths.add(p);
            return p;
        }

        const parts = p.split('/');
        const base = parts.pop();
        const dir = parts.length ? parts.join('/') : '';
        const ext = h.ext(base);
        const stem = ext ? h.fnNoExt(base) : base;

        let i = 2;
        while (true) {
            const candidateBase = ext ? `${stem} (${i}).${ext}` : `${stem} (${i})`;
            const candidate = dir ? `${dir}/${candidateBase}` : candidateBase;
            if (!usedPaths.has(candidate)) {
                usedPaths.add(candidate);
                return candidate;
            }
            i++;
        }
    };

    const usedFlatNames = new Set();

    const ensureUniqueFlatName = name => {
        let n = String(name || '').trim();
        if (!n) {
            n = 'file';
        }

        if (!usedFlatNames.has(n)) {
            usedFlatNames.add(n);
            return n;
        }

        const ext = h.ext(n);
        const stem = ext ? h.fnNoExt(n) : n;

        let i = 2;
        while (true) {
            const candidate = ext ? `${stem} (${i}).${ext}` : `${stem} (${i})`;
            if (!usedFlatNames.has(candidate)) {
                usedFlatNames.add(candidate);
                return candidate;
            }
            i++;
        }
    };

    log.separator(postId);
    log.post.info(postId, `::Found ${totalDownloadable} resource(s)::`, postNumber);
    log.separator(postId);

    let customFilename = postSettings.output.find(o => o.postId === postId)?.value;

    if (customFilename) {
        customFilename = customFilename.replace(/:title:/g, threadTitle);
        customFilename = customFilename.replace(/:#:/g, postNumber);
        customFilename = customFilename.replace(/:id:/g, postId);
    }

    if (postSettings.skipDuplicates) {
        const unique = [];
        for (const r of resolved.filter(r => r.url).sort((a, b) => (a.host.type !== 'folder' || b.host.type !== 'folder' ? -1 : 1))) {
            const filename = h.basename(r.url);
            if (unique.find(u => u.filename.toLowerCase() === filename.toLowerCase())) {
                log.post.info(postId, `::Skipped duplicate::: ${filename} ::from:: ${r.url}`, postNumber);
                continue;
            }
            unique.push({ ...r, filename });
        }

        if (unique.length !== resolved.length) {
            h.ui.setText(statusLabel, `Removed ${resolved.length - unique.length} duplicates...`);
            unique.forEach(u => delete u.filename);
            resolved = unique;
            totalDownloadable = resolved.length;
        }
    }

    const isFF = window.isFF;

    if (!postSettings.skipDownload) {
        const resources = resolved.filter(r => r.url);
        totalDownloadable = resources.length;
        resources.forEach((item, idx) => {
            item._seqIndex = idx + 1;
        });

        // Limit bunkr links to a single concurrent download.
        let batchLength = resolved.some(file => /(turbocdn\.st|turbo\.cr|turbovid\.cr)/i.test(file.url)) ? 1 : (resolved.some(file => /(bunkrr?\.\w+)|(bunkr-cache)/.test(file.url)) ? 1 : 2);

        let currentBatch = 0;

        const batches = [];

        // Build batches:
// - keep existing concurrency (batchLength) for speed
// - but never put more than ONE GoFile item in the same batch (prevents GoFile "gate" spam / soft-block cascades)
const isGoFileUrlBatch = u => /gofile\.io/i.test(String(u || ''));

let tmp = [];
let tmpHasGoFile = false;

for (const item of resources) {
    const isGF = isGoFileUrlBatch(item.url);
    // if current batch is full OR would contain 2x GoFile -> flush
    if (tmp.length >= batchLength || (tmpHasGoFile && isGF)) {
        batches.push(tmp);
        tmp = [];
        tmpHasGoFile = false;
    }

    tmp.push(item);
    if (isGF) tmpHasGoFile = true;
}

if (tmp.length) {
    batches.push(tmp);
        }

        const getNextBatch = () => {
            const batch = currentBatch < batches.length ? batches[currentBatch] : [];
            currentBatch++;
            return batch;
        };

        const requestProgress = [];

        const requests = [];

        let completedBatchedDownloads = 0;

        let batchWakeResolver = null;
        const notifyBatchStep = () => {
            if (batchWakeResolver) {
                const fn = batchWakeResolver;
                batchWakeResolver = null;
                fn();
            }
        };
        const waitBatchTurn = ms =>
            new Promise(resolve => {
                let done = false;
                const finish = () => {
                    if (done) return;
                    done = true;
                    if (batchWakeResolver === finish) batchWakeResolver = null;
                    resolve();
                };
                batchWakeResolver = finish;
                setTimeout(finish, ms);
            });

        const finishBatchItem = didSucceed => {
            if (completed < totalDownloadable) {
                completed++;
            }
            if (didSucceed === 'dedup') {
                dedupedCount++;
                runtimeDedupedCount++;
            } else if (didSucceed) {
                succeededCount++;
            } else {
                failedCount++;
            }
            completedBatchedDownloads++;
            if (callbacks && typeof callbacks.onProgress === 'function') {
                try {
                    callbacks.onProgress({
                        phase: 'downloading',
                        completed,
                        total: totalDownloadable,
                        succeeded: succeededCount,
                        failed: failedCount,
                    });
                } catch (e) {}
            }
            notifyBatchStep();
        };

        cancelController.abortHandlers.add(() => {
            for (const p of requestProgress) {
                try { clearInterval(p.intervalId); } catch (e) {}
            }
            for (const r of requests) {
                try { r.request && r.request.abort(); } catch (e) {}
            }
            notifyBatchStep();
        });

        let cyberdropDirectWarmupDone = false;

        {
            const GOFILE_WARMUP_MS = 3000;

            // Turbo: if a signed turbocdn URL stalls (no progress), re-sign and retry quickly before falling back.
            const TURBO_STALL_MS = 5000;
            const TURBO_RESIGN_RETRIES = 3;    // number of re-sign + retry attempts
            const TURBO_DIRECT_FALLBACKS = 1;  // number of direct-download fallbacks after re-sign retries
            const TURBO_RETRY_DELAY_MS = 600;   // small pause before re-sign retry
            const TURBO_DIRECT_DELAY_MS = 800;  // small pause before DIRECT fallback
            const turboRetryState = new Map(); // key -> { resign: n, direct: n }

            const isTurboUrl = u => /turbocdn\.st|turbo\.cr|turbovid\.cr/i.test(String(u || ''));

            const turboExtractId = u => {
                const s = String(u || '');
                const m = s.match(/\/\/(?:[\w-]+\.)?turbo\.cr\/(?:v|d|embed)\/([^\/?#]+)/i) ||
                          s.match(/\/\/(?:[\w-]+\.)?turbovid\.cr\/(?:v|d|embed)\/([^\/?#]+)/i);
                return (m && m[1]) ? m[1] : '';
            };

            const turboExtractFn = u => {
                const s = String(u || '');
                const m = s.match(/[?&]fn=([^&]+)/i);
                if (m && m[1]) {
                    try { return decodeURIComponent(m[1].replace(/\+/g, '%20')); } catch (e) { return m[1]; }
                }
                return '';
            };

            const gmGetTextWithHeaders = (getUrl, headers) => new Promise(resolve => {
                try {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: getUrl,
                        headers: headers || {},
                        onload: r => resolve({ ok: true, status: r.status, text: r.responseText || '' }),
                        onerror: () => resolve({ ok: false, status: 0, text: '' }),
                        ontimeout: () => resolve({ ok: false, status: 0, text: '' }),
                    });
                } catch (e) {
                    resolve({ ok: false, status: 0, text: '' });
                }
            });

            const turboResignSignedUrl = async (turboId, currentUrl) => {
                if (!turboId) return null;

                const embedUrl = `https://turbo.cr/embed/${turboId}`;
                const keepFn = turboExtractFn(currentUrl) || '';

                try {
                    const j = await xfpdTurboFetchSignJsonWithTimeout(turboId, embedUrl);
                    if (j && j.url) {
                        let signed = j.url;
                        const name = (j.original_filename || keepFn || '').toString();
                        if (signed && name && !/[?&]fn=/i.test(String(signed))) {
                            const enc = encodeURIComponent(String(name)).replace(/%20/g, '+');
                            signed += (signed.includes('?') ? '&' : '?') + 'fn=' + enc;
                        }
                        try { turboIdBySignedUrl.set(String(signed), String(turboId)); } catch (e) {}
                        return signed;
                    }
                } catch (e) {}

                return null;
            };
            const isGoFileUrl = u => /gofile\.io/i.test(String(u || ''));
            const isPixeldrainUrl = u => /(?:pixeldrain\.com|pixeldrain\.net|pixeldra\.in)/i.test(String(u || ''));
            const isImagebamCdnUrl = u => /https?:\/\/(?:images|thumbs)\d+\.imagebam\.com\//i.test(String(u || ''));
            const imagebamRefererForCdn = u => {
                try {
                    const uu = new URL(String(u || ''), location.origin);
                    const base = (uu.pathname || '').split('/').pop() || '';
                    const id = base.replace(/\.[a-z0-9]+$/i, '');
                    return id ? `https://www.imagebam.com/view/${id}` : 'https://www.imagebam.com/';
                } catch (e) {
                    return 'https://www.imagebam.com/';
                }
            };
            const gofileWarmupAttempted = new Set();
            // url -> highest pass number currently authoritative. GM_xmlhttpRequest's abort()
            // isn't always reliable once a blob response is substantially buffered, so a
            // "stalled" pass-1 request can still fire onload after we've already moved on to a
            // warm-up retry -- checked in the blob onload handler to stop that stale pass from
            // also saving the file (duplicate download alongside the retry's result).
            const gofileActivePass = new Map();
            const CYBERDROP_WARMUP_MS = 1500;

            const BLOB_MAX_BYTES = Math.floor(1.6 * 1024 * 1024 * 1024);
            const BUNKR_DIRECT_MIN_BYTES = 500 * 1024 * 1024;
            const preflightMetaCache = new Map();
            // Windows-safe filenames for GM_download (Chrome is stricter than Firefox).
            const WIN_ILLEGAL_RE = /[<>:"\/\\|?*\x00-\x1F]/g;

            const sanitizeWinSegment = (s) => {
                const sub = (settings && settings.naming && settings.naming.invalidCharSubstitute) ? settings.naming.invalidCharSubstitute : '_';
                let out = String(s || '');

                // If emojis are disabled, strip emoji/pictographs for consistent behavior across hosts.
                if (settings?.naming?.allowEmojis === false) {
                    try {
                        out = out.replace(/\p{Extended_Pictographic}/gu, '');
                    } catch (e) {
                        // Fallback: strip surrogate pairs (covers most emoji)
                        out = out.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '');
                    }
                    // Remove variation selectors + ZWJ
                    out = out.replace(/[\uFE0E\uFE0F\u200D]/g, '');
                }
                out = out.replace(WIN_ILLEGAL_RE, sub);
                // Remove remaining control chars / oddities
                out = out.replace(/[\x00-\x08\x0E-\x1F\x7F]/g, '');
                // Windows also hates trailing dots/spaces in path segments
                out = out.replace(/[\. ]+$/g, '').replace(/^[\. ]+/g, '');
                if (!out) out = '_';
                // Avoid reserved device names
                if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(out)) out = '_' + out;
                return out;
            };

            const sanitizeWinPath = (p) => {
                return String(p || '').split('/').map(sanitizeWinSegment).join('/');
            };


            const headerValue = (headers, name) => {
                try {
                    const re = new RegExp(`^${name}:\\s*([^\\r\\n]+)`, 'im');
                    const m = re.exec(headers || '');
                    return m && m[1] ? String(m[1]).trim() : '';
                } catch (e) { return ''; }
            };

            const parseDispositionFilename = headers => {
                const hRaw = headers || '';
                // RFC 5987 filename*=UTF-8''...
                let m = /filename\*\s*=\s*UTF-8''([^;\r\n]+)/i.exec(hRaw);
                if (m && m[1]) {
                    const raw = String(m[1]).trim().replace(/^"|"$/g, '');
                    try { return decodeURIComponent(raw); } catch (e) { return raw; }
                }
                m = /filename\s*=\s*"([^"\r\n]+)"/i.exec(hRaw) || /filename\s*=\s*([^;\r\n]+)/i.exec(hRaw);
                if (m && m[1]) return String(m[1]).trim().replace(/^"|"$/g, '');
                return '';
            };

            const gmHead = (headUrl, reflink) => new Promise(resolve => {
                try {
                    GM_xmlhttpRequest({
                        method: 'HEAD',
                        url: headUrl,
                                                onload: r => resolve({ ok: true, status: r.status, headers: r.responseHeaders || '' }),
                        onerror: () => resolve({ ok: false, status: 0, headers: '' }),
                        ontimeout: () => resolve({ ok: false, status: 0, headers: '' }),
                    });
                } catch (e) {
                    resolve({ ok: false, status: 0, headers: '' });
                }
            });

            const gmGetText = (getUrl, reflink) => new Promise(resolve => {
                try {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: getUrl,
                                                onload: r => resolve({ ok: true, status: r.status, text: r.responseText || '' }),
                        onerror: () => resolve({ ok: false, status: 0, text: '' }),
                        ontimeout: () => resolve({ ok: false, status: 0, text: '' }),
                    });
                } catch (e) {
                    resolve({ ok: false, status: 0, text: '' });
                }
            });

            const extractNum = v => {
                const n = Number(v);
                return Number.isFinite(n) ? n : 0;
            };

            const preflightMeta = async (dlUrl, reflink, isGoFile, isPixeldrain) => {
                const key = `${dlUrl}`;
                if (preflightMetaCache.has(key)) return preflightMetaCache.get(key);

                const meta = { size: 0, filename: '', status: 0, contentType: '', headers: '' };

                try {
                    if (isPixeldrain) {
                        const mFile = /(?:pixeldrain\.com|pixeldrain\.net|pixeldra\.in)\/api\/file\/([^\/?#]+)/i.exec(dlUrl || '');
                        if (mFile && mFile[1]) {
                            const pdId = mFile[1];
                            if (pixeldrainInfoById.has(pdId)) {
                                const cachedPd = pixeldrainInfoById.get(pdId);
                                meta.size = extractNum(cachedPd.size);
                                meta.filename = String(cachedPd.filename || '');
                            } else {
                                const pdOrigin = (() => {
                                    try {
                                        const uu = new URL(dlUrl || '', location.origin);
                                        const host = String(uu.hostname || '').toLowerCase();
                                        if (host.endsWith('pixeldrain.net')) return 'https://pixeldrain.net';
                                        if (host.endsWith('pixeldra.in')) return 'https://pixeldra.in';
                                        return 'https://pixeldrain.com';
                                    } catch (e) {
                                        return 'https://pixeldrain.com';
                                    }
                                })();
                                const infoUrl = `${pdOrigin}/api/file/${pdId}/info`;
                                const r = await gmGetText(infoUrl, reflink);
                                if (r.ok && r.text) {
                                    try {
                                        const j = JSON.parse(r.text);
                                        const v = j && (j.value || j.data || j);
                                        meta.size = extractNum((v && (v.size ?? v.bytes ?? v.length)) ?? (j && (j.size ?? j.bytes)));
                                        meta.filename = String((v && (v.name ?? v.filename ?? v.title)) ?? (j && (j.name ?? j.filename)) ?? '');
                                        if (meta.filename) {
                                            pixeldrainInfoById.set(pdId, { filename: meta.filename, size: meta.size });
                                        }
                                    } catch (e) {}
                                }
                            }
                        }
                    }


                    // Filester hints (API gives name/size but the CDN URL may not include them)
                    try {
                        if (!meta.size) {
                        let hintedSize = 0;
                        try {
                            // Prefer slug-based hints (from /f/ album page) when available.
                            const s0 = String(filesterSlugByUrl.get(String(dlUrl)) || '');
                            hintedSize = Number(filesterSizeBySlug.get(s0) || filesterSizeByUrl.get(String(dlUrl)) || 0) || 0;
                        } catch (e) { hintedSize = 0; }
                        if (hintedSize) meta.size = extractNum(hintedSize);
                    }
                    if (!meta.filename) {
                        let hintedName = '';
                        try {
                            const s0 = String(filesterSlugByUrl.get(String(dlUrl)) || '');
                            hintedName = String(filesterNameBySlug.get(s0) || filesterNameByUrl.get(String(dlUrl)) || '');
                        } catch (e) { hintedName = ''; }
                        if (hintedName) meta.filename = String(hintedName);
                    }
                    } catch (e) {}

                    // Fallback HEAD (works for GoFile store links and Pixeldrain list ZIPs)
                    const nameHasExt = /\.[A-Za-z0-9]{1,8}$/.test(String(meta.filename || ''));
                    const isFilester = /(?:^https?:\/\/)?(?:cache\d+\.)?filester\.(me|sh|si|gg)\/v\//i.test(String(dlUrl || ''));
                    const needHead = !!(isGoFile || isPixeldrain || (!isFilester && (!meta.size || !meta.filename || !nameHasExt)));
                    if (needHead) {
                        const hRes = await gmHead(dlUrl, reflink);
                        meta.status = hRes.status || 0;
                        meta.headers = hRes.headers || '';
                        meta.contentType = headerValue(meta.headers, 'content-type');
                        const cl = headerValue(meta.headers, 'content-length');
                        if (!meta.size && cl) meta.size = extractNum(cl);
                        if (!meta.filename) {
                            const cdName = parseDispositionFilename(meta.headers);
                            if (cdName) meta.filename = cdName;
                        }
                    }                } catch (e) {}

                preflightMetaCache.set(key, meta);
                return meta;
            };

            // Filester album policy (location stays unchanged; this only decides ZIP vs DIRECT per file).
            // Rules:
            // - Zipped ON:
            //   * If album contains images + other files:
            //       - If total (all files) <= ~1.6GB AND all sizes are known -> ZIP all.
            //       - Else -> ZIP images only, save the rest via DIRECT (outside ZIP).
            //   * If album contains only non-image files:
            //       - If total <= ~1.6GB AND all sizes are known -> ZIP all.
            //       - Else -> DIRECT all (skip ZIP).
            // - Zipped OFF:
            //   * If album contains any non-image file (mixed OR video-only) -> DIRECT all.
            //   * Images-only album keeps default behavior.

            const FIL_IMG_EXTS = new Set(['.jpg','.jpeg','.png','.gif','.webp','.bmp','.avif','.tif','.tiff','.jxl','.heic','.heif']);
            const FIL_VID_EXTS = new Set(['.mp4','.m4v','.webm','.mkv','.mov','.avi','.wmv','.flv','.ts','.m2ts','.mpg','.mpeg','.3gp']);

            const filesterGuessExt = (s) => {
                const t = String(s || '').trim();
                const m = t.match(/\.([A-Za-z0-9]{1,8})(?=($|\?))/);
                return m ? `.${String(m[1]).toLowerCase()}` : '';
            };

            const filesterSlugFromUrl = (u0) => {
                try {
                    const s = String(u0 || '');
                    const mD = /\/d\/([^\/?#]+)/i.exec(s);
                    if (mD && mD[1]) return String(mD[1]);
                    // cacheN /v/ tokens -> map back to slug when known
                    const s2 = String(filesterSlugByUrl.get(String(u0)) || '');
                    if (s2) return s2;
                } catch (e) {}
                return '';
            };

            const filesterHintName = (u0) => {
                try {
                    const slug = filesterSlugFromUrl(u0);
                    const v =
                        (slug ? filesterNameBySlug.get(String(slug)) : '') ||
                        filesterNameByUrl.get(String(u0)) ||
                        '';
                    return String(v || '').trim();
                } catch (e) {
                    return '';
                }
            };

            const filesterHintSize = (u0) => {
                try {
                    const slug = filesterSlugFromUrl(u0);
                    const v =
                        (slug ? filesterSizeBySlug.get(String(slug)) : 0) ||
                        filesterSizeByUrl.get(String(u0)) ||
                        0;
                    const n = Number(v);
                    return Number.isFinite(n) && n > 0 ? n : 0;
                } catch (e) {
                    return 0;
                }
            };

            const filesterClassify = (u0) => {
                try {
                    const hintedName = filesterHintName(u0);
                    const ext = filesterGuessExt(hintedName || u0);
                    if (ext && FIL_IMG_EXTS.has(ext)) return 'image';
                    if (ext && FIL_VID_EXTS.has(ext)) return 'video';
                    // If no extension, treat as "other" (safer for ZIP decisions).
                    return 'other';
                } catch (e) {
                    return 'other';
                }
            };

            const applyFilesterAlbumPolicy = async () => {
                try {
                    const isFilesterAlbumOriginal = (s) => /(?:^|\/\/)(?:www\.)?filester\.(me|sh|si|gg)\/f\//i.test(String(s || '')) || /filester\.(me|sh|si|gg)\/f\//i.test(String(s || ''));
                    const albumItems = resolved.filter(r => r && r.url && isFilesterAlbumOriginal(r.original));
                    if (!albumItems.length) return;

                    // Group by the original album URL so each album is handled independently.
                    const groups = new Map();
                    for (const it of albumItems) {
                        const k = String(it.original || '');
                        if (!groups.has(k)) groups.set(k, []);
                        groups.get(k).push(it);
                    }

                    for (const [albumUrl, items] of groups.entries()) {
                        let hasImage = false;
                        let hasNonImage = false;
                        let imgCount = 0;
                        let vidCount = 0;
                        let otherCount = 0;
                        let nonImgCount = 0;
                        let totalSize = 0;
                        let unknownSize = 0;

                        const unknownItems = [];

                        // Collect classification + sizes.
                        for (const it of items) {
                            const kind = filesterClassify(it.url);
                            if (kind === 'image') { hasImage = true; imgCount++; }
                            else if (kind === 'video') { hasNonImage = true; vidCount++; nonImgCount++; }
                            else { hasNonImage = true; otherCount++; nonImgCount++; }

                            const sz0 = filesterHintSize(it.url);
                            if (sz0 > 0) totalSize += sz0;
                            else { unknownSize++; unknownItems.push(it); }
                        }

                        // Best-effort: only attempt HEAD for missing sizes on small albums.
                        // (Avoids 100x HEAD calls on huge albums; in that case we default to the safer policy.)
                        if (unknownItems.length && unknownItems.length <= 10 && items.length <= 25) {
                            for (const it of unknownItems) {
                                const meta = await preflightMeta(it.url, String(albumUrl || 'https://filester.me/'), false, false);
                                const sz = Number(meta && meta.size) || 0;
                                if (sz > 0) { totalSize += sz; unknownSize--; }
                            }
                        }

                        const allSizesKnown = unknownSize === 0 && totalSize > 0;
                        const canZipAll = allSizesKnown && totalSize <= BLOB_MAX_BYTES;

                        const totalStr = allSizesKnown ? `${Math.round(totalSize / 1024 / 1024)}MB` : 'unknown';
                        const info = `files=${items.length}, images=${imgCount}, videos=${vidCount}, other=${otherCount}, total=${totalStr}, unknown=${unknownSize}`;

                        if (!postSettings.zipped) {
                            // Unzipped: if there is ANY non-image (mixed or video-only) -> DIRECT all.
                            if (hasNonImage) {
                                for (const it of items) it.forceDirect = true;
                                log.post.info(postId, `::Filester album (unzipped) has non-image -> DIRECT all (${info})::: ${albumUrl}`, postNumber);
                            }
                            continue;
                        }

                        // Zipped ON
                        if (hasImage && hasNonImage) {
                            if (!canZipAll) {
                                // ZIP images only; everything else DIRECT.
                                for (const it of items) {
                                    const kind = filesterClassify(it.url);
                                    if (kind !== 'image') it.forceDirect = true;
                                }
                                log.post.info(postId, `::Filester mixed album -> ZIP images, DIRECT others (${info})::: ${albumUrl}`, postNumber);
                            } else {
                                log.post.info(postId, `::Filester mixed album total<=~1.6GB -> ZIP all (${info})::: ${albumUrl}`, postNumber);
                            }
                        } else if (!hasImage && hasNonImage) {
                            // Non-image only (videos and/or other file types)
                            const isVideoOnly = vidCount > 0 && otherCount === 0;

                            if (!canZipAll) {
                                for (const it of items) it.forceDirect = true;
                                log.post.info(
                                    postId,
                                    `::Filester ${isVideoOnly ? 'video-only' : 'non-image'} album >~1.6GB or unknown -> DIRECT all (${info})::: ${albumUrl}`,
                                    postNumber
                                );
                            } else {
                                log.post.info(
                                    postId,
                                    `::Filester ${isVideoOnly ? 'video-only' : 'non-image'} album total<=~1.6GB -> ZIP all (${info})::: ${albumUrl}`,
                                    postNumber
                                );
                            }
                        }
                        // Images-only album: keep default behavior.
                    }
                } catch (e) {}
            };

            await applyFilesterAlbumPolicy();

            const gofileWarmupOpenTab = warmUrl => {
                try {
                    const tab = GM_openInTab(warmUrl, { active: false, insert: true, setParent: true });
                    setTimeout(() => {
                        try { xfpdCloseTabHandle(tab); } catch (e) {}
                    }, GOFILE_WARMUP_MS);
                } catch (e) {}
            };

            let filesterNoTabTokenLogged = false;

            const startDownload = async (resource, pass = 1) => {
                if (isCancelled()) {
                    notifyBatchStep();
                    return;
                }
                let { url, host, original, folderName } = resource;
                let mirrorSwitched = false;

                const tryFallbackMirror = (reason, releasePath = '') => {
                    if (mirrorSwitched || isCancelled()) return false;
                    const fbList = resource && Array.isArray(resource.mirrorFallbacks) ? resource.mirrorFallbacks : null;
                    if (!fbList || !fbList.length) return false;
                    mirrorSwitched = true;
                    if (releasePath) {
                        usedPaths.delete(releasePath);
                    }
                    const nextMirror = fbList.shift();
                    nextMirror._seqIndex = resource._seqIndex;
                    nextMirror.mirrorFallbacks = fbList;
                    if (!nextMirror.hintedFilename && resource.hintedFilename) {
                        nextMirror.hintedFilename = resource.hintedFilename;
                    }
                    log.post.info(
                        postId,
                        `::Mirror fallback (${reason}) -> switching from ${(host && host.name) || 'mirror'} to ${(nextMirror.host && nextMirror.host.name) || 'fallback'}::: ${nextMirror.url}`,
                        postNumber,
                    );
                    h.ui.setElProps(statusLabel, { color: '#e8a838' });
                    h.ui.setText(
                        statusLabel,
                        `Mirror fallback (${reason}) 🢒 ${(nextMirror.host && nextMirror.host.name) || 'next mirror'}...`,
                    );
                    setTimeout(() => startDownload(nextMirror, 1), 150);
                    return true;
                };
                const zippedForThis = !!(postSettings.zipped && !(resource && (resource.forceDirect || resource.forceUnzipped)) );
                const isGoFile = isGoFileUrl(url);
                const isPixeldrain = isPixeldrainUrl(url);
                const isTurbo = isTurboUrl(url);
                const isCyberdrop = String(host || '').toLowerCase() === 'cyberdrop';
                const isBunkr = String((host && host.name) || '').toLowerCase() === 'bunkr' || /bunkr/i.test(String(url || '')) || /bunkr/i.test(String(original || ''));
                const isFilester = String((host && host.name) || '').toLowerCase() === 'filester' || /(?:^|\.)filester\.(me|sh|si|gg)/i.test(String(url || ''));

                // GoFile: make sure the browser's accountToken cookie matches the token that
                // resolved this album BEFORE the first request (store links gate on this too,
                // not just DIRECT) -- see gofileSyncCookie definition for why.
                if (isGoFile) {
                    try {
                        const gfToken = settings?.hosts?.goFile?.token;
                        if (gfToken) await gofileSyncCookie(gfToken);
                    } catch (e) {}
                }

                // Filester: turn short /d/<slug> view URLs into v2 CDN stream URLs (no tabs).
                // Album pages (/f/...) only ever yield short slugs, so this is the step that makes
                // album downloads work at all -- the /d/ link resolver never sees them.
                //
                // This used to call the v1 /api/public/download endpoint and build
                // `${host}/v/${token}` candidates from it. v1 still answers 200, so resolution
                // looked fine, but every one of those URLs 404s on the current CDN -- which is why
                // single /d/ links worked from b06 while albums kept retrying fsc1/fsc2/fsc3 and
                // failing. Resolution now goes through the same v2 resolver as single links.
                if (isFilester) {
                    try {
                        const uF = new URL(String(url || ''));
                        const isFilesterD = /(^|\.)filester\.(me|sh|si|gg)$/i.test(String(uF.host || '')) && /^\/d\//i.test(String(uF.pathname || ''));
                        if (isFilesterD) {
                            const slug = String(uF.pathname || '').split('/').filter(Boolean).pop() || '';
                            // Slugs look like "d8ZdCxc" / "QnUVP6A". The bound is deliberately loose
                            // -- anything path-shaped under /d/ on a Filester host is a slug, and a
                            // tight length check would silently skip resolution and save the HTML
                            // view page instead.
                            const looksLikeSlug = /^[A-Za-z0-9_-]{4,64}$/.test(slug);
                            if (looksLikeSlug) {
                                // Follow whichever Filester domain the post linked to.
                                const apiBase = `https://${String(uF.host || 'filester.me')}`;
                                const v2 = await filesterResolveV2(h.http, apiBase, slug);

                                if (v2 && v2.url) {
                                    const streamUrl = String(v2.url);
                                    if (!filesterNoTabTokenLogged) {
                                        filesterNoTabTokenLogged = true;
                                        log.post.info(postId, `::Filester slug->v2 token (no tab)::: ${slug} -> ${streamUrl}`, postNumber);
                                    }

                                    // filesterResolveV2 already recorded the slug/name/referer for
                                    // the new URL; the /d/ URL still needs its referer mapped so a
                                    // later fallback to it uses a Filester referer too.
                                    try { filesterRefByUrl.set(String(url), String(v2.ref)); } catch (e) {}
                                    url = streamUrl;
                                    try { resource.url = streamUrl; } catch (e) {}
                                }
                            }
                        }
                    } catch (e) {}
                }


                const turboId = isTurbo ? (turboIdBySignedUrl.get(String(url)) || turboExtractId(original) || turboExtractId(url) || '') : '';
                const turboKey = isTurbo ? (turboId ? `turbo:${turboId}` : `turbo-url:${url}`) : '';

                let cyberOrigin = '';
                let cyberSlug = '';
                let cyberFilePage = '';
                const progressKey = isGoFile ? `${url}@@gofilepass${pass}` : url;

                h.ui.setElProps(statusLabel, { fontWeight: 'normal' });

                var reflink = original;
                if (url.includes('bunkr')){
                    reflink = "https://bunkr.si"
                }
                if (url.includes('pomf2')){
                    reflink = "https://pomf2.lain.la"
                }
                if (url.includes('turbocdn.st')){
                    reflink = "https://turbo.cr/"
                }
                if (/erome\.com/i.test(String(url || ''))){
                    reflink = "https://www.erome.com/"
                }
                if (/(?:imagepond\.net|images\.socialmediagirls\.com)/i.test(String(url || ''))){
                    reflink = "https://www.imagepond.net/"
                }
                if (isFilesterUrl(url)){
                    // Prefer the exact /d/ page the token was issued against; the CDN accepts any
                    // Filester referer, but a v2 stream URL is not on a filester.* host at all, so
                    // the old hostname test never fired for it.
                    reflink = String(filesterRefByUrl.get(String(url)) || "https://filester.me/")
                }


                // Cyberdrop: normalize referer/origin and build a /f/ page for optional warm-up.
                if (isCyberdrop) {
                    try {
                        const o = new URL(/^https?:\/\//i.test(String(original || '')) ? String(original) : `https://${String(original)}`);
                        cyberOrigin = o.origin;
                        // Prefer slug from the original /e/ or /f/ URL, fallback to the resolved download URL.
                        const m1 = /\/[ef]\/([^\/?#]+)/i.exec(String(original || ''));
                        const m2 = /\/api\/file\/(?:d|info|auth)\/([^\/?#]+)/i.exec(String(original || ''));
                        const m3 = /\/api\/file\/d\/([^\/?#]+)/i.exec(String(url || ''));
                        cyberSlug = (m1 && m1[1]) || (m2 && m2[1]) || (m3 && m3[1]) || '';
                        if (cyberSlug) cyberFilePage = `${cyberOrigin}/f/${cyberSlug}`;
                        // Match browser requests: Referer/Origin are usually just https://cyberdrop.cr/
                        reflink = `${cyberOrigin}/`;
                    } catch (e) {}
                }

                const ellipsedUrl = h.limit(url, 80);
                log.post.info(postId, `::Downloading${isGoFile && pass > 1 ? ' (retry)' : ''}::: ${url}`, postNumber);

                if (isCyberdrop && pass === 1 && cyberOrigin && cyberFilePage && /gigachad-cdn\.ru|cuckcapital\.cr/i.test(String(url || '')) && !cyberdropDirectWarmupDone) {

                    cyberdropDirectWarmupDone = true;
                                        log.post.info(postId, `::Cyberdrop warm-up -> open tab (${CYBERDROP_WARMUP_MS}ms) then continue::: ${cyberFilePage}`, postNumber);
                    await cyberdropWarmupOnce(cyberOrigin, cyberFilePage, CYBERDROP_WARMUP_MS);
                }


                let switchedToDirect = false;

                const startDirectDownload = async (metaHint = null) => {
                    switchedToDirect = true;

                    try {
                        const baseMeta = isTurbo ? {} : ((await preflightMeta(url, reflink, isGoFile, isPixeldrain)) || {});
                        const meta = { ...baseMeta, ...(metaHint || {}) };
                        const sizeBytes = Number(meta.size || 0) || 0;

                        // GoFile: if HEAD already shows an HTML gate / bad status, do the same warm-up + one retry.
                        if (isGoFile) {
                            const ct = String(meta.contentType || '');
                            const badStatus = meta.status && meta.status >= 400;
                            const isHtml = /text\/html|application\/xhtml\+xml/i.test(ct);
                            if ((badStatus || isHtml) && pass === 1 && !gofileWarmupAttempted.has(url)) {
                                gofileWarmupAttempted.add(url);
                                log.post.info(postId, `::GoFile warm-up -> open tab (${GOFILE_WARMUP_MS}ms) then retry [1/2]::: ${url}`, postNumber);
                                gofileWarmupOpenTab(url);
                                setTimeout(() => startDownload(resource, 2), GOFILE_WARMUP_MS);
                                return;
                            }
                        }

                        if (postSettings.zipped) {
                            log.post.info(postId, `::Zipped ON -> saving standalone (not in ZIP)::: ${url}`, postNumber);
                        }

                        // Try to reuse the existing GoFile filename hints, if available.
                        let filename = filenames.find(f => f.url === url);
                        if (!filename && isGoFile) {
                            const mGf = String(url).match(/\/download\/(?:web|direct)\/([^\/?#]+)\//i);
                            const gid = mGf && mGf[1] ? mGf[1] : null;
                            if (gid) {
                                filename = filenames.find(f => f && f.gofileId === gid);
                                if (!filename) {
                                    const hinted =
                                        gofileNameById.get(String(gid)) ||
                                        gofileNameByUrl.get(String(url));
                                    if (hinted) {
                                        filename = { url, name: String(hinted), gofileId: String(gid) };
                                    }
                                }
                            }
                        }

                        let basename = '';

                        if (isPixeldrain) {
                            basename =
                                String(meta.filename || '') ||
                                parseDispositionFilename(meta.headers || '') ||
                                String((resource && resource.hintedFilename) || '') ||
                                '';
                        } else if (isGoFile) {
                            basename =
                                (filename && filename.name ? String(filename.name) : '') ||
                                String(meta.filename || '') ||
                                parseDispositionFilename(meta.headers || '') ||
                                '';
                        }

                        if (!basename && isTurbo) {
                            basename = turboExtractFn(url) || '';
                        }

                        if (!basename) {
                            const stripIp = s => String(s || '').split('#')[0].split('?')[0].replace(/\/+$/, '');
                            const hintedIp =
                                imagepondNameByUrl.get(String(url)) ||
                                imagepondNameByUrl.get(stripIp(url)) ||
                                imagepondNameByUrl.get(String((resource && resource.original) || '')) ||
                                imagepondNameByUrl.get(stripIp((resource && resource.original) || '')) ||
                                '';
                            if (hintedIp) basename = String(hintedIp).trim();
                        }
                        if (!basename) {
                            basename = (filename && filename.name) ? String(filename.name) : '';
                        }
                        if (!basename && resource && resource.hintedFilename) {
                            basename = String(resource.hintedFilename);
                        }
                        if (!basename) {
                            basename = h.basename(url);
                        }

                        // Bunkr: prefer the human filename (og:title / h1) captured during resolution.
                        if (isBunkr) {
                            try {
                                const strip = (u) => String(u || '').split('#')[0].split('?')[0];
                                const hinted =
                                    bunkrNameByUrl.get(String(url)) ||
                                    bunkrNameByUrl.get(strip(url)) ||
                                    bunkrNameByUrl.get(String((resource && resource.original) || '')) ||
                                    bunkrNameByUrl.get(strip((resource && resource.original) || '')) ||
                                    '';
                                if (hinted && String(hinted).trim() && !xfpdLooksLikeCfFilenameHint(hinted)) {
                                    basename = String(hinted).trim();

                                    // If hinted has no extension, derive it from URL first, then content-type.
                                    const hasExt = /\.[A-Za-z0-9]{1,8}$/.test(basename);
                                    if (!hasExt) {
                                        const urlExt = h.ext(h.basename(strip(url))) || '';
                                        const ct0 = String((meta && (meta.contentType || meta.content_type)) || '');
                                        let ext0 = '';
                                        if (urlExt) ext0 = String(urlExt);
                                        else if (/video\/mp4/i.test(ct0)) ext0 = 'mp4';
                                        else if (/video\/webm/i.test(ct0)) ext0 = 'webm';
                                        else if (/image\/jpe?g/i.test(ct0)) ext0 = 'jpg';
                                        else if (/image\/png/i.test(ct0)) ext0 = 'png';
                                        else if (/image\/gif/i.test(ct0)) ext0 = 'gif';
                                        else if (/application\/zip/i.test(ct0)) ext0 = 'zip';
                                        else if (/application\/(x-7z-compressed)/i.test(ct0)) ext0 = '7z';
                                        else if (/application\/(x-rar|vnd\.rar)|application\/octet-stream/i.test(ct0)) ext0 = 'rar';
                                        else if (/application\/pdf/i.test(ct0)) ext0 = 'pdf';
                                        if (ext0) basename = `${basename}.${ext0}`;
                                    }

                                    basename = sanitizeWinSegment(String(basename || ''));
                                    if (!basename) basename = sanitizeWinSegment(String(h.basename(strip(url)) || ''));
                                }
                            } catch (e) {}
                        }

                        // Filester: prefer the real filename (from view page / API hints); fallback to a safe slug-based name.
                        if (isFilester) {
                            try {
                                let slug0 = '';
                                const m = /https?:\/\/(?:www\.)?filester\.(me|sh|si|gg)\/d\/([^\/?#]+)/i.exec(String((resource && resource.original) || ''));
                                if (m && m[1]) slug0 = m[1];
                                if (!slug0) slug0 = String(filesterSlugByUrl.get(String(url)) || '');
                                const ct0 = String((meta && (meta.contentType || meta.content_type)) || '');
                                let ext0 = 'bin';
                                if (/video\/mp4/i.test(ct0)) ext0 = 'mp4';
                                else if (/video\/webm/i.test(ct0)) ext0 = 'webm';
                                else if (/image\/jpe?g/i.test(ct0)) ext0 = 'jpg';
                                else if (/image\/png/i.test(ct0)) ext0 = 'png';
                                else if (/image\/gif/i.test(ct0)) ext0 = 'gif';
                                else if (/application\/zip/i.test(ct0)) ext0 = 'zip';
                                else if (/application\/x-7z-compressed/i.test(ct0)) ext0 = '7z';
                                else if (/application\/(x-rar|vnd\.rar)/i.test(ct0)) ext0 = 'rar';

                                const hinted =
                                    String((meta && (meta.filename || meta.fileName)) || '') ||
                                    String(filesterNameByUrl.get(String(url)) || '') ||
                                    (slug0 ? String(filesterNameBySlug.get(String(slug0)) || '') : '');

                                if (hinted && hinted.trim()) {
                                    basename = hinted.trim();
                                    const hasExt = /\.[A-Za-z0-9]{1,8}$/.test(String(basename || ''));
                                    if (!hasExt && ext0) basename = `${basename}.${ext0}`;
                                } else if (slug0) {
                                    basename = `Filester_${slug0}.${ext0}`;
                                }
                            } catch (e) {}
                        }

                        const originalName = basename;

                        // In flat/albums modes (without sequence prefix), disambiguate same-named files before building path.
                        if (['flat', 'albums'].includes(resolveEffectiveLayout())) {
                            const same = filenames.filter(f => f && (f.original === basename || f.name === basename));
                            if (same.length) {
                                const ext2 = h.extension(basename);
                                if (ext2) {
                                    basename = `${h.fnNoExt(basename)} (${same.length + 1}).${ext2}`;
                                } else {
                                    basename = `${basename} (${same.length + 1})`;
                                }
                            }
                        }

                        if (!filename) {
                            const extra = {};
                            if (isGoFile) {
                                const mGf2 = String(url).match(/\/download\/(?:web|direct)\/([^\/?#]+)\//i);
                                const gid2 = mGf2 && mGf2[1] ? mGf2[1] : null;
                                if (gid2) extra.gofileId = String(gid2);
                            }
                            filenames.push({ url, name: basename, original: originalName, ...extra });
                        }

                        const folder = folderName || '';
                        const directContentType = String((meta && (meta.contentType || meta.content_type)) || '');

                        // If Auto-Extract Archives is enabled and this direct item is a single-volume archive within our
                        // safe RAM ceiling (<= 650 MB; <= 500 MB on Bunkr MV3), reroute to the Blob path for extraction!
                        const maxArchiveBlobBytes = isBunkr
                            ? Math.min(XFPD_MAX_EXTRACT_ARCHIVE_BYTES, BUNKR_DIRECT_MIN_BYTES)
                            : XFPD_MAX_EXTRACT_ARCHIVE_BYTES;
                        if (
                            postSettings.extractArchives !== false &&
                            resource &&
                            !resource._skipDirectForArchive &&
                            xfpdIsExtractableArchiveCandidate(basename, directContentType) &&
                            sizeBytes > 0 &&
                            sizeBytes <= maxArchiveBlobBytes
                        ) {
                            resource.forceDirect = false;
                            resource._skipDirectForArchive = true;
                            log.post.info(
                                postId,
                                `::Archive candidate (${Math.round(sizeBytes / 1024 / 1024)}MB) -> fetching via Blob for auto-extraction::: ${basename}`,
                                postNumber,
                            );
                            startDownload(resource, pass);
                            return;
                        }

                        let fn = buildTargetRelativePath({
                            basename,
                            folderName: folder,
                            seqIndex: resource && resource._seqIndex,
                            contentType: directContentType,
                            hostCategory: host && host.category,
                            sanitizeSegFn: sanitizeWinSegment,
                            sanitizePathFn: sanitizeWinPath,
                        });

                        log.separator(postId);
                        log.post.info(postId, `::Handed off (direct)::: ${url}`, postNumber);
                        log.post.info(postId, `::Saving as (direct)::: ${fn}`, postNumber);

                        let title = sanitizeWinSegment(threadTitle);

                        fn = ensureUniquePath(fn);
                        basename = h.basename(fn);
                        const saveAsFF = `${title} #${postNumber} - ${ensureUniqueFlatName(fn.replace(/\//g, ' - '))}`;
                        const saveAsPath = `${title}/${fn}`;
                        const saveAsName = isFF ? saveAsFF : saveAsPath;

                        h.ui.setElProps(statusLabel, { color: '#469cf3' });
                        h.show(filePB);


                        const origUrl = String(url);
                        let directUrl = String(url);
                        let filesterDirectPreflightDone = false;

                        // Filester DIRECT: retry a few times on transient HTTP errors (429/400/etc) and rotate cache hosts (cache6 <-> cache1 ...)
                        // before starting GM_download. Keeps pauses short (<=~2s).
                        if (isFilester) {
                            try {
                                const ref = String(filesterRefByUrl.get(String(url)) || (resource && resource.original) || 'https://filester.me/');
                                const token0 = filesterTokenFromVUrl(String(url || ''));

                                if (token0) {
                                    let candidates0 = filesterCandidatesByToken.get(token0) || filesterBuildCandidates(token0);
                                    candidates0 = Array.isArray(candidates0) ? candidates0.slice() : [];

                                    const u0 = String(url);
                                    const ix = candidates0.indexOf(u0);
                                    if (ix >= 0) candidates0.splice(ix, 1);
                                    candidates0.unshift(u0);

                                    const cacheLabel = (u) => {
                                        const m = String(u || '').match(/https?:\/\/cache(\d+)\.filester\.(me|sh|si|gg)/i);
                                        return m && m[1] ? `cache${m[1]}` : (String(u || '').includes('filester.me') ? 'filester' : 'url');
                                    };

                                    const isRetryableStatus = (st) => {
                                        const n = Number(st || 0) || 0;
                                        return n === 0 || n === 400 || n === 403 || n === 404 || n === 429 || (n >= 500 && n <= 599);
                                    };

                                    const delays = [650, 1300, 2000];

                                    for (let i = 0; i < 3; i++) {
                                        const cand = candidates0[i] || u0;

                                        const pre = await new Promise(resolve => {
                                            try {
                                                GM_xmlhttpRequest({
                                                    method: 'GET',
                                                    url: String(cand),
                                                    responseType: 'text',
                                                    anonymous: false,
                                                    withCredentials: true,
                                                    timeout: 5000,
                                                    headers: { Range: 'bytes=0-0', Accept: '*/*', Referer: ref },
                                                    onload: r => resolve(r),
                                                    onerror: _ => resolve(null),
                                                    ontimeout: _ => resolve(null),
                                                });
                                            } catch (e) {
                                                resolve(null);
                                            }
                                        });

                                        filesterDirectPreflightDone = true;

                                        const st0 = Number(pre && pre.status || 0) || 0;
                                        const finalUrl = pre && (pre.finalUrl || pre.responseURL) ? String(pre.finalUrl || pre.responseURL) : '';
                                        const ok = st0 && st0 < 400;

                                        if (ok) {
                                            directUrl = (finalUrl && /^https?:\/\//i.test(finalUrl)) ? finalUrl : String(cand);

                                            if (i > 0 || String(cand) !== u0 || (finalUrl && finalUrl !== cand)) {
                                                log.post.info(postId, `::Filester DIRECT picked ${cacheLabel(cand)} (HTTP ${st0})::: ${directUrl}`, postNumber);
                                            }
                                            break;
                                        }

                                        if (i < 2 && isRetryableStatus(st0) && candidates0[i + 1]) {
                                            const next = candidates0[i + 1];
                                            const delay = delays[i] || 1000;
                                            log.post.info(postId, `::Filester DIRECT HTTP ${st0 || 0} -> retry [${i + 1}/3] after ${delay}ms; switching ${cacheLabel(cand)}->${cacheLabel(next)}::: ${next}`, postNumber);
                                            await h.delayedResolve(delay);
                                        }
                                    }
                                }
                            } catch (e) {}
                        }

                        const isEromeCdnUrl = u => /https?:\/\/(?:[sv]\d+\.)?erome\.com\//i.test(String(u || ''));
                        const imagebamHeaders = isImagebamCdnUrl(url)
                            ? { Referer: imagebamRefererForCdn(url) }
                            : isEromeCdnUrl(url)
                              ? { Referer: 'https://www.erome.com/' }
                              : null;

                        // Fast 64 KB Range fingerprint for large DIRECT downloads:
                        // Skips multi-GB duplicate videos with different filenames before downloading!
                        let directFingerprint = '';
                        if (useContentDedup && sizeBytes > 0) {
                            try {
                                const probeBuf = await new Promise(resolve => {
                                    let reqRange = null;
                                    let settled = false;
                                    const done = val => {
                                        if (settled) return;
                                        settled = true;
                                        resolve(val);
                                    };
                                    try {
                                        reqRange = GM_xmlhttpRequest({
                                            method: 'GET',
                                            url: String(directUrl),
                                            responseType: 'arraybuffer',
                                            anonymous: false,
                                            timeout: 7000,
                                            headers: {
                                                Range: 'bytes=0-65535',
                                                Referer: (imagebamHeaders && imagebamHeaders.Referer) || reflink || directUrl,
                                            },
                                            onreadystatechange: r => {
                                                // If server ignores Range (returns 200 full stream instead of 206), abort immediately!
                                                if (r.readyState === 2 && r.status && r.status !== 206) {
                                                    try { reqRange && reqRange.abort(); } catch (e) {}
                                                    done(null);
                                                }
                                            },
                                            onload: r => {
                                                if (r.status === 206 && r.response && r.response.byteLength > 0) {
                                                    done(new Uint8Array(r.response, 0, Math.min(65536, r.response.byteLength)));
                                                } else {
                                                    done(null);
                                                }
                                            },
                                            onerror: () => done(null),
                                            ontimeout: () => done(null),
                                        });
                                    } catch (e) {
                                        done(null);
                                    }
                                });
                                if (probeBuf && probeBuf.byteLength > 0) {
                                    const tag = await xfpdDigestUint8ArrayToTag(probeBuf);
                                    if (tag) directFingerprint = `d:${sizeBytes}:${tag}`;
                                }
                            } catch (e) {}

                            if (directFingerprint && xfpdHasSeenThreadHash(directFingerprint, activeThreadKey)) {
                                usedPaths.delete(fn);
                                log.post.info(
                                    postId,
                                    `::Skipped duplicate DIRECT content (identical size + 64KB header hash)::: ${basename}`,
                                    postNumber,
                                );
                                finishBatchItem('dedup');
                                h.ui.setText(statusLabel, `${completed} / ${totalDownloadable} (dupe skipped) 🢒 ${ellipsedUrl}`);
                                h.ui.setElProps(statusLabel, { color: '#2d9053' });
                                h.ui.setElProps(totalPB, {
                                    width: `${(completed / totalDownloadable) * 100}%`,
                                });
                                return;
                            }
                        }

                        let lastDirectUiAt = 0;
                        const dlOpts = {
                            url: directUrl,
                            name: saveAsName,
                            onprogress: e => {
                                if (isCancelled()) return;
                                const nowMs = Date.now();
                                const totalBytes = (e.total && e.total > 0) ? e.total : (sizeBytes || 0);
                                if (nowMs - lastDirectUiAt < 80 && (!totalBytes || e.loaded < totalBytes)) return;
                                lastDirectUiAt = nowMs;
                                const loadedMB = Number((e.loaded || 0) / 1024 / 1024).toFixed(2);
                                const totalMB = totalBytes ? Number(totalBytes / 1024 / 1024).toFixed(2) : '??';
                                if (!totalBytes) {
                                    h.ui.setElProps(filePB, { width: '0%' });
                                    h.ui.setText(statusLabel, `${completed} / ${totalDownloadable} 🢒 ${host.name} 🢒 DIRECT 🢒 ${loadedMB} MB 🢒 ${ellipsedUrl}`);
                                } else {
                                    h.ui.setText(statusLabel, `${completed} / ${totalDownloadable} 🢒 ${host.name} 🢒 DIRECT 🢒 ${loadedMB} MB / ${totalMB} MB  🢒 ${ellipsedUrl}`);
                                    h.ui.setElProps(filePB, {
                                        width: `${(e.loaded / totalBytes) * 100}%`,
                                    });
                                }
                            },
                            onload: () => {
                                if (useContentDedup) {
                                    const cKey = (resource && resource._canonicalKey) || canonicalizeMediaUrl(url);
                                    if (cKey) xfpdMarkSeenThreadUrl(cKey, activeThreadKey);
                                    if (resource && !resource.folderName && resource.original) {
                                        const oKey = canonicalizeMediaUrl(resource.original);
                                        if (oKey) xfpdMarkSeenThreadUrl(oKey, activeThreadKey);
                                    }
                                    if (directFingerprint) xfpdMarkSeenThreadHash(directFingerprint, activeThreadKey);
                                }
                                finishBatchItem(true);

                                h.ui.setText(statusLabel, `${completed} / ${totalDownloadable} 🢒 ${ellipsedUrl}`);
                                h.ui.setElProps(statusLabel, { color: '#2d9053' });
                                h.ui.setElProps(totalPB, {
                                    width: `${(completed / totalDownloadable) * 100}%`,
                                });
                            },
                            onerror: err => {
                                log.post.error(postId, `::DIRECT download failed::: ${url}`, postNumber);
                                console.log(err);
                                if (tryFallbackMirror('DIRECT error', fn)) return;
                                finishBatchItem(false);

                                h.ui.setText(statusLabel, `${completed} / ${totalDownloadable} 🢒 ${ellipsedUrl}`);
                                h.ui.setElProps(statusLabel, { color: '#b23b3b' });
                                h.ui.setElProps(totalPB, {
                                    width: `${(completed / totalDownloadable) * 100}%`,
                                });
                            },
                            ontimeout: err => {
                                log.post.error(postId, `::DIRECT download timed out::: ${url}`, postNumber);
                                console.log(err);
                                if (tryFallbackMirror('DIRECT timeout', fn)) return;
                                finishBatchItem(false);
                            },
                        };
if (imagebamHeaders && isFF) {
                            // Imagebam CDN often blocks hotlinking without a Referer. In Firefox, GM_download headers
                            // are unreliable, so fetch as a blob with GM_xmlhttpRequest (with Referer) then save.
                            try {
                                GM_xmlhttpRequest({
                                    method: 'GET',
                                    url,
                                    headers: imagebamHeaders,
                                    responseType: 'blob',
                                    anonymous: false,
                                    timeout: 60000,
                                    onprogress: dlOpts.onprogress,
                                    onload: r => {
                                        const ct = headerValue(r.responseHeaders || '', 'content-type');
                                        const isHtml = /text\/html|application\/xhtml\+xml/i.test(String(ct || ''));
                                        if (!(r.status >= 200 && r.status < 300) || !r.response || isHtml) {
                                            dlOpts.onerror({ status: r.status, contentType: ct });
                                            return;
                                        }
                                        const blob = r.response;
                                        // Guard against tiny non-image responses (common for blocked hotlinks)
                                        if (blob && blob.size && blob.size < 2048 && isHtml) {
                                            dlOpts.onerror({ status: r.status, contentType: ct });
                                            return;
                                        }
                                        const blobUrl = URL.createObjectURL(blob);
                                        GM_download({
                                            url: blobUrl,
                                            name: saveAsName,
                                            onload: () => { try { URL.revokeObjectURL(blobUrl); } catch (e) {} dlOpts.onload(); },
                                            onerror: err => { try { URL.revokeObjectURL(blobUrl); } catch (e) {} dlOpts.onerror(err); },
                                            ontimeout: err => { try { URL.revokeObjectURL(blobUrl); } catch (e) {} dlOpts.ontimeout(err); },
                                        });
                                    },
                                    onerror: dlOpts.onerror,
                                    ontimeout: dlOpts.ontimeout,
                                });
                            } catch (e) {
                                dlOpts.onerror(e);
                            }
                        } else {
                            if (imagebamHeaders) dlOpts.headers = { ...(dlOpts.headers || {}), ...imagebamHeaders };

                            // Filester (Chrome): preflight a 1-byte range request to capture the final URL.
                            // This helps when the downloads API drops cookies or when Filester redirects to a signed URL.
                            if (isFilester && !isFF && !filesterDirectPreflightDone) {
                                try {
                                    const ref = String(filesterRefByUrl.get(String(url)) || (resource && resource.original) || 'https://filester.me/');
                                    const pre = await new Promise(resolve => {
                                        try {
                                            GM_xmlhttpRequest({
                                                method: 'GET',
                                                url: String(dlOpts.url),
                                                responseType: 'text',
                                                anonymous: false,
                                                withCredentials: true,
                                                timeout: 15000,
                                                headers: { Range: 'bytes=0-0', Accept: '*/*', Referer: ref },
                                                onload: r => resolve(r),
                                                onerror: _ => resolve(null),
                                                ontimeout: _ => resolve(null),
                                            });
                                        } catch (e) {
                                            resolve(null);
                                        }
                                    });
                                    const finalUrl = pre && (pre.finalUrl || pre.responseURL);
                                    if (finalUrl && typeof finalUrl === 'string' && /^https?:\/\//i.test(finalUrl)) {
                                        dlOpts.url = finalUrl;
                                    }
                                } catch (e) {}
                            }

GM_download(dlOpts);
                        }

                    } catch (e) {
                        // Safety: never hang the batch loop.
                        log.post.error(postId, `::DIRECT download error::: ${url}`, postNumber);
                        console.log(e);
                        if (tryFallbackMirror('DIRECT exception')) return;
                        finishBatchItem(false);
                    }
                };



                // Forced DIRECT (used by Filester album policy: mixed albums, unzipped mixed/video-only, etc.)
                if (resource && resource.forceDirect && !resource._skipDirectForArchive) {
                    log.post.info(postId, `::Forced DIRECT (skip blob/ZIP)::: ${url}`, postNumber);
                    setTimeout(() => startDirectDownload(), TURBO_DIRECT_DELAY_MS);
                    return;
                }

                const isPixeldrainList =
                    isPixeldrain &&
                    /pixeldrain\.com\/l\//i.test(String(original || '')) &&
                    !(resource && resource._skipDirectForArchive);
                if (isPixeldrainList) {
                    log.post.info(postId, `::Pixeldrain list (/l/) -> DIRECT (skip blob)::: ${url}`, postNumber);
                    setTimeout(() => startDirectDownload(), TURBO_DIRECT_DELAY_MS);
                    return;
                }

if (isGoFile || isPixeldrain || isFilester) {
                    const meta0 = await preflightMeta(url, reflink, isGoFile, isPixeldrain);
                    if (!isGoFile && meta0 && meta0.status && meta0.status >= 400) {
                        log.post.error(postId, `::Preflight HTTP ${meta0.status}::: ${url}`, postNumber);
                        if (tryFallbackMirror(`HTTP ${meta0.status}`)) return;
                    }
                    if (meta0 && meta0.size && meta0.size > BLOB_MAX_BYTES) {
                        log.post.info(postId, `::Large file (${meta0.size} bytes > ~1.6GB) -> DIRECT (skip blob)::: ${url}`, postNumber);
                        startDirectDownload(meta0);
                        return;
                    }
                }
                let abortReason = '';
                let bunkrMaintenanceHandled = false;

                const isForumAttachment =
                    /(?:simpcity\.[a-z]+|socialmediagirls\.com)\/(?:attachments|data\/video)\//i.test(String(url || '')) ||
                    /smgmedia\.socialmediagirls\.com\//i.test(String(url || ''));
                const isTurboCdn = /turbocdn\.st/i.test(String(url || ''));
                const filesterRef = isFilester ? String(filesterRefByUrl.get(String(url)) || (resource && resource.original) || 'https://filester.me/') : '';
                const reqHeaders = isTurboCdn ? { Referer: 'https://turbo.cr/' } : (isFilester ? { Referer: filesterRef } : { Referer: reflink });

                let lastBlobProgressUiAt = 0;
                const progressEntry = { url: progressKey, intervalId: null, old: 0, new: 0 };

                const request = GM_xmlhttpRequest({
                    url,
                    headers: reqHeaders,
                    responseType: 'blob',
                    anonymous: false,
                    ...((isFilester || isForumAttachment) ? { withCredentials: true } : {}),
                    onreadystatechange: response => {
                        if (isCancelled()) return;
                        if (response.readyState === 2) {
                            let matches = h.re.matchAll(/(?<=attachment;filename=").*?(?=")/gis, response.responseHeaders);
                            if (matches.length && !filenames.find(f => f.url === url)) {
                                filenames.push({ url, name: matches[0] });
                            } else if (!filenames.find(f => f.url === url)) {
                                const dispName = parseDispositionFilename(response.responseHeaders || '');
                                if (dispName) {
                                    filenames.push({ url, name: dispName });
                                }
                            }
                            matches = h.re.matchAll(/(?<=content-type:\s).*$/gi, response.responseHeaders);
                            if (matches.length && !mimeTypes.find(m => m.url === url)) {
                                mimeTypes.push({ url, type: matches[0] });
                            }


                            // Bunkr: detect maintenance placeholder redirect (maint.mp4) early and abort (skip).
                            if (isBunkr && !abortReason) {
                                const loc = headerValue(response.responseHeaders || '', 'location');
                                const fu = String(response.finalUrl || '');
                                if (/\/maint\.mp4(\?|$)/i.test(loc) || /\/maint\.mp4(\?|$)/i.test(fu)) {
                                    abortReason = 'bunkr_maint';
                                    try { request.abort(); } catch (e) {}
                                }
                            }
                        }
                    },
                    onprogress: response => {
                        if (isCancelled()) return;
                        progressEntry.new = response.loaded;

                        // Pixeldrain/GoFile: if size only becomes known mid-download and it's > ~1.6GB, switch to direct download.
                        if (!switchedToDirect && (isGoFile || isPixeldrain || isFilester) && response && response.total && response.total > BLOB_MAX_BYTES) {
                            log.post.info(postId, `::Large file (${response.total} bytes > ~1.6GB) detected -> switch to DIRECT::: ${url}`, postNumber);
                            switchedToDirect = true;
                            try { request.abort(); } catch (e) {}
                            startDirectDownload({ size: response.total });
                            return;
                        }
                        // Bunkr: large videos cause MV3 port disconnection via blob; switch to direct download above 500MB.
                        if (!switchedToDirect && isBunkr && response && response.total && response.total > BUNKR_DIRECT_MIN_BYTES) {
                            log.post.info(postId, `::Bunkr large file (${response.total} bytes > 500MB) -> switch to DIRECT::: ${url}`, postNumber);
                            switchedToDirect = true;
                            try { request.abort(); } catch (e) {}
                            startDirectDownload({ size: response.total });
                            return;
                        }

                        const nowMs = Date.now();
                        const hasTotal = response.total !== -1 && response.totalSize !== -1 && response.total > 0;
                        if (nowMs - lastBlobProgressUiAt < 80 && (!hasTotal || response.loaded < response.total)) {
                            return;
                        }
                        lastBlobProgressUiAt = nowMs;

                        h.ui.setElProps(statusLabel, {
                            color: '#469cf3',
                        });

                        const downloadedSizeInMB = Number(response.loaded / 1024 / 1024).toFixed(2);
                        if (!hasTotal) {
                            h.ui.setElProps(filePB, { width: '0%' });
                            h.ui.setText(statusLabel, `${completed} / ${totalDownloadable} 🢒 ${host.name} 🢒 ${downloadedSizeInMB} MB 🢒 ${ellipsedUrl}`);
                        } else {
                            const totalSizeInMB = Number(response.total / 1024 / 1024).toFixed(2);
                            h.show(filePB);
                            h.ui.setText(
                                statusLabel,
                                `${completed} / ${totalDownloadable} 🢒 ${host.name} 🢒 ${downloadedSizeInMB} MB / ${totalSizeInMB} MB  🢒 ${ellipsedUrl}`,
                            );
                            h.ui.setElProps(filePB, {
                                width: `${(response.loaded / response.total) * 100}%`,
                            });
                        }
                    },
                    onload: async response => {
                        if (progressEntry.intervalId) clearInterval(progressEntry.intervalId);
                        if (isCancelled()) {
                            notifyBatchStep();
                            return;
                        }



                        if (abortReason === 'bunkr_maint' && bunkrMaintenanceHandled) return;
                        // GoFile: this pass was superseded by a stall-triggered warm-up retry
                        // (request.abort() above isn't always reliable once a blob response is
                        // substantially buffered) -- a newer pass now owns saving this file.
                        if (isGoFile && (gofileActivePass.get(url) || pass) > pass) return;
                        // GoFile: detect soft-block / HTML gate
                        if (isGoFile) {
                            const mCt = /content-type:\s*([^\r\n]+)/i.exec(response.responseHeaders || '');
                            const ct = mCt && mCt[1] ? mCt[1] : '';
                            const isHtml = /text\/html|application\/xhtml\+xml/i.test(ct);
                            const badStatus = !response.status || response.status >= 400;

                            if (badStatus || isHtml) {
                                if (pass === 1 && !gofileWarmupAttempted.has(url)) {
                                    gofileWarmupAttempted.add(url);
                                    log.post.info(postId, `::GoFile warm-up -> open tab (${GOFILE_WARMUP_MS}ms) then retry [1/2]::: ${url}`, postNumber);
                                    gofileWarmupOpenTab(url);
                                    setTimeout(() => startDownload(resource, 2), GOFILE_WARMUP_MS);
                                    return;
                                }

                                // Retry failed -> try fallback mirror before marking as unsuccessful.
                                log.post.error(postId, `::GoFile failed (after retry)::: ${url}`, postNumber);
                                if (tryFallbackMirror('GoFile failed')) return;
                                finishBatchItem(false);

                                h.ui.setText(statusLabel, `${completed} / ${totalDownloadable} 🢒 ${ellipsedUrl}`);
                                h.ui.setElProps(statusLabel, { color: '#b23b3b' });
                                h.ui.setElProps(totalPB, {
                                    width: `${(completed / totalDownloadable) * 100}%`,
                                });
                                return;
                            }
                        }


                        // Cyberdrop: detect anti-bot / API responses (often tiny JSON/HTML) and retry once after warm-up.
                        if (isCyberdrop) {
                            const mCt = /content-type:\s*([^\r\n]+)/i.exec(response.responseHeaders || '');
                            const ct = mCt && mCt[1] ? mCt[1] : '';
                            const isGate = /text\/html|application\/xhtml\+xml|application\/json/i.test(ct);
                            const badStatus = !response.status || response.status >= 400;
                            const size = response.response && typeof response.response.size === 'number' ? response.response.size : 0;
                            const isTiny = size > 0 && size <= 16384;

                            if (badStatus || isGate || isTiny) {
                                if (pass === 1 && cyberOrigin && cyberFilePage) {
                                                                        log.post.info(postId, `::Cyberdrop warm-up -> open tab (${CYBERDROP_WARMUP_MS}ms) then retry [1/2]::: ${cyberFilePage}`, postNumber);
                                    cyberdropWarmupOnce(cyberOrigin, cyberFilePage, CYBERDROP_WARMUP_MS)
                                        .then(() => startDownload(resource, 2))
                                        .catch(() => startDownload(resource, 2));
                                    return;
                                }

                                // Retry failed -> try fallback mirror before marking as unsuccessful.
                                log.post.error(postId, `::Cyberdrop failed (gate/tiny response)::: ${url}`, postNumber);
                                if (tryFallbackMirror('Cyberdrop failed')) return;
                                finishBatchItem(false);

                                h.ui.setText(statusLabel, `${completed} / ${totalDownloadable} 🢒 ${ellipsedUrl}`);
                                h.ui.setElProps(statusLabel, { color: '#b23b3b' });
                                h.ui.setElProps(totalPB, {
                                    width: `${(completed / totalDownloadable) * 100}%`,
                                });
                                return;
                            }
                        }


                        // Filester: detect blocked/tiny responses (often an error thumbnail or HTML gate) and fall back to DIRECT once.
                        if (isFilester) {
                            const mCt = /content-type:\s*([^\r\n]+)/i.exec(response.responseHeaders || '');
                            const ct = mCt && mCt[1] ? mCt[1] : '';
                            const isGate = /text\/html|application\/xhtml\+xml|application\/json/i.test(ct);
                            const badStatus = !response.status || response.status >= 400;

                            const blob = response.response;
                            const size = blob && typeof blob.size === 'number' ? blob.size : 0;

                            let hintSize = 0;
                            try {
                                const s0 = String(filesterSlugByUrl.get(String(url)) || '');
                                hintSize = Number(filesterSizeBySlug.get(s0) || filesterSizeByUrl.get(String(url)) || 0) || 0;
                            } catch (e) {
                                hintSize = 0;
                            }

                            // Only treat "tiny" as suspicious when we have a meaningful expected size.
                            const suspiciousTiny = !!hintSize && size > 0 && size <= 16384 && hintSize >= 32768;

                            if (badStatus || isGate || suspiciousTiny) {
                                if (pass === 1) {
                                    // Filester: some tokens are not available on cache6 (404). Try other cacheN hosts before falling back.
                                    if (badStatus && Number(response.status || 0) === 404) {
                                        const token0 = filesterTokenFromVUrl(String(url || ''));
                                        if (token0) {
                                            const candidates0 = filesterCandidatesByToken.get(token0) || filesterBuildCandidates(token0);
                                            let tried0 = filesterTriedByToken.get(token0);
                                            if (!tried0) { tried0 = new Set(); filesterTriedByToken.set(token0, tried0); }
                                            tried0.add(String(url));
                                            let nextUrl = '';
                                            for (const c of (candidates0 || [])) {
                                                if (!tried0.has(c)) { nextUrl = c; tried0.add(c); break; }
                                            }
                                            if (nextUrl) {
                                                log.post.info(postId, `::Filester cache 404 -> try next cache [${tried0.size}/${(candidates0 || []).length}]::: ${nextUrl}`, postNumber);
                                                try { filesterRefByUrl.set(String(nextUrl), 'https://filester.me/'); } catch (e) {}
                                                try { resource.url = nextUrl; } catch (e) {}
                                                try { url = nextUrl; } catch (e) {}
                                                startDownload(resource, pass);
                                                return;
                                            }
                                        }
                                    }


                                                                        // Filester: retry a few times on transient HTTP errors (429/400/etc) before switching to DIRECT.
                                    // Keep pauses short (<=~2.5s) and try alternate cacheN hosts (cache6 <-> cache1) when possible.
                                    if (badStatus) {
                                        const st0 = Number(response.status || 0) || 0;
                                        const isRetryable = (
                                            st0 === 429 ||
                                            st0 === 400 ||
                                            st0 === 403 ||
                                            st0 === 408 ||
                                            st0 === 409 ||
                                            st0 === 425 ||
                                            st0 === 500 ||
                                            st0 === 502 ||
                                            st0 === 503 ||
                                            st0 === 504
                                        );

                                        if (isRetryable) {
                                            const token0 = filesterTokenFromVUrl(String(url || ''));
                                            const key0 = token0 || String(url || '');
                                            const max0 = 3;

                                            let a0 = Number(filesterRetryAttemptsByKey.get(key0) || 0) || 0;
                                            a0++;
                                            filesterRetryAttemptsByKey.set(key0, a0);

                                            let waitMs = 0;
                                            const ra0 = headerValue(response.responseHeaders || '', 'retry-after');
                                            if (ra0) {
                                                const n0 = Number(String(ra0).trim());
                                                if (Number.isFinite(n0) && n0 > 0) waitMs = Math.floor(n0 * 1000);
                                            }
                                            if (!waitMs) {
                                                waitMs = (650 * a0) + Math.floor(Math.random() * 250);
                                            }
                                            waitMs = Math.min(2500, Math.max(0, waitMs));

                                            let nextUrl = '';
                                            if (token0) {
                                                const candidates0 = filesterCandidatesByToken.get(token0) || filesterBuildCandidates(token0);
                                                let tried0 = filesterTriedByToken.get(token0);
                                                if (!tried0) { tried0 = new Set(); filesterTriedByToken.set(token0, tried0); }
                                                tried0.add(String(url));

                                                const isOn6 = /https?:\/\/cache6\.filester\.(me|sh|si|gg)\//i.test(String(url || ''));
                                                const isOn1 = /https?:\/\/cache1\.filester\.(me|sh|si|gg)\//i.test(String(url || ''));

                                                // Prefer swapping cache6 <-> cache1 first.
                                                if (isOn6) {
                                                    for (const c of (candidates0 || [])) {
                                                        if (/https?:\/\/cache1\.filester\.(me|sh|si|gg)\//i.test(c) && !tried0.has(c)) { nextUrl = c; tried0.add(c); break; }
                                                    }
                                                } else if (isOn1) {
                                                    for (const c of (candidates0 || [])) {
                                                        if (/https?:\/\/cache6\.filester\.(me|sh|si|gg)\//i.test(c) && !tried0.has(c)) { nextUrl = c; tried0.add(c); break; }
                                                    }
                                                }

                                                if (!nextUrl) {
                                                    for (const c of (candidates0 || [])) {
                                                        if (!tried0.has(c)) { nextUrl = c; tried0.add(c); break; }
                                                    }
                                                }
                                            }

                                            if (a0 <= max0) {
                                                const tgt = nextUrl || String(url || '');
                                                // retry logging: include cache switch info (cache6<->cache1 etc.)
                                                let switchInfo = '';
                                                try {
                                                    const fromU = String(url || '');
                                                    const toU = String(nextUrl || '');
                                                    if (toU && toU !== fromU) {
                                                        const mf = /https?:\/\/(cache\d+)\.filester\.(me|sh|si|gg)\//i.exec(fromU);
                                                        const mt = /https?:\/\/(cache\d+)\.filester\.(me|sh|si|gg)\//i.exec(toU);
                                                        if (mf && mt) switchInfo = `; switching ${mf[1]}->${mt[1]}`;
                                                        else if (mf && !mt) switchInfo = `; switching ${mf[1]}->other`;
                                                        else if (!mf && mt) switchInfo = `; switching other->${mt[1]}`;
                                                        else switchInfo = '; switching host';
                                                    }
                                                } catch (e) {}
                                                log.post.info(postId, `::Filester HTTP ${st0} -> retry [${a0}/${max0}] after ${waitMs}ms${switchInfo}::: ${tgt}`, postNumber);

                                                setTimeout(() => {
                                                    try {
                                                        if (nextUrl) {
                                                            try { filesterRefByUrl.set(String(nextUrl), 'https://filester.me/'); } catch (e) {}
                                                            try { resource.url = nextUrl; } catch (e) {}
                                                            try { url = nextUrl; } catch (e) {}
                                                        }
                                                    } catch (e) {}
                                                    startDownload(resource, pass);
                                                }, waitMs);

                                                return;
                                            }
                                        }
                                    }

const isView = /https?:\/\/(?:www\.)?filester\.(me|sh|si|gg)\/d\//i.test(String(url || ''));
                                    if (!isView) {
                                        log.post.info(postId, `::Filester blocked/tiny response -> switch to DIRECT [1/2]::: ${url}`, postNumber);
                                        startDirectDownload({ size: hintSize || 0 });
                                        return;
                                    }

                                    // If we only have a /d/ view URL, DIRECT would just save HTML.
                                    log.post.error(postId, `::Filester failed (resolved to /d/ HTML view)::: ${url}`, postNumber);
                                    if (tryFallbackMirror('Filester HTML view')) return;
                                    finishBatchItem(false);

                                    h.ui.setText(statusLabel, `${completed} / ${totalDownloadable} 🢒 ${ellipsedUrl}`);
                                    h.ui.setElProps(statusLabel, { color: '#b23b3b' });
                                    h.ui.setElProps(totalPB, {
                                        width: `${(completed / totalDownloadable) * 100}%`,
                                    });
                                    return;
                                }

                                const reason = badStatus ? `HTTP ${response.status || 0}` : (isGate ? 'HTML/JSON gate' : 'tiny/blocked response');
                                log.post.error(postId, `::Filester failed (${reason})::: ${url}`, postNumber);
                                if (tryFallbackMirror(`Filester ${reason}`)) return;
                                finishBatchItem(false);

                                h.ui.setText(statusLabel, `${completed} / ${totalDownloadable} 🢒 ${ellipsedUrl}`);
                                h.ui.setElProps(statusLabel, { color: '#b23b3b' });
                                h.ui.setElProps(totalPB, {
                                    width: `${(completed / totalDownloadable) * 100}%`,
                                });
                                return;
                            }
                        }

                        // Bunkr: skip maintenance/dead placeholder responses (often tiny HTML) instead of saving a tiny file.
                        if (String((host && host.name) || '').toLowerCase() === 'bunkr' || /bunkr/i.test(String(url || '')) || /bunkr/i.test(String((resource && resource.original) || ''))) {
                            const mCt = /content-type:\s*([^\r\n]+)/i.exec(response.responseHeaders || '');
                            const ct = mCt && mCt[1] ? mCt[1] : '';
                            const isHtml = /text\/html|application\/xhtml\+xml/i.test(ct);
                            const badStatus = !response.status || response.status >= 400;

                            const bunkrFinalUrl = String(response.finalUrl || '');
                            const bunkrLoc = headerValue(response.responseHeaders || '', 'location');
                            const isMaint = (abortReason === 'bunkr_maint') || /\/maint\.mp4(\?|$)/i.test(bunkrFinalUrl) || /\/maint\.mp4(\?|$)/i.test(bunkrLoc);

                            const blob = response.response;
                            const size = blob && typeof blob.size === 'number' ? blob.size : 0;
                            const tinyLimit = 32768;

                            let tinyLooksLikeHtml = false;
                            if (!isHtml && !badStatus && postSettings.verifyBunkrLinks && size > 0 && size <= tinyLimit) {
                                try {
                                    const t = await blob.text();
                                    const head = String(t || '').slice(0, 2048).toLowerCase();
                                    tinyLooksLikeHtml =
                                        head.includes('<!doctype') ||
                                        head.includes('<html') ||
                                        head.includes('<head') ||
                                        head.includes('<body') ||
                                        head.includes('temporarily not available') ||
                                        head.includes('maintenance') ||
                                        head.includes('cloudflare');
                                } catch (e) {
                                    tinyLooksLikeHtml = false;
                                }
                            }

                            if (badStatus || isHtml || tinyLooksLikeHtml || isMaint) {
                                if (isMaint) bunkrMaintenanceHandled = true;
                                const reason = isMaint ? 'maintenance redirect (maint.mp4)' : (badStatus ? `HTTP ${response.status || 0}` : (isHtml ? 'HTML/maintenance response' : 'tiny HTML placeholder'));
                                log.post.error(postId, `::Bunkr skipped (${reason})::: ${url}`, postNumber);
                                if (tryFallbackMirror(`Bunkr ${reason}`)) return;
                                finishBatchItem(false);

                                h.ui.setText(statusLabel, `${completed} / ${totalDownloadable} 🢒 ${ellipsedUrl}`);
                                h.ui.setElProps(statusLabel, { color: '#b23b3b' });
                                h.ui.setElProps(totalPB, {
                                    width: `${(completed / totalDownloadable) * 100}%`,
                                });
                                return;
                            }
                        }

                        // Universal HTTP status guard (e.g. Pixeldrain 403 daily quota / 404 DMCA): fail over to mirror instead of saving error body!
                        if (!response.status || response.status >= 400) {
                            log.post.error(postId, `::HTTP ${response.status || 0} downloading::: ${url}`, postNumber);
                            if (tryFallbackMirror(`HTTP ${response.status || 0}`)) return;
                            finishBatchItem(false);
                            h.ui.setText(statusLabel, `${completed} / ${totalDownloadable} 🢒 ${ellipsedUrl}`);
                            h.ui.setElProps(statusLabel, { color: '#b23b3b' });
                            h.ui.setElProps(totalPB, {
                                width: `${(completed / totalDownloadable) * 100}%`,
                            });
                            return;
                        }

                        // Universal HTML error-page guard (e.g. Cyberdrop/ImageBam/Pixhost deleted file redirecting to 200 OK homepage HTML):
                        // prevent saving junk <!DOCTYPE html> files into Archives/ and trigger Smart Mirrors fallback!
                        {
                            const respCt = String(headerValue(response.responseHeaders || '', 'content-type') || '');
                            const isHtmlHeader = /text\/html|application\/xhtml\+xml/i.test(respCt);
                            const intentionalHtml = /\.html?(?:$|[?#])/i.test(String(url || ''));
                            const bObj = response.response;
                            let smallHtmlSniff = false;
                            if (!isHtmlHeader && !intentionalHtml && bObj && typeof bObj.size === 'number' && bObj.size > 0 && bObj.size < 65536) {
                                try {
                                    const headBytes = new Uint8Array(await xfpdReadBlobArrayBuffer(bObj.slice(0, 256)));
                                    const headAscii = String.fromCharCode(...headBytes).trimStart().toLowerCase();
                                    if (headAscii.startsWith('<!doctype html') || headAscii.startsWith('<html')) {
                                        smallHtmlSniff = true;
                                    }
                                } catch (e) {}
                            }
                            if ((isHtmlHeader || smallHtmlSniff) && !intentionalHtml) {
                                log.post.error(postId, `::Rejected HTML page response (dead/deleted host link)::: ${url}`, postNumber);
                                if (tryFallbackMirror('HTML error page')) return;
                                finishBatchItem(false);
                                h.ui.setText(statusLabel, `${completed} / ${totalDownloadable} 🢒 ${ellipsedUrl}`);
                                h.ui.setElProps(statusLabel, { color: '#b23b3b' });
                                h.ui.setElProps(totalPB, {
                                    width: `${(completed / totalDownloadable) * 100}%`,
                                });
                                return;
                            }
                        }

                        // Success path (finishBatchItem(true) and status update run after saving/zipping below)

                        // TODO: Extract to method.
                        let filename = filenames.find(f => f.url === url);
                        if (!filename && isGoFile) {
                            // GoFile URLs may be re-resolved to a file-*.gofile.io host, so match by GoFile fileId.
                            const mGf = String(url).match(/\/download\/(?:web|direct)\/([^\/?#]+)\//i);
                            const gid = mGf && mGf[1] ? mGf[1] : null;
                            if (gid) {
                                filename = filenames.find(f => f && f.gofileId === gid);

                                // If the per-run filenames list doesn't know this URL (e.g. re-resolved host),
                                // fall back to the global GoFile hint maps populated during /d/ resolution.
                                if (!filename) {
                                    const hinted =
                                        gofileNameById.get(String(gid)) ||
                                        gofileNameByUrl.get(String(url));
                                    if (hinted) {
                                        filename = { url, name: String(hinted), gofileId: String(gid) };
                                    }
                                }
                            }
                        }

                        if (!filename) {
                            const hintedFilester = filesterNameByUrl.get(String(url));
                            if (hintedFilester) {
                                filename = { url, name: String(hintedFilester) };
                            }
                        }

                        if (!filename) {
                            const hintedByUrl = cyberdropNameByUrl.get(String(url));
                            if (hintedByUrl) {
                                filename = { url, name: String(hintedByUrl) };
                            } else {
                                const mCd =
                                    String(url).match(/\/api\/file\/d\/([^\/\?#]+)\b/i) ||
                                    String(url).match(/cyberdrop\.[^\/]+\/(?:f|e)\/([^\/\?#]+)/i);
                                const slug = mCd && mCd[1] ? mCd[1] : null;
                                if (slug) {
                                    const hintedBySlug = cyberdropNameBySlug.get(String(slug));
                                    if (hintedBySlug) {
                                        filename = { url, name: String(hintedBySlug), cyberdropSlug: String(slug) };
                                    }
                                }
                            }
                        }

                        if (!filename) {
                            const stripIp = s => String(s || '').split('#')[0].split('?')[0].replace(/\/+$/, '');
                            const hintedImagePond =
                                imagepondNameByUrl.get(String(url)) ||
                                imagepondNameByUrl.get(stripIp(url)) ||
                                imagepondNameByUrl.get(String((resource && resource.original) || '')) ||
                                imagepondNameByUrl.get(stripIp((resource && resource.original) || ''));
                            if (hintedImagePond) {
                                filename = { url, name: String(hintedImagePond) };
                            }
                        }

                        let basename;

                        if (/(?:pixeldrain\.(?:com|net)|pixeldra\.in)/i.test(String(url || ''))) {
                            const rh = response && response.responseHeaders ? String(response.responseHeaders) : '';
                            basename =
                                parseDispositionFilename(rh) ||
                                (filename ? filename.name : '') ||
                                String((resource && resource.hintedFilename) || '') ||
                                h.basename(url).replace(/\?.*/, '').replace(/#.*/, '');
                        } else if (/\/attachments\//i.test(String(url || ''))) {
                            basename = filename ? filename.name : h.basename(url).replace(/(.*)-([a-z0-9]{3,4})\.\d+$/i, '$1.$2');
                        } else if (/kemono\.(cr|su|party)/i.test(String(url || ''))) {
                            basename = filename
                                ? filename.name
                            : h
                                .basename(url)
                                .replace(/(.*)\?f=(.*)/, '$2')
                                .replace('%20', ' ');
                        } else if (url.includes('cyberdrop')) {
                            const rh = response && response.responseHeaders ? String(response.responseHeaders) : '';
                            const cdName = parseDispositionFilename(rh);
                            basename = cdName
                                ? cdName
                                : (filename ? filename.name : h.basename(url).replace(/\?.*/, '').replace(/#.*/, ''));

                            try { basename = decodeURI(basename); } catch (e) {}

                            const extMatch = basename.match(/\.\w{3,6}$/);
                            const basename_ext = extMatch ? extMatch[0] : '';
                            if (basename_ext) {
                                basename =
                                    basename
                                        .replace(basename_ext, '')
                                        .replace(/(\.\w{3,6}-\w{8}$)|(-\w{8}$)/, '') +
                                    basename_ext;
                            }
                        } else {
                            // Turbo CDN signed URLs include the original filename in the fn= query param.
                            // Without this, we'd end up saving as the short id (e.g. uVOxoqFFlDGrZ.mp4).
                            if (url.includes('turbocdn.st')) {
                                const m = url.match(/[?&]fn=([^&]+)/i);
                                if (m && m[1]) {
                                    try {
                                        basename = decodeURIComponent(m[1].replace(/\+/g, '%20'));
                                    } catch (e) {
                                        basename = m[1];
                                    }
                                }
                            }

                            if (!basename) {
                                basename =
                                    (filename && filename.name) ||
                                    (resource && resource.hintedFilename) ||
                                    h.basename(url).replace(/\?.*/, '').replace(/#.*/, '');
                            }
                        }

                        // Bunkr: prefer the human filename (og:title / h1) captured during resolution.
                        if (isBunkr) {
                            try {
                                const strip = (u) => String(u || '').split('#')[0].split('?')[0];
                                const hinted =
                                    bunkrNameByUrl.get(String(url)) ||
                                    bunkrNameByUrl.get(strip(url)) ||
                                    bunkrNameByUrl.get(String((resource && resource.original) || '')) ||
                                    bunkrNameByUrl.get(strip((resource && resource.original) || '')) ||
                                    '';
                                if (hinted && String(hinted).trim() && !xfpdLooksLikeCfFilenameHint(hinted)) {
                                    basename = String(hinted).trim();

                                    // If hinted has no extension, derive it from URL first, then content-type.
                                    const hasExt = /\.[A-Za-z0-9]{1,8}$/.test(basename);
                                    if (!hasExt) {
                                        const urlExt = h.ext(h.basename(strip(url))) || '';
                                        const ct0 = headerValue(response.responseHeaders || '', 'content-type');
                                        let ext0 = '';
                                        if (urlExt) ext0 = String(urlExt);
                                        else if (/video\/mp4/i.test(ct0)) ext0 = 'mp4';
                                        else if (/video\/webm/i.test(ct0)) ext0 = 'webm';
                                        else if (/image\/jpe?g/i.test(ct0)) ext0 = 'jpg';
                                        else if (/image\/png/i.test(ct0)) ext0 = 'png';
                                        else if (/image\/gif/i.test(ct0)) ext0 = 'gif';
                                        else if (/application\/zip/i.test(ct0)) ext0 = 'zip';
                                        else if (/application\/(x-7z-compressed)/i.test(ct0)) ext0 = '7z';
                                        else if (/application\/(x-rar|vnd\.rar)|application\/octet-stream/i.test(ct0)) ext0 = 'rar';
                                        else if (/application\/pdf/i.test(ct0)) ext0 = 'pdf';
                                        if (ext0) basename = `${basename}.${ext0}`;
                                    }

                                    basename = sanitizeWinSegment(String(basename || ''));
                                    if (!basename) basename = sanitizeWinSegment(String(h.basename(strip(url)) || ''));
                                }
                            } catch (e) {}
                        }

                        // Filester: prefer the real filename (from view page / API hints). Only fall back to a safe slug-based name when needed.
                        if (isFilesterUrl(url)) {
                            try {
                                let slug0 = '';
                                const m = /https?:\/\/(?:www\.)?filester\.(me|sh|si|gg)\/d\/([^\/?#]+)/i.exec(String((resource && resource.original) || ''));
                                if (m && m[1]) slug0 = m[1];
                                if (!slug0) slug0 = String(filesterSlugByUrl.get(String(url)) || '');
                                const ct0 = headerValue(response.responseHeaders || '', 'content-type');
                                let ext0 = 'bin';
                                if (/video\/mp4/i.test(ct0)) ext0 = 'mp4';
                                else if (/video\/webm/i.test(ct0)) ext0 = 'webm';
                                else if (/image\/jpe?g/i.test(ct0)) ext0 = 'jpg';
                                else if (/image\/png/i.test(ct0)) ext0 = 'png';
                                else if (/image\/gif/i.test(ct0)) ext0 = 'gif';
                                else if (/application\/zip/i.test(ct0)) ext0 = 'zip';
                                else if (/application\/x-7z-compressed/i.test(ct0)) ext0 = '7z';
                                else if (/application\/(x-rar|vnd\.rar)/i.test(ct0)) ext0 = 'rar';

                                const hinted =
                                    String((filename && filename.name) || '') ||
                                    String(filesterNameByUrl.get(String(url)) || '') ||
                                    (slug0 ? String(filesterNameBySlug.get(String(slug0)) || '') : '');

                                if (hinted && hinted.trim()) {
                                    basename = hinted.trim();
                                    const hasExt = /\.[A-Za-z0-9]{1,8}$/.test(String(basename || ''));
                                    if (!hasExt && ext0) basename = `${basename}.${ext0}`;
                                } else if (slug0) {
                                    basename = `Filester_${slug0}.${ext0}`;
                                }

                                basename = sanitizeWinSegment(String(basename || ''));
                            } catch (e) {}
                        }




                        const fileBlob = response.response;
                        let ext = h.ext(basename);

                        const mimeType = mimeTypes.find(m => m.url === url);
                        const rawMime = String(
                            (mimeType && mimeType.type) ||
                                headerValue(response.responseHeaders || '', 'content-type') ||
                                (fileBlob && fileBlob.type) ||
                                '',
                        )
                            .split(';')[0]
                            .trim()
                            .toLowerCase();

                        if (!ext && rawMime) {
                            switch (rawMime) {
                                case 'image/jpeg':
                                case 'image/jpg':
                                    ext = 'jpg';
                                    break;
                                case 'image/png':
                                    ext = 'png';
                                    break;
                                case 'image/webp':
                                    ext = 'webp';
                                    break;
                                case 'image/gif':
                                    ext = 'gif';
                                    break;
                                case 'image/avif':
                                    ext = 'avif';
                                    break;
                                case 'image/bmp':
                                    ext = 'bmp';
                                    break;
                                case 'video/mp4':
                                    ext = 'mp4';
                                    break;
                                case 'video/webm':
                                    ext = 'webm';
                                    break;
                                case 'video/quicktime':
                                    ext = 'mov';
                                    break;
                                case 'video/x-matroska':
                                    ext = 'mkv';
                                    break;
                                case 'video/mp2t':
                                    ext = 'ts';
                                    break;
                                case 'application/zip':
                                case 'application/x-zip-compressed':
                                    ext = 'zip';
                                    break;
                                case 'application/vnd.rar':
                                case 'application/x-rar':
                                case 'application/x-rar-compressed':
                                    ext = 'rar';
                                    break;
                                case 'application/x-7z-compressed':
                                    ext = '7z';
                                    break;
                                default:
                                    ext = 'unknown';
                            }
                            if (ext && ext !== 'unknown') {
                                basename = `${basename}.${ext}`;
                            }
                        }

                        // Content-level byte deduplication (catches identical photos/videos/archives even with different filenames or hosts!)
                        let blobFingerprint = '';
                        if (useContentDedup && fileBlob && typeof fileBlob.size === 'number' && fileBlob.size > 0) {
                            blobFingerprint = await xfpdComputeBlobFingerprint(fileBlob);
                            if (isCancelled()) {
                                notifyBatchStep();
                                return;
                            }
                            if (blobFingerprint && xfpdHasSeenThreadHash(blobFingerprint, activeThreadKey)) {
                                log.separator(postId);
                                log.post.info(
                                    postId,
                                    `::Skipped duplicate content (identical byte hash)::: ${basename} ::from:: ${url}`,
                                    postNumber,
                                );
                                finishBatchItem('dedup');
                                h.ui.setText(statusLabel, `${completed} / ${totalDownloadable} (dupe skipped) 🢒 ${ellipsedUrl}`);
                                h.ui.setElProps(statusLabel, { color: '#2d9053' });
                                h.ui.setElProps(totalPB, {
                                    width: `${(completed / totalDownloadable) * 100}%`,
                                });
                                return;
                            }
                        }

                        // Auto-Extract Archives (.zip / .rar RAR4+RAR5 / .7z / .tar.gz): unpack photos & videos directly into
                        // Photos/ and Videos/ with per-file SHA-256 deduplication instead of saving the raw archive!
                        if (
                            postSettings.extractArchives !== false &&
                            fileBlob &&
                            typeof fileBlob.size === 'number' &&
                            fileBlob.size > 0 &&
                            fileBlob.size <= XFPD_MAX_EXTRACT_ARCHIVE_BYTES &&
                            !xfpdIsMultiVolumePartName(basename) &&
                            !xfpdIsNonMediaContainerZipExt(basename)
                        ) {
                            let isArchiveBlob = xfpdIsExtractableArchiveCandidate(basename, rawMime);
                            if (!isArchiveBlob && (!ext || ext === 'unknown' || ext === 'bin' || rawMime === 'application/octet-stream')) {
                                const magic = await xfpdInspectArchiveHeader(fileBlob);
                                if (magic && magic.kind) isArchiveBlob = true;
                            }

                            if (isArchiveBlob) {
                                h.ui.setElProps(statusLabel, { color: '#3DB7C7' });
                                h.ui.setText(statusLabel, `${completed} / ${totalDownloadable} 🢒 📦 Extracting ${h.limit(basename, 42)}...`);

                                const extractRes = await xfpdExtractArchiveBlob(
                                    fileBlob,
                                    basename,
                                    parsedPost && Array.isArray(parsedPost.spoilers) ? parsedPost.spoilers : [],
                                );

                                if (isCancelled()) {
                                    notifyBatchStep();
                                    return;
                                }

                                if (extractRes && extractRes.ok && Array.isArray(extractRes.entries) && extractRes.entries.length > 0) {
                                    const rawArchiveStem = ext ? h.fnNoExt(basename) : basename;
                                    const archiveLabel = cleanAlbumLabel(rawArchiveStem) || sanitizeWinSegment(rawArchiveStem, '');
                                    const subWidth = Math.max(2, String(extractRes.entries.length).length);
                                    const titleClean = sanitizeWinSegment(threadTitle);
                                    const effectiveLay = resolveEffectiveLayout();
                                    const saveTasks = [];
                                    let savedFromArchive = 0;
                                    let dedupedFromArchive = 0;

                                    for (let idx = 0; idx < extractRes.entries.length; idx++) {
                                        if (isCancelled()) {
                                            notifyBatchStep();
                                            return;
                                        }
                                        const item = extractRes.entries[idx];
                                        if (useContentDedup) {
                                            const itemFp = await xfpdComputeBlobFingerprint(item.blob);
                                            if (itemFp && xfpdHasSeenThreadHash(itemFp, activeThreadKey)) {
                                                dedupedFromArchive++;
                                                log.post.info(
                                                    postId,
                                                    `::Skipped duplicate extracted file (identical byte hash)::: ${item.basename} ::in:: ${basename}`,
                                                    postNumber,
                                                );
                                                continue;
                                            }
                                            if (itemFp) {
                                                xfpdMarkSeenThreadHash(itemFp, activeThreadKey);
                                            }
                                        }

                                        const subSeqTag = String(idx + 1).padStart(subWidth, '0');
                                        const itemStemLow = String(h.fnNoExt(item.basename) || '').toLowerCase();
                                        const archLow = String(archiveLabel || '').toLowerCase();
                                        const decoratedBase =
                                            archiveLabel &&
                                            ['media', 'post', 'post-media'].includes(effectiveLay) &&
                                            !itemStemLow.includes(archLow.slice(0, Math.min(12, archLow.length)))
                                                ? `${archiveLabel} - ${item.basename}`
                                                : item.basename;

                                        let entryFn = buildTargetRelativePath({
                                            basename: decoratedBase,
                                            folderName: folderName || archiveLabel,
                                            seqIndex: resource && resource._seqIndex,
                                            subSeqTag,
                                            contentType: item.mime,
                                            hostCategory: '',
                                            sanitizeSegFn: sanitizeWinSegment,
                                            sanitizePathFn: sanitizeWinPath,
                                        });
                                        entryFn = ensureUniquePath(entryFn);
                                        savedFromArchive++;

                                        if (zippedForThis) {
                                            zip.file(entryFn, item.blob);
                                            zipFileCount++;
                                        } else {
                                            const entrySaveFF = `${titleClean} #${postNumber} - ${ensureUniqueFlatName(entryFn.replace(/\//g, ' - '))}`;
                                            const entrySavePath = `${titleClean}/${entryFn}`;
                                            const entrySaveName = isFF ? entrySaveFF : entrySavePath;
                                            saveTasks.push({ blob: item.blob, saveName: entrySaveName, relFn: entryFn });
                                        }
                                    }

                                    // Dispatch extracted files to disk with bounded concurrency (6 at a time) so Chrome's
                                    // download manager never drops items on 100+ file archives!
                                    if (saveTasks.length > 0) {
                                        let tCursor = 0;
                                        const saveWorker = async () => {
                                            while (!isCancelled() && tCursor < saveTasks.length) {
                                                const task = saveTasks[tCursor++];
                                                if (!task) continue;
                                                await new Promise(resolveSave => {
                                                    const bUrl = URL.createObjectURL(task.blob);
                                                    let settled = false;
                                                    const doneSave = () => {
                                                        if (settled) return;
                                                        settled = true;
                                                        setTimeout(() => {
                                                            try { URL.revokeObjectURL(bUrl); } catch (e) {}
                                                        }, 1000);
                                                        resolveSave();
                                                    };
                                                    const safetyTimer = setTimeout(doneSave, 15000);
                                                    try {
                                                        GM_download({
                                                            url: bUrl,
                                                            name: task.saveName,
                                                            onload: () => {
                                                                clearTimeout(safetyTimer);
                                                                doneSave();
                                                            },
                                                            onerror: err => {
                                                                clearTimeout(safetyTimer);
                                                                console.warn('[XFPD] Error saving extracted file:', task.relFn, err);
                                                                doneSave();
                                                            },
                                                            ontimeout: () => {
                                                                clearTimeout(safetyTimer);
                                                                doneSave();
                                                            },
                                                        });
                                                    } catch (e) {
                                                        clearTimeout(safetyTimer);
                                                        doneSave();
                                                    }
                                                });
                                            }
                                        };
                                        const poolSize = Math.min(6, saveTasks.length);
                                        const pool = [];
                                        for (let w = 0; w < poolSize; w++) pool.push(saveWorker());
                                        await Promise.all(pool);
                                    }

                                    if (useContentDedup) {
                                        if (blobFingerprint) xfpdMarkSeenThreadHash(blobFingerprint, activeThreadKey);
                                        const cKey = (resource && resource._canonicalKey) || canonicalizeMediaUrl(url);
                                        if (cKey) xfpdMarkSeenThreadUrl(cKey, activeThreadKey);
                                    }

                                    log.separator(postId);
                                    log.post.info(
                                        postId,
                                        `::Extracted archive (${extractRes.engine})::: ${basename} -> ${savedFromArchive} saved, ${dedupedFromArchive} dupes skipped`,
                                        postNumber,
                                    );

                                    finishBatchItem(savedFromArchive === 0 && dedupedFromArchive > 0 ? 'dedup' : true);
                                    h.ui.setText(
                                        statusLabel,
                                        `${completed} / ${totalDownloadable} (📦 unpacked ${savedFromArchive}${dedupedFromArchive ? `, ${dedupedFromArchive} dupes` : ''}) 🢒 ${ellipsedUrl}`,
                                    );
                                    h.ui.setElProps(statusLabel, { color: '#2d9053' });
                                    h.ui.setElProps(totalPB, {
                                        width: `${(completed / totalDownloadable) * 100}%`,
                                    });
                                    return;
                                }

                                log.post.info(
                                    postId,
                                    `::Archive not extracted (${(extractRes && extractRes.reason) || 'unsupported/locked'}) -> saving archive in Archives/::: ${basename}`,
                                    postNumber,
                                );
                            }
                        }

                        if (useContentDedup) {
                            if (blobFingerprint) xfpdMarkSeenThreadHash(blobFingerprint, activeThreadKey);
                            const cKey = (resource && resource._canonicalKey) || canonicalizeMediaUrl(url);
                            if (cKey) xfpdMarkSeenThreadUrl(cKey, activeThreadKey);
                            if (resource && !resource.folderName && resource.original) {
                                const oKey = canonicalizeMediaUrl(resource.original);
                                if (oKey) xfpdMarkSeenThreadUrl(oKey, activeThreadKey);
                            }
                        }

                        const original = basename;

                        if (['flat', 'albums'].includes(resolveEffectiveLayout()) && filenames.find(f => f.original === basename)) {
                            const count = filenames.filter(f => f.original === basename).length;
                            const baseNoExt = (ext && h.fnNoExt(basename)) ? h.fnNoExt(basename) : basename;
                            basename = ext ? `${baseNoExt} (${count + 1}).${ext}` : `${baseNoExt} (${count + 1})`;
                        }

                        if (!filename) {
                            filenames.push({ url, name: basename, original });
                        }

                        const folder = folderName || '';
                        let fn = buildTargetRelativePath({
                            basename,
                            folderName: folder,
                            seqIndex: resource && resource._seqIndex,
                            contentType: rawMime,
                            hostCategory: host && host.category,
                            sanitizeSegFn: sanitizeWinSegment,
                            sanitizePathFn: sanitizeWinPath,
                        });

                        fn = ensureUniquePath(fn);
                        basename = h.basename(fn);

                        log.separator(postId);
                        log.post.info(postId, `::Completed::: ${url}`, postNumber);
                        log.post.info(postId, `::Saving as::: ${fn}`, postNumber);

                        let title = sanitizeWinSegment(threadTitle);

                        const saveAsFF = `${title} #${postNumber} - ${ensureUniqueFlatName(fn.replace(/\//g, ' - '))}`;
                        const saveAsPath = `${title}/${fn}`;

                        const saveAsName = (isFF && !zippedForThis) ? saveAsFF : saveAsPath;

                        if (!zippedForThis) {
                            const blobUrl = URL.createObjectURL(fileBlob);
                            GM_download({
                                url: blobUrl,
                                name: saveAsName,
                                onload: () => {
                                    try { URL.revokeObjectURL(blobUrl); } catch (e) {}
                                },
                                onerror: response => {
                                    console.log(`Error writing file ${fn} to disk. There may be more details below.`);
                                    console.log(response);
                                    try { URL.revokeObjectURL(blobUrl); } catch (e) {}
                                },
                            });
                        }

                        if (zippedForThis) {
                            zip.file(fn, fileBlob);
                            zipFileCount++;
                        }

                        finishBatchItem(true);
                        h.ui.setText(statusLabel, `${completed} / ${totalDownloadable} 🢒 ${ellipsedUrl}`);
                        h.ui.setElProps(statusLabel, { color: '#2d9053' });
                        h.ui.setElProps(totalPB, {
                            width: `${(completed / totalDownloadable) * 100}%`,
                        });
                    },

                    onabort: () => {
                        if (progressEntry.intervalId) clearInterval(progressEntry.intervalId);
                        if (isCancelled()) {
                            notifyBatchStep();
                            return;
                        }
                        if (abortReason !== 'bunkr_maint' || bunkrMaintenanceHandled) return;
                        bunkrMaintenanceHandled = true;

                        log.post.error(postId, `::Bunkr skipped (maintenance redirect: maint.mp4)::: ${url}`, postNumber);
                        if (tryFallbackMirror('Bunkr maint.mp4')) return;
                        finishBatchItem(false);

                        h.ui.setText(statusLabel, `${completed} / ${totalDownloadable} 🢒 ${ellipsedUrl}`);
                        h.ui.setElProps(statusLabel, { color: '#b23b3b' });
                        h.ui.setElProps(totalPB, {
                            width: `${(completed / totalDownloadable) * 100}%`,
                        });
                    },

                    onerror: () => {
                        if (progressEntry.intervalId) clearInterval(progressEntry.intervalId);
                        if (isCancelled()) {
                            notifyBatchStep();
                            return;
                        }

                        if (switchedToDirect) return;

                        if (isGoFile && pass === 1 && !gofileWarmupAttempted.has(url)) {
                            gofileWarmupAttempted.add(url);
                            log.post.info(postId, `::GoFile warm-up -> open tab (${GOFILE_WARMUP_MS}ms) then retry [1/2]::: ${url}`, postNumber);
                            gofileWarmupOpenTab(url);
                            setTimeout(() => startDownload(resource, 2), GOFILE_WARMUP_MS);
                            return;
                        }

                        log.post.error(postId, `::Network error downloading::: ${url}`, postNumber);
                        if (tryFallbackMirror('Network error')) return;
                        finishBatchItem(false);
                    },
                });

                requests.push({ url: progressKey, request });

                const stallMs = isTurbo ? TURBO_STALL_MS : 30000;

                const intervalId = setInterval(async () => {
                    if (isCancelled()) {
                        clearInterval(intervalId);
                        notifyBatchStep();
                        return;
                    }
                    const p = progressEntry;

                    // Large files switch to DIRECT mid-download: that aborts this request and hands
                    // off to GM_download. request.abort() does not reliably fire onload/onerror once
                    // a blob response is buffered (see the GoFile duplicate-save fix), so nothing
                    // clears this interval. Without the guard the watchdog then reports a false
                    // ::Stalled/Failed:: for a download that actually succeeded, and increments the
                    // counter a second time -- the DIRECT onload already counts it, giving 3/2.
                    if (switchedToDirect) {
                        clearInterval(p.intervalId);
                        return;
                    }

                    if (p.old === p.new) {
                        try { if (request) request.abort(); } catch (e) {}
                        clearInterval(p.intervalId);

                        // Turbo: fast re-sign + retry, then (optional) direct fallback.
                        if (isTurbo) {
                            const st = turboRetryState.get(turboKey) || { resign: 0, direct: 0 };

                            if (st.resign < TURBO_RESIGN_RETRIES) {
                                st.resign++;
                                turboRetryState.set(turboKey, st);

                                log.post.info(postId, `::Turbo stalled (no progress for ${Math.round(stallMs / 1000)}s) -> re-sign + retry [${st.resign}/${TURBO_RESIGN_RETRIES}]::: ${url}`, postNumber);

                                try {
                                    const newUrl = await turboResignSignedUrl(turboId, url);
                                    if (newUrl) {
                                        resource.url = newUrl;
                                    }
                                } catch (e) {}

                                // Retry once (even if we couldn't re-sign, a plain retry sometimes works).
                                setTimeout(() => startDownload(resource, pass + 1), st.resign >= 3 ? TURBO_RETRY_DELAY_MS * 2 : TURBO_RETRY_DELAY_MS);
                                return;
                            }

                            if (st.direct < TURBO_DIRECT_FALLBACKS) {
                                st.direct++;
                                turboRetryState.set(turboKey, st);

                                log.post.info(postId, `::Turbo stalled (no progress for ${Math.round(stallMs / 1000)}s) -> DIRECT fallback (outside ZIP) [${st.direct}/${TURBO_DIRECT_FALLBACKS}]::: ${url}`, postNumber);
                                startDirectDownload();
                                return;
                            }

                            log.post.error(postId, `::Turbo failed (stalled after retries)::: ${url}`, postNumber);
                            if (tryFallbackMirror('Turbo stalled')) return;
                            finishBatchItem(false);
                            return;
                        }

                        // Make stalls visible instead of silently counting a failed download as
                        // complete (previously only GoFile logged this; every other host -- Bunkr
                        // included -- fell through to completed++ with no indication of failure).
                        log.post.error(postId, `::Stalled/Failed::: ${url}`, postNumber);

                        if (isGoFile && pass === 1 && !gofileWarmupAttempted.has(url)) {
                            gofileWarmupAttempted.add(url);
                            log.post.info(postId, `::GoFile stalled -> warm-up tab (${GOFILE_WARMUP_MS}ms) then retry [1/2]::: ${url}`, postNumber);
                            gofileActivePass.set(url, 2);
                            gofileWarmupOpenTab(url);
                            setTimeout(() => startDownload(resource, 2), GOFILE_WARMUP_MS);
                            return;
                        }

                        if (tryFallbackMirror('Stalled')) return;
                        finishBatchItem(false);
                    } else {
                        p.old = p.new;
                    }
                }, stallMs);

                progressEntry.intervalId = intervalId;
                requestProgress.push(progressEntry);
            };

            let batch = getNextBatch();

            while (batch.length && !isCancelled()) {
                completedBatchedDownloads = 0;

                for (const item of batch) {
                    if (isCancelled()) break;
                    startDownload(item, 1);
                }

                while (completedBatchedDownloads < batch.length && !isCancelled()) {
                    await waitBatchTurn(100);
                }

                completedBatchedDownloads = 0;
                batch = getNextBatch();
            }
        }
    } else {
        log.post.info(postId, '::Skipping download::', postNumber);
    }

    if (isCancelled()) {
        log.post.info(postId, `::Download cancelled (${succeededCount}/${totalDownloadable} completed)::`, postNumber);
        h.hide(filePB);
        h.hide(totalPB);
        h.ui.setElProps(statusLabel, { color: '#e8a838', fontWeight: 'bold' });
        h.ui.setText(statusLabel, `Cancelled (${succeededCount} / ${totalDownloadable} downloaded)`);
        h.show(statusLabel);
        if (callbacks && typeof callbacks.onCancel === 'function') {
            callbacks.onCancel(totalDownloadable, succeededCount);
        }
        return;
    }

    h.hide(filePB);
    h.hide(totalPB);

    if (totalDownloadable > 0) {
        let title = sanitizeWinSegment(threadTitle);

        const mainZipName = customFilename || `${title} #${postNumber}.zip`;
        const generatedZipName = `${title} #${postNumber} generated.zip`;
        const needZipBlob = (postSettings.generateLog || postSettings.generateLinks || (postSettings.zipped && zipFileCount > 0));

        // If "Zipped" is enabled but nothing was added to the ZIP (e.g. everything was saved via DIRECT),
        // skip creating an empty ZIP file.
        if (postSettings.zipped && zipFileCount === 0 && !postSettings.generateLog && !postSettings.generateLinks) {
            log.post.info(postId, `::Zipped ON but nothing to zip (all DIRECT downloads) -> skipping ZIP::`, postNumber);
        }

        if (needZipBlob) {
            log.separator(postId);
            log.post.info(postId, postSettings.zipped ? `::Preparing zip::` : `::Preparing generated.zip::`, postNumber);
            h.ui.setElProps(statusLabel, { color: '#469cf3', fontWeight: 'bold' });
            h.ui.setText(statusLabel, postSettings.zipped ? 'Packaging ZIP archive...' : 'Packaging generated.zip...');
            h.show(statusLabel);

            if (postSettings.generateLog) {
                log.post.info(postId, `::Generating log file::`, postNumber);
                zip.file(
                    isFF ? 'generated/log.txt' : 'log.txt',
                    logs
                        .filter(l => l.postId === postId)
                        .map(l => l.message)
                        .join('\n'),
                );
            }

            if (postSettings.generateLinks) {
                log.post.info(postId, `::Generating links::`, postNumber);
                zip.file(
                    isFF ? 'generated/links.txt' : 'links.txt',
                    resolved
                        .filter(r => r.url)
                        .map(r => r.url)
                        .join('\n'),
                );
            }

            let blob = null;
            try {
                blob = await zip.generateAsync({ type: 'blob' });
            } catch (e) {
                console.log('JSZip failed to construct the Blob. For very large albums, try unzipped mode.');
                console.log(e);
                blob = null;
            }

            if (blob) {
                if (postSettings.zipped) {
                    if (isFF) {
                        saveAs(blob, mainZipName);
                    } else {
                        await new Promise(resolve => {
                            const url = URL.createObjectURL(blob);
                            GM_download({
                                url,
                                name: `${title}/#${postNumber}.zip`,
                                onload: () => {
                                    try { URL.revokeObjectURL(url); } catch (e) {}
                                    blob = null;
                                    resolve();
                                },
                                onerror: response => {
                                    try { URL.revokeObjectURL(url); } catch (e) {}
                                    console.log(`Error writing file to disk. There may be more details below.`);
                                    console.log(response);
                                    console.log('Trying to write using FileSaver...');
                                    try { saveAs(blob, mainZipName); } catch (e) {}
                                    console.log('Done!');
                                    resolve();
                                },
                            });
                        });
                    }
                } else {
                    if (postSettings.generateLog || postSettings.generateLinks) {
                        if (isFF) {
                            saveAs(blob, generatedZipName);
                        } else {
                            await new Promise(resolve => {
                                const url = URL.createObjectURL(blob);
                                GM_download({
                                    url,
                                    name: `${title}/#${postNumber}/generated.zip`,
                                    onload: () => {
                                        try { URL.revokeObjectURL(url); } catch (e) {}
                                        blob = null;
                                        resolve();
                                    },
                                    onerror: response => {
                                        try { URL.revokeObjectURL(url); } catch (e) {}
                                        console.log(`Error writing generated.zip to disk. There may be more details below.`);
                                        console.log(response);
                                        blob = null;
                                        resolve();
                                    },
                                });
                            });
                        }
                    }
                }
            }
        }
    }

    if (totalDownloadable > 0) {
        if (!postSettings.skipDownload) {
            log.post.info(postId, `::Download completed (${succeededCount}/${totalDownloadable} succeeded)::`, postNumber);
        } else {
            log.post.info(postId, `::Links generation completed::`, postNumber);
        }
    }

    // Snapshot post logs for one-click Copy Log before clearing window.logs.
    try {
        const postLogsText = window.logs
            .filter(l => l.postId === postId)
            .map(l => l.message)
            .join('\n');
        if (postLogsText) {
            // Keep at most 30 recent post logs in memory so long browsing sessions stay lean.
            if (postLastLogs.size >= 30 && !postLastLogs.has(postId)) {
                const oldestKey = postLastLogs.keys().next().value;
                if (oldestKey !== undefined) postLastLogs.delete(oldestKey);
            }
            postLastLogs.set(postId, postLogsText);
        }
    } catch (e) {}

    const effectiveTargetTotal = Math.max(0, totalDownloadable - runtimeDedupedCount);
    const totalFailedWithResolve = failedCount + resolveFailedCount;
    const reportedTargetTotal = effectiveTargetTotal + resolveFailedCount;

    if (postSettings.skipDownload) {
        h.hide(statusLabel);
    } else if (reportedTargetTotal === 0 && dedupedCount > 0 && totalFailedWithResolve === 0) {
        h.ui.setElProps(statusLabel, { color: '#47ba24', fontWeight: 'bold' });
        h.ui.setText(statusLabel, `All ${dedupedCount} item(s) already downloaded (duplicates skipped)`);
        h.show(statusLabel);
    } else if (totalDownloadable === 0 && totalResources > 0) {
        h.ui.setElProps(statusLabel, { color: '#d9534f', fontWeight: 'bold' });
        h.ui.setText(statusLabel, `0 / ${totalResources} resolved (dead/locked links)`);
        appendCopyLogButton(statusLabel, postId);
        h.show(statusLabel);
    } else if (totalFailedWithResolve > 0 || succeededCount < effectiveTargetTotal) {
        h.ui.setElProps(statusLabel, { color: succeededCount > 0 ? '#e8a838' : '#d9534f', fontWeight: 'bold' });
        h.ui.setText(
            statusLabel,
            `${succeededCount} / ${reportedTargetTotal} downloaded${totalFailedWithResolve > 0 ? ` (${totalFailedWithResolve} failed)` : ''}${dedupedCount > 0 ? ` · ${dedupedCount} dupes skipped` : ''}`,
        );
        appendCopyLogButton(statusLabel, postId);
        h.show(statusLabel);
    } else if (runtimeDedupedCount > 0) {
        h.ui.setElProps(statusLabel, { color: '#47ba24', fontWeight: 'bold' });
        h.ui.setText(statusLabel, `${succeededCount} saved · ${dedupedCount} duplicate(s) skipped`);
        h.show(statusLabel);
    } else {
        h.hide(statusLabel);
    }

    if (totalDownloadable > 0 || totalResources > 0) {
        callbacks &&
            callbacks.onComplete &&
            callbacks.onComplete(
                reportedTargetTotal,
                postSettings.skipDownload ? totalDownloadable : succeededCount,
                totalFailedWithResolve,
                dedupedCount,
                postLastLogs.get(postId) || '',
            );
    }
    } finally {
        activePostControllers.delete(postId);
        setProcessing(false, postId);

        if (!processing.some(p => p.processing)) {
            gofileRestoreCookie();
        }

        window.logs = window.logs.filter(l => l.postId !== postId);
    }
};

/**
 * @param post
 */
const addDuplicateTabLink = post => {
    const parent = post?.parentNode;
    if (!parent) return;
    const attrMain = parent.querySelector('.message-attribution-main');
    const templateLI = parent.querySelector('.u-concealed');
    if (!attrMain || !templateLI || attrMain.querySelector('.duplicate-tab')) return;

    const span = document.createElement('span');
    span.innerHTML = '<i class="fa fa-copy"></i> Duplicate Tab';

    const dupTabLI = templateLI.cloneNode(true);
    dupTabLI.setAttribute('class', 'duplicate-tab');

    const anchor = dupTabLI.querySelector('a');
    if (!anchor) return;
    anchor.style.color = 'rgb(138, 138, 138)';
    anchor.setAttribute('target', '_blank');
    anchor.querySelector('time')?.remove();
    if (anchor.parentNode) anchor.parentNode.style.marginLeft = '10px';
    anchor.append(span);

    attrMain.append(dupTabLI);
};

/**
 * @param post
 */
const addShowDownloadPageBtnLink = post => {
    const parent = post?.parentNode;
    if (!parent) return;
    const attrMain = parent.querySelector('.message-attribution-main');
    const templateLI = parent.querySelector('.u-concealed');
    if (!attrMain || !templateLI || attrMain.querySelector('.show-download-page')) return;

    const span = document.createElement('span');
    span.innerHTML = '<i class="fa fa-arrow-up"></i> Download Page';

    const dupTabLI = templateLI.cloneNode(true);
    dupTabLI.setAttribute('class', 'show-download-page');

    const anchor = dupTabLI.querySelector('a');
    if (!anchor) return;
    anchor.style.color = 'rgb(138, 138, 138)';
    anchor.setAttribute('href', '#download-page');
    anchor.querySelector('time')?.remove();
    if (anchor.parentNode) anchor.parentNode.style.marginLeft = '10px';
    anchor.append(span);
    anchor.addEventListener('click', e => {
        if (typeof window.__xfpdFocusDownloadPage === 'function') {
            e.preventDefault();
            window.__xfpdFocusDownloadPage();
        }
    });

    attrMain.append(dupTabLI);
};

// TODO: Extract to ui.js
const xfpdGetThreadPaginationInfo = (doc = document, baseHref = location.href) => {
    let currentPage = 1;
    let totalPages = 1;
    try {
        const u = new URL(baseHref, location.origin);
        const mPath = /\/page-(\d+)(?:\/|$)/i.exec(u.pathname || '');
        if (mPath && mPath[1]) {
            currentPage = Math.max(1, parseInt(mPath[1], 10) || 1);
        } else if (u.searchParams.has('page')) {
            currentPage = Math.max(1, parseInt(u.searchParams.get('page'), 10) || 1);
        }
    } catch (e) {}

    try {
        doc.querySelectorAll('.pageNav-main .pageNav-page a, .pageNav-page a').forEach(a => {
            const numTxt = parseInt(String(a.textContent || '').replace(/[^\d]/g, ''), 10);
            if (numTxt > totalPages) totalPages = numTxt;
            const href = a.getAttribute('href') || '';
            const mh = /\/page-(\d+)(?:\/|[?#]|$)/i.exec(href) || /[?&]page=(\d+)/i.exec(href);
            if (mh && mh[1]) {
                const nh = parseInt(mh[1], 10);
                if (nh > totalPages) totalPages = nh;
            }
        });
        doc.querySelectorAll('input.js-pageJumpPage[max]').forEach(inp => {
            const mx = parseInt(inp.getAttribute('max') || '', 10);
            if (mx > totalPages) totalPages = mx;
        });
        const simpleEl = doc.querySelector('.pageNavSimple-el--current');
        if (simpleEl) {
            const ms = /(\d+)\s+of\s+(\d+)/i.exec(String(simpleEl.textContent || ''));
            if (ms && ms[2]) {
                const ns = parseInt(ms[2], 10);
                if (ns > totalPages) totalPages = ns;
            }
        }
    } catch (e) {}

    totalPages = Math.max(1, currentPage, totalPages);

    const buildPageUrl = pageNum => {
        const p = Math.max(1, parseInt(pageNum, 10) || 1);
        try {
            const u = new URL(baseHref, location.origin);
            u.hash = '';
            const basePath = (u.pathname || '').replace(/\/(?:page-\d+|post-\d+)(?:\/.*)?$/i, '').replace(/\/+$/, '');
            if (u.searchParams.has('page')) {
                if (p <= 1) u.searchParams.delete('page');
                else u.searchParams.set('page', String(p));
                return u.href;
            }
            u.search = '';
            u.pathname = p <= 1 ? `${basePath}/` : `${basePath}/page-${p}`;
            return u.href;
        } catch (e) {
            const clean = String(baseHref || '').split('#')[0].split('?')[0].replace(/\/(?:page-\d+|post-\d+).*$/i, '').replace(/\/+$/, '');
            return p <= 1 ? `${clean}/` : `${clean}/page-${p}`;
        }
    };

    return { currentPage, totalPages, buildPageUrl };
};

const ensureTopThreadButtonGroup = () => {
    const messagesBlock =
        h.element('.block.block--messages') ||
        h.element('.block--messages') ||
        (h.element('.js-post, article.message') && h.element('.js-post, article.message').closest('.block'));

    let topOuter =
        (messagesBlock &&
            (messagesBlock.querySelector(':scope > .block-outer:not(.block-outer--after)') ||
                messagesBlock.querySelector('.block-outer:not(.block-outer--after)'))) ||
        h.element('.block--messages .block-outer:not(.block-outer--after)');

    if (!topOuter && messagesBlock) {
        topOuter = document.createElement('div');
        topOuter.className = 'block-outer';
        topOuter.style.paddingBottom = '8px';
        const opposite = document.createElement('div');
        opposite.className = 'block-outer-opposite';
        topOuter.appendChild(opposite);
        messagesBlock.prepend(topOuter);
    }

    let buttonGroup = topOuter ? topOuter.querySelector('.buttonGroup') : null;
    if (!buttonGroup && topOuter) {
        let outerOpposite = topOuter.querySelector('.block-outer-opposite');
        if (!outerOpposite) {
            outerOpposite = document.createElement('div');
            outerOpposite.className = 'block-outer-opposite';
            topOuter.appendChild(outerOpposite);
        }
        buttonGroup = document.createElement('div');
        buttonGroup.setAttribute('class', 'buttonGroup');
        buttonGroup.style.display = 'inline-block';
        buttonGroup.style.marginRight = '6px';
        outerOpposite.prepend(buttonGroup);
    }
    return buttonGroup;
};

const addDownloadPageButton = () => {
    const existing = h.element('#download-page');
    if (existing) return existing;

    const downloadAllButton = document.createElement('a');
    downloadAllButton.setAttribute('id', 'download-page');
    downloadAllButton.setAttribute('href', '#');
    downloadAllButton.setAttribute('class', 'button--link button rippleButton');
    downloadAllButton.style.borderColor = 'rgba(61, 183, 199, 0.55)';

    const buttonTextSpan = document.createElement('span');
    buttonTextSpan.setAttribute('class', 'button-text download-page-btn');
    buttonTextSpan.innerText = `🡳 Download All Page`;

    downloadAllButton.appendChild(buttonTextSpan);

    const buttonGroup = ensureTopThreadButtonGroup();
    if (buttonGroup) {
        buttonGroup.prepend(downloadAllButton);
    } else {
        const pageAction = h.element('.p-title-pageAction') || h.element('.p-body-header');
        if (pageAction) {
            pageAction.prepend(downloadAllButton);
        }
    }

    return downloadAllButton;
};

const addDownloadThreadButton = () => {
    const existing = h.element('#download-thread');
    if (existing) return existing;

    const btn = document.createElement('a');
    btn.setAttribute('id', 'download-thread');
    btn.setAttribute('href', '#');
    btn.setAttribute('class', 'button--link button rippleButton');
    btn.style.borderColor = 'rgba(61, 183, 199, 0.75)';
    btn.style.color = '#3DB7C7';

    const span = document.createElement('span');
    span.setAttribute('class', 'button-text download-thread-btn');
    span.innerText = '📚 Download Thread';
    btn.appendChild(span);

    const buttonGroup = ensureTopThreadButtonGroup();
    if (buttonGroup) {
        buttonGroup.prepend(btn);
    } else {
        const pageAction = h.element('.p-title-pageAction') || h.element('.p-body-header');
        if (pageAction) {
            pageAction.prepend(btn);
        }
    }
    return btn;
};

const xfpdCollectHintsFromPostDom = (contentContainer, parsedHosts) => {
    const linkNames = [];
    const bunkrNames = [];
    const goonboxThumbs = [];
    const imagepondDirects = [];
    const imagepondNames = [];

    const strip = s => String(s || '').split('#')[0].split('?')[0].replace(/\/+$/, '');

    try {
        if (contentContainer && contentContainer.querySelectorAll) {
            contentContainer.querySelectorAll('a[href]').forEach(a => {
                let href0 = String(a.getAttribute('href') || '').replace(/&amp;/g, '&').trim().split(/[\s"'<>]/)[0];
                if (!href0) return;
                if (!/^https?:\/\//i.test(href0)) {
                    try { href0 = new URL(href0, location.origin).href; } catch (e) { return; }
                }
                if (href0.endsWith('/')) href0 = href0.slice(0, -1);
                if (/bunkrr?r?\./i.test(href0) && !/scdn\.st\//i.test(href0)) {
                    const txt = String(a.textContent || '').replace(/\s+/g, ' ').trim();
                    if (txt && !/^https?:\/\//i.test(txt) && /\.[A-Za-z0-9]{1,8}$/.test(txt) && !xfpdLooksLikeCfFilenameHint(txt)) {
                        bunkrNames.push([href0, txt]);
                        bunkrNames.push([strip(href0), txt]);
                    }
                }
                if (/goonbox\.cr\/img\//i.test(href0)) {
                    const img = a.querySelector('img');
                    const rawThumb = img && (img.getAttribute('data-url') || img.getAttribute('data-src') || img.getAttribute('src'));
                    if (rawThumb && !/^data:/i.test(rawThumb)) {
                        goonboxThumbs.push([strip(href0), rawThumb]);
                    }
                }
            });
        }
    } catch (e) {}

    for (const host of parsedHosts || []) {
        for (const resUrl of host.resources || []) {
            const sUrl = strip(resUrl);
            for (const k of [resUrl, sUrl]) {
                if (linkHintNameByUrl.has(k)) linkNames.push([k, linkHintNameByUrl.get(k)]);
                if (bunkrNameByUrl.has(k)) bunkrNames.push([k, bunkrNameByUrl.get(k)]);
                if (goonboxThumbByUrl.has(k)) goonboxThumbs.push([k, goonboxThumbByUrl.get(k)]);
                if (imagepondDirectByPageUrl.has(k)) {
                    const dirU = imagepondDirectByPageUrl.get(k);
                    imagepondDirects.push([k, dirU]);
                    if (imagepondNameByUrl.has(dirU)) imagepondNames.push([dirU, imagepondNameByUrl.get(dirU)]);
                }
                if (imagepondNameByUrl.has(k)) imagepondNames.push([k, imagepondNameByUrl.get(k)]);
            }
        }
    }

    return { linkNames, bunkrNames, goonboxThumbs, imagepondDirects, imagepondNames };
};

const xfpdBuildSerializedPostJob = ({
    parsedPost,
    parsedHosts,
    messageEl,
    postSettings,
    threadKey,
    threadTitle,
    pageUrl,
    pageNumber,
    csrfToken,
}) => {
    const ps = postSettings || {};
    const incComments = ps.includeComments !== false;
    const unlockReactUrls = [];
    let completionReactUrl = '';

    if (messageEl) {
        const mainReactLink = xfpdFindPostNativeReactLink(messageEl);
        if (mainReactLink) {
            const ownPostReacted = [...messageEl.querySelectorAll('.has-reaction, .smgReactionPill--reacted')].some(
                el => !el.closest('.comment, .js-comment, .uw_fcs_comment_section, .message-responses'),
            );
            const alreadyMain = mainReactLink.classList.contains('has-reaction') || ownPostReacted;
            if (!alreadyMain) {
                const rUrl = xfpdBuildPostReactUrl(mainReactLink.getAttribute('href') || '');
                completionReactUrl = rUrl;
                if (parsedPost.hasMainLockedContent) {
                    unlockReactUrls.push(rUrl);
                }
            }
        }

        if (incComments && parsedPost.hasCommentLockedContent) {
            const commentEls = xfpdCollectPostCommentElements(messageEl);
            for (const cEl of commentEls) {
                const cClone = xfpdCleanContentFragmentClone(cEl.cloneNode(true));
                if (xfpdDetectLockedReactionContent(cEl, cClone, true)) {
                    const cLink = xfpdFindNativeReactLinkInContainer(cEl, false);
                    if (cLink && !cLink.classList.contains('has-reaction')) {
                        const crUrl = xfpdBuildPostReactUrl(cLink.getAttribute('href') || '');
                        if (crUrl) unlockReactUrls.push(crUrl);
                    }
                }
            }
        }
    }

    const clonedHosts = (parsedHosts || []).map(hItem => ({
        id: hItem.id,
        name: hItem.name,
        type: hItem.type,
        category: hItem.category,
        enabled: !!hItem.enabled,
        resources: Array.isArray(hItem.resources) ? hItem.resources.slice() : [],
    }));

    const initialResourceCount = clonedHosts
        .filter(hItem => hItem.enabled && hItem.resources.length)
        .reduce((a, hItem) => a + hItem.resources.length, 0);

    return {
        kind: 'post',
        jobId: `job_${threadKey || 'f'}_${parsedPost.postId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        threadKey,
        threadTitle,
        pageUrl,
        csrfToken,
        postId: parsedPost.postId,
        postNumber: parsedPost.postNumber,
        pageNumber: pageNumber || parsedPost.pageNumber || 1,
        postCaption: parsedPost.postCaption || '',
        spoilers: Array.isArray(parsedPost.spoilers) ? parsedPost.spoilers.slice() : [],
        hasMainLockedContent: !!parsedPost.hasMainLockedContent,
        hasCommentLockedContent: !!parsedPost.hasCommentLockedContent,
        hasLockedContent: !!(parsedPost.hasMainLockedContent || (incComments && parsedPost.hasCommentLockedContent)),
        hasCollapsedComments: !!(incComments && parsedPost.hasCollapsedComments),
        unlockReactUrls,
        completionReactUrl,
        initialResourceCount,
        parsedHosts: clonedHosts,
        postSettings: JSON.parse(JSON.stringify(ps)),
        hints: xfpdCollectHintsFromPostDom(parsedPost.contentContainer, parsedHosts),
    };
};

const xfpdExtractCsrfFromDoc = (doc = document) => {
    try {
        const inputEl = doc.querySelector('input[name="_xfToken"]');
        if (inputEl && inputEl.value) return String(inputEl.value);
        const htmlCsrf = doc.documentElement && doc.documentElement.getAttribute('data-csrf');
        if (htmlCsrf) return String(htmlCsrf);
        const scripts = doc.querySelectorAll('script:not([src])');
        for (const s of scripts) {
            const m = /\bcsrf\s*:\s*['"]([^'"]+)['"]/.exec(s.textContent || '');
            if (m && m[1]) return m[1];
        }
    } catch (e) {}
    return '';
};

const xfpdGetXenForoCsrfToken = () => xfpdExtractCsrfFromDoc(document);

const xfpdBuildPostReactUrl = rawHref => {
    if (!rawHref) return '';
    try {
        const u = new URL(rawHref, location.origin);
        // SimpCity uses reaction_id=33 for love/thanks; SocialMediaGirls uses reaction_id=1 (Like/React; 33 is DMCA!).
        const targetId = /(^|\.)simpcity\./i.test(location.hostname || '') ? '33' : '1';
        if (u.searchParams.has('reaction_id')) {
            u.searchParams.set('reaction_id', targetId);
        } else {
            return u.href.replace(/([?&]reaction_id=)\d*/i, `$1${targetId}`);
        }
        return u.href;
    } catch (e) {
        return String(rawHref);
    }
};

const xfpdUnlockAttemptedPosts = new Set();

const xfpdSameOriginFetchText = async (targetUrl, method = 'GET', formBody = null) => {
    if (typeof window.fetch === 'function') {
        try {
            const initOpts = {
                method,
                credentials: 'same-origin',
                cache: 'no-store',
                headers:
                    method === 'POST'
                        ? {
                              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                              'X-Requested-With': 'XMLHttpRequest',
                              Accept: 'application/json, text/javascript, */*; q=0.01',
                          }
                        : {
                              Accept: 'text/html,application/xhtml+xml,*/*',
                          },
            };
            if (formBody !== null) initOpts.body = formBody;
            const res = await window.fetch(targetUrl, initOpts);
            const text = await res.text();
            return { ok: res.ok, status: res.status, text };
        } catch (e) {}
    }
    try {
        const hdrs =
            method === 'POST'
                ? {
                      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                      'X-Requested-With': 'XMLHttpRequest',
                      Accept: 'application/json, text/javascript, */*; q=0.01',
                      __xfpd_withCredentials: true,
                      __xfpd_timeout: 15000,
                  }
                : {
                      Accept: 'text/html,application/xhtml+xml,*/*',
                      __xfpd_withCredentials: true,
                      __xfpd_timeout: 15000,
                  };
        const r = await h.http.base(method, targetUrl, {}, hdrs, formBody || '', 'text');
        const st = Number((r && r.status) || 0) || 0;
        return { ok: st >= 200 && st < 400, status: st, text: String((r && r.source) || '') };
    } catch (e) {
        return { ok: false, status: 0, text: '' };
    }
};

/**
 * @param postFooter
 */
const registerPostReaction = postFooter => {
    if (!postFooter || !postFooter.querySelector) return;
    const hasReaction = postFooter.querySelector('.has-reaction, .smgReactionPill--reacted');
    if (!hasReaction) {
        const reactionAnchor = postFooter.querySelector('.reaction--imageHidden');
        if (reactionAnchor) {
            const href = reactionAnchor.getAttribute('href') || '';
            // SimpCity uses reaction_id=33 for love/thanks; on SocialMediaGirls reaction_id=33 is DMCA, so keep _id=1 (React/Like).
            if (href && /(^|\.)simpcity\./i.test(location.hostname || '')) {
                reactionAnchor.setAttribute('href', href.replace('_id=1', '_id=33'));
            }
            reactionAnchor.click();
        }
    }
};


const CYBERDROP_WARMUP_DEFAULT_MS = 2500;
let cyberdropWarmupChain = Promise.resolve();
const cyberdropWarmupAttempted = new Map();

/**
 * Warm up a Cyberdrop /f/ page in a background tab to let the site set any required cookies.
 * Ensures at most one warm-up tab is open at any time.
 */
async function cyberdropWarmupOnce(key, warmUrl, ms = CYBERDROP_WARMUP_DEFAULT_MS) {
    // Back-compat: allow cyberdropWarmupOnce(url) calls.
    if (typeof warmUrl === 'undefined') {
        const maybeUrl = String(key || '').trim();
        if (/^https?:\/\//i.test(maybeUrl)) {
            warmUrl = maybeUrl;
            try { key = `cyberdrop:${new URL(maybeUrl).origin}`; } catch { key = `cyberdrop:${maybeUrl}`; }
        }
    }

    // Normalize keys that accidentally include a full URL (avoid per-file warmups).
    const _k0 = String(key || '').trim();
    if (_k0.indexOf('://') !== -1) {
        const m = _k0.match(/https?:\/\/[^\s]+/i);
        if (m) { try { key = `cyberdrop:${new URL(m[0]).origin}`; } catch {} }
    }

    const k = String(key || '').trim();
    const u = String(warmUrl || '').trim();
    if (!k || !u) return;

    if (cyberdropWarmupAttempted.has(k)) {
        try { await cyberdropWarmupAttempted.get(k); } catch (e) {}
        return;
    }

    cyberdropWarmupChain = cyberdropWarmupChain.then(() => {
        return new Promise(resolve => {
            try {
                const tab = GM_openInTab(u, { active: false, insert: true, setParent: true });
                setTimeout(() => {
                    try { xfpdCloseTabHandle(tab); } catch (e) {}
                    resolve();
                }, Math.max(250, ms));
            } catch (e) {
                resolve();
            }
        });
    });

    cyberdropWarmupAttempted.set(k, cyberdropWarmupChain);
    await cyberdropWarmupChain;
}



// Legacy helper kept for compatibility (expects a Cyberdrop API URL that returns JSON with a "url" field).
async function cyberdrop_helper(apiUrl) {
    const url = String(apiUrl || '');
    if (!url) return null;

    const headers = { Accept: 'application/json, text/plain, */*' };

    const gmGetText = u =>
        new Promise(resolve => {
            try {
                GM.xmlHttpRequest({
                    method: 'GET',
                    url: u,
                    headers,
                    onload: r => resolve(r),
                    onerror: () => resolve(null),
                    ontimeout: () => resolve(null),
                });
            } catch (e) {
                resolve(null);
            }
        });

    for (let attempt = 0; attempt < 2; attempt++) {
        const r = await gmGetText(url);
        if (r && r.status === 200 && r.responseText) {
            try {
                const j = JSON.parse(r.responseText);
                const direct = j && (j.url || (j.data && j.data.url) || (j.file && j.file.url));
                if (direct && typeof direct === 'string') return direct;
            } catch (e) {}
        }
        await new Promise(res => setTimeout(res, 800));
    }

    return null;
}

const parsedPosts = [];
const selectedPosts = [];

let xfpdLocalQueueEngineStarted = false;

function xfpdStartQueueEngine({ isDedicatedWorkerTab = false } = {}) {
    if (xfpdLocalQueueEngineStarted) return;

    const initialCheck = xfpdReadQueueState();
    if (isDedicatedWorkerTab && xfpdIsQueueWorkerAlive(initialCheck)) {
        try { window.close(); } catch (e) {}
        return;
    }

    xfpdLocalQueueEngineStarted = true;
    const workerId = `wrk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const processedCmdIds = new Set(Array.isArray(initialCheck.ackCmdIds) ? initialCheck.ackCmdIds : []);
    const ackQueue = Array.isArray(initialCheck.ackCmdIds) ? initialCheck.ackCmdIds.slice(-180) : [];
    const pendingJobs = [];
    let history = Array.isArray(initialCheck.history) ? initialCheck.history.slice(0, 30) : [];
    let activeJobSummary = null;
    let activeCancelController = null;
    let activeThreadCrawl = null;
    let pumping = false;
    let standbyMode = false;
    let idleCloseTimer = null;
    let workerRefs = null;
    let listRenderRevision = 1;
    let lastRenderedRevision = 0;

    const sessionStats = {
        postsDone: Number(initialCheck.stats?.postsDone || 0) || 0,
        postsSkipped: Number(initialCheck.stats?.postsSkipped || 0) || 0,
        filesSaved: Number(initialCheck.stats?.filesSaved || 0) || 0,
        filesDeduped: Number(initialCheck.stats?.filesDeduped || 0) || 0,
        filesFailed: Number(initialCheck.stats?.filesFailed || 0) || 0,
        failedPostsCount: Number(initialCheck.stats?.failedPostsCount || 0) || 0,
        pagesScanned: Number(initialCheck.stats?.pagesScanned || 0) || 0,
        startedAt: Number(initialCheck.stats?.startedAt || 0) || Date.now(),
    };
    const failedPostsRecords = [];
    const deadLinksByHost = new Map();

    const escHtml = s =>
        String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

    const formatElapsed = startMs => {
        if (!startMs) return '00:00';
        const sec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
        const hrs = Math.floor(sec / 3600);
        const mins = Math.floor((sec % 3600) / 60);
        const rem = sec % 60;
        const pad = n => String(n).padStart(2, '0');
        return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(rem)}` : `${pad(mins)}:${pad(rem)}`;
    };

    const parseDeadLinksFromLog = errorLogText => {
        const items = [];
        const seenUrls = new Set();
        const lines = String(errorLogText || '').split('\n');
        for (const line of lines) {
            if (!line.includes('[ERROR]')) continue;
            const m = /\[ERROR\]\s*(?:\[[^\]]+\]\s*)?(.+?):\s*(https?:\/\/\S+)/i.exec(line);
            if (!m) continue;
            const reason = m[1].trim();
            const deadUrl = m[2].trim();
            if (seenUrls.has(deadUrl)) continue;
            seenUrls.add(deadUrl);
            let hostDomain = 'unknown';
            try {
                hostDomain = new URL(deadUrl).hostname.toLowerCase().replace(/^(?:www|cdn\d*|fs-\d+|store\d*|cache\d*)\./, '');
            } catch (e) {}
            items.push({ reason, url: deadUrl, host: hostDomain });
        }
        return items;
    };

    const cancelIdleClose = () => {
        if (idleCloseTimer) {
            clearTimeout(idleCloseTimer);
            idleCloseTimer = null;
        }
    };

    const summarizeQueuedJob = j => {
        if (j && j.kind === 'thread_crawl') {
            return {
                jobId: j.jobId,
                isThreadCrawl: true,
                threadKey: j.threadKey,
                threadTitle: j.threadTitle,
                startPage: j.startPage,
                endPage: j.endPage,
                pageCount: Array.isArray(j.pages) ? j.pages.length : Math.max(1, (j.endPage || 1) - (j.startPage || 1) + 1),
            };
        }
        return {
            jobId: j.jobId,
            isThreadCrawl: false,
            threadKey: j.threadKey,
            threadTitle: j.threadTitle,
            postId: j.postId,
            postNumber: j.postNumber,
            postCaption: j.postCaption || '',
            resourceCount: Number(j.initialResourceCount || 0) || 0,
            hasLock: !!j.hasLockedContent,
        };
    };

    const renderWorkerDashboard = st => {
        if (!workerRefs) return;
        const isStandbyNow = !st.active && st.queued.length === 0 && standbyMode;

        // 1) Header status & timer
        workerRefs.timer.textContent = `⏱ ${formatElapsed(sessionStats.startedAt)}`;
        if (st.active) {
            workerRefs.badge.style.background = 'rgba(71,186,36,.16)';
            workerRefs.badge.style.color = '#5ce038';
            workerRefs.badge.style.borderColor = 'rgba(71,186,36,.45)';
            workerRefs.badge.textContent = '● Active Downloading';
        } else if (isStandbyNow) {
            workerRefs.badge.style.background = 'rgba(61,183,199,.14)';
            workerRefs.badge.style.color = '#3DB7C7';
            workerRefs.badge.style.borderColor = 'rgba(61,183,199,.4)';
            workerRefs.badge.textContent = '💤 Standby (Ready)';
        } else {
            workerRefs.badge.style.background = 'rgba(255,255,255,.07)';
            workerRefs.badge.style.color = '#a5b1bd';
            workerRefs.badge.style.borderColor = 'rgba(255,255,255,.18)';
            workerRefs.badge.textContent = '⏳ Idle';
        }

        // 2) 5 Cumulative KPI Cards
        workerRefs.kpiPosts.textContent = String(sessionStats.postsDone);
        workerRefs.kpiPostsSub.textContent =
            sessionStats.postsSkipped > 0 ? `+${sessionStats.postsSkipped} already done skipped` : `${st.queued.length} queued`;
        workerRefs.kpiSaved.textContent = String(sessionStats.filesSaved);
        workerRefs.kpiDedup.textContent = String(sessionStats.filesDeduped);
        workerRefs.kpiFailed.textContent = String(sessionStats.filesFailed);
        workerRefs.kpiFailed.style.color = sessionStats.filesFailed > 0 ? '#ff6b6b' : '#7d8894';
        workerRefs.kpiFailedCard.style.borderColor =
            sessionStats.filesFailed > 0 ? 'rgba(255,107,107,.48)' : 'rgba(255,255,255,.09)';
        workerRefs.kpiFailedSub.textContent =
            sessionStats.failedPostsCount > 0
                ? `across ${sessionStats.failedPostsCount} ${sessionStats.failedPostsCount === 1 ? 'post' : 'posts'}`
                : '0 dead links detected';
        workerRefs.kpiPages.textContent = String(sessionStats.pagesScanned);
        workerRefs.kpiPagesSub.textContent =
            st.active && st.active.threadCrawl
                ? `crawl P.${st.active.threadCrawl.currentPage}/${st.active.threadCrawl.endPage}`
                : 'pages crawled';

        // 3) Live Active Task Panel
        if (st.active) {
            const act = st.active;
            const tc = act.threadCrawl;
            workerRefs.activeTitle.innerHTML = tc
                ? `📚 <b>${escHtml(act.threadTitle || 'Thread')}</b> · Page ${tc.currentPage}/${tc.endPage}${
                      act.postId ? ` · Post #${escHtml(act.postNumber)}` : ''
                  }`
                : `▶ <b>${escHtml(act.threadTitle || 'Thread')}</b> · Post #${escHtml(act.postNumber)}`;
            workerRefs.activeStatus.textContent = act.statusText || act.phase || 'Working...';
            workerRefs.fileFill.style.width = `${act.filePct || 0}%`;
            workerRefs.totalFill.style.width = `${act.totalPct || 0}%`;
            workerRefs.activeActions.style.display = 'inline-flex';
            workerRefs.skipPostBtn.style.display = act.postId ? '' : 'none';
            workerRefs.stopThreadBtn.style.display = tc ? '' : 'none';
            if (tc && tc.pagesTotal > 0) {
                const crawlPct = Math.min(100, Math.round(((tc.pagesDone + (act.totalPct || 0) / 100) / tc.pagesTotal) * 100));
                workerRefs.crawlWrap.style.display = 'block';
                workerRefs.crawlLbl.textContent = `Thread Crawl Progress: Page ${tc.currentPage} of ${tc.endPage} (${crawlPct}%)`;
                workerRefs.crawlFill.style.width = `${crawlPct}%`;
            } else {
                workerRefs.crawlWrap.style.display = 'none';
            }
        } else {
            workerRefs.activeTitle.textContent = isStandbyNow
                ? '💤 Worker in zero-CPU standby — waiting for next task across any tab'
                : 'No active download right now';
            workerRefs.activeStatus.textContent = 'Ready.';
            workerRefs.fileFill.style.width = '0%';
            workerRefs.totalFill.style.width = '0%';
            workerRefs.activeActions.style.display = 'none';
            workerRefs.crawlWrap.style.display = 'none';
        }

        // 4) Lists (Failed/Dead Breakdown + Queue + History) — only rebuild DOM when revision changes!
        if (lastRenderedRevision === listRenderRevision) return;
        lastRenderedRevision = listRenderRevision;

        // 4a) Failed / Dead Links Breakdown
        workerRefs.deadCountBadge.textContent = `${sessionStats.filesFailed} dead links · ${failedPostsRecords.length} posts`;
        if (deadLinksByHost.size > 0) {
            const sortedHosts = [...deadLinksByHost.entries()].sort((a, b) => b[1] - a[1]);
            workerRefs.hostPills.innerHTML = sortedHosts
                .map(
                    ([hostName, cnt]) =>
                        `<span style="padding:2px 8px;border-radius:999px;background:rgba(255,107,107,.14);border:1px solid rgba(255,107,107,.35);color:#ff9b9b;font-size:11.5px;font-weight:600;">${escHtml(
                            hostName,
                        )}: ${cnt}</span>`,
                )
                .join('');
            workerRefs.hostPills.style.display = 'flex';
        } else {
            workerRefs.hostPills.style.display = 'none';
        }

        if (failedPostsRecords.length === 0) {
            workerRefs.failedList.innerHTML = `<div style="color:#7d8894;font-size:12.5px;padding:6px 0;">✓ Zero failed or dead links in this session.</div>`;
            workerRefs.copyAllDeadBtn.style.display = 'none';
        } else {
            workerRefs.copyAllDeadBtn.style.display = '';
            workerRefs.failedList.innerHTML = failedPostsRecords
                .map(rec => {
                    const postLink = rec.pageUrl && rec.postId ? `${rec.pageUrl.split('#')[0]}#post-${rec.postId}` : '';
                    const deadPreview = rec.deadItems
                        .slice(0, 6)
                        .map(
                            d =>
                                `<div style="font-family:monospace;font-size:11px;color:#d99a9a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">• [${escHtml(
                                    d.reason,
                                )}] ${escHtml(d.url)}</div>`,
                        )
                        .join('');
                    const moreCount = rec.deadItems.length > 6 ? `<div style="font-size:11px;color:#9aa4af;">+ ${rec.deadItems.length - 6} more in post log...</div>` : '';
                    return `
                      <div style="padding:9px 11px;border-radius:7px;background:#15171b;border:1px solid rgba(255,107,107,.24);display:flex;flex-direction:column;gap:5px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                          <span style="font-weight:700;font-size:12.5px;color:#f1f3f5;">
                            ${escHtml(h.limit(rec.threadTitle || 'Thread', 36))} · <span style="color:#ff8787;">Post #${escHtml(rec.postNumber)}</span>
                            ${rec.pageNumber ? `<span style="color:#8b95a1;font-weight:500;">(P.${rec.pageNumber})</span>` : ''}
                          </span>
                          <span style="display:inline-flex;align-items:center;gap:6px;font-size:11.5px;">
                            <span style="color:#47ba24;">✓ ${rec.succeeded} saved</span>
                            <span style="color:#ff6b6b;font-weight:700;">✕ ${rec.failed} failed/dead</span>
                            ${rec.deduped > 0 ? `<span style="color:#3DB7C7;">⚡ ${rec.deduped} dupes</span>` : ''}
                            ${
                                postLink
                                    ? `<a href="${escHtml(postLink)}" target="_blank" rel="noopener" style="padding:2px 7px;border-radius:4px;border:1px solid rgba(61,183,199,.45);color:#3DB7C7;text-decoration:none;font-weight:600;">↗ Open Post</a>`
                                    : ''
                            }
                            ${
                                rec.errorLog
                                    ? `<button type="button" data-wrk-copy-log="${escHtml(rec.jobId)}" style="padding:2px 7px;border-radius:4px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.06);color:#e4e7eb;cursor:pointer;font-size:11px;font-weight:600;">Copy Log</button>`
                                    : ''
                            }
                          </span>
                        </div>
                        ${deadPreview}
                        ${moreCount}
                      </div>
                    `;
                })
                .join('');
        }

        // 4b) Pending Queue List
        workerRefs.queueCount.textContent = String(st.queued.length);
        if (!st.queued.length) {
            workerRefs.queueList.innerHTML = `<div style="color:#7d8894;font-size:12px;padding:4px 0;">Queue is empty.</div>`;
        } else {
            workerRefs.queueList.innerHTML = st.queued
                .slice(0, 40)
                .map(q =>
                    q.isThreadCrawl
                        ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;border-radius:5px;background:#15171b;font-size:12px;">
                             <span>📚 <b>${escHtml(h.limit(q.threadTitle || 'Thread', 28))}</b> · Pages ${q.startPage}–${q.endPage} (${q.pageCount}p)</span>
                             <button type="button" data-wrk-cancel-thread="${escHtml(q.jobId)}" style="padding:1px 6px;border-radius:4px;border:1px solid rgba(217,83,79,.45);background:transparent;color:#ff8787;cursor:pointer;">✕</button>
                           </div>`
                        : `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;border-radius:5px;background:#15171b;font-size:12px;">
                             <span>• ${escHtml(h.limit(q.threadTitle || 'Thread', 26))} · <b>#${escHtml(q.postNumber)}</b> (${q.hasLock && !q.resourceCount ? '🔒' : `${q.resourceCount} items`})</span>
                             <button type="button" data-wrk-cancel-job="${escHtml(q.jobId)}" style="padding:1px 6px;border-radius:4px;border:1px solid rgba(217,83,79,.45);background:transparent;color:#ff8787;cursor:pointer;">✕</button>
                           </div>`,
                )
                .join('');
        }

        // 4c) Recent Completed List
        workerRefs.histCount.textContent = String(st.history.length);
        if (!st.history.length) {
            workerRefs.histList.innerHTML = `<div style="color:#7d8894;font-size:12px;padding:4px 0;">No completed posts yet.</div>`;
        } else {
            workerRefs.histList.innerHTML = st.history
                .slice(0, 25)
                .map(item => {
                    const col =
                        item.status === 'failed'
                            ? '#ff6b6b'
                            : item.status === 'partial'
                              ? '#e8a838'
                              : item.status === 'dedup'
                                ? '#3DB7C7'
                                : '#47ba24';
                    const badge =
                        item.status === 'dedup'
                            ? `⚡ ${item.deduped} dupes`
                            : item.failed > 0
                              ? `✓ ${item.succeeded} · ✕ ${item.failed}`
                              : `✓ ${item.succeeded}/${item.total || item.succeeded}`;
                    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;border-radius:5px;background:#15171b;font-size:12px;">
                              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(h.limit(item.threadTitle || 'Thread', 26))} · <b>#${escHtml(item.postNumber)}</b></span>
                              <span style="color:${col};font-weight:700;white-space:nowrap;margin-left:8px;">${badge}</span>
                            </div>`;
                })
                .join('');
        }
    };

    const publishState = (extra = {}) => {
        const isStandbyNow = !activeJobSummary && pendingJobs.length === 0 && standbyMode;
        const st = xfpdWriteQueueState({
            workerId,
            workerHeartbeat: Date.now(),
            workerClosing: false,
            workerStandby: isStandbyNow,
            ackCmdIds: ackQueue.slice(-200),
            active: activeJobSummary ? { ...activeJobSummary } : null,
            queued: pendingJobs.map(summarizeQueuedJob),
            history: history.slice(0, 30),
            stats: { ...sessionStats },
            ...extra,
        });
        if (isDedicatedWorkerTab) {
            try {
                const deadSuffix = sessionStats.filesFailed > 0 ? ` · ✕${sessionStats.filesFailed}` : '';
                document.title = st.active
                    ? `📥 #${st.active.postNumber} (${st.active.totalPct || 0}%)${deadSuffix} — XFPD Worker`
                    : isStandbyNow
                      ? `💤 Ready (✓${sessionStats.filesSaved}${deadSuffix}) — XFPD Worker`
                      : '📥 XFPD Download Worker';
            } catch (e) {}
            renderWorkerDashboard(st);
        }
        return st;
    };

    if (isDedicatedWorkerTab) {
        window.addEventListener('pagehide', () => {
            try {
                xfpdWriteQueueState({
                    workerId: '',
                    workerHeartbeat: 0,
                    workerClosing: true,
                    workerStandby: false,
                    ackCmdIds: ackQueue.slice(-200),
                    active: null,
                    queued: [],
                    history: history.slice(0, 30),
                    stats: { ...sessionStats },
                });
            } catch (e) {}
        });

        const mountWorkerDashboard = () => {
            try {
                document.title = '📥 XFPD Download Worker';
                if (!document.body) {
                    if (typeof MutationObserver !== 'undefined' && document.documentElement) {
                        const wObs = new MutationObserver(() => {
                            if (document.body) {
                                wObs.disconnect();
                                mountWorkerDashboard();
                            }
                        });
                        wObs.observe(document.documentElement, { childList: true, subtree: true });
                    }
                    return;
                }
                document.body.style.cssText =
                    'margin:0;padding:24px 16px 48px;background:#101216;color:#e4e7eb;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
                document.body.innerHTML = `
                  <div id="xfpd-wrk-root" style="max-width:980px;margin:0 auto;display:flex;flex-direction:column;gap:16px;">
                    <div style="padding:18px 22px;border-radius:12px;background:#1a1d23;border:1px solid rgba(61,183,199,.35);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                      <div>
                        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                          <h2 style="margin:0;color:#3DB7C7;font-size:18px;">📥 XenForoPostDownloader — Background Queue Worker</h2>
                          <span style="padding:2px 8px;border-radius:999px;background:rgba(61,183,199,.14);color:#3DB7C7;font-size:11.5px;font-weight:700;">v${escHtml(xfpdVersion)}</span>
                          <span id="wrk-status-badge" style="padding:2px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.18);font-size:12px;font-weight:700;">Initializing...</span>
                          <span id="wrk-elapsed" style="font-family:monospace;font-size:12.5px;color:#9aa4af;">⏱ 00:00</span>
                        </div>
                        <p style="margin:6px 0 0;font-size:12.5px;color:#8e99a6;">
                          Keep this background tab open while downloads run. You can freely browse, paginate, or close forum tabs.
                        </p>
                      </div>
                      <div style="display:flex;align-items:center;gap:8px;">
                        <button type="button" id="wrk-reset-stats-btn" style="padding:6px 11px;border-radius:6px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:#d0d7de;font-size:12px;font-weight:600;cursor:pointer;">Reset Stats</button>
                        <button type="button" id="wrk-stop-all-btn" style="padding:6px 11px;border-radius:6px;border:1px solid rgba(217,83,79,.55);background:rgba(217,83,79,.16);color:#ff8787;font-size:12px;font-weight:700;cursor:pointer;">✕ Stop All</button>
                      </div>
                    </div>

                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;">
                      <div style="padding:14px 16px;border-radius:10px;background:#1a1d23;border:1px solid rgba(255,255,255,.09);">
                        <div style="font-size:11.5px;color:#8e99a6;font-weight:600;text-transform:uppercase;letter-spacing:.4px;">Posts Processed</div>
                        <div id="wrk-kpi-posts" style="font-size:26px;font-weight:800;color:#f1f3f5;margin-top:4px;">0</div>
                        <div id="wrk-kpi-posts-sub" style="font-size:11.5px;color:#8e99a6;margin-top:2px;">0 queued</div>
                      </div>
                      <div style="padding:14px 16px;border-radius:10px;background:#1a1d23;border:1px solid rgba(71,186,36,.28);">
                        <div style="font-size:11.5px;color:#8e99a6;font-weight:600;text-transform:uppercase;letter-spacing:.4px;">✓ Files Saved</div>
                        <div id="wrk-kpi-saved" style="font-size:26px;font-weight:800;color:#47ba24;margin-top:4px;">0</div>
                        <div style="font-size:11.5px;color:#8e99a6;margin-top:2px;">written to disk</div>
                      </div>
                      <div style="padding:14px 16px;border-radius:10px;background:#1a1d23;border:1px solid rgba(61,183,199,.28);">
                        <div style="font-size:11.5px;color:#8e99a6;font-weight:600;text-transform:uppercase;letter-spacing:.4px;">⚡ Dupes Skipped</div>
                        <div id="wrk-kpi-dedup" style="font-size:26px;font-weight:800;color:#3DB7C7;margin-top:4px;">0</div>
                        <div style="font-size:11.5px;color:#8e99a6;margin-top:2px;">SHA-256 + URL dedup</div>
                      </div>
                      <div id="wrk-kpi-failed-card" style="padding:14px 16px;border-radius:10px;background:#1a1d23;border:1px solid rgba(255,255,255,.09);">
                        <div style="font-size:11.5px;color:#ff9b9b;font-weight:700;text-transform:uppercase;letter-spacing:.4px;">✕ Failed / Dead Links</div>
                        <div id="wrk-kpi-failed" style="font-size:26px;font-weight:800;color:#7d8894;margin-top:4px;">0</div>
                        <div id="wrk-kpi-failed-sub" style="font-size:11.5px;color:#8e99a6;margin-top:2px;">0 dead links detected</div>
                      </div>
                      <div style="padding:14px 16px;border-radius:10px;background:#1a1d23;border:1px solid rgba(255,255,255,.09);">
                        <div style="font-size:11.5px;color:#8e99a6;font-weight:600;text-transform:uppercase;letter-spacing:.4px;">📄 Pages Scanned</div>
                        <div id="wrk-kpi-pages" style="font-size:26px;font-weight:800;color:#e4e7eb;margin-top:4px;">0</div>
                        <div id="wrk-kpi-pages-sub" style="font-size:11.5px;color:#8e99a6;margin-top:2px;">pages crawled</div>
                      </div>
                    </div>

                    <div style="padding:16px 20px;border-radius:10px;background:#1a1d23;border:1px solid rgba(61,183,199,.28);">
                      <div id="wrk-crawl-wrap" style="display:none;margin-bottom:12px;">
                        <div id="wrk-crawl-lbl" style="font-size:12px;font-weight:700;color:#3DB7C7;margin-bottom:5px;">Thread Crawl Progress</div>
                        <div style="height:6px;border-radius:3px;background:rgba(255,255,255,.09);overflow:hidden;">
                          <div id="wrk-crawl-fill" style="height:100%;width:0%;background:linear-gradient(90deg,#3DB7C7,#47ba24);transition:width .2s ease;"></div>
                        </div>
                      </div>
                      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:6px;">
                        <div id="wrk-active-title" style="font-size:14px;color:#f1f3f5;">Initializing...</div>
                        <span id="wrk-active-actions" style="display:none;gap:6px;">
                          <button type="button" id="wrk-skip-post-btn" style="padding:3px 9px;border-radius:5px;border:1px solid rgba(255,255,255,.24);background:rgba(255,255,255,.07);color:#eaeaea;font-size:11.5px;font-weight:600;cursor:pointer;">Skip Post</button>
                          <button type="button" id="wrk-stop-thread-btn" style="padding:3px 9px;border-radius:5px;border:1px solid rgba(217,83,79,.55);background:rgba(217,83,79,.16);color:#ff8787;font-size:11.5px;font-weight:700;cursor:pointer;">Stop Thread</button>
                        </span>
                      </div>
                      <div id="wrk-active-status" style="font-family:monospace;font-size:12.5px;color:#47ba24;margin-bottom:8px;word-break:break-all;">Ready.</div>
                      <div style="display:flex;flex-direction:column;gap:5px;">
                        <div style="height:5px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden;" title="Current File Progress">
                          <div id="wrk-file-fill" style="height:100%;width:0%;background:#3DB7C7;transition:width .14s ease;"></div>
                        </div>
                        <div style="height:6px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden;" title="Current Post Progress">
                          <div id="wrk-total-fill" style="height:100%;width:0%;background:#47ba24;transition:width .14s ease;"></div>
                        </div>
                      </div>
                    </div>

                    <div style="padding:16px 20px;border-radius:10px;background:#1a1d23;border:1px solid rgba(255,107,107,.28);">
                      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
                        <div style="display:flex;align-items:center;gap:8px;">
                          <span style="font-weight:700;font-size:14px;color:#ff8787;">✕ Failed / Dead Links Overview</span>
                          <span id="wrk-dead-badge" style="padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.07);font-size:11.5px;color:#c9d1d9;">0 dead links · 0 posts</span>
                        </div>
                        <button type="button" id="wrk-copy-all-dead-btn" style="display:none;padding:4px 10px;border-radius:5px;border:1px solid rgba(61,183,199,.5);background:rgba(61,183,199,.14);color:#65d9e8;font-size:11.5px;font-weight:700;cursor:pointer;">Copy All Dead URLs</button>
                      </div>
                      <div id="wrk-host-pills" style="display:none;flex-wrap:wrap;gap:6px;margin-bottom:10px;"></div>
                      <div id="wrk-failed-list" style="max-height:280px;overflow-y:auto;display:flex;flex-direction:column;gap:7px;"></div>
                    </div>

                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px;">
                      <div style="padding:14px 18px;border-radius:10px;background:#1a1d23;border:1px solid rgba(255,255,255,.09);">
                        <div style="font-weight:700;font-size:13px;color:#3DB7C7;margin-bottom:8px;">⏳ Pending Queue (<span id="wrk-queue-count">0</span>)</div>
                        <div id="wrk-queue-list" style="max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:5px;"></div>
                      </div>
                      <div style="padding:14px 18px;border-radius:10px;background:#1a1d23;border:1px solid rgba(255,255,255,.09);">
                        <div style="font-weight:700;font-size:13px;color:#47ba24;margin-bottom:8px;">✓ Recent Completed Posts (<span id="wrk-hist-count">0</span>)</div>
                        <div id="wrk-hist-list" style="max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:5px;"></div>
                      </div>
                    </div>
                  </div>
                `;

                const q = id => document.getElementById(id);
                workerRefs = {
                    badge: q('wrk-status-badge'),
                    timer: q('wrk-elapsed'),
                    kpiPosts: q('wrk-kpi-posts'),
                    kpiPostsSub: q('wrk-kpi-posts-sub'),
                    kpiSaved: q('wrk-kpi-saved'),
                    kpiDedup: q('wrk-kpi-dedup'),
                    kpiFailedCard: q('wrk-kpi-failed-card'),
                    kpiFailed: q('wrk-kpi-failed'),
                    kpiFailedSub: q('wrk-kpi-failed-sub'),
                    kpiPages: q('wrk-kpi-pages'),
                    kpiPagesSub: q('wrk-kpi-pages-sub'),
                    crawlWrap: q('wrk-crawl-wrap'),
                    crawlLbl: q('wrk-crawl-lbl'),
                    crawlFill: q('wrk-crawl-fill'),
                    activeTitle: q('wrk-active-title'),
                    activeStatus: q('wrk-active-status'),
                    activeActions: q('wrk-active-actions'),
                    skipPostBtn: q('wrk-skip-post-btn'),
                    stopThreadBtn: q('wrk-stop-thread-btn'),
                    fileFill: q('wrk-file-fill'),
                    totalFill: q('wrk-total-fill'),
                    deadCountBadge: q('wrk-dead-badge'),
                    hostPills: q('wrk-host-pills'),
                    failedList: q('wrk-failed-list'),
                    copyAllDeadBtn: q('wrk-copy-all-dead-btn'),
                    queueCount: q('wrk-queue-count'),
                    queueList: q('wrk-queue-list'),
                    histCount: q('wrk-hist-count'),
                    histList: q('wrk-hist-list'),
                };

                q('wrk-stop-all-btn').addEventListener('click', () => {
                    pendingJobs.length = 0;
                    if (activeThreadCrawl) activeThreadCrawl.cancelled = true;
                    if (activeCancelController) activeCancelController.cancel();
                    listRenderRevision++;
                    publishState();
                });

                q('wrk-reset-stats-btn').addEventListener('click', () => {
                    history = [];
                    failedPostsRecords.length = 0;
                    deadLinksByHost.clear();
                    sessionStats.postsDone = 0;
                    sessionStats.postsSkipped = 0;
                    sessionStats.filesSaved = 0;
                    sessionStats.filesDeduped = 0;
                    sessionStats.filesFailed = 0;
                    sessionStats.failedPostsCount = 0;
                    sessionStats.pagesScanned = 0;
                    sessionStats.startedAt = Date.now();
                    listRenderRevision++;
                    publishState();
                });

                q('wrk-skip-post-btn').addEventListener('click', () => {
                    if (activeCancelController) activeCancelController.cancel();
                });

                q('wrk-stop-thread-btn').addEventListener('click', () => {
                    if (activeThreadCrawl) activeThreadCrawl.cancelled = true;
                    if (activeCancelController) activeCancelController.cancel();
                    listRenderRevision++;
                    publishState();
                });

                q('wrk-copy-all-dead-btn').addEventListener('click', async e => {
                    const btn = e.currentTarget;
                    const lines = [];
                    for (const rec of failedPostsRecords) {
                        for (const d of rec.deadItems) {
                            lines.push(`[${rec.threadTitle || 'Thread'} · Post #${rec.postNumber}] ${d.reason}: ${d.url}`);
                        }
                        if (!rec.deadItems.length) {
                            lines.push(`[${rec.threadTitle || 'Thread'} · Post #${rec.postNumber}] ${rec.failed} failed link(s)`);
                        }
                    }
                    const ok = await copyTextToClipboard(lines.join('\n'));
                    btn.textContent = ok ? 'Copied!' : 'Failed';
                    setTimeout(() => {
                        if (btn.isConnected) btn.textContent = 'Copy All Dead URLs';
                    }, 1500);
                });

                q('xfpd-wrk-root').addEventListener('click', async e => {
                    const copyBtn = e.target.closest('[data-wrk-copy-log]');
                    if (copyBtn) {
                        const jId = copyBtn.getAttribute('data-wrk-copy-log');
                        const rec = failedPostsRecords.find(r => r.jobId === jId);
                        if (rec && rec.errorLog) {
                            const ok = await copyTextToClipboard(rec.errorLog);
                            copyBtn.textContent = ok ? 'Copied!' : 'Failed';
                            setTimeout(() => {
                                if (copyBtn.isConnected) copyBtn.textContent = 'Copy Log';
                            }, 1500);
                        }
                        return;
                    }
                    const cThread = e.target.closest('[data-wrk-cancel-thread]');
                    if (cThread) {
                        const jId = cThread.getAttribute('data-wrk-cancel-thread');
                        for (let i = pendingJobs.length - 1; i >= 0; i--) {
                            if (pendingJobs[i].jobId === jId) pendingJobs.splice(i, 1);
                        }
                        listRenderRevision++;
                        publishState();
                        return;
                    }
                    const cJob = e.target.closest('[data-wrk-cancel-job]');
                    if (cJob) {
                        const jId = cJob.getAttribute('data-wrk-cancel-job');
                        for (let i = pendingJobs.length - 1; i >= 0; i--) {
                            if (pendingJobs[i].jobId === jId) pendingJobs.splice(i, 1);
                        }
                        listRenderRevision++;
                        publishState();
                    }
                });

                lastRenderedRevision = 0;
                renderWorkerDashboard(xfpdReadQueueState());
            } catch (e) {}
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', mountWorkerDashboard, { once: true });
        } else {
            mountWorkerDashboard();
        }
    }

    const maybeArmIdleClose = () => {
        cancelIdleClose();
        if (!isDedicatedWorkerTab) return;
        if (activeJobSummary || pendingJobs.length > 0) return;
        if (standbyMode) return;
        idleCloseTimer = setTimeout(() => {
            const unacked = xfpdReadPendingQueueCommands(processedCmdIds);
            if (unacked.length > 0 || activeJobSummary || pendingJobs.length > 0) {
                drainCommands();
                return;
            }
            // Signal opener tab's GM_openInTab handle to close us cleanly (no @grant window.close needed!)
            xfpdWriteQueueState({
                workerId: '',
                workerHeartbeat: 0,
                workerClosing: true,
                workerStandby: false,
                ackCmdIds: ackQueue.slice(-200),
                active: null,
                queued: [],
                history: history.slice(0, 30),
            });
            try { window.close(); } catch (e) {}

            // If opener tab navigated away and the browser kept this tab open, enter Standby Mode
            // so future downloads across any page/thread reuse this exact single tab with zero new tabs!
            setTimeout(() => {
                if (window.closed) return;
                standbyMode = true;
                publishState();
                drainCommands();
            }, 900);
        }, XFPD_WORKER_IDLE_CLOSE_MS);
    };

    const hydrateJobHints = hints => {
        if (!hints || typeof hints !== 'object') return;
        const applyPairs = (pairs, mapObj) => {
            if (!Array.isArray(pairs) || !mapObj) return;
            for (const pair of pairs) {
                if (Array.isArray(pair) && pair.length >= 2 && pair[0] && pair[1]) {
                    try { mapObj.set(String(pair[0]), String(pair[1])); } catch (e) {}
                }
            }
        };
        applyPairs(hints.linkNames, linkHintNameByUrl);
        applyPairs(hints.bunkrNames, bunkrNameByUrl);
        applyPairs(hints.goonboxThumbs, goonboxThumbByUrl);
        applyPairs(hints.imagepondDirects, imagepondDirectByPageUrl);
        applyPairs(hints.imagepondNames, imagepondNameByUrl);
    };

    const prepareRemotePostIfLockedOrCollapsed = async job => {
        const incComments = !job.postSettings || job.postSettings.includeComments !== false;
        const needsLockUnlock =
            !!(job.hasMainLockedContent || (incComments && job.hasCommentLockedContent)) &&
            (!job.postSettings || job.postSettings.autoUnlockReaction !== false || !job.parsedHosts.length);
        const needsCommentsExpand = !!(incComments && job.hasCollapsedComments);

        let reactedMainDuringUnlock = false;

        if (!needsLockUnlock && !needsCommentsExpand) {
            return { reactedMainDuringUnlock };
        }

        if (needsLockUnlock && Array.isArray(job.unlockReactUrls) && job.unlockReactUrls.length && job.csrfToken) {
            activeJobSummary.phase = 'unlocking';
            activeJobSummary.statusText = '🔓 Reacting to unlock hidden links...';
            publishState();

            for (const rUrl of job.unlockReactUrls) {
                let reqUri = '/';
                try {
                    const pUrl = new URL(job.pageUrl);
                    reqUri = `${pUrl.pathname}${pUrl.search || ''}`;
                } catch (e) {}
                const bodyParams = new URLSearchParams({
                    _xfToken: job.csrfToken,
                    _xfRequestUri: reqUri,
                    _xfWithData: '1',
                    _xfResponseType: 'json',
                }).toString();
                const res = await xfpdSameOriginFetchText(rUrl, 'POST', bodyParams);
                if (res && res.ok && job.completionReactUrl && rUrl === job.completionReactUrl) {
                    reactedMainDuringUnlock = true;
                }
                await h.delayedResolve(150);
            }
        }

        if (job.pageUrl) {
            activeJobSummary.phase = 'unlocking';
            activeJobSummary.statusText = '💬 Loading fresh post & comment links...';
            publishState();

            const pageRes = await xfpdSameOriginFetchText(job.pageUrl, 'GET', null);
            if (pageRes && pageRes.ok && pageRes.text) {
                try {
                    const doc = new DOMParser().parseFromString(pageRes.text, 'text/html');
                    const freshPostEl = doc.querySelector(`#js-post-${job.postId}, [data-content="post-${job.postId}"]`);
                    if (freshPostEl) {
                        // Expand collapsed comments inside detached freshPostEl if needed
                        if (incComments) {
                            for (let pass = 0; pass < 10; pass++) {
                                const loaders = xfpdFindCollapsedCommentLoaders(freshPostEl);
                                if (!loaders.length) break;
                                const loaderLink = loaders[0];
                                const rawHref = loaderLink.getAttribute('href') || '';
                                if (!rawHref) break;
                                let fetchUrl = '';
                                try {
                                    const u = new URL(rawHref, job.pageUrl);
                                    u.searchParams.set('_xfWithData', '1');
                                    u.searchParams.set('_xfResponseType', 'json');
                                    fetchUrl = u.href;
                                } catch (e) {
                                    break;
                                }
                                const cRes = await xfpdSameOriginFetchText(fetchUrl, 'GET', null);
                                const loaderRow = loaderLink.closest('.js-commentLoader, .message-responseRow') || loaderLink;
                                if (cRes && cRes.ok && cRes.text) {
                                    let htmlChunk = '';
                                    try {
                                        const pj = JSON.parse(cRes.text);
                                        htmlChunk = String((pj && pj.html && pj.html.content) || '');
                                    } catch (e) {
                                        htmlChunk = cRes.text;
                                    }
                                    if (htmlChunk && htmlChunk.trim()) {
                                        const targetContainer =
                                            (loaderRow && loaderRow.parentElement) ||
                                            freshPostEl.querySelector('.js-replyNewMessageContainer, .message-responses, .uw_fcs_comment_section');
                                        if (targetContainer) {
                                            const tmp = doc.createElement('div');
                                            tmp.innerHTML = htmlChunk;
                                            while (tmp.firstChild) {
                                                targetContainer.appendChild(tmp.firstChild);
                                            }
                                        }
                                    }
                                }
                                loaderRow.remove();
                            }
                        }

                        const oppEl = freshPostEl.querySelector('.message-attribution-opposite');
                        if (oppEl) {
                            const reParsed = parsers.thread.parsePost(oppEl);
                            if (reParsed) {
                                const targetContent = incComments ? reParsed.content : reParsed.mainOnlyContent;
                                const disabledKeys = new Set(
                                    (job.parsedHosts || [])
                                        .filter(hItem => !hItem.enabled)
                                        .map(hItem => `${hItem.name}:${hItem.category}`),
                                );
                                const freshHosts = parsers.hosts.parseHosts(targetContent);
                                freshHosts.forEach(hItem => {
                                    if (disabledKeys.has(`${hItem.name}:${hItem.category}`)) {
                                        hItem.enabled = false;
                                    }
                                });
                                job.parsedHosts = freshHosts;
                                job.postCaption = reParsed.postCaption || job.postCaption;
                                job.spoilers = reParsed.spoilers || job.spoilers;
                            }
                        }
                    }
                } catch (e) {}
            }
        }

        return { reactedMainDuringUnlock };
    };

    const executeSingleJob = async job => {
        cancelIdleClose();
        hydrateJobHints(job.hints);

        activeCancelController = {
            cancelled: false,
            abortHandlers: new Set(),
            cancel() {
                this.cancelled = true;
                this.abortHandlers.forEach(fn => {
                    try { fn(); } catch (e) {}
                });
                this.abortHandlers.clear();
            },
        };

        const enabledCount0 = (job.parsedHosts || [])
            .filter(hItem => hItem.enabled && hItem.resources && hItem.resources.length)
            .reduce((a, hItem) => a + hItem.resources.length, 0);

        activeJobSummary = {
            jobId: job.jobId,
            threadKey: job.threadKey,
            threadTitle: job.threadTitle,
            postId: job.postId,
            postNumber: job.postNumber,
            postCaption: job.postCaption || '',
            threadCrawl: job.threadCrawl || null,
            phase: 'starting',
            completed: 0,
            total: enabledCount0,
            filePct: 0,
            totalPct: 0,
            statusText: 'Preparing...',
        };
        publishState();

        let reactedMainDuringUnlock = false;
        try {
            const prep = await prepareRemotePostIfLockedOrCollapsed(job);
            reactedMainDuringUnlock = !!(prep && prep.reactedMainDuringUnlock);
        } catch (e) {}

        if (activeCancelController.cancelled) {
            history.unshift({
                jobId: job.jobId,
                threadKey: job.threadKey,
                threadTitle: job.threadTitle,
                postId: job.postId,
                postNumber: job.postNumber,
                status: 'cancelled',
                succeeded: 0,
                total: enabledCount0,
                failed: 0,
                deduped: 0,
                errorLog: '',
                finishedAt: Date.now(),
            });
            activeJobSummary = null;
            activeCancelController = null;
            publishState();
            return;
        }

        const enabledHosts = (job.parsedHosts || []).filter(hItem => hItem.enabled && hItem.resources && hItem.resources.length);
        const finalResourceTotal = enabledHosts.reduce((a, hItem) => a + hItem.resources.length, 0);
        if (finalResourceTotal === 0) {
            history.unshift({
                jobId: job.jobId,
                threadKey: job.threadKey,
                threadTitle: job.threadTitle,
                postId: job.postId,
                postNumber: job.postNumber,
                status: 'done',
                succeeded: 0,
                total: 0,
                failed: 0,
                deduped: 0,
                errorLog: '',
                finishedAt: Date.now(),
            });
            activeJobSummary = null;
            activeCancelController = null;
            publishState();
            return;
        }

        activeJobSummary.total = finalResourceTotal;
        publishState();

        // Virtual statusUI elements observed via MutationObserver (immune to background timer throttling!)
        const vRoot = document.createElement('div');
        const vStatus = document.createElement('span');
        const vFilePB = document.createElement('div');
        const vTotalPB = document.createElement('div');
        vRoot.append(vStatus, vFilePB, vTotalPB);

        let lastBroadcastAt = 0;
        const syncVirtualDomProgress = (force = false) => {
            if (!activeJobSummary) return;
            const now = Date.now();
            if (!force && now - lastBroadcastAt < 140) return;
            lastBroadcastAt = now;
            const txt = String(vStatus.textContent || '').replace(/Copy Log$/i, '').trim();
            if (txt) activeJobSummary.statusText = txt;
            const fPct = parseFloat(vFilePB.style.width || '0') || 0;
            const tPct = parseFloat(vTotalPB.style.width || '0') || 0;
            activeJobSummary.filePct = Math.max(0, Math.min(100, Math.round(fPct)));
            activeJobSummary.totalPct = Math.max(0, Math.min(100, Math.round(tPct)));
            publishState();
        };

        let vObserver = null;
        if (typeof MutationObserver !== 'undefined') {
            vObserver = new MutationObserver(() => syncVirtualDomProgress(false));
            vObserver.observe(vRoot, {
                childList: true,
                characterData: true,
                attributes: true,
                subtree: true,
            });
        }
        const progressPoll = setInterval(() => syncVirtualDomProgress(false), 350);

        const virtualParsedPost = {
            postId: job.postId,
            postNumber: job.postNumber,
            pageNumber: job.pageNumber || 1,
            threadKey: job.threadKey,
            threadTitle: job.threadTitle,
            postCaption: job.postCaption || '',
            spoilers: Array.isArray(job.spoilers) ? job.spoilers : [],
            contentContainer: null,
            footer: null,
        };

        let outcome = null;

        try {
            await downloadPost(
                virtualParsedPost,
                job.parsedHosts,
                list => list.filter(hItem => hItem.enabled),
                resolvers,
                () => job.postSettings,
                { status: vStatus, filePB: vFilePB, totalPB: vTotalPB },
                {
                    cancelController: activeCancelController,
                    onProgress: ({ phase, completed, total }) => {
                        if (!activeJobSummary) return;
                        activeJobSummary.phase = phase;
                        activeJobSummary.completed = completed;
                        activeJobSummary.total = total;
                        if (total > 0) {
                            activeJobSummary.totalPct = Math.max(0, Math.min(100, Math.round((completed / total) * 100)));
                        }
                        syncVirtualDomProgress(false);
                    },
                    onCancel: (total, succeeded) => {
                        outcome = {
                            status: 'cancelled',
                            total,
                            succeeded,
                            failed: 0,
                            deduped: 0,
                            errorLog: '',
                        };
                    },
                    onComplete: (total, succeeded, failed = 0, deduped = 0, errorLog = '') => {
                        let st = 'done';
                        if (total === 0 && deduped > 0 && failed === 0) st = 'dedup';
                        else if (failed > 0 && succeeded > 0) st = 'partial';
                        else if (failed > 0 && succeeded === 0) st = 'failed';
                        outcome = {
                            status: st,
                            total,
                            succeeded,
                            failed,
                            deduped,
                            errorLog: failed > 0 ? String(errorLog || '') : '',
                        };
                    },
                },
            );
        } catch (err) {
            console.error('[XFPD Worker] Job failed with exception:', err);
            outcome = {
                status: 'failed',
                total: finalResourceTotal,
                succeeded: 0,
                failed: finalResourceTotal,
                deduped: 0,
                errorLog: String((err && err.stack) || err || ''),
            };
        } finally {
            if (vObserver) {
                try { vObserver.disconnect(); } catch (e) {}
            }
            clearInterval(progressPoll);
        }

        // Trigger post-download thank-you reaction remotely ONLY when Auto-React Downloaded Posts is enabled!
        if (
            outcome &&
            job.postSettings &&
            job.postSettings.autoReactAfterDownload === true &&
            (outcome.succeeded > 0 || (outcome.deduped > 0 && outcome.failed === 0)) &&
            job.completionReactUrl &&
            !reactedMainDuringUnlock
        ) {
            const activeCsrf = job.csrfToken || xfpdGetXenForoCsrfToken();
            if (activeCsrf) {
                try {
                    let reqUri = '/';
                    try {
                        const pUrl = new URL(job.pageUrl);
                        reqUri = `${pUrl.pathname}${pUrl.search || ''}`;
                    } catch (e) {}
                    const bodyParams = new URLSearchParams({
                        _xfToken: activeCsrf,
                        _xfRequestUri: reqUri,
                        _xfWithData: '1',
                        _xfResponseType: 'json',
                    }).toString();
                    let reactRes = await xfpdSameOriginFetchText(job.completionReactUrl, 'POST', bodyParams);
                    // Retry once after 1.2s if XenForo flood-checked rapid consecutive reactions!
                    if (!reactRes || !reactRes.ok || /"status"\s*:\s*"error"/i.test(reactRes.text || '')) {
                        await h.delayedResolve(1200);
                        await xfpdSameOriginFetchText(job.completionReactUrl, 'POST', bodyParams);
                    }
                } catch (e) {}
            }
        }

        if (outcome) {
            if (outcome.status !== 'cancelled') {
                sessionStats.postsDone++;
                sessionStats.filesSaved += Number(outcome.succeeded || 0) || 0;
                sessionStats.filesDeduped += Number(outcome.deduped || 0) || 0;
                const failCnt = Number(outcome.failed || 0) || 0;
                if (failCnt > 0) {
                    sessionStats.filesFailed += failCnt;
                    sessionStats.failedPostsCount++;
                    const deadItems = parseDeadLinksFromLog(outcome.errorLog || '');
                    for (const d of deadItems) {
                        deadLinksByHost.set(d.host, (deadLinksByHost.get(d.host) || 0) + 1);
                    }
                    failedPostsRecords.unshift({
                        jobId: job.jobId,
                        threadKey: job.threadKey,
                        threadTitle: job.threadTitle,
                        pageUrl: job.pageUrl || '',
                        pageNumber: job.pageNumber || 0,
                        postId: job.postId,
                        postNumber: job.postNumber,
                        succeeded: outcome.succeeded || 0,
                        failed: failCnt,
                        deduped: outcome.deduped || 0,
                        total: outcome.total || 0,
                        deadItems,
                        errorLog: outcome.errorLog || '',
                        finishedAt: Date.now(),
                    });
                    if (failedPostsRecords.length > 150) failedPostsRecords.length = 150;
                }
            }
            if (typeof xfpdRecordThreadPostOutcome === 'function') {
                try {
                    xfpdRecordThreadPostOutcome(job.threadKey, {
                        postId: job.postId,
                        postNumber: job.postNumber,
                        ...outcome,
                    });
                } catch (e) {}
            }
            history = history.filter(hItem => !(hItem.threadKey === job.threadKey && hItem.postId === job.postId));
            history.unshift({
                jobId: job.jobId,
                threadKey: job.threadKey,
                threadTitle: job.threadTitle,
                postId: job.postId,
                postNumber: job.postNumber,
                ...outcome,
                finishedAt: Date.now(),
            });
            if (history.length > 30) history = history.slice(0, 30);
            listRenderRevision++;
        }

        if (activeThreadCrawl && !activeThreadCrawl.cancelled && job.threadCrawl) {
            activeJobSummary = {
                jobId: activeThreadCrawl.jobId,
                threadKey: activeThreadCrawl.threadKey,
                threadTitle: activeThreadCrawl.threadTitle,
                postId: '',
                postNumber: `P.${job.threadCrawl.currentPage}`,
                postCaption: '',
                threadCrawl: job.threadCrawl,
                phase: 'scanning_page',
                completed: job.threadCrawl.pagesDone,
                total: job.threadCrawl.pagesTotal,
                filePct: 0,
                totalPct: Math.round(((job.threadCrawl.pagesDone + 0.5) / Math.max(1, job.threadCrawl.pagesTotal)) * 100),
                statusText: `📄 Continuing thread crawl (Page ${job.threadCrawl.currentPage}/${job.threadCrawl.endPage})...`,
            };
        } else {
            activeJobSummary = null;
        }
        activeCancelController = null;
        publishState();
    };

    const executeThreadCrawlJob = async crawlJob => {
        cancelIdleClose();
        const pages = Array.isArray(crawlJob.pages) ? crawlJob.pages : [];
        if (!pages.length) return;

        activeThreadCrawl = {
            jobId: crawlJob.jobId,
            threadKey: crawlJob.threadKey,
            threadTitle: crawlJob.threadTitle,
            startPage: crawlJob.startPage || pages[0].pageNum,
            endPage: crawlJob.endPage || pages[pages.length - 1].pageNum,
            pagesTotal: pages.length,
            cancelled: false,
        };

        let csrfToken = crawlJob.csrfToken || '';
        const incComments = !crawlJob.postSettings || crawlJob.postSettings.includeComments !== false;

        try {
            for (let pIdx = 0; pIdx < pages.length; pIdx++) {
                if (activeThreadCrawl.cancelled) break;
                const { pageNum, pageUrl } = pages[pIdx];

                const crawlSnapshot = {
                    jobId: crawlJob.jobId,
                    currentPage: pageNum,
                    startPage: activeThreadCrawl.startPage,
                    endPage: activeThreadCrawl.endPage,
                    pagesDone: pIdx,
                    pagesTotal: pages.length,
                };

                activeJobSummary = {
                    jobId: crawlJob.jobId,
                    threadKey: crawlJob.threadKey,
                    threadTitle: crawlJob.threadTitle,
                    postId: '',
                    postNumber: `P.${pageNum}`,
                    postCaption: '',
                    threadCrawl: crawlSnapshot,
                    phase: 'scanning_page',
                    completed: pIdx,
                    total: pages.length,
                    filePct: 0,
                    totalPct: Math.round((pIdx / pages.length) * 100),
                    statusText: `📄 Scanning Thread Page ${pageNum} / ${activeThreadCrawl.endPage}...`,
                };
                publishState();

                // Resilient 6-attempt exponential backoff (up to ~72s recovery) + valid XenForo DOM check
                // so temporary Cloudflare 429 / 502 / 522 / interstitial pages never silently skip pages!
                const backoffDelaysMs = [0, 2200, 5000, 10000, 20000, 35000];
                let validDoc = null;

                for (let attempt = 0; attempt < backoffDelaysMs.length; attempt++) {
                    if (activeThreadCrawl.cancelled) break;
                    if (backoffDelaysMs[attempt] > 0) {
                        const waitSec = Math.round(backoffDelaysMs[attempt] / 1000);
                        activeJobSummary.statusText = `⏳ Forum busy/rate-limited on Page ${pageNum} — retry [${attempt}/${backoffDelaysMs.length - 1}] in ${waitSec}s...`;
                        publishState();
                        await h.delayedResolve(backoffDelaysMs[attempt]);
                        if (activeThreadCrawl.cancelled) break;
                    }
                    const pageRes = await xfpdSameOriginFetchText(pageUrl, 'GET', null);
                    if (pageRes && pageRes.ok && pageRes.text) {
                        try {
                            const candidateDoc = new DOMParser().parseFromString(pageRes.text, 'text/html');
                            if (candidateDoc.querySelector('.block--messages, .js-post, article.message, .message-attribution-opposite')) {
                                validDoc = candidateDoc;
                                break;
                            }
                        } catch (e) {}
                    }
                }

                if (activeThreadCrawl.cancelled) break;

                if (!validDoc) {
                    if (typeof xfpdRecordThreadPageOutcome === 'function') {
                        xfpdRecordThreadPageOutcome(crawlJob.threadKey, pageNum, false);
                    }
                    continue;
                }

                sessionStats.pagesScanned++;
                if (typeof xfpdRecordThreadPageOutcome === 'function') {
                    xfpdRecordThreadPageOutcome(crawlJob.threadKey, pageNum, true);
                }

                const pagePostJobs = [];
                try {
                    const freshCsrf = xfpdExtractCsrfFromDoc(validDoc);
                    if (freshCsrf) csrfToken = freshCsrf;

                    const oppEls = [...validDoc.querySelectorAll('.message-attribution-opposite')];
                    for (const oppEl of oppEls) {
                        const parsedPost = parsers.thread.parsePost(oppEl);
                        if (!parsedPost) continue;

                        // Instant 0ms resume: if Smart Dedup is ON and this post was already completed cleanly
                        // in this thread's persistent ledger, skip re-resolving its albums/links completely!
                        if (
                            (!crawlJob.postSettings || crawlJob.postSettings.contentDedup !== false) &&
                            typeof xfpdGetThreadPostRecord === 'function'
                        ) {
                            const prevRec = xfpdGetThreadPostRecord(parsedPost.postId, crawlJob.threadKey);
                            if (prevRec && (prevRec.status === 'done' || prevRec.status === 'dedup')) {
                                sessionStats.postsSkipped++;
                                continue;
                            }
                        }

                        parsedPost.pageNumber = pageNum;
                        const targetContent = incComments ? parsedPost.content : parsedPost.mainOnlyContent;
                        const parsedHosts = parsers.hosts.parseHosts(targetContent);
                        const hasLocked =
                            !!(parsedPost.hasMainLockedContent || (incComments && parsedPost.hasCommentLockedContent));
                        const hasCollapsed = !!(incComments && parsedPost.hasCollapsedComments);

                        if (!parsedHosts.length && !hasLocked && !hasCollapsed) {
                            continue;
                        }

                        const pJob = xfpdBuildSerializedPostJob({
                            parsedPost,
                            parsedHosts,
                            messageEl: parsedPost.messageEl,
                            postSettings: crawlJob.postSettings,
                            threadKey: crawlJob.threadKey,
                            threadTitle: crawlJob.threadTitle,
                            pageUrl,
                            pageNumber: pageNum,
                            csrfToken,
                        });
                        pJob.threadCrawl = crawlSnapshot;
                        pagePostJobs.push(pJob);
                    }
                } catch (err) {
                    console.error('[XFPD Worker] Error parsing thread page:', pageNum, err);
                }

                for (const postJob of pagePostJobs) {
                    if (activeThreadCrawl.cancelled) break;
                    if (csrfToken) postJob.csrfToken = csrfToken;
                    await executeSingleJob(postJob);
                }

                if (pIdx + 1 < pages.length && !activeThreadCrawl.cancelled) {
                    await h.delayedResolve(450);
                }
            }
        } finally {
            activeThreadCrawl = null;
            activeJobSummary = null;
            activeCancelController = null;
            publishState();
        }
    };

    const pumpQueue = async () => {
        if (pumping) return;
        pumping = true;
        standbyMode = false;
        cancelIdleClose();

        const runLoop = async () => {
            while (pendingJobs.length > 0) {
                const nextJob = pendingJobs.shift();
                if (!nextJob) continue;
                if (nextJob.kind === 'thread_crawl') {
                    await executeThreadCrawlJob(nextJob);
                } else {
                    await executeSingleJob(nextJob);
                }
            }
        };

        try {
            if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
                await navigator.locks.request('xfpd_active_download_lock', { mode: 'shared' }, runLoop);
            } else {
                await runLoop();
            }
        } finally {
            pumping = false;
            publishState();
            maybeArmIdleClose();
        }
    };

    const drainCommands = () => {
        const cmds = xfpdReadPendingQueueCommands(processedCmdIds);
        if (!cmds.length) return;

        let mutated = false;
        for (const cmd of cmds) {
            processedCmdIds.add(cmd.id);
            ackQueue.push(cmd.id);
            if (ackQueue.length > 220) ackQueue.splice(0, ackQueue.length - 200);
            mutated = true;

            const p = cmd.payload || {};
            if (cmd.type === 'enqueue' && Array.isArray(p.jobs)) {
                for (const job of p.jobs) {
                    if (!job || !job.postId) continue;
                    const dupActive =
                        activeJobSummary &&
                        activeJobSummary.threadKey === job.threadKey &&
                        activeJobSummary.postId === job.postId;
                    const dupQueued = pendingJobs.some(
                        q => q.kind !== 'thread_crawl' && q.threadKey === job.threadKey && q.postId === job.postId,
                    );
                    if (!dupActive && !dupQueued) {
                        pendingJobs.push(job);
                    }
                }
            } else if (cmd.type === 'enqueue_thread' && p.crawlJob && Array.isArray(p.crawlJob.pages)) {
                const cj = p.crawlJob;
                const dupActiveCrawl =
                    activeThreadCrawl &&
                    activeThreadCrawl.threadKey === cj.threadKey &&
                    activeThreadCrawl.startPage === cj.startPage &&
                    activeThreadCrawl.endPage === cj.endPage;
                const dupQueuedCrawl = pendingJobs.some(
                    q =>
                        q.kind === 'thread_crawl' &&
                        q.threadKey === cj.threadKey &&
                        q.startPage === cj.startPage &&
                        q.endPage === cj.endPage,
                );
                if (!dupActiveCrawl && !dupQueuedCrawl) {
                    pendingJobs.push({ ...cj, kind: 'thread_crawl' });
                }
            } else if (cmd.type === 'cancel_thread') {
                const matchCrawl = item =>
                    item &&
                    ((p.jobId && item.jobId === p.jobId) ||
                        (!p.jobId && p.threadKey && item.threadKey === p.threadKey));
                if (activeThreadCrawl && matchCrawl(activeThreadCrawl)) {
                    activeThreadCrawl.cancelled = true;
                    if (activeCancelController) activeCancelController.cancel();
                }
                for (let i = pendingJobs.length - 1; i >= 0; i--) {
                    if (pendingJobs[i].kind === 'thread_crawl' && matchCrawl(pendingJobs[i])) {
                        pendingJobs.splice(i, 1);
                    }
                }
            } else if (cmd.type === 'cancel_job') {
                if (activeThreadCrawl && p.jobId && activeThreadCrawl.jobId === p.jobId) {
                    activeThreadCrawl.cancelled = true;
                    if (activeCancelController) activeCancelController.cancel();
                    continue;
                }
                const matchJob = item =>
                    (p.jobId && item.jobId === p.jobId) ||
                    (p.postId && item.postId === p.postId && (!p.threadKey || item.threadKey === p.threadKey));
                if (activeJobSummary && matchJob(activeJobSummary) && activeCancelController) {
                    activeCancelController.cancel();
                } else {
                    for (let i = pendingJobs.length - 1; i >= 0; i--) {
                        if (matchJob(pendingJobs[i])) {
                            pendingJobs.splice(i, 1);
                        }
                    }
                }
            } else if (cmd.type === 'cancel_all') {
                pendingJobs.length = 0;
                if (activeThreadCrawl) {
                    activeThreadCrawl.cancelled = true;
                }
                if (activeCancelController) {
                    activeCancelController.cancel();
                }
            } else if (cmd.type === 'clear_history') {
                history = [];
                failedPostsRecords.length = 0;
                deadLinksByHost.clear();
                sessionStats.postsDone = 0;
                sessionStats.postsSkipped = 0;
                sessionStats.filesSaved = 0;
                sessionStats.filesDeduped = 0;
                sessionStats.filesFailed = 0;
                sessionStats.failedPostsCount = 0;
                sessionStats.pagesScanned = 0;
                sessionStats.startedAt = Date.now();
            }
        }

        if (mutated) {
            listRenderRevision++;
            publishState();
        }
        if (pendingJobs.length > 0 && !pumping) {
            pumpQueue();
        } else if (!activeJobSummary && pendingJobs.length === 0) {
            maybeArmIdleClose();
        }
    };

    const heartbeatTimer = setInterval(() => {
        publishState();
    }, XFPD_WORKER_HEARTBEAT_MS);
    const cmdPollTimer = setInterval(drainCommands, 400);
    xfpdOnQueueCommand(drainCommands);
    xfpdOnQueuePing(() => {
        publishState();
        drainCommands();
    });

    publishState();
    drainCommands();
}

(function () {
    try { if (window.__XFPD_ABORT_MAIN) return; } catch (e) {}

    // @match covers gofile.io for GM_cookie sync; bail out on GoFile pages.
    try { if (/(^|\.)gofile\.io$/i.test(location.hostname)) return; } catch (e) {}

    // Goonbox same-origin API helper tab.
    try {
        if (/(^|\.)goonbox\.cr$/i.test(location.hostname)) {
            try { goonboxBridgeServe(); } catch (e) {}
            return;
        }
    } catch (e) {}

    // Instant bypass if user ever lands directly on SimpCity /redirect/?to=... or SMG /goto/link-confirmation?url=...
    try {
        if (/^\/(?:redirect\b|goto\/link-confirmation\b)/i.test(location.pathname || '')) {
            const directTarget = typeof xfpdDecodeForumRedirectUrl === 'function' ? xfpdDecodeForumRedirectUrl(location.href) : null;
            if (directTarget) {
                location.replace(directTarget);
                return;
            }
        }
    } catch (e) {}

    // Synchronous capture-phase unwrap so left-click, middle-click, Ctrl+click, and right-click "Copy link"
    // ALWAYS open/copy the clean external URL directly without hitting /redirect/ or confirmation overlays!
    const unwrapEventAnchor = ev => {
        try {
            const t = ev && ev.target;
            if (!t || !t.closest) return;
            const a = t.closest('a');
            if (a && typeof xfpdUnwrapSingleAnchorRedirect === 'function') {
                xfpdUnwrapSingleAnchorRedirect(a);
            }
            const card = t.closest('.js-unfurl[data-url], .bbCodeBlock--unfurl[data-url]');
            if (card && typeof xfpdDecodeForumRedirectUrl === 'function') {
                const dec = xfpdDecodeForumRedirectUrl(card.getAttribute('data-url'));
                if (dec) card.setAttribute('data-url', dec);
            }
        } catch (e) {}
    };
    document.addEventListener('mousedown', unwrapEventAnchor, true);
    document.addEventListener('click', unwrapEventAnchor, true);
    document.addEventListener('auxclick', unwrapEventAnchor, true);
    document.addEventListener('contextmenu', unwrapEventAnchor, true);

    window.addEventListener('beforeunload', e => {
        if (processing.find(p => p.processing)) {
            const message = 'Downloads are in progress. Sure you wanna exit this page?';
            e.returnValue = message;
            return message;
        }
    });

    // Dedicated Background Worker Tab (`?xfpd_worker=1`): runs queue headlessly without forum UI overhead!
    if (xfpdIsWorkerTab()) {
        xfpdStartQueueEngine({ isDedicatedWorkerTab: true });
        return;
    }

    const onReady = cb => {
        let ran = false;
        const runOnceWhenBodyReady = () => {
            if (ran) return;
            if (document.body) {
                ran = true;
                cb();
                return;
            }
            if (typeof MutationObserver !== 'undefined' && document.documentElement) {
                const bootObs = new MutationObserver(() => {
                    if (!ran && document.body) {
                        ran = true;
                        bootObs.disconnect();
                        cb();
                    }
                });
                bootObs.observe(document.documentElement, { childList: true, subtree: true });
            }
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', runOnceWhenBodyReady, { once: true });
        } else {
            runOnceWhenBodyReady();
        }
    };

    onReady(() => {
        init.injectCustomStyles();

        // Process selected posts in strict chronological order (1 post at a time; each post already
        // downloads files concurrently in batches) so earlier posts always own shared/reposted media first.
        const XFPD_PAGE_CONCURRENCY = 1;
        let downloadPageTippy = null;
        const pageSettings = xfpdCreatePostSettings();
        const pageBatchState = {
            running: false,
            cancelled: false,
            finished: 0,
            total: 0,
            activePostIds: new Set(),
        };

        const isPostDownloadableOrLocked = postEntry => {
            if (!postEntry) return false;
            const ps = postEntry.getSettingsCB && postEntry.getSettingsCB();
            const incComments = !ps || ps.includeComments !== false;
            const lockedActive =
                postEntry.parsedPost &&
                (postEntry.parsedPost.hasMainLockedContent || (incComments && postEntry.parsedPost.hasCommentLockedContent));
            const collapsedActive = incComments && postEntry.parsedPost && postEntry.parsedPost.hasCollapsedComments;
            return postEntry.parsedHosts.length > 0 || !!lockedActive || !!collapsedActive;
        };

        const getPostEnabledResourceCount = postEntry => {
            if (!postEntry || !Array.isArray(postEntry.parsedHosts)) return 0;
            return postEntry.parsedHosts
                .filter(host => host.enabled && host.resources.length)
                .reduce((acc, host) => acc + host.resources.length, 0);
        };

        const getPageSelectionStats = () => {
            const downloadablePosts = parsedPosts.filter(isPostDownloadableOrLocked);
            let totalResourcesCount = 0;
            let totalLockedPosts = 0;
            let enabledPostsCount = 0;
            let selectedResourcesCount = 0;
            let selectedLockedPosts = 0;
            downloadablePosts.forEach(p => {
                const resCnt = getPostEnabledResourceCount(p);
                const isLck = !!(p.parsedPost && p.parsedPost.hasLockedContent);
                totalResourcesCount += resCnt;
                if (isLck) totalLockedPosts++;

                const sp = selectedPosts.find(s => s.post.parsedPost.postId === p.parsedPost.postId);
                if (sp && sp.enabled) {
                    enabledPostsCount++;
                    selectedResourcesCount += resCnt;
                    if (isLck) {
                        selectedLockedPosts++;
                    }
                }
            });
            return {
                totalPosts: downloadablePosts.length,
                totalResources: totalResourcesCount,
                totalLockedPosts,
                enabledPosts: enabledPostsCount,
                selectedResources: selectedResourcesCount,
                selectedLockedPosts,
            };
        };

        const updateDownloadPageButtonLabel = customState => {
            const btn = h.element('#download-page');
            if (!btn) return;
            const span = btn.querySelector('.download-page-btn') || btn;
            if (pageBatchState.running) {
                btn.style.color = '#e8a838';
                span.textContent = `✕ Cancel Page (${pageBatchState.finished}/${pageBatchState.total})`;
                return;
            }
            if (customState === 'completed') {
                btn.style.color = '#47ba24';
                span.textContent = `✓ Page Queued`;
                return;
            }
            btn.style.color = '';
            const {
                totalPosts,
                totalResources,
                totalLockedPosts,
                enabledPosts,
                selectedResources,
                selectedLockedPosts,
            } = getPageSelectionStats();
            if (!totalPosts) {
                span.textContent = '🡳 Download All Page';
            } else if (enabledPosts > 0) {
                const lockBadge = selectedLockedPosts > 0 ? ' + 🔒' : '';
                span.textContent = `🡳 Download Selected (${enabledPosts}/${totalPosts} · ${selectedResources}${lockBadge})`;
            } else {
                const allLockBadge = totalLockedPosts > 0 ? ' + 🔒' : '';
                span.textContent = `🡳 Download All Page (${totalPosts} ${totalPosts === 1 ? 'post' : 'posts'} · ${totalResources}${allLockBadge})`;
            }
        };

        const updatePageFormActionBtn = formEl => {
            if (!formEl) return;
            const actionBtn = formEl.querySelector('#xfpd-start-page-download');
            if (!actionBtn) return;
            if (pageBatchState.running) {
                actionBtn.disabled = false;
                actionBtn.textContent = `✕ Cancel Page (${pageBatchState.finished}/${pageBatchState.total})`;
                return;
            }
            const {
                totalPosts,
                totalResources,
                totalLockedPosts,
                enabledPosts,
                selectedResources,
                selectedLockedPosts,
            } = getPageSelectionStats();
            if (!totalPosts) {
                actionBtn.disabled = true;
                actionBtn.textContent = 'No downloadable posts on page';
            } else if (enabledPosts === 0) {
                const allLockBadge = totalLockedPosts > 0 ? ' + 🔒' : '';
                actionBtn.disabled = false;
                actionBtn.textContent = `🡳 Download All Page (${totalPosts} ${totalPosts === 1 ? 'post' : 'posts'} · ${totalResources}${allLockBadge})`;
            } else {
                const lockBadge = selectedLockedPosts > 0 ? ' + 🔒' : '';
                actionBtn.disabled = false;
                actionBtn.textContent = `🡳 Download Selected (${enabledPosts}/${totalPosts} · ${selectedResources}${lockBadge})`;
            }
        };

        window.__xfpdFocusDownloadPage = () => {
            const btn = h.element('#download-page');
            if (!btn) return;
            try {
                btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch (e) {
                btn.scrollIntoView();
            }
            if (downloadPageTippy && typeof downloadPageTippy.show === 'function') {
                setTimeout(() => {
                    try { downloadPageTippy.show(); } catch (e) {}
                }, 180);
            }
        };

        const pulsePostSelectionHeading = () => {
            if (!downloadPageTippy || !downloadPageTippy.popper) return;
            const heading = downloadPageTippy.popper.querySelector('[data-xfpd-post-selection-heading="1"]');
            if (!heading) return;
            heading.classList.remove('xfpd-pulse-highlight');
            void heading.offsetWidth;
            heading.classList.add('xfpd-pulse-highlight');
        };

        const escapeHudHtml = s =>
            String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

        let hudDismissedUntilCount = -1;
        let hudExpanded = true;
        let hudIdleExpanded = false;
        let hudIdleDismissed = false;
        try {
            const savedHudExp = sessionStorage.getItem('xfpd_hud_expanded');
            if (savedHudExp === '0') hudExpanded = false;
            if (sessionStorage.getItem('xfpd_hud_idle_dismissed') === '1') hudIdleDismissed = true;
        } catch (e) {}

        const serializePostEntryToJob = postEntry => {
            const { parsedPost, parsedHosts } = postEntry;
            const ps = postEntry.getSettingsCB();
            const messageEl =
                parsedPost.messageEl ||
                document.querySelector(`#js-post-${parsedPost.postId}, [data-content="post-${parsedPost.postId}"]`);
            return xfpdBuildSerializedPostJob({
                parsedPost,
                parsedHosts,
                messageEl,
                postSettings: ps,
                threadKey: xfpdGetCurrentThreadKey(),
                threadTitle: parsers.thread.parseTitle(),
                pageUrl: String(location.href || '').split('#')[0],
                pageNumber: parsedPost.pageNumber || 1,
                csrfToken: xfpdGetXenForoCsrfToken(),
            });
        };

        const enqueueThreadPageList = pageNumList => {
            const pag = xfpdGetThreadPaginationInfo();
            const cleanNums = [...new Set((pageNumList || []).map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= pag.totalPages))].sort(
                (a, b) => a - b,
            );
            if (!cleanNums.length) return;
            const pages = cleanNums.map(p => ({ pageNum: p, pageUrl: pag.buildPageUrl(p) }));

            hudDismissedUntilCount = -1;
            hudIdleDismissed = false;
            try { sessionStorage.removeItem('xfpd_hud_idle_dismissed'); } catch (e) {}

            const tKey = xfpdGetCurrentThreadKey();
            const sPage = cleanNums[0];
            const ePage = cleanNums[cleanNums.length - 1];
            const crawlJob = {
                kind: 'thread_crawl',
                jobId: `tcrawl_${tKey || 'f'}_${sPage}_${ePage}_${Date.now()}`,
                threadKey: tKey,
                threadTitle: parsers.thread.parseTitle(),
                startPage: sPage,
                endPage: ePage,
                pages,
                csrfToken: xfpdGetXenForoCsrfToken(),
                postSettings: JSON.parse(JSON.stringify(pageSettings)),
            };

            const cmdId = xfpdSendQueueCommand('enqueue_thread', { crawlJob });
            const spawnedOrAlive = xfpdEnsureQueueWorkerTab();
            syncVisiblePostsAndHud(xfpdReadQueueState());
            if (!spawnedOrAlive) {
                xfpdStartQueueEngine({ isDedicatedWorkerTab: false });
                return;
            }
            setTimeout(() => {
                const st = xfpdReadQueueState();
                const acked = Array.isArray(st.ackCmdIds) && st.ackCmdIds.includes(cmdId);
                if (!acked && !xfpdIsQueueWorkerAlive(st)) {
                    xfpdStartQueueEngine({ isDedicatedWorkerTab: false });
                }
            }, 3500);
        };

        const enqueueThreadPagesRange = (rawStartPage = null, rawEndPage = null) => {
            const pag = xfpdGetThreadPaginationInfo();
            if (pag.totalPages <= 1 && parsedPosts.length > 0) {
                enqueueAllPagePosts();
                return;
            }
            const sPage = Math.max(1, Math.min(pag.totalPages, parseInt(rawStartPage, 10) || 1));
            const ePage = Math.max(sPage, Math.min(pag.totalPages, parseInt(rawEndPage, 10) || pag.totalPages));
            const nums = [];
            for (let p = sPage; p <= ePage; p++) nums.push(p);
            enqueueThreadPageList(nums);
        };

        const enqueuePostsToBackgroundWorker = entries => {
            const list = (entries || []).filter(Boolean);
            if (!list.length) return;
            hudDismissedUntilCount = -1;
            hudIdleDismissed = false;
            try { sessionStorage.removeItem('xfpd_hud_idle_dismissed'); } catch (e) {}
            const jobs = list.map(serializePostEntryToJob);
            const cmdId = xfpdSendQueueCommand('enqueue', { jobs });

            // Immediately show optimistic queued state on the clicked post buttons
            list.forEach(entry => {
                if (entry.btnDownloadPost) {
                    entry.btnDownloadPost.dataset.xfpdState = 'queued';
                    entry.btnDownloadPost.style.color = '#3DB7C7';
                    entry.btnDownloadPost.innerHTML = '⏳ Queued · ✕';
                }
            });

            const spawnedOrAlive = xfpdEnsureQueueWorkerTab();
            syncVisiblePostsAndHud(xfpdReadQueueState());
            if (!spawnedOrAlive) {
                xfpdStartQueueEngine({ isDedicatedWorkerTab: false });
                return;
            }

            // Safety fallback: if popup/background tab was blocked and no worker claims the command within 3.5s,
            // run the queue engine seamlessly in the current tab so downloads never stall!
            setTimeout(() => {
                const st = xfpdReadQueueState();
                const acked = Array.isArray(st.ackCmdIds) && st.ackCmdIds.includes(cmdId);
                if (!acked && !xfpdIsQueueWorkerAlive(st)) {
                    xfpdStartQueueEngine({ isDedicatedWorkerTab: false });
                }
            }, 3500);
        };

        const syncVisiblePostsAndHud = stateSnapshot => {
            const st = stateSnapshot || xfpdReadQueueState();
            const curThreadKey = xfpdGetCurrentThreadKey();
            const workerAlive = xfpdIsQueueWorkerAlive(st);
            const active = workerAlive ? st.active : null;
            const queued = workerAlive ? st.queued || [] : [];
            const history = st.history || [];

            // 1) Sync post buttons on the current page
            parsedPosts.forEach(entry => {
                const btn = entry.btnDownloadPost;
                if (!btn) return;
                const pid = entry.parsedPost.postId;

                if (active && active.postId === pid && (!active.threadKey || active.threadKey === curThreadKey)) {
                    btn.dataset.xfpdState = 'running';
                    btn.style.color = '#e8a838';
                    if (active.phase === 'unlocking') {
                        btn.innerHTML = '⏳ Unlocking... (✕)';
                    } else if (active.phase === 'resolving') {
                        btn.innerHTML = `✕ Cancel (Resolving ${active.completed}/${active.total})`;
                    } else {
                        btn.innerHTML = `✕ Cancel (${active.completed}/${active.total})`;
                    }
                    return;
                }

                const qIdx = queued.findIndex(
                    q => q.postId === pid && (!q.threadKey || q.threadKey === curThreadKey),
                );
                if (qIdx > -1) {
                    btn.dataset.xfpdState = 'queued';
                    btn.style.color = '#3DB7C7';
                    btn.innerHTML = `⏳ Queued (#${qIdx + 1}) · ✕`;
                    return;
                }

                const hist =
                    history.find(hItem => hItem.postId === pid && (!hItem.threadKey || hItem.threadKey === curThreadKey)) ||
                    (typeof xfpdGetThreadPostRecord === 'function' ? xfpdGetThreadPostRecord(pid, curThreadKey) : null);
                if (hist) {
                    if (hist.status === 'cancelled') {
                        btn.dataset.xfpdState = 'idle';
                        entry.updateIdleButtonLabel();
                    } else {
                        btn.dataset.xfpdState = 'done';
                        if (hist.status === 'dedup') {
                            btn.style.color = '#47ba24';
                            btn.innerHTML = `✓ Deduplicated (${hist.deduped})`;
                        } else if (hist.status === 'done') {
                            btn.style.color = '#47ba24';
                            btn.innerHTML = `✓ Downloaded (${hist.succeeded}/${hist.total || hist.succeeded})`;
                        } else if (hist.status === 'partial') {
                            btn.style.color = '#e8a838';
                            btn.innerHTML = `⚠ Downloaded (${hist.succeeded}/${hist.total})`;
                        } else {
                            btn.style.color = '#d9534f';
                            btn.innerHTML = `✕ Retry (0/${hist.total || 1})`;
                        }
                    }
                    return;
                }

                if (btn.dataset.xfpdState === 'running' || btn.dataset.xfpdState === 'queued') {
                    btn.dataset.xfpdState = 'idle';
                    entry.updateIdleButtonLabel();
                }
            });

            // 2) Render Floating Queue HUD (#xfpd-queue-hud)
            if (!document.body) return;
            const recentHistory = history.filter(hItem => Date.now() - (Number(hItem.finishedAt) || 0) < 1800000);
            const unackedCmds = xfpdReadPendingQueueCommands(new Set(st.ackCmdIds || []));
            const pendingEnqueues = unackedCmds.reduce((acc, c) => {
                if (c.type === 'enqueue' && c.payload && Array.isArray(c.payload.jobs)) {
                    return acc + c.payload.jobs.length;
                }
                if (c.type === 'enqueue_thread' && c.payload && c.payload.crawlJob) {
                    return acc + 1;
                }
                return acc;
            }, 0);
            const pagInfo = xfpdGetThreadPaginationInfo();
            const isBusy = !!(active || queued.length > 0 || pendingEnqueues > 0);
            const hasUnclosedHistory = recentHistory.length > 0 && recentHistory.length !== hudDismissedUntilCount;
            const isIdlePillMode = !isBusy && !hasUnclosedHistory;
            const shouldShowHud =
                isBusy || hasUnclosedHistory || ((parsedPosts.length > 0 || pagInfo.totalPages > 1) && !hudIdleDismissed);

            let hudEl = document.getElementById('xfpd-queue-hud');
            if (!shouldShowHud) {
                if (hudEl) hudEl.style.display = 'none';
                return;
            }

            if (!hudEl) {
                hudEl = document.createElement('div');
                hudEl.id = 'xfpd-queue-hud';
                hudEl.setAttribute('data-xfpd-ui', '1');
                hudEl.innerHTML = `
                  <div class="xfpd-q-head" id="xfpd-q-head-bar">
                    <span class="xfpd-q-title" id="xfpd-q-title-txt">📥 Download Queue</span>
                    <span class="xfpd-q-ctrls">
                      <button type="button" class="xfpd-q-btn xfpd-q-btn-accent" id="xfpd-q-dl-thread-btn" title="Download entire thread (all pages)">📚 Thread</button>
                      <button type="button" class="xfpd-q-btn xfpd-q-btn-accent" id="xfpd-q-dl-page-btn" title="Enqueue all posts on this page">⬇ Page</button>
                      <button type="button" class="xfpd-q-btn" id="xfpd-q-toggle-btn" title="Expand / Collapse">▼</button>
                      <button type="button" class="xfpd-q-btn xfpd-q-btn-danger" id="xfpd-q-close-btn" title="Cancel All / Hide">✕</button>
                    </span>
                  </div>
                  <div class="xfpd-q-top-bar"><div class="xfpd-q-top-fill" id="xfpd-q-top-fill"></div></div>
                  <div class="xfpd-q-body" id="xfpd-q-body"></div>
                `;
                document.body.appendChild(hudEl);

                const toggleExpand = () => {
                    const curSt = xfpdReadQueueState();
                    const curAlive = xfpdIsQueueWorkerAlive(curSt);
                    const curUnacked = xfpdReadPendingQueueCommands(new Set(curSt.ackCmdIds || []));
                    const curPending = curUnacked.reduce(
                        (a, c) => a + (c.type === 'enqueue' && c.payload && Array.isArray(c.payload.jobs) ? c.payload.jobs.length : 0),
                        0,
                    );
                    const curBusy = !!(
                        (curAlive && (curSt.active || (curSt.queued && curSt.queued.length))) ||
                        curPending > 0
                    );
                    const curRecent = (curSt.history || []).filter(
                        hItem => Date.now() - (Number(hItem.finishedAt) || 0) < 1800000,
                    );
                    const curIdleMode = !curBusy && !(curRecent.length > 0 && curRecent.length !== hudDismissedUntilCount);
                    if (curIdleMode) {
                        hudIdleExpanded = !hudIdleExpanded;
                    } else {
                        hudExpanded = !hudExpanded;
                        try { sessionStorage.setItem('xfpd_hud_expanded', hudExpanded ? '1' : '0'); } catch (e) {}
                    }
                    syncVisiblePostsAndHud(curSt);
                };

                hudEl.querySelector('#xfpd-q-head-bar').addEventListener('click', e => {
                    if (e.target.closest('button')) return;
                    toggleExpand();
                });
                hudEl.querySelector('#xfpd-q-dl-thread-btn').addEventListener('click', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const pInf = xfpdGetThreadPaginationInfo();
                    enqueueThreadPagesRange(1, pInf.totalPages);
                });
                hudEl.querySelector('#xfpd-q-dl-page-btn').addEventListener('click', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    enqueueAllPagePosts();
                });
                hudEl.querySelector('#xfpd-q-toggle-btn').addEventListener('click', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleExpand();
                });
                hudEl.querySelector('#xfpd-q-close-btn').addEventListener('click', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const curSt = xfpdReadQueueState();
                    const curBusy = xfpdIsQueueWorkerAlive(curSt) && !!(curSt.active || (curSt.queued && curSt.queued.length));
                    if (curBusy) {
                        xfpdSendQueueCommand('cancel_all', {});
                    } else {
                        const curRecent = (curSt.history || []).filter(
                            hItem => Date.now() - (Number(hItem.finishedAt) || 0) < 1800000,
                        );
                        if (curRecent.length > 0 && curRecent.length !== hudDismissedUntilCount) {
                            hudDismissedUntilCount = curRecent.length;
                            hudIdleExpanded = false;
                            syncVisiblePostsAndHud(curSt);
                        } else {
                            hudIdleDismissed = true;
                            try { sessionStorage.setItem('xfpd_hud_idle_dismissed', '1'); } catch (err) {}
                            hudEl.style.display = 'none';
                        }
                    }
                });

                hudEl.querySelector('#xfpd-q-body').addEventListener('click', async e => {
                    const retryPagesBtn = e.target.closest('[data-xfpd-retry-failed-pages]');
                    if (retryPagesBtn) {
                        e.preventDefault();
                        const summary = typeof xfpdGetThreadLedgerSummary === 'function' ? xfpdGetThreadLedgerSummary() : null;
                        if (summary && Array.isArray(summary.failedPages) && summary.failedPages.length) {
                            enqueueThreadPageList(summary.failedPages);
                        }
                        return;
                    }
                    const cancelThreadBtn = e.target.closest('[data-xfpd-cancel-thread]');
                    if (cancelThreadBtn) {
                        e.preventDefault();
                        xfpdSendQueueCommand('cancel_thread', { jobId: cancelThreadBtn.getAttribute('data-xfpd-cancel-thread') });
                        return;
                    }
                    const cancelBtn = e.target.closest('[data-xfpd-cancel-job]');
                    if (cancelBtn) {
                        e.preventDefault();
                        xfpdSendQueueCommand('cancel_job', { jobId: cancelBtn.getAttribute('data-xfpd-cancel-job') });
                        return;
                    }
                    const clearHistBtn = e.target.closest('[data-xfpd-clear-hist]');
                    if (clearHistBtn) {
                        e.preventDefault();
                        xfpdSendQueueCommand('clear_history', {});
                        hudDismissedUntilCount = 0;
                        hudIdleExpanded = false;
                        syncVisiblePostsAndHud(xfpdReadQueueState());
                        return;
                    }
                    const copyErrBtn = e.target.closest('[data-xfpd-copy-err]');
                    if (copyErrBtn) {
                        e.preventDefault();
                        const jId = copyErrBtn.getAttribute('data-xfpd-copy-err');
                        const curSt = xfpdReadQueueState();
                        const hMatch = (curSt.history || []).find(x => x.jobId === jId);
                        if (hMatch && hMatch.errorLog) {
                            const ok = await copyTextToClipboard(hMatch.errorLog);
                            copyErrBtn.textContent = ok ? 'Copied!' : 'Failed';
                            setTimeout(() => {
                                if (copyErrBtn.isConnected) copyErrBtn.textContent = 'Copy Log';
                            }, 1500);
                        }
                    }
                });
            }

            hudEl.style.display = 'block';
            const titleEl = hudEl.querySelector('#xfpd-q-title-txt');
            const dlThreadHudBtn = hudEl.querySelector('#xfpd-q-dl-thread-btn');
            const dlPageHudBtn = hudEl.querySelector('#xfpd-q-dl-page-btn');
            const toggleBtn = hudEl.querySelector('#xfpd-q-toggle-btn');
            const topFill = hudEl.querySelector('#xfpd-q-top-fill');
            const bodyEl = hudEl.querySelector('#xfpd-q-body');

            if (dlThreadHudBtn) {
                if (pagInfo.totalPages > 1) {
                    dlThreadHudBtn.style.display = '';
                    dlThreadHudBtn.textContent = `📚 Thread (${pagInfo.totalPages}p)`;
                } else {
                    dlThreadHudBtn.style.display = 'none';
                }
            }
            if (dlPageHudBtn) {
                const pageDlPosts = parsedPosts.filter(isPostDownloadableOrLocked);
                if (pageDlPosts.length > 0) {
                    dlPageHudBtn.style.display = '';
                    dlPageHudBtn.textContent = `⬇ Page (${pageDlPosts.length})`;
                } else {
                    dlPageHudBtn.style.display = 'none';
                }
            }

            const effectiveExpanded = isIdlePillMode ? hudIdleExpanded : hudExpanded;
            hudEl.classList.toggle('xfpd-q-pill', isIdlePillMode && !hudIdleExpanded);

            const recentDone = recentHistory.filter(hItem => hItem.status !== 'cancelled').length;
            const doneCount = Math.max(recentDone, (st.stats && st.stats.postsDone) || 0);
            const totalPostsInWave = doneCount + (active ? 1 : 0) + queued.length + pendingEnqueues;

            if (active) {
                const pct = active.totalPct || 0;
                titleEl.style.color = '#3DB7C7';
                if (active.threadCrawl) {
                    const tc = active.threadCrawl;
                    const postTag = active.phase === 'scanning_page' ? 'scanning' : `#${active.postNumber}`;
                    titleEl.textContent = `📚 Thread P.${tc.currentPage}/${tc.endPage} · ${postTag} · ${pct}%`;
                } else {
                    const curPostIdx = doneCount + 1;
                    titleEl.textContent = `📥 Downloading (${curPostIdx}/${totalPostsInWave} posts) · ${pct}%`;
                }
                topFill.style.background = '#3DB7C7';
                topFill.style.width = `${pct}%`;
            } else if (queued.length > 0 || pendingEnqueues > 0) {
                const waitTotal = queued.length + pendingEnqueues;
                titleEl.style.color = '#3DB7C7';
                titleEl.textContent = `⏳ Starting Queue (${waitTotal} pending)...`;
                topFill.style.background = '#3DB7C7';
                topFill.style.width = '5%';
            } else if (hasUnclosedHistory) {
                titleEl.style.color = '#47ba24';
                titleEl.textContent = `✓ Queue Finished (${doneCount} ${doneCount === 1 ? 'post' : 'posts'})`;
                topFill.style.background = '#47ba24';
                topFill.style.width = '100%';
            } else {
                titleEl.style.color = '#3DB7C7';
                titleEl.textContent = workerAlive ? '📥 Queue · Standby ●' : '📥 Queue · Ready';
                topFill.style.background = '#3DB7C7';
                topFill.style.width = '0%';
            }

            toggleBtn.textContent = effectiveExpanded ? '▼' : '▲';
            bodyEl.style.display = effectiveExpanded ? 'block' : 'none';

            if (!effectiveExpanded) return;

            const ledgerSummary =
                typeof xfpdGetThreadLedgerSummary === 'function'
                    ? xfpdGetThreadLedgerSummary(curThreadKey)
                    : { postCount: 0, savedPosts: 0, scannedPages: [], failedPages: [] };

            const parts = [];
            if (isIdlePillMode) {
                parts.push(`
                  <div class="xfpd-q-empty">
                    Queue is ready (v${escapeHudHtml(xfpdVersion)}).${
                        ledgerSummary.savedPosts > 0
                            ? `<br/><span style="color:#47ba24;font-weight:600;">✓ This thread: ${ledgerSummary.savedPosts} posts saved${
                                  ledgerSummary.scannedPages.length ? ` · ${ledgerSummary.scannedPages.length} pages scanned` : ''
                              }</span>`
                            : ' Click <b>Download</b> on any post, <b>⬇ Page</b>, or <b>📚 Thread</b>.'
                    }
                  </div>
                `);
            }
            if (ledgerSummary.failedPages.length > 0) {
                parts.push(`
                  <div class="xfpd-q-item" style="border:1px solid rgba(232,168,56,.45);background:rgba(232,168,56,.12);margin-bottom:6px;">
                    <span class="xfpd-q-item-txt" style="color:#ffca6b;">⚠ Skipped pages: ${escapeHudHtml(ledgerSummary.failedPages.join(', '))}</span>
                    <button type="button" class="xfpd-q-btn xfpd-q-btn-accent" data-xfpd-retry-failed-pages="1">🔄 Retry</button>
                  </div>
                `);
            }
            if (active) {
                const tc = active.threadCrawl;
                const activeHeading = tc
                    ? `📚 ${escapeHudHtml(h.limit(active.threadTitle || 'Thread', 18))} · P.${tc.currentPage}/${tc.endPage}${active.postId ? ` · #${escapeHudHtml(active.postNumber)}` : ''}`
                    : `▶ ${escapeHudHtml(h.limit(active.threadTitle || 'Thread', 24))} · #${escapeHudHtml(active.postNumber)}`;
                const activeBtns = tc
                    ? `<span class="xfpd-q-ctrls">
                         ${active.postId ? `<button type="button" class="xfpd-q-btn" data-xfpd-cancel-job="${escapeHudHtml(active.jobId)}" title="Skip only this post">Skip</button>` : ''}
                         <button type="button" class="xfpd-q-btn xfpd-q-btn-danger" data-xfpd-cancel-thread="${escapeHudHtml(tc.jobId)}" title="Stop entire thread download">Stop Thread</button>
                       </span>`
                    : `<button type="button" class="xfpd-q-btn xfpd-q-btn-danger" data-xfpd-cancel-job="${escapeHudHtml(active.jobId)}">Cancel</button>`;
                parts.push(`
                  <div class="xfpd-q-active">
                    <div class="xfpd-q-active-top">
                      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${activeHeading}</span>
                      ${activeBtns}
                    </div>
                    <div class="xfpd-q-sub">${escapeHudHtml(active.statusText || active.phase || 'Working...')}</div>
                    <div class="xfpd-q-pbar"><div style="width:${active.filePct || 0}%;background:#3DB7C7;"></div></div>
                    <div class="xfpd-q-pbar"><div style="width:${active.totalPct || 0}%;background:#47ba24;"></div></div>
                  </div>
                `);
            }

            if (queued.length > 0) {
                const rows = queued
                    .map(q => {
                        if (q.isThreadCrawl) {
                            return `
                      <div class="xfpd-q-item">
                        <span class="xfpd-q-item-txt">📚 ${escapeHudHtml(h.limit(q.threadTitle || 'Thread', 20))} · Pages ${q.startPage}–${q.endPage} (${q.pageCount}p)</span>
                        <button type="button" class="xfpd-q-btn xfpd-q-btn-danger" data-xfpd-cancel-thread="${escapeHudHtml(q.jobId)}" title="Remove thread crawl">✕</button>
                      </div>
                    `;
                        }
                        return `
                      <div class="xfpd-q-item">
                        <span class="xfpd-q-item-txt">• ${escapeHudHtml(h.limit(q.threadTitle || 'Thread', 22))} · #${escapeHudHtml(q.postNumber)} (${q.hasLock && !q.resourceCount ? '🔒' : q.resourceCount})</span>
                        <button type="button" class="xfpd-q-btn xfpd-q-btn-danger" data-xfpd-cancel-job="${escapeHudHtml(q.jobId)}" title="Remove from queue">✕</button>
                      </div>
                    `;
                    })
                    .join('');
                parts.push(`
                  <div class="xfpd-q-sec-lbl"><span>⏳ In Queue (${queued.length})</span></div>
                  <div class="xfpd-q-list">${rows}</div>
                `);
            }

            if (recentHistory.length > 0 || (st.stats && st.stats.postsDone > 0)) {
                const useCum = st.stats && st.stats.postsDone >= doneCount;
                const dispDone = useCum ? st.stats.postsDone : doneCount;
                const totalSavedFiles = useCum
                    ? st.stats.filesSaved
                    : recentHistory.reduce((a, x) => a + (Number(x.succeeded) || 0), 0);
                const totalDupes = useCum
                    ? st.stats.filesDeduped
                    : recentHistory.reduce((a, x) => a + (Number(x.deduped) || 0), 0);
                const totalDead = useCum
                    ? st.stats.filesFailed
                    : recentHistory.reduce((a, x) => a + (Number(x.failed) || 0), 0);
                const lastFailed = recentHistory.find(x => x.failed > 0 && x.errorLog);
                parts.push(`
                  <div class="xfpd-q-foot">
                    <span>✓ ${dispDone} posts · ${totalSavedFiles} saved${totalDupes > 0 ? ` · ${totalDupes} dupes` : ''}${
                        totalDead > 0 ? ` · <b style="color:#ff7b7b;">✕ ${totalDead} dead</b>` : ''
                    }</span>
                    <span>
                      ${lastFailed ? `<button type="button" class="xfpd-q-btn" data-xfpd-copy-err="${escapeHudHtml(lastFailed.jobId)}">Copy Log</button>` : ''}
                      ${!isBusy ? `<button type="button" class="xfpd-q-btn" data-xfpd-clear-hist="1">Clear</button>` : ''}
                    </span>
                  </div>
                `);
            }

            bodyEl.innerHTML = parts.join('');
        };

        xfpdOnQueueStateChange(st => {
            syncVisiblePostsAndHud(st);
            updateDownloadPageButtonLabel();
            updateDownloadThreadButtonLabel();
        });
        setInterval(() => {
            syncVisiblePostsAndHud(xfpdReadQueueState());
            updateDownloadThreadButtonLabel();
        }, 700);

        const enqueueAllPagePosts = () => {
            const allOnPage = parsedPosts.filter(isPostDownloadableOrLocked);
            if (!allOnPage.length) return;
            const notYetDone = allOnPage.filter(
                entry => !entry.btnDownloadPost || entry.btnDownloadPost.dataset.xfpdState !== 'done',
            );
            const targetList = notYetDone.length > 0 ? notYetDone : allOnPage;
            enqueuePostsToBackgroundWorker(targetList);
            updateDownloadPageButtonLabel();
        };

        const runDownloadPageQueue = async () => {
            const checkedQueue = selectedPosts.filter(s => s.enabled && s.post).map(s => s.post);
            if (downloadPageTippy && typeof downloadPageTippy.hide === 'function') {
                downloadPageTippy.hide();
            }

            if (checkedQueue.length > 0) {
                enqueuePostsToBackgroundWorker(checkedQueue);
                selectedPosts.forEach(s => {
                    s.enabled = false;
                });
            } else {
                enqueueAllPagePosts();
            }

            updateDownloadPageButtonLabel();
            if (downloadPageTippy && downloadPageTippy.popper) {
                setupDownloadPageForm(downloadPageTippy);
            }
        };

        xfpdOnUserPrefsChange((prefs, changedKeys, source) => {
            const keys = Array.isArray(changedKeys) && changedKeys.length ? changedKeys : XFPD_USER_PREF_KEYS;
            keys.forEach(k => {
                pageSettings[k] = prefs[k];
            });
            if (prefs.preSkipDownload) {
                pageSettings.preSkipDownload = { ...prefs.preSkipDownload };
            }
            if (downloadPageTippy && downloadPageTippy.popper) {
                ui.forms.config.syncSettingsInputs(downloadPageTippy.popper, 'page-settings', pageSettings);
            }

            const incCommentsChanged = keys.includes('includeComments');
            parsedPosts.forEach(p => {
                const ps = p.getSettingsCB();
                if (!ps) return;
                keys.forEach(k => {
                    if (source === 'page') {
                        ps[k] = prefs[k];
                        if (ps._overridden) ps._overridden.delete(k);
                    } else if (!ps._overridden || !ps._overridden.has(k)) {
                        ps[k] = prefs[k];
                    }
                });
                if (prefs.preSkipDownload && (source === 'page' || !ps._overridden || !ps._overridden.has('skipDownload'))) {
                    ps.preSkipDownload = { ...prefs.preSkipDownload };
                }
                if (incCommentsChanged && typeof p.recomputeHostsForSettings === 'function') {
                    p.recomputeHostsForSettings();
                } else if (p.tippyInstance && p.tippyInstance.popper) {
                    ui.forms.config.syncSettingsInputs(p.tippyInstance.popper, `settings-${p.parsedPost.postId}`, ps);
                }
            });
            if (incCommentsChanged) {
                syncDownloadPageUI();
            }
        });

        const buildDownloadPageFormHtml = () => {
            const color = ui.getTooltipBackgroundColor();
            const threadTitle = parsers.thread.parseTitle();
            const downloadablePosts = parsedPosts.filter(isPostDownloadableOrLocked);

            let postsHtml = '';
            downloadablePosts.forEach(post => {
                const { postId, postNumber, textContent, hasLockedContent } = post.parsedPost;
                let selected = selectedPosts.find(s => s.post.parsedPost.postId === postId);
                if (!selected) {
                    selected = { post, enabled: false };
                    selectedPosts.push(selected);
                } else {
                    selected.post = post;
                }

                const resCount = getPostEnabledResourceCount(post);
                const badgeText =
                    resCount === 0 && hasLockedContent
                        ? '🔒'
                        : hasLockedContent
                          ? `${resCount} + 🔒`
                          : `${resCount}`;
                const defaultPostContent = (textContent || '').trim().replace('​', '');
                const ellipsedText = h.limit(defaultPostContent === '' ? threadTitle : defaultPostContent, 18);
                const summary = `<a id="post-content-${postId}" href="#post-${postId}" style="color: #3DB7C7"> ${ellipsedText} </a>`;
                postsHtml += ui.forms.createCheckbox(
                    `config-download-post-${postId}`,
                    `Post #${postNumber} <span style="opacity:0.75;font-size:11.5px;">(${badgeText})</span> ${summary}`,
                    !!selected.enabled,
                );
            });

            const allSelected =
                downloadablePosts.length > 0 &&
                downloadablePosts.every(p => {
                    const s = selectedPosts.find(item => item.post.parsedPost.postId === p.parsedPost.postId);
                    return !!(s && s.enabled);
                });

            const pag = xfpdGetThreadPaginationInfo();
            const ledger =
                typeof xfpdGetThreadLedgerSummary === 'function'
                    ? xfpdGetThreadLedgerSummary()
                    : { postCount: 0, savedPosts: 0, scannedPages: [], failedPages: [] };
            const ledgerBadgeHtml =
                ledger.savedPosts > 0 || ledger.failedPages.length > 0
                    ? `<div style="font-size:11.5px;color:#a5b1bd;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;gap:6px;">
                         <span>✓ Saved in thread: <b style="color:#47ba24;">${ledger.savedPosts} posts</b>${
                             ledger.scannedPages.length ? ` (${ledger.scannedPages.length}/${pag.totalPages}p scanned)` : ''
                         }</span>
                         ${
                             ledger.failedPages.length > 0
                                 ? `<button type="button" id="xfpd-retry-failed-pages-btn" class="xfpd-mini-btn" style="border-color:#e8a838;color:#ffca6b;" title="Retry pages: ${ledger.failedPages.join(', ')}">🔄 Retry ${ledger.failedPages.length} Failed Page(s)</button>`
                                 : ''
                         }
                       </div>`
                    : '';
            const threadRangeHtml =
                pag.totalPages > 1
                    ? ui.forms.createRow(`
                        <div class="xfpd-thread-range-box">
                          <div class="xfpd-thread-range-row">
                            <span style="font-weight:700;color:#3DB7C7;">📚 Entire Thread (${pag.totalPages} pages)</span>
                            ${
                                pag.currentPage > 1
                                    ? `<button type="button" id="xfpd-range-from-cur" class="xfpd-mini-btn" title="Set range from current page (${pag.currentPage}) to last page (${pag.totalPages})">P.${pag.currentPage}→${pag.totalPages}</button>`
                                    : ''
                            }
                          </div>
                          ${ledgerBadgeHtml}
                          <div class="xfpd-thread-range-row">
                            <span>Pages:</span>
                            <span style="display:inline-flex;align-items:center;gap:5px;">
                              <input type="number" id="xfpd-thread-start-page" class="xfpd-page-num-input" min="1" max="${pag.totalPages}" value="1" />
                              <span>to</span>
                              <input type="number" id="xfpd-thread-end-page" class="xfpd-page-num-input" min="1" max="${pag.totalPages}" value="${pag.totalPages}" />
                            </span>
                          </div>
                          <button type="button" id="xfpd-start-thread-download" class="xfpd-thread-btn">📚 Download Thread Pages (1–${pag.totalPages})</button>
                        </div>
                      `)
                    : '';

            const settingsHtml = ui.forms.config.createSettingsCheckboxesHtml('page-settings', pageSettings);
            const postSelectionHtml = [
                threadRangeHtml,
                ui.forms.createRow(
                    `<div data-xfpd-post-selection-heading="1" style="font-weight: bold; margin-top:5px; margin-bottom: 8px; color: #3DB7C7;">Current Page Posts (${downloadablePosts.length})</div>`,
                ),
                ui.forms.createCheckbox('config-toggle-all-posts', settings.ui.checkboxes.toggleAllCheckboxLabel, allSelected),
                `<div id="downloader-page-posts-list" style="max-height: 240px; overflow-y: auto; overflow-x: hidden;">${postsHtml}</div>`,
                ui.forms.createRow('<button type="button" id="xfpd-start-page-download" class="xfpd-action-btn" disabled>Select posts above (0 selected)</button>'),
            ].join('');

            return ui.forms.config.page.createForm(color, `${settingsHtml}${postSelectionHtml}`);
        };

        const setupDownloadPageForm = instance => {
            const root = instance && instance.popper ? instance.popper : document;
            const formEl = root.querySelector('#downloader-page-config-form');
            if (!formEl) return;

            ui.forms.config.syncSettingsInputs(formEl, 'page-settings', pageSettings);
            ui.forms.config.bindSettingsInputs(formEl, 'page-settings', pageSettings, (patch, changedKeys) => {
                if (typeof xfpdSaveUserPrefs === 'function') {
                    xfpdSaveUserPrefs(patch, 'page', changedKeys);
                }
            });

            if (formEl.dataset.xfpdSubmitBound !== '1') {
                formEl.dataset.xfpdSubmitBound = '1';
                formEl.addEventListener('submit', e => {
                    e.preventDefault();
                    if (instance && typeof instance.hide === 'function') {
                        instance.hide();
                    }
                });
            }

            const retryFailedFormBtn = formEl.querySelector('#xfpd-retry-failed-pages-btn');
            if (retryFailedFormBtn && retryFailedFormBtn.dataset.xfpdBound !== '1') {
                retryFailedFormBtn.dataset.xfpdBound = '1';
                retryFailedFormBtn.addEventListener('click', e => {
                    e.preventDefault();
                    const curLed = typeof xfpdGetThreadLedgerSummary === 'function' ? xfpdGetThreadLedgerSummary() : null;
                    if (curLed && Array.isArray(curLed.failedPages) && curLed.failedPages.length) {
                        if (instance && typeof instance.hide === 'function') instance.hide();
                        enqueueThreadPageList(curLed.failedPages);
                    }
                });
            }

            const startThreadBtn = formEl.querySelector('#xfpd-start-thread-download');
            const startPageInp = formEl.querySelector('#xfpd-thread-start-page');
            const endPageInp = formEl.querySelector('#xfpd-thread-end-page');
            const fromCurBtn = formEl.querySelector('#xfpd-range-from-cur');

            const syncThreadBtnLabel = () => {
                if (!startThreadBtn || !startPageInp || !endPageInp) return;
                const pagNow = xfpdGetThreadPaginationInfo();
                const sVal = Math.max(1, Math.min(pagNow.totalPages, parseInt(startPageInp.value, 10) || 1));
                const eVal = Math.max(sVal, Math.min(pagNow.totalPages, parseInt(endPageInp.value, 10) || pagNow.totalPages));
                const count = eVal - sVal + 1;
                startThreadBtn.textContent = `📚 Download Thread Pages (${sVal}–${eVal} · ${count}p)`;
            };

            if (startPageInp && startPageInp.dataset.xfpdBound !== '1') {
                startPageInp.dataset.xfpdBound = '1';
                startPageInp.addEventListener('input', syncThreadBtnLabel);
            }
            if (endPageInp && endPageInp.dataset.xfpdBound !== '1') {
                endPageInp.dataset.xfpdBound = '1';
                endPageInp.addEventListener('input', syncThreadBtnLabel);
            }
            if (fromCurBtn && fromCurBtn.dataset.xfpdBound !== '1') {
                fromCurBtn.dataset.xfpdBound = '1';
                fromCurBtn.addEventListener('click', e => {
                    e.preventDefault();
                    const pagNow = xfpdGetThreadPaginationInfo();
                    if (startPageInp) startPageInp.value = String(pagNow.currentPage);
                    if (endPageInp) endPageInp.value = String(pagNow.totalPages);
                    syncThreadBtnLabel();
                });
            }
            if (startThreadBtn && startThreadBtn.dataset.xfpdBound !== '1') {
                startThreadBtn.dataset.xfpdBound = '1';
                startThreadBtn.addEventListener('click', e => {
                    e.preventDefault();
                    const pagNow = xfpdGetThreadPaginationInfo();
                    const sVal = startPageInp ? parseInt(startPageInp.value, 10) || 1 : 1;
                    const eVal = endPageInp ? parseInt(endPageInp.value, 10) || pagNow.totalPages : pagNow.totalPages;
                    if (instance && typeof instance.hide === 'function') {
                        instance.hide();
                    }
                    enqueueThreadPagesRange(sVal, eVal);
                });
            }

            const startPageBtn = formEl.querySelector('#xfpd-start-page-download');
            if (startPageBtn && startPageBtn.dataset.xfpdBound !== '1') {
                startPageBtn.dataset.xfpdBound = '1';
                startPageBtn.addEventListener('click', e => {
                    e.preventDefault();
                    runDownloadPageQueue();
                });
            }

            const downloadableNow = parsedPosts.filter(isPostDownloadableOrLocked);

            downloadableNow.forEach(post => {
                const { postId, contentContainer } = post.parsedPost;
                const linkEl = formEl.querySelector(`#post-content-${postId}`);
                if (linkEl && linkEl.dataset.xfpdTipBound !== '1') {
                    linkEl.dataset.xfpdTipBound = '1';
                    ui.tooltip(
                        linkEl,
                        `<div style="overflow-y: auto; background: #242323; padding: 16px; width: 500px; max-height: 500px">
                          ${contentContainer.innerHTML}
                         </div>`,
                        { placement: 'right', offset: [10, 15] },
                    );
                }

                const selected = selectedPosts.find(s => s.post.parsedPost.postId === postId);
                const postCheckbox = formEl.querySelector(`#config-download-post-${postId}`);
                if (postCheckbox) {
                    postCheckbox.checked = !!(selected && selected.enabled);
                    if (postCheckbox.dataset.xfpdBound !== '1') {
                        postCheckbox.dataset.xfpdBound = '1';
                        postCheckbox.addEventListener('change', e => {
                            const selectedPost = selectedPosts.find(s => s.post.parsedPost.postId === postId);
                            if (selectedPost) selectedPost.enabled = e.target.checked;

                            const currentDownloadable = parsedPosts.filter(isPostDownloadableOrLocked);
                            const checkAllCB = formEl.querySelector('#config-toggle-all-posts');
                            if (checkAllCB) {
                                const enabledCount = currentDownloadable.filter(p => {
                                    const sp = selectedPosts.find(s => s.post.parsedPost.postId === p.parsedPost.postId);
                                    return !!(sp && sp.enabled);
                                }).length;
                                checkAllCB.checked = currentDownloadable.length > 0 && enabledCount === currentDownloadable.length;
                            }
                            updateDownloadPageButtonLabel();
                            updatePageFormActionBtn(formEl);
                        });
                    }
                }
            });

            const toggleAllEl = formEl.querySelector('#config-toggle-all-posts');
            if (toggleAllEl) {
                const enabledCount = downloadableNow.filter(p => {
                    const sp = selectedPosts.find(s => s.post.parsedPost.postId === p.parsedPost.postId);
                    return !!(sp && sp.enabled);
                }).length;
                toggleAllEl.checked = downloadableNow.length > 0 && enabledCount === downloadableNow.length;

                if (toggleAllEl.dataset.xfpdBound !== '1') {
                    toggleAllEl.dataset.xfpdBound = '1';
                    toggleAllEl.addEventListener('change', async e => {
                        e.preventDefault();

                        const checked = e.target.checked;
                        const postCheckboxes = parsedPosts
                            .filter(isPostDownloadableOrLocked)
                            .map(p => formEl.querySelector(`#config-download-post-${p.parsedPost.postId}`))
                            .filter(Boolean);

                        const checkedPostCheckboxes = postCheckboxes.filter(el => el.checked);
                        const unCheckedPostCheckboxes = postCheckboxes.filter(el => !el.checked);

                        if (checked) {
                            unCheckedPostCheckboxes.forEach(c => c.click());
                        } else {
                            checkedPostCheckboxes.forEach(c => c.click());
                        }
                        updateDownloadPageButtonLabel();
                        updatePageFormActionBtn(formEl);
                    });
                }
            }

            updatePageFormActionBtn(formEl);
        };

        const updateDownloadThreadButtonLabel = () => {
            const btn = h.element('#download-thread');
            if (!btn) return;
            const span = btn.querySelector('.download-thread-btn') || btn;
            const pag = xfpdGetThreadPaginationInfo();
            if (pag.totalPages <= 1) {
                btn.style.display = 'none';
                return;
            }
            btn.style.display = '';
            const st = xfpdReadQueueState();
            const curKey = xfpdGetCurrentThreadKey();
            const alive = xfpdIsQueueWorkerAlive(st);
            const activeTc =
                alive && st.active && st.active.threadCrawl && (!st.active.threadKey || st.active.threadKey === curKey)
                    ? st.active.threadCrawl
                    : null;
            const queuedTc =
                alive && Array.isArray(st.queued)
                    ? st.queued.find(q => q && q.isThreadCrawl && (!q.threadKey || q.threadKey === curKey))
                    : null;

            if (activeTc) {
                btn.style.color = '#e8a838';
                span.textContent = `✕ Stop Thread (P.${activeTc.currentPage}/${activeTc.endPage})`;
            } else if (queuedTc) {
                btn.style.color = '#3DB7C7';
                span.textContent = `⏳ Thread Queued (${queuedTc.startPage}–${queuedTc.endPage}) · ✕`;
            } else {
                btn.style.color = '#3DB7C7';
                span.textContent = `📚 Download Thread (${pag.totalPages} pages)`;
            }
        };

        const syncDownloadPageUI = () => {
            const downloadablePosts = parsedPosts.filter(isPostDownloadableOrLocked);
            const pag = xfpdGetThreadPaginationInfo();
            if (!downloadablePosts.length && pag.totalPages <= 1) return;

            const btnDownloadPage = addDownloadPageButton();
            if (!btnDownloadPage) return;

            if (pag.totalPages > 1) {
                const btnDownloadThread = addDownloadThreadButton();
                if (btnDownloadThread && btnDownloadThread.dataset.xfpdClickBound !== '1') {
                    btnDownloadThread.dataset.xfpdClickBound = '1';
                    btnDownloadThread.addEventListener('click', e => {
                        e.preventDefault();
                        const st = xfpdReadQueueState();
                        const curKey = xfpdGetCurrentThreadKey();
                        const alive = xfpdIsQueueWorkerAlive(st);
                        const activeTc =
                            alive && st.active && st.active.threadCrawl && (!st.active.threadKey || st.active.threadKey === curKey)
                                ? st.active.threadCrawl
                                : null;
                        const queuedTc =
                            alive && Array.isArray(st.queued)
                                ? st.queued.find(q => q && q.isThreadCrawl && (!q.threadKey || q.threadKey === curKey))
                                : null;
                        if (activeTc) {
                            xfpdSendQueueCommand('cancel_thread', { jobId: activeTc.jobId });
                            return;
                        }
                        if (queuedTc) {
                            xfpdSendQueueCommand('cancel_thread', { jobId: queuedTc.jobId });
                            return;
                        }
                        const curPag = xfpdGetThreadPaginationInfo();
                        enqueueThreadPagesRange(1, curPag.totalPages);
                    });
                }
                updateDownloadThreadButtonLabel();
            }

            if (btnDownloadPage.dataset.xfpdClickBound !== '1') {
                btnDownloadPage.dataset.xfpdClickBound = '1';
                btnDownloadPage.addEventListener('click', e => {
                    e.preventDefault();
                    runDownloadPageQueue();
                });
            }

            const formContent = buildDownloadPageFormHtml();
            updateDownloadPageButtonLabel();

            if (downloadPageTippy && typeof downloadPageTippy.setContent === 'function') {
                downloadPageTippy.setContent(formContent);
                setupDownloadPageForm(downloadPageTippy);
                return;
            }

            downloadPageTippy = ui.tooltip(btnDownloadPage, formContent, {
                placement: 'bottom',
                interactive: true,
                onCreate: instance => setupDownloadPageForm(instance),
                onShow: instance => setupDownloadPageForm(instance),
                onMount: instance => setupDownloadPageForm(instance),
                onShown: instance => setupDownloadPageForm(instance),
            });
        };

        const expandCollapsedPostComments = async (postEntry, statusLabel) => {
            const { parsedPost } = postEntry;
            const { postId, postNumber } = parsedPost;
            const messageEl =
                parsedPost.messageEl ||
                document.querySelector(`#js-post-${postId}, [data-content="post-${postId}"]`) ||
                (parsedPost.post && parsedPost.post.closest && parsedPost.post.closest('article.message, .message--post, .js-post'));
            if (!messageEl) return false;

            let expandedAny = false;
            for (let pass = 0; pass < 10; pass++) {
                const loaders = xfpdFindCollapsedCommentLoaders(messageEl);
                if (!loaders.length) break;

                const loaderLink = loaders[0];
                const rawHref = loaderLink.getAttribute('href') || '';
                if (!rawHref) break;

                let fetchUrl = '';
                try {
                    const u = new URL(rawHref, location.origin);
                    u.searchParams.set('_xfWithData', '1');
                    u.searchParams.set('_xfResponseType', 'json');
                    fetchUrl = u.href;
                } catch (e) {
                    break;
                }

                if (statusLabel) {
                    h.ui.setElProps(statusLabel, { color: '#3DB7C7', fontWeight: 'bold' });
                    h.ui.setText(statusLabel, '💬 Expanding collapsed post comments...');
                    h.show(statusLabel);
                }

                const res = await xfpdSameOriginFetchText(fetchUrl, 'GET', null);
                // Remove or mark the loader row so we never re-fetch the same loader link in a loop.
                const loaderRow = loaderLink.closest('.js-commentLoader, .message-responseRow') || loaderLink;
                if (!res || !res.ok || !res.text) {
                    loaderLink.removeAttribute('href');
                    break;
                }

                let htmlChunk = '';
                try {
                    const parsedJson = JSON.parse(res.text);
                    htmlChunk = String((parsedJson && parsedJson.html && parsedJson.html.content) || '');
                } catch (e) {
                    htmlChunk = res.text;
                }

                if (htmlChunk && htmlChunk.trim()) {
                    const targetContainer =
                        (loaderRow && loaderRow.parentElement) ||
                        messageEl.querySelector('.js-replyNewMessageContainer, .message-responses, .uw_fcs_comment_section') ||
                        messageEl.nextElementSibling;
                    if (targetContainer) {
                        const tmp = document.createElement('div');
                        tmp.innerHTML = htmlChunk;
                        while (tmp.firstChild) {
                            if (loaderRow && loaderRow.parentElement === targetContainer) {
                                targetContainer.insertBefore(tmp.firstChild, loaderRow);
                            } else {
                                targetContainer.appendChild(tmp.firstChild);
                            }
                        }
                        expandedAny = true;
                    }
                }
                if (loaderRow && loaderRow !== messageEl) {
                    loaderRow.remove();
                } else {
                    loaderLink.remove();
                }
            }

            if (expandedAny) {
                log.post.info(postId, '::Expanded collapsed post comments::', postNumber);
                postEntry.refreshUnlockedDom();
                syncDownloadPageUI();
            } else {
                parsedPost.hasCollapsedComments = false;
            }
            return expandedAny;
        };

        const unlockPostViaReaction = async (postEntry, statusLabel) => {
            const { parsedPost } = postEntry;
            const { postId, postNumber } = parsedPost;
            if (xfpdUnlockAttemptedPosts.has(postId)) {
                return false;
            }
            xfpdUnlockAttemptedPosts.add(postId);

            const messageEl =
                parsedPost.messageEl ||
                document.querySelector(`#js-post-${postId}, [data-content="post-${postId}"]`) ||
                (parsedPost.post && parsedPost.post.closest && parsedPost.post.closest('article.message, .message--post, .js-post'));
            if (!messageEl) return false;

            const postSettings = postEntry.getSettingsCB ? postEntry.getSettingsCB() : {};
            const incComments = postSettings.includeComments !== false;

            const reactTargets = [];
            if (parsedPost.hasMainLockedContent) {
                const mainLink = xfpdFindPostNativeReactLink(messageEl);
                if (mainLink) reactTargets.push(mainLink);
            }
            if (incComments && parsedPost.hasCommentLockedContent) {
                const commentEls = xfpdCollectPostCommentElements(messageEl);
                for (const cEl of commentEls) {
                    const cClone = xfpdCleanContentFragmentClone(cEl.cloneNode(true));
                    if (xfpdDetectLockedReactionContent(cEl, cClone, true)) {
                        const cReactLink = xfpdFindNativeReactLinkInContainer(cEl, false);
                        if (cReactLink) reactTargets.push(cReactLink);
                    }
                }
            }
            if (!reactTargets.length) {
                const fallbackMain = xfpdFindPostNativeReactLink(messageEl);
                if (fallbackMain) reactTargets.push(fallbackMain);
            }
            if (!reactTargets.length) return false;

            if (statusLabel) {
                h.ui.setElProps(statusLabel, { color: '#3DB7C7', fontWeight: 'bold' });
                h.ui.setText(statusLabel, '🔓 Reacting to unlock hidden links...');
                h.show(statusLabel);
            }
            log.post.info(postId, '::Locked content detected -> reacting to unlock links::', postNumber);

            const csrfToken = xfpdGetXenForoCsrfToken();

            for (const reactLink of reactTargets) {
                const ownerBlock = reactLink.closest('.comment, .js-comment, article.message, .js-post') || messageEl;
                const alreadyReacted =
                    reactLink.classList.contains('has-reaction') ||
                    !!ownerBlock.querySelector(':scope > footer .has-reaction, .comment-actionBar .has-reaction');
                if (alreadyReacted) continue;

                const reactUrl = xfpdBuildPostReactUrl(reactLink.getAttribute('href') || '');
                let postedViaAjax = false;

                if (reactUrl && csrfToken) {
                    const bodyParams = new URLSearchParams({
                        _xfToken: csrfToken,
                        _xfRequestUri: `${location.pathname}${location.search || ''}`,
                        _xfWithData: '1',
                        _xfResponseType: 'json',
                    }).toString();
                    const res = await xfpdSameOriginFetchText(reactUrl, 'POST', bodyParams);
                    if (res && res.ok) {
                        postedViaAjax = true;
                        reactLink.classList.add('has-reaction');
                        reactLink.classList.remove('reaction--imageHidden');
                    }
                }

                if (!postedViaAjax) {
                    const href = reactLink.getAttribute('href') || '';
                    if (href && /(^|\.)simpcity\./i.test(location.hostname || '')) {
                        reactLink.setAttribute('href', href.replace('_id=1', '_id=33'));
                    }
                    reactLink.click();
                    reactLink.classList.add('has-reaction');
                    await h.delayedResolve(500);
                } else {
                    await h.delayedResolve(150);
                }
            }

            // Check if client-side XenForo/SMG JS already swapped the hidden block into visible links.
            let refreshed = postEntry.refreshUnlockedDom();

            // If still locked (e.g. server-rendered [HIDETHANKS]/[HIDEREACT] block), fetch the fresh page HTML
            // and update the post's .message-userContent (and comments) in-place!
            if (parsedPost.hasLockedContent || !postEntry.parsedHosts.length) {
                if (statusLabel) {
                    h.ui.setText(statusLabel, '🔓 Loading unlocked post links...');
                }
                const pageUrl = String(location.href || '').split('#')[0];
                const pageRes = await xfpdSameOriginFetchText(pageUrl, 'GET', null);
                if (pageRes && pageRes.ok && pageRes.text) {
                    try {
                        const doc = new DOMParser().parseFromString(pageRes.text, 'text/html');
                        const freshPostEl = doc.querySelector(`#js-post-${postId}, [data-content="post-${postId}"]`);
                        if (freshPostEl) {
                            const freshContent = freshPostEl.querySelector('.message-content > .message-userContent');
                            if (freshContent && parsedPost.contentContainer) {
                                parsedPost.contentContainer.innerHTML = freshContent.innerHTML;
                                if (postEntry.statusUI) {
                                    if (postEntry.statusUI.totalPB) parsedPost.contentContainer.prepend(postEntry.statusUI.totalPB);
                                    if (postEntry.statusUI.filePB) parsedPost.contentContainer.prepend(postEntry.statusUI.filePB);
                                    if (postEntry.statusUI.status) parsedPost.contentContainer.prepend(postEntry.statusUI.status);
                                }
                            }
                            const liveResponses = messageEl.querySelector('.message-responses, .uw_fcs_comment_section');
                            const freshResponses = freshPostEl.querySelector('.message-responses, .uw_fcs_comment_section');
                            if (liveResponses && freshResponses) {
                                liveResponses.innerHTML = freshResponses.innerHTML;
                            }
                            refreshed = postEntry.refreshUnlockedDom() || refreshed;
                        }
                    } catch (e) {}
                }
            }

            parsedPost.hasMainLockedContent = false;
            parsedPost.hasCommentLockedContent = false;
            parsedPost.hasLockedContent = false;
            postEntry.updateIdleButtonLabel();
            if (postEntry.tippyInstance && typeof postEntry.tippyInstance.__xfpdRebuildForm === 'function') {
                postEntry.tippyInstance.__xfpdRebuildForm();
            }
            syncDownloadPageUI();
            return refreshed;
        };

        const initPostElement = post => {
            if (!post || post.dataset?.xfpdInitialized === '1') return false;

            const parsedPost = parsers.thread.parsePost(post);
            if (!parsedPost) return false;

            const { postId, contentContainer } = parsedPost;

            addDuplicateTabLink(post);
            addShowDownloadPageBtnLink(post);

            const existingIdx = parsedPosts.findIndex(p => p.parsedPost.postId === postId);
            const postSettings = existingIdx > -1 ? parsedPosts[existingIdx].getSettingsCB() : xfpdCreatePostSettings();

            const selectEffectiveContent = () =>
                postSettings.includeComments !== false ? parsedPost.content : parsedPost.mainOnlyContent;

            const parsedHosts = parsers.hosts.parseHosts(selectEffectiveContent());
            const fullHostsCheck = parsedPost.commentsOnlyContent ? parsers.hosts.parseHosts(parsedPost.content) : parsedHosts;
            const getEnabledHostsCB = hostsList => hostsList.filter(host => host.enabled);

            if (!fullHostsCheck.length && !parsedPost.hasLockedContent && !parsedPost.hasCollapsedComments) {
                return false;
            }

            post.dataset.xfpdInitialized = '1';

            const getTotalDownloadableResourcesForPostCB = hostsList => {
                return hostsList.filter(host => host.enabled && host.resources.length).reduce((acc, host) => acc + host.resources.length, 0);
            };
            const getTotalResourcesCount = () => parsedHosts.reduce((acc, host) => acc + host.resources.length, 0);

            const hasActiveLock = () =>
                !!(
                    parsedPost.hasMainLockedContent ||
                    (postSettings.includeComments !== false && parsedPost.hasCommentLockedContent)
                );

            // Create and attach the download button to post.
            const { btn: btnDownloadPost } = ui.buttons.addDownloadPostButton(post);
            const updateIdleButtonLabel = () => {
                const totalRes = getTotalResourcesCount();
                const checkedLen = getTotalDownloadableResourcesForPostCB(parsedHosts);
                const isLockedNow = hasActiveLock();
                const hasMoreComments = postSettings.includeComments !== false && parsedPost.hasCollapsedComments;
                if (totalRes === 0 && isLockedNow) {
                    btnDownloadPost.style.color = '#3DB7C7';
                    btnDownloadPost.innerHTML = '🔓 Unlock & Download';
                } else if (totalRes === 0 && hasMoreComments) {
                    btnDownloadPost.style.color = '#3DB7C7';
                    btnDownloadPost.innerHTML = '💬 Load Comments & Download';
                } else {
                    const extraTags = `${isLockedNow ? ' + 🔒' : ''}${hasMoreComments ? ' + 💬' : ''}`;
                    btnDownloadPost.style.color = '';
                    btnDownloadPost.innerHTML = `🡳 Download (${checkedLen}/${totalRes}${extraTags})`;
                }
            };
            updateIdleButtonLabel();

            // Create download status / progress elements.
            const { el: statusText } = ui.labels.status.createStatusLabel();
            const filePBar = ui.pBars.createFileProgressBar();
            const totalPBar = ui.pBars.createTotalProgressBar();

            contentContainer.prepend(totalPBar);
            contentContainer.prepend(filePBar);
            contentContainer.prepend(statusText);

            h.hide(statusText);
            h.hide(filePBar);
            h.hide(totalPBar);

            const statusUI = {
                status: statusText,
                filePB: filePBar,
                totalPB: totalPBar,
            };

            const getSettingsCB = () => postSettings;

            const applyFreshHostsList = freshHosts => {
                const disabledNames = new Set(
                    parsedHosts.filter(hItem => !hItem.enabled).map(hItem => `${hItem.name}:${hItem.category}`),
                );
                freshHosts.forEach(hItem => {
                    if (disabledNames.has(`${hItem.name}:${hItem.category}`)) {
                        hItem.enabled = false;
                    }
                });
                const prevTotal = getTotalResourcesCount();
                parsedHosts.splice(0, parsedHosts.length, ...freshHosts);
                const newTotal = getTotalResourcesCount();
                if (btnDownloadPost.dataset.xfpdState !== 'running') {
                    updateIdleButtonLabel();
                }
                if (postEntry && postEntry.tippyInstance && typeof postEntry.tippyInstance.__xfpdRebuildForm === 'function') {
                    postEntry.tippyInstance.__xfpdRebuildForm();
                }
                return newTotal !== prevTotal;
            };

            const recomputeHostsForSettings = () => {
                parsedPost.hasLockedContent = hasActiveLock();
                const freshHosts = parsers.hosts.parseHosts(selectEffectiveContent());
                return applyFreshHostsList(freshHosts);
            };

            const refreshUnlockedDom = () => {
                const reParsed = parsers.thread.parsePost(post);
                if (!reParsed) return false;
                parsedPost.mainOnlyContent = reParsed.mainOnlyContent;
                parsedPost.commentsOnlyContent = reParsed.commentsOnlyContent;
                parsedPost.content = reParsed.content;
                parsedPost.textContent = reParsed.textContent;
                parsedPost.postCaption = reParsed.postCaption;
                parsedPost.spoilers = reParsed.spoilers;
                parsedPost.footer = reParsed.footer;
                parsedPost.hasMainLockedContent = reParsed.hasMainLockedContent;
                parsedPost.hasCommentLockedContent = reParsed.hasCommentLockedContent;
                parsedPost.hasCollapsedComments = reParsed.hasCollapsedComments;
                parsedPost.hasLockedContent = hasActiveLock();

                const changedCount = applyFreshHostsList(parsers.hosts.parseHosts(selectEffectiveContent()));
                return changedCount || !parsedPost.hasLockedContent;
            };

            const postDownloadCallbacks = {
                onProgress: ({ phase, completed: doneCount, total: totalCount }) => {
                    btnDownloadPost.dataset.xfpdState = 'running';
                    btnDownloadPost.style.color = '#e8a838';
                    if (phase === 'resolving') {
                        btnDownloadPost.innerHTML = `✕ Cancel (Resolving ${doneCount}/${totalCount})`;
                    } else {
                        btnDownloadPost.innerHTML = `✕ Cancel (${doneCount}/${totalCount})`;
                    }
                },
                onCancel: () => {
                    btnDownloadPost.dataset.xfpdState = 'idle';
                    updateIdleButtonLabel();
                },
                onComplete: (total, succeeded, failed = 0, deduped = 0) => {
                    btnDownloadPost.dataset.xfpdState = 'done';
                    if (postSettings.autoReactAfterDownload === true && (succeeded > 0 || (deduped > 0 && failed === 0))) {
                        registerPostReaction(parsedPost.footer);
                    }
                    if (total === 0 && deduped > 0) {
                        btnDownloadPost.style.color = '#47ba24';
                        btnDownloadPost.innerHTML = `✓ Deduplicated (${deduped})`;
                    } else if (postSettings.skipDownload && total > 0) {
                        btnDownloadPost.style.color = '#47ba24';
                        btnDownloadPost.innerHTML = `✓ Links Ready (${total})`;
                    } else if (total > 0 && succeeded >= total && failed === 0) {
                        btnDownloadPost.style.color = '#47ba24';
                        btnDownloadPost.innerHTML = `✓ Downloaded (${succeeded}/${total})`;
                    } else if (succeeded > 0) {
                        btnDownloadPost.style.color = '#e8a838';
                        btnDownloadPost.innerHTML = `⚠ Downloaded (${succeeded}/${total})`;
                    } else {
                        btnDownloadPost.style.color = '#d9534f';
                        const denom = total || getTotalDownloadableResourcesForPostCB(parsedHosts);
                        btnDownloadPost.innerHTML = `✕ Retry (0/${denom})`;
                    }
                },
            };

            const startPostDownload = () => {
                const curSt = xfpdReadQueueState();
                const curThreadKey = xfpdGetCurrentThreadKey();
                const workerAlive = xfpdIsQueueWorkerAlive(curSt);

                // If this post is currently active or queued in the background worker, clicking cancels it!
                if (workerAlive) {
                    const isAct =
                        curSt.active &&
                        curSt.active.postId === postId &&
                        (!curSt.active.threadKey || curSt.active.threadKey === curThreadKey);
                    const isQue = (curSt.queued || []).some(
                        q => q.postId === postId && (!q.threadKey || q.threadKey === curThreadKey),
                    );
                    if (isAct || isQue) {
                        xfpdSendQueueCommand('cancel_job', { threadKey: curThreadKey, postId });
                        return;
                    }
                }

                if (isPostProcessing(postId)) {
                    const ctrl = activePostControllers.get(postId);
                    if (ctrl) ctrl.cancel();
                    return;
                }

                enqueuePostsToBackgroundWorker([postEntry]);
            };

            const onFormSubmitCB = data => {
                const { tippyInstance, startDownload: shouldStart } = data || {};
                if (tippyInstance && typeof tippyInstance.hide === 'function') {
                    tippyInstance.hide();
                }
                if (shouldStart) {
                    startPostDownload();
                }
            };

            let postEntry = null;

            const postTippyInstance = ui.forms.config.post.createPostConfigForm(
                parsedPost,
                parsedHosts,
                `#${parsedPost.postNumber}.zip`,
                postSettings,
                onFormSubmitCB,
                getTotalDownloadableResourcesForPostCB,
                btnDownloadPost,
            );

            // Replace any stale entry if a post was re-rendered dynamically (e.g. XenSoluce [HIDEREACT] unlock on SMG).
            postEntry = {
                parsedPost,
                parsedHosts,
                enabledHostsCB: getEnabledHostsCB,
                resolvers,
                getSettingsCB,
                statusUI,
                postDownloadCallbacks,
                startPostDownload,
                refreshUnlockedDom,
                recomputeHostsForSettings,
                updateIdleButtonLabel,
                btnDownloadPost,
                tippyInstance: postTippyInstance,
            };
            if (existingIdx > -1) {
                parsedPosts[existingIdx] = postEntry;
            } else {
                parsedPosts.push(postEntry);
            }

            btnDownloadPost.addEventListener('click', e => {
                e.preventDefault();
                startPostDownload();
            });

            return true;
        };

        const scanPosts = () => {
            if (typeof xfpdUnwrapLiveForumLinks === 'function') {
                xfpdUnwrapLiveForumLinks(document);
            }
            let changed = false;
            // Also refresh any already-initialized locked posts whose DOM was unlocked manually on the page.
            parsedPosts.forEach(entry => {
                if (entry.parsedPost && entry.parsedPost.hasLockedContent && !isPostProcessing(entry.parsedPost.postId)) {
                    try {
                        if (entry.refreshUnlockedDom && entry.refreshUnlockedDom()) {
                            changed = true;
                        }
                    } catch (e) {}
                }
            });
            h.elements('.message-attribution-opposite').forEach(post => {
                try {
                    if (initPostElement(post)) {
                        changed = true;
                    }
                } catch (e) {
                    console.error('[XFPD] Error initializing post:', e);
                }
            });
            if (changed || xfpdGetThreadPaginationInfo().totalPages > 1) {
                syncDownloadPageUI();
            }
        };

        scanPosts();
        syncVisiblePostsAndHud(xfpdReadQueueState());

        window.addEventListener(
            'load',
            () => {
                init.injectCustomStyles();
                scanPosts();
                syncVisiblePostsAndHud(xfpdReadQueueState());
            },
            { once: true },
        );

        // Watch for dynamically unlocked/inserted posts & comments (e.g. SMG [HIDEREACT]/[HIDETHANKS], Rocket Loader, or UW/FCS comment expansion).
        const observeRoot = h.element('.block--messages') || document.body || document.documentElement;
        if (typeof MutationObserver !== 'undefined' && observeRoot) {
            let rescanTimer = null;
            const observer = new MutationObserver(mutations => {
                let shouldScan = false;
                for (const m of mutations) {
                    if (m.type === 'attributes') {
                        const t = m.target;
                        if (t && t.classList && (t.classList.contains('bbCodeBlock--visible') || t.classList.contains('hidethanks'))) {
                            shouldScan = true;
                            break;
                        }
                        continue;
                    }
                    if (!m.addedNodes || !m.addedNodes.length) continue;
                    for (const node of m.addedNodes) {
                        if (node.nodeType !== 1) continue;
                        if (
                            (node.matches &&
                                node.matches('body, article.message, .js-post, .message-attribution-opposite, .bbCodeBlock--visible, .comment, .js-comment')) ||
                            (node.querySelector &&
                                node.querySelector('.message-attribution-opposite, .bbCodeBlock--visible, .comment, .js-comment')) ||
                            (node.closest && node.closest('.message-body, .message-userContent, .message-responses, .uw_fcs_comment_section'))
                        ) {
                            shouldScan = true;
                            break;
                        }
                    }
                    if (shouldScan) break;
                }
                if (shouldScan) {
                    if (rescanTimer) clearTimeout(rescanTimer);
                    rescanTimer = setTimeout(() => {
                        rescanTimer = null;
                        init.injectCustomStyles();
                        // Refresh existing posts when comments are added dynamically too!
                        let updatedExisting = false;
                        parsedPosts.forEach(entry => {
                            if (entry && !isPostProcessing(entry.parsedPost.postId) && typeof entry.refreshUnlockedDom === 'function') {
                                try {
                                    if (entry.refreshUnlockedDom()) updatedExisting = true;
                                } catch (e) {}
                            }
                        });
                        scanPosts();
                        if (updatedExisting) syncDownloadPageUI();
                        syncVisiblePostsAndHud(xfpdReadQueueState());
                    }, 80);
                }
            });
            observer.observe(observeRoot, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class'],
            });
        }
    });
})();
