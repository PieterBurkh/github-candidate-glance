
-- Table: longlist_runs
CREATE TABLE public.longlist_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_run_id uuid REFERENCES public.runs(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.longlist_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on longlist_runs" ON public.longlist_runs
  FOR ALL USING (true) WITH CHECK (true);

-- Table: longlist_candidates
CREATE TABLE public.longlist_candidates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  longlist_run_id uuid NOT NULL REFERENCES public.longlist_runs(id) ON DELETE CASCADE,
  login text NOT NULL,
  stage text NOT NULL DEFAULT 'pending',
  discard_reason text,
  hydration jsonb NOT NULL DEFAULT '{}'::jsonb,
  candidate_repos jsonb NOT NULL DEFAULT '[]'::jsonb,
  repo_signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  pre_score double precision NOT NULL DEFAULT 0,
  pre_confidence double precision NOT NULL DEFAULT 0,
  selection_tier text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (longlist_run_id, login)
);

ALTER TABLE public.longlist_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on longlist_candidates" ON public.longlist_candidates
  FOR ALL USING (true) WITH CHECK (true);
