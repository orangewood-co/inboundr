# Step 03 — Postgres + pgvector (Supabase Free)

**Sequence:** 03 of 12 · **Depends on:** nothing · **Blocks:** 08

## What part of the project this step deploys

The **Postgres side of `backend/`**:
- The org-scoped **product catalog** (`products` table) used by the RFQ matching agent (`generate_rfq.ts`), products CRUD and quotes.
- The **knowledge/RAG chunk table** with `vector` columns (`backend/src/db/knowledge-schema.ts`), used for chat document retrieval.

The backend connects through `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (`backend/src/db/postgres.ts`) with a pool of 15 connections.

## What to use

- **Supabase Free** (500 MB database, pgvector included, connection pooler).
- `pg_dump` / `pg_restore` (from `postgresql-client`, same or newer major version than the server).

## How to do it

1. Sign up at https://supabase.com → **New project**.
   - Region: closest to your Oracle VM (e.g. **Mumbai ap-south-1**).
   - Set a strong database password and save it.
2. **Database → Extensions** → enable **`vector`**. `ensureKnowledgeSchema()` creates the chunk table at startup, but it needs the extension to be available.
3. **Connect** (top bar) → **Session pooler**. Copy the values:
   | Env var | Value |
   |---------|-------|
   | `DB_HOST` | `aws-0-<region>.pooler.supabase.com` |
   | `DB_PORT` | `5432` (session mode) |
   | `DB_NAME` | `postgres` |
   | `DB_USER` | `postgres.<project-ref>` |
   | `DB_PASSWORD` | the password from step 1 |
   | `PGSSLMODE` | `require` (read by the `pg` driver from the environment) |

   Use the **session pooler**, not the direct `db.<ref>.supabase.co` host. On the free plan the direct host is IPv6-only, and the Oracle VCN from Step 07 is IPv4.

### Load the schema / data (required)

The repo has **no script that creates the base `products` table**. `migrate:catalog:postgres` only `ALTER`s an existing table. So you must bring the schema over from your current database:

- **Current Postgres is already Supabase?** Keep it and skip this section. The code comment about a "session-mode pooler that allows 20 clients" suggests it may already be Supabase.
- Otherwise copy the schema and data:
  ```bash
  pg_dump "postgresql://<OLD_USER>:<OLD_PASS>@<OLD_HOST>:5432/<OLD_DB>" \
    --no-owner --no-privileges -Fc -f inboundr-pg.dump

  pg_restore --no-owner --no-privileges --clean --if-exists \
    -d "postgresql://postgres.<ref>:<PASS>@aws-0-<region>.pooler.supabase.com:5432/postgres" \
    inboundr-pg.dump
  ```
  For a fresh, empty install use `pg_dump --schema-only` from any existing environment instead.
- After restoring, run the catalog migration once from the VM in Step 08 (`bun run --cwd backend migrate:catalog`). It is idempotent.

## Verify

```bash
psql "postgresql://postgres.<ref>:<PASS>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require" \
  -c "select count(*) from products;" -c "select extname from pg_extension where extname='vector';"
```

## Gotchas

- If the backend logs `self-signed certificate in certificate chain`, download the Supabase CA (**Database settings → SSL configuration → Download certificate**) to the VM and set `NODE_EXTRA_CA_CERTS=/home/ubuntu/supabase-ca.crt` in `backend/.env`. Don't use `PGSSLMODE=no-verify`: it skips server verification, so an interceptor could impersonate the pooler and receive the DB password and queries.
- Supabase **pauses free projects after ~7 days of inactivity**. Normal app use plus the nightly `pg_dump` from Step 12 keeps it active.
- The session pooler allows a limited number of clients. Don't raise `MAX_CONNECTIONS` (15) in `postgres.ts`.

## Role in the bigger picture

This is the **brain's lookup table**. When an RFQ email arrives, the AI agent matches the requested line items against this catalog to build a priced quote. The vector table lets the AI assistant answer from your uploaded documents. Without it, quoting (the core feature) doesn't work.
