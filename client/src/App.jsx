import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Archive, LogIn, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { useAuth } from './auth.jsx';
import { useTheme } from './theme.js';
import Browse from './pages/Browse.jsx';
import Discover from './pages/Discover.jsx';
import Auth from './pages/Auth.jsx';
import Upload from './pages/Upload.jsx';
import Admin from './pages/Admin.jsx';

function NavLinks({ user }) {
  return (
    <>
      <NavLink to="/" end>Browse</NavLink>
      <NavLink to="/discover">Discover</NavLink>
      <NavLink to="/upload">Upload</NavLink>
      {user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
    </>
  );
}

function Nav() {
  const { user, logout } = useAuth();
  const [theme, toggleTheme] = useTheme();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className={`nav ${scrolled ? 'scrolled' : ''}`}>
      <Link to="/" className="logo">
        <span className="mark"><Archive size={18} strokeWidth={2.4} /></span>
        byteArchieve
      </Link>

      <nav className="links" aria-label="Main">
        <NavLinks user={user} />
      </nav>

      <div className="spacer" />

      <div className="nav-auth">
        {user ? (
          <>
            <span className="who">@{user.username}</span>
            <button className="btn ghost" onClick={logout}><LogOut size={16} /> Log out</button>
          </>
        ) : (
          <>
            <Link className="btn ghost" to="/login"><LogIn size={16} /> Log in</Link>
            <Link className="btn" to="/register">Sign up</Link>
          </>
        )}
      </div>

      <button
        type="button"
        className="icon-ghost"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <button
        type="button"
        className="icon-ghost menu-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="mobile-menu"
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>

      {open && (
        <div id="mobile-menu" className="mobile-menu">
          <NavLinks user={user} />
          <div className="sep-line" />
          {user ? (
            <>
              <span className="who">Signed in as @{user.username}</span>
              <button className="btn ghost" onClick={logout}><LogOut size={16} /> Log out</button>
            </>
          ) : (
            <>
              <Link className="btn ghost" to="/login"><LogIn size={16} /> Log in</Link>
              <Link className="btn" to="/register">Sign up</Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}

function Guard({ admin, children }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Nav />
      <main id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Browse />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/login"element={<Auth mode="login" />} />
          <Route path="/register" element={<Auth mode="register" />} />
          <Route path="/upload" element={<Guard><Upload /></Guard>} />
          <Route path="/admin" element={<Guard admin><Admin /></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
