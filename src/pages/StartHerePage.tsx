import { NavBar } from "@/components/NavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "react-router-dom";
import { AlertTriangle, ExternalLink } from "lucide-react";

export default function StartHerePage() {
  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-8">
        {/* Introduction */}
        <section className="space-y-3">
          <h1 className="text-2xl font-bold text-foreground">Welcome to the Hiring Tool</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This is the internal tool we developed in Hash to source the candidates for the position of{" "}
            <Link to="/job" className="text-primary font-medium hover:underline inline-flex items-center gap-1">
              Front-end Engineer <ExternalLink className="h-3 w-3" />
            </Link>.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            With this tool, you can do the following:
          </p>
          <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1 pl-1">
            <li>Review the current <Link to="/shortlist" className="text-primary font-medium hover:underline">Shortlist</Link> of candidates</li>
            <li>Add new candidates into the Shortlist</li>
          </ol>
        </section>

        {/* Shortlist Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              <Link to="/shortlist" className="hover:underline inline-flex items-center gap-1.5">
                Shortlist <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p>
              In the Shortlist, you see the candidates who were assessed by an LLM using our unique methodology—so you already see the best options.
            </p>
            <p className="font-medium text-foreground">Here you can do the following:</p>

            <div className="space-y-3 pl-1">
              <div>
                <p className="font-medium text-foreground">Review candidates and set their status</p>
                <p>
                  Status options are: <span className="font-medium">pending</span>, <span className="font-medium">shortlist</span>, <span className="font-medium">on hold</span>, <span className="font-medium">reject</span>.
                  This way you can track your pipeline.
                </p>
              </div>

              <div>
                <p className="font-medium text-foreground">Download the whole list</p>
                <p>You can download the full list and work on it offline.</p>
              </div>

              <div>
                <p className="font-medium text-foreground">Sort and review</p>
                <p>
                  You can sort by location and review status to make sure you're, for example, looking only into the people who were not rejected.
                </p>
              </div>

              <div>
                <p className="font-medium text-foreground">Open individual candidate cards</p>
                <p>On the individual card, you will have:</p>
                <ul className="list-disc list-inside pl-2 space-y-0.5 mt-1">
                  <li>The person's accounts</li>
                  <li>Name</li>
                  <li>The overall assessment</li>
                  <li>A more detailed assessment across criteria of must-have and nice to have</li>
                  <li>And very importantly: a <span className="font-medium text-foreground">personal communication message</span> that you can use to send the person this personal message</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sourcing Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              <Link to="/sourcing" className="hover:underline inline-flex items-center gap-1.5">
                Sourcing <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p>
              Next we have our Sourcing page. In order to add new candidates, you need to perform the following runs (in this order):
            </p>
            <ol className="list-decimal list-inside space-y-0.5 pl-1 font-medium text-foreground">
              <li>Initial List Run</li>
              <li>Long List Run</li>
              <li>Shortlist Run</li>
            </ol>

            <p className="font-medium text-foreground">What each run does:</p>

            <div className="space-y-3 pl-1">
              <div>
                <p className="font-medium text-foreground">Initial List Run</p>
                <p>Creates the first list of additional GitHub repositories to analyze.</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Long List Run</p>
                <p>
                  Runs through the new repositories you identified in the previous step and does the high-level assessment of them, to make sure we assess only the most relevant candidates.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Shortlist Run</p>
                <p>
                  Runs through those candidates starting with the highest rated. This is our AI-empowered assessment that looks more detailed into their code.
                </p>
              </div>
            </div>

            <p>
              Each of the runs can be started on the respective page. For more info visit{" "}
              <Link to="/approach" className="text-primary font-medium hover:underline inline-flex items-center gap-1">
                Sourcing Methodology <ExternalLink className="h-3 w-3" />
              </Link>.
            </p>
          </CardContent>
        </Card>

        {/* GitHub API Warning */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Important note on GitHub API limits</AlertTitle>
          <AlertDescription className="text-sm leading-relaxed">
            This search and re-listing uses GitHub APIs, and we have a maximum of 5,000 calls per hour. That's why, if at some point it stops, we probably need to wait some time before we can continue using the GitHub API.
          </AlertDescription>
        </Alert>

        {/* Footer */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          With this, I wish you a pleasant time with the tool, and I hope it is useful. You can contact <span className="font-medium text-foreground">Kamil</span> for questions.
        </p>
      </div>
    </div>
  );
}
