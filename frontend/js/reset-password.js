// Reset-password page: the e-mailed link opens it with ?token=...; the new password is sent with that token.
// Needs utils.js and auth-common.js.

const { $, post, showAlert, setLoading, bindPasswordToggles } = window.authUi;

const token = new URLSearchParams(window.location.search).get('token');
// Keep the token out of the address bar and the browser history
window.history.replaceState(null, '', window.location.pathname);

function showPanel(id) {
    ['form-panel', 'done-panel', 'invalid-panel'].forEach((panel) => { $(panel).hidden = panel !== id; });
}

bindPasswordToggles();
if (!token) showPanel('invalid-panel');

let passwordMin = 8;
let passwordMax = 72;
fetch('/api/public/meta')
    .then((res) => res.json())
    .then(({ data }) => {
        passwordMin = data.passwordMin || passwordMin;
        passwordMax = data.passwordMax || passwordMax;
    })
    .catch(() => { /* the defaults stay; the server checks the length anyway */ });

$('reset-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = $('reset-password').value;
    if (password.length < passwordMin || password.length > passwordMax) return showAlert(`Password must be ${passwordMin}-${passwordMax} characters.`);
    if (password !== $('reset-confirm').value) return showAlert('The two passwords do not match.');

    const button = e.target.querySelector('button[type="submit"]');
    setLoading(button, true);
    try {
        await post('/auth/reset-password', { token, password });
        // Anyone still logged in on this browser was signed out by the server; drop the saved login too
        try { localStorage.removeItem('token'); localStorage.removeItem('currentUser'); } catch { /* storage unavailable */ }
        showPanel('done-panel');
    } catch (err) {
        // A bad link is a dead end; any other problem (length, rate limit, network) can be retried
        if (err.message.startsWith('This link is invalid')) showPanel('invalid-panel');
        else showAlert(err.message);
    } finally {
        setLoading(button, false);
    }
});
