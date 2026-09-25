<?php
declare(strict_types=1);
namespace Tabiro;
final class Http {
 public static function body(): array {
  if (!str_starts_with(strtolower($_SERVER['CONTENT_TYPE']??''),'application/json')) throw new ApiError(415,'content_type','Use a JSON request.');
  if ((int)($_SERVER['CONTENT_LENGTH']??0)>65536) throw new ApiError(413,'too_large','Request too large.');
  $raw=file_get_contents('php://input',false,null,0,65537);
  if ($raw === '' && $_SERVER['REQUEST_METHOD'] === 'DELETE') return [];
  if(strlen($raw)>65536) throw new ApiError(413,'too_large','Request too large.');
  try {$data=json_decode($raw,true,32,JSON_THROW_ON_ERROR);} catch(\JsonException) {throw new ApiError(400,'invalid_json','Invalid JSON.');}
  if(!is_array($data) || !str_starts_with(ltrim($raw),'{')) throw new ApiError(400,'invalid_json','Expected a JSON object.');
  return $data;
 }
 public static function respond(mixed $data,int $status=200): never {
  http_response_code($status);header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
  if($status!==204) echo json_encode(['data'=>$data],JSON_THROW_ON_ERROR);
  exit;
 }
 public static function error(ApiError $e): never {
  http_response_code($e->status); header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
  echo json_encode(['error'=>['code'=>$e->errorCode,'message'=>$e->getMessage(),'fields'=>(object)$e->fields]]); exit;
 }
 public static function text(array $data,string $key,int $max,bool $required=false,string $default=''): string {
  $value=$data[$key]??$default;
  if(!is_string($value)||mb_strlen($value)>$max||($required&&trim($value)==='')) throw new ApiError(422,'validation','Check the highlighted fields.',[$key=>'invalid']);
  return trim($value);
 }
 public static function integer(array $data,string $key,int $min,int $max,int $default=0): int {
  $value=$data[$key]??$default;
  if(!is_int($value)||$value<$min||$value>$max) throw new ApiError(422,'validation','Check the highlighted fields.',[$key=>'invalid']);
  return $value;
 }
 public static function date(mixed $value): string {
  if(!is_string($value)||!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$value)) throw new ApiError(422,'validation','Invalid date.');
  $d=\DateTimeImmutable::createFromFormat('!Y-m-d',$value);
  if(!$d||$d->format('Y-m-d')!==$value||$value<'1900-01-01'||$value>'2200-12-31') throw new ApiError(422,'validation','Invalid date.');
  return $value;
 }
}
