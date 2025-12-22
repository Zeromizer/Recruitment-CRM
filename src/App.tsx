import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Candidates from './pages/Candidates';
import CandidateDetail from './pages/CandidateDetail';
import Pipeline from './pages/Pipeline';
import Interviews from './pages/Interviews';
import Activities from './pages/Activities';
import Settings from './pages/Settings';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="candidates" element={<Candidates />} />
        <Route path="candidates/:id" element={<CandidateDetail />} />
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="interviews" element={<Interviews />} />
        <Route path="activities" element={<Activities />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;
