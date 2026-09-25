<?php
declare(strict_types=1);
namespace Tabiro;
use PDO;
final class Trips {
 public function __construct(private PDO $db,private int $userId) {}
 private function query(string $sql,array $args=[]): \PDOStatement {$q=$this->db->prepare($sql);$q->execute($args);return $q;}
 public function owned(int $id): array {
  $trip=$this->query('SELECT * FROM trips WHERE id=? AND owner_id=?'.($this->db->inTransaction()?' FOR UPDATE':''),[$id,$this->userId])->fetch();
  if(!$trip) throw new ApiError(404,'not_found','Trip not found.');return $trip;
 }
 private function day(int $tripId,int $dayId): array {
  $this->owned($tripId);$day=$this->query('SELECT * FROM itinerary_days WHERE id=? AND trip_id=?',[$dayId,$tripId])->fetch();
  if(!$day) throw new ApiError(404,'not_found','Day not found.');return $day;
 }
 private function stop(int $tripId,int $dayId,int $stopId): array {
  $this->day($tripId,$dayId);$stop=$this->query('SELECT * FROM itinerary_stops WHERE id=? AND day_id=?',[$stopId,$dayId])->fetch();
  if(!$stop) throw new ApiError(404,'not_found','Stop not found.');return $stop;
 }
 public function list(): array {return $this->query('SELECT * FROM trips WHERE owner_id=? ORDER BY updated_at DESC,id DESC',[$this->userId])->fetchAll();}
 public function get(int $id): array {
  $trip=$this->owned($id);$days=$this->query('SELECT * FROM itinerary_days WHERE trip_id=? ORDER BY date,id',[$id])->fetchAll();
  foreach($days as &$day) $day['stops']=$this->query('SELECT * FROM itinerary_stops WHERE day_id=? ORDER BY position,id',[$day['id']])->fetchAll();
  $trip['days']=$days;return $trip;
 }
 private function tripData(array $input): array {
  $title=Http::text($input,'title',200,true);$description=Http::text($input,'description',10000);
  $start=Http::date($input['start_date']??null);$end=Http::date($input['end_date']??null);
  if($end<$start||(new \DateTimeImmutable($start))->diff(new \DateTimeImmutable($end))->days>365) throw new ApiError(422,'validation','Choose a date range of up to 366 days.');
  $travelers=Http::integer($input,'travelers',1,100,1);$vehicle=Http::text($input,'vehicle',200);$budget=Http::integer($input,'budget_minor',0,1000000000000);
  $currency=$input['currency']??'JPY';if(!is_string($currency)||!preg_match('/^[A-Z]{3}$/D',$currency)) throw new ApiError(422,'validation','Invalid currency.');
  if(($input['visibility']??'private')!=='private') throw new ApiError(422,'validation','Only private trips are currently supported.');
  $status=$input['status']??'draft';if(!in_array($status,['draft','planned','completed','archived'],true)) throw new ApiError(422,'validation','Invalid status.');
  return [$title,$description,$start,$end,$travelers,$vehicle,$budget,$currency,$status];
 }
 public function create(array $input): array {
  $values=$this->tripData($input);
  $this->query('INSERT INTO trips(owner_id,title,description,start_date,end_date,travelers,vehicle,budget_minor,currency,status) VALUES(?,?,?,?,?,?,?,?,?,?)',[$this->userId,...$values]);
  $id=(int)$this->db->lastInsertId();$this->query("INSERT INTO trip_members(trip_id,user_id,role) VALUES(?,?,'owner')",[$id,$this->userId]);return $this->get($id);
 }
 public function update(int $id,array $input): array {
  $old=$this->owned($id);$revision=Http::integer($input,'revision',1,PHP_INT_MAX);
  if($revision!==(int)$old['revision']) throw new ApiError(409,'conflict','This trip changed. Reload before saving.');
  $values=$this->tripData(array_replace($old,$input));
  if($this->query('SELECT COUNT(*) FROM itinerary_days WHERE trip_id=? AND (date<? OR date>?)',[$id,$values[2],$values[3]])->fetchColumn()>0) throw new ApiError(422,'validation','Trip dates must include existing itinerary days.');
  $this->query('UPDATE trips SET title=?,description=?,start_date=?,end_date=?,travelers=?,vehicle=?,budget_minor=?,currency=?,status=?,revision=revision+1 WHERE id=?',[...$values,$id]);return $this->get($id);
 }
 public function delete(int $id): void {$this->owned($id);$this->query('DELETE FROM trips WHERE id=?',[$id]);}
 public function addDay(int $id,array $data): array {
  $trip=$this->owned($id);$date=Http::date($data['date']??null);
  if($date<$trip['start_date']||$date>$trip['end_date']) throw new ApiError(422,'validation','Day must fall within trip dates.');
  $notes=Http::text($data,'notes',10000);
  if($this->query('SELECT id FROM itinerary_days WHERE trip_id=? AND date=?',[$id,$date])->fetch()) throw new ApiError(409,'duplicate_day','This day already exists.');
  $this->query('INSERT INTO itinerary_days(trip_id,date,notes) VALUES(?,?,?)',[$id,$date,$notes]);$day=$this->day($id,(int)$this->db->lastInsertId());$day['stops']=[];return $day;
 }
 public function updateDay(int $id,int $dayId,array $data): array {
  $old=$this->day($id,$dayId);$trip=$this->owned($id);$date=Http::date($data['date']??$old['date']);
  if($date<$trip['start_date']||$date>$trip['end_date']) throw new ApiError(422,'validation','Day must fall within trip dates.');
  if($this->query('SELECT id FROM itinerary_days WHERE trip_id=? AND date=? AND id<>?',[$id,$date,$dayId])->fetch()) throw new ApiError(409,'duplicate_day','This day already exists.');
  $this->query('UPDATE itinerary_days SET date=?,notes=? WHERE id=?',[$date,Http::text($data,'notes',10000,false,$old['notes']),$dayId]);return $this->day($id,$dayId);
 }
 public function deleteDay(int $id,int $dayId): void {$this->day($id,$dayId);$this->query('DELETE FROM itinerary_days WHERE id=?',[$dayId]);}
 private function stopData(array $data): array {
  $title=Http::text($data,'title',200,true);$notes=Http::text($data,'notes',10000);$times=[];
  foreach(['arrival_time','departure_time'] as $key) {
   $time=$data[$key]??null;if($time==='') $time=null;
   if($time!==null&&(!is_string($time)||!preg_match('/^([01]\d|2[0-3]):[0-5]\d(:00)?$/D',$time))) throw new ApiError(422,'validation','Invalid time.');
   $times[]=$time===null?null:substr($time,0,5).':00';
  }
  if($times[0]&&$times[1]&&$times[1]<$times[0]) throw new ApiError(422,'validation','Departure must not precede arrival.');
  $status=$data['confirmation_status']??'unconfirmed';if(!in_array($status,['unconfirmed','confirmed','cancelled'],true)) throw new ApiError(422,'validation','Invalid confirmation status.');
  return [$title,...$times,Http::integer($data,'distance_m',0,10000000),Http::integer($data,'driving_minutes',0,10080),Http::integer($data,'estimated_cost_minor',0,1000000000000),$notes,$status];
 }
 public function addStop(int $id,int $dayId,array $data): array {
  $this->day($id,$dayId);$values=$this->stopData($data);$position=(int)$this->query('SELECT COALESCE(MAX(position),0)+1 FROM itinerary_stops WHERE day_id=?',[$dayId])->fetchColumn();
  $this->query('INSERT INTO itinerary_stops(day_id,position,title,arrival_time,departure_time,distance_m,driving_minutes,estimated_cost_minor,notes,confirmation_status) VALUES(?,?,?,?,?,?,?,?,?,?)',[$dayId,$position,...$values]);return $this->stop($id,$dayId,(int)$this->db->lastInsertId());
 }
 public function updateStop(int $id,int $dayId,int $stopId,array $data): array {
  $old=$this->stop($id,$dayId,$stopId);$values=$this->stopData(array_replace($old,$data));
  $this->query('UPDATE itinerary_stops SET title=?,arrival_time=?,departure_time=?,distance_m=?,driving_minutes=?,estimated_cost_minor=?,notes=?,confirmation_status=? WHERE id=?',[...$values,$stopId]);return $this->stop($id,$dayId,$stopId);
 }
 public function deleteStop(int $id,int $dayId,int $stopId): void {$this->stop($id,$dayId,$stopId);$this->query('DELETE FROM itinerary_stops WHERE id=?',[$stopId]);}
 public function order(int $id,int $dayId,array $data): array {
  $this->day($id,$dayId);$ids=$data['stop_ids']??null;
  $existing=array_map('intval',$this->query('SELECT id FROM itinerary_stops WHERE day_id=? ORDER BY id',[$dayId])->fetchAll(PDO::FETCH_COLUMN));
  if(!is_array($ids)||!array_is_list($ids)||count($ids)!==count($existing)||array_filter($ids,fn($n)=>!is_int($n)||$n<1)) throw new ApiError(422,'validation','Send each stop exactly once.');
  $sorted=$ids;sort($sorted,SORT_NUMERIC);if($sorted!==$existing) throw new ApiError(422,'validation','Send each stop exactly once.');
  // Unique positive positions move into a negative namespace before final assignment.
  $this->query('UPDATE itinerary_stops SET position=-position WHERE day_id=?',[$dayId]);
  foreach($ids as $index=>$stopId) $this->query('UPDATE itinerary_stops SET position=? WHERE id=? AND day_id=?',[$index+1,$stopId,$dayId]);
  return $this->query('SELECT * FROM itinerary_stops WHERE day_id=? ORDER BY position',[$dayId])->fetchAll();
 }
}
