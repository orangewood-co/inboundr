# AGENTS.md

## Cursor Cloud specific instructions

Inboundr is a Bun workspace monorepo: `backend` (Express API, MongoDB + PostgreSQL,
AI agents, WebSockets, crons), `frontend` (React/Vite dashboard, port 5173),
`embed` (public forms/links, port 5175), `landing` (marketing, port 5174). Standard
run/lint/typecheck/build commands live in the root `README.md` and each
`package.json` — use those; this section only covers non-obvious local caveats.

### Services and how to start them (not auto-started)

The update script only refreshes JS dependencies (`bun install`). Databases, the
mock email endpoint, and dev servers are **not** started automatically — start
them per session:

- **MongoDB (required for the backend to boot) must run as a single-node replica
  set.** Better Auth uses transactions on sign-up; a standalone `mongod` fails with
  `Transaction numbers are only allowed on a replica set member or mongos` (sign-up
  returns HTTP 500 and the user is rolled back). Start it with:
  ```
  sudo -u mongodb mongod --dbpath /var/lib/mongodb --logpath /var/log/mongodb/mongod.log --bind_ip 127.0.0.1 --replSet rs0 --fork
  mongosh --quiet --eval 'try { rs.status() } catch(e) { rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]}) }'
  ```
  The backend's `MONGODB_URI` includes `?replicaSet=rs0` so the driver uses
  replica-set topology.
- **PostgreSQL** (product catalog + pgvector RAG): `sudo pg_ctlcluster 16 main start`.
  Role/db `inboundr`/`inboundr` already exist and the `vector` extension is installed.
- **Dev servers** (see README): `bun run dev:backend`, `bun run dev:frontend`.
  Run them via tmux; `bun run dev:backend` is `bun --watch`.

### Local `.env` files

Each workspace has a gitignored `.env` (not committed; persists via the VM
snapshot). If missing, recreate from the `*.env.production.example` files. Backend
specifics that are easy to miss:
- `MONGODB_URI=mongodb://127.0.0.1:27017/btsa?replicaSet=rs0`
- Placeholder `OPENROUTER_API_KEY` and `OPENAI_API_KEY` are **required just to boot**
  — `backend/src/agents/*.ts` and `rfq-attachment.service.ts` construct LLM clients
  at import time and throw on an empty key. Real AI calls still need valid keys.
- `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD` for Postgres (not in the example file).

### Auth / local sign-up gotcha

Sign-up sends a verification email via AWS SES and login requires a verified email
(`requireEmailVerification: true`). Locally SES points at a mock endpoint
(`AWS_ENDPOINT_URL_SES=http://127.0.0.1:4566`); start it with `bun ~/mock-ses.ts`
before signing up, otherwise the email send throws and sign-up is rolled back.
After sign-up, mark the user verified before logging in:
```
mongosh --quiet btsa --eval 'db.user.updateOne({email:"<email>"},{$set:{emailVerified:true}})'
```
A ready-to-use verified test account already exists:
`founder@acme.test` / `Password123!` (with an auto-created organization) — just log
in with it to skip sign-up entirely.

### Known pre-existing issues (not environment problems; do not "fix" as setup)

- Product catalog over Postgres: the repo has **no `CREATE TABLE products` DDL**
  (migrations only `ALTER` it), so product-catalog Postgres routes error until a
  base `products` table exists. The RAG `drive_document_chunks` schema auto-provisions
  on boot. `bun run migrate:catalog:postgres` fails for the same reason.
- Lint: `frontend` and `landing` have pre-existing ESLint errors; `embed` does not
  declare `eslint` as a dependency so `bun run lint:embed` fails with
  `eslint: command not found`. `bun run typecheck` (what CI enforces) passes for all
  workspaces.
- The new-customer form's "Contact number" field crashes the UI ("Something Went
  Wrong"); create customers without touching that field.
