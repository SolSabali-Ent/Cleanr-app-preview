import { Routes, Route } from "react-router-dom";
import BottomNav from "./navigation/BottomNav";
import ProtectedRoute from "./components/ProtectedRoute";

import TodayScreen from "./screens/TodayScreen";
import JobsScreen from "./screens/JobsScreen";
import JobDetailsScreen from "./screens/JobDetailsScreen";
import EarningsScreen from "./screens/EarningsScreen";
import ProfileScreen from "./screens/ProfileScreen";
import CalendarScreen from "./screens/CalendarScreen";
import AICheckScreen from "./screens/AICheckScreen";
import IncidentLogScreen from "./screens/IncidentLogScreen";

export default function ProviderApp() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-950 flex justify-center">
        {/* Mobile shell */}
        <div className="w-full max-w-md bg-slate-950 text-white relative flex flex-col pb-24">
          {/* Safe area top */}
          <div className="h-4" />

          {/* Content area */}
          <main className="flex-1 px-4 pb-4">
            <Routes>
              <Route path="/" element={<TodayScreen />} />
              <Route path="jobs" element={<JobsScreen />} />
              <Route path="jobs/:jobId" element={<JobDetailsScreen />} />
              <Route path="jobs/:jobId/ai-check" element={<AICheckScreen />} />
              <Route path="jobs/:jobId/incident" element={<IncidentLogScreen />} />
              <Route path="calendar" element={<CalendarScreen />} />
              <Route path="earnings" element={<EarningsScreen />} />
              <Route path="profile" element={<ProfileScreen />} />
            </Routes>
          </main>

          {/* Bottom Nav */}
          <BottomNav />
        </div>
      </div>
    </ProtectedRoute>
  );
}
