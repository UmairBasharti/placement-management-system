# PMS — Audit & Fix Plan

Single source of truth for taking this project from "works on my machine" to portfolio/GitHub ready.
Work top to bottom, one item at a time. Tick the box when the **Done when** check passes.

**Legend**
- **[V]** reproduced by running it (headless Chrome 157 + mock API, or the real backend without a DB)
- **[C]** confirmed by reading the code (not yet executed — mostly needs MongoDB)
- Severity: 🔴 critical · 🟠 high · 🟡 medium · ⚪ low/polish

**Audit date:** 2026-11-06 · **Stack:** Node 25 / Express 4.22 / Mongoose 7.8 / Multer 1.4.5 / vanilla JS + Bootstrap 5.3
**Baseline facts (at audit time):** all 20 JS files pass `node --check`; no git repo yet; MongoDB not installed locally; `frontend/assets/` was empty.
**Progress since:** Atlas connected + seeded (0.2) · logo added (P1, partly) · dependencies updated, prod `npm audit` 0 vulns (S7) · CDN libs pinned with SRI (Phase 11) · B2 disproved. Still **no git repo** — item 0.1 is next.

---

## 🎯 Scope decision (2026-11-06) — semester project → clean GitHub repo with documentation

**Decided:** keep the current stack (Express + MongoDB Atlas + vanilla JS + Bootstrap). **No Next.js/React rewrite, no TypeScript migration** — not needed for the goal, and it would add weeks. The college is **not** hosting it; the deliverable is a clean, secure, well-documented GitHub repo. A live demo is optional.

**Work in tiers — finish a tier before starting the next.**

| Tier | Meaning | Items |
|---|---|---|
| **1 — Must** (safe to show, GitHub-ready) | Nothing embarrassing or dangerous if the guide or a recruiter opens it | **0.1, 0.3** · **S1, S2, S3, S4, S5, S6, S8** (S7 ✅) · **R1, R2, R3, R11, R13, R15, R16, R17** · **F1–F5** · **B1, B4, B5, B6, B7, B8, B9, B13** · **C1, C2** · **P1** (favicon) · **D1–D5** |
| **2 — Should** (polish) | Makes it feel finished | Remaining **B**, **F6–F14**, remaining **R**, **Q1–Q4**, **P2–P4**, **C3**, **C4** (a few tests), Multer 2 (with S2) |
| **3 — Optional / later** | Nice extras, not required | **FEAT-1** resume auto-fill, **FEAT-2** recommendations, **Phase 10** cloud storage, **C5/C6** deploy + CI, remaining major upgrades (express 5, mongoose 9), **P5**, TypeScript / Next.js |

**Hosting — what GitHub can and can't do**

| Option | Runs this app? | Notes |
|---|---|---|
| **GitHub repository** | n/a (stores code) | The real deliverable: README, screenshots/GIF, docs, LICENSE |
| GitHub Pages | ❌ static files only | No Express, no MongoDB → login/features would not work |
| Render / Railway | ✅ as-is | Serves frontend + API on one URL with Atlas; free tiers sleep when idle and terms change — verify at deploy time. Needs cloud storage for resumes (Phase 10) because the disk is wiped on deploy |
| Vercel | ⚠️ needs rework | Express must become serverless functions; request bodies are limited to roughly 4.5 MB (below the 5 MB resume cap); no persistent disk |
| Demo video / GIF in the README | ✅ | Usually enough for a semester project; costs nothing |

**Documentation to deliver (Tier 1, D-items):** README with screenshots and a demo GIF/video, setup + env table, demo credentials, API table, troubleshooting (D1b); and a `docs/` folder with an architecture diagram, database schema/ER diagram, user flows for student and admin, and a short user manual — these are what a guide typically looks for.

---

## Phase 0 — Setup before touching code

- [x] **0.1 — DONE 2026-11-06** (repo initialised on `main`, root `.gitignore` in place, redundant `backend/.gitignore` removed because it blocked `uploads/.gitkeep`; **no commit made yet**). Original task: `git init` at repo root, add a root `.gitignore` (`node_modules/`, `.env`, `backend/uploads/*`, `!backend/uploads/.gitkeep`, `.DS_Store`, `*.log`). Make the first commit *before* any fix so every change is diffable.
- [x] **0.2 — DONE 2026-11-06 (Atlas connected, DB seeded, login verified).** **Decision: move to MongoDB Atlas** (local MongoDB isn't running and its old users/passwords are unknown). Steps — you do these in the Atlas website, then put the string in `backend/.env` yourself (never paste it into chat or commit it):
  1. Create a free Atlas account → create an **M0 (free)** cluster.
  2. *Database Access* → add a database user + password (avoid special characters, or URL-encode them).
  3. *Network Access* → allow your current IP (use `0.0.0.0/0` only temporarily for a hosted demo).
  4. *Connect → Drivers* → copy the `mongodb+srv://…` string into `MONGODB_URI` in `backend/.env`, adding the DB name, e.g. `…mongodb.net/pms?retryWrites=true`.
  5. Run `npm run seed` in `backend/` → this creates **known** logins: `admin@pms.com` / `admin123`, `rahul@pms.com` and `priya@pms.com` / `student123` (demo only — see S8). Old local data is simply left behind; nothing needs migrating.
  6. Start the app and log in as admin to confirm.
  7. **Troubleshooting we actually hit — `querySrv ECONNREFUSED`:** Windows could resolve the cluster but *Node's* resolver failed on this network's DNS servers (a router/ISP refusing SRV lookups; it is **not** a password or IP-allowlist problem). Fix, now in the code: `server.js` and `seed.js` call `dns.setServers()` when `DNS_SERVERS` is set; `backend/.env` has `DNS_SERVERS=8.8.8.8,1.1.1.1`. Also add the DB name (`…mongodb.net/pms?retryWrites=true&w=majority`) — without it data lands in a database called `test`. Document this in the README (D1) and `.env.example`.
- [x] **0.3 — DONE 2026-11-06** (both resumes *moved*, not deleted, to `D:\PMS-Documentation\_local-backup\uploads\`, outside the repo; delete them whenever you like). Original task: check `backend/uploads/` holds 2 real-looking resumes (`69d1…pdf`, `69d1…PDF`) → delete or move them out; they must never be committed.

---

## Phase 1 — Security 🔴 (must fix before the repo goes public)

### S1 🔴 [V] Stored XSS everywhere (`innerHTML` with unescaped data)
- **Where:** every template in [frontend/js/admin-dashboard.js](frontend/js/admin-dashboard.js) and [frontend/js/student-dashboard.js](frontend/js/student-dashboard.js) — names, emails, company fields, event title/description, notification messages, activity titles, `resume.name` (= the client's original filename), status history messages. Also `showAlert` in [login.js:45](frontend/js/login.js#L45) and `showNotification` in [student-dashboard.js:47](frontend/js/student-dashboard.js#L47).
- **Evidence:** a company description containing `<img src=x onerror=…>` executed twice on the student page.
- **Impact:** JWT lives in `localStorage` → a student registering with a malicious *name* steals the admin's token when the admin opens Students / Activities / Applications.
- **Fix:** add one `escapeHtml()` helper (shared file, see Q1) and wrap every interpolated value, or build DOM with `textContent`. Replace inline `onclick="fn('${id}')"` with `data-id` attributes + event delegation (also fixes F2).
- [x] **Done when:** a company description / student name of `<img src=x onerror=alert(1)>` renders as literal text on both dashboards. — **DONE 2026-11-06 (commit "S1 + F2")**: new `frontend/js/utils.js` exposes `esc()`; every user/admin-entered field in `student-dashboard.js`, `admin-dashboard.js` and `login.js` templates is escaped; resume links get `rel="noopener"`. Tested in headless Chrome with a payload injected into every text field (names, emails, company/event text, notifications, activities, resume names): payload never executed on any section or modal and appeared as literal text. **Remaining inline `onclick`s** only carry server-generated Mongo ObjectIds (not user text) and are left for the shared-utils refactor (Q1); enum values (status) are not escaped because the server validates them.

### S2 🔴 [C] Upload accepts any file type and keeps the client's extension
- **Where:** [backend/utils/fileUpload.js:16](backend/utils/fileUpload.js#L16) (`path.extname(file.originalname)`), [:22](backend/utils/fileUpload.js#L22) (only checks client-sent MIME); served from same origin by [server.js:24](backend/server.js#L24).
- **Impact:** upload `x.html` with `Content-Type: application/pdf` → saved as `.html`, served as `text/html` on your origin → script runs when the admin clicks "view resume".
- **Fix:** always save as `.pdf`; verify magic bytes `%PDF-` after upload (delete + 400 if not); serve with `Content-Disposition` / `X-Content-Type-Options: nosniff`.
- [ ] **Done when:** uploading a renamed HTML file is rejected with 400 and nothing is written to disk.

### S3 🔴 [V] Resumes are publicly downloadable
- **Where:** [server.js:24](backend/server.js#L24) `express.static('uploads')`.
- **Evidence:** `GET /uploads/<file>.pdf` → `200 application/pdf` with no token.
- **Fix:** remove the static mount; add `GET /api/students/:id/resume` (admin, or the owner) that streams the file after `protect`. Frontend fetches as blob → `URL.createObjectURL` (a plain `<a href>` can't send the Bearer header). Use random filenames (`crypto.randomUUID()`), not `userId-timestamp`.
- [ ] **Done when:** the old `/uploads/...` URL returns 404 and an unauthenticated API call returns 401.

### S4 🟠 [V] Admin-private company notes are sent to students _(confirmed live against Atlas 2026-11-06: a student's `GET /api/companies` items include the `notes` key)_
- **Where:** [company.routes.js:19](backend/routes/company.routes.js#L19) and [:30](backend/routes/company.routes.js#L30) return full documents including `notes`.
- **Fix:** `.select('-notes')` when `req.user.role === 'student'`.
- [ ] **Done when:** the student `GET /api/companies` response has no `notes` key.

### S5 🟠 [V] No hardening middleware
- **Evidence:** 15 rapid failed logins all accepted; headers show `X-Powered-By: Express` and `Access-Control-Allow-Origin: *`; no CSP / HSTS / nosniff.
- **Fix:** `helmet()` (with a CSP allowing your CDNs, or self-host them), `express-rate-limit` on `/api/auth/*` (e.g. 10 per 15 min per IP), `cors({ origin: process.env.CLIENT_ORIGIN })` or remove CORS (same origin), `app.disable('x-powered-by')`, `app.set('trust proxy', 1)` when deployed behind a proxy, `express.json({ limit: '100kb' })`.
- [ ] **Done when:** the 11th rapid login gets 429 and the response headers include helmet's set.

### S6 🟠 [V] Internal error messages leak to clients
- **Where:** every `catch` returns `error.message` (e.g. [auth.routes.js:52](backend/routes/auth.routes.js#L52), [:84](backend/routes/auth.routes.js#L84) always, regardless of `NODE_ENV`).
- **Evidence:** login returned ``Operation `users.findOne()` buffering timed out after 10000ms``.
- **Fix:** route errors to `next(err)` (or an `asyncHandler` wrapper); the central handler maps ValidationError→400, CastError→400, 11000→409, Multer→400 and otherwise returns a generic 500. Log details server-side only.
- [ ] **Done when:** no response body contains a Mongoose/Mongo message.

### S7 🟠 [V] Vulnerable dependencies
- **Evidence:** `npm audit` → 5 issues: proxy-addr (**critical**), body-parser (high), ip-address (high), mongoose 7.x (moderate, prototype pollution), qs (moderate).
- **Fix:** `npm audit fix`; consider Mongoose 8 + Multer 2. Re-run the app after upgrading.
- [x] **Done when:** `npm audit --omit=dev` reports 0 vulnerabilities. — **DONE 2026-11-06:** `npm update` + `npm audit fix` took production vulnerabilities from 5 → 0 (mongoose 7.8.13, express 4.22.3). 2 *moderate* findings remain in **nodemon (dev-only, minimatch)**; `--force` would downgrade it, so deliberately left. Mongoose 8/9 + Multer 2 majors still pending (Phase 11).

### S8 🟠 [C] Secrets & config
- `.env` holds a real-looking `JWT_SECRET` → rotate it; add `backend/.env.example` with placeholders.
- [auth.routes.js:11](backend/routes/auth.routes.js#L11) / [auth.middleware.js:20](backend/middleware/auth.middleware.js#L20): fail fast at startup if `JWT_SECRET` / `MONGODB_URI` are missing.
- [seed.js:40](backend/seed.js#L40) defaults the admin password to `admin123`, and the README advertises it → fine for a demo, but label it "demo credentials" and require `ADMIN_SEED_PASSWORD` in production.
- [x] **Done when:** the server refuses to start without `JWT_SECRET`; `.env.example` exists; the real `.env` is untracked. — **DONE 2026-11-06 (commit "S8")**: `backend/config/validateEnv.js` (required vars; weak/placeholder secret → warn in dev, refuse in production), `backend/.env.example`, localhost DB fallback removed, production seed requires `ADMIN_SEED_PASSWORD`, local `JWT_SECRET` rotated (96 hex chars; everyone must log in again). Tested: missing secret/URI → exit 1, prod + weak secret → exit 1, prod seed without password → exit 1, normal start + admin login OK.

### S9 ⚪ [C] Token storage / session model
- 24h JWT in `localStorage`, no revocation, no refresh. Acceptable for a portfolio **after S1**; document it as a known trade-off (or move to an httpOnly cookie + CSRF protection).
- `localStorage` is shared across tabs: logging in as admin in tab A and student in tab B overwrites the token, so the other tab silently acts as the wrong user (403s). Listen for the `storage` event and reload/logout.
- [ ] **Done when:** the README "Security notes" section documents the trade-off and the multi-tab handling is added.

---

## Phase 2 — Layout breakers (most visible in a demo)

### R1 🔴 [V] Student dashboard overflows horizontally on every desktop
- **Cause:** `.main-content` is a child of Bootstrap `.row` → `.row > * { width:100% }` **plus** `margin-left:280px`. The page is 1720px wide at 1440; the right 280px (Profile Completion card etc.) is cut off.
- **Where:** [student-dashboard.html:15-17,58](frontend/student-dashboard.html#L15), [student-dashboard.css:69](frontend/css/student-dashboard.css#L69).
- **Fix:** drop `.container-fluid > .row` wrappers, or give `.main-content { width: auto; flex: 1; }` / `width: calc(100% - var(--sidebar-width))`.
- [ ] **Done when:** `document.documentElement.scrollWidth === clientWidth` at 1440 and 1024.

### R2 🔴 [V] Admin dashboard overflows on desktop and is 75% wide on tablet
- **Cause:** `col-md-3 col-lg-2` / `col-md-9 col-lg-10` Bootstrap columns mixed with a fixed 280px sidebar and `margin-left:280px`. Overflows by 40px at 1440 and 109px at 1024; at 768–992px `col-md-9` keeps the content at 75% width (615 of 820px, empty right quarter).
- **Where:** [admin-dashboard.html:18,43](frontend/admin-dashboard.html#L18), [admin-dashboard.css:69](frontend/css/admin-dashboard.css#L69).
- **Fix:** remove the `col-*` classes; use the same layout as the fixed R1.
- [ ] **Done when:** no horizontal scroll at 1440/1024 and the content is full width at 820.

### R3 🟠 [V] Stray unstyled hamburger button at the bottom of both dashboards on desktop
- **Cause:** JS always creates `.mobile-menu-toggle` ([admin-dashboard.js:79](frontend/js/admin-dashboard.js#L79), [student-dashboard.js:94](frontend/js/student-dashboard.js#L94)), but its CSS lives only inside `@media (max-width: 992px)`.
- **Fix:** put the toggle in the HTML once with a base `display:none` rule; show it in the media query. Delete the dead `#mobile-menu-btn` / `.mobile-header` duplicate on the student page (R9).
- [ ] **Done when:** nothing is visible below the footer at 1440.

### R11 🔴 [V] Home page: Login / Signup and Admin Login are unreachable on phones and tablets
- **Cause:** `.navbar` has `backdrop-filter` ([home.css:14](frontend/css/home.css#L14)), which makes it the containing block for its `position:fixed` children → `.nav-actions { bottom: 2rem }` ([home.css:591](frontend/css/home.css#L591)) resolves against the 70px navbar → buttons sit at y = −72 (off-screen). Screenshot: "Admin Login" clipped at the top edge, "Login / Signup" invisible.
- **Fix:** move `.nav-actions` *inside* the `.nav-menu` drawer as the last item, or move the blur to a `::before` pseudo-element so the navbar stops being a containing block.
- [ ] **Done when:** both buttons are visible and tappable in the open drawer at 390 and 820.

### R13 🟠 [V] Login button hidden behind the fixed footer on short phones
- **Evidence:** at 390×667 (iPhone SE size) the hit-test on the Login button returns `.footer-content`; the footer is 139px tall and `position:fixed` ([login.css:729](frontend/css/login.css#L729)).
- **Fix:** make the login footer static (or hide it under 700px tall); use `100dvh` instead of `100vh`.
- [ ] **Done when:** the Login button is tappable at 390×667 and 320×568.

---

## Phase 3 — Functional bugs (frontend)

### F1 🟠 [V] "Recent Applications" shows the 3 *oldest*
- [student-dashboard.js:215](frontend/js/student-dashboard.js#L215) — the API is already newest-first; `.slice(-3).reverse()` takes the tail. → `.slice(0, 3)`.
- [ ] Done when: the newest 3 show, newest first.

### F2 🟠 [V] Calendar "Add / Remove" buttons break on apostrophes and newlines
- [student-dashboard.js:493-506](frontend/js/student-dashboard.js#L493): an event titled `Alumni's Meet` → `SyntaxError: missing ) after argument list`; the button is dead. Fix via data-attributes + delegation (S1); reference events by `_id` (see B15).
- [x] Done when: the `Alumni's Meet` event can be added and removed. — **DONE 2026-11-06 with S1**: calendar buttons now use `data-action` / `data-event-id` + one delegated click handler (no text inside inline JS), button disables during the request and re-enables after a failure. Verified: clicking Add on the apostrophe-titled event sends `POST /api/students/me/events`.

### F3 🟠 [V] Login/Register button vanishes while loading
- `setLoading` adds the class `loading` ([login.js:56](frontend/js/login.js#L56)), which collides with the global overlay rule `.loading { display:none; position:fixed; … }` ([common.css:149](frontend/css/common.css#L149)). Computed `display` = `none`, so the spinner never shows. → rename to `is-loading` / `btn-loading`.
- [ ] Done when: the spinner is visible during the request.

### F4 🟠 [V] No loading / error states anywhere
- With the API down: the student page shows **Dashboard and Profile sections stacked** (profile-section has no initial `display:none`, [student-dashboard.html:226](frontend/student-dashboard.html#L226)); the admin page is silent; errors go only to `console`. `#loadingOverlay` is never toggled.
- Fix: hide all sections except dashboard in the HTML; wrap every loader in try/catch → toast + inline retry; show the overlay or skeletons while loading.
- [ ] Done when: blocking `fetch` shows a friendly error and only one section.

### F5 🟠 [C] `apiFetch` returns `undefined` on 401 → TypeErrors
- [admin-dashboard.js:11,19](frontend/js/admin-dashboard.js#L19) / [student-dashboard.js:12,22](frontend/js/student-dashboard.js#L22): after `logout()` the function returns `undefined`, so `res.data` throws. The auth guard ([admin:43](frontend/js/admin-dashboard.js#L43), [student:58](frontend/js/student-dashboard.js#L58)) calls `logout()` but the script keeps running; `JSON.parse` of corrupt storage throws. Nav click handlers have no try/catch (unhandled rejections).
- Fix: throw a sentinel after redirect; `return` after the guard; wrap `JSON.parse` in try/catch.
- [ ] Done when: an expired token cleanly redirects with no console errors.

### F6 🟡 [C] Profile completion is misleading
- [student-dashboard.js:132](frontend/js/student-dashboard.js#L132): name and course are always set at registration → 40% baseline; "Personal Information" / "Course Details" are always ticked; projects are not counted.
- [ ] Done when: completion reflects only fields the student actually fills in.

### F7 🟡 [C] "Apply Now" inside the company modal leaves the modal open with stale content
- [student-dashboard.js:445,459](frontend/js/student-dashboard.js#L459) → close or re-render the modal after applying; disable the button while the request is in flight (double-click → duplicate request).
- [ ] Done when: the modal closes and shows status after applying.

### F8 🟡 [C] Ctrl+F hijacked on every student page
- [student-dashboard.js:649](frontend/js/student-dashboard.js#L649) breaks the browser's Find. Remove it, or only trigger on `/` while the Companies section is visible.
- [ ] Done when: Ctrl+F opens browser find.

### F9 🟡 [C] Admin company form problems
- [admin-dashboard.js:397-463](frontend/js/admin-dashboard.js#L397): editing silently drops branches other than MCA/MBA; there is no Cancel / close button; the heading stays "Add New Company" while editing; no scroll to the form; no validation that at least 1 branch is ticked; `requirements` is `required` in the form but optional on the backend.
- [ ] Done when: edit/cancel/validation all work and branches round-trip.

### F10 🟡 [C] CSV export
- [admin-dashboard.js:240-252](frontend/js/admin-dashboard.js#L240): formula injection (values starting with `= + - @`), no UTF-8 BOM (Excel garbles non-ASCII), object URL never revoked; the "Export Data" button sits on every section but only exports students.
- [ ] Done when: prefixed cells are neutralised, a BOM is added and the button is labelled "Export students".

### F11 🟡 [C] Admin dashboard data gaps
- `/admin/stats` totals (`totalStudents`, `placedStudents`, …) are fetched but never displayed → add KPI cards.
- The activities API returns 10, the UI slices 5 ([admin-dashboard.js:163](frontend/js/admin-dashboard.js#L163)).
- The `company` activity type has no icon or colour (JS `iconMap` + CSS `.activity-icon.company` missing) — seen as a black ⓘ.
- [ ] Done when: KPI cards render and every activity type has an icon.

### F12 ⚪ [C] Wasteful / pointless requests and filters
- Student `init()` fetches profile/applications/events, then `loadDashboard()` fetches them again (about 9 requests instead of 4). [student-dashboard.js:621](frontend/js/student-dashboard.js#L621).
- The student Branch filter is pointless: the API already returns only the student's branch.
- [ ] Done when: init makes each request once and the student branch filter is removed.

### F13 ⚪ [C] Missing UI for existing backend features
- No UI for company notes (`POST /api/companies/:id/notes`) or "mark notifications read" (`PUT /me/notifications/read`); no unread badge.
- Admin can't view a student's skills, education, projects, resume or history (the API returns them).
- [ ] Done when: each feature has a UI, or the unused endpoint is removed.

### F14 ⚪ [C] Small UX gaps
- The status `<select>` in the admin Students list changes status instantly with no confirmation; native `confirm()` dialogs everywhere.
- No client-side checks: password `minlength`, file size ≤ 5 MB, at least one branch.
- Event form allows past dates (no `min`).
- Refresh always returns to Dashboard (no `#hash` routing).
- [ ] Done when: these checks/confirmations are in place.

---

## Phase 4 — Backend logic & data bugs

| ID | Sev | Status | Issue | Where | Fix |
|---|---|---|---|---|---|
| B1 | 🟠 | [V] | Email regex rejects valid addresses (`.info`, `.tech`, `.online`, `user+tag@…`). `express-validator` accepts them first → **500** | [user.model.js:15](backend/models/user.model.js#L15) | Drop the custom regex; rely on `isEmail()` |
| ~~B2~~ | — | **NOT A BUG** | ~~Login/duplicate check are case-sensitive~~ — **disproved 2026-11-06 against Atlas:** `Rahul@pms.com` logs in fine (HTTP 200) and registering `Rahul@pms.com` returns "Email already registered". Mongoose runs the schema's `lowercase` setter on query filters too. Still worth adding `.normalizeEmail()`/`trim()` in the validators for tidy input, but nothing is broken | [auth.routes.js:35,70](backend/routes/auth.routes.js#L35) | Optional tidy-up only |
| B3 | 🟠 | [C] | User created, then Student creation fails → orphan account that can log in but always 404s | [auth.routes.js:40-43](backend/routes/auth.routes.js#L40) | Transaction, or delete the user on failure |
| B4 | 🟠 | [V] | Validation failures return `{errors:[…]}` with no `message` → frontend shows "Request failed" | [auth.routes.js:26,64](backend/routes/auth.routes.js#L26) | Return `message: errors.array()[0].msg` too |
| B5 | 🟠 | [C] | Multer errors (wrong type, >5 MB) → 500 "Internal Server Error" | [student.routes.js:73](backend/routes/student.routes.js#L73) | Handle `MulterError` → 400 with a clear message |
| B6 | 🟠 | [C] | Any new application resets status to "Under Review", **downgrading Placed / Interview Scheduled** students | [application.routes.js:72](backend/routes/application.routes.js#L72) | Only change status if currently `Unplaced` |
| B7 | 🟠 | [C] | Rejecting a Pending application sets the student to "Unplaced" even if accepted elsewhere; history entries are added when nothing changed; Accepted→Pending doesn't undo Placed | [application.routes.js:119-134](backend/routes/application.routes.js#L119) | Derive student status from all their applications |
| B8 | 🟠 | [C] | Apply skips eligibility: branch, `company.status === 'active'`, resume approved (the home page promises "admin-approved resumes") | [application.routes.js:35-53](backend/routes/application.routes.js#L35) | Add the 3 checks |
| B9 | 🟡 | [C] | **Branch never validated** — `body('branch').notEmpty()` accepts any string; a student registered with `XYZ` sees zero companies. MCA/MBA hardcoded in 13 places across frontend + seed | [auth.routes.js:21](backend/routes/auth.routes.js#L21) | `isIn(BRANCHES)` from one shared constant; expose `GET /api/meta/branches` and render selects from it |
| B10 | 🟡 | [C] | `GET /companies/:id` skips the branch/active filter the list applies | [company.routes.js:28](backend/routes/company.routes.js#L28) | Same filter for students |
| B11 | 🟡 | [C] | Mass assignment in update (`...rest` → `status`, `notes`, `postedDate`…); `package` can't be cleared (`''` is falsy) | [company.routes.js:77-83](backend/routes/company.routes.js#L77) | Whitelist fields; check `!== undefined` |
| B12 | 🟡 | [C] | Create with no branches stores `[undefined]`; ValidationError → 500 | [company.routes.js:57](backend/routes/company.routes.js#L57) | Validate with express-validator; ValidationError → 400 |
| B13 | 🟡 | [C] | Invalid ObjectId on any `/:id` → CastError 500 | all `/:id` routes | `isMongoId()` param validator or CastError→400 |
| B14 | 🟡 | [C] | Resume "reject" = `approved:false`, same as pending; approve works with no resume; old files never deleted on re-upload; no rejection reason | [admin.routes.js:150-199](backend/routes/admin.routes.js#L150) | `status: 'pending'/'approved'/'rejected'` + `reason`; delete the old file; 400 if no resume |
| B15 | 🟡 | [C] | Events stored as strings (no date validation, no timezone, lexicographic sort); student calendar entries copy title+date instead of referencing `eventId` → edits/deletes orphan them | [event.model.js:9](backend/models/event.model.js#L9), [student.model.js:41](backend/models/student.model.js#L41) | `date: Date`; store `eventId` refs |
| B16 | 🟡 | [C] | Hard delete of a company deletes its applications and leaves student statuses stale; the `inactive` status is unused | [company.routes.js:113-116](backend/routes/company.routes.js#L113) | Soft delete (set `inactive`) |
| B17 | 🟡 | [C] | Unbounded growth: every event create/update/delete `$push`es a notification to **every** student; notifications never marked read; `Activity` has no TTL | [event.routes.js:30,60,83](backend/routes/event.routes.js#L30) | Separate Notification collection with TTL / cap; mark-read wired up |
| B18 | 🟡 | [C] | One orphan Student (user deleted) → `/admin/students`, `/admin/resumes`, status update all 500 (`s.user._id`) | [admin.routes.js:72,137,118](backend/routes/admin.routes.js#L72) | Filter `s.user` null / use optional chaining |
| B19 | ⚪ | [C] | No pagination / server-side search on students, applications, activities | admin routes | `?page&limit&q` |
| B20 | ⚪ | [C] | `seed.js` clears User/Student/Company but **not** Application/Event/Activity → orphan applications after re-seed; interactive `readline` prompt hangs in non-TTY/CI | [seed.js:31](backend/seed.js#L31) | Clear all collections; `--force` flag |
| B21 | ⚪ | [C] | Profile update: empty name silently ignored; no length limits on any text field; `branch` can never be changed by anyone | [student.routes.js:52](backend/routes/student.routes.js#L52) | Validators with `isLength({max})` |
| B22 | ⚪ | [C] | Multi-document writes (application + student + activity) not atomic | application / company routes | Transactions (needs a replica set / Atlas) or accept and document |
| B23 | ⚪ | [C] | Unused import `Application` in [student.routes.js:6](backend/routes/student.routes.js#L6); register sends an ignored `role` ([login.js:131](frontend/js/login.js#L131)) | — | Remove |

- [ ] B1 · [ ] B2 · [ ] B3 · [ ] B4 · [ ] B5 · [ ] B6 · [ ] B7 · [ ] B8 · [ ] B9 · [ ] B10 · [ ] B11 · [ ] B12
- [ ] B13 · [ ] B14 · [ ] B15 · [ ] B16 · [ ] B17 · [ ] B18 · [ ] B19 · [ ] B20 · [ ] B21 · [ ] B22 · [ ] B23

---

## Phase 5 — Server config & robustness

- [ ] **C1 🟠 [V]** Catch-all `app.get('*')` ([server.js:50](backend/server.js#L50)) returns the **home page with HTTP 200** for `/api/typo`, `/favicon.ico`, `/js/nope.js` and the missing logo; unknown POSTs get an HTML 404. → JSON 404 for `/api/*`, a real 404 for missing static files (this isn't a SPA; the comment is wrong).
- [ ] **C2 🟠 [V]** The server listens even when MongoDB fails ([server.js:45-47](backend/server.js#L45)); requests then hang 10s. → connect first, `process.exit(1)` on failure; add SIGTERM graceful shutdown + `GET /api/health`.
- [ ] **C3 🟡 [C]** Add `compression`, `morgan` request logging, `express-mongo-sanitize` (defence in depth), `"engines": { "node": ">=20" }`, `autoIndex: false` in production.
- [ ] **C4 🟡 [C]** No tests, lint or formatting: add ESLint + Prettier, and a small Jest + Supertest suite (auth, apply, status cascade) using `mongodb-memory-server`.
- [ ] **C5 🟡 [C]** **Deployment blocker:** uploads go to local disk — Render/Railway/Vercel wipe it on every deploy. → decision and plan in **Phase 10 (Storage)**. No deploy config yet (Dockerfile or `render.yaml`), no Atlas instructions.
- [ ] **C6 ⚪ [C]** No CI: a GitHub Actions workflow running lint + tests + `npm audit` on push.

---

## Phase 6 — Remaining responsiveness

**Desktop**
- [ ] **R4 🟠 [V]** Student Companies page buttons unstyled — `.company-actions`, `.action-btn`, `.view-btn`, `.approve-btn`, `.reject-btn` exist only in [admin-dashboard.css:309-353](frontend/css/admin-dashboard.css#L309). "View Details" renders as a raw grey browser button. → move to a shared `dashboard.css` (Q2).
- [ ] **R5 🟡 [C]** Every `.card` lifts 5px on hover, including large form/table/calendar cards → jitter while typing or clicking. Limit to small clickable cards.
- [ ] **R6 ⚪ [V]** The login register form scrolls inside its fixed 550px card on desktop (content 577px). → `min-height` instead of `height`, or tighter spacing.

**Tablet (768–992)**
- [ ] **R8 🟠 [V]** The fixed hamburger (top-left, 40px) covers the page title on both dashboards ("Dashboard" reads "shboard"). → a real top bar with the toggle, or `padding-left` on the header.
- [ ] **R9 🟡 [V]** Student page has 2 overlapping hamburgers: HTML `#mobile-menu-btn` (no handler) + the JS-created one; the "PMS" label sits under them.

**Mobile**
- [ ] **R12 🟡 [V]** The closed home-page drawer's links are off-screen but still keyboard-focusable → `visibility:hidden` / `inert` when closed; add `aria-expanded` on the hamburger; close on outside click / Esc.
- [ ] **R14 🟡 [V]** Login ≤650px: `.container` keeps `max-width: calc(100% - 40px)` → the red panel is inset 20px while the form sheet is full-bleed (misaligned gutters); `100vh` → `100dvh`.
- [ ] **R15 🟠 [V]** Fixed dashboard footer is 147px tall at 390px (17% of 844, **32% of a 568px screen**) and hides the last 51–67px of content (`padding-bottom: 5rem` too small). → static footer on dashboards.
- [ ] **R16 🟠 [V]** The open mobile sidebar is painted over by the footer (both z-index 1000, footer later in the DOM; overlay 999 sits below the footer). At 390×667 the footer covers **Logout**.
- [ ] **R17 🟠 [V]** The sidebar and overlay stay open after tapping a nav link → close them in the nav click handler.
- [ ] **R18 🟡 [V]** Admin company filters squashed (search 86px, selects 108px) — `.filter-group` has no wrap or mobile rule ([admin-dashboard.css:426](frontend/css/admin-dashboard.css#L426)).
- [ ] **R19 ⚪ [V]** Admin Companies shows two headings ("Companies" + "Company Management").
- [ ] **R20 🟡 [V]** Login branch `<select>` unstyled (Arial, native look): the page loads Bootstrap **JS** but not its CSS ([login.html:105](frontend/login.html#L105)) and uses `mb-3 form-label form-select`. → style it like `.input-box` and drop the unused Bootstrap JS.
- [ ] **R21 ⚪ [C]** Hover transforms stick on touch devices (wrap in `@media (hover: hover)`); small touch targets (`btn-sm` icon buttons, 0.75rem footer links); modal body `padding: 2rem` on 320px; admin Resumes table is 475px wide (actions need a sideways scroll — consider a card layout on mobile); `.btn-group` stacking makes the `<a>` button narrower than the `<button>`s.

**Checked and fine:** home page has no horizontal scroll at 320–1440; login is fine at 820/1440; dashboards have no horizontal scroll at ≤992.

---

## Phase 7 — Code quality, accessibility, polish

- [ ] **Q1 🟡** `apiFetch` / `logout` / `showNotification` duplicated in 3 JS files (and they differ: the student version lets `options.headers` overwrite Authorization). → one `js/api.js` + `js/utils.js` (escapeHtml, formatDate, toast).
- [ ] **Q2 🟡** `student-dashboard.css` and `admin-dashboard.css` are ~60% identical → a shared `dashboard.css`.
- [ ] **Q3 ⚪** Dead CSS: `.auth-container`, `.social-login`, `.social-icons`, `.form-switch`, `.forgot-link`, `.profile-header`, `.profile-actions`, `.notification-item`, `.filter-select`, `.company-logo`, `.student-info`, `.student-actions`, `.company-notes`/`.note-item`/`.add-note-form`, `.export-btn`, `.resume-preview iframe`; `@keyframes ripple` defined 3×. Dead `data-aos` attributes in [index.html](frontend/index.html) (AOS isn't loaded).
- [ ] **Q4 ⚪** Theme inconsistency: focus rings and hover shadows use indigo `rgba(99,102,241,…)` and Chart.js colours are indigo, but the brand is crimson `#bd0745`.
- [ ] **P1 🟡 [V]** ~~`frontend/assets/` is empty~~ — **logo added** (`frontend/assets/Hiray logo.png`, 256×256, supplied by the owner), so the 3 existing references now resolve. Still to do: no favicon (served as HTML 200) → generate one from the logo (`favicon.ico` + `<link rel="icon">` on all 4 pages); optionally rename to `hiray-logo.png` and update the 3 references (the space in the name is fragile in URLs).
- [x] **Q5 ⚪ Brand colours — RESOLVED 2026-11-06: keep the current crimson theme (`#bd0745` / `#8a0532`); no colour change.** Only remaining part: replace the stray indigo focus/chart colours (Q4) with this crimson. _(Original note:)_ the logo's red is ≈ `#F04038` (grey ribbon ≈ `#606060`), while the theme uses a deeper crimson `--primary-color: #bd0745` / `--secondary-color: #8a0532` ([common.css:9](frontend/css/common.css#L9)). Decide whether to align the tokens with the logo / dbhcmr.org palette (one-line change in `:root`, plus the hard-coded `#bd0745` / `rgba(189,7,69,…)` values in `login.css`, `home.css`, charts). Also replace the indigo focus/chart colours (Q4) with the final brand colour.
- [ ] **P2 🟡 [C]** CDNs: Chart.js unpinned (`npm/chart.js` = latest, [admin-dashboard.html:10](frontend/admin-dashboard.html#L10), render-blocking in `<head>`); Font Awesome 6.0.0 and Bootstrap 5.3.0 are old; no SRI hashes; Boxicons from unpkg; Google Fonts via CSS `@import` (chained, render-blocking). No `<script defer>` on any page. → pin versions + SRI, `defer` scripts, `<link rel=preconnect>`.
- [ ] **P3 ⚪** Placeholder content: fake stats (500+ placed / 50 companies / 12 LPA), placeholder email/phone, "© 2024" (hardcoded), every footer/social link `#`. → real or clearly demo content, a dynamic year, remove dead links.
- [ ] **P4 🟡** Accessibility:
  - 28 `<label>`s not linked to their inputs (no `for`); login/register fields have only placeholders as labels.
  - No `autocomplete` attributes anywhere (`email`, `current-password`, `new-password`, `name`) and no `name` attributes on inputs.
  - Icon-only buttons (resume view/approve/reject, event edit/delete, info) have no `aria-label`; modals lack `aria-labelledby`/`tabindex="-1"`; the close buttons lack `aria-label`.
  - Password toggle icons aren't focusable/keyboard-operable.
  - No `:focus-visible` styles; `outline:none` on login inputs.
  - Contrast: white on `#ff6b6b` (status-unplaced, alert-danger) about 2.8:1; `.status-pending` `#ff9800` text on white about 2.1:1.
  - `prefers-reduced-motion` ignored (particles, counters, smooth scroll, card lifts).
  - `.reveal` content stays at `opacity:0` if JS fails; no `<noscript>`; no `<main>` landmark.
- [ ] **P5 ⚪** SEO/meta for a portfolio link: Open Graph / Twitter card tags, `theme-color`, favicon set.

---

## Phase 8 — Documentation & GitHub presentation

- [ ] **D1** Rewrite the README: overview, features, **screenshots/GIF** (desktop + mobile), tech stack, architecture diagram, folder structure, setup (local + Atlas), env var table (`.env.example`), demo credentials, a complete API table (it's missing `PUT /me/notifications/read`, `POST /companies/:id/notes`), security notes (S9), known limitations, roadmap.
- [ ] **D1b** README "Troubleshooting" section: `querySrv ECONNREFUSED` → set `DNS_SERVERS=8.8.8.8,1.1.1.1`; Atlas timeouts → add your current IP under Network Access (or try another network — some campus Wi-Fi blocks port 27017); `bad auth` → wrong DB user/password (URL-encode special characters); data appears in a `test` DB → the URI is missing the `/pms` database name.
- [ ] **D2** Fix stale README facts: "Node 16+" → match `engines`; `node seed.js` behaviour after B20.
- [ ] **D3** Add `LICENSE` (MIT), `.editorconfig`, `CONTRIBUTING.md` (optional).
- [ ] **D4** Live demo (after C5) + link in the README and the GitHub "About" section; add repo topics.
- [ ] **D5** Remove "Fix #N" comments scattered through the code (they refer to an old, unknown list) once this audit supersedes them.

---

## Phase 9 — New features (requested)

> **Do not start these before S1, S2, S3 and B9 are done.** Parsing user-uploaded files widens the attack surface (S2/S3), the matching logic needs one shared branch list (B9), and every new screen would otherwise inherit the XSS problem (S1).

### FEAT-1 — Upload resume → auto-fill profile

**Goal:** after a student uploads a PDF, the app reads it and *suggests* skills, education, projects (and phone) to put on their profile. The student reviews and confirms; nothing is overwritten silently.

**Approach options**

| Option | How | Pros | Cons |
|---|---|---|---|
| **A. Rule-based (recommended default)** | Extract the PDF text (`pdf-parse` / `unpdf`), then regex + a skills dictionary + section-heading detection ("Education", "Projects", "Skills") | Free, offline, no PII leaves your server, deterministic, easy to unit-test | Misses unusual layouts; needs a maintained skills list |
| **B. LLM extraction (optional upgrade)** | Send the extracted *text* to the Claude API with a JSON schema → structured `{skills[], education[], projects[]}` (a small/cheap model such as `claude-haiku-5-5` is enough) | Much better on messy resumes; understands context | Costs per resume, needs an API key, resume PII goes to a third party (needs consent notice) |
| **C. Hybrid** | A first (always), B only when `ANTHROPIC_API_KEY` is set and A found too little | Best demo story: works free, shines with a key | Two code paths to test |

**Recommendation:** build A first behind a `parseResume(text)` function with a stable output shape, so B can be dropped in later without touching routes or UI. Check current model IDs/pricing at implementation time.

**Data model changes**
- `Student.skills` is a free-text string today. Add **`skillsList: [String]`** (canonical lowercase, e.g. `javascript`, `node.js`, `financial analysis`) and keep the text field for display, or migrate fully to an array (preferred; write a one-off migration script).
- `Student.resumeMeta: { parsedAt, parser: 'rules'|'llm', skillsFound: Number }`. Do **not** store the full extracted text (PII, size); keep only the structured result.
- New `backend/data/skills.json`: canonical name → aliases (`js`, `javascript`, `ecmascript`; `node`, `nodejs`, `node.js`; `ms excel`, `excel`), grouped by domain (software for MCA, finance/marketing/HR for MBA). Start with ~250 entries.

**API**
- Extend `POST /api/students/me/resume` to return `{ resume, suggestions: { skills[], education, projects, phone } }` — or a separate `POST /api/students/me/resume/parse` so a parse failure never blocks the upload.
- Apply suggestions through the existing `PUT /api/students/me` (the student chooses which to keep). **Never take name/email from the resume** — identity comes from registration.
- Guardrails: size already capped at 5 MB; run parsing inside try/catch with a timeout (~5 s); only after the magic-byte check from S2; return `suggestions: null` + a friendly message for scanned/image-only PDFs (no extractable text) — OCR (`tesseract.js`) is a later, optional step.

**UI**
- After a successful upload, open a modal: "We found these in your resume" with checkboxes per field (skills as chips) → **Apply selected** / **Skip**.
- Profile page gets a "Re-scan my resume" button. Show the parse source ("detected automatically — review before saving").

**Steps**
1. Add `skills.json` + `backend/utils/resumeParser.js` (`extractText` → `parseResume`) with unit tests on 3–4 fake resumes in `backend/test/fixtures/`.
2. Add `skillsList` to the model (+ migration), normalise skills on every profile save (split on commas/newlines, lowercase, alias→canonical, dedupe).
3. Wire the parse step into the upload route; add the suggestions modal.
4. (Optional) LLM path behind an env flag + a privacy note in the README and the UI.

- [ ] **Done when:** uploading a sample PDF shows a suggestions modal; confirming fills the profile; a non-text PDF and a corrupt PDF both fail gracefully; profile completion (F6) counts the new fields.

### FEAT-2 — Job recommendations from the resume/profile

**Goal:** "Recommended for you" on the student dashboard — admin-posted jobs ranked by how well they fit the student's skills, with the reason shown ("matches: React, SQL · missing: Docker").

**Prerequisite data work**
- `Company.requiredSkills: [String]` (canonical, same dictionary). Add a tag-style input to the admin form. For existing/free-text jobs, auto-extract from `requirements` + `description` with the same dictionary at save time.
- Student `skillsList` from FEAT-1.

**Scoring (build in stages — each stage is shippable)**

1. **Stage 1 — skill overlap (MVP):** hard filters first (branch eligible, `status: 'active'`, not already applied), then `score = matchedSkills / requiredSkills` (0–100%). Return `{ company, matchScore, matchedSkills, missingSkills }`, sorted by score, tie-break on newest. Cheap, explainable, easy to test.
2. **Stage 2 — text relevance:** TF-IDF / BM25 cosine similarity between the student's skills + projects and the job's description + requirements, blended with Stage 1 (e.g. 70/30). Catches jobs that use different wording.
3. **Stage 3 — semantic (optional):** embeddings-based similarity from an embeddings provider, or an LLM-written one-line explanation for the top 3. Only worth it once Stages 1–2 are solid; adds cost and a dependency.

**API**
- `GET /api/companies/recommended?limit=6` (student only).
- ⚠ **Routing trap:** declare it **above** `GET /api/companies/:id` in [company.routes.js](backend/routes/company.routes.js) — otherwise Express treats `recommended` as an id and returns a CastError (B13).
- Put the scoring in a pure function (`backend/utils/matcher.js`), no DB calls inside, so it can be unit-tested.

**UI**
- Dashboard: "Recommended for you" cards with a match-% badge and matched/missing skill chips + **Apply**.
- Companies page: a "Best match" sort option and a small match badge on each card.
- Empty state: "Upload your resume or add skills to get recommendations" (links to Resume/Profile).
- Make it clear the score is advisory — students can still apply to any eligible job.

**Optional extension (admin):** on each company, "Top matching students" using the same function in reverse. Strong portfolio talking point, small once the matcher exists.

**Steps**
1. `matcher.js` + tests (exact match, alias match, no skills, no required skills, already applied, wrong branch).
2. `requiredSkills` on Company + admin form + extraction fallback + migration for existing rows.
3. `/recommended` endpoint (above `/:id`).
4. Dashboard section + Companies sort/badge.
5. Stage 2 scoring once 1–4 are stable.

- [ ] **Done when:** a student with skills `javascript, node.js, mongodb` sees the MCA web-dev job ranked above the MBA finance job, with correct matched/missing skills, and already-applied or ineligible jobs never appear.

---

## Phase 10 — Resume storage decision (resolves C5, S3; needed by FEAT-1) — **Tier 3 / optional**

> **Update 2026-11-06:** local disk storage is acceptable for a GitHub-only deliverable (no college hosting, no mandatory live demo). Cloud storage is only needed **if** you deploy a live demo (Render/Railway). S3 (auth-gated download route) and S2 (upload checks) are still Tier 1 and work with local storage.

**Short answer: you do not need to buy AWS.** Local-disk storage is fine while the app runs on your own machine. It only breaks when you *deploy* to a host with an ephemeral filesystem (Render/Railway/Vercel/Heroku free tiers reset the disk on every deploy or restart). Pricing and free-tier limits change often — **verify each provider's current terms before committing**.

| Option | New account? | Cost model | Fits this project because… | Watch out for |
|---|---|---|---|---|
| **Local disk (current)** | No | Free | Fine for local dev and screen-recorded demos | Lost on deploy; not scalable |
| **MongoDB GridFS** | No (reuse Atlas) | Counts against DB storage (Atlas free tier is small, ~512 MB) | Zero new services; files stored next to the data; auth handled by your API | ~2,500 resumes of 200 KB fit the free tier; DB backups include files |
| **Supabase Storage** | Yes | Free tier available | Private buckets + signed URLs, simple SDK | Free projects can pause when idle |
| **Cloudflare R2** | Yes | Free monthly allowance, no egress fees | S3-compatible API | May require a payment method on file |
| **Cloudinary** | Yes | Free tier available | Easy upload SDK | Built for images/video; PDFs need `raw` handling and delivery settings |
| **AWS S3** | Yes (card required) | Pay-as-you-go (pennies at this scale); free-tier terms for new accounts have changed — check | Industry standard; strong CV keyword | More setup (IAM, bucket policy); easy to misconfigure public access |
| **Host persistent disk** (Render/Railway/Fly volume) | No | Usually paid | No code change | Tied to one instance; paid |

**Recommendation**
1. **Now (local dev, GitHub, demo videos):** keep local disk — but only after S2/S3 (random `.pdf` filenames, no public `/uploads`, authenticated download route).
2. **First deploy:** **GridFS** — the least work and no new account, because you already need Atlas for the database.
3. **If you want a CV-worthy cloud story:** implement an **S3-compatible driver** (`@aws-sdk/client-s3`). The same code works for AWS S3, Cloudflare R2 and Supabase's S3 API, so you can start on a free one and switch later by changing env vars.

**How to implement without lock-in**
- Create `backend/utils/storage.js` exposing `save(stream, meta) → key`, `open(key) → stream`, `remove(key)`, with a driver chosen by `STORAGE_DRIVER=local|gridfs|s3`.
- Store only the opaque **key** in `Student.resume.path` (not `/uploads/...`), plus the original filename for display.
- Downloads always go through `GET /api/students/:id/resume` (owner or admin) — streaming from the driver, or a short-lived signed URL for S3-type drivers. Never make the bucket public.
- Delete the old object when a student re-uploads (B14). Write a one-off script that moves existing local files into the new driver.
- Add the new env vars to `.env.example` and the README (D1).

- [ ] **Done when:** the same upload/download flow works with `STORAGE_DRIVER=local` and with one cloud/GridFS driver, and restarting the server loses no resumes.

---

## Phase 11 — Stack & dependency versions (checked 2026-11-06 against the npm registry / nodejs.org)

**Runtime:** you run **Node v25.5.0** — an odd-numbered "Current" release (short-lived, not LTS). Current LTS lines are **v24.x "Krypton"** and **v26.x "Lithium"** (v26.13.0 / v24.22.2 at check time). → Install an LTS, add `"engines": { "node": ">=20.19" }` to `package.json` and a `.nvmrc`; fix the README ("Node 16+" is also wrong).

**Backend (`npm outdated`)**

| Package | Installed | Latest | Gap | Plan |
|---|---|---|---|---|
| mongoose | 7.8.9 | 9.12.0 | 2 majors | **Now:** `npm update` → 7.8.13 (removes the audit's prototype-pollution finding, S7). **Later (own step):** 9.x needs Node ≥ 20.19; our usage is basic, but the `pre('save', …next)` hook in `user.model.js` uses callback style that newer majors have been moving away from — read the migration guide first |
| express | 4.22.1 | 5.3.0 | 1 major | **Now:** → 4.22.3. **Later:** Express 5 breaks `app.get('*')` (our catch-all, C1 — rewrite it anyway), and forwards async errors automatically (helps S6) |
| multer | 1.4.5-lts.2 | 2.5.0 | 1 major | Upgrade to 2.x with S2 (1.x is the deprecated line); basic `diskStorage` + `single()` usage should carry over |
| bcryptjs | 2.4.3 | 3.0.3 | 1 major | Optional; confirm `require('bcryptjs')` still works in v3 before bumping |
| dotenv | 16.6.1 | 18.0.9 | 2 majors | Optional / low value; newer versions print a startup tip (can be silenced) |
| jsonwebtoken 9.0.3 · cors 2.8.6 · express-validator 7.3.2 · nodemon 3.1.14 | — | same | **up to date** | — |

**Frontend (loaded from CDNs — no lockfile, so versions are whatever the `<script>` URL says)**

| Library | Used | Latest | Plan |
|---|---|---|---|
| Bootstrap (CSS + JS) | 5.3.0 | 5.3.8 | Safe patch bump → 5.3.8, add SRI hashes |
| Font Awesome Free | 6.0.0 | 7.3.1 | Bump to the latest **6.x** first (same icon names); consider 7 later after checking icon renames |
| Chart.js | *unpinned* ("latest") | 4.6.1 | Pin `chart.js@4.6.1` (a future v5 would silently break the charts) |
| Boxicons | 2.1.4 | 2.1.4 | Up to date (but unmaintained; only used on the login page) |
| Poppins (Google Fonts) | via CSS `@import` | — | Switch to `<link rel=preconnect>` + `<link>` (P2) |

**Steps (safest order):** (1) switch to Node LTS → (2) `npm update` + `npm audit fix` inside current majors → run the re-test checklist → (3) CDN patch bumps + pins + SRI → (4) majors one at a time, each its own commit: multer 2 (with S2), then express 5, then mongoose 9, then optional ones.

**Status 2026-11-06:**
- ✅ Step 2 done — in-range updates + `npm audit fix` (express 4.22.3, mongoose 7.8.13); `"engines": { "node": ">=20.19" }` added to `package.json`. Backup of the old `package.json`/lockfile is in the scratchpad `backup-deps/`.
- ✅ Step 3 done — all 4 HTML pages now use pinned CDN files with SRI: Bootstrap **5.3.8**, Font Awesome **6.7.2**, Chart.js **4.6.1**. Verified in headless Chrome: no blocked assets, no console errors, Chart.js reports 4.6.1, FA font loads, logo loads (256 px).
- ⏳ Step 1 (Node LTS) — **owner action:** install Node 24 or 26 LTS from nodejs.org (you run v25.5.0, a short-lived "Current" release). The app works on 25 meanwhile.
- ⏳ Step 4 (majors: multer 2 → express 5 → mongoose 9) — deferred, one commit each.
- ℹ️ The `punycode` deprecation warning printed at startup comes from a transitive dependency on Node 25; harmless, expected to disappear after the Mongoose major upgrade / Node LTS.

- [ ] **Done when:** `npm outdated` shows only deliberately deferred majors, `npm audit --omit=dev` is clean, and every CDN URL is pinned with an SRI hash.

---

## Decisions log

| Date | Decision | Notes |
|---|---|---|
| 2026-11-06 | **Keep current stack; no Next.js/TypeScript rewrite** | Semester project; goal = clean repo + docs. Work in tiers (see "Scope decision") |
| 2026-11-06 | **Not hosted by the college; GitHub is the deliverable** | Live demo optional (Render/Railway); GitHub Pages can't run the backend |
| 2026-11-06 | Atlas connection fixed via `DNS_SERVERS` env workaround | Cause: Node's resolver refused SRV lookups on this network; Windows DNS was fine |
| 2026-11-06 | Audit item **B2 withdrawn** | Disproved by testing: Mongoose lowercases query values; mixed-case login works |
| 2026-11-06 | **Keep the current crimson theme** | Q5 resolved; logo red `#F04038` not adopted |
| 2026-11-06 | Upgrade plan: patch/minor first, majors one at a time | Phase 11 |
| 2026-11-06 | Move database to **MongoDB Atlas** (free M0) | See 0.2; resumes later via GridFS (Phase 10) |
| 2026-11-06 | Logo supplied → `frontend/assets/Hiray logo.png` | P1 partly done (favicon still to do) |
| 2026-11-06 | **FEAT-1 uses no paid model API** | Rule-based parsing is the default and is free; an LLM is an optional later add-on |

---

## Resolution playbook — how we'll fix each group (summary)

| Group | Core approach | Decision needed from you |
|---|---|---|
| **Security (S1–S9)** | One shared `escapeHtml` + event delegation instead of inline `onclick`; magic-byte + random-name uploads; auth-gated download route; `helmet` + rate limit; central error handler; `npm audit fix`; `.env.example` + startup checks | None — just do it |
| **Layout (R1–R3, R11, R13)** | Replace the Bootstrap-grid-plus-fixed-sidebar mix with one flex/`calc()` layout; build the hamburger once in the HTML; move login buttons inside the mobile drawer; make footers static on dashboards/login | Keep Bootstrap, or move to plain CSS for the dashboards? (Recommendation: keep it, remove the `col-*`/`.row` wrappers) |
| **Frontend bugs (F1–F14)** | Shared `api.js` / `utils.js`; try/catch + toast + retry on every load; sections hidden in HTML; rename the `loading` class; fix `slice`; reference events by id | None |
| **Backend logic (B1–B23)** | `express-validator` on every route; one `asyncHandler` + error middleware (ValidationError→400, CastError→400, 11000→409); derive student status from all their applications; `status` enum for resumes; `eventId` references; shared `BRANCHES` constant | **Branch list:** hardcoded MCA/MBA, or admin-editable? (Recommendation: shared constant now, admin-editable later) |
| **Server/infra (C1–C6)** | JSON 404 for `/api/*`; exit on DB failure; health route; ESLint + Prettier + Jest/Supertest with `mongodb-memory-server`; GitHub Actions | None |
| **Responsive polish (R4–R21)** | Move shared button/card styles into `dashboard.css`; `@media (hover:hover)` for hover lifts; flex-wrap filters; card layout for the Resumes table on mobile | None |
| **Quality & a11y (Q/P)** | Merge duplicated CSS/JS; pin CDNs + SRI + `defer`; add real labels/`autocomplete`/`aria-label`; ship the logo + favicon | **Logo/branding:** do you have the college logo file to drop into `frontend/assets/`? |
| **Docs (D1–D5)** | README rewrite with screenshots/GIF, env table, API table, security notes; LICENSE | Screenshots/GIF will be taken after Phase 2 |
| **Features (FEAT-1/2)** | Rule-based parsing + skill dictionary first; LLM optional; skill-overlap matcher first, text/semantic later | **LLM parsing:** yes/no? (Recommendation: no for now, design for it) |
| **Storage (Phase 10)** | Storage abstraction; GridFS for the first deploy, S3-compatible driver if you want the cloud story | **Which first deploy target?** (Recommendation: Render/Railway + Atlas + GridFS) |

---

## Suggested order (one PR / commit per line)

1. Phase 0 (git + gitignore + Mongo)
2. Node LTS + Phase 11 steps 1–3 (patch/minor updates, CDN pins) → S8 → S7 → S1 (+Q1 shared utils) → S2 + S3 → S4 → S6 → S5
3. R1 + R2 + R3 (+Q2 shared CSS) → R11 → R13
4. F1 → F2 → F3 → F4 → F5
5. B1 → B2 → B4 → B5 → B9 → B6 + B7 + B8 → C1 → C2 → remaining B items
6. Remaining R items → F6–F14
7. Q3/Q4, P1–P5 → C3–C6
8. **Phase 10 storage abstraction** (then the local→driver migration script)
9. **FEAT-1** resume auto-fill → **FEAT-2** recommendations (Stage 1, then Stage 2)
10. D1–D5 (README last, so screenshots show the finished app)

## Re-test checklist after each phase
- Desktop 1440 & 1024, tablet 820, phones 390×844 / 390×667 / 320×568 — no horizontal scroll, nothing covered by the footer or hamburger.
- Flows: register (mixed-case email, `.info` email, short password) → login → fill profile → upload PDF (and a fake PDF) → apply → admin accept/reject → student sees status + notification → admin event CRUD → student calendar add/remove (title with apostrophe).
- API down → friendly error; expired token → clean redirect.
- `npm audit` clean; no Mongo error text in any response.
