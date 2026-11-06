# User manual

This guide walks through the portal from two points of view: the **student** and the **placement cell (admin)**. Screenshots use demo data.

- [Getting an account](#getting-an-account)
- [Student guide](#student-guide)
- [Placement cell (admin) guide](#placement-cell-admin-guide)
- [Using the portal on a phone](#using-the-portal-on-a-phone)
- [FAQ](#faq)

---

## Getting an account

**Students** register themselves. **Admins** (placement officers) are created by whoever sets up the system (the seed script creates `admin@pms.com`).

1. Open the portal's home page and click **Login / Signup**.
2. Click **Register** on the red panel and fill in your name, e-mail, a password (at least 6 characters), confirm it, and choose your **branch** (MCA or MBA).
3. After registering you are taken back to the login form — log in with the same e-mail and password.

![Register](screenshots/register-desktop.png)

> Your branch decides which companies you can see and apply to, and it cannot be changed later.

Admins use the **Admin Login** button on the home page (it only accepts admin accounts).

---

## Student guide

After logging in you land on your **Dashboard**. The sidebar gives access to every section.

![Student dashboard](screenshots/student-dashboard.png)

### Dashboard
- **Placement Status** — where you are right now (*Unplaced → Under Review → Interview Scheduled → Placed*) with a progress bar.
- **Applications** — how many you have sent and how many are pending, accepted or rejected.
- **Profile Completion** — a checklist of what is still missing.
- **Recent Applications** and **Upcoming Events** at a glance.

### 1. Complete your profile
Open **Profile**, fill in your **Skills** (comma-separated), **Education** and **Projects**, then press **Save Profile**. Your name can be edited; e-mail and course are read-only.

> **Skills are required** before you can apply to any company.

### 2. Upload your resume
Open **Resume**, choose a **PDF** (maximum **5 MB**) and press **Upload**.

![Resume page](screenshots/student-resume.png)

- The resume is marked **"pending approval"** until the placement cell reviews it.
- You can **view** your own resume at any time, and uploading a new one replaces the old one (and asks for approval again).
- You will get a **notification** when it is approved or rejected.

### 3. Find and apply to companies
Open **Companies**. You only see companies that are open to *your* branch. Use the search box and the job-type filter, press **View Details** for the full description, and **Apply** to send your application.

![Companies](screenshots/student-companies.png)

You can apply when **all** of these are true:
- your profile has skills,
- your resume is uploaded **and approved**,
- the company is open to your branch and is still accepting applications,
- you have not applied to it before.

If something is missing, the portal tells you exactly what.

### 4. Follow your progress
- **Status** shows a timeline of your placement-status changes.
- **Dashboard → Recent Applications** shows each application as *Pending*, *Accepted* or *Rejected*.
- **Notifications** lists every update from the placement cell (newest first).

### 5. Events and your calendar
Open **Calendar** to see placement drives, workshops and mock interviews. Press **Add to Calendar** on an upcoming event to keep it in your personal list, or the **ⓘ** button for the details.

![Calendar](screenshots/student-calendar.png)

### Logging out
Press **Logout** at the bottom of the sidebar. If you are inactive for more than 24 hours you will be asked to log in again.

---

## Placement cell (admin) guide

### Dashboard
Shows the placement-status **doughnut chart**, the **course-wise** student count, and the latest **activities** (applications, uploads, status changes, new events and companies).

![Admin dashboard](screenshots/admin-dashboard.png)

### Companies
Open **Companies** to add, view, edit or delete companies.

![Admin companies](screenshots/admin-companies.png)

- **Add New Company** — name, description, location, job type, **eligible branches** (tick at least one), requirements and package.
- **Edit** loads a company into the same form; **View Details** shows its stats; **Delete** removes the company *and its applications* (you are asked to confirm).
- Search and filter by job type or branch, and sort by newest, oldest or name.
- The **Applications** list below shows every application — press **Accept** or **Reject** on pending ones. The student's placement status and notifications update automatically.

### Students
Open **Students** to search the directory and filter by course or status. Use the dropdown on a student's card to set their placement status manually (for example *Interview Scheduled*); the student is notified.

![Admin students](screenshots/admin-students.png)

### Resumes
Open **Resumes** to review uploads: the **eye** button opens the PDF in a new tab, the **✓** button approves it and the **✗** button rejects it (the student is asked to upload a new one). Students can only apply after approval.

![Admin resumes](screenshots/admin-resumes.png)

### Calendar
Create events with a title, date/time and description. **Every student is notified** when an event is created, changed or cancelled.

![Admin calendar](screenshots/admin-calendar.png)

### Exporting data
**Export Data** (top right) downloads a CSV of all students: name, e-mail, course, status, skills, education and projects.

---

## Using the portal on a phone

On screens narrower than 993 px the sidebar becomes a menu: tap the **☰** button in the top bar to open it, tap an item (or outside the menu, or press **Esc**) to close it.

<p>
  <img src="screenshots/mobile-student.png" alt="Mobile dashboard" width="30%">
  <img src="screenshots/mobile-student-menu.png" alt="Mobile menu" width="30%">
  <img src="screenshots/mobile-admin.png" alt="Mobile admin" width="30%">
</p>

---

## FAQ

**I can't press Apply / I get a message about my resume.** Your resume must be uploaded *and* approved by the placement cell, and your profile needs skills.

**Why don't I see a particular company?** Companies are shown only if they are active and open to your branch.

**I forgot my password.** There is no self-service reset yet; ask the placement cell to help.

**"Too many failed login attempts."** After 10 wrong passwords from the same network the login is paused for 15 minutes.

**My session suddenly ended.** Sessions last 24 hours; after that (or if the server was reconfigured) you simply log in again.
