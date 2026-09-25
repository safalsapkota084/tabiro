<?php
declare(strict_types=1);
use Phinx\Migration\AbstractMigration;
final class Foundation extends AbstractMigration {
 public function up(): void {
  $tables = [
'users'=>"id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, email VARCHAR(254) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, name VARCHAR(100) NOT NULL, locale VARCHAR(5) NOT NULL DEFAULT 'en', status VARCHAR(20) NOT NULL DEFAULT 'active', verified_at DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
'roles'=>"id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(32) NOT NULL UNIQUE",
'user_roles'=>"user_id BIGINT UNSIGNED NOT NULL, role_id BIGINT UNSIGNED NOT NULL, PRIMARY KEY(user_id,role_id), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(role_id) REFERENCES roles(id) ON DELETE RESTRICT",
'sessions'=>"token_hash CHAR(64) PRIMARY KEY, user_id BIGINT UNSIGNED NULL, csrf_token CHAR(64) NOT NULL, expires_at DATETIME NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX(expires_at), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE",
'auth_tokens'=>"id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, token_hash CHAR(64) NOT NULL UNIQUE, purpose VARCHAR(30) NOT NULL, expires_at DATETIME NOT NULL, consumed_at DATETIME NULL, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE",
'auth_rate_limits'=>"bucket CHAR(64) PRIMARY KEY, attempts INT UNSIGNED NOT NULL, expires_at DATETIME NOT NULL, INDEX(expires_at)",
'destinations'=>"id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(200) NOT NULL, category VARCHAR(40) NOT NULL DEFAULT 'attraction', latitude DECIMAL(10,7) NULL, longitude DECIMAL(10,7) NULL, source_url VARCHAR(2048) NULL, verified_at DATETIME NULL",
 'trips'=>"id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, owner_id BIGINT UNSIGNED NOT NULL, title VARCHAR(200) NOT NULL, description TEXT NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL, travelers SMALLINT UNSIGNED NOT NULL DEFAULT 1, vehicle VARCHAR(200) NOT NULL DEFAULT '', budget_minor BIGINT UNSIGNED NOT NULL DEFAULT 0, currency CHAR(3) NOT NULL DEFAULT 'JPY', visibility VARCHAR(20) NOT NULL DEFAULT 'private', status VARCHAR(20) NOT NULL DEFAULT 'draft', revision INT UNSIGNED NOT NULL DEFAULT 1, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE RESTRICT, INDEX(owner_id,updated_at), CHECK(end_date >= start_date)",
 'trip_members'=>"trip_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL, role VARCHAR(20) NOT NULL DEFAULT 'viewer', PRIMARY KEY(trip_id,user_id), FOREIGN KEY(trip_id) REFERENCES trips(id) ON DELETE CASCADE, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE",
 'itinerary_days'=>"id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, trip_id BIGINT UNSIGNED NOT NULL, date DATE NOT NULL, notes TEXT NOT NULL, UNIQUE(trip_id,date), FOREIGN KEY(trip_id) REFERENCES trips(id) ON DELETE CASCADE",
 'itinerary_stops'=>"id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, day_id BIGINT UNSIGNED NOT NULL, destination_id BIGINT UNSIGNED NULL, title VARCHAR(200) NOT NULL, position INT NOT NULL, arrival_time TIME NULL, departure_time TIME NULL, distance_m INT UNSIGNED NOT NULL DEFAULT 0, driving_minutes INT UNSIGNED NOT NULL DEFAULT 0, estimated_cost_minor BIGINT UNSIGNED NOT NULL DEFAULT 0, notes TEXT NOT NULL, confirmation_status VARCHAR(20) NOT NULL DEFAULT 'unconfirmed', UNIQUE(day_id,position), FOREIGN KEY(day_id) REFERENCES itinerary_days(id) ON DELETE CASCADE, FOREIGN KEY(destination_id) REFERENCES destinations(id) ON DELETE RESTRICT",
 ];
 foreach($tables as $name=>$definition) $this->execute("CREATE TABLE `$name` ($definition) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
 $this->execute("INSERT INTO roles (name) VALUES ('user'), ('administrator')");
 }
 public function down(): void { throw new RuntimeException('Destructive rollback disabled. Use a reviewed recovery migration.'); }
}
