import { pool } from "./client";

export async function migrate(): Promise<void> {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id                  BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            email               VARCHAR(255) NOT NULL,
            password_hash       TEXT NOT NULL,
            data_consent_at     DATETIME NULL,
            is_active           TINYINT(1) NOT NULL DEFAULT 1,
            notif_outages       TINYINT(1) NOT NULL DEFAULT 1,
            notif_meetings      TINYINT(1) NOT NULL DEFAULT 1,
            notif_announcements TINYINT(1) NOT NULL DEFAULT 1,
            notif_general       TINYINT(1) NOT NULL DEFAULT 1,
            created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS user_profiles (
            user_id             BIGINT(20) UNSIGNED NOT NULL,
            full_name           VARCHAR(255) NOT NULL DEFAULT '',
            phone               VARCHAR(50)  NOT NULL DEFAULT '',
            building_key        VARCHAR(120) NULL,
            apartment           VARCHAR(20)  NOT NULL DEFAULT '',
            apartment_area_sqm  DECIMAL(6,2) NULL,
            created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id),
            CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id     BIGINT(20) UNSIGNED NOT NULL,
            token       VARCHAR(100) NOT NULL,
            expires_at  DATETIME NOT NULL,
            created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY token (token),
            CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log("Migration complete");
}
