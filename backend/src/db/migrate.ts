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
            entrances           INT          NOT NULL DEFAULT 0,
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
            user_id          BIGINT UNSIGNED        NULL,
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
            INDEX idx_votes_building (building_key, created_at DESC),
            CONSTRAINT fk_vote_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    // Для существующих БД — добавляем user_id если ещё нет
    await pool.query(`ALTER TABLE votes ADD COLUMN IF NOT EXISTS user_id BIGINT UNSIGNED NULL`).catch(() => {});

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

    await pool.query(`
        CREATE TABLE IF NOT EXISTS appeals (
            id               BIGINT UNSIGNED                                                          NOT NULL AUTO_INCREMENT,
            user_id          BIGINT UNSIGNED                                                          NOT NULL,
            title            VARCHAR(500)                                                             NOT NULL,
            body             TEXT                                                                     NOT NULL,
            category         VARCHAR(100)                                                             NOT NULL,
            status           ENUM('new','accepted','in_progress','mass_appeal','resolved','rejected') NOT NULL DEFAULT 'new',
            kind             ENUM('personal','collective')                                            NOT NULL DEFAULT 'personal',
            building_key     VARCHAR(120)                                                             NOT NULL,
            entrance         VARCHAR(20)                                                              DEFAULT NULL,
            author_apartment VARCHAR(20)                                                              NOT NULL DEFAULT '',
            escalated_to_uk  BOOLEAN                                                                  NOT NULL DEFAULT FALSE,
            created_at       DATETIME                                                                 NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at       DATETIME                                                                 NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            resolved_at      DATETIME                                                                 DEFAULT NULL,
            PRIMARY KEY (id),
            CONSTRAINT fk_appeals_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_appeals_user_created   (user_id, created_at DESC),
            INDEX idx_appeals_status_created (status, created_at DESC),
            INDEX idx_appeals_building_key   (building_key, created_at DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS appeal_photos (
            id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            appeal_id  BIGINT UNSIGNED NOT NULL,
            image_url  VARCHAR(500)    NOT NULL,
            position   INT             NOT NULL DEFAULT 0,
            created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            CONSTRAINT fk_aph_appeal FOREIGN KEY (appeal_id) REFERENCES appeals(id) ON DELETE CASCADE,
            INDEX idx_aph_appeal (appeal_id, position)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS appeal_participants (
            id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            appeal_id    BIGINT UNSIGNED NOT NULL,
            user_id      BIGINT UNSIGNED NOT NULL,
            apartment    VARCHAR(20)     NOT NULL,
            entrance     VARCHAR(20)     DEFAULT NULL,
            display_name VARCHAR(255)    NOT NULL DEFAULT '',
            anonymous    BOOLEAN         NOT NULL DEFAULT FALSE,
            comment      TEXT            DEFAULT NULL,
            photo_uri    VARCHAR(500)    DEFAULT NULL,
            joined_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_ap_appeal_user (appeal_id, user_id),
            CONSTRAINT fk_ap_appeal FOREIGN KEY (appeal_id) REFERENCES appeals(id) ON DELETE CASCADE,
            CONSTRAINT fk_ap_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
            INDEX idx_ap_appeal (appeal_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS house_specs (
            id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            building_key VARCHAR(120)    NOT NULL,
            label        VARCHAR(255)    NOT NULL,
            value        TEXT            NOT NULL,
            position     INT             NOT NULL DEFAULT 0,
            PRIMARY KEY (id),
            INDEX idx_hs_building_position (building_key, position)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS house_photos (
            id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            building_key VARCHAR(120)    NOT NULL,
            image_url    VARCHAR(500)    NOT NULL,
            position     INT             NOT NULL DEFAULT 0,
            PRIMARY KEY (id),
            INDEX idx_hph_building_position (building_key, position)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS house_calendar_activities (
            id            BIGINT UNSIGNED                                            NOT NULL AUTO_INCREMENT,
            building_key  VARCHAR(120)                                               NOT NULL,
            activity_date DATE                                                       NOT NULL,
            title         VARCHAR(500)                                               NOT NULL,
            kind          ENUM('yard','pipes','meeting','heating','garbage','other') NOT NULL DEFAULT 'other',
            created_at    DATETIME                                                   NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_hca_building_date (building_key, activity_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS trash_pickup_schedule (
            id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            building_key VARCHAR(120)    NOT NULL,
            title        VARCHAR(255)    NOT NULL,
            schedule     VARCHAR(255)    NOT NULL,
            note         TEXT            DEFAULT NULL,
            position     INT             NOT NULL DEFAULT 0,
            PRIMARY KEY (id),
            INDEX idx_tps_building_position (building_key, position)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS environment_ratings (
            id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id         BIGINT UNSIGNED NOT NULL,
            building_key    VARCHAR(120)    NOT NULL,
            month_key       CHAR(7)         NOT NULL,
            courtyard_stars TINYINT         NOT NULL,
            entrance_stars  TINYINT         NOT NULL,
            uk_stars        TINYINT         NOT NULL,
            feedback_tags   JSON            DEFAULT NULL,
            feedback_other  TEXT            DEFAULT NULL,
            submitted_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_er_user_month (user_id, month_key),
            CONSTRAINT fk_er_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_er_building_month (building_key, month_key DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS notifications (
            id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            building_key VARCHAR(120)    NULL COMMENT 'NULL = всем домам',
            title        VARCHAR(500)    NOT NULL,
            body         TEXT            NOT NULL,
            type         ENUM('outage','meeting','announcement','general') NOT NULL DEFAULT 'general',
            created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_notif_building (building_key, created_at DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    // таблица могла существовать без building_key — добавляем если нет
    await pool.query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS building_key VARCHAR(120) NULL COMMENT 'NULL = всем домам'`).catch(() => {});

    await pool.query(`
        CREATE TABLE IF NOT EXISTS user_notification_reads (
            id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            notification_id BIGINT UNSIGNED NOT NULL,
            user_id         BIGINT UNSIGNED NOT NULL,
            read_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
y            CONSTRAINT fk_unr_notif FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
            CONSTRAINT fk_unr_user  FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS house_status (
            id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            building_key VARCHAR(120)    NOT NULL,
            text         VARCHAR(500)    NOT NULL,
            status       ENUM('ok','warning','danger') NOT NULL DEFAULT 'ok',
            position     INT             NOT NULL DEFAULT 0,
            is_active    TINYINT(1)      NOT NULL DEFAULT 1,
            PRIMARY KEY (id),
            INDEX idx_hs_building (building_key, position)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS building_contacts (
            id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            building_key VARCHAR(120)    NOT NULL,
            company_name VARCHAR(255)    NOT NULL DEFAULT '',
            phone        VARCHAR(100)    NOT NULL DEFAULT '',
            email        VARCHAR(255)    NOT NULL DEFAULT '',
            site         VARCHAR(255)    NOT NULL DEFAULT '',
            hours        VARCHAR(255)    NOT NULL DEFAULT '',
            PRIMARY KEY (id),
            UNIQUE KEY uq_bc_building (building_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Expo Push Token для push-уведомлений
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS expo_push_token VARCHAR(500) DEFAULT NULL`).catch(() => {});

    // Фото профиля пользователя (URL на сервере)
    await pool.query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS profile_photo TEXT DEFAULT NULL`).catch(() => {});
    await pool.query(`ALTER TABLE user_profiles MODIFY COLUMN profile_photo TEXT DEFAULT NULL`).catch(() => {});

    // Архивирование обращений
    await pool.query(`ALTER TABLE appeals ADD COLUMN IF NOT EXISTS manually_archived TINYINT(1) NOT NULL DEFAULT 0`).catch(() => {});
    // resolved_at уже должна быть в таблице, но добавим на случай если нет
    await pool.query(`ALTER TABLE appeals ADD COLUMN IF NOT EXISTS resolved_at DATETIME DEFAULT NULL`).catch(() => {});

    // Фото хранятся как URL на сервере (TEXT достаточно)
    await pool.query(`ALTER TABLE district_pois MODIFY COLUMN photo_url TEXT DEFAULT NULL`).catch(() => {});
    await pool.query(`ALTER TABLE house_photos MODIFY COLUMN image_url TEXT NOT NULL`).catch(() => {});
    await pool.query(`ALTER TABLE appeal_photos MODIFY COLUMN image_url TEXT NOT NULL`).catch(() => {});
    await pool.query(`ALTER TABLE neighbor_ad_photos MODIFY COLUMN image_url TEXT NOT NULL`).catch(() => {});
    await pool.query(`ALTER TABLE appeal_participants MODIFY COLUMN photo_uri TEXT DEFAULT NULL`).catch(() => {});
    // verification_requests — фото документа
    await pool.query(`ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT NULL`).catch(() => {});
    await pool.query(`ALTER TABLE verification_requests MODIFY COLUMN photo_url TEXT DEFAULT NULL`).catch(() => {});
    await pool.query(`ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS building_key VARCHAR(120) DEFAULT NULL`).catch(() => {});
    await pool.query(`ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS comment TEXT DEFAULT NULL`).catch(() => {});
    await pool.query(`ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS reviewed_at DATETIME DEFAULT NULL`).catch(() => {});

    await pool.query(`
        CREATE TABLE IF NOT EXISTS neighbor_ad_photos (
            id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            ad_id      BIGINT UNSIGNED NOT NULL,
            image_url  TEXT            NOT NULL,
            position   INT             NOT NULL DEFAULT 0,
            is_primary TINYINT(1)      NOT NULL DEFAULT 0,
            created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            CONSTRAINT fk_nap_ad FOREIGN KEY (ad_id) REFERENCES neighbor_ads(id) ON DELETE CASCADE,
            INDEX idx_nap_ad (ad_id, position)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // lat/lng здания — для якоря карты района
    await pool.query(`ALTER TABLE buildings ADD COLUMN IF NOT EXISTS lat DECIMAL(9,6) DEFAULT NULL`).catch(() => {});
    await pool.query(`ALTER TABLE buildings ADD COLUMN IF NOT EXISTS lng DECIMAL(9,6) DEFAULT NULL`).catch(() => {});

    await pool.query(`
        CREATE TABLE IF NOT EXISTS district_pois (
            id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            building_key VARCHAR(120)    NULL     COMMENT 'NULL = city-wide; задан = только для этого дома',
            layer_id     VARCHAR(50)     NOT NULL,
            scope        ENUM('city','house') NOT NULL DEFAULT 'city',
            name         VARCHAR(500)    NOT NULL,
            address      VARCHAR(500)    NOT NULL DEFAULT '',
            lat          DECIMAL(9,6)    NOT NULL,
            lng          DECIMAL(9,6)    NOT NULL,
            photo_url    VARCHAR(500)    DEFAULT NULL,
            schedule     TEXT            DEFAULT NULL,
            rating       DECIMAL(3,1)    DEFAULT NULL,
            PRIMARY KEY (id),
            INDEX idx_dp_scope_layer (scope, layer_id),
            INDEX idx_dp_building    (building_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Миграция старых статусов обращений на новые
    await pool.query(`UPDATE appeals SET status = 'in_progress' WHERE status = 'accepted'`).catch(() => {});
    await pool.query(`UPDATE appeals SET status = 'collecting_signatures' WHERE status = 'mass_appeal'`).catch(() => {});

    // Комментарий администратора к обращению
    await pool.query(`ALTER TABLE appeals ADD COLUMN IF NOT EXISTS admin_comment TEXT DEFAULT NULL`).catch(() => {});
    await pool.query(`ALTER TABLE appeals ADD COLUMN IF NOT EXISTS admin_comment_at DATETIME DEFAULT NULL`).catch(() => {});

    // Новые статусы обращений
    await pool.query(`
        ALTER TABLE appeals
        MODIFY COLUMN status
        ENUM('new','collecting_signatures','in_progress','resolved','closed','rejected',
             'accepted','mass_appeal')
        NOT NULL DEFAULT 'new'
    `).catch(() => {});

    // Статус голосований
    await pool.query(`
        ALTER TABLE votes ADD COLUMN IF NOT EXISTS status
        ENUM('new','under_review','active','completed','cancelled')
        NOT NULL DEFAULT 'new'
    `).catch(() => {});

    // Статус объявлений
    await pool.query(`
        ALTER TABLE neighbor_ads ADD COLUMN IF NOT EXISTS status
        ENUM('new','under_review','published','archived','rejected','under_review_appeal')
        NOT NULL DEFAULT 'new'
    `).catch(() => {});

    console.log("Migration complete");
}
