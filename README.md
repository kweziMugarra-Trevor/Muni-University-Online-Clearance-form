# University Online Clearance System

A local demonstration prototype for student clearance, built with HTML, CSS, JavaScript, Node.js, Express and SQLite. It is based on the supplied project files, with the pages linked and their stylesheet paths fixed.

**Use fictional data on your own laptop only.** This is not an official university system and is not ready for deployment, real personal records or official clearance decisions.

## What's included

- `client/` — sign-in, registration, student, officer, administrator and certificate verification pages, plus CSS and browser JavaScript.
- `server/` — Express API, authentication, validation and tests.
- `database/schema.sql` — database structure and relationships.
- `server/.env.example` — configuration template. Your private `.env` and database are not included.

## Start on Windows (VS Code)

1. Install the current supported Node.js LTS (version 20 or newer) from https://nodejs.org/ . Restart VS Code after installation if needed.
2. Extract this ZIP. Open the `clearance-system` folder in VS Code. Open **Terminal > New Terminal**.
3. Run these commands one at a time:

   ```powershell
   cd server
   npm ci
   Copy-Item .env.example .env
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

4. Open `server/.env` in VS Code. Copy the random string just printed into `JWT_SECRET=`. Set `ADMIN_EMAIL` to a test email and `ADMIN_PASSWORD` to your own unique password of at least 12 characters. Optionally change `UNIVERSITY_NAME` to `Muni University`. Save the file. Don't share or commit `.env`.
5. In the same terminal run:

   ```powershell
   npm run init-db
   npm test
   npm start
   ```

6. Keep the terminal running and open **http://127.0.0.1:3000/** in your browser. Do not open the HTML files directly with `file://` or VS Code's static Live Server: the pages need the Express API. Stop the server with Ctrl+C.

If `npm` is not found, reinstall Node.js LTS and restart VS Code. If PowerShell blocks `npm.ps1`, use `npm.cmd` instead of `npm`. If `npm ci` reports a native build error for `better-sqlite3`, use a supported Node.js LTS version or install the Windows C++ build tools and Python; share the error if you need help.

## Try the demonstration

1. Log in as admin using the email and password from `.env`; create one officer for each sample department. Use fictional emails and different test passwords.
2. Log out. Register a fictional student, sign in, and start a clearance request.
3. Log in as each officer and make a decision on that office's queue. The student can review progress; when every office approves, a certificate code is generated for verification.

The seeded departments are examples, not confirmed Muni policy. Your team can agree on the actual sequence, offices, permissions and clearance criteria before building integrations.

## Tests and limits

`npm test` runs local API lifecycle and access-control checks using a temporary database. The demo does not automatically check tuition, performance, library records or university identity, nor does it implement official signatures or approval by a dean or vice-chancellor. Its department approval and certificate are demonstrations only.

Authentication and database protection need substantial further work, including verified identities, secure sessions, audit coverage, HTTPS, data protection, and a proper security review before any real deployment. See `server/README.md` for setup details and security limitations. Do not commit secrets, databases, personal data or `node_modules` to GitHub.

## Notes for project work

Keep backups of your original files. Review and understand changes with your teammates, test against your own requirements and disclose AI assistance in line with your university's rules.
