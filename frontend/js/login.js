// Log in and registration. Needs utils.js and auth-common.js.

const { $, post, showAlert, setLoading, bindPasswordToggles } = window.authUi;
const container = $('auth-container');
const adminMode = new URLSearchParams(window.location.search).get('admin') === 'true';

// Already signed in? Go straight to the dashboard.
try {
    const stored = JSON.parse(localStorage.getItem('currentUser'));
    if (localStorage.getItem('token') && stored) {
        window.location.replace(stored.role === 'admin' ? 'admin-dashboard.html' : 'student-dashboard.html');
    }
} catch { /* unreadable storage: show the form */ }

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
bindPasswordToggles();

// Course list and password limits from the server (the HTML and these defaults are the fallback)
let passwordMin = 8;
let passwordMax = 72;
fetch('/api/public/meta')
    .then((res) => res.json())
    .then(({ data }) => {
        passwordMin = data.passwordMin || passwordMin;
        passwordMax = data.passwordMax || passwordMax;
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
    if (password.length < passwordMin || password.length > passwordMax) return showAlert(`Password must be ${passwordMin}-${passwordMax} characters.`);
    if (password !== $('register-confirm-password').value) return showAlert('The two passwords do not match.');

    const button = e.target.querySelector('button[type="submit"]');
    setLoading(button, true);
    try {
        const { message, emailSent } = await post('/auth/register', { name, email, password, branch });
        // The account cannot log in until the e-mailed link is opened, so this message stays up longer
        showAlert(message, emailSent ? 'success' : 'danger', 10000);
        e.target.reset();
        showRegister(false);
        $('login-email').value = email;
        $('resend-verification').hidden = false;   // in case the e-mail does not arrive
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
        showAlert(err.message, 'danger', err.code === 'EMAIL_NOT_VERIFIED' ? 8000 : 4000);
        if (err.code === 'EMAIL_NOT_VERIFIED') $('resend-verification').hidden = false;
        setLoading(button, false);
    }
});

// Ask for a new verification e-mail (shown after registering and after a login blocked as "not verified")
$('resend-verification').addEventListener('click', async (e) => {
    const email = $('login-email').value.trim();
    if (!email) return showAlert('Enter your email above first.');

    const button = e.currentTarget;
    button.disabled = true;
    try {
        const { message } = await post('/auth/resend-verification', { email });
        showAlert(message, 'success', 8000);
    } catch (err) {
        showAlert(err.message);
    } finally {
        button.disabled = false;
    }
});
