// Forgot-password page: asks the server to e-mail a reset link. Needs utils.js and auth-common.js.

const { $, post, showAlert, setLoading } = window.authUi;

$('forgot-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('forgot-email').value.trim();
    if (!email) return showAlert('Enter your email.');

    const button = e.target.querySelector('button[type="submit"]');
    setLoading(button, true);
    try {
        await post('/auth/forgot-password', { email });
        // The server answers the same way whether or not the email is registered, and so does this page
        $('sent-email').textContent = email;
        $('request-panel').hidden = true;
        $('sent-panel').hidden = false;
    } catch (err) {
        showAlert(err.message);
    } finally {
        setLoading(button, false);
    }
});
