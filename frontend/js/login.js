// Log in and registration. Needs utils.js (esc).

const $ = (id) => document.getElementById(id);
const container = $('auth-container');
const adminMode = new URLSearchParams(window.location.search).get('admin') === 'true';

// Already signed in? Go straight to the dashboard.
try {
    const stored = JSON.parse(localStorage.getItem('currentUser'));
    if (localStorage.getItem('token') && stored) {
        window.location.replace(stored.role === 'admin' ? 'admin-dashboard.html' : 'student-dashboard.html');
    }
} catch { /* unreadable storage: show the form */ }

// Helpers
async function post(endpoint, body) {
    const res = await fetch(`/api${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    let data;
    try { data = await res.json(); } catch { throw new Error('The server sent an unexpected response'); }
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
}

function showAlert(message, type = 'danger') {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.setAttribute('role', type === 'danger' ? 'alert' : 'status');
    alert.innerHTML = `<i class="fas fa-${type === 'danger' ? 'circle-exclamation' : 'circle-check'}" aria-hidden="true"></i><span>${esc(message)}</span>`;
    $('alert-area').appendChild(alert);
    setTimeout(() => alert.classList.add('leaving'), 3700);
    setTimeout(() => alert.remove(), 4000);
}

function setLoading(button, loading) {
    button.disabled = loading;
    button.classList.toggle('is-loading', loading);
}

// Switching between the two forms
function showRegister(register) {
    container.classList.toggle('active', register);
    // The hidden form must not be reachable with Tab or a screen reader
    $('register-box').inert = !register;
    $('login-box').inert = register;
    (register ? $('register-name') : $('login-email')).focus({ preventScroll: true });
}

document.querySelector('.register-btn').addEventListener('click', () => showRegister(true));
document.querySelector('.login-btn').addEventListener('click', () => showRegister(false));
$('register-box').inert = true;

if (adminMode) {
    $('login-title').textContent = 'Admin log in';
    document.querySelector('.toggle-box').remove();
    $('register-box').remove();
    $('login-box').style.cssText = 'position: relative; width: 100%;';
}

// Show / hide password
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

// Course list from the server (the HTML keeps a fallback)
fetch('/api/public/meta')
    .then((res) => res.json())
    .then(({ data }) => {
        const select = $('register-branch');
        if (!select || !data.branches.length) return;
        select.length = 1;   // keep the "Select your course" placeholder
        data.branches.forEach((branch) => select.add(new Option(branch, branch)));
    })
    .catch(() => { /* the fallback options in the HTML stay */ });

// Register
$('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('register-name').value.trim();
    const email = $('register-email').value.trim();
    const password = $('register-password').value;
    const branch = $('register-branch').value;

    if (!name || !email || !branch) return showAlert('Please fill in every field.');
    if (password.length < 6) return showAlert('Password must be at least 6 characters.');
    if (password !== $('register-confirm-password').value) return showAlert('The two passwords do not match.');

    const button = e.target.querySelector('button[type="submit"]');
    setLoading(button, true);
    try {
        await post('/auth/register', { name, email, password, branch });
        showAlert('Account created. You can log in now.', 'success');
        e.target.reset();
        showRegister(false);
        $('login-email').value = email;
        $('login-password').focus();
    } catch (err) {
        showAlert(err.message);
    } finally {
        setLoading(button, false);
    }
});

// Log in
$('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('login-email').value.trim();
    const password = $('login-password').value;
    if (!email || !password) return showAlert('Enter your email and password.');

    const button = e.target.querySelector('button[type="submit"]');
    setLoading(button, true);
    try {
        const { token, user } = await post('/auth/login', { email, password });

        // Each login page only admits its own kind of user
        if (adminMode && user.role !== 'admin') throw new Error('This login is for administrators only.');
        if (!adminMode && user.role === 'admin') throw new Error('Administrators log in from the "Admin login" button on the home page.');

        localStorage.setItem('token', token);
        localStorage.setItem('currentUser', JSON.stringify(user));
        showAlert('Logged in. Redirecting…', 'success');
        setTimeout(() => {
            window.location.href = user.role === 'admin' ? 'admin-dashboard.html' : 'student-dashboard.html';
        }, 500);
    } catch (err) {
        showAlert(err.message);
        setLoading(button, false);
    }
});
