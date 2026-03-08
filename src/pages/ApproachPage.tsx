import { NavBar } from "@/components/NavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const NETS = [
  { key: "core-stack", label: "Core Stack", desc: "React, TypeScript, Next.js — the foundational technologies we're hiring for." },
  { key: "meta-frameworks", label: "Meta-frameworks", desc: "Remix, Astro, SvelteKit adapters — shows breadth beyond the obvious." },
  { key: "component-libs", label: "Component Libs", desc: "Design systems, UI kits, Storybook — signals strong component architecture skills." },
  { key: "versioning", label: "Versioning", desc: "Semantic-release, changesets, monorepo tooling — indicates mature engineering practices." },
  { key: "performance", label: "Performance", desc: "Lighthouse, bundle analysis, Core Web Vitals — performance-aware engineers." },
  { key: "a11y", label: "Accessibility", desc: "ARIA patterns, screen reader testing, WCAG — inclusive-first mindset." },
  { key: "complex-ui", label: "Complex UI", desc: "Drag-and-drop, virtualized lists, canvas — handles hard UI problems." },
  { key: "crdt-realtime", label: "CRDT / Realtime", desc: "Yjs, Automerge, WebSocket collaboration — cutting-edge multiplayer patterns." },
  { key: "wasm", label: "WASM", desc: "WebAssembly, Rust-to-web — pushes browser performance boundaries." },
];

export function ApproachContent() {
  return (
    <div className="mx-auto max-w-4xl py-8">
      <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">Initial List Approach</h1>
        <p className="text-muted-foreground mb-8">
          How we systematically discover high-signal open-source contributors.
        </p>

        {/* Strategy overview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Net-Based Search Strategy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Instead of a single broad query, we cast <strong className="text-foreground">9 specialised nets</strong> — each
              targeting a distinct skill domain. Every net searches GitHub for repositories whose
              <code className="bg-muted px-1 rounded text-xs">README</code> mentions relevant keywords
              (using <code className="bg-muted px-1 rounded text-xs">in:readme</code>), which catches
              projects that lack proper topic tags.
            </p>
            <p>
              Each net runs with <strong className="text-foreground">star banding</strong>: we query
              multiple star ranges (e.g. 50–200, 200–1000, 1000+) to avoid giant-project bias where
              mega-popular repos drown out excellent mid-tier work.
            </p>
            <p>
              Within each band, results are fetched twice — once sorted by <strong className="text-foreground">stars</strong> (popularity)
              and once by <strong className="text-foreground">recently updated</strong> (activity). This dual-sort ensures we
              surface both established projects and actively-maintained ones.
            </p>
          </CardContent>
        </Card>

        {/* The 9 Nets */}
        <h2 className="text-lg font-semibold text-foreground mb-3">The 9 Nets</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          {NETS.map((net) => (
            <Card key={net.key} className="flex flex-col">
              <CardHeader className="pb-2">
                <Badge variant="secondary" className="w-fit text-xs">{net.label}</Badge>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground flex-1">
                {net.desc}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Dedup & Pipeline */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Deduplication & Merging</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Because nets overlap, the same repository may appear in multiple searches. We
              deduplicate by <code className="bg-muted px-1 rounded text-xs">full_name</code> and
              merge the <strong className="text-foreground">matched_nets</strong> arrays — a repo
              matching 4+ nets is a stronger signal than one matching only 1.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What Comes Next</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Enrichment:</strong> Each repo is analysed by an LLM against
              scoring criteria (code quality, contribution patterns, complexity of work). This produces
              per-repo signal scores and links the repo's owner to a <em>Person</em> record.
            </p>
            <p>
              <strong className="text-foreground">Shortlist:</strong> People are ranked by aggregated scores
              across all their repos. The top candidates form the shortlist for outreach.
            </p>
          </CardContent>
      </Card>
    </div>
  );
}

export default function ApproachPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <ApproachContent />
    </div>
  );
}
