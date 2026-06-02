-- ============================================================
--  Domovoy — схема БД (MariaDB 10.6+ / MySQL 8.0+)
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
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_buildings_key (building_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  ПОЛЬЗОВАТЕЛИ (+ настройки уведомлений)
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
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id            BIGINT UNSIGNED NOT NULL,
  full_name          VARCHAR(255)    NOT NULL DEFAULT '',
  phone              VARCHAR(50)     NOT NULL DEFAULT '',
  building_key       VARCHAR(120)    DEFAULT NULL,
  apartment          VARCHAR(20)     NOT NULL DEFAULT '',
  apartment_area_sqm DECIMAL(6,2)    DEFAULT NULL,
  created_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_up_user     FOREIGN KEY (user_id)      REFERENCES users(id)             ON DELETE CASCADE,
  CONSTRAINT fk_up_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE,
  INDEX idx_up_building_key (building_key)
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
--  ВЕРИФИКАЦИЯ ЖИЛЬЦА
-- ============================================================

CREATE TABLE IF NOT EXISTS verification_requests (
  id               BIGINT UNSIGNED                                  NOT NULL AUTO_INCREMENT,
  user_id          BIGINT UNSIGNED                                  NOT NULL,
  status           ENUM('none','pending','approved','rejected')     NOT NULL DEFAULT 'none',
  doc_type         ENUM('lease','ownership')                        DEFAULT NULL,
  submitted_at     DATETIME                                         DEFAULT NULL,
  reviewer_comment TEXT                                             DEFAULT NULL,
  created_at       DATETIME                                         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME                                         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_vr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_vr_user_created (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  УК — КОНТАКТЫ (основные + аварийные в одной таблице)
-- ============================================================

CREATE TABLE IF NOT EXISTS uk_contacts (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_name VARCHAR(255)    NOT NULL DEFAULT '',
  title        VARCHAR(255)    NOT NULL,
  subtitle     VARCHAR(255)    DEFAULT NULL,
  email        VARCHAR(255)    DEFAULT NULL,
  phone        VARCHAR(50)     NOT NULL,
  site         VARCHAR(500)    DEFAULT NULL,
  hours        VARCHAR(255)    DEFAULT NULL,
  is_emergency BOOLEAN         NOT NULL DEFAULT FALSE,
  position     INT             NOT NULL DEFAULT 0,
  is_active    BOOLEAN         NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id)
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
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id                BIGINT UNSIGNED                                     NOT NULL AUTO_INCREMENT,
  type              ENUM('outage','meeting','announcement','general')   NOT NULL,
  title             VARCHAR(255)                                        NOT NULL,
  body              TEXT                                                NOT NULL,
  recipient_user_id BIGINT UNSIGNED                                     DEFAULT NULL,
  published_at      DATETIME                                            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at        DATETIME                                            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_notif_user FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notifications_type_date (type, published_at DESC),
  INDEX idx_notifications_recipient (recipient_user_id, published_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_notification_reads (
  user_id         BIGINT UNSIGNED NOT NULL,
  notification_id BIGINT UNSIGNED NOT NULL,
  read_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, notification_id),
  CONSTRAINT fk_unr_user  FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE,
  CONSTRAINT fk_unr_notif FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  ОБРАЩЕНИЯ (ЗАЯВКИ)
-- ============================================================

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
  CONSTRAINT fk_appeals_user     FOREIGN KEY (user_id)      REFERENCES users(id)             ON DELETE CASCADE,
  CONSTRAINT fk_appeals_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE,
  INDEX idx_appeals_user_created   (user_id, created_at DESC),
  INDEX idx_appeals_status_created (status, created_at DESC),
  INDEX idx_appeals_building_key   (building_key, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS appeal_photos (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  appeal_id  BIGINT UNSIGNED NOT NULL,
  image_url  VARCHAR(500)    NOT NULL,
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
  photo_uri    VARCHAR(500)    DEFAULT NULL,
  joined_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ap_appeal_user (appeal_id, user_id),
  CONSTRAINT fk_ap_appeal FOREIGN KEY (appeal_id) REFERENCES appeals(id) ON DELETE CASCADE,
  CONSTRAINT fk_ap_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  INDEX idx_ap_appeal (appeal_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  ДОМ — ХАРАКТЕРИСТИКИ, ФОТО, КАЛЕНДАРЬ, МУСОР
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
  image_url    VARCHAR(500)    NOT NULL,
  position     INT             NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_hph_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_hph_building_position (building_key, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS house_calendar_activities (
  id           BIGINT UNSIGNED                                            NOT NULL AUTO_INCREMENT,
  building_key VARCHAR(120)                                               NOT NULL,
  activity_date DATE                                                      NOT NULL,
  title        VARCHAR(500)                                               NOT NULL,
  kind         ENUM('yard','pipes','meeting','heating','garbage','other') NOT NULL DEFAULT 'other',
  created_at   DATETIME                                                   NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
  id                 BIGINT UNSIGNED                                              NOT NULL AUTO_INCREMENT,
  author_user_id     BIGINT UNSIGNED                                              NOT NULL,
  building_key       VARCHAR(120)                                                 NOT NULL,
  title              VARCHAR(500)                                                 NOT NULL,
  body               TEXT                                                         NOT NULL,
  category           ENUM('sell','buy','service','invite','lost','found','other') NOT NULL DEFAULT 'other',
  image_url          VARCHAR(500)                                                 DEFAULT NULL,
  show_phone         BOOLEAN                                                      NOT NULL DEFAULT FALSE,
  author_phone       VARCHAR(50)                                                  DEFAULT NULL,
  pending_moderation BOOLEAN                                                      NOT NULL DEFAULT FALSE,
  archived           BOOLEAN                                                      NOT NULL DEFAULT FALSE,
  created_at         DATETIME                                                     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at         DATETIME                                                     NOT NULL,
  updated_at         DATETIME                                                     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_na_user     FOREIGN KEY (author_user_id) REFERENCES users(id)               ON DELETE CASCADE,
  CONSTRAINT fk_na_building FOREIGN KEY (building_key)   REFERENCES buildings(building_key) ON UPDATE CASCADE,
  INDEX idx_na_building_created (building_key, created_at DESC),
  INDEX idx_na_author_created   (author_user_id, created_at DESC),
  INDEX idx_na_expires          (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  ГОЛОСОВАНИЯ
-- ============================================================

CREATE TABLE IF NOT EXISTS votes (
  id               BIGINT UNSIGNED        NOT NULL AUTO_INCREMENT,
  building_key     VARCHAR(120)           NOT NULL,
  created_by_label VARCHAR(255)           NOT NULL DEFAULT '',
  sponsor          ENUM('uk','residents') NOT NULL DEFAULT 'residents',
  topic            TEXT                   NOT NULL,
  description      TEXT                   NOT NULL DEFAULT '',
  visibility       ENUM('open','secret')  NOT NULL DEFAULT 'open',
  ends_at          DATETIME               NOT NULL,
  closed           BOOLEAN                NOT NULL DEFAULT FALSE,
  trial            BOOLEAN                NOT NULL DEFAULT FALSE,
  created_at       DATETIME               NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_votes_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE,
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
-- ============================================================

CREATE TABLE IF NOT EXISTS district_pois (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(255)    NOT NULL,
  layer_id     ENUM(
                 'schools_daycare','clinic_pharmacy','grocery','parks',
                 'bus_stops_city','parking_city','waste_yard',
                 'bus_stops_house','parking_house'
               )               NOT NULL,
  scope        ENUM('city','house') NOT NULL DEFAULT 'city',
  address      VARCHAR(500)    NOT NULL DEFAULT '',
  lat          DOUBLE          NOT NULL,
  lng          DOUBLE          NOT NULL,
  rating       DECIMAL(3,2)    DEFAULT NULL,
  schedule     VARCHAR(500)    DEFAULT NULL,
  photo_url    VARCHAR(500)    DEFAULT NULL,
  building_key VARCHAR(120)    DEFAULT NULL,
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_dp_building FOREIGN KEY (building_key) REFERENCES buildings(building_key) ON UPDATE CASCADE,
  INDEX idx_dp_layer    (layer_id),
  INDEX idx_dp_building (building_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  СПРАВОЧНИК ЧС
-- ============================================================

CREATE TABLE IF NOT EXISTS emergency_scenarios (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  scenario_key VARCHAR(120)    NOT NULL,
  title        VARCHAR(500)    NOT NULL,
  position     INT             NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_es_key (scenario_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS emergency_scenario_steps (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  scenario_key VARCHAR(120)    NOT NULL,
  step_text    TEXT            NOT NULL,
  position     INT             NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_ess_scenario FOREIGN KEY (scenario_key) REFERENCES emergency_scenarios(scenario_key) ON DELETE CASCADE,
  INDEX idx_ess_scenario (scenario_key, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS emergency_scenario_contacts (
  scenario_key VARCHAR(120)    NOT NULL,
  contact_id   BIGINT UNSIGNED NOT NULL,
  position     INT             NOT NULL DEFAULT 0,
  PRIMARY KEY (scenario_key, contact_id),
  CONSTRAINT fk_esc_scenario FOREIGN KEY (scenario_key) REFERENCES emergency_scenarios(scenario_key) ON DELETE CASCADE,
  CONSTRAINT fk_esc_contact  FOREIGN KEY (contact_id)   REFERENCES uk_contacts(id)                   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  ПРЕДСТАВЛЕНИЯ
-- ============================================================

CREATE OR REPLACE VIEW appeals_archive AS
SELECT a.*
FROM   appeals a
WHERE  a.status IN ('resolved', 'rejected')
  AND  a.created_at <= NOW() - INTERVAL 3 DAY;

CREATE OR REPLACE VIEW appeals_active AS
SELECT a.*
FROM   appeals a
WHERE  NOT (
  a.status IN ('resolved', 'rejected')
  AND a.created_at <= NOW() - INTERVAL 3 DAY
);

CREATE OR REPLACE VIEW vote_results AS
SELECT
  v.id                          AS vote_id,
  vo.id                         AS option_id,
  vo.label                      AS option_label,
  vo.position                   AS option_position,
  COUNT(vc.id)                  AS vote_count,
  COALESCE(SUM(vc.area_sqm), 0) AS total_area_sqm
FROM  votes v
JOIN  vote_options vo ON vo.vote_id = v.id
LEFT  JOIN vote_casts vc ON vc.vote_id = v.id AND vc.option_id = vo.id
GROUP BY v.id, vo.id, vo.label, vo.position;

SET FOREIGN_KEY_CHECKS = 1;
