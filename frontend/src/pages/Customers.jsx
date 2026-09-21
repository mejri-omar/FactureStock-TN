import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { Users } from 'lucide-react';
import TableScroll from '../components/TableScroll';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [address, setAddress] = useState('');
  const [matriculeFiscal, setMatriculeFiscal] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const { isAdmin } = useAuth();

  const loadCustomers = async () => {
    const response = await api.get('/customers');
    setCustomers(response.data);
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/customers', { name, contact, address, matricule_fiscal: matriculeFiscal });
      setName('');
      setContact('');
      setAddress('');
      setMatriculeFiscal('');
      loadCustomers();
    } catch (err) {
      setError(err.response?.data?.error || "Échec de l'ajout du client");
    }
  };

  const handleEditCustomer = async (customer) => {
    const newName = window.prompt('Nom :', customer.name);
    if (newName === null) return;

    const newContact = window.prompt('Contact :', customer.contact || '');
    if (newContact === null) return;

    const newAddress = window.prompt('Adresse :', customer.address || '');
    if (newAddress === null) return;

    const newMatricule = window.prompt('Matricule fiscal :', customer.matricule_fiscal || '');
    if (newMatricule === null) return;

    try {
      await api.put(`/customers/${customer.id}`, {
        name: newName,
        contact: newContact,
        address: newAddress,
        matricule_fiscal: newMatricule,
      });
      loadCustomers();
    } catch (err) {
      setError(err.response?.data?.error || 'Échec de la modification');
    }
  };

  const handleDelete = async (customerId, customerName) => {
    setError('');
    const confirmed = window.confirm(`Supprimer le client "${customerName}" ?`);
    if (!confirmed) return;

    try {
      await api.delete(`/customers/${customerId}`);
      loadCustomers();
    } catch (err) {
      setError(err.response?.data?.error || 'Échec de la suppression');
    }
  };

  const handleRecordPayment = async (customer) => {
    setError('');
    const amount = window.prompt(
      `Montant payé par "${customer.name}" (solde actuel : ${customer.balance} DT) :`
    );
    if (amount === null) return;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Montant invalide');
      return;
    }

    try {
      await api.post(`/customers/${customer.id}/payments`, { amount: parsedAmount });
      loadCustomers();
    } catch (err) {
      setError(err.response?.data?.error || "Échec de l'enregistrement du paiement");
    }
  };

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Users size={26} /> Clients
      </h1>

      <form className="card responsive-form" onSubmit={handleAddCustomer}>
        <h3>Ajouter un client</h3>
        <input
          className="form-input"
          placeholder="Nom"
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
        <input
          className="form-input"
          placeholder="Adresse"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />{' '}
        <input
          className="form-input"
          placeholder="Matricule fiscal (ex: 1234567L/A/M/000)"
          value={matriculeFiscal}
          onChange={(e) => setMatriculeFiscal(e.target.value)}
        />{' '}
        <button className="btn btn-primary" type="submit">Ajouter</button>
        {error && <p className="badge badge-danger">{error}</p>}
      </form>

      <h3>Clients actuels</h3>
      <input
        className="form-input"
        placeholder="Rechercher un client..."
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
            <th>Adresse</th>
            <th>Matricule fiscal</th>
            <th>Solde</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredCustomers.map((c) => (
            <tr key={c.id} className={parseFloat(c.balance) > 0 ? 'row-warning' : ''}>
              <td>{c.name}</td>
              <td>{c.contact}</td>
              <td>{c.address}</td>
              <td>{c.matricule_fiscal || '—'}</td>
              <td>{c.balance} DT</td>
              <td>
                <button className="btn btn-secondary" onClick={() => handleRecordPayment(c)}>
                  Enregistrer paiement
                </button>{' '}
                {isAdmin && (
                  <>
                    <button className="btn btn-secondary" onClick={() => handleEditCustomer(c)}>
                      Modifier
                    </button>{' '}
                    <button className="btn btn-danger" onClick={() => handleDelete(c.id, c.name)}>
                      Supprimer
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </TableScroll>
    </div>
  );
}
