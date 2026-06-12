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
            PRIMARY KEY (building_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await exec(`ALTER TABLE buildings ADD COLUMN IF NOT EXISTS lat DECIMAL(9,6) DEFAULT NULL`);
    await exec(`ALTER TABLE buildings ADD COLUMN IF NOT EXISTS lng DECIMAL(9,6) DEFAULT NULL`);

    // Старые установки: buildings.id — избыточный суррогатный ключ, все FK уже ссылаются на building_key
    if (await columnExists("buildings", "id")) {
        await exec(`
            ALTER TABLE buildings
                MODIFY id BIGINT UNSIGNED NOT NULL,
                DROP PRIMARY KEY,
                ADD PRIMARY KEY (building_key),
                DROP COLUMN id
        `);
        await exec(`ALTER TABLE buildings DROP INDEX uq_buildings_key`);
    }

    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            email               VARCHAR(255) NOT NULL,
            password_hash       VARCHAR(255) NOT NULL,
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
    await exec(`ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) NOT NULL`);

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
            token_hash  CHAR(64) NOT NULL,
            expires_at  DATETIME NOT NULL,
            created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_rt_token_hash (token_hash),
            CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Старые установки хранили refresh-токен в открытом виде — переходим на SHA-256 хеш
    if (await columnExists("refresh_tokens", "token")) {
        await exec(`ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS token_hash CHAR(64) DEFAULT NULL`);
        await exec(`UPDATE refresh_tokens SET token_hash = SHA2(token, 256) WHERE token_hash IS NULL`);
        await exec(`ALTER TABLE refresh_tokens DROP INDEX token`);
        await exec(`ALTER TABLE refresh_tokens DROP COLUMN token`);
        await exec(`ALTER TABLE refresh_tokens MODIFY COLUMN token_hash CHAR(64) NOT NULL`);
        await exec(`ALTER TABLE refresh_tokens ADD UNIQUE KEY uq_rt_token_hash (token_hash)`);
    }

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

    await pool.query(`
        CREATE TABLE IF NOT EXISTS verification_photos (
            id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            request_id BIGINT UNSIGNED NOT NULL,
            image_url  TEXT            NOT NULL,
            position   INT             NOT NULL DEFAULT 0,
            created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            CONSTRAINT fk_vp_request FOREIGN KEY (request_id) REFERENCES verification_requests(id) ON DELETE CASCADE,
            INDEX idx_vp_request (request_id, position)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // --- Перенос старого единственного photo_url в verification_photos (для старых установок) ---
    if (await columnExists("verification_requests", "photo_url")) {
        await exec(`
            INSERT INTO verification_photos (request_id, image_url, position)
            SELECT id, photo_url, 0 FROM verification_requests
            WHERE photo_url IS NOT NULL AND photo_url <> ''
        `);
        await exec(`ALTER TABLE verification_requests DROP COLUMN photo_url`);
    }

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

        await exec(`ALTER TABLE verification_requests MODIFY COLUMN status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending'`);
        await exec(`ALTER TABLE verification_requests MODIFY COLUMN apartment_id BIGINT UNSIGNED NOT NULL`);

        await exec(`ALTER TABLE verification_requests DROP FOREIGN KEY fk_vr_user`);
        await exec(`ALTER TABLE verification_requests DROP FOREIGN KEY fk_vr_apartment`);
        await exec(`ALTER TABLE verification_requests DROP COLUMN user_id`);
        await exec(`ALTER TABLE verification_requests DROP COLUMN IF EXISTS building_key`);
        await exec(`ALTER TABLE verification_requests ADD CONSTRAINT fk_vr_apartment FOREIGN KEY (apartment_id) REFERENCES user_apartments(id) ON DELETE CASCADE`);
        await exec(`ALTER TABLE verification_requests ADD INDEX idx_vr_apartment_submitted (apartment_id, submitted_at DESC)`);
        await exec(`ALTER TABLE verification_requests ADD INDEX idx_vr_status (status)`);
    }

    // ============================================================
    //  УК — КОНТАКТЫ ДОМА
    // ============================================================

    // management_companies — одна УК может обслуживать несколько домов (buildings.management_company_id)
    await pool.query(`
        CREATE TABLE IF NOT EXISTS management_companies (
            id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            company_name VARCHAR(255)    NOT NULL DEFAULT '',
            phone        VARCHAR(100)    NOT NULL DEFAULT '',
            email        VARCHAR(255)    NOT NULL DEFAULT '',
            site         VARCHAR(255)    NOT NULL DEFAULT '',
            hours        VARCHAR(255)    NOT NULL DEFAULT '',
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await exec(`ALTER TABLE buildings ADD COLUMN IF NOT EXISTS management_company_id BIGINT UNSIGNED DEFAULT NULL`);

    // Перенос старых building_contacts (1:1 с домом) в management_companies (1:N)
    if (await tableExists("building_contacts")) {
        await exec(`
            INSERT INTO management_companies (company_name, phone, email, site, hours)
            SELECT DISTINCT company_name, phone, email, site, hours FROM building_contacts
        `);
        await exec(`
            UPDATE buildings b
            JOIN building_contacts bc ON bc.building_key = b.building_key
            JOIN management_companies mc
                ON mc.company_name = bc.company_name AND mc.phone = bc.phone
               AND mc.email = bc.email AND mc.site = bc.site AND mc.hours = bc.hours
            SET b.management_company_id = mc.id
        `);
        await exec(`DROP TABLE building_contacts`);
    }

    await exec(`ALTER TABLE buildings ADD CONSTRAINT fk_buildings_mc FOREIGN KEY (management_company_id) REFERENCES management_companies(id) ON DELETE SET NULL`);

    // building_chats — официальные чаты дома (Telegram/VK/Max)
    await pool.query(`
        CREATE TABLE IF NOT EXISTS building_chats (
            id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            building_key VARCHAR(120)    NOT NULL,
            platform     ENUM('telegram','vk','max') NOT NULL,
            url          VARCHAR(500)    NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uq_building_chats (building_key, platform)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    // Удаление дома не должно молча сносить контент — building_key FK везде RESTRICT (только ON UPDATE CASCADE)
    await exec(`ALTER TABLE building_chats DROP FOREIGN KEY fk_building_chats_building`);
    await exec(`ALTER TABLE building_chats ADD CONSTRAINT fk_building_chats_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE`);

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
    await exec(`ALTER TABLE news DROP FOREIGN KEY fk_news_building`);
    await exec(`ALTER TABLE news ADD CONSTRAINT fk_news_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS news_photos (
            id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            news_id   BIGINT UNSIGNED NOT NULL,
            image_url TEXT            NOT NULL,
            position  INT             NOT NULL DEFAULT 0,
            PRIMARY KEY (id),
            CONSTRAINT fk_np_news FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE,
            INDEX idx_np_news (news_id, position)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await exec(`ALTER TABLE news_photos MODIFY COLUMN image_url TEXT NOT NULL`);

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
    await exec(`ALTER TABLE notifications DROP FOREIGN KEY fk_notif_building`);
    await exec(`ALTER TABLE notifications ADD CONSTRAINT fk_notif_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE`);

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
            category              ENUM('Аварийная ситуация','Сантехника','Электрика','Отопление','Вентиляция','Уборка и благоустройство','Нарушение порядка','Инициатива собрания собственников','Другое') NOT NULL DEFAULT 'Другое',
            kind                  ENUM('personal','collective') NOT NULL DEFAULT 'personal',
            status                ENUM('new','collecting_signatures','in_progress','resolved','closed','rejected') NOT NULL DEFAULT 'new',
            entrance              INT             DEFAULT NULL,
            author_apartment      VARCHAR(20)     NOT NULL DEFAULT '' COMMENT 'снепшот на момент подачи, не синхронизируется с user_apartments.apartment',
            author_apartment_id   BIGINT UNSIGNED DEFAULT NULL,
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
    await exec(`ALTER TABLE appeals MODIFY COLUMN author_apartment VARCHAR(20) NOT NULL DEFAULT '' COMMENT 'снепшот на момент подачи, не синхронизируется с user_apartments.apartment'`);
    await exec(`ALTER TABLE appeals ADD COLUMN IF NOT EXISTS manually_archived TINYINT(1) NOT NULL DEFAULT 0`);
    await exec(`ALTER TABLE appeals ADD COLUMN IF NOT EXISTS resolved_at DATETIME DEFAULT NULL`);
    await exec(`ALTER TABLE appeals ADD COLUMN IF NOT EXISTS admin_comment TEXT DEFAULT NULL`);
    await exec(`ALTER TABLE appeals ADD COLUMN IF NOT EXISTS admin_comment_at DATETIME DEFAULT NULL`);
    await exec(`ALTER TABLE appeals ADD COLUMN IF NOT EXISTS admin_comment_read_at DATETIME DEFAULT NULL`);
    await exec(`ALTER TABLE appeals ADD CONSTRAINT fk_appeals_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE`);
    await exec(`ALTER TABLE appeals ADD COLUMN IF NOT EXISTS author_apartment_id BIGINT UNSIGNED DEFAULT NULL`);
    await exec(`
        UPDATE appeals a
        JOIN user_apartments ua ON ua.user_id = a.user_id AND ua.building_key = a.building_key AND ua.apartment = a.author_apartment
        SET a.author_apartment_id = ua.id
        WHERE a.author_apartment_id IS NULL
    `);
    await exec(`ALTER TABLE appeals ADD CONSTRAINT fk_appeals_apartment FOREIGN KEY (author_apartment_id) REFERENCES user_apartments(id) ON DELETE SET NULL`);
    await exec(`ALTER TABLE appeals ADD INDEX idx_appeals_apartment (author_apartment_id)`);

    // category -> ENUM (был свободный VARCHAR без проверки на фронтовый список категорий)
    await exec(`
        UPDATE appeals SET category = 'Другое'
        WHERE category NOT IN (
            'Аварийная ситуация','Сантехника','Электрика','Отопление','Вентиляция',
            'Уборка и благоустройство','Нарушение порядка','Инициатива собрания собственников','Другое'
        )
    `);
    await exec(`
        ALTER TABLE appeals MODIFY COLUMN category
        ENUM('Аварийная ситуация','Сантехника','Электрика','Отопление','Вентиляция','Уборка и благоустройство','Нарушение порядка','Инициатива собрания собственников','Другое')
        NOT NULL DEFAULT 'Другое'
    `);
    // Старые установки хранили entrance как VARCHAR(20) — приводим к INT, как в user_apartments.entrance
    await exec(`ALTER TABLE appeals MODIFY COLUMN entrance INT DEFAULT NULL`);
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
            apartment    VARCHAR(20)     NOT NULL COMMENT 'снепшот на момент присоединения, не синхронизируется с user_apartments.apartment',
            apartment_id BIGINT UNSIGNED DEFAULT NULL,
            entrance     INT             DEFAULT NULL,
            display_name VARCHAR(255)    NOT NULL DEFAULT '' COMMENT 'снепшот имени на момент присоединения, не синхронизируется с user_profiles.full_name',
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
    await exec(`ALTER TABLE appeal_participants MODIFY COLUMN apartment VARCHAR(20) NOT NULL COMMENT 'снепшот на момент присоединения, не синхронизируется с user_apartments.apartment'`);
    await exec(`ALTER TABLE appeal_participants MODIFY COLUMN display_name VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'снепшот имени на момент присоединения, не синхронизируется с user_profiles.full_name'`);
    await exec(`ALTER TABLE appeal_participants MODIFY COLUMN photo_uri TEXT DEFAULT NULL`);
    await exec(`ALTER TABLE appeal_participants MODIFY COLUMN entrance INT DEFAULT NULL`);
    await exec(`ALTER TABLE appeal_participants ADD COLUMN IF NOT EXISTS apartment_id BIGINT UNSIGNED DEFAULT NULL`);
    await exec(`
        UPDATE appeal_participants ap
        JOIN appeals a ON a.id = ap.appeal_id
        JOIN user_apartments ua ON ua.user_id = ap.user_id AND ua.building_key = a.building_key AND ua.apartment = ap.apartment
        SET ap.apartment_id = ua.id
        WHERE ap.apartment_id IS NULL
    `);
    await exec(`ALTER TABLE appeal_participants ADD CONSTRAINT fk_ap_apartment FOREIGN KEY (apartment_id) REFERENCES user_apartments(id) ON DELETE SET NULL`);
    await exec(`ALTER TABLE appeal_participants ADD INDEX idx_ap_apartment (apartment_id)`);

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
    await exec(`ALTER TABLE house_specs DROP FOREIGN KEY fk_hs_building`);
    await exec(`ALTER TABLE house_specs ADD CONSTRAINT fk_hs_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE`);

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
    await exec(`ALTER TABLE house_photos DROP FOREIGN KEY fk_hph_building`);
    await exec(`ALTER TABLE house_photos ADD CONSTRAINT fk_hph_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE`);

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
    await exec(`ALTER TABLE house_status DROP FOREIGN KEY fk_hst_building`);
    await exec(`ALTER TABLE house_status ADD CONSTRAINT fk_hst_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE`);

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
    await exec(`ALTER TABLE house_calendar_activities DROP FOREIGN KEY fk_hca_building`);
    await exec(`ALTER TABLE house_calendar_activities ADD CONSTRAINT fk_hca_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE`);

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
    await exec(`ALTER TABLE trash_pickup_schedule DROP FOREIGN KEY fk_tps_building`);
    await exec(`ALTER TABLE trash_pickup_schedule ADD CONSTRAINT fk_tps_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE`);

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

    // pending_moderation/archived заменены единым полем status (single source of truth)
    if (await columnExists("neighbor_ads", "pending_moderation")) {
        await exec(`UPDATE neighbor_ads SET status = 'under_review' WHERE pending_moderation = 1 AND status = 'new'`);
        await exec(`UPDATE neighbor_ads SET status = 'archived' WHERE archived = 1 AND status = 'new'`);
        await exec(`UPDATE neighbor_ads SET status = 'published' WHERE status = 'new'`);
        await exec(`ALTER TABLE neighbor_ads DROP COLUMN pending_moderation`);
        await exec(`ALTER TABLE neighbor_ads DROP COLUMN archived`);
    }
    await exec(`
        ALTER TABLE neighbor_ads MODIFY COLUMN status
        ENUM('new','under_review','published','archived','rejected','under_review_appeal')
        NOT NULL DEFAULT 'published'
    `);
    await exec(`ALTER TABLE neighbor_ads ADD INDEX idx_na_status (status)`);

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
            created_by_label VARCHAR(255)           NOT NULL DEFAULT '' COMMENT 'снепшот имени автора на момент создания, не синхронизируется с user_profiles.full_name',
            sponsor          ENUM('uk','residents') NOT NULL DEFAULT 'residents',
            status           ENUM('new','under_review','active','completed','cancelled') NOT NULL DEFAULT 'new',
            topic            TEXT                   NOT NULL,
            description      TEXT                   NOT NULL DEFAULT '',
            visibility       ENUM('open','secret')  NOT NULL DEFAULT 'open',
            ends_at          DATETIME               NOT NULL,
            closed           TINYINT(1)             NOT NULL DEFAULT 0,
            trial            TINYINT(1)             NOT NULL DEFAULT 0,
            created_at       DATETIME               NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at       DATETIME               NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            CONSTRAINT fk_votes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
            INDEX idx_votes_building_key (building_key, created_at DESC),
            INDEX idx_votes_ends_at      (ends_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await exec(`ALTER TABLE votes MODIFY COLUMN created_by_label VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'снепшот имени автора на момент создания, не синхронизируется с user_profiles.full_name'`);
    await exec(`ALTER TABLE votes ADD COLUMN IF NOT EXISTS updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
    await exec(`ALTER TABLE votes ADD COLUMN IF NOT EXISTS user_id BIGINT UNSIGNED NULL`);
    await exec(`
        ALTER TABLE votes ADD COLUMN IF NOT EXISTS status
        ENUM('new','under_review','active','completed','cancelled')
        NOT NULL DEFAULT 'new'
    `);
    await exec(`ALTER TABLE votes ADD CONSTRAINT fk_votes_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE`);

    // Существующие голосования создавались до появления status — переносим их в active/completed
    await exec(`UPDATE votes SET status = 'completed' WHERE status = 'new' AND (closed = 1 OR ends_at <= NOW())`);
    await exec(`UPDATE votes SET status = 'active' WHERE status = 'new'`);
    await exec(`
        ALTER TABLE votes MODIFY COLUMN status
        ENUM('new','under_review','active','completed','cancelled')
        NOT NULL DEFAULT 'active'
    `);
    await exec(`ALTER TABLE votes ADD INDEX idx_votes_status (status)`);

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
            apartment_id BIGINT UNSIGNED DEFAULT NULL,
            area_sqm  DECIMAL(6,2)    NOT NULL DEFAULT 0 COMMENT 'снепшот площади на момент голосования, не синхронизируется с user_apartments.apartment_area_sqm',
            voted_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_vc_vote_user (vote_id, user_id),
            CONSTRAINT fk_vc_vote   FOREIGN KEY (vote_id)   REFERENCES votes(id)        ON DELETE CASCADE,
            CONSTRAINT fk_vc_user   FOREIGN KEY (user_id)   REFERENCES users(id)        ON DELETE CASCADE,
            CONSTRAINT fk_vc_option FOREIGN KEY (option_id) REFERENCES vote_options(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await exec(`ALTER TABLE vote_casts MODIFY COLUMN area_sqm DECIMAL(6,2) NOT NULL DEFAULT 0 COMMENT 'снепшот площади на момент голосования, не синхронизируется с user_apartments.apartment_area_sqm'`);
    await exec(`ALTER TABLE vote_casts ADD COLUMN IF NOT EXISTS apartment_id BIGINT UNSIGNED DEFAULT NULL`);
    await exec(`
        UPDATE vote_casts vc
        JOIN votes v ON v.id = vc.vote_id
        SET vc.apartment_id = (
            SELECT ua.id FROM user_apartments ua
            WHERE ua.user_id = vc.user_id AND ua.building_key = v.building_key
            LIMIT 1
        )
        WHERE vc.apartment_id IS NULL
          AND (SELECT COUNT(*) FROM user_apartments ua WHERE ua.user_id = vc.user_id AND ua.building_key = v.building_key) = 1
    `);
    await exec(`ALTER TABLE vote_casts ADD CONSTRAINT fk_vc_apartment FOREIGN KEY (apartment_id) REFERENCES user_apartments(id) ON DELETE SET NULL`);
    await exec(`ALTER TABLE vote_casts ADD INDEX idx_vc_apartment (apartment_id)`);

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
            UNIQUE KEY uq_er_user_building_month (user_id, building_key, month_key),
            CONSTRAINT fk_er_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_er_building_month (building_key, month_key DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await exec(`ALTER TABLE environment_ratings ADD CONSTRAINT fk_er_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE`);

    // Старые установки: одна оценка в месяц на пользователя суммарно — расширяем до «на дом»
    if (await columnExists("environment_ratings", "month_key")) {
        await exec(`ALTER TABLE environment_ratings DROP INDEX uq_er_user_month`);
        await exec(`ALTER TABLE environment_ratings ADD UNIQUE KEY uq_er_user_building_month (user_id, building_key, month_key)`);
    }

    // ============================================================
    //  РАЙОН (КАРТА)
    // ============================================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS district_layers (
            id       VARCHAR(40)  NOT NULL,
            label    VARCHAR(255) NOT NULL,
            position INT          NOT NULL DEFAULT 0,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await exec(`
        INSERT IGNORE INTO district_layers (id, label, position) VALUES
            ('schools_daycare','Школы и детские сады',0),
            ('clinic_pharmacy','Поликлиники',1),
            ('grocery','Продуктовые магазины',2),
            ('parks','Парки и скверы',3),
            ('bus_stops_city','Остановки (город)',4),
            ('parking_city','Парковки (город)',5),
            ('waste_yard','Контейнеры у дома',6),
            ('bus_stops_house','Остановки у дома',7),
            ('parking_house','Парковка жильцов',8)
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS district_pois (
            id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            name         VARCHAR(255)    NOT NULL,
            layer_id     VARCHAR(40)     NOT NULL,
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
    // scope полностью определялся building_key (NULL -> city, иначе -> house) — избыточная колонка
    await exec(`ALTER TABLE district_pois DROP COLUMN IF EXISTS scope`);
    await exec(`ALTER TABLE district_pois ADD CONSTRAINT fk_dp_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE`);
    // Старые установки: layer_id был ENUM — переводим на VARCHAR + FK на district_layers
    await exec(`ALTER TABLE district_pois MODIFY COLUMN layer_id VARCHAR(40) NOT NULL`);
    await exec(`ALTER TABLE district_pois ADD CONSTRAINT fk_dp_layer FOREIGN KEY (layer_id) REFERENCES district_layers(id) ON UPDATE CASCADE`);

    // ============================================================
    //  АДМИНКА И PUSH-ТОКЕНЫ
    // ============================================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_users (
            id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            email         VARCHAR(255)    NOT NULL,
            password_hash VARCHAR(255)    NOT NULL,
            full_name     VARCHAR(255)    NOT NULL DEFAULT '',
            role          ENUM('admin','moderator') NOT NULL DEFAULT 'admin',
            permissions   JSON            DEFAULT NULL,
            is_active     TINYINT(1)      NOT NULL DEFAULT 1,
            created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_admin_users_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await exec(`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS role ENUM('admin','moderator') NOT NULL DEFAULT 'admin'`);
    await exec(`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS permissions JSON DEFAULT NULL`);
    await exec(`ALTER TABLE admin_users MODIFY COLUMN password_hash VARCHAR(255) NOT NULL`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS push_tokens (
            id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id    BIGINT UNSIGNED NOT NULL,
            token      VARCHAR(500)    NOT NULL,
            platform   VARCHAR(20)     NOT NULL DEFAULT 'expo',
            created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_pt_token (token),
            CONSTRAINT fk_pt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Старые установки: один токен мог быть привязан к нескольким пользователям — токен уникален глобально
    if (await columnExists("push_tokens", "user_id")) {
        // Оставляем самую свежую запись на токен, остальные удаляем
        await exec(`
            DELETE pt1 FROM push_tokens pt1
            JOIN push_tokens pt2 ON pt1.token = pt2.token AND pt1.id < pt2.id
        `);
        await exec(`ALTER TABLE push_tokens DROP INDEX uq_pt_user_token`);
        await exec(`ALTER TABLE push_tokens ADD UNIQUE KEY uq_pt_token (token)`);
    }

    // Перенос токенов из устаревшей users.expo_push_token в push_tokens
    if (await columnExists("users", "expo_push_token")) {
        await exec(`
            INSERT INTO push_tokens (user_id, token, platform)
            SELECT id, expo_push_token, 'expo' FROM users
            WHERE expo_push_token IS NOT NULL AND expo_push_token != ''
            ON DUPLICATE KEY UPDATE token = token
        `);
        await exec(`ALTER TABLE users DROP COLUMN expo_push_token`);
    }

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
