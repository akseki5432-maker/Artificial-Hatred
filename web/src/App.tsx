import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { ProfileProvider, useProfile } from './lib/profile.tsx';
import Dashboard from './pages/Dashboard.tsx';
import Earn from './pages/Earn.tsx';
import Goals from './pages/Goals.tsx';
import Grow from './pages/Grow.tsx';
import Habits from './pages/Habits.tsx';
import Learn from './pages/Learn.tsx';
import Ledger from './pages/Ledger.tsx';
import Prices from './pages/Prices.tsx';
import Start from './pages/Start.tsx';

const NAV = [
  { to: '/', label: '🏠 My money', end: true },
  { to: '/goals', label: '🎯 Goals' },
  { to: '/grow', label: '🚀 Grow' },
  { to: '/habits', label: '🧋 Daily stuff' },
  { to: '/earn', label: '💪 Earn more' },
  { to: '/ledger', label: '📒 Log' },
  { to: '/learn', label: '📚 Learn' },
  { to: '/prices', label: '🏷️ Prices' },
];

function Shell() {
  const { profiles, profile, selectProfile, loading, error } = useProfile();
  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand">
            <span>🪙</span> PocketPilot
          </NavLink>
          {profiles.length > 0 && (
            <select aria-label="Who is using the app" value={profile?.id ?? ''} onChange={(e) => selectProfile(Number(e.target.value))} style={{ width: 'auto' }}>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <nav className="nav">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                {n.label}
              </NavLink>
            ))}
            <NavLink to="/start" className={({ isActive }) => (isActive ? 'active' : '')}>
              ➕ New kid
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="main">
        {error && (
          <div className="alert" style={{ marginBottom: 16 }}>
            Could not reach the PocketPilot server: {error}. Is it running?
          </div>
        )}
        <Routes>
          <Route path="/start" element={<Start />} />
          <Route path="/" element={<Guard loading={loading} ok={profile !== null} element={<Dashboard />} />} />
          <Route path="/goals" element={<Guard loading={loading} ok={profile !== null} element={<Goals />} />} />
          <Route path="/grow" element={<Guard loading={loading} ok={profile !== null} element={<Grow />} />} />
          <Route path="/habits" element={<Guard loading={loading} ok={profile !== null} element={<Habits />} />} />
          <Route path="/earn" element={<Guard loading={loading} ok={profile !== null} element={<Earn />} />} />
          <Route path="/ledger" element={<Guard loading={loading} ok={profile !== null} element={<Ledger />} />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/prices" element={<Prices />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function Guard({ loading, ok, element }: { loading: boolean; ok: boolean; element: React.ReactElement }) {
  if (loading && !ok) return <p className="muted">Loading…</p>;
  if (!ok) return <Navigate to="/start" replace />;
  return element;
}

export default function App() {
  return (
    <ProfileProvider>
      <Shell />
    </ProfileProvider>
  );
}
