const parsers = {
    thread: {
        /**
     * @returns {string}
     */
        parseTitle: () => {
            const emojisPattern =
                  /[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/gu;
            const titleEl = h.element('.p-title-value');
            let parsed = '';
            if (titleEl) {
                const clone = titleEl.cloneNode(true);
                clone.querySelectorAll('a, span').forEach(el => el.remove());
                parsed = (clone.textContent || '').replace(/\s+/g, ' ').trim();
            }
            if (!parsed) {
                parsed = (document.title || 'Thread').replace(/\s*\|\s*(?:Social Media Girls|SimpCity).*$/i, '').trim();
            }
            return !settings.naming.allowEmojis ? parsed.replace(emojisPattern, settings.naming.invalidCharSubstitute).trim() : parsed.trim();
        },
        /**
     *
     * @param post
     * @returns {{pageNumber: number, post, spoilers: *, footer: HTMLElement, contentContainer: Element, textContent: string, postId: string, postNumber: string, content: string}|null}
     */
        parsePost: post => {
            if (!post || (post.closest && post.closest('.comment, .js-comment, .uw_fcs_comment_section, .message-responses'))) {
                return null;
            }

            const messageEl = (post.closest && post.closest('article.message, .message--post, .js-post')) || post.parentNode?.parentNode;
            if (!messageEl) return null;

            const messageContent = messageEl.querySelector('.message-content > .message-userContent');
            if (!messageContent) return null;

            const footer = messageEl.querySelector('footer.message-footer, footer');
            const messageContentClone = messageContent.cloneNode(true);

            const postNumberCandidates = [...post.querySelectorAll('li > a[href*="/post-"], li > a[href*="/posts/"]')].filter(
                a => !a.classList.contains('message-attribution-gadget') && (a.textContent || '').trim() !== '',
            );
            const postIdAnchor =
                postNumberCandidates[postNumberCandidates.length - 1] ||
                [...post.querySelectorAll('li > a[href*="/post-"]')].pop() ||
                post.querySelector('li:last-of-type > a');

            const postHref = postIdAnchor?.getAttribute('href') || '';
            const dataContent = messageEl.getAttribute?.('data-content') || messageEl.id || '';
            const idMatch =
                /\/post-(\d+)/i.exec(postHref) ||
                /\/posts\/(\d+)/i.exec(postHref) ||
                /(?:^|-)post-(\d+)/i.exec(dataContent);

            if (!idMatch || !idMatch[1]) return null;

            const postId = idMatch[1];
            const rawNumber = (postIdAnchor?.textContent || '').replace('#', '').trim();
            const postNumber = rawNumber || postId;

            // Remove the following from the post content:
            // 1. Quotes.
            // 2. CodeBlock headers
            // 3. Spoiler button text from each spoiler
            // 4. Icons from un-furled urls and SMG per-target reaction overlays.
            ['.contentRow-figure', '.js-unfurl-favicon', '.smgTargetReactions', 'blockquote', '.button-text > span']
                .flatMap(i => [...messageContentClone.querySelectorAll(i)])
                .forEach(i => {
                if (i.tagName === 'BLOCKQUOTE') {
                    // Only remove blockquotes that quote the other posts.
                    if (i.querySelector('.bbCodeBlock-title')) {
                        i.remove();
                    }
                } else {
                    i.remove();
                }
            });

            // Remove internal forum thread/node links (SimpCity & SocialMediaGirls).
            [...messageContentClone.querySelectorAll('.contentRow-header > a[href]')]
                .filter(a => {
                    const href = a.getAttribute('href') || '';
                    return (
                        /^https?:\/\/(?:[\w-]+\.)?(?:simpcity\.[a-z]+|socialmediagirls\.com)\/(?:threads|forums|posts)\b/i.test(href) ||
                        /^\/(?:threads|forums|posts)\//i.test(href)
                    );
                })
                .map(a => a.closest('.bbCodeBlock--unfurl, .js-unfurl') || a.parentNode?.parentNode?.parentNode?.parentNode)
                .filter(Boolean)
                .forEach(i => i.remove());

            // Decode forum outbound link protection (e.g. /redirect/?to=...&m=b64 and SMG's /goto/link-confirmation?url=...)
            // BEFORE stripping preview images inside host links so decoded anchors are recognized by their real target host.
            try {
                const __decodeB64Url = (s) => {
                    if (!s) return null;
                    let b = String(s).trim().replace(/-/g, '+').replace(/_/g, '/');
                    while (b.length % 4) b += '=';
                    try {
                        const bin = atob(b);
                        try {
                            const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
                            return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
                        } catch (e2) {
                            return bin;
                        }
                    } catch (e) {
                        return null;
                    }
                };

                const __decodeForumRedirect = (href) => {
                    if (!href) return null;
                    try {
                        const u = new URL(href, location.origin);
                        const p = (u.pathname || '').toLowerCase();
                        const q = (u.search || '').toLowerCase();

                        const looksRedirect = p === '/redirect' || p === '/redirect/' || p.startsWith('/redirect/');
                        const looksLinkProxy = p.includes('link-proxy');
                        const looksGoto =
                            p.includes('/goto/link-confirmation') ||
                            q.includes('goto/link-confirmation') ||
                            (p.startsWith('/goto/') && !p.startsWith('/goto/post') && !p.startsWith('/goto/quoted'));
                        if (!looksRedirect && !looksLinkProxy && !looksGoto) return null;

                        const to = u.searchParams.get('to')
                                 || u.searchParams.get('url')
                                 || u.searchParams.get('u')
                                 || u.searchParams.get('link')
                                 || u.searchParams.get('target');
                        if (!to) return null;

                        const mode = (u.searchParams.get('m') || '').toLowerCase();
                        let decoded = null;

                        if (mode === 'b64' || mode === 'base64') {
                            decoded = __decodeB64Url(to);
                        }

                        // Some installs (including SMG /goto/link-confirmation) omit the mode flag even though `url` is base64.
                        if (!decoded) {
                            let rawTo = to;
                            try { rawTo = decodeURIComponent(rawTo); } catch (e) {}
                            const looksB64 = /^[A-Za-z0-9+/_-]+={0,2}$/.test(rawTo) && rawTo.length >= 16 && (rawTo.length % 4 !== 1);
                            if (looksB64) decoded = __decodeB64Url(rawTo);
                        }

                        if (!decoded) {
                            try { decoded = decodeURIComponent(to); } catch (e) { decoded = to; }
                        }

                        decoded = String(decoded || '').trim();

                        // Some protectors double-encode.
                        if (decoded && !/^https?:\/\//i.test(decoded) && /%3a%2f%2f/i.test(decoded)) {
                            try {
                                const d2 = decodeURIComponent(decoded);
                                if (/^https?:\/\//i.test(d2)) decoded = d2;
                            } catch (e) { /* ignore */ }
                        }

                        if (!/^https?:\/\//i.test(decoded)) return null;
                        return decoded;
                    } catch (e) {
                        return null;
                    }
                };

                const sel = [
                    'a[href*="/redirect/"]',
                    'a[href^="/redirect"]',
                    'a[href*="redirect?"]',
                    'a[href*="link-proxy"]',
                    'a[href*="/goto/"]',
                    'a[href*="goto/link-confirmation"]',
                    'a[data-href*="/goto/"]',
                ].join(', ');

                messageContentClone.querySelectorAll(sel).forEach((a) => {
                    // Some XenForo installs store the redirect/protected URL in different attrs.
                    const candidates = [
                        a.getAttribute('href'),
                        a.getAttribute('data-href'),
                        a.getAttribute('data-url'),
                    ].filter(Boolean);

                    for (const c of candidates) {
                        const decoded = __decodeForumRedirect(c);
                        if (decoded) {
                            a.setAttribute('data-url', decoded);
                            a.setAttribute('href', decoded);
                            a.setAttribute('data-xfpd-decoded', '1');
                            break;
                        }
                    }
                });

                // Prevent common thumbnail URLs inside decoded redirect links from being treated as direct downloads.
                // (Keeps the UI intact for non-thumb embeds, but avoids downloading *_t.jpg / thumbs.* previews.)
                try {
                    messageContentClone.querySelectorAll('a[data-xfpd-decoded="1"] img').forEach((img) => {
                        const u = (img.getAttribute('data-url') || img.getAttribute('data-src') || img.getAttribute('src') || '').trim();
                        if (!u) return;

                        let host = '';
                        let path = '';
                        try {
                            const uu = new URL(u, location.origin);
                            host = (uu.hostname || '').toLowerCase();
                            path = (uu.pathname || '').toLowerCase();
                        } catch (e) {
                            // ignore
                        }

                        const isThumb =
                            host.includes('thumb') ||
                            /_t\.(?:jpe?g|png|webp|gif)$/i.test(u) ||
                            /\/thumbs?\//i.test(path);

                        if (isThumb) img.remove();
                    });
                } catch (e) { /* ignore */ }
            } catch (e) { /* ignore */ }

            // Prevent duplicate detection: attachment links often wrap a preview image.
            // For parsing only, remove the preview <img> inside attachment links so we don't count/download it twice.
            try {
                messageContentClone.querySelectorAll('a[href*="/attachments/"] img').forEach((img) => img.remove());
            } catch (e) { /* ignore */ }

            // Goonbox links wrap a medium-res CDN thumbnail — suppress it so we call the API for the original instead.
            try {
                messageContentClone.querySelectorAll('a[href*="goonbox.cr"] img').forEach((img) => img.remove());
            } catch (e) { /* ignore */ }

            // ImagePond links (SocialMediaGirls default host) wrap either the full media.imagepond.net image or a /thumb/ preview.
            // Record full-res direct CDN hints + alt filenames, then remove the inner <img> so linked embeds aren't counted twice.
            try {
                messageContentClone
                    .querySelectorAll('a[href*="imagepond.net"], a[href*="images.socialmediagirls.com"]')
                    .forEach((a) => {
                        const rawHref = (a.getAttribute('href') || '').trim().split('#')[0].split('?')[0].replace(/\/$/, '');
                        const img = a.querySelector('img');
                        if (!img) return;

                        const imgUrl = (img.getAttribute('data-url') || img.getAttribute('data-src') || img.getAttribute('src') || '').trim();
                        const altName = (img.getAttribute('alt') || '').trim();

                        if (
                            rawHref &&
                            /^https?:\/\/media\.imagepond\.net\/media\//i.test(imgUrl) &&
                            !/(?:_thumb\.|\/thumb\/|\.th\.|\.md\.|android-chrome|placeholder)/i.test(imgUrl)
                        ) {
                            imagepondDirectByPageUrl.set(rawHref, imgUrl);
                            if (altName && /\.[A-Za-z0-9]{2,8}$/.test(altName) && !/^https?:\/\//i.test(altName)) {
                                imagepondNameByUrl.set(imgUrl, altName);
                                imagepondNameByUrl.set(rawHref, altName);
                            }
                        }

                        img.remove();
                    });
            } catch (e) { /* ignore */ }

            // Pixhost /show/ and PutMega /image/ links wrap a thumbnail <img> — remove the inner <img> to avoid double-counting.
            try {
                messageContentClone
                    .querySelectorAll('a[href*="pixhost."][href*="/show/"] img, a[href*="pixho.st/show/"] img, a[href*="putmega.com/image/"] img, a[href*="putme.ga/image/"] img')
                    .forEach((img) => img.remove());
            } catch (e) { /* ignore */ }

            // Extract spoilers from the post content.
            const spoilers = [...messageContentClone.querySelectorAll('.bbCodeBlock--spoiler > .bbCodeBlock-content')]
            .filter(s => !s.querySelector('.bbCodeBlock--unfurl'))
            .concat([...messageContentClone.querySelectorAll('.bbCodeInlineSpoiler')].filter(s => !s.querySelector('.bbCodeBlock--unfurl')))
            .map(s => s.innerText)
            .concat(
                h.re
                .matchAll(/(?<=pw|pass|passwd|password)(\s:|:)?\s+?[a-zA-Z0-9~!@#$%^&*()_+{}|:'"<>?\/,;.]+/gis, messageContentClone.innerText)
                .map(s => s.trim()),
            )
            .map(s =>
                 s
                 .trim()
                 .replace(/^:/, '')
                 .replace(/\bp:\b/i, '')
                 .replace(/\bpw:\b/i, '')
                 .replace(/\bkey:\b/i, '')
                 .trim(),
                )
            .filter(s => s !== '')
            .unique();

            const postContent = messageContentClone.innerHTML;
            const postTextContent = messageContentClone.innerText;

            const matches = /(?<=\/page-)\d+/is.exec(document.location.pathname);

            const pageNumber = matches && matches.length ? Number(matches[0]) : 1;

            return {
                post,
                postId,
                postNumber,
                pageNumber,
                spoilers,
                footer,
                content: postContent,
                textContent: postTextContent,
                contentContainer: messageContent,
            };
        },
    },
    hosts: (() => {
        let compiledHostsCache = null;
        let nextHostId = 1;

        const compileMatcher = matcher => {
            if (!matcher) return null;
            let patternStr = matcher.toString().replace(/~an@/g, 'a-zA-Z0-9');
            const stripQueryString = h.contains('<no_qs>', patternStr);
            const stripTrailingSlash = !h.contains('<keep_ts>', patternStr);
            patternStr = patternStr.replace('<no_qs>', '').replace('<keep_ts>', '');

            let regex;
            if (h.contains('!!', patternStr)) {
                patternStr = patternStr.replace('!!', '');
                regex = h.re.toRegExp(h.re.toString(patternStr), 'igs');
            } else {
                const rawInner = h.re.toString(patternStr);
                const pat = `(?<=data-url="|data-src="|src="|href=")${rawInner}.*?(?=")|https?:\\/\\/(www\\.)?${rawInner}.*?(?=("|<|$|\\]|'))`;
                regex = h.re.toRegExp(pat, 'igs');
            }

            return { regex, stripQueryString, stripTrailingSlash };
        };

        const getCompiledHosts = () => {
            if (compiledHostsCache && compiledHostsCache.source === hosts) {
                return compiledHostsCache.items;
            }
            const items = [];
            for (const host of hosts) {
                if (!host || host.length < 2) continue;
                const signature = host[0].split(':');
                const matchers = host[1];
                if (!h.isArray(matchers) || !matchers.length) continue;

                const name = signature[0];
                const category = signature.length > 1 ? signature[1] : 'misc';
                const categories = category.split(',');

                const firstCat = categories[0];
                const singleCategory =
                    firstCat === 'image' || firstCat === 'video'
                        ? `${h.ucFirst(firstCat)}s`
                        : firstCat.trim() !== ''
                          ? h.ucFirst(firstCat)
                          : 'Links';

                const albumCatRaw = categories.length > 1 ? categories[1] : categories[0];
                const albumCategory = `${h.ucFirst(albumCatRaw)} Albums`;

                items.push({
                    name,
                    singleCategory,
                    albumCategory,
                    singleMatcher: compileMatcher(matchers[0]),
                    albumMatcher: matchers.length > 1 ? compileMatcher(matchers[1]) : null,
                });
            }
            compiledHostsCache = { source: hosts, items };
            return items;
        };

        const execCompiledMatcher = (compiled, postContent) => {
            if (!compiled) return [];
            const rawMatches = h.re.matchAll(compiled.regex, postContent);
            if (!rawMatches.length) return [];

            const seen = new Set();
            const out = [];
            for (let i = 0; i < rawMatches.length; i++) {
                // Some XenForo post HTML can leak into the match (e.g. trailing </a>...</div>), which then
                // creates "ghost" resources (and broken filenames like "div>"). Strip anything after the URL.
                let url = String(rawMatches[i] || '').replace(/&amp;/g, '&');
                url = url.split(/[\s"'<>]/)[0].trim();
                if (!url) continue;
                // Normalize scheme so the same link in different representations dedupes cleanly.
                if (!/^https?:\/\//i.test(url)) {
                    url = `https://${url}`;
                }
                if (compiled.stripQueryString) {
                    const qIdx = url.indexOf('?');
                    if (qIdx > -1) url = url.substring(0, qIdx);
                }
                if (compiled.stripTrailingSlash && url.endsWith('/')) {
                    url = url.slice(0, -1);
                }
                url = url.trim();
                if (url && !seen.has(url)) {
                    seen.add(url);
                    out.push(url);
                }
            }
            return out;
        };

        return {
            /**
       * @param postContent
       * @returns {(*&{id: number, enabled: boolean})[]}
       */
            parseHosts: postContent => {
                if (!postContent) return [];
                const parsed = [];
                const compiledList = getCompiledHosts();

                for (let i = 0; i < compiledList.length; i++) {
                    const entry = compiledList[i];
                    if (entry.singleMatcher) {
                        const resources = execCompiledMatcher(entry.singleMatcher, postContent);
                        if (resources.length) {
                            parsed.push({
                                name: entry.name,
                                type: 'single',
                                category: entry.singleCategory,
                                resources,
                                enabled: true,
                                id: nextHostId++,
                            });
                        }
                    }
                    if (entry.albumMatcher) {
                        const resources = execCompiledMatcher(entry.albumMatcher, postContent);
                        if (resources.length) {
                            parsed.push({
                                name: entry.name,
                                type: 'album',
                                category: entry.albumCategory,
                                resources,
                                enabled: true,
                                id: nextHostId++,
                            });
                        }
                    }
                }

                return parsed;
            },
        };
    })(),
};
