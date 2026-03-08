import { NavBar } from "@/components/NavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const SCORING_FACTORS = [
  { factor: "React / Next / Remix / Gatsby in topics", points: "+20", note: null },
  { factor: "TypeScript language detected", points: "+15", note: "or JavaScript +10 if no TS" },
  { factor: "Total stars ≥ 100", points: "+10", note: "or ≥ 20 → +5" },
  { factor: "Followers ≥ 200", points: "+10", note: "or ≥ 50 → +5" },
  { factor: "Pushed in last 6 months", points: "+5", note: null },
  { factor: "3+ repos ≥ 500 KB", points: "+5", note: null },
  { factor: "5+ non-fork repos", points: "+5", note: null },
  { factor: "GitHub Pages enabled", points: "+2", note: null },
  { factor: "Complex keywords (drag, editor, chart, xstate…)", points: "+3 each", note: "max +10" },
];

export function LonglistApproachContent() {
  return (
    <div className="mx-auto max-w-4xl py-8">
      <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">Longlist Approach</h1>
        <p className="text-muted-foreground mb-8">
          How we transform the Initial List into a ranked Longlist — deterministically, at scale.
        </p>

        {/* Overview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              The Longlist pipeline is a <strong className="text-foreground">fully deterministic</strong> process
              that uses only GitHub metadata — no LLM calls. This keeps it fast and cheap enough to
              process <strong className="text-foreground">16,000+ unique candidates</strong> in a single pass.
            </p>
            <p>
              The pipeline runs in 3 stages: Seeding, Hydration, and Scoring.
            </p>
          </CardContent>
        </Card>

        {/* Stage 1 */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Stage 1</Badge>
              <CardTitle className="text-lg">Seeding &amp; Deduplication</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              We extract every unique <code className="bg-muted px-1 rounded text-xs">owner_login</code> from
              the Initial List repos table. Each login becomes a candidate row in the longlist.
            </p>
            <p>
              <strong className="text-foreground">Cross-run deduplication:</strong> If a login was already
              processed in a previous Longlist run, it is skipped entirely. This means you can run
              new Initial List searches and only the <em>new</em> logins get processed.
            </p>
          </CardContent>
        </Card>

        {/* Stage 2 */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Stage 2</Badge>
              <CardTitle className="text-lg">Hydration &amp; Repo Selection</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              For each candidate, we fetch their <strong className="text-foreground">GitHub profile</strong> (bio,
              followers, location, company) and their <strong className="text-foreground">public repositories</strong>.
            </p>
            <p>
              From all their repos, we select up to <strong className="text-foreground">8 representative repos</strong>:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Top 4 by star count (popularity signal)</li>
              <li>Top 2 by most recent push (activity signal)</li>
              <li>Fill remaining slots from the rest</li>
            </ul>
            <p>
              Candidates are <strong className="text-foreground">discarded</strong> at this stage if they are
              an organization account, their profile is not found (404), or they have zero public repos.
            </p>
          </CardContent>
        </Card>

        {/* Stage 3 */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Stage 3</Badge>
              <CardTitle className="text-lg">Metadata Scoring</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Each candidate receives a deterministic <strong className="text-foreground">pre_score</strong> (0–100)
              computed from their GitHub metadata. No AI is involved — it's pure heuristic scoring.
            </p>
            <p>
              A <strong className="text-foreground">pre_confidence</strong> score (0–1) accompanies it, reflecting
              how much data was available to compute the score. Low confidence means sparse metadata.
            </p>
            <p>
              Candidates with a <strong className="text-foreground">pre_score between 70 and 82</strong> are
              selected for the Longlist. This is a pure score threshold — no tiers, no quotas.
            </p>
          </CardContent>
        </Card>

        {/* Scoring Breakdown */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Scoring Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {SCORING_FACTORS.map((s) => (
                <div
                  key={s.factor}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                >
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">{s.factor}</span>
                    {s.note && <span className="text-xs text-muted-foreground/60">{s.note}</span>}
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs shrink-0 ml-2">{s.points}</Badge>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Scores are capped at 100. The theoretical maximum with all signals is ~97. Tiered criteria (e.g. stars, followers) award the higher value only — they don't stack.
            </p>
          </CardContent>
        </Card>

        {/* Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Selection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Selection is <strong className="text-foreground">purely score-based</strong> and runs idempotently
              after scoring completes. Any candidate whose <code className="bg-muted px-1 rounded text-xs">pre_score</code> falls
              in the <strong className="text-foreground">70–82 range</strong> is selected for the Longlist.
            </p>
            <p>
              Candidates below 70 lack enough signal. Candidates above 82 are rare outliers that often
              indicate bot accounts or organisation profiles with inflated metrics. All non-selected
              candidates are marked as <strong className="text-foreground">discarded</strong>.
            </p>
          </CardContent>
        </Card>
    </div>
  );
}

export default function LonglistApproachPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <LonglistApproachContent />
    </div>
  );
}
