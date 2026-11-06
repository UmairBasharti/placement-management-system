# Deployment

The app is a single Node.js process (API + static frontend) plus a MongoDB database, so it can run on any host that runs Node.js. This guide lists what must be configured, the main caveat (resume storage), and one concrete example.

> Hosting providers change their plans, limits and screens often. Treat provider-specific steps as a starting point and check the provider's current documentation and free-tier terms.

## Production checklist

- [ ] **Node.js 20.19+** (an LTS release).
- [ ] **MongoDB Atlas** cluster, with the connection string in `MONGODB_URI` (include the database name, e.g. `/pms`).
- [ ] **`NODE_ENV=production`**
- [ ] **`JWT_SECRET`** — 32+ random characters (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`). In production the server refuses weak secrets.
- [ ] **`TRUST_PROXY=1`** when running behind a platform proxy, so the rate limiter sees real client IPs.
- [ ] **Seed the admin** with your own password: run `ADMIN_SEED_PASSWORD='…' npm run seed` once (the seed refuses the demo password in production). Change or remove the demo students afterwards.
- [ ] **HTTPS** (every major platform provides it). HSTS and the CSP headers are already sent by the app.
- [ ] **Atlas Network Access**: allow your host's outbound IPs. Platforms with changing IPs usually need `0.0.0.0/0` — if you do that, use a long random database password and a least-privilege database user.
- [ ] Decide how to handle **resume storage** (next section).
- [ ] Never commit `.env`; set variables in the host's dashboard.

## Resume storage — the important caveat

Resumes are saved to the **local disk** (`backend/uploads/`). Many platforms (including most free tiers) use an *ephemeral* filesystem that is wiped on every deploy or restart, which would delete every uploaded resume while the database still points to them.

Options, from least to most work:

| Option | Notes |
|---|---|
| Accept it for a short demo | Fine for a presentation; uploaded resumes disappear on restart. |
| Host with a **persistent disk/volume** | No code change; usually a paid feature and tied to a single instance. |
| **MongoDB GridFS** | Stores files in the database you already have; no new account. Atlas free clusters are small (~512 MB), enough for thousands of ordinary resumes. |
| **S3-compatible object storage** (AWS S3, Cloudflare R2, Supabase Storage…) | Standard approach; keep the bucket **private** and stream files through the existing authenticated routes. |

The upload code is isolated in [`backend/utils/fileUpload.js`](../backend/utils/fileUpload.js) and the two download routes, so swapping the storage backend touches very little code. The routes already enforce the privacy rules (no public URLs).

## Example: Render (Node web service)

1. Push the repository to GitHub.
2. In Render, create a **Web Service** from the repository.
3. Settings:
   - **Build command:** `cd backend && npm install`
   - **Start command:** `cd backend && npm start`
   - **Health check path:** `/api/health`
4. **Environment variables:** `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `TRUST_PROXY=1`.
5. In Atlas, allow access from the service (see the checklist).
6. From your own machine, seed once against the production database (set `MONGODB_URI` and `ADMIN_SEED_PASSWORD` in your shell or a local `.env`, then `npm run seed`).
7. Open the service URL, log in as admin, and check `/api/health` returns `{"status":"ok","database":"connected"}`.

Notes: free web services on some platforms *sleep* when idle, so the first request after a pause can take a while. Remember the resume-storage caveat above.

## Running behind your own server (e.g. a college server)

```bash
git clone <repo> && cd P-M-S/backend
npm ci --omit=dev
# create .env with MONGODB_URI, JWT_SECRET, NODE_ENV=production, PORT
node server.js
```
Keep it running with a process manager (for example `pm2 start server.js --name pms`) and put a reverse proxy such as nginx in front for HTTPS; set `TRUST_PROXY=1` in that case.

## Operations

- **Health:** `GET /api/health` (HTTP 503 while the database is unreachable).
- **Logs:** errors are logged server-side with the request method and URL; clients only ever see generic messages.
- **Shutdown:** `SIGINT`/`SIGTERM` stop accepting requests, close the database connection and exit cleanly.
- **Backups:** use Atlas backups (or `mongodump`) for the database; if resumes live on disk or in a bucket, back that up separately.
- **Dependencies:** run `npm audit` and `npm outdated` periodically.
