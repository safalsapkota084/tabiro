<?php
// Run through Hostinger SSH, outside public_html. No public HTTP endpoint.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
ini_set('log_errors', '0');
error_reporting(E_ALL);

// Discard accidental output from the private configuration, including whitespace.
$bufferLevel = ob_get_level();
ob_start();
set_error_handler(static function () {
    throw new RuntimeException('Configuration or runtime failure.');
});

$category = 'configuration';
$result = ['success' => false, 'category' => $category];
$pdo = null;

try {
    // This file is created manually on Hostinger, never in the Git checkout.
    $configFile = __DIR__ . '/database.php';
    if (!is_file($configFile) || !is_readable($configFile)) {
        throw new RuntimeException('Private configuration unavailable.');
    }
    $config = require $configFile;
    if (!is_array($config)) {
        throw new RuntimeException('Invalid configuration.');
    }
    foreach (['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'] as $key) {
        if (!isset($config[$key]) || !is_string($config[$key]) || $config[$key] === '') {
            throw new RuntimeException('Missing configuration.');
        }
    }
    $port = $config['DB_PORT'] ?? null;
    if ((!is_int($port) && !is_string($port)) || !ctype_digit((string) $port)
        || (int) $port < 1 || (int) $port > 65535) {
        throw new RuntimeException('Invalid port.');
    }
    // Prevent DSN delimiters or control characters from changing its structure.
    foreach (['DB_HOST', 'DB_NAME'] as $key) {
        if (preg_match('/[;\x00-\x1F\x7F]/', $config[$key])) {
            throw new RuntimeException('Invalid configuration.');
        }
    }

    $category = 'runtime';
    if (!class_exists('PDO') || !in_array('mysql', PDO::getAvailableDrivers(), true)) {
        throw new RuntimeException('PDO MySQL unavailable.');
    }

    $category = 'connection';
    $pdo = new PDO(
        'mysql:host=' . $config['DB_HOST'] . ';port=' . (int) $port
        . ';dbname=' . $config['DB_NAME'] . ';charset=utf8mb4',
        $config['DB_USER'],
        $config['DB_PASSWORD'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 10]
    );
    unset($config);

    $category = 'query';
    // This is the only SQL statement in this script.
    $statement = $pdo->query('SELECT 1');
    if ((string) $statement->fetchColumn() !== '1') {
        throw new RuntimeException('Unexpected result.');
    }
    $statement->closeCursor();
    $result = ['success' => true];
} catch (PDOException $error) {
    // Inspect numeric driver codes internally; never output the exception or DSN.
    $driverCode = (int) ($error->errorInfo[1] ?? 0);
    if (in_array($driverCode, [1045, 1698], true)) {
        $category = 'authentication';
    } elseif (in_array($driverCode, [1044, 1130], true)) {
        $category = 'permission';
    } elseif ($driverCode === 1049) {
        $category = 'database_unavailable';
    }
    $result = ['success' => false, 'category' => $category];
} catch (Throwable $error) {
    $result = ['success' => false, 'category' => $category];
} finally {
    $statement = null;
    $pdo = null;
    unset($config);
    restore_error_handler();
    while (ob_get_level() > $bufferLevel) {
        ob_end_clean();
    }
}

echo json_encode($result), PHP_EOL;
exit($result['success'] ? 0 : 1);
