<div align="center">

<img src="frontend/assets/Hiray%20logo.png" alt="Dr. B.V. Hiray College logo" width="110">

# Placement Management System

**A full-stack campus placement portal: students upload a resume, get jobs ranked by skill match and apply; the placement cell reviews resumes, manages companies and tracks every application.**

[![CI](https://github.com/UmairBasharti/placement-management-system/actions/workflows/ci.yml/badge.svg)](https://github.com/UmairBasharti/placement-management-system/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/Node.js-20.19%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas%20%7C%20GridFS-47A248?logo=mongodb&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-vanilla-F7DF1E?logo=javascript&logoColor=black)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-7952B3?logo=bootstrap&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

</div>

<p align="center">
  <img src="docs/screenshots/student-dashboard.png" alt="Student dashboard with job recommendations" width="49%">
  <img src="docs/screenshots/admin-dashboard.png" alt="Admin dashboard" width="49%">
</p>

## Overview

A college placement cell collects resumes, matches students to companies and keeps track of who applied where. That work often lives in spreadsheets, e-mail and chat groups: resumes get lost in threads, nobody has one place to see a student's status, and a student cannot tell whether an application was seen. This project puts it all in one portal. It started as a semester project for **Dr. B.V. Hiray College of Management & Research Center, Malegaon (Nashik)**, and I later reviewed and rebuilt large parts of it for security, correctness and responsiveness.

**Student.** Registers with a course (MCA or MBA), keeps a profile, uploads a PDF resume and can fill the profile from it. Sees open jobs ranked by how many of the required skills they already have, applies once the resume is approved, and follows every application, a placement-status timeline, notifications and events.

**Placement cell (admin).** Reviews and approves resumes, manages companies (required skills, private notes, archive), sees the best-matching students for each job, accepts or rejects applications, sets placement statuses, publishes events and exports the student list as CSV.

**Stack.** Node.js and Express 4, MongoDB (Mongoose 7, GridFS for resume files), JWT authentication, plain JavaScript with Bootstrap 5 and Chart.js on the front end. No build step. One process serves the pages and the API.

## What I implemented

| Area | Implementation | Evidence |
|---|---|---|
| **Authentication and roles** | JWT (HS256 only), bcrypt hashing, student and admin roles checked on every protected route, public registration can only create students | [`auth.routes.js`](backend/routes/auth.routes.js), [`auth.middleware.js`](backend/middleware/auth.middleware.js) |
| **Resume pipeline** | PDF upload checked by MIME type, size and real `%PDF-` header, stored in MongoDB GridFS, three review states (`pending`, `approved`, `rejected`), served only through authenticated routes | [`fileUpload.js`](backend/utils/fileUpload.js), [`student.routes.js`](backend/routes/student.routes.js), [`admin.routes.js`](backend/routes/admin.routes.js) |
| **Resume to profile** | Reads PDF text locally with `unpdf`, finds skills with a dictionary of about 190 skills, cuts out Education and Projects by heading. The student reviews before anything is saved. No AI service, no API cost | [`resumeParser.js`](backend/utils/resumeParser.js), [`skills.js`](backend/utils/skills.js), [`data/skills.js`](backend/data/skills.js) |
| **Job matching** | Match score is the share of a job's required skills the student already has; ranked recommendations for students, best-matching students per job for admins | [`matcher.js`](backend/utils/matcher.js), [`company.routes.js`](backend/routes/company.routes.js) |
| **Placement-status rules** | Pure functions keep a student's status consistent with their applications (never downgrades *Placed*, recomputed from all applications) | [`placementStatus.js`](backend/utils/placementStatus.js), [`placementStatus.test.js`](backend/tests/placementStatus.test.js) |
| **Admin tools** | Dashboard with charts, company CRUD with archive and notes, application decisions, student directory, CSV export (formula-injection safe), events with cascading updates to students' calendars | [`admin-dashboard.js`](frontend/js/admin-dashboard.js), [`event.routes.js`](backend/routes/event.routes.js) |
| **Security hardening** | CSP without inline scripts, output escaping, rate limits, input type checks, central error handler, startup config validation, see [Security](#security) | [`server.js`](backend/server.js), [`utils.js`](frontend/js/utils.js) |
| **Responsive UI** | One flex layout for both dashboards, slide-in menu below 993 px; checked with no horizontal overflow at 1440, 1024, 820, 390 and 320 px | [`dashboard.css`](frontend/css/dashboard.css), [`dashboard.js`](frontend/js/dashboard.js) |
| **Quality gates** | 55 unit tests with `node --test`, ESLint 9, GitHub Actions on Node 22 and 24, production `npm audit` | [`tests/`](backend/tests), [`ci.yml`](.github/workflows/ci.yml) |

## Screenshots

| Student | Admin |
|---|---|
| ![Student companies](docs/screenshots/student-companies.png) | ![Admin companies](docs/screenshots/admin-companies.png) |
| ![Resume scan](docs/screenshots/scan-dialog.png) | ![Company details with matching students](docs/screenshots/admin-company-details.png) |
| ![Student calendar](docs/screenshots/student-calendar.png) | ![Resume review](docs/screenshots/admin-resumes.png) |
| ![Student profile](docs/screenshots/student-profile.png) | ![Admin students](docs/screenshots/admin-students.png) |

| Home | Login |
|---|---|
| ![Home](docs/screenshots/home-desktop.png) | ![Login](docs/screenshots/login-desktop.png) |

**Phone and tablet**

<p>
  <img src="docs/screenshots/mobile-home.png" alt="Phone: home" width="19%">
  <img src="docs/screenshots/mobile-login.png" alt="Phone: login" width="19%">
  <img src="docs/screenshots/mobile-student.png" alt="Phone: student dashboard" width="19%">
  <img src="docs/screenshots/mobile-student-menu.png" alt="Phone: menu" width="19%">
  <img src="docs/screenshots/mobile-admin.png" alt="Phone: admin dashboard" width="19%">
</p>
<p>
  <img src="docs/screenshots/tablet-admin.png" alt="Tablet: admin dashboard" width="40%">
</p>

> The screenshots use fictional data (eight students, six companies), a larger set than `npm run seed` creates.

## Architecture

```mermaid
flowchart LR
    subgraph Client["Browser"]
        P["Pages<br/>home · login · student · admin"]
        J["Vanilla JS<br/>fetch() with Bearer token"]
    end
    subgraph Server["Node.js · Express"]
        S["Security layer<br/>helmet (CSP) · CORS (closed) · rate limits"]
        A["Auth middleware<br/>verify JWT · role check"]
        R["Routes<br/>public · auth · students · companies<br/>applications · events · admin"]
        V["Validation<br/>express-validator + Mongoose schemas"]
        U["Utilities<br/>matcher · skills · resume parser<br/>placement-status rules · GridFS helpers"]
        E["Central error handler"]
    end
    subgraph Data["MongoDB Atlas"]
        M[("Collections<br/>users · students · companies<br/>applications · events · activities")]
        F[("GridFS bucket<br/>resumes")]
    end
    P -- "static files" --> S
    J -- "/api/* JSON" --> S
    S --> A --> R --> V --> M
    R --> U
    U --> F
    R -. "errors" .-> E
```

> Express serves both the pages and the API from one origin. That removes CORS set-up, gives a one-command start and allows a strict Content-Security-Policy (`connect-src 'self'`). Resumes live in the same database, so a host with no persistent disk still loses nothing. More diagrams (login flow, resume workflow, matching) are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); the data model is in [`docs/DATABASE.md`](docs/DATABASE.md).

### How an application moves through the system

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

A student can apply only when the company is active and open to their course, a resume is uploaded **and approved**, the profile lists skills, and they have not applied to that company before. The server checks every one of these.

## Technology and why

| Technology | Why I used it |
|---|---|
| **Express 4** | Small, well understood, and keeps every layer (auth, validation, routing) visible instead of hidden in a framework |
| **MongoDB and Mongoose 7** | Documents fit the data: notifications, calendar and status history are embedded in the student, applications are queried across students and companies. Schemas add validation |
| **GridFS** | Resume files stay in the database I already had: no extra account, no cost, one backup, nothing lost on hosts that wipe the disk |
| **JWT and bcryptjs** | Stateless login with hashed passwords; roles are checked per route |
| **helmet, express-rate-limit, express-validator** | Security headers and CSP, brute-force protection, input validation at the edge |
| **multer (memory storage)** | The upload is checked in memory before anything is stored |
| **unpdf** | PDF text extraction with no native dependencies |
| **Vanilla JS and Bootstrap 5** | No build step, easy to read and run; one `state` object per page, delegated click handlers, shared helpers |
| **Chart.js** | The dashboard charts |
| **`node --test` and ESLint 9** | Tests and linting with no extra frameworks |
| **GitHub Actions** | Lint, tests and dependency audit on every push |

## Security

The original code was reviewed line by line and attacked on purpose (for example by injecting scripts into every text field). What was found, and the control that replaced it:

| Risk | What I found | Control now | Where |
|---|---|---|---|
| **Stored XSS** | Names and company text went into `innerHTML` unescaped; a student's name could run a script on the admin's page | Every value is escaped; buttons use `data-action` and one delegated listener; the CSP forbids inline scripts | [`utils.js`](frontend/js/utils.js), [`server.js`](backend/server.js) |
| **Malicious upload** | Any file type accepted, client extension kept, files served from a public folder | MIME type, size and real `%PDF-` header checked, name cleaned, files stored in GridFS and served only to the owner or an admin | [`fileUpload.js`](backend/utils/fileUpload.js) |
| **NoSQL injection** | An id in a request body could be an object like `{"$ne": null}` and reach a query | Body ids must be 24-character hex strings; password and e-mail must be strings | [`objectId.js`](backend/utils/objectId.js), [`auth.routes.js`](backend/routes/auth.routes.js) |
| **Weak credentials** | 6-character minimum, token algorithm not pinned, unknown e-mails answered faster than wrong passwords | 8 to 72 characters; HS256 only; an unknown e-mail still pays for one bcrypt comparison | [`auth.routes.js`](backend/routes/auth.routes.js), [`auth.middleware.js`](backend/middleware/auth.middleware.js) |
| **Brute force** | Unlimited login attempts | 10 failed logins per 15 minutes per address, 20 registrations per hour, 600 API calls per 15 minutes | [`server.js`](backend/server.js) |
| **Information leaks** | Database error messages reached the browser; admin-only notes were sent to students | Central error handler returns short messages and logs details server-side; students never receive notes and see only companies open to their course | [`error.middleware.js`](backend/middleware/error.middleware.js), [`company.routes.js`](backend/routes/company.routes.js) |
| **Missing hardening** | No security headers, CORS open to everyone | helmet with CSP, `Permissions-Policy`, `no-store` on API responses, CORS closed unless `CLIENT_ORIGIN` is set, 100 kB body limit | [`server.js`](backend/server.js) |
| **Secrets and config** | No env template, no check for missing secrets, public demo admin password | Startup validation (weak secrets refused in production), `.env.example`, seed requires `ADMIN_SEED_PASSWORD` in production | [`validateEnv.js`](backend/config/validateEnv.js) |
| **Vulnerable dependencies** | Five known vulnerabilities, one critical | Updated to zero; `npm audit` for production dependencies runs in CI | [`ci.yml`](.github/workflows/ci.yml) |

**Known trade-off:** the login token is kept in `localStorage`, which any script on the page could read. That is why the XSS controls above matter. A stricter set-up would use an `httpOnly` cookie with CSRF protection.

## Delivery pipeline

```
push / pull request
      │
      ├── npm ci (root + backend)
      ├── ESLint
      ├── unit tests (node --test) ........ Node 22 and Node 24
      └── npm audit --omit=dev ............. production dependencies
```

Defined in [`.github/workflows/ci.yml`](.github/workflows/ci.yml). The end-to-end checks (the API against a real MongoDB and the pages in a real browser at five widths) were run by hand against a separate throwaway database during development and are not part of the repository.

## Problems I encountered

| Problem | Root cause | Resolution |
|---|---|---|
| Atlas would not connect: `querySrv ECONNREFUSED` | Windows resolved the cluster name, but my network's DNS refused the SRV lookups Node makes. Not a password or IP problem | Optional `DNS_SERVERS` setting, documented. Also learned that a connection string without a database name stores data in `test` |
| A script ran through a student's name | `innerHTML` with unescaped data, token in `localStorage` | Escaping everywhere, no inline handlers, CSP (see [Security](#security)) |
| An `.html` file could pose as a PDF resume | Client's MIME type and extension were trusted | Header check, name cleaning, GridFS, authenticated downloads |
| Dashboards 280 px too wide; login buttons off-screen on phones | Bootstrap columns fought a fixed sidebar; `backdrop-filter` turned the navbar into the containing block of a `position: fixed` menu | One flex layout; blur moved to a pseudo-element; verified by measuring `scrollWidth` in a real browser at five widths |
| Applying reset a *Placed* student to *Under Review* | Status was set per action instead of derived from all applications | Pure rule functions in `placementStatus.js` with unit tests |
| Reading resumes without a paid AI service | Needed text from PDFs and a way to find skills; short names like "C", "R" and "Go" match ordinary words | Dictionary plus section rules; ambiguous names count only as a separate item in a Skills section; scanned PDFs are reported, not guessed; PDF library pinned to a version that supports Node 20 |
| A profile update wiped fields it did not send | `PUT` replaced the whole document | Only fields that were sent are changed; found by a test |
| Browser tests failed on a slow evening | Fixed sleeps while the CDNs were slow | Tests wait for a condition (the loading spinner is gone), not for a number of seconds |
| A "Profile" button wrapped into "Profi / le" and phone labels broke mid-word | Visible only when I looked at the screenshots | Fixed in CSS. Looking at the result is part of testing |

## What I learned

- **Security is mostly small habits applied everywhere:** escape output, never trust the client's file type or ids, check the role on every route, keep secrets out of git, and add a second layer (the CSP) for when the first one misses.
- **Model data around how it is read.** Embed what is always read together, reference what is queried across owners, copy what must stay historically true, and archive instead of deleting.
- **Put rules in pure functions.** Placement rules, the matcher and the resume parser are easy to test because they touch neither the database nor the network.
- **Plain JavaScript goes further than expected** with one state object per page, delegated events and shared helpers, and it showed me what frameworks are for.
- **Test the real thing.** A real browser, a real (separate) database and waiting for conditions found problems that reading code did not.
- **Review first, then fix in small commits.** The history reads as a log of decisions.

## Local development

You need **Node.js 20.19 or newer**, **Git** and a **MongoDB database** (a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster is the easiest).

```bash
git clone https://github.com/UmairBasharti/placement-management-system.git
cd placement-management-system/backend
npm install
cp .env.example .env      # PowerShell: Copy-Item .env.example .env
```

Edit `backend/.env` and set at least `MONGODB_URI` and `JWT_SECRET`; the server will not start without them. Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

<details>
<summary>Setting up a free MongoDB Atlas cluster</summary>

1. Create an account at <https://www.mongodb.com/atlas> and create a free **M0** cluster.
2. **Database Access**: add a database user and note the password.
3. **Network Access**: add your current IP address.
4. **Connect, Drivers, Node.js**: copy the connection string.
5. Put it in `.env` as `MONGODB_URI`, replace `<password>` and add the database name before the `?`:
   `mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/pms?retryWrites=true&w=majority`
   (URL-encode special characters in the password, for example `@` becomes `%40`.)

</details>

```bash
npm run seed      # demo accounts, three companies, two events
npm run dev       # auto-restart on changes; `npm start` for plain node
```

Open <http://localhost:5000>.

| Role | Email | Password |
|---|---|---|
| Admin (use **Admin login** on the home page) | `admin@pms.com` | `admin123` |
| Student, MCA | `rahul@pms.com` | `student123` |
| Student, MBA | `priya@pms.com` | `student123` |

These are for local demos only. Set `ADMIN_SEED_PASSWORD` before seeding anything other people can reach; the seed refuses the default password when `NODE_ENV=production`.

**Try the whole flow.** Log in as Rahul, upload a text-based PDF on **Resume** and try **Fill my profile from this resume**. Log in as admin, approve the resume under **Resumes**. As Rahul, open **Companies**, check the match percentages and apply. As admin, accept or reject the application and watch Rahul's status change.

### Configuration

All settings are in `backend/.env` (template: [`backend/.env.example`](backend/.env.example)).

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `MONGODB_URI` | yes | | MongoDB connection string, with the database name (`/pms`) |
| `JWT_SECRET` | yes | | Signs login tokens. 32 or more random characters; weak values are refused in production |
| `PORT` | no | `5000` | HTTP port |
| `NODE_ENV` | no | | `development` or `production` |
| `JWT_EXPIRE` | no | `24h` | Login lifetime |
| `DNS_SERVERS` | no | | For example `8.8.8.8,1.1.1.1`. Fixes `querySrv ECONNREFUSED` on networks that block SRV lookups |
| `TRUST_PROXY` | no | | `1` behind a reverse proxy, so rate limiting sees real client addresses |
| `CLIENT_ORIGIN` | no | | Allowed browser origin(s), comma separated, only if the frontend is hosted elsewhere |
| `ADMIN_SEED_PASSWORD` | in production | `admin123` | Password for the seeded admin |

### Testing

```bash
npm install          # once, in the repository root (installs ESLint)
npm test             # 55 unit tests
npm run lint
```

The tests cover the placement-status rules, upload helpers, the error handler, the id check, the skill dictionary, the matcher, the resume parser (against generated PDFs) and the front-end escaping helper.

### Troubleshooting

| Symptom | Fix |
|---|---|
| `querySrv ECONNREFUSED ...mongodb.net` | Add `DNS_SERVERS=8.8.8.8,1.1.1.1` to `backend/.env` |
| Timeout when connecting to Atlas | Add your current IP under Atlas, Network Access. Some campus Wi-Fi blocks MongoDB; try a phone hotspot |
| `bad auth` or authentication failed | Wrong database user or password; URL-encode special characters |
| Data lands in a database called `test` | The URI has no database name; use `...mongodb.net/pms?retryWrites=true&w=majority` |
| "Missing required environment variable(s)" | Copy `backend/.env.example` to `backend/.env` and fill in `MONGODB_URI` and `JWT_SECRET` |
| "Too many failed login attempts" | 10 failures per 15 minutes per address; wait, or restart the server while developing |
| A student cannot apply | They need skills on the profile and an **approved** resume; the company must be active and open to their course |
| "This PDF has no readable text" | The resume is a scan or photo; export a text PDF or fill the profile by hand |

## API

All endpoints are under `/api`; logged-in endpoints expect `Authorization: Bearer <token>`. Full reference with examples: [`docs/API.md`](docs/API.md).

| Area | Endpoints |
|---|---|
| Public | `GET /public/stats` · `GET /public/meta` · `GET /health` |
| Auth | `POST /auth/register` · `POST /auth/login` · `GET /auth/me` |
| Student | `GET/PUT /students/me` · `POST /students/me/resume` · `GET /students/me/resume/file` · `GET /students/me/resume/suggestions` · notifications · calendar |
| Companies | `GET /companies` · `GET /companies/recommended` · `GET /companies/:id` · admin: `POST` · `PUT /:id` · `DELETE /:id` · `POST /:id/notes` |
| Applications | student: `GET /applications/my` · `POST /applications` · admin: `PUT /applications/:id/status` |
| Events | `GET /events` · admin: `POST` · `PUT /:id` · `DELETE /:id` |
| Admin | stats, activities, students, resumes (view, approve, reject), `companies/:id/matches`, applications |

## Where to look in the repository

| If you want to see... | Look at |
|---|---|
| App set-up, security headers, rate limits, startup and shutdown | [`backend/server.js`](backend/server.js) |
| Login, registration, token handling | [`backend/routes/auth.routes.js`](backend/routes/auth.routes.js), [`backend/middleware/auth.middleware.js`](backend/middleware/auth.middleware.js) |
| Error handling that never leaks internals | [`backend/middleware/error.middleware.js`](backend/middleware/error.middleware.js) |
| Business rules with tests | [`backend/utils/placementStatus.js`](backend/utils/placementStatus.js), [`backend/tests/`](backend/tests) |
| Skill matching and resume reading | [`backend/utils/matcher.js`](backend/utils/matcher.js), [`backend/utils/resumeParser.js`](backend/utils/resumeParser.js) |
| Safe upload and GridFS storage | [`backend/utils/fileUpload.js`](backend/utils/fileUpload.js) |
| Data models | [`backend/models/`](backend/models) |
| Shared front-end runtime (API client, navigation, session) | [`frontend/js/dashboard.js`](frontend/js/dashboard.js), [`frontend/js/utils.js`](frontend/js/utils.js) |
| The two dashboards | [`frontend/js/student-dashboard.js`](frontend/js/student-dashboard.js), [`frontend/js/admin-dashboard.js`](frontend/js/admin-dashboard.js) |
| Responsive layout | [`frontend/css/dashboard.css`](frontend/css/dashboard.css) |
| CI | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) |

## Engineering trade-offs

| Decision | Rationale |
|---|---|
| Keep Express and plain JavaScript instead of rewriting in React or Next.js | The goal was a working, understandable project. A rewrite would have replaced working code and taken weeks |
| GridFS instead of S3 or local disk | No new account or cost, and no data loss on hosts that wipe the disk. Atlas M0 holds 512 MB; the file helpers are isolated if that ever needs to change |
| Rule-based resume reading instead of an AI API | Free, private, predictable and testable. The price is a smaller vocabulary and no support for scanned PDFs |
| Removing a company archives it | Deleting would silently destroy students' application history |
| An admin must approve a resume before a student can apply | The placement cell controls what companies receive |
| Token in `localStorage` | Simple and works with one origin; mitigated by escaping and the CSP. A cookie with CSRF protection is the next step |
| Courses are a fixed list in [`config/constants.js`](backend/config/constants.js) | One place to change; the forms read it from `/api/public/meta` |

## Limitations and next steps

- Lists are not paginated, which is fine for a college cohort but not for tens of thousands of rows.
- Status changes write to several documents without a database transaction, so a crash between two writes could leave them briefly out of step.
- The skill dictionary covers common IT and business skills; unknown skills still work as typed text but match only by exact spelling.
- The pages load Bootstrap, Chart.js, Font Awesome and Google Fonts from CDNs (the first three pinned with integrity hashes), so they need an internet connection.
- No e-mail notifications or password reset.
- Next: HTTP and browser end-to-end tests inside the repository, pagination, transactions, an `httpOnly` cookie session, a larger skill dictionary.

## Documentation

| Document | Contents |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System overview, request flow, login and resume workflows, matching, placement rules, front-end structure |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Entity diagram, every collection and field, GridFS |
| [`docs/API.md`](docs/API.md) | API reference with examples |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Production checklist and hosting notes |

## License

[MIT](LICENSE).

## Acknowledgements

Developed for **Dr. B.V. Hiray College of Management & Research Center, Malegaon (Nashik)**.
