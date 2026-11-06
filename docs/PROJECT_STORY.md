# Project story

Why I built this, the decisions behind it, what went wrong along the way, and what I took from it.

## The problem

A college placement cell has three jobs: collect students' resumes, match students to companies, and keep track of who applied where and what happened. That work is often done with spreadsheets, e-mail and chat groups. Resumes get lost in message threads, nobody has one place to see a student's status, and a student cannot tell whether their application was seen.

The Placement Management System puts that in one portal. Students keep a profile and a resume and apply to companies. The placement cell reviews resumes, manages companies and applications, and sees every student's status at a glance. It started as a semester project for Dr. B.V. Hiray College of Management & Research Center, Malegaon (Nashik).

## What I built

- A **student side**: registration, profile, resume upload, a scan that fills the profile from the resume, job recommendations ranked by skill match, applications with status tracking, notifications and an events calendar.
- A **placement-cell side**: dashboard with charts, company management with required skills and private notes, the best-matching students for each job, resume approval, application decisions, student directory with CSV export, events.
- A **REST API** (Express and MongoDB) with login, roles, validation, rate limiting and a central error handler.
- **Automated checks**: 52 unit tests, ESLint, and a GitHub Actions workflow.

Screenshots are in the [README](../README.md#screenshots). The design is explained in [`ARCHITECTURE.md`](ARCHITECTURE.md) and the API in [`API.md`](API.md).

## The flow in one minute

1. A student registers, fills in skills and uploads a PDF resume.
2. The portal can read the PDF and suggest skills, education and projects. The student keeps what is right.
3. The placement cell opens the resume and approves it. Only then can the student apply.
4. The student sees jobs ranked by how many of the required skills they already have, and applies.
5. The placement cell accepts or rejects. The student's placement status and notifications update on their own.

## Decisions and why

| Decision | Why |
|---|---|
| Keep Express, MongoDB and plain JavaScript instead of rewriting in React or Next.js | The goal was a working, understandable project. A rewrite would have replaced working code and taken weeks, and plain JavaScript keeps every moving part visible. |
| MongoDB Atlas (free tier) | No local database to maintain, and it works the same on any machine. |
| Resumes in MongoDB (GridFS) instead of the server's disk or a cloud bucket | Most hosts wipe the disk on every deploy. GridFS uses the database I already had: no new account, no extra cost, one backup. |
| Read resumes with rules instead of a paid AI service | It costs nothing, nothing leaves the server, and the result is predictable and testable. The trade-off is a smaller vocabulary (about 190 skills) and no support for scanned PDFs. |
| Match score = share of the job's required skills the student already has | Easy to explain to a student and to a placement officer, and easy to test. |
| An admin must approve a resume before a student can apply | The placement cell stays in control of what companies see. |
| Removing a company archives it | Deleting would silently destroy students' application history. |
| One origin: Express serves the pages and the API | No CORS set-up, one command to start, and a strict Content-Security-Policy. |

## Difficulties and how I solved them

**1. The database would not connect.** Atlas answered in the browser, but Node failed with `querySrv ECONNREFUSED`. The password and IP allow-list were fine. Windows could resolve the cluster name, but my network's DNS refused the SRV lookups Node makes. I added an optional `DNS_SERVERS` setting and documented it. A second trap: without the database name in the connection string, data lands in a database called `test`.

**2. A script could run through a student's name.** When I reviewed the code I put `<img src=x onerror=...>` into every text field. It ran on the admin's page. Because the login token sits in `localStorage`, a student could have stolen the admin's session. The fix had three parts: escape every value before it reaches the page, replace inline `onclick` attributes with one delegated listener, and add a Content-Security-Policy that forbids inline scripts.

**3. Resume upload was the riskiest feature.** The first version accepted any file type, kept the client's file extension, and served files from a public folder. An `.html` file posing as a PDF could have run on the site's own address. Now the real `%PDF-` header is checked, the size is capped, the file name is cleaned, and resumes are only served through authenticated routes. Moving them into GridFS also solved the problem of hosts that erase the disk.

**4. The layout broke in ways the code did not hint at.** The dashboards were 280 px too wide at desktop sizes because Bootstrap columns and a fixed sidebar fought each other. On phones, the login buttons were off the screen: the navbar's `backdrop-filter` quietly became the reference box for a `position: fixed` menu. A fixed footer covered the Login button on short phones. I only found these by measuring `scrollWidth` in a real browser at five widths, not by reading the CSS.

**5. The business rules had edge cases.** Applying to a company reset a student who was already *Placed* back to *Under Review*, and rejecting one application could un-place someone accepted elsewhere. I moved the rules into small pure functions ([`placementStatus.js`](../backend/utils/placementStatus.js)) and wrote unit tests for each case.

**6. Reading a resume without paying for AI.** I needed text out of PDFs and a way to find skills in it. Short names like "C", "R" and "Go" match ordinary words, so they only count when they appear as a separate item in a Skills section. Scanned PDFs have no text, so the app says so instead of guessing. I pinned the PDF library to a version that supports the Node versions I target.

**7. My own tests misled me.** A test showed that updating one profile field wiped the fields I had not sent, which was a real bug. Later, tests failed only on a slow evening because the CDNs were slow and my test waited a fixed time. I changed them to wait for a condition ("the spinner is gone"), not for a number of seconds. I ran everything against a separate throwaway database so the real data was never at risk.

**8. Screenshots found bugs the tests missed.** Retaking the documentation screenshots showed a "Profile" button wrapping into "Profi / le" and phone labels breaking mid-word. Looking at the result is part of testing.

## What I learned

- **Security is mostly small habits applied everywhere:** escape output, never trust the file type or the client, check the role on every route, keep secrets out of git, and add a second layer (the CSP) in case the first one misses something.
- **Model data around how it is read.** Notifications live inside the student because they are always read with the student. Applications are their own collection because the admin queries them across students and companies. Copies of data (names in an application) are sometimes better than references. Archiving beats deleting.
- **Put rules in pure functions.** The placement-status rules, the matcher and the resume parser are easy to test because they do not touch the database or the network.
- **Plain JavaScript scales further than I expected** when each page has one state object, one delegated click handler and a few shared helpers. It also showed me what frameworks are for.
- **Test the real thing.** A real browser, a real database (a separate one), and waiting for conditions instead of time found problems that reading code did not.
- **Review first, then fix in small steps.** I wrote every problem down, grouped them, and fixed them one commit at a time. The history reads like a log of decisions.
- **Write the documentation from the code.** Several statements in my first README were out of date by the end. Checking each claim against the code caught them.

## Where to look in the code

| If you want to see... | Look at |
|---|---|
| Login, roles and route protection | [`backend/routes/auth.routes.js`](../backend/routes/auth.routes.js), [`backend/middleware/auth.middleware.js`](../backend/middleware/auth.middleware.js) |
| Error handling that never leaks internals | [`backend/middleware/error.middleware.js`](../backend/middleware/error.middleware.js) |
| Business rules with tests | [`backend/utils/placementStatus.js`](../backend/utils/placementStatus.js), [`backend/tests/placementStatus.test.js`](../backend/tests/placementStatus.test.js) |
| Skill matching and resume reading | [`backend/utils/matcher.js`](../backend/utils/matcher.js), [`backend/utils/resumeParser.js`](../backend/utils/resumeParser.js), [`backend/data/skills.js`](../backend/data/skills.js) |
| Safe file upload and GridFS storage | [`backend/utils/fileUpload.js`](../backend/utils/fileUpload.js) |
| Shared frontend runtime (API client, navigation, session) | [`frontend/js/dashboard.js`](../frontend/js/dashboard.js), [`frontend/js/utils.js`](../frontend/js/utils.js) |
| Responsive layout | [`frontend/css/dashboard.css`](../frontend/css/dashboard.css) |
| Lint, tests and dependency audit in CI | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) |

## What I would do next

- Pagination for the long lists, and database transactions for the status changes.
- E-mail notifications and a password-reset flow.
- Browser-based end-to-end tests in the repository (they were run by hand during development).
- Move the login token from `localStorage` to an `httpOnly` cookie with CSRF protection.
- A larger skill dictionary, or a pluggable matcher, so more kinds of resumes are understood.
