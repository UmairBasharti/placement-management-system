// ═══════════════════════════════════════════════════════════════
//  LOGIN / REGISTER — async/await, clean & readable
// ═══════════════════════════════════════════════════════════════

const API = '/api';

// ── Helpers ───────────────────────────────────────────────────

/**
 * Make an API call with JSON body.
 * Automatically attaches JWT if present.
 */
async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem('token');

    const response = await fetch(API + endpoint, {
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        ...options
    });

    let data;
    try {
        data = await response.json();
    } catch {
        throw new Error('Server returned an unexpected response');
    }

    if (!response.ok) {
        throw new Error(data.message || 'Request failed');
    }

    return data;
}

/**
 * Show a floating alert at the top-right corner.
 */
function showAlert(message, type = 'danger') {
    const icon = type === 'danger' ? 'exclamation-circle' : 'check-circle';
    const div  = document.createElement('div');
    div.className = `alert alert-${type}`;
    div.innerHTML = `<i class="fas fa-${icon}"></i> ${esc(message)}`;
    document.body.appendChild(div);

    setTimeout(() => div.remove(), 3000);
}

/**
 * Toggle the loading spinner on a button.
 */
function setLoading(button, isLoading) {
    button.disabled = isLoading;
    button.classList.toggle('is-loading', isLoading);   // NOT "loading": that class is the global full-screen overlay (display:none)
}

// ── Admin mode detection ──────────────────────────────────────
const urlParams   = new URLSearchParams(window.location.search);
const isAdminMode = urlParams.get('admin') === 'true';

if (isAdminMode) {
    // Update UI to show admin-specific login
    const title = document.getElementById('login-title');
    if (title) title.textContent = 'Admin Login';

    // Hide register panel and toggle for admin mode
    const registerFormBox = document.querySelector('.form-box.register');
    const toggleBox       = document.querySelector('.toggle-box');
    if (registerFormBox) registerFormBox.style.display = 'none';
    if (toggleBox)       toggleBox.style.display       = 'none';

    // Make the login form take full width in admin mode
    const loginFormBox = document.querySelector('.form-box.login');
    if (loginFormBox) {
        loginFormBox.style.width    = '100%';
        loginFormBox.style.position = 'relative';
    }
}

// ── Form switching (login ↔ register) ─────────────────────────
const container   = document.querySelector('.container');
const registerBtn = document.querySelector('.register-btn');
const loginBtn    = document.querySelector('.login-btn');

if (registerBtn) {
    registerBtn.addEventListener('click', () => container.classList.add('active'));
}
if (loginBtn) {
    loginBtn.addEventListener('click', () => container.classList.remove('active'));
}

// ── Password visibility toggle ────────────────────────────────
document.querySelectorAll('.toggle-password').forEach(icon => {
    icon.addEventListener('click', function () {
        const input = this.previousElementSibling;
        const isHidden = input.type === 'password';

        input.type = isHidden ? 'text' : 'password';
        this.classList.toggle('bxs-lock-alt', !isHidden);
        this.classList.toggle('bxs-lock-open-alt', isHidden);
    });
});

// ── Register ──────────────────────────────────────────────────
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = registerForm.querySelector('button[type="submit"]');
        setLoading(btn, true);

        const name            = document.getElementById('register-name').value.trim();
        const email           = document.getElementById('register-email').value.trim();
        const password        = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;
        const branch          = document.getElementById('register-branch').value;

        if (password !== confirmPassword) {
            showAlert('Passwords do not match!');
            setLoading(btn, false);
            return;
        }

        try {
            // role is always 'student' — backend enforces it too
            await apiFetch('/auth/register', {
                method: 'POST',
                body: JSON.stringify({ name, email, password, role: 'student', branch })
            });

            showAlert('Registration successful! Please login.', 'success');
            container.classList.remove('active'); // switch to login view
            registerForm.reset();
        } catch (error) {
            showAlert(error.message);
        } finally {
            setLoading(btn, false);
        }
    });
}

// ── Login ─────────────────────────────────────────────────────
const loginForm = document.getElementById('login-form');
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = loginForm.querySelector('button[type="submit"]');
    setLoading(btn, true);

    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    try {
        const data = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        const userRole = data.user.role;

        // ── Role enforcement BEFORE showing any success ──
        //
        // Admin login page (?admin=true) → only admin can log in
        // Student login page (no param)  → only student can log in
        if (isAdminMode && userRole !== 'admin') {
            showAlert('Access denied — this login is for administrators only.', 'danger');
            setLoading(btn, false);
            return;   // don't store token, don't redirect
        }

        if (!isAdminMode && userRole === 'admin') {
            showAlert('Access denied — admins must use the Admin Login page.', 'danger');
            setLoading(btn, false);
            return;   // don't store token, don't redirect
        }

        // Role is correct — store session and redirect
        localStorage.setItem('token', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));

        showAlert('Login successful!', 'success');

        const destination = userRole === 'admin'
            ? 'admin-dashboard.html'
            : 'student-dashboard.html';

        setTimeout(() => {
            window.location.href = destination;
        }, 800);
    } catch (error) {
        showAlert(error.message || 'Invalid email or password');
    } finally {
        setLoading(btn, false);
    }
});
