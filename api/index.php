<?php
declare(strict_types=1);
ini_set('display_errors','0');ini_set('log_errors','0');error_reporting(E_ALL);
require dirname(__DIR__).'/vendor/autoload.php';
try {
 set_error_handler(static function(){throw new RuntimeException('Runtime failure.');});
 $config=require dirname(__DIR__).'/backend/config.php';
 \Tabiro\Application::run($config);
} catch(\Tabiro\ApiError $error) {\Tabiro\Http::error($error);}
catch(\Throwable) {\Tabiro\Http::error(new \Tabiro\ApiError(500,'server_error','The request could not be completed.'));}
