# Deployment

The app is one Node.js process (API and static frontend) plus a MongoDB database, so it runs on any host that runs Node.js. Resume PDFs are stored in MongoDB (GridFS), so the host needs **no persistent disk**: a restart or redeploy loses nothing.

> Hosting providers change their plans, limits and screens often. Treat the provider-specific steps below as a starting point and check the provider's current documentation and free-tier terms.

## Production checklist

- [ ] **Node.js 20.19 or newer** (an LTS release; CI runs on 22 and 24).
- [ ] **MongoDB Atlas** cluster, with the connection string in `MONGODB_URI` and the database name included (for example `/pms`).
- [ ] **`NODE_ENV=production`**
- [ ] **`JWT_SECRET`** of 32 or more random characters (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`). In production the server refuses weak secrets.
- [ ] **`SMTP_USER`, `SMTP_PASS` and `APP_URL`.** The verification and reset e-mails need a mail account (for a Gmail account: 2-Step Verification on, then an app password as `SMTP_PASS`) and the public address of the site (for example `https://pms.onrender.com`) for the links. In production the server refuses to start without them, because printing the links in the logs would let anyone who can read the logs use them. Gmail has a daily sending limit; for a busy site use a mail provider and set `SMTP_HOST`, `SMTP_PORT` and `MAIL_FROM`.
- [ ] **`TRUST_PROXY=1`** when running behind a platform proxy, so the rate limiter sees real client addresses.
- [ ] **Create the admin** from your own machine with `npm run create-admin` (it asks for the e-mail and a password (masked as you type), and works against the database in `MONGODB_URI`). Do not run `npm run seed` on a production database: it clears the data and adds demo students with known passwords.
- [ ] **HTTPS.** Every major platform provides it. The app already sends HSTS and the CSP headers.
- [ ] **Atlas Network Access:** allow your host's outbound addresses. Platforms with changing addresses usually need `0.0.0.0/0`; if you do that, use a long random database password and a database user with only the permissions the app needs.
- [ ] Keep `.env` out of git. Set the variables in the host's dashboard.

## Storage and size

- **Resumes** are stored in the `resumes` GridFS bucket of the same database. The upload limit is 5 MB, and a student has one resume at a time (a new upload replaces the old one).
- Atlas **M0 (free)** holds 512 MB, which is thousands of ordinary resumes plus all other data. If it ever fills up, upgrade the cluster or move the file helpers in [`backend/utils/fileUpload.js`](../backend/utils/fileUpload.js) to object storage; only that file and the two download routes touch the stored files.
- Atlas free clusters pause after a long period without activity. Resume them from the Atlas dashboard if the app reports that the database is unreachable.

## Live demo (optional)

The GitHub repository is the deliverable. A live demo is optional and needs an account on a hosting provider; the college does not host it. Any Node host with a free tier works. Example with **Render**:

1. Push the repository to GitHub.
2. In Render, create a **Web Service** from the repository.
3. Settings:
   - **Build command:** `cd backend && npm install`
   - **Start command:** `cd backend && npm start`
   - **Health check path:** `/api/health`
4. **Environment variables:** `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `TRUST_PROXY=1`, `SMTP_USER`, `SMTP_PASS`, `APP_URL`. Add `DNS_SERVERS` only if connecting to Atlas fails with `querySrv ECONNREFUSED`.
5. In Atlas, allow access from the service (see the checklist).
6. From your own machine, create the admin once against the production database: put `MONGODB_URI` in `backend/.env` (or your shell) and run `npm run create-admin`.
7. Open the service URL, log in as admin, and check that `/api/health` returns `{"status":"ok","database":"connected", ...}`.

Free web services on some platforms sleep when idle, so the first request after a pause can take a while.

## Running on your own server

```bash
git clone <repo> && cd P-M-S/backend
npm ci --omit=dev
# create .env with MONGODB_URI, JWT_SECRET, NODE_ENV=production, PORT, SMTP_USER, SMTP_PASS, APP_URL
node server.js
```

Keep it running with a process manager (for example `pm2 start server.js --name pms`) and put a reverse proxy such as nginx in front for HTTPS; set `TRUST_PROXY=1` in that case.

## Operations

- **Health:** `GET /api/health` (HTTP 503 while the database is unreachable).
- **Logs:** errors are logged on the server with the request method and URL. Clients only ever see short messages.
- **Shutdown:** `SIGINT` and `SIGTERM` stop accepting requests, close the database connection and exit.
- **Backups:** use Atlas backups or `mongodump`. Resumes are in the database, so one backup covers everything.
- **Dependencies:** `npm audit` runs in CI for production dependencies. `unpdf` is pinned to 1.9.1 because later major versions need Node 24 or newer; revisit that when the minimum Node version is raised.
- **Pages need the internet:** the browser loads Bootstrap, Chart.js, Font Awesome and Google Fonts from CDNs.
