const ui = {
    /**
   * @returns {string}
   */
    getTooltipBackgroundColor: () => {
        const scheme =
            document.documentElement.dataset.colorScheme ||
            (typeof XF !== 'undefined' && XF?.config?.style?.defaultColorScheme) ||
            '';
        if (scheme === 'dark') return '#2B2B2B';
        if (scheme === 'light') return '#EDF0F3';
        if (document.querySelector('link[href*="uix_dark"]')) return '#2B2B2B';
        try {
            const bg = window.getComputedStyle(document.body).backgroundColor || '';
            const m = bg.match(/\d+/g);
            if (m && m.length >= 3) {
                const lum = 0.299 * Number(m[0]) + 0.587 * Number(m[1]) + 0.114 * Number(m[2]);
                return lum < 128 ? '#2B2B2B' : '#EDF0F3';
            }
        } catch (e) {}
        return '#2B2B2B';
    },

    /**
   * @param target
   * @param content
   * @param options
   * @returns {*}
   */
    tooltip: (target, content, options = {}) => {
        // noinspection JSUnusedGlobalSymbols
        return tippy(target, {
            arrow: true,
            theme: 'transparent',
            allowHTML: true,
            content: content,
            appendTo: () => document.body,
            placement: 'left',
            interactive: true,
            ...options,
        });
    },
    pBars: {
        /**
     * @param color
     * @param height
     * @param width
     * @returns {HTMLDivElement}
     */
        base: (color, height = '3px', width = '0%') => {
            const pb = document.createElement('div');
            pb.style.height = height;
            pb.style.background = color;
            pb.style.width = width;
            return pb;
        },
        /**
     * @param color
     * @returns {HTMLDivElement}
     */
        createFileProgressBar: (color = '#46658b') => {
            const pb = ui.pBars.base(color);
            pb.style.marginBottom = '1px';
            return pb;
        },
        /**
     * @param color
     * @returns {HTMLDivElement}
     */
        createTotalProgressBar: (color = '#545454') => {
            const pb = ui.pBars.base(color);
            pb.style.marginBottom = '10px';
            return pb;
        },
    },
    labels: {
        /**
     * @param initialText
     * @param color
     * @returns {{container: HTMLDivElement, el: HTMLSpanElement}}
     */
        createBlockLabel: (initialText = null, color = '#959595') => {
            const container = document.createElement('div');
            container.style.color = color;
            container.style.fontSize = '12px';

            const span = document.createElement('span');
            container.appendChild(span);

            if (initialText) {
                span.textContent = initialText;
            }

            return {
                el: span,
                container,
            };
        },
        status: {
            /**
       * @param initialText
       * @returns {{container: HTMLDivElement, el: HTMLSpanElement}}
       */
            createStatusLabel: (initialText = '') => {
                const label = ui.labels.createBlockLabel(initialText);
                label.el.style.marginBottom = '3px';

                return label;
            },
        },
    },
    buttons: {
        /**
     * @returns {HTMLAnchorElement}
     */
        createPostDownloadButton: () => {
            const downloadPostBtn = document.createElement('a');
            downloadPostBtn.setAttribute('href', '#');
            downloadPostBtn.innerHTML = '🡳 Download';

            return downloadPostBtn;
        },
        /**
     * @returns {HTMLLIElement}
     */
        createPostDownloadButtonContainer: () => {
            return document.createElement('li');
        },
        /**
     * @param post
     * @returns {{container: HTMLLIElement, btn: HTMLAnchorElement}}
     */
        addDownloadPostButton: post => {
            const btnDownloadPostContainer = ui.buttons.createPostDownloadButtonContainer();
            const btnDownloadPost = ui.buttons.createPostDownloadButton();
            btnDownloadPostContainer.appendChild(btnDownloadPost);
            post.prepend(btnDownloadPostContainer);

            return {
                container: btnDownloadPostContainer,
                btn: btnDownloadPost,
            };
        },
    },
    forms: {
        /**
     * @param id
     * @param label
     * @param checked
     * @param disabled
     * @returns {string}
     */
        createCheckbox: (id, label, checked, disabled = false) => {
            return `
          <div class="menu-row" style="margin-top: -5px;">
            <label class="iconic" style="user-select: none">
              <input type="checkbox" ${checked ? 'checked="checked"' : ''} ${disabled ? 'disabled="disabled"' : ''} id="${id}" />
                <i aria-hidden="true"></i>
                <span
                  class="iconic-label"
                  style="margin-left: -7px"
                >
                    <span id="${id}-label">${label}</span>
                </span>
            </label>
          </div>
          `;
        },
        /**
     * @param content
     * @returns {string}
     */
        createRow: content => {
            return `
      <div class="menu-row">
          ${content}
      </div>
      `;
        },
        /**
     * @param label
     * @returns {string}
     */
        createLabel: label => {
            return `
      <div style="font-weight: bold; margin-top:5px; margin-bottom: 8px; color: #3DB7C7;">
          ${label}
      </div>
      `;
        },
        config: {
            /**
       * Renders the Settings heading and the 7 download configuration checkboxes for any form prefix.
       * @param idPrefix
       * @param currentSettings
       * @returns {string}
       */
            createSettingsCheckboxesHtml: (idPrefix, currentSettings) => {
                const skipDl = !!currentSettings.skipDownload;
                const orgMedia = skipDl ? false : currentSettings.organizeMedia !== false;
                const smartMirrors = currentSettings.smartMirrors !== false;
                const vidQual = currentSettings.videoQuality || 'best';
                const opt = (val, label) => `<option value="${val}" ${vidQual === val ? 'selected="selected"' : ''}>${label}</option>`;
                return [
                    `
          <div class="menu-row">
            <div style="font-weight: bold; margin-top:3px; margin-bottom: 4px; color: #3DB7C7;">
                Settings
            </div>
          </div>
          `,
                    ui.forms.createCheckbox(`${idPrefix}-zipped`, 'Zipped', !!currentSettings.zipped),
                    ui.forms.createCheckbox(
                        `${idPrefix}-organize-media`,
                        'Organize Media (Photos/Videos)',
                        orgMedia,
                        skipDl,
                    ),
                    ui.forms.createCheckbox(
                        `${idPrefix}-smart-mirrors`,
                        'Smart Mirrors (Auto-Fallback)',
                        smartMirrors,
                        false,
                    ),
                    `
          <div class="menu-row xfpd-select-row">
            <label class="xfpd-select-label" for="${idPrefix}-video-quality">Video Quality</label>
            <select id="${idPrefix}-video-quality" class="xfpd-select">
              ${opt('best', 'Best Available (4K)')}
              ${opt('1080p', 'Max 1080p')}
              ${opt('720p', 'Max 720p')}
              ${opt('all', 'All Resolutions')}
            </select>
          </div>
          `,
                    ui.forms.createCheckbox(
                        `${idPrefix}-flatten`,
                        'Flatten',
                        skipDl || orgMedia ? false : !!currentSettings.flatten,
                        skipDl || orgMedia,
                    ),
                    ui.forms.createCheckbox(
                        `${idPrefix}-skip-duplicates`,
                        'Skip Duplicates',
                        skipDl ? false : !!currentSettings.skipDuplicates,
                        skipDl,
                    ),
                    ui.forms.createCheckbox(
                        `${idPrefix}-generate-links`,
                        'Generate Links',
                        skipDl ? true : !!currentSettings.generateLinks,
                        skipDl,
                    ),
                    ui.forms.createCheckbox(`${idPrefix}-generate-log`, 'Generate Log', !!currentSettings.generateLog),
                    ui.forms.createCheckbox(`${idPrefix}-skip-download`, 'Skip Download', skipDl),
                    ui.forms.createCheckbox(`${idPrefix}-verify-bunkr-links`, 'Verify Bunkr Links', !!currentSettings.verifyBunkrLinks),
                ].join('');
            },
            /**
       * Syncs checkbox .checked/.disabled and select .value states in rootEl from live settingsObj.
       * @param rootEl
       * @param idPrefix
       * @param settingsObj
       */
            syncSettingsInputs: (rootEl, idPrefix, settingsObj) => {
                if (!rootEl || !settingsObj) return;
                const setCb = (suffix, checked, disabled = false) => {
                    const el = rootEl.querySelector(`#${idPrefix}-${suffix}`);
                    if (!el) return;
                    el.checked = !!checked;
                    el.disabled = !!disabled;
                    if (checked) {
                        el.setAttribute('checked', 'checked');
                    } else {
                        el.removeAttribute('checked');
                    }
                };
                const skipDl = !!settingsObj.skipDownload;
                const orgMedia = skipDl ? false : settingsObj.organizeMedia !== false;
                setCb('zipped', settingsObj.zipped, false);
                setCb('organize-media', orgMedia, skipDl);
                setCb('smart-mirrors', settingsObj.smartMirrors !== false, false);
                const qualEl = rootEl.querySelector(`#${idPrefix}-video-quality`);
                if (qualEl) {
                    const q = settingsObj.videoQuality || 'best';
                    if (qualEl.value !== q) qualEl.value = q;
                }
                setCb('flatten', skipDl || orgMedia ? false : settingsObj.flatten, skipDl || orgMedia);
                setCb('skip-duplicates', skipDl ? false : settingsObj.skipDuplicates, skipDl);
                setCb('generate-links', skipDl ? true : settingsObj.generateLinks, skipDl);
                setCb('generate-log', settingsObj.generateLog, false);
                setCb('skip-download', skipDl, false);
                setCb('verify-bunkr-links', settingsObj.verifyBunkrLinks, false);
            },
            /**
       * Binds change handlers once per form element for the settings checkboxes.
       * @param rootEl
       * @param idPrefix
       * @param settingsObj
       * @param onSettingChange
       */
            bindSettingsInputs: (rootEl, idPrefix, settingsObj, onSettingChange) => {
                if (!rootEl || !settingsObj || rootEl.dataset.xfpdSettingsBound === '1') return;
                rootEl.dataset.xfpdSettingsBound = '1';

                const notify = (patch, keys) => {
                    if (typeof onSettingChange === 'function') {
                        onSettingChange(patch, keys);
                    }
                };

                const ensurePreSkip = () => {
                    if (!settingsObj.preSkipDownload || typeof settingsObj.preSkipDownload !== 'object') {
                        settingsObj.preSkipDownload = {
                            organizeMedia: settingsObj.organizeMedia !== false,
                            flatten: !!settingsObj.flatten,
                            skipDuplicates: !!settingsObj.skipDuplicates,
                            generateLinks: !!settingsObj.generateLinks,
                        };
                    }
                };

                const bindOne = (suffix, handler) => {
                    const el = rootEl.querySelector(`#${idPrefix}-${suffix}`);
                    if (el && el.dataset.xfpdBound !== '1') {
                        el.dataset.xfpdBound = '1';
                        el.addEventListener('change', handler);
                    }
                };

                bindOne('zipped', e => {
                    settingsObj.zipped = !!e.target.checked;
                    notify({ zipped: settingsObj.zipped }, ['zipped']);
                });

                bindOne('organize-media', e => {
                    ensurePreSkip();
                    settingsObj.organizeMedia = !!e.target.checked;
                    if (!settingsObj.skipDownload) {
                        settingsObj.preSkipDownload.organizeMedia = settingsObj.organizeMedia;
                    }
                    ui.forms.config.syncSettingsInputs(rootEl, idPrefix, settingsObj);
                    notify(
                        { organizeMedia: settingsObj.organizeMedia, preSkipDownload: { ...settingsObj.preSkipDownload } },
                        ['organizeMedia'],
                    );
                });

                bindOne('smart-mirrors', e => {
                    settingsObj.smartMirrors = !!e.target.checked;
                    notify({ smartMirrors: settingsObj.smartMirrors }, ['smartMirrors']);
                });

                bindOne('video-quality', e => {
                    settingsObj.videoQuality = e.target.value || 'best';
                    notify({ videoQuality: settingsObj.videoQuality }, ['videoQuality']);
                });

                bindOne('flatten', e => {
                    ensurePreSkip();
                    settingsObj.flatten = !!e.target.checked;
                    if (!settingsObj.skipDownload) {
                        settingsObj.preSkipDownload.flatten = settingsObj.flatten;
                    }
                    notify({ flatten: settingsObj.flatten, preSkipDownload: { ...settingsObj.preSkipDownload } }, ['flatten']);
                });

                bindOne('skip-duplicates', e => {
                    ensurePreSkip();
                    settingsObj.skipDuplicates = !!e.target.checked;
                    if (!settingsObj.skipDownload) {
                        settingsObj.preSkipDownload.skipDuplicates = settingsObj.skipDuplicates;
                    }
                    notify(
                        { skipDuplicates: settingsObj.skipDuplicates, preSkipDownload: { ...settingsObj.preSkipDownload } },
                        ['skipDuplicates'],
                    );
                });

                bindOne('generate-links', e => {
                    ensurePreSkip();
                    settingsObj.generateLinks = !!e.target.checked;
                    if (!settingsObj.skipDownload) {
                        settingsObj.preSkipDownload.generateLinks = settingsObj.generateLinks;
                    }
                    notify(
                        { generateLinks: settingsObj.generateLinks, preSkipDownload: { ...settingsObj.preSkipDownload } },
                        ['generateLinks'],
                    );
                });

                bindOne('generate-log', e => {
                    settingsObj.generateLog = !!e.target.checked;
                    notify({ generateLog: settingsObj.generateLog }, ['generateLog']);
                });

                bindOne('verify-bunkr-links', e => {
                    settingsObj.verifyBunkrLinks = !!e.target.checked;
                    notify({ verifyBunkrLinks: settingsObj.verifyBunkrLinks }, ['verifyBunkrLinks']);
                });

                bindOne('skip-download', e => {
                    ensurePreSkip();
                    const checked = !!e.target.checked;
                    if (checked) {
                        settingsObj.preSkipDownload = {
                            organizeMedia: settingsObj.organizeMedia !== false,
                            flatten: !!settingsObj.flatten,
                            skipDuplicates: !!settingsObj.skipDuplicates,
                            generateLinks: !!settingsObj.generateLinks,
                        };
                        settingsObj.skipDownload = true;
                        settingsObj.organizeMedia = false;
                        settingsObj.flatten = false;
                        settingsObj.skipDuplicates = false;
                        settingsObj.generateLinks = true;
                    } else {
                        settingsObj.skipDownload = false;
                        settingsObj.organizeMedia = settingsObj.preSkipDownload.organizeMedia !== false;
                        settingsObj.flatten = !!settingsObj.preSkipDownload.flatten;
                        settingsObj.skipDuplicates = !!settingsObj.preSkipDownload.skipDuplicates;
                        settingsObj.generateLinks = !!settingsObj.preSkipDownload.generateLinks;
                    }
                    ui.forms.config.syncSettingsInputs(rootEl, idPrefix, settingsObj);
                    notify(
                        {
                            skipDownload: settingsObj.skipDownload,
                            organizeMedia: settingsObj.organizeMedia,
                            flatten: settingsObj.flatten,
                            skipDuplicates: settingsObj.skipDuplicates,
                            generateLinks: settingsObj.generateLinks,
                            preSkipDownload: { ...settingsObj.preSkipDownload },
                        },
                        ['skipDownload', 'organizeMedia', 'flatten', 'skipDuplicates', 'generateLinks'],
                    );
                });
            },
            page: {
                /**
         * @param backgroundColor
         * @param innerHTML
         * @returns {string}
         */
                createForm: (backgroundColor, innerHTML) => {
                    return `
          <form
            id="downloader-page-config-form"
            class="menu-content"
            style="user-select: none; padding: 5px 10px; background: ${backgroundColor};width:300px; min-width: 300px;"
          >
            ${innerHTML}
          </form>
          `;
                },
            },
            post: {
                /**
         * @param postId
         * @param backgroundColor
         * @param innerHTML
         * @returns {string}
         */
                createForm: (postId, backgroundColor, innerHTML) => {
                    return `
          <form
            id="download-config-form-${postId}"
            class="menu-content"
            style="user-select: none; padding: 5px 10px; background: ${backgroundColor};width:300px; min-width: 300px;"
          >
            ${innerHTML}
          </form>
          `;
                },
                /**
         * @param currentValue
         * @param postId
         * @param backgroundColor
         * @param placeholder
         * @returns {string}
         */
                createFilenameInput: (currentValue, postId, backgroundColor, placeholder) => {
                    return `
          <div class="menu-row">
            <div style="font-weight: bold; margin-top:5px; margin-bottom: 8px; color: #3DB7C7;">
                File / Archive Name
            </div>
            <input
              id="filename-input-${postId}"
              type="text"
              style="background: ${backgroundColor};"
              class="archive-name input"
              autocomplete="off"
              name="keywords"
              placeholder="${placeholder}"
              aria-label="Search"
              value="${currentValue}"
            />
          </div>
          `;
                },
                /**
         * @returns {string}
         */
                createZippedCheckbox: (postId, checked) => {
                    return ui.forms.createCheckbox(`settings-${postId}-zipped`, 'Zipped', checked);
                },
                /**
         * @returns {string}
         */
                createFlattenCheckbox: (postId, checked, disabled = false) => {
                    return ui.forms.createCheckbox(`settings-${postId}-flatten`, 'Flatten', checked, disabled);
                },
                /**
         * @returns {string}
         */
                createSkipDownloadCheckbox: (postId, checked) => {
                    return ui.forms.createCheckbox(`settings-${postId}-skip-download`, 'Skip Download', checked);
                },
                /**
         * @returns {string}
         */
                createVerifyBunkrLinksCheckbox: (postId, checked) => {
                    return ui.forms.createCheckbox(`settings-${postId}-verify-bunkr-links`, 'Verify Bunkr Links', checked);
                },
                /**
         * @returns {string}
         */
                createGenerateLinksCheckbox: (postId, checked, disabled = false) => {
                    return ui.forms.createCheckbox(`settings-${postId}-generate-links`, 'Generate Links', checked, disabled);
                },
                /**
         * @returns {string}
         */
                createGenerateLogCheckbox: (postId, checked) => {
                    return ui.forms.createCheckbox(`settings-${postId}-generate-log`, 'Generate Log', checked);
                },
                /**
         * @returns {string}
         */
                createSkipDuplicatesCheckbox: (postId, checked, disabled = false) => {
                    return ui.forms.createCheckbox(`settings-${postId}-skip-duplicates`, 'Skip Duplicates', checked, disabled);
                },
                /**
         * @param hosts
         * @param getTotalDownloadableResourcesCB
         * @param postId
         * @returns {string}
         */
                createFilterLabel: (hosts, getTotalDownloadableResourcesCB, postId = '') => {
                    const countId = postId ? `filtered-count-${postId}` : 'filtered-count';
                    return `
          <div style="font-weight: bold; margin-top:5px; margin-bottom: 8px; margin-left: 8px; color: #3DB7C7;">Filter <span id="${countId}" data-xfpd-filtered-count="1">(${getTotalDownloadableResourcesCB(
                        hosts,
                    )})</span></div>
          `;
                },
                /**
         * @param postId
         * @returns {string}
         */
                createToggleAllCheckbox: postId => {
                    return ui.forms.createCheckbox(`settings-toggle-all-hosts-${postId}`, settings.ui.checkboxes.toggleAllCheckboxLabel, true);
                },
                /**
         * @param postId
         * @param host
         * @returns {string}
         */
                createHostCheckbox: (postId, host) => {
                    const title = `${host.name} ${host.category}`;
                    return ui.forms.createCheckbox(`downloader-host-${host.id}-${postId}`, `${title} (${host.resources.length})`, host.enabled);
                },
                /**
         * @param postId
         * @param filterLabel
         * @param hostsHtml
         * @param createToggleAllCheckbox
         * @returns {string}
         */
                createHostCheckboxes: (postId, filterLabel, hostsHtml, createToggleAllCheckbox) => {
                    return `
          <div>
            ${filterLabel}
            ${createToggleAllCheckbox ? ui.forms.config.post.createToggleAllCheckbox(postId) : ''}
            ${hostsHtml}
          </div>
          `;
                },
                /**
         * @param parsedPost
         * @param parsedHosts
         * @param defaultFilename
         * @param postSettings
         * @param onSubmitFormCB
         * @param totalDownloadableResourcesForPostCB
         * @param btnDownloadPost
         */
                createPostConfigForm: (
                    parsedPost,
                    parsedHosts,
                    defaultFilename,
                    postSettings,
                    onSubmitFormCB,
                    totalDownloadableResourcesForPostCB,
                    btnDownloadPost,
                ) => {
                    const { postId } = parsedPost;
                    const color = ui.getTooltipBackgroundColor();

                    const customFilename = postSettings.output.find(o => o.postId === postId)?.value || '';

                    let hostsHtml = '<div style="max-height: 200px; overflow-y: auto; overflow-x: hidden;">';
                    parsedHosts.forEach(host => (hostsHtml += ui.forms.config.post.createHostCheckbox(postId, host)));
                    hostsHtml += '</div>';

                    const totalResourcesCount = parsedHosts.reduce((acc, host) => acc + host.resources.length, 0);
                    const initialFilteredCount = totalDownloadableResourcesForPostCB(parsedHosts);
                    const filterLabel = ui.forms.config.post.createFilterLabel(parsedHosts, totalDownloadableResourcesForPostCB, postId);
                    const idPrefix = `settings-${postId}`;

                    const formHtml = [
                        window.isFF ? ui.forms.config.post.createFilenameInput(customFilename, postId, color, defaultFilename) : null,
                        ui.forms.config.createSettingsCheckboxesHtml(idPrefix, postSettings),
                        ui.forms.config.post.createHostCheckboxes(postId, filterLabel, hostsHtml, parsedHosts.length > 1),
                        ui.forms.createRow(
                            `<button type="button" id="xfpd-start-post-${postId}" class="xfpd-action-btn">🡳 Download Post (${initialFilteredCount}/${totalResourcesCount})</button>`,
                        ),
                        ui.forms.createRow(
                            '<a href="#download-page" data-xfpd-jump-page="1" style="color: #3DB7C7; font-weight: bold"><i class="fa fa-arrow-up"></i> Show Download Page Button</a>',
                        ),
                    ].filter(c => c !== null);

                    const configForm = ui.forms.config.post.createForm(postId, color, formHtml.join(''));
                    let activeInstance = null;

                    const setupPostForm = instance => {
                        activeInstance = instance || activeInstance;
                        const root = instance && instance.popper ? instance.popper : document;
                        const formEl = root.querySelector(`#download-config-form-${postId}`);
                        if (!formEl) return;

                        // Always sync DOM inputs to reflect live postSettings (handles re-hover, page-wide toggles, cross-tab sync).
                        ui.forms.config.syncSettingsInputs(formEl, idPrefix, postSettings);

                        const inputEl = formEl.querySelector(`#filename-input-${postId}`);
                        if (inputEl) {
                            const savedOut = postSettings.output.find(o => o.postId === postId)?.value || '';
                            if (inputEl.value !== savedOut) inputEl.value = savedOut;
                            if (inputEl.dataset.xfpdBound !== '1') {
                                inputEl.dataset.xfpdBound = '1';
                                inputEl.addEventListener('input', e => {
                                    const value = e.target.value;
                                    const o = postSettings.output.find(item => item.postId === postId);
                                    if (o) {
                                        o.value = value;
                                    } else {
                                        postSettings.output.push({
                                            postId,
                                            value,
                                        });
                                    }
                                });
                            }
                        }

                        ui.forms.config.bindSettingsInputs(formEl, idPrefix, postSettings, (patch, changedKeys) => {
                            if (postSettings._overridden && Array.isArray(changedKeys)) {
                                changedKeys.forEach(k => postSettings._overridden.add(k));
                            }
                            if (typeof xfpdSaveUserPrefs === 'function') {
                                xfpdSaveUserPrefs(patch, 'post', changedKeys);
                            }
                        });

                        // Sync host checkboxes, filtered count, and action button on every open.
                        let enabledHostCount = 0;
                        parsedHosts.forEach(host => {
                            const hostCb = formEl.querySelector(`#downloader-host-${host.id}-${postId}`);
                            if (hostCb) {
                                hostCb.checked = !!host.enabled;
                                if (host.enabled) enabledHostCount++;
                            }
                        });
                        const liveFilteredCount = totalDownloadableResourcesForPostCB(parsedHosts);
                        const countSpan = formEl.querySelector('[data-xfpd-filtered-count]') || formEl.querySelector('#filtered-count');
                        if (countSpan) {
                            countSpan.textContent = `(${liveFilteredCount})`;
                        }
                        const startBtn = formEl.querySelector(`#xfpd-start-post-${postId}`);
                        if (startBtn) {
                            startBtn.disabled = liveFilteredCount === 0;
                            startBtn.textContent = `🡳 Download Post (${liveFilteredCount}/${totalResourcesCount})`;
                        }
                        if (parsedHosts.length > 1) {
                            const toggleAllCb = formEl.querySelector(`#settings-toggle-all-hosts-${postId}`);
                            if (toggleAllCb) {
                                const allChecked = enabledHostCount === parsedHosts.length;
                                toggleAllCb.checked = allChecked;
                                if (allChecked) {
                                    toggleAllCb.setAttribute('checked', 'checked');
                                } else {
                                    toggleAllCb.removeAttribute('checked');
                                }
                            }
                        }

                        if (formEl.dataset.xfpdPostFormBound === '1') return;
                        formEl.dataset.xfpdPostFormBound = '1';

                        formEl.addEventListener('submit', async e => {
                            e.preventDefault();
                            onSubmitFormCB({ tippyInstance: activeInstance });
                        });

                        if (startBtn) {
                            startBtn.addEventListener('click', e => {
                                e.preventDefault();
                                onSubmitFormCB({ tippyInstance: activeInstance, startDownload: true });
                            });
                        }

                        const jumpPageLink = formEl.querySelector('[data-xfpd-jump-page="1"]');
                        if (jumpPageLink) {
                            jumpPageLink.addEventListener('click', e => {
                                if (typeof window.__xfpdFocusDownloadPage === 'function') {
                                    e.preventDefault();
                                    if (activeInstance && typeof activeInstance.hide === 'function') {
                                        activeInstance.hide();
                                    }
                                    window.__xfpdFocusDownloadPage();
                                }
                            });
                        }

                        if (parsedHosts.length > 1) {
                            const toggleAllEl = formEl.querySelector(`#settings-toggle-all-hosts-${postId}`);
                            if (toggleAllEl) {
                                toggleAllEl.addEventListener('change', async e => {
                                    e.preventDefault();

                                    const checked = e.target.checked;
                                    const hostCheckboxes = parsedHosts
                                        .map(host => formEl.querySelector(`#downloader-host-${host.id}-${postId}`))
                                        .filter(Boolean);
                                    const checkedHostCheckboxes = hostCheckboxes.filter(el => el.checked);
                                    const unCheckedHostCheckboxes = hostCheckboxes.filter(el => !el.checked);

                                    if (checked) {
                                        unCheckedHostCheckboxes.forEach(c => c.click());
                                    } else {
                                        checkedHostCheckboxes.forEach(c => c.click());
                                    }
                                });
                            }
                        }

                        parsedHosts.forEach(host => {
                            const hostCb = formEl.querySelector(`#downloader-host-${host.id}-${postId}`);
                            if (!hostCb) return;
                            hostCb.addEventListener('change', e => {
                                host.enabled = e.target.checked;
                                const filteredCount = totalDownloadableResourcesForPostCB(parsedHosts);
                                const filteredEl =
                                    formEl.querySelector('[data-xfpd-filtered-count]') || formEl.querySelector('#filtered-count');
                                if (filteredEl) {
                                    filteredEl.textContent = `(${filteredCount})`;
                                }

                                if (parsedHosts.length > 0) {
                                    const checkedLength = parsedHosts
                                        .map(hItem => formEl.querySelector(`#downloader-host-${hItem.id}-${postId}`))
                                        .filter(el => el && el.checked).length;

                                    const totalResources = parsedHosts.reduce((acc, hItem) => acc + hItem.resources.length, 0);

                                    const totalDownloadableResources = parsedHosts
                                        .filter(hItem => hItem.enabled && hItem.resources.length)
                                        .reduce((acc, hItem) => acc + hItem.resources.length, 0);

                                    if (btnDownloadPost.dataset.xfpdState !== 'running') {
                                        btnDownloadPost.style.color = '';
                                        btnDownloadPost.innerHTML = `🡳 Download (${totalDownloadableResources}/${totalResources})`;
                                    }
                                    const startActionBtn = formEl.querySelector(`#xfpd-start-post-${postId}`);
                                    if (startActionBtn) {
                                        startActionBtn.disabled = totalDownloadableResources === 0;
                                        startActionBtn.textContent = `🡳 Download Post (${totalDownloadableResources}/${totalResources})`;
                                    }

                                    if (parsedHosts.length > 1) {
                                        const toggleAllHostsCheckbox = formEl.querySelector(`#settings-toggle-all-hosts-${postId}`);
                                        if (toggleAllHostsCheckbox) {
                                            if (checkedLength !== parsedHosts.length) {
                                                toggleAllHostsCheckbox.removeAttribute('checked');
                                                toggleAllHostsCheckbox.checked = false;
                                            } else {
                                                toggleAllHostsCheckbox.setAttribute('checked', 'checked');
                                                toggleAllHostsCheckbox.checked = true;
                                            }
                                        }
                                    }
                                }
                            });
                        });
                    };

                    return ui.tooltip(btnDownloadPost, configForm, {
                        onCreate: instance => setupPostForm(instance),
                        onShow: instance => setupPostForm(instance),
                        onMount: instance => setupPostForm(instance),
                        onShown: instance => setupPostForm(instance),
                    });
                },
            },
        },
    },
};
