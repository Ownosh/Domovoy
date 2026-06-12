import { pool } from "./client";
import { RowDataPacket } from "mysql2";

// Выполнить запрос, игнорируя ошибку (для идемпотентных ALTER на существующих БД)
async function exec(sql: string): Promise<void> {
    await pool.query(sql).catch(() => {});
}

async function columnExists(table: string, column: string): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column],
    );
    return rows.length > 0;
}

async function tableExists(table: string): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 1 FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [table],
    );
    return rows.length > 0;
}

export async function migrate(): Promise<void> {
    // ============================================================
    //  БАЗОВЫЕ СПРАВОЧНИКИ
    // ============================================================

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
            lat          DECIMAL(9,6)    DEFAULT NULL,
            lng          DECIMAL(9,6)    DEFAULT NULL,
            created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_buildings_key (building_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await exec(`ALTER TABLE buildings ADD COLUMN IF NOT EXISTS lat DECIMAL(9,6) DEFAULT NULL`);
    await exec(`ALTER TABLE buildings ADD COLUMN IF NOT EXISTS lng DECIMAL(9,6) DEFAULT NULL`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            email               VARCHAR(255) NOT NULL,
            password_hash       TEXT NOT NULL,
            data_consent_at     DATETIME NULL,
            is_active           TINYINT(1) NOT NULL DEFAULT 1,
            notif_outages       TINYINT(1) NOT NULL DEFAULT 1,
            notif_meetings      TINYINT(1) NOT NULL DEFAULT 1,
            notif_announcements TINYINT(1) NOT NULL DEFAULT 1,
            notif_general       TINYINT(1) NOT NULL DEFAULT 1,
            expo_push_token     VARCHAR(500) DEFAULT NULL,
            created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS expo_push_token VARCHAR(500) DEFAULT NULL`);

    // ============================================================
    //  КВАРТИРЫ ПОЛЬЗОВАТЕЛЯ + ПРОФИЛЬ
    //  user_apartments — единственный источник данных о доме/квартире/площади.
    //  user_profiles ссылается на «активную» квартиру через active_apartment_id.
    // ============================================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS user_apartments (
            id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id            BIGINT UNSIGNED NOT NULL,
            building_key       VARCHAR(120)    NOT NULL,
            apartment          VARCHAR(20)     NOT NULL DEFAULT '',
            entrance           INT             DEFAULT NULL,
            apartment_area_sqm DECIMAL(6,2)    DEFAULT NULL,
            created_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_ua_user_building_apt (user_id, building_key, apartment),
            CONSTRAINT fk_ua_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_ua_user     (user_id),
            INDEX idx_ua_building (building_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    // Старые установки могли создать таблицу без UNIQUE по (user_id, building_key, apartment)
    await exec(`ALTER TABLE user_apartments ADD CONSTRAINT uq_ua_user_building_apt UNIQUE (user_id, building_key, apartment)`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS user_profiles (
            user_id             BIGINT UNSIGNED NOT NULL,
            full_name           VARCHAR(255) NOT NULL DEFAULT '',
            phone               VARCHAR(50)  NOT NULL DEFAULT '',
            profile_photo       TEXT NULL,
            active_apartment_id BIGINT UNSIGNED DEFAULT NULL,
            created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id),
            CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await exec(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS profile_photo TEXT DEFAULT NULL`);
    await exec(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS active_apartment_id BIGINT UNSIGNED DEFAULT NULL`);

    // --- Миграция старых установок: вынести building_key/apartment/entrances/area из user_profiles в user_apartments ---
    if (await columnExists("user_profiles", "building_key")) {
        // 1. Создаём недостающие квартиры в user_apartments из данных профиля
        await exec(`
            INSERT INTO user_apartments (user_id, building_key, apartment, entrance, apartment_area_sqm)
            SELECT p.user_id, p.building_key, p.apartment, NULLIF(p.entrances, 0), p.apartment_area_sqm
            FROM user_profiles p
            WHERE p.building_key IS NOT NULL
              AND p.active_apartment_id IS NULL
              AND NOT EXISTS (
                  SELECT 1 FROM user_apartments ua
                  WHERE ua.user_id = p.user_id AND ua.building_key = p.building_key AND ua.apartment = p.apartment
              )
        `);
        // 2. Привязываем активную квартиру
        await exec(`
            UPDATE user_profiles p
            JOIN user_apartments ua
                 ON ua.user_id = p.user_id AND ua.building_key = p.building_key AND ua.apartment = p.apartment
            SET p.active_apartment_id = ua.id
            WHERE p.active_apartment_id IS NULL AND p.building_key IS NOT NULL
        `);
        // 3. Убираем дублирующие колонки
        await exec(`ALTER TABLE user_profiles DROP FOREIGN KEY fk_up_building`);
        await exec(`ALTER TABLE user_profiles DROP COLUMN building_key`);
        await exec(`ALTER TABLE user_profiles DROP COLUMN apartment`);
        await exec(`ALTER TABLE user_profiles DROP COLUMN entrances`);
        await exec(`ALTER TABLE user_profiles DROP COLUMN apartment_area_sqm`);
    }
    await exec(`ALTER TABLE user_profiles ADD CONSTRAINT fk_up_active_apartment FOREIGN KEY (active_apartment_id) REFERENCES user_apartments(id) ON DELETE SET NULL`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id     BIGINT UNSIGNED NOT NULL,
            token       VARCHAR(100) NOT NULL,
            expires_at  DATETIME NOT NULL,
            created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY token (token),
            CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ============================================================
    //  ВЕРИФИКАЦИЯ КВАРТИРЫ
    //  Одна заявка = одна квартира (apartment_id). user_id/building_key
    //  выводятся через user_apartments.
    // ============================================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS verification_requests (
            id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            apartment_id BIGINT UNSIGNED NOT NULL,
            doc_type     ENUM('lease','ownership') NOT NULL,
            status       ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
            photo_url    TEXT NOT NULL,
            comment      TEXT DEFAULT NULL,
            submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            reviewed_at  DATETIME DEFAULT NULL,
            created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            CONSTRAINT fk_vr_apartment FOREIGN KEY (apartment_id) REFERENCES user_apartments(id) ON DELETE CASCADE,
            INDEX idx_vr_apartment_submitted (apartment_id, submitted_at DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // --- Миграция старых установок verification_requests (user_id/building_key -> apartment_id) ---
    if (await tableExists("verification_requests") && await columnExists("verification_requests", "user_id")) {
        await exec(`ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS apartment_id BIGINT UNSIGNED DEFAULT NULL`);
        await exec(`ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS comment TEXT DEFAULT NULL`);
        await exec(`ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS reviewed_at DATETIME DEFAULT NULL`);
        await exec(`ALTER TABLE verification_requests DROP COLUMN IF EXISTS reviewer_comment`);

        // Заполняем apartment_id из активной квартиры пользователя
        await exec(`
            UPDATE verification_requests vr
            JOIN user_profiles p ON p.user_id = vr.user_id
            SET vr.apartment_id = p.active_apartment_id
            WHERE vr.apartment_id IS NULL AND p.active_apartment_id IS NOT NULL
        `);
        // Иначе — первая квартира пользователя
        await exec(`
            UPDATE verification_requests vr
            JOIN (SELECT user_id, MIN(id) AS apt_id FROM user_apartments GROUP BY user_id) ua
                 ON ua.user_id = vr.user_id
            SET vr.apartment_id = ua.apt_id
            WHERE vr.apartment_id IS NULL
        `);
        // Заявки без привязки к квартире — удаляем как осиротевшие
        await exec(`DELETE FROM verification_requests WHERE apartment_id IS NULL`);

        await exec(`UPDATE verification_requests SET status = 'pending' WHERE status = 'none'`);
        await exec(`UPDATE verification_requests SET photo_url = '' WHERE photo_url IS NULL`);

        await exec(`ALTER TABLE verification_requests MODIFY COLUMN status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending'`);
        await exec(`ALTER TABLE verification_requests MODIFY COLUMN photo_url TEXT NOT NULL`);
        await exec(`ALTER TABLE verification_requests MODIFY COLUMN apartment_id BIGINT UNSIGNED NOT NULL`);

        await exec(`ALTER TABLE verification_requests DROP FOREIGN KEY fk_vr_user`);
        await exec(`ALTER TABLE verification_requests DROP FOREIGN KEY fk_vr_apartment`);
        await exec(`ALTER TABLE verification_requests DROP COLUMN user_id`);
        await exec(`ALTER TABLE verification_requests DROP COLUMN IF EXISTS building_key`);
        await exec(`ALTER TABLE verification_requests ADD CONSTRAINT fk_vr_apartment FOREIGN KEY (apartment_id) REFERENCES user_apartments(id) ON DELETE CASCADE`);
        await exec(`ALTER TABLE verification_requests ADD INDEX idx_vr_apartment_submitted (apartment_id, submitted_at DESC)`);
    }

    // ============================================================
    //  УК — КОНТАКТЫ ДОМА
    // ============================================================

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
    await exec(`ALTER TABLE building_contacts ADD CONSTRAINT fk_bc_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON DELETE CASCADE ON UPDATE CASCADE`);

    // ============================================================
    //  НОВОСТИ
    // ============================================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS news (
            id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            building_key VARCHAR(120)    NOT NULL,
            title        TEXT            NOT NULL,
            excerpt      TEXT            NOT NULL,
            published_at DATE            NOT NULL,
            is_published TINYINT(1)      NOT NULL DEFAULT 1,
            created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_news_building_published (building_key, published_at DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await exec(`ALTER TABLE news ADD COLUMN IF NOT EXISTS is_published TINYINT(1) NOT NULL DEFAULT 1`);
    await exec(`ALTER TABLE news ADD CONSTRAINT fk_news_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE ON DELETE CASCADE`);

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

    // ============================================================
    //  УВЕДОМЛЕНИЯ
    // ============================================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS notifications (
            id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            building_key VARCHAR(120)    NULL COMMENT 'NULL = всем домам',
            title        VARCHAR(500)    NOT NULL,
            body         TEXT            NOT NULL,
            type         ENUM('outage','meeting','announcement','general') NOT NULL DEFAULT 'general',
            created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_notif_building_created (building_key, created_at DESC),
            INDEX idx_notif_type_created      (type, created_at DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await exec(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS building_key VARCHAR(120) NULL COMMENT 'NULL = всем домам'`);
    await exec(`ALTER TABLE notifications ADD CONSTRAINT fk_notif_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE ON DELETE CASCADE`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS user_notification_reads (
            id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            notification_id BIGINT UNSIGNED NOT NULL,
            user_id         BIGINT UNSIGNED NOT NULL,
            read_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_unr (notification_id, user_id),
            CONSTRAINT fk_unr_notif FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
            CONSTRAINT fk_unr_user  FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ============================================================
    //  ОБРАЩЕНИЯ
    // ============================================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS appeals (
            id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id               BIGINT UNSIGNED NOT NULL,
            building_key          VARCHAR(120)    NOT NULL,
            title                 VARCHAR(500)    NOT NULL,
            body                  TEXT            NOT NULL,
            category              VARCHAR(100)    NOT NULL,
            kind                  ENUM('personal','collective') NOT NULL DEFAULT 'personal',
            status                ENUM('new','collecting_signatures','in_progress','resolved','closed','rejected') NOT NULL DEFAULT 'new',
            entrance              VARCHAR(20)     DEFAULT NULL,
            author_apartment      VARCHAR(20)     NOT NULL DEFAULT '',
            escalated_to_uk       BOOLEAN         NOT NULL DEFAULT FALSE,
            manually_archived     TINYINT(1)      NOT NULL DEFAULT 0,
            admin_comment         TEXT            DEFAULT NULL,
            admin_comment_at      DATETIME        DEFAULT NULL,
            admin_comment_read_at DATETIME        DEFAULT NULL,
            created_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            resolved_at           DATETIME        DEFAULT NULL,
            PRIMARY KEY (id),
            CONSTRAINT fk_appeals_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_appeals_user_created   (user_id, created_at DESC),
            INDEX idx_appeals_status_created (status, created_at DESC),
            INDEX idx_appeals_building_key   (building_key, created_at DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await exec(`ALTER TABLE appeals ADD COLUMN IF NOT EXISTS manually_archived TINYINT(1) NOT NULL DEFAULT 0`);
    await exec(`ALTER TABLE appeals ADD COLUMN IF NOT EXISTS resolved_at DATETIME DEFAULT NULL`);
    await exec(`ALTER TABLE appeals ADD COLUMN IF NOT EXISTS admin_comment TEXT DEFAULT NULL`);
    await exec(`ALTER TABLE appeals ADD COLUMN IF NOT EXISTS admin_comment_at DATETIME DEFAULT NULL`);
    await exec(`ALTER TABLE appeals ADD COLUMN IF NOT EXISTS admin_comment_read_at DATETIME DEFAULT NULL`);
    await exec(`ALTER TABLE appeals ADD CONSTRAINT fk_appeals_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE`);
    // Старые статусы -> новые, затем сужаем ENUM
    await exec(`UPDATE appeals SET status = 'in_progress' WHERE status = 'accepted'`);
    await exec(`UPDATE appeals SET status = 'collecting_signatures' WHERE status = 'mass_appeal'`);
    await exec(`
        ALTER TABLE appeals
        MODIFY COLUMN status
        ENUM('new','collecting_signatures','in_progress','resolved','closed','rejected')
        NOT NULL DEFAULT 'new'
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS appeal_photos (
            id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            appeal_id  BIGINT UNSIGNED NOT NULL,
            image_url  TEXT            NOT NULL,
            position   INT             NOT NULL DEFAULT 0,
            created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            CONSTRAINT fk_aph_appeal FOREIGN KEY (appeal_id) REFERENCES appeals(id) ON DELETE CASCADE,
            INDEX idx_aph_appeal (appeal_id, position)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await exec(`ALTER TABLE appeal_photos MODIFY COLUMN image_url TEXT NOT NULL`);

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
            photo_uri    TEXT            DEFAULT NULL,
            joined_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_ap_appeal_user (appeal_id, user_id),
            CONSTRAINT fk_ap_appeal FOREIGN KEY (appeal_id) REFERENCES appeals(id) ON DELETE CASCADE,
            CONSTRAINT fk_ap_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
            INDEX idx_ap_appeal (appeal_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await exec(`ALTER TABLE appeal_participants MODIFY COLUMN photo_uri TEXT DEFAULT NULL`);

    // ============================================================
    //  ДОМ — ХАРАКТЕРИСТИКИ, ФОТО, СТАТУС, КАЛЕНДАРЬ, МУСОР
    // ============================================================

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
    await exec(`ALTER TABLE house_specs ADD CONSTRAINT fk_hs_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON DELETE CASCADE ON UPDATE CASCADE`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS house_photos (
            id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            building_key VARCHAR(120)    NOT NULL,
            image_url    TEXT            NOT NULL,
            position     INT             NOT NULL DEFAULT 0,
            PRIMARY KEY (id),
            INDEX idx_hph_building_position (building_key, position)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await exec(`ALTER TABLE house_photos MODIFY COLUMN image_url TEXT NOT NULL`);
    await exec(`ALTER TABLE house_photos ADD CONSTRAINT fk_hph_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON DELETE CASCADE ON UPDATE CASCADE`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS house_status (
            id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            building_key VARCHAR(120)    NOT NULL,
            text         VARCHAR(500)    NOT NULL,
            status       ENUM('ok','warning','danger') NOT NULL DEFAULT 'ok',
            position     INT             NOT NULL DEFAULT 0,
            is_active    TINYINT(1)      NOT NULL DEFAULT 1,
            PRIMARY KEY (id),
            INDEX idx_hst_building_position (building_key, position)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await exec(`ALTER TABLE house_status ADD CONSTRAINT fk_hst_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON DELETE CASCADE ON UPDATE CASCADE`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS house_calendar_activities (
            id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            building_key  VARCHAR(120)    NOT NULL,
            activity_date DATE            NOT NULL,
            title         VARCHAR(500)    NOT NULL,
            kind          ENUM('yard','pipes','meeting','heating','garbage','other') NOT NULL DEFAULT 'other',
            created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_hca_building_date (building_key, activity_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await exec(`ALTER TABLE house_calendar_activities ADD CONSTRAINT fk_hca_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON DELETE CASCADE ON UPDATE CASCADE`);

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
    await exec(`ALTER TABLE trash_pickup_schedule ADD CONSTRAINT fk_tps_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON DELETE CASCADE ON UPDATE CASCADE`);

    // ============================================================
    //  ОБЪЯВЛЕНИЯ СОСЕДЕЙ
    // ============================================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS neighbor_ads (
            id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            author_user_id     BIGINT UNSIGNED NOT NULL,
            building_key       VARCHAR(120)    NOT NULL,
            title              VARCHAR(500)    NOT NULL,
            body               TEXT            NOT NULL,
            category           ENUM('sell','buy','service','invite','lost','found','other') NOT NULL DEFAULT 'other',
            status             ENUM('new','under_review','published','archived','rejected','under_review_appeal') NOT NULL DEFAULT 'new',
            show_phone         TINYINT(1)      NOT NULL DEFAULT 0,
            author_phone       VARCHAR(50)     DEFAULT NULL,
            pending_moderation TINYINT(1)      NOT NULL DEFAULT 0,
            archived           TINYINT(1)      NOT NULL DEFAULT 0,
            created_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at         DATETIME        NOT NULL,
            updated_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            CONSTRAINT fk_na_user FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_na_building_created (building_key, created_at DESC),
            INDEX idx_na_author_created   (author_user_id, created_at DESC),
            INDEX idx_na_expires          (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await exec(`ALTER TABLE neighbor_ads DROP COLUMN IF EXISTS image_url`);
    await exec(`ALTER TABLE neighbor_ads DROP COLUMN IF EXISTS image_urls`);
    await exec(`
        ALTER TABLE neighbor_ads ADD COLUMN IF NOT EXISTS status
        ENUM('new','under_review','published','archived','rejected','under_review_appeal')
        NOT NULL DEFAULT 'new'
    `);
    await exec(`ALTER TABLE neighbor_ads ADD CONSTRAINT fk_na_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE`);

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
    await exec(`ALTER TABLE neighbor_ad_photos MODIFY COLUMN image_url TEXT NOT NULL`);

    // ============================================================
    //  ГОЛОСОВАНИЯ
    // ============================================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS votes (
            id               BIGINT UNSIGNED        NOT NULL AUTO_INCREMENT,
            building_key     VARCHAR(120)           NOT NULL,
            user_id          BIGINT UNSIGNED        NULL,
            created_by_label VARCHAR(255)           NOT NULL DEFAULT '',
            sponsor          ENUM('uk','residents') NOT NULL DEFAULT 'residents',
            status           ENUM('new','under_review','active','completed','cancelled') NOT NULL DEFAULT 'new',
            topic            TEXT                   NOT NULL,
            description      TEXT                   NOT NULL DEFAULT '',
            visibility       ENUM('open','secret')  NOT NULL DEFAULT 'open',
            ends_at          DATETIME               NOT NULL,
            closed           TINYINT(1)             NOT NULL DEFAULT 0,
            trial            TINYINT(1)             NOT NULL DEFAULT 0,
            created_at       DATETIME               NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            CONSTRAINT fk_votes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
            INDEX idx_votes_building_key (building_key, created_at DESC),
            INDEX idx_votes_ends_at      (ends_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await exec(`ALTER TABLE votes ADD COLUMN IF NOT EXISTS user_id BIGINT UNSIGNED NULL`);
    await exec(`
        ALTER TABLE votes ADD COLUMN IF NOT EXISTS status
        ENUM('new','under_review','active','completed','cancelled')
        NOT NULL DEFAULT 'new'
    `);
    await exec(`ALTER TABLE votes ADD CONSTRAINT fk_votes_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE`);

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
            CONSTRAINT fk_vc_vote   FOREIGN KEY (vote_id)   REFERENCES votes(id)        ON DELETE CASCADE,
            CONSTRAINT fk_vc_user   FOREIGN KEY (user_id)   REFERENCES users(id)        ON DELETE CASCADE,
            CONSTRAINT fk_vc_option FOREIGN KEY (option_id) REFERENCES vote_options(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ============================================================
    //  ОЦЕНКИ СРЕДЫ
    // ============================================================

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
    await exec(`ALTER TABLE environment_ratings ADD CONSTRAINT fk_er_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE`);

    // ============================================================
    //  РАЙОН (КАРТА)
    // ============================================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS district_pois (
            id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            name         VARCHAR(255)    NOT NULL,
            layer_id     ENUM(
                          'schools_daycare','clinic_pharmacy','grocery','parks',
                          'bus_stops_city','parking_city','waste_yard',
                          'bus_stops_house','parking_house'
                         )              NOT NULL,
            scope        ENUM('city','house') NOT NULL DEFAULT 'city',
            address      VARCHAR(500)    NOT NULL DEFAULT '',
            lat          DOUBLE          NOT NULL,
            lng          DOUBLE          NOT NULL,
            rating       DECIMAL(3,2)    DEFAULT NULL,
            schedule     VARCHAR(500)    DEFAULT NULL,
            photo_url    TEXT            DEFAULT NULL,
            building_key VARCHAR(120)    DEFAULT NULL COMMENT 'NULL = city-wide; задан = только для этого дома',
            created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_dp_layer    (layer_id),
            INDEX idx_dp_building (building_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await exec(`ALTER TABLE district_pois MODIFY COLUMN photo_url TEXT DEFAULT NULL`);
    await exec(`ALTER TABLE district_pois ADD COLUMN IF NOT EXISTS created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`);
    await exec(`ALTER TABLE district_pois ADD CONSTRAINT fk_dp_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE`);

    // ============================================================
    //  АДМИНКА И PUSH-ТОКЕНЫ
    // ============================================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_users (
            id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            email         VARCHAR(255)    NOT NULL,
            password_hash TEXT            NOT NULL,
            full_name     VARCHAR(255)    NOT NULL DEFAULT '',
            is_active     TINYINT(1)      NOT NULL DEFAULT 1,
            created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_admin_users_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS push_tokens (
            id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id    BIGINT UNSIGNED NOT NULL,
            token      VARCHAR(500)    NOT NULL,
            platform   VARCHAR(20)     NOT NULL DEFAULT 'expo',
            created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_pt_user_token (user_id, token),
            CONSTRAINT fk_pt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ============================================================
    //  УДАЛЕНИЕ НЕИСПОЛЬЗУЕМЫХ ОБЪЕКТОВ
    //  (uk_contacts/emergency_* — сценарии ЧС хранятся статично на фронте;
    //   представления appeals_archive/appeals_active/vote_results нигде не используются)
    // ============================================================

    await exec(`DROP VIEW IF EXISTS appeals_archive`);
    await exec(`DROP VIEW IF EXISTS appeals_active`);
    await exec(`DROP VIEW IF EXISTS vote_results`);
    await exec(`DROP TABLE IF EXISTS emergency_scenario_contacts`);
    await exec(`DROP TABLE IF EXISTS emergency_scenario_steps`);
    await exec(`DROP TABLE IF EXISTS emergency_scenarios`);
    await exec(`DROP TABLE IF EXISTS uk_contacts`);

    console.log("Migration complete");
}
