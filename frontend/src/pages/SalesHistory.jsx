import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { History } from 'lucide-react';
import TableScroll from '../components/TableScroll';

export default function SalesHistory() {
  const [sales, setSales] = useState([]);
  const [error, setError] = useState('');
  const { isAdmin } = useAuth();

  // NEW STATE
  const [editingSale, setEditingSale] = useState(null);
  const [editItems, setEditItems] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [editSelectedProductId, setEditSelectedProductId] = useState('');
  const [editQuantity, setEditQuantity] = useState(1);
  const [editError, setEditError] = useState('');
  const [issuingSaleId, setIssuingSaleId] = useState(null);
  const [invoiceMessage, setInvoiceMessage] = useState('');

  const loadSales = async () => {
    const response = await api.get('/sales');
    setSales(response.data);
  };

  // LOAD PRODUCTS ONCE
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await api.get('/products');
        setAllProducts(res.data);
      } catch (err) {
        console.error('Failed to load products', err);
      }
    };
    loadProducts();
  }, []);

  useEffect(() => {
    loadSales();
  }, []);

  const handleVoid = async (saleId) => {
    setError('');
    const confirmed = window.confirm(
      `Voulez-vous vraiment annuler la vente #${saleId} ? Le stock sera restauré.`
    );
    if (!confirmed) return;

    try {
      await api.post(`/sales/${saleId}/void`);
      loadSales();
    } catch (err) {
      setError(err.response?.data?.error || "Échec de l'annulation");
    }
  };

  const openEditModal = async (sale) => {
    setError('');
    setEditError('');
    setEditSelectedProductId('');
    setEditQuantity(1);
    try {
      const res = await api.get(`/sales/${sale.id}`);
      setEditingSale(sale);
      // map items to required shape
      const mapped = res.data.items.map(item => ({
        product_id: item.product_id,
        name: item.product_name,
        quantity: item.quantity,
        price: parseFloat(item.unit_price)
      }));
      setEditItems(mapped);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load sale for edit");
      setEditingSale(null);
    }
  };

  const handleIssueInvoice = async (sale) => {
    setInvoiceMessage('');
    setIssuingSaleId(sale.id);
    try {
      const resp = await api.post(`/invoices/from-sale/${sale.id}`);
      
      // Validate response structure before accessing properties
      if (!resp || !resp.data || !resp.data.invoice) {
        setInvoiceMessage('Failed to issue invoice: invalid response from server');
        setIssuingSaleId(null);
        return;
      }
      
      const invoice = resp.data.invoice;
      if (resp.status === 201) {
        setInvoiceMessage(`Facture ${invoice.invoice_number} émise`);
      } else if (resp.status === 200) {
        setInvoiceMessage(`Facture déjà émise : ${invoice.invoice_number}`);
      } else {
        setInvoiceMessage(`Statut inattendu : ${resp.status}`);
      }
      // refresh sales list so any UI reflecting invoices can update elsewhere
      loadSales();
    } catch (err) {
      setInvoiceMessage(err.response?.data?.error || 'Failed to issue invoice');
    } finally {
      setIssuingSaleId(null);
      // clear message after a short delay
      setTimeout(() => setInvoiceMessage(''), 5000);
    }
  };

  const closeEditModal = () => {
    setEditingSale(null);
    setEditItems([]);
    setEditError('');
  };

  const handleAddEditItem = () => {
    setEditError('');
    if (!editSelectedProductId || editQuantity <= 0) return;
    const product = allProducts.find(p => p.id === parseInt(editSelectedProductId));
    if (!product) return;
    // check if product already in editItems
    const existingIndex = editItems.findIndex(item => item.product_id === product.id);
    if (existingIndex >= 0) {
      // increase quantity
      const updated = [...editItems];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: updated[existingIndex].quantity + parseInt(editQuantity)
      };
      setEditItems(updated);
    } else {
      setEditItems([...editItems, {
        product_id: product.id,
        name: product.name,
        quantity: parseInt(editQuantity),
        price: parseFloat(product.price)
      }]);
    }
    setEditSelectedProductId('');
    setEditQuantity(1);
  };

  const handleRemoveEditItem = (productId) => {
    setEditError('');
    const filtered = editItems.filter(item => item.product_id !== productId);
    if (filtered.length === 0) {
      setEditError("La facture doit contenir au moins un article.");
      return;
    }
    setEditItems(filtered);
  };

  const handleSaveEdit = async () => {
    setEditError('');
    if (!editingSale) return;
    try {
      await api.put(`/sales/${editingSale.id}/edit`, {
        items: editItems.map(item => ({ product_id: item.product_id, quantity: item.quantity }))
      });
      closeEditModal();
      loadSales();
    } catch (err) {
      setEditError(err.response?.data?.error || "Failed to save changes");
    }
  };

  return (
    <div>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <History size={26} />
        Historique des ventes
      </h1>

      {error && <p className="badge badge-danger">{error}</p>}
      {invoiceMessage && <p className="badge badge-neutral">{invoiceMessage}</p>}

      <TableScroll>
      <table className="data-table">
        <thead>
          <tr>
            <th>N°</th>
            <th>Date</th>
            <th>Client</th>
            <th>Employé</th>
            <th>Total</th>
            <th>Paiement</th>
            <th>Statut</th>
            {isAdmin && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => (
            <tr key={sale.id} style={sale.status === 'voided' ? { opacity: 0.5 } : {}}>
              <td>{sale.id}</td>
              <td>{new Date(sale.date).toLocaleString('fr-FR')}</td>
              <td>{sale.customer_name}</td>
              <td>{sale.employee_username}</td>
              <td>{sale.total} DT</td>
              <td>
                {sale.payment_method === 'cash' ? (
                  <span className="badge badge-neutral">Espèces</span>
                ) : sale.payment_method === 'card' ? (
                  <span className="badge badge-neutral">Carte</span>
                ) : (
                  <span className="badge badge-warning">Crédit</span>
                )}
              </td>
              <td>
                <span className={sale.status === 'paid' ? 'badge badge-success' : 'badge badge-danger'}>
                  {sale.status === 'paid' ? 'Payée' : 'Annulée'}
                </span>
              </td>
              {isAdmin && (
                <td>
                  {sale.status === 'paid' && (
                    <>
                      <button className="btn btn-danger" onClick={() => handleVoid(sale.id)}>
                        Annuler
                      </button>{' '}
                      <button className="btn btn-secondary" onClick={() => openEditModal(sale)}>
                        Modifier
                      </button>
                        {' '}
                        <button
                          className="btn btn-primary"
                          onClick={() => handleIssueInvoice(sale)}
                          disabled={issuingSaleId === sale.id}
                        >
                          {issuingSaleId === sale.id ? 'Émission…' : 'Émettre facture'}
                        </button>
                    </>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </TableScroll>

      {editingSale && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3>Modifier la facture #{editingSale.id}</h3>

            <TableScroll>
            <table className="data-table" style={{ marginBottom: '1rem' }}>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Quantité</th>
                  <th>Prix unitaire</th>
                  <th>Sous-total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {editItems.map((item) => (
                  <tr key={item.product_id}>
                    <td>{item.name}</td>
                    <td>{item.quantity}</td>
                    <td>{item.price} DT</td>
                    <td>{(item.price * item.quantity).toFixed(2)} DT</td>
                    <td>
                      <button className="btn btn-danger" onClick={() => handleRemoveEditItem(item.product_id)}>
                        Retirer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </TableScroll>

            <div className="control-row" style={{ marginBottom: '1rem' }}>
              <select
                className="form-input"
                value={editSelectedProductId}
                onChange={(e) => setEditSelectedProductId(e.target.value)}
              >
                <option value="">-- Ajouter un produit --</option>
                {allProducts.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} - {p.price} DT</option>
                ))}
              </select>{' '}
              <input
                className="form-input"
                type="number"
                min="1"
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
                style={{ width: '70px' }}
              />{' '}
              <button className="btn btn-primary" onClick={handleAddEditItem}>Ajouter</button>
            </div>

            <p><strong>Nouveau total : {editItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)} DT</strong></p>

            {editError && <p className="badge badge-danger">{editError}</p>}

            <div className="modal-actions" style={{ marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={handleSaveEdit}>Enregistrer les modifications</button>
              <button className="btn btn-secondary" onClick={closeEditModal}>Annuler la modification</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
