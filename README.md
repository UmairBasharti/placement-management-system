# Placement Management System

## Prerequisites
- Node.js v16+
- MongoDB running locally on port 27017

## Setup & Run

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Seed the database (first time only)
```bash
cd backend
node seed.js
```
This creates:
- Admin:   admin@pms.com   / admin123
- Student: rahul@pms.com   / student123  (MCA)
- Student: priya@pms.com   / student123  (MBA)
- 3 sample companies

### 3. Start the backend
```bash
cd backend
npm run dev       # development (nodemon)
# or
npm start         # production
```

### 4. Open the frontend
Open your browser to: http://localhost:5000/login.html

The backend serves the HTML files automatically via express.static.

## API Endpoints

### Auth
| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/auth/register | Register new student |
| POST | /api/auth/login | Login (returns JWT) |
| GET  | /api/auth/me | Get current user |

### Students (requires JWT, role: student)
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/students/me | Get own profile |
| PUT | /api/students/me | Update profile |
| POST | /api/students/me/resume | Upload PDF resume |
| GET | /api/students/me/notifications | Get notifications |
| POST | /api/students/me/events | Add event to calendar |
| DELETE | /api/students/me/events/:id | Remove from calendar |

### Companies (requires JWT)
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/companies | List companies (branch-filtered for students) |
| GET | /api/companies/:id | Get single company |
| POST | /api/companies | Add company (admin only) |
| PUT | /api/companies/:id | Update company (admin only) |
| DELETE | /api/companies/:id | Delete company (admin only) |

### Applications (requires JWT)
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/applications/my | Student's own applications |
| POST | /api/applications | Apply to a company |
| PUT | /api/applications/:id/status | Update status (admin only) |

### Events (requires JWT)
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/events | List all events |
| POST | /api/events | Create event (admin only) |
| PUT | /api/events/:id | Update event (admin only) |
| DELETE | /api/events/:id | Delete event (admin only) |

### Admin (requires JWT, role: admin)
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/admin/stats | Dashboard stats + chart data |
| GET | /api/admin/activities | Recent activity log |
| GET | /api/admin/students | All students |
| PUT | /api/admin/students/:id/status | Update student placement status |
| GET | /api/admin/resumes | Students with uploaded resumes |
| PUT | /api/admin/resumes/:id/approve | Approve resume |
| PUT | /api/admin/resumes/:id/reject | Reject resume |
| GET | /api/admin/applications | All applications |
