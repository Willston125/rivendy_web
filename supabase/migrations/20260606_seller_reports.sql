-- Migration for creating seller_reports table

CREATE TABLE IF NOT EXISTS seller_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT uq_seller_reporter UNIQUE(seller_id, reported_by)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_seller_reports_seller ON seller_reports(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_reports_status ON seller_reports(status);
CREATE INDEX IF NOT EXISTS idx_seller_reports_created ON seller_reports(created_at DESC);

-- RLS
ALTER TABLE seller_reports ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert reports
DROP POLICY IF EXISTS "auth_can_insert_seller_report" ON seller_reports;
CREATE POLICY "auth_can_insert_seller_report" ON seller_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reported_by);

-- Allow authenticated users to view their own reports
DROP POLICY IF EXISTS "auth_can_view_own_seller_reports" ON seller_reports;
CREATE POLICY "auth_can_view_own_seller_reports" ON seller_reports
  FOR SELECT TO authenticated
  USING (auth.uid() = reported_by);

-- Service role has full access
DROP POLICY IF EXISTS "service_role_all_seller_reports" ON seller_reports;
CREATE POLICY "service_role_all_seller_reports" ON seller_reports
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
