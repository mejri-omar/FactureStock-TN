import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch {
      setError("Nom d'utilisateur ou mot de passe invalide");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page" style={styles.page}>
      <form className="login-card" style={styles.card} onSubmit={handleSubmit}>
        {searchParams.get('expired') === '1' && (
          <p style={{ color: '#C1443D', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Votre session a expiré, veuillez vous reconnecter.
          </p>
        )}
        <h1 style={styles.title}>Connexion</h1>
        <p style={styles.subtitle}>Accès réservé au personnel et aux administrateurs</p>

        <label style={styles.label}>Nom d'utilisateur</label>
        <input
          className="form-input"
          style={styles.input}
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />

        <label style={styles.label}>Mot de passe</label>
        <input
          className="form-input"
          style={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p style={styles.error}>{error}</p>}

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F6F7',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: '2.5rem',
    borderRadius: '8px',
    border: '1px solid #DADFE3',
    width: '320px',
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#1C1E21',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#6B7280',
    marginTop: '0.25rem',
    marginBottom: '1.5rem',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: 500,
    color: '#374151',
    marginBottom: '0.35rem',
  },
  input: {
    padding: '0.6rem 0.75rem',
    marginBottom: '1rem',
    border: '1px solid #DADFE3',
    borderRadius: '6px',
    fontSize: '0.95rem',
    outline: 'none',
  },
  button: {
    marginTop: '0.5rem',
    padding: '0.7rem',
    backgroundColor: '#1F6F5C',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    color: '#C1443D',
    fontSize: '0.85rem',
    marginBottom: '0.5rem',
  },
};
