
ALTER TABLE people ADD COLUMN IF NOT EXISTS shortlist_status text DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS shortlist_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending',
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE shortlist_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to shortlist_runs" ON shortlist_runs FOR ALL USING (true) WITH CHECK (true);
