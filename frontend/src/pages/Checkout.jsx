import { useState, useEffect } from 'react';
import api from '../api';
import { ShoppingCart } from 'lucide-react';
import TableScroll from '../components/TableScroll';
import Receipt from './Receipt';
import { useAuth } from '../context/AuthContext';

export default function Checkout() {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cart, setCart] = useState([]); // [{ product_id, name, price, quantity, tva_rate }]
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');
  const [lastSale, setLastSale] = useState(null);
  const [summary, setSummary] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const { user } = useAuth();

  const loadData = async () => {
    const [productsRes, customersRes, summaryRes] = await Promise.all([
      api.get('/products'),
      api.get('/customers'),
      api.get('/dashboard/summary'),
    ]);
    setProducts(productsRes.data);
    setCustomers(customersRes.data);
    setSummary(summaryRes.data);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (showPrintModal) {
      const timer = setTimeout(() => {
        window.print();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showPrintModal]);

  const handleAddToCart = () => {
    setError('');
    if (!selectedProductId || quantity <= 0) return;

    const product = products.find((p) => p.id === parseInt(selectedProductId));
    if (!product) return;

    const existing = cart.find((item) => item.product_id === product.id);
    if (existing) {
      setCart(
        cart.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + parseInt(quantity) }
            : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          product_id: product.id,
          name: product.name,
          price: parseFloat(product.price),
          quantity: parseInt(quantity),
          tva_rate: parseFloat(product.tva_rate) || 0,
          unit: product.unit,
        },
      ]);
    }
    setSelectedProductId('');
    setQuantity(1);
  };

  const handleRemoveFromCart = (productId) => {
    setCart(cart.filter((item) => item.product_id !== productId));
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Break down the total into HT / TVA / TTC per line, based on each product's own TVA rate.
  // The price is TTC (already what the customer pays) - TVA is calculated backward out of it.
  const totalsBreakdown = cart.reduce(
    (acc, item) => {
      const lineTTC = item.price * item.quantity;
      const lineHT = lineTTC / (1 + item.tva_rate / 100);
      const lineTVA = lineTTC - lineHT;
      acc.ht += lineHT;
      acc.tva += lineTVA;
      acc.ttc += lineTTC;
      return acc;
    },
    { ht: 0, tva: 0, ttc: 0 }
  );

  const handleCheckout = async () => {
    setError('');
    setLastSale(null);

    if (!customerId) {
      setError('Veuillez sélectionner un client');
      return;
    }
    if (cart.length === 0) {
      setError('Le panier est vide');
      return;
    }

    const selectedCustomer = customers.find((c) => c.id === parseInt(customerId));

    try {
      const response = await api.post('/sales', {
        customer_id: parseInt(customerId),
        payment_method: paymentMethod,
        items: cart.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
      });

      setLastSale({
        id: response.data.sale.id,
        date: response.data.sale.date,
        customerName: selectedCustomer?.name,
        customerMatricule: selectedCustomer?.matricule_fiscal,
        paymentMethod,
        items: cart,
        total: response.data.total,
        breakdown: totalsBreakdown,
      });

      setCart([]);
      setCustomerId('');
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Échec de la vente');
    }
  };

  return (
    <div>
      {summary && (
        <div className="stats-grid">
          <div className="stat-card blue">
            <div className="stat-card-label">Ventes aujourd'hui</div>
            <div className="stat-card-value">{summary.todaySalesTotal.toFixed(2)} DT</div>
          </div>
          <div className="stat-card green">
            <div className="stat-card-label">Nombre de ventes aujourd'hui</div>
            <div className="stat-card-value">{summary.todaySalesCount}</div>
          </div>
          {summary.lowStockCount > 0 && (
            <div className="stat-card orange">
              <div className="stat-card-label">Produits en stock faible</div>
              <div className="stat-card-value">{summary.lowStockCount}</div>
            </div>
          )}
          {summary.totalOwedByCustomers > 0 && (
            <div className="stat-card purple">
              <div className="stat-card-label">Montant dû par les clients</div>
              <div className="stat-card-value">{summary.totalOwedByCustomers.toFixed(2)} DT</div>
            </div>
          )}
        </div>
      )}

      <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <ShoppingCart size={26} />
        Caisse
      </h1>

      <div className="control-row" style={{ marginBottom: '1rem' }}>
        <label>Client : </label>
        <select className="form-input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">-- Choisir un client --</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {parseFloat(c.balance) !== 0 ? `(solde: ${c.balance} DT)` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="control-row" style={{ marginBottom: '1.5rem' }}>
        <label>Produit : </label>
        <select className="form-input" value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}>
          <option value="">-- Choisir un produit --</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.stock_quantity} {p.unit} en stock) - {p.price} DT
            </option>
          ))}
        </select>{' '}
        <input
          className="form-input"
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          style={{ width: '60px' }}
        />{' '}
        <button className="btn btn-primary" onClick={handleAddToCart}>Ajouter au panier</button>
      </div>

      <h3>Panier</h3>
      <TableScroll>
      <table className="data-table">
        <thead>
          <tr>
            <th>Produit</th>
            <th>Quantité</th>
            <th>Prix unitaire</th>
            <th>TVA</th>
            <th>Sous-total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {cart.map((item) => (
            <tr key={item.product_id}>
              <td>{item.name}</td>
              <td>{item.quantity} {item.unit}</td>
              <td>{item.price} DT</td>
              <td>{item.tva_rate}%</td>
              <td>{(item.price * item.quantity).toFixed(2)} DT</td>
              <td>
                <button className="btn btn-danger" onClick={() => handleRemoveFromCart(item.product_id)}>Retirer</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </TableScroll>

      <p>Total HT : {totalsBreakdown.ht.toFixed(3)} DT</p>
      <p>Total TVA : {totalsBreakdown.tva.toFixed(3)} DT</p>
      <h3>Total TTC : {total.toFixed(2)} DT</h3>

      <div className="control-row" style={{ marginBottom: '1rem' }}>
        <label>Paiement : </label>
        <select className="form-input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
          <option value="cash">Espèces</option>
          <option value="card">Carte</option>
          <option value="credit">Crédit (paiement différé)</option>
        </select>
      </div>

      {error && <p className="badge badge-danger">{error}</p>}

      <button className="btn btn-primary" onClick={handleCheckout}>
        Encaisser
      </button>

      {lastSale && (
        <div className="card" style={{ maxWidth: '350px' }}>
          <p>
            <span className="badge badge-success">
              Vente enregistrée avec succès (Reçu #{lastSale.id})
            </span>
          </p>
          <button className="btn btn-secondary" onClick={() => setShowPrintModal(true)}>
            Imprimer le ticket
          </button>
        </div>
      )}

      {showPrintModal && lastSale && (
        <div className="modal-backdrop" onClick={() => setShowPrintModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>Ticket de caisse</h3>
              <button className="btn btn-danger" onClick={() => setShowPrintModal(false)}>
                Fermer
              </button>
            </div>
            <Receipt sale={lastSale} cashier={user?.username} />
          </div>
        </div>
      )}
    </div>
  );
}
