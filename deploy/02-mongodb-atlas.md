# Step 02 — MongoDB (Atlas M0)

**Sequence:** 02 of 12 · **Depends on:** nothing · **Blocks:** 08

## What part of the project this step deploys

The **primary database of `backend/`**: Better Auth users, sessions and organizations, plus most app data (customers, emails, invoices, forms, Drive metadata, support tickets, employees, projects, ...). It is read through `MONGODB_URI` (Mongoose plus the native driver).

## What to use

- **MongoDB Atlas M0** (free forever, 512 MB storage, shared CPU).
- `mongodump` / `mongorestore` (MongoDB Database Tools) if you are moving existing data.

## How to do it

1. Sign up at https://cloud.mongodb.com → **Create** a deployment → choose **M0 Free**.
   - Provider/region: the one closest to your Oracle VM region (e.g. AWS **Mumbai ap-south-1** if your Oracle home region is Mumbai/Hyderabad and M0 is offered there).
   - Name: `inboundr`.
2. **Database Access** → add a database user, e.g. `inboundr-app`, password auth, role **Read and write to any database**. Save the password.
3. **Network Access**:
   - Add your laptop's IP for now (for the data migration).
   - In Step 07 you will add the **Oracle VM public IP**. Do not use `0.0.0.0/0` in production.
4. **Connect → Drivers** → copy the SRV string and put the database name in it:
   ```
   mongodb+srv://inboundr-app:<PASSWORD>@<cluster>.mongodb.net/inboundr?retryWrites=true&w=majority
   ```
   This is `MONGODB_URI` for Step 08. URL-encode special characters in the password.

### If you already run Inboundr somewhere (data migration)

- **Already on Atlas M0?** Keep the cluster. Just add the Oracle VM IP to the access list in Step 07 and skip the migration.
- Otherwise:
  1. Check the size first. In `mongosh` run `db.stats(1024*1024)`. Data plus indexes must fit in 512 MB.
  2. Copy the data:
     ```bash
     mongodump   --uri "<OLD_MONGODB_URI>" --archive=inboundr.archive --gzip
     mongorestore --uri "<NEW_MONGODB_URI>" --archive=inboundr.archive --gzip --nsInclude 'inboundr.*' --drop
     ```
  3. Do the final dump/restore during the cutover in Step 11, after the old backend is stopped, so no writes are lost.

## Verify

```bash
mongosh "<NEW_MONGODB_URI>" --eval 'db.getCollectionNames().length'
```

## Gotchas

- M0 has **no automated backups**. Step 12 adds a nightly `mongodump`.
- M0 limits ops/sec and connections. That's fine for a small team. Upgrade to Flex/M10 when you outgrow it.
- Keep the same database name (`inboundr`) the app already uses.

## Role in the bigger picture

This is the **system of record**. Login, organizations, permissions and nearly every screen in the dashboard read from it. Without it, the backend refuses to start (`connectDB()` runs first in `initializeServices`).
