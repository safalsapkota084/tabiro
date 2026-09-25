<?php
declare(strict_types=1);
// This writes ONLY fixed disposable local credentials, never loads .env.
if(PHP_SAPI!=='cli')exit(1);
$dir=dirname(__DIR__).'/.local';if(!is_dir($dir))mkdir($dir,0700,true);
$path=$dir.'/database.php';if(file_exists($path)){echo "Local configuration already exists; unchanged.\n";exit;}
$port=getenv('TABIRO_LOCAL_PORT')?:'33077';if(!ctype_digit($port)||(int)$port<1||(int)$port>65535)exit(1);
$config=['DB_HOST'=>'127.0.0.1','DB_PORT'=>(int)$port,'DB_NAME'=>'tabiro_development','DB_USER'=>'tabiro_local','DB_PASSWORD'=>'local-only-not-production'];
umask(0077);$file=fopen($path,'x');fwrite($file,"<?php\nreturn ".var_export($config,true).";\n");fclose($file);chmod($path,0600);echo "Disposable local configuration created.\n";
