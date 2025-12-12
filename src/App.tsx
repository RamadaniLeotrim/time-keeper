import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CalendarPage from './pages/CalendarPage';
import CalculatorPage from './pages/CalculatorPage';
import Settings from './pages/Settings';
import DebugPage from './pages/DebugPage';
// Placeholder for now

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="calculator" element={<CalculatorPage />} />
          <Route path="settings" element={<Settings />} />
          <Route path="debug" element={<DebugPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
