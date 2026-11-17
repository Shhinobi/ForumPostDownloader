const init = {
    injectCustomStyles: () => {
        try {
            if (document.getElementById('xfpd-theme-styles')) return;
            const target = document.head || document.documentElement || document.body;
            if (!target) return;

            // Tippy transparent theme + Queue HUD styles.
            const styleEl = document.createElement('style');
            styleEl.id = 'xfpd-theme-styles';
            styleEl.textContent = styles.tippy.theme;
            target.append(styleEl);

            const customStyles = document.createElement('style');
            customStyles.id = 'xfpd-margin-styles';
            const marginClasses = [];

            for (let i = 1; i <= 15; i++) {
                marginClasses.push(`.m-l-${i} {margin-left: ${i}px;}`);
                marginClasses.push(`.m-t-${i} {margin-top: ${i}px;}`);
            }

            customStyles.textContent = marginClasses.join('\n');
            target.append(customStyles);
        } catch (e) {
            console.error('[XFPD] Style injection error:', e);
        }
    },
};