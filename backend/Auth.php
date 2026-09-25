<?php
declare(strict_types=1);
namespace Tabiro;
use PDO;
final class Auth {
 private array $session;
 public function __construct(private PDO $db, private bool $production) {
  $token=$_COOKIE['tabiro_session']??'';
  $stmt=$db->prepare('SELECT * FROM sessions WHERE token_hash=? AND expires_at>UTC_TIMESTAMP()');
  $stmt->execute([hash('sha256',is_string($token)?$token:'')]);
  $session=$stmt->fetch();
  if(!$session) $this->rotate(null); else $this->session=$session;
 }
 private function rotate(?int $userId): void {
  $token=bin2hex(random_bytes(32));$csrf=bin2hex(random_bytes(32));
  $expires=gmdate('Y-m-d H:i:s',time()+86400);
  $this->db->beginTransaction();
  try {
   if(isset($this->session)) {$delete=$this->db->prepare('DELETE FROM sessions WHERE token_hash=?');$delete->execute([$this->session['token_hash']]);}
   $stmt=$this->db->prepare('INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES(?,?,?,?)');
   $stmt->execute([hash('sha256',$token),$userId,$csrf,$expires]);$this->db->commit();
  } catch(\Throwable $e) {$this->db->rollBack();throw $e;}
  $this->session=['token_hash'=>hash('sha256',$token),'user_id'=>$userId,'csrf_token'=>$csrf,'expires_at'=>$expires];
  setcookie('tabiro_session',$token,['expires'=>time()+86400,'path'=>'/','secure'=>$this->production,'httponly'=>true,'samesite'=>'Lax']);
 }
 public function csrf(): void {
  if(!hash_equals($this->session['csrf_token'],$_SERVER['HTTP_X_CSRF_TOKEN']??'')) throw new ApiError(403,'csrf','Refresh the page and try again.');
 }
 public function user(): ?array {
  if(!$this->session['user_id']) return null;
  $q=$this->db->prepare("SELECT id,name,email,locale,verified_at FROM users WHERE id=? AND status='active'");$q->execute([$this->session['user_id']]);
  $row=$q->fetch(); if(!$row) return null; $row['id']=(int)$row['id'];return $row;
 }
 public function required(): array {return $this->user()??throw new ApiError(401,'unauthenticated','Please sign in.');}
 public function view(): array {return ['user'=>$this->user(),'csrf_token'=>$this->session['csrf_token']];}
 private function throttle(string $email): void {
  foreach(['ip:'.($_SERVER['REMOTE_ADDR']??''),'account:'.$email] as $bucket) {
   $key=hash('sha256',$bucket);$expiry=gmdate('Y-m-d H:i:s',time()+900);
   $q=$this->db->prepare('INSERT INTO auth_rate_limits(bucket,attempts,expires_at) VALUES(?,1,?) ON DUPLICATE KEY UPDATE attempts=IF(expires_at<=UTC_TIMESTAMP(),1,attempts+1), expires_at=IF(expires_at<=UTC_TIMESTAMP(),VALUES(expires_at),expires_at)');$q->execute([$key,$expiry]);
   $q=$this->db->prepare('SELECT attempts FROM auth_rate_limits WHERE bucket=?');$q->execute([$key]);
   if((int)$q->fetchColumn()>20) {header('Retry-After: 900');throw new ApiError(429,'rate_limited','Too many attempts. Try again later.');}
  }
 }
 public function register(array $data): array {
  $email=strtolower(Http::text($data,'email',254,true));$this->throttle($email);
  if(!filter_var($email,FILTER_VALIDATE_EMAIL)) throw new ApiError(422,'validation','Enter a valid email address.',['email'=>'invalid']);
  $name=Http::text($data,'name',100,true);$password=$data['password']??null;
  if(!is_string($password)||strlen($password)<12||strlen($password)>72) throw new ApiError(422,'validation','Use a password between 12 and 72 bytes.',['password'=>'invalid']);
  $locale=$data['locale']??'en';if(!in_array($locale,['en','ja','fr'],true)) throw new ApiError(422,'validation','Invalid language.');
  $this->db->beginTransaction();
  try {
   $q=$this->db->prepare('INSERT INTO users(email,password_hash,name,locale) VALUES(?,?,?,?)');$q->execute([$email,password_hash($password,PASSWORD_DEFAULT),$name,$locale]);$id=(int)$this->db->lastInsertId();
   $q=$this->db->prepare("INSERT INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE name='user'");$q->execute([$id]);$this->db->commit();
  }catch(\PDOException $e){$this->db->rollBack();if(($e->errorInfo[1]??null)===1062) throw new ApiError(409,'account_unavailable','Unable to register this account.');throw $e;}
  $this->rotate($id);return $this->view();
 }
 public function login(array $data): array {
  $email=strtolower(Http::text($data,'email',254,true));$this->throttle($email);
  $password=$data['password']??'';if(!is_string($password)||strlen($password)>72) throw new ApiError(401,'invalid_credentials','Email or password is incorrect.');
  $q=$this->db->prepare("SELECT id,password_hash FROM users WHERE email=? AND status='active'");$q->execute([$email]);$user=$q->fetch();
  // A fixed valid bcrypt hash keeps unknown-account verification on the same slow path.
  $hash=$user['password_hash']??'$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
  if(!password_verify($password,$hash)||!$user) throw new ApiError(401,'invalid_credentials','Email or password is incorrect.');
  $this->rotate((int)$user['id']);return $this->view();
 }
 public function logout(): array {$this->rotate(null);return $this->view();}
 public function update(array $data): array {
  $user=$this->required();$name=Http::text($data,'name',100,true,$user['name']);$locale=$data['locale']??$user['locale'];
  if(!in_array($locale,['en','ja','fr'],true)) throw new ApiError(422,'validation','Invalid language.');
  $q=$this->db->prepare('UPDATE users SET name=?,locale=? WHERE id=?');$q->execute([$name,$locale,$user['id']]);return $this->user();
 }
}
