/* The theme control for the written pages.
   The prompter has its own copy of this in script.js, where the mode is one
   setting among many. Here it is the only one, so the saved object is read and
   written back around it: replacing it would throw away the visitor's script
   and their pacing the moment they pressed the toggle. */
(function () {
    const STORAGE_KEY = 'teleprompterSettings';
    const toggle = document.getElementById('theme-toggle-btn');
    const lightIcon = document.getElementById('light-mode-icon');
    const darkIcon = document.getElementById('dark-mode-icon');

    function readSettings() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        } catch (e) {
            return {};
        }
    }

    let mode = readSettings().mode
        || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

    function apply() {
        document.documentElement.setAttribute('data-theme', `nord-${mode}`);
        lightIcon.style.display = mode === 'light' ? 'block' : 'none';
        darkIcon.style.display = mode === 'dark' ? 'block' : 'none';
        toggle.setAttribute('aria-label', mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    }

    apply();

    toggle.addEventListener('click', () => {
        mode = mode === 'light' ? 'dark' : 'light';
        apply();
        const settings = readSettings();
        settings.mode = mode;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch (e) {
            /* Storage unavailable. The theme still applies to this page. */
        }
    });
})();
