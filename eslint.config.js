const js = require('@eslint/js');
const globals = require('globals');

// Helpers that utils.js / dashboard.js attach to `window` and the page scripts then use as globals
const sharedFrontend = Object.fromEntries([
    'esc', 'formatDate', 'formatDateTime', 'statusSlug', 'SESSION_EXPIRED', 'withLoading', 'guarded', 'showLoadError',
    'initSidebar', 'openProtectedPdf', 'logout', 'requireRole', 'apiFetch', 'showNotification', 'initNavigation',
    'loadMeta', 'fillOptionLists', 'bootstrap', 'Chart'
].map((name) => [name, 'readonly']));

module.exports = [
    { ignores: ['**/node_modules/**', 'docs/**'] },
    js.configs.recommended,
    {
        rules: {
            'no-unused-vars': ['warn', { args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'none' }]
        }
    },
    { files: ['eslint.config.js', 'backend/**/*.js'], languageOptions: { sourceType: 'commonjs', globals: globals.node } },
    { files: ['frontend/js/**/*.js'], languageOptions: { sourceType: 'script', globals: { ...globals.browser, ...sharedFrontend } } }
];
