import { pool } from "./client";

export async function migrate(): Promise<void> {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS buildings (
            id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            building_key VARCHAR(120)    NOT NULL,
            address      TEXT            NOT NULL,
            short_name   VARCHAR(255)    NOT NULL,
            city         VARCHAR(255)    NOT NULL DEFAULT '',
            is_active    TINYINT(1)      NOT NULL DEFAULT 1,
            year_built   INT             DEFAULT NULL,
            entrances    INT             DEFAULT NULL,
            apartments   INT             DEFAULT NULL,
            created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_buildings_key (building_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

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

    await pool.query(`
        CREATE TABLE IF NOT EXISTS news (
            id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            building_key VARCHAR(120)    NOT NULL,
            title        TEXT            NOT NULL,
            excerpt      TEXT            NOT NULL,
            published_at DATE            NOT NULL,
            created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_news_building_published (building_key, published_at DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS news_photos (
            id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            news_id   BIGINT UNSIGNED NOT NULL,
            image_url VARCHAR(500)    NOT NULL,
            position  INT             NOT NULL DEFAULT 0,
            PRIMARY KEY (id),
            CONSTRAINT fk_np_news FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE,
            INDEX idx_np_news (news_id, position)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS votes (
            id               BIGINT UNSIGNED        NOT NULL AUTO_INCREMENT,
            building_key     VARCHAR(120)           NOT NULL,
            created_by_label VARCHAR(255)           NOT NULL DEFAULT '',
            sponsor          ENUM('uk','residents') NOT NULL DEFAULT 'residents',
            topic            TEXT                   NOT NULL,
            description      TEXT                   NOT NULL DEFAULT '',
            visibility       ENUM('open','secret')  NOT NULL DEFAULT 'open',
            ends_at          DATETIME               NOT NULL,
            closed           TINYINT(1)             NOT NULL DEFAULT 0,
            trial            TINYINT(1)             NOT NULL DEFAULT 0,
            created_at       DATETIME               NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_votes_building (building_key, created_at DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS vote_options (
            id       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            vote_id  BIGINT UNSIGNED NOT NULL,
            label    TEXT            NOT NULL,
            position INT             NOT NULL DEFAULT 0,
            PRIMARY KEY (id),
            CONSTRAINT fk_vo_vote FOREIGN KEY (vote_id) REFERENCES votes(id) ON DELETE CASCADE,
            INDEX idx_vo_vote (vote_id, position)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS vote_casts (
            id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            vote_id   BIGINT UNSIGNED NOT NULL,
            user_id   BIGINT UNSIGNED NOT NULL,
            option_id BIGINT UNSIGNED NOT NULL,
            area_sqm  DECIMAL(6,2)    NOT NULL DEFAULT 0,
            voted_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_vc_vote_user (vote_id, user_id),
            CONSTRAINT fk_vc_vote FOREIGN KEY (vote_id)   REFERENCES votes(id)        ON DELETE CASCADE,
            CONSTRAINT fk_vc_user FOREIGN KEY (user_id)   REFERENCES users(id)         ON DELETE CASCADE,
            CONSTRAINT fk_vc_opt  FOREIGN KEY (option_id) REFERENCES vote_options(id)  ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS neighbor_ads (
            id                 BIGINT UNSIGNED                                              NOT NULL AUTO_INCREMENT,
            author_user_id     BIGINT UNSIGNED                                              NOT NULL,
            building_key       VARCHAR(120)                                                 NOT NULL,
            title              VARCHAR(500)                                                 NOT NULL,
            body               TEXT                                                         NOT NULL,
            category           ENUM('sell','buy','service','invite','lost','found','other') NOT NULL DEFAULT 'other',
            image_url          VARCHAR(500)                                                 DEFAULT NULL,
            show_phone         TINYINT(1)                                                   NOT NULL DEFAULT 0,
            author_phone       VARCHAR(50)                                                  DEFAULT NULL,
            pending_moderation TINYINT(1)                                                   NOT NULL DEFAULT 0,
            archived           TINYINT(1)                                                   NOT NULL DEFAULT 0,
            created_at         DATETIME                                                     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at         DATETIME                                                     NOT NULL,
            updated_at         DATETIME                                                     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            CONSTRAINT fk_na_user FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_na_building (building_key, created_at DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log("Migration complete");
}
