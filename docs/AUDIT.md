# Code review and fix log

This project started as a working semester project. Before publishing it, the whole code base (backend, frontend, layout on desktop, tablet and phone) was reviewed, every problem was written down, and the problems were fixed one by one. This page records what was found and what was done, including the things that were left alone on purpose.

**Method.** The code was read in full. Behaviour was checked by running it: the pages in a real headless Chrome at 1440, 1024, 820, 390 and 320 px wide, and the API against a real MongoDB Atlas database (a separate throwaway database, never the working one). Each fix was re-tested the same way, and the final versions of the student pages, admin pages and public pages were run through scripted browser checks (about 100 checks in total, with no console errors).

**Result in numbers.** Production dependencies: 5 known vulnerabilities before, 0 after. Unit tests: none before, 52 now. ESLint and CI: none before, both in place.

Item IDs (S1, B7, ...) are the ones used in the commit history.

## Summary

| Area | Items | Fixed | Left on purpose |
|---|---|---|---|
| Security (S) | 9 | 9 | |
| Layout and responsiveness (R) | 21 | 21 | |
| Frontend bugs (F) | 14 | 14 | |
| Backend logic and data (B) | 23 | 20 | B19 pagination, B22 transactions (B2 was a false alarm) |
| Server and tooling (C) | 6 | 5 | Part of C3 (see below) |
| Code quality and polish (Q, P) | 10 | 10 | |
| New features | 2 | 2 | |

## Security

| ID | Problem found | Resolution |
|---|---|---|
| S1 | **Stored XSS everywhere.** Names, company text, event text, notifications and file names went into `innerHTML` unescaped; a student registering with a script in their name could steal the admin's token. | One `esc()` helper, used for every interpolated value. Buttons use `data-action` attributes and one delegated listener, so no inline handlers remain and the CSP now forbids them. Tested with a payload in every text field. |
| S2 | **Upload accepted any file type** and kept the client's extension, so an `.html` file could be served as HTML from the app's own origin. | PDF only: MIME type and the real `%PDF-` header are checked, size is capped at 5 MB, the client's file name is cleaned and never used as a path. Multer upgraded to 2.x. |
| S3 | **Resumes were publicly downloadable** through a static `/uploads` mount. | No static mount. Resumes are served only through authenticated routes (a student's own file, any file for an admin) with `nosniff` and `no-store`. They now live in MongoDB GridFS. |
| S4 | Admin-private company notes were sent to students. | Students never receive `notes`, and can only open companies that are active and open to their course. |
| S5 | No hardening: unlimited login attempts, `X-Powered-By`, CORS open to everyone, no security headers. | `helmet` with a CSP (checked in a real browser, no violations), rate limits (login: 10 failures per 15 min), CORS closed unless `CLIENT_ORIGIN` is set, body size limit, `TRUST_PROXY` for hosted deployments. |
| S6 | Raw database error messages reached clients. | A central error handler returns short messages and logs details on the server only. |
| S7 | Five vulnerable dependencies (one critical). | Updated; `npm audit --omit=dev` reports 0. Runs in CI. |
| S8 | Secrets and config: no `.env.example`, no check for a missing `JWT_SECRET`, demo admin password in production. | Startup validation, `.env.example`, weak secrets refused in production, the seed requires `ADMIN_SEED_PASSWORD` in production. |
| S9 | Token in `localStorage`; other tabs kept acting as the previous user after a new login. | The trade-off is documented in the README. A `storage` listener reloads other tabs when the login changes. |

## Layout and responsiveness

The two dashboards overflowed horizontally at desktop widths because Bootstrap grid columns were mixed with a fixed sidebar, and the login and navigation controls could not be reached on phones. Both dashboards were rebuilt on one flex layout, with a real top bar and slide-in menu below 993 px.

| IDs | Problem found | Resolution |
|---|---|---|
| R1, R2 | Student dashboard 280 px too wide at 1440; admin dashboard overflowed and used only 75% of a tablet screen. | One flex layout (`.app-layout`, `.main-content { flex: 1; min-width: 0 }`). Measured: no horizontal scroll at 1440, 1024, 820, 390, 320. |
| R3, R8, R9 | A stray hamburger button below the footer on desktop; on phones one or two hamburgers covered the page title. | A single hamburger in a top bar that only exists on small screens. |
| R11 | Home page: Login and Admin login were off-screen on phones and tablets (the navbar's `backdrop-filter` became the containing block of the fixed menu). | The blur moved to a pseudo-element; both buttons are inside the viewport. |
| R12, R14, R17 | Closed menu links still focusable; login panel gutters misaligned; menu stayed open after tapping a link. | Closed menus are `visibility: hidden` and the login form that is not shown is `inert`; the hamburger carries `aria-expanded`; aligned gutters with `dvh` units; menus close on link click, outside click and Esc. |
| R13, R15, R16 | Fixed footers hid the Login button and the last lines of content on short phones and painted over the open menu (including Logout). | Static footers, login footer hidden on small screens, correct stacking order. |
| R4, R5, R6, R18-R21 | Unstyled buttons on the student page, cards jumping on hover, squashed filters, double headings, unstyled select, hover effects stuck on touch screens, tiny touch targets. | Shared dashboard styles, hover effects only on devices that hover, wrapping filters, larger touch targets. |

While retaking the final screenshots two more layout bugs showed up and were fixed: the admin Students card's *Profile* button wrapped to "Profi/le", and on phones the admin KPI labels broke mid-word.

## Frontend bugs

| IDs | Problem found | Resolution |
|---|---|---|
| F1 | Recent applications showed the three oldest. | Newest three, newest first. |
| F2 | Calendar buttons broke on apostrophes and newlines in event titles. | Buttons use ids from `data-` attributes, never text inside inline code. |
| F3 | The login button disappeared while loading (a class name clashed with Bootstrap's `.loading`). | Renamed `is-loading`. |
| F4, F5 | No loading or error states; an expired token threw `TypeError`s. | `withLoading`, `guarded` and `showLoadError` helpers with a retry banner; an expired session redirects cleanly. |
| F6 | Profile completion counted fields that were never asked for. | Five real checks: skills, education, projects, resume, approved resume. |
| F7 | The company dialog stayed open with stale content after applying. | Closes and refreshes. |
| F8 | Ctrl+F was hijacked on the student pages. | Handler removed. |
| F9 | Admin company form: edit, cancel and validation problems, branches not restored. | Rewritten; branches round-trip; required-skills field added. |
| F10 | CSV export: formula injection (cells starting with `=`, `+`, `-`, `@`), no BOM, misleading button label. | Cells neutralised, UTF-8 BOM added, button reads *Export CSV*. |
| F11, F12 | Dashboard data gaps, missing icons, duplicate and pointless requests. | Each page loads what it shows once; every activity type has an icon. |
| F13, F14 | Backend features without UI (company notes, student profile view, calendar removal) and small UX gaps (no confirmations). | UI added for each; confirmations before removing a company, rejecting a resume and deleting an event. |

## Backend logic and data

| ID | Problem found | Resolution |
|---|---|---|
| B1 | E-mail regex rejected valid addresses (`.info`, `+tag`) and produced a 500. | Permissive check; the validator and schema agree. |
| B2 | Reported as "login is case-sensitive". | **Not a bug.** Disproved by testing (Mongoose lower-cases query filters too). Withdrawn. |
| B3 | A failed profile creation left an account that could log in but had no profile. | The user is deleted again if the profile cannot be created. |
| B4 | Validation errors had no readable `message`. | Added; e-mails are trimmed and lower-cased. |
| B5, B13 | Upload errors and malformed ids returned 500. | Clean 400 responses. |
| B6, B7 | Applying downgraded Interview Scheduled and Placed students; decisions did not consider all applications. | Pure rules in `utils/placementStatus.js` with unit tests: recomputed from all applications, never downgrading. |
| B8 | Students could apply without an approved resume or to ineligible companies. | The server checks: active company, eligible course, approved resume, skills, no duplicate. |
| B9, B12 | Branch never validated; empty branches stored; validation errors gave 500. | Shared constants used by registration and the schema; 400 with a clear message. The forms read the lists from `/public/meta`. |
| B10, B11 | `GET /companies/:id` skipped eligibility; mass assignment on update. | Same visibility rules as the list; update accepts a field whitelist. |
| B14 | Resume review was a yes/no flag. | Three states (`pending`, `approved`, `rejected`) with matching messages and notifications. |
| B15 | Events accepted any date text; students' calendar copies went stale. | Date format validated; calendar entries reference the event by id and follow edits and deletions. |
| B16 | Deleting a company deleted its applications. | Removing archives the company (`inactive`); history stays. |
| B17 | Notifications and activities grew without limit. | 100 newest notifications per student; activities expire after 90 days. |
| B18 | Admin lists failed on an account without a user record. | Such records are skipped. |
| B20 | The seed left applications, events and activities behind and hung without a terminal. | Clears every collection and the resume bucket; `--force` for scripts; asks first when users exist. |
| B21, B23 | No length limits on profile text; unused import and an ignored `role` field. | Length validators; removed. |
| B19 | No pagination or server-side search. | **Left on purpose.** Not needed at the size of one college cohort; listed in the README limitations. |
| B22 | Several writes without a transaction. | **Left on purpose.** Documented. Each status decision is recomputed from all applications, so a repeated action repairs it. |

## Server and tooling

| ID | Resolution |
|---|---|
| C1 | Unknown `/api/*` paths return a JSON 404 and missing pages a real 404 page (the old catch-all served the home page for everything). |
| C2 | The server connects to the database first and exits with a clear message if that fails; `GET /api/health`; graceful shutdown. |
| C3 | `engines` set; the Express disclosure header removed. **Not added:** `compression`, request logging, `express-mongo-sanitize` and `autoIndex: false`. The hosting platform normally compresses and logs, and the API only accepts typed fields, so they add little for this size. |
| C4 | 52 unit tests with Node's built-in runner and ESLint 9 (flat config). **Not added:** HTTP-level tests in the repository; those checks were run against a throwaway database during development. |
| C5 | Resolved by storing resumes in GridFS: nothing is written to the host's disk. |
| C6 | GitHub Actions: lint and tests on Node 22 and 24, plus `npm audit` for production dependencies. |

## Code quality and polish

| IDs | Resolution |
|---|---|
| Q1, Q2 | `apiFetch`, `logout`, toasts and navigation existed three times with differences. Now one `dashboard.js` and `utils.js`, one shared `dashboard.css`. |
| Q3, Q4, Q5 | Dead CSS removed; stray indigo colours replaced; the college's crimson theme (`#bd0745`) kept everywhere, including charts. |
| P1 | College logo and favicon set added. |
| P2 | CDN libraries pinned to exact versions with integrity hashes (Bootstrap 5.3.8, Font Awesome 6.7.2, Chart.js 4.6.1); fonts via `<link>` instead of `@import`. |
| P3 | Placeholder content removed: the home page shows real counts from the database, the copyright year is computed, and the contact area links to the college website only. |
| P4 | Accessibility: labelled form fields, `aria-current` on navigation, `aria-expanded` on the menu button, `role="alert"` and `role="status"` on messages, a visible `:focus-visible` outline, decorative icons hidden from screen readers. |
| P5 | Page titles, `theme-color` and Open Graph tags on the home page. |

## New features

| Feature | Notes |
|---|---|
| **Resume upload to profile auto-fill** | Reads the PDF locally (no paid model API) and proposes skills, education and projects; the student confirms before anything is saved. Details in [`ARCHITECTURE.md`](ARCHITECTURE.md). |
| **Job recommendations** | Skill-based ranking for students; best-matching students per company for admins. |
| **Resume storage in MongoDB GridFS** | Resumes survive restarts and redeploys with no extra service or account. |

## Dependencies

The versions in `package.json` are current within the major versions in use, with the exceptions below. Frontend libraries are pinned CDN versions.

| Package | Status |
|---|---|
| Express 4, Mongoose 7 | Maintained lines. Express 5 and Mongoose 9 are separate migrations that bring no feature this project needs. |
| `bcryptjs` 2, `dotenv` 16 | Work as is; newer majors are optional. |
| `unpdf` 1.9.1 | Pinned. Version 2 needs Node 24 or newer, while this project supports Node 20.19 and up. |
| `nodemon` | Dev only. |

## Behaviour changes from the original

- Students can no longer apply until an admin has **approved** their resume.
- **Removing a company archives it** instead of deleting it and its applications.
- Branch and job-type lists come from one server-side constant.
- Registration can only create students.

## Not done, by design

- Rewriting in Next.js or TypeScript: not needed for a semester project and would have replaced working code.
- Pagination, transactions, compression and request logging: see the notes above.
- Moving the token to an `httpOnly` cookie: documented as a known trade-off.
