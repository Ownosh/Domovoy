-- ============================================================
--  Domovoy — схема БД (MariaDB 10.6+ / MySQL 8.0+)
--  Нормализована до 3НФ. Источник истины — backend/src/db/migrate.ts
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
--  СПРАВОЧНИК ДОМОВ (+ паспорт дома)
-- ============================================================

CREATE TABLE IF NOT EXISTS buildings (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
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
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_buildings_key (building_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  ПОЛЬЗОВАТЕЛИ
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email               VARCHAR(255)    NOT NULL,
  password_hash       TEXT            NOT NULL,
  data_consent_at     DATETIME        DEFAULT NULL,
  is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
  notif_outages       BOOLEAN         NOT NULL DEFAULT TRUE,
  notif_meetings      BOOLEAN         NOT NULL DEFAULT TRUE,
  notif_announcements BOOLEAN         NOT NULL DEFAULT TRUE,
  notif_general       BOOLEAN         NOT NULL DEFAULT TRUE,
  expo_push_token     VARCHAR(500)    DEFAULT NULL,
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
  token      VARCHAR(100)    NOT NULL,
  expires_at DATETIME        NOT NULL,
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rt_token (token),
  CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_rt_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  ВЕРИФИКАЦИЯ КВАРТИРЫ
--  Одна запись = одна заявка на верификацию конкретной квартиры.
--  user_id и building_key не хранятся — выводятся через apartment_id.
-- ============================================================

CREATE TABLE IF NOT EXISTS verification_requests (
  id           BIGINT UNSIGNED                              NOT NULL AUTO_INCREMENT,
  apartment_id BIGINT UNSIGNED                              NOT NULL,
  doc_type     ENUM('lease','ownership')                    NOT NULL,
  status       ENUM('pending','approved','rejected')        NOT NULL DEFAULT 'pending',
  photo_url    TEXT                                          NOT NULL,
  comment      TEXT                                          DEFAULT NULL,
  submitted_at DATETIME                                      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at  DATETIME                                      DEFAULT NULL,
  created_at   DATETIME                                      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME                                      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_vr_apartment FOREIGN KEY (apartment_id) REFERENCES user_apartments(id) ON DELETE CASCADE,
  INDEX idx_vr_apartment_submitted (apartment_id, submitted_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  УК — КОНТАКТЫ ДОМА
-- ============================================================

CREATE TABLE IF NOT EXISTS building_contacts (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  building_key VARCHAR(120)    NOT NULL,
  company_name VARCHAR(255)    NOT NULL DEFAULT '',
  phone        VARCHAR(100)    NOT NULL DEFAULT '',
  email        VARCHAR(255)    NOT NULL DEFAULT '',
  site         VARCHAR(255)    NOT NULL DEFAULT '',
  hours        VARCHAR(255)    NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  UNIQUE KEY uq_bc_building (building_key),
  CONSTRAINT fk_bc_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  НОВОСТИ
-- ============================================================

CREATE TABLE IF NOT EXISTS news (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  building_key VARCHAR(120)    NOT NULL,
  title        TEXT            NOT NULL,
  excerpt      TEXT            NOT NULL,
  published_at DATE            NOT NULL,
  is_published BOOLEAN         NOT NULL DEFAULT TRUE,
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_news_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX idx_news_building_published (building_key, published_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS news_photos (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  news_id    BIGINT UNSIGNED NOT NULL,
  image_url  VARCHAR(500)    NOT NULL,
  position   INT             NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_np_news FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE,
  INDEX idx_np_news (news_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  УВЕДОМЛЕНИЯ
--  building_key = NULL означает «всем домам»
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id           BIGINT UNSIGNED                                     NOT NULL AUTO_INCREMENT,
  building_key VARCHAR(120)                                        DEFAULT NULL,
  type         ENUM('outage','meeting','announcement','general')   NOT NULL DEFAULT 'general',
  title        VARCHAR(500)                                        NOT NULL,
  body         TEXT                                                NOT NULL,
  created_at   DATETIME                                            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_notif_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX idx_notif_building_created (building_key, created_at DESC),
  INDEX idx_notif_type_created     (type, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_notification_reads (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  notification_id BIGINT UNSIGNED NOT NULL,
  user_id         BIGINT UNSIGNED NOT NULL,
  read_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_unr (notification_id, user_id),
  CONSTRAINT fk_unr_notif FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  CONSTRAINT fk_unr_user  FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  ОБРАЩЕНИЯ (ЗАЯВКИ)
-- ============================================================

CREATE TABLE IF NOT EXISTS appeals (
  id                     BIGINT UNSIGNED                                                                          NOT NULL AUTO_INCREMENT,
  user_id                BIGINT UNSIGNED                                                                          NOT NULL,
  building_key           VARCHAR(120)                                                                             NOT NULL,
  title                  VARCHAR(500)                                                                             NOT NULL,
  body                   TEXT                                                                                     NOT NULL,
  category               VARCHAR(100)                                                                             NOT NULL,
  kind                   ENUM('personal','collective')                                                            NOT NULL DEFAULT 'personal',
  status                 ENUM('new','collecting_signatures','in_progress','resolved','closed','rejected')        NOT NULL DEFAULT 'new',
  entrance               VARCHAR(20)                                                                              DEFAULT NULL,
  author_apartment       VARCHAR(20)                                                                              NOT NULL DEFAULT '',
  escalated_to_uk        BOOLEAN                                                                                  NOT NULL DEFAULT FALSE,
  manually_archived      BOOLEAN                                                                                  NOT NULL DEFAULT FALSE,
  admin_comment          TEXT                                                                                     DEFAULT NULL,
  admin_comment_at       DATETIME                                                                                 DEFAULT NULL,
  admin_comment_read_at  DATETIME                                                                                 DEFAULT NULL,
  created_at             DATETIME                                                                                 NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME                                                                                 NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at            DATETIME                                                                                 DEFAULT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_appeals_user     FOREIGN KEY (user_id)      REFERENCES users(id)               ON DELETE CASCADE,
  CONSTRAINT fk_appeals_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE,
  INDEX idx_appeals_user_created   (user_id, created_at DESC),
  INDEX idx_appeals_status_created (status, created_at DESC),
  INDEX idx_appeals_building_key   (building_key, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS appeal_photos (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  appeal_id  BIGINT UNSIGNED NOT NULL,
  image_url  TEXT            NOT NULL,
  position   INT             NOT NULL DEFAULT 0,
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_aph_appeal FOREIGN KEY (appeal_id) REFERENCES appeals(id) ON DELETE CASCADE,
  INDEX idx_aph_appeal (appeal_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
  CONSTRAINT fk_hs_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_hs_building_position (building_key, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS house_photos (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  building_key VARCHAR(120)    NOT NULL,
  image_url    TEXT            NOT NULL,
  position     INT             NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_hph_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_hph_building_position (building_key, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS house_status (
  id           BIGINT UNSIGNED                NOT NULL AUTO_INCREMENT,
  building_key VARCHAR(120)                   NOT NULL,
  text         VARCHAR(500)                   NOT NULL,
  status       ENUM('ok','warning','danger')  NOT NULL DEFAULT 'ok',
  position     INT                            NOT NULL DEFAULT 0,
  is_active    BOOLEAN                        NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  CONSTRAINT fk_hst_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_hst_building_position (building_key, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS house_calendar_activities (
  id            BIGINT UNSIGNED                                            NOT NULL AUTO_INCREMENT,
  building_key  VARCHAR(120)                                               NOT NULL,
  activity_date DATE                                                       NOT NULL,
  title         VARCHAR(500)                                               NOT NULL,
  kind          ENUM('yard','pipes','meeting','heating','garbage','other') NOT NULL DEFAULT 'other',
  created_at    DATETIME                                                   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_hca_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON DELETE CASCADE ON UPDATE CASCADE,
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
  CONSTRAINT fk_tps_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_tps_building_position (building_key, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  ОБЪЯВЛЕНИЯ СОСЕДЕЙ
-- ============================================================

CREATE TABLE IF NOT EXISTS neighbor_ads (
  id                 BIGINT UNSIGNED                                                                            NOT NULL AUTO_INCREMENT,
  author_user_id     BIGINT UNSIGNED                                                                            NOT NULL,
  building_key       VARCHAR(120)                                                                               NOT NULL,
  title              VARCHAR(500)                                                                               NOT NULL,
  body               TEXT                                                                                       NOT NULL,
  category           ENUM('sell','buy','service','invite','lost','found','other')                              NOT NULL DEFAULT 'other',
  status             ENUM('new','under_review','published','archived','rejected','under_review_appeal')        NOT NULL DEFAULT 'new',
  show_phone         BOOLEAN                                                                                    NOT NULL DEFAULT FALSE,
  author_phone       VARCHAR(50)                                                                                DEFAULT NULL,
  pending_moderation BOOLEAN                                                                                    NOT NULL DEFAULT FALSE,
  archived           BOOLEAN                                                                                    NOT NULL DEFAULT FALSE,
  created_at         DATETIME                                                                                   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at         DATETIME                                                                                   NOT NULL,
  updated_at         DATETIME                                                                                   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_na_user     FOREIGN KEY (author_user_id) REFERENCES users(id)               ON DELETE CASCADE,
  CONSTRAINT fk_na_building FOREIGN KEY (building_key)   REFERENCES buildings(building_key) ON UPDATE CASCADE,
  INDEX idx_na_building_created (building_key, created_at DESC),
  INDEX idx_na_author_created   (author_user_id, created_at DESC),
  INDEX idx_na_expires          (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS neighbor_ad_photos (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ad_id      BIGINT UNSIGNED NOT NULL,
  image_url  TEXT            NOT NULL,
  position   INT             NOT NULL DEFAULT 0,
  is_primary BOOLEAN         NOT NULL DEFAULT FALSE,
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_nap_ad FOREIGN KEY (ad_id) REFERENCES neighbor_ads(id) ON DELETE CASCADE,
  INDEX idx_nap_ad (ad_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  ГОЛОСОВАНИЯ
-- ============================================================

CREATE TABLE IF NOT EXISTS votes (
  id               BIGINT UNSIGNED                                              NOT NULL AUTO_INCREMENT,
  building_key     VARCHAR(120)                                                 NOT NULL,
  user_id          BIGINT UNSIGNED                                              DEFAULT NULL,
  created_by_label VARCHAR(255)                                                 NOT NULL DEFAULT '',
  sponsor          ENUM('uk','residents')                                       NOT NULL DEFAULT 'residents',
  status           ENUM('new','under_review','active','completed','cancelled')  NOT NULL DEFAULT 'new',
  topic            TEXT                                                         NOT NULL,
  description      TEXT                                                        NOT NULL DEFAULT '',
  visibility       ENUM('open','secret')                                        NOT NULL DEFAULT 'open',
  ends_at          DATETIME                                                     NOT NULL,
  closed           BOOLEAN                                                      NOT NULL DEFAULT FALSE,
  trial            BOOLEAN                                                      NOT NULL DEFAULT FALSE,
  created_at       DATETIME                                                     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_votes_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE,
  CONSTRAINT fk_votes_user     FOREIGN KEY (user_id)       REFERENCES users(id)               ON DELETE SET NULL,
  INDEX idx_votes_building_key (building_key, created_at DESC),
  INDEX idx_votes_ends_at      (ends_at)
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
  area_sqm  DECIMAL(6,2)    NOT NULL DEFAULT 0,
  voted_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vc_vote_user (vote_id, user_id),
  CONSTRAINT fk_vc_vote   FOREIGN KEY (vote_id)   REFERENCES votes(id)        ON DELETE CASCADE,
  CONSTRAINT fk_vc_user   FOREIGN KEY (user_id)   REFERENCES users(id)        ON DELETE CASCADE,
  CONSTRAINT fk_vc_option FOREIGN KEY (option_id) REFERENCES vote_options(id) ON DELETE CASCADE,
  INDEX idx_vc_vote (vote_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  ОЦЕНКИ СРЕДЫ
-- ============================================================

CREATE TABLE IF NOT EXISTS environment_ratings (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         BIGINT UNSIGNED NOT NULL,
  building_key    VARCHAR(120)    NOT NULL,
  month_key       CHAR(7)         NOT NULL,
  courtyard_stars TINYINT         NOT NULL CHECK (courtyard_stars BETWEEN 1 AND 5),
  entrance_stars  TINYINT         NOT NULL CHECK (entrance_stars  BETWEEN 1 AND 5),
  uk_stars        TINYINT         NOT NULL CHECK (uk_stars        BETWEEN 1 AND 5),
  feedback_tags   JSON            DEFAULT NULL,
  feedback_other  TEXT            DEFAULT NULL,
  submitted_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_er_user_month (user_id, month_key),
  CONSTRAINT fk_er_user     FOREIGN KEY (user_id)      REFERENCES users(id)               ON DELETE CASCADE,
  CONSTRAINT fk_er_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE,
  INDEX idx_er_building_month (building_key, month_key DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  РАЙОН (КАРТА)
--  building_key = NULL — точка общегородского слоя,
--  иначе — точка, привязанная к конкретному дому.
-- ============================================================

CREATE TABLE IF NOT EXISTS district_pois (
  id           BIGINT UNSIGNED       NOT NULL AUTO_INCREMENT,
  name         VARCHAR(255)          NOT NULL,
  layer_id     ENUM(
                 'schools_daycare','clinic_pharmacy','grocery','parks',
                 'bus_stops_city','parking_city','waste_yard',
                 'bus_stops_house','parking_house'
               )                     NOT NULL,
  scope        ENUM('city','house')  NOT NULL DEFAULT 'city',
  address      VARCHAR(500)          NOT NULL DEFAULT '',
  lat          DOUBLE                NOT NULL,
  lng          DOUBLE                NOT NULL,
  rating       DECIMAL(3,2)          DEFAULT NULL,
  schedule     VARCHAR(500)          DEFAULT NULL,
  photo_url    TEXT                  DEFAULT NULL,
  building_key VARCHAR(120)          DEFAULT NULL,
  created_at   DATETIME              NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_dp_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE,
  INDEX idx_dp_layer    (layer_id),
  INDEX idx_dp_building (building_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  АДМИНКА И PUSH-ТОКЕНЫ
-- ============================================================

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS push_tokens (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  token      VARCHAR(500)    NOT NULL,
  platform   VARCHAR(20)     NOT NULL DEFAULT 'expo',
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pt_user_token (user_id, token),
  CONSTRAINT fk_pt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
