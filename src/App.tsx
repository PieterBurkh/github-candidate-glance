import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import SourcingPage from "./pages/SourcingPage";
import LeadsPage from "./pages/LeadsPage";
import LeadDetailPage from "./pages/LeadDetailPage";
import JobDescription from "./pages/JobDescription";
import LonglistPage from "./pages/LonglistPage";
import GlobalLonglistPage from "./pages/GlobalLonglistPage";
import LonglistResultsPage from "./pages/LonglistResultsPage";
import ApproachOverviewPage from "./pages/ApproachOverviewPage";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/sourcing" replace />} />
          <Route path="/sourcing" element={<SourcingPage />} />
          <Route path="/longlist" element={<GlobalLonglistPage />} />
          <Route path="/longlist-results" element={<LonglistResultsPage />} />
          <Route path="/shortlist" element={<LeadsPage />} />
          <Route path="/approach" element={<ApproachOverviewPage />} />
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
