
-- Enable RLS but with permissive policies for all operations (internal tool, no auth)
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repo_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on runs" ON public.runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on repos" ON public.repos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on repo_signals" ON public.repo_signals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on people" ON public.people FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on person_evidence" ON public.person_evidence FOR ALL USING (true) WITH CHECK (true);
