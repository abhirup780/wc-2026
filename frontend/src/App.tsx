import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
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

// ─── Theme toggle ─────────────────────────────────────────────────────────────

function IcoSun() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
function IcoMoon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

function ThemeToggle() {
  const [light, setLight] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('light'),
  );

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('light', light);
    try { localStorage.setItem('theme', light ? 'light' : 'dark'); } catch { /* ignore */ }
  }, [light]);

  return (
    <button
      onClick={() => setLight(v => !v)}
      aria-label={light ? 'Switch to dark theme' : 'Switch to light theme'}
      title={light ? 'Switch to dark theme' : 'Switch to light theme'}
      className="flex items-center justify-center w-9 h-9 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
    >
      <span className="w-[18px] h-[18px]">{light ? <IcoMoon /> : <IcoSun />}</span>
    </button>
  );
}

// ─── Mobile bottom nav ────────────────────────────────────────────────────────

function BottomNav() {
  return (
    <nav
      className="bottom-nav fixed bottom-0 left-0 right-0 sm:hidden z-20"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex h-16">
        {NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-semibold tracking-wide transition-colors relative ${
                isActive ? 'text-fifa-gold' : 'text-gray-400 active:text-gray-200'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute top-0 left-3 right-3 h-0.5 bg-fifa-gold rounded-b-sm" />
                )}
                <span className="w-[22px] h-[22px]"><Icon /></span>
                <span>{label}</span>
              </>
            )}
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
        'border-white/25 text-white/80 hover:border-white/50 hover:text-white disabled:opacity-50 disabled:cursor-wait'
      }`}
    >
      {state === 'running' && <SimSpinner />}
      {state === 'running' ? 'Running…' : state === 'done' ? 'Done' : state === 'error' ? 'Failed' : 'Run Simulation'}
    </button>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col">

        {/* Header */}
        <header
          className="sticky top-0 z-10"
          style={{
            background: 'linear-gradient(180deg, #002f72 0%, #002868 100%)',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div className="max-w-5xl mx-auto px-4">
            <div className="flex items-center gap-4 py-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <img
                  src="/icons/icon-192.png"
                  alt="FIFA World Cup 2026"
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-xl shrink-0 ring-1 ring-white/15 shadow-lg shadow-black/25"
                />
                <div className="min-w-0">
                  <h1 className="font-display text-xl font-bold tracking-tight text-white leading-tight">
                    <span className="text-fifa-gold">WC</span> 2026
                  </h1>
                  <p className="text-xs text-white/55 truncate">Live scores &amp; winner forecast</p>
                </div>
              </div>
              <RunSimButton />
              <ThemeToggle />
              {/* Desktop nav only */}
              <nav className="hidden sm:flex gap-1">
                {NAV.map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        isActive ? 'bg-fifa-gold text-fifa-navy' : 'text-white/75 hover:text-white hover:bg-white/10'
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
