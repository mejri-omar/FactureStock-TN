import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>Bienvenue, {user?.username}</h1>
      <p>Rôle: {user?.role === 'admin' ? 'Administrateur' : user?.role === 'staff' ? 'Personnel' : user?.role}</p>
      <button onClick={logout} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
        Déconnexion
      </button>
    </div>
  );
}
