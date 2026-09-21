import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { Factory } from 'lucide-react';
import TableScroll from '../components/TableScroll';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const { isAdmin } = useAuth();

  const loadSuppliers = async () => {
    const response = await api.get('/suppliers');
    setSuppliers(response.data);
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/suppliers', { name, contact });
      setName('');
      setContact('');
      loadSuppliers();
    } catch (err) {
      setError(err.response?.data?.error || "Échec de l'ajout du fournisseur");
    }
  };

  const handleEditSupplier = async (supplier) => {
    const newName = window.prompt('Nom du fournisseur :', supplier.name);
    if (newName === null) return;

    const newContact = window.prompt('Contact :', supplier.contact || '');
    if (newContact === null) return;

    try {
      await api.put(`/suppliers/${supplier.id}`, { name: newName, contact: newContact });
      loadSuppliers();
    } catch (err) {
      setError(err.response?.data?.error || 'Échec de la modification');
    }
  };

  const handleDelete = async (supplierId, supplierName) => {
    setError('');
    const confirmed = window.confirm(`Supprimer le fournisseur "${supplierName}" ?`);
    if (!confirmed) return;

    try {
      await api.delete(`/suppliers/${supplierId}`);
      loadSuppliers();
    } catch (err) {
      setError(err.response?.data?.error || 'Échec de la suppression');
    }
  };

  const filteredSuppliers = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Factory size={26} /> Fournisseurs
      </h1>

      <form className="card responsive-form" onSubmit={handleAddSupplier}>
        <h3>Ajouter un fournisseur</h3>
        <input
          className="form-input"
          placeholder="Nom du fournisseur"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />{' '}
        <input
          className="form-input"
          placeholder="Contact"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        />{' '}
        <button className="btn btn-primary" type="submit">Ajouter</button>
        {error && <p className="badge badge-danger">{error}</p>}
      </form>

      <h3>Fournisseurs actuels</h3>
      <input
        className="form-input"
        placeholder="Rechercher un fournisseur..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: '1rem', width: '250px' }}
      />

      <TableScroll>
      <table className="data-table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Contact</th>
            {isAdmin && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {filteredSuppliers.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{s.contact}</td>
              {isAdmin && (
                <td>
                  <button className="btn btn-secondary" onClick={() => handleEditSupplier(s)}>
                    Modifier
                  </button>{' '}
                  <button className="btn btn-danger" onClick={() => handleDelete(s.id, s.name)}>
                    Supprimer
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </TableScroll>
    </div>
  );
}
