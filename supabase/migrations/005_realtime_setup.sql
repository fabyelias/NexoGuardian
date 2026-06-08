-- Enable REPLICA IDENTITY FULL so Realtime column filters work correctly
ALTER TABLE incidents       REPLICA IDENTITY FULL;
ALTER TABLE notifications   REPLICA IDENTITY FULL;
ALTER TABLE guard_locations REPLICA IDENTITY FULL;

-- Add tables to the supabase_realtime publication (safe even if already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'incidents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE incidents;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'guard_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE guard_locations;
  END IF;
END $$;

-- RLS policy: users can read their own notifications
DROP POLICY IF EXISTS "notifications_own_read" ON notifications;
CREATE POLICY "notifications_own_read" ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- RLS policy: service role can insert notifications (for Edge Functions)
DROP POLICY IF EXISTS "notifications_service_insert" ON notifications;
CREATE POLICY "notifications_service_insert" ON notifications FOR INSERT
  WITH CHECK (true);

-- RLS policy: users can update (mark as read) their own notifications
DROP POLICY IF EXISTS "notifications_own_update" ON notifications;
CREATE POLICY "notifications_own_update" ON notifications FOR UPDATE
  USING (user_id = auth.uid());
