// Verify-email page: the link in the registration e-mail opens it with ?token=...; the token is sent
// to the server on load. Needs utils.js and auth-common.js.

const { $, post, showAlert, setLoading } = window.authUi;

const token = new URLSearchParams(window.location.search).get('token');
// Keep the token out of the address bar and the browser history
window.history.replaceState(null, '', window.location.pathname);

function showPanel(id) {
    ['working-panel', 'success-panel', 'failed-panel'].forEach((panel) => { $(panel).hidden = panel !== id; });
}

async function verify() {
    if (!token) return showPanel('failed-panel');
    try {
        await post('/auth/verify-email', { token });
        showPanel('success-panel');
    } catch {
        showPanel('failed-panel');
    }
}

$('resend-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('resend-email').value.trim();
    if (!email) return showAlert('Enter your email.');

    const button = e.target.querySelector('button[type="submit"]');
    setLoading(button, true);
    try {
        const { message } = await post('/auth/resend-verification', { email });
        showAlert(message, 'success', 8000);
    } catch (err) {
        showAlert(err.message);
    } finally {
        setLoading(button, false);
    }
});

verify();
