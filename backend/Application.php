<?php
declare(strict_types=1);
namespace Tabiro;
final class Application {
 public static function run(array $config): never {
  $db=Database::connect($config);$auth=new Auth($db,$config['environment']==='production');
  $method=$_SERVER['REQUEST_METHOD'];$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
  if(!str_starts_with($path,'/api/v1/')) throw new ApiError(404,'not_found','Endpoint not found.');
  $path=substr($path,7);$data=[];
  if(in_array($method,['POST','PATCH','PUT','DELETE'],true)) {$auth->csrf();$data=Http::body();}
  if($path==='/session'&&$method==='GET') Http::respond($auth->view());
  if($path==='/auth/register'&&$method==='POST') Http::respond($auth->register($data),201);
  if($path==='/auth/login'&&$method==='POST') Http::respond($auth->login($data));
  if($path==='/auth/logout'&&$method==='POST') Http::respond($auth->logout());
  $user=$auth->required();
  if($path==='/me'&&$method==='GET') Http::respond($user);
  if($path==='/me'&&$method==='PATCH') Http::respond($auth->update($data));
  $trips=new Trips($db,$user['id']);$write=$method!=='GET';
  if($write) $db->beginTransaction();
  try {
   $status=200;
   if($path==='/trips'&&$method==='GET') $result=$trips->list();
   elseif($path==='/trips'&&$method==='POST') {$result=$trips->create($data);$status=201;}
   elseif(preg_match('~^/trips/([1-9][0-9]{0,17})(?:/days(?:/([1-9][0-9]{0,17})(?:/(stops|order)(?:/([1-9][0-9]{0,17}))?)?)?)?$~D',$path,$m)) {
    $id=(int)$m[1];$day=isset($m[2])?(int)$m[2]:0;$resource=$m[3]??'';$stop=isset($m[4])?(int)$m[4]:0;
    if($resource==='order'&&$stop===0&&$method==='PUT') $result=$trips->order($id,$day,$data);
    elseif($resource==='stops'&&$stop&&$method==='PATCH') $result=$trips->updateStop($id,$day,$stop,$data);
    elseif($resource==='stops'&&$stop&&$method==='DELETE') {$trips->deleteStop($id,$day,$stop);$result=null;$status=204;}
    elseif($resource==='stops'&&!$stop&&$method==='POST') {$result=$trips->addStop($id,$day,$data);$status=201;}
    elseif($day&&$resource===''&&$method==='PATCH') $result=$trips->updateDay($id,$day,$data);
    elseif($day&&$resource===''&&$method==='DELETE') {$trips->deleteDay($id,$day);$result=null;$status=204;}
    elseif(str_ends_with($path,'/days')&&$method==='POST') {$result=$trips->addDay($id,$data);$status=201;}
    elseif($path==='/trips/'.$id&&$method==='GET') $result=$trips->get($id);
    elseif($path==='/trips/'.$id&&$method==='PATCH') $result=$trips->update($id,$data);
    elseif($path==='/trips/'.$id&&$method==='DELETE') {$trips->delete($id);$result=null;$status=204;}
    else throw new ApiError(404,'not_found','Endpoint not found.');
   } else throw new ApiError(404,'not_found','Endpoint not found.');
   if($write) $db->commit();Http::respond($result,$status);
  }catch(\Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
 }
}
