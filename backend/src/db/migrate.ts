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
            chat_telegram_url VARCHAR(500) NOT NULL DEFAULT '',
            chat_vk_url       VARCHAR(500) NOT NULL DEFAULT '',
            chat_max_url      VARCHAR(500) NOT NULL DEFAULT '',
            created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (building_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await exec(`ALTER TABLE buildings ADD COLUMN IF NOT EXISTS lat DECIMAL(9,6) DEFAULT NULL`);
    await exec(`ALTER TABLE buildings ADD COLUMN IF NOT EXISTS lng DECIMAL(9,6) DEFAULT NULL`);
    await exec(`ALTER TABLE buildings ADD COLUMN IF NOT EXISTS chat_telegram_url VARCHAR(500) NOT NULL DEFAULT ''`);
    await exec(`ALTER TABLE buildings ADD COLUMN IF NOT EXISTS chat_vk_url VARCHAR(500) NOT NULL DEFAULT ''`);
    await exec(`ALTER TABLE buildings ADD COLUMN IF NOT EXISTS chat_max_url VARCHAR(500) NOT NULL DEFAULT ''`);

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
            notifications_last_seen_at DATETIME NULL,
            created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await exec(`ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) NOT NULL`);
    await exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_last_seen_at DATETIME NULL`);

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

    // verification_photos — см. раздел фото ниже
    // когда уже созданы все таблицы-владельцы для внешних ключей.

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

    // Гарантия на уровне БД: не более одной активной (pending) заявки на квартиру.
    // Частичные индексы MySQL/MariaDB не поддерживает, поэтому используем
    // сохраняемый генерируемый столбец (pending => apartment_id, иначе NULL) + UNIQUE.
    if (!(await columnExists("verification_requests", "pending_apartment_id"))) {
        // Сначала закрываем уже существующие дубли pending, оставляя самую свежую заявку
        await exec(`
            UPDATE verification_requests vr
            JOIN (
                SELECT apartment_id, MAX(id) AS keep_id
                FROM verification_requests
                WHERE status = 'pending'
                GROUP BY apartment_id
                HAVING COUNT(*) > 1
            ) d ON d.apartment_id = vr.apartment_id
               AND vr.status = 'pending'
               AND vr.id <> d.keep_id
            SET vr.status = 'rejected',
                vr.comment = COALESCE(vr.comment, 'Закрыта автоматически: дубликат заявки')
        `);
        await exec(`
            ALTER TABLE verification_requests
              ADD COLUMN pending_apartment_id BIGINT UNSIGNED
                AS (IF(status = 'pending', apartment_id, NULL)) STORED
        `);
        await exec(`ALTER TABLE verification_requests ADD UNIQUE KEY uq_vr_pending_apartment (pending_apartment_id)`);
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
    // building_chats удалены — ссылки на чаты хранятся прямо в buildings.chat_*_url
    if (await tableExists("building_chats")) {
        // Переносим ссылки в здания (по платформам). Берём любые значения, если были дубликаты.
        await exec(`
            UPDATE buildings b
            LEFT JOIN building_chats tg ON tg.building_key = b.building_key AND tg.platform = 'telegram'
            LEFT JOIN building_chats vk ON vk.building_key = b.building_key AND vk.platform = 'vk'
            LEFT JOIN building_chats mx ON mx.building_key = b.building_key AND mx.platform = 'max'
            SET
                b.chat_telegram_url = COALESCE(NULLIF(b.chat_telegram_url, ''), COALESCE(tg.url, '')),
                b.chat_vk_url       = COALESCE(NULLIF(b.chat_vk_url, ''),       COALESCE(vk.url, '')),
                b.chat_max_url      = COALESCE(NULLIF(b.chat_max_url, ''),      COALESCE(mx.url, ''))
        `);
        await exec(`DROP TABLE building_chats`);
    }

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

    // news_photos — см. раздел фото ниже

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

    // user_notification_reads заменены на users.notifications_last_seen_at
    await exec(`DROP TABLE IF EXISTS user_notification_reads`);

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
    // author_apartment (snapshot) удаляем — значение берём через JOIN user_apartments
    await exec(`ALTER TABLE appeals DROP COLUMN IF EXISTS author_apartment`);

    // 3НФ: дом обращения выводится из квартиры автора (author_apartment_id ->
    // user_apartments.building_key), поэтому отдельная колонка appeals.building_key
    // удаляется (см. блок нормализации ниже), а триггеры согласованности больше не нужны.
    await exec(`DROP TRIGGER IF EXISTS trg_appeals_building_consistency_bi`);
    await exec(`DROP TRIGGER IF EXISTS trg_appeals_building_consistency_bu`);

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

    // ============================================================
    //  НОРМАЛИЗАЦИЯ 3НФ: appeals.building_key выводится из квартиры автора
    //  (author_apartment_id -> user_apartments.building_key). Убираем дублирующую
    //  колонку building_key и делаем привязку к квартире обязательной (ON DELETE RESTRICT),
    //  чтобы дом всегда был разрешим через JOIN, а не хранился отдельной копией.
    // ============================================================
    // Подстраховка: добиваем author_apartment_id там, где он ещё не проставлен —
    // берём активную квартиру пользователя в том же доме (колонка building_key ещё есть).
    await exec(`
        UPDATE appeals a
        JOIN user_profiles p ON p.user_id = a.user_id
        JOIN user_apartments ua ON ua.id = p.active_apartment_id AND ua.building_key = a.building_key
        SET a.author_apartment_id = ua.id
        WHERE a.author_apartment_id IS NULL
    `);
    // Осиротевшие обращения (без разрешимой квартиры) в нормализованной модели
    // представить нельзя — удаляем (обычно их нет).
    await exec(`DELETE FROM appeals WHERE author_apartment_id IS NULL`);
    // Привязка к квартире автора обязательна и защищена от удаления квартиры.
    await exec(`ALTER TABLE appeals MODIFY COLUMN author_apartment_id BIGINT UNSIGNED NOT NULL`);
    await exec(`ALTER TABLE appeals DROP FOREIGN KEY fk_appeals_apartment`);
    await exec(`ALTER TABLE appeals ADD CONSTRAINT fk_appeals_apartment FOREIGN KEY (author_apartment_id) REFERENCES user_apartments(id) ON DELETE RESTRICT`);
    // Удаляем дублирующую building_key — дом берём через JOIN user_apartments.
    await exec(`ALTER TABLE appeals DROP FOREIGN KEY fk_appeals_building`);
    await exec(`ALTER TABLE appeals DROP INDEX idx_appeals_building_key`);
    await exec(`ALTER TABLE appeals DROP COLUMN building_key`);

    // appeal_photos — см. раздел фото ниже

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
    // apartment/display_name (snapshots) удаляем — значение берём через JOIN
    await exec(`ALTER TABLE appeal_participants DROP COLUMN IF EXISTS apartment`);
    await exec(`ALTER TABLE appeal_participants DROP COLUMN IF EXISTS display_name`);

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

    // building_photos — см. раздел фото ниже
    await exec(`DROP TABLE IF EXISTS house_status`);

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

    // neighbor_ad_photos — см. раздел фото ниже

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
    // created_by_label (snapshot) удаляем — имя/квартиру берём через JOIN
    await exec(`ALTER TABLE votes DROP COLUMN IF EXISTS created_by_label`);

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
    // area_sqm (snapshot) удаляем — площадь берём через JOIN user_apartments
    await exec(`ALTER TABLE vote_casts DROP COLUMN IF EXISTS area_sqm`);

    // ============================================================
    //  ОЦЕНКИ СРЕДЫ
    // ============================================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS environment_ratings (
            id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            apartment_id    BIGINT UNSIGNED NOT NULL,
            month_key       CHAR(7)         NOT NULL,
            courtyard_stars TINYINT         NOT NULL,
            entrance_stars  TINYINT         NOT NULL,
            uk_stars        TINYINT         NOT NULL,
            feedback_other  TEXT            DEFAULT NULL,
            submitted_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_er_apartment_month (apartment_id, month_key),
            CONSTRAINT fk_er_apartment FOREIGN KEY (apartment_id) REFERENCES user_apartments(id) ON DELETE CASCADE,
            INDEX idx_er_apartment_month (apartment_id, month_key DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS environment_rating_feedback_tags (
            rating_id BIGINT UNSIGNED NOT NULL,
            tag_id    ENUM('yard','entrance','uk_comm','uk_work','contractors','safety','other') NOT NULL,
            PRIMARY KEY (rating_id, tag_id),
            CONSTRAINT fk_erft_rating FOREIGN KEY (rating_id) REFERENCES environment_ratings(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    if (await columnExists("environment_ratings", "feedback_tags")) {
        const VALID_RATING_FEEDBACK_TAGS = new Set([
            "yard", "entrance", "uk_comm", "uk_work", "contractors", "safety", "other",
        ]);
        const [legacyRows] = await pool.query<RowDataPacket[]>(
            `SELECT id, feedback_tags FROM environment_ratings WHERE feedback_tags IS NOT NULL`,
        );
        for (const row of legacyRows) {
            let tags: unknown;
            try {
                const raw = row.feedback_tags;
                tags = typeof raw === "string" ? JSON.parse(raw) : raw;
            } catch {
                continue;
            }
            if (!Array.isArray(tags)) continue;
            for (const tag of tags) {
                if (typeof tag !== "string" || !VALID_RATING_FEEDBACK_TAGS.has(tag)) continue;
                await pool
                    .execute(
                        `INSERT IGNORE INTO environment_rating_feedback_tags (rating_id, tag_id) VALUES (?, ?)`,
                        [row.id, tag],
                    )
                    .catch(() => {});
            }
        }
        await exec(`ALTER TABLE environment_ratings DROP COLUMN feedback_tags`);
    }

    // Старые установки: одна оценка в месяц на пользователя суммарно — расширяем до «на дом»
    if (await columnExists("environment_ratings", "month_key") && await columnExists("environment_ratings", "user_id")) {
        await exec(`ALTER TABLE environment_ratings DROP INDEX uq_er_user_month`);
        await exec(`ALTER TABLE environment_ratings ADD UNIQUE KEY uq_er_user_building_month (user_id, building_key, month_key)`);
    }

    // ============================================================
    //  РАЙОН (КАРТА)
    // ============================================================

    // district_layers удалены — метаданные слоёв фиксированы на клиенте/сервере (VALID_LAYER_IDS)
    await exec(`DROP TABLE IF EXISTS district_layers`);

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
    // Старые установки: layer_id был ENUM — переводим на VARCHAR
    await exec(`ALTER TABLE district_pois MODIFY COLUMN layer_id VARCHAR(40) NOT NULL`);
    await exec(`ALTER TABLE district_pois DROP FOREIGN KEY fk_dp_layer`);

    // ============================================================
    //  АДМИНКА И PUSH-ТОКЕНЫ
    // ============================================================

    // Администраторы. Ролевая модель: admin (полный доступ) и moderator
    // (новости, уведомления, обработка жалоб, модерация контента).
    // Управление администраторами и проверки прав реализованы в админ-панели,
    // здесь поддерживается только согласованность схемы общей БД.
    await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_users (
            id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            email         VARCHAR(255)    NOT NULL,
            password_hash VARCHAR(255)    NOT NULL,
            full_name     VARCHAR(255)    NOT NULL DEFAULT '',
            role          ENUM('admin','moderator') NOT NULL DEFAULT 'admin',
            is_active     TINYINT(1)      NOT NULL DEFAULT 1,
            created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_admin_users_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await exec(`ALTER TABLE admin_users MODIFY COLUMN password_hash VARCHAR(255) NOT NULL`);
    await exec(`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS role ENUM('admin','moderator') NOT NULL DEFAULT 'admin'`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_user_permissions (
            admin_user_id BIGINT UNSIGNED NOT NULL,
            permission    VARCHAR(64)     NOT NULL,
            PRIMARY KEY (admin_user_id, permission),
            CONSTRAINT fk_aup_admin FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Связи admin_users с сущностями, которые создаёт/обрабатывает админка
    const adminFkLinks: [string, string][] = [
        ["notifications", "created_by_admin_id"],
        ["verification_requests", "reviewed_by_admin_id"],
        ["appeals", "handled_by_admin_id"],
        ["news", "created_by_admin_id"],
        ["users", "blocked_by_admin_id"],
    ];
    for (const [table, column] of adminFkLinks) {
        await exec(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} BIGINT UNSIGNED DEFAULT NULL`);
        await exec(`ALTER TABLE ${table} ADD INDEX idx_${table}_${column} (${column})`);
        await exec(
            `ALTER TABLE ${table} ADD CONSTRAINT fk_${table}_${column} FOREIGN KEY (${column}) REFERENCES admin_users(id) ON DELETE SET NULL`,
        );
    }

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
    // ============================================================
    //  ФОТО: отдельная таблица на каждую сущность (без полиморфных FK)
    // ============================================================

    // Старые таблицы с колонкой image_url — убираем с пути, чтобы не мешать CREATE
    if (await tableExists("appeal_photos") && await columnExists("appeal_photos", "image_url")) {
        await exec(`DROP TABLE IF EXISTS legacy_appeal_photos`);
        await exec(`RENAME TABLE appeal_photos TO legacy_appeal_photos`);
    }
    if (await tableExists("neighbor_ad_photos") && (await columnExists("neighbor_ad_photos", "image_url") || await columnExists("neighbor_ad_photos", "ad_id"))) {
        await exec(`DROP TABLE IF EXISTS legacy_neighbor_ad_photos`);
        await exec(`RENAME TABLE neighbor_ad_photos TO legacy_neighbor_ad_photos`);
    }
    if (await tableExists("verification_photos") && (await columnExists("verification_photos", "image_url") || await columnExists("verification_photos", "request_id"))) {
        await exec(`DROP TABLE IF EXISTS legacy_verification_photos`);
        await exec(`RENAME TABLE verification_photos TO legacy_verification_photos`);
    }
    if (await tableExists("news_photos") && await columnExists("news_photos", "image_url")) {
        await exec(`DROP TABLE IF EXISTS legacy_news_photos`);
        await exec(`RENAME TABLE news_photos TO legacy_news_photos`);
    }
    if (await tableExists("house_photos") && await columnExists("house_photos", "image_url")) {
        await exec(`DROP TABLE IF EXISTS legacy_house_photos`);
        await exec(`RENAME TABLE house_photos TO legacy_house_photos`);
    }

    await pool.query(`
        CREATE TABLE IF NOT EXISTS appeal_photos (
            id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            appeal_id  BIGINT UNSIGNED NOT NULL,
            url        VARCHAR(900)    NOT NULL,
            position   INT             NOT NULL DEFAULT 0,
            created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            CONSTRAINT fk_aphotos_appeal FOREIGN KEY (appeal_id) REFERENCES appeals(id) ON DELETE CASCADE,
            UNIQUE KEY uq_ap_appeal_pos_url (appeal_id, position, url),
            INDEX idx_ap_appeal (appeal_id, position)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS neighbor_ad_photos (
            id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            neighbor_ad_id BIGINT UNSIGNED NOT NULL,
            url            VARCHAR(900)    NOT NULL,
            position       INT             NOT NULL DEFAULT 0,
            is_primary     TINYINT(1)      NOT NULL DEFAULT 0,
            created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            CONSTRAINT fk_nap_ad FOREIGN KEY (neighbor_ad_id) REFERENCES neighbor_ads(id) ON DELETE CASCADE,
            UNIQUE KEY uq_nap_ad_pos_url (neighbor_ad_id, position, url),
            INDEX idx_nap_ad (neighbor_ad_id, position)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS verification_photos (
            id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            verification_request_id BIGINT UNSIGNED NOT NULL,
            url                     VARCHAR(900)    NOT NULL,
            position                INT             NOT NULL DEFAULT 0,
            created_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            CONSTRAINT fk_vp_request FOREIGN KEY (verification_request_id) REFERENCES verification_requests(id) ON DELETE CASCADE,
            UNIQUE KEY uq_vp_request_pos_url (verification_request_id, position, url),
            INDEX idx_vp_request (verification_request_id, position)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS building_photos (
            id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            building_key VARCHAR(120)    NOT NULL,
            url          VARCHAR(900)    NOT NULL,
            position     INT             NOT NULL DEFAULT 0,
            created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            CONSTRAINT fk_bp_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON DELETE CASCADE ON UPDATE CASCADE,
            UNIQUE KEY uq_bp_building_pos_url (building_key, position, url),
            INDEX idx_bp_building (building_key, position)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS news_photos (
            id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            news_id    BIGINT UNSIGNED NOT NULL,
            url        VARCHAR(900)    NOT NULL,
            position   INT             NOT NULL DEFAULT 0,
            created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            CONSTRAINT fk_np_news FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE,
            UNIQUE KEY uq_np_news_pos_url (news_id, position, url),
            INDEX idx_np_news (news_id, position)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // --- Перенос из полиморфной content_photos ---
    if (await tableExists("content_photos")) {
        await exec(`
            INSERT IGNORE INTO appeal_photos (appeal_id, url, position, created_at)
            SELECT appeal_id, url, position, created_at
            FROM content_photos
            WHERE appeal_id IS NOT NULL
        `);
        await exec(`
            INSERT IGNORE INTO neighbor_ad_photos (neighbor_ad_id, url, position, is_primary, created_at)
            SELECT neighbor_ad_id, url, position, is_primary, created_at
            FROM content_photos
            WHERE neighbor_ad_id IS NOT NULL
        `);
        await exec(`
            INSERT IGNORE INTO verification_photos (verification_request_id, url, position, created_at)
            SELECT verification_request_id, url, position, created_at
            FROM content_photos
            WHERE verification_request_id IS NOT NULL
        `);
        await exec(`DROP TRIGGER IF EXISTS trg_content_photos_one_owner_bi`);
        await exec(`DROP TRIGGER IF EXISTS trg_content_photos_one_owner_bu`);
        await exec(`DROP TABLE content_photos`);
    }

    // --- Перенос из полиморфной house_photos ---
    if (await tableExists("house_photos")) {
        await exec(`
            INSERT IGNORE INTO building_photos (building_key, url, position, created_at)
            SELECT building_key, url, position, created_at
            FROM house_photos
            WHERE building_key IS NOT NULL
        `);
        await exec(`
            INSERT IGNORE INTO news_photos (news_id, url, position, created_at)
            SELECT news_id, url, position, created_at
            FROM house_photos
            WHERE news_id IS NOT NULL
        `);
        await exec(`DROP TRIGGER IF EXISTS trg_house_photos_one_owner_bi`);
        await exec(`DROP TRIGGER IF EXISTS trg_house_photos_one_owner_bu`);
        await exec(`DROP TABLE house_photos`);
    }

    // --- Перенос из универсальной media ---
    if (await tableExists("media")) {
        await exec(`
            INSERT IGNORE INTO appeal_photos (appeal_id, url, position, created_at)
            SELECT a.id, m.url, m.position, m.created_at
            FROM media m
            JOIN appeals a ON a.id = CAST(m.owner_key AS UNSIGNED)
            WHERE m.owner_type = 'appeal'
        `);
        await exec(`
            INSERT IGNORE INTO neighbor_ad_photos (neighbor_ad_id, url, position, is_primary, created_at)
            SELECT na.id, m.url, m.position, m.is_primary, m.created_at
            FROM media m
            JOIN neighbor_ads na ON na.id = CAST(m.owner_key AS UNSIGNED)
            WHERE m.owner_type = 'neighbor_ad'
        `);
        await exec(`
            INSERT IGNORE INTO verification_photos (verification_request_id, url, position, created_at)
            SELECT vr.id, m.url, m.position, m.created_at
            FROM media m
            JOIN verification_requests vr ON vr.id = CAST(m.owner_key AS UNSIGNED)
            WHERE m.owner_type = 'verification'
        `);
        await exec(`
            INSERT IGNORE INTO building_photos (building_key, url, position, created_at)
            SELECT b.building_key, m.url, m.position, m.created_at
            FROM media m
            JOIN buildings b ON LOWER(b.building_key) = LOWER(m.owner_key)
            WHERE m.owner_type = 'building'
        `);
        await exec(`
            INSERT IGNORE INTO news_photos (news_id, url, position, created_at)
            SELECT n.id, m.url, m.position, m.created_at
            FROM media m
            JOIN news n ON n.id = CAST(m.owner_key AS UNSIGNED)
            WHERE m.owner_type = 'news'
        `);
        await exec(`DROP TABLE IF EXISTS media`);
    }

    // --- Перенос из legacy *_photos ---
    if (await tableExists("legacy_appeal_photos")) {
        await exec(`
            INSERT IGNORE INTO appeal_photos (appeal_id, url, position)
            SELECT ap.appeal_id, ap.image_url, ap.position
            FROM legacy_appeal_photos ap
        `);
        await exec(`DROP TABLE legacy_appeal_photos`);
    }
    if (await tableExists("legacy_neighbor_ad_photos")) {
        if (await columnExists("legacy_neighbor_ad_photos", "neighbor_ad_id")) {
            await exec(`
                INSERT IGNORE INTO neighbor_ad_photos (neighbor_ad_id, url, position, is_primary)
                SELECT neighbor_ad_id, image_url, position, COALESCE(is_primary, 0)
                FROM legacy_neighbor_ad_photos
            `);
        } else {
            await exec(`
                INSERT IGNORE INTO neighbor_ad_photos (neighbor_ad_id, url, position, is_primary)
                SELECT ad_id, image_url, position, COALESCE(is_primary, 0)
                FROM legacy_neighbor_ad_photos
            `);
        }
        await exec(`DROP TABLE legacy_neighbor_ad_photos`);
    }
    if (await tableExists("legacy_verification_photos")) {
        if (await columnExists("legacy_verification_photos", "verification_request_id")) {
            await exec(`
                INSERT IGNORE INTO verification_photos (verification_request_id, url, position)
                SELECT verification_request_id, image_url, position
                FROM legacy_verification_photos
            `);
        } else {
            await exec(`
                INSERT IGNORE INTO verification_photos (verification_request_id, url, position)
                SELECT request_id, image_url, position
                FROM legacy_verification_photos
            `);
        }
        await exec(`DROP TABLE legacy_verification_photos`);
    }
    if (await tableExists("legacy_news_photos")) {
        await exec(`
            INSERT IGNORE INTO news_photos (news_id, url, position)
            SELECT np.news_id, np.image_url, np.position
            FROM legacy_news_photos np
        `);
        await exec(`DROP TABLE legacy_news_photos`);
    }
    if (await tableExists("legacy_house_photos")) {
        await exec(`
            INSERT IGNORE INTO building_photos (building_key, url, position)
            SELECT hp.building_key, hp.image_url, hp.position
            FROM legacy_house_photos hp
        `);
        await exec(`DROP TABLE legacy_house_photos`);
    }

    if (await columnExists("verification_requests", "photo_url")) {
        await exec(`
            INSERT IGNORE INTO verification_photos (verification_request_id, url, position)
            SELECT id, photo_url, 0
            FROM verification_requests
            WHERE photo_url IS NOT NULL AND photo_url <> ''
        `);
        await exec(`ALTER TABLE verification_requests DROP COLUMN photo_url`);
    }


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

    // ============================================================
    //  НОРМАЛИЗАЦИЯ: убираем дублирующие колонки
    // ============================================================

    if (await columnExists("appeals", "user_id")) {
        await exec(`ALTER TABLE appeals DROP FOREIGN KEY fk_appeals_user`);
        await exec(`ALTER TABLE appeals DROP INDEX idx_appeals_user_created`);
        await exec(`ALTER TABLE appeals DROP COLUMN user_id`);
    }
    if (await columnExists("appeals", "entrance")) {
        await exec(`ALTER TABLE appeals DROP COLUMN entrance`);
    }
    if (await columnExists("appeal_participants", "entrance")) {
        await exec(`ALTER TABLE appeal_participants DROP COLUMN entrance`);
    }

    if (await columnExists("neighbor_ads", "author_phone")) {
        await exec(`ALTER TABLE neighbor_ads DROP COLUMN author_phone`);
    }

    if (!(await columnExists("environment_ratings", "apartment_id"))) {
        await exec(`ALTER TABLE environment_ratings ADD COLUMN apartment_id BIGINT UNSIGNED DEFAULT NULL`);
    }
    if (await columnExists("environment_ratings", "user_id")) {
        await exec(`
            UPDATE environment_ratings er
            LEFT JOIN user_profiles up ON up.user_id = er.user_id
            SET er.apartment_id = COALESCE(
                (SELECT ua.id FROM user_apartments ua
                 WHERE ua.id = up.active_apartment_id AND ua.building_key = er.building_key),
                (SELECT ua.id FROM user_apartments ua
                 WHERE ua.user_id = er.user_id AND ua.building_key = er.building_key
                 ORDER BY ua.id LIMIT 1)
            )
            WHERE er.apartment_id IS NULL
        `);
        await exec(`DELETE FROM environment_ratings WHERE apartment_id IS NULL`);
        await exec(`ALTER TABLE environment_ratings DROP INDEX uq_er_user_building_month`);
        await exec(`ALTER TABLE environment_ratings DROP FOREIGN KEY fk_er_user`);
        await exec(`ALTER TABLE environment_ratings DROP FOREIGN KEY fk_er_building`);
        await exec(`ALTER TABLE environment_ratings DROP INDEX idx_er_building_month`);
        await exec(`ALTER TABLE environment_ratings DROP COLUMN user_id`);
        await exec(`ALTER TABLE environment_ratings DROP COLUMN building_key`);
        await exec(`ALTER TABLE environment_ratings MODIFY COLUMN apartment_id BIGINT UNSIGNED NOT NULL`);
        await exec(`ALTER TABLE environment_ratings ADD UNIQUE KEY uq_er_apartment_month (apartment_id, month_key)`);
        await exec(`ALTER TABLE environment_ratings ADD CONSTRAINT fk_er_apartment FOREIGN KEY (apartment_id) REFERENCES user_apartments(id) ON DELETE CASCADE`);
        await exec(`ALTER TABLE environment_ratings ADD INDEX idx_er_apartment_month (apartment_id, month_key DESC)`);
    }

    if (await columnExists("admin_users", "permissions")) {
        const [permRows] = await pool.query<RowDataPacket[]>(
            `SELECT id, permissions FROM admin_users WHERE permissions IS NOT NULL`,
        );
        for (const row of permRows) {
            let perms: unknown;
            try {
                const raw = row.permissions;
                perms = typeof raw === "string" ? JSON.parse(raw) : raw;
            } catch {
                continue;
            }
            const keys: string[] = [];
            if (Array.isArray(perms)) {
                for (const p of perms) if (typeof p === "string" && p) keys.push(p);
            } else if (perms && typeof perms === "object") {
                for (const [k, v] of Object.entries(perms as Record<string, unknown>)) {
                    if (v) keys.push(k);
                }
            }
            for (const key of keys) {
                await pool
                    .execute(
                        `INSERT IGNORE INTO admin_user_permissions (admin_user_id, permission) VALUES (?, ?)`,
                        [row.id, key.slice(0, 64)],
                    )
                    .catch(() => {});
            }
        }
        await exec(`ALTER TABLE admin_users DROP COLUMN permissions`);
    }

    console.log("Migration complete");
}
