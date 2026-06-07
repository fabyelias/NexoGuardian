-- ============================================================
-- NEXOGUARD — Políticas adicionales para rol admin
-- ============================================================

-- Admin puede editar novedades del libro de guardia
CREATE POLICY "logs_admin_update" ON guard_logs FOR UPDATE
  USING (
    organization_id = get_user_org_id()
    AND get_user_role() IN ('super_admin', 'admin', 'supervisor')
  );

-- Admin puede ver todas las novedades de su org (ya cubierto por logs_read)
-- Admin puede editar incidentes de su org (ya cubierto por incidents_update)

-- Profiles: admin puede ver todos y editar todos de su org
DROP POLICY IF EXISTS "profiles_admin_manage" ON profiles;
CREATE POLICY "profiles_admin_manage" ON profiles FOR ALL
  USING (
    get_user_role() IN ('super_admin', 'admin')
    AND (organization_id = get_user_org_id() OR id = auth.uid())
  );
