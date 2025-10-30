import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from '@/pages/LandingPage';
import SignUpPage from '@/pages/SignUpPage';
import VoicePreferencesPage from '@/pages/VoicePreferencesPage';
import AgentSettingsPage from '@/pages/AgentSettingsPage';
import SquareOAuthStatusPage from '@/pages/SquareOAuthStatusPage';
import PhoneNumberChoicePage from '@/pages/PhoneNumberChoicePage';
import ConfirmationPage from '@/pages/ConfirmationPage';
import DashboardLayout from '@/pages/DashboardLayout';
import DashboardOverviewPage from '@/pages/DashboardOverviewPage';
import BookingsPage from '@/pages/BookingsPage';
import AICallsPage from '@/pages/AICallsPage';
import AgentDashboardPage from '@/pages/AgentDashboardPage';

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage theme={theme} onToggleTheme={toggleTheme} />} />
        <Route path="/signup" element={<SignUpPage theme={theme} onToggleTheme={toggleTheme} />} />
        <Route
          path="/voice-preferences"
          element={<VoicePreferencesPage theme={theme} onToggleTheme={toggleTheme} />}
        />
        <Route
          path="/agent-settings"
          element={<AgentSettingsPage theme={theme} onToggleTheme={toggleTheme} />}
        />
        <Route
          path="/square-oauth"
          element={<SquareOAuthStatusPage theme={theme} onToggleTheme={toggleTheme} />}
        />
        <Route
          path="/phone-number-choice"
          element={<PhoneNumberChoicePage theme={theme} onToggleTheme={toggleTheme} />}
        />
        <Route
          path="/confirmation"
          element={<ConfirmationPage theme={theme} onToggleTheme={toggleTheme} />}
        />

        {/* Dashboard Routes */}
        <Route path="/dashboard" element={<DashboardLayout theme={theme} onToggleTheme={toggleTheme} />}>
          <Route index element={<DashboardOverviewPage />} />
          <Route path="bookings" element={<BookingsPage />} />
          <Route path="calls" element={<AICallsPage />} />
          <Route path="agent" element={<AgentDashboardPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
