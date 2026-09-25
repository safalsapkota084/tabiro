<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
ini_set('display_errors','0');ini_set('log_errors','0');
require dirname(__DIR__).'/vendor/autoload.php';
$exit=1;$lock=null;$buffer=ob_get_level();ob_start();
try {
 $config=require dirname(__DIR__).'/backend/config.php';
 if($config['environment']==='production')throw new RuntimeException('Production disabled.');
 $dir=dirname(__DIR__).'/.local';$name=$config['DB_NAME'];
 $lock=fopen($dir.'/'.$name.'.migration.lock','c');if(!$lock||!flock($lock,LOCK_EX|LOCK_NB))throw new RuntimeException('Migration locked.');
 $ledger=$dir.'/'.$name.'.migrations.json';$dirty=$dir.'/'.$name.'.migration-incomplete';
 if(file_exists($dirty))throw new RuntimeException('Previous migration incomplete; inspect before retry.');
 $previous=file_exists($ledger)?json_decode(file_get_contents($ledger),true,512,JSON_THROW_ON_ERROR):[];
 $checksums=[];foreach(glob(dirname(__DIR__).'/database/migrations/*.php') as $file)$checksums[basename($file)]=hash_file('sha256',$file);
 foreach($previous as $file=>$checksum)if(($checksums[$file]??null)!==$checksum)throw new RuntimeException('Applied migration changed.');
 $db=\Tabiro\Database::connect($config);
 $names=$db->query('SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema=DATABASE()')->fetchAll(PDO::FETCH_COLUMN);
 $foundationTables=['users','roles','user_roles','sessions','auth_tokens','auth_rate_limits','destinations','trips','trip_members','itinerary_days','itinerary_stops'];
 $existing=array_values(array_intersect($foundationTables,$names));
 if($existing) {
  if(!in_array('tabiro_migrations',$names,true))throw new RuntimeException('Untracked application tables exist; inspect the schema and migration history before migrating.');
  $version=$db->prepare('SELECT COUNT(*) FROM tabiro_migrations WHERE version=?');$version->execute(['20260925000100']);
  if((int)$version->fetchColumn()!==1||array_diff($foundationTables,$names))throw new RuntimeException('The foundation migration is untracked or incomplete; inspect before migrating.');
 }
 file_put_contents($dirty,'Inspect migration state before removing this marker.');
 $app=new \Phinx\Console\PhinxApplication();$app->setAutoExit(false);$app->setCatchExceptions(false);
 $output=new \Symfony\Component\Console\Output\BufferedOutput();
 $code=$app->run(new \Symfony\Component\Console\Input\ArrayInput(['command'=>'migrate','--configuration'=>dirname(__DIR__).'/phinx.php','--environment'=>'local','--no-interaction'=>true]),$output);
 if($code!==0)throw new RuntimeException('Migration failed.');
 $count=(int)$db->query('SELECT COUNT(*) FROM tabiro_migrations')->fetchColumn();
 file_put_contents($ledger,json_encode($checksums,JSON_THROW_ON_ERROR),LOCK_EX);unlink($dirty);
 $result=['success'=>true,'applied_versions'=>$count];$exit=0;
}catch(Throwable){$result=['success'=>false,'category'=>'migration_failed','message'=>'Check local configuration, lock, migration checksums or incomplete-run marker. No automatic retry.' ];}
finally {if(is_resource($lock)){flock($lock,LOCK_UN);fclose($lock);}while(ob_get_level()>$buffer)ob_end_clean();}
echo json_encode($result),PHP_EOL;exit($exit);
