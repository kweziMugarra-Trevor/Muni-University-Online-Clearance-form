# Clearance server — local demo only

This is an Express + SQLite demo, not a production deployment. It serves the existing `client` folder; no client changes are required. Use fictional test data only. No external payment, email, identity verification, file upload, or university system is connected. The `uploads` table alone does not implement uploads.

## Setup

1. Install Node.js 20 LTS or newer with npm. `better-sqlite3` uses a native addon: supported platforms may get prebuilt binaries, otherwise a C/C++ build toolchain and Python are required.
2. Open a shell in the project's `server` directory and run `npm ci`.
3. Copy `.env.example` to `.env` (`cp .env.example .env` on Linux/macOS, `copy .env.example .env` on Windows). Open `.env` privately and fill in `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`. Set your preferred university name if desired; the seven offices are generic samples. The JWT secret must be at least 32 characters; generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste it into `.env`. The admin password must be unique and at least 12 characters, and no more than 72 UTF-8 bytes. Do not share or commit `.env` or the SQLite database. Anyone with the secret can forge tokens.
4. Run `npm run init-db`, then `npm start`. Open `http://127.0.0.1:3000/` on the same machine. The default listener is loopback only. Do not expose the demo to a public network.
5. Log in using the admin email and password you chose; create officers for the sample offices. Students register on the login page and start a request. Each officer approves or rejects their department's queue. A request is cleared when all its offices approve, and its certificate can be verified from the student page.

SQLite is created at `server/clearance.db`; its foreign keys are enabled. Initialization is safe to rerun and does not update existing account passwords. On an existing database, back it up before initialization: it adds a unique index preventing multiple active requests per student. If existing duplicates block the migration, resolve them manually after backing up, then rerun. The initializer is not a general migration tool and does not reconstruct partially missing tables. Stop the server before backing up the database and keep the backup private. For a fresh disposable demo you can stop the server and remove its SQLite database, then rerun initialization; this erases all data. A rejected request remains active and officers can change their decisions until the request clears; completed requests are locked. Initialization requires the admin configuration even on reruns; changing the `.env` password does not reset an existing account.

## Tests

Run `npm test`. Tests start the API on an ephemeral loopback port, create and delete a temporary SQLite database, and use temporary test credentials. They do not require or edit your real database. `npm audit --omit=dev` checks known dependency advisories.

## Demo limitations and risks

- Public self-registration does not verify university membership, email ownership or student registration numbers. Do not use real student records or treat a certificate as trusted proof.
- Login and registration use an in-memory IP rate limit, which resets on restart and is not distributed. There is no MFA, password recovery, session revocation on password change, account disable flow, or managed key rotation. Tokens expire after eight hours and the unchanged client stores them in browser localStorage, where injected scripts or browser access could expose them. Database role changes and deletions are checked on each request.
- HTTP is unencrypted, public certificate verification exposes the fictional student's name, registration number, institution and completion date to anyone holding the code, and SQLite/database backups are not encrypted. Keep this demo on localhost with fictitious data only.
- SQLite provides local storage, not multi-server concurrency, robust backup/recovery, production migrations, monitoring, comprehensive audit coverage or operational security. The demo has not received an independent security review.
