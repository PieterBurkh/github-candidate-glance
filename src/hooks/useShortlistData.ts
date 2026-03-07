import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 1000;

async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => any
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

interface EnrichmentEntry {
  overall_score: number;
  shortlist_status: string;
  evidence: any[];
}

/**
 * Fetches enrichment data (people + person_evidence) and indexes by login
 * for quick lookup when rendering the shortlist table.
 */
export function useShortlistEnrichment() {
  const query = useQuery({
    queryKey: ["shortlist-enrichment"],
    queryFn: async () => {
      const people = await fetchAllRows<any>((from, to) =>
        supabase.from("people").select("*").order("overall_score", { ascending: false }).range(from, to)
      );

      if (people.length === 0) return {} as Record<string, EnrichmentEntry>;

      const personIds = people.map((p: any) => p.id);
      const evidence = await fetchAllRows<any>((from, to) =>
        supabase.from("person_evidence").select("*").in("person_id", personIds).range(from, to)
      );

      const evidenceByPerson = new Map<string, any[]>();
      for (const ev of evidence) {
        const arr = evidenceByPerson.get(ev.person_id) || [];
        arr.push(ev);
        evidenceByPerson.set(ev.person_id, arr);
      }

      const map: Record<string, EnrichmentEntry> = {};
      for (const p of people) {
        map[p.login] = {
          overall_score: p.overall_score,
          shortlist_status: p.shortlist_status || "pending",
          evidence: evidenceByPerson.get(p.id) || [],
        };
      }
      return map;
    },
    refetchInterval: 10000,
  });

  return {
    enrichmentMap: query.data || ({} as Record<string, EnrichmentEntry>),
    isLoading: query.isLoading,
  };
}
