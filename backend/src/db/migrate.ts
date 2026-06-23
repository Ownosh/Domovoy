import { pool } from "./client";
import { RowDataPacket } from "mysql2";
import { SQL_NORMALIZE_APARTMENT_NORM } from "./normalize";
import { LEGACY_APPEAL_CATEGORY_MAP } from "../constants/appealCategories";
import { runMaintenance, installMaintenanceEvents } from "./maintenance";

// Идемпотентный ALTER: только ожидаемые «уже есть» ошибки — warn, остальные — throw
const SKIPPABLE_MIGRATE = /Duplicate|already exists|check that column\/key exists|Can't DROP|Cannot drop index|needed in a foreign key constraint|cannot be used in the CHECK clause|Unknown column|check that it exists|Multiple primary key/i;

async function exec(sql: string): Promise<void> {
    await pool.query(sql).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (SKIPPABLE_MIGRATE.test(msg)) {
            console.warn("[migrate] skipped:", msg);
            return;
        }
        console.error("[migrate] failed:", msg);
        throw err;
    });
}

const DISTRICT_LAYER_SEED: [string, string][] = [
    ["schools_daycare", "Школы и детсады"],
    ["clinic_pharmacy", "Клиники и аптеки"],
    ["grocery", "Продукты"],
    ["parks", "Парки"],
    ["bus_stops_city", "Остановки (город)"],
    ["parking_city", "Парковки (город)"],
    ["waste_yard", "Площадки ТКО"],
    ["bus_stops_house", "Остановки (дом)"],
    ["parking_house", "Парковки (дом)"],
];

const ADMIN_FK_LINKS: { table: string; column: string; fk: string; index: string }[] = [
    { table: "notifications", column: "created_by_admin_id", fk: "fk_notif_admin", index: "idx_notif_admin" },
    { table: "verification_requests", column: "reviewed_by_admin_id", fk: "fk_vr_admin", index: "idx_vr_admin" },
    { table: "appeals", column: "handled_by_admin_id", fk: "fk_appeals_admin", index: "idx_appeals_admin" },
    { table: "news", column: "created_by_admin_id", fk: "fk_news_admin", index: "idx_news_admin" },
    { table: "users", column: "blocked_by_admin_id", fk: "fk_users_blocked_admin", index: "idx_users_blocked_admin" },
];

async function seedDistrictLayers(): Promise<void> {
    for (const [layerId, title] of DISTRICT_LAYER_SEED) {
        await pool
            .execute(`INSERT IGNORE INTO district_layers (layer_id, title) VALUES (?, ?)`, [layerId, title])
            .catch((err: unknown) => {
                const msg = err instanceof Error ? err.message : String(err);
                console.warn("[migrate] district_layers seed skipped:", msg);
            });
    }
}

async function columnExists(table: string, column: string): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column],
    );
    return rows.length > 0;
}

async function indexExists(table: string, indexName: string): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 1 FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
         LIMIT 1`,
        [table, indexName],
    );
    return rows.length > 0;
}

async function foreignKeyExists(table: string, constraintName: string): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?
           AND CONSTRAINT_TYPE = 'FOREIGN KEY'
         LIMIT 1`,
        [table, constraintName],
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

async function columnType(table: string, column: string): Promise<string | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column],
    );
    return (rows[0]?.COLUMN_TYPE as string | undefined) ?? null;
}

/** MySQL не поддерживает ADD COLUMN IF NOT EXISTS (это синтаксис MariaDB). */
async function addColumnIfNotExists(table: string, column: string, definition: string): Promise<void> {
    if (!(await tableExists(table))) return;
    if (await columnExists(table, column)) return;
    await exec(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
}

async function addIndexIfNotExists(table: string, indexName: string, indexColumns: string): Promise<void> {
    if (!(await tableExists(table))) return;
    if (await indexExists(table, indexName)) return;
    await exec(`ALTER TABLE \`${table}\` ADD INDEX \`${indexName}\` (${indexColumns})`);
}

async function dropColumnIfExists(table: string, column: string): Promise<void> {
    if (!(await tableExists(table))) return;
    if (!(await columnExists(table, column))) return;
    await exec(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);
}

async function dropIndexIfExists(table: string, indexName: string): Promise<void> {
    if (!(await tableExists(table))) return;
    if (!(await indexExists(table, indexName))) return;
    await exec(`ALTER TABLE \`${table}\` DROP INDEX \`${indexName}\``);
}

async function constraintExists(table: string, constraintName: string): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?
         LIMIT 1`,
        [table, constraintName],
    );
    return rows.length > 0;
}

async function dropConstraintIfExists(table: string, constraintName: string): Promise<void> {
    if (!(await tableExists(table))) return;
    if (!(await constraintExists(table, constraintName))) return;
    await exec(`ALTER TABLE \`${table}\` DROP CHECK \`${constraintName}\``);
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
    await addColumnIfNotExists("buildings", "lat", "DECIMAL(9,6) DEFAULT NULL");
    await addColumnIfNotExists("buildings", "lng", "DECIMAL(9,6) DEFAULT NULL");
    await addColumnIfNotExists("buildings", "chat_telegram_url", "VARCHAR(500) NOT NULL DEFAULT ''");
    await addColumnIfNotExists("buildings", "chat_vk_url", "VARCHAR(500) NOT NULL DEFAULT ''");
    await addColumnIfNotExists("buildings", "chat_max_url", "VARCHAR(500) NOT NULL DEFAULT ''");

    // Старые установки: buildings.id — избыточный суррогатный ключ, все FK уже ссылаются на building_key
    if (await columnExists("buildings", "id")) {
        await exec(`
            ALTER TABLE buildings
                MODIFY id BIGINT UNSIGNED NOT NULL,
                DROP PRIMARY KEY,
                ADD PRIMARY KEY (building_key),
                DROP COLUMN id
        `);
    }
    // uq_buildings_key дублирует PK(building_key); FK могут быть привязаны к нему — drop необязателен
    if (await indexExists("buildings", "uq_buildings_key")) {
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
    await exec(`ALTER TABLE user_apartments DROP FOREIGN KEY fk_ua_building`);
    await exec(
        `ALTER TABLE user_apartments ADD CONSTRAINT fk_ua_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE`,
    );

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
    await addColumnIfNotExists("user_profiles", "profile_photo", "TEXT DEFAULT NULL");
    await addColumnIfNotExists("user_profiles", "active_apartment_id", "BIGINT UNSIGNED DEFAULT NULL");

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
        await addColumnIfNotExists("refresh_tokens", "token_hash", "CHAR(64) DEFAULT NULL");
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
    // verification_pending_apartments + generated column — см. блок «СТРОГАЯ НФ» ниже

    // --- Миграция старых установок verification_requests (user_id/building_key -> apartment_id) ---
    if (await tableExists("verification_requests") && await columnExists("verification_requests", "user_id")) {
        await addColumnIfNotExists("verification_requests", "apartment_id", "BIGINT UNSIGNED DEFAULT NULL");
        await addColumnIfNotExists("verification_requests", "comment", "TEXT DEFAULT NULL");
        await addColumnIfNotExists("verification_requests", "reviewed_at", "DATETIME DEFAULT NULL");
        await dropColumnIfExists("verification_requests", "reviewer_comment");

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
        await dropColumnIfExists("verification_requests", "building_key");
        await exec(`ALTER TABLE verification_requests ADD CONSTRAINT fk_vr_apartment FOREIGN KEY (apartment_id) REFERENCES user_apartments(id) ON DELETE CASCADE`);
        await exec(`ALTER TABLE verification_requests ADD INDEX idx_vr_apartment_submitted (apartment_id, submitted_at DESC)`);
        await exec(`ALTER TABLE verification_requests ADD INDEX idx_vr_status (status)`);
    }

    // verification_photos — см. раздел фото ниже

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
    await addColumnIfNotExists("buildings", "management_company_id", "BIGINT UNSIGNED DEFAULT NULL");

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
    await addColumnIfNotExists("news", "is_published", "TINYINT(1) NOT NULL DEFAULT 1");
    if (await columnExists("news", "building_key")) {
        if (await foreignKeyExists("news", "fk_news_building")) {
            await exec(`ALTER TABLE news DROP FOREIGN KEY fk_news_building`);
        }
        if (!(await foreignKeyExists("news", "fk_news_building"))) {
            await exec(`ALTER TABLE news ADD CONSTRAINT fk_news_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE`);
        }
    }

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
    await addColumnIfNotExists("notifications", "building_key", "VARCHAR(120) NULL COMMENT 'NULL = всем домам'");
    if (await columnExists("notifications", "building_key")) {
        if (await foreignKeyExists("notifications", "fk_notif_building")) {
            await exec(`ALTER TABLE notifications DROP FOREIGN KEY fk_notif_building`);
        }
        if (!(await foreignKeyExists("notifications", "fk_notif_building"))) {
            await exec(`ALTER TABLE notifications ADD CONSTRAINT fk_notif_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE`);
        }
    }

    await pool.query(`
        CREATE TABLE IF NOT EXISTS user_notification_reads (
            user_id         BIGINT UNSIGNED NOT NULL,
            notification_id BIGINT UNSIGNED NOT NULL,
            read_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, notification_id),
            CONSTRAINT fk_unr_user FOREIGN KEY (user_id)         REFERENCES users(id)          ON DELETE CASCADE,
            CONSTRAINT fk_unr_notif FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
            INDEX idx_unr_notification (notification_id)
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
    await addColumnIfNotExists("appeals", "manually_archived", "TINYINT(1) NOT NULL DEFAULT 0");
    await addColumnIfNotExists("appeals", "resolved_at", "DATETIME DEFAULT NULL");
    await addColumnIfNotExists("appeals", "admin_comment", "TEXT DEFAULT NULL");
    await addColumnIfNotExists("appeals", "admin_comment_at", "DATETIME DEFAULT NULL");
    await addColumnIfNotExists("appeals", "admin_comment_read_at", "DATETIME DEFAULT NULL");
    if (await columnExists("appeals", "building_key")) {
        await exec(`ALTER TABLE appeals ADD CONSTRAINT fk_appeals_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE`);
    }
    await addColumnIfNotExists("appeals", "author_apartment_id", "BIGINT UNSIGNED DEFAULT NULL");
    if (
        await columnExists("appeals", "building_key") &&
        await columnExists("appeals", "author_apartment")
    ) {
        await exec(`
            UPDATE appeals a
            JOIN user_apartments ua ON ua.user_id = a.user_id AND ua.building_key = a.building_key AND ua.apartment = a.author_apartment
            SET a.author_apartment_id = ua.id
            WHERE a.author_apartment_id IS NULL
        `);
    }
    // Legacy appeals (ещё с user_id): промежуточный FK. На новой схеме — см. блок ниже (~author_building_key).
    if (await columnExists("appeals", "user_id")) {
        await exec(`
            UPDATE appeals a
            LEFT JOIN user_apartments ua ON ua.id = a.author_apartment_id
            SET a.author_apartment_id = NULL
            WHERE a.author_apartment_id IS NOT NULL
              AND (ua.id IS NULL OR a.author_apartment_id = 0)
        `);
        await exec(`ALTER TABLE appeals MODIFY COLUMN author_apartment_id BIGINT UNSIGNED NULL`);
        if (await foreignKeyExists("appeals", "fk_appeals_apartment")) {
            await exec(`ALTER TABLE appeals DROP FOREIGN KEY fk_appeals_apartment`);
        }
        await exec(`ALTER TABLE appeals ADD CONSTRAINT fk_appeals_apartment FOREIGN KEY (author_apartment_id) REFERENCES user_apartments(id) ON DELETE SET NULL`);
    }
    await addIndexIfNotExists("appeals", "idx_appeals_apartment", "author_apartment_id");
    // author_apartment (snapshot) удаляем — значение берём через JOIN user_apartments
    await dropColumnIfExists("appeals", "author_apartment");

    // 3НФ: дом обращения выводится из квартиры автора (author_apartment_id ->
    // user_apartments.building_key), поэтому отдельная колонка appeals.building_key
    // удаляется (см. блок нормализации ниже), а триггеры согласованности больше не нужны.
    await exec(`DROP TRIGGER IF EXISTS trg_appeals_building_consistency_bi`);
    await exec(`DROP TRIGGER IF EXISTS trg_appeals_building_consistency_bu`);

    // category -> ENUM (legacy: русские подписи). Пропускаем, если schema.sql уже с ключами (emergency, …).
    const appealsCategoryType = await columnType("appeals", "category");
    if (appealsCategoryType && !appealsCategoryType.includes("'emergency'")) {
        await exec(`ALTER TABLE appeals MODIFY COLUMN category VARCHAR(255) NOT NULL DEFAULT 'Другое'`);
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
    }
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
    if (await columnExists("appeals", "building_key")) {
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
    }

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
    await exec(`ALTER TABLE appeal_participants MODIFY COLUMN entrance INT DEFAULT NULL`);
    await addColumnIfNotExists("appeal_participants", "apartment_id", "BIGINT UNSIGNED DEFAULT NULL");
    // building_key в appeals уже удалён — дом берём через квартиру автора обращения
    await exec(`
        UPDATE appeal_participants ap
        JOIN appeals a ON a.id = ap.appeal_id
        JOIN user_apartments author_ua ON author_ua.id = a.author_apartment_id
        JOIN user_apartments ua ON ua.user_id = ap.user_id
            AND ua.building_key = author_ua.building_key
            AND ua.apartment = ap.apartment
        SET ap.apartment_id = ua.id
        WHERE ap.apartment_id IS NULL
    `);
    await exec(`ALTER TABLE appeal_participants ADD CONSTRAINT fk_ap_apartment FOREIGN KEY (apartment_id) REFERENCES user_apartments(id) ON DELETE SET NULL`);
    await exec(`ALTER TABLE appeal_participants ADD INDEX idx_ap_apartment (apartment_id)`);
    // apartment/display_name (snapshots) удаляем — значение берём через JOIN
    await dropColumnIfExists("appeal_participants", "apartment");
    await dropColumnIfExists("appeal_participants", "display_name");

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
    await dropColumnIfExists("neighbor_ads", "image_url");
    await dropColumnIfExists("neighbor_ads", "image_urls");
    await addColumnIfNotExists(
        "neighbor_ads",
        "status",
        "ENUM('new','under_review','published','archived','rejected','under_review_appeal') NOT NULL DEFAULT 'new'",
    );
    if (await columnExists("neighbor_ads", "building_key")) {
        if (!(await foreignKeyExists("neighbor_ads", "fk_na_building"))) {
            await exec(`ALTER TABLE neighbor_ads ADD CONSTRAINT fk_na_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE`);
        }
    }

    // pending_moderation/archived заменены единым полем status (single source of truth)
    if (await columnExists("neighbor_ads", "pending_moderation")) {
        await exec(`UPDATE neighbor_ads SET status = 'under_review' WHERE pending_moderation = 1 AND status = 'new'`);
        await exec(`UPDATE neighbor_ads SET status = 'archived' WHERE archived = 1 AND status = 'new'`);
        await exec(`UPDATE neighbor_ads SET status = 'published' WHERE status = 'new'`);
        await exec(`ALTER TABLE neighbor_ads DROP COLUMN pending_moderation`);
        await exec(`ALTER TABLE neighbor_ads DROP COLUMN archived`);
    }
    await exec(`UPDATE neighbor_ads SET status = 'published' WHERE status = 'new'`);
    await exec(`
        ALTER TABLE neighbor_ads MODIFY COLUMN status
        ENUM('under_review','published','archived','rejected','under_review_appeal')
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
            description      TEXT                   NOT NULL,
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
    await addColumnIfNotExists("votes", "updated_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
    await addColumnIfNotExists("votes", "user_id", "BIGINT UNSIGNED NULL");
    await addColumnIfNotExists(
        "votes",
        "status",
        "ENUM('new','under_review','active','completed','cancelled') NOT NULL DEFAULT 'new'",
    );
    if (await columnExists("votes", "building_key")) {
        if (!(await foreignKeyExists("votes", "fk_votes_building"))) {
            await exec(`ALTER TABLE votes ADD CONSTRAINT fk_votes_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE`);
        }
    }

    // Существующие голосования создавались до появления status — переносим их в active/completed
    await exec(`UPDATE votes SET status = 'completed' WHERE status = 'new' AND (closed = 1 OR ends_at <= NOW())`);
    await exec(`UPDATE votes SET status = 'active' WHERE status = 'new'`);
    await exec(`
        ALTER TABLE votes MODIFY COLUMN status
        ENUM('under_review','active','completed','cancelled')
        NOT NULL DEFAULT 'active'
    `);
    await exec(`ALTER TABLE votes ADD INDEX idx_votes_status (status)`);
    // created_by_label (snapshot) удаляем — имя/квартиру берём через JOIN
    await dropColumnIfExists("votes", "created_by_label");

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
    await addColumnIfNotExists("vote_casts", "apartment_id", "BIGINT UNSIGNED DEFAULT NULL");
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
    await dropColumnIfExists("vote_casts", "area_sqm");

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

    if (await columnExists("environment_ratings", "feedback_tags")) {
        await exec(`ALTER TABLE environment_ratings DROP COLUMN feedback_tags`);
    }

    await exec(
        `ALTER TABLE environment_ratings MODIFY COLUMN courtyard_stars TINYINT NOT NULL CHECK (courtyard_stars BETWEEN 1 AND 5)`,
    );
    await exec(
        `ALTER TABLE environment_ratings MODIFY COLUMN entrance_stars TINYINT NOT NULL CHECK (entrance_stars BETWEEN 1 AND 5)`,
    );
    await exec(
        `ALTER TABLE environment_ratings MODIFY COLUMN uk_stars TINYINT NOT NULL CHECK (uk_stars BETWEEN 1 AND 5)`,
    );

    // Старые установки: одна оценка в месяц на пользователя суммарно — расширяем до «на дом»
    if (await columnExists("environment_ratings", "month_key") && await columnExists("environment_ratings", "user_id")) {
        await exec(`ALTER TABLE environment_ratings DROP INDEX uq_er_user_month`);
        await exec(`ALTER TABLE environment_ratings ADD UNIQUE KEY uq_er_user_building_month (user_id, building_key, month_key)`);
    }

    // ============================================================
    //  РАЙОН (КАРТА)
    // ============================================================

    // district_layers — справочник слоёв карты района
    await pool.query(`
        CREATE TABLE IF NOT EXISTS district_layers (
            layer_id VARCHAR(40)  NOT NULL,
            title    VARCHAR(255) NOT NULL DEFAULT '',
            PRIMARY KEY (layer_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await seedDistrictLayers();

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
    await addColumnIfNotExists("district_pois", "created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
    // scope полностью определялся building_key (NULL -> city, иначе -> house) — избыточная колонка
    await dropColumnIfExists("district_pois", "scope");
    await exec(`ALTER TABLE district_pois ADD CONSTRAINT fk_dp_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE`);
    // Старые установки: layer_id был ENUM — переводим на VARCHAR
    await exec(`ALTER TABLE district_pois MODIFY COLUMN layer_id VARCHAR(40) NOT NULL`);
    await exec(`ALTER TABLE district_pois DROP FOREIGN KEY fk_dp_layer`);
    await exec(`DELETE FROM district_pois WHERE layer_id NOT IN (
        'schools_daycare','clinic_pharmacy','grocery','parks',
        'bus_stops_city','parking_city','waste_yard','bus_stops_house','parking_house'
    )`);
    await exec(
        `ALTER TABLE district_pois ADD CONSTRAINT fk_dp_layer FOREIGN KEY (layer_id) REFERENCES district_layers(layer_id) ON UPDATE CASCADE`,
    );

    // ============================================================
    //  АДМИНКА И PUSH-ТОКЕНЫ
    // ============================================================

    // Администраторы (отдельно от users). admin — все дома; moderator — свой дом (building_key).
    await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_users (
            id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            email         VARCHAR(255)    NOT NULL,
            password_hash VARCHAR(255)    NOT NULL,
            full_name     VARCHAR(255)    NOT NULL DEFAULT '',
            role          ENUM('admin','moderator') NOT NULL DEFAULT 'admin',
            building_key  VARCHAR(120)    DEFAULT NULL COMMENT 'moderator: дом; admin: NULL = все дома',
            is_active     TINYINT(1)      NOT NULL DEFAULT 1,
            created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_admin_users_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await exec(`ALTER TABLE admin_users MODIFY COLUMN password_hash VARCHAR(255) NOT NULL`);
    await addColumnIfNotExists("admin_users", "role", "ENUM('admin','moderator') NOT NULL DEFAULT 'admin'");
    await addColumnIfNotExists("admin_users", "building_key", "VARCHAR(120) DEFAULT NULL COMMENT 'moderator: дом; admin: NULL = все дома'");
    await exec(`ALTER TABLE admin_users DROP FOREIGN KEY fk_admin_users_building`);
    await exec(`ALTER TABLE admin_users ADD CONSTRAINT fk_admin_users_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE`);
    await exec(`ALTER TABLE admin_users ADD INDEX idx_admin_users_building (building_key)`);

    // Связи admin_users с сущностями, которые создаёт/обрабатывает админка
    for (const { table, column, fk, index } of ADMIN_FK_LINKS) {
        await addColumnIfNotExists(table, column, "BIGINT UNSIGNED DEFAULT NULL");
        await exec(`ALTER TABLE ${table} DROP FOREIGN KEY fk_${table}_${column}`);
        await exec(`ALTER TABLE ${table} DROP FOREIGN KEY ${fk}`);
        await exec(`ALTER TABLE ${table} DROP INDEX idx_${table}_${column}`);
        await exec(`ALTER TABLE ${table} ADD INDEX ${index} (${column})`);
        await exec(
            `ALTER TABLE ${table} ADD CONSTRAINT ${fk} FOREIGN KEY (${column}) REFERENCES admin_users(id) ON DELETE SET NULL`,
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
        await exec(`ALTER TABLE admin_users DROP COLUMN permissions`);
    }

    // neighbor_ads: author_apartment_id вместо author_user_id + building_key
    if (!(await columnExists("neighbor_ads", "author_apartment_id"))) {
        await exec(`ALTER TABLE neighbor_ads ADD COLUMN author_apartment_id BIGINT UNSIGNED DEFAULT NULL`);
    }
    if (await columnExists("neighbor_ads", "author_user_id")) {
        await exec(`
            UPDATE neighbor_ads na
            JOIN user_profiles up ON up.user_id = na.author_user_id
            JOIN user_apartments ua ON ua.id = up.active_apartment_id AND ua.building_key = na.building_key
            SET na.author_apartment_id = ua.id
            WHERE na.author_apartment_id IS NULL
        `);
        await exec(`
            UPDATE neighbor_ads na
            JOIN user_apartments ua ON ua.user_id = na.author_user_id AND ua.building_key = na.building_key
            SET na.author_apartment_id = (
                SELECT MIN(ua2.id) FROM user_apartments ua2
                WHERE ua2.user_id = na.author_user_id AND ua2.building_key = na.building_key
            )
            WHERE na.author_apartment_id IS NULL
        `);
        await exec(`DELETE FROM neighbor_ads WHERE author_apartment_id IS NULL`);
        await exec(`ALTER TABLE neighbor_ads DROP FOREIGN KEY fk_na_user`);
        await exec(`ALTER TABLE neighbor_ads DROP FOREIGN KEY fk_na_building`);
        await exec(`ALTER TABLE neighbor_ads DROP INDEX idx_na_author_created`);
        await exec(`ALTER TABLE neighbor_ads DROP INDEX idx_na_building_created`);
        await exec(`ALTER TABLE neighbor_ads DROP COLUMN author_user_id`);
        await exec(`ALTER TABLE neighbor_ads DROP COLUMN building_key`);
        await exec(`ALTER TABLE neighbor_ads MODIFY COLUMN author_apartment_id BIGINT UNSIGNED NOT NULL`);
        await exec(`ALTER TABLE neighbor_ads ADD CONSTRAINT fk_na_apartment FOREIGN KEY (author_apartment_id) REFERENCES user_apartments(id) ON DELETE CASCADE`);
        await exec(`ALTER TABLE neighbor_ads ADD INDEX idx_na_apartment_created (author_apartment_id, created_at DESC)`);
    }

    // appeal_participants: user_id убираем, apartment_id обязателен
    if (await columnExists("appeal_participants", "user_id")) {
        await exec(`DELETE FROM appeal_participants WHERE apartment_id IS NULL`);
        await exec(`ALTER TABLE appeal_participants DROP FOREIGN KEY fk_ap_user`);
        await exec(`ALTER TABLE appeal_participants DROP INDEX uq_ap_appeal_user`);
        await exec(`ALTER TABLE appeal_participants DROP COLUMN user_id`);
        await exec(`ALTER TABLE appeal_participants MODIFY COLUMN apartment_id BIGINT UNSIGNED NOT NULL`);
        await exec(`ALTER TABLE appeal_participants DROP FOREIGN KEY fk_ap_apartment`);
        await exec(`ALTER TABLE appeal_participants ADD CONSTRAINT fk_ap_apartment FOREIGN KEY (apartment_id) REFERENCES user_apartments(id) ON DELETE CASCADE`);
        await exec(`ALTER TABLE appeal_participants ADD UNIQUE KEY uq_ap_appeal_apartment (appeal_id, apartment_id)`);
    }

    // vote_casts: user_id убираем, apartment_id обязателен
    if (await columnExists("vote_casts", "user_id")) {
        await exec(`DELETE FROM vote_casts WHERE apartment_id IS NULL`);
        await exec(`ALTER TABLE vote_casts DROP FOREIGN KEY fk_vc_user`);
        await exec(`ALTER TABLE vote_casts DROP INDEX uq_vc_vote_user`);
        await exec(`ALTER TABLE vote_casts DROP COLUMN user_id`);
        await exec(`ALTER TABLE vote_casts MODIFY COLUMN apartment_id BIGINT UNSIGNED NOT NULL`);
        await exec(`ALTER TABLE vote_casts DROP FOREIGN KEY fk_vc_apartment`);
        await exec(`ALTER TABLE vote_casts ADD CONSTRAINT fk_vc_apartment FOREIGN KEY (apartment_id) REFERENCES user_apartments(id) ON DELETE CASCADE`);
        await exec(`ALTER TABLE vote_casts ADD UNIQUE KEY uq_vc_vote_apartment (vote_id, apartment_id)`);
    }

    // votes: author_apartment_id вместо user_id
    if (!(await columnExists("votes", "author_apartment_id"))) {
        await exec(`ALTER TABLE votes ADD COLUMN author_apartment_id BIGINT UNSIGNED DEFAULT NULL`);
    }
    if (await columnExists("votes", "user_id")) {
        await exec(`
            UPDATE votes v
            JOIN user_profiles up ON up.user_id = v.user_id
            JOIN user_apartments ua ON ua.id = up.active_apartment_id AND ua.building_key = v.building_key
            SET v.author_apartment_id = ua.id
            WHERE v.user_id IS NOT NULL AND v.author_apartment_id IS NULL
        `);
        await exec(`
            UPDATE votes v
            JOIN user_apartments ua ON ua.user_id = v.user_id AND ua.building_key = v.building_key
            SET v.author_apartment_id = (
                SELECT MIN(ua2.id) FROM user_apartments ua2
                WHERE ua2.user_id = v.user_id AND ua2.building_key = v.building_key
            )
            WHERE v.user_id IS NOT NULL AND v.author_apartment_id IS NULL
        `);
        await exec(`ALTER TABLE votes DROP FOREIGN KEY fk_votes_user`);
        await exec(`ALTER TABLE votes DROP COLUMN user_id`);
        await exec(`ALTER TABLE votes ADD CONSTRAINT fk_votes_author_apartment FOREIGN KEY (author_apartment_id) REFERENCES user_apartments(id) ON DELETE SET NULL`);
    }

    await seedDistrictLayers();

    // permission_codes / admin_user_permissions заменены на role + building_key в admin_users
    await exec(`DROP TABLE IF EXISTS admin_user_permissions`);
    await exec(`DROP TABLE IF EXISTS permission_codes`);

    // active_apartment_id должна принадлежать user_id профиля
    await exec(`DROP TRIGGER IF EXISTS trg_up_active_apartment_bi`);
    await exec(`DROP TRIGGER IF EXISTS trg_up_active_apartment_bu`);
    await pool.query(`
        CREATE TRIGGER trg_up_active_apartment_bi
        BEFORE INSERT ON user_profiles
        FOR EACH ROW
        BEGIN
            IF NEW.active_apartment_id IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM user_apartments ua
                WHERE ua.id = NEW.active_apartment_id AND ua.user_id = NEW.user_id
            ) THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'active_apartment_id does not belong to user';
            END IF;
        END
    `);
    await pool.query(`
        CREATE TRIGGER trg_up_active_apartment_bu
        BEFORE UPDATE ON user_profiles
        FOR EACH ROW
        BEGIN
            IF NEW.active_apartment_id IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM user_apartments ua
                WHERE ua.id = NEW.active_apartment_id AND ua.user_id = NEW.user_id
            ) THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'active_apartment_id does not belong to user';
            END IF;
        END
    `);

    // ============================================================
    //  СТРОГАЯ НФ + ЦЕЛОСТНОСТЬ
    // ============================================================

    if (await columnExists("votes", "status")) {
        if (!(await columnExists("votes", "moderation_status"))) {
            await exec(
                `ALTER TABLE votes ADD COLUMN moderation_status ENUM('none','under_review','cancelled') NOT NULL DEFAULT 'none'`,
            );
            await exec(`UPDATE votes SET moderation_status = 'under_review' WHERE status = 'under_review'`);
            await exec(`UPDATE votes SET moderation_status = 'cancelled' WHERE status = 'cancelled'`);
        }
        await exec(`ALTER TABLE votes DROP INDEX idx_votes_status`);
        await exec(`ALTER TABLE votes DROP COLUMN status`);
    }
    if (!(await columnExists("votes", "moderation_status"))) {
        await exec(
            `ALTER TABLE votes ADD COLUMN moderation_status ENUM('none','under_review','cancelled') NOT NULL DEFAULT 'none'`,
        );
    }
    await exec(`ALTER TABLE votes ADD INDEX idx_votes_moderation (moderation_status)`);

    if (await columnExists("votes", "building_key")) {
        await exec(`UPDATE votes SET building_key = NULL WHERE author_apartment_id IS NOT NULL`);
        await exec(`ALTER TABLE votes MODIFY COLUMN building_key VARCHAR(120) NULL`);
        await exec(`ALTER TABLE votes DROP FOREIGN KEY fk_votes_building`);
        await exec(
            `ALTER TABLE votes ADD CONSTRAINT fk_votes_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE`,
        );
        await dropConstraintIfExists("votes", "chk_votes_building_source");
        await exec(`
            ALTER TABLE votes ADD CONSTRAINT chk_votes_building_source CHECK (
                (author_apartment_id IS NOT NULL AND building_key IS NULL)
                OR
                (author_apartment_id IS NULL AND building_key IS NOT NULL)
            )
        `);
    }

    await exec(`DROP TRIGGER IF EXISTS trg_vr_pending_ai`);
    await exec(`DROP TRIGGER IF EXISTS trg_vr_pending_au`);
    await exec(`DROP TABLE IF EXISTS verification_pending_apartments`);
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
    if (!(await columnExists("verification_requests", "pending_apartment_id"))) {
        await exec(`
            ALTER TABLE verification_requests
              ADD COLUMN pending_apartment_id BIGINT UNSIGNED
                AS (IF(status = 'pending', apartment_id, NULL)) STORED
        `);
        await exec(`ALTER TABLE verification_requests ADD UNIQUE KEY uq_vr_pending_apartment (pending_apartment_id)`);
    }

    await dropConstraintIfExists("admin_users", "chk_admin_users_role_building");
    await exec(`
        ALTER TABLE admin_users ADD CONSTRAINT chk_admin_users_role_building CHECK (
            (role = 'admin' AND building_key IS NULL)
            OR
            (role = 'moderator' AND building_key IS NOT NULL)
        )
    `);

    // ============================================================
    //  ЦЕЛОСТНОСТЬ: квартиры, верификация, обращения, ключи домов
    // ============================================================

    await exec(`UPDATE buildings SET building_key = LOWER(TRIM(building_key))`);
    await exec(`UPDATE user_apartments SET building_key = LOWER(TRIM(building_key))`);

    await addColumnIfNotExists("user_apartments", "apartment_norm", "VARCHAR(20) DEFAULT NULL");
    await addColumnIfNotExists("user_apartments", "verification_status", "ENUM('none','pending','lease','ownership','rejected') NOT NULL DEFAULT 'none'");
    await exec(`
        UPDATE user_apartments ua
        SET apartment_norm = ${SQL_NORMALIZE_APARTMENT_NORM.replace(/\bapartment\b/g, "ua.apartment")}
        WHERE apartment_norm IS NULL OR apartment_norm = ''
    `);
    await exec(`UPDATE user_apartments SET apartment = TRIM(apartment) WHERE apartment <> TRIM(apartment)`);

  // Синхронизация verification_status из последней заявки
    await exec(`
        UPDATE user_apartments ua
        JOIN (
            SELECT vr.apartment_id,
                   CASE
                       WHEN vr.status = 'pending' THEN 'pending'
                       WHEN vr.status = 'approved' AND vr.doc_type = 'ownership' THEN 'ownership'
                       WHEN vr.status = 'approved' THEN 'lease'
                       WHEN vr.status = 'rejected' THEN 'rejected'
                       ELSE 'none'
                   END AS vs,
                   vr.submitted_at
            FROM verification_requests vr
            JOIN (
                SELECT apartment_id, MAX(submitted_at) AS max_submitted
                FROM verification_requests
                GROUP BY apartment_id
            ) latest ON latest.apartment_id = vr.apartment_id AND latest.max_submitted = vr.submitted_at
        ) x ON x.apartment_id = ua.id
        SET ua.verification_status = x.vs
    `);

    await exec(`ALTER TABLE user_apartments MODIFY COLUMN apartment_norm VARCHAR(20) NOT NULL`);
    await dropIndexIfExists("user_apartments", "uq_ua_user_building_apt");
    await exec(`ALTER TABLE user_apartments ADD UNIQUE KEY uq_ua_user_building_norm (user_id, building_key, apartment_norm)`);
    // Дубликаты квартир в одном доме — оставляем запису с максимальным статусом верификации
    await pool.query(`
        DELETE ua FROM user_apartments ua
        INNER JOIN (
            SELECT building_key, apartment_norm,
                CAST(SUBSTRING_INDEX(
                    GROUP_CONCAT(id ORDER BY FIELD(verification_status,'ownership','lease','pending','rejected','none'), id),
                    ',', 1
                ) AS UNSIGNED) AS keep_id
            FROM user_apartments
            GROUP BY building_key, apartment_norm
            HAVING COUNT(*) > 1
        ) d ON ua.building_key = d.building_key AND ua.apartment_norm = d.apartment_norm AND ua.id <> d.keep_id
    `);
    await dropIndexIfExists("user_apartments", "uq_ua_building_apartment_norm");
    await exec(`ALTER TABLE user_apartments ADD UNIQUE KEY uq_ua_building_apartment_norm (building_key, apartment_norm)`);

    // Обращения: снимок автора + категории по ключам
    await addColumnIfNotExists("appeals", "author_building_key", "VARCHAR(120) NOT NULL DEFAULT ''");
    await addColumnIfNotExists("appeals", "author_apartment_snapshot", "VARCHAR(20) NOT NULL DEFAULT ''");
    await addColumnIfNotExists("appeals", "author_user_id", "BIGINT UNSIGNED NOT NULL DEFAULT 0");
    await exec(`
        UPDATE appeals a
        JOIN user_apartments ua ON ua.id = a.author_apartment_id
        SET a.author_building_key = ua.building_key,
            a.author_apartment_snapshot = ua.apartment,
            a.author_user_id = ua.user_id
        WHERE a.author_building_key = '' OR a.author_user_id = 0
    `);

    if (await columnExists("appeals", "category")) {
        await exec(`ALTER TABLE appeals MODIFY COLUMN category VARCHAR(80) NOT NULL DEFAULT 'other'`);
        for (const [legacy, key] of Object.entries(LEGACY_APPEAL_CATEGORY_MAP)) {
            const esc = legacy.replace(/'/g, "''");
            await exec(`UPDATE appeals SET category = '${key}' WHERE category = '${esc}'`);
        }
        await exec(`
            ALTER TABLE appeals MODIFY COLUMN category
            ENUM('emergency','plumbing','electrical','heating','ventilation','cleaning','order_violation','owners_meeting','other')
            NOT NULL DEFAULT 'other'
        `);
    }

    await exec(`
        UPDATE appeals a
        LEFT JOIN user_apartments ua ON ua.id = a.author_apartment_id
        SET a.author_apartment_id = NULL
        WHERE a.author_apartment_id IS NOT NULL
          AND (ua.id IS NULL OR a.author_apartment_id = 0)
    `);
    await exec(`ALTER TABLE appeals MODIFY COLUMN author_apartment_id BIGINT UNSIGNED NULL`);
    if (await foreignKeyExists("appeals", "fk_appeals_apartment")) {
        await exec(`ALTER TABLE appeals DROP FOREIGN KEY fk_appeals_apartment`);
    }
    if (!(await foreignKeyExists("appeals", "fk_appeals_apartment"))) {
        await exec(`
            ALTER TABLE appeals ADD CONSTRAINT fk_appeals_apartment
            FOREIGN KEY (author_apartment_id) REFERENCES user_apartments(id) ON DELETE SET NULL
        `);
    }

    await exec(`DELETE FROM refresh_tokens WHERE expires_at < NOW()`);

    await exec(`DROP TRIGGER IF EXISTS trg_votes_building_bi`);
    await exec(`DROP TRIGGER IF EXISTS trg_votes_building_bu`);

    await exec(`DROP TRIGGER IF EXISTS trg_ua_normalize_bi`);
    await pool.query(`
        CREATE TRIGGER trg_ua_normalize_bi
        BEFORE INSERT ON user_apartments
        FOR EACH ROW
        BEGIN
            SET NEW.building_key = LOWER(TRIM(NEW.building_key));
            SET NEW.apartment = TRIM(NEW.apartment);
            SET NEW.apartment_norm = ${SQL_NORMALIZE_APARTMENT_NORM.replace(/\bapartment\b/g, "NEW.apartment")};
            IF NEW.apartment_norm = '' THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'apartment number is empty after normalization';
            END IF;
        END
    `);

    await exec(`DROP TRIGGER IF EXISTS trg_ua_normalize_bu`);
    await pool.query(`
        CREATE TRIGGER trg_ua_normalize_bu
        BEFORE UPDATE ON user_apartments
        FOR EACH ROW
        BEGIN
            SET NEW.building_key = LOWER(TRIM(NEW.building_key));
            SET NEW.apartment = TRIM(NEW.apartment);
            SET NEW.apartment_norm = ${SQL_NORMALIZE_APARTMENT_NORM.replace(/\bapartment\b/g, "NEW.apartment")};
            IF NEW.apartment_norm = '' THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'apartment number is empty after normalization';
            END IF;
        END
    `);

    await exec(`DROP TRIGGER IF EXISTS trg_ua_before_delete`);
    await pool.query(`
        CREATE TRIGGER trg_ua_before_delete
        BEFORE DELETE ON user_apartments
        FOR EACH ROW
        BEGIN
            UPDATE votes
            SET building_key = OLD.building_key
            WHERE author_apartment_id = OLD.id AND building_key IS NULL;
        END
    `);

    await exec(`DROP TRIGGER IF EXISTS trg_appeals_snapshot_bi`);
    await pool.query(`
        CREATE TRIGGER trg_appeals_snapshot_bi
        BEFORE INSERT ON appeals
        FOR EACH ROW
        BEGIN
            IF NEW.author_apartment_id IS NOT NULL THEN
                SELECT ua.building_key, ua.apartment, ua.user_id
                INTO @bk, @apt, @uid
                FROM user_apartments ua
                WHERE ua.id = NEW.author_apartment_id;
                SET NEW.author_building_key = COALESCE(@bk, NEW.author_building_key);
                SET NEW.author_apartment_snapshot = COALESCE(@apt, NEW.author_apartment_snapshot);
                SET NEW.author_user_id = COALESCE(@uid, NEW.author_user_id);
            END IF;
        END
    `);

    await exec(`DROP TRIGGER IF EXISTS trg_vr_sync_ua_ai`);
    await pool.query(`
        CREATE TRIGGER trg_vr_sync_ua_ai
        AFTER INSERT ON verification_requests
        FOR EACH ROW
        BEGIN
            UPDATE user_apartments ua SET verification_status = COALESCE((
                SELECT CASE
                    WHEN vr.status = 'pending' THEN 'pending'
                    WHEN vr.status = 'approved' AND vr.doc_type = 'ownership' THEN 'ownership'
                    WHEN vr.status = 'approved' THEN 'lease'
                    WHEN vr.status = 'rejected' THEN 'rejected'
                    ELSE 'none'
                END
                FROM verification_requests vr
                WHERE vr.apartment_id = NEW.apartment_id
                ORDER BY vr.submitted_at DESC
                LIMIT 1
            ), 'none')
            WHERE ua.id = NEW.apartment_id;
        END
    `);

    await exec(`DROP TRIGGER IF EXISTS trg_vr_sync_ua_au`);
    await pool.query(`
        CREATE TRIGGER trg_vr_sync_ua_au
        AFTER UPDATE ON verification_requests
        FOR EACH ROW
        BEGIN
            UPDATE user_apartments ua SET verification_status = COALESCE((
                SELECT CASE
                    WHEN vr.status = 'pending' THEN 'pending'
                    WHEN vr.status = 'approved' AND vr.doc_type = 'ownership' THEN 'ownership'
                    WHEN vr.status = 'approved' THEN 'lease'
                    WHEN vr.status = 'rejected' THEN 'rejected'
                    ELSE 'none'
                END
                FROM verification_requests vr
                WHERE vr.apartment_id = NEW.apartment_id
                ORDER BY vr.submitted_at DESC
                LIMIT 1
            ), 'none')
            WHERE ua.id = NEW.apartment_id;
        END
    `);

    await exec(`DROP TRIGGER IF EXISTS trg_vr_sync_ua_ad`);
    await pool.query(`
        CREATE TRIGGER trg_vr_sync_ua_ad
        AFTER DELETE ON verification_requests
        FOR EACH ROW
        BEGIN
            UPDATE user_apartments ua SET verification_status = COALESCE((
                SELECT CASE
                    WHEN vr.status = 'pending' THEN 'pending'
                    WHEN vr.status = 'approved' AND vr.doc_type = 'ownership' THEN 'ownership'
                    WHEN vr.status = 'approved' THEN 'lease'
                    WHEN vr.status = 'rejected' THEN 'rejected'
                    ELSE 'none'
                END
                FROM verification_requests vr
                WHERE vr.apartment_id = OLD.apartment_id
                ORDER BY vr.submitted_at DESC
                LIMIT 1
            ), 'none')
            WHERE ua.id = OLD.apartment_id;
        END
    `);

    await exec(`DROP TRIGGER IF EXISTS trg_na_expiry_bi`);
    await pool.query(`
        CREATE TRIGGER trg_na_expiry_bi
        BEFORE INSERT ON neighbor_ads
        FOR EACH ROW
        BEGIN
            IF NEW.status = 'published' AND NEW.expires_at <= NOW() THEN
                SET NEW.status = 'archived';
            END IF;
        END
    `);

    await exec(`DROP TRIGGER IF EXISTS trg_na_expiry_bu`);
    await pool.query(`
        CREATE TRIGGER trg_na_expiry_bu
        BEFORE UPDATE ON neighbor_ads
        FOR EACH ROW
        BEGIN
            IF NEW.status = 'published' AND NEW.expires_at <= NOW() THEN
                SET NEW.status = 'archived';
            END IF;
        END
    `);

    await exec(`DROP TRIGGER IF EXISTS trg_vc_building_bi`);
    await exec(`DROP TRIGGER IF EXISTS trg_vc_validate_bi`);
    await pool.query(`
        CREATE TRIGGER trg_vc_validate_bi
        BEFORE INSERT ON vote_casts
        FOR EACH ROW
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM vote_options WHERE id = NEW.option_id AND vote_id = NEW.vote_id
            ) THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'option does not belong to vote';
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM user_apartments WHERE id = NEW.apartment_id AND verification_status = 'ownership'
            ) THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'only verified owners can vote';
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM votes v
                JOIN user_apartments voter ON voter.id = NEW.apartment_id
                LEFT JOIN user_apartments author_ua ON author_ua.id = v.author_apartment_id
                WHERE v.id = NEW.vote_id
                  AND v.moderation_status = 'none'
                  AND v.closed = 0 AND v.ends_at > NOW()
                  AND LOWER(COALESCE(author_ua.building_key, v.building_key)) = LOWER(voter.building_key)
            ) THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'vote is not active or apartment mismatch';
            END IF;
        END
    `);

    await exec(`DROP TRIGGER IF EXISTS trg_ap_participant_building_bi`);
    await pool.query(`
        CREATE TRIGGER trg_ap_participant_building_bi
        BEFORE INSERT ON appeal_participants
        FOR EACH ROW
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM appeals a
                LEFT JOIN user_apartments author_ua ON author_ua.id = a.author_apartment_id
                JOIN user_apartments participant ON participant.id = NEW.apartment_id
                WHERE a.id = NEW.appeal_id
                  AND LOWER(COALESCE(author_ua.building_key, a.author_building_key)) = LOWER(participant.building_key)
            ) THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'participant apartment is not in appeal building';
            END IF;
        END
    `);

    await exec(`DROP TRIGGER IF EXISTS trg_vc_building_bu`);
    await exec(`DROP TRIGGER IF EXISTS trg_vc_validate_bu`);
    await pool.query(`
        CREATE TRIGGER trg_vc_validate_bu
        BEFORE UPDATE ON vote_casts
        FOR EACH ROW
        BEGIN
            IF NEW.vote_id <> OLD.vote_id OR NEW.apartment_id <> OLD.apartment_id OR NEW.option_id <> OLD.option_id THEN
                IF NOT EXISTS (
                    SELECT 1 FROM vote_options WHERE id = NEW.option_id AND vote_id = NEW.vote_id
                ) THEN
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'option does not belong to vote';
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM user_apartments WHERE id = NEW.apartment_id AND verification_status = 'ownership'
                ) THEN
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'only verified owners can vote';
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM votes v
                    JOIN user_apartments voter ON voter.id = NEW.apartment_id
                    LEFT JOIN user_apartments author_ua ON author_ua.id = v.author_apartment_id
                    WHERE v.id = NEW.vote_id
                      AND v.moderation_status = 'none'
                      AND v.closed = 0 AND v.ends_at > NOW()
                      AND LOWER(COALESCE(author_ua.building_key, v.building_key)) = LOWER(voter.building_key)
                ) THEN
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'vote is not active or apartment mismatch';
                END IF;
            END IF;
        END
    `);

    await exec(`DROP TRIGGER IF EXISTS trg_ap_participant_building_bu`);
    await pool.query(`
        CREATE TRIGGER trg_ap_participant_building_bu
        BEFORE UPDATE ON appeal_participants
        FOR EACH ROW
        BEGIN
            IF NEW.appeal_id <> OLD.appeal_id OR NEW.apartment_id <> OLD.apartment_id THEN
                IF NOT EXISTS (
                    SELECT 1 FROM appeals a
                    LEFT JOIN user_apartments author_ua ON author_ua.id = a.author_apartment_id
                    JOIN user_apartments participant ON participant.id = NEW.apartment_id
                    WHERE a.id = NEW.appeal_id
                      AND LOWER(COALESCE(author_ua.building_key, a.author_building_key)) = LOWER(participant.building_key)
                ) THEN
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'participant apartment is not in appeal building';
                END IF;
            END IF;
        END
    `);

    // user_notification_reads вместо users.notifications_last_seen_at
    if (await columnExists("users", "notifications_last_seen_at")) {
        await exec(`
            INSERT IGNORE INTO user_notification_reads (user_id, notification_id, read_at)
            SELECT u.id, n.id, u.notifications_last_seen_at
            FROM users u
            JOIN notifications n ON n.created_at <= u.notifications_last_seen_at
            WHERE u.notifications_last_seen_at IS NOT NULL
        `);
        await exec(`ALTER TABLE users DROP COLUMN notifications_last_seen_at`);
    }

    await runMaintenance();
    await installMaintenanceEvents();

    await addIndexIfNotExists("appeals", "idx_appeals_author_building", "author_building_key, created_at DESC");
    await addIndexIfNotExists("appeals", "idx_appeals_author_user", "author_user_id, created_at DESC");

    await exec(`UPDATE user_profiles SET phone = NULL WHERE phone IS NULL OR TRIM(phone) = ''`);
    await exec(`ALTER TABLE user_profiles MODIFY phone VARCHAR(50) NULL DEFAULT NULL`);
    await exec(`
        UPDATE user_profiles p
        JOIN (
            SELECT phone, MIN(user_id) AS keep_uid
            FROM user_profiles
            WHERE phone IS NOT NULL
            GROUP BY phone
            HAVING COUNT(*) > 1
        ) d ON p.phone = d.phone AND p.user_id <> d.keep_uid
        SET p.phone = NULL
    `);
    await dropIndexIfExists("user_profiles", "uq_profile_phone");
    await exec(`ALTER TABLE user_profiles ADD UNIQUE KEY uq_profile_phone (phone)`);

    await exec(`DROP TRIGGER IF EXISTS trg_buildings_normalize_bi`);
    await pool.query(`
        CREATE TRIGGER trg_buildings_normalize_bi
        BEFORE INSERT ON buildings
        FOR EACH ROW
        BEGIN
            SET NEW.building_key = LOWER(TRIM(NEW.building_key));
        END
    `);
    await exec(`DROP TRIGGER IF EXISTS trg_buildings_normalize_bu`);
    await pool.query(`
        CREATE TRIGGER trg_buildings_normalize_bu
        BEFORE UPDATE ON buildings
        FOR EACH ROW
        BEGIN
            SET NEW.building_key = LOWER(TRIM(NEW.building_key));
        END
    `);

    // appeal_participants: только подпись (квартира + дата), без анонимности/комментария/фото
    await dropColumnIfExists("appeal_participants", "anonymous");
    await dropColumnIfExists("appeal_participants", "comment");
    await dropColumnIfExists("appeal_participants", "photo_uri");

    await exec(`DROP TABLE IF EXISTS environment_rating_feedback_tags`);

    console.log("Migration complete");
}
