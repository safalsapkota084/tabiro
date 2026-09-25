import test from 'node:test';
import { EventEmitter } from 'node:events';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadDbConfig, safeFailure, canInspectTriggers, runDbDiagnostic } from '../scripts/db-test.mjs';

test('database settings come only from the five allowed file entries', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'tabiro-env-test-'));
  try {
    const file = path.join(directory, '.env');
    await writeFile(file, 'DB_HOST=test.invalid\nDB_NAME=test_db\nDB_USER=test_user\nDB_PASSWORD="a # quoted test password"\nDB_PORT=3306\nUNRELATED_KEY=must-not-load\n');
    const config = await loadDbConfig(file);
    assert.deepEqual(Object.keys(config).sort(), ['database', 'host', 'password', 'port', 'user']);
    assert.equal(config.password, 'a # quoted test password');
    assert.equal(config.port, 3306);
    assert.equal(process.env.UNRELATED_KEY, undefined);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('missing settings and invalid ports are rejected without exposing file contents', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'tabiro-env-test-'));
  try {
    const file = path.join(directory, '.env');
    for (const port of ['', '0', '65536', '3306junk']) {
      await writeFile(file, `DB_HOST=test.invalid\nDB_NAME=test_db\nDB_USER=test_user\nDB_PASSWORD=secret-sentinel\nDB_PORT=${port}\n`);
      await assert.rejects(loadDbConfig(file), error => !String(error).includes('secret-sentinel'));
    }
    await writeFile(file, 'DB_HOST=test.invalid\n');
    await assert.rejects(loadDbConfig(file));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('driver errors never enter the returned result', () => {
  for (const code of ['ER_ACCESS_DENIED_ERROR', 'ENOTFOUND', 'EPERM', 'ER_BAD_DB_ERROR', 'UNEXPECTED']) {
    const error = Object.assign(new Error('secret-sentinel connection string'), { code, sql: 'private sql', host: 'private host' });
    const result = safeFailure('connect', error);
    assert.equal(result.success, false);
    assert.deepEqual(Object.keys(result).sort(), ['category', 'code', 'errno', 'message', 'sqlState', 'success']);
    assert.doesNotMatch(JSON.stringify(result), /secret-sentinel|private sql|private host/);
  }
});

test('existing-table trigger inspection requires a visible applicable privilege', () => {
  assert.equal(canInspectTriggers(['GRANT SELECT, INSERT ON `test_db`.* TO \'test\'@\'host\''], 'test_db'), false);
  assert.equal(canInspectTriggers(['GRANT ALL PRIVILEGES ON `other_db`.* TO \'test\'@\'host\''], 'test_db'), false);
  assert.equal(canInspectTriggers(['GRANT TRIGGER ON `test_db`.`codex_db_test` TO \'test\'@\'host\''], 'test_db'), true);
  assert.equal(canInspectTriggers(['GRANT ALL PRIVILEGES ON `test_db`.* TO \'test\'@\'host\''], 'test_db'), true);
  assert.equal(canInspectTriggers(['GRANT ALL PRIVILEGES ON *.* TO \'test\'@\'host\'', 'REVOKE TRIGGER ON `test_db`.* FROM \'test\'@\'host\''], 'test_db'), false);
});

test('failure results expose safe MySQL diagnostics without raw connection details', () => {
  const result = safeFailure('connect', {
    code: 'ER_ACCESS_DENIED_ERROR', errno: 1045, sqlState: '28000',
    message: 'private username/password/host', stack: 'private stack',
  });
  assert.equal(result.code, 'ER_ACCESS_DENIED_ERROR');
  assert.equal(result.errno, 1045);
  assert.equal(result.sqlState, '28000');
  assert.equal(result.category, 'authentication');
  assert.doesNotMatch(JSON.stringify(result), /private/);
});

test('network failures have a safe category and absent SQLSTATE is null', () => {
  const result = safeFailure('connect', { code: 'ECONNREFUSED', errno: -61 });
  assert.equal(result.code, 'ECONNREFUSED');
  assert.equal(result.errno, -61);
  assert.equal(result.sqlState, null);
  assert.equal(result.category, 'connection');
});

test('malformed diagnostic fields are omitted and arbitrary categories are not echoed', () => {
  const result = safeFailure('private stage', {
    code: 'PRIVATE_USERNAME', errno: 'private password', sqlState: 'private connection string', category: 'private host',
  });
  assert.equal(result.code, null);
  assert.equal(result.errno, null);
  assert.equal(result.sqlState, null);
  assert.equal(result.category, 'unknown');
  assert.doesNotMatch(JSON.stringify(result), /private/i);
});

test('query failures and configuration failures use bounded categories', () => {
  assert.equal(safeFailure('query', { code: 'ER_DUP_ENTRY', errno: 1062, sqlState: '23000' }).category, 'constraint');
  assert.equal(safeFailure('settings', new Error('private setting')).category, 'configuration');
  assert.equal(safeFailure('query', undefined).category, 'query');
});

// Simulate only the external network/client boundary; exercise real diagnostic logic.
function diagnosticBoundary(outcome) {
  const socket = new EventEmitter();
  let closed = false;
  let sqlCalls = 0;
  socket.destroy = () => { closed = true; };
  socket.setNoDelay = () => {};
  const neverSql = () => { sqlCalls++; throw new Error('SQL must never run'); };
  return {
    options: {
      loadConfig: async () => ({ host: 'private-host', user: 'private-user', database: 'private-db', password: 'private-password', port: 3306 }),
      createSocket: options => { assert.equal(options.family, 4); return socket; },
      connect: async config => {
        assert.equal(config.connectTimeout, 10000);
        assert.equal(config.ssl, false);
        assert.equal(config.multipleStatements, false);
        assert.equal(config.stream(), socket);
        if (outcome !== 'tcp-failure') socket.emit('connect');
        if (['success', 'authentication-failure'].includes(outcome)) socket.emit('data', Buffer.from('private-packet'));
        if (outcome !== 'success') throw Object.assign(new Error('private-stack-and-connection-string'), {
          code: outcome === 'authentication-failure' ? 'ER_ACCESS_DENIED_ERROR' : 'ETIMEDOUT',
          errno: outcome === 'authentication-failure' ? 1045 : undefined,
          sqlState: outcome === 'authentication-failure' ? '28000' : undefined,
        });
        return { destroy: socket.destroy, query: neverSql, execute: neverSql, beginTransaction: neverSql, commit: neverSql };
      },
    },
    assertClosedWithoutSql() { assert.equal(closed, true); assert.equal(sqlCalls, 0); },
  };
}

test('diagnostic closes immediately after successful authentication without SQL', async () => {
  const boundary = diagnosticBoundary('success');
  const result = await runDbDiagnostic(boundary.options);
  assert.equal(result.success, true);
  assert.equal(result.tcp_connected, true);
  assert.equal(result.server_data_received, true);
  assert.equal(result.mysql_connected, true);
  assert.equal(result.category, 'success');
  assert.equal(result.code, null);
  assert.equal(result.errno, null);
  assert.equal(result.sqlState, null);
  assert.ok(Number.isInteger(result.elapsed_ms) && result.elapsed_ms >= 0);
  assert.deepEqual(Object.keys(result).sort(), ['category', 'code', 'elapsed_ms', 'errno', 'mysql_connected', 'server_data_received', 'sqlState', 'success', 'tcp_connected'].sort());
  assert.doesNotMatch(JSON.stringify(result), /private/);
  boundary.assertClosedWithoutSql();
});

test('diagnostic distinguishes TCP, greeting wait, and authentication failure', async () => {
  for (const [outcome, tcp, data, category] of [
    ['tcp-failure', false, false, 'timeout'],
    ['greeting-timeout', true, false, 'timeout'],
    ['authentication-failure', true, true, 'authentication'],
  ]) {
    const boundary = diagnosticBoundary(outcome);
    const result = await runDbDiagnostic(boundary.options);
    assert.equal(result.success, false);
    assert.equal(result.tcp_connected, tcp);
    assert.equal(result.server_data_received, data);
    assert.equal(result.mysql_connected, false);
    assert.equal(result.category, category);
    assert.doesNotMatch(JSON.stringify(result), /private/);
    boundary.assertClosedWithoutSql();
  }
});

test('diagnostic settings failure never reaches the connection factory', async () => {
  let attempts = 0;
  const result = await runDbDiagnostic({
    loadConfig: async () => { throw new Error('private-settings'); },
    connect: async () => { attempts++; },
  });
  assert.equal(attempts, 0);
  assert.equal(result.category, 'configuration');
  assert.equal(result.success, false);
  assert.equal(result.tcp_connected, false);
  assert.equal(result.server_data_received, false);
  assert.equal(result.mysql_connected, false);
  assert.doesNotMatch(JSON.stringify(result), /private/);
});
