-- ============================================================
--  Domovoy — схема БД (MariaDB 10.6+ / MySQL 8.0+)
--  Нормализована до 3НФ. Источник истины — backend/src/db/migrate.ts
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
--  УК (управляющие компании)
--  Определена до buildings, т.к. buildings ссылается на неё.
-- ============================================================

-- management_companies — одна УК может обслуживать несколько домов (buildings.management_company_id)
CREATE TABLE IF NOT EXISTS management_companies (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_name VARCHAR(255)    NOT NULL DEFAULT '',
  phone        VARCHAR(100)    NOT NULL DEFAULT '',
  email        VARCHAR(255)    NOT NULL DEFAULT '',
  site         VARCHAR(255)    NOT NULL DEFAULT '',
  hours        VARCHAR(255)    NOT NULL DEFAULT '',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  СПРАВОЧНИК ДОМОВ (+ паспорт дома)
-- ============================================================

CREATE TABLE IF NOT EXISTS buildings (
  building_key VARCHAR(120)    NOT NULL,
  address      TEXT            NOT NULL,
  short_name   VARCHAR(255)    NOT NULL,
  city         VARCHAR(255)    NOT NULL DEFAULT '',
  is_active    BOOLEAN         NOT NULL DEFAULT TRUE,
  year_built   INT             DEFAULT NULL,
  entrances    INT             DEFAULT NULL,
  apartments   INT             DEFAULT NULL,
  lat          DECIMAL(9,6)    DEFAULT NULL,
  lng          DECIMAL(9,6)    DEFAULT NULL,
  chat_telegram_url VARCHAR(500) NOT NULL DEFAULT '',
  chat_vk_url       VARCHAR(500) NOT NULL DEFAULT '',
  chat_max_url      VARCHAR(500) NOT NULL DEFAULT '',
  management_company_id BIGINT UNSIGNED DEFAULT NULL,
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (building_key),
  CONSTRAINT fk_buildings_mc FOREIGN KEY (management_company_id) REFERENCES management_companies(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  ПОЛЬЗОВАТЕЛИ
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email               VARCHAR(255)    NOT NULL,
  password_hash       VARCHAR(255)    NOT NULL,
  data_consent_at     DATETIME        DEFAULT NULL,
  is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
  notif_outages       BOOLEAN         NOT NULL DEFAULT TRUE,
  notif_meetings      BOOLEAN         NOT NULL DEFAULT TRUE,
  notif_announcements BOOLEAN         NOT NULL DEFAULT TRUE,
  notif_general       BOOLEAN         NOT NULL DEFAULT TRUE,
  blocked_by_admin_id BIGINT UNSIGNED DEFAULT NULL,
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  INDEX idx_users_blocked_admin (blocked_by_admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  КВАРТИРЫ ПОЛЬЗОВАТЕЛЯ (включая первую, добавленную при регистрации)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_apartments (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id            BIGINT UNSIGNED NOT NULL,
  building_key       VARCHAR(120)    NOT NULL,
  apartment          VARCHAR(20)     NOT NULL DEFAULT '',
  apartment_norm     VARCHAR(20)     NOT NULL,
  entrance           INT             DEFAULT NULL,
  apartment_area_sqm DECIMAL(6,2)    DEFAULT NULL,
  verification_status ENUM('none','pending','lease','ownership','rejected') NOT NULL DEFAULT 'none',
  created_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ua_user_building_norm (user_id, building_key, apartment_norm),
  UNIQUE KEY uq_ua_building_apartment_norm (building_key, apartment_norm),
  CONSTRAINT fk_ua_user     FOREIGN KEY (user_id)      REFERENCES users(id)               ON DELETE CASCADE,
  CONSTRAINT fk_ua_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE,
  INDEX idx_ua_user     (user_id),
  INDEX idx_ua_building (building_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ
--  Данные о квартирах (дом/квартира/площадь) живут только в
--  user_apartments — здесь только сама персона + ссылка на
--  «активную» квартиру.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id             BIGINT UNSIGNED NOT NULL,
  full_name           VARCHAR(255)    NOT NULL DEFAULT '',
  phone               VARCHAR(50)     DEFAULT NULL,
  profile_photo       TEXT            DEFAULT NULL,
  active_apartment_id BIGINT UNSIGNED DEFAULT NULL,
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_profile_phone (phone),
  CONSTRAINT fk_up_user             FOREIGN KEY (user_id)             REFERENCES users(id)           ON DELETE CASCADE,
  CONSTRAINT fk_up_active_apartment FOREIGN KEY (active_apartment_id) REFERENCES user_apartments(id) ON DELETE SET NULL,
  INDEX idx_up_active_apartment (active_apartment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  ТОКЕНЫ ОБНОВЛЕНИЯ (JWT refresh flow)
-- ============================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64)        NOT NULL COMMENT 'SHA-256 от refresh-токена',
  expires_at DATETIME        NOT NULL,
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rt_token_hash (token_hash),
  CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_rt_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  ВЕРИФИКАЦИЯ КВАРТИРЫ
--  Одна запись = одна заявка на верификацию конкретной квартиры.
--  user_id и building_key не хранятся — выводятся через apartment_id.
-- ============================================================

CREATE TABLE IF NOT EXISTS verification_requests (
  id                   BIGINT UNSIGNED                              NOT NULL AUTO_INCREMENT,
  apartment_id         BIGINT UNSIGNED                              NOT NULL,
  doc_type             ENUM('lease','ownership')                    NOT NULL,
  status               ENUM('pending','approved','rejected')        NOT NULL DEFAULT 'pending',
  comment              TEXT                                          DEFAULT NULL,
  submitted_at         DATETIME                                      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at          DATETIME                                      DEFAULT NULL,
  reviewed_by_admin_id BIGINT UNSIGNED                               DEFAULT NULL,
  pending_apartment_id BIGINT UNSIGNED                               AS (IF(status = 'pending', apartment_id, NULL)) STORED,
  created_at           DATETIME                                      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME                                      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_vr_apartment FOREIGN KEY (apartment_id) REFERENCES user_apartments(id) ON DELETE CASCADE,
  INDEX idx_vr_apartment_submitted (apartment_id, submitted_at DESC),
  INDEX idx_vr_status (status),
  INDEX idx_vr_admin (reviewed_by_admin_id),
  UNIQUE KEY uq_vr_pending_apartment (pending_apartment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- pending_apartment_id + UNIQUE — не более одной pending-заявки на квартиру (строгая НФ)

-- verification_photos — см. ниже в разделе фото

-- ============================================================
--  УК — КОНТАКТЫ ДОМА
-- ============================================================

-- building_chats удалены — ссылки на чаты хранятся в buildings.chat_*_url

-- ============================================================
--  НОВОСТИ
-- ============================================================

CREATE TABLE IF NOT EXISTS news (
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  building_key         VARCHAR(120)    NOT NULL,
  title                TEXT            NOT NULL,
  excerpt              TEXT            NOT NULL,
  published_at         DATE            NOT NULL,
  is_published         BOOLEAN         NOT NULL DEFAULT TRUE,
  created_by_admin_id  BIGINT UNSIGNED DEFAULT NULL,
  created_at           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_news_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE,
  INDEX idx_news_building_published (building_key, published_at DESC),
  INDEX idx_news_admin (created_by_admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- news_photos — см. ниже в разделе фото

-- ============================================================
--  УВЕДОМЛЕНИЯ
--  building_key = NULL означает «всем домам»
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id                   BIGINT UNSIGNED                                     NOT NULL AUTO_INCREMENT,
  building_key         VARCHAR(120)                                        DEFAULT NULL,
  type                 ENUM('outage','meeting','announcement','general')   NOT NULL DEFAULT 'general',
  title                VARCHAR(500)                                        NOT NULL,
  body                 TEXT                                                NOT NULL,
  created_by_admin_id  BIGINT UNSIGNED                                     DEFAULT NULL,
  created_at           DATETIME                                            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_notif_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE,
  INDEX idx_notif_building_created (building_key, created_at DESC),
  INDEX idx_notif_type_created     (type, created_at DESC),
  INDEX idx_notif_admin (created_by_admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_notification_reads (
  user_id         BIGINT UNSIGNED NOT NULL,
  notification_id BIGINT UNSIGNED NOT NULL,
  read_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, notification_id),
  CONSTRAINT fk_unr_user FOREIGN KEY (user_id)         REFERENCES users(id)          ON DELETE CASCADE,
  CONSTRAINT fk_unr_notif FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  INDEX idx_unr_notification (notification_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  ОБРАЩЕНИЯ (ЗАЯВКИ)
-- ============================================================

-- 3НФ: дом и автор обращения выводятся из author_apartment_id -> user_apartments.
CREATE TABLE IF NOT EXISTS appeals (
  id                     BIGINT UNSIGNED                                                                          NOT NULL AUTO_INCREMENT,
  title                  VARCHAR(500)                                                                             NOT NULL,
  body                   TEXT                                                                                     NOT NULL,
  category               ENUM('emergency','plumbing','electrical','heating','ventilation','cleaning','order_violation','owners_meeting','other') NOT NULL DEFAULT 'other',
  kind                   ENUM('personal','collective')                                                            NOT NULL DEFAULT 'personal',
  status                 ENUM('new','collecting_signatures','in_progress','resolved','closed','rejected')        NOT NULL DEFAULT 'new',
  author_apartment_id    BIGINT UNSIGNED                                                                          DEFAULT NULL,
  author_building_key    VARCHAR(120)                                                                             NOT NULL DEFAULT '',
  author_apartment_snapshot VARCHAR(20)                                                                           NOT NULL DEFAULT '',
  author_user_id         BIGINT UNSIGNED                                                                          NOT NULL DEFAULT 0,
  escalated_to_uk        BOOLEAN                                                                                  NOT NULL DEFAULT FALSE,
  manually_archived      BOOLEAN                                                                                  NOT NULL DEFAULT FALSE,
  admin_comment          TEXT                                                                                     DEFAULT NULL,
  admin_comment_at       DATETIME                                                                                 DEFAULT NULL,
  admin_comment_read_at  DATETIME                                                                                 DEFAULT NULL,
  handled_by_admin_id    BIGINT UNSIGNED                                                                          DEFAULT NULL,
  created_at             DATETIME                                                                                 NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME                                                                                 NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at            DATETIME                                                                                 DEFAULT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_appeals_apartment FOREIGN KEY (author_apartment_id) REFERENCES user_apartments(id)     ON DELETE SET NULL,
  INDEX idx_appeals_status_created (status, created_at DESC),
  INDEX idx_appeals_apartment      (author_apartment_id),
  INDEX idx_appeals_author_building (author_building_key, created_at DESC),
  INDEX idx_appeals_author_user     (author_user_id, created_at DESC),
  INDEX idx_appeals_admin          (handled_by_admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- appeal_photos — см. ниже в разделе фото

-- Подпись на коллективное обращение: квартира + дата (имя/фото — через JOIN user_profiles).
CREATE TABLE IF NOT EXISTS appeal_participants (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  appeal_id    BIGINT UNSIGNED NOT NULL,
  apartment_id BIGINT UNSIGNED NOT NULL,
  joined_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ap_appeal_apartment (appeal_id, apartment_id),
  CONSTRAINT fk_ap_appeal    FOREIGN KEY (appeal_id)    REFERENCES appeals(id)         ON DELETE CASCADE,
  CONSTRAINT fk_ap_apartment FOREIGN KEY (apartment_id) REFERENCES user_apartments(id) ON DELETE CASCADE,
  INDEX idx_ap_appeal (appeal_id),
  INDEX idx_ap_apartment (apartment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  ДОМ — ХАРАКТЕРИСТИКИ, ФОТО, СТАТУС, КАЛЕНДАРЬ, МУСОР
-- ============================================================

CREATE TABLE IF NOT EXISTS house_specs (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  building_key VARCHAR(120)    NOT NULL,
  label        VARCHAR(255)    NOT NULL,
  value        TEXT            NOT NULL,
  position     INT             NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_hs_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE,
  INDEX idx_hs_building_position (building_key, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- building_photos — см. ниже в разделе фото

CREATE TABLE IF NOT EXISTS house_calendar_activities (
  id            BIGINT UNSIGNED                                            NOT NULL AUTO_INCREMENT,
  building_key  VARCHAR(120)                                               NOT NULL,
  activity_date DATE                                                       NOT NULL,
  title         VARCHAR(500)                                               NOT NULL,
  kind          ENUM('yard','pipes','meeting','heating','garbage','other') NOT NULL DEFAULT 'other',
  created_at    DATETIME                                                   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_hca_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE,
  INDEX idx_hca_building_date (building_key, activity_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS trash_pickup_schedule (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  building_key VARCHAR(120)    NOT NULL,
  title        VARCHAR(255)    NOT NULL,
  schedule     VARCHAR(255)    NOT NULL,
  note         TEXT            DEFAULT NULL,
  position     INT             NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_tps_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE,
  INDEX idx_tps_building_position (building_key, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  ОБЪЯВЛЕНИЯ СОСЕДЕЙ
-- ============================================================

-- status: published -> видно соседям; under_review -> пожаловались, ждёт проверки админом;
--         archived -> срок истёк / автор снял с публикации; rejected -> админ отклонил;
--         under_review_appeal -> автор отредактировал отклонённое объявление, повторная проверка
CREATE TABLE IF NOT EXISTS neighbor_ads (
  id                   BIGINT UNSIGNED                                                                            NOT NULL AUTO_INCREMENT,
  author_apartment_id  BIGINT UNSIGNED                                                                            NOT NULL,
  title                VARCHAR(500)                                                                               NOT NULL,
  body                 TEXT                                                                                       NOT NULL,
  category             ENUM('sell','buy','service','invite','lost','found','other')                              NOT NULL DEFAULT 'other',
  status               ENUM('under_review','published','archived','rejected','under_review_appeal')                NOT NULL DEFAULT 'published',
  show_phone           BOOLEAN                                                                                    NOT NULL DEFAULT FALSE,
  created_at           DATETIME                                                                                   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at           DATETIME                                                                                   NOT NULL,
  updated_at           DATETIME                                                                                   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_na_apartment FOREIGN KEY (author_apartment_id) REFERENCES user_apartments(id) ON DELETE CASCADE,
  INDEX idx_na_apartment_created (author_apartment_id, created_at DESC),
  INDEX idx_na_expires           (expires_at),
  INDEX idx_na_status            (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- neighbor_ad_photos — см. ниже в разделе фото

-- ============================================================
--  ГОЛОСОВАНИЯ
-- ============================================================

-- moderation_status: none | under_review | cancelled (active/completed выводятся из closed и ends_at)
-- closed — автор закрыл голосование вручную до истечения срока.
-- Одна квартира = один голос (vote_casts.uq_vc_vote_apartment).
CREATE TABLE IF NOT EXISTS votes (
  id                   BIGINT UNSIGNED                                              NOT NULL AUTO_INCREMENT,
  building_key         VARCHAR(120)                                                 DEFAULT NULL COMMENT 'только голосование УК без author_apartment_id',
  author_apartment_id  BIGINT UNSIGNED                                              DEFAULT NULL,
  sponsor              ENUM('uk','residents')                                       NOT NULL DEFAULT 'residents',
  moderation_status    ENUM('none','under_review','cancelled')                      NOT NULL DEFAULT 'none',
  topic            TEXT                                                         NOT NULL,
  description      TEXT                                                        NOT NULL DEFAULT '',
  visibility       ENUM('open','secret')                                        NOT NULL DEFAULT 'open',
  ends_at          DATETIME                                                     NOT NULL,
  closed           BOOLEAN                                                      NOT NULL DEFAULT FALSE,
  trial            BOOLEAN                                                      NOT NULL DEFAULT FALSE,
  created_at       DATETIME                                                     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME                                                     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_votes_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE,
  CONSTRAINT fk_votes_author_apartment FOREIGN KEY (author_apartment_id) REFERENCES user_apartments(id) ON DELETE SET NULL,
  CONSTRAINT chk_votes_building_source CHECK (
    (author_apartment_id IS NOT NULL AND building_key IS NULL)
    OR
    (author_apartment_id IS NULL AND building_key IS NOT NULL)
  ),
  INDEX idx_votes_building_key (building_key, created_at DESC),
  INDEX idx_votes_ends_at      (ends_at),
  INDEX idx_votes_moderation   (moderation_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vote_options (
  id       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  vote_id  BIGINT UNSIGNED NOT NULL,
  label    TEXT            NOT NULL,
  position INT             NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_vo_vote FOREIGN KEY (vote_id) REFERENCES votes(id) ON DELETE CASCADE,
  INDEX idx_vo_vote (vote_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vote_casts (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  vote_id      BIGINT UNSIGNED NOT NULL,
  option_id    BIGINT UNSIGNED NOT NULL,
  apartment_id BIGINT UNSIGNED NOT NULL,
  voted_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vc_vote_apartment (vote_id, apartment_id),
  CONSTRAINT fk_vc_vote      FOREIGN KEY (vote_id)      REFERENCES votes(id)             ON DELETE CASCADE,
  CONSTRAINT fk_vc_option    FOREIGN KEY (option_id)    REFERENCES vote_options(id)      ON DELETE CASCADE,
  CONSTRAINT fk_vc_apartment FOREIGN KEY (apartment_id) REFERENCES user_apartments(id)   ON DELETE CASCADE,
  INDEX idx_vc_vote (vote_id),
  INDEX idx_vc_apartment (apartment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  ОЦЕНКИ СРЕДЫ
-- ============================================================

CREATE TABLE IF NOT EXISTS environment_ratings (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  apartment_id    BIGINT UNSIGNED NOT NULL,
  month_key       CHAR(7)         NOT NULL,
  courtyard_stars TINYINT         NOT NULL CHECK (courtyard_stars BETWEEN 1 AND 5),
  entrance_stars  TINYINT         NOT NULL CHECK (entrance_stars  BETWEEN 1 AND 5),
  uk_stars        TINYINT         NOT NULL CHECK (uk_stars        BETWEEN 1 AND 5),
  feedback_other  TEXT            DEFAULT NULL,
  submitted_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_er_apartment_month (apartment_id, month_key),
  CONSTRAINT fk_er_apartment FOREIGN KEY (apartment_id) REFERENCES user_apartments(id) ON DELETE CASCADE,
  INDEX idx_er_apartment_month (apartment_id, month_key DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  РАЙОН (КАРТА)
--  building_key = NULL — точка общегородского слоя,
--  иначе — точка, привязанная к конкретному дому.
-- ============================================================

CREATE TABLE IF NOT EXISTS district_layers (
  layer_id VARCHAR(40)  NOT NULL,
  title    VARCHAR(255) NOT NULL DEFAULT '',
  PRIMARY KEY (layer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS district_pois (
  id           BIGINT UNSIGNED       NOT NULL AUTO_INCREMENT,
  name         VARCHAR(255)          NOT NULL,
  layer_id     VARCHAR(40)           NOT NULL,
  address      VARCHAR(500)          NOT NULL DEFAULT '',
  lat          DOUBLE                NOT NULL,
  lng          DOUBLE                NOT NULL,
  rating       DECIMAL(3,2)          DEFAULT NULL,
  schedule     VARCHAR(500)          DEFAULT NULL,
  photo_url    TEXT                  DEFAULT NULL,
  building_key VARCHAR(120)          DEFAULT NULL COMMENT 'NULL = city-wide; задан = только для этого дома',
  created_at   DATETIME              NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_dp_layer    FOREIGN KEY (layer_id)     REFERENCES district_layers(layer_id) ON UPDATE CASCADE,
  CONSTRAINT fk_dp_building FOREIGN KEY (building_key) REFERENCES buildings(building_key)     ON UPDATE CASCADE,
  INDEX idx_dp_layer    (layer_id),
  INDEX idx_dp_building (building_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- appeal_photos — фото обращений

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- neighbor_ad_photos — фото объявлений соседей

CREATE TABLE IF NOT EXISTS neighbor_ad_photos (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  neighbor_ad_id BIGINT UNSIGNED NOT NULL,
  url            VARCHAR(900)    NOT NULL,
  position       INT             NOT NULL DEFAULT 0,
  is_primary     BOOLEAN         NOT NULL DEFAULT FALSE,
  created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_nap_ad FOREIGN KEY (neighbor_ad_id) REFERENCES neighbor_ads(id) ON DELETE CASCADE,
  UNIQUE KEY uq_nap_ad_pos_url (neighbor_ad_id, position, url),
  INDEX idx_nap_ad (neighbor_ad_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- verification_photos — фото документов верификации

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- building_photos — фото паспорта дома

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- news_photos — фото новостей

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  АДМИНКА И PUSH-ТОКЕНЫ
-- ============================================================

-- Администраторы (отдельно от users). Ролевая модель:
--   admin     — полный доступ ко всем домам (building_key = NULL);
--   moderator — новости, уведомления и модерация контента только своего дома.
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
  UNIQUE KEY uq_admin_users_email (email),
  CONSTRAINT fk_admin_users_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE,
  CONSTRAINT chk_admin_users_role_building CHECK (
    (role = 'admin' AND building_key IS NULL)
    OR
    (role = 'moderator' AND building_key IS NOT NULL)
  ),
  INDEX idx_admin_users_building (building_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS push_tokens (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  token      VARCHAR(500)    NOT NULL,
  platform   VARCHAR(20)     NOT NULL DEFAULT 'expo',
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pt_token (token),
  CONSTRAINT fk_pt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- FK на admin_users (идемпотентно: DROP IF EXISTS + ADD)
ALTER TABLE verification_requests DROP FOREIGN KEY IF EXISTS fk_vr_admin;
ALTER TABLE verification_requests
  ADD CONSTRAINT fk_vr_admin FOREIGN KEY (reviewed_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE news DROP FOREIGN KEY IF EXISTS fk_news_admin;
ALTER TABLE news
  ADD CONSTRAINT fk_news_admin FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE notifications DROP FOREIGN KEY IF EXISTS fk_notif_admin;
ALTER TABLE notifications
  ADD CONSTRAINT fk_notif_admin FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE appeals DROP FOREIGN KEY IF EXISTS fk_appeals_admin;
ALTER TABLE appeals
  ADD CONSTRAINT fk_appeals_admin FOREIGN KEY (handled_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE users DROP FOREIGN KEY IF EXISTS fk_users_blocked_admin;
ALTER TABLE users
  ADD CONSTRAINT fk_users_blocked_admin FOREIGN KEY (blocked_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL;

-- ============================================================
--  ТРИГГЕРЫ (целостность данных)
-- ============================================================

DROP TRIGGER IF EXISTS trg_up_active_apartment_bi;
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
END;

DROP TRIGGER IF EXISTS trg_up_active_apartment_bu;
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
END;

DROP TRIGGER IF EXISTS trg_ua_normalize_bi;
CREATE TRIGGER trg_ua_normalize_bi
BEFORE INSERT ON user_apartments
FOR EACH ROW
BEGIN
  SET NEW.building_key = LOWER(TRIM(NEW.building_key));
  SET NEW.apartment = TRIM(NEW.apartment);
  SET NEW.apartment_norm = LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(TRIM(NEW.apartment), '^(кв\\.?|№|#)[[:space:]]*', '', 1, 0, 'i'),
      '[^0-9a-zа-яё]', '', 1, 0, 'i'
    )
  );
  IF NEW.apartment_norm = '' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'apartment number is empty after normalization';
  END IF;
END;

DROP TRIGGER IF EXISTS trg_ua_normalize_bu;
CREATE TRIGGER trg_ua_normalize_bu
BEFORE UPDATE ON user_apartments
FOR EACH ROW
BEGIN
  SET NEW.building_key = LOWER(TRIM(NEW.building_key));
  SET NEW.apartment = TRIM(NEW.apartment);
  SET NEW.apartment_norm = LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(TRIM(NEW.apartment), '^(кв\\.?|№|#)[[:space:]]*', '', 1, 0, 'i'),
      '[^0-9a-zа-яё]', '', 1, 0, 'i'
    )
  );
  IF NEW.apartment_norm = '' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'apartment number is empty after normalization';
  END IF;
END;

DROP TRIGGER IF EXISTS trg_ua_before_delete;
CREATE TRIGGER trg_ua_before_delete
BEFORE DELETE ON user_apartments
FOR EACH ROW
BEGIN
  UPDATE votes
  SET building_key = OLD.building_key
  WHERE author_apartment_id = OLD.id AND building_key IS NULL;
END;

DROP TRIGGER IF EXISTS trg_appeals_snapshot_bi;
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
END;

DROP TRIGGER IF EXISTS trg_vr_sync_ua_ai;
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
END;

DROP TRIGGER IF EXISTS trg_vr_sync_ua_au;
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
END;

DROP TRIGGER IF EXISTS trg_vr_sync_ua_ad;
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
END;

DROP TRIGGER IF EXISTS trg_buildings_normalize_bi;
CREATE TRIGGER trg_buildings_normalize_bi
BEFORE INSERT ON buildings
FOR EACH ROW
BEGIN
  SET NEW.building_key = LOWER(TRIM(NEW.building_key));
END;

DROP TRIGGER IF EXISTS trg_buildings_normalize_bu;
CREATE TRIGGER trg_buildings_normalize_bu
BEFORE UPDATE ON buildings
FOR EACH ROW
BEGIN
  SET NEW.building_key = LOWER(TRIM(NEW.building_key));
END;

DROP TRIGGER IF EXISTS trg_na_expiry_bi;
CREATE TRIGGER trg_na_expiry_bi
BEFORE INSERT ON neighbor_ads
FOR EACH ROW
BEGIN
  IF NEW.status = 'published' AND NEW.expires_at <= NOW() THEN
    SET NEW.status = 'archived';
  END IF;
END;

DROP TRIGGER IF EXISTS trg_na_expiry_bu;
CREATE TRIGGER trg_na_expiry_bu
BEFORE UPDATE ON neighbor_ads
FOR EACH ROW
BEGIN
  IF NEW.status = 'published' AND NEW.expires_at <= NOW() THEN
    SET NEW.status = 'archived';
  END IF;
END;

DROP TRIGGER IF EXISTS trg_vc_building_bi;
DROP TRIGGER IF EXISTS trg_vc_validate_bi;
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
END;

DROP TRIGGER IF EXISTS trg_vc_building_bu;
DROP TRIGGER IF EXISTS trg_vc_validate_bu;
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
END;

DROP TRIGGER IF EXISTS trg_ap_participant_building_bi;
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
END;

DROP TRIGGER IF EXISTS trg_ap_participant_building_bu;
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
END;

-- ============================================================
--  Периодическое обслуживание (MariaDB EVENT, раз в час)
--  Дублируется в backend: runMaintenance() + startMaintenanceScheduler()
-- ============================================================

DROP EVENT IF EXISTS evt_domovoy_maintenance;
CREATE EVENT evt_domovoy_maintenance
ON SCHEDULE EVERY 1 HOUR
STARTS CURRENT_TIMESTAMP
ON COMPLETION PRESERVE
ENABLE
COMMENT 'Archive ads/appeals, close expired votes, purge refresh tokens'
DO
BEGIN
  UPDATE neighbor_ads SET status = 'archived'
    WHERE status = 'published' AND expires_at <= NOW();
  UPDATE appeals SET manually_archived = 1
    WHERE manually_archived = 0
      AND status IN ('resolved', 'closed', 'rejected')
      AND COALESCE(resolved_at, created_at) <= NOW() - INTERVAL 24 HOUR;
  UPDATE votes SET closed = 1
    WHERE closed = 0
      AND moderation_status NOT IN ('cancelled')
      AND ends_at <= NOW();
  DELETE FROM refresh_tokens WHERE expires_at < NOW();
END;

SET FOREIGN_KEY_CHECKS = 1;
