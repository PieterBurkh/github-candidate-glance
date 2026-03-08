import { MapPin, Building, Clock, Briefcase, ExternalLink } from "lucide-react";
import { NavBar } from "@/components/NavBar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const JobDescription = () => {
  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Senior Frontend Engineer
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">HASH</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1">
              <MapPin className="h-3 w-3" /> London / Berlin
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Building className="h-3 w-3" /> In-person
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" /> Full-time
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Briefcase className="h-3 w-3" /> Engineering
            </Badge>
          </div>
          <div className="mt-4">
            <Button asChild size="sm" className="gap-1.5">
              <a
                href="https://jobs.gem.com/hash/am9icG9zdDqVU53q9bOz3ZiFAXRG99WL"
                target="_blank"
                rel="noopener noreferrer"
              >
                Apply on Gem <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-8 pb-16">
        {/* About HASH */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">About HASH</h2>
          <Card>
            <CardContent className="p-5 text-sm leading-relaxed text-muted-foreground space-y-3">
              <p>
                HASH's open-source platform helps firms integrate both structured and unstructured
                information into knowledge graphs that support simulating, optimizing and automating
                processes. Our mission is to solve information failure, and help everybody make the
                right decisions.
              </p>
              <p>
                To that end, we're unapologetically excited. Actions speak louder than words, and we
                measure performance by output. We prioritize speed, and measure product delivery
                timelines in hours and days, not months and years.
              </p>
              <p>
                We value high-energy, high-expectations people who do what they say and say what they
                mean. We're committed to building a high-commitment, high-trust environment, and
                believe that the best teams are most productive together, in-person. We're therefore
                currently hiring exclusively in both London (UK) and Berlin (Germany) to join the
                firm.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* About the Role */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">About the Role</h2>
          <Card>
            <CardContent className="p-5 text-sm leading-relaxed text-muted-foreground space-y-3">
              <p>
                We're a fast-growing deep-tech company crafting web-based tools that help people
                model, understand, and optimize real-world systems and processes using AI. From
                interactive process-model editors to real-time simulations, we turn complex,
                non-textual data into intuitive, responsive, accessible web apps designed to be used
                by non-technical domain experts at research labs, startups and enterprises worldwide.
              </p>
              <p>
                As a Senior Frontend Engineer you'll own end-to-end delivery of novel world modeling
                and AI native interface components, helping shape our frontend architecture, as part
                of an Advanced Research + Invention Agency funded project building systems for
                delivering "Safeguarded AI". You'll collaborate with technical product management, UX
                researchers and AI engineers from top labs, as well as our own developers and
                leadership, to push the boundaries of what a browser can do — whether that's a
                drag-and-drop model builder, timeline-based simulator, or multimodal feedback
                interface.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* What You'll Work On */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">What You'll Work On</h2>
          <Card>
            <CardContent className="p-5 text-sm leading-relaxed text-muted-foreground">
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  Design, build, and ship production-ready React/TypeScript components and app-wide
                  features for complex data-driven UIs
                </li>
                <li>
                  Work with mathematical experts to convert world-modeling theory formalizations into
                  software requirements, and writing tests which ensure implementation correctness
                </li>
                <li>
                  Convert novel UX/UI designs — for new world modeling and AI-interaction features —
                  into performant, responsive and accessible experiences that work across devices
                </li>
                <li>
                  Establish project-wide standards for code quality (e.g. via linting), review and
                  testing, and provide feedback on the work of other frontend engineers
                </li>
                <li>
                  Profile and optimize rendering performance for complex interactions and
                  visualisations
                </li>
                <li>
                  Tell the story of best practices and lessons learned in developing and testing
                  novel, complex world-modeling interfaces, e.g. via blog posts and workshops
                </li>
                <li>
                  Partner with backend/infra teams to identify and manage interdependencies, and to
                  help define robust APIs that support excellent, feature-rich frontend performance
                </li>
                <li>
                  Stay on top of emerging browser capabilities and drive adoption of the ones that
                  matter
                </li>
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* Requirements */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">Requirements</h2>
          <Card>
            <CardContent className="p-5 text-sm leading-relaxed text-muted-foreground space-y-4">
              <div>
                <h3 className="font-medium text-foreground mb-2">Must Have</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Expertise with React, TypeScript, modern HTML &amp; CSS</li>
                  <li>
                    Proven track record architecting and delivering rich web apps that involve
                    complex user interactions
                  </li>
                  <li>
                    Rigorous approach to documenting and versioning components for external audiences
                  </li>
                  <li>Experience profiling and debugging performance in devtools</li>
                  <li>
                    Comfortable taking a visible technical leadership role, mediating discussions
                    around standards and implementation approaches, and taking accountability for the
                    delivery of features on time and to spec
                  </li>
                  <li>
                    Excellent written &amp; verbal communication in English and comfort working async
                  </li>
                </ul>
              </div>
              <Separator />
              <div>
                <h3 className="font-medium text-foreground mb-2">Nice to Have</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    Familiarity with process/model-oriented UIs: BPMN, UML, systems-dynamics models,
                    graphs, etc.
                  </li>
                  <li>
                    Understanding of WCAG 2.2 and pragmatic accessibility techniques (ARIA, focus
                    management, keyboard UX)
                  </li>
                  <li>
                    Public record of maintaining a well-documented, semantically versioned library
                    (ideally in an open-source context)
                  </li>
                  <li>Experience with CRDTs or other real-time collaboration solutions</li>
                  <li>Hands-on experience with WebAssembly pipelines</li>
                  <li>Canvas/WebGL experience for high-performance rendering</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Benefits */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">Benefits</h2>
          <Card>
            <CardContent className="p-5 text-sm leading-relaxed text-muted-foreground">
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  Leading equity-weighted total compensation, including competitive salaries and
                  tax-advantaged options
                </li>
                <li>Employer pension contributions</li>
                <li>At least 30 days holiday annually</li>
                <li>Twice-yearly in-person team retreats around the world</li>
              </ul>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default JobDescription;
