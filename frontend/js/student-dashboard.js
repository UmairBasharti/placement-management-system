// Student dashboard: profile, resume, companies and applications, events, notifications.
// Depends on utils.js and dashboard.js (apiFetch, requireRole, showNotification, initNavigation …).

const user = requireRole('student');

const state = {
    profile: null,
    companies: [],
    applications: [],
    events: [],
    recommended: [],           // jobs ranked for this student (all of them, best first)
    matches: new Map(),        // company id → { matchScore, matchedSkills, missingSkills }
    hasSkills: false
};

const $ = (id) => document.getElementById(id);
const detailsModal = new bootstrap.Modal($('detailsModal'));
const scanModal = new bootstrap.Modal($('scanModal'));

const PROGRESS = { 'Unplaced': 0, 'Under Review': 50, 'Interview Scheduled': 75, 'Placed': 100 };
const APPLICATION_ICON = { Accepted: 'circle-check', Rejected: 'circle-xmark', Pending: 'clock' };

// ── Data ─────────────────────────────────────────────────────────────────────
async function fetchProfile() {
    state.profile = (await apiFetch('/students/me')).data;
    renderUnreadBadge();
    renderPlacementStatus();
}

async function fetchApplications() {
    state.applications = (await apiFetch('/applications/my')).data;
}

async function fetchEvents() {
    state.events = (await apiFetch('/events')).data;
}

async function fetchCompanies() {
    state.companies = (await apiFetch('/companies')).data;
}

async function fetchRecommendations() {
    const res = await apiFetch('/companies/recommended?limit=50');
    state.recommended = res.data;
    state.hasSkills = res.meta.hasSkills;
    state.matches = new Map(res.data.map((r) => [r.company._id, r]));
}

const applicationFor = (companyId) => state.applications.find((a) => a.company && a.company._id === companyId);

// ── Small view helpers ───────────────────────────────────────────────────────
function emptyState(text, shortcuts = []) {
    const buttons = shortcuts.map(([section, label]) =>
        `<button type="button" class="btn btn-sm btn-outline-primary me-2" data-goto="${section}">${esc(label)}</button>`).join('');
    return `<div class="empty-state"><p class="mb-2">${esc(text)}</p>${buttons}</div>`;
}

function applicationStatusLabel(status) {
    return `<span class="status-${statusSlug(status)} fw-semibold"><i class="fas fa-${APPLICATION_ICON[status] || 'clock'}" aria-hidden="true"></i> ${esc(status)}</span>`;
}

function matchBadge(score) {
    const level = score >= 70 ? '' : score >= 40 ? ' is-medium' : ' is-low';
    return `<span class="match-badge${level}">${score}% match</span>`;
}

function skillChips(skills, kind, max = Infinity) {
    const shown = skills.slice(0, max).map((s) => `<span class="skill-chip ${kind}">${esc(s)}</span>`).join('');
    const more = skills.length > max ? `<span class="skill-chip ${kind}">+${skills.length - max} more</span>` : '';
    return shown + more;
}

const companyMeta = (c) => `
    <div class="company-meta">
        <span><i class="fas fa-location-dot" aria-hidden="true"></i>${esc(c.location)}</span>
        <span><i class="fas fa-briefcase" aria-hidden="true"></i>${esc(c.jobType)}</span>
        <span><i class="fas fa-indian-rupee-sign" aria-hidden="true"></i>${esc(c.package || 'Not disclosed')}</span>
    </div>`;

const splitSkills = (text) => String(text || '').split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);

// ── Dashboard ────────────────────────────────────────────────────────────────
function profileChecks() {
    const p = state.profile;
    const resume = p.resume || {};
    return {
        skills: Boolean((p.skills || '').trim()),
        education: Boolean((p.education || '').trim()),
        projects: Boolean((p.projects || '').trim()),
        resume: Boolean(resume.fileId),
        approved: resume.status === 'approved'
    };
}

function renderPlacementStatus() {
    const status = state.profile.status || 'Unplaced';
    for (const el of [$('current-status'), $('dash-status-badge')]) {
        el.className = `status-badge status-${statusSlug(status)}`;
        el.innerHTML = `<i class="fas fa-circle" aria-hidden="true"></i> ${esc(status)}`;
    }
}

function renderDashboard() {
    const p = state.profile;
    renderPlacementStatus();

    const history = p.statusHistory || [];
    $('status-updated-time').textContent = history.length
        ? `Last updated: ${formatDateTime(history[history.length - 1].timestamp)}`
        : 'Last updated: never';
    const progress = PROGRESS[p.status] ?? 0;
    $('status-progress-bar').style.width = `${progress}%`;
    $('status-progress-bar').parentElement.setAttribute('aria-valuenow', progress);

    const count = (status) => state.applications.filter((a) => a.status === status).length;
    const total = state.applications.length;
    const [pending, accepted, rejected] = [count('Pending'), count('Accepted'), count('Rejected')];
    $('app-total-count').textContent = total;
    $('app-pending-label').innerHTML = `<i class="fas fa-clock" aria-hidden="true"></i> Pending: ${pending}`;
    $('app-accepted-label').innerHTML = `<i class="fas fa-circle-check" aria-hidden="true"></i> Accepted: ${accepted}`;
    $('app-rejected-label').innerHTML = `<i class="fas fa-circle-xmark" aria-hidden="true"></i> Rejected: ${rejected}`;
    const share = (n) => `${total ? (n / total) * 100 : 0}%`;
    $('pending-progress-bar').style.width = share(pending);
    $('accepted-progress-bar').style.width = share(accepted);
    $('rejected-progress-bar').style.width = share(rejected);

    const checks = profileChecks();
    const done = Object.values(checks).filter(Boolean).length;
    const pct = Math.round((done / Object.keys(checks).length) * 100);
    $('profile-progress-bar').style.width = `${pct}%`;
    $('profile-progress-bar').parentElement.setAttribute('aria-valuenow', pct);
    $('profile-completion-pct').textContent = `${pct}% complete`;
    for (const [key, ok] of Object.entries(checks)) {
        $(`check-${key}`).className = `fas fa-${ok ? 'circle-check text-success' : 'circle-xmark text-danger'} me-2`;
    }

    renderRecommended();
    renderRecentApplications();
    renderUpcomingEvents();
}

function renderRecommended() {
    const el = $('recommended-list');
    if (!state.hasSkills) {
        el.innerHTML = emptyState('Add your skills or upload your resume to get job recommendations.', [['profile', 'Add skills'], ['resume', 'Upload resume']]);
        return;
    }
    const top = state.recommended.slice(0, 6);
    if (!top.length) {
        el.innerHTML = emptyState('No matching jobs right now. New companies appear here as they are posted.');
        return;
    }
    el.innerHTML = top.map(({ company: c, matchScore, matchedSkills, missingSkills }) => `
        <div class="recommendation">
            <div class="d-flex justify-content-between align-items-start gap-2">
                <div>
                    <h3>${esc(c.name)}</h3>
                    ${companyMeta(c)}
                </div>
                ${matchBadge(matchScore)}
            </div>
            <div class="skill-row">${skillChips(matchedSkills, 'matched')}${skillChips(missingSkills, 'missing', 4)}</div>
            <div class="company-actions">
                <button type="button" class="action-btn view-btn" data-action="company-details" data-id="${esc(c._id)}">View details</button>
                <button type="button" class="action-btn apply-btn" data-action="apply" data-id="${esc(c._id)}">Apply</button>
            </div>
        </div>`).join('');
}

function renderRecentApplications() {
    const recent = state.applications.slice(0, 3);   // the API returns newest first
    $('recent-applications').innerHTML = recent.length
        ? recent.map((a) => `
            <div class="d-flex justify-content-between align-items-center gap-2 py-2 border-bottom">
                <div>
                    <h3 class="h6 mb-0">${esc(a.company ? a.company.name : 'Removed company')}</h3>
                    <small class="text-muted">Applied on ${formatDate(a.appliedDate)}</small>
                </div>
                ${applicationStatusLabel(a.status)}
            </div>`).join('')
        : emptyState('You have not applied to any company yet.', [['companies', 'Browse companies']]);
}

function renderUpcomingEvents() {
    const upcoming = state.events.filter((ev) => new Date(ev.date) > new Date()).slice(0, 3);
    $('upcoming-events').innerHTML = upcoming.length
        ? upcoming.map((ev) => `
            <div class="d-flex justify-content-between align-items-center gap-2 py-2 border-bottom">
                <div>
                    <h3 class="h6 mb-0">${esc(ev.title)}</h3>
                    <small class="text-muted"><i class="fas fa-clock me-1" aria-hidden="true"></i>${formatDateTime(ev.date)}</small>
                </div>
                <button type="button" class="btn btn-sm btn-outline-primary" data-action="event-details" data-id="${esc(ev._id)}" aria-label="Details of ${esc(ev.title)}">
                    <i class="fas fa-circle-info" aria-hidden="true"></i>
                </button>
            </div>`).join('')
        : emptyState('No upcoming events.');
}

// ── Companies ────────────────────────────────────────────────────────────────
function renderCompanies() {
    const query = $('search-company').value.trim().toLowerCase();
    const type = $('filter-job-type').value;
    const bestMatch = $('sort-companies').value === 'match';
    const score = (c) => (state.matches.has(c._id) ? state.matches.get(c._id).matchScore : -1);
    const newest = (a, b) => new Date(b.postedDate) - new Date(a.postedDate);

    const list = state.companies
        .filter((c) => (!query || c.name.toLowerCase().includes(query) || c.location.toLowerCase().includes(query)) && (!type || c.jobType === type))
        .sort(bestMatch ? (a, b) => score(b) - score(a) || newest(a, b) : newest);

    $('companies-list').innerHTML = list.length ? list.map((c) => {
        const application = applicationFor(c._id);
        const match = state.matches.get(c._id);
        return `
        <article class="company-card">
            <div class="d-flex justify-content-between align-items-start gap-2">
                <h3>${esc(c.name)}</h3>
                ${match ? matchBadge(match.matchScore) : ''}
            </div>
            ${companyMeta(c)}
            <p class="mb-0">${esc(c.description)}</p>
            <div class="company-tags">
                <span class="company-tag">${esc(c.branches.join(', '))}</span>
                ${c.requirements ? `<span class="company-tag">${esc(c.requirements)}</span>` : ''}
            </div>
            <div class="company-actions">
                <button type="button" class="action-btn view-btn" data-action="company-details" data-id="${esc(c._id)}">View details</button>
                ${application
                    ? `<span class="application-status">${applicationStatusLabel(application.status)}<small class="text-muted">Applied on ${formatDate(application.appliedDate)}</small></span>`
                    : `<button type="button" class="action-btn apply-btn" data-action="apply" data-id="${esc(c._id)}"><i class="fas fa-paper-plane me-1" aria-hidden="true"></i>Apply</button>`}
            </div>
        </article>`;
    }).join('') : emptyState('No companies match your filters.');
}

function openCompanyDetails(id) {
    const c = state.companies.find((x) => x._id === id) || (state.matches.get(id) || {}).company;
    if (!c) return;
    const application = applicationFor(id);
    const match = state.matches.get(id);

    $('detailsModalTitle').textContent = c.name;
    $('detailsModalBody').innerHTML = `
        <div class="detail-grid">
            <div class="detail-item"><span class="label">Job type</span><span class="value">${esc(c.jobType)}</span></div>
            <div class="detail-item"><span class="label">Package</span><span class="value">${esc(c.package || 'Not disclosed')}</span></div>
            <div class="detail-item"><span class="label">Location</span><span class="value">${esc(c.location)}</span></div>
            <div class="detail-item"><span class="label">Open to</span><span class="value">${esc(c.branches.join(', '))}</span></div>
            <div class="detail-item"><span class="label">Requirements</span><span class="value">${esc(c.requirements || 'Not specified')}</span></div>
            <div class="detail-item"><span class="label">Posted</span><span class="value">${formatDate(c.postedDate)}</span></div>
        </div>
        <p class="mt-3">${esc(c.description)}</p>
        ${match ? `
            <h3 class="fs-6 mt-3">How you match <span class="ms-2">${matchBadge(match.matchScore)}</span></h3>
            <div class="skill-row">${skillChips(match.matchedSkills, 'matched')}${skillChips(match.missingSkills, 'missing')}</div>
            <p class="form-text">Green: skills you already have. Grey: skills this job asks for that are not on your profile yet.</p>` : ''}
        <div class="mt-4">
            ${application
                ? `<div class="alert alert-secondary mb-0">Your application: ${applicationStatusLabel(application.status)} <small class="text-muted ms-2">Applied on ${formatDateTime(application.appliedDate)}</small></div>`
                : `<button type="button" class="btn btn-primary" data-action="apply" data-id="${esc(c._id)}"><i class="fas fa-paper-plane me-1" aria-hidden="true"></i>Apply now</button>
                   <p class="form-text mt-2 mb-0">You need skills on your profile and a resume approved by the placement cell.</p>`}
        </div>`;
    detailsModal.show();
}

async function applyTo(companyId, button) {
    button.disabled = true;
    try {
        await apiFetch('/applications', { method: 'POST', body: JSON.stringify({ companyId }) });
        detailsModal.hide();
        showNotification('Application submitted');
        await Promise.all([fetchProfile(), fetchApplications(), fetchRecommendations()]);
        renderDashboard();
        renderCompanies();
    } catch (err) {
        showNotification(err.message, 'error');
        button.disabled = false;
    }
}

// ── Profile ──────────────────────────────────────────────────────────────────
function renderProfile() {
    const p = state.profile;
    $('profile-name').value = p.name || '';
    $('profile-email').value = p.email || '';
    $('profile-course').value = p.course || '';
    $('profile-skills').value = p.skills || '';
    $('profile-education').value = p.education || '';
    $('profile-projects').value = p.projects || '';
}

$('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await apiFetch('/students/me', {
            method: 'PUT',
            body: JSON.stringify({
                name: $('profile-name').value,
                skills: $('profile-skills').value,
                education: $('profile-education').value,
                projects: $('profile-projects').value
            })
        });
        await fetchProfile();
        showNotification('Profile saved');
    } catch (err) {
        showNotification(err.message, 'error');
    }
});

// ── Resume ───────────────────────────────────────────────────────────────────
const RESUME_LOOK = {
    approved: ['alert-success', 'circle-check', 'approved — you can apply to companies'],
    pending: ['alert-warning', 'clock', 'waiting for approval by the placement cell'],
    rejected: ['alert-danger', 'circle-xmark', 'rejected — please upload a new one']
};

function renderResume() {
    const r = state.profile.resume;
    const uploaded = Boolean(r && r.fileId);

    if (!uploaded) {
        $('resume-status').innerHTML = '';
        $('resume-preview').innerHTML = emptyState('No resume uploaded yet.');
        return;
    }
    const [tone, icon, text] = RESUME_LOOK[r.status] || RESUME_LOOK.pending;
    $('resume-status').innerHTML = `
        <div class="alert ${tone} mb-0">
            <i class="fas fa-${icon} me-2" aria-hidden="true"></i>Resume ${text}
            <br><small>${esc(r.name)} · uploaded ${formatDateTime(r.uploadedAt)}</small>
        </div>`;
    $('resume-preview').innerHTML = `
        <div class="resume-card">
            <i class="fas fa-file-pdf resume-icon" aria-hidden="true"></i>
            <p class="mb-1 fw-semibold">${esc(r.name)}</p>
            <div class="d-flex flex-wrap justify-content-center gap-2">
                <button type="button" class="btn btn-primary" data-action="open-resume"><i class="fas fa-eye me-1" aria-hidden="true"></i>View resume</button>
                <button type="button" class="btn btn-outline-primary" data-action="scan-resume"><i class="fas fa-wand-magic-sparkles me-1" aria-hidden="true"></i>Fill my profile from this resume</button>
            </div>
        </div>`;
}

$('resume-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = $('resume-file').files[0];
    if (!file) return;
    if (!/\.pdf$/i.test(file.name)) return showNotification('Please choose a PDF file', 'error');
    if (file.size > 5 * 1024 * 1024) return showNotification('File too large (maximum 5 MB)', 'error');

    const button = $('resume-submit');
    button.disabled = true;
    button.textContent = 'Uploading…';
    try {
        const form = new FormData();
        form.append('resume', file);
        await apiFetch('/students/me/resume', { method: 'POST', body: form });
        e.target.reset();
        await fetchProfile();
        renderResume();
        showNotification('Resume uploaded. The placement cell will review it.');
        await scanResume({ auto: true });
    } catch (err) {
        showNotification(err.message, 'error');
    } finally {
        button.disabled = false;
        button.textContent = 'Upload';
    }
});

// Read the resume on the server and offer the result in a dialog; nothing is saved until the student confirms
async function scanResume({ auto = false } = {}) {
    try {
        const { data } = await apiFetch('/students/me/resume/suggestions');
        if (!data.textFound) {
            return showNotification('This PDF has no readable text (it may be a scan), so please fill in your profile by hand.', 'warning');
        }
        if (!data.skills.length && !data.education && !data.projects) {
            return showNotification('We could not recognise any skills or sections in this resume. Please fill in your profile by hand.', 'warning');
        }
        openScanModal(data);
    } catch (err) {
        showNotification(err.message, auto ? 'warning' : 'error');
    }
}

function openScanModal(found) {
    const p = state.profile;
    const have = new Set(splitSkills(p.skills).map((s) => s.toLowerCase()));

    $('scan-skills-block').hidden = !found.skills.length;
    $('scan-skills').innerHTML = found.skills.map((skill) => {
        const owned = have.has(skill.toLowerCase());
        return `<label class="skill-chip scan-skill${owned ? ' matched' : ''}">
            <input type="checkbox" value="${esc(skill)}" checked${owned ? ' disabled' : ''}> ${esc(skill)}${owned ? ' <small>(already on your profile)</small>' : ''}
        </label>`;
    }).join('');

    for (const field of ['education', 'projects']) {
        $(`scan-${field}-block`).hidden = !found[field];
        $(`scan-${field}`).value = found[field];
        $(`scan-${field}-use`).checked = !p[field];                       // pre-tick only if the profile field is empty
        $(`scan-${field}-note`).textContent = p[field] ? '(replaces your current text)' : '';
    }
    scanModal.show();
}

$('scan-apply').addEventListener('click', async () => {
    const chosen = [...document.querySelectorAll('#scan-skills input:checked:not(:disabled)')].map((i) => i.value);
    const body = {};
    if (chosen.length) body.skills = [...splitSkills(state.profile.skills), ...chosen].join(', ');
    for (const field of ['education', 'projects']) {
        const text = $(`scan-${field}`).value.trim();
        if ($(`scan-${field}-use`).checked && text) body[field] = text;
    }
    if (!Object.keys(body).length) return scanModal.hide();

    $('scan-apply').disabled = true;
    try {
        await apiFetch('/students/me', { method: 'PUT', body: JSON.stringify(body) });
        await Promise.all([fetchProfile(), fetchRecommendations()]);
        renderProfile();
        renderDashboard();
        scanModal.hide();
        showNotification('Your profile was updated from your resume');
    } catch (err) {
        showNotification(err.message, 'error');
    } finally {
        $('scan-apply').disabled = false;
    }
});

// ── Status timeline ──────────────────────────────────────────────────────────
function renderStatusTimeline() {
    const history = [...(state.profile.statusHistory || [])].reverse();
    $('status-timeline').innerHTML = history.length
        ? history.map((h) => `
            <div class="timeline-item">
                <div class="timeline-content">
                    <h3 class="h6 mb-1">${esc(h.status)}</h3>
                    <small class="text-muted">${formatDateTime(h.timestamp)}</small>
                    ${h.message ? `<p class="mt-2 mb-0">${esc(h.message)}</p>` : ''}
                </div>
            </div>`).join('')
        : emptyState('No status changes yet. Your history appears here once you apply to a company.');
}

// ── Calendar ─────────────────────────────────────────────────────────────────
function renderCalendar() {
    const mine = new Set((state.profile.events || []).map((e) => e.eventId));
    const events = [...state.events].sort((a, b) => new Date(a.date) - new Date(b.date));

    $('calendar').innerHTML = events.length ? events.map((ev) => {
        const upcoming = new Date(ev.date) > new Date();
        const added = mine.has(ev._id);
        return `
        <div class="calendar-event ${upcoming ? 'upcoming' : 'past'}">
            <div class="d-flex justify-content-between align-items-start gap-3">
                <div>
                    <h3 class="h6 mb-1">${esc(ev.title)}</h3>
                    <small class="text-muted"><i class="fas fa-clock me-1" aria-hidden="true"></i>${formatDateTime(ev.date)}</small>
                    ${ev.description ? `<p class="mt-2 mb-0">${esc(ev.description)}</p>` : ''}
                    ${upcoming ? '' : '<span class="badge bg-secondary mt-2">Past event</span>'}
                </div>
                <div class="event-actions">
                    ${upcoming ? `<button type="button" class="btn btn-sm ${added ? 'btn-success' : 'btn-primary'}" data-action="calendar-toggle" data-id="${esc(ev._id)}" data-added="${added}">
                        <i class="fas fa-${added ? 'check' : 'calendar-plus'} me-1" aria-hidden="true"></i>${added ? 'Added' : 'Add to my calendar'}</button>` : ''}
                    <button type="button" class="btn btn-sm btn-outline-secondary" data-action="event-details" data-id="${esc(ev._id)}" aria-label="Details of ${esc(ev.title)}"><i class="fas fa-circle-info" aria-hidden="true"></i></button>
                </div>
            </div>
        </div>`;
    }).join('') : emptyState('No events scheduled yet.');
}

async function toggleCalendar(button) {
    const removing = button.dataset.added === 'true';
    button.disabled = true;
    try {
        await apiFetch(removing ? `/students/me/events/${button.dataset.id}` : '/students/me/events', {
            method: removing ? 'DELETE' : 'POST',
            body: removing ? undefined : JSON.stringify({ eventId: button.dataset.id })
        });
        await fetchProfile();
        showNotification(removing ? 'Removed from your calendar' : 'Added to your calendar');
    } catch (err) {
        showNotification(err.message, 'error');
    }
    renderCalendar();   // also re-enables the button after a failure
}

function openEventDetails(id) {
    const ev = state.events.find((x) => x._id === id);
    if (!ev) return;
    $('detailsModalTitle').textContent = ev.title;
    $('detailsModalBody').innerHTML = `
        <p><strong>When:</strong> ${formatDateTime(ev.date)} (${new Date(ev.date) > new Date() ? 'upcoming' : 'past'})</p>
        ${ev.description ? `<p class="mb-0">${esc(ev.description)}</p>` : '<p class="text-muted mb-0">No further details.</p>'}`;
    detailsModal.show();
}

// ── Notifications ────────────────────────────────────────────────────────────
function renderUnreadBadge() {
    const unread = (state.profile.notifications || []).filter((n) => !n.read).length;
    const badge = $('unread-badge');
    badge.hidden = unread === 0;
    badge.textContent = unread > 99 ? '99+' : unread;
}

function renderNotifications() {
    const items = [...(state.profile.notifications || [])].reverse();
    $('notifications-list').innerHTML = items.length
        ? items.map((n) => `
            <div class="notification-item${n.read ? '' : ' unread'}">
                <i class="fas fa-bell" aria-hidden="true"></i>
                <div>${esc(n.message)}<br><small class="text-muted">${formatDateTime(n.timestamp)}</small></div>
            </div>`).join('')
        : emptyState('No notifications yet.');
}

// ── Section loaders ──────────────────────────────────────────────────────────
const loaders = {
    async dashboard() {
        await Promise.all([fetchProfile(), fetchApplications(), fetchEvents(), fetchRecommendations()]);
        renderDashboard();
    },
    async companies() {
        await Promise.all([fetchProfile(), fetchCompanies(), fetchApplications(), fetchRecommendations()]);
        renderCompanies();
    },
    async profile() {
        await fetchProfile();
        renderProfile();
    },
    async resume() {
        await fetchProfile();
        renderResume();
    },
    async status() {
        await fetchProfile();
        renderStatusTimeline();
    },
    async calendar() {
        await Promise.all([fetchProfile(), fetchEvents()]);
        renderCalendar();
    },
    async notifications() {
        await fetchProfile();
        renderNotifications();
        if (state.profile.notifications.some((n) => !n.read)) {
            await apiFetch('/students/me/notifications/read', { method: 'PUT' });   // shown as unread this once
            state.profile.notifications.forEach((n) => { n.read = true; });
            renderUnreadBadge();
        }
    }
};

// ── Events ───────────────────────────────────────────────────────────────────
const actions = {
    'apply': (el) => applyTo(el.dataset.id, el),
    'company-details': (el) => openCompanyDetails(el.dataset.id),
    'event-details': (el) => openEventDetails(el.dataset.id),
    'calendar-toggle': (el) => toggleCalendar(el),
    'open-resume': () => openProtectedPdf('/students/me/resume/file').catch((err) => showNotification(err.message, 'error')),
    'scan-resume': () => scanResume(),
    'refresh-applications': () => guarded(async () => {
        await fetchApplications();
        renderDashboard();
        showNotification('Applications refreshed');
    })
};

document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (el && actions[el.dataset.action]) actions[el.dataset.action](el);
});

['search-company', 'filter-job-type', 'sort-companies'].forEach((id) => {
    $(id).addEventListener(id === 'search-company' ? 'input' : 'change', renderCompanies);
});

// ── Start ────────────────────────────────────────────────────────────────────
if (user) {
    initSidebar();
    withLoading(async () => {
        await fillOptionLists().catch(() => {});
        const ok = await initNavigation(loaders);
        if (!ok) showLoadError('We could not load your dashboard. Please check your connection and try again.');
    });
}
