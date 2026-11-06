# API reference

Base URL when running locally: `http://localhost:5000/api`

## Conventions

**Authentication.** After logging in, send the token with every protected request:

```
Authorization: Bearer <token>
```

**Response shape.** Every JSON response has a `success` boolean. Successful responses add `data` and/or `message`; errors add `message`, and validation errors also add an `errors` array.

```json
{ "success": true,  "data": { } }
{ "success": false, "message": "Description is required" }
```

**Status codes**

| Code | Meaning |
|---|---|
| 200, 201 | Success, created |
| 400 | Validation error, invalid id, malformed JSON, or a business rule failed (the message says which) |
| 401 | Missing, invalid or expired token, or wrong login |
| 403 | Logged in but not allowed (wrong role, or the job is not open to the student's course) |
| 404 | Record or API route not found |
| 409 | Duplicate value (for example an e-mail that is already registered) |
| 413 | Request body too large |
| 422 | A resume PDF could not be read (resume suggestions only) |
| 429 | Rate limit exceeded |
| 500 | Unexpected server error (details are in the server log only) |

**Rate limits, per IP address.** General API: 600 requests per 15 minutes. Login: 10 *failed* attempts per 15 minutes (successful logins are not counted). Registration: 20 per hour. Responses carry the standard `RateLimit-*` headers.

**Ids.** MongoDB ObjectIds (24 hex characters). An invalid id returns `400 { "message": "Invalid id" }`.

**Access.** *Public* needs no login. *Any user* needs a valid token. *Student* and *Admin* need that role.

---

## Public and health

| Access | Endpoint | Description |
|---|---|---|
| Public | `GET /health` | `{ "status": "ok", "database": "connected", "uptime": 123 }`. HTTP 503 with `"degraded"` while the database is unreachable. |
| Public | `GET /public/stats` | `{ "data": { "students": 8, "companies": 6, "placed": 1 } }`. Counts only, cached for 60 seconds. Used by the home page. |
| Public | `GET /public/meta` | `{ "data": { "branches": ["MCA","MBA"], "jobTypes": ["Full Time","Part Time","Internship"] } }`. Option lists for every form, cached for 5 minutes. |

## Auth

| Access | Endpoint | Description |
|---|---|---|
| Public | `POST /auth/register` | Body `{ name, email, password, branch }`. Password at least 6 characters; `branch` must be one of the courses from `/public/meta`. Always creates a student. Returns `201`; the user then logs in. |
| Public | `POST /auth/login` | Body `{ email, password }`. Returns `{ token, user: { id, name, email, role } }`. The token lasts `JWT_EXPIRE` (24 h by default). |
| Any user | `GET /auth/me` | The current user: `{ id, name, email, role, branch }`. |

## Student profile and resume

All endpoints in this section are **student only**.

| Endpoint | Description |
|---|---|
| `GET /students/me` | Profile: `id, name, email, course, skills, education, projects, status, resume, notifications, events, statusHistory`. |
| `PUT /students/me` | Body with any of `name`, `skills` (max 500 characters), `education` (1500), `projects` (2500). Only the fields that are sent are changed; an empty string clears a field. |
| `POST /students/me/resume` | `multipart/form-data` with one field `resume` (PDF, up to 5 MB). Replaces the previous resume and resets its status to `pending`. The type is checked by MIME type and by the real `%PDF-` header. |
| `GET /students/me/resume/file` | Streams the student's own PDF. |
| `GET /students/me/resume/suggestions` | Reads the stored PDF and returns `{ skills: [..], education, projects, textFound }`. Nothing is saved; the client applies the suggestions it wants with `PUT /students/me`. Returns `422` if the PDF cannot be read, `400` if no resume is uploaded. |
| `GET /students/me/notifications` | The student's notifications, oldest first (the newest 100 are kept). |
| `PUT /students/me/notifications/read` | Marks all notifications as read. |
| `POST /students/me/events` | Body `{ eventId }`. Copies an event into the personal calendar; the title and date come from the stored event. `400` if it is already there. |
| `DELETE /students/me/events/:eventId` | Removes an event from the personal calendar. |

`resume` looks like `{ name, fileId, uploadedAt, status }` with `status` one of `pending`, `approved`, `rejected`. Without an upload, `name` and `fileId` are `null`.

## Companies

| Access | Endpoint | Description |
|---|---|---|
| Any user | `GET /companies` | Active companies, newest first. Students only get companies open to their course, and never the admin notes. |
| Student | `GET /companies/recommended?limit=6` | Jobs ranked by skill match: `{ data: [{ company, matchScore, matchedSkills, missingSkills }], meta: { hasSkills } }`. `limit` is 1 to 50. Excludes jobs already applied to. |
| Any user | `GET /companies/:id` | One company. Students only get an active company open to their course; admins get any company plus `stats: { total, accepted, pending, rejected }`. |
| Admin | `POST /companies` | Body `{ name, description, location, jobType, branches, requirements, package, requiredSkills }`. `branches` is an array with at least one course. `requiredSkills` is an array or comma-separated text; known skills are normalised (`nodejs` becomes `Node.js`), at most 20. |
| Admin | `PUT /companies/:id` | Any of the same fields plus `status` (`active` or `inactive`). Only the fields that are sent change. |
| Admin | `DELETE /companies/:id` | Archives the company (`status: inactive`). It disappears from the lists, and existing applications are kept. |
| Admin | `POST /companies/:id/notes` | Body `{ text }` (up to 500 characters). Internal note, never shown to students. |

## Applications

| Access | Endpoint | Description |
|---|---|---|
| Student | `GET /applications/my` | The student's applications with company name, location, job type and package. |
| Student | `POST /applications` | Body `{ companyId }`. See the rules below. Returns `201`. |
| Admin | `PUT /applications/:id/status` | Body `{ status }` with `Accepted`, `Rejected` or `Pending`. Updates the student's placement status and notifies them. |

A student can apply only when all of these hold:

| Rule | Response |
|---|---|
| The company exists and is `active` | 404 or 400 |
| The company is open to the student's course | 403 |
| A resume is uploaded | 400 |
| The resume is `approved` (a `pending` or `rejected` one gives a different message) | 400 |
| The profile has skills | 400 |
| The student has not applied to this company before | 400 |

## Events

| Access | Endpoint | Description |
|---|---|---|
| Any user | `GET /events` | All events, soonest first. |
| Admin | `POST /events` | Body `{ title, description, date }`. `date` looks like `2026-11-20T10:00`. Notifies every student. |
| Admin | `PUT /events/:id` | Updates the event, refreshes the copies in students' calendars and notifies every student. |
| Admin | `DELETE /events/:id` | Deletes the event, removes it from students' calendars and notifies every student. |

## Admin

All endpoints in this section are **admin only**.

| Endpoint | Description |
|---|---|
| `GET /admin/stats` | `{ totalStudents, placedStudents, totalCompanies, totalApplications, statusBreakdown: [{ _id, count }], branchBreakdown: [{ _id, count }] }`. |
| `GET /admin/activities` | The 10 latest activity entries. Entries are removed after 90 days. |
| `GET /admin/students` | Every student with account and profile data and the status timeline. |
| `PUT /admin/students/:id/status` | Body `{ status }` with `Unplaced`, `Under Review`, `Interview Scheduled` or `Placed`. `:id` is the student id. |
| `GET /admin/resumes` | Students who uploaded a resume: `{ id, name, email, course, resume }`. |
| `GET /admin/students/:id/resume` | Streams that student's PDF. |
| `PUT /admin/resumes/:id/approve` | Approves the resume and notifies the student. `:id` is the student id. |
| `PUT /admin/resumes/:id/reject` | Rejects the resume; the student is asked to upload a new one. |
| `GET /admin/companies/:id/matches` | Students from the eligible courses ranked by how well their skills fit the job: `{ studentId, name, email, course, status, resumeStatus, matchScore, matchedSkills, missingSkills }`. |
| `GET /admin/applications` | Every application with company details. |

## Example session

```bash
# 1. log in
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"rahul@pms.com","password":"student123"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).token")

# 2. jobs ranked for this student
curl -s http://localhost:5000/api/companies/recommended -H "Authorization: Bearer $TOKEN"

# 3. upload a resume (an admin must approve it before the student can apply)
curl -s -X POST http://localhost:5000/api/students/me/resume \
  -H "Authorization: Bearer $TOKEN" -F "resume=@my-resume.pdf;type=application/pdf"

# 4. see what the scan found in it
curl -s http://localhost:5000/api/students/me/resume/suggestions -H "Authorization: Bearer $TOKEN"

# 5. apply (needs skills and an approved resume)
curl -s -X POST http://localhost:5000/api/applications \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"companyId":"<company id from step 2>"}'
```
