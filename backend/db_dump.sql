CREATE TABLE `admin_users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password_hash` text NOT NULL,
  `full_name` varchar(255) NOT NULL DEFAULT '',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_admin_users_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `appeal_participants` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `appeal_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `apartment` varchar(20) NOT NULL,
  `entrance` varchar(20) DEFAULT NULL,
  `display_name` varchar(255) NOT NULL DEFAULT '',
  `anonymous` tinyint(1) NOT NULL DEFAULT 0,
  `comment` text DEFAULT NULL,
  `photo_uri` text DEFAULT NULL,
  `joined_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ap_appeal_user` (`appeal_id`,`user_id`),
  KEY `fk_ap_user` (`user_id`),
  KEY `idx_ap_appeal` (`appeal_id`),
  CONSTRAINT `fk_ap_appeal` FOREIGN KEY (`appeal_id`) REFERENCES `appeals` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ap_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `appeal_photos` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `appeal_id` bigint(20) unsigned NOT NULL,
  `image_url` text NOT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_aph_appeal` (`appeal_id`,`position`),
  CONSTRAINT `fk_aph_appeal` FOREIGN KEY (`appeal_id`) REFERENCES `appeals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `appeals` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `title` varchar(500) NOT NULL,
  `body` text NOT NULL,
  `category` varchar(100) NOT NULL,
  `status` enum('new','collecting_signatures','in_progress','resolved','closed','rejected') NOT NULL DEFAULT 'new',
  `kind` enum('personal','collective') NOT NULL DEFAULT 'personal',
  `building_key` varchar(120) NOT NULL,
  `entrance` varchar(20) DEFAULT NULL,
  `author_apartment` varchar(20) NOT NULL DEFAULT '',
  `escalated_to_uk` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `resolved_at` datetime DEFAULT NULL,
  `manually_archived` tinyint(1) NOT NULL DEFAULT 0,
  `admin_comment` text DEFAULT NULL,
  `admin_comment_at` datetime DEFAULT NULL,
  `admin_comment_read_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_appeals_user_created` (`user_id`,`created_at` DESC),
  KEY `idx_appeals_status_created` (`status`,`created_at` DESC),
  KEY `idx_appeals_building_key` (`building_key`,`created_at` DESC),
  CONSTRAINT `fk_appeals_building` FOREIGN KEY (`building_key`) REFERENCES `buildings` (`building_key`) ON UPDATE CASCADE,
  CONSTRAINT `fk_appeals_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `building_contacts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `building_key` varchar(120) NOT NULL,
  `company_name` varchar(255) NOT NULL DEFAULT '',
  `phone` varchar(100) NOT NULL DEFAULT '',
  `email` varchar(255) NOT NULL DEFAULT '',
  `site` varchar(255) NOT NULL DEFAULT '',
  `hours` varchar(255) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_bc_building` (`building_key`),
  CONSTRAINT `fk_bc_building` FOREIGN KEY (`building_key`) REFERENCES `buildings` (`building_key`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `buildings` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `building_key` varchar(120) NOT NULL,
  `address` text NOT NULL,
  `short_name` varchar(255) NOT NULL,
  `city` varchar(255) NOT NULL DEFAULT '',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `year_built` int(11) DEFAULT NULL,
  `entrances` int(11) DEFAULT NULL,
  `apartments` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `lat` decimal(9,6) DEFAULT NULL,
  `lng` decimal(9,6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_buildings_key` (`building_key`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `district_pois` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `layer_id` enum('schools_daycare','clinic_pharmacy','grocery','parks','bus_stops_city','parking_city','waste_yard','bus_stops_house','parking_house') NOT NULL,
  `scope` enum('city','house') NOT NULL DEFAULT 'city',
  `address` varchar(500) NOT NULL DEFAULT '',
  `lat` double NOT NULL,
  `lng` double NOT NULL,
  `rating` decimal(3,2) DEFAULT NULL,
  `schedule` varchar(500) DEFAULT NULL,
  `photo_url` text DEFAULT NULL,
  `building_key` varchar(120) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_dp_layer` (`layer_id`),
  KEY `idx_dp_building` (`building_key`),
  CONSTRAINT `fk_dp_building` FOREIGN KEY (`building_key`) REFERENCES `buildings` (`building_key`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `environment_ratings` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `building_key` varchar(120) NOT NULL,
  `month_key` char(7) NOT NULL,
  `courtyard_stars` tinyint(4) NOT NULL CHECK (`courtyard_stars` between 1 and 5),
  `entrance_stars` tinyint(4) NOT NULL CHECK (`entrance_stars` between 1 and 5),
  `uk_stars` tinyint(4) NOT NULL CHECK (`uk_stars` between 1 and 5),
  `feedback_tags` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`feedback_tags`)),
  `feedback_other` text DEFAULT NULL,
  `submitted_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_er_user_month` (`user_id`,`month_key`),
  KEY `idx_er_building_month` (`building_key`,`month_key` DESC),
  CONSTRAINT `fk_er_building` FOREIGN KEY (`building_key`) REFERENCES `buildings` (`building_key`) ON UPDATE CASCADE,
  CONSTRAINT `fk_er_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `house_calendar_activities` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `building_key` varchar(120) NOT NULL,
  `activity_date` date NOT NULL,
  `title` varchar(500) NOT NULL,
  `kind` enum('yard','pipes','meeting','heating','garbage','other') NOT NULL DEFAULT 'other',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_hca_building_date` (`building_key`,`activity_date`),
  CONSTRAINT `fk_hca_building` FOREIGN KEY (`building_key`) REFERENCES `buildings` (`building_key`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=77 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `house_photos` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `building_key` varchar(120) NOT NULL,
  `image_url` text NOT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_hph_building_position` (`building_key`,`position`),
  CONSTRAINT `fk_hph_building` FOREIGN KEY (`building_key`) REFERENCES `buildings` (`building_key`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `house_specs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `building_key` varchar(120) NOT NULL,
  `label` varchar(255) NOT NULL,
  `value` text NOT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_hs_building_position` (`building_key`,`position`),
  CONSTRAINT `fk_hs_building` FOREIGN KEY (`building_key`) REFERENCES `buildings` (`building_key`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `house_status` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `building_key` varchar(120) NOT NULL,
  `text` varchar(500) NOT NULL,
  `status` enum('ok','warning','danger') NOT NULL DEFAULT 'ok',
  `position` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_hs_building` (`building_key`,`position`),
  CONSTRAINT `fk_hst_building` FOREIGN KEY (`building_key`) REFERENCES `buildings` (`building_key`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `neighbor_ad_photos` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `ad_id` bigint(20) unsigned NOT NULL,
  `image_url` text NOT NULL,
  `position` smallint(5) unsigned NOT NULL DEFAULT 0,
  `is_primary` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_ad_id` (`ad_id`),
  CONSTRAINT `fk_photos_ad` FOREIGN KEY (`ad_id`) REFERENCES `neighbor_ads` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `neighbor_ads` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `author_user_id` bigint(20) unsigned NOT NULL,
  `building_key` varchar(120) NOT NULL,
  `title` varchar(500) NOT NULL,
  `body` text NOT NULL,
  `category` enum('sell','buy','service','invite','lost','found','other') NOT NULL DEFAULT 'other',
  `show_phone` tinyint(1) NOT NULL DEFAULT 0,
  `author_phone` varchar(50) DEFAULT NULL,
  `pending_moderation` tinyint(1) NOT NULL DEFAULT 0,
  `archived` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `expires_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `image_urls` mediumtext DEFAULT NULL,
  `status` enum('new','under_review','published','archived','rejected','under_review_appeal') NOT NULL DEFAULT 'new',
  PRIMARY KEY (`id`),
  KEY `idx_na_building_created` (`building_key`,`created_at` DESC),
  KEY `idx_na_author_created` (`author_user_id`,`created_at` DESC),
  KEY `idx_na_expires` (`expires_at`),
  CONSTRAINT `fk_na_building` FOREIGN KEY (`building_key`) REFERENCES `buildings` (`building_key`) ON UPDATE CASCADE,
  CONSTRAINT `fk_na_user` FOREIGN KEY (`author_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `news` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `building_key` varchar(120) NOT NULL,
  `title` text NOT NULL,
  `excerpt` text NOT NULL,
  `published_at` date NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `is_published` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_news_building_published` (`building_key`,`published_at` DESC),
  CONSTRAINT `fk_news_building` FOREIGN KEY (`building_key`) REFERENCES `buildings` (`building_key`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `news_photos` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `news_id` bigint(20) unsigned NOT NULL,
  `image_url` mediumtext NOT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_np_news` (`news_id`,`position`),
  CONSTRAINT `fk_np_news` FOREIGN KEY (`news_id`) REFERENCES `news` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `notifications` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `type` enum('outage','meeting','announcement','general') NOT NULL,
  `title` varchar(255) NOT NULL,
  `body` text NOT NULL,
  `recipient_user_id` bigint(20) unsigned DEFAULT NULL,
  `published_at` datetime NOT NULL DEFAULT current_timestamp(),
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `building_key` varchar(120) DEFAULT NULL COMMENT 'NULL = всем домам',
  PRIMARY KEY (`id`),
  KEY `idx_notifications_type_date` (`type`,`published_at` DESC),
  KEY `idx_notifications_recipient` (`recipient_user_id`,`published_at` DESC),
  KEY `fk_notif_building` (`building_key`),
  CONSTRAINT `fk_notif_building` FOREIGN KEY (`building_key`) REFERENCES `buildings` (`building_key`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`recipient_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `push_tokens` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `token` varchar(500) NOT NULL,
  `platform` varchar(20) NOT NULL DEFAULT 'expo',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pt_user_token` (`user_id`,`token`),
  CONSTRAINT `fk_pt_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `refresh_tokens` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `token` varchar(100) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rt_token` (`token`),
  KEY `idx_rt_user` (`user_id`),
  CONSTRAINT `fk_rt_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=194 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `trash_pickup_schedule` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `building_key` varchar(120) NOT NULL,
  `title` varchar(255) NOT NULL,
  `schedule` varchar(255) NOT NULL,
  `note` text DEFAULT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_tps_building_position` (`building_key`,`position`),
  CONSTRAINT `fk_tps_building` FOREIGN KEY (`building_key`) REFERENCES `buildings` (`building_key`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `user_apartments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `building_key` varchar(120) NOT NULL,
  `apartment` varchar(20) NOT NULL DEFAULT '',
  `entrance` int(11) DEFAULT NULL,
  `apartment_area_sqm` decimal(6,2) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ua_user_building_apt` (`user_id`,`building_key`,`apartment`),
  KEY `idx_ua_user` (`user_id`),
  KEY `idx_ua_building` (`building_key`),
  CONSTRAINT `fk_ua_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `user_notification_reads` (
  `user_id` bigint(20) unsigned NOT NULL,
  `notification_id` bigint(20) unsigned NOT NULL,
  `read_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`user_id`,`notification_id`),
  KEY `fk_unr_notif` (`notification_id`),
  CONSTRAINT `fk_unr_notif` FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_unr_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `user_profiles` (
  `user_id` bigint(20) unsigned NOT NULL,
  `full_name` varchar(255) NOT NULL DEFAULT '',
  `phone` varchar(50) NOT NULL DEFAULT '',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `profile_photo` text DEFAULT NULL,
  `active_apartment_id` bigint(20) unsigned DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  KEY `fk_up_active_apartment` (`active_apartment_id`),
  CONSTRAINT `fk_up_active_apartment` FOREIGN KEY (`active_apartment_id`) REFERENCES `user_apartments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_up_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password_hash` text NOT NULL,
  `data_consent_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `notif_outages` tinyint(1) NOT NULL DEFAULT 1,
  `notif_meetings` tinyint(1) NOT NULL DEFAULT 1,
  `notif_announcements` tinyint(1) NOT NULL DEFAULT 1,
  `notif_general` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `expo_push_token` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `verification_requests` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `doc_type` enum('lease','ownership') DEFAULT NULL,
  `submitted_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `photo_url` text NOT NULL,
  `comment` text DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `apartment_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_vr_user_created` (`created_at` DESC),
  KEY `idx_vr_apartment_submitted` (`apartment_id`,`submitted_at` DESC),
  CONSTRAINT `fk_vr_apartment` FOREIGN KEY (`apartment_id`) REFERENCES `user_apartments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `vote_casts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `vote_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `option_id` bigint(20) unsigned NOT NULL,
  `area_sqm` decimal(6,2) NOT NULL DEFAULT 0.00,
  `voted_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vc_vote_user` (`vote_id`,`user_id`),
  KEY `fk_vc_user` (`user_id`),
  KEY `fk_vc_option` (`option_id`),
  KEY `idx_vc_vote` (`vote_id`),
  CONSTRAINT `fk_vc_option` FOREIGN KEY (`option_id`) REFERENCES `vote_options` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_vc_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_vc_vote` FOREIGN KEY (`vote_id`) REFERENCES `votes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `vote_options` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `vote_id` bigint(20) unsigned NOT NULL,
  `label` text NOT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_vo_vote` (`vote_id`,`position`),
  CONSTRAINT `fk_vo_vote` FOREIGN KEY (`vote_id`) REFERENCES `votes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `votes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `building_key` varchar(120) NOT NULL,
  `created_by_label` varchar(255) NOT NULL DEFAULT '',
  `sponsor` enum('uk','residents') NOT NULL DEFAULT 'residents',
  `topic` text NOT NULL,
  `description` text NOT NULL DEFAULT '',
  `visibility` enum('open','secret') NOT NULL DEFAULT 'open',
  `ends_at` datetime NOT NULL,
  `closed` tinyint(1) NOT NULL DEFAULT 0,
  `trial` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `status` enum('new','under_review','active','completed','cancelled') NOT NULL DEFAULT 'new',
  PRIMARY KEY (`id`),
  KEY `idx_votes_building_key` (`building_key`,`created_at` DESC),
  KEY `idx_votes_ends_at` (`ends_at`),
  CONSTRAINT `fk_votes_building` FOREIGN KEY (`building_key`) REFERENCES `buildings` (`building_key`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

