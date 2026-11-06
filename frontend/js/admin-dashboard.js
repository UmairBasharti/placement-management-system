// ═══════════════════════════════════════════════════════════════
//  ADMIN DASHBOARD — all data from REST API, JWT-authenticated
//  Fixes applied: #1 #5 #10 #12 #13 #14
// ═══════════════════════════════════════════════════════════════

// Relative URL: works on any host/port
const API = '/api';

async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    if (!token) { logout(); throw new Error(SESSION_EXPIRED); }
    const isFormData = options.body instanceof FormData;
    const headers = {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        Authorization: `Bearer ${token}`,
        ...options.headers
    };
    const res = await fetch(API + endpoint, { ...options, headers });
    // Throw (not return undefined) so callers never crash on `res.data` while the redirect happens
    if (res.status === 401) { logout(); throw new Error(SESSION_EXPIRED); }
    let data;
    try { data = await res.json(); } catch (e) { throw new Error('Server returned an unexpected response'); }
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html'; // back to the home page
}

function showNotification(message, type = 'success') {
    const div = document.createElement('div');
    div.className = `alert alert-${type === 'error' ? 'danger' : type} position-fixed top-0 end-0 m-3`;
    div.style.zIndex = '9999';
    div.textContent = message;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

// ── auth guard ────────────────────────────────────────────────
let currentUser = null;
try { currentUser = JSON.parse(localStorage.getItem('currentUser')); } catch { /* corrupt storage = logged out */ }
const authorized = !!currentUser && currentUser.role === 'admin';
if (!authorized) logout();

// ── in-memory state ───────────────────────────────────────────
let allStudents    = [];
let allCompanies   = [];
let allApplications = [];
let allEvents      = [];
let placementChart = null;
let courseChart    = null;

// ── navigation ────────────────────────────────────────────────
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

        if      (section === 'dashboard') { await guarded(loadDashboard); }
        else if (section === 'students')  { await guarded(loadStudents); }
        else if (section === 'resumes')   { await guarded(loadResumes); }
        else if (section === 'calendar')  { await guarded(loadCalendar); }
        else if (section === 'companies') { await guarded(loadCompanies); }
    });
});

// mobile sidebar (button + overlay live in the HTML; logic is shared in utils.js)
initSidebar();

// ── dashboard ─────────────────────────────────────────────────
async function loadDashboard() {
    const [statsRes, activitiesRes] = await Promise.all([
        apiFetch('/admin/stats'),
        apiFetch('/admin/activities')
    ]);

    const stats = statsRes.data;

    const statusMap = {};
    (stats.statusBreakdown || []).forEach(s => { statusMap[s._id] = s.count; });
    const branchMap = {};
    (stats.branchBreakdown || []).forEach(b => { branchMap[b._id] = b.count; });

    updateCharts(statusMap, branchMap);
    updateActivities(activitiesRes.data);
}

function updateCharts(statusMap, branchMap) {
    const placementCtx = document.getElementById('placementChart');
    const courseCtx    = document.getElementById('courseChart');
    if (!placementCtx || !courseCtx) return;

    if (placementChart) { placementChart.destroy(); }
    if (courseChart)    { courseChart.destroy();    }

    const statusLabels = ['Unplaced', 'Under Review', 'Interview Scheduled', 'Placed'];
    placementChart = new Chart(placementCtx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: statusLabels,
            datasets: [{
                data: statusLabels.map(l => statusMap[l] || 0),
                backgroundColor: ['#fee2e2','#fef3c7','#dbeafe','#dcfce7'],
                borderColor:     ['#dc2626','#d97706','#2563eb','#16a34a'],
                borderWidth: 2
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });

    const branchLabels = Object.keys(branchMap).length ? Object.keys(branchMap) : ['MCA','MBA'];
    courseChart = new Chart(courseCtx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: branchLabels,
            datasets: [{
                label: 'Students',
                data: branchLabels.map(l => branchMap[l] || 0),
                backgroundColor: ['rgba(99,102,241,0.2)','rgba(79,70,229,0.2)'],
                borderColor:     ['rgba(99,102,241,1)','rgba(79,70,229,1)'],
                borderWidth: 2
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
}

// Icon per activity type
function updateActivities(activities) {
    const el = document.getElementById('recent-activities');
    if (!el) return;
    const iconMap = {
        upload: 'file-upload',
        status: 'chart-line',
        event: 'calendar',
        application: 'paper-plane'
    };
    el.innerHTML = activities.length ? activities.slice(0, 5).map(a => `
        <div class="activity-item">
            <div class="d-flex align-items-center">
                <div class="activity-icon ${a.type}">
                    <i class="fas fa-${iconMap[a.type] || 'info-circle'}"></i>
                </div>
                <div>
                    <h6 class="mb-1">${esc(a.title)}</h6>
                    <p class="mb-0 text-muted"><small>${new Date(a.timestamp).toLocaleString()}</small></p>
                </div>
            </div>
        </div>`).join('') : '<div class="text-center text-muted">No recent activities</div>';
}

// ── students ──────────────────────────────────────────────────
async function loadStudents() {
    const res = await apiFetch('/admin/students');
    allStudents = res.data;
    updateStudentsList();
}

function updateStudentsList() {
    const search     = (document.getElementById('search-students')?.value || '').toLowerCase();
    const courseFilter = document.getElementById('filter-course')?.value || '';
    const statusFilter = document.getElementById('filter-status')?.value || '';

    const filtered = allStudents.filter(s => {
        const matchSearch  = s.name.toLowerCase().includes(search) || s.email.toLowerCase().includes(search);
        const matchCourse  = !courseFilter || s.course === courseFilter;
        const matchStatus  = !statusFilter || s.status === statusFilter;
        return matchSearch && matchCourse && matchStatus;
    });

    const el = document.getElementById('students-list');
    if (!el) return;
    el.innerHTML = filtered.map(s => `
        <div class="col-md-6 col-lg-4 mb-4">
            <div class="card student-card">
                <div class="card-body">
                    <h5 class="card-title">${esc(s.name)}</h5>
                    <p class="card-text">
                        <small class="text-muted">${esc(s.email)}</small><br>
                        <span class="badge bg-secondary">${esc(s.course || 'N/A')}</span>
                        <span class="status-badge status-${(s.status||'').toLowerCase().replace(/ /g,'-')}">
                            <i class="fas fa-circle"></i> ${s.status}
                        </span>
                    </p>
                    <div class="d-flex gap-2">
                        <select class="form-select form-select-sm" onchange="updateStudentStatus('${s.id}', this.value)">
                            ${['Unplaced','Under Review','Interview Scheduled','Placed'].map(v =>
                                `<option value="${v}" ${s.status === v ? 'selected' : ''}>${v}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
            </div>
        </div>`).join('');
}

window.updateStudentStatus = async function (studentId, status) {
    try {
        await apiFetch(`/admin/students/${studentId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        await loadStudents();
        showNotification('Student status updated');
    } catch (err) {
        showNotification(err.message, 'error');
    }
};

document.getElementById('search-students')?.addEventListener('input', updateStudentsList);
document.getElementById('filter-course')?.addEventListener('change', updateStudentsList);
document.getElementById('filter-status')?.addEventListener('change', updateStudentsList);

// ── export CSV ────────────────────────────────────────────────
document.getElementById('export-data')?.addEventListener('click', async function () {
    if (!allStudents.length) await loadStudents();
    const csv = [
        ['Name','Email','Course','Status','Skills','Education','Projects'],
        ...allStudents.map(s => [s.name, s.email, s.course, s.status, s.skills, s.education, s.projects])
    ].map(row => row.map(v => `"${(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'students_data.csv';
    a.click();
});

// ── resumes ───────────
async function loadResumes() {
    const res = await apiFetch('/admin/resumes');
    const el = document.getElementById('resumes-list');
    if (!el) return;
    el.innerHTML = res.data.map(s => `
        <tr>
            <td>${esc(s.name)}</td>
            <td>${esc(s.course || 'N/A')}</td>
            <td>${esc(s.resume.name)}</td>
            <td><span class="badge ${{ approved: 'bg-success', rejected: 'bg-danger' }[s.resume.status] || 'bg-warning'}">${{ approved: 'Approved', rejected: 'Rejected' }[s.resume.status] || 'Pending'}</span></td>
            <td>
                <div class="btn-group">
                    <button type="button" class="btn btn-sm btn-primary" data-resume-id="${esc(s.id)}" aria-label="View resume">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-success" onclick="approveResume('${s.id}')" ${s.resume.status === 'approved' ? 'disabled' : ''} aria-label="Approve resume">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="rejectResume('${s.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </td>
        </tr>`).join('');
}

// "View resume" — fetched with the admin token (files are not publicly accessible)
document.getElementById('resumes-list')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-resume-id]');
    if (!btn) return;
    try {
        await openProtectedPdf(`/admin/students/${btn.dataset.resumeId}/resume`);
    } catch (err) {
        showNotification(err.message, 'error');
    }
});

window.approveResume = async function (studentId) {
    try {
        await apiFetch(`/admin/resumes/${studentId}/approve`, { method: 'PUT' });
        await loadResumes();
        showNotification('Resume approved');
    } catch (err) { showNotification(err.message, 'error'); }
};

window.rejectResume = async function (studentId) {
    try {
        await apiFetch(`/admin/resumes/${studentId}/reject`, { method: 'PUT' });
        await loadResumes();
        showNotification('Resume rejected');
    } catch (err) { showNotification(err.message, 'error'); }
};

// ── companies ─────────────────────────────────────────────────
async function loadCompanies() {
    const [compRes, appRes] = await Promise.all([
        apiFetch('/companies'),
        apiFetch('/admin/applications')
    ]);
    allCompanies    = compRes.data;
    allApplications = appRes.data;
    displayCompanies();
    displayApplications();
}

function displayCompanies() {
    const el = document.getElementById('companies-list');
    if (!el) return;
    const search   = (document.getElementById('search-company')?.value || '').toLowerCase();
    const jobType  = document.getElementById('filter-job-type')?.value || '';
    const branch   = document.getElementById('filter-branch')?.value  || '';
    const sortBy   = document.getElementById('sort-companies')?.value || 'newest';

    let filtered = allCompanies.filter(c => {
        const matchSearch  = c.name.toLowerCase().includes(search) || c.location.toLowerCase().includes(search);
        const matchJobType = !jobType || c.jobType === jobType;
        const matchBranch  = !branch  || c.branches.includes(branch);
        return matchSearch && matchJobType && matchBranch;
    });

    filtered.sort((a, b) => {
        if (sortBy === 'newest')    return new Date(b.postedDate) - new Date(a.postedDate);
        if (sortBy === 'oldest')    return new Date(a.postedDate) - new Date(b.postedDate);
        if (sortBy === 'name-asc')  return a.name.localeCompare(b.name);
        if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
        return 0;
    });

    el.innerHTML = filtered.map(c => `
        <div class="company-card">
            <div class="d-flex align-items-start">
                <div class="company-info ms-3">
                    <h3>${esc(c.name)}</h3>
                    <p><i class="fas fa-map-marker-alt"></i> ${esc(c.location)}</p>
                    <p><i class="fas fa-briefcase"></i> ${esc(c.jobType)}</p>
                    <p><i class="fas fa-rupee-sign"></i> ${esc(c.package || 'N/A')}</p>
                </div>
            </div>
            <p class="mt-2">${esc(c.description)}</p>
            <div class="company-tags">
                <span class="company-tag">${esc(c.branches.join(', '))}</span>
                ${c.requirements ? `<span class="company-tag">${esc(c.requirements)}</span>` : ''}
            </div>
            <div class="company-actions">
                <button class="action-btn view-btn" onclick="viewCompanyDetails('${c._id}')">
                    <i class="fas fa-eye"></i> View Details
                </button>
                <button class="action-btn edit-btn" onclick="editCompany('${c._id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="action-btn delete-btn" onclick="deleteCompany('${c._id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>`).join('');
}

window.viewCompanyDetails = function (companyId) {
    const company = allCompanies.find(c => c._id === companyId);
    if (!company) return;
    const compApps  = allApplications.filter(a => a.company && a.company._id === companyId);
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
                        <div class="detail-item"><label>Posted Date</label><div class="value">${new Date(company.postedDate).toLocaleDateString()}</div></div>
                    </div>
                    <div class="company-stats mt-3">
                        <div class="stat-card"><div class="number">${compApps.length}</div><div class="label">Total Applications</div></div>
                        <div class="stat-card"><div class="number">${compApps.filter(a=>a.status==='Accepted').length}</div><div class="label">Accepted</div></div>
                        <div class="stat-card"><div class="number">${compApps.filter(a=>a.status==='Pending').length}</div><div class="label">Pending</div></div>
                    </div>
                </div>
            </div>
        </div>`;
    document.body.appendChild(modal);
    const m = new bootstrap.Modal(modal);
    m.show();
    modal.addEventListener('hidden.bs.modal', () => modal.remove());
};

window.editCompany = function (companyId) {
    const c = allCompanies.find(c => c._id === companyId);
    if (!c) return;
    document.getElementById('company-name').value         = c.name;
    document.getElementById('company-description').value  = c.description;
    document.getElementById('company-location').value     = c.location;
    document.getElementById('company-job-type').value     = c.jobType;
    document.getElementById('company-requirements').value = c.requirements || '';
    document.getElementById('company-package').value      = c.package || '';
    document.getElementById('branch-mca').checked = c.branches.includes('MCA');
    document.getElementById('branch-mba').checked = c.branches.includes('MBA');
    document.getElementById('add-company-form').style.display = 'block';
    document.getElementById('company-form').dataset.editId = companyId;
    document.querySelector('#company-form button[type="submit"]').textContent = 'Update Company';
};

window.deleteCompany = async function (companyId) {
    if (!confirm('Delete this company and all its applications?')) return;
    try {
        await apiFetch(`/companies/${companyId}`, { method: 'DELETE' });
        await loadCompanies();
        showNotification('Company deleted successfully');
    } catch (err) { showNotification(err.message, 'error'); }
};

window.showAddCompanyForm = function () {
    document.getElementById('add-company-form').style.display = 'block';
    document.getElementById('company-form').reset();
    delete document.getElementById('company-form').dataset.editId;
    document.querySelector('#company-form button[type="submit"]').textContent = 'Add Company';
};

document.getElementById('company-form')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const branches = [];
    if (document.getElementById('branch-mca').checked) branches.push('MCA');
    if (document.getElementById('branch-mba').checked) branches.push('MBA');

    const payload = {
        name:        document.getElementById('company-name').value,
        description: document.getElementById('company-description').value,
        location:    document.getElementById('company-location').value,
        jobType:     document.getElementById('company-job-type').value,
        requirements:document.getElementById('company-requirements').value,
        package:     document.getElementById('company-package').value,
        branches
    };

    try {
        if (this.dataset.editId) {
            await apiFetch(`/companies/${this.dataset.editId}`, {
                method: 'PUT', body: JSON.stringify(payload)
            });
            showNotification('Company updated successfully');
        } else {
            await apiFetch('/companies', {
                method: 'POST', body: JSON.stringify(payload)
            });
            showNotification('Company added successfully');
        }
        document.getElementById('add-company-form').style.display = 'none';
        this.reset();
        delete this.dataset.editId;
        await loadCompanies();
    } catch (err) { showNotification(err.message, 'error'); }
});

// applications
function displayApplications() {
    const el = document.getElementById('applications-list');
    if (!el) return;
    el.innerHTML = allApplications.length ? allApplications.map(app => `
        <div class="application-card">
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <h4>${esc(app.studentName)}</h4>
                    <p class="text-muted">${esc(app.studentEmail)}</p>
                    <p><strong>Company:</strong> ${esc(app.company ? app.company.name : 'N/A')}</p>
                    <p><strong>Applied on:</strong> ${new Date(app.appliedDate).toLocaleString()}</p>
                </div>
                <div class="application-status">
                    <i class="fas fa-${app.status === 'Accepted' ? 'check-circle' : app.status === 'Rejected' ? 'times-circle' : 'clock'}"></i>
                    <span>${app.status}</span>
                </div>
            </div>
            ${app.status === 'Pending' ? `
                <div class="action-buttons">
                    <button class="action-btn approve-btn" onclick="updateApplicationStatus('${app._id}','Accepted')">
                        <i class="fas fa-check"></i> Accept
                    </button>
                    <button class="action-btn reject-btn" onclick="updateApplicationStatus('${app._id}','Rejected')">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </div>` : ''}
        </div>`).join('') : '<div class="alert alert-secondary">No applications found</div>';
}

window.updateApplicationStatus = async function (appId, status) {
    try {
        await apiFetch(`/applications/${appId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        await loadCompanies();
        showNotification(`Application ${status.toLowerCase()}`);
    } catch (err) { showNotification(err.message, 'error'); }
};

// company filter/sort listeners
document.getElementById('search-company')?.addEventListener('input', displayCompanies);
document.getElementById('filter-job-type')?.addEventListener('change', displayCompanies);
document.getElementById('filter-branch')?.addEventListener('change', displayCompanies);
document.getElementById('sort-companies')?.addEventListener('change', displayCompanies);

// ── events / calendar ─────────────────────────────────────────
async function loadCalendar() {
    const res = await apiFetch('/events');
    allEvents = res.data;
    updateCalendar();
}

function updateCalendar() {
    const el = document.getElementById('calendar');
    if (!el) return;
    const sorted = [...allEvents].sort((a, b) => new Date(a.date) - new Date(b.date));
    el.innerHTML = sorted.length ? sorted.map((ev, i) => {
        const isUpcoming = new Date(ev.date) > new Date();
        return `
            <div class="calendar-event ${isUpcoming ? 'upcoming' : 'past'}">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h6 class="mb-1">${esc(ev.title)}</h6>
                        <p class="mb-0 text-muted"><small><i class="fas fa-clock me-2"></i>${new Date(ev.date).toLocaleString()}</small></p>
                        ${ev.description ? `<p class="mt-2">${esc(ev.description)}</p>` : ''}
                        ${!isUpcoming ? '<div class="mt-2"><span class="badge bg-secondary">Past Event</span></div>' : ''}
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-primary" onclick="editEvent('${ev._id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="deleteEvent('${ev._id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>`;
    }).join('') : '<div class="alert alert-secondary">No events scheduled</div>';
}

window.editEvent = function (eventId) {
    const ev = allEvents.find(e => e._id === eventId);
    if (!ev) return;
    document.getElementById('event-title').value       = ev.title;
    document.getElementById('event-date').value        = ev.date;
    document.getElementById('event-description').value = ev.description || '';
    document.getElementById('event-form').dataset.editId = eventId;
    document.querySelector('#event-form button[type="submit"]').textContent = 'Update Event';
};

window.deleteEvent = async function (eventId) {
    if (!confirm('Delete this event?')) return;
    try {
        await apiFetch(`/events/${eventId}`, { method: 'DELETE' });
        await loadCalendar();
        showNotification('Event deleted');
    } catch (err) { showNotification(err.message, 'error'); }
};

document.getElementById('event-form')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const payload = {
        title:       document.getElementById('event-title').value,
        date:        document.getElementById('event-date').value,
        description: document.getElementById('event-description').value
    };
    try {
        if (this.dataset.editId) {
            await apiFetch(`/events/${this.dataset.editId}`, {
                method: 'PUT', body: JSON.stringify(payload)
            });
            delete this.dataset.editId;
            this.querySelector('button[type="submit"]').textContent = 'Add Event';
            showNotification('Event updated');
        } else {
            await apiFetch('/events', { method: 'POST', body: JSON.stringify(payload) });
            showNotification('Event created');
        }
        this.reset();
        await loadCalendar();
    } catch (err) { showNotification(err.message, 'error'); }
});

// ── init ──────────────────────────────────────────────────────
async function init() {
    try {
        await loadDashboard();
        document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
        const dash = document.getElementById('dashboard-section');
        if (dash) dash.style.display = 'block';
        document.getElementById('section-title').textContent = 'Dashboard';
    } catch (err) {
        console.error('Init error:', err);
        showLoadError('We could not load the dashboard. Please check your connection and try again.');
    }
}

if (authorized) withLoading(init);
