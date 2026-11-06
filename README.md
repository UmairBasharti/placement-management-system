<div align="center">

<img src="frontend/assets/Hiray%20logo.png" alt="Dr. B.V. Hiray College logo" width="110">

# Placement Management System

A campus placement portal. Students upload a resume, get job suggestions that fit their skills and apply to companies. The placement cell reviews resumes, manages companies and applications, and tracks every student's placement status.

Built as a semester project for **Dr. B.V. Hiray College of Management & Research Center, Malegaon (Nashik)**.

![Node.js](https://img.shields.io/badge/Node.js-20.19%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

</div>

<p align="center">
  <img src="docs/screenshots/student-dashboard.png" alt="Student dashboard with job recommendations" width="49%">
  <img src="docs/screenshots/admin-dashboard.png" alt="Admin dashboard" width="49%">
</p>

## Contents
[What it does](#what-it-does) · [Screenshots](#screenshots) · [Tech stack](#tech-stack) · [Getting started](#getting-started) · [Configuration](#configuration) · [How the matching works](#how-the-matching-and-resume-scan-work) · [Project structure](#project-structure) · [API](#api) · [Security](#security) · [Testing](#testing) · [Troubleshooting](#troubleshooting) · [Limitations](#limitations) · [Documentation](#documentation)

## What it does

**Students**
- Register with their course (MCA or MBA), keep a profile of skills, education and projects.
- Upload a resume (PDF, up to 5 MB). **Fill my profile from this resume** reads the PDF and proposes skills, education and projects; the student picks what to keep, nothing is saved automatically.
- See **recommended jobs** ranked by how many of the required skills they already have, with the matching and missing skills shown on each card.
- Apply to companies open to their course. Applying needs an approved resume.
- Follow each application (Pending / Accepted / Rejected), a placement-status timeline and notifications.
- Browse placement events and add them to a personal calendar.

**Placement cell (admin)**
- Dashboard: headline numbers, placement-status chart, students per course, recent activity.
- Companies: add, edit and remove (removing archives the company, applications are kept), set required skills, add private notes. The company page lists the **best-matching students** for that job.
- Students: search and filter, change a placement status, open a full profile, export CSV.
- Resumes: open any student's PDF, approve or reject it. The student is notified.
- Applications: accept or reject; the student's placement status follows automatically.
- Events: create, edit and delete. Every student is notified, and edits and deletions carry over to students' calendars.

The pages work on desktop, tablet and phone (a slide-in menu replaces the sidebar on small screens).

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

> The screenshots use a larger fictional data set than `npm run seed` creates (eight students, six companies). All names are made up.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS and plain JavaScript (no build step), Bootstrap 5.3, Chart.js 4, Font Awesome 6, Poppins. Libraries come from CDNs; Bootstrap, Chart.js and Font Awesome are pinned with integrity hashes. |
| Backend | Node.js 20.19+, Express 4 |
| Database | MongoDB through Mongoose 7 (MongoDB Atlas free tier works). Resume PDFs are stored in the same database with GridFS. |
| Auth | JSON Web Tokens, `bcryptjs` password hashing, two roles (`student`, `admin`) |
| Safety | `helmet` (CSP), `express-rate-limit`, `express-validator`, `cors` (closed by default), `multer` for uploads |
| Resume reading | [`unpdf`](https://github.com/unjs/unpdf) for the PDF text, then local rules. No AI service, no API key, no cost. |
| Tooling | `node --test`, ESLint 9, GitHub Actions |

The Express server also serves the frontend, so the whole app is one process on one address.

## Getting started

You need **Node.js 20.19 or newer**, **Git** and a **MongoDB database** (a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster is the easiest).

```bash
git clone <your-repo-url>
cd P-M-S/backend
npm install
cp .env.example .env      # PowerShell: Copy-Item .env.example .env
```

Edit `backend/.env` and set at least `MONGODB_URI` and `JWT_SECRET` (the server will not start without them). Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

<details>
<summary>Setting up a free MongoDB Atlas cluster</summary>

1. Create an account at <https://www.mongodb.com/atlas> and create a free **M0** cluster.
2. **Database Access**: add a database user and note the password.
3. **Network Access**: add your current IP address.
4. **Connect, Drivers, Node.js**: copy the connection string.
5. Put it in `.env` as `MONGODB_URI`, replace `<password>`, and add the database name before the `?`:
   `mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/pms?retryWrites=true&w=majority`
   (URL-encode special characters in the password, for example `@` becomes `%40`.)

</details>

Then fill the database with demo data and start the server:

```bash
npm run seed      # demo accounts, three companies, two events
npm run dev       # auto-restart on changes. Use `npm start` for plain node.
```

Open <http://localhost:5000>.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin (use **Admin login** on the home page) | `admin@pms.com` | `admin123` |
| Student, MCA | `rahul@pms.com` | `student123` |
| Student, MBA | `priya@pms.com` | `student123` |

These are for local demos only. Set `ADMIN_SEED_PASSWORD` before seeding anything that other people can reach; the seed script refuses the default password when `NODE_ENV=production`.

### Try the whole flow
1. Log in as **Rahul**, open **Resume** and upload any PDF (a text-based CV works best). Choose **Fill my profile from this resume** to see the scan.
2. Log in as **admin**, open **Resumes** and approve Rahul's resume.
3. As Rahul, open **Companies**, check the match percentages and **Apply**.
4. As admin, open **Companies**, accept or reject the application, and watch Rahul's status and notifications change.

## Configuration

Everything is set in `backend/.env` (template: [`backend/.env.example`](backend/.env.example)).

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `MONGODB_URI` | yes | | MongoDB connection string, with the database name (`/pms`) |
| `JWT_SECRET` | yes | | Signs login tokens. 32 or more random characters; weak values are refused in production |
| `PORT` | no | `5000` | HTTP port |
| `NODE_ENV` | no | | `development` or `production` |
| `JWT_EXPIRE` | no | `24h` | Login lifetime |
| `DNS_SERVERS` | no | | For example `8.8.8.8,1.1.1.1`. Fixes `querySrv ECONNREFUSED` on networks that block SRV lookups |
| `TRUST_PROXY` | no | | Set to `1` behind a reverse proxy so rate limiting sees real client addresses |
| `CLIENT_ORIGIN` | no | | Allowed browser origin(s), comma separated, only if the frontend is hosted elsewhere |
| `ADMIN_SEED_PASSWORD` | in production | `admin123` | Password for the seeded admin |

## How the matching and resume scan work

Both features are plain rules, so they are predictable and free to run.

- **Skill dictionary** ([`backend/data/skills.js`](backend/data/skills.js)): about 190 skills with their common spellings (`node`, `node.js` and `nodejs` are one skill). A student's skills come from the Skills field of the profile plus known skills mentioned in their projects. A job's skills are the list the admin enters, or, if there is none, the known skills found in its requirements text.
- **Match score**: the share of a job's required skills the student already has. Recommendations leave out jobs the student already applied to, jobs for other courses, jobs whose skills cannot be recognised and jobs that share no skill with the student.
- **Resume scan** ([`backend/utils/resumeParser.js`](backend/utils/resumeParser.js)): extracts the PDF text, finds known skills, and cuts out the Education and Projects sections by their headings. Ambiguous names such as C, R, Go or Express only count when they appear as a separate item in the Skills section, so the letter "c" or the word "go" in a sentence is not mistaken for a skill.
- Scanned (image-only) PDFs contain no text; the app says so and asks the student to fill in the profile by hand.

## Project structure

```
P-M-S/
├── backend/
│   ├── server.js            app setup: security headers, rate limits, routes, startup
│   ├── seed.js              demo data
│   ├── config/              environment checks, shared constants (courses, job types)
│   ├── data/skills.js       skill dictionary
│   ├── middleware/          JWT auth and roles, validation, central error handler
│   ├── models/              Mongoose schemas
│   ├── routes/              auth, students, companies, applications, events, admin, public
│   ├── utils/               GridFS file helpers, placement-status rules, skills, matcher, resume parser
│   └── tests/               unit tests
├── frontend/
│   ├── index.html · login.html · student-dashboard.html · admin-dashboard.html · 404.html
│   ├── css/                 common, dashboard (shared), one file per page
│   ├── js/                  utils and dashboard (shared), one file per page
│   └── assets/              logo, icons
├── docs/                    architecture, database, API, user manual, deployment, audit, screenshots
├── .github/workflows/       CI (lint, tests, dependency audit)
└── eslint.config.js
```

## API

All endpoints live under `/api`. Logged-in endpoints expect `Authorization: Bearer <token>`. The full reference with request and response examples is in [`docs/API.md`](docs/API.md).

| Area | Endpoints |
|---|---|
| Public | `GET /public/stats` · `GET /public/meta` · `GET /health` |
| Auth | `POST /auth/register` · `POST /auth/login` · `GET /auth/me` |
| Student | `GET/PUT /students/me` · `POST /students/me/resume` · `GET /students/me/resume/file` · `GET /students/me/resume/suggestions` · notifications · calendar |
| Companies | `GET /companies` · `GET /companies/recommended` · `GET /companies/:id` · admin: `POST` · `PUT /:id` · `DELETE /:id` · `POST /:id/notes` |
| Applications | student: `GET /applications/my` · `POST /applications` · admin: `PUT /applications/:id/status` |
| Events | `GET /events` · admin: `POST` · `PUT /:id` · `DELETE /:id` |
| Admin | stats, activities, students, resumes (view, approve, reject), `companies/:id/matches`, applications |

## Security

The full review and what was changed is in [`docs/AUDIT.md`](docs/AUDIT.md). In short:

- All user-entered text is escaped before it is shown, and the pages contain no inline scripts or event handlers, so the Content-Security-Policy can forbid them.
- Resumes are private. They are only served through authenticated routes: a student can fetch their own, an admin can fetch any. Uploads are checked for size, MIME type and the real `%PDF-` header.
- Passwords are hashed with bcrypt, tokens are signed and expire, and every protected route checks the role. Registration can only create students.
- Rate limits: 10 failed logins per 15 minutes per address, 20 registrations per hour, 600 API calls per 15 minutes.
- The error handler returns short messages; stack traces and database details stay in the server log.
- Students never receive admin-only company notes and can only open companies that are active and open to their course.

**Known trade-off:** the login token is kept in `localStorage`, which any script on the page could read. That is why the XSS protections above matter. A stricter set-up would use an `httpOnly` cookie with CSRF protection.

## Testing

```bash
npm install          # once, in the repository root (installs ESLint)
npm test             # 52 unit tests (node --test)
npm run lint         # ESLint
```

The unit tests cover the placement-status rules, upload helpers, the error handler, the skill dictionary, the matcher, the resume parser (against generated PDFs) and the frontend escaping helper. GitHub Actions runs lint and tests on Node 22 and 24, plus `npm audit` for production dependencies.

The end-to-end behaviour (APIs and the real pages in a browser) was verified by hand against a separate throwaway database; those scripts are not part of the repository.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `querySrv ECONNREFUSED ...mongodb.net` | Your network refuses DNS SRV lookups from Node. Add `DNS_SERVERS=8.8.8.8,1.1.1.1` to `backend/.env`. |
| Timeout when connecting to Atlas | Add your current IP under Atlas, Network Access. Some campus Wi-Fi blocks MongoDB; try a phone hotspot. |
| `bad auth` or authentication failed | Wrong database username or password. URL-encode special characters in the password. |
| Data lands in a database called `test` | The URI has no database name. Use `...mongodb.net/pms?retryWrites=true&w=majority`. |
| "Missing required environment variable(s)" | Copy `backend/.env.example` to `backend/.env` and fill in `MONGODB_URI` and `JWT_SECRET`. |
| "Too many failed login attempts" | The limit is 10 failures per 15 minutes per address. Wait, or restart the server while developing. |
| A student cannot apply | They need skills on the profile and an **approved** resume, and the company must be active and open to their course. |
| Everyone was logged out | Expected after changing `JWT_SECRET`. Log in again. |
| "This PDF has no readable text" | The resume is a scan or photo. Export a text PDF from Word or Google Docs, or fill in the profile by hand. |

## Limitations

- Lists (companies, students, applications) are not paginated. That is fine for a college cohort, not for tens of thousands of rows.
- Placement-status changes write to several documents without a database transaction, so a crash between two writes could leave them briefly out of step.
- The skill dictionary is limited to common IT and business skills; unknown skills still work as typed text but are matched only by exact spelling.
- Courses (MCA, MBA) are a fixed list in [`backend/config/constants.js`](backend/config/constants.js); the forms read it from the server, so that file is the only place to change.
- The pages load Bootstrap, Chart.js, Font Awesome and Google Fonts from CDNs, so they need an internet connection.
- No e-mail notifications; notifications appear inside the portal only.
- The login token lives in `localStorage` (see [Security](#security)).

## Documentation

| Document | Contents |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System overview, request flow, login, resume workflow, matching, placement-status rules, frontend structure |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Entity diagram, every collection and field, GridFS |
| [`docs/API.md`](docs/API.md) | API reference with examples |
| [`docs/USER_MANUAL.md`](docs/USER_MANUAL.md) | Guides for students and the placement cell |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Production checklist and hosting notes |
| [`docs/AUDIT.md`](docs/AUDIT.md) | The code review that shaped this version: what was found, what was fixed |

## License

[MIT](LICENSE).

Developed for **Dr. B.V. Hiray College of Management & Research Center, Malegaon (Nashik)**.
