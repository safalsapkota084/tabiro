<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    throw new RuntimeException('Production migrations are CLI-only.');
}

if ((getenv('TABIRO_ENV') ?: '') !== 'production') {
    throw new RuntimeException('Production migrations require TABIRO_ENV=production.');
}

$config = require __DIR__ . '/backend/config.php';
if (($config['environment'] ?? null) !== 'production') {
    throw new RuntimeException('Production configuration was not loaded.');
}
if ($config['DB_NAME'] !== 'u844935905_tabiro') {
    throw new RuntimeException('Unexpected production database.');
}

return [
    'paths' => ['migrations' => __DIR__ . '/database/migrations'],
    'environments' => [
        'default_migration_table' => 'tabiro_migrations',
        'default_environment' => 'production',
        'production' => [
            'adapter' => 'mysql',
            'host' => $config['DB_HOST'],
            'port' => (int) $config['DB_PORT'],
            'name' => $config['DB_NAME'],
            'user' => $config['DB_USER'],
            'pass' => $config['DB_PASSWORD'],
            'charset' => 'utf8mb4',
        ],
    ],
    'version_order' => 'creation',
];
