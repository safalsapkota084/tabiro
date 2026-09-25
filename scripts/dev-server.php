<?php
// php -S 127.0.0.1:8087 scripts/dev-server.php
$root=dirname(__DIR__);$path=rawurldecode(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH));
if(str_starts_with($path,'/api/')) {require $root.'/api/index.php';return true;}
$pages=['/','/index.html','/explore.html','/route.html','/planner.html','/trips.html','/signin.html','/signup.html','/account.html'];
$asset=preg_match('~^/assets/(css|js|images)/[a-zA-Z0-9_&./%-]+\.(css|js|png|svg|jpg|webp)$~D',$path);
$resolved=realpath($root.($path==='/'?'/index.html':$path));
if((in_array($path,$pages,true)||$asset)&&$resolved&&str_starts_with($resolved,$root.'/')&&!str_contains($path,'..')&&!str_contains($path,'/.')&&is_file($resolved)) return false;
http_response_code(404);header('Content-Type: text/plain');echo 'Not found';return true;
