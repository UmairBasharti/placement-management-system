// Admin dashboard: statistics, companies and applications, students, resume review, events.
// Depends on utils.js and dashboard.js (apiFetch, requireRole, showNotification, initNavigation …).

const user = requireRole('admin');

const state = {
    stats: null,
    activities: [],
    companies: [],
    applications: [],
    students: [],
    resumes: [],
    events: [],
    editingCompanyId: null,
    editingEventId: null
};

const $ = (id) => document.getElementById(id);
const detailsModal = new bootstrap.Modal($('detailsModal'));
let placementChart = null;
let courseChart = null;

const PLACEMENT_STATUSES = ['Unplaced', 'Under Review', 'Interview Scheduled', 'Placed'];
const STATUS_COLORS = ['#dc3545', '#ffd93d', '#bd0745', '#16a34a'];   // matches the status badges
const ACTIVITY_ICON = { upload: 'file-arrow-up', status: 'chart-line', event: 'calendar-days', application: 'paper-plane', company: 'building' };
const APPLICATION_ICON = { Accepted: 'circle-check', Rejected: 'circle-xmark', Pending: 'clock' };
const RESUME_BADGE = { approved: ['bg-success', 'Approved'], rejected: ['bg-danger', 'Rejected'], pending: ['bg-warning text-dark', 'Pending'] };

// Small view helpers
function emptyState(text) {
    return `<div class="empty-state">${esc(text)}</div>`;
}

function applicationStatusLabel(status) {
    return `<span class="status-${statusSlug(status)} fw-semibold"><i class="fas fa-${APPLICATION_ICON[status] || 'clock'}" aria-hidden="true"></i> ${esc(status)}</span>`;
}

function resumeBadge(resume) {
    if (!resume || !resume.fileId) return '<span class="badge bg-secondary">No resume</span>';
    const [tone, label] = RESUME_BADGE[resume.status] || RESUME_BADGE.pending;
    return `<span class="badge ${tone}">Resume: ${label}</span>`;
}

const skillChips = (skills, kind = '') => skills.map((s) => `<span class="skill-chip ${kind}">${esc(s)}</span>`).join('');

function matchBadge(score) {
    const level = score >= 70 ? '' : score >= 40 ? ' is-medium' : ' is-low';
    return `<span class="match-badge${level}">${score}% match</span>`;
}

const companyMeta = (c) => `
    <div class="company-meta">
        <span><i class="fas fa-location-dot" aria-hidden="true"></i>${esc(c.location)}</span>
        <span><i class="fas fa-briefcase" aria-hidden="true"></i>${esc(c.jobType)}</span>
        <span><i class="fas fa-indian-rupee-sign" aria-hidden="true"></i>${esc(c.package || 'Not disclosed')}</span>
    </div>`;

// Dashboard
function renderDashboard() {
    const s = state.stats;
    $('kpi-students').textContent = s.totalStudents;
    $('kpi-placed').textContent = s.placedStudents;
    $('kpi-companies').textContent = s.totalCompanies;
    $('kpi-applications').textContent = s.totalApplications;

    const byStatus = Object.fromEntries(s.statusBreakdown.map((x) => [x._id, x.count]));
    const byBranch = Object.fromEntries(s.branchBreakdown.map((x) => [x._id || 'Unknown', x.count]));

    placementChart?.destroy();
    courseChart?.destroy();
    placementChart = new Chart($('placementChart'), {
        type: 'doughnut',
        data: {
            labels: PLACEMENT_STATUSES,
            datasets: [{ data: PLACEMENT_STATUSES.map((l) => byStatus[l] || 0), backgroundColor: STATUS_COLORS, borderWidth: 2, borderColor: '#fff' }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
    courseChart = new Chart($('courseChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(byBranch),
            datasets: [{ label: 'Students', data: Object.values(byBranch), backgroundColor: 'rgba(189, 7, 69, 0.8)', borderRadius: 6 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });

    $('recent-activities').innerHTML = state.activities.length
        ? state.activities.map((a) => `
            <div class="activity-item">
                <div class="activity-icon ${esc(a.type)}"><i class="fas fa-${ACTIVITY_ICON[a.type] || 'circle-info'}" aria-hidden="true"></i></div>
                <div>
                    <div>${esc(a.title)}</div>
                    <small class="text-muted">${formatDateTime(a.timestamp)}</small>
                </div>
            </div>`).join('')
        : emptyState('No activity yet.');
}

// Companies
function renderCompanies() {
    const query = $('search-company').value.trim().toLowerCase();
    const type = $('filter-job-type').value;
    const branch = $('filter-branch').value;
    const sort = $('sort-companies').value;

    const order = {
        'newest': (a, b) => new Date(b.postedDate) - new Date(a.postedDate),
        'oldest': (a, b) => new Date(a.postedDate) - new Date(b.postedDate),
        'name-asc': (a, b) => a.name.localeCompare(b.name),
        'name-desc': (a, b) => b.name.localeCompare(a.name)
    }[sort];

    const list = state.companies
        .filter((c) => (!query || c.name.toLowerCase().includes(query) || c.location.toLowerCase().includes(query))
            && (!type || c.jobType === type) && (!branch || c.branches.includes(branch)))
        .sort(order);

    $('companies-list').innerHTML = list.length ? list.map((c) => `
        <article class="company-card">
            <h3>${esc(c.name)}</h3>
            ${companyMeta(c)}
            <p class="mb-0">${esc(c.description)}</p>
            <div class="company-tags">
                <span class="company-tag">Open to: ${esc(c.branches.join(', '))}</span>
                ${c.requirements ? `<span class="company-tag">${esc(c.requirements)}</span>` : ''}
            </div>
            <div class="company-actions">
                <button type="button" class="action-btn view-btn" data-action="company-view" data-id="${esc(c._id)}"><i class="fas fa-eye me-1" aria-hidden="true"></i>Details</button>
                <button type="button" class="action-btn edit-btn" data-action="company-edit" data-id="${esc(c._id)}"><i class="fas fa-pen me-1" aria-hidden="true"></i>Edit</button>
                <button type="button" class="action-btn delete-btn" data-action="company-remove" data-id="${esc(c._id)}"><i class="fas fa-trash me-1" aria-hidden="true"></i>Remove</button>
            </div>
        </article>`).join('') : emptyState('No companies yet. Use "Add company" to create the first one.');
}

function renderApplications() {
    const filter = $('application-filter').value;
    const list = state.applications.filter((a) => !filter || a.status === filter);

    $('applications-list').innerHTML = list.length ? list.map((a) => `
        <div class="application-card">
            <div class="d-flex flex-wrap justify-content-between align-items-start gap-2">
                <div>
                    <h3>${esc(a.studentName)}</h3>
                    <div class="text-muted small">${esc(a.studentEmail)}</div>
                    <div class="mt-2"><strong>${esc(a.company ? a.company.name : 'Removed company')}</strong> · applied ${formatDateTime(a.appliedDate)}</div>
                </div>
                ${applicationStatusLabel(a.status)}
            </div>
            ${a.status === 'Pending' ? `
                <div class="company-actions">
                    <button type="button" class="action-btn approve-btn" data-action="application-decide" data-id="${esc(a._id)}" data-status="Accepted"><i class="fas fa-check me-1" aria-hidden="true"></i>Accept</button>
                    <button type="button" class="action-btn reject-btn" data-action="application-decide" data-id="${esc(a._id)}" data-status="Rejected"><i class="fas fa-xmark me-1" aria-hidden="true"></i>Reject</button>
                </div>` : ''}
        </div>`).join('') : emptyState(filter ? `No ${filter.toLowerCase()} applications.` : 'No applications yet.');
}

async function decideApplication(id, status) {
    try {
        await apiFetch(`/applications/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
        showNotification(`Application ${status.toLowerCase()}`);
        await loaders.companies();
    } catch (err) {
        showNotification(err.message, 'error');
    }
}

function openCompanyForm(company = null) {
    state.editingCompanyId = company ? company._id : null;
    $('company-form-title').textContent = company ? 'Edit company' : 'Add company';
    $('company-save').textContent = company ? 'Save changes' : 'Add company';

    $('company-form').reset();
    if (company) {
        $('company-name').value = company.name;
        $('company-location').value = company.location;
        $('company-job-type').value = company.jobType;
        $('company-description').value = company.description;
        $('company-requirements').value = company.requirements || '';
        $('company-skills').value = (company.requiredSkills || []).join(', ');
        $('company-package').value = company.package || '';
    }
    document.querySelectorAll('#company-branches input').forEach((box) => {
        box.checked = Boolean(company) && company.branches.includes(box.value);
    });

    $('company-form-card').hidden = false;
    $('company-form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('company-name').focus({ preventScroll: true });
}

function closeCompanyForm() {
    $('company-form-card').hidden = true;
    state.editingCompanyId = null;
}

$('company-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const branches = [...document.querySelectorAll('#company-branches input:checked')].map((box) => box.value);
    if (!branches.length) return showNotification('Select at least one branch', 'error');

    const editing = state.editingCompanyId;
    $('company-save').disabled = true;
    try {
        await apiFetch(editing ? `/companies/${editing}` : '/companies', {
            method: editing ? 'PUT' : 'POST',
            body: JSON.stringify({
                name: $('company-name').value,
                location: $('company-location').value,
                jobType: $('company-job-type').value,
                description: $('company-description').value,
                requirements: $('company-requirements').value,
                requiredSkills: $('company-skills').value,
                package: $('company-package').value,
                branches
            })
        });
        showNotification(editing ? 'Company updated' : 'Company added');
        closeCompanyForm();
        await loaders.companies();
    } catch (err) {
        showNotification(err.message, 'error');
    } finally {
        $('company-save').disabled = false;
    }
});

async function removeCompany(id) {
    const company = state.companies.find((c) => c._id === id);
    if (!company || !confirm(`Remove ${company.name}?\n\nStudents will no longer see it. Applications already made are kept.`)) return;
    try {
        await apiFetch(`/companies/${id}`, { method: 'DELETE' });
        showNotification('Company removed');
        await loaders.companies();
    } catch (err) {
        showNotification(err.message, 'error');
    }
}

async function openCompanyDetails(id) {
    const base = state.companies.find((c) => c._id === id);
    if (!base) return;
    $('detailsModalTitle').textContent = base.name;
    $('detailsModalBody').innerHTML = '<p class="text-muted mb-0">Loading…</p>';
    detailsModal.show();

    try {
        const [detail, matches] = await Promise.all([apiFetch(`/companies/${id}`), apiFetch(`/admin/companies/${id}/matches`)]);
        const c = detail.data;
        const skills = c.requiredSkills || [];
        $('detailsModalBody').innerHTML = `
            <div class="detail-grid">
                <div class="detail-item"><span class="label">Job type</span><span class="value">${esc(c.jobType)}</span></div>
                <div class="detail-item"><span class="label">Package</span><span class="value">${esc(c.package || 'Not disclosed')}</span></div>
                <div class="detail-item"><span class="label">Location</span><span class="value">${esc(c.location)}</span></div>
                <div class="detail-item"><span class="label">Open to</span><span class="value">${esc(c.branches.join(', '))}</span></div>
                <div class="detail-item"><span class="label">Posted</span><span class="value">${formatDate(c.postedDate)}</span></div>
                <div class="detail-item"><span class="label">Requirements</span><span class="value">${esc(c.requirements || 'Not specified')}</span></div>
            </div>
            <div class="stat-tiles">
                <div class="stat-tile"><div class="number">${c.stats.total}</div><div class="label">Applications</div></div>
                <div class="stat-tile"><div class="number">${c.stats.pending}</div><div class="label">Pending</div></div>
                <div class="stat-tile"><div class="number">${c.stats.accepted}</div><div class="label">Accepted</div></div>
                <div class="stat-tile"><div class="number">${c.stats.rejected}</div><div class="label">Rejected</div></div>
            </div>
            <h3 class="fs-6">Required skills</h3>
            <div class="skill-row mb-3">${skills.length ? skillChips(skills) : '<span class="text-muted small">None listed — they are read from the requirements text.</span>'}</div>

            <h3 class="fs-6">Best-matching students</h3>
            ${matches.data.length ? matches.data.map((m) => `
                <div class="match-row">
                    <div>
                        <strong>${esc(m.name)}</strong> <span class="text-muted small">${esc(m.course)} · ${esc(m.status)}</span>
                        <div class="skill-row">${skillChips(m.matchedSkills, 'matched')}</div>
                    </div>
                    <div class="d-flex flex-wrap align-items-center gap-2">${resumeBadge({ fileId: m.resumeStatus !== 'none', status: m.resumeStatus })}${matchBadge(m.matchScore)}</div>
                </div>`).join('') : '<p class="text-muted small">No student with a matching skill yet.</p>'}

            <h3 class="fs-6 mt-4">Internal notes <span class="text-muted fw-normal small">(students never see these)</span></h3>
            <div id="notes-list">${(c.notes || []).length
                ? c.notes.map((n) => `<div class="note-item">${esc(n.text)}<div class="text-muted small">${formatDateTime(n.date)}</div></div>`).join('')
                : '<p class="text-muted small">No notes yet.</p>'}</div>
            <div class="mt-2">
                <label class="visually-hidden" for="note-text">New note</label>
                <textarea class="form-control mb-2" id="note-text" rows="2" maxlength="500" placeholder="Add a note for the placement team"></textarea>
                <button type="button" class="btn btn-sm btn-outline-primary" data-action="note-add" data-id="${esc(c._id)}">Add note</button>
            </div>`;
    } catch (err) {
        $('detailsModalBody').innerHTML = `<div class="alert alert-danger mb-0">${esc(err.message)}</div>`;
    }
}

async function addNote(id) {
    const text = $('note-text').value.trim();
    if (!text) return showNotification('Write a note first', 'error');
    try {
        await apiFetch(`/companies/${id}/notes`, { method: 'POST', body: JSON.stringify({ text }) });
        showNotification('Note added');
        await openCompanyDetails(id);
    } catch (err) {
        showNotification(err.message, 'error');
    }
}

// Students
function renderStudents() {
    const query = $('search-students').value.trim().toLowerCase();
    const course = $('filter-course').value;
    const status = $('filter-status').value;

    const list = state.students.filter((s) =>
        (!query || s.name.toLowerCase().includes(query) || s.email.toLowerCase().includes(query))
        && (!course || s.course === course) && (!status || s.status === status));

    $('students-list').innerHTML = list.length ? list.map((s) => `
        <div class="col-md-6 col-xl-4 mb-3">
            <div class="card student-card h-100 mb-0"><div class="card-body">
                <div>
                    <h3>${esc(s.name)}</h3>
                    <div class="text-muted small">${esc(s.email)}</div>
                </div>
                <div class="badges">
                    <span class="badge bg-secondary">${esc(s.course || 'N/A')}</span>
                    <span class="status-badge status-${statusSlug(s.status)}">${esc(s.status)}</span>
                    ${resumeBadge(s.resume)}
                </div>
                <div class="mt-auto d-flex gap-2 pt-2">
                    <label class="visually-hidden" for="status-${esc(s.id)}">Placement status of ${esc(s.name)}</label>
                    <select class="form-select form-select-sm student-status-select" id="status-${esc(s.id)}" data-id="${esc(s.id)}">
                        ${PLACEMENT_STATUSES.map((v) => `<option${s.status === v ? ' selected' : ''}>${v}</option>`).join('')}
                    </select>
                    <button type="button" class="btn btn-sm btn-outline-primary" data-action="student-view" data-id="${esc(s.id)}">Profile</button>
                </div>
            </div></div>
        </div>`).join('') : `<div class="col-12">${emptyState('No students match these filters.')}</div>`;
}

async function updateStudentStatus(select) {
    try {
        await apiFetch(`/admin/students/${select.dataset.id}/status`, { method: 'PUT', body: JSON.stringify({ status: select.value }) });
        showNotification('Placement status updated');
        await loaders.students();
    } catch (err) {
        showNotification(err.message, 'error');
        await loaders.students();   // put the dropdown back to the stored value
    }
}

function openStudentDetails(id) {
    const s = state.students.find((x) => x.id === id);
    if (!s) return;
    const history = [...(s.statusHistory || [])].reverse();
    const field = (text) => text ? `<p class="mb-0" style="white-space: pre-line;">${esc(text)}</p>` : '<p class="text-muted mb-0">Not filled in</p>';

    $('detailsModalTitle').textContent = s.name;
    $('detailsModalBody').innerHTML = `
        <div class="d-flex flex-wrap gap-2 mb-3">
            <span class="badge bg-secondary">${esc(s.course || 'N/A')}</span>
            <span class="status-badge status-${statusSlug(s.status)}">${esc(s.status)}</span>
            ${resumeBadge(s.resume)}
        </div>
        <p class="text-muted">${esc(s.email)}</p>
        <h3 class="fs-6">Skills</h3>
        <div class="skill-row mb-3">${(s.skills || '').trim() ? skillChips(s.skills.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean)) : '<span class="text-muted small">Not filled in</span>'}</div>
        <h3 class="fs-6">Education</h3><div class="mb-3">${field(s.education)}</div>
        <h3 class="fs-6">Projects</h3><div class="mb-3">${field(s.projects)}</div>
        ${s.resume && s.resume.fileId ? `<button type="button" class="btn btn-outline-primary btn-sm mb-3" data-action="resume-view" data-id="${esc(s.id)}"><i class="fas fa-eye me-1" aria-hidden="true"></i>Open resume (${esc(s.resume.name)})</button>` : ''}
        <h3 class="fs-6">Placement history</h3>
        ${history.length ? history.map((h) => `<div class="note-item"><strong>${esc(h.status)}</strong> — ${esc(h.message || '')}<div class="text-muted small">${formatDateTime(h.timestamp)}</div></div>`).join('') : '<p class="text-muted small mb-0">No changes yet.</p>'}`;
    detailsModal.show();
}

// A cell that starts with = + - @ would be run as a formula by Excel, so it gets a leading apostrophe
const csvCell = (value) => {
    let text = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
};

async function exportStudents() {
    try {
        if (!state.students.length) await loaders.students();
        const rows = [
            ['Name', 'Email', 'Course', 'Placement status', 'Resume status', 'Skills', 'Education', 'Projects'],
            ...state.students.map((s) => [s.name, s.email, s.course, s.status, s.resume && s.resume.fileId ? s.resume.status : 'none', s.skills, s.education, s.projects])
        ];
        const csv = '﻿' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');   // BOM: Excel reads UTF-8 correctly
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        link.download = 'students.csv';
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (err) {
        showNotification(err.message, 'error');
    }
}

// Resumes
function renderResumes() {
    $('resumes-list').innerHTML = state.resumes.length ? state.resumes.map((s) => {
        const [tone, label] = RESUME_BADGE[s.resume.status] || RESUME_BADGE.pending;
        return `
        <tr>
            <td>${esc(s.name)}</td>
            <td>${esc(s.course || 'N/A')}</td>
            <td>${esc(s.resume.name)}</td>
            <td><span class="badge ${tone}">${label}</span></td>
            <td>
                <div class="row-actions">
                    <button type="button" class="btn btn-sm btn-outline-primary" data-action="resume-view" data-id="${esc(s.id)}" aria-label="View resume of ${esc(s.name)}"><i class="fas fa-eye" aria-hidden="true"></i></button>
                    <button type="button" class="btn btn-sm btn-success" data-action="resume-approve" data-id="${esc(s.id)}" aria-label="Approve resume of ${esc(s.name)}"${s.resume.status === 'approved' ? ' disabled' : ''}><i class="fas fa-check" aria-hidden="true"></i></button>
                    <button type="button" class="btn btn-sm btn-danger" data-action="resume-reject" data-id="${esc(s.id)}" aria-label="Reject resume of ${esc(s.name)}"${s.resume.status === 'rejected' ? ' disabled' : ''}><i class="fas fa-xmark" aria-hidden="true"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('') : `<tr><td colspan="5">${emptyState('No resumes uploaded yet.')}</td></tr>`;
}

async function reviewResume(id, decision) {
    if (decision === 'reject' && !confirm('Reject this resume? The student will be asked to upload a new one.')) return;
    try {
        await apiFetch(`/admin/resumes/${id}/${decision}`, { method: 'PUT' });
        showNotification(decision === 'approve' ? 'Resume approved' : 'Resume rejected');
        await loaders.resumes();
    } catch (err) {
        showNotification(err.message, 'error');
    }
}

// Calendar
// "now" in the format datetime-local expects (local time, minutes)
const localNow = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function renderCalendar() {
    const events = [...state.events].sort((a, b) => new Date(a.date) - new Date(b.date));
    $('calendar').innerHTML = events.length ? events.map((ev) => {
        const upcoming = new Date(ev.date) > new Date();
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
                    <button type="button" class="btn btn-sm btn-outline-primary" data-action="event-edit" data-id="${esc(ev._id)}" aria-label="Edit ${esc(ev.title)}"><i class="fas fa-pen" aria-hidden="true"></i></button>
                    <button type="button" class="btn btn-sm btn-outline-danger" data-action="event-delete" data-id="${esc(ev._id)}" aria-label="Delete ${esc(ev.title)}"><i class="fas fa-trash" aria-hidden="true"></i></button>
                </div>
            </div>
        </div>`;
    }).join('') : emptyState('No events yet. Add one with the form.');
}

function setEventForm(event = null) {
    state.editingEventId = event ? event._id : null;
    $('event-form-title').textContent = event ? 'Edit event' : 'Add event';
    $('event-save').textContent = event ? 'Save changes' : 'Add event';
    $('event-cancel').hidden = !event;
    $('event-title').value = event ? event.title : '';
    $('event-date').value = event ? event.date.slice(0, 16) : '';
    $('event-description').value = event ? event.description || '' : '';
    if (event) $('event-date').removeAttribute('min'); else $('event-date').min = localNow();   // past dates only when editing
}

$('event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const editing = state.editingEventId;
    $('event-save').disabled = true;
    try {
        await apiFetch(editing ? `/events/${editing}` : '/events', {
            method: editing ? 'PUT' : 'POST',
            body: JSON.stringify({ title: $('event-title').value, date: $('event-date').value, description: $('event-description').value })
        });
        showNotification(editing ? 'Event updated — students were notified' : 'Event created — students were notified');
        setEventForm();
        await loaders.calendar();
    } catch (err) {
        showNotification(err.message, 'error');
    } finally {
        $('event-save').disabled = false;
    }
});

async function deleteEvent(id) {
    const ev = state.events.find((x) => x._id === id);
    if (!ev || !confirm(`Delete "${ev.title}"? It is removed from students' calendars too.`)) return;
    try {
        await apiFetch(`/events/${id}`, { method: 'DELETE' });
        showNotification('Event deleted');
        if (state.editingEventId === id) setEventForm();
        await loaders.calendar();
    } catch (err) {
        showNotification(err.message, 'error');
    }
}

// Section loaders
const loaders = {
    async dashboard() {
        const [stats, activities] = await Promise.all([apiFetch('/admin/stats'), apiFetch('/admin/activities')]);
        state.stats = stats.data;
        state.activities = activities.data;
        renderDashboard();
    },
    async companies() {
        const [companies, applications] = await Promise.all([apiFetch('/companies'), apiFetch('/admin/applications')]);
        state.companies = companies.data;
        state.applications = applications.data;
        renderCompanies();
        renderApplications();
    },
    async students() {
        state.students = (await apiFetch('/admin/students')).data;
        renderStudents();
    },
    async resumes() {
        state.resumes = (await apiFetch('/admin/resumes')).data;
        renderResumes();
    },
    async calendar() {
        state.events = (await apiFetch('/events')).data;
        renderCalendar();
    }
};

// Events
const actions = {
    'company-new': () => openCompanyForm(),
    'company-cancel': () => closeCompanyForm(),
    'company-view': (el) => openCompanyDetails(el.dataset.id),
    'company-edit': (el) => openCompanyForm(state.companies.find((c) => c._id === el.dataset.id)),
    'company-remove': (el) => removeCompany(el.dataset.id),
    'note-add': (el) => addNote(el.dataset.id),
    'application-decide': (el) => decideApplication(el.dataset.id, el.dataset.status),
    'student-view': (el) => openStudentDetails(el.dataset.id),
    'export-students': () => exportStudents(),
    'resume-view': (el) => openProtectedPdf(`/admin/students/${el.dataset.id}/resume`).catch((err) => showNotification(err.message, 'error')),
    'resume-approve': (el) => reviewResume(el.dataset.id, 'approve'),
    'resume-reject': (el) => reviewResume(el.dataset.id, 'reject'),
    'event-edit': (el) => { setEventForm(state.events.find((x) => x._id === el.dataset.id)); $('event-title').focus(); },
    'event-delete': (el) => deleteEvent(el.dataset.id),
    'event-cancel': () => setEventForm()
};

document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (el && actions[el.dataset.action]) actions[el.dataset.action](el);
});

document.addEventListener('change', (e) => {
    if (e.target.matches('.student-status-select')) updateStudentStatus(e.target);
});

[['search-company', renderCompanies], ['filter-job-type', renderCompanies], ['filter-branch', renderCompanies], ['sort-companies', renderCompanies],
 ['application-filter', renderApplications],
 ['search-students', renderStudents], ['filter-course', renderStudents], ['filter-status', renderStudents]
].forEach(([id, render]) => $(id).addEventListener(id.startsWith('search') ? 'input' : 'change', render));

// Start
if (user) {
    initSidebar();
    setEventForm();
    withLoading(async () => {
        await fillOptionLists().catch(() => {});
        const ok = await initNavigation(loaders);
        if (!ok) showLoadError('We could not load the dashboard. Please check your connection and try again.');
    });
}
