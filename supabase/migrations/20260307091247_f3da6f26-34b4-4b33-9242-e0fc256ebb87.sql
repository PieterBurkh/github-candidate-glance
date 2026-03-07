
-- Runs table
CREATE TABLE public.runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending',
  search_params jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Repos table
CREATE TABLE public.repos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.runs(id) ON DELETE CASCADE NOT NULL,
  full_name text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  owner_login text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(run_id, full_name)
);

-- Repo signals table
CREATE TABLE public.repo_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id uuid REFERENCES public.repos(id) ON DELETE CASCADE NOT NULL,
  criterion text NOT NULL,
  signal_value float NOT NULL DEFAULT 0,
  confidence float NOT NULL DEFAULT 0,
  evidence jsonb NOT NULL DEFAULT '[]',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- People table
CREATE TABLE public.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login text NOT NULL UNIQUE,
  profile jsonb NOT NULL DEFAULT '{}',
  overall_score float NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Person evidence table
CREATE TABLE public.person_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid REFERENCES public.people(id) ON DELETE CASCADE NOT NULL,
  repo_id uuid REFERENCES public.repos(id) ON DELETE SET NULL,
  criterion text NOT NULL,
  score float NOT NULL DEFAULT 0,
  evidence jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Disable RLS on all tables (internal single-user tool)
ALTER TABLE public.runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.repos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.repo_signals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.people DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_evidence DISABLE ROW LEVEL SECURITY;
