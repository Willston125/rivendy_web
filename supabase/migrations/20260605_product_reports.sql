-- Migration for creating product_reports table
-- Shared between flutter mobile app and web frontend

CREATE TABLE IF NOT EXISTS product_reports (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  reported_by   uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  reason        text        NOT NULL DEFAULT 'other'
                            CHECK (reason IN (
                              'pornography','violence','illegal','fake',
                              'inappropriate','spam','other'
                            )),
  details       text        DEFAULT '',
  status        text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','reviewed','dismissed','actioned')),
  reviewed_by   uuid        REFERENCES profiles(id),
  reviewed_at   timestamptz,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_reports_product ON product_reports(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reports_status ON product_reports(status);
CREATE INDEX IF NOT EXISTS idx_product_reports_created ON product_reports(created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE product_reports ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to file a report
DROP POLICY IF EXISTS "auth_can_insert_report" ON product_reports;
CREATE POLICY "auth_can_insert_report" ON product_reports
  FOR INSERT TO authenticated WITH CHECK (true);

-- Allow authenticated users to view their own reports (if needed)
DROP POLICY IF EXISTS "auth_can_view_own_reports" ON product_reports;
CREATE POLICY "auth_can_view_own_reports" ON product_reports
  FOR SELECT TO authenticated USING (reported_by = auth.uid());

-- Admin/service_role access
DROP POLICY IF EXISTS "service_role_all" ON product_reports;
CREATE POLICY "service_role_all" ON product_reports
  FOR ALL TO service_role USING (true);
