# API reference

Base URL (local): `http://localhost:5000/api`

## Conventions

**Authentication** — after logging in, send the token on every protected request:
```
Authorization: Bearer <token>
```

**Response shape** — every JSON response contains `success` (boolean). Successful responses add `data` and/or `message`; errors add `message` (and, for validation failures, an `errors` array).
```json
{ "success": true,  "data": { } }
{ "success": false, "message": "Description is required" }
```

**Status codes**

| Code | Meaning |
|---|---|
| 200 / 201 | Success / created |
| 400 | Validation error, bad id, malformed JSON, or a business rule failed (message explains which) |
| 401 | Missing, invalid or expired token (or wrong login credentials) |
| 403 | Authenticated but not allowed (wrong role, or branch not eligible) |
| 404 | Resource or API route not found |
| 409 | Duplicate value |
| 413 | Request body too large |
| 429 | Rate limit exceeded |
| 500 | Unexpected server error (details are logged server-side only) |

**Rate limits (per IP)** — general API: 600 requests / 15 min · login: 10 *failed* attempts / 15 min (successful logins are not counted) · registration: 20 / hour. Responses include standard `RateLimit-*` headers.

**Ids** — MongoDB ObjectIds (24 hex characters). An invalid id returns `400 { "message": "Invalid id" }`.

Legend: 🔓 public · 🔑 any logged-in user · 🎓 student only · 🛡️ admin only

---

## Health
| | Endpoint | Description |
|---|---|---|
| 🔓 | `GET /health` | `{ "status": "ok", "database": "connected", "uptime": 123 }` — HTTP 503 with `"degraded"` if the database is down |

## Auth

### `POST /auth/register` 🔓
Creates a **student** account (admins cannot be created here).
```json
{ "name": "Rahul Sharma", "email": "rahul@pms.com", "password": "student123", "branch": "MCA" }
```
- `branch` must be `MCA` or `MBA`; `password` min 6 characters; email is trimmed and lower-cased.
- `201` → `{ "success": true, "message": "Registration successful! Please log in." }`
- `400` → e.g. `{ "message": "Password must be at least 6 characters", "errors": [...] }`, or `"Email already registered"`.

### `POST /auth/login` 🔓
```json
{ "email": "rahul@pms.com", "password": "student123" }
```
`200` → `{ "success": true, "token": "<jwt>", "user": { "id", "name", "email", "role" } }` · `401` → `"Invalid email or password"`.

### `GET /auth/me` 🔑
`{ "user": { "id", "name", "email", "role", "branch" } }` — handy to verify a stored token.

---

## Student profile (🎓 all endpoints below)

| Endpoint | Description |
|---|---|
| `GET /students/me` | Full profile (see below) |
| `PUT /students/me` | Update `name`, `skills`, `education`, `projects` |
| `POST /students/me/resume` | Upload a PDF (`multipart/form-data`, field **`resume`**) |
| `GET /students/me/resume/file` | Download/stream your own resume PDF |
| `GET /students/me/notifications` | List notifications |
| `PUT /students/me/notifications/read` | Mark all notifications read |
| `POST /students/me/events` | Add an event to your personal calendar — `{ title, date, description }` |
| `DELETE /students/me/events/:eventId` | Remove it |

`GET /students/me` → `data`:
```json
{
  "id": "…", "userId": "…", "name": "Rahul Sharma", "email": "rahul@pms.com", "course": "MCA",
  "skills": "JavaScript, Node.js", "education": "…", "projects": "…",
  "status": "Under Review",
  "resume": { "name": "Resume.pdf", "path": "<stored file name>", "uploadedAt": "…", "approved": false },
  "notifications": [ { "message": "…", "timestamp": "…", "read": false } ],
  "events": [ ], "statusHistory": [ { "status": "Under Review", "message": "Applied to …", "timestamp": "…" } ]
}
```

**Resume upload rules** — PDF only (type is checked, then the file's real `%PDF-` header), max **5 MB**. Errors are `400` with a clear message: `Only PDF files are allowed`, `File too large (maximum 5 MB)`, `The uploaded file is not a valid PDF`, `No file uploaded`. A successful upload resets `approved` to `false` and deletes the previous file.
```bash
curl -X POST http://localhost:5000/api/students/me/resume \
     -H "Authorization: Bearer $TOKEN" -F "resume=@MyResume.pdf;type=application/pdf"
```

---

## Companies

| | Endpoint | Description |
|---|---|---|
| 🔑 | `GET /companies` | **Students:** only *active* companies open to their branch, newest first, without admin notes. **Admins:** all active companies, with notes. |
| 🔑 | `GET /companies/:id` | **Students:** 404 unless the company is active and open to their branch. **Admins:** includes `stats` (`total`, `accepted`, `pending`, `rejected`) and `notes`. |
| 🛡️ | `POST /companies` | Create a company |
| 🛡️ | `PUT /companies/:id` | Update a company |
| 🛡️ | `DELETE /companies/:id` | Delete a company **and its applications** |
| 🛡️ | `POST /companies/:id/notes` | Add an internal note — `{ "text": "…" }` |

Create / update body:
```json
{
  "name": "Tech Solutions Inc.", "description": "…", "location": "Mumbai",
  "jobType": "Full Time", "branches": ["MCA", "MBA"],
  "requirements": "Strong programming skills", "package": "8–12 LPA"
}
```
- `jobType`: `Full Time` · `Part Time` · `Internship`. `branches`: at least one of `MCA` / `MBA` (a single string is accepted too).
- `PUT` only changes these fields: `name, description, location, jobType, requirements, package, status, branches` (anything else is ignored). Send `""` to clear `requirements`/`package`. `status` is `active` or `inactive`.
- Missing required fields or unknown branches → `400` with the first validation message.

---

## Applications

| | Endpoint | Description |
|---|---|---|
| 🎓 | `GET /applications/my` | Your applications (newest first, with company name/location/type/package) |
| 🎓 | `POST /applications` | Apply — `{ "companyId": "…" }` |
| 🛡️ | `PUT /applications/:id/status` | Decide — `{ "status": "Accepted" \| "Rejected" \| "Pending" }` |

**Apply rules** (all enforced server-side): company exists and is `active` · company is open to your branch (`403` otherwise) · you uploaded a resume · the resume is **approved** · your profile has skills · you haven't applied to this company before. Applying moves an *Unplaced* student to *Under Review* and adds a notification.

**Deciding** recomputes the student's placement status from *all* their applications (see [ARCHITECTURE.md](ARCHITECTURE.md#5-placement-status-state-machine)), notifies the student, and logs an activity. Sending the status the application already has is a harmless no-op.

---

## Events

| | Endpoint | Description |
|---|---|---|
| 🔑 | `GET /events` | All events, soonest first |
| 🛡️ | `POST /events` | `{ "title", "date", "description" }` — notifies **all students** |
| 🛡️ | `PUT /events/:id` | Update — notifies all students |
| 🛡️ | `DELETE /events/:id` | Delete — notifies all students |

`date` is the local date-time string from a `datetime-local` input, e.g. `2026-11-20T10:00`.

---

## Admin (🛡️ all endpoints below)

| Endpoint | Description |
|---|---|
| `GET /admin/stats` | `{ totalStudents, placedStudents, totalCompanies, totalApplications, statusBreakdown: [{ _id, count }], branchBreakdown: [{ _id, count }] }` |
| `GET /admin/activities` | The 10 most recent activity entries |
| `GET /admin/students` | All students (profile + user data merged) |
| `PUT /admin/students/:id/status` | `{ "status": "Unplaced" \| "Under Review" \| "Interview Scheduled" \| "Placed" }` — `:id` is the **student** id; notifies the student |
| `GET /admin/students/:id/resume` | Stream the student's resume PDF |
| `GET /admin/resumes` | Students who have uploaded a resume |
| `PUT /admin/resumes/:id/approve` | Approve (notifies the student) |
| `PUT /admin/resumes/:id/reject` | Reject (notifies the student to upload a new one) |
| `GET /admin/applications` | All applications with company details |

---

## Example session

```bash
# 1. log in
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"rahul@pms.com","password":"student123"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).token")

# 2. list companies open to this student's branch
curl -s http://localhost:5000/api/companies -H "Authorization: Bearer $TOKEN"

# 3. apply (needs skills + an approved resume)
curl -s -X POST http://localhost:5000/api/applications \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"companyId":"<company id from step 2>"}'
```
