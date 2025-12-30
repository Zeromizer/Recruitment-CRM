import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Candidates from './pages/Candidates';
import CandidateDetail from './pages/CandidateDetail';
import Pipeline from './pages/Pipeline';
import Interviews from './pages/Interviews';
import Activities from './pages/Activities';
import BotConfig from './pages/BotConfig';
import JobScoring from './pages/JobScoring';
import Settings from './pages/Settings';
import { useRealtimeSubscription } from './hooks/useData';

// OAuth callback component - redirects to settings with query params preserved
function AuthCallback() {
  // The query params (code) are preserved during redirect
  // Settings page handles the OAuth callback
  return <Navigate to={`/settings${window.location.search}`} replace />;
}

function App() {
  // Enable realtime updates from Supabase
  useRealtimeSubscription();

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="candidates" element={<Candidates />} />
        <Route path="candidates/:id" element={<CandidateDetail />} />
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="interviews" element={<Interviews />} />
        <Route path="activities" element={<Activities />} />
        <Route path="bot-config" element={<BotConfig />} />
        <Route path="job-scoring" element={<JobScoring />} />
        <Route path="settings" element={<Settings />} />
        <Route path="auth/callback" element={<AuthCallback />} />
      </Route>
    </Routes>
  );
}

export default App;
