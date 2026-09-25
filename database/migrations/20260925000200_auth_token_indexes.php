<?php
declare(strict_types=1);
use Phinx\Migration\AbstractMigration;
final class AuthTokenIndexes extends AbstractMigration {
 public function up(): void {
  // Keep the already-applied foundation immutable; never create replacement user tables.
  foreach(['users','roles','user_roles','sessions','auth_tokens'] as $name){
   if(!$this->hasTable($name))throw new RuntimeException('Foundation schema missing; inspect migration history before continuing.');
  }
  $table=$this->table('auth_tokens');
  foreach(['user_id','purpose','consumed_at','expires_at','token_hash'] as $column){
   if(!$table->hasColumn($column))throw new RuntimeException('Incompatible auth_tokens schema; manual inspection required.');
  }
  $sessions=$this->table('sessions');
  foreach(['user_id','expires_at'] as $column){
   if(!$sessions->hasColumn($column))throw new RuntimeException('Incompatible sessions schema; manual inspection required.');
  }
  if(!$table->hasIndex(['user_id','purpose','consumed_at','expires_at'])){
   if($table->hasIndexByName('auth_tokens_user_purpose_expiry'))throw new RuntimeException('Authentication index name collision; manual inspection required.');
   $table->addIndex(['user_id','purpose','consumed_at','expires_at'],['name'=>'auth_tokens_user_purpose_expiry']);
  }
  if(!$sessions->hasIndex(['user_id','expires_at'])){
   if($sessions->hasIndexByName('sessions_user_expiry'))throw new RuntimeException('Session index name collision; manual inspection required.');
   $sessions->addIndex(['user_id','expires_at'],['name'=>'sessions_user_expiry']);
  }
  $table->update();
  $sessions->update();
 }
 public function down(): void {throw new RuntimeException('Automatic rollback disabled; use a reviewed forward migration.');}
}
