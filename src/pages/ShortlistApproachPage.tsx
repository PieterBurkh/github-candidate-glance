import { NavBar } from "@/components/NavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const MUST_HAVES = [
  { criterion: "React + TypeScript + modern HTML/CSS", strong: "Production React app with strict TS, semantic HTML, CSS modules or Tailwind", weak: "Tutorial-style todo app with any types" },
  { criterion: "Architecting rich apps with complex interactions", strong: "State machines, optimistic updates, complex forms, drag-and-drop", weak: "Simple CRUD with basic useState" },
  { criterion: "Documentation + versioning for external audiences", strong: "Versioned README, CHANGELOG, API docs, migration guides", weak: "Auto-generated docs only, no changelog" },
  { criterion: "Performance profiling / debugging", strong: "Lighthouse configs, bundle analysis, React.memo usage with comments, lazy loading", weak: "No evidence of performance consideration" },
  { criterion: "Technical leadership + standards mediation", strong: "RFC/ADR documents, PR reviews with architectural feedback, ESLint/Prettier configs", weak: "Solo contributor, no evidence of team standards" },
  { criterion: "English communication + async comfort", strong: "Clear PR descriptions, issue discussions, README prose in fluent English", weak: "Minimal or non-English communication" },
];

const NICE_TO_HAVES = [
  { criterion: "Process/model-oriented UIs (BPMN/UML/graphs)", strong: "Graph editor, flowchart builder, node-based UI", weak: "Simple list/table UIs only" },
  { criterion: "WCAG 2.2 + pragmatic accessibility", strong: "aria-* attributes, keyboard navigation, a11y test configs", weak: "No accessibility consideration" },
  { criterion: "Maintaining a semver library", strong: "Published npm package with semver releases, deprecation notices", weak: "No library maintenance evidence" },
  { criterion: "CRDTs / real-time collaboration", strong: "Yjs/Automerge usage, WebSocket sync, conflict resolution logic", weak: "No real-time features" },
  { criterion: "WebAssembly pipelines", strong: "WASM modules compiled from Rust/C++, wasm-pack configs", weak: "No WASM usage" },
  { criterion: "Canvas / WebGL", strong: "Custom canvas rendering, Three.js/PixiJS, WebGL shaders", weak: "No canvas/WebGL usage" },
];

export function ShortlistApproachContent() {
  return (
    <div className="mx-auto max-w-4xl py-8">
      <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">Shortlist Approach</h1>
        <p className="text-muted-foreground mb-8">
          How we evaluate Longlist candidates using LLM-powered evidence packs — person-centric, not repo-centric.
        </p>

        {/* Overview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              The Shortlist pipeline is a <strong className="text-foreground">person-centric LLM evaluation</strong> of
              exploit/explore candidates from the Longlist. Unlike the deterministic Longlist scoring, this stage
              uses <strong className="text-foreground">Gemini</strong> to assess each candidate against a 12-criterion rubric.
            </p>
            <p>
              We don't send full codebases. Instead, we assemble compact <strong className="text-foreground">evidence packs</strong> from
              up to 4 representative repos per candidate — enough signal for reliable scoring without excessive token usage.
            </p>
          </CardContent>
        </Card>

        {/* Stage 1 */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Stage 1</Badge>
              <CardTitle className="text-lg">Evidence Pack Assembly</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              For each candidate, we select up to <strong className="text-foreground">4 representative repos</strong> using these rules:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-foreground">Pinned repos</strong> — profile-pinned or top-starred owned repos</li>
              <li><strong className="text-foreground">Most recently pushed</strong> — activity signal</li>
              <li><strong className="text-foreground">Most maintained</strong> — has releases + CI + tests</li>
              <li><strong className="text-foreground">Contributed repo</strong> — PR in an org repo (if available)</li>
            </ul>
            <p className="mt-3">Per repo, we collect these artifacts (compact, not full source):</p>
            <div className="grid gap-2 mt-2">
              {[
                { artifact: "README.md", detail: "First ~4k chars + sections matching Features/Architecture/Performance/Docs/Accessibility" },
                { artifact: "package.json", detail: "dependencies + devDependencies only" },
                { artifact: "tsconfig.json", detail: "strict-related flags only" },
                { artifact: "CHANGELOG.md", detail: "Header + last 2 release entries" },
                { artifact: "Presence flags", detail: "Boolean: .storybook/, .github/workflows/, test dirs" },
                { artifact: "Releases/tags", detail: "Semver count + last release date" },
                { artifact: "PR/issue samples", detail: "Max 3 threads with keywords (perf, RFC, ADR, migration, lighthouse)" },
              ].map((a) => (
                <div key={a.artifact} className="flex items-start gap-3 rounded-md border border-border px-3 py-2">
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono whitespace-nowrap">{a.artifact}</code>
                  <span className="text-xs">{a.detail}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Stage 2 */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Stage 2</Badge>
              <CardTitle className="text-lg">LLM Scoring</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              A single <strong className="text-foreground">Gemini call per candidate</strong> evaluates all 12 criteria
              using a structured tool_call response. Each sub-criterion is scored on a 5-point scale:
            </p>
            <div className="grid grid-cols-5 gap-2 mt-2">
              {[
                { score: "0.00", label: "No evidence" },
                { score: "0.25", label: "Weak mention" },
                { score: "0.50", label: "Clear, limited depth" },
                { score: "0.75", label: "Strong across 2+ artifacts" },
                { score: "1.00", label: "Exceptional, production-grade" },
              ].map((s) => (
                <div key={s.score} className="rounded-md border border-border p-2 text-center">
                  <div className="font-mono text-sm font-semibold text-foreground">{s.score}</div>
                  <div className="text-[10px] mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Must-haves */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge className="text-xs">80% weight</Badge>
              <CardTitle className="text-lg">Must-haves (6 criteria)</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {MUST_HAVES.map((m, i) => (
                <div key={i} className="rounded-md border border-border p-3">
                  <div className="font-medium text-sm text-foreground mb-1.5">{i + 1}. {m.criterion}</div>
                  <div className="grid sm:grid-cols-2 gap-2 text-xs">
                    <div className="flex gap-1.5">
                      <Badge variant="default" className="text-[9px] shrink-0">Strong</Badge>
                      <span className="text-muted-foreground">{m.strong}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <Badge variant="outline" className="text-[9px] shrink-0">Weak</Badge>
                      <span className="text-muted-foreground">{m.weak}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Nice-to-haves */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">20% weight</Badge>
              <CardTitle className="text-lg">Nice-to-haves (6 criteria)</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {NICE_TO_HAVES.map((n, i) => (
                <div key={i} className="rounded-md border border-border p-3">
                  <div className="font-medium text-sm text-foreground mb-1.5">{i + 1}. {n.criterion}</div>
                  <div className="grid sm:grid-cols-2 gap-2 text-xs">
                    <div className="flex gap-1.5">
                      <Badge variant="default" className="text-[9px] shrink-0">Strong</Badge>
                      <span className="text-muted-foreground">{n.strong}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <Badge variant="outline" className="text-[9px] shrink-0">Weak</Badge>
                      <span className="text-muted-foreground">{n.weak}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Scoring Formula */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Scoring Formula &amp; Decision Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-md bg-muted p-4 font-mono text-xs">
              overall_pct = round(100 × (0.80 × must_haves_avg + 0.20 × nice_haves_avg))
            </div>
            <div className="grid gap-3 sm:grid-cols-3 mt-3">
              <div className="rounded-md border border-border p-3">
                <Badge className="text-[10px] mb-1.5">SHORTLIST</Badge>
                <p className="text-xs">overall_pct ≥ 65 AND must_haves_avg ≥ 0.60</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <Badge variant="secondary" className="text-[10px] mb-1.5">NEEDS REVIEW</Badge>
                <p className="text-xs">overall_pct ≥ 65 AND must_haves_avg &lt; 0.60</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <Badge variant="outline" className="text-[10px] mb-1.5">NO</Badge>
                <p className="text-xs">overall_pct &lt; 65</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Anti-gaming */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Anti-gaming Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li><strong className="text-foreground">Template repos:</strong> Downweight repos created from templates (detected via GitHub API flag)</li>
              <li><strong className="text-foreground">Tutorial/demo repos:</strong> Repos with names like "tutorial", "demo", "example", "course" receive reduced weight</li>
              <li><strong className="text-foreground">Forks without contribution:</strong> Forks are only counted if the candidate has unique commits beyond the upstream</li>
              <li><strong className="text-foreground">Stars/forks as context only:</strong> These are never the primary reason for a high score — they provide context but not evidence of skill</li>
            </ul>
          </CardContent>
        </Card>
    </div>
  );
}

export default function ShortlistApproachPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <ShortlistApproachContent />
    </div>
  );
}
