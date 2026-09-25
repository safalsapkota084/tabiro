# Hostinger-side PDO connectivity check

This replaces further local remote-MySQL troubleshooting. It is a standalone PHP CLI script for Hostinger, not a browser endpoint or a Tabiro backend. It requires PHP 7.4+ with PDO MySQL and executes only `SELECT 1`. No tables, rows, schema, transactions, migrations, or credentials are changed. No Composer dependency is needed.

## Private placement on Hostinger

Find the website's actual document root in hPanel. Hostinger's usual structure is:

```text
<site-root>/
├── public_html/                 # public website; put neither test file here
└── private/                     # outside every web-accessible document root
    ├── hostinger-db-check.php   # copy scripts/hostinger-db-check.php here
    └── database.php             # create manually on Hostinger; secrets only
```

The exact `<site-root>` depends on the domain's configuration. For a subdomain whose document root is inside another website's public_html, do not create `private` beside that subdomain folder: choose a location outside the parent public_html as well. Keep `private` outside the Git checkout/deployment directory, do not map it to any website, and do not symlink it into a public directory.

Use permissions `700` on the private directory and `600` on both files. Run the script as their owning hosting account. Permission `600` alone does not make a file non-web-readable; placement outside all document roots is required.

## Create the configuration manually

Create `database.php` on Hostinger in that private directory. Use a private editor; do not put actual credentials into a shell command, chat, screenshots, or Git. This template intentionally contains no real values:

```php
<?php
return [
    'DB_HOST' => 'REPLACE_WITH_HOSTINGER_SERVER_SIDE_DATABASE_HOST',
    'DB_NAME' => 'REPLACE_WITH_EXISTING_DATABASE_NAME',
    'DB_USER' => 'REPLACE_WITH_EXISTING_DATABASE_USER',
    'DB_PASSWORD' => 'REPLACE_WITH_EXISTING_DATABASE_PASSWORD',
    'DB_PORT' => 3306,
];
```

Use the existing database credentials and Hostinger's server-side connection settings. Do not change the database account's password or permissions for this test. Within PHP single-quoted strings, escape a literal single quote as `\'` and a literal backslash as `\\`. Do not copy the configuration into the local project; it must remain server-only.

The script reads only this adjacent configuration file. It does not read the local `.env`, use the Node diagnostic, or require remote MySQL access from your computer.

## Run through Hostinger SSH

1. In hPanel, open the website dashboard's **SSH Access** page and use its connection instructions. Hostinger Business Web Hosting supports SSH.
2. Manually copy the PHP test into the private directory described above. No automatic deployment is configured by this change.
3. Change to that private directory and run:

```sh
php -d display_errors=0 -d display_startup_errors=0 -d log_errors=0 hostinger-db-check.php
```

Successful stdout is exactly:

```json
{"success":true}
```

A failure returns only a safe category, for example:

```json
{"success":false,"category":"connection"}
```

Possible failure categories are `configuration`, `runtime`, `connection`, `authentication`, `permission`, `database_unavailable`, and `query`. Exit status is 0 for success and 1 for failure. Raw PDO messages, connection strings, database identifiers, stack traces, and credentials are neither printed nor logged by the script. Accidental configuration output is discarded.

Do not open this script in a browser: it rejects non-CLI requests. A browser URL is not part of this check.

## Verification and cleanup

`success: true` confirms both PDO connection and a verified `SELECT 1` result. No row will appear in phpMyAdmin because this test creates or writes nothing. There is no SQL cleanup step. Remove the temporary checker manually when finished; retain the private configuration only if you intend to use it for a later server-side application.

The script is prepared locally. It has not been uploaded or executed on Hostinger. Local PHP execution is unavailable in this workspace.

## Prepared production migration configuration

The repository includes `phinx.production.php` for an explicitly approved migration. It never contains credentials and requires:

- `TABIRO_ENV=production`
- `TABIRO_CONFIG` pointing to a private `database.php` outside every public document root
- `DB_NAME` exactly equal to `u844935905_tabiro`
- CLI execution

From the private Hostinger deployment directory, after confirming a restorable backup, an empty database, and a disposable MySQL 8 migration test, the command is:

```sh
TABIRO_ENV=production \
TABIRO_CONFIG=/absolute/path/outside/public_html/database.php \
vendor/bin/phinx migrate \
  -c /absolute/path/to/phinx.production.php \
  -e production \
  --no-interaction
```

This command has not been run. The local `scripts/migrate.php` wrapper remains development/test-only and still rejects production.

Official references:
- [Hostinger SSH access](https://www.hostinger.com/support/1583245-how-to-connect-to-a-hosting-plan-via-ssh-in-hostinger/)
- [Hostinger document root location](https://www.hostinger.com/support/5973000-how-to-open-the-website-s-root-directory-via-ssh-in-hostinger/)
- [PDO and MySQL support at Hostinger](https://www.hostinger.com/support/which-databases-and-data-tools-are-supported-at-hostinger/)
- [PHP PDO connections](https://www.php.net/manual/en/pdo.connections.php)
