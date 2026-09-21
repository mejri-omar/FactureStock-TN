import { useState, useEffect } from 'react';
import api from '../api';
import { KeyRound, ShieldCheck, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import TableScroll from '../components/TableScroll';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('staff');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [passwordUser, setPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const { user: currentUser } = useAuth();

  const loadUsers = async () => {
    const response = await api.get('/users');
    setUsers(response.data);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    try {
      await api.post('/users', { username, password, role });
      setSuccessMessage(`Compte "${username}" créé avec succès`);
      setUsername('');
      setPassword('');
      setRole('staff');
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || "Échec de la création du compte");
    }
  };

  const closePasswordModal = () => {
    setPasswordUser(null);
    setNewPassword('');
    setPasswordError('');
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setPasswordError('');

    try {
      await api.put(`/users/${passwordUser.id}/password`, { new_password: newPassword });
      setSuccessMessage(`Mot de passe de "${passwordUser.username}" mis à jour`);
      closePasswordModal();
    } catch (err) {
      setPasswordError(err.response?.data?.error || 'Échec de la mise à jour du mot de passe');
    }
  };

  const handleDeleteUser = async (account) => {
    setError('');
    setSuccessMessage('');

    if (!window.confirm(`Supprimer définitivement le compte "${account.username}" ?`)) {
      return;
    }

    try {
      await api.delete(`/users/${account.id}`);
      setSuccessMessage(`Compte "${account.username}" supprimé`);
      loadUsers();
    } catch (err) {
      setError(
        err.response?.data?.error ||
        (err.request
          ? 'Impossible de joindre le serveur. Vérifiez que le backend fonctionne sur le port 3000.'
          : 'Échec de la suppression du compte')
      );
    }
  };

  return (
    <div>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <ShieldCheck size={26} />
        Utilisateurs
      </h1>

      <form className="card responsive-form" onSubmit={handleCreateUser}>
        <h3>Créer un compte</h3>
        <input
          className="form-input"
          placeholder="Nom d'utilisateur"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />{' '}
        <input
          className="form-input"
          placeholder="Mot de passe"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />{' '}
        <select className="form-input" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="staff">Personnel</option>
          <option value="admin">Administrateur</option>
        </select>{' '}
        <button className="btn btn-primary" type="submit">Créer</button>
        {error && <p className="badge badge-danger">{error}</p>}
        {successMessage && <p className="badge badge-success">{successMessage}</p>}
      </form>

      <h3>Comptes existants</h3>
      <TableScroll>
      <table className="data-table">
        <thead>
          <tr>
            <th>Nom d'utilisateur</th>
            <th>Rôle</th>
            <th>Créé le</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.username}</td>
              <td>
                <span className="badge badge-neutral">
                  {u.role === 'admin' ? 'Administrateur' : 'Personnel'}
                </span>
              </td>
              <td>{new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
              <td className="user-actions">
                <button className="btn btn-secondary" type="button" onClick={() => setPasswordUser(u)}>
                  <KeyRound size={16} aria-hidden="true" />
                  Mot de passe
                </button>
                {u.id !== currentUser?.id && (
                  <button className="btn btn-danger" type="button" onClick={() => handleDeleteUser(u)}>
                    <Trash2 size={16} aria-hidden="true" />
                    Supprimer
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </TableScroll>

      {passwordUser && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-content responsive-form" onSubmit={handlePasswordReset}>
            <div className="modal-title-row">
              <h3>Modifier le mot de passe</h3>
              <button className="icon-button" type="button" onClick={closePasswordModal} aria-label="Fermer">
                <X size={20} />
              </button>
            </div>
            <p>Compte : <strong>{passwordUser.username}</strong></p>
            <input
              className="form-input"
              type="password"
              placeholder="Nouveau mot de passe"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength="6"
              autoFocus
              required
            />
            {passwordError && <p className="badge badge-danger">{passwordError}</p>}
            <div className="modal-actions">
              <button className="btn btn-primary" type="submit">Enregistrer</button>
              <button className="btn btn-secondary" type="button" onClick={closePasswordModal}>Annuler</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
