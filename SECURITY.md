# Security policy

## Supported versions

Only the latest commit on `main` is maintained.

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Use GitHub's private reporting instead: open the **Security** tab of this repository and choose **Report a vulnerability**. Include what you found, the steps to reproduce it and the impact you expect. I will reply as soon as I can.

## Scope and notes

- There is no built-in admin account. Admins are created with `npm run create-admin`, which asks for the e-mail and a password (masked as you type), so no admin credentials exist in the code or the seed data. The two demo students in the README (`rahul@pms.com`, `priya@pms.com`) and their passwords exist only in the seed data for local demos. Never seed them on a server other people can reach.
- Secrets live in `backend/.env`, which is git-ignored. Only `backend/.env.example` with placeholders is committed.
- The login token is stored in the browser's `localStorage`. This is a documented trade-off; see the Security section of the README.
- Reports about missing security headers, rate limits and similar hardening are welcome. Reports that need a leaked secret or physical access to a machine are out of scope.
