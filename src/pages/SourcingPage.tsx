import { NavBar } from "@/components/NavBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RunsContent } from "./RunsPage";
import { LonglistRunsContent } from "./LonglistRunsPage";
import { ShortlistRunsContent } from "./ShortlistRunsPage";

export default function SourcingPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
        <Tabs defaultValue="initial" className="w-full">
          <TabsList>
            <TabsTrigger value="initial">Initial List Runs</TabsTrigger>
            <TabsTrigger value="longlist">Longlist Runs</TabsTrigger>
            <TabsTrigger value="shortlist">Shortlist Runs</TabsTrigger>
          </TabsList>
          <TabsContent value="initial">
            <RunsContent />
          </TabsContent>
          <TabsContent value="longlist">
            <LonglistRunsContent />
          </TabsContent>
          <TabsContent value="shortlist">
            <ShortlistRunsContent />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
