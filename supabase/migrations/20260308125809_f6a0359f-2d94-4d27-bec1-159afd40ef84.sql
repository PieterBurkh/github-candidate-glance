CREATE TABLE public.pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage text NOT NULL DEFAULT 'pending',
  config jsonb NOT NULL DEFAULT '{}',
  run_id uuid,
  longlist_run_id uuid,
  shortlist_run_id uuid,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on pipeline_runs" ON public.pipeline_runs FOR ALL USING (true) WITH CHECK (true);