import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Archive, LogIn, LogOut } from 'lucide-react';
import { useAuth } from './auth.jsx';
import Browse from './pages/Browse.jsx';
import Auth from './pages/Auth.jsx';
import Upload from './pages/Upload.jsx';
import Admin from './pages/Admin.jsx';

function Nav() {
  const { user, logout } = useAuth();
  return (
    <header className="nav">
      <Link to="/" className="logo">
        <span className="mark"><Archive size={18} strokeWidth={2.4} /></span>
        byteArchieve
      </Link>
      <nav className="links">
        <NavLink to="/" end>Browse</NavLink>
        <NavLink to="/upload">Upload</NavLink>
        {user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
      </nav>
      <div className="spacer" />
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
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<Browse />} />
          <Route path="/login" element={<Auth mode="login" />} />
          <Route path="/register" element={<Auth mode="register" />} />
          <Route path="/upload" element={<Guard><Upload /></Guard>} />
          <Route path="/admin" element={<Guard admin><Admin /></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
