<?php
declare(strict_types=1);
namespace Tabiro;
use PDO;

final class AccountTokens {
 public function __construct(private PDO $db,private Auth $auth,private Mailer $mailer) {}
 private function query(string $sql,array $args=[]): \PDOStatement {$q=$this->db->prepare($sql);$q->execute($args);return $q;}
 public function forgot(array $data): array {
  $email=strtolower(Http::text($data,'email',254,true));
  if(!filter_var($email,FILTER_VALIDATE_EMAIL))throw new ApiError(422,'validation','Enter a valid email address.');
  $this->auth->throttle('reset:'.$email);$this->mailer->ready();
  $user=$this->query("SELECT id FROM users WHERE email=? AND status='active'",[$email])->fetch();
  if($user)$this->issue((int)$user['id'],'reset_password',1800);
  return ['message'=>'If an eligible account exists, a password reset email has been requested.'];
 }
 public function requestVerification(): array {
  $user=$this->auth->required();$this->auth->throttle('verify:'.$user['id']);
  if(!$user['verified_at']){$this->mailer->ready();$this->issue($user['id'],'verify_email',86400);}
  return ['message'=>'Verification requested for eligible accounts.'];
 }
 private function issue(int $userId,string $purpose,int $lifetime): void {
  $this->db->beginTransaction();
  try {
   // Every issue/consume operation locks the account first, serializing resends and resets.
   $user=$this->query("SELECT email,status,verified_at FROM users WHERE id=? FOR UPDATE",[$userId])->fetch();
   if(!$user||$user['status']!=='active'||($purpose==='verify_email'&&$user['verified_at'])){$this->db->commit();return;}
   $token=bin2hex(random_bytes(32));
   $this->query('UPDATE auth_tokens SET consumed_at=UTC_TIMESTAMP() WHERE user_id=? AND purpose=? AND consumed_at IS NULL',[$userId,$purpose]);
   $this->query('INSERT INTO auth_tokens(user_id,token_hash,purpose,expires_at) VALUES(?,?,?,?)',[$userId,hash('sha256',$token),$purpose,gmdate('Y-m-d H:i:s',time()+$lifetime)]);
   $this->mailer->send($user['email'],$purpose,$token);
   $this->db->commit();
  }catch(\Throwable $e){if($this->db->inTransaction())$this->db->rollBack();throw $e;}
 }
 private function invalid(): never {throw new ApiError(422,'invalid_token','This link is invalid or expired. Request a new email.');}
 public function consume(array $data,string $purpose): array {
  $token=$data['token']??null;if(!is_string($token)||!preg_match('/^[a-f0-9]{64}$/D',$token))$this->invalid();
  $this->auth->throttle('token:'.hash('sha256',$token));
  $password=$purpose==='reset_password'?PasswordPolicy::validate($data['password']??null):null;
  $hash=hash('sha256',$token);
  $id=$this->query('SELECT user_id FROM auth_tokens WHERE token_hash=? AND purpose=?',[$hash,$purpose])->fetchColumn();
  if(!$id)$this->invalid();
  // Hash before acquiring locks: expensive work must not extend the critical section.
  $passwordHash=$password!==null?password_hash($password,PASSWORD_DEFAULT):null;
  $this->db->beginTransaction();
  try {
   $user=$this->query("SELECT id FROM users WHERE id=? AND status='active' FOR UPDATE",[$id])->fetch();
   $row=$this->query('SELECT id FROM auth_tokens WHERE token_hash=? AND user_id=? AND purpose=? AND consumed_at IS NULL AND expires_at>UTC_TIMESTAMP() FOR UPDATE',[$hash,$id,$purpose])->fetch();
   if(!$user||!$row)$this->invalid();
   $this->query('UPDATE auth_tokens SET consumed_at=UTC_TIMESTAMP() WHERE user_id=? AND purpose=? AND consumed_at IS NULL',[$id,$purpose]);
   if($purpose==='reset_password'){
    $this->query('UPDATE users SET password_hash=? WHERE id=?',[$passwordHash,$id]);
    $this->query('DELETE FROM sessions WHERE user_id=?',[$id]);
   }else{$this->query('UPDATE users SET verified_at=COALESCE(verified_at,UTC_TIMESTAMP()) WHERE id=?',[$id]);}
   $this->db->commit();
  }catch(\Throwable $e){if($this->db->inTransaction())$this->db->rollBack();throw $e;}
  return ['message'=>$purpose==='reset_password'?'Password updated. Sign in with your new password.':'Email verified.'];
 }
}
