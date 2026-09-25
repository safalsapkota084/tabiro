<?php
declare(strict_types=1);
$config = require __DIR__.'/backend/config.php';
if ($config['environment'] === 'production') throw new RuntimeException('Production migrations are not enabled.');
return [
 'paths'=>['migrations'=>__DIR__.'/database/migrations'],
 'environments'=>['default_migration_table'=>'tabiro_migrations','default_environment'=>'local','local'=>[
  'adapter'=>'mysql','host'=>$config['DB_HOST'],'port'=>(int)$config['DB_PORT'],'name'=>$config['DB_NAME'],'user'=>$config['DB_USER'],'pass'=>$config['DB_PASSWORD'],'charset'=>'utf8mb4',
 ]],
 'version_order'=>'creation',
];
