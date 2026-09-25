# Isolated Hostinger database test

## Existing backend inspection

The checkout had no PHP backend, Composer setup, environment loader, or database connection layer. It was a static HTML/JavaScript frontend with Node-based development tooling. This standalone **Node CLI test** is isolated from the website; it is not a new application backend or public endpoint. It uses `dotenv` and `mysql2` as development dependencies.

## Settings and execution

The test reads the existing project-root `.env`, corresponding to `~/Desktop/Tabiro/.env` in this workspace. Only these settings are used:

- `DB_HOST`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_PORT`

It does not fall back to `.env.example`, change `.env`, populate the process environment with other entries, or display any setting values. Keep `.env` out of Git and out of the website's public document root.

From the project directory, install dependencies if needed, then explicitly run the test:

```sh
npm ci
npm run --silent db:test
```

The command needs network access to the configured database. A local test may require Hostinger remote-database access for the computer's IP. If the settings point at a host-local database endpoint, run from an already authorized environment with access; do not replace the existing credentials or expose connection details in troubleshooting output.

## What one run does

1. Read and validate only the five permitted settings.
2. Connect to the configured MySQL-compatible database.
3. Create the isolated test table. An already-existing-table error is handled explicitly, so an existing table is reused only after safety checks:

```sql
CREATE TABLE codex_db_test (
    id INT AUTO_INCREMENT PRIMARY KEY,
    message VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
```

4. Verify the test table's expected columns and reject existing triggers. Reusing an existing table requires a directly visible TRIGGER or ALL PRIVILEGES grant; otherwise the test stops before inserting. It will not alter an incompatible existing table.
5. Begin a transaction, insert **one** `Tabiro database connection works` message using a prepared statement, and fetch the row using that insert's ID.
6. Verify the fetched message and commit, leaving the row available in phpMyAdmin.
7. Output only:

```json
{"success":true,"message":"Tabiro database connection works"}
```

Errors return `success: false` with a fixed, safe message and a nonzero exit code. Driver exceptions, credentials, SQL errors, hostnames, connection strings, and fetched row metadata are not printed. On a query failure, rollback is attempted. Table creation is DDL and is not rolled back; an empty test table can remain after failure. A network failure during commit can leave the outcome uncertain; inspect the test table before rerunning.

Each explicit successful run inserts one additional row. There are no automatic retries, updates, deletes, or full Tabiro-schema migrations. `npm test` runs offline safety checks and does **not** connect to the real database.

## Verify in Hostinger phpMyAdmin

Once the command actually returns `success: true`:

1. Open Hostinger hPanel and manage the website.
2. Open **Databases → phpMyAdmin** and enter the database configured in your `.env`.
3. Select **codex_db_test**, then **Browse**. Look for the message and its creation timestamp.
4. Alternatively, open the **SQL** tab and run:

```sql
SELECT id, message, created_at
FROM codex_db_test
WHERE message = 'Tabiro database connection works'
ORDER BY id DESC
LIMIT 10;
```

Do not share screenshots containing database credentials or other database content.

## Cleanup (manual only)

When you are finished verifying, run this only against the intended database:

```sql
DROP TABLE codex_db_test;
```

The test never runs cleanup automatically. This deletes only the test table and all its test rows.

## Scope

No production tables are intentionally written, no full schema is created, and the frontend is unchanged. No commit, push, deployment, remote access rule change, or credential change is part of this test. Do not deploy `.env`, `scripts/db-test.mjs`, or `node_modules` with the public static site.

References: https://sidorares.github.io/node-mysql2/docs and https://www.hostinger.com/support/1583545-how-to-access-phpmyadmin-at-hostinger/

## Latest local attempt

The real `.env` was found and validated without printing its values. The connection attempt failed before any SQL ran. A safe configuration check established that the configured host is a local-only endpoint. That endpoint is relative to the computer running this command; from this local workspace it does not reach the Hostinger database. No table or row was created by this attempt. Complete the test from an authorized environment that can reach the database, or configure the existing `.env` with Hostinger's remote database endpoint and the required remote access before retrying. No settings have been changed automatically.
