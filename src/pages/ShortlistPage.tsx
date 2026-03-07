import { NavBar } from "@/components/NavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListFilter } from "lucide-react";

export default function ShortlistPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">Shortlist</h1>
        <p className="text-muted-foreground mb-8">
          Curated candidates ready for outreach.
        </p>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ListFilter className="h-5 w-5 text-muted-foreground" />
              Coming Soon
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              The shortlist will contain top-ranked candidates selected from the enriched leads.
              You'll be able to review profiles, compare scores, and export contacts for outreach.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
