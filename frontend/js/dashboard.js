// Runtime shared by the student and admin dashboards: session, API client, toasts, navigation.
// Needs utils.js to be loaded first.
(function (global) {
    function logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }

    function readUser() {
        try { return JSON.parse(localStorage.getItem('currentUser')); } catch { return null; }
    }

    // Returns the logged-in user if they have this role; otherwise sends them back to the home page and returns null
    function requireRole(role) {
        const user = readUser();
        if (!user || user.role !== role || !localStorage.getItem('token')) {
            logout();
            return null;
        }
        return user;
    }

    // JSON API call with the login token. Throws an Error carrying the server's message.
    async function apiFetch(endpoint, { headers, body, ...options } = {}) {
        const token = localStorage.getItem('token');
        if (!token) { logout(); throw new Error(global.SESSION_EXPIRED); }

        const res = await fetch('/api' + endpoint, {
            ...options,
            body,
            headers: {
                ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
                Authorization: `Bearer ${token}`,
                ...headers
            }
        });

        if (res.status === 401) { logout(); throw new Error(global.SESSION_EXPIRED); }

        let data;
        try { data = await res.json(); } catch { throw new Error('The server sent an unexpected response'); }
        if (!res.ok) throw new Error(data.message || 'Request failed');
        return data;
    }

    // Toasts stack in one fixed container, so several can show at once
    function showNotification(message, type = 'success') {
        const icons = { success: 'check-circle', error: 'times-circle', warning: 'exclamation-triangle' };
        let stack = document.getElementById('toast-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.id = 'toast-stack';
            stack.className = 'toast-stack';
            document.body.appendChild(stack);
        }
        const toast = document.createElement('div');
        toast.className = `notification ${type}`;
        toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
        toast.innerHTML = `<i class="fas fa-${icons[type] || 'info-circle'} me-2"></i><span>${esc(message)}</span>`;
        stack.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // Sidebar navigation: shows one section at a time, runs that section's loader, keeps the URL hash
    // in sync (so a refresh stays on the same section), and wires [data-goto="section"] shortcut buttons.
    function initNavigation(loaders, defaultSection = 'dashboard') {
        const links = [...document.querySelectorAll('.sidebar .nav-link[data-section]')];
        const sections = [...document.querySelectorAll('.section')];
        const title = document.getElementById('section-title');

        async function show(name) {
            const link = links.find((l) => l.dataset.section === name) || links.find((l) => l.dataset.section === defaultSection);
            name = link.dataset.section;
            links.forEach((l) => {
                l.classList.toggle('active', l === link);
                if (l === link) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current');
            });
            sections.forEach((s) => { s.hidden = s.id !== `${name}-section`; });
            title.textContent = link.textContent.trim();
            history.replaceState(null, '', `#${name}`);
            return loaders[name] ? global.guarded(loaders[name]) : true;
        }

        document.addEventListener('click', (e) => {
            const link = e.target.closest('.sidebar .nav-link[data-section]');
            const shortcut = e.target.closest('[data-goto]');
            if (link) { e.preventDefault(); show(link.dataset.section); }
            else if (shortcut) { e.preventDefault(); show(shortcut.dataset.goto); }
        });
        document.getElementById('logout').addEventListener('click', (e) => { e.preventDefault(); logout(); });

        return show(window.location.hash.slice(1) || defaultSection);
    }

    // Option lists (branches, job types) come from the server so there is one source of truth.
    let metaPromise;
    function loadMeta() {
        metaPromise ||= fetch('/api/public/meta').then((r) => r.json()).then((j) => j.data);
        return metaPromise;
    }

    // Fills <select data-options="branches|jobTypes"> and <div data-branch-checkboxes>
    async function fillOptionLists() {
        const meta = await loadMeta();
        document.querySelectorAll('select[data-options]').forEach((select) => {
            (meta[select.dataset.options] || []).forEach((value) => select.add(new Option(value, value)));
        });
        document.querySelectorAll('[data-branch-checkboxes]').forEach((box) => {
            box.innerHTML = meta.branches.map((b) => `
                <div class="form-check form-check-inline">
                    <input class="form-check-input" type="checkbox" id="branch-${esc(b)}" value="${esc(b)}">
                    <label class="form-check-label" for="branch-${esc(b)}">${esc(b)}</label>
                </div>`).join('');
        });
    }

    // The login is stored per browser, not per tab. If another tab signs in or out, reload this one so it
    // can never keep acting as the previous user (requireRole sends it away if the role no longer fits).
    global.addEventListener('storage', (e) => {
        if (e.key === 'token' || e.key === 'currentUser') global.location.reload();
    });

    Object.assign(global, { logout, requireRole, apiFetch, showNotification, initNavigation, loadMeta, fillOptionLists });
})(window);
