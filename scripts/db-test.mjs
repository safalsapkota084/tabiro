import { readFile } from 'node:fs/promises';
import { createConnection as createTcpConnection } from 'node:net';
import { pathToFileURL } from 'node:url';
import { parse } from 'dotenv';

const ENV_FILE = new URL('../.env', import.meta.url);
const MESSAGE = 'Tabiro database connection works';
const ALLOWED_KEYS = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_PORT'];

// parse() does not populate process.env or print dotenv diagnostics.
export async function loadDbConfig(file = ENV_FILE) {
  let settings;
  try {
    const parsed = parse(await readFile(file));
    settings = Object.fromEntries(ALLOWED_KEYS.map(key => [key, parsed[key]]));
  } catch {
    throw new Error('Database settings could not be loaded.');
  }
  if (ALLOWED_KEYS.some(key => typeof settings[key] !== 'string' || !settings[key].trim())) {
    throw new Error('Required database settings are missing.');
  }
  if (!/^\d+$/.test(settings.DB_PORT) || Number(settings.DB_PORT) < 1 || Number(settings.DB_PORT) > 65535) {
    throw new Error('Database port configuration is invalid.');
  }
  return {
    host: settings.DB_HOST,
    database: settings.DB_NAME,
    user: settings.DB_USER,
    password: settings.DB_PASSWORD,
    port: Number(settings.DB_PORT),
  };
}

// Return only allowlisted codes, numeric errno, a validated SQLSTATE, and fixed text.
// Unknown or malformed diagnostic fields become null; raw errors are never serialized.
export function safeFailure(stage, error) {
  const allowedCodes = new Set([
    'EPERM', 'EACCES', 'ECONNREFUSED', 'ECONNRESET', 'ECONNABORTED', 'ENOTFOUND',
    'EAI_AGAIN', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE',
    'ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND', 'HANDSHAKE_SSL_ERROR',
    'PROTOCOL_CONNECTION_LOST', 'PROTOCOL_SEQUENCE_TIMEOUT',
    'ER_ACCESS_DENIED_ERROR', 'ER_DBACCESS_DENIED_ERROR', 'ER_HOST_NOT_PRIVILEGED',
    'ER_HOST_IS_BLOCKED', 'ER_BAD_DB_ERROR', 'ER_CON_COUNT_ERROR',
    'ER_TOO_MANY_USER_CONNECTIONS', 'ER_TABLEACCESS_DENIED_ERROR',
    'ER_COLUMNACCESS_DENIED_ERROR', 'ER_SPECIFIC_ACCESS_DENIED_ERROR',
    'ER_TABLE_EXISTS_ERROR', 'ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR',
    'ER_PARSE_ERROR', 'ER_DUP_ENTRY', 'ER_BAD_NULL_ERROR', 'ER_DATA_TOO_LONG',
    'ER_NO_REFERENCED_ROW_2', 'ER_ROW_IS_REFERENCED_2',
    'ER_LOCK_WAIT_TIMEOUT', 'ER_LOCK_DEADLOCK',
  ]);
  const code = allowedCodes.has(error?.code) ? error.code : null;
  const errno = Number.isSafeInteger(error?.errno) ? error.errno : null;
  const rawState = error?.sqlState ?? error?.sqlstate ?? error?.SQLSTATE;
  const sqlState = typeof rawState === 'string' && /^[0-9A-Z]{5}$/.test(rawState) ? rawState : null;
  let category = 'unknown';
  if (stage === 'settings') category = 'configuration';
  else if (stage === 'dependencies') category = 'dependency';
  else if (['EPERM', 'EACCES', 'ER_DBACCESS_DENIED_ERROR', 'ER_HOST_NOT_PRIVILEGED', 'ER_HOST_IS_BLOCKED', 'ER_TABLEACCESS_DENIED_ERROR', 'ER_COLUMNACCESS_DENIED_ERROR', 'ER_SPECIFIC_ACCESS_DENIED_ERROR'].includes(code)) category = 'permission';
  else if (code === 'ER_ACCESS_DENIED_ERROR' || sqlState?.startsWith('28')) category = 'authentication';
  else if (['ENOTFOUND', 'EAI_AGAIN'].includes(code)) category = 'dns';
  else if (['ETIMEDOUT', 'PROTOCOL_SEQUENCE_TIMEOUT', 'ER_LOCK_WAIT_TIMEOUT'].includes(code)) category = 'timeout';
  else if (code === 'HANDSHAKE_SSL_ERROR') category = 'tls';
  else if (code === 'ER_BAD_DB_ERROR') category = 'database_unavailable';
  else if (sqlState?.startsWith('23')) category = 'constraint';
  else if (code === 'ER_LOCK_DEADLOCK' || sqlState?.startsWith('40')) category = 'transaction';
  else if (stage === 'connect' || sqlState?.startsWith('08')) category = 'connection';
  else if (stage === 'query') category = 'query';

  let message = 'Database test failed. No connection details are displayed.';
  if (stage === 'settings') message = 'Database settings are missing or invalid.';
  else if (stage === 'dependencies') message = 'Database test dependencies are unavailable. Run npm ci.';
  else if (stage === 'connect') {
    if (['EPERM', 'EACCES'].includes(error?.code)) message = 'Database connection blocked by local network permissions.';
    else if (error?.code === 'ER_ACCESS_DENIED_ERROR') message = 'Database authentication or remote access was denied.';
    else if (error?.code === 'ER_BAD_DB_ERROR') message = 'The configured database is unavailable.';
    else if (error?.code === 'ECONNREFUSED') message = 'The configured database endpoint refused the connection.';
    else if (['ENOTFOUND', 'EAI_AGAIN'].includes(error?.code)) message = 'The configured database hostname could not be resolved.';
    else if (error?.code === 'ETIMEDOUT') message = 'The database connection timed out.';
    else message = 'Could not connect to the database. Check network access and database settings.';
  }
  return { success: false, message, code, errno, sqlState, category };
}

// Empty trigger metadata is only trustworthy when the account can inspect it.
// Role-only grants and partial revocations fail closed instead of guessing.
export function canInspectTriggers(grants, database) {
  if (grants.some(grant => /^REVOKE\b/i.test(grant))) return false;
  const quotedDatabase = '`' + database.replaceAll('`', '``') + '`';
  const targets = new Set(['*.*', `${quotedDatabase}.*`, `${quotedDatabase}.\`codex_db_test\``]);
  return grants.some(grant => {
    const match = /^GRANT (.+?) ON (.+?) TO /i.exec(grant);
    if (!match || !targets.has(match[2])) return false;
    return match[1].split(',').some(privilege => ['TRIGGER', 'ALL PRIVILEGES'].includes(privilege.trim().toUpperCase()));
  });
}

export async function runDbTest() {
  let connection;
  let transactionStarted = false;
  let stage = 'settings';
  try {
    const config = await loadDbConfig();
    stage = 'dependencies';
    const { default: mysql } = await import('mysql2/promise');
    stage = 'connect';
    connection = await mysql.createConnection({
      ...config,
      connectTimeout: 10000,
      multipleStatements: false,
      charset: 'utf8mb4',
      supportBigNumbers: true,
      bigNumberStrings: true,
    });
    // Bound the entire connected test; do not automatically retry writes.
    const deadline = setTimeout(() => connection.destroy(), 20000);
    try {
      stage = 'query';
      let tableExisted = false;
      try {
        await connection.query(`CREATE TABLE codex_db_test (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB`);
      } catch (error) {
        if (error?.code !== 'ER_TABLE_EXISTS_ERROR') throw error;
        tableExisted = true;
      }

      if (tableExisted) {
        const [grantRows] = await connection.query('SHOW GRANTS FOR CURRENT_USER');
        const grants = grantRows.flatMap(row => Object.values(row));
        if (!canInspectTriggers(grants, config.database)) {
          throw new Error('Existing test table cannot be safely inspected.');
        }
      }

      // Reject an incompatible pre-existing test table without altering it.
      const [columns] = await connection.query('SHOW COLUMNS FROM codex_db_test');
      if (columns.length !== 3 || columns[0].Field !== 'id' || !/^int(?:\(\d+\))?$/i.test(columns[0].Type) || columns[0].Key !== 'PRI' || !columns[0].Extra.includes('auto_increment') || columns[1].Field !== 'message' || columns[1].Type.toLowerCase() !== 'varchar(255)' || columns[1].Null !== 'NO' || columns[2].Field !== 'created_at' || columns[2].Type.toLowerCase() !== 'timestamp' || !/^current_timestamp(?:\(\))?$/i.test(columns[2].Default || '')) {
        throw new Error('Unexpected test table structure.');
      }
      // Do not execute pre-existing triggers that might write into production tables.
      const [triggers] = await connection.execute(
        'SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND EVENT_OBJECT_TABLE = ?',
        ['codex_db_test'],
      );
      if (triggers.length) throw new Error('Test table has existing triggers.');

      await connection.beginTransaction();
      transactionStarted = true;
      const [insert] = await connection.execute(
        'INSERT INTO codex_db_test (message) VALUES (?)', [MESSAGE],
      );
      if (insert.affectedRows !== 1) throw new Error('Insert was not verified.');
      const [rows] = await connection.execute(
        'SELECT id, message, created_at FROM codex_db_test WHERE id = ?', [insert.insertId],
      );
      if (rows.length !== 1 || String(rows[0].id) !== String(insert.insertId) || rows[0].message !== MESSAGE) {
        throw new Error('Inserted row could not be verified.');
      }
      await connection.commit();
      transactionStarted = false;
      return { success: true, message: MESSAGE };
    } finally {
      clearTimeout(deadline);
    }
  } catch (error) {
    if (connection && transactionStarted) {
      try { await connection.rollback(); } catch { /* Never expose rollback errors. */ }
    }
    return safeFailure(stage, error);
  } finally {
    if (connection) {
      // Release the socket without allowing a cleanup error to expose driver details.
      connection.destroy();
    }
  }
}

// This path only authenticates and closes. It never calls runDbTest or sends SQL.
// Optional factories isolate the external transport in offline tests.
export async function runDbDiagnostic({ loadConfig = loadDbConfig, connect, createSocket = createTcpConnection } = {}) {
  const started = performance.now();
  const result = {
    success: false,
    elapsed_ms: 0,
    tcp_connected: false,
    server_data_received: false,
    mysql_connected: false,
    code: null,
    errno: null,
    sqlState: null,
    category: 'unknown',
  };
  let stage = 'settings';
  let socket;
  let connection;
  try {
    const config = await loadConfig();
    stage = 'dependencies';
    const createConnection = connect ?? (await import('mysql2/promise')).default.createConnection;
    stage = 'connect';
    connection = await createConnection({
      ...config,
      connectTimeout: 10000,
      ssl: false,
      multipleStatements: false,
      charset: 'utf8mb4',
      stream: () => {
        socket = createSocket({ host: config.host, port: config.port, family: 4 });
        socket.setNoDelay(true);
        socket.once('connect', () => { result.tcp_connected = true; });
        // Observe arrival only: never retain, parse, or print packet contents.
        socket.once('data', () => { result.server_data_received = true; });
        return socket;
      },
    });
    // The Promise resolves only once the MySQL handshake/authentication completes.
    result.mysql_connected = true;
    result.success = true;
    result.category = 'success';
  } catch (error) {
    const { code, errno, sqlState, category } = safeFailure(stage, error);
    Object.assign(result, { code, errno, sqlState, category });
  } finally {
    // Destroy closes the transport immediately, without SQL or a queued command.
    try { connection?.destroy(); } catch { result.success = false; result.category = 'cleanup'; }
    try { socket?.destroy(); } catch { result.success = false; result.category = 'cleanup'; }
    result.elapsed_ms = Math.max(0, Math.round(performance.now() - started));
  }
  return result;
}

// Importing this module for offline tests must never connect to the real database.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const args = process.argv.slice(2);
  let result;
  if (args.length === 1 && args[0] === '--diagnostic') result = await runDbDiagnostic();
  else if (args.length === 0) result = await runDbTest();
  else result = { success: false, message: 'Unsupported command arguments.' };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.success ? 0 : 1;
}
