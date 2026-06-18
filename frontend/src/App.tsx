import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useState } from 'react';
import LiveScores from './components/LiveScores.tsx';
import Groups from './components/Groups.tsx';
import Forecast from './components/Forecast.tsx';
import Bracket from './components/Bracket.tsx';
import Prediction from './components/Prediction.tsx';
import Footer from './components/Footer.tsx';

const NAV = [
  { to: '/scores', label: 'Live Scores' },
  { to: '/groups', label: 'Groups' },
  { to: '/forecast', label: 'Forecast' },
  { to: '/bracket', label: 'Bracket' },
  { to: '/prediction', label: 'Best Guess' },
];

function SimSpinner() {
  return (
    <svg className="animate-spin" style={{ width: 14, height: 14 }} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function RunSimButton() {
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  if (import.meta.env.PROD) return null;

  async function run() {
    setState('running');
    try {
      const res = await fetch('/api/simulate', { method: 'POST' });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
    setTimeout(() => setState('idle'), 3000);
  }

  return (
    <button
      onClick={run}
      disabled={state === 'running'}
      className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors border ${
        state === 'done'  ? 'border-green-500 text-green-400' :
        state === 'error' ? 'border-red-500 text-red-400' :
        'border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200 disabled:opacity-50 disabled:cursor-wait'
      }`}
    >
      {state === 'running' && <SimSpinner />}
      {state === 'running' ? 'Running…' : state === 'done' ? '✓ Done' : state === 'error' ? '✗ Failed' : '⟳ Run Simulation'}
    </button>
  );
}

export default function App() {
  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="bg-fifa-navy border-b border-gray-800 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4">
            <div className="flex items-center gap-4 py-3">
              <div className="flex-1">
                <h1 className="text-xl font-bold tracking-tight text-white">
                  <span className="text-fifa-gold">WC</span> 2026
                </h1>
                <p className="text-xs text-gray-400 hidden sm:block">Live scores & championship forecast</p>
              </div>
              <RunSimButton />
              <nav className="flex gap-1">
                {NAV.map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-fifa-gold text-fifa-navy'
                          : 'text-gray-300 hover:text-white hover:bg-gray-800'
                      }`
                    }
                  >
                    {label}
                  </NavLink>
                ))}
              </nav>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
          <Routes>
            <Route path="/" element={<Navigate to="/scores" replace />} />
            <Route path="/scores" element={<LiveScores />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/forecast" element={<Forecast />} />
            <Route path="/bracket" element={<Bracket />} />
            <Route path="/prediction" element={<Prediction />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </HashRouter>
  );
}
