import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useState } from 'react';
import LiveScores from './components/LiveScores.tsx';
import Groups from './components/Groups.tsx';
import Forecast from './components/Forecast.tsx';
import Prediction from './components/Prediction.tsx';
import Footer from './components/Footer.tsx';

// ─── Nav icons ────────────────────────────────────────────────────────────────

function IcoScores() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 7v5l3 3"/>
    </svg>
  );
}
function IcoGroups() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/>
      <rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/>
      <rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  );
}
function IcoForecast() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  );
}
function IcoSimulate() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <rect x="2" y="2" width="20" height="20" rx="3"/>
      <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none"/>
      <circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" stroke="none"/>
      <circle cx="12"   cy="12"  r="1.2" fill="currentColor" stroke="none"/>
      <circle cx="8.5"  cy="15.5" r="1.2" fill="currentColor" stroke="none"/>
      <circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" stroke="none"/>
    </svg>
  );
}

const NAV = [
  { to: '/scores',     label: 'Scores',   Icon: IcoScores   },
  { to: '/groups',     label: 'Groups',   Icon: IcoGroups   },
  { to: '/forecast',   label: 'Forecast', Icon: IcoForecast },
  { to: '/prediction', label: 'Simulate', Icon: IcoSimulate },
];

// ─── Mobile bottom nav ────────────────────────────────────────────────────────

function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 sm:hidden z-20"
      style={{
        background: 'rgba(3,7,18,0.96)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex h-16">
        {NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-semibold tracking-wide transition-colors ${
                isActive ? 'text-fifa-gold' : 'text-gray-600 active:text-gray-300'
              }`
            }
          >
            <span className="w-[22px] h-[22px]"><Icon /></span>
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

// ─── Desktop run-sim button ───────────────────────────────────────────────────

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
        'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200 disabled:opacity-50 disabled:cursor-wait'
      }`}
    >
      {state === 'running' && <SimSpinner />}
      {state === 'running' ? 'Running…' : state === 'done' ? '✓ Done' : state === 'error' ? '✗ Failed' : '⟳ Run Simulation'}
    </button>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col">

        {/* Header */}
        <header className="bg-fifa-navy border-b border-gray-800 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4">
            <div className="flex items-center gap-4 py-3">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold tracking-tight text-white">
                  <span className="text-fifa-gold">WC</span> 2026
                </h1>
                <p className="text-xs text-gray-400 hidden sm:block">Live scores & winner forecast</p>
              </div>
              <RunSimButton />
              {/* Desktop nav only */}
              <nav className="hidden sm:flex gap-1">
                {NAV.map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        isActive ? 'bg-fifa-gold text-fifa-navy' : 'text-gray-300 hover:text-white hover:bg-gray-800'
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

        {/* Main — extra bottom padding on mobile for bottom nav */}
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 pt-5 pb-24 sm:pb-8">
          <Routes>
            <Route path="/" element={<Navigate to="/scores" replace />} />
            <Route path="/scores"     element={<LiveScores />} />
            <Route path="/groups"     element={<Groups />} />
            <Route path="/forecast"   element={<Forecast />} />
            <Route path="/prediction" element={<Prediction />} />
          </Routes>
        </main>

        <Footer />
        <BottomNav />
      </div>
    </HashRouter>
  );
}
