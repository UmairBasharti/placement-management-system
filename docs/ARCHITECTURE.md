# Architecture

## 1. System overview

The app is a classic three-tier web application served from a **single Node.js process**: Express serves the static frontend pages *and* the JSON API, and talks to MongoDB.

```mermaid
flowchart LR
    subgraph Client["Browser"]
        P["Pages<br/>index · login · student-dashboard · admin-dashboard"]
        J["Vanilla JS<br/>fetch() with Bearer token"]
    end
    subgraph Server["Node.js · Express"]
        S["Security layer<br/>helmet (CSP) · CORS (closed) · rate limits"]
        A["Auth middleware<br/>verify JWT · role check"]
        R["Routes<br/>auth · students · companies<br/>applications · events · admin"]
        V["express-validator<br/>+ Mongoose schema validation"]
        E["Central error handler"]
    end
    subgraph Data["Storage"]
        M[("MongoDB Atlas")]
        F[("backend/uploads/<br/>resume PDFs")]
    end
    P -- "GET static files" --> S
    J -- "/api/* JSON" --> S
    S --> A --> R --> V --> M
    R --> F
    R -. "errors" .-> E
```

**Why one origin?** Serving the frontend from Express means no CORS configuration is needed, the app starts with a single command, and the Content-Security-Policy can be strict (`connect-src 'self'`).

## 2. Request lifecycle

1. **Static files** (`/`, `/login.html`, `/css/*`, `/js/*`) are served by `express.static`.
2. **API calls** (`/api/*`) pass through, in order: `helmet` → CORS (disabled unless `CLIENT_ORIGIN` is set) → JSON body parsing (100 kB limit) → rate limiters → route.
3. Protected routes run `protect` (verifies the JWT and loads the user) and, where needed, `authorize('admin' | 'student')`.
4. Input is validated (`express-validator` on auth routes, Mongoose schemas everywhere).
5. Any error is passed to `next(err)` and mapped by the **central error handler** to a clean 4xx/5xx response. Unknown API paths return a JSON 404; unknown pages return the branded `404.html`.

## 3. Authentication & authorization

```mermaid
sequenceDiagram
    actor U as User
    participant B as Browser
    participant S as Express API
    participant DB as MongoDB
    U->>B: email + password
    B->>S: POST /api/auth/login
    S->>DB: find user (+password hash)
    DB-->>S: user
    S->>S: bcrypt.compare()
    S-->>B: { token (JWT, 24h), user { role } }
    B->>B: store token + user in localStorage
    B->>S: GET /api/... (Authorization: Bearer token)
    S->>S: verify JWT signature + expiry
    S->>DB: load user by id
    S->>S: authorize(role)
    S-->>B: data (or 401 / 403)
    Note over B: On 401 the page clears the session<br/>and returns to the home page
```

- **Roles**: `student` and `admin`. Public registration can only create students; the admin account is created by the seed script.
- **Login page modes**: the "Admin Login" link (`login.html?admin=true`) only accepts admins; the normal login only accepts students. The server still enforces roles on every route, so this is a convenience, not the security boundary.
- **Token**: JWT containing the user id, signed with `JWT_SECRET`, expiring after `JWT_EXPIRE` (default 24 h). It is stored in `localStorage` (see the trade-off noted in the README).

## 4. Resume workflow

```mermaid
sequenceDiagram
    actor S as Student
    participant API as Express API
    participant FS as uploads/
    actor A as Admin
    S->>API: POST /students/me/resume (multipart PDF)
    API->>API: type + size check (multer, 5 MB)
    API->>FS: save as <random-uuid>.pdf
    API->>API: verify real "%PDF-" header
    alt not a real PDF
        API->>FS: delete file
        API-->>S: 400 "not a valid PDF"
    else valid
        API->>API: store metadata, approved = false, delete previous file
        API-->>S: 200
    end
    A->>API: GET /admin/students/:id/resume
    API-->>A: PDF stream (private, no-store)
    A->>API: PUT /admin/resumes/:id/approve
    API-->>S: notification "Your resume has been approved"
    Note over S,API: Applying requires an approved resume
```

Resumes are **never** exposed through a public URL; both the student and the admin download them through authenticated routes, and the browser opens them from a temporary blob URL.

## 5. Placement-status state machine

A student's `status` reflects their progress. The rules live in [`backend/utils/placementStatus.js`](../backend/utils/placementStatus.js) and are covered by unit tests.

```mermaid
stateDiagram-v2
    direction LR
    state "Under Review" as UnderReview
    state "Interview Scheduled" as InterviewScheduled

    [*] --> Unplaced
    Unplaced --> UnderReview: student applies
    UnderReview --> Unplaced: last pending application rejected
    UnderReview --> InterviewScheduled: admin sets status
    InterviewScheduled --> Placed: application accepted
    UnderReview --> Placed: application accepted
    Unplaced --> Placed: application accepted
    Placed --> UnderReview: offer withdrawn, another application pending
    Placed --> Unplaced: offer withdrawn, nothing else open
```

Key rules:
- Applying only moves an **Unplaced** student to *Under Review*; it never downgrades *Interview Scheduled* or *Placed*.
- Rejecting one application does **not** unplace a student who has been accepted elsewhere.
- *Interview Scheduled* is set manually by an admin and is never overridden by application decisions (other than becoming *Placed*).
- The timeline records only real status changes; the reason for each decision also appears as a notification.

## 6. Application rules

A student can apply to a company only if **all** of these hold (checked on the server):

| Rule | Error |
|---|---|
| Company exists and is `active` | 404 / 400 |
| The company is open to the student's branch | 403 |
| The student has uploaded a resume | 400 |
| The resume is **approved** by an admin | 400 |
| The profile has skills filled in | 400 |
| They have not applied to this company before (unique index) | 400 |

## 7. Frontend structure

| File | Responsibility |
|---|---|
| `js/utils.js` | Shared helpers: `esc()` (XSS-safe text), `openProtectedPdf()`, `initSidebar()`, `withLoading()`, `guarded()`, `showLoadError()` |
| `js/home.js` | Landing page: navbar, scroll effects, counters |
| `js/login.js` | Login / registration, role-specific login modes |
| `js/student-dashboard.js` | Student sections: dashboard, companies, profile, resume, status, calendar, notifications |
| `js/admin-dashboard.js` | Admin sections: dashboard (charts), companies, students, resumes, calendar |

Pages are plain HTML; dynamic content is rendered with template strings where **every** user- or admin-entered value goes through `esc()`. Layout uses a fixed sidebar on desktop and a top bar with a slide-in drawer below 993 px.
