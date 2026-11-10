<div align="center">

<img src="docs/assets/hero.png" alt="Placement Management System: student and admin dashboards" width="100%">

<br>

<img src="https://img.shields.io/badge/NODE.JS-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="NODE.JS"> <img src="https://img.shields.io/badge/EXPRESS-000000?style=for-the-badge&logo=express&logoColor=white" alt="EXPRESS"> <img src="https://img.shields.io/badge/MONGODB-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MONGODB"> <img src="https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white" alt="JWT">

<img src="https://img.shields.io/badge/JAVASCRIPT-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JAVASCRIPT"> <img src="https://img.shields.io/badge/BOOTSTRAP-7952B3?style=for-the-badge&logo=bootstrap&logoColor=white" alt="BOOTSTRAP"> <img src="https://img.shields.io/badge/CHART.JS-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white" alt="CHART.JS"> <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5">

<img src="https://img.shields.io/badge/GITHUB_ACTIONS-2088FF?style=for-the-badge&logo=githubactions&logoColor=white" alt="GITHUB ACTIONS"> <img src="https://img.shields.io/badge/ESLINT-4B32C3?style=for-the-badge&logo=eslint&logoColor=white" alt="ESLINT"> <a href="https://github.com/UmairBasharti/placement-management-system/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/UmairBasharti/placement-management-system/ci.yml?branch=main&style=for-the-badge&logo=githubactions&logoColor=white&label=CI" alt="CI status"></a> <img src="https://img.shields.io/badge/LICENSE-MIT-blue?style=for-the-badge" alt="MIT license">

<br>

**A full-stack campus placement portal.** Students upload a resume, get jobs ranked by skill match and apply. The placement cell reviews resumes, manages companies and tracks every application.

[Overview](#overview) · [What I implemented](#what-i-implemented) · [Product tour](#product-tour) · [Architecture](#architecture) · [Security](#security) · [Problems I encountered](#problems-i-encountered) · [Run it](#local-development) · [Docs](#documentation)

</div>

---

## Overview

A college placement cell collects resumes, matches students to companies and keeps track of who applied where. That work often lives in spreadsheets, e-mail and chat groups: resumes get lost in threads, nobody has one place to see a student's status, and a student cannot tell whether an application was seen. This project puts it all in one portal. It started as a second-semester project in the first year of my MCA at **Dr. B.V. Hiray College of Management & Research Center, Malegaon (Nashik)**, and I later reviewed and rebuilt large parts of it for security, correctness and responsiveness.

**Student.** Registers with a course (MCA or MBA) and confirms their e-mail address from a link before logging in, can reset a forgotten password by e-mail, keeps a profile, uploads a PDF resume and can fill the profile from it. Sees open jobs ranked by how many of the required skills they already have, applies once the resume is approved, and follows every application, a placement-status timeline, notifications and events.

**Placement cell (admin).** Reviews and approves resumes, manages companies (required skills, private notes, archive), sees the best-matching students for each job, accepts or rejects applications, sets placement statuses, publishes events and exports the student list as CSV.

**Stack.** Node.js and Express 4, MongoDB (Mongoose 7, GridFS for resume files), JWT authentication, plain JavaScript with Bootstrap 5 and Chart.js on the front end. No build step. One process serves the pages and the API.

<table align="center">
  <tr>
    <td align="center"><b>65</b><br><sub>unit tests</sub></td>
    <td align="center"><b>0</b><br><sub>vulnerable production dependencies</sub></td>
    <td align="center"><b>~190</b><br><sub>skills the matcher recognises</sub></td>
    <td align="center"><b>5</b><br><sub>screen widths checked for overflow</sub></td>
    <td align="center"><b>1</b><br><sub>database for data and resume files</sub></td>
  </tr>
</table>

## What I implemented

| Area | Implementation | Evidence |
|---|---|---|
| **Authentication and roles** | JWT (HS256 only), bcrypt hashing, student and admin roles checked on every protected route, public registration can only create students | [`auth.routes.js`](backend/routes/auth.routes.js), [`auth.middleware.js`](backend/middleware/auth.middleware.js) |
| **E-mail verification and password reset** | A new account cannot log in until the e-mailed link is opened; a forgotten password is reset through a one-time e-mailed link. Mail goes out through Gmail SMTP (free) or any other SMTP server | [`auth.routes.js`](backend/routes/auth.routes.js), [`mailer.js`](backend/utils/mailer.js), [`tokens.js`](backend/utils/tokens.js) |
| **Resume pipeline** | PDF upload checked by MIME type, size and real `%PDF-` header, stored in MongoDB GridFS, three review states (`pending`, `approved`, `rejected`), served only through authenticated routes | [`fileUpload.js`](backend/utils/fileUpload.js), [`student.routes.js`](backend/routes/student.routes.js), [`admin.routes.js`](backend/routes/admin.routes.js) |
| **Resume to profile** | Reads PDF text locally with `unpdf`, finds skills with a dictionary of about 190 skills, cuts out Education and Projects by heading. The student reviews before anything is saved. No AI service, no API cost | [`resumeParser.js`](backend/utils/resumeParser.js), [`skills.js`](backend/utils/skills.js), [`data/skills.js`](backend/data/skills.js) |
| **Job matching** | Match score is the share of a job's required skills the student already has; ranked recommendations for students, best-matching students per job for admins | [`matcher.js`](backend/utils/matcher.js), [`company.routes.js`](backend/routes/company.routes.js) |
| **Placement-status rules** | Pure functions keep a student's status consistent with their applications (never downgrades *Placed*, recomputed from all applications) | [`placementStatus.js`](backend/utils/placementStatus.js), [`placementStatus.test.js`](backend/tests/placementStatus.test.js) |
| **Admin tools** | Dashboard with charts, company CRUD with archive and notes, application decisions, student directory, CSV export (formula-injection safe), events with cascading updates to students' calendars | [`admin-dashboard.js`](frontend/js/admin-dashboard.js), [`event.routes.js`](backend/routes/event.routes.js) |
| **Security hardening** | CSP without inline scripts, output escaping, rate limits, input type checks, central error handler, startup config validation, see [Security](#security) | [`server.js`](backend/server.js), [`utils.js`](frontend/js/utils.js) |
| **Responsive UI** | One flex layout for both dashboards, slide-in menu below 993 px; checked with no horizontal overflow at 1440, 1024, 820, 390 and 320 px | [`dashboard.css`](frontend/css/dashboard.css), [`dashboard.js`](frontend/js/dashboard.js) |
| **Quality gates** | 65 unit tests with `node --test`, ESLint 9, GitHub Actions on Node 22 and 24, production `npm audit` | [`tests/`](backend/tests), [`ci.yml`](.github/workflows/ci.yml) |

## Product tour

<p align="center"><img src="docs/assets/showcase-student.png" alt="Student experience: ranked jobs, resume scan, calendar" width="100%"></p>
<p align="center"><img src="docs/assets/showcase-admin.png" alt="Placement cell: best-matching students, resume review, student directory" width="100%"></p>
<p align="center"><img src="docs/assets/responsive.png" alt="One layout on desktop, tablet and phone" width="100%"></p>

> The screenshots use fictional data (eight students, six companies), a larger set than `npm run seed` creates.

## Architecture

<p align="center"><img src="docs/assets/architecture.png" alt="Architecture: browser, Express server, MongoDB with GridFS, resume pipeline and CI" width="100%"></p>

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
| **Fake e-mails and account recovery** | Anyone could register with an address they do not own, and a forgotten password meant a locked-out account | Login needs a verified e-mail. Reset and verification links carry a random 256-bit token; only its SHA-256 hash is stored, it works once and expires (24 h, 60 min). Forgot-password answers the same for known and unknown e-mails, one link per account per minute, 30 e-mail requests per hour per address. A reset ends every login started before it | [`auth.routes.js`](backend/routes/auth.routes.js), [`tokens.js`](backend/utils/tokens.js), [`auth.middleware.js`](backend/middleware/auth.middleware.js) |
| **Information leaks** | Database error messages reached the browser; admin-only notes were sent to students | Central error handler returns short messages and logs details server-side; students never receive notes and see only companies open to their course | [`error.middleware.js`](backend/middleware/error.middleware.js), [`company.routes.js`](backend/routes/company.routes.js) |
| **Missing hardening** | No security headers, CORS open to everyone | helmet with CSP, `Permissions-Policy`, `no-store` on API responses, CORS closed unless `CLIENT_ORIGIN` is set, 100 kB body limit | [`server.js`](backend/server.js) |
| **Secrets and config** | No env template, no check for missing secrets, a public demo admin password written in the seed and the README | Startup validation (weak secrets refused in production), `.env.example`, no built-in admin: it is created by `npm run create-admin`, which masks the password as you type, and only its hash is stored | [`validateEnv.js`](backend/config/validateEnv.js), [`createAdmin.js`](backend/createAdmin.js) |
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

You run **one program**: a Node.js server that serves the web pages and the API and keeps its data in a MongoDB database. There is no build step.

### What you need

| Tool | Version | Download | Check it works |
|---|---|---|---|
| **Git** | any recent (or skip it and download a ZIP, see step 1) | [git-scm.com/downloads](https://git-scm.com/downloads) | `git --version` |
| **Node.js** | 20.19 or newer (the LTS version is fine) | [nodejs.org](https://nodejs.org) | `node --version` |
| **MongoDB** | any recent | A free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster is the easiest (steps below). MongoDB Community Server installed on your own computer works too | |
| A browser | Chrome, Edge, Firefox or Safari | | |

> **What is a terminal?** The window where you type commands. On Windows press the Windows key, type **PowerShell** and press Enter. On macOS open **Terminal**.

### 1. Get the code

```bash
git clone https://github.com/UmairBasharti/placement-management-system.git
cd placement-management-system
```

No Git? On the GitHub page click the green **Code** button, then **Download ZIP**, unzip it, and open your terminal inside the unzipped folder (it is called `placement-management-system-main`).

### 2. Install and configure

```bash
cd backend
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

**Prefer a database on your own computer?** Install MongoDB Community Server, skip the Atlas steps and use `MONGODB_URI=mongodb://localhost:27017/pms` (`127.0.0.1` works the same).

### 3. Add demo data and start the server

```bash
npm run seed          # two demo students, three companies, two events
npm run create-admin  # your own admin account (asks for an e-mail and a password)
npm run dev           # auto-restart on changes; `npm start` for plain node
```

`npm run seed` fills an empty database. You should see:

```
Connected to MongoDB
Cleared existing data
Created student: rahul@pms.com / student123 (MCA)
Created student: priya@pms.com / student123 (MBA)
Created 3 companies
Created 2 events
Seed complete. Next: create your admin account with  npm run create-admin  and start the app with  npm run dev
```

**The admin account.** There is no built-in admin and no admin password anywhere in the code, the seed data or this README. `npm run create-admin` asks for a name, an e-mail (use an inbox you can open, because "Forgot password?" sends the reset link there) and a password, which shows only as `****` while you type and is stored only as a bcrypt hash. It only adds or updates that one account and never touches other data. Run it again with the same e-mail to reset that admin's password, for example if it is ever lost. If other admin accounts exist it offers to delete them. For scripted set-ups you can set `ADMIN_EMAIL` and `ADMIN_PASSWORD` instead of typing them (keep them out of `.env`).

> **Careful: `seed` clears the database before it fills it.** If the database already has users it asks first (`y/N`); in a shell that cannot ask it stops with `The database already has N users. Run with --force to clear it and re-seed.` To wipe and re-seed on purpose, run `npm run seed -- --force`. The extra `--` matters: `npm run seed --force` is swallowed by npm and does nothing.

`npm run dev` is ready when you see:

```
Connected to MongoDB
Server running on http://localhost:5000
```

A warning about `punycode` or a `nodemon` banner above those lines is harmless. Leave this window open.

### 4. Open it

Go to <http://localhost:5000>.

| Role | Email | Password |
|---|---|---|
| Admin (use **Admin login** on the home page) | the e-mail you gave to `npm run create-admin` | the password you typed there |
| Student, MCA | `rahul@pms.com` | `student123` |
| Student, MBA | `priya@pms.com` | `student123` |

The two demo students exist only in the seed data, for local demos; do not seed them on a server other people can reach. New students register themselves and verify their e-mail.

**Try the whole flow.** Log in as Rahul, upload a text-based PDF on **Resume** and try **Fill my profile from this resume**. Log in as admin, approve the resume under **Resumes**. As Rahul, open **Companies**, check the match percentages and apply. As admin, accept or reject the application and watch Rahul's status change.

**Next time** you only need to start the server: open a terminal in the `backend` folder and run `npm run dev`. Your data stays in the database. Stop the server with **Ctrl+C**.

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
| `SMTP_USER`, `SMTP_PASS` | in production | | Mail account that sends the verification and reset e-mails (Gmail address and its app password). Without them the e-mails are printed in the server console instead |
| `APP_URL` | in production | `http://localhost:PORT` | Public address of the site, used in the e-mailed links |
| `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM` | no | `smtp.gmail.com`, `465` | Another mail provider, or a different sender name |

**E-mail (verification and password reset).** New accounts must open a link sent to their e-mail before they can log in, and "Forgot password?" on the login page sends a reset link. To send real e-mail with a free Gmail account: turn on 2-Step Verification, create an app password (Google Account, Security, App passwords) and put the Gmail address in `SMTP_USER` and the 16-character password in `SMTP_PASS`. While developing you can leave both empty: the e-mail, with its link, is then printed in the server console, so the whole flow works on a laptop with no mail account. The seeded demo accounts are already verified, and so are accounts that existed before verification was added. For quick manual tests, a throwaway address such as `anything@yopmail.com` works (its inbox is public, so never use it for a real account).

### Testing

```bash
npm install          # once, in the repository root (installs ESLint)
npm test             # 65 unit tests
npm run lint
```

The tests cover the placement-status rules, upload helpers, the error handler, the id check, the skill dictionary, the matcher, the resume parser (against generated PDFs) and the front-end escaping helper.

<details>
<summary><b>Troubleshooting</b></summary>

| Symptom | Fix |
|---|---|
| `querySrv ECONNREFUSED ...mongodb.net` | Add `DNS_SERVERS=8.8.8.8,1.1.1.1` to `backend/.env` |
| "Could not connect to any servers in your MongoDB Atlas cluster" or a timeout | Atlas is refusing your IP address. Add it under Atlas, Network Access, and wait until it shows Active. Your home IP can change, and a VPN or proxy in the browser can make "Add Current IP Address" add a different address than the one the server connects from. Some campus Wi-Fi blocks MongoDB; try a phone hotspot |
| `bad auth` or authentication failed | Wrong database user or password; URL-encode special characters |
| Data lands in a database called `test` | The URI has no database name; use `...mongodb.net/pms?retryWrites=true&w=majority` |
| "Missing required environment variable(s)" | Copy `backend/.env.example` to `backend/.env` and fill in `MONGODB_URI` and `JWT_SECRET` |
| `node` or `npm` is not recognized | Install Node.js (see the table at the top of this section) and open a **new** terminal window |
| "JWT_SECRET looks weak (use 32+ random characters before deploying)" | Only a warning while developing. Generate a real secret (command in step 2) before you deploy |
| `Error: listen EADDRINUSE: address already in use :::5000` | Another program, or an older copy of this server in another terminal, is using port 5000. Close it, or add `PORT=5001` to `backend/.env` and open <http://localhost:5001> |
| "The database already has N users. Run with --force to clear it and re-seed." | `seed` will not wipe a database that has data unless you say so: `npm run seed -- --force` (with the extra `--`) |
| "Invalid email or password" for a demo account | The database is empty until you run `npm run seed`. Run it, then try again |
| "Invalid email or password" on the admin login | There is no default admin. Create one with `npm run create-admin` (running it again with the same e-mail resets the password) |
| "Please verify your email before logging in" | Open the link in the e-mail sent at registration, or use "Resend verification email" on the login page. With no `SMTP_USER` / `SMTP_PASS` set, the link is printed in the server console |
| "Too many failed login attempts" | 10 failures per 15 minutes per address; wait, or restart the server while developing |
| A student cannot apply | They need skills on the profile and an **approved** resume; the company must be active and open to their course |
| "This PDF has no readable text" | The resume is a scan or photo; export a text PDF or fill the profile by hand |

</details>

## API

All endpoints are under `/api`; logged-in endpoints expect `Authorization: Bearer <token>`. Full reference with examples: [`docs/API.md`](docs/API.md).

| Area | Endpoints |
|---|---|
| Public | `GET /public/stats` · `GET /public/meta` · `GET /health` |
| Auth | `POST /auth/register` · `POST /auth/login` · `GET /auth/me` · `POST /auth/verify-email` · `POST /auth/resend-verification` · `POST /auth/forgot-password` · `POST /auth/reset-password` |
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
| E-mail verification, password reset and the admin command | [`backend/utils/mailer.js`](backend/utils/mailer.js), [`backend/utils/tokens.js`](backend/utils/tokens.js), [`backend/createAdmin.js`](backend/createAdmin.js) |
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
| Own verification and reset flow instead of a hosted login service such as Clerk | Keeps the working login and the one-command, no-extra-account set-up. The price is that this code is mine to maintain; the tokens and the rules around them are covered in [`tokens.js`](backend/utils/tokens.js) and the tests |
| Gmail SMTP for sending mail | Free and needs no domain. It has a daily sending limit and sends from a Gmail address, so a busy production site would switch to a mail provider by setting `SMTP_HOST` |
| Token in `localStorage` | Simple and works with one origin; mitigated by escaping and the CSP. A cookie with CSRF protection is the next step |
| Courses are a fixed list in [`config/constants.js`](backend/config/constants.js) | One place to change; the forms read it from `/api/public/meta` |

## Limitations and next steps

- Lists are not paginated, which is fine for a college cohort but not for tens of thousands of rows.
- Status changes write to several documents without a database transaction, so a crash between two writes could leave them briefly out of step.
- The skill dictionary covers common IT and business skills; unknown skills still work as typed text but match only by exact spelling.
- The pages load Bootstrap, Chart.js, Font Awesome and Google Fonts from CDNs (the first three pinned with integrity hashes), so they need an internet connection.
- E-mail links trust whoever can read the inbox. An account registered with a public throwaway address such as Yopmail is therefore not protected, because anyone can open that inbox and use the reset link. If this were deployed, the next step would be to block known throwaway domains or to allow only the college's e-mail domain.
- E-mail is used only to verify addresses and reset passwords; there are no notification e-mails yet. An account that has not verified its address stays in the database until someone resets its password or it is removed by hand.
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

Started as a second-semester project in the first year of my MCA at **Dr. B.V. Hiray College of Management & Research Center, Malegaon (Nashik)**.
