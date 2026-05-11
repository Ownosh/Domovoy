BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
        CREATE TYPE verification_status AS ENUM ('none', 'pending', 'approved', 'rejected');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appeal_status') THEN
        CREATE TYPE appeal_status AS ENUM ('new', 'accepted', 'in_progress', 'resolved', 'rejected');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
        CREATE TYPE notification_type AS ENUM ('outage', 'meeting', 'announcement', 'general');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'poi_category') THEN
        CREATE TYPE poi_category AS ENUM ('education', 'health', 'shopping', 'leisure');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE payment_status AS ENUM ('created', 'pending', 'succeeded', 'failed', 'cancelled');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    building TEXT NOT NULL DEFAULT '',
    apartment TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status verification_status NOT NULL DEFAULT 'none',
    doc_type TEXT CHECK (doc_type IN ('lease', 'ownership') OR doc_type IS NULL),
    submitted_at TIMESTAMPTZ,
    reviewer_comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_user_created
    ON verification_requests(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    outages BOOLEAN NOT NULL DEFAULT TRUE,
    meetings BOOLEAN NOT NULL DEFAULT TRUE,
    announcements BOOLEAN NOT NULL DEFAULT TRUE,
    general BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feed_visibility_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    show_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    show_news BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appeals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    category TEXT NOT NULL,
    status appeal_status NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_appeals_user_created
    ON appeals(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_appeals_status_created
    ON appeals(status, created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_type_date
    ON notifications(type, published_at DESC);

CREATE TABLE IF NOT EXISTS user_notification_reads (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, notification_id)
);

CREATE TABLE IF NOT EXISTS news (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    excerpt TEXT NOT NULL,
    image_url TEXT,
    published_at DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_published_at
    ON news(published_at DESC);

CREATE TABLE IF NOT EXISTS uk_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    site TEXT,
    hours TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS house_passports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building TEXT NOT NULL,
    address TEXT NOT NULL,
    year_built INT,
    entrances INT,
    apartments INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS house_specs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    house_passport_id UUID NOT NULL REFERENCES house_passports(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    position INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_house_specs_passport_position
    ON house_specs(house_passport_id, position);

CREATE TABLE IF NOT EXISTS house_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    house_passport_id UUID NOT NULL REFERENCES house_passports(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    position INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_house_photos_passport_position
    ON house_photos(house_passport_id, position);

CREATE TABLE IF NOT EXISTS district_pois (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category poi_category NOT NULL,
    address TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_district_pois_category
    ON district_pois(category);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    currency CHAR(3) NOT NULL DEFAULT 'RUB',
    description TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'yookassa',
    provider_payment_id TEXT,
    status payment_status NOT NULL DEFAULT 'created',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_user_created
    ON payments(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_provider_payment
    ON payments(provider, provider_payment_id);

-- App logic: finished appeals are auto-moved to archive after 3 days.
-- This is represented with views, no data duplication needed.
CREATE OR REPLACE VIEW appeals_archive AS
SELECT a.*
FROM appeals a
WHERE a.status IN ('resolved', 'rejected')
  AND a.created_at <= NOW() - INTERVAL '3 days';

CREATE OR REPLACE VIEW appeals_active AS
SELECT a.*
FROM appeals a
WHERE NOT (
    a.status IN ('resolved', 'rejected')
    AND a.created_at <= NOW() - INTERVAL '3 days'
);

-- --- Расширения под функции приложения (черновик для бэкенда) ---
-- appeal_kind: personal | collective
-- appeal_status: + mass_appeal
-- neighbor_ads: срок 30 дней, модерация УК
-- votes / vote_ballots: открытые/тайные, площадь, время голоса для протокола ОСС
-- appeal_participants: присоединение жильцов, анонимность, комментарий
-- environment_ratings: двор/подъезд без привязки к заявке
-- contractors + appeal_contractor_links: рейтинг подрядчиков по закрытым заявкам
-- uk_transparency_snapshots: публичная статистика УК (снимок раз в сутки)
-- emergency_contacts_cache, emergency_guides: офлайн ЧС

COMMIT;

