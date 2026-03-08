import { NavBar } from "@/components/NavBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApproachContent } from "./ApproachPage";
import { LonglistApproachContent } from "./LonglistApproachPage";
import { ShortlistApproachContent } from "./ShortlistApproachPage";

export default function ApproachOverviewPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
        <Tabs defaultValue="initial" className="w-full">
          <TabsList>
            <TabsTrigger value="initial">Initial List</TabsTrigger>
            <TabsTrigger value="longlist">Longlist</TabsTrigger>
            <TabsTrigger value="shortlist">Shortlist</TabsTrigger>
          </TabsList>
          <TabsContent value="initial">
            <ApproachContent />
          </TabsContent>
          <TabsContent value="longlist">
            <LonglistApproachContent />
          </TabsContent>
          <TabsContent value="shortlist">
            <ShortlistApproachContent />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
