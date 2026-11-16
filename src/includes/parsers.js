function xfpdFindNativeReactLinkInContainer(containerEl, excludeComments = true) {
    if (!containerEl || !containerEl.querySelectorAll) return null;
    const candidates = containerEl.querySelectorAll(
        'footer a.reaction[href], .message-actionBar a.reaction[href], .comment-actionBar a.reaction[href], a.reaction[data-xf-init~="reaction"][href]',
    );
    for (const link of candidates) {
        if (link.closest && link.closest('.smgReactionPills')) {
            continue;
        }
        if (
            excludeComments &&
            link.closest &&
            link.closest('.comment, .js-comment, .uw_fcs_comment_section, .message-responses')
        ) {
            continue;
        }
        const href = link.getAttribute('href') || '';
        if (/\/react(?=[?&]|$)/i.test(href) && href.includes('reaction_id=')) {
            return link;
        }
    }
    return null;
}

function xfpdFindPostNativeReactLink(messageEl) {
    return xfpdFindNativeReactLinkInContainer(messageEl, true);
}

function xfpdDetectLockedReactionContent(ownerEl, cleanedClone, isComment = false) {
    if (!ownerEl || !cleanedClone || !cleanedClone.querySelectorAll) return false;
    // Only offer reaction-unlock when a native reaction control exists on the post/comment (user is logged in & permitted to react).
    const reactLink = xfpdFindNativeReactLinkInContainer(ownerEl, !isComment);
    if (!reactLink) return false;

    const explicitReactionLockSel = [
        '.hidethanks:not(.bbCodeBlock--visible)',
        '.hidereact:not(.bbCodeBlock--visible)',
        '.hidereactscore:not(.bbCodeBlock--visible)',
        '.hidereplyreact:not(.bbCodeBlock--visible)',
        '[class*="xs_hide_react"]:not([class*="visible"])',
        '[class*="xs_hide_like"]:not([class*="visible"])',
    ].join(', ');

    if (cleanedClone.querySelector(explicitReactionLockSel)) {
        return true;
    }

    const genericHiddenBlocks = cleanedClone.querySelectorAll(
        '.bbCodeBlock--hidden:not(.bbCodeBlock--visible), .bbCodeBlock--hide:not(.bbCodeBlock--visible), [class*="xs_hide"]:not([class*="visible"]), .messageHide, .th_hide_block',
    );
    for (const blk of genericHiddenBlocks) {
        const txt = String(blk.textContent || '').replace(/\s+/g, ' ').trim();
        // Exclude reply-only or post-count-only locks unless react/like/thank is also an option.
        const isStrictlyNonReact =
            /\b(?:you\s+must\s+reply|reply\s+to\s+(?:this|view|see)|must\s+have\s+\d+\s+posts)\b/i.test(txt) &&
            !/\b(?:react|like|thank)\b/i.test(txt);
        if (!isStrictlyNonReact) {
            return true;
        }
    }

    const candidateBoxes = cleanedClone.querySelectorAll(
        '.bbCodeBlock:not(.bbCodeBlock--spoiler):not(.bbCodeBlock--unfurl):not(.bbCodeBlock--quote):not(.bbCodeBlock--visible), .blockMessage',
    );
    const reactPromptRe =
        /(?:you\s+must|need\s+to|have\s+to|please)\s+(?:react|like|thank)|(?:react|like)\s+(?:or\s+\w+\s+)?to\s+(?:this\s+(?:post|message)|unlock|view|see)|hidden\s+content[\s\S]{0,140}\b(?:react|like|thank)\b/i;
    for (const box of candidateBoxes) {
        const txt = String(box.textContent || '').replace(/\s+/g, ' ').trim();
        if (reactPromptRe.test(txt)) {
            return true;
        }
    }

    return false;
}

function xfpdExtractCleanPostCaption(cleanedClone) {
    if (!cleanedClone) return '';
    try {
        const capClone = cleanedClone.cloneNode(true);
        // Strip unfurl cards, hide boxes, spoilers, quotes, scripts, and reaction overlays so only real human post caption remains.
        capClone
            .querySelectorAll('.bbCodeBlock, .js-unfurl, blockquote, script, style, .smgTargetReactions, .blockMessage')
            .forEach(el => el.remove());

        capClone.querySelectorAll('a').forEach(a => {
            const t = String(a.textContent || '').trim();
            if (
                !t ||
                /^https?:\/\//i.test(t) ||
                /\.[A-Za-z0-9]{2,5}$/.test(t) ||
                /^(?:download|mirror\s*\d*|link\s*\d*|click\s*here|here|source|mega|gofile|pixeldrain|bunkr|cyberdrop|filester)$/i.test(t)
            ) {
                a.remove();
            }
        });

        // Convert <br> to newlines before reading textContent so JSDOM and browsers agree on line breaks.
        capClone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));

        const rawText = String(capClone.textContent || '');
        const lines = rawText
            .split(/\r?\n/)
            .map(l =>
                l
                    .replace(/https?:\/\/\S+/gi, '')
                    .replace(/[\u200B-\u200D\uFEFF]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim(),
            )
            .filter(Boolean);

        for (const line of lines) {
            if (line.length < 2) continue;
            // Skip bare technical/resolution headers
            if (
                /^(?:4k|8k|2160p?|1440p?|1080p?|720p?|540p?|480p?|360p?|hd|fhd|uhd|sd|mp4|mkv|zip|rar|pack|preview|fotos?|videos?|links?|mirrors?)$/i.test(
                    line,
                )
            ) {
                continue;
            }
            if (!/[A-Za-zÀ-ÖØ-öø-ÿ0-9]{2}/.test(line)) continue;
            return line.length > 55 ? line.slice(0, 55).trim() : line;
        }
    } catch (e) {}
    return '';
}

function xfpdGetPostCommentContainers(messageEl) {
    const roots = [];
    if (!messageEl) return roots;
    roots.push(messageEl);
    const sib = messageEl.nextElementSibling;
    if (
        sib &&
        sib.matches &&
        sib.matches('.uw_fcs_comment_section, .message-responses, .js-messageResponses, [class*="uw_fcs"]') &&
        !sib.matches('article.message--post:not(.comment)')
    ) {
        roots.push(sib);
    }
    return roots;
}

function xfpdCollectPostCommentElements(messageEl) {
    const out = [];
    const seen = new Set();
    for (const root of xfpdGetPostCommentContainers(messageEl)) {
        if (!root.querySelectorAll) continue;
        const nodes = root.querySelectorAll('.comment, .js-comment, .uw_fcs_comment');
        for (const n of nodes) {
            if (seen.has(n)) continue;
            let hasCommentAncestor = false;
            let cur = n.parentElement;
            while (cur && cur !== root) {
                if (seen.has(cur)) {
                    hasCommentAncestor = true;
                    break;
                }
                cur = cur.parentElement;
            }
            if (hasCommentAncestor) continue;
            seen.add(n);
            out.push(n);
        }
    }
    return out;
}

function xfpdFindCollapsedCommentLoaders(messageEl) {
    const loaders = [];
    const seenHrefs = new Set();
    for (const root of xfpdGetPostCommentContainers(messageEl)) {
        if (!root.querySelectorAll) continue;
        const links = root.querySelectorAll(
            'a[data-xf-click*="comment-loader"][href], .js-commentLoader a[href], a[href*="/load-previous"], a[href*="/load-comments"], a[href*="uw-fcs"][href*="load"]',
        );
        for (const a of links) {
            const href = String(a.getAttribute('href') || '').trim();
            if (!href || href === '#' || href.startsWith('javascript:') || seenHrefs.has(href)) continue;
            seenHrefs.add(href);
            loaders.push(a);
        }
    }
    return loaders;
}

function xfpdCleanContentFragmentClone(fragmentClone) {
    if (!fragmentClone || !fragmentClone.querySelectorAll) return fragmentClone;

    // Remove our own injected status/progress UI, quotes of other posts, code headers, spoiler button labels, unfurl icons, and SMG reaction overlays.
    ['[data-xfpd-ui="1"]', '.contentRow-figure', '.js-unfurl-favicon', '.smgTargetReactions', 'blockquote', '.button-text > span']
        .flatMap(i => [...fragmentClone.querySelectorAll(i)])
        .forEach(i => {
            if (i.tagName === 'BLOCKQUOTE') {
                if (i.querySelector('.bbCodeBlock-title')) {
                    i.remove();
                }
            } else {
                i.remove();
            }
        });

    // Remove internal forum thread/node links (SimpCity & SocialMediaGirls).
    [...fragmentClone.querySelectorAll('.contentRow-header > a[href]')]
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

    // Decode forum outbound link protection (/redirect/?to=...&m=b64 and SMG /goto/link-confirmation?url=...)
    try {
        const __decodeB64Url = s => {
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

        const __decodeForumRedirect = href => {
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

                const to =
                    u.searchParams.get('to') ||
                    u.searchParams.get('url') ||
                    u.searchParams.get('u') ||
                    u.searchParams.get('link') ||
                    u.searchParams.get('target');
                if (!to) return null;

                const mode = (u.searchParams.get('m') || '').toLowerCase();
                let decoded = null;

                if (mode === 'b64' || mode === 'base64') {
                    decoded = __decodeB64Url(to);
                }

                if (!decoded) {
                    let rawTo = to;
                    try { rawTo = decodeURIComponent(rawTo); } catch (e) {}
                    const looksB64 = /^[A-Za-z0-9+/_-]+={0,2}$/.test(rawTo) && rawTo.length >= 16 && rawTo.length % 4 !== 1;
                    if (looksB64) decoded = __decodeB64Url(rawTo);
                }

                if (!decoded) {
                    try { decoded = decodeURIComponent(to); } catch (e) { decoded = to; }
                }

                decoded = String(decoded || '').trim();

                if (decoded && !/^https?:\/\//i.test(decoded) && /%3a%2f%2f/i.test(decoded)) {
                    try {
                        const d2 = decodeURIComponent(decoded);
                        if (/^https?:\/\//i.test(d2)) decoded = d2;
                    } catch (e) {}
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

        fragmentClone.querySelectorAll(sel).forEach(a => {
            const candidates = [a.getAttribute('href'), a.getAttribute('data-href'), a.getAttribute('data-url')].filter(Boolean);
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

        try {
            fragmentClone.querySelectorAll('a[data-xfpd-decoded="1"] img').forEach(img => {
                const u = (img.getAttribute('data-url') || img.getAttribute('data-src') || img.getAttribute('src') || '').trim();
                if (!u) return;
                let host = '';
                let path = '';
                try {
                    const uu = new URL(u, location.origin);
                    host = (uu.hostname || '').toLowerCase();
                    path = (uu.pathname || '').toLowerCase();
                } catch (e) {}
                const isThumb = host.includes('thumb') || /_t\.(?:jpe?g|png|webp|gif)$/i.test(u) || /\/thumbs?\//i.test(path);
                if (isThumb) img.remove();
            });
        } catch (e) {}
    } catch (e) {}

    // Capture human-readable filename hints from anchor text / XenForo unfurl card headers
    try {
        const extractFilenameHint = rawText => {
            let s = String(rawText || '').replace(/\s+/g, ' ').trim();
            if (!s || /^https?:\/\//i.test(s) || xfpdLooksLikeCfFilenameHint(s)) return '';
            s = s.replace(/\s+[|\-–—]\s*(?:bunkr|gofile|pixeldrain|filester|cyberdrop|fileditch[a-z.]*)\s*$/i, '').trim();
            if (/\.[A-Za-z0-9]{2,5}$/.test(s) && s.length >= 4 && s.length <= 240) {
                return s;
            }
            const m = s.match(/[^\\/:*?"<>|\r\n]{3,220}\.(?:mp4|mkv|m4v|mov|webm|avi|wmv|flv|ts|m2ts|zip|rar|7z|pdf|jpe?g|png|webp|gif|avif)\b/i);
            return m ? m[0].trim() : '';
        };

        fragmentClone.querySelectorAll('a[href]').forEach(a => {
            let href0 = String(a.getAttribute('href') || '').replace(/&amp;/g, '&').trim();
            if (!href0 || href0.startsWith('#') || href0.startsWith('javascript:')) return;
            if (!/^https?:\/\//i.test(href0)) {
                try { href0 = new URL(href0, location.origin).href; } catch (e) { return; }
            }
            const hint = extractFilenameHint(a.textContent || '');
            if (!hint) return;
            const cleanNoHash = href0.split('#')[0].replace(/\/$/, '');
            const cleanNoQs = cleanNoHash.split('?')[0].replace(/\/$/, '');
            linkHintNameByUrl.set(href0, hint);
            linkHintNameByUrl.set(cleanNoHash, hint);
            linkHintNameByUrl.set(cleanNoQs, hint);
        });
    } catch (e) {}

    try {
        fragmentClone.querySelectorAll('a[href*="/attachments/"] img').forEach(img => img.remove());
    } catch (e) {}

    try {
        fragmentClone.querySelectorAll('a[href*="goonbox.cr"] img').forEach(img => img.remove());
    } catch (e) {}

    try {
        fragmentClone
            .querySelectorAll('a[href*="imagepond.net"], a[href*="images.socialmediagirls.com"]')
            .forEach(a => {
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
    } catch (e) {}

    try {
        fragmentClone
            .querySelectorAll(
                'a[href*="pixhost."][href*="/show/"] img, a[href*="pixho.st/show/"] img, a[href*="putmega.com/image/"] img, a[href*="putme.ga/image/"] img',
            )
            .forEach(img => img.remove());
    } catch (e) {}

    return fragmentClone;
}

function xfpdExtractSpoilersFromFragment(fragmentClone) {
    if (!fragmentClone || !fragmentClone.querySelectorAll) return [];
    const textVal = fragmentClone.innerText || fragmentClone.textContent || '';
    return [...fragmentClone.querySelectorAll('.bbCodeBlock--spoiler > .bbCodeBlock-content')]
        .filter(s => !s.querySelector('.bbCodeBlock--unfurl'))
        .concat([...fragmentClone.querySelectorAll('.bbCodeInlineSpoiler')].filter(s => !s.querySelector('.bbCodeBlock--unfurl')))
        .map(s => s.innerText || s.textContent || '')
        .concat(
            h.re
                .matchAll(/(?<=pw|pass|passwd|password)(\s:|:)?\s+?[a-zA-Z0-9~!@#$%^&*()_+{}|:'"<>?\/,;.]+/gis, textVal)
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
        .filter(s => s !== '');
}

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
     * @param post
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
            const messageContentClone = xfpdCleanContentFragmentClone(messageContent.cloneNode(true));

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

            // Collect and clean post comments (e.g. SMG [UW] Forum Comments System / XenForo .message-responses)
            const commentEls = xfpdCollectPostCommentElements(messageEl);
            const commentHtmlParts = [];
            const commentSpoilers = [];
            let hasCommentLockedContent = false;

            for (const commentEl of commentEls) {
                const bodyEl =
                    commentEl.querySelector(
                        '.comment-body .bbWrapper, .comment-contentWrapper .bbWrapper, .message-userContent .bbWrapper, .comment-body, .message-userContent, .bbWrapper',
                    ) || commentEl;
                const cClone = xfpdCleanContentFragmentClone(bodyEl.cloneNode(true));
                if (xfpdDetectLockedReactionContent(commentEl, cClone, true)) {
                    hasCommentLockedContent = true;
                }
                commentSpoilers.push(...xfpdExtractSpoilersFromFragment(cClone));
                const cHtml = cClone.innerHTML;
                if (cHtml && cHtml.trim() !== '') {
                    commentHtmlParts.push(cHtml);
                }
            }

            const collapsedLoaders = xfpdFindCollapsedCommentLoaders(messageEl);
            const hasCollapsedComments = collapsedLoaders.length > 0;

            const spoilers = xfpdExtractSpoilersFromFragment(messageContentClone).concat(commentSpoilers).unique();
            const hasMainLockedContent = xfpdDetectLockedReactionContent(messageEl, messageContentClone, false);
            const hasLockedContent = hasMainLockedContent || hasCommentLockedContent;

            // Extract caption purely from the main post (never polluted by commenter replies!)
            const postCaption = xfpdExtractCleanPostCaption(messageContentClone);

            const mainOnlyContent = messageContentClone.innerHTML;
            const commentsOnlyContent = commentHtmlParts.join('\n');
            const postContent = commentsOnlyContent ? `${mainOnlyContent}\n${commentsOnlyContent}` : mainOnlyContent;
            const postTextContent = messageContentClone.innerText || messageContentClone.textContent || '';

            const matches = /(?<=\/page-)\d+/is.exec(document.location.pathname);
            const pageNumber = matches && matches.length ? Number(matches[0]) : 1;

            return {
                post,
                messageEl,
                postId,
                postNumber,
                pageNumber,
                spoilers,
                footer,
                hasMainLockedContent,
                hasCommentLockedContent,
                hasLockedContent,
                hasCollapsedComments,
                commentCount: commentEls.length,
                postCaption,
                mainOnlyContent,
                commentsOnlyContent,
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
