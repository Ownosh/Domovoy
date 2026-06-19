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
  notifications_last_seen_at DATETIME DEFAULT NULL,
  blocked_by_admin_id BIGINT UNSIGNED DEFAULT NULL,
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  КВАРТИРЫ ПОЛЬЗОВАТЕЛЯ (включая первую, добавленную при регистрации)
-- ============================================================

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
  phone               VARCHAR(50)     NOT NULL DEFAULT '',
  profile_photo       TEXT            DEFAULT NULL,
  active_apartment_id BIGINT UNSIGNED DEFAULT NULL,
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
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
  created_at           DATETIME                                      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME                                      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- pending => apartment_id, иначе NULL: UNIQUE гарантирует не более одной
  -- активной заявки на квартиру (частичные индексы не поддерживаются).
  pending_apartment_id BIGINT UNSIGNED AS (IF(status = 'pending', apartment_id, NULL)) STORED,
  PRIMARY KEY (id),
  CONSTRAINT fk_vr_apartment FOREIGN KEY (apartment_id) REFERENCES user_apartments(id) ON DELETE CASCADE,
  UNIQUE KEY uq_vr_pending_apartment (pending_apartment_id),
  INDEX idx_vr_apartment_submitted (apartment_id, submitted_at DESC),
  INDEX idx_vr_status (status),
  INDEX idx_vr_admin (reviewed_by_admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

-- user_notification_reads удалены — используется users.notifications_last_seen_at

-- ============================================================
--  ОБРАЩЕНИЯ (ЗАЯВКИ)
-- ============================================================

-- 3НФ: дом и автор обращения выводятся из author_apartment_id -> user_apartments.
CREATE TABLE IF NOT EXISTS appeals (
  id                     BIGINT UNSIGNED                                                                          NOT NULL AUTO_INCREMENT,
  title                  VARCHAR(500)                                                                             NOT NULL,
  body                   TEXT                                                                                     NOT NULL,
  category               ENUM('Аварийная ситуация','Сантехника','Электрика','Отопление','Вентиляция','Уборка и благоустройство','Нарушение порядка','Инициатива собрания собственников','Другое') NOT NULL DEFAULT 'Другое',
  kind                   ENUM('personal','collective')                                                            NOT NULL DEFAULT 'personal',
  status                 ENUM('new','collecting_signatures','in_progress','resolved','closed','rejected')        NOT NULL DEFAULT 'new',
  author_apartment_id    BIGINT UNSIGNED                                                                          NOT NULL,
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
  CONSTRAINT fk_appeals_apartment FOREIGN KEY (author_apartment_id) REFERENCES user_apartments(id)     ON DELETE RESTRICT,
  INDEX idx_appeals_status_created (status, created_at DESC),
  INDEX idx_appeals_apartment      (author_apartment_id),
  INDEX idx_appeals_admin          (handled_by_admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- appeal_photos — см. ниже в разделе фото

CREATE TABLE IF NOT EXISTS appeal_participants (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  appeal_id    BIGINT UNSIGNED NOT NULL,
  user_id      BIGINT UNSIGNED NOT NULL,
  apartment_id BIGINT UNSIGNED DEFAULT NULL,
  anonymous    BOOLEAN         NOT NULL DEFAULT FALSE,
  comment      TEXT            DEFAULT NULL,
  photo_uri    TEXT            DEFAULT NULL,
  joined_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ap_appeal_user (appeal_id, user_id),
  CONSTRAINT fk_ap_appeal    FOREIGN KEY (appeal_id)    REFERENCES appeals(id)         ON DELETE CASCADE,
  CONSTRAINT fk_ap_user      FOREIGN KEY (user_id)      REFERENCES users(id)           ON DELETE CASCADE,
  CONSTRAINT fk_ap_apartment FOREIGN KEY (apartment_id) REFERENCES user_apartments(id) ON DELETE SET NULL,
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
  id                 BIGINT UNSIGNED                                                                            NOT NULL AUTO_INCREMENT,
  author_user_id     BIGINT UNSIGNED                                                                            NOT NULL,
  building_key       VARCHAR(120)                                                                               NOT NULL,
  title              VARCHAR(500)                                                                               NOT NULL,
  body               TEXT                                                                                       NOT NULL,
  category           ENUM('sell','buy','service','invite','lost','found','other')                              NOT NULL DEFAULT 'other',
  status             ENUM('new','under_review','published','archived','rejected','under_review_appeal')        NOT NULL DEFAULT 'published',
  show_phone         BOOLEAN                                                                                    NOT NULL DEFAULT FALSE,
  created_at         DATETIME                                                                                   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at         DATETIME                                                                                   NOT NULL,
  updated_at         DATETIME                                                                                   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_na_user     FOREIGN KEY (author_user_id) REFERENCES users(id)               ON DELETE CASCADE,
  CONSTRAINT fk_na_building FOREIGN KEY (building_key)   REFERENCES buildings(building_key) ON UPDATE CASCADE,
  INDEX idx_na_building_created (building_key, created_at DESC),
  INDEX idx_na_author_created   (author_user_id, created_at DESC),
  INDEX idx_na_expires          (expires_at),
  INDEX idx_na_status           (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- neighbor_ad_photos — см. ниже в разделе фото

-- ============================================================
--  ГОЛОСОВАНИЯ
-- ============================================================

-- status: active -> идёт голосование; under_review -> пожаловались, ждёт проверки админом;
--         completed -> завершено (closed=1 или истёк ends_at); cancelled -> отменено админом.
-- closed — отдельная характеристика: автор закрыл голосование вручную до истечения срока.
CREATE TABLE IF NOT EXISTS votes (
  id               BIGINT UNSIGNED                                              NOT NULL AUTO_INCREMENT,
  building_key     VARCHAR(120)                                                 NOT NULL,
  user_id          BIGINT UNSIGNED                                              DEFAULT NULL,
  sponsor          ENUM('uk','residents')                                       NOT NULL DEFAULT 'residents',
  status           ENUM('new','under_review','active','completed','cancelled')  NOT NULL DEFAULT 'active',
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
  CONSTRAINT fk_votes_user     FOREIGN KEY (user_id)       REFERENCES users(id)               ON DELETE SET NULL,
  INDEX idx_votes_building_key (building_key, created_at DESC),
  INDEX idx_votes_ends_at      (ends_at),
  INDEX idx_votes_status       (status)
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
  id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  vote_id   BIGINT UNSIGNED NOT NULL,
  user_id   BIGINT UNSIGNED NOT NULL,
  option_id BIGINT UNSIGNED NOT NULL,
  apartment_id BIGINT UNSIGNED DEFAULT NULL,
  voted_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vc_vote_user (vote_id, user_id),
  CONSTRAINT fk_vc_vote      FOREIGN KEY (vote_id)      REFERENCES votes(id)        ON DELETE CASCADE,
  CONSTRAINT fk_vc_user      FOREIGN KEY (user_id)      REFERENCES users(id)        ON DELETE CASCADE,
  CONSTRAINT fk_vc_option    FOREIGN KEY (option_id)    REFERENCES vote_options(id) ON DELETE CASCADE,
  CONSTRAINT fk_vc_apartment FOREIGN KEY (apartment_id) REFERENCES user_apartments(id) ON DELETE SET NULL,
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

CREATE TABLE IF NOT EXISTS environment_rating_feedback_tags (
  rating_id BIGINT UNSIGNED NOT NULL,
  tag_id    ENUM('yard','entrance','uk_comm','uk_work','contractors','safety','other') NOT NULL,
  PRIMARY KEY (rating_id, tag_id),
  CONSTRAINT fk_erft_rating FOREIGN KEY (rating_id) REFERENCES environment_ratings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  РАЙОН (КАРТА)
--  building_key = NULL — точка общегородского слоя,
--  иначе — точка, привязанная к конкретному дому.
-- ============================================================

-- district_layers удалены — метаданные слоёв фиксированы в приложении

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
  CONSTRAINT fk_dp_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE,
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

-- Администраторы. Ролевая модель:
--   admin     — полный доступ;
--   moderator — новости, уведомления, обработка жалоб, модерация контента.
-- Проверки прав реализованы в админ-панели.
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS admin_user_permissions (
  admin_user_id BIGINT UNSIGNED NOT NULL,
  permission    VARCHAR(64)     NOT NULL,
  PRIMARY KEY (admin_user_id, permission),
  CONSTRAINT fk_aup_admin FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE
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

ALTER TABLE verification_requests
  ADD CONSTRAINT fk_vr_admin FOREIGN KEY (reviewed_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE news
  ADD CONSTRAINT fk_news_admin FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE notifications
  ADD CONSTRAINT fk_notif_admin FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE appeals
  ADD CONSTRAINT fk_appeals_admin FOREIGN KEY (handled_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE users
  ADD CONSTRAINT fk_users_blocked_admin FOREIGN KEY (blocked_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL;

SET FOREIGN_KEY_CHECKS = 1;
