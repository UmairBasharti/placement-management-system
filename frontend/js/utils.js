// Shared helpers loaded before each page script.

// Escape text before putting it inside an HTML template string (prevents stored XSS).
// Use esc() around every value that can contain user- or admin-entered text:
//   el.innerHTML = `<h5>${esc(company.name)}</h5>`;
(function (global) {
    const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

    global.esc = function esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ESCAPES[ch]);
    };

    // Message used when the login token is missing/expired (after redirecting to the home page)
    global.SESSION_EXPIRED = 'Your session has expired. Please log in again.';

    // Show the full-screen spinner only if the work takes longer than ~300 ms (no flicker on fast loads)
    global.withLoading = async function withLoading(fn) {
        const overlay = document.getElementById('loadingOverlay');
        const timer = setTimeout(() => { if (overlay) overlay.style.display = 'flex'; }, 300);
        try {
            return await fn();
        } finally {
            clearTimeout(timer);
            if (overlay) overlay.style.display = 'none';
        }
    };

    // Run a page/section loader: spinner if slow, and turn failures into a friendly toast instead of an
    // unhandled promise rejection. Expects the page to define showNotification(message, type).
    global.guarded = async function guarded(fn) {
        try {
            await withLoading(fn);
        } catch (err) {
            console.error(err);
            if (typeof global.showNotification === 'function') {
                global.showNotification((err && err.message) || 'Something went wrong. Please try again.', 'error');
            }
        }
    };

    // Persistent banner with a Retry button, for when a whole page failed to load
    global.showLoadError = function showLoadError(message) {
        const host = document.querySelector('.main-content');
        if (!host || document.getElementById('load-error')) return;
        const box = document.createElement('div');
        box.id = 'load-error';
        box.setAttribute('role', 'alert');
        box.className = 'alert alert-danger d-flex flex-wrap align-items-center justify-content-between gap-2';
        const text = document.createElement('span');
        text.textContent = message;
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'btn btn-sm btn-outline-danger';
        retry.textContent = 'Retry';
        retry.addEventListener('click', () => window.location.reload());
        box.append(text, retry);
        host.prepend(box);
    };

    // Mobile sidebar: hamburger opens it; overlay click, Esc, choosing a menu item, or growing the
    // window to desktop width closes it.
    global.initSidebar = function initSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const button = document.getElementById('mobile-menu-btn');
        const overlay = document.getElementById('sidebar-overlay');
        if (!sidebar || !button || !overlay) return;

        const setOpen = (open) => {
            sidebar.classList.toggle('active', open);
            overlay.classList.toggle('active', open);
            button.setAttribute('aria-expanded', String(open));
            button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        };
        button.addEventListener('click', () => setOpen(!sidebar.classList.contains('active')));
        overlay.addEventListener('click', () => setOpen(false));
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
        sidebar.addEventListener('click', (e) => { if (e.target.closest('.nav-link')) setOpen(false); });
        window.matchMedia('(min-width: 993px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });
    };

    // Resumes are private: a plain <a href> can't send the login token, so fetch the PDF with the
    // Authorization header and show it from a temporary blob URL in a new tab.
    // Throws an Error with a user-friendly message on failure.
    global.openProtectedPdf = async function openProtectedPdf(endpoint) {
        const tab = window.open('', '_blank');   // open synchronously so popup blockers allow it
        try {
            const res = await fetch('/api' + endpoint, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            if (!res.ok) {
                let message = 'Could not open the resume';
                try { message = (await res.json()).message || message; } catch { /* not JSON */ }
                throw new Error(message);
            }
            const url = URL.createObjectURL(await res.blob());
            if (tab) tab.location.href = url; else window.location.href = url;
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (err) {
            if (tab) tab.close();
            throw err;
        }
    };
})(window);
