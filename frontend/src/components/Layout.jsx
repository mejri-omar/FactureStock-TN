import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ShoppingCart,
  Package,
  Truck,
  Factory,
  Users as UsersIcon,
  History,
  FileText,
  BarChart3,
  ShieldCheck,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const [navigationOpen, setNavigationOpen] = useState(false);

  const linkClass = ({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '');
  const closeNavigation = () => setNavigationOpen(false);

  return (
    <div className="app-shell">
      <button
        type="button"
        className="mobile-menu-button"
        onClick={() => setNavigationOpen((open) => !open)}
        aria-label={navigationOpen ? 'Fermer la navigation' : 'Ouvrir la navigation'}
        aria-expanded={navigationOpen}
      >
        {navigationOpen ? <X size={22} /> : <Menu size={22} />}
      </button>
      <nav className={`sidebar ${navigationOpen ? 'sidebar-open' : ''}`} aria-label="Navigation principale">
        <button type="button" className="sidebar-close-button" onClick={closeNavigation} aria-label="Fermer la navigation">
          <X size={20} />
        </button>
        <div className="sidebar-user">
          <div className="sidebar-user-name">{user?.username}</div>
          <div className="sidebar-user-role">
            {user?.role === 'admin' ? 'Administrateur' : 'Personnel'}
          </div>
        </div>

        <ul className="sidebar-nav">
          <li>
            <NavLink to="/" end className={linkClass} onClick={closeNavigation}>
              <ShoppingCart size={18} /> Caisse
            </NavLink>
          </li>
          <li>
            <NavLink to="/inventory" className={linkClass} onClick={closeNavigation}>
              <Package size={18} /> Inventaire
            </NavLink>
          </li>
          <li>
            <NavLink to="/deliveries" className={linkClass} onClick={closeNavigation}>
              <Truck size={18} /> Livraisons
            </NavLink>
          </li>
          <li>
            <NavLink to="/suppliers" className={linkClass} onClick={closeNavigation}>
              <Factory size={18} /> Fournisseurs
            </NavLink>
          </li>
          <li>
            <NavLink to="/customers" className={linkClass} onClick={closeNavigation}>
              <UsersIcon size={18} /> Clients
            </NavLink>
          </li>
          <li>
            <NavLink to="/sales-history" className={linkClass} onClick={closeNavigation}>
              <History size={18} /> Historique des ventes
            </NavLink>
          </li>
          <li>
            <NavLink to="/invoices" end className={linkClass} onClick={closeNavigation}>
              <FileText size={18} /> Factures
            </NavLink>
          </li>
          <li>
            <NavLink to="/invoices/report" end className={linkClass} onClick={closeNavigation}>
              <BarChart3 size={18} /> Rapport Annuel
            </NavLink>
          </li>
          {isAdmin && (
            <li>
              <NavLink to="/users" className={linkClass} onClick={closeNavigation}>
                <ShieldCheck size={18} /> Utilisateurs
              </NavLink>
            </li>
          )}
        </ul>

        <button onClick={() => { closeNavigation(); logout(); }} className="btn btn-secondary sidebar-logout">
          <LogOut size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
          Déconnexion
        </button>
      </nav>
      {navigationOpen && <button type="button" className="sidebar-backdrop" onClick={closeNavigation} aria-label="Fermer la navigation" />}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
