import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Candidate {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  public_repos: number;
  followers: number;
  expertise: {
    react: boolean;
    typescript: boolean;
    html: boolean;
    css: boolean;
  };
  topStarredRepo: { name: string; url: string; stars: number } | null;
  topForkedRepo: { name: string; url: string; forks: number } | null;
  error?: string;
}

interface CandidatesResponse {
  candidates: Candidate[];
  totalCount: number;
  page: number;
  perPage: number;
}

async function fetchCandidates(): Promise<CandidatesResponse> {
  const { data, error } = await supabase.functions.invoke("github-candidates", {
    body: { page: 1, perPage: 20 },
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  return data as CandidatesResponse;
}

export function useCandidates() {
  return useQuery({
    queryKey: ["github-candidates"],
    queryFn: fetchCandidates,
    staleTime: 5 * 60 * 1000, // 5 min cache
    retry: 1,
  });
}
