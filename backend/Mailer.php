<?php
declare(strict_types=1);
namespace Tabiro;

/** Delivery is configured privately; no request-controlled host or sender. */
final class Mailer {
 public function __construct(private array $config) {}
 public function ready(): void {
  $production=$this->config['environment']==='production';
  $transport=$this->config['MAIL_TRANSPORT']??($production?'disabled':'file');
  $url=$this->config['APP_URL']??($production?'':'http://127.0.0.1:8087');
  $parts=is_string($url)?parse_url($url):false;
  if(!$parts || isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment']) || !empty($parts['path']) && $parts['path']!=='/' || preg_match('/[\x00-\x20\x7f]/',$url)) $this->unavailable();
  if($production) {
   if($transport!=='mail'||($parts['scheme']??'')!=='https'||empty($parts['host'])||!filter_var($this->config['MAIL_FROM']??'',FILTER_VALIDATE_EMAIL)||preg_match('/[\r\n]/',$this->config['MAIL_FROM'])) $this->unavailable();
  } elseif($transport!=='file'||($parts['scheme']??'')!=='http'||!in_array($parts['host']??'',['127.0.0.1','localhost'],true)) $this->unavailable();
 }
 private function unavailable(): never {throw new ApiError(503,'mail_unavailable','Account email is temporarily unavailable. Please try again later.');}
 public function send(string $email,string $purpose,string $token): void {
  $this->ready();
  $url=rtrim($this->config['APP_URL']??'http://127.0.0.1:8087','/').'/signin.html#'.http_build_query(['action'=>$purpose,'token'=>$token]);
  $subject=$purpose==='reset_password'?'Reset your Tabiro password':'Verify your Tabiro email';
  $body=$subject."\n\nOpen this link and confirm the action:\n".$url."\n\nIf you did not request this, ignore this email.\n";
  try {
   if($this->config['environment']==='production') {
    if(!mail($email,$subject,$body,['From'=>$this->config['MAIL_FROM'],'Content-Type'=>'text/plain; charset=UTF-8'])) $this->unavailable();
   } else {
    $dir=dirname(__DIR__).'/.local/mail-'.($this->config['environment']==='test'?'test':'development');
    $old=umask(0077);
    try {
      if(is_link(dirname($dir))||is_link($dir)||(!is_dir($dir)&&!mkdir($dir,0700,true))) $this->unavailable();
      chmod($dir,0700);
     $path=$dir.'/'.bin2hex(random_bytes(16)).'.json';
     if(file_put_contents($path,json_encode(['to'=>$email,'purpose'=>$purpose,'url'=>$url,'created_at'=>microtime(true)],JSON_THROW_ON_ERROR),LOCK_EX)===false) $this->unavailable();
      chmod($path,0600);
    }finally{umask($old);}
   }
  }catch(\Throwable){$this->unavailable();}
 }
}
