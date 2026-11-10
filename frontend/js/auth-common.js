// Helpers for the pages that use the login card styles: log in, forgot password, reset password and
// verify e-mail. Needs utils.js (esc). Exposes window.authUi.
(function (global) {
    const $ = (id) => document.getElementById(id);

    // POST JSON. Resolves to the parsed reply; rejects with an Error that carries the server's message
    // (and its `code`, when it sent one).
    async function post(endpoint, body) {
        const res = await fetch(`/api${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        let data;
        try { data = await res.json(); } catch { throw new Error('The server sent an unexpected response'); }
        if (!res.ok) throw Object.assign(new Error(data.message || 'Request failed'), { code: data.code });
        return data;
    }

    function showAlert(message, type = 'danger', duration = 4000) {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.setAttribute('role', type === 'danger' ? 'alert' : 'status');
        alert.innerHTML = `<i class="fas fa-${type === 'danger' ? 'circle-exclamation' : 'circle-check'}" aria-hidden="true"></i><span>${global.esc(message)}</span>`;
        $('alert-area').appendChild(alert);
        setTimeout(() => alert.classList.add('leaving'), duration - 300);
        setTimeout(() => alert.remove(), duration);
    }

    function setLoading(button, loading) {
        button.disabled = loading;
        button.classList.toggle('is-loading', loading);
    }

    // The eye button inside a password field shows / hides the typed password
    function bindPasswordToggles() {
        document.querySelectorAll('.toggle-password').forEach((button) => {
            button.addEventListener('click', () => {
                const input = button.parentElement.querySelector('input');
                const show = input.type === 'password';
                input.type = show ? 'text' : 'password';
                button.setAttribute('aria-pressed', String(show));
                button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
                button.firstElementChild.className = `fas fa-${show ? 'eye-slash' : 'eye'}`;
            });
        });
    }

    global.authUi = { $, post, showAlert, setLoading, bindPasswordToggles };
})(window);
