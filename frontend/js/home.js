// Home page: signed-in redirect, mobile menu, active link while scrolling, live statistics.

// A visitor who is already signed in goes straight to their dashboard
(function redirectIfSignedIn() {
    try {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (localStorage.getItem('token') && user) {
            window.location.replace(user.role === 'admin' ? 'admin-dashboard.html' : 'student-dashboard.html');
        }
    } catch { /* unreadable storage: show the page */ }
})();

const hamburger = document.getElementById('nav-hamburger');
const panel = document.getElementById('nav-panel');
const navLinks = document.querySelectorAll('.nav-menu .nav-link');

// ── Mobile menu ──────────────────────────────────────────────────────────────
function setMenu(open) {
    panel.classList.toggle('is-open', open);
    hamburger.setAttribute('aria-expanded', String(open));
    hamburger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}

hamburger.addEventListener('click', () => setMenu(!panel.classList.contains('is-open')));
panel.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && !hamburger.contains(e.target)) setMenu(false);   // tap outside
});
window.matchMedia('(min-width: 993px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

// ── Active menu link while scrolling ─────────────────────────────────────────
const sections = [...document.querySelectorAll('main section[id]')];
const linkFor = (id) => [...navLinks].find((l) => l.getAttribute('href') === `#${id}`);

const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((l) => l.classList.remove('active'));
        linkFor(entry.target.id)?.classList.add('active');
    });
}, { rootMargin: '-45% 0px -50% 0px' });
sections.forEach((section) => observer.observe(section));

// ── Live statistics ──────────────────────────────────────────────────────────
function countUp(el, target) {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || target === 0) { el.textContent = target; return; }
    const start = performance.now();
    const duration = 1200;
    (function frame(now) {
        const progress = Math.min((now - start) / duration, 1);
        el.textContent = Math.round(target * progress);
        if (progress < 1) requestAnimationFrame(frame);
    })(start);
}

fetch('/api/public/stats')
    .then((res) => res.json())
    .then(({ data }) => {
        document.getElementById('hero-stats').hidden = false;
        countUp(document.getElementById('stat-students'), data.students);
        countUp(document.getElementById('stat-companies'), data.companies);
        countUp(document.getElementById('stat-placed'), data.placed);
    })
    .catch(() => { /* no numbers rather than wrong ones: the block stays hidden */ });
