import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import RunsPage from "./pages/RunsPage";
import LeadsPage from "./pages/LeadsPage";
import LeadDetailPage from "./pages/LeadDetailPage";
import JobDescription from "./pages/JobDescription";
import LonglistPage from "./pages/LonglistPage";
import GlobalLonglistPage from "./pages/GlobalLonglistPage";
import LonglistRunsPage from "./pages/LonglistRunsPage";
import LonglistResultsPage from "./pages/LonglistResultsPage";
import ApproachPage from "./pages/ApproachPage";
import LonglistApproachPage from "./pages/LonglistApproachPage";
import ShortlistApproachPage from "./pages/ShortlistApproachPage";
import ShortlistRunsPage from "./pages/ShortlistRunsPage";
import PipelineRunsPage from "./pages/PipelineRunsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RunsPage />} />
          <Route path="/longlist" element={<GlobalLonglistPage />} />
          <Route path="/longlist-runs" element={<LonglistRunsPage />} />
          <Route path="/longlist-results" element={<LonglistResultsPage />} />
          <Route path="/shortlist" element={<LeadsPage />} />
          <Route path="/shortlist-runs" element={<ShortlistRunsPage />} />
          <Route path="/shortlist-approach" element={<ShortlistApproachPage />} />
          <Route path="/approach" element={<ApproachPage />} />
          <Route path="/longlist-approach" element={<LonglistApproachPage />} />
          <Route path="/runs/:runId/longlist" element={<LonglistPage />} />
          <Route path="/runs/:runId/leads" element={<LeadsPage />} />
          <Route path="/leads/:login" element={<LeadDetailPage />} />
          <Route path="/job" element={<JobDescription />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
