-- ============================================================
-- NEXOGUARD v1.0 — Row Level Security
-- ============================================================

ALTER TABLE organizations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites            ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkpoints      ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE guard_locations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE guard_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE media            ENABLE ROW LEVEL SECURITY;
ALTER TABLE patrol_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE patrol_points    ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications    ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- PROFILES
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (id = auth.uid() OR organization_id = get_user_org_id());

CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "profiles_admin_manage" ON profiles FOR ALL
  USING (get_user_role() IN ('super_admin','admin'));

-- ORGANIZATIONS
CREATE POLICY "orgs_read_own" ON organizations FOR SELECT
  USING (id = get_user_org_id());

CREATE POLICY "orgs_admin_manage" ON organizations FOR ALL
  USING (get_user_role() = 'super_admin');

-- SITES
CREATE POLICY "sites_org_read" ON sites FOR SELECT
  USING (organization_id = get_user_org_id() AND (
    get_user_role() IN ('super_admin','admin','supervisor','guard')
    OR client_id = auth.uid()
  ));

CREATE POLICY "sites_admin_manage" ON sites FOR ALL
  USING (organization_id = get_user_org_id() AND get_user_role() IN ('super_admin','admin'));

-- CHECKPOINTS
CREATE POLICY "checkpoints_org_read" ON checkpoints FOR SELECT
  USING (organization_id = get_user_org_id());

CREATE POLICY "checkpoints_admin_manage" ON checkpoints FOR ALL
  USING (organization_id = get_user_org_id() AND get_user_role() IN ('super_admin','admin','supervisor'));

-- SHIFTS
CREATE POLICY "shifts_read" ON shifts FOR SELECT
  USING (organization_id = get_user_org_id() AND (
    get_user_role() IN ('super_admin','admin','supervisor')
    OR guard_id = auth.uid()
  ));

CREATE POLICY "shifts_guard_update" ON shifts FOR UPDATE
  USING (guard_id = auth.uid());

CREATE POLICY "shifts_admin_manage" ON shifts FOR ALL
  USING (organization_id = get_user_org_id() AND get_user_role() IN ('super_admin','admin','supervisor'));

-- GUARD LOCATIONS
CREATE POLICY "locations_insert_own" ON guard_locations FOR INSERT
  WITH CHECK (guard_id = auth.uid());

CREATE POLICY "locations_select" ON guard_locations FOR SELECT
  USING (
    guard_id = auth.uid()
    OR (
      get_user_role() IN ('super_admin','admin','supervisor')
      AND guard_id IN (SELECT id FROM profiles WHERE organization_id = get_user_org_id())
    )
  );

-- GUARD LOGS
CREATE POLICY "logs_read" ON guard_logs FOR SELECT
  USING (organization_id = get_user_org_id() AND (
    get_user_role() IN ('super_admin','admin','supervisor')
    OR guard_id = auth.uid()
  ));

CREATE POLICY "logs_insert" ON guard_logs FOR INSERT
  WITH CHECK (organization_id = get_user_org_id() AND guard_id = auth.uid());

-- INCIDENTS
CREATE POLICY "incidents_read" ON incidents FOR SELECT
  USING (organization_id = get_user_org_id() AND (
    get_user_role() IN ('super_admin','admin','supervisor')
    OR reported_by = auth.uid()
    OR assigned_to = auth.uid()
    OR (get_user_role() = 'client' AND site_id IN (SELECT id FROM sites WHERE client_id = auth.uid()))
  ));

CREATE POLICY "incidents_insert" ON incidents FOR INSERT
  WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "incidents_update" ON incidents FOR UPDATE
  USING (organization_id = get_user_org_id() AND (
    get_user_role() IN ('super_admin','admin','supervisor')
    OR reported_by = auth.uid()
  ));

-- INCIDENT UPDATES
CREATE POLICY "incident_updates_read" ON incident_updates FOR SELECT
  USING (incident_id IN (SELECT id FROM incidents WHERE organization_id = get_user_org_id()));

CREATE POLICY "incident_updates_insert" ON incident_updates FOR INSERT
  WITH CHECK (author_id = auth.uid());

-- MEDIA
CREATE POLICY "media_read" ON media FOR SELECT
  USING (organization_id = get_user_org_id());

CREATE POLICY "media_insert" ON media FOR INSERT
  WITH CHECK (organization_id = get_user_org_id() AND uploaded_by = auth.uid());

-- PATROL SESSIONS
CREATE POLICY "patrols_read" ON patrol_sessions FOR SELECT
  USING (organization_id = get_user_org_id() AND (
    get_user_role() IN ('super_admin','admin','supervisor')
    OR guard_id = auth.uid()
  ));

CREATE POLICY "patrols_insert" ON patrol_sessions FOR INSERT
  WITH CHECK (organization_id = get_user_org_id() AND guard_id = auth.uid());

CREATE POLICY "patrols_update" ON patrol_sessions FOR UPDATE
  USING (guard_id = auth.uid() OR get_user_role() IN ('super_admin','admin','supervisor'));

-- PATROL POINTS
CREATE POLICY "patrol_points_read" ON patrol_points FOR SELECT
  USING (patrol_session_id IN (SELECT id FROM patrol_sessions WHERE organization_id = get_user_org_id()));

CREATE POLICY "patrol_points_insert" ON patrol_points FOR INSERT
  WITH CHECK (guard_id = auth.uid());

-- NOTIFICATIONS
CREATE POLICY "notifications_own" ON notifications FOR ALL
  USING (user_id = auth.uid());
