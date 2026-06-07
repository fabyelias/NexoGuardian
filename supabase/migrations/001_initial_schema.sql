-- ============================================================
-- NEXOGUARD v1.0 — Schema inicial
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ENUMS
CREATE TYPE user_role AS ENUM ('super_admin','admin','supervisor','guard','client');
CREATE TYPE incident_category AS ENUM ('intrusion','theft','damage','medical_emergency','fire','accident','operational','other');
CREATE TYPE incident_severity AS ENUM ('low','medium','high','critical');
CREATE TYPE incident_status AS ENUM ('open','in_progress','resolved','closed');
CREATE TYPE shift_status AS ENUM ('scheduled','active','completed','absent');
CREATE TYPE patrol_status AS ENUM ('in_progress','completed','incomplete');
CREATE TYPE media_type AS ENUM ('photo','video','audio','document');

-- ORGANIZATIONS
CREATE TABLE organizations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  logo_url      TEXT,
  address       TEXT,
  phone         TEXT,
  email         TEXT,
  tax_id        TEXT,
  plan          TEXT DEFAULT 'free' CHECK (plan IN ('free','pro','enterprise')),
  is_active     BOOLEAN DEFAULT true,
  settings      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- PROFILES
CREATE TABLE profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role              user_role NOT NULL DEFAULT 'guard',
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  avatar_url        TEXT,
  phone             TEXT,
  badge_number      TEXT,
  id_document       TEXT,
  address           TEXT,
  emergency_contact JSONB,
  is_active         BOOLEAN DEFAULT true,
  last_seen_at      TIMESTAMPTZ,
  fcm_token         TEXT,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- SITES
CREATE TABLE sites (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES profiles(id),
  name            TEXT NOT NULL,
  address         TEXT NOT NULL,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  geofence_radius INTEGER DEFAULT 100,
  contact_name    TEXT,
  contact_phone   TEXT,
  contact_email   TEXT,
  consignas       TEXT,
  is_active       BOOLEAN DEFAULT true,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- CHECKPOINTS
CREATE TABLE checkpoints (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name            TEXT NOT NULL,
  description     TEXT,
  qr_code         TEXT UNIQUE NOT NULL DEFAULT uuid_generate_v4()::TEXT,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  order_index     INTEGER DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- SHIFTS
CREATE TABLE shifts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID NOT NULL REFERENCES organizations(id),
  site_id          UUID NOT NULL REFERENCES sites(id),
  guard_id         UUID NOT NULL REFERENCES profiles(id),
  supervisor_id    UUID REFERENCES profiles(id),
  scheduled_start  TIMESTAMPTZ NOT NULL,
  scheduled_end    TIMESTAMPTZ NOT NULL,
  actual_start     TIMESTAMPTZ,
  actual_end       TIMESTAMPTZ,
  status           shift_status DEFAULT 'scheduled',
  start_lat        DOUBLE PRECISION,
  start_lng        DOUBLE PRECISION,
  end_lat          DOUBLE PRECISION,
  end_lng          DOUBLE PRECISION,
  start_selfie_url TEXT,
  end_selfie_url   TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- GUARD LOCATIONS
CREATE TABLE guard_locations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guard_id    UUID NOT NULL REFERENCES profiles(id),
  shift_id    UUID REFERENCES shifts(id),
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  accuracy    DOUBLE PRECISION,
  battery     INTEGER,
  is_online   BOOLEAN DEFAULT true,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_guard_locations_guard_time ON guard_locations(guard_id, recorded_at DESC);

-- GUARD LOGS
CREATE TABLE guard_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id        UUID NOT NULL REFERENCES shifts(id),
  guard_id        UUID NOT NULL REFERENCES profiles(id),
  site_id         UUID NOT NULL REFERENCES sites(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  content         TEXT NOT NULL,
  ai_enhanced     TEXT,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  is_synced       BOOLEAN DEFAULT true,
  recorded_at     TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- INCIDENTS
CREATE TABLE incidents (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID NOT NULL REFERENCES organizations(id),
  site_id          UUID NOT NULL REFERENCES sites(id),
  reported_by      UUID NOT NULL REFERENCES profiles(id),
  assigned_to      UUID REFERENCES profiles(id),
  category         incident_category NOT NULL,
  severity         incident_severity NOT NULL DEFAULT 'medium',
  status           incident_status DEFAULT 'open',
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  ai_description   TEXT,
  lat              DOUBLE PRECISION,
  lng              DOUBLE PRECISION,
  is_panic         BOOLEAN DEFAULT false,
  shift_id         UUID REFERENCES shifts(id),
  resolved_at      TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_incidents_org_status ON incidents(organization_id, status, created_at DESC);

-- INCIDENT UPDATES
CREATE TABLE incident_updates (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id   UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES profiles(id),
  content       TEXT NOT NULL,
  status_change incident_status,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- MEDIA
CREATE TABLE media (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  uploaded_by     UUID NOT NULL REFERENCES profiles(id),
  incident_id     UUID REFERENCES incidents(id) ON DELETE CASCADE,
  guard_log_id    UUID REFERENCES guard_logs(id) ON DELETE CASCADE,
  patrol_point_id UUID,
  type            media_type NOT NULL,
  storage_path    TEXT NOT NULL,
  file_name       TEXT,
  file_size       INTEGER,
  duration        INTEGER,
  thumbnail_path  TEXT,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  is_evidence     BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- PATROL SESSIONS
CREATE TABLE patrol_sessions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     UUID NOT NULL REFERENCES organizations(id),
  site_id             UUID NOT NULL REFERENCES sites(id),
  guard_id            UUID NOT NULL REFERENCES profiles(id),
  shift_id            UUID REFERENCES shifts(id),
  status              patrol_status DEFAULT 'in_progress',
  started_at          TIMESTAMPTZ DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  total_checkpoints   INTEGER DEFAULT 0,
  visited_checkpoints INTEGER DEFAULT 0,
  notes               TEXT
);

-- PATROL POINTS
CREATE TABLE patrol_points (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patrol_session_id UUID NOT NULL REFERENCES patrol_sessions(id) ON DELETE CASCADE,
  checkpoint_id     UUID NOT NULL REFERENCES checkpoints(id),
  guard_id          UUID NOT NULL REFERENCES profiles(id),
  lat               DOUBLE PRECISION,
  lng               DOUBLE PRECISION,
  notes             TEXT,
  scanned_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE media ADD CONSTRAINT fk_media_patrol_point
  FOREIGN KEY (patrol_point_id) REFERENCES patrol_points(id);

-- NOTIFICATIONS
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id         UUID NOT NULL REFERENCES profiles(id),
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  type            TEXT NOT NULL,
  reference_id    UUID,
  reference_type  TEXT,
  is_read         BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);

-- TRIGGERS updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orgs_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sites_updated_at BEFORE UPDATE ON sites FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_shifts_updated_at BEFORE UPDATE ON shifts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_incidents_updated_at BEFORE UPDATE ON incidents FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- AUTO-CREATE PROFILE ON SIGNUP
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, first_name, last_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'Usuario'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'Nuevo'),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'guard')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
