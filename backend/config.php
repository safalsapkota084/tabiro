<?php
declare(strict_types=1);
// Never load the repository .env: it belongs to the production diagnostic.
$environment = getenv('TABIRO_ENV') ?: 'development';
if (!in_array($environment, ['development', 'test', 'production'], true)) throw new RuntimeException('Invalid environment.');
$path = $environment === 'production' ? getenv('TABIRO_CONFIG') : dirname(__DIR__) . '/.local/database.php';
if (!$path || !is_file($path)) throw new RuntimeException('Private configuration unavailable.');
if ($environment === 'production') {
    $resolved = realpath($path);
    $root = realpath($_SERVER['DOCUMENT_ROOT'] ?? dirname(__DIR__));
    if (!$resolved || ($root && str_starts_with($resolved, $root . DIRECTORY_SEPARATOR))) throw new RuntimeException('Configuration must be private.');
}
$config = require $path;
foreach (['DB_HOST','DB_NAME','DB_USER','DB_PASSWORD','DB_PORT'] as $key) {
    if (!isset($config[$key]) || !is_scalar($config[$key])) throw new RuntimeException('Invalid private configuration.');
}
if ($environment !== 'production') {
    if ($config['DB_HOST'] !== '127.0.0.1' || !in_array($config['DB_NAME'], ['tabiro_development','tabiro_test'], true)) throw new RuntimeException('Local database required.');
    if ($environment === 'test') $config['DB_NAME'] = 'tabiro_test';
}
if (preg_match('/[;\x00-\x1f\x7f]/', (string)$config['DB_HOST'] . (string)$config['DB_NAME']) || !ctype_digit((string)$config['DB_PORT']) || (int)$config['DB_PORT'] < 1 || (int)$config['DB_PORT'] > 65535) throw new RuntimeException('Invalid database configuration.');
$config['environment'] = $environment;
return $config;
