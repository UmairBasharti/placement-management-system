// ═══════════════════════════════════════════════════════════════
//  STUDENT DASHBOARD — all data from REST API, JWT-authenticated
//  Fixes applied: #1 #2 #7 #8 #11
// ═══════════════════════════════════════════════════════════════

// Relative URL: works on any host/port
const API = '/api';

// Handle non-JSON responses gracefully
async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    if (!token) { logout(); throw new Error(SESSION_EXPIRED); }

    // Merge custom headers instead of letting them replace Authorization
    const { headers: extraHeaders, ...rest } = options;
    const res = await fetch(API + endpoint, {
        ...rest,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...extraHeaders
        }
    });

    // Throw (not return undefined) so callers never crash on `res.data` while the redirect happens
    if (res.status === 401) { logout(); throw new Error(SESSION_EXPIRED); }

    let data;
    try {
        data = await res.json();
    } catch (e) {
        throw new Error('Server returned an unexpected response');
    }

    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html'; // back to the home page
}

function showNotification(message, type = 'success') {
    const container = document.getElementById('notificationContainer');
    if (!container) return;
    const div = document.createElement('div');
    div.className = `notification ${type}`;
    const icons = { success: 'check-circle', error: 'times-circle', warning: 'exclamation-triangle' };
    div.innerHTML = `<div class="d-flex align-items-center"><i class="fas fa-${icons[type] || 'info-circle'} me-2"></i><span>${esc(message)}</span></div>`;
    container.appendChild(div);
    requestAnimationFrame(() => div.classList.add('show'));
    setTimeout(() => {
        div.classList.remove('show');
        setTimeout(() => div.remove(), 300);
    }, 3000);
}

// ── auth guard ────────────────────────────────────────────────
let currentUser = null;
try { currentUser = JSON.parse(localStorage.getItem('currentUser')); } catch { /* corrupt storage = logged out */ }
const authorized = !!currentUser && currentUser.role === 'student';
if (!authorized) logout();

// In-memory state — fetched fresh from API on each section load
let studentData = {};
let allCompanies = [];
let myApplications = [];
let allEvents = [];

// ── navigation ──
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', async function (e) {
        e.preventDefault();
        if (this.id === 'logout') { logout(); return; }

        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        this.classList.add('active');

        const section = this.dataset.section;
        document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
        const target = document.getElementById(`${section}-section`);
        if (target) {
            target.style.display = 'block';
            document.getElementById('section-title').textContent = this.textContent.trim();
        }

        if      (section === 'dashboard')     { await guarded(loadDashboard); }
        else if (section === 'companies')      { await guarded(loadCompanies); }
        else if (section === 'profile')        { renderProfile(); }
        else if (section === 'resume')         { renderResume(); }
        else if (section === 'notifications')  { await guarded(loadNotifications); }
        else if (section === 'status')         { await guarded(loadStatusTimeline); }
        else if (section === 'calendar')       { await guarded(loadCalendar); }
    });
});

// mobile sidebar (button + overlay live in the HTML; logic is shared in utils.js)
initSidebar();

// ── data loaders ──────────────────────────────────────────────
async function fetchProfile() {
    const res = await apiFetch('/students/me');
    studentData = res.data;
}

async function fetchCompanies() {
    const res = await apiFetch('/companies');
    allCompanies = res.data;
}

async function fetchApplications() {
    const res = await apiFetch('/applications/my');
    myApplications = res.data;
}

async function fetchEvents() {
    const res = await apiFetch('/events');
    allEvents = res.data;
}

// ── profile completion calculation ────────────────────
function calculateProfileCompletion() {
    const fields = [studentData.name, studentData.course, studentData.skills,
                    studentData.education, studentData.resume && studentData.resume.path];
    return Math.round(fields.filter(Boolean).length / fields.length * 100);
}

// ── dashboard ─────────────────────────────────────────────────
async function loadDashboard() {
    await Promise.all([fetchProfile(), fetchApplications(), fetchEvents()]);

    // profile completion
    const pct = calculateProfileCompletion();
    const bar = document.getElementById('profile-progress-bar');
    if (bar) { bar.style.width = pct + '%'; bar.textContent = pct + '%'; }
    const pctText = document.getElementById('profile-completion-pct');
    if (pctText) pctText.textContent = `${pct}% Complete`;

    // profile checklist
    document.getElementById('check-personal').className = `fas fa-${studentData.name ? 'check-circle text-success' : 'times-circle text-danger'} me-2`;
    document.getElementById('check-course').className = `fas fa-${studentData.course ? 'check-circle text-success' : 'times-circle text-danger'} me-2`;
    document.getElementById('check-skills').className = `fas fa-${studentData.skills ? 'check-circle text-success' : 'times-circle text-danger'} me-2`;
    document.getElementById('check-education').className = `fas fa-${studentData.education ? 'check-circle text-success' : 'times-circle text-danger'} me-2`;
    document.getElementById('check-resume').className = `fas fa-${studentData.resume && studentData.resume.path ? 'check-circle text-success' : 'times-circle text-danger'} me-2`;

    // placement status badge
    const statusBadge = document.getElementById('current-status');
    const status = studentData.status || 'Unplaced';
    if (statusBadge) {
        statusBadge.className = `status-badge status-${status.toLowerCase().replace(/ /g, '-')} me-3`;
        statusBadge.innerHTML = `<i class="fas fa-circle"></i> ${status}`;
    }

    // dashboard placement status card
    const dashStatus = document.getElementById('dash-status-badge');
    if (dashStatus) {
        dashStatus.className = `status-badge status-${status.toLowerCase().replace(/ /g, '-')} me-3`;
        dashStatus.innerHTML = `<i class="fas fa-circle"></i> ${status}`;
    }

    const statusTime = document.getElementById('status-updated-time');
    if (statusTime) {
        statusTime.textContent = studentData.statusHistory && studentData.statusHistory.length > 0
            ? 'Last Updated: ' + new Date(studentData.statusHistory[studentData.statusHistory.length - 1].timestamp).toLocaleString()
            : 'Last Updated: Never';
    }

    const statusBar = document.getElementById('status-progress-bar');
    if (statusBar) {
        const progress = { 'Placed': 100, 'Interview Scheduled': 75, 'Under Review': 50, 'Unplaced': 0 };
        statusBar.style.width = (progress[status] || 0) + '%';
    }

    // application counts
    const total     = myApplications.length;
    const pending   = myApplications.filter(a => a.status === 'Pending').length;
    const accepted  = myApplications.filter(a => a.status === 'Accepted').length;
    const rejected  = myApplications.filter(a => a.status === 'Rejected').length;

    const countEl = document.getElementById('app-total-count');
    if (countEl) countEl.textContent = total;

    const t = total || 1;
    const pBar = document.getElementById('pending-progress-bar');
    const aBar = document.getElementById('accepted-progress-bar');
    const rBar = document.getElementById('rejected-progress-bar');
    if (pBar) pBar.style.width = `${pending / t * 100}%`;
    if (aBar) aBar.style.width = `${accepted / t * 100}%`;
    if (rBar) rBar.style.width = `${rejected / t * 100}%`;

    const pendingLabel  = document.getElementById('app-pending-label');
    const acceptedLabel = document.getElementById('app-accepted-label');
    const rejectedLabel = document.getElementById('app-rejected-label');
    if (pendingLabel)  pendingLabel.innerHTML  = `<i class="fas fa-clock"></i> Pending: ${pending}`;
    if (acceptedLabel) acceptedLabel.innerHTML = `<i class="fas fa-check-circle"></i> Accepted: ${accepted}`;
    if (rejectedLabel) rejectedLabel.innerHTML = `<i class="fas fa-times-circle"></i> Rejected: ${rejected}`;

    renderRecentApplications();
    renderUpcomingEvents();
}

function renderRecentApplications() {
    const el = document.getElementById('recent-applications');
    if (!el) return;
    const recent = myApplications.slice(0, 3);   // the API returns newest first
    el.innerHTML = recent.length ? recent.map(app => `
        <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
            <div>
                <h6 class="mb-0">${esc(app.company ? app.company.name : 'Unknown')}</h6>
                <small class="text-muted">Applied on: ${new Date(app.appliedDate).toLocaleString()}</small>
            </div>
            <div class="status-badge status-${app.status.toLowerCase()}">
                <i class="fas fa-${app.status === 'Accepted' ? 'check-circle' : app.status === 'Rejected' ? 'times-circle' : 'clock'}"></i>
                ${app.status}
            </div>
        </div>
    `).join('') : '<div class="text-center text-muted">No recent applications</div>';
}

function renderUpcomingEvents() {
    const el = document.getElementById('upcoming-events');
    if (!el) return;
    const upcoming = allEvents
        .filter(ev => new Date(ev.date) > new Date())
        .slice(0, 3);
    el.innerHTML = upcoming.length ? upcoming.map(ev => `
        <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
            <div>
                <h6 class="mb-0">${esc(ev.title)}</h6>
                <small class="text-muted"><i class="fas fa-clock me-1"></i>${new Date(ev.date).toLocaleString()}</small>
            </div>
            <button class="btn btn-sm btn-outline-primary" onclick="viewEventDetails('${ev._id}')">
                <i class="fas fa-info-circle"></i>
            </button>
        </div>
    `).join('') : '<div class="text-center text-muted">No upcoming events</div>';
}

// ── profile ───────────────────────────────────────────────────
function renderProfile() {
    document.getElementById('profile-name').value    = studentData.name    || '';
    document.getElementById('profile-email').value   = studentData.email   || '';
    document.getElementById('profile-course').value  = studentData.course  || '';
    document.getElementById('profile-skills').value  = studentData.skills  || '';
    document.getElementById('profile-education').value = studentData.education || '';
    document.getElementById('profile-projects').value  = studentData.projects  || '';
}

document.getElementById('profile-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    try {
        await apiFetch('/students/me', {
            method: 'PUT',
            body: JSON.stringify({
                name:      document.getElementById('profile-name').value,
                skills:    document.getElementById('profile-skills').value,
                education: document.getElementById('profile-education').value,
                projects:  document.getElementById('profile-projects').value
            })
        });
        await fetchProfile();
        showNotification('Profile updated successfully!');
    } catch (err) {
        showNotification(err.message, 'error');
    }
});

// ── resume ────────────────────────────────────────────────────
function renderResume() {
    updateResumeStatus();
    updateResumePreview();
}

function updateResumeStatus() {
    const el = document.getElementById('resume-status');
    if (!el) return;
    const r = studentData.resume;
    if (r && r.path) {
        el.innerHTML = `
            <div class="alert ${r.approved ? 'alert-success' : 'alert-warning'}">
                <i class="fas fa-${r.approved ? 'check-circle' : 'clock'} me-2"></i>
                Resume ${r.approved ? 'approved' : 'pending approval'}: ${esc(r.name)}
                <br><small>Uploaded on: ${new Date(r.uploadedAt).toLocaleString()}</small>
            </div>`;
    } else {
        el.innerHTML = `<div class="alert alert-secondary"><i class="fas fa-exclamation-circle me-2"></i>No resume uploaded yet</div>`;
    }
}

function updateResumePreview() {
    const el = document.getElementById('resume-preview');
    if (!el) return;
    const r = studentData.resume;
    if (r && r.path) {
        el.innerHTML = `
            <div class="d-flex flex-column align-items-center justify-content-center h-100">
                <i class="fas fa-file-pdf fa-3x mb-3" style="color:var(--primary-color)"></i>
                <p class="mb-2">${esc(r.name)}</p>
                <button type="button" class="btn btn-primary" data-action="open-resume">
                    <i class="fas fa-eye me-2"></i>View Resume
                </button>
            </div>`;
    } else {
        el.innerHTML = `<div class="text-center text-muted"><i class="fas fa-file-alt fa-3x mb-3"></i><p>No resume uploaded yet</p></div>`;
    }
}

// "View Resume" — fetched with the login token (the file is not publicly accessible)
document.getElementById('resume-preview')?.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-action="open-resume"]')) return;
    try {
        await openProtectedPdf('/students/me/resume/file');
    } catch (err) {
        showNotification(err.message, 'error');
    }
});

// Resume upload — uses FormData (multipart) instead of base64
document.getElementById('resume-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const file = document.getElementById('resume-file').files[0];
    if (!file) return;
    if (!/\.pdf$/i.test(file.name)) { showNotification('Please choose a PDF file', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { showNotification('File too large (maximum 5 MB)', 'error'); return; }

    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('resume', file);

    try {
        const res = await fetch(API + '/students/me/resume', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData
        });
        if (res.status === 401) { logout(); throw new Error(SESSION_EXPIRED); }
        let data;
        try { data = await res.json(); } catch (e) { throw new Error('Upload failed — unexpected server response'); }
        if (!res.ok) throw new Error(data.message || 'Upload failed');

        await fetchProfile();
        renderResume();
        showNotification('Resume uploaded successfully!');
        this.reset();
    } catch (err) {
        showNotification(err.message, 'error');
    }
});

// ── companies ─────────────────────────────────────────────────
async function loadCompanies() {
    await Promise.all([fetchCompanies(), fetchApplications()]);
    displayCompanies();
}

function displayCompanies() {
    const el = document.getElementById('companies-list');
    if (!el) return;

    const search  = (document.getElementById('search-company')?.value || '').toLowerCase();
    const jobType = document.getElementById('filter-job-type')?.value || '';
    const branch  = document.getElementById('filter-branch')?.value  || '';

    let filtered = allCompanies.filter(c => {
        const matchSearch  = c.name.toLowerCase().includes(search) || c.location.toLowerCase().includes(search);
        const matchJobType = !jobType || c.jobType === jobType;
        const matchBranch  = !branch  || c.branches.includes(branch);
        return matchSearch && matchJobType && matchBranch;
    });

    filtered.sort((a, b) => new Date(b.postedDate) - new Date(a.postedDate));

    el.innerHTML = filtered.map(company => {
        const app = myApplications.find(a => a.company && a.company._id === company._id);
        return `
            <div class="company-card">
                <div class="d-flex align-items-start">
                    <div class="company-info ms-3">
                        <h3>${esc(company.name)}</h3>
                        <p><i class="fas fa-map-marker-alt"></i> ${esc(company.location)}</p>
                        <p><i class="fas fa-briefcase"></i> ${esc(company.jobType)}</p>
                        <p><i class="fas fa-rupee-sign"></i> ${esc(company.package || 'N/A')}</p>
                        <p><i class="fas fa-calendar"></i> Posted: ${new Date(company.postedDate).toLocaleDateString()}</p>
                    </div>
                </div>
                <p class="mt-2">${esc(company.description)}</p>
                <div class="company-tags">
                    <span class="company-tag">${esc(company.branches.join(', '))}</span>
                    ${company.requirements ? `<span class="company-tag">${esc(company.requirements)}</span>` : ''}
                </div>
                <div class="company-actions">
                    <button class="action-btn view-btn" onclick="viewCompanyDetails('${company._id}')">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                    ${!app ? `
                        <button class="action-btn apply-btn" onclick="applyToCompany('${company._id}')">
                            <i class="fas fa-paper-plane"></i> Apply
                        </button>` : `
                        <div class="application-status">
                            <button class="action-btn ${app.status === 'Accepted' ? 'approve-btn' : app.status === 'Rejected' ? 'reject-btn' : 'status-pending'}" disabled>
                                <i class="fas fa-${app.status === 'Accepted' ? 'check' : app.status === 'Rejected' ? 'times' : 'clock'}"></i>
                                ${app.status}
                            </button>
                            <small class="text-muted">Applied on: ${new Date(app.appliedDate).toLocaleDateString()}</small>
                        </div>`}
                </div>
            </div>`;
    }).join('') || '<div class="alert alert-info">No companies found matching your criteria</div>';
}

window.viewCompanyDetails = function (companyId) {
    const company = allCompanies.find(c => c._id === companyId);
    if (!company) return;
    const app = myApplications.find(a => a.company && a.company._id === companyId);

    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog company-details-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">${esc(company.name)}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="company-details-grid">
                        <div class="detail-item"><label>Job Type</label><div class="value">${esc(company.jobType)}</div></div>
                        <div class="detail-item"><label>Package</label><div class="value">${esc(company.package || 'N/A')}</div></div>
                        <div class="detail-item"><label>Branches</label><div class="value">${esc(company.branches.join(', '))}</div></div>
                        <div class="detail-item"><label>Requirements</label><div class="value">${esc(company.requirements || 'N/A')}</div></div>
                        <div class="detail-item"><label>Location</label><div class="value">${esc(company.location)}</div></div>
                    </div>
                    <p class="mt-3">${esc(company.description)}</p>
                    <div class="application-info mt-4">
                        ${app ? `
                            <div class="alert ${app.status === 'Accepted' ? 'alert-success' : app.status === 'Rejected' ? 'alert-danger' : 'alert-warning'}">
                                <h6>Your Application Status</h6>
                                <p class="mb-0">
                                    <i class="fas fa-${app.status === 'Accepted' ? 'check-circle' : app.status === 'Rejected' ? 'times-circle' : 'clock'}"></i>
                                    Status: ${app.status}
                                </p>
                                <small>Applied on: ${new Date(app.appliedDate).toLocaleString()}</small>
                            </div>` : `
                            <div class="alert alert-info">
                                <h6>Ready to Apply?</h6>
                                <p class="mb-0">Make sure your profile and resume are up to date.</p>
                                <button class="btn btn-primary mt-2" onclick="applyToCompany('${companyId}')">
                                    <i class="fas fa-paper-plane"></i> Apply Now
                                </button>
                            </div>`}
                    </div>
                </div>
            </div>
        </div>`;
    document.body.appendChild(modal);
    const m = new bootstrap.Modal(modal);
    m.show();
    modal.addEventListener('hidden.bs.modal', () => modal.remove());
};

window.applyToCompany = async function (companyId) {
    try {
        await apiFetch('/applications', {
            method: 'POST',
            body: JSON.stringify({ companyId })
        });
        await Promise.all([fetchProfile(), fetchApplications()]);
        displayCompanies();
        renderRecentApplications();
        showNotification('Application submitted successfully!');
    } catch (err) {
        showNotification(err.message, 'error');
    }
};

// company filter listeners
document.getElementById('search-company')?.addEventListener('input', displayCompanies);
document.getElementById('filter-job-type')?.addEventListener('change', displayCompanies);
document.getElementById('filter-branch')?.addEventListener('change', displayCompanies);

// ── events / calendar ───────
async function loadCalendar() {
    await Promise.all([fetchEvents(), fetchProfile()]);
    updateCalendar();
}

function updateCalendar() {
    const el = document.getElementById('calendar');
    if (!el) return;

    const sorted = [...allEvents].sort((a, b) => new Date(a.date) - new Date(b.date));
    el.innerHTML = sorted.length ? sorted.map(ev => {
        const isUpcoming = new Date(ev.date) > new Date();
        const added = (studentData.events || []).some(e => e.title === ev.title && e.date === ev.date);
        return `
            <div class="calendar-event ${isUpcoming ? 'upcoming' : 'past'}">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h6 class="mb-1">${esc(ev.title)}</h6>
                        <p class="mb-0 text-muted"><small><i class="fas fa-clock me-2"></i>${new Date(ev.date).toLocaleString()}</small></p>
                        ${ev.description ? `<p class="mt-2">${esc(ev.description)}</p>` : ''}
                        ${!isUpcoming ? '<div class="mt-2"><span class="badge bg-secondary">Past Event</span></div>' : ''}
                    </div>
                    <div class="event-actions">
                        ${isUpcoming ? `
                            <button class="btn btn-sm ${added ? 'btn-success' : 'btn-primary'}"
                                data-action="${added ? 'remove' : 'add'}" data-event-id="${esc(ev._id)}">
                                <i class="fas fa-${added ? 'check' : 'calendar-plus'}"></i>
                                ${added ? 'Added' : 'Add to Calendar'}
                            </button>` : ''}
                        <button class="btn btn-sm btn-info" data-action="details" data-event-id="${esc(ev._id)}" aria-label="Event details">
                            <i class="fas fa-info-circle"></i>
                        </button>
                    </div>
                </div>
            </div>`;
    }).join('') : '<div class="alert alert-secondary">No events scheduled</div>';
}

// Calendar buttons carry only the event id (data attributes) — no user text is ever
// placed inside an inline JavaScript handler.
async function addToCalendar(ev) {
    try {
        await apiFetch('/students/me/events', {
            method: 'POST',
            body: JSON.stringify({ title: ev.title, date: ev.date, description: ev.description })
        });
        await fetchProfile();
        updateCalendar();
        showNotification('Event added to your calendar!');
    } catch (err) {
        showNotification(err.message, 'error');
    }
}

async function removeFromCalendar(ev) {
    try {
        const mine = (studentData.events || []).find(e => e.title === ev.title && e.date === ev.date);
        if (!mine) return;
        await apiFetch(`/students/me/events/${mine._id}`, { method: 'DELETE' });
        await fetchProfile();
        updateCalendar();
        showNotification('Event removed from your calendar!');
    } catch (err) {
        showNotification(err.message, 'error');
    }
}

document.getElementById('calendar')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const ev = allEvents.find(x => x._id === btn.dataset.eventId);
    if (!ev) return;
    if (btn.dataset.action === 'details') { window.viewEventDetails(ev._id); return; }
    btn.disabled = true;   // prevent double-clicks while the request runs
    const run = btn.dataset.action === 'add' ? addToCalendar(ev) : removeFromCalendar(ev);
    run.finally(updateCalendar);   // re-render also re-enables the button after a failure
});

window.viewEventDetails = function (eventId) {
    const ev = allEvents.find(e => e._id === eventId);
    if (!ev) return;
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">${esc(ev.title)}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <p><strong>Date & Time:</strong> ${new Date(ev.date).toLocaleString()}</p>
                    ${ev.description ? `<p><strong>Description:</strong> ${esc(ev.description)}</p>` : ''}
                    <p><strong>Status:</strong> ${new Date(ev.date) > new Date() ? 'Upcoming' : 'Past'}</p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(modal);
    const m = new bootstrap.Modal(modal);
    m.show();
    modal.addEventListener('hidden.bs.modal', () => modal.remove());
};

// ── notifications ─────────────────────────────────────────────
async function loadNotifications() {
    await fetchProfile();
    const el = document.getElementById('notifications-list');
    if (!el) return;
    const notifs = studentData.notifications || [];
    el.innerHTML = notifs.length ? [...notifs].reverse().map(n => `
        <div class="alert alert-info">
            <i class="fas fa-info-circle me-2"></i>${esc(n.message)}
            <br><small>${new Date(n.timestamp).toLocaleString()}</small>
        </div>`).join('') : '<div class="alert alert-secondary">No notifications yet</div>';
}

// ── status timeline ───────────────────
async function loadStatusTimeline() {
    await fetchProfile();
    updateStatusTimeline();
}

function updateStatusTimeline() {
    const el = document.getElementById('status-timeline');
    if (!el) return;
    const hist = studentData.statusHistory || [];
    el.innerHTML = hist.length ? [...hist].reverse().map(h => `
        <div class="timeline-item">
            <div class="timeline-content">
                <h6 class="mb-1">${h.status}</h6>
                <p class="mb-0 text-muted"><small>${new Date(h.timestamp).toLocaleString()}</small></p>
                ${h.message ? `<p class="mt-2">${esc(h.message)}</p>` : ''}
            </div>
        </div>`).join('') : '<div class="text-center text-muted"><i class="fas fa-history fa-3x mb-3"></i><p>No status history yet</p></div>';
}

// ── refresh helpers ───────────────────────────────────────────
window.refreshApplications = () => guarded(async () => {
    await fetchApplications();
    renderRecentApplications();
    showNotification('Applications refreshed!');
});

window.refreshEvents = () => guarded(async () => {
    await fetchEvents();
    renderUpcomingEvents();
    showNotification('Events refreshed!');
});

// ── init ──────────────────────────────────────────────────────
async function init() {
    try {
        await fetchProfile();
        renderProfile();
        updateResumeStatus();
        updateResumePreview();
        updateStatusTimeline();
        await Promise.all([fetchCompanies(), fetchApplications(), fetchEvents()]);
        displayCompanies();
        updateCalendar();
        renderRecentApplications();
        renderUpcomingEvents();

        document.getElementById('section-title').textContent = 'Dashboard';
        document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
        const dash = document.getElementById('dashboard-section');
        if (dash) dash.style.display = 'block';

        // Trigger dashboard load to populate data
        await loadDashboard();
    } catch (err) {
        console.error('Init error:', err);
        showLoadError('We could not load your dashboard. Please check your connection and try again.');
    }
}

if (authorized) withLoading(init);

// Keyboard shortcut: Ctrl+F focuses company search
document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        document.getElementById('search-company')?.focus();
    }
});
