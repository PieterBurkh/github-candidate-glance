import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const MUST_HAVES: Record<string, { label: string; weight: number }> = {
  react_typescript: { label: "React & TypeScript", weight: 2.0 },
  rich_app_architecture: { label: "Rich App Architecture", weight: 2.0 },
  performance_profiling: { label: "Performance Profiling", weight: 1.5 },
  docs_versioning: { label: "Docs & Versioning", weight: 1.0 },
};

const NICE_TO_HAVES: Record<string, string> = {
  bpmn_uml_uis: "BPMN / UML UIs",
  wcag_accessibility: "WCAG Accessibility",
  semver_library_maintenance: "Semver / Library Maintenance",
  crdts: "CRDTs",
  wasm: "WASM",
  canvas_webgl: "Canvas / WebGL",
};

interface CriterionEntry {
  score: number;
  evidence?: string;
}

function CriterionRow({ label, entry, suffix }: { label: string; entry: CriterionEntry; suffix?: string }) {
  const pct = Math.round((entry.score ?? 0) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground font-medium">
          {label}
          {suffix && <span className="text-muted-foreground text-xs ml-1">{suffix}</span>}
        </span>
        <span className="font-semibold text-foreground">{pct}%</span>
      </div>
      <Progress value={pct} className="h-2" />
      {entry.evidence && (
        <p className="text-xs text-muted-foreground mt-1">{entry.evidence}</p>
      )}
    </div>
  );
}

function weightedAvg(criteria: Record<string, { weight: number }>, data: Record<string, CriterionEntry>) {
  let total = 0, wSum = 0;
  for (const [key, meta] of Object.entries(criteria)) {
    const s = data[key]?.score ?? 0;
    total += s * meta.weight;
    wSum += meta.weight;
  }
  return wSum > 0 ? total / wSum : 0;
}

function simpleAvg(keys: string[], data: Record<string, CriterionEntry>) {
  const scores = keys.map(k => data[k]?.score ?? 0);
  return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
}

interface RubricBreakdownProps {
  rubricEvidence: any;
}

export function RubricBreakdown({ rubricEvidence }: RubricBreakdownProps) {
  const mustHaves = rubricEvidence?.must_haves as Record<string, CriterionEntry> | undefined;
  const niceToHaves = rubricEvidence?.nice_to_haves as Record<string, CriterionEntry> | undefined;
  const reposEvaluated = rubricEvidence?.repos_evaluated as string[] | undefined;

  const mustAvg = mustHaves ? weightedAvg(MUST_HAVES, mustHaves) : 0;
  const niceAvg = niceToHaves ? simpleAvg(Object.keys(NICE_TO_HAVES), niceToHaves) : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Evaluation Breakdown</h2>

      {/* Must-Haves */}
      {mustHaves && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Must-Haves (80% weight)</CardTitle>
              <span className="text-sm font-semibold text-foreground">
                Avg: {Math.round(mustAvg * 100)}%
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(MUST_HAVES).map(([key, meta]) => {
              const entry = mustHaves[key];
              if (!entry) return null;
              return (
                <CriterionRow
                  key={key}
                  label={meta.label}
                  entry={entry}
                  suffix={`×${meta.weight}`}
                />
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Nice-to-Haves */}
      {niceToHaves && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Nice-to-Haves (20% weight)</CardTitle>
              <span className="text-sm font-semibold text-foreground">
                Avg: {Math.round(niceAvg * 100)}%
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(NICE_TO_HAVES).map(([key, label]) => {
              const entry = niceToHaves[key];
              if (!entry) return null;
              return <CriterionRow key={key} label={label} entry={entry} />;
            })}
          </CardContent>
        </Card>
      )}

      {/* Repos Evaluated */}
      {reposEvaluated && reposEvaluated.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Repos Evaluated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {reposEvaluated.map((repo) => (
                <a
                  key={repo}
                  href={`https://github.com/${repo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors border border-border rounded px-2 py-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  {repo}
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
