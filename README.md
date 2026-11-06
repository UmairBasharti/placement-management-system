<div align="center">

<img src="frontend/assets/Hiray%20logo.png" alt="Dr. B.V. Hiray College logo" width="120">

# Placement Management System (PMS)

**A full-stack campus placement portal — students build profiles, upload resumes and apply to companies; the placement cell manages companies, resumes, applications and events.**

Built as a semester project for **Dr. B.V. Hiray College of Management & Research Center, Malegaon (Nashik)**.

![Node.js](https://img.shields.io/badge/Node.js-20.19%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

</div>

<p align="center">
  <img src="docs/screenshots/home-desktop.png" alt="Home page" width="49%">
  <img src="docs/screenshots/student-dashboard.png" alt="Student dashboard" width="49%">
</p>
<p align="center">
  <img src="docs/screenshots/admin-dashboard.png" alt="Admin dashboard" width="49%">
  <img src="docs/screenshots/admin-resumes.png" alt="Resume approvals" width="49%">
</p>

---

## Table of contents
[Features](#features) · [Screenshots](#screenshots) · [Tech stack](#tech-stack) · [Architecture](#architecture) · [Getting started](#getting-started) · [Configuration](#configuration) · [Project structure](#project-structure) · [API overview](#api-overview) · [Security](#security) · [Testing](#testing) · [Troubleshooting](#troubleshooting) · [Known limitations & roadmap](#known-limitations--roadmap) · [Documentation](#documentation)

## Features

### For students
- **Register & log in** (students pick their branch — MCA or MBA — at registration).
- **Profile** with skills, education and projects, plus a **profile-completion** meter.
- **Resume upload** (PDF, max 5 MB). The placement cell reviews every resume; students can apply once it is **approved**.
- **Browse companies** filtered automatically by branch, with search and job-type filters, company detail view and **one-click apply**.
- **Track everything**: application status (Pending / Accepted / Rejected), a **placement-status timeline**, and **notifications**.
- **Event calendar** for drives, workshops and mock interviews; add events to a personal calendar.

### For the placement cell (admin)
- **Dashboard** with a placement-status doughnut chart, a course-wise bar chart and a live **recent-activity** feed.
- **Company management**: add, edit, view and delete companies (job type, eligible branches, package, requirements).
- **Student directory** with search, branch/status filters and manual placement-status updates.
- **Resume review**: open a student's PDF securely, then approve or reject it.
- **Application review**: accept or reject applications — the student's placement status and notifications update automatically.
- **Events**: create, edit and delete events; every student is notified.
- **CSV export** of student data.

### Quality
- Fully **responsive** (desktop, tablet, phone) with a mobile navigation drawer.
- Security hardening: XSS-safe rendering, validated and private resume uploads, security headers (CSP), rate limiting, consistent error handling — see [Security](#security).

## Screenshots

| Student | Admin |
|---|---|
| ![Student companies](docs/screenshots/student-companies.png) | ![Admin companies](docs/screenshots/admin-companies.png) |
| ![Student resume](docs/screenshots/student-resume.png) | ![Admin students](docs/screenshots/admin-students.png) |
| ![Student calendar](docs/screenshots/student-calendar.png) | ![Admin calendar](docs/screenshots/admin-calendar.png) |

| Login | Register |
|---|---|
| ![Login](docs/screenshots/login-desktop.png) | ![Register](docs/screenshots/register-desktop.png) |

**Mobile & tablet**

<p>
  <img src="docs/screenshots/mobile-home.png" alt="Mobile home" width="19%">
  <img src="docs/screenshots/mobile-login.png" alt="Mobile login" width="19%">
  <img src="docs/screenshots/mobile-student.png" alt="Mobile student dashboard" width="19%">
  <img src="docs/screenshots/mobile-student-menu.png" alt="Mobile navigation drawer" width="19%">
  <img src="docs/screenshots/mobile-admin.png" alt="Mobile admin dashboard" width="19%">
</p>
<p>
  <img src="docs/screenshots/tablet-admin.png" alt="Tablet admin dashboard" width="40%">
</p>

> Screenshots use demo data. Student names and companies are fictional.

## Tech stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, CSS3, vanilla JavaScript (ES2020), [Bootstrap 5.3](https://getbootstrap.com/), [Chart.js 4](https://www.chartjs.org/), Font Awesome 6, Boxicons, Poppins font |
| **Backend** | [Node.js](https://nodejs.org/) (≥ 20.19), [Express 4](https://expressjs.com/) |
| **Database** | [MongoDB](https://www.mongodb.com/) via [Mongoose 7](https://mongoosejs.com/) (MongoDB Atlas recommended) |
| **Auth** | JSON Web Tokens (`jsonwebtoken`), passwords hashed with `bcryptjs`, role-based access (`student` / `admin`) |
| **Validation & security** | `express-validator`, `helmet` (CSP), `express-rate-limit`, `cors` (closed by default) |
| **Uploads** | `multer` 2 (PDF only, 5 MB, content-checked) |
| **Tests** | Node's built-in test runner (`node --test`) |

The backend also serves the static frontend, so the whole app runs from **one process on one origin**.

## Architecture

```mermaid
flowchart LR
    B["Browser<br/>HTML · CSS · vanilla JS"] -- "JSON + Bearer JWT" --> E["Express API<br/>helmet · rate limit · validation · RBAC"]
    B -. "static pages" .-> E
    E --> M[("MongoDB Atlas<br/>users · students · companies<br/>applications · events · activities")]
    E --> U[("uploads/<br/>resume PDFs (private)")]
```

More diagrams — authentication flow, resume workflow, placement-status state machine — are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). The data model is in [`docs/DATABASE.md`](docs/DATABASE.md).

## Getting started

### Prerequisites
- **Node.js 20.19 or newer** (an LTS release is recommended) — <https://nodejs.org>
- A **MongoDB** database: a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster (recommended) or a local MongoDB
- **Git**

### 1. Clone and install
```bash
git clone <your-repo-url>
cd P-M-S/backend
npm install
```

### 2. Configure the environment
```bash
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
```
Open `backend/.env` and fill in the values (see [Configuration](#configuration)). The two required ones are `MONGODB_URI` and `JWT_SECRET`; the server refuses to start without them.

<details>
<summary><b>Setting up a free MongoDB Atlas cluster (about 10 minutes)</b></summary>

1. Create an account at <https://www.mongodb.com/atlas> and create a free **M0** cluster.
2. **Database Access** → add a database user (note the password).
3. **Network Access** → add your current IP address.
4. **Connect → Drivers → Node.js** → copy the connection string.
5. Put it in `.env` as `MONGODB_URI`, replacing `<password>` and **adding the database name** before the `?`:
   `mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/pms?retryWrites=true&w=majority`
   (URL-encode special characters in the password, e.g. `@` → `%40`.)

</details>

Generate a strong JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 3. Seed the database (first run only)
```bash
npm run seed
```
This creates the demo accounts and three sample companies. If the database already has users, the script asks before clearing them.

### 4. Start the server
```bash
npm run dev      # development (auto-restart with nodemon)
# or
npm start        # plain node
```
Open **<http://localhost:5000>**.

### Demo accounts
| Role | Email | Password |
|---|---|---|
| Admin (use **Admin Login** on the home page) | `admin@pms.com` | `admin123` |
| Student (MCA) | `rahul@pms.com` | `student123` |
| Student (MBA) | `priya@pms.com` | `student123` |

> ⚠️ These are **demo credentials only**. Set `ADMIN_SEED_PASSWORD` before seeding anything that is publicly reachable — the seed script refuses to run with the default in `NODE_ENV=production`.

### Try the full flow
1. Log in as **Rahul**, fill in *Skills* on the Profile page and upload a PDF on the Resume page.
2. Log out, log in as **admin** → *Resumes* → approve Rahul's resume.
3. Back as Rahul → *Companies* → **Apply**. Watch the status timeline and notifications.
4. As admin → *Companies* → *Applications* → accept or reject, and see the student's placement status update.

## Configuration

All settings live in `backend/.env` (see [`backend/.env.example`](backend/.env.example)).

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGODB_URI` | **yes** | — | MongoDB connection string. Include the database name (`/pms`). |
| `JWT_SECRET` | **yes** | — | Secret used to sign login tokens. 32+ random characters; weak values are rejected in production. |
| `PORT` | no | `5000` | HTTP port. |
| `NODE_ENV` | no | — | `development` or `production`. |
| `JWT_EXPIRE` | no | `24h` | Token lifetime. |
| `DNS_SERVERS` | no | — | e.g. `8.8.8.8,1.1.1.1`. Workaround for `querySrv ECONNREFUSED` on networks that block DNS SRV lookups. |
| `TRUST_PROXY` | no | — | Set to `1` behind a reverse proxy (Render, Railway, nginx) so rate limiting sees real client IPs. |
| `CLIENT_ORIGIN` | no | — | Allowed browser origin(s), comma-separated, if the frontend is hosted separately. By default cross-origin API access is disabled. |
| `ADMIN_SEED_PASSWORD` | no* | `admin123` | Password for the seeded admin. *Required when seeding with `NODE_ENV=production`. |

## Project structure

```
P-M-S/
├── backend/
│   ├── server.js                # app setup: security headers, rate limits, routes, startup
│   ├── seed.js                  # demo data
│   ├── config/                  # env validation, shared constants (branches)
│   ├── middleware/              # JWT auth + role checks, central error handler
│   ├── models/                  # Mongoose schemas (user, student, company, application, event, activity)
│   ├── routes/                  # auth, students, companies, applications, events, admin
│   ├── utils/                   # upload handling, placement-status rules
│   ├── tests/                   # unit tests (npm test)
│   └── uploads/                 # resume PDFs (git-ignored, never served statically)
├── frontend/
│   ├── index.html · login.html · student-dashboard.html · admin-dashboard.html · 404.html
│   ├── css/                     # common, home, login, student-dashboard, admin-dashboard
│   ├── js/                      # utils (shared helpers), home, login, student-dashboard, admin-dashboard
│   └── assets/                  # logo and icons
├── docs/                        # architecture, database, API, user manual, deployment, screenshots
├── AUDIT.md                     # security/quality audit and fix log
└── README.md
```

## API overview

All endpoints are under `/api`. Authenticated endpoints expect `Authorization: Bearer <token>`. Full request/response details are in [`docs/API.md`](docs/API.md).

| Area | Endpoints |
|---|---|
| **Auth** | `POST /auth/register` · `POST /auth/login` · `GET /auth/me` |
| **Student profile** *(student)* | `GET/PUT /students/me` · `POST /students/me/resume` · `GET /students/me/resume/file` · `GET /students/me/notifications` · `PUT /students/me/notifications/read` · `POST /students/me/events` · `DELETE /students/me/events/:id` |
| **Companies** | `GET /companies` · `GET /companies/:id` · *(admin)* `POST` · `PUT /:id` · `DELETE /:id` · `POST /:id/notes` |
| **Applications** | *(student)* `GET /applications/my` · `POST /applications` · *(admin)* `PUT /applications/:id/status` |
| **Events** | `GET /events` · *(admin)* `POST` · `PUT /:id` · `DELETE /:id` |
| **Admin** | `GET /admin/stats` · `GET /admin/activities` · `GET /admin/students` · `PUT /admin/students/:id/status` · `GET /admin/students/:id/resume` · `GET /admin/resumes` · `PUT /admin/resumes/:id/approve` · `PUT /admin/resumes/:id/reject` · `GET /admin/applications` |
| **Health** | `GET /health` |

## Security

Security was audited and hardened as part of this project; the full list with evidence is in [`AUDIT.md`](AUDIT.md).

- **XSS**: all user- and admin-entered text is escaped before rendering; no user text is placed in inline JavaScript.
- **Uploads**: files are saved under random names with a fixed `.pdf` extension, the real `%PDF-` header is verified, size is capped at 5 MB, and rejected files never touch the disk.
- **Private resumes**: PDFs are **not** served statically. Students can fetch only their own file; admins can fetch any — both through authenticated routes.
- **Headers**: `helmet` with a Content-Security-Policy, `nosniff`, HSTS, no `X-Powered-By`.
- **Rate limiting**: 10 failed logins per 15 minutes per IP, limited registrations, general API cap.
- **Auth**: bcrypt-hashed passwords, signed JWTs, role checks on every protected route, registration always creates a *student*.
- **Errors**: a central handler returns clean messages; database internals and stack traces are never sent to clients.
- **Config**: the server refuses to start without `JWT_SECRET` / `MONGODB_URI`; secrets live only in the git-ignored `.env`.
- **Authorization details**: students never receive admin-only company notes, and can only open companies that are active and match their branch.

**Known trade-off:** the login token is kept in `localStorage` (simple, but readable by any script that runs on the page — which is why XSS protection matters here). A hardened deployment would move it to an `httpOnly` cookie with CSRF protection.

## Testing

```bash
cd backend
npm test
```
Runs 25 unit tests with Node's built-in runner: placement-status rules, upload helpers (real-PDF detection, path-traversal safety), the central error handler, and the frontend XSS-escaping helper.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `querySrv ECONNREFUSED …mongodb.net` | Your network refuses DNS SRV lookups from Node. Add `DNS_SERVERS=8.8.8.8,1.1.1.1` to `backend/.env`. |
| Connection **timeout** to Atlas | Add your current IP under Atlas → *Network Access* (home IPs change). Some campus Wi-Fi blocks MongoDB — try a phone hotspot. |
| `bad auth` / authentication failed | Wrong database username/password. URL-encode special characters in the password. |
| Data shows up in a database called `test` | The URI is missing the database name — use `…mongodb.net/pms?retryWrites=true&w=majority`. |
| "Missing required environment variable(s)" | Copy `backend/.env.example` to `backend/.env` and fill in `MONGODB_URI` and `JWT_SECRET`. |
| "Too many failed login attempts" | The login limiter allows 10 failures per 15 minutes per IP. Wait, or restart the server in development. |
| Cannot apply to a company | You need skills on your profile and a resume **approved by the admin**; the company must be active and open to your branch. |
| Everyone got logged out after changing `JWT_SECRET` | Expected — old tokens are no longer valid. Log in again. |

## Known limitations & roadmap

- Resume files are stored on the **server's local disk** (`backend/uploads`). Hosts with an ephemeral filesystem will lose them on restart — see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for options (e.g. MongoDB GridFS or S3-compatible storage).
- Branches (MCA, MBA) are a fixed list in the code; the frontend dropdowns are still hard-coded.
- The login token lives in `localStorage` (see [Security](#security)).
- The hero statistics on the home page (500+ placed, 50+ companies, 12 LPA) are placeholder numbers.
- Test coverage covers core logic only; HTTP-level and browser tests are planned.

**Planned ideas:** automatic profile fill-in from an uploaded resume, job recommendations based on skills, cloud resume storage, per-student application notes, e-mail notifications.

## Documentation

| Document | What's inside |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System diagram, request flow, authentication and resume workflows, placement-status state machine |
| [`docs/DATABASE.md`](docs/DATABASE.md) | ER diagram, every collection and field, indexes |
| [`docs/API.md`](docs/API.md) | Complete API reference with examples |
| [`docs/USER_MANUAL.md`](docs/USER_MANUAL.md) | Step-by-step guides for students and the placement cell, with screenshots |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Production checklist and hosting notes |
| [`AUDIT.md`](AUDIT.md) | Security & quality audit, fixes applied and verification notes |

## License

Released under the [MIT License](LICENSE).

## Acknowledgements

Developed for **Dr. B.V. Hiray College of Management & Research Center, Malegaon (Nashik)** — *Virtues · Vision · Knowledge*.
